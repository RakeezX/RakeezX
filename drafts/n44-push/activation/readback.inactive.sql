-- AI: metadata only; later authorized auditor. No private rows or secret output.
begin read only;
set local statement_timeout='5s';
-- AI: READ-ONLY proposal for the later authorized operator; no data row/token output.
select nspname from pg_catalog.pg_namespace where nspname='n44_push_draft';
select rolname,rolcanlogin,rolsuper,rolbypassrls from pg_catalog.pg_roles where rolname in ('n44_guard','n44_backend');
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_catalog.pg_policies where schemaname='n44_push_draft' or policyname='n44_guard_read';
select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='n44_push_draft';
select p.oid::regprocedure,p.prosecdef,p.proconfig,p.proacl,r.rolname,pg_catalog.pg_get_functiondef(p.oid) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_roles r on r.oid=p.proowner where n.nspname='n44_push_draft';
select c.conrelid::regclass,c.conname,c.contype,c.condeferrable,c.convalidated,pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c join pg_catalog.pg_namespace n on n.oid=c.connamespace where n.nspname in ('n44_push_draft','rakeezx');
select schemaname,tablename,indexname,indexdef from pg_catalog.pg_indexes where schemaname='n44_push_draft';
select grantee,table_schema,table_name,column_name,privilege_type from information_schema.column_privileges where grantee in ('n44_guard','n44_backend') order by grantee,table_schema,table_name,column_name;
select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema='auth' and (table_name='users' and column_name in ('id','banned_until') or table_name='sessions' and column_name in ('id','user_id','not_after'));
select has_schema_privilege('anon','n44_push_draft','USAGE') as anon_schema,has_schema_privilege('authenticated','n44_push_draft','USAGE') as authenticated_schema,has_function_privilege('authenticated','n44_push_draft.read_source(uuid,text,text)','EXECUTE') as user_source_helper;
-- Existing management capability and exact helper privileges, metadata only.
select rolname,rolsuper,rolbypassrls,pg_has_role('postgres','supabase_auth_admin','member') as auth_owner_member,
 has_schema_privilege('postgres','auth','USAGE') as auth_usage,has_schema_privilege('postgres','auth','CREATE') as auth_create
 from pg_catalog.pg_roles where rolname='postgres';
select c.relname,r.rolname as owner,c.relrowsecurity,c.relforcerowsecurity
 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_roles r on r.oid=c.relowner
 where n.nspname='auth' and c.relname in ('users','sessions');
select policyname,roles,cmd from pg_catalog.pg_policies where schemaname='auth' and tablename in ('users','sessions');
select has_column_privilege('postgres','auth.users','id','SELECT') as user_id_read,
 has_column_privilege('postgres','auth.users','banned_until','SELECT') as user_ban_read,
 has_column_privilege('postgres','auth.users','id','UPDATE') as user_id_lock,
 has_column_privilege('postgres','auth.sessions','id','SELECT') as session_id_read,
 has_column_privilege('postgres','auth.sessions','user_id','SELECT') as session_owner_read,
 has_column_privilege('postgres','auth.sessions','not_after','SELECT') as session_expiry_read,
 has_column_privilege('postgres','auth.sessions','id','UPDATE') as session_id_lock;
-- Actual timebox/inactivity/single-session policy requires separate fresh readonly
-- Auth configuration metadata fresh at exact approval activation. Any policy change
-- first disables/drains N44 and retires that approval/bindings before NEW approval
-- requalification. No daily human renewal. Table existence/not_after is not policy proof.
-- Unknown/unsupported N44_SESSION_POLICY_JSON must keep all live flags OFF.

select has_column_privilege('postgres','auth.users','id','REFERENCES') as existing_owner_fk_reference_capability;
-- Also readback exact function/version/config hashes from provider metadata, OFF flags, routes and cron.
rollback;
