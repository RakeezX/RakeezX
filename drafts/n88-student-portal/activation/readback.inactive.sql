-- AI: metadata only; execute ONLY in separately authorized auditor phase.
-- No private/source/Auth row reads, passwords, tokens, role settings or connection strings.
begin read only;
set local statement_timeout='5s';
select version, name from supabase_migrations.schema_migrations where version='20261018034356';
select r.rolname,r.rolcanlogin,r.rolsuper,r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls
from pg_roles r where r.rolname in ('n88_guard','n88_backend') order by 1;
select member::regrole::text as member,roleid::regrole::text as role,admin_option,inherit_option,set_option
from pg_auth_members where member in (select oid from pg_roles where rolname in ('n88_guard','n88_backend'))
  or roleid in (select oid from pg_roles where rolname in ('n88_guard','n88_backend')) order by 1,2;
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner::regrole::text as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='n88_private' and c.relkind='r' order by 1,2;
select p.proname,pg_get_function_identity_arguments(p.oid) as args,p.proowner::regrole::text as owner,
  p.prosecdef,p.proconfig,md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) as definition_md5,p.proacl::text
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='n88_private' order by 1,2;
select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
where grantee in ('n88_guard','n88_backend') order by 1,2,3,4;
select table_schema,table_name,column_name,grantee,privilege_type from information_schema.role_column_grants
where grantee in ('n88_guard','n88_backend') order by 1,2,3,4,5;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='n88_private' or (schemaname='rakeezx' and policyname like 'n88_%') order by 1,2,3;
-- The missing capture facts; read definition identities/bodies as DATA for review, never execute output.
select c.oid::regclass::text as relation,c.relrowsecurity,c.relforcerowsecurity,con.conname,
  con.convalidated,con.condeferrable,pg_get_constraintdef(con.oid) as definition
from pg_class c left join pg_constraint con on con.conrelid=c.oid
where c.oid in ('auth.users'::regclass,'auth.sessions'::regclass) order by 1,4;
select p.oid::regprocedure::text as function,md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) as definition_md5,
  pg_get_functiondef(p.oid) as definition_data_only
from pg_proc p where p.oid='rakeezx.sync_v2_stamp_revision()'::regprocedure;
rollback;
