-- AI-authored: exact existing-edge tightening after M1 and before M2. Never replay M1.
-- PostgreSQL17 GRANT retains omitted ADMIN/SET options on an existing edge.
do $n88_guard_inherit_repair$
declare before_roles jsonb; after_roles jsonb; before_edges jsonb; after_edges jsonb;
begin
  perform pg_advisory_xact_lock(188,195100);
  if current_user <> 'postgres' then raise exception 'n88_membership_executor_mismatch'; end if;
  if (select count(*) from pg_roles where rolname in ('n88_backend','n88_guard')
      and not rolsuper and not rolinherit and not rolcanlogin and not rolcreatedb
      and not rolcreaterole and not rolreplication and not rolbypassrls
      and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null) <> 2
  then raise exception 'n88_membership_role_baseline_mismatch'; end if;
  select jsonb_agg(to_jsonb(r)-'rolpassword' order by rolname) into before_roles
    from pg_roles r where rolname in ('n88_backend','n88_guard');
  select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) order by r.rolname,m.rolname,g.rolname) into before_edges from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor where r.rolname in ('n88_backend','n88_guard') or m.rolname in ('n88_backend','n88_guard');
  if before_edges is distinct from '[{"role":"n88_backend","member":"postgres","grantor":"supabase_admin","admin":true,"inherit":false,"set":false},{"role":"n88_guard","member":"postgres","grantor":"postgres","admin":false,"inherit":true,"set":false},{"role":"n88_guard","member":"postgres","grantor":"supabase_admin","admin":true,"inherit":false,"set":false}]'::jsonb
  then raise exception 'n88_membership_edge_baseline_mismatch'; end if;
  grant n88_guard to postgres with inherit false granted by postgres;
  select jsonb_agg(to_jsonb(r)-'rolpassword' order by rolname) into after_roles
    from pg_roles r where rolname in ('n88_backend','n88_guard');
  select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) order by r.rolname,m.rolname,g.rolname) into after_edges from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor where r.rolname in ('n88_backend','n88_guard') or m.rolname in ('n88_backend','n88_guard');
  if after_roles is distinct from before_roles or after_edges is distinct from '[{"role":"n88_backend","member":"postgres","grantor":"supabase_admin","admin":true,"inherit":false,"set":false},{"role":"n88_guard","member":"postgres","grantor":"postgres","admin":false,"inherit":false,"set":false},{"role":"n88_guard","member":"postgres","grantor":"supabase_admin","admin":true,"inherit":false,"set":false}]'::jsonb
  then raise exception 'n88_membership_postimage_mismatch'; end if;
end
$n88_guard_inherit_repair$;
