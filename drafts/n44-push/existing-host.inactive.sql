-- AI: FRESH PRIVATE PROPOSAL ONLY. Never applied remotely. Apply AFTER schema-proposal.sql.
-- Roles are deliberately unprivileged. Provision LOGIN password externally only after approval.
create role n44_guard nologin nosuperuser nobypassrls;
create role n44_backend nologin nosuperuser nobypassrls;
grant usage on schema n44_push_draft to n44_guard,n44_backend;
create table n44_push_draft.events (
 owner_id uuid not null references auth.users(id) on delete cascade,
 workspace_id text not null,device_id text not null,event_id text not null,
 source_kind text not null check(source_kind in ('lesson','due')),source_id text not null,
 source_stamp text not null check(source_stamp ~ '^[a-f0-9]{64}$'),
 due_at_ms bigint not null,expires_at_ms bigint not null,payload jsonb not null,
 primary key(owner_id,workspace_id,device_id,event_id),
 foreign key(owner_id,workspace_id,device_id) references n44_push_draft.contexts(owner_id,workspace_id,device_id),
 check(expires_at_ms>due_at_ms),check(octet_length(payload::text)<=2048));
create index events_due on n44_push_draft.events(due_at_ms,owner_id,workspace_id,device_id,event_id);
alter table n44_push_draft.owner_clock add column next_cleanup_ms bigint not null default 0;
create index cleanup_due on n44_push_draft.owner_clock(next_cleanup_ms,owner_id);
create table n44_push_draft.ingress_nonces(nonce uuid primary key,scope text not null check(scope in ('teacher','scheduler')),expires_at_ms bigint not null);
create index ingress_expiry on n44_push_draft.ingress_nonces(expires_at_ms);
create index ingress_scope on n44_push_draft.ingress_nonces(scope);
create table n44_push_draft.ingress_rates(key text primary key,kind text not null,bucket bigint not null,count integer not null,expires_at_ms bigint not null);
create index ingress_kind on n44_push_draft.ingress_rates(kind);
create index ingress_rate_expiry on n44_push_draft.ingress_rates(expires_at_ms);
-- Dedicated helper role can only lock exact Auth rows; no tokens, passwords, scans or writes.
grant usage on schema auth to n44_guard;
grant select(id,banned_until) on auth.users to n44_guard;
grant update(id) on auth.users to n44_guard;
grant select(id,user_id,not_after) on auth.sessions to n44_guard;
grant update(id) on auth.sessions to n44_guard;
create function n44_push_draft.lock_current_session(p_user uuid,p_session uuid)
returns table(user_id uuid,session_id uuid) language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform u.id from auth.users u where u.id=p_user and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
 if not found then return; end if;
 return query select s.user_id,s.id from auth.sessions s where s.user_id=p_user and s.id=p_session
 and (s.not_after is null or s.not_after>clock_timestamp()) for share of s;
end $$;
alter function n44_push_draft.lock_current_session(uuid,uuid) owner to n44_guard;
revoke all on function n44_push_draft.lock_current_session(uuid,uuid) from public;
grant execute on function n44_push_draft.lock_current_session(uuid,uuid) to n44_backend;
-- RLS private backend only. No authenticated membership or exposed private schema.
do $$ declare t text; begin
 foreach t in array array['owner_clock','contexts','registrations','endpoint_claims','deliveries','budgets','events','ingress_nonces','ingress_rates'] loop
 execute format('alter table n44_push_draft.%I enable row level security',t);
 execute format('alter table n44_push_draft.%I force row level security',t);
 execute format('revoke all on n44_push_draft.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on n44_push_draft.%I to n44_backend',t);
 execute format('create policy private_backend on n44_push_draft.%I to n44_backend using (true) with check (true)',t);
 end loop;
end $$;
