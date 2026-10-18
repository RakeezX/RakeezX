-- AI: INACTIVE prerequisite, not a migration and NEVER applied to hosted data.
-- Exact core FKs: all seven tables owner_id -> auth.users(id), NOT DEFERRABLE.
-- The owner key FOR UPDATE conflicts with FK KEY SHARE on inserts/key transfers,
-- even from noncooperating Sync writers. Existing/tombstoned rows are then locked
-- to cover UPDATE/restore/delete without any new FK check. No table SHARE lock.
-- Bound per-table lock count; any cap/timeout/deadlock aborts the whole transaction.
-- Managed Auth has RLS enabled/zero policies. A separate private exact-key helper
-- retains the EXISTING postgres management owner; guard/backend never gain bypass.
create function n88_private.lock_owner_key(p_owner uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_owner is null then raise exception 'n88_canonical_unavailable'; end if;
  perform id from auth.users where id=p_owner for update;
  if not found then raise exception 'n88_canonical_unavailable'; end if;
end;
$$;
revoke all on function n88_private.lock_owner_key(uuid) from public;
-- Backend gets EXECUTE + source SELECT only, no canonical/Auth UPDATE privileges.
create function n88_private.lock_canonical_sources(p_owner uuid,p_max integer) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare t text; n integer;
begin
  if p_owner is null or p_max is null or p_max<1 or p_max>10000 then raise exception 'n88_canonical_unavailable'; end if;
  perform set_config('n88.canonical_owner',p_owner::text,true);
  perform n88_private.lock_owner_key(p_owner);
  foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop
    execute format('select count(*) from (select id from rakeezx.%I where owner_id=$1 order by id limit $2 for update) locked',t)
      into n using p_owner,p_max+1;
    if n>p_max then raise exception 'n88_canonical_unavailable'; end if;
  end loop;
end;
$$;
revoke all on function n88_private.lock_canonical_sources(uuid,integer) from public;
-- No frontend grant. Exact backend-role grant/owner set remains an activation diff.
