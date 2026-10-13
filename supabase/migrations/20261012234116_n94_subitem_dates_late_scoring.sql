-- N94: additive nullable fields; no backfill, data rewrite or bulk projection.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table rakeezx.score_subitems
  add column start_date date,
  add column due_date date,
  add column late_points numeric,
  add constraint n94_subitem_dates check (start_date is null or due_date is null or due_date >= start_date),
  add constraint n94_late_points check (late_points is null or
    (late_points >= 0 and late_points <= value and late_points = round(late_points,2)));
alter table rakeezx.score_subitem_completions
  add column completion_state text,
  add constraint n94_completion_state check (completion_state is null or
    (checked and completion_state in ('regular','late')));

CREATE OR REPLACE FUNCTION rakeezx.sync_v2_field_map(p_entity text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case p_entity
when 'score_subitems' then '{"item_id":"identity","name":"name","value":"configuration","order":"order","distribution_version":"configuration","start_date":"configuration","due_date":"configuration","late_points":"configuration"}'::jsonb
when 'score_subitem_completions' then '{"student_id":"identity","subitem_id":"identity","checked":"state","completion_state":"state"}'::jsonb
when 'assignments' then '{"teaching_id":"identity","lesson_id":"identity","item_id":"identity","title":"content","assigned_date":"dates","due_date":"dates","max":"grading"}'::jsonb
when 'submissions' then '{"student_id":"identity","assignment_id":"identity","status":"content","score":"content","note":"content"}'::jsonb
else rakeezx.sync_v2_field_map_before_n71(p_entity) end;
$function$;

CREATE OR REPLACE FUNCTION rakeezx.guard_subitem_definition_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if pg_catalog.current_setting('rakeezx.score_domain_write',true) is distinct from 'on' then
    if tg_table_name='items' then
      if new.score_mode='subitems' or (tg_op='UPDATE' and old.score_mode='subitems') then
        raise exception using errcode='42501',message='Subitem configuration requires atomic score domain command';
      end if;
    else
      raise exception using errcode='42501',message='Subitem mutation requires atomic score domain command';
    end if;
  end if;
  if tg_table_name='score_subitems' and tg_op='UPDATE' and
      new.created_at is distinct from old.created_at then
    raise exception using errcode='42501',message='Subitem creation history is immutable';
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.recompute_subitem_score(p_owner uuid, p_item text, p_student text, p_device text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_max numeric(6,2); v_derived numeric(6,2); v_sum numeric; v_manual numeric(6,2);
  v_recorded boolean; v_exists boolean; v_score rakeezx.scores%rowtype;
begin
  select max into v_max from rakeezx.items where owner_id=p_owner and id=p_item and
    score_mode='subitems' and deleted_at is null;
  if v_max is null then raise exception using errcode='22023',message='Subitem parent unavailable'; end if;
  select coalesce(sum(case when c.completion_state='late' then coalesce(d.late_points,d.value) else d.value end),0),count(*)>0 into v_sum,v_recorded
    from rakeezx.score_subitem_completions c
    join rakeezx.score_subitems d on d.owner_id=c.owner_id and d.id=c.subitem_id
    where c.owner_id=p_owner and c.student_id=p_student and c.checked and c.deleted_at is null
      and d.item_id=p_item and d.deleted_at is null;
  v_derived:=least(v_max,v_sum);
  select * into v_score from rakeezx.scores where owner_id=p_owner and student_id=p_student
    and item_id=p_item for update;
  v_exists:=found;
  v_manual:=case when v_score.manual_value is null then null
    else least(greatest(v_score.manual_value,0),greatest(v_max-v_derived,0)) end;
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  if v_exists then
    update rakeezx.scores set derived_value=v_derived,manual_value=v_manual,
      value=case when v_recorded or v_manual is not null then v_derived+coalesce(v_manual,0) else null end,
      device_id=p_device where owner_id=p_owner and id=v_score.id returning * into v_score;
  else
    insert into rakeezx.scores(owner_id,id,student_id,item_id,derived_value,manual_value,value,device_id)
      values(p_owner,'sc:'||p_student||':'||p_item,p_student,p_item,v_derived,v_manual,
        case when v_recorded or v_manual is not null then v_derived+coalesce(v_manual,0) else null end,p_device)
      returning * into v_score;
  end if;
  return pg_catalog.to_jsonb(v_score);
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.assert_score_provenance_consistent(p_owner uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists(
    select 1 from rakeezx.items i where i.owner_id=p_owner and i.deleted_at is null
      and i.score_mode='subitems' and not exists(
        select 1 from rakeezx.score_subitems d where d.owner_id=i.owner_id
          and d.item_id=i.id and d.deleted_at is null)) then
    raise exception using errcode='22023',message='Subitem item has no definitions';
  end if;
  if exists(
    select 1 from rakeezx.score_subitem_completions c
    join rakeezx.score_subitems d on d.owner_id=c.owner_id and d.id=c.subitem_id
    where c.owner_id=p_owner and c.deleted_at is null and d.deleted_at is null and c.checked
      and not exists(select 1 from rakeezx.scores s where s.owner_id=c.owner_id
        and s.student_id=c.student_id and s.item_id=d.item_id and s.deleted_at is null)) then
    raise exception using errcode='22023',message='Checked completion has no materialized score';
  end if;
  if exists(
    select 1 from rakeezx.scores s
    join rakeezx.items i on i.owner_id=s.owner_id and i.id=s.item_id
    cross join lateral (
      select least(i.max,coalesce(sum(case when c.completion_state='late' then coalesce(d.late_points,d.value) else d.value end) filter(where c.checked and c.deleted_at is null
        and d.deleted_at is null),0)) derived,
        count(*) filter(where c.checked and c.deleted_at is null and d.deleted_at is null)>0 recorded
      from rakeezx.score_subitems d
      left join rakeezx.score_subitem_completions c on c.owner_id=d.owner_id
        and c.subitem_id=d.id and c.student_id=s.student_id
      where d.owner_id=s.owner_id and d.item_id=s.item_id
    ) projection
    where s.owner_id=p_owner and s.deleted_at is null and i.deleted_at is null
      and i.score_mode='subitems' and (
        s.derived_value is distinct from projection.derived or
        (s.manual_value is not null and (s.manual_value<0 or s.manual_value>i.max-projection.derived)) or
        s.value is distinct from (case when projection.recorded or s.manual_value is not null
          then projection.derived+coalesce(s.manual_value,0) else null end)
      )) then
    raise exception using errcode='22023',message='Subitem score provenance diverged';
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.apply_score_subitem_command(p_mutation_id text, p_device_id text, p_command text, p_item_id text, p_student_id text, p_subitem_id text DEFAULT NULL::text, p_checked boolean DEFAULT NULL::boolean, p_manual_value numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_envelope jsonb; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_item rakeezx.items%rowtype; v_completion rakeezx.score_subitem_completions%rowtype;
  v_score jsonb; v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or char_length(p_mutation_id)>200 or
     coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
     p_command not in ('set_completion','set_manual') or
     coalesce(p_item_id,'')='' or coalesce(p_student_id,'')='' or
     (p_command='set_completion' and (p_subitem_id is null or p_checked is null)) or
     (p_command='set_manual' and (p_subitem_id is not null or p_checked is not null)) or
     (p_manual_value is not null and (p_manual_value<0 or p_manual_value>9999.99 or
       p_manual_value<>pg_catalog.round(p_manual_value,2))) then
    raise exception using errcode='22023',message='Invalid score domain command';
  end if;
  v_envelope:=pg_catalog.jsonb_build_object('deviceId',p_device_id,'command',p_command,
    'itemId',p_item_id,'studentId',p_student_id,'subitemId',p_subitem_id,
    'checked',p_checked,'manualValue',p_manual_value);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.score_domain_receipts
    where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Score mutation ID reused with different content';
    end if;
    return v_receipt.result;
  end if;
  -- The item row serializes completion, manual and definition changes across devices.
  select * into v_item from rakeezx.items where owner_id=v_owner and id=p_item_id
    and deleted_at is null for update;
  if not found or v_item.score_mode<>'subitems' or not exists(
    select 1 from rakeezx.students where owner_id=v_owner and id=p_student_id and deleted_at is null
  ) then raise exception using errcode='22023',message='Score item or student unavailable'; end if;
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  if p_command='set_completion' then
    if not exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and id=p_subitem_id
      and item_id=p_item_id and deleted_at is null) then
      raise exception using errcode='22023',message='Subitem unavailable';
    end if;
    insert into rakeezx.score_subitem_completions(owner_id,id,student_id,subitem_id,checked,completion_state,device_id)
      values(v_owner,'ssc:'||p_student_id||':'||p_subitem_id,p_student_id,p_subitem_id,p_checked,case when p_checked then 'regular' else null end,p_device_id)
      on conflict(owner_id,id) do update set checked=excluded.checked,completion_state=excluded.completion_state,device_id=excluded.device_id
        where rakeezx.score_subitem_completions.deleted_at is null
      returning * into v_completion;
    if not found then raise exception using errcode='22023',message='Deleted completion cannot be resurrected'; end if;
  else
    -- The requested amount is provisional until the authoritative projection clamps it.
    insert into rakeezx.scores(owner_id,id,student_id,item_id,manual_value,device_id)
      values(v_owner,'sc:'||p_student_id||':'||p_item_id,p_student_id,p_item_id,p_manual_value,p_device_id)
      on conflict(owner_id,id) do update set manual_value=excluded.manual_value,device_id=excluded.device_id;
  end if;
  v_score:=rakeezx.recompute_subitem_score(v_owner,p_item_id,p_student_id,p_device_id);
  v_result:=pg_catalog.jsonb_build_object('mutationId',p_mutation_id,'itemId',p_item_id,
    'studentId',p_student_id,'score',v_score,'completion',
    case when p_command='set_completion' then pg_catalog.to_jsonb(v_completion) else null end);
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.apply_score_subitem_command_n94(p_mutation_id text, p_device_id text, p_command text, p_item_id text, p_student_id text, p_subitem_id text DEFAULT NULL::text, p_completion_state text DEFAULT NULL::text, p_manual_value numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_envelope jsonb; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_item rakeezx.items%rowtype; v_completion rakeezx.score_subitem_completions%rowtype;
  v_score jsonb; v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or char_length(p_mutation_id)>200 or
     coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
     p_command is null or p_command not in ('set_completion','set_manual') or
     coalesce(p_item_id,'')='' or coalesce(p_student_id,'')='' or
     (p_command='set_completion' and (p_subitem_id is null or (p_completion_state is not null and p_completion_state not in ('regular','late')))) or
     (p_command='set_manual' and (p_subitem_id is not null or p_completion_state is not null)) or
     (p_manual_value is not null and (p_manual_value<0 or p_manual_value>9999.99 or
       p_manual_value<>pg_catalog.round(p_manual_value,2))) then
    raise exception using errcode='22023',message='Invalid score domain command';
  end if;
  v_envelope:=pg_catalog.jsonb_build_object('deviceId',p_device_id,'command',p_command,
    'itemId',p_item_id,'studentId',p_student_id,'subitemId',p_subitem_id,
    'completionState',p_completion_state,'manualValue',p_manual_value);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.score_domain_receipts
    where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Score mutation ID reused with different content';
    end if;
    return v_receipt.result;
  end if;
  -- The item row serializes completion, manual and definition changes across devices.
  select * into v_item from rakeezx.items where owner_id=v_owner and id=p_item_id
    and deleted_at is null for update;
  if not found or v_item.score_mode<>'subitems' or not exists(
    select 1 from rakeezx.students where owner_id=v_owner and id=p_student_id and deleted_at is null
  ) then raise exception using errcode='22023',message='Score item or student unavailable'; end if;
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  if p_command='set_completion' then
    if not exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and id=p_subitem_id
      and item_id=p_item_id and deleted_at is null) then
      raise exception using errcode='22023',message='Subitem unavailable';
    end if;
    insert into rakeezx.score_subitem_completions(owner_id,id,student_id,subitem_id,checked,completion_state,device_id)
      values(v_owner,'ssc:'||p_student_id||':'||p_subitem_id,p_student_id,p_subitem_id,p_completion_state is not null,p_completion_state,p_device_id)
      on conflict(owner_id,id) do update set checked=excluded.checked,completion_state=excluded.completion_state,device_id=excluded.device_id
        where rakeezx.score_subitem_completions.deleted_at is null
      returning * into v_completion;
    if not found then raise exception using errcode='22023',message='Deleted completion cannot be resurrected'; end if;
  else
    -- The requested amount is provisional until the authoritative projection clamps it.
    insert into rakeezx.scores(owner_id,id,student_id,item_id,manual_value,device_id)
      values(v_owner,'sc:'||p_student_id||':'||p_item_id,p_student_id,p_item_id,p_manual_value,p_device_id)
      on conflict(owner_id,id) do update set manual_value=excluded.manual_value,device_id=excluded.device_id;
  end if;
  v_score:=rakeezx.recompute_subitem_score(v_owner,p_item_id,p_student_id,p_device_id);
  v_result:=pg_catalog.jsonb_build_object('mutationId',p_mutation_id,'itemId',p_item_id,
    'studentId',p_student_id,'score',v_score,'completion',
    case when p_command='set_completion' then pg_catalog.to_jsonb(v_completion) else null end);
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $function$;

revoke all on function rakeezx.apply_score_subitem_command_n94(text,text,text,text,text,text,text,numeric) from public,anon;
grant execute on function rakeezx.apply_score_subitem_command_n94(text,text,text,text,text,text,text,numeric) to authenticated;

CREATE OR REPLACE FUNCTION rakeezx.apply_score_configuration_command(p_mutation_id text, p_device_id text, p_item_id text, p_expected_version bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_envelope jsonb; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_item rakeezx.items%rowtype; v_mode text; v_distribution text; v_max numeric(6,2);
  v_definition jsonb; v_id text; v_name text; v_value numeric(6,2); v_order integer;
  v_start date; v_due date; v_late numeric; v_old rakeezx.score_subitems%rowtype;
  v_count integer; v_position integer:=0; v_total_cents bigint; v_each bigint;
  v_ids text[]:='{}'::text[]; v_student text; v_result jsonb; v_scores jsonb:='[]'::jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or char_length(p_mutation_id)>200 or
     coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
     coalesce(p_item_id,'')='' or p_expected_version is null or p_expected_version<1 or
     p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object' or
     pg_catalog.jsonb_typeof(p_payload->'subitems')<>'array' then
    raise exception using errcode='22023',message='Invalid score configuration envelope';
  end if;
  v_envelope:=pg_catalog.jsonb_build_object('deviceId',p_device_id,'itemId',p_item_id,
    'expectedVersion',p_expected_version,'payload',p_payload);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.score_domain_receipts
    where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Score mutation ID reused with different content';
    end if;
    return v_receipt.result;
  end if;
  select * into v_item from rakeezx.items where owner_id=v_owner and id=p_item_id
    and deleted_at is null for update;
  if not found or v_item.distribution_version<>p_expected_version then
    raise exception using errcode='40001',message='Score configuration revision changed';
  end if;
  v_mode:=p_payload->>'scoreMode';
  v_distribution:=p_payload->>'distributionMode';
  if (p_payload->>'max')::numeric is distinct from
      pg_catalog.round((p_payload->>'max')::numeric,2) then
    raise exception using errcode='22023',message='Score maximum requires two-decimal precision';
  end if;
  v_max:=(p_payload->>'max')::numeric(6,2);
  v_count:=pg_catalog.jsonb_array_length(p_payload->'subitems');
  if v_mode is null or v_mode not in ('direct','subitems') or v_max is null or v_max<=0 or
     (v_mode='subitems' and (v_distribution is null or v_distribution not in ('auto','manual') or v_count<1 or v_count>200)) or
     (v_mode='direct' and v_count<>0) then
    raise exception using errcode='22023',message='Invalid score configuration';
  end if;
  if v_item.score_mode='direct' and v_mode='subitems' and exists(
    select 1 from rakeezx.scores where owner_id=v_owner and item_id=p_item_id
      and deleted_at is null and value is not null
  ) and (p_payload->>'conversionStrategy') is distinct from 'retain-as-manual' then
    raise exception using errcode='22023',message='Direct scores require reviewed conversion';
  end if;
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  if v_item.score_mode='direct' and v_mode='subitems' then
    update rakeezx.scores set manual_value=value,derived_value=0
      where owner_id=v_owner and item_id=p_item_id and deleted_at is null;
  end if;
  update rakeezx.items set max=v_max,score_mode=v_mode,
    distribution_mode=case when v_mode='subitems' then v_distribution else null end,
    portability_group_id=case when v_mode='subitems' then null else portability_group_id end,
    distribution_version=p_expected_version+1,device_id=p_device_id
    where owner_id=v_owner and id=p_item_id returning * into v_item;
  if v_mode='direct' then
    update rakeezx.scores set manual_value=null,derived_value=null,device_id=p_device_id
      where owner_id=v_owner and item_id=p_item_id and deleted_at is null;
  else
    v_total_cents:=pg_catalog.round(v_max*100)::bigint;
    v_each:=v_total_cents/v_count;
    for v_definition in select value from pg_catalog.jsonb_array_elements(p_payload->'subitems') loop
      v_position:=v_position+1;
      v_id:=v_definition->>'id'; v_name:=v_definition->>'name';
      if coalesce(v_id,'')='' or char_length(v_id)>240 or coalesce(v_name,'')='' or
         v_id=any(v_ids) or pg_catalog.jsonb_typeof(v_definition)<>'object' then
        raise exception using errcode='22023',message='Invalid or duplicate subitem identity';
      end if;
      v_ids:=pg_catalog.array_append(v_ids,v_id);
      v_order:=v_position-1;
      if v_distribution='auto' then
        v_value:=(case when v_position=v_count then v_total_cents-v_each*(v_count-1)
          else v_each end)::numeric/100;
      else
        if (v_definition->>'value')::numeric is distinct from
            pg_catalog.round((v_definition->>'value')::numeric,2) then
          raise exception using errcode='22023',message='Subitem value requires two-decimal precision';
        end if;
        v_value:=(v_definition->>'value')::numeric(6,2);
        if v_value is null or v_value<0 then
          raise exception using errcode='22023',message='Invalid manual subitem value';
        end if;
      end if;
      if exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and id=v_id
        and (item_id<>p_item_id or deleted_at is not null)) then
        raise exception using errcode='22023',message='Subitem identity is unavailable';
      end if;
      select * into v_old from rakeezx.score_subitems where owner_id=v_owner and id=v_id;
      v_start:=case when v_definition ? 'startDate' then nullif(v_definition->>'startDate','')::date else v_old.start_date end;
      v_due:=case when v_definition ? 'dueDate' then nullif(v_definition->>'dueDate','')::date else v_old.due_date end;
      v_late:=case when v_definition ? 'latePoints' then nullif(v_definition->>'latePoints','')::numeric else v_old.late_points end;
      insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,"order",distribution_version,start_date,due_date,late_points,device_id)
        values(v_owner,v_id,p_item_id,v_name,v_value,v_order,p_expected_version+1,v_start,v_due,v_late,p_device_id)
        on conflict(owner_id,id) do update set name=excluded.name,value=excluded.value,
          "order"=excluded."order",distribution_version=excluded.distribution_version,
          start_date=excluded.start_date,due_date=excluded.due_date,late_points=excluded.late_points,device_id=excluded.device_id;
    end loop;
    update rakeezx.score_subitems set deleted_at=pg_catalog.clock_timestamp(),device_id=p_device_id
      where owner_id=v_owner and item_id=p_item_id and deleted_at is null and not(id=any(v_ids));
    for v_student in
      select distinct student_id from rakeezx.scores
        where owner_id=v_owner and item_id=p_item_id and deleted_at is null
      union
      select distinct c.student_id from rakeezx.score_subitem_completions c
        join rakeezx.score_subitems d on d.owner_id=c.owner_id and d.id=c.subitem_id
        where c.owner_id=v_owner and d.item_id=p_item_id and c.checked and c.deleted_at is null
    loop
      v_scores:=v_scores||pg_catalog.jsonb_build_array(
        rakeezx.recompute_subitem_score(v_owner,p_item_id,v_student,p_device_id));
    end loop;
  end if;
  v_result:=pg_catalog.jsonb_build_object('mutationId',p_mutation_id,
    'item',pg_catalog.to_jsonb(v_item),'scores',v_scores,
    'subitems',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d."order",d.id),'[]'::jsonb)
      from rakeezx.score_subitems d where d.owner_id=v_owner and d.item_id=p_item_id));
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.apply_score_distribution_copy_command(p_mutation_id text, p_device_id text, p_source_item_id text, p_source_revision bigint, p_target_teaching_id text, p_new_item_id text, p_subitem_ids jsonb, p_conflict_choice text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_envelope jsonb; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_source rakeezx.items%rowtype; v_source_teaching rakeezx.teachings%rowtype;
  v_target rakeezx.teachings%rowtype; v_source_section rakeezx.sections%rowtype;
  v_target_section rakeezx.sections%rowtype; v_definition rakeezx.score_subitems%rowtype;
  v_mapping jsonb; v_new_subitem text; v_new_item rakeezx.items%rowtype;
  v_subitems jsonb; v_result jsonb; v_count integer;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or pg_catalog.char_length(p_mutation_id)>200 or
     coalesce(p_device_id,'')='' or coalesce(p_source_item_id,'')='' or
     coalesce(p_target_teaching_id,'')='' or coalesce(p_new_item_id,'')='' or
     p_source_revision is null or p_source_revision<1 or
     pg_catalog.jsonb_typeof(p_subitem_ids)<>'object' or
     coalesce(p_conflict_choice,'') not in ('missing','add') then
    raise exception using errcode='22023',message='Invalid distribution copy envelope';
  end if;
  v_envelope:=pg_catalog.jsonb_build_object('deviceId',p_device_id,'sourceItemId',p_source_item_id,
    'sourceRevision',p_source_revision,'targetTeachingId',p_target_teaching_id,
    'newItemId',p_new_item_id,'subitemIds',p_subitem_ids,'conflictChoice',p_conflict_choice);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.score_domain_receipts
    where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Copy mutation ID reused with different content'; end if;
    return v_receipt.result;
  end if;
  select * into v_source from rakeezx.items where owner_id=v_owner and id=p_source_item_id
    and deleted_at is null for update;
  select * into v_target from rakeezx.teachings where owner_id=v_owner
    and id=p_target_teaching_id and deleted_at is null for update;
  if v_source.id is null or v_target.id is null or v_source.revision<>p_source_revision then
    raise exception using errcode='40001',message='Copy source or target is stale'; end if;
  select * into v_source_teaching from rakeezx.teachings where owner_id=v_owner
    and id=v_source.teaching_id and deleted_at is null;
  select * into v_source_section from rakeezx.sections where owner_id=v_owner
    and id=v_source_teaching.section_id and deleted_at is null;
  select * into v_target_section from rakeezx.sections where owner_id=v_owner
    and id=v_target.section_id and deleted_at is null;
  if v_source_teaching.id is null or v_source_section.id is null or v_target_section.id is null or
     v_source_section.status='archived' or v_target_section.status='archived' or
     v_source_teaching.id=v_target.id or v_source_section.id=v_target_section.id or
     v_source_teaching.subject_id<>v_target.subject_id or
     v_source_teaching.term_id<>v_target.term_id or
     v_source_section.year_id<>v_target_section.year_id or
     v_source_section.grade<>v_target_section.grade then
    raise exception using errcode='22023',message='Copy crosses an academic boundary'; end if;
  if exists(select 1 from rakeezx.items where owner_id=v_owner and id=p_new_item_id) then
    raise exception using errcode='22023',message='Destination item identity already exists'; end if;
  if p_conflict_choice='missing' and exists(select 1 from rakeezx.items where owner_id=v_owner
    and teaching_id=v_target.id and name=v_source.name and deleted_at is null) then
    raise exception using errcode='40001',message='Destination classification changed'; end if;
  select count(*) into v_count from rakeezx.score_subitems where owner_id=v_owner
    and item_id=v_source.id and deleted_at is null;
  if (v_source.score_mode='subitems' and
      (v_count=0 or (select count(*) from pg_catalog.jsonb_object_keys(p_subitem_ids))<>v_count)) or
     (v_source.score_mode<>'subitems' and
       (select count(*) from pg_catalog.jsonb_object_keys(p_subitem_ids))<>0) then
    raise exception using errcode='22023',message='Copy subitem mapping is incomplete'; end if;
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  insert into rakeezx.items(owner_id,id,teaching_id,name,max,"order",auto,per_point,penalty,
    unit_id,lesson_id,score_mode,distribution_mode,distribution_version,
    distribution_origin_id,portability_group_id,device_id)
    values(v_owner,p_new_item_id,v_target.id,v_source.name,v_source.max,v_source."order",v_source.auto,
      v_source.per_point,v_source.penalty,v_source.unit_id,v_source.lesson_id,v_source.score_mode,
      v_source.distribution_mode,1,v_source.id,null,p_device_id)
    returning * into v_new_item;
  for v_definition in select * from rakeezx.score_subitems where owner_id=v_owner
      and item_id=v_source.id and deleted_at is null order by "order",id loop
    v_mapping:=p_subitem_ids->v_definition.id;
    v_new_subitem:=p_subitem_ids->>v_definition.id;
    if pg_catalog.jsonb_typeof(v_mapping)<>'string' or coalesce(v_new_subitem,'')='' or
       pg_catalog.char_length(v_new_subitem)>240 or exists(select 1 from rakeezx.score_subitems
         where owner_id=v_owner and id=v_new_subitem) then
      raise exception using errcode='22023',message='Copy subitem identity is invalid'; end if;
    insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,"order",distribution_version,start_date,due_date,late_points,device_id)
      values(v_owner,v_new_subitem,p_new_item_id,v_definition.name,v_definition.value,
        v_definition."order",1,v_definition.start_date,v_definition.due_date,v_definition.late_points,p_device_id);
  end loop;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d."order",d.id),'[]'::jsonb)
    into v_subitems from rakeezx.score_subitems d where d.owner_id=v_owner and d.item_id=p_new_item_id;
  v_result:=pg_catalog.jsonb_build_object('mutationId',p_mutation_id,
    'item',pg_catalog.to_jsonb(v_new_item),'subitems',v_subitems,'scores','[]'::jsonb);
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.stage_sync_v2_restore_score_v2(p_restore_id text, p_backup_hash text, p_backup_version integer, p_source_manifest jsonb, p_operations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_existing rakeezx.sync_restore_stages%rowtype;
  v_operation jsonb; v_entity text; v_id text; v_action text; v_patch jsonb;
  v_allowed jsonb; v_row jsonb; v_stage_hash text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_restore_id,'')='' or pg_catalog.char_length(p_restore_id)>200 or
     p_backup_hash !~ '^[a-f0-9]{64}$' or p_backup_version<>5 or
     pg_catalog.jsonb_typeof(p_source_manifest)<>'array' or
     pg_catalog.jsonb_typeof(p_operations)<>'array' then
    raise exception using errcode='22023',message='Invalid V5 restore envelope';
  end if;
  if p_source_manifest is distinct from rakeezx.sync_v2_backup_manifest_score_v2(v_owner) then
    raise exception using errcode='40001',message='Canonical source changed before V5 staging';
  end if;
  if pg_catalog.jsonb_array_length(p_operations)>10000 or exists(select 1 from (
    select value->>'entity' entity,value->>'recordId' record_id,count(*) n
    from pg_catalog.jsonb_array_elements(p_operations) group by 1,2 having count(*)>1
  ) duplicates) then
    raise exception using errcode='22023',message='Invalid V5 operation set';
  end if;
  for v_operation in select value from pg_catalog.jsonb_array_elements(p_operations) loop
    v_entity:=v_operation->>'entity'; v_id:=v_operation->>'recordId';
    v_action:=v_operation->>'operation'; v_patch:=coalesce(v_operation->'patch','{}'::jsonb);
    if not(v_entity=any(pg_catalog.array_append(pg_catalog.array_append(
      rakeezx.sync_v2_restore_entities(),'score_subitems'),'score_subitem_completions'))) or
      coalesce(v_id,'')='' or pg_catalog.char_length(v_id)>240 or
      v_action not in ('create','create_deleted','patch','delete') or
      pg_catalog.jsonb_typeof(v_patch)<>'object' or
      (v_action='delete' and v_patch<>'{}'::jsonb) then
      raise exception using errcode='22023',message='Invalid V5 restore operation';
    end if;
    if v_entity='profile' and v_id<>'profile' then
      raise exception using errcode='22023',message='Invalid V5 profile identity'; end if;
    v_allowed:=case when v_entity='closed_term_reports' then
      '{"term_id":1,"year_id":1,"version":1,"supersedes_id":1,"source_manifest":1,"payload":1,"state":1,"created_at":1}'::jsonb
      else rakeezx.sync_v2_field_map(v_entity) end;
    if v_entity='score_subitems' and v_action in ('create','create_deleted') then
      v_allowed:=v_allowed||'{"created_at":1}'::jsonb;
      if v_patch ? 'created_at' and ((v_patch->>'created_at') is null or
          not pg_catalog.isfinite((v_patch->>'created_at')::timestamptz) or
          (v_patch->>'created_at')::timestamptz <= '1970-01-01'::timestamptz) then
        raise exception using errcode='22023',message='Invalid subitem creation history';
      end if;
    end if;
    if v_allowed is null or exists(select 1 from pg_catalog.jsonb_object_keys(v_patch) f
      where not(v_allowed ? f)) then
      raise exception using errcode='22023',message='Unsupported V5 restore field'; end if;
    if v_entity='profile' then
      select pg_catalog.to_jsonb(t) into v_row from rakeezx.profile t where owner_id=v_owner;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from rakeezx.%I t where owner_id=$1 and id=$2',v_entity)
        into v_row using v_owner,v_id;
    end if;
    if (v_action in ('create','create_deleted') and
      (v_row is not null or coalesce((v_operation->>'baseRevision')::bigint,0)<>0)) or
       (v_action not in ('create','create_deleted') and
         (v_row is null or (v_row->>'deleted_at') is not null or
       (v_row->>'revision')::bigint<>coalesce((v_operation->>'baseRevision')::bigint,-1))) then
      raise exception using errcode='40001',message='V5 restore operation is stale'; end if;
    if v_action not in ('create','create_deleted') and
      (v_entity in ('score_subitems','score_subitem_completions') or
       (v_entity='items' and v_row->>'score_mode'='subitems') or
       (v_entity='scores' and exists(select 1 from rakeezx.items i where i.owner_id=v_owner
         and i.id=v_row->>'item_id' and i.score_mode='subitems'))) then
      raise exception using errcode='22023',message='Subitem domain restore change requires explicit review';
    end if;
  end loop;
  v_stage_hash:=pg_catalog.md5(p_backup_hash||':'||p_source_manifest::text||':'||p_operations::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':restore:'||p_restore_id,0));
  select * into v_existing from rakeezx.sync_restore_stages where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_existing.backup_hash,v_existing.backup_version,v_existing.stage_hash) is distinct from
       (p_backup_hash,p_backup_version,v_stage_hash) then
      raise exception using errcode='22023',message='V5 restore ID reused'; end if;
    return pg_catalog.jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,
      'stageHash',v_stage_hash,'state',v_existing.state);
  end if;
  insert into rakeezx.sync_restore_stages(owner_id,restore_id,backup_hash,backup_version,
    stage_hash,source_manifest,operations)
    values(v_owner,p_restore_id,p_backup_hash,5,v_stage_hash,p_source_manifest,p_operations);
  return pg_catalog.jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,
    'stageHash',v_stage_hash,'state','staged');
end; $function$;

CREATE OR REPLACE FUNCTION rakeezx.score_foundation_capability()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pg_catalog.jsonb_build_object('scoreDomainVersion',1,'restoreProtocol','CORE_V2',
    'backupVersion',5,'copyDomainVersion',1,'n94SubitemVersion',1);
$function$;

notify pgrst, 'reload schema';
