-- 0086 PRECHECK: run BEFORE apply and save security_metadata_sha256.
-- Metadata ONLY. No Product/student row reads or lifecycle calls.
-- Acceptance requires BOTH function assertions and an identical pre/post hash.
begin;
set transaction read only;
set local search_path = pg_catalog;

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

select 'REVIEWED_0029_BASELINE_PASS' verification;
select 'DETERMINISTIC_SOURCE_TRANSFORM_PASS' transformation;

-- Fingerprints schema/table/column ACLs, RLS/policies, defaults and triggers.
-- No content is returned; comparing these hashes detects security metadata drift.
with security_metadata as (
  select jsonb_build_object(
    'schema_acl',(select nspacl::text from pg_namespace where nspname='rakeezx'),
    'tables',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl::text,
      'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.relname),'[]')
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rakeezx' and c.relkind in ('r','p','v','m','f')),
    'columns',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'acl',a.attacl::text)
      order by c.relname,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname='rakeezx' and a.attnum>0 and not a.attisdropped),
    'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname),'[]') from pg_policies p where p.schemaname='rakeezx'),
    'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]')
      from pg_default_acl d where d.defaclnamespace=0 or d.defaclnamespace=(select oid from pg_namespace where nspname='rakeezx')),
    'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
      'definition',pg_get_triggerdef(t.oid,true)) order by c.relname,t.tgname),'[]') from pg_trigger t
      join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='rakeezx' and not t.tgisinternal)
  ) data
)
select encode(sha256(convert_to(data::text,'UTF8')),'hex') security_metadata_sha256 from security_metadata;
commit;
