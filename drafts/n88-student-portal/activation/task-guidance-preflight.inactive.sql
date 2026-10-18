-- AI: local/inert current prerequisites; hosted execution requires separate exact authority.
do $$ begin
 if current_user<>'postgres' or to_regclass('n88_private.task_guidance') is not null or
    to_regclass('n88_private.code_recovery') is null or to_regclass('n88_private.class_visibility') is null or
    not exists(select 1 from pg_roles where rolname='n88_backend' and not rolsuper and not rolbypassrls) or
    has_schema_privilege('authenticated','n88_private','usage') or has_schema_privilege('anon','n88_private','usage') then
   raise exception 'n88_guidance_preflight_unavailable';
 end if;
end $$;
-- Compare full prior-task-guidance-integrated-expected-identities.json before the new amendment.
