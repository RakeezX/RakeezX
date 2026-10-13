-- N73 business conflicts must not enter PostgREST serialization retries.
-- Original applied migration remains immutable; signatures and privileges are preserved.
create or replace function rakeezx.apply_score_distribution_plan(p_mutation_id text,p_device_id text,p_plan_id text,p_token text,p_confirmed boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_saved rakeezx.score_distribution_plans%rowtype; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_envelope jsonb; v_op jsonb; v_patch jsonb; v_entity text; v_id text; v_key text; v_sets text; v_columns text; v_values text;
  v_source text; v_targets text[]; v_accepted text[]; v_result jsonb; v_rows jsonb; v_ids text[]; v_affected bigint; v_now timestamptz:=clock_timestamp();
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or length(p_mutation_id)>200 or coalesce(p_device_id,'')='' or length(p_device_id)>200 or
    p_token is null or p_confirmed is null then raise exception using errcode='22023',message='Invalid distribution envelope'; end if;
  v_envelope:=jsonb_build_object('protocol','N73_D119_V2','deviceId',p_device_id,'planId',p_plan_id,'token',p_token,'confirmed',p_confirmed);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.score_domain_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Distribution mutation ID reused'; end if;
    return v_receipt.result;
  end if;
  lock table rakeezx.items,rakeezx.score_subitems,rakeezx.score_subitem_completions,rakeezx.scores,
    rakeezx.teachings,rakeezx.sections,rakeezx.terms,rakeezx.years,rakeezx.subjects,rakeezx.students,
    rakeezx.enrollments,rakeezx.units,rakeezx.lessons,rakeezx.logs,rakeezx.attendance in share row exclusive mode;
  select * into v_saved from rakeezx.score_distribution_plans where owner_id=v_owner and id=p_plan_id;
  if not found then raise exception using errcode='42501',message='Distribution plan unavailable'; end if;
  if v_saved.fingerprint<>p_token or v_saved.created_at+interval '15 minutes'<clock_timestamp() then
    raise exception using errcode='PT409',message='Distribution plan expired or changed'; end if;
  if (v_saved.plan->>'requiresConfirmation')::boolean and not p_confirmed then
    raise exception using errcode='22023',message='Deliberate impact confirmation required'; end if;
  if jsonb_array_length(v_saved.plan->'targets')=0 then raise exception using errcode='22023',message='Resolve ambiguous targets before applying'; end if;
  v_source:=v_saved.request->>'source';
  select array_agg(x) into v_targets from jsonb_array_elements_text(v_saved.request->'targets') x;
  if md5(rakeezx.n73_distribution_state(v_source,v_targets)::text)<>v_saved.fingerprint then
    raise exception using errcode='PT409',message='Distribution changed since review'; end if;
  perform set_config('rakeezx.score_domain_write','on',true);
  for v_op in select value from jsonb_array_elements(v_saved.plan->'operations') loop
    v_entity:=v_op->>'entity'; v_id:=v_op->>'id'; v_patch:=v_op->'patch';
    if v_patch->>'deleted_at'='__now__' then v_patch:=v_patch||jsonb_build_object('deleted_at',v_now); end if;
    v_patch:=v_patch||jsonb_build_object('device_id',p_device_id);
    if coalesce((v_op->>'create')::boolean,false) then
      v_patch:=v_patch||jsonb_build_object('owner_id',v_owner,'id',v_id);
      select string_agg(format('%I',k),',' order by k),string_agg(format('p.%I',k),',' order by k)
        into v_columns,v_values from jsonb_object_keys(v_patch) k;
      execute format('insert into rakeezx.%I(%s) select %s from jsonb_populate_record(null::rakeezx.%I,$1) p',v_entity,v_columns,v_values,v_entity) using v_patch;
    else
      select string_agg(format('%I=p.%I',k,k),',' order by k) into v_sets from jsonb_object_keys(v_patch) k;
      execute format('update rakeezx.%I t set %s from jsonb_populate_record(null::rakeezx.%I,$1) p where t.owner_id=$2 and t.id=$3 and t.deleted_at is null',v_entity,v_sets,v_entity)
        using v_patch,v_owner,v_id;
      get diagnostics v_affected=row_count;
      if v_affected<>1 then raise exception using errcode='PT409',message='Distribution operation unavailable'; end if;
    end if;
  end loop;
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'planId',p_plan_id,'protocol','N73_D119_V2',
    'changedCount',v_saved.plan->'changedCount','excludedTargets',v_saved.plan->'excludedTargets');
  select array_agg(x->>'teachingId') into v_accepted from jsonb_array_elements(v_saved.plan->'targets') x;
  -- Full accepted-target canonical scope includes compatible unchanged scores
  -- and completions as well as tombstones. It never contains source grades.
  v_result:=v_result||jsonb_build_object(
    'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from rakeezx.items i where owner_id=v_owner and teaching_id=any(v_accepted)),
    'score_subitems',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from rakeezx.score_subitems d join rakeezx.items i
      on i.owner_id=d.owner_id and i.id=d.item_id where d.owner_id=v_owner and i.teaching_id=any(v_accepted)),
    'score_subitem_completions',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from rakeezx.score_subitem_completions c
      join rakeezx.score_subitems d on d.owner_id=c.owner_id and d.id=c.subitem_id join rakeezx.items i on i.owner_id=d.owner_id and i.id=d.item_id
      where c.owner_id=v_owner and i.teaching_id=any(v_accepted)),
    'scores',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from rakeezx.scores s join rakeezx.items i
      on i.owner_id=s.owner_id and i.id=s.item_id where s.owner_id=v_owner and i.teaching_id=any(v_accepted))
  );
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result) values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $$;

create or replace function rakeezx.rename_score_item(p_mutation_id text,p_device_id text,p_item_id text,p_revision bigint,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_item rakeezx.items%rowtype; v_saved rakeezx.score_domain_receipts%rowtype; v_envelope jsonb; v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or length(p_mutation_id)>200 or coalesce(p_device_id,'')='' or length(p_device_id)>200 or
    length(btrim(p_name)) not between 1 and 50 or p_name is null then raise exception using errcode='22023',message='Invalid item name'; end if;
  v_envelope:=jsonb_build_object('deviceId',p_device_id,'itemId',p_item_id,'revision',p_revision,'name',p_name);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_saved from rakeezx.score_domain_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_saved.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Rename mutation ID reused'; end if;
    return v_saved.result;
  end if;
  select * into v_item from rakeezx.items where owner_id=v_owner and id=p_item_id and deleted_at is null for update;
  if not found or v_item.revision<>p_revision then raise exception using errcode='PT409',message='Item changed since review'; end if;
  perform set_config('rakeezx.score_domain_write','on',true);
  update rakeezx.items set name=btrim(p_name),device_id=p_device_id where owner_id=v_owner and id=p_item_id returning * into v_item;
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'item',to_jsonb(v_item),'subitems','[]'::jsonb,'scores','[]'::jsonb);
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result) values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $$;
