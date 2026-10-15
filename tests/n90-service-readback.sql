-- AI: bounded N90 verification only. No DDL or persistent fixture/account.
-- All synthetic rows, Auth FK scaffolding and RPC writes roll back in the inner block.
do $n90_proof$
declare
  v_owner uuid:=gen_random_uuid(); v_other uuid:=gen_random_uuid();
  v_prefix text:='n90-proof:'||v_owner::text||':';
  v_batch jsonb; v_bad jsonb; v_receipt jsonb; v_retry jsonb;
  v_checks text[]:='{}'; v_rejected boolean; v_revision bigint; v_item_revision bigint;
begin
  if has_function_privilege('anon','rakeezx.apply_unified_student_grade_import(text,text,jsonb)','execute')
    or has_function_privilege('anon','rakeezx.unified_student_grade_import_capability()','execute')
    or not has_function_privilege('authenticated','rakeezx.apply_unified_student_grade_import(text,text,jsonb)','execute')
    or not has_function_privilege('authenticated','rakeezx.unified_student_grade_import_capability()','execute') then
    raise exception 'N90_AUTHENTICATED_ONLY_ACL_FAILED';
  end if;
  v_checks:=array_append(v_checks,'authenticated_only_effective_ACL');
  begin
    -- A non-login, credential-free synthetic FK row, never committed or sent through Auth API.
    insert into auth.users(id,email) values(v_owner,'n90-'||v_owner::text||'@example.invalid');
    perform set_config('request.jwt.claim.sub',v_owner::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
    insert into rakeezx.years(id,label,hijri_start,hijri_end) values(v_prefix||'y','N90 synthetic transaction',1450,1451);
    insert into rakeezx.terms(id,year_id,name,"index",status) values(v_prefix||'term',v_prefix||'y','Synthetic',1,'active');
    insert into rakeezx.subjects(id,name,slug) values(v_prefix||'subject','Synthetic',v_prefix||'subject');
    insert into rakeezx.sections(id,year_id,grade,label,name) values(v_prefix||'section',v_prefix||'y',4,'1','4/1');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values(v_prefix||'t',v_prefix||'section',v_prefix||'subject',v_prefix||'term');
    insert into rakeezx.items(id,teaching_id,name,max) values(v_prefix||'item',v_prefix||'t','Synthetic manual',5);
    insert into rakeezx.students(id,name,deleted_at) values(v_prefix||'deleted','هوية محذوفة تجريبية',now());
    select revision into v_revision from rakeezx.teachings where owner_id=v_owner and id=v_prefix||'t';
    select revision into v_item_revision from rakeezx.items where owner_id=v_owner and id=v_prefix||'item';
    v_batch:=jsonb_build_object('teachingId',v_prefix||'t','sectionId',v_prefix||'section','termId',v_prefix||'term',
      'teachingRevision',v_revision,'newItems','[]'::jsonb,'enrollmentConfirmed',true,'overwriteConfirmed',false,
      'newStudents',jsonb_build_array(jsonb_build_object('id',v_prefix||'new','enrollmentId',v_prefix||'en','name','طالب تحقق تجريبي')),
      'cells',jsonb_build_array(jsonb_build_object('studentId',v_prefix||'new','itemId',v_prefix||'item','itemRevision',v_item_revision,'max',5,'scoreId',null,'scoreRevision',0,'old',null,'value',0)));

    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims','{}',true);
    v_rejected:=false;
    begin perform rakeezx.apply_unified_student_grade_import(v_prefix||'unsigned','n90-transaction',v_batch);
    exception when insufficient_privilege then v_rejected:=true; end;
    if not v_rejected then raise exception 'N90_UNSIGNED_NOT_REJECTED'; end if;
    v_checks:=array_append(v_checks,'unsigned_rejected');

    perform set_config('request.jwt.claim.sub',v_other::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
    set local role authenticated;
    v_rejected:=false;
    begin perform rakeezx.apply_unified_student_grade_import(v_prefix||'foreign','n90-transaction',v_batch);
    exception when sqlstate 'PT409' then v_rejected:=true; end;
    if not v_rejected or exists(select 1 from rakeezx.years where owner_id=v_owner) then raise exception 'N90_WRONG_OWNER_FAILED'; end if;
    reset role;
    v_checks:=array_append(v_checks,'authenticated_wrong_owner_RLS_rejected');
    perform set_config('request.jwt.claim.sub',v_owner::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);

    update rakeezx.years set status='archived' where owner_id=v_owner and id=v_prefix||'y';
    v_rejected:=false;
    begin perform rakeezx.apply_unified_student_grade_import(v_prefix||'inactive-year','n90-transaction',v_batch);
    exception when sqlstate 'PT409' then v_rejected:=true; end;
    if not v_rejected then raise exception 'N90_INACTIVE_YEAR_NOT_REJECTED'; end if;
    update rakeezx.years set status='active' where owner_id=v_owner and id=v_prefix||'y';
    update rakeezx.terms set status='upcoming' where owner_id=v_owner and id=v_prefix||'term';
    v_rejected:=false;
    begin perform rakeezx.apply_unified_student_grade_import(v_prefix||'inactive-term','n90-transaction',v_batch);
    exception when sqlstate 'PT409' then v_rejected:=true; end;
    if not v_rejected then raise exception 'N90_INACTIVE_TERM_NOT_REJECTED'; end if;
    update rakeezx.terms set status='active' where owner_id=v_owner and id=v_prefix||'term';
    v_checks:=array_append(v_checks,'inactive_year_and_term_rejected');

    foreach v_bad in array array[
      jsonb_set(v_batch,'{teachingRevision}','0'),
      jsonb_set(v_batch,'{newStudents,0,id}',to_jsonb(v_prefix||'deleted')),
      jsonb_set(v_batch,'{cells,0,max}','4'),
      jsonb_set(v_batch,'{cells,0,itemRevision}','0'),
      jsonb_set(v_batch,'{cells,0,value}','6')
    ] loop
      v_rejected:=false;
      begin perform rakeezx.apply_unified_student_grade_import(v_prefix||'negative','n90-transaction',v_bad);
      exception when sqlstate 'PT409' then v_rejected:=true; end;
      if not v_rejected or exists(select 1 from rakeezx.students where owner_id=v_owner and id=v_prefix||'new')
        or exists(select 1 from rakeezx.enrollments where owner_id=v_owner)
        or exists(select 1 from rakeezx.score_domain_receipts where owner_id=v_owner) then raise exception 'N90_NEGATIVE_ATOMICITY_FAILED'; end if;
    end loop;
    v_checks:=array_append(v_checks,'teaching_revision_deleted_identity_frozen_max_item_revision_and_late_score_rollback');

    set local role authenticated;
    if rakeezx.unified_student_grade_import_capability()->>'unifiedProtocol' is distinct from 'N90_UNIFIED_V1' then raise exception 'N90_AUTHENTICATED_CAPABILITY_FAILED'; end if;
    v_checks:=array_append(v_checks,'authenticated_capability_readback');
    v_receipt:=rakeezx.apply_unified_student_grade_import(v_prefix||'ok','n90-transaction',v_batch);
    v_retry:=rakeezx.apply_unified_student_grade_import(v_prefix||'ok','n90-transaction',v_batch);
    if v_receipt is distinct from v_retry or v_receipt->>'protocol'<>'N90_UNIFIED_V1'
      or jsonb_array_length(v_receipt->'students')<>1 or jsonb_array_length(v_receipt->'enrollments')<>1
      or (v_receipt->'scores'->0->>'value')::numeric<>0 then raise exception 'N90_ZERO_RECEIPT_RETRY_FAILED'; end if;
    v_bad:=jsonb_set(v_batch,'{cells,0,value}','1');
    v_rejected:=false;
    begin perform rakeezx.apply_unified_student_grade_import(v_prefix||'ok','n90-transaction',v_bad);
    exception when invalid_parameter_value then v_rejected:=true; end;
    if not v_rejected then raise exception 'N90_FORGED_MUTATION_ID_NOT_REJECTED'; end if;
    reset role;
    update rakeezx.scores set value=1 where owner_id=v_owner and student_id=v_prefix||'new';
    set local role authenticated;
    if rakeezx.apply_unified_student_grade_import(v_prefix||'ok','n90-transaction',v_batch) is distinct from v_receipt
      or (select value from rakeezx.scores where owner_id=v_owner and student_id=v_prefix||'new')<>1
      or (select count(*) from rakeezx.score_domain_receipts where owner_id=v_owner)<>1 then raise exception 'N90_RETRY_OVERWROTE_LATER_SCORE'; end if;
    reset role;
    v_checks:=array_append(v_checks,'authenticated_zero_canonical_receipt_exact_retry_forged_id_and_later_score_preserved');

    v_bad:=jsonb_set(jsonb_set(v_batch,'{newStudents}',jsonb_build_array(jsonb_build_object('id',v_prefix||'blank','enrollmentId',v_prefix||'blank-en','name','طالب بلا درجة تجريبي'))),'{cells}','[]');
    set local role authenticated;
    v_retry:=rakeezx.apply_unified_student_grade_import(v_prefix||'blank','n90-transaction',v_bad);
    if jsonb_array_length(v_retry->'scores')<>0 or jsonb_array_length(v_retry->'students')<>1 then raise exception 'N90_BLANK_INVENTED_SCORE'; end if;
    reset role;
    v_checks:=array_append(v_checks,'blank_enrollment_without_invented_scores');
    raise sqlstate 'ZX090' using message='N90 controlled fixture rollback';
  exception when sqlstate 'ZX090' then null;
  end;
  if exists(select 1 from auth.users where id=v_owner) or exists(select 1 from rakeezx.years where owner_id=v_owner)
    or exists(select 1 from rakeezx.students where owner_id=v_owner)
    or exists(select 1 from rakeezx.enrollments where owner_id=v_owner)
    or exists(select 1 from rakeezx.scores where owner_id=v_owner)
    or exists(select 1 from rakeezx.score_domain_receipts where owner_id=v_owner) then raise exception 'N90_FIXTURE_NOT_ROLLED_BACK'; end if;
  perform set_config('rakeez.n90_service_proof',jsonb_build_object('checks',v_checks,'fixtureRolledBack',true,'persistentAccounts',0,'realStudentData',0)::text,true);
end $n90_proof$;

select current_setting('rakeez.n90_service_proof',true)::jsonb as transactional_proof,
  rakeezx.unified_student_grade_import_capability() as capability,
  (select jsonb_agg(to_jsonb(m)) from (select version,name,statements from supabase_migrations.schema_migrations
    where name='n90_unified_student_grade_import' or version='20261014100000' order by version) m) as migration_records,
  (select jsonb_agg(to_jsonb(f)) from (select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition,md5(p.prosrc) as body_md5,p.proacl::text as acl,p.prosecdef,p.proconfig,
    pg_get_userbyid(p.proowner) as function_owner
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx'
    and p.proname in ('unified_student_grade_import_capability','apply_unified_student_grade_import','reviewed_grade_import_capability','apply_reviewed_grade_import') order by p.proname) f) as functions;
