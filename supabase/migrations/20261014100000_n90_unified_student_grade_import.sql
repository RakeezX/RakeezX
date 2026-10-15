-- AI-authored N90 additive composition: existing grade command and owner receipts.
-- No Auth/RLS/table grants, backfill, scoring bypass or applied-function rewrite.
begin;
set local lock_timeout='10s';
create function rakeezx.unified_student_grade_import_capability() returns jsonb
language sql stable security definer set search_path='' as $$
  select rakeezx.reviewed_grade_import_capability() || '{"unifiedProtocol":"N90_UNIFIED_V1","unifiedVersion":1}'::jsonb;
$$;
revoke all on function rakeezx.unified_student_grade_import_capability() from public,anon;
grant execute on function rakeezx.unified_student_grade_import_capability() to authenticated;

create function rakeezx.apply_unified_student_grade_import(p_mutation_id text,p_device_id text,p_batch jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=auth.uid(); v_saved rakeezx.score_domain_receipts%rowtype;
  v_envelope jsonb; v_result jsonb; v_teaching rakeezx.teachings%rowtype;
  v_new jsonb; v_roll int; v_key text; v_ids text[]:='{}'; v_enrollment_ids text[]:='{}';
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(length(p_mutation_id),0) not between 1 and 200 or coalesce(length(p_device_id),0) not between 1 and 200 or
    jsonb_typeof(p_batch) is distinct from 'object' or jsonb_typeof(p_batch->'newStudents') is distinct from 'array' or
    jsonb_typeof(p_batch->'cells') is distinct from 'array' or jsonb_typeof(p_batch->'newItems') is distinct from 'array' or
    p_batch->>'enrollmentConfirmed' is distinct from 'true' then
    raise exception using errcode='22023',message='Explicit reviewed enrollment required'; end if;
  if jsonb_array_length(p_batch->'newStudents') not between 1 and 300 or jsonb_array_length(p_batch->'cells')>15000 or
    (select count(distinct id) from (select x->>'id' id from jsonb_array_elements(p_batch->'newStudents') x union all select x->>'studentId' from jsonb_array_elements(p_batch->'cells') x) identities)>300 or
    (select count(distinct x->>'id') from jsonb_array_elements(p_batch->'newStudents') x)<>jsonb_array_length(p_batch->'newStudents') or
    (select count(distinct x->>'enrollmentId') from jsonb_array_elements(p_batch->'newStudents') x)<>jsonb_array_length(p_batch->'newStudents') or
    (select count(distinct lower(regexp_replace(normalize(x->>'name',NFC),'[[:space:]ـً-ٰٟ]','','g'))) from jsonb_array_elements(p_batch->'newStudents') x)<>jsonb_array_length(p_batch->'newStudents') then
    raise exception using errcode='22023',message='Duplicate or oversized new students'; end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  v_envelope:=jsonb_build_object('protocol','N90_UNIFIED_V1','deviceId',p_device_id,'batch',p_batch);
  select * into v_saved from rakeezx.score_domain_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_saved.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Unified mutation ID reused'; end if;
    return v_saved.result;
  end if;
  select * into v_teaching from rakeezx.teachings where owner_id=v_owner and id=p_batch->>'teachingId' and deleted_at is null for update;
  if v_teaching.id is null or v_teaching.section_id is distinct from p_batch->>'sectionId' or
    v_teaching.revision is distinct from (p_batch->>'teachingRevision')::bigint or v_teaching.term_id is distinct from p_batch->>'termId' or not exists (
      select 1 from rakeezx.sections s join rakeezx.terms t on t.owner_id=s.owner_id and t.year_id=s.year_id
      join rakeezx.years y on y.owner_id=s.owner_id and y.id=s.year_id
      join rakeezx.subjects u on u.owner_id=s.owner_id and u.id=v_teaching.subject_id
      where s.owner_id=v_owner and s.id=v_teaching.section_id and t.id=v_teaching.term_id and s.deleted_at is null
        and t.deleted_at is null and y.deleted_at is null and u.deleted_at is null and s.status<>'archived' and t.status='active' and y.status='active') then
    raise exception using errcode='PT409',message='Teaching or current term changed'; end if;
  select coalesce(max(roll_no),0) into v_roll from rakeezx.enrollments where owner_id=v_owner and section_id=v_teaching.section_id and status='active' and deleted_at is null;
  if v_roll+jsonb_array_length(p_batch->'newStudents')>999 then raise exception using errcode='22023',message='Roster limit'; end if;
  for v_new in select value from jsonb_array_elements(p_batch->'newStudents') order by value->>'enrollmentId' loop
    if jsonb_typeof(v_new->'id') is distinct from 'string' or jsonb_typeof(v_new->'enrollmentId') is distinct from 'string' or jsonb_typeof(v_new->'name') is distinct from 'string' or
      coalesce(length(v_new->>'id'),0) not between 1 and 200 or coalesce(length(v_new->>'enrollmentId'),0) not between 1 and 200 or
      coalesce(length(btrim(v_new->>'name')),0) not between 2 and 80 or v_new->>'name' is distinct from btrim(v_new->>'name') or
      v_new->>'name' ~ ('^[=+@-]|[[:cntrl:]'||chr(8203)||'-'||chr(8207)||chr(8234)||'-'||chr(8238)||chr(8294)||'-'||chr(8297)||']') or
      regexp_replace(v_new->>'name','[0-9٠-٩۰-۹[:space:][:punct:]]','','g')=''  then
      raise exception using errcode='22023',message='Invalid student identity or name'; end if;
    -- Existing/deleted identities are never resurrected or adopted by name.
    if exists(select 1 from rakeezx.students where owner_id=v_owner and id=v_new->>'id') or
      exists(select 1 from rakeezx.enrollments where owner_id=v_owner and id=v_new->>'enrollmentId') then
      raise exception using errcode='PT409',message='New identity already exists'; end if;
    v_key:=lower(regexp_replace(normalize(v_new->>'name',NFC),'[[:space:]ـً-ٰٟ]','','g'));
    if exists(select 1 from rakeezx.students s join rakeezx.enrollments e on e.owner_id=s.owner_id and e.student_id=s.id
      where s.owner_id=v_owner and s.deleted_at is null and e.deleted_at is null and e.status='active' and e.section_id=v_teaching.section_id and
      lower(regexp_replace(normalize(s.name,NFC),'[[:space:]ـً-ٰٟ]','','g'))=v_key) then
      raise exception using errcode='PT409',message='Roster changed since review'; end if;
    insert into rakeezx.students(owner_id,id,name,device_id) values(v_owner,v_new->>'id',v_new->>'name',p_device_id);
    v_roll:=v_roll+1;
    insert into rakeezx.enrollments(owner_id,id,student_id,section_id,roll_no,device_id)
      values(v_owner,v_new->>'enrollmentId',v_new->>'id',v_teaching.section_id,v_roll,p_device_id);
    v_ids:=array_append(v_ids,v_new->>'id'); v_enrollment_ids:=array_append(v_enrollment_ids,v_new->>'enrollmentId');
  end loop;
  if jsonb_array_length(p_batch->'cells')>0 then
    -- Nested function has no independent transaction. Any late grade failure rolls back enrollment too.
    v_result:=rakeezx.apply_reviewed_grade_import(p_mutation_id,p_device_id,p_batch-'newStudents'-'sectionId'-'enrollmentConfirmed');
  else
    if jsonb_array_length(p_batch->'newItems')<>0 then raise exception using errcode='22023',message='Unused new items'; end if;
    v_result:=jsonb_build_object('mutationId',p_mutation_id,'teachingId',v_teaching.id,'items','[]'::jsonb,'scores','[]'::jsonb,'score_subitems','[]'::jsonb,'score_subitem_completions','[]'::jsonb);
  end if;
  v_result:=v_result || jsonb_build_object('protocol','N90_UNIFIED_V1',
    'students',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.students s where owner_id=v_owner and id=any(v_ids)),
    'enrollments',(select jsonb_agg(to_jsonb(e) order by id) from rakeezx.enrollments e where owner_id=v_owner and id=any(v_enrollment_ids)));
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result) values(v_owner,p_mutation_id,v_envelope,v_result)
    on conflict(owner_id,mutation_id) do update set request_envelope=excluded.request_envelope,result=excluded.result;
  return v_result;
end; $$;
revoke all on function rakeezx.apply_unified_student_grade_import(text,text,jsonb) from public,anon;
grant execute on function rakeezx.apply_unified_student_grade_import(text,text,jsonb) to authenticated;
commit;
