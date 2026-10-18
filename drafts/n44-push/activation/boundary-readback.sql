select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
    pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as definer,
    r.rolname as owner,p.proconfig as config,
    (select array_agg(coalesce(gr.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(gr.rolname,'PUBLIC'),a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles gr on gr.oid=a.grantee) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='n44_push_draft' and p.proname like 'boundary_%' order by p.proname;
