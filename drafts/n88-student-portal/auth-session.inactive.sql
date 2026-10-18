-- AI: PROPOSAL ONLY. Never applied to hosted Auth. No tokens or user enumeration.
-- Existing supported management owner postgres (BYPASSRLS, NOT superuser) only.
-- Managed Auth tables retain their owner/RLS/zero policies. No new bypass grant.
-- Backend gets only exact-session helper EXECUTE, no Auth schema/table privileges.
create function n88_private.lock_current_session(p_user uuid,p_session uuid)
returns table(user_id uuid,session_id uuid)
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform u.id from auth.users u where u.id=p_user
    and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then return; end if;
  return query select s.user_id,s.id from auth.sessions s
    where s.id=p_session and s.user_id=p_user
    and (s.not_after is null or s.not_after>clock_timestamp()) for share of s;
end;
$$;
revoke all on function n88_private.lock_current_session(uuid,uuid) from public;
-- Migration must retain owner postgres; private EXECUTE only to n88_backend.
-- No refresh_tokens lookup, session writes, Auth setting or RLS change.
