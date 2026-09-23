-- RAKEEZ X — additive score-subitem protocol. Never apply before the compatible client gate.
set lock_timeout = '10s';
begin;

alter table rakeezx.items
  add column if not exists score_mode text not null default 'direct'
    check (score_mode in ('direct','subitems')),
  add column if not exists distribution_mode text
    check (distribution_mode in ('auto','manual')),
  add column if not exists distribution_version bigint not null default 1
    check (distribution_version >= 1),
  add column if not exists distribution_origin_id text,
  add column if not exists portability_group_id text;
alter table rakeezx.scores
  add column if not exists manual_value numeric(6,2) check (manual_value >= 0),
  add column if not exists derived_value numeric(6,2) check (derived_value >= 0);

create table rakeezx.score_subitems (
  id text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id text not null,
  name text not null,
  value numeric(6,2) not null check (value >= 0),
  "order" integer not null default 0,
  distribution_version bigint not null default 1 check (distribution_version >= 1),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  client_updated_at bigint,
  device_id text,
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  field_revisions jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(field_revisions)='object'),
  primary key(owner_id,id),
  foreign key(owner_id,item_id) references rakeezx.items(owner_id,id) on delete cascade
);
create index score_subitems_item_idx on rakeezx.score_subitems(owner_id,item_id);

create table rakeezx.score_subitem_completions (
  id text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id text not null,
  subitem_id text not null,
  checked boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  client_updated_at bigint,
  device_id text,
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  field_revisions jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(field_revisions)='object'),
  primary key(owner_id,id),
  unique(owner_id,student_id,subitem_id),
  foreign key(owner_id,student_id) references rakeezx.students(owner_id,id) on delete cascade,
  foreign key(owner_id,subitem_id) references rakeezx.score_subitems(owner_id,id) on delete cascade
);
create index score_subitem_completions_student_idx
  on rakeezx.score_subitem_completions(owner_id,student_id);

alter table rakeezx.score_subitems enable row level security;
alter table rakeezx.score_subitems force row level security;
alter table rakeezx.score_subitem_completions enable row level security;
alter table rakeezx.score_subitem_completions force row level security;
create policy score_subitems_select on rakeezx.score_subitems for select to authenticated
  using(owner_id=(select auth.uid()));
create policy score_subitem_completions_select on rakeezx.score_subitem_completions for select to authenticated
  using(owner_id=(select auth.uid()));
revoke all on rakeezx.score_subitems,rakeezx.score_subitem_completions from public,anon,authenticated;
grant select on rakeezx.score_subitems,rakeezx.score_subitem_completions to authenticated;

create trigger score_subitems_owner before insert on rakeezx.score_subitems
  for each row execute function rakeezx.force_owner();
create trigger score_subitem_completions_owner before insert on rakeezx.score_subitem_completions
  for each row execute function rakeezx.force_owner();
create trigger score_subitems_touch before insert or update on rakeezx.score_subitems
  for each row execute function rakeezx.touch_updated_at();
create trigger score_subitem_completions_touch before insert or update on rakeezx.score_subitem_completions
  for each row execute function rakeezx.touch_updated_at();

alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_scores_0033;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable security definer set search_path='' as $$
  select case p_entity
    when 'score_subitems' then '{"item_id":"identity","name":"name","value":"configuration","order":"order","distribution_version":"configuration"}'::jsonb
    when 'score_subitem_completions' then '{"student_id":"identity","subitem_id":"identity","checked":"state"}'::jsonb
    when 'items' then rakeezx.sync_v2_field_map_before_scores_0033('items') ||
      '{"score_mode":"configuration","distribution_mode":"configuration","distribution_version":"configuration","distribution_origin_id":"identity","portability_group_id":"portability"}'::jsonb
    when 'scores' then rakeezx.sync_v2_field_map_before_scores_0033('scores') ||
      '{"manual_value":"manual","derived_value":"derived"}'::jsonb
    else rakeezx.sync_v2_field_map_before_scores_0033(p_entity)
  end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_scores_0033(text) from public;
create trigger score_subitems_sync_v2_revision before insert or update on rakeezx.score_subitems
  for each row execute function rakeezx.sync_v2_stamp_revision();
create trigger score_subitem_completions_sync_v2_revision before insert or update on rakeezx.score_subitem_completions
  for each row execute function rakeezx.sync_v2_stamp_revision();

-- A generic/legacy score write must never bypass subitem provenance.
create function rakeezx.guard_subitem_score_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from rakeezx.items i where i.owner_id=new.owner_id and i.id=new.item_id
      and i.score_mode='subitems') and
      pg_catalog.current_setting('rakeezx.score_domain_write',true) is distinct from 'on' then
    raise exception using errcode='42501',message='Subitem score requires atomic score domain command';
  end if;
  return new;
end; $$;
create trigger scores_subitem_write_guard before insert or update on rakeezx.scores
  for each row execute function rakeezx.guard_subitem_score_write();

-- Generic item/subitem/completion writes cannot publish partial definitions.
create function rakeezx.guard_subitem_definition_write() returns trigger
language plpgsql security definer set search_path='' as $$
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
  return new;
end; $$;
create trigger items_subitem_definition_guard before insert or update on rakeezx.items
  for each row execute function rakeezx.guard_subitem_definition_write();
create trigger score_subitems_definition_guard before insert or update on rakeezx.score_subitems
  for each row execute function rakeezx.guard_subitem_definition_write();
create trigger score_subitem_completions_definition_guard before insert or update on rakeezx.score_subitem_completions
  for each row execute function rakeezx.guard_subitem_definition_write();

create table rakeezx.score_domain_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null check (char_length(mutation_id) between 1 and 200),
  request_envelope jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key(owner_id,mutation_id)
);
alter table rakeezx.score_domain_receipts enable row level security;
alter table rakeezx.score_domain_receipts force row level security;
create policy score_domain_receipts_select on rakeezx.score_domain_receipts for select to authenticated
  using(owner_id=(select auth.uid()));
revoke all on rakeezx.score_domain_receipts from public,anon,authenticated;
grant select on rakeezx.score_domain_receipts to authenticated;

-- Called under the item lock. The server computes from committed components.
create function rakeezx.recompute_subitem_score(p_owner uuid,p_item text,p_student text,p_device text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_max numeric(6,2); v_derived numeric(6,2); v_sum numeric; v_manual numeric(6,2);
  v_recorded boolean; v_exists boolean; v_score rakeezx.scores%rowtype;
begin
  select max into v_max from rakeezx.items where owner_id=p_owner and id=p_item and
    score_mode='subitems' and deleted_at is null;
  if v_max is null then raise exception using errcode='22023',message='Subitem parent unavailable'; end if;
  select coalesce(sum(d.value),0),count(*)>0 into v_sum,v_recorded
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
end; $$;
revoke all on function rakeezx.recompute_subitem_score(uuid,text,text,text) from public,anon,authenticated;

-- One user action, one server transaction, one idempotent receipt.
create function rakeezx.apply_score_subitem_command(
  p_mutation_id text,p_device_id text,p_command text,p_item_id text,p_student_id text,
  p_subitem_id text default null,p_checked boolean default null,p_manual_value numeric default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
    insert into rakeezx.score_subitem_completions(owner_id,id,student_id,subitem_id,checked,device_id)
      values(v_owner,'ssc:'||p_student_id||':'||p_subitem_id,p_student_id,p_subitem_id,p_checked,p_device_id)
      on conflict(owner_id,id) do update set checked=excluded.checked,device_id=excluded.device_id
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
end; $$;
revoke all on function rakeezx.apply_score_subitem_command(text,text,text,text,text,text,boolean,numeric)
  from public,anon;
grant execute on function rakeezx.apply_score_subitem_command(text,text,text,text,text,text,boolean,numeric)
  to authenticated;

-- A configuration is published with every affected score, or not at all.
create function rakeezx.apply_score_configuration_command(
  p_mutation_id text,p_device_id text,p_item_id text,p_expected_version bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_envelope jsonb; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_item rakeezx.items%rowtype; v_mode text; v_distribution text; v_max numeric(6,2);
  v_definition jsonb; v_id text; v_name text; v_value numeric(6,2); v_order integer;
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
      insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,"order",distribution_version,device_id)
        values(v_owner,v_id,p_item_id,v_name,v_value,v_order,p_expected_version+1,p_device_id)
        on conflict(owner_id,id) do update set name=excluded.name,value=excluded.value,
          "order"=excluded."order",distribution_version=excluded.distribution_version,device_id=excluded.device_id;
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
end; $$;
revoke all on function rakeezx.apply_score_configuration_command(text,text,text,bigint,jsonb) from public,anon;
grant execute on function rakeezx.apply_score_configuration_command(text,text,text,bigint,jsonb)
  to authenticated;

-- One definition copy per source item/target teaching. The source canonical
-- definition is authoritative; the client supplies only fresh destination IDs.
create function rakeezx.apply_score_distribution_copy_command(
  p_mutation_id text,p_device_id text,p_source_item_id text,p_source_revision bigint,
  p_target_teaching_id text,p_new_item_id text,p_subitem_ids jsonb,p_conflict_choice text
) returns jsonb language plpgsql security definer set search_path='' as $$
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
    insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,"order",distribution_version,device_id)
      values(v_owner,v_new_subitem,p_new_item_id,v_definition.name,v_definition.value,
        v_definition."order",1,p_device_id);
  end loop;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d."order",d.id),'[]'::jsonb)
    into v_subitems from rakeezx.score_subitems d where d.owner_id=v_owner and d.item_id=p_new_item_id;
  v_result:=pg_catalog.jsonb_build_object('mutationId',p_mutation_id,
    'item',pg_catalog.to_jsonb(v_new_item),'subitems',v_subitems,'scores','[]'::jsonb);
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.apply_score_distribution_copy_command(
  text,text,text,bigint,text,text,jsonb,text) from public,anon;
grant execute on function rakeezx.apply_score_distribution_copy_command(
  text,text,text,bigint,text,text,jsonb,text) to authenticated;

create function rakeezx.score_foundation_capability() returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('scoreDomainVersion',1,'restoreProtocol','CORE_V2',
    'backupVersion',5,'copyDomainVersion',1);
$$;
revoke all on function rakeezx.score_foundation_capability() from public,anon;
grant execute on function rakeezx.score_foundation_capability() to authenticated;

-- CORE_V1 and the deployed full curriculum manifest remain byte-compatible.
create function rakeezx.sync_v2_restore_entities_score_v2() returns text[]
language sql immutable security definer set search_path='' as $$
  select pg_catalog.array_append(pg_catalog.array_append(
    rakeezx.sync_v2_restore_entities_full(),'score_subitems'),'score_subitem_completions');
$$;
revoke all on function rakeezx.sync_v2_restore_entities_score_v2() from public,anon;

create function rakeezx.sync_v2_restore_manifest_score_v2(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_manifest jsonb; v_entity text; v_part jsonb;
begin
  if p_owner is null or p_owner<>auth.uid() then
    raise exception using errcode='42501',message='Restore manifest owner mismatch';
  end if;
  v_manifest:=rakeezx.sync_v2_restore_manifest_full_before_score_0033(p_owner);
  foreach v_entity in array array['score_subitems','score_subitem_completions'] loop
    execute pg_catalog.format('select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      ''entity'',%L,''id'',id,''revision'',revision,''deleted'',deleted_at is not null)
      order by id),''[]''::jsonb) from rakeezx.%I where owner_id=$1',v_entity,v_entity)
      into v_part using p_owner;
    v_manifest:=v_manifest||v_part;
  end loop;
  return v_manifest;
end; $$;
revoke all on function rakeezx.sync_v2_restore_manifest_score_v2(uuid) from public,anon;
grant execute on function rakeezx.sync_v2_restore_manifest_score_v2(uuid) to authenticated;

create function rakeezx.sync_v2_restore_canonical_score_v2(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_canonical jsonb; v_entity text; v_part jsonb;
begin
  if p_owner is null or p_owner<>auth.uid() then
    raise exception using errcode='42501',message='Restore owner mismatch';
  end if;
  v_canonical:=rakeezx.sync_v2_restore_canonical_full_before_score_0033(p_owner);
  foreach v_entity in array array['score_subitems','score_subitem_completions'] loop
    execute pg_catalog.format('select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)
      order by t.id),''[]''::jsonb) from rakeezx.%I t where owner_id=$1',v_entity)
      into v_part using p_owner;
    v_canonical:=v_canonical||pg_catalog.jsonb_build_object(v_entity,v_part);
  end loop;
  return v_canonical;
end; $$;
revoke all on function rakeezx.sync_v2_restore_canonical_score_v2(uuid) from public,anon;
grant execute on function rakeezx.sync_v2_restore_canonical_score_v2(uuid) to authenticated;

-- The existing V3/V4 cloud-restore RPCs and entity list remain unchanged.
-- V5 uses the same owner-scoped stage/receipt tables but separate RPC names.
alter table rakeezx.sync_restore_stages
  drop constraint if exists sync_restore_stages_backup_version_check;
alter table rakeezx.sync_restore_stages
  add constraint sync_restore_stages_backup_version_check check(backup_version in (3,4,5));

create function rakeezx.sync_v2_backup_manifest_score_v2(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb; v_entity text; v_part jsonb;
begin
  if p_owner is null or p_owner<>auth.uid() then
    raise exception using errcode='42501',message='Backup manifest owner mismatch';
  end if;
  v_rows:=rakeezx.sync_v2_restore_manifest(p_owner);
  foreach v_entity in array array['score_subitems','score_subitem_completions'] loop
    execute pg_catalog.format('select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      ''entity'',%L,''id'',id,''revision'',revision,''deleted'',deleted_at is not null)
      order by id),''[]''::jsonb) from rakeezx.%I where owner_id=$1',v_entity,v_entity)
      into v_part using p_owner;
    v_rows:=v_rows||v_part;
  end loop;
  return v_rows;
end; $$;
revoke all on function rakeezx.sync_v2_backup_manifest_score_v2(uuid) from public,anon;

create function rakeezx.sync_v2_backup_canonical_score_v2(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb; v_entity text; v_part jsonb;
begin
  if p_owner is null or p_owner<>auth.uid() then
    raise exception using errcode='42501',message='Backup owner mismatch';
  end if;
  v_rows:=rakeezx.sync_v2_restore_canonical(p_owner);
  foreach v_entity in array array['score_subitems','score_subitem_completions'] loop
    execute pg_catalog.format('select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)
      order by t.id),''[]''::jsonb) from rakeezx.%I t where owner_id=$1',v_entity)
      into v_part using p_owner;
    v_rows:=v_rows||pg_catalog.jsonb_build_object(v_entity,v_part);
  end loop;
  return v_rows;
end; $$;
revoke all on function rakeezx.sync_v2_backup_canonical_score_v2(uuid) from public,anon;

create function rakeezx.assert_score_provenance_consistent(p_owner uuid)
returns void language plpgsql stable security definer set search_path='' as $$
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
      select least(i.max,coalesce(sum(d.value) filter(where c.checked and c.deleted_at is null
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
end; $$;
revoke all on function rakeezx.assert_score_provenance_consistent(uuid) from public,anon,authenticated;

create function rakeezx.stage_sync_v2_restore_score_v2(
  p_restore_id text,p_backup_hash text,p_backup_version integer,
  p_source_manifest jsonb,p_operations jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
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
end; $$;
revoke all on function rakeezx.stage_sync_v2_restore_score_v2(text,text,integer,jsonb,jsonb)
  from public,anon;
grant execute on function rakeezx.stage_sync_v2_restore_score_v2(text,text,integer,jsonb,jsonb)
  to authenticated;

create function rakeezx.finalize_sync_v2_restore_score_v2(
  p_restore_id text,p_backup_hash text,p_expected_stage_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_stage rakeezx.sync_restore_stages%rowtype;
  v_receipt rakeezx.sync_restore_receipts%rowtype; v_operation jsonb;
  v_entity text; v_id text; v_action text; v_patch jsonb; v_columns text; v_values text;
  v_sets text; v_field text; v_sql text; v_row jsonb; v_canonical jsonb; v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':restore:'||p_restore_id,0));
  select * into v_receipt from rakeezx.sync_restore_receipts where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_receipt.backup_hash,v_receipt.stage_hash) is distinct from
      (p_backup_hash,p_expected_stage_hash) then
      raise exception using errcode='22023',message='V5 restore receipt mismatch'; end if;
    return v_receipt.result;
  end if;
  select * into v_stage from rakeezx.sync_restore_stages
    where owner_id=v_owner and restore_id=p_restore_id for update;
  if not found or v_stage.backup_version<>5 or
    (v_stage.backup_hash,v_stage.stage_hash) is distinct from
      (p_backup_hash,p_expected_stage_hash) then
    raise exception using errcode='22023',message='V5 restore stage mismatch'; end if;
  if v_stage.source_manifest is distinct from rakeezx.sync_v2_backup_manifest_score_v2(v_owner) then
    raise exception using errcode='40001',message='Canonical source changed after V5 staging'; end if;
  perform pg_catalog.set_config('rakeezx.sync_v2_attendance_snapshot','on',true);
  perform pg_catalog.set_config('rakeezx.section_lifecycle_write','on',true);
  perform pg_catalog.set_config('rakeezx.section_lifecycle_delete','on',true);
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  for v_operation in select value from pg_catalog.jsonb_array_elements(v_stage.operations) loop
    v_entity:=v_operation->>'entity'; v_id:=v_operation->>'recordId';
    v_action:=v_operation->>'operation'; v_patch:=coalesce(v_operation->'patch','{}'::jsonb);
    v_columns:=''; v_values:=''; v_sets:='';
    if v_entity='profile' then
      select pg_catalog.to_jsonb(t) into v_row from rakeezx.profile t where owner_id=v_owner for update;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from rakeezx.%I t
        where owner_id=$1 and id=$2 for update',v_entity) into v_row using v_owner,v_id;
    end if;
    if (v_action in ('create','create_deleted') and v_row is not null) or
      (v_action not in ('create','create_deleted') and
        (v_row is null or (v_row->>'deleted_at') is not null or
        (v_row->>'revision')::bigint<>(v_operation->>'baseRevision')::bigint)) then
      raise exception using errcode='40001',message='Canonical source changed during V5 finalize'; end if;
    if v_action in ('create','create_deleted') then
      for v_field in select pg_catalog.jsonb_object_keys(v_patch) order by 1 loop
        v_columns:=v_columns||pg_catalog.format(',%I',v_field);
        v_values:=v_values||pg_catalog.format(',p.%I',v_field);
      end loop;
      if v_entity='profile' then
        v_sql:=pg_catalog.format('insert into rakeezx.profile(owner_id,device_id,client_updated_at%s)
          select $1,$2,$3%s from pg_catalog.jsonb_populate_record(null::rakeezx.profile,$4) p',v_columns,v_values);
        execute v_sql using v_owner,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_patch;
      else
        v_sql:=pg_catalog.format('insert into rakeezx.%I(owner_id,id,device_id,client_updated_at%s)
          select $1,$2,$3,$4%s from pg_catalog.jsonb_populate_record(null::rakeezx.%I,$5) p',
          v_entity,v_columns,v_values,v_entity);
        execute v_sql using v_owner,v_id,'restore:'||p_restore_id,
          (v_operation->>'clientUpdatedAt')::bigint,v_patch;
      end if;
      if v_action='create_deleted' then
        if v_entity='profile' then
          update rakeezx.profile set deleted_at=pg_catalog.clock_timestamp()
            where owner_id=v_owner;
        else
          execute pg_catalog.format('update rakeezx.%I set deleted_at=pg_catalog.clock_timestamp()
            where owner_id=$1 and id=$2',v_entity) using v_owner,v_id;
        end if;
      end if;
    elsif v_action='delete' then
      if v_entity='profile' then
        update rakeezx.profile set deleted_at=pg_catalog.clock_timestamp(),
          device_id='restore:'||p_restore_id where owner_id=v_owner;
      else
        execute pg_catalog.format('update rakeezx.%I set deleted_at=pg_catalog.clock_timestamp(),
          device_id=$1 where owner_id=$2 and id=$3',v_entity)
          using 'restore:'||p_restore_id,v_owner,v_id;
      end if;
    else
      for v_field in select pg_catalog.jsonb_object_keys(v_patch) order by 1 loop
        if v_sets<>'' then v_sets:=v_sets||','; end if;
        v_sets:=v_sets||pg_catalog.format('%I=(select p.%I from pg_catalog.jsonb_populate_record(null::rakeezx.%I,$1) p)',
          v_field,v_field,v_entity);
      end loop;
      if v_sets='' then continue; end if;
      v_sets:=v_sets||',device_id=$2,client_updated_at=$3';
      if v_entity='profile' then
        execute 'update rakeezx.profile set '||v_sets||' where owner_id=$4'
          using v_patch,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_owner;
      else
        execute pg_catalog.format('update rakeezx.%I set %s where owner_id=$4 and id=$5',v_entity,v_sets)
          using v_patch,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_owner,v_id;
      end if;
    end if;
  end loop;
  perform rakeezx.assert_score_provenance_consistent(v_owner);
  v_canonical:=rakeezx.sync_v2_backup_canonical_score_v2(v_owner);
  v_result:=pg_catalog.jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,
    'stageHash',p_expected_stage_hash,
    'receipt',pg_catalog.jsonb_build_object('restoreId',p_restore_id,'status','finalized'),
    'canonical',v_canonical);
  insert into rakeezx.sync_restore_receipts(owner_id,restore_id,backup_hash,stage_hash,result)
    values(v_owner,p_restore_id,p_backup_hash,p_expected_stage_hash,v_result);
  update rakeezx.sync_restore_stages set state='finalized',finalized_at=pg_catalog.clock_timestamp()
    where owner_id=v_owner and restore_id=p_restore_id;
  return v_result;
end; $$;
revoke all on function rakeezx.finalize_sync_v2_restore_score_v2(text,text,text) from public,anon;
grant execute on function rakeezx.finalize_sync_v2_restore_score_v2(text,text,text) to authenticated;

-- Old clients cannot declare a numeric-only restore complete for a workspace
-- containing active subitem scores. Keep their contract for DIRECT workspaces.
alter function rakeezx.sync_v2_restore_manifest_full(uuid)
  rename to sync_v2_restore_manifest_full_before_score_0033;
alter function rakeezx.sync_v2_restore_canonical_full(uuid)
  rename to sync_v2_restore_canonical_full_before_score_0033;
alter function rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb)
  rename to stage_sync_v2_restore_before_score_0033;
alter function rakeezx.finalize_sync_v2_restore(text,text,text)
  rename to finalize_sync_v2_restore_before_score_0033;
revoke all on function rakeezx.sync_v2_restore_manifest_full_before_score_0033(uuid) from public,anon,authenticated;
revoke all on function rakeezx.sync_v2_restore_canonical_full_before_score_0033(uuid) from public,anon,authenticated;
revoke all on function rakeezx.stage_sync_v2_restore_before_score_0033(text,text,integer,jsonb,jsonb) from public,anon,authenticated;
revoke all on function rakeezx.finalize_sync_v2_restore_before_score_0033(text,text,text) from public,anon,authenticated;

create function rakeezx.assert_legacy_score_restore_safe(p_owner uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if p_owner is null or p_owner<>auth.uid() then
    raise exception using errcode='42501',message='Restore owner mismatch';
  end if;
  if exists(select 1 from rakeezx.items where owner_id=p_owner
    and score_mode='subitems') then
    raise exception using errcode='42501',message='RESTORE_PROTOCOL_UNSUPPORTED';
  end if;
end; $$;
revoke all on function rakeezx.assert_legacy_score_restore_safe(uuid) from public,anon,authenticated;

create function rakeezx.sync_v2_restore_manifest_full(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform rakeezx.assert_legacy_score_restore_safe(p_owner);
  return rakeezx.sync_v2_restore_manifest_full_before_score_0033(p_owner);
end; $$;
create function rakeezx.sync_v2_restore_canonical_full(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform rakeezx.assert_legacy_score_restore_safe(p_owner);
  return rakeezx.sync_v2_restore_canonical_full_before_score_0033(p_owner);
end; $$;
create function rakeezx.stage_sync_v2_restore(
  p_restore_id text,p_backup_hash text,p_backup_version integer,
  p_source_manifest jsonb,p_operations jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
  perform rakeezx.assert_legacy_score_restore_safe(v_owner);
  return rakeezx.stage_sync_v2_restore_before_score_0033(
    p_restore_id,p_backup_hash,p_backup_version,p_source_manifest,p_operations);
end; $$;
create function rakeezx.finalize_sync_v2_restore(
  p_restore_id text,p_backup_hash text,p_expected_stage_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
  perform rakeezx.assert_legacy_score_restore_safe(v_owner);
  return rakeezx.finalize_sync_v2_restore_before_score_0033(
    p_restore_id,p_backup_hash,p_expected_stage_hash);
end; $$;
revoke all on function rakeezx.sync_v2_restore_manifest_full(uuid) from public,anon;
revoke all on function rakeezx.sync_v2_restore_canonical_full(uuid) from public,anon;
revoke all on function rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb) from public,anon;
revoke all on function rakeezx.finalize_sync_v2_restore(text,text,text) from public,anon;
grant execute on function rakeezx.sync_v2_restore_manifest_full(uuid) to authenticated;
grant execute on function rakeezx.sync_v2_restore_canonical_full(uuid) to authenticated;
grant execute on function rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb) to authenticated;
grant execute on function rakeezx.finalize_sync_v2_restore(text,text,text) to authenticated;

-- One statement snapshot lets a client adopt components and materialized totals
-- together even when another device commits between ordinary entity pulls.
create function rakeezx.sync_v2_score_domain_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  return pg_catalog.jsonb_build_object(
    'items',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.id),'[]'::jsonb)
      from rakeezx.items i where i.owner_id=v_owner and i.score_mode='subitems'),
    'score_subitems',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d.id),'[]'::jsonb)
      from rakeezx.score_subitems d join rakeezx.items i
        on i.owner_id=d.owner_id and i.id=d.item_id
      where d.owner_id=v_owner and i.score_mode='subitems'),
    'score_subitem_completions',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.id),'[]'::jsonb)
      from rakeezx.score_subitem_completions c join rakeezx.score_subitems d
        on d.owner_id=c.owner_id and d.id=c.subitem_id
      join rakeezx.items i on i.owner_id=d.owner_id and i.id=d.item_id
      where c.owner_id=v_owner and i.score_mode='subitems'),
    'scores',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) order by s.id),'[]'::jsonb)
      from rakeezx.scores s join rakeezx.items i
        on i.owner_id=s.owner_id and i.id=s.item_id
      where s.owner_id=v_owner and i.score_mode='subitems')
  );
end; $$;
revoke all on function rakeezx.sync_v2_score_domain_snapshot() from public,anon;
grant execute on function rakeezx.sync_v2_score_domain_snapshot() to authenticated;

commit;
