-- AI: catalog-only exact extended schema readback; no personal rows, keys or settings.
with baseline as (-- AI: same metadata-only query for local expected identity and later authorized auditor readback.
select jsonb_build_object(
 'management',(select jsonb_build_object('role',rolname,'bypassrls',rolbypassrls,'superuser',rolsuper,
   'auth_owner_member',pg_has_role('postgres','supabase_auth_admin','MEMBER'),
   'auth_create',has_schema_privilege('postgres','auth','CREATE')) from pg_roles where rolname='postgres'),
 'auth',(select jsonb_agg(to_jsonb(x) order by x.relname) from (
   select relname,relrowsecurity,relforcerowsecurity,relowner::regrole::text as owner from pg_class
   where oid in ('auth.users'::regclass,'auth.sessions'::regclass)) x),
 'auth_policy_count',(select count(*) from pg_policies where schemaname='auth' and tablename in ('users','sessions')),
 'roles',(select jsonb_agg(to_jsonb(x) order by x.rolname) from (
   select rolname,rolcanlogin,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
   from pg_roles where rolname in ('n88_guard','n88_backend')) x),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(x) order by x.member,x.role),'[]') from (
   select member::regrole::text as member,roleid::regrole::text as role,admin_option,inherit_option,set_option from pg_auth_members
   where member in (select oid from pg_roles where rolname in ('n88_guard','n88_backend'))
      or roleid in (select oid from pg_roles where rolname in ('n88_guard','n88_backend'))) x),
 'helpers',(select jsonb_agg(to_jsonb(x) order by x.name,x.args) from (
   select p.proname as name,pg_get_function_identity_arguments(p.oid) as args,p.proowner::regrole::text as owner,
   p.prosecdef,p.proconfig,md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) as definition_md5,p.proacl::text
   from pg_proc p where p.pronamespace='n88_private'::regnamespace) x),
 'tables',(select jsonb_agg(to_jsonb(x) order by x.relname) from (
   select relname,relrowsecurity,relforcerowsecurity,relowner not in (select oid from pg_roles where rolname in ('n88_guard','n88_backend')) as independently_owned
   from pg_class where relnamespace='n88_private'::regnamespace and relkind='r') x),
 'table_grants',(select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.grantee,x.privilege_type) from (
   select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where grantee in ('n88_guard','n88_backend')) x),
 'column_grants',(select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.column_name,x.grantee,x.privilege_type) from (
   select table_schema,table_name,column_name,grantee,privilege_type from information_schema.role_column_grants where grantee in ('n88_guard','n88_backend')) x),
 'policies',(select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.policyname) from (
   select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
   where schemaname='n88_private' or (schemaname='rakeezx' and policyname like 'n88_%')) x),
 'negative_access',jsonb_build_object(
   'anon_private',has_schema_privilege('anon','n88_private','usage'),
   'authenticated_private',has_schema_privilege('authenticated','n88_private','usage'),
   'backend_auth',has_schema_privilege('n88_backend','auth','usage'),
   'backend_session_scan',has_table_privilege('n88_backend','auth.sessions','select'),
   'backend_guard_member',pg_has_role('n88_backend','n88_guard','member'))
) as identities)
select identities || jsonb_build_object(
 'private_constraints',(select jsonb_agg(to_jsonb(x) order by x.table_name,x.name) from (
  select c.conrelid::regclass::text as table_name,c.conname as name,c.contype,c.convalidated,c.condeferrable,pg_get_constraintdef(c.oid) as definition
  from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relnamespace='n88_private'::regnamespace) x),
 'private_indexes',(select jsonb_agg(to_jsonb(x) order by x.tablename,x.indexname) from (
  select tablename,indexname,indexdef from pg_indexes where schemaname='n88_private') x),
 'private_triggers',(select jsonb_agg(to_jsonb(x) order by x.table_name,x.name) from (
  select t.tgrelid::regclass::text as table_name,t.tgname as name,t.tgenabled,pg_get_triggerdef(t.oid) as definition
  from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='n88_private'::regnamespace and not t.tgisinternal) x)
) as identities from baseline;
