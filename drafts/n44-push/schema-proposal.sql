-- DRAFT ONLY. Not a migration, not applied; keep outside supabase/ paths.
-- Requires separately approved actual schema mapping/roles and runtime RLS tests.
-- No exposed schema, user grants, service-role role, extension or hosted operation.
begin;
create schema n44_push_draft;
revoke all on schema n44_push_draft from public, anon, authenticated;
alter default privileges in schema n44_push_draft revoke execute on functions from public;

-- Lock this row FOR UPDATE before all owner-scoped context/registration/job/budget
-- operations, including logout and preference updates. Use one short transaction,
-- bounded statement/lock timeout, and retry serialization failures before sending.
create table n44_push_draft.owner_clock (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  high_water_ms bigint not null check (high_water_ms >= 0)
);
create table n44_push_draft.contexts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null check (length(workspace_id) between 1 and 180),
  device_id text not null check (length(device_id) between 1 and 180),
  active boolean not null default false,
  session_id text not null check (length(session_id) between 1 and 180),
  session_revision text not null check (length(session_revision) between 1 and 180),
  session_expires_at_ms bigint not null,
  consent_revision text not null check (length(consent_revision) between 1 and 180),
  push_consent boolean not null default false,
  -- Authoritative, versioned server preference mapping still missing. No client
  -- permission to assert these context or session bindings, even for its own row.
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 2048),
  primary key (owner_id, workspace_id, device_id)
);
create table n44_push_draft.registrations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  registration_id uuid not null,
  workspace_id text not null,
  device_id text not null,
  session_id text not null,
  session_revision text not null,
  consent_revision text not null,
  state text not null check (state in ('active', 'revoked', 'dead')),
  expires_at_ms bigint not null check (expires_at_ms >= 0),
  -- Authenticated encryption envelope incl key version; encryption key external
  -- to this DB. Endpoint + p256dh + auth never stored as plaintext or query logs.
  sealed text check (octet_length(sealed) between 1 and 8192),
  fingerprint text check (fingerprint ~ '^[a-f0-9]{64}$'),
  binding_fingerprint text check (binding_fingerprint ~ '^[a-f0-9]{64}$'),
  primary key (owner_id, registration_id),
  foreign key (owner_id, workspace_id, device_id)
    references n44_push_draft.contexts(owner_id, workspace_id, device_id),
  check ((state = 'active' and sealed is not null and fingerprint is not null and binding_fingerprint is not null)
    or (state <> 'active' and sealed is null and fingerprint is null and binding_fingerprint is null))
);
create unique index one_active_context on n44_push_draft.registrations(owner_id, workspace_id, device_id) where state = 'active';
create index registration_expiry on n44_push_draft.registrations(owner_id, expires_at_ms);
-- Global HMAC uniqueness prevents cross-owner reuse. Releasing a claim must
-- match BOTH owner and original registration; never enumerate foreign claims.
create table n44_push_draft.endpoint_claims (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  owner_id uuid not null,
  registration_id uuid not null,
  unique (owner_id, registration_id),
  foreign key (owner_id, registration_id)
    references n44_push_draft.registrations(owner_id, registration_id) on delete cascade
    deferrable initially deferred
);
create table n44_push_draft.deliveries (
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  device_id text not null,
  event_id text not null check (event_id ~ '^[a-zA-Z0-9_:%.-]{1,240}$'),
  registration_id uuid not null,
  kind text not null check (kind in ('lesson', 'due')),
  action_path text not null check (length(action_path) between 1 and 800),
  expires_at_ms bigint not null check (expires_at_ms >= 0),
  attempts smallint not null check (attempts between 0 and 3),
  state text not null check (state in ('sending', 'retry', 'sent', 'uncertain', 'suppressed', 'dead')),
  started_at_ms bigint not null,
  next_at_ms bigint not null,
  check (attempts > 0 or state = 'suppressed'),
  primary key (owner_id, workspace_id, device_id, event_id),
  -- No cascading registration FK: receipt survives early secret removal.
  check (started_at_ms < expires_at_ms)
);
create index retry_due on n44_push_draft.deliveries(owner_id, next_at_ms) where state = 'retry';
create index delivery_retention on n44_push_draft.deliveries(owner_id, expires_at_ms);
create table n44_push_draft.budgets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  budget_key text not null check (length(budget_key) between 1 and 200),
  bucket bigint not null check (bucket >= 0),
  count integer not null check (count between 1 and 40),
  expires_at_ms bigint not null,
  primary key (owner_id, budget_key)
);

-- Defense in depth: no API grants below. Authenticated ownership does not grant
-- permission to write consent, contexts, keys, budgets or deliveries directly.
do $$
declare t text;
begin
  foreach t in array array['owner_clock','contexts','registrations','endpoint_claims','deliveries','budgets'] loop
    execute format('alter table n44_push_draft.%I enable row level security', t);
    execute format('alter table n44_push_draft.%I force row level security', t);
    execute format('revoke all on table n44_push_draft.%I from public, anon, authenticated', t);
    execute format('create policy owner_select on n44_push_draft.%I for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', t);
    execute format('create policy owner_insert on n44_push_draft.%I for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', t);
    execute format('create policy owner_update on n44_push_draft.%I for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = owner_id) with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', t);
    execute format('create policy owner_delete on n44_push_draft.%I for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', t);
  end loop;
end $$;
-- endpoint_claims' primary key is global; owner predicate needs its own index.
create index endpoint_owner on n44_push_draft.endpoint_claims(owner_id);

create function n44_push_draft.immutable_delivery() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.owner_id,new.workspace_id,new.device_id,new.event_id,new.registration_id,
         new.kind,new.action_path,new.expires_at_ms) is distinct from
     row(old.owner_id,old.workspace_id,old.device_id,old.event_id,old.registration_id,
         old.kind,old.action_path,old.expires_at_ms)
     or new.attempts < old.attempts or new.attempts > old.attempts + 1
     or (new.attempts > old.attempts and not (old.state = 'retry' and new.state = 'sending'))
     or (old.state in ('sent','uncertain','suppressed','dead') and new is distinct from old)
     or (old.state = 'sending' and new.state = 'sending' and new is distinct from old)
     or (old.state = 'retry' and new.state not in ('retry','sending','suppressed')) then
    raise exception using message = 'n44_transition_rejected';
  end if;
  return new;
end $$;
create trigger immutable_delivery before update on n44_push_draft.deliveries
for each row execute function n44_push_draft.immutable_delivery();
create function n44_push_draft.immutable_registration() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.owner_id,new.registration_id,new.workspace_id,new.device_id,new.session_id,
         new.session_revision,new.consent_revision,new.expires_at_ms) is distinct from
     row(old.owner_id,old.registration_id,old.workspace_id,old.device_id,old.session_id,
         old.session_revision,old.consent_revision,old.expires_at_ms)
     or (old.state <> 'active' and new is distinct from old)
     or (new.state = 'active' and row(new.sealed,new.fingerprint,new.binding_fingerprint)
       is distinct from row(old.sealed,old.fingerprint,old.binding_fingerprint)) then
    raise exception using message = 'n44_transition_rejected';
  end if;
  return new;
end $$;
create trigger immutable_registration before update on n44_push_draft.registrations
for each row execute function n44_push_draft.immutable_registration();
revoke all on all functions in schema n44_push_draft from public, anon, authenticated;
commit;
