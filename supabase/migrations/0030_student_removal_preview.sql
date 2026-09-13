-- STUDENT-REMOVAL-PREVIEW-RUNTIME-01. No Product writes or new table grants.
begin;
set local lock_timeout = '10s';

-- Full reviewed baseline + deterministic transformation checked BEFORE any DDL.
-- CRLF/LF normalization only; no SQL tokens, comments or safety guards removed.
do $verify$ declare v_expected record; v_p record; v_oid oid;
begin
  if to_regprocedure('rakeezx.preview_student_removal(text,text,bigint)') is not null or
    to_regprocedure('rakeezx.student_removal_source_blocker(uuid,text,text,bigint)') is not null then
    raise exception 'MIGRATION_0030_ALREADY_PARTLY_OR_FULLY_INSTALLED: verify, do not reapply';
  end if;
  for v_expected in select * from (values
    ('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','p_mutation_id text, p_device_id text, p_command text, p_payload jsonb, p_client_updated_at bigint','jsonb','plpgsql',true,'5160b50798e8c92c30d66d5db7dab31c8e636c5549e90f7bd4a57719f1054e32'),
    ('rakeezx.pristine_student_blocker(uuid,text)','p_owner uuid, p_student text','text','plpgsql',false,'af73a98a6655ddc42955306050b6ff89d89acecc9ff52f56a5727d0616ead740'),
    ('rakeezx.lock_student_lifecycle(uuid)','p_owner uuid','void','sql',false,'ab2e662a0824b4dea26a6f0d8e64dd793a6a7d26317b291170c46683d5304906')
  ) expected(signature,arguments,result_type,language,authenticated_execute,source_sha256) loop
    v_oid:=to_regprocedure(v_expected.signature);
    if v_oid is null then raise exception 'MIGRATION_0030_VERIFY_MISSING: %',v_expected.signature; end if;
    select p.*,l.lanname into v_p from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=v_oid;
    if not v_p.prosecdef or v_p.provolatile<>'v' or v_p.proisstrict or v_p.proretset or v_p.proleakproof or
      v_p.proparallel<>'u' or v_p.pronargdefaults<>0 or
      v_p.proconfig is distinct from array['search_path=""'] or
      v_p.lanname<>v_expected.language or pg_get_function_result(v_oid)<>v_expected.result_type or
      pg_get_function_identity_arguments(v_oid)<>v_expected.arguments or
      encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>v_expected.source_sha256 or
      has_function_privilege('authenticated',v_oid,'execute')<>v_expected.authenticated_execute or
      has_function_privilege('anon',v_oid,'execute') or
      exists(select 1 from aclexplode(coalesce(v_p.proacl,acldefault('f',v_p.proowner))) a
        where a.privilege_type='EXECUTE' and (a.grantee=0 or (a.grantee<>v_p.proowner and
          not exists(select 1 from pg_roles r where r.oid=a.grantee and
            (r.rolname='service_role' or (r.rolname='authenticated' and v_expected.authenticated_execute)))))) or
      exists(select 1 from pg_roles r where r.oid=v_p.proowner and r.rolname in ('authenticated','anon')) or
      (select count(*) from pg_proc p where p.pronamespace=v_p.pronamespace and p.proname=v_p.proname)<>1 then
      raise exception using message=format('MIGRATION_0030_VERIFY_DEFINITION_OR_PRIVILEGE_DRIFT: %s',v_expected.signature),
        detail=jsonb_build_object('expected_source_sha256',v_expected.source_sha256,
          'actual_source_sha256',encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex'),
          'security_definer',v_p.prosecdef,'search_path',v_p.proconfig,
          'authenticated_execute',has_function_privilege('authenticated',v_oid,'execute'),
          'anon_execute',has_function_privilege('anon',v_oid,'execute'),
          'acl',v_p.proacl::text)::text;
    end if;
  end loop;
end; $verify$;

-- Dry-run the exact source transformation against catalogs only; no DDL/RPC.
do $transform_precheck$ declare v_body text; v_definition text; v_rewritten text;
  v_old text := $old$    if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>v_expected then
      v_outcome:='rejected'; v_code:='STALE_SOURCE_ENROLLMENT';
    elsif exists(select 1 from rakeezx.sections where owner_id=v_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
      v_outcome:='protected'; v_code:='ARCHIVED_ENROLLMENT';$old$;
  v_new text := $new$    v_code:=rakeezx.student_removal_source_blocker(v_owner,v_student,v_source,v_expected);
    if v_code='STALE_SOURCE_ENROLLMENT' then
      v_outcome:='rejected';
    elsif v_code='ARCHIVED_ENROLLMENT' then
      v_outcome:='protected';$new$;
begin
  v_old:=replace(v_old,chr(13)||chr(10),chr(10));
  v_new:=replace(v_new,chr(13)||chr(10),chr(10));
  select replace(prosrc,chr(13)||chr(10),chr(10)),
    replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10)) into v_body,v_definition
    from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure;
  if v_body is null or position(v_old in v_body)=0 or
    (length(v_body)-length(replace(v_body,v_old,'')))/length(v_old)<>1 or
    position(v_body in v_definition)=0 or
    (length(v_definition)-length(replace(v_definition,v_body,'')))/length(v_body)<>1 then
    raise exception using errcode='22023',message='MIGRATION_0030_SOURCE_CHECK_PRECONDITION_FAILED';
  end if;
  v_rewritten:=replace(v_body,v_old,v_new);
  if encode(sha256(convert_to(v_rewritten,'UTF8')),'hex')<>
    '70119b55eda351b980d3ff15d76bc7baa0f6db51a7fee0f054f23a5f4d8c9a10' then
    raise exception using errcode='22023',message='MIGRATION_0030_TRANSFORM_PREFLIGHT_FAILED';
  end if;
end; $transform_precheck$;

-- Exact existing end-enrollment checks, shared by preview and execution.
create function rakeezx.student_removal_source_blocker(
  p_owner uuid,p_student text,p_source text,p_revision bigint
) returns text language plpgsql security definer set search_path='' as $$
declare v_e rakeezx.enrollments%rowtype;
begin
  select * into v_e from rakeezx.enrollments where owner_id=p_owner and id=p_source and student_id=p_student;
  if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>p_revision then
    return 'STALE_SOURCE_ENROLLMENT';
  elsif exists(select 1 from rakeezx.sections where owner_id=p_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
    return 'ARCHIVED_ENROLLMENT';
  end if;
  return null;
end; $$;
revoke all on function rakeezx.student_removal_source_blocker(uuid,text,text,bigint) from public,anon,authenticated;

-- Reuse the helper without changing receipts, locks, writes or rejection codes.
-- Abort the whole additive installation if the reviewed 0029 body has drifted.
do $install$ declare v_body text; v_definition text; v_rewritten text;
  v_old text := $old$    if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>v_expected then
      v_outcome:='rejected'; v_code:='STALE_SOURCE_ENROLLMENT';
    elsif exists(select 1 from rakeezx.sections where owner_id=v_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
      v_outcome:='protected'; v_code:='ARCHIVED_ENROLLMENT';$old$;
  v_new text := $new$    v_code:=rakeezx.student_removal_source_blocker(v_owner,v_student,v_source,v_expected);
    if v_code='STALE_SOURCE_ENROLLMENT' then
      v_outcome:='rejected';
    elsif v_code='ARCHIVED_ENROLLMENT' then
      v_outcome:='protected';$new$;
begin
  v_old:=replace(v_old,chr(13)||chr(10),chr(10));
  v_new:=replace(v_new,chr(13)||chr(10),chr(10));
  select replace(prosrc,chr(13)||chr(10),chr(10)),
    replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10)) into v_body,v_definition
    from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure;
  if v_body is null or position(v_old in v_body)=0 or
    (length(v_body)-length(replace(v_body,v_old,'')))/length(v_old)<>1 or
    position(v_body in v_definition)=0 or
    (length(v_definition)-length(replace(v_definition,v_body,'')))/length(v_body)<>1 then
    raise exception using errcode='22023',message='MIGRATION_0030_SOURCE_CHECK_PRECONDITION_FAILED';
  end if;
  v_rewritten:=replace(v_body,v_old,v_new);
  if encode(sha256(convert_to(v_rewritten,'UTF8')),'hex')<>
    '70119b55eda351b980d3ff15d76bc7baa0f6db51a7fee0f054f23a5f4d8c9a10' then
    raise exception using errcode='22023',message='MIGRATION_0030_TRANSFORM_PREFLIGHT_FAILED';
  end if;
  execute replace(v_definition,v_body,v_rewritten);
  select replace(prosrc,chr(13)||chr(10),chr(10)) into v_body
    from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure;
  if v_body is distinct from v_rewritten then
    raise exception using errcode='22023',message='MIGRATION_0030_COMPILED_TRANSFORM_MISMATCH';
  end if;
end; $install$;

-- VOLATILE intentionally: after waiting for the existing owner boundary, each
-- read must see the latest committed authority, not a pre-lock stable snapshot.
-- Advisory locks serialize reads with 0029 execution; no Product row is written.
create function rakeezx.preview_student_removal(
  p_student_id text,p_source_enrollment_id text,p_source_revision bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_s rakeezx.students%rowtype; v_block text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_student_id,'')='' or char_length(p_student_id)>200 or
    coalesce(p_source_enrollment_id,'')='' or char_length(p_source_enrollment_id)>200 or p_source_revision is null then
    return jsonb_build_object('outcome','blocked','reason','invalid_source','retryable',false);
  end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  select * into v_s from rakeezx.students where owner_id=v_owner and id=p_student_id;
  if not found then
    return jsonb_build_object('outcome','blocked','reason','student_unavailable','retryable',true);
  elsif v_s.deleted_at is not null then
    return jsonb_build_object('outcome','blocked','reason','student_deleted','retryable',false);
  end if;
  v_block:=rakeezx.student_removal_source_blocker(v_owner,p_student_id,p_source_enrollment_id,p_source_revision);
  if v_block='STALE_SOURCE_ENROLLMENT' then
    return jsonb_build_object('outcome','blocked','reason','stale_source','retryable',true);
  elsif v_block='ARCHIVED_ENROLLMENT' then
    return jsonb_build_object('outcome','blocked','reason','archived_enrollment','retryable',false);
  end if;
  if rakeezx.pristine_student_blocker(v_owner,p_student_id) is not null then
    return jsonb_build_object('outcome','end_enrollment','reason','history_exists','retryable',false);
  end if;
  return jsonb_build_object('outcome','delete_pristine','reason','pristine','retryable',false);
end; $$;
revoke all on function rakeezx.preview_student_removal(text,text,bigint) from public,anon;
grant execute on function rakeezx.preview_student_removal(text,text,bigint) to authenticated;
-- Verify compiled bodies, attributes and effective privileges BEFORE COMMIT.
-- A failure here rolls back helper, preview and execution refactor together.
do $verify$ declare v_expected record; v_p record; v_oid oid;
begin
  for v_expected in select * from (values
    ('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','p_mutation_id text, p_device_id text, p_command text, p_payload jsonb, p_client_updated_at bigint','jsonb','plpgsql',true,'70119b55eda351b980d3ff15d76bc7baa0f6db51a7fee0f054f23a5f4d8c9a10'),
    ('rakeezx.pristine_student_blocker(uuid,text)','p_owner uuid, p_student text','text','plpgsql',false,'af73a98a6655ddc42955306050b6ff89d89acecc9ff52f56a5727d0616ead740'),
    ('rakeezx.lock_student_lifecycle(uuid)','p_owner uuid','void','sql',false,'ab2e662a0824b4dea26a6f0d8e64dd793a6a7d26317b291170c46683d5304906'),
    ('rakeezx.preview_student_removal(text,text,bigint)','p_student_id text, p_source_enrollment_id text, p_source_revision bigint','jsonb','plpgsql',true,'5e549845fc9145073c3cd1714eb395a49f15b0361150e90498b792e8a7476c9c'),
    ('rakeezx.student_removal_source_blocker(uuid,text,text,bigint)','p_owner uuid, p_student text, p_source text, p_revision bigint','text','plpgsql',false,'23ad1c8c356e604ea2fdce490fb2c143b92e96d20baa747f5e120867c03d5483')
  ) expected(signature,arguments,result_type,language,authenticated_execute,source_sha256) loop
    v_oid:=to_regprocedure(v_expected.signature);
    if v_oid is null then raise exception 'MIGRATION_0030_VERIFY_MISSING: %',v_expected.signature; end if;
    select p.*,l.lanname into v_p from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=v_oid;
    if not v_p.prosecdef or v_p.provolatile<>'v' or v_p.proisstrict or v_p.proretset or v_p.proleakproof or
      v_p.proparallel<>'u' or v_p.pronargdefaults<>0 or
      v_p.proconfig is distinct from array['search_path=""'] or
      v_p.lanname<>v_expected.language or pg_get_function_result(v_oid)<>v_expected.result_type or
      pg_get_function_identity_arguments(v_oid)<>v_expected.arguments or
      encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>v_expected.source_sha256 or
      has_function_privilege('authenticated',v_oid,'execute')<>v_expected.authenticated_execute or
      has_function_privilege('anon',v_oid,'execute') or
      exists(select 1 from aclexplode(coalesce(v_p.proacl,acldefault('f',v_p.proowner))) a
        where a.privilege_type='EXECUTE' and (a.grantee=0 or (a.grantee<>v_p.proowner and
          not exists(select 1 from pg_roles r where r.oid=a.grantee and
            (r.rolname='service_role' or (r.rolname='authenticated' and v_expected.authenticated_execute)))))) or
      exists(select 1 from pg_roles r where r.oid=v_p.proowner and r.rolname in ('authenticated','anon')) or
      (select count(*) from pg_proc p where p.pronamespace=v_p.pronamespace and p.proname=v_p.proname)<>1 then
      raise exception using message=format('MIGRATION_0030_VERIFY_DEFINITION_OR_PRIVILEGE_DRIFT: %s',v_expected.signature),
        detail=jsonb_build_object('expected_source_sha256',v_expected.source_sha256,
          'actual_source_sha256',encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex'),
          'security_definer',v_p.prosecdef,'search_path',v_p.proconfig,
          'authenticated_execute',has_function_privilege('authenticated',v_oid,'execute'),
          'anon_execute',has_function_privilege('anon',v_oid,'execute'),
          'acl',v_p.proacl::text)::text;
    end if;
  end loop;
end; $verify$;
commit;
