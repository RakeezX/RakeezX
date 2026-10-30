-- AI-authored new owner-admin storage prerequisite. Unbound template refuses execution.
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL idle_in_transaction_session_timeout='15s';
SET LOCAL search_path=pg_catalog;
DO $external_gate$
DECLARE
 expected_target jsonb := 'null'::jsonb;
 expected_authority jsonb := 'null'::jsonb;
 observed record; baseline text; target_digest text;
BEGIN
 IF jsonb_typeof(expected_target) IS DISTINCT FROM 'object' OR jsonb_typeof(expected_authority) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'n88_external_target_and_authority_unbound';
 END IF;
 PERFORM set_config('n88.external_authority_ref',expected_authority->>'ref',true);
 PERFORM set_config('n88.external_authority_sha256',encode(sha256(convert_to(expected_authority::text,'UTF8')),'hex'),true);
 PERFORM set_config('n88.external_nonexposure_sha256',expected_target->>'nonExposureReadbackSha256',true);
 target_digest := encode(sha256(convert_to(expected_target::text,'UTF8')),'hex');
 IF expected_target->>'projectRef' IS DISTINCT FROM 'xlrubcwjqktzzunrvuns' OR
    expected_authority->>'productId' IS DISTINCT FROM 'N88' OR
    expected_authority->>'taskId' IS DISTINCT FROM 'continuous-n88-owner-admin-storage-install-20261031' OR
    expected_authority->>'runId' IS DISTINCT FROM 'f63d1781-5921-4fe4-9d60-5eeb7c27e823' OR
    expected_authority->>'action' IS DISTINCT FROM 'install-owner-admin-storage-20261031' OR
    expected_authority->>'targetSha256' IS DISTINCT FROM target_digest OR
    expected_authority->>'deltaSha256' IS DISTINCT FROM '6f0c21236d3a465f399b4b865a562247519c928d6d2a42575a81f6ac3f754026' OR
    coalesce(expected_authority->>'ref','')='' OR
    coalesce((expected_authority->>'expiresAt')::timestamptz,'-infinity'::timestamptz)<=clock_timestamp() OR
    current_setting('n88.external_authority_ref',true) IS DISTINCT FROM expected_authority->>'ref' OR
    current_setting('n88.external_authority_sha256',true) IS DISTINCT FROM encode(sha256(convert_to(expected_authority::text,'UTF8')),'hex') OR
    coalesce(expected_target->>'nonExposureReadbackSha256','') !~ '^[a-f0-9]{64}$' OR
    current_setting('n88.external_nonexposure_sha256',true) IS DISTINCT FROM expected_target->>'nonExposureReadbackSha256' THEN
  RAISE EXCEPTION 'n88_external_exact_authority_mismatch';
 END IF;
 SELECT * INTO STRICT observed FROM (select current_database() as database_name,(select oid::text from pg_database where datname=current_database()) as database_oid,current_user::text as current_role,session_user::text as session_role,host(inet_server_addr()) as server_address,inet_server_port() as server_port,current_setting('server_version_num') as server_version_num,(pg_control_system()).system_identifier::text as system_identifier) identity;
 IF observed.database_name IS DISTINCT FROM expected_target->>'databaseName' OR
    observed.database_oid IS DISTINCT FROM expected_target->>'databaseOid' OR
    observed.system_identifier IS DISTINCT FROM expected_target->>'systemIdentifier' OR
    observed.server_address IS DISTINCT FROM expected_target->>'serverAddress' OR
    observed.server_port::text IS DISTINCT FROM expected_target->>'serverPort' OR
    observed.server_version_num IS DISTINCT FROM expected_target->>'serverVersionNum' OR
    observed.session_role IS DISTINCT FROM expected_target->>'installerSessionRole' OR
    observed.current_role IS DISTINCT FROM expected_target->>'installerCurrentRole' THEN
  RAISE EXCEPTION 'n88_external_physical_target_or_role_mismatch';
 END IF;
 PERFORM pg_advisory_xact_lock(1312307256,88);
 SELECT sha256 INTO STRICT baseline FROM (select encode(sha256(convert_to(jsonb_build_object('roles-and-memberships',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select r.rolname,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcanlogin,r.rolcreatedb,r.rolcreaterole,(select jsonb_agg(jsonb_build_object('role',p.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname) from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid) as memberships from pg_roles r where r.rolname in ('postgres','supabase_auth_admin','n88_backend','n88_guard','n88_v2_runtime','n88_v2_guard','anon','authenticated') order by r.rolname limit 9) q),'relation-identity',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65) q),'constraints-columns-policies',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,(select jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable) order by k.conname) from pg_constraint k where k.conrelid=c.oid) as constraints,(select jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles::text,'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65) q),'function-and-trigger-identity',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,p.prosecdef as definer,pg_get_userbyid(p.proowner) as owner,p.proconfig,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and (p.proname in ('lock_current_session','lock_owner_key','lock_canonical_sources','lock_projection_sources','publication_v2_exact','publication_v2_scope','publication_v2_flags','publication_v2_manual','publication_v2_transition','publication_v2_retire_source') or p.proname in ('v2_0dad27a56bfdc5bfab552235','v2_23ccfc1e16cd0b122d0cb3c3','v2_3b143936c792a16ff5425c3d','v2_5d62e77b02ab6a1fb4e97688','v2_6d27c8049efec0665b9d1f91','v2_71a3e914da47cf1053850671','v2_74c4aa4d430911e99002af80','v2_7874a827dae2373223bc8adc','v2_94bb23dac56c2e002713130a','v2_a3e6d95cdff2d66f56ae84f6','v2_dbe074dae923ca8a3746d390','v2_e1b1c0927f6164faeccb760b','v2_f46afed1e023d013cdabf257','v2_f8a1689cd78951d7fc52ef91')) or n.nspname='rakeezx' and p.proname in ('apply_sync_v2_mutation','sync_v2_stamp_revision') order by n.nspname,p.proname,arguments limit 65) q),'trigger-and-index-identity',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,t.tgname as name,'trigger'::text as kind,pg_get_triggerdef(t.oid) as definition,t.tgenabled::text as enabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and ((n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts'))) union all select n.nspname,c.relname,i.relname as name,'index'::text as kind,pg_get_indexdef(i.oid) as definition,null::text as enabled from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) order by nspname,relname,name limit 257) q),'effective-table-privileges',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,r.rolname,has_table_privilege(r.oid,c.oid,'SELECT') as table_select,has_any_column_privilege(r.oid,c.oid,'SELECT') as column_select,has_table_privilege(r.oid,c.oid,'INSERT') as insert,has_table_privilege(r.oid,c.oid,'UPDATE') as update,has_any_column_privilege(r.oid,c.oid,'UPDATE') as column_update,has_table_privilege(r.oid,c.oid,'DELETE') as delete,has_table_privilege(r.oid,c.oid,'TRUNCATE') as truncate from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r where r.rolname in ('n88_v2_guard','n88_v2_runtime','anon','authenticated') and ((n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions'))) order by n.nspname,c.relname,r.rolname limit 129) q))::text,'UTF8')),'hex') as sha256) inventory;
 IF baseline IS DISTINCT FROM expected_target->>'baselineInventorySha256' THEN RAISE EXCEPTION 'n88_external_prerequisite_inventory_changed'; END IF;
 IF to_regnamespace('n88_private') IS NULL OR to_regrole('n88_backend') IS NULL OR to_regrole('n88_guard') IS NULL OR
    to_regprocedure('n88_private.lock_current_session(uuid,uuid)') IS NULL OR
    to_regprocedure('n88_private.lock_canonical_sources(uuid,integer)') IS NULL OR
    to_regprocedure('n88_private.lock_projection_sources(uuid,integer)') IS NULL THEN RAISE EXCEPTION 'n88_external_original_prerequisite_missing'; END IF;
 IF has_schema_privilege('anon','n88_private','USAGE') OR has_schema_privilege('authenticated','n88_private','USAGE') THEN RAISE EXCEPTION 'n88_external_private_schema_exposed'; END IF;
 IF EXISTS(select 1 from pg_roles where rolname in ('n88_v2_guard','n88_v2_runtime')) OR
    EXISTS(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts')) OR
    EXISTS(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and (p.proname like 'publication_v2_%' or p.proname in ('v2_0dad27a56bfdc5bfab552235','v2_23ccfc1e16cd0b122d0cb3c3','v2_3b143936c792a16ff5425c3d','v2_5d62e77b02ab6a1fb4e97688','v2_6d27c8049efec0665b9d1f91','v2_71a3e914da47cf1053850671','v2_74c4aa4d430911e99002af80','v2_7874a827dae2373223bc8adc','v2_94bb23dac56c2e002713130a','v2_a3e6d95cdff2d66f56ae84f6','v2_dbe074dae923ca8a3746d390','v2_e1b1c0927f6164faeccb760b','v2_f46afed1e023d013cdabf257','v2_f8a1689cd78951d7fc52ef91'))) THEN RAISE EXCEPTION 'n88_external_collision_or_partial_state_readback_only'; END IF;
END
$external_gate$;
DO $original_snapshot$ DECLARE actor_profile record; BEGIN
 IF current_setting('transaction_isolation')<>'serializable' OR current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'n88_transaction_actor_mismatch'; END IF;
 SELECT * INTO STRICT actor_profile FROM pg_roles WHERE rolname=current_user;
 IF actor_profile.rolsuper OR NOT actor_profile.rolcanlogin OR NOT actor_profile.rolcreaterole OR NOT actor_profile.rolinherit OR NOT actor_profile.rolbypassrls OR current_setting('createrole_self_grant')<>'' THEN RAISE EXCEPTION 'n88_actor_profile_changed'; END IF;
 IF (select jsonb_agg(jsonb_build_object('grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option) order by grantor::regrole::text) from pg_auth_members where roleid='n88_guard'::regrole and member='postgres'::regrole) IS DISTINCT FROM '[{"grantor":"postgres","admin":false,"inherit":false,"set":false},{"grantor":"supabase_admin","admin":true,"inherit":false,"set":false}]'::jsonb THEN RAISE EXCEPTION 'n88_original_two_edges_changed'; END IF;
 IF (select proowner from pg_proc where oid='n88_private.lock_current_session(uuid,uuid)'::regprocedure)<>'postgres'::regrole OR
 EXISTS(select 1 from pg_proc where oid in ('n88_private.lock_canonical_sources(uuid,integer)'::regprocedure,'n88_private.lock_projection_sources(uuid,integer)'::regprocedure) and proowner<>'n88_guard'::regrole) THEN RAISE EXCEPTION 'n88_helper_owner_changed'; END IF;
  IF NOT has_database_privilege(current_user,current_database(),'CREATE') OR NOT has_schema_privilege(current_user,'n88_private','USAGE WITH GRANT OPTION') OR
    NOT has_schema_privilege(current_user,'n88_private','CREATE WITH GRANT OPTION') OR
    NOT has_schema_privilege(current_user,'rakeezx','USAGE WITH GRANT OPTION') THEN
  RAISE EXCEPTION 'n88_actor_schema_grant_authority_missing';
 END IF;
 -- Policies require effective ownership, not merely BYPASSRLS/table GRANTs.
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE (n.nspname='rakeezx' AND c.relname IN ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs'))
      OR (n.nspname='n88_private' AND c.relname IN ('contexts','numeric_sessions','numeric_credentials'))
   GROUP BY c.oid,c.relowner HAVING NOT pg_has_role(current_user,c.relowner,'USAGE')) THEN
  RAISE EXCEPTION 'n88_actor_existing_relation_owner_missing';
 END IF;

 PERFORM set_config('n88.admin_original',(select jsonb_build_object('functions',(select coalesce(jsonb_agg(to_jsonb(q) order by q.identity),'[]'::jsonb) from (select p.oid::regprocedure::text as identity,pg_get_functiondef(p.oid) as body,p.proowner,p.proconfig,(select coalesce(jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where not (p.oid in (to_regprocedure('n88_private.lock_current_session(uuid,uuid)'),to_regprocedure('n88_private.lock_canonical_sources(uuid,integer)'),to_regprocedure('n88_private.lock_projection_sources(uuid,integer)')) and to_regrole('n88_v2_runtime') is not null and a.grantee=coalesce(to_regrole('n88_v2_runtime')::oid,0) and a.privilege_type='EXECUTE' and not a.is_grantable and a.grantor=p.proowner)) as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('n88_private','rakeezx','auth') and not (n.nspname='n88_private' and (p.proname like 'publication_v2_%' or p.proname like 'v2_%'))) q),'roles',(select jsonb_agg(to_jsonb(r) order by rolname) from pg_roles r where rolname in ('postgres','n88_guard','n88_backend','supabase_auth_admin')),'edges',(select coalesce(jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor),'[]'::jsonb) from pg_auth_members m where (roleid in ('n88_guard'::regrole,'n88_backend'::regrole) or member in ('n88_guard'::regrole,'n88_backend'::regrole,'postgres'::regrole)) and roleid not in (coalesce(to_regrole('n88_v2_guard')::oid,0),coalesce(to_regrole('n88_v2_runtime')::oid,0)))))::text,true);
 PERFORM set_config('n88.admin_xid',pg_current_xact_id()::text,true);
END $original_snapshot$;
create role n88_v2_runtime nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;
grant execute on function n88_private.lock_current_session(uuid,uuid) to n88_v2_runtime;
grant n88_guard to postgres with admin false, inherit false, set true granted by postgres;
SET LOCAL ROLE n88_guard;
-- INJECTION after-old-set
DO $same_xid$ BEGIN IF pg_current_xact_id()::text<>current_setting('n88.admin_xid') THEN RAISE EXCEPTION 'n88_transaction_changed'; END IF; END $same_xid$;
grant execute on function n88_private.lock_canonical_sources(uuid,integer),n88_private.lock_projection_sources(uuid,integer) to n88_v2_runtime;
-- INJECTION after-helper-acls
SET LOCAL ROLE NONE;
DO $original_actor$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'n88_actor_not_restored'; END IF; END $original_actor$;
grant n88_guard to postgres with admin false, inherit false, set false granted by postgres;
DO $original_edges$ BEGIN IF (select jsonb_agg(jsonb_build_object('grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option) order by grantor::regrole::text) from pg_auth_members where roleid='n88_guard'::regrole and member='postgres'::regrole) IS DISTINCT FROM '[{"grantor":"postgres","admin":false,"inherit":false,"set":false},{"grantor":"supabase_admin","admin":true,"inherit":false,"set":false}]'::jsonb THEN RAISE EXCEPTION 'n88_original_edges_not_restored'; END IF; END $original_edges$;
-- BEGIN EXACT original storage proposal (transaction wrapper excluded)
-- AI-authored UNAPPLIED proposal. Not a migration, not a service activation.
-- New private objects only. Never run against a hosted DB under this card.
-- Synthetic scratch tests may execute this file. No roles/policies/grants created.
create schema if not exists n88_private;

create function n88_private.publication_v2_exact(v jsonb, keys text[]) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(jsonb_typeof(v)='object' and
    (select array_agg(k order by k) from jsonb_object_keys(v) k)=
    (select array_agg(k order by k) from unnest(keys) k), false)
$$;
create function n88_private.publication_v2_scope(v jsonb, owner uuid) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(n88_private.publication_v2_exact(v,array['ownerId','teachingId','sectionId','termId','subjectId']) and
    v->>'ownerId'=owner::text and not exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'string' or char_length(x.value#>>'{}') not between 1 and 200),false)
$$;
create function n88_private.publication_v2_flags(v jsonb) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(n88_private.publication_v2_exact(v,array['required','scheduled','completed','grade']) and
    not exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'boolean'),false)
$$;
create function n88_private.publication_v2_manual(v jsonb) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(jsonb_typeof(v)='array' and jsonb_array_length(v)<=2000 and not exists(
    select 1 from jsonb_array_elements(v) m where not n88_private.publication_v2_exact(m,array['id','title','description','startDate','dueDate','link']) or
      jsonb_typeof(m->'id')<>'string' or m->>'id' !~ '^[A-Za-z0-9_-]{1,100}$' or
      jsonb_typeof(m->'title')<>'string' or char_length(m->>'title') not between 1 and 200 or
      jsonb_typeof(m->'description')<>'string' or char_length(m->>'description')>2000 or
      not (m->'startDate'='null'::jsonb or jsonb_typeof(m->'startDate')='string' and m->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$') or
      not (m->'dueDate'='null'::jsonb or jsonb_typeof(m->'dueDate')='string' and m->>'dueDate' ~ '^\d{4}-\d{2}-\d{2}$') or
      not (m->'link'='null'::jsonb or jsonb_typeof(m->'link')='string' and m->>'link' ~ '^https://' and char_length(m->>'link')<=2048)),false)
$$;

create table n88_private.publication_v2_scopes (
  owner_id uuid not null,
  scope_key text not null check(scope_key ~ '^[a-f0-9]{64}$'),
  store_revision bigint not null check(store_revision>0),
  payload jsonb not null check(octet_length(payload::text)<=2097152),
  primary key(owner_id,scope_key),
  check(n88_private.publication_v2_exact(payload,array['scope','manualTasks'])),
  check(n88_private.publication_v2_scope(payload->'scope',owner_id)),
  check(n88_private.publication_v2_manual(payload->'manualTasks'))
);
-- Canonical jsonb scope identity also unique: alternative scope-key spellings
-- cannot create a second row. Fixed-width built-in SHA-256 needs no extension.
create unique index publication_v2_scope_identity on n88_private.publication_v2_scopes
  (owner_id,(sha256(((payload->'scope')::text)::bytea)));

-- INJECTION partial-v2-ddl
create table n88_private.publication_v2_items (
  owner_id uuid not null,
  scope_key text not null,
  row_id text not null check(octet_length(row_id) between 1 and 2000),
  publication_revision bigint not null check(publication_revision between 0 and 9007199254740991),
  tombstone boolean not null,
  payload jsonb not null check(octet_length(payload::text)<=16384),
  primary key(owner_id,scope_key,row_id),
  foreign key(owner_id,scope_key) references n88_private.publication_v2_scopes(owner_id,scope_key),
  check(n88_private.publication_v2_exact(payload,array['rowId','sourceRevision','publicationRevision','membershipRevision','decisions','tombstone'])),
  check(jsonb_typeof(payload->'rowId')='string' and payload->>'rowId'=row_id),
  check(jsonb_typeof(payload->'publicationRevision')='number' and (payload->>'publicationRevision')::bigint=publication_revision),
  check(jsonb_typeof(payload->'tombstone')='boolean' and (payload->>'tombstone')::boolean=tombstone),
  check(jsonb_typeof(payload->'sourceRevision')='string' and payload->>'sourceRevision' ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(payload->'membershipRevision')='string' and payload->>'membershipRevision' ~ '^[a-f0-9]{64}$'),
  check(n88_private.publication_v2_flags(payload->'decisions')),
  check(not tombstone or payload->'decisions'='{"required":false,"scheduled":false,"completed":false,"grade":false}'::jsonb),
  check(jsonb_typeof(row_id::jsonb)='array' and jsonb_array_length(row_id::jsonb)=3 and row_id::jsonb->>0 in ('item','subitem','manual')),
  check(row_id::jsonb->>0<>'manual' or payload#>>'{decisions,grade}'='false'),
  check(row_id::jsonb->>0<>'item' or (payload#>>'{decisions,required}'='false' and payload#>>'{decisions,scheduled}'='false' and payload#>>'{decisions,completed}'='false'))
);
create table n88_private.publication_v2_high_water (
  owner_id uuid not null,
  scope_key text not null,
  source_key text not null check(char_length(source_key)<=220 and source_key ~ '^(items|scoreSubitems):.'),
  canonical_revision bigint not null check(canonical_revision>0),
  retired boolean not null,
  primary key(owner_id,scope_key,source_key),
  foreign key(owner_id,scope_key) references n88_private.publication_v2_scopes(owner_id,scope_key)
);
create table n88_private.publication_v2_receipts (
  owner_id uuid not null,
  request_id text not null check(request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  scope_key text not null,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check(octet_length(payload::text)<=16384),
  primary key(owner_id,request_id),
  foreign key(owner_id,scope_key) references n88_private.publication_v2_scopes(owner_id,scope_key),
  check(n88_private.publication_v2_exact(payload,array['version','scope','binding','requestId','rowId','sourceRevision','state','publicationRevision'])),
  check(payload->'version'='2'::jsonb and n88_private.publication_v2_scope(payload->'scope',owner_id)),
  check(n88_private.publication_v2_exact(payload->'binding',array['sessionId','leaseId','contextRevision'])),
  check(jsonb_typeof(payload#>'{binding,sessionId}')='string' and char_length(payload#>>'{binding,sessionId}') between 1 and 200),
  check(jsonb_typeof(payload#>'{binding,leaseId}')='string' and char_length(payload#>>'{binding,leaseId}') between 1 and 200),
  check(jsonb_typeof(payload#>'{binding,contextRevision}')='string' and char_length(payload#>>'{binding,contextRevision}') between 1 and 200),
  check(jsonb_typeof(payload->'requestId')='string' and payload->>'requestId'=request_id),
  check(jsonb_typeof(payload->'rowId')='string' and octet_length(payload->>'rowId') between 1 and 2000),
  check(jsonb_typeof(payload->'sourceRevision')='string' and payload->>'sourceRevision' ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(payload->'state')='string' and payload->>'state' in ('applied','rejected')),
  check(jsonb_typeof(payload->'publicationRevision')='number' and (payload->>'publicationRevision')::bigint between 0 and 9007199254740991)
);

-- No purge/reset path. Future approved retention must preserve unresolved UNKNOWN
-- identities and prevent old source/request IDs from being recycled.
create function n88_private.publication_v2_transition() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if TG_OP in ('DELETE','TRUNCATE') or TG_TABLE_NAME='publication_v2_receipts' then
    raise exception using errcode='23514', message='n88_v2_immutable_identity';
  end if;
  if NEW.owner_id<>OLD.owner_id or NEW.scope_key<>OLD.scope_key then
    raise exception using errcode='23514', message='n88_v2_scope_immutable';
  end if;
  if TG_TABLE_NAME='publication_v2_scopes' then
    if NEW.payload->'scope'<>OLD.payload->'scope' or NEW.store_revision<>OLD.store_revision+1 then
      raise exception using errcode='23514', message='n88_v2_scope_revision';
    end if;
  elsif TG_TABLE_NAME='publication_v2_items' then
    if NEW.row_id<>OLD.row_id or NEW.publication_revision<=OLD.publication_revision or OLD.tombstone and not NEW.tombstone then
      raise exception using errcode='23514', message='n88_v2_publication_revision';
    end if;
  elsif TG_TABLE_NAME='publication_v2_high_water' then
    if NEW.source_key<>OLD.source_key or NEW.canonical_revision<OLD.canonical_revision or OLD.retired and not NEW.retired then
      raise exception using errcode='23514', message='n88_v2_source_revision';
    end if;
  end if;
  return NEW;
end
$$;
create trigger publication_v2_scope_guard before update or delete on n88_private.publication_v2_scopes for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_item_guard before update or delete on n88_private.publication_v2_items for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_water_guard before update or delete on n88_private.publication_v2_high_water for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_receipt_guard before update or delete on n88_private.publication_v2_receipts for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_scope_truncate before truncate on n88_private.publication_v2_scopes for each statement execute function n88_private.publication_v2_transition();
create trigger publication_v2_item_truncate before truncate on n88_private.publication_v2_items for each statement execute function n88_private.publication_v2_transition();
create trigger publication_v2_water_truncate before truncate on n88_private.publication_v2_high_water for each statement execute function n88_private.publication_v2_transition();
create trigger publication_v2_receipt_truncate before truncate on n88_private.publication_v2_receipts for each statement execute function n88_private.publication_v2_transition();

-- Internal deletion-journal hook for a FUTURE authorized canonical lifecycle
-- integration. Call in the SAME canonical deletion transaction, with verified
-- owner/scope and OLD canonical identity/revision, never request-supplied facts.
-- Not attached to canonical tables here, not executable by browser roles.
-- This persists retirement even if deletion/restoration happens between reads.
create function n88_private.publication_v2_retire_source(p_owner uuid,p_scope text,p_family text,p_source text,p_revision bigint) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if p_family not in ('items','scoreSubitems') or p_revision<1 or p_revision is null or p_owner is null or
     p_scope is null or p_scope !~ '^[a-f0-9]{64}$' or p_source is null or char_length(p_source) not between 1 and 200 then
    raise exception using errcode='23514', message='n88_v2_retirement_unavailable';
  end if;
  perform pg_advisory_xact_lock(1312307256,88);
  perform 1 from n88_private.publication_v2_scopes where owner_id=p_owner and scope_key=p_scope for update;
  if not found then raise exception using errcode='23514', message='n88_v2_retirement_unavailable'; end if;
  insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired)
    values(p_owner,p_scope,p_family||':'||p_source,p_revision,true)
    on conflict(owner_id,scope_key,source_key) do update set canonical_revision=greatest(publication_v2_high_water.canonical_revision,excluded.canonical_revision),retired=true;
  -- Parent retirement includes all its children; no aggregate publication exists.
  update n88_private.publication_v2_items set publication_revision=publication_revision+1,tombstone=true,
    payload=payload||jsonb_build_object('publicationRevision',publication_revision+1,'tombstone',true,
      'decisions',jsonb_build_object('required',false,'scheduled',false,'completed',false,'grade',false))
    where owner_id=p_owner and scope_key=p_scope and not tombstone and
      (p_family='items' and row_id::jsonb->>1=p_source or p_family='scoreSubitems' and row_id::jsonb->>0='subitem' and row_id::jsonb->>2=p_source);
  update n88_private.publication_v2_scopes set store_revision=store_revision+1 where owner_id=p_owner and scope_key=p_scope;
end
$$;

revoke all on n88_private.publication_v2_scopes,n88_private.publication_v2_items,n88_private.publication_v2_high_water,n88_private.publication_v2_receipts from public;
revoke all on function n88_private.publication_v2_exact(jsonb,text[]),n88_private.publication_v2_scope(jsonb,uuid),n88_private.publication_v2_flags(jsonb),n88_private.publication_v2_manual(jsonb),n88_private.publication_v2_transition() from public;
revoke all on function n88_private.publication_v2_retire_source(uuid,text,text,text,bigint) from public;
-- Revoke only these new objects, including direct grants from existing defaults.
do $$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if exists(select 1 from pg_catalog.pg_roles where rolname=role_name) then
      execute format('revoke all on n88_private.publication_v2_scopes,n88_private.publication_v2_items,n88_private.publication_v2_high_water,n88_private.publication_v2_receipts from %I',role_name);
      execute format('revoke all on function n88_private.publication_v2_exact(jsonb,text[]),n88_private.publication_v2_scope(jsonb,uuid),n88_private.publication_v2_flags(jsonb),n88_private.publication_v2_manual(jsonb),n88_private.publication_v2_transition() from %I',role_name);
      execute format('revoke all on function n88_private.publication_v2_retire_source(uuid,text,text,text,bigint) from %I',role_name);
    end if;
  end loop;
end
$$;

-- END EXACT original storage proposal
-- Runtime was created by actual postgres inside this transaction.
create role n88_v2_guard nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
-- PG17 creator ADMIN does not imply SET with empty createrole_self_grant.
DO $new_membership$ BEGIN
 PERFORM set_config('n88.actor_qualified_creator_edges',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m WHERE m.roleid='n88_v2_guard'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('grant n88_v2_guard to %I with inherit false, set true',current_user);
 IF NOT pg_has_role(current_user,'n88_v2_guard','SET') OR pg_has_role(current_user,'n88_v2_guard','USAGE') THEN
  RAISE EXCEPTION 'n88_actor_new_guard_set_qualification_failed'; END IF;
END $new_membership$;
grant usage on schema n88_private to n88_v2_guard,n88_v2_runtime;
grant select,update(namespace) on n88_private.contexts to n88_v2_guard;
grant select,update(row_key) on n88_private.numeric_sessions,n88_private.numeric_credentials to n88_v2_guard;
create policy v2_lookup on n88_private.contexts for select to n88_v2_guard using(true);
create policy v2_lock on n88_private.contexts for update to n88_v2_guard using(true) with check(false);
create policy v2_lookup on n88_private.numeric_sessions for select to n88_v2_guard using(true);
create policy v2_lock on n88_private.numeric_sessions for update to n88_v2_guard using(true) with check(false);
create policy v2_lookup on n88_private.numeric_credentials for select to n88_v2_guard using(true);
create policy v2_lock on n88_private.numeric_credentials for update to n88_v2_guard using(true) with check(false);
alter table n88_private.publication_v2_scopes enable row level security;
alter table n88_private.publication_v2_scopes force row level security;
create policy v2_owned on n88_private.publication_v2_scopes to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert,update on n88_private.publication_v2_scopes to n88_v2_guard;
alter table n88_private.publication_v2_items enable row level security;
alter table n88_private.publication_v2_items force row level security;
create policy v2_owned on n88_private.publication_v2_items to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert,update on n88_private.publication_v2_items to n88_v2_guard;
alter table n88_private.publication_v2_high_water enable row level security;
alter table n88_private.publication_v2_high_water force row level security;
create policy v2_owned on n88_private.publication_v2_high_water to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert,update on n88_private.publication_v2_high_water to n88_v2_guard;
alter table n88_private.publication_v2_receipts enable row level security;
alter table n88_private.publication_v2_receipts force row level security;
create policy v2_owned on n88_private.publication_v2_receipts to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert on n88_private.publication_v2_receipts to n88_v2_guard;
grant execute on function n88_private.publication_v2_exact(jsonb,text[]),n88_private.publication_v2_scope(jsonb,uuid),n88_private.publication_v2_flags(jsonb),n88_private.publication_v2_manual(jsonb) to n88_v2_guard;
-- Exact existing helper grants are prerequisites; this candidate never changes their ACLs.
grant create on schema n88_private to n88_v2_guard;
-- owner-context; exact original SQL SHA256 f8a1689cd78951d7fc52ef91eb51423510f98cbf717a42c162572b2c69bf692b
create function n88_private.v2_f8a1689cd78951d7fc52ef91(p1 uuid) returns table(namespace text,owner_id uuid,active boolean) language sql security definer set search_path=pg_catalog as $v2$select namespace,owner_id,active from n88_private.contexts where owner_id=p1::uuid for share$v2$;
revoke all on function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) from public;
grant execute on function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) to n88_v2_runtime;
alter function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) owner to n88_v2_guard;
-- numeric-session; exact original SQL SHA256 7874a827dae2373223bc8adc67a2a30d158ed7e1e40183e72a8cff2c1df55a90
create function n88_private.v2_7874a827dae2373223bc8adc(p1 text) returns table(payload jsonb) language sql security definer set search_path=pg_catalog as $v2$select payload from n88_private.numeric_sessions where token_hash=p1 for share$v2$;
revoke all on function n88_private.v2_7874a827dae2373223bc8adc(text) from public;
grant execute on function n88_private.v2_7874a827dae2373223bc8adc(text) to n88_v2_runtime;
alter function n88_private.v2_7874a827dae2373223bc8adc(text) owner to n88_v2_guard;
-- numeric-credential; exact original SQL SHA256 6d27c8049efec0665b9d1f91f20f631f036ebb8403a3301bcc211176a6d1c751
create function n88_private.v2_6d27c8049efec0665b9d1f91(p1 uuid,p2 uuid,p3 text,p4 text) returns table(payload jsonb) language sql security definer set search_path=pg_catalog as $v2$select payload from n88_private.numeric_credentials where id=p1::uuid and owner_id=p2::uuid and student_id=p3 and version=p4::bigint for share$v2$;
revoke all on function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) from public;
grant execute on function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) to n88_v2_runtime;
alter function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) owner to n88_v2_guard;
-- read-scopes; exact original SQL SHA256 e1b1c0927f6164faeccb760bbe7678f49ff4bfec39ac0e057b7be9b754ec33bf
create function n88_private.v2_e1b1c0927f6164faeccb760b(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,store_revision::text as store_revision,payload from n88_private.publication_v2_scopes where owner_id=p1::uuid order by scope_key limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) from public;
grant execute on function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) to n88_v2_runtime;
alter function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) owner to n88_v2_guard;
-- read-items; exact original SQL SHA256 f46afed1e023d013cdabf257a722636fc6929997f1612d157d83327bae417a22
create function n88_private.v2_f46afed1e023d013cdabf257(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload from n88_private.publication_v2_items where owner_id=p1::uuid order by scope_key,row_id limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) from public;
grant execute on function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) to n88_v2_runtime;
alter function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) owner to n88_v2_guard;
-- read-high_water; exact original SQL SHA256 0dad27a56bfdc5bfab552235376bffb18292e9cfd59f29465272b0ba1bef11f3
create function n88_private.v2_0dad27a56bfdc5bfab552235(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,source_key,canonical_revision::text as canonical_revision,retired from n88_private.publication_v2_high_water where owner_id=p1::uuid order by scope_key,source_key limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) from public;
grant execute on function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) to n88_v2_runtime;
alter function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) owner to n88_v2_guard;
-- read-receipts; exact original SQL SHA256 71a3e914da47cf1053850671fc8c2835603b1bc3490153fbb1784e773e0417eb
create function n88_private.v2_71a3e914da47cf1053850671(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select request_id,scope_key,fingerprint,payload from n88_private.publication_v2_receipts where owner_id=p1::uuid order by request_id limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) from public;
grant execute on function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) to n88_v2_runtime;
alter function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) owner to n88_v2_guard;
-- insert-scope; exact original SQL SHA256 74c4aa4d430911e99002af80476a8c2647e430d81bd66eff0ce4ca1c1d7ddf12
create function n88_private.v2_74c4aa4d430911e99002af80(p1 uuid,p2 text,p3 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values(p1::uuid,p2,1,p3::jsonb); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) from public;
grant execute on function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) to n88_v2_runtime;
alter function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) owner to n88_v2_guard;
-- cas-scope; exact original SQL SHA256 dbe074dae923ca8a3746d390240287893cd777e5f01b8b27fe07477aeda85df0
create function n88_private.v2_dbe074dae923ca8a3746d390(p1 uuid,p2 text,p3 text,p4 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=p3::jsonb where owner_id=p1::uuid and scope_key=p2 and store_revision=p4::bigint; GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) from public;
grant execute on function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) to n88_v2_runtime;
alter function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) owner to n88_v2_guard;
-- insert-item; exact original SQL SHA256 a3e6d95cdff2d66f56ae84f6530f07f9bc970a014b2f3a25d31f548173d2c508
create function n88_private.v2_a3e6d95cdff2d66f56ae84f6(p1 uuid,p2 text,p3 text,p4 text,p5 boolean,p6 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values(p1::uuid,p2,p3,p4::bigint,p5,p6::jsonb); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) from public;
grant execute on function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) to n88_v2_runtime;
alter function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) owner to n88_v2_guard;
-- cas-item; exact original SQL SHA256 5d62e77b02ab6a1fb4e97688aa1810d3559d998a42ab85a04435819f19017f21
create function n88_private.v2_5d62e77b02ab6a1fb4e97688(p1 uuid,p2 text,p3 text,p4 text,p5 boolean,p6 text,p7 text,p8 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin update n88_private.publication_v2_items set publication_revision=p4::bigint,tombstone=p5,payload=p6::jsonb where owner_id=p1::uuid and scope_key=p2 and row_id=p3 and publication_revision=p7::bigint and payload=p8::jsonb; GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) from public;
grant execute on function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) to n88_v2_runtime;
alter function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) owner to n88_v2_guard;
-- insert-high-water; exact original SQL SHA256 23ccfc1e16cd0b122d0cb3c342a2492cc10f5e108becfcd5b1955b3a42772c73
create function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(p1 uuid,p2 text,p3 text,p4 text,p5 boolean) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values(p1::uuid,p2,p3,p4::bigint,p5); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) from public;
grant execute on function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) to n88_v2_runtime;
alter function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) owner to n88_v2_guard;
-- cas-high-water; exact original SQL SHA256 94bb23dac56c2e002713130ac7ddb2c686561f7c1bbe1f1464a873629c5237fc
create function n88_private.v2_94bb23dac56c2e002713130a(p1 uuid,p2 text,p3 text,p4 text,p5 boolean,p6 text,p7 boolean) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin update n88_private.publication_v2_high_water set canonical_revision=p4::bigint,retired=p5 where owner_id=p1::uuid and scope_key=p2 and source_key=p3 and canonical_revision=p6::bigint and retired=p7; GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) from public;
grant execute on function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) to n88_v2_runtime;
alter function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) owner to n88_v2_guard;
-- insert-receipt; exact original SQL SHA256 3b143936c792a16ff5425c3dd129c1065921837cfaa15fdcc018734517196acf
create function n88_private.v2_3b143936c792a16ff5425c3d(p1 uuid,p2 text,p3 text,p4 text,p5 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values(p1::uuid,p2,p3,p4,p5::jsonb); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) from public;
grant execute on function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) to n88_v2_runtime;
alter function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) owner to n88_v2_guard;
revoke create on schema n88_private from n88_v2_guard;
-- Remove the temporary self-granted SET edge; preserve the PG17 mandatory
-- bootstrap-granted ADMIN edge (INHERIT=false/SET=false), which CREATEROLE cannot revoke.
-- No legacy role membership/ownership/ACL is repaired here.
DO $new_membership_cleanup$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['n88_v2_guard'] LOOP
  EXECUTE format('revoke %I from %I',role_name,current_user);
 END LOOP;
 IF (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.grantor),'[]'::jsonb) FROM pg_auth_members m WHERE m.roleid='n88_v2_guard'::regrole AND m.member=current_user::regrole) IS DISTINCT FROM current_setting('n88.actor_qualified_creator_edges')::jsonb
 OR pg_has_role(current_user,'n88_v2_guard','SET') OR pg_has_role(current_user,'n88_v2_guard','USAGE')
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='n88_v2_guard'::regrole AND member=current_user::regrole AND grantor=current_user::regrole) THEN
  RAISE EXCEPTION 'n88_actor_temporary_membership_remains'; END IF;
END $new_membership_cleanup$;
DO $external_readback$
DECLARE observed jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(q) order by q.name) INTO observed FROM (
 select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,p.prosecdef as definer,pg_get_userbyid(p.proowner) as owner,p.proconfig as config,
 (select array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(r.rolname,'PUBLIC'),a.privilege_type) from aclexplode(p.proacl) a left join pg_roles r on r.oid=a.grantee) as acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and p.proname in ('v2_0dad27a56bfdc5bfab552235','v2_23ccfc1e16cd0b122d0cb3c3','v2_3b143936c792a16ff5425c3d','v2_5d62e77b02ab6a1fb4e97688','v2_6d27c8049efec0665b9d1f91','v2_71a3e914da47cf1053850671','v2_74c4aa4d430911e99002af80','v2_7874a827dae2373223bc8adc','v2_94bb23dac56c2e002713130a','v2_a3e6d95cdff2d66f56ae84f6','v2_dbe074dae923ca8a3746d390','v2_e1b1c0927f6164faeccb760b','v2_f46afed1e023d013cdabf257','v2_f8a1689cd78951d7fc52ef91')) q;
 IF observed IS DISTINCT FROM '[{"name":"v2_0dad27a56bfdc5bfab552235","definition":"0aadee3865cb4c0575a3abe06ccd6fc1bce7e317da292c133145f6cc2117b91a","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_23ccfc1e16cd0b122d0cb3c3","definition":"277c6405d47dfe5f193982cb4d591889081f63aa403f1b53698da3cc963e6573","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_3b143936c792a16ff5425c3d","definition":"70ebe1fab16d248125ba9ba231e05e7d5385bddd91973031e5407f8b822564bb","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_5d62e77b02ab6a1fb4e97688","definition":"a70a8255124089753437b62447cb542fa21af059ee025fe7641f3e0a02454cf1","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_6d27c8049efec0665b9d1f91","definition":"ba27f79ab0a2aeab728a5695543ea64f660c9ee049847bcfa74f86c2badc8822","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_71a3e914da47cf1053850671","definition":"1d32ca5bbb74a3d9af199a378c9b71f5dca364db588fd47eadf9298203e9db28","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_74c4aa4d430911e99002af80","definition":"ccb5c0585d18d7e94f6765ca522a2426f0c0e4cc2ce363b23ffbd1d25dadbbda","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_7874a827dae2373223bc8adc","definition":"0f38db25d66389643b074dd8c46eab079aea0e3e25e8dd082bd58a327e26e533","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_94bb23dac56c2e002713130a","definition":"38a36af0320818a809b4dcca844098eadc71af5cf95912ed6aca49d9f89d34d3","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_a3e6d95cdff2d66f56ae84f6","definition":"f32fbd2a6ce1d8a3abb4503d67cee64f006d9af38c764ee8d2e0a9011fa6beb6","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_dbe074dae923ca8a3746d390","definition":"2b7cba6ba01cd276e76267da996f3a8a336e1e5d9ac1bad149698ff05908b5b5","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_e1b1c0927f6164faeccb760b","definition":"a8a31033f93b613376ac1c4695cc6839def54236794c8f698b000ba6605cb471","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_f46afed1e023d013cdabf257","definition":"17bd70bd63d76000de1a54906634e3cbecd9941350315af89d0210748ed45960","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_f8a1689cd78951d7fc52ef91","definition":"ed645e03679e62e1bf90646037781c367e0b2f421583749b59bfc591df866e33","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]}]'::jsonb THEN RAISE EXCEPTION 'n88_external_fixed_function_readback_mismatch'; END IF;
 IF (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts') and c.relrowsecurity and c.relforcerowsecurity)<>4 THEN RAISE EXCEPTION 'n88_external_storage_rls_mismatch'; END IF;
 IF (select count(*) from pg_roles where rolname in ('n88_v2_guard','n88_v2_runtime') and not rolsuper and not rolbypassrls and not rolcanlogin and not rolinherit and not rolcreatedb and not rolcreaterole)<>2 THEN RAISE EXCEPTION 'n88_external_new_role_mismatch'; END IF;
END
$external_readback$;
DO $admin_readback$ DECLARE checked_role text; BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('transaction_isolation')<>'serializable' OR pg_current_xact_id()::text<>current_setting('n88.admin_xid') THEN RAISE EXCEPTION 'n88_transaction_changed'; END IF;
 IF (select jsonb_build_object('functions',(select coalesce(jsonb_agg(to_jsonb(q) order by q.identity),'[]'::jsonb) from (select p.oid::regprocedure::text as identity,pg_get_functiondef(p.oid) as body,p.proowner,p.proconfig,(select coalesce(jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where not (p.oid in (to_regprocedure('n88_private.lock_current_session(uuid,uuid)'),to_regprocedure('n88_private.lock_canonical_sources(uuid,integer)'),to_regprocedure('n88_private.lock_projection_sources(uuid,integer)')) and to_regrole('n88_v2_runtime') is not null and a.grantee=coalesce(to_regrole('n88_v2_runtime')::oid,0) and a.privilege_type='EXECUTE' and not a.is_grantable and a.grantor=p.proowner)) as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('n88_private','rakeezx','auth') and not (n.nspname='n88_private' and (p.proname like 'publication_v2_%' or p.proname like 'v2_%'))) q),'roles',(select jsonb_agg(to_jsonb(r) order by rolname) from pg_roles r where rolname in ('postgres','n88_guard','n88_backend','supabase_auth_admin')),'edges',(select coalesce(jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor),'[]'::jsonb) from pg_auth_members m where (roleid in ('n88_guard'::regrole,'n88_backend'::regrole) or member in ('n88_guard'::regrole,'n88_backend'::regrole,'postgres'::regrole)) and roleid not in (coalesce(to_regrole('n88_v2_guard')::oid,0),coalesce(to_regrole('n88_v2_runtime')::oid,0))))) IS DISTINCT FROM current_setting('n88.admin_original')::jsonb THEN RAISE EXCEPTION 'n88_original_metadata_changed'; END IF;
 IF (select jsonb_agg(jsonb_build_object('grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option) order by grantor::regrole::text) from pg_auth_members where roleid='n88_guard'::regrole and member='postgres'::regrole) IS DISTINCT FROM '[{"grantor":"postgres","admin":false,"inherit":false,"set":false},{"grantor":"supabase_admin","admin":true,"inherit":false,"set":false}]'::jsonb THEN RAISE EXCEPTION 'n88_old_edges_changed'; END IF;
 IF (select count(*) from pg_auth_members where roleid in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) or member in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole))<>2 OR
 EXISTS(select 1 from pg_auth_members where (roleid in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) or member in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole)) and not (roleid in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) and member='postgres'::regrole and grantor='supabase_admin'::regrole and admin_option and not inherit_option and not set_option)) THEN RAISE EXCEPTION 'n88_nonmandatory_creator_membership'; END IF;
 FOREACH checked_role IN ARRAY ARRAY['n88_guard','n88_v2_guard','n88_v2_runtime'] LOOP
 IF pg_has_role('postgres',checked_role,'SET') OR pg_has_role('postgres',checked_role,'USAGE') THEN RAISE EXCEPTION 'n88_effective_role_leak'; END IF; END LOOP;
 IF EXISTS(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('n88_private','auth','rakeezx') and c.relkind in ('r','p','v','m','f') and (has_table_privilege('n88_v2_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('n88_v2_runtime',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'n88_runtime_raw_access'; END IF;
 IF (select count(*) from pg_proc where pronamespace='n88_private'::regnamespace and proname like 'publication_v2_%')<>6 OR
 EXISTS(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.pronamespace='n88_private'::regnamespace and (p.proname like 'publication_v2_%' or p.proname like 'v2_%') and (a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole) or a.grantee<>p.proowner and (a.grantee not in ('n88_v2_runtime'::regrole,'n88_v2_guard'::regrole) or a.is_grantable))) THEN RAISE EXCEPTION 'n88_new_function_acl_exposed'; END IF;
 IF (select count(*) from pg_proc p cross join lateral aclexplode(p.proacl) a where p.oid in ('n88_private.lock_current_session(uuid,uuid)'::regprocedure,'n88_private.lock_canonical_sources(uuid,integer)'::regprocedure,'n88_private.lock_projection_sources(uuid,integer)'::regprocedure) and a.grantee='n88_v2_runtime'::regrole and a.grantor=p.proowner and a.privilege_type='EXECUTE' and not a.is_grantable)<>3 THEN RAISE EXCEPTION 'n88_helper_acl_delta_mismatch'; END IF;
END $admin_readback$;
COMMIT;
