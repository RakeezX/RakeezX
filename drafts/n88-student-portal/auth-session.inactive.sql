-- AI: PROPOSAL ONLY. Never applied to hosted Auth. No tokens or user enumeration.
-- Proposed controlled NOLOGIN helper owner: n88_guard. Backend: n88_backend.
-- n88_guard needs schema USAGE, SELECT(id,user_id,not_after) on auth.sessions,
-- UPDATE(id) solely for row locking. It must not be granted to a login/frontend.
create function n88_private.lock_current_session(p_user uuid,p_session uuid)
returns table(user_id uuid,session_id uuid)
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform u.id from auth.users u where u.id=p_user for share;
  if not found then return; end if;
  return query select s.user_id,s.id from auth.sessions s
    where s.id=p_session and s.user_id=p_user
    and (s.not_after is null or s.not_after>clock_timestamp()) for share of s;
end;
$$;
revoke all on function n88_private.lock_current_session(uuid,uuid) from public;
-- Separate approval must set owner to n88_guard and grant EXECUTE to n88_backend.
-- No refresh_tokens lookup, session writes, Auth setting or RLS change.
