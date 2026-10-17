-- AI: INACTIVE prerequisite, not a migration and NEVER applied to hosted data.
-- After separately approved private schema/repository DDL. Function owner must be
-- a narrowly controlled NOLOGIN role able to lock these exact canonical tables.
-- Backend needs SELECT on the queried source columns, not canonical write grants.
create function n88_private.lock_canonical_sources() returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  lock table rakeezx.years,rakeezx.terms,rakeezx.sections,rakeezx.students,
    rakeezx.enrollments,rakeezx.teachings,rakeezx.items in share mode;
end;
$$;
revoke all on function n88_private.lock_canonical_sources() from public;
-- No frontend grant. Exact backend-role grant/owner set remains an activation diff.
