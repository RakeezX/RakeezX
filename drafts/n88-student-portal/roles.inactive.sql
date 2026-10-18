-- AI: EXACT PROPOSAL ONLY; requires separate hosted schema/Auth permission.
-- Fresh private tables only; do not apply/reapply by guessing migration history.
create role n88_guard nologin noinherit;
-- Provision n88_backend LOGIN/password by the approved secret custodian, never SQL evidence.
-- No new subscription/account. n88_backend must be a narrowly scoped DB role,
-- not service_role/postgres. This script assumes that approved role exists.
grant usage on schema rakeezx,n88_private to n88_guard;
-- Existing postgres owner alone operates Auth exact-key locks under managed RLS.
-- Never create Auth policies, change its ownership or grant guard/backend bypass.
grant execute on function n88_private.lock_owner_key(uuid) to n88_guard;
grant select(owner_id,id),update(id) on rakeezx.years,rakeezx.terms,rakeezx.sections,
  rakeezx.students,rakeezx.enrollments,rakeezx.teachings,rakeezx.items to n88_guard;
grant select,insert,delete on n88_private.ingress_receipts to n88_guard;
create policy n88_guard_receipts on n88_private.ingress_receipts to n88_guard using(true) with check(true);
grant usage on schema n88_private,rakeezx to n88_backend;
grant select(owner_id,id,status,deleted_at,revision) on rakeezx.years to n88_backend;
grant select(owner_id,id,year_id,status,deleted_at,revision) on rakeezx.terms,rakeezx.sections to n88_backend;
grant select(owner_id,id,name,status,deleted_at,revision) on rakeezx.students to n88_backend;
grant select(owner_id,id,section_id,student_id,revision,status,end_date,deleted_at) on rakeezx.enrollments to n88_backend;
grant select(owner_id,id,section_id,term_id,deleted_at,revision) on rakeezx.teachings to n88_backend;
grant select(owner_id,id,teaching_id,name,auto,deleted_at,revision) on rakeezx.items to n88_backend;
grant select,insert,update,delete on n88_private.contexts,n88_private.memberships,n88_private.credentials,
  n88_private.sessions,n88_private.publications,n88_private.guess_budgets to n88_backend;
do $$ declare t text;begin
  foreach t in array array['contexts','memberships','credentials','sessions','publications','guess_budgets'] loop
    execute format('create policy n88_backend_only on n88_private.%I to n88_backend using(true) with check(true)',t);
  end loop;
end $$;
-- Canonical RLS remains enabled. These ADDED policies name only private roles;
-- original authenticated owner policies and all Sync guards remain unchanged.
-- GUC is transaction-local and set by the fixed owner-lock helper. The backend
-- is a trusted server role; it must never be issued to a browser or API caller.
do $$ declare t text;begin
  foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop
    execute format('create policy n88_canonical_read on rakeezx.%I for select to n88_backend using(owner_id::text=current_setting(''n88.canonical_owner'',true))',t);
    execute format('create policy n88_guard_lock on rakeezx.%I to n88_guard using(owner_id::text=current_setting(''n88.canonical_owner'',true)) with check(false)',t);
  end loop;
end $$;
-- Helper ownership is NOT a login membership or a grant to browser roles.
-- Grant while existing postgres still owns the functions. Ownership transfer
-- rewrites the grantor for guard-owned helpers without requiring superuser.
grant execute on function n88_private.lock_canonical_sources(uuid,integer),
  n88_private.lock_current_session(uuid,uuid),n88_private.consume_ingress(uuid,bigint) to n88_backend;
grant create on schema n88_private to n88_guard;
-- PG17 CREATEROLE grants creator ADMIN but does not imply SET. Temporarily allow
-- ONLY existing postgres to transfer these two newly created private helpers.
grant n88_guard to postgres with set true;
alter function n88_private.lock_canonical_sources(uuid,integer) owner to n88_guard;
-- lock_owner_key and lock_current_session retain EXISTING postgres ownership.
alter function n88_private.consume_ingress(uuid,bigint) owner to n88_guard;
grant n88_guard to postgres with set false;
revoke create on schema n88_private from n88_guard;
-- Keep schema unexposed, no anon/authenticated grants. Backend has NO canonical
-- write/Auth/session-table access and no membership in n88_guard. Revoke inherited
-- privileges if existing role readback finds any; never silently broaden a role.
