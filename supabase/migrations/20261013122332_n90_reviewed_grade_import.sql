-- AI-authored N90: one reviewed DIRECT/MANUAL batch, existing owner receipts.
-- No backfill, Auth changes, new relation or grants on grade tables.
begin;
set local lock_timeout='10s';
create function rakeezx.reviewed_grade_import_capability() returns jsonb
language sql stable security definer set search_path='' as $$
  select '{"protocol":"N90_REVIEWED_V1","version":1}'::jsonb;
$$;
revoke all on function rakeezx.reviewed_grade_import_capability() from public,anon;
grant execute on function rakeezx.reviewed_grade_import_capability() to authenticated;

create function rakeezx.apply_reviewed_grade_import(p_mutation_id text,p_device_id text,p_batch jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=auth.uid(); v_saved rakeezx.score_domain_receipts%rowtype;
  v_envelope jsonb; v_result jsonb; v_teaching rakeezx.teachings%rowtype;
  v_item rakeezx.items%rowtype; v_score rakeezx.scores%rowtype; v_cell jsonb; v_new jsonb;
  v_value numeric; v_max numeric; v_item_ids text[]; v_score_ids text[]:='{}'; v_id text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(length(p_mutation_id),0) not between 1 and 200 or coalesce(length(p_device_id),0) not between 1 and 200 or
    jsonb_typeof(p_batch) is distinct from 'object' or jsonb_typeof(p_batch->'cells') is distinct from 'array' or
    jsonb_typeof(p_batch->'newItems') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid reviewed batch'; end if;
  if jsonb_array_length(p_batch->'cells') not between 1 and 15000 or jsonb_array_length(p_batch->'newItems')>50 or
    (select count(distinct x->>'studentId') from jsonb_array_elements(p_batch->'cells') x)>300 or
    (select count(distinct x->>'itemId') from jsonb_array_elements(p_batch->'cells') x)>50 or
    (select count(distinct (x->>'studentId',x->>'itemId')) from jsonb_array_elements(p_batch->'cells') x)<>jsonb_array_length(p_batch->'cells') or
    (select count(distinct x->>'id') from jsonb_array_elements(p_batch->'newItems') x)<>jsonb_array_length(p_batch->'newItems') then
    raise exception using errcode='22023',message='Duplicate or oversized reviewed batch'; end if;
  -- Same ordering as existing lifecycle writes, then receipt and item locks.
  perform rakeezx.lock_student_lifecycle(v_owner);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  v_envelope:=jsonb_build_object('protocol','N90_REVIEWED_V1','deviceId',p_device_id,'batch',p_batch);
  select * into v_saved from rakeezx.score_domain_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_saved.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Grade mutation ID reused'; end if;
    return v_saved.result;
  end if;
  select * into v_teaching from rakeezx.teachings where owner_id=v_owner and id=p_batch->>'teachingId' and deleted_at is null for update;
  if v_teaching.id is null or v_teaching.revision is distinct from (p_batch->>'teachingRevision')::bigint or
    v_teaching.term_id is distinct from p_batch->>'termId' or not exists (
      select 1 from rakeezx.sections s join rakeezx.terms t on t.owner_id=s.owner_id and t.year_id=s.year_id
      join rakeezx.years y on y.owner_id=s.owner_id and y.id=s.year_id
      join rakeezx.subjects u on u.owner_id=s.owner_id and u.id=v_teaching.subject_id
      where s.owner_id=v_owner and s.id=v_teaching.section_id and t.id=v_teaching.term_id and s.deleted_at is null
        and t.deleted_at is null and y.deleted_at is null and u.deleted_at is null and s.status<>'archived' and t.status='active' and y.status='active') then
    raise exception using errcode='PT409',message='Teaching or current term changed'; end if;
  for v_new in select value from jsonb_array_elements(p_batch->'newItems') order by value->>'id' loop
    v_max:=(v_new->>'max')::numeric;
    if coalesce(length(v_new->>'id'),0) not between 1 and 200 or coalesce(length(btrim(v_new->>'name')),0) not between 1 and 50 or
      v_max is null or v_max::text in ('NaN','Infinity','-Infinity') or v_max<=0 or v_max>9999.99 or v_max<>round(v_max,2) or
      not exists(select 1 from jsonb_array_elements(p_batch->'cells') c where c->>'itemId'=v_new->>'id') then
      raise exception using errcode='22023',message='Invalid explicit new manual item'; end if;
    if exists(select 1 from rakeezx.items where owner_id=v_owner and id=v_new->>'id') then
      raise exception using errcode='PT409',message='New item identity already exists'; end if;
    insert into rakeezx.items(owner_id,id,teaching_id,name,max,"order",score_mode,auto,device_id)
      values(v_owner,v_new->>'id',v_teaching.id,btrim(v_new->>'name'),v_max,
        coalesce((select max("order")+1 from rakeezx.items where owner_id=v_owner and teaching_id=v_teaching.id),0),'direct',null,p_device_id);
  end loop;
  select array_agg(distinct x->>'itemId' order by x->>'itemId') into v_item_ids from jsonb_array_elements(p_batch->'cells') x;
  perform 1 from rakeezx.items where owner_id=v_owner and id=any(v_item_ids) order by id for update;
  for v_cell in select value from jsonb_array_elements(p_batch->'cells') order by value->>'itemId',value->>'studentId' loop
    select * into v_item from rakeezx.items where owner_id=v_owner and id=v_cell->>'itemId';
    v_value:=(v_cell->>'value')::numeric;
    if v_item.id is null or v_item.deleted_at is not null or v_item.teaching_id<>v_teaching.id or v_item.score_mode<>'direct' or v_item.auto is not null or
      v_item.max is distinct from (v_cell->>'max')::numeric or
      (not exists(select 1 from jsonb_array_elements(p_batch->'newItems') x where x->>'id'=v_item.id) and v_item.revision is distinct from (v_cell->>'itemRevision')::bigint) or
      v_value is null or v_value::text in ('NaN','Infinity','-Infinity') or v_value<0 or v_value>v_item.max or v_value<>round(v_value,2) then
      raise exception using errcode='PT409',message='Item or grade changed or invalid'; end if;
    if not exists(select 1 from rakeezx.students s join rakeezx.enrollments e on e.owner_id=s.owner_id and e.student_id=s.id
      where s.owner_id=v_owner and s.id=v_cell->>'studentId' and s.deleted_at is null and e.deleted_at is null and e.status='active' and e.section_id=v_teaching.section_id) then
      raise exception using errcode='42501',message='Student outside current enrollment'; end if;
    select * into v_score from rakeezx.scores where owner_id=v_owner and student_id=v_cell->>'studentId' and item_id=v_item.id for update;
    if v_score.deleted_at is not null or v_score.id is distinct from v_cell->>'scoreId' or
      coalesce(v_score.revision,0) is distinct from (v_cell->>'scoreRevision')::bigint or v_score.value is distinct from (v_cell->>'old')::numeric then
      raise exception using errcode='PT409',message='Score changed since review'; end if;
    if v_score.value is not null and v_score.value<>v_value and (p_batch->>'overwriteConfirmed') is distinct from 'true' then
      raise exception using errcode='22023',message='Explicit overwrite confirmation required'; end if;
    if v_score.id is null then
      v_id:='sc:'||(v_cell->>'studentId')||':'||v_item.id;
      insert into rakeezx.scores(owner_id,id,student_id,item_id,value,device_id)
        values(v_owner,v_id,v_cell->>'studentId',v_item.id,v_value,p_device_id);
    else
      v_id:=v_score.id;
      update rakeezx.scores set value=v_value,device_id=p_device_id where owner_id=v_owner and id=v_id;
    end if;
    v_score_ids:=array_append(v_score_ids,v_id);
  end loop;
  v_result:=jsonb_build_object('protocol','N90_REVIEWED_V1','mutationId',p_mutation_id,'teachingId',v_teaching.id,
    'items',(select coalesce(jsonb_agg(to_jsonb(i) order by id),'[]') from rakeezx.items i where owner_id=v_owner and id=any(v_item_ids)),
    'scores',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from rakeezx.scores s where owner_id=v_owner and id=any(v_score_ids)),
    'score_subitems','[]'::jsonb,'score_subitem_completions','[]'::jsonb);
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result) values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.apply_reviewed_grade_import(text,text,jsonb) from public,anon;
grant execute on function rakeezx.apply_reviewed_grade_import(text,text,jsonb) to authenticated;
commit;
