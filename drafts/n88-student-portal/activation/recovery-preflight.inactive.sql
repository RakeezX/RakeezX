-- AI: metadata-only fresh fifth amendment prerequisites; no keys or personal rows.
do $$ begin
 if current_user<>'postgres' or to_regclass('n88_private.code_recovery') is not null or
    to_regclass('n88_private.numeric_attempts') is null or
    not exists(select 1 from pg_roles where rolname='n88_backend' and not rolsuper and not rolbypassrls) or
    has_schema_privilege('authenticated','n88_private','usage') or has_schema_privilege('anon','n88_private','usage') then
   raise exception 'n88_recovery_preflight_unavailable';
 end if;
end $$;
-- Compare complete prior-recovery-integrated-expected-identities.json before application.
-- Custody/readback of inactive server key bindings requires separate exact activation authority.
