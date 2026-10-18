-- AI: same metadata-only query for local expected identity and later authorized auditor readback.
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
   from pg_roles where rolname in ('n44_guard','n44_backend')) x),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(x) order by x.member,x.role),'[]') from (
   select member::regrole::text as member,roleid::regrole::text as role,admin_option,inherit_option,set_option from pg_auth_members
   where member in (select oid from pg_roles where rolname in ('n44_guard','n44_backend'))
      or roleid in (select oid from pg_roles where rolname in ('n44_guard','n44_backend'))) x),
 'helpers',(select jsonb_agg(to_jsonb(x) order by x.name,x.args) from (
   select p.proname as name,pg_get_function_identity_arguments(p.oid) as args,p.proowner::regrole::text as owner,
   p.prosecdef,p.proconfig,md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) as definition_md5,p.proacl::text
   from pg_proc p where p.pronamespace='n44_push_draft'::regnamespace) x),
 'tables',(select jsonb_agg(to_jsonb(x) order by x.relname) from (
   select relname,relrowsecurity,relforcerowsecurity,relowner not in (select oid from pg_roles where rolname in ('n44_guard','n44_backend')) as independently_owned
   from pg_class where relnamespace='n44_push_draft'::regnamespace and relkind='r') x),
 'table_grants',(select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.grantee,x.privilege_type) from (
   select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where grantee in ('n44_guard','n44_backend')) x),
 'column_grants',(select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.column_name,x.grantee,x.privilege_type) from (
   select table_schema,table_name,column_name,grantee,privilege_type from information_schema.role_column_grants where grantee in ('n44_guard','n44_backend')) x),
 'policies',(select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.policyname) from (
   select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
   where schemaname='n44_push_draft' or (schemaname='rakeezx' and policyname like 'n44_%')) x),
 'schema',(select jsonb_build_object('owner',nspowner::regrole::text,'acl',nspacl::text) from pg_namespace where nspname='n44_push_draft'),
 'constraints',(select jsonb_agg(to_jsonb(x) order by x.table_name,x.name) from (
   select conrelid::regclass::text as table_name,conname as name,convalidated,condeferrable,condeferred,pg_get_constraintdef(oid) as definition
   from pg_constraint where connamespace='n44_push_draft'::regnamespace) x),
 'indexes',(select jsonb_agg(to_jsonb(x) order by x.tablename,x.indexname) from (
   select tablename,indexname,indexdef from pg_indexes where schemaname='n44_push_draft') x),
 'triggers',(select jsonb_agg(to_jsonb(x) order by x.table_name,x.name) from (
   select tgrelid::regclass::text as table_name,tgname as name,tgenabled,pg_get_triggerdef(oid) as definition from pg_trigger
   where tgrelid in(select oid from pg_class where relnamespace='n44_push_draft'::regnamespace) and not tgisinternal) x),
 'owner_reference_capability',has_column_privilege('postgres','auth.users','id','REFERENCES'),
 'negative_access',jsonb_build_object(
   'anon_private',has_schema_privilege('anon','n44_push_draft','usage'),
   'authenticated_private',has_schema_privilege('authenticated','n44_push_draft','usage'),
   'backend_auth',has_schema_privilege('n44_backend','auth','usage'),
   'backend_session_scan',has_table_privilege('n44_backend','auth.sessions','select'),
   'backend_guard_member',pg_has_role('n44_backend','n44_guard','member'),
   'guard_schema_create',has_schema_privilege('n44_guard','n44_push_draft','CREATE'),
   'backend_schema_create',has_schema_privilege('n44_backend','n44_push_draft','CREATE'))
) as identities;
