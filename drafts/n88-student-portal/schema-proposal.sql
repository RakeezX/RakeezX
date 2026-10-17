-- AI: DESIGN ONLY, INACTIVE, outside migrations/functions. Never apply on this card.
-- NOT an adapter to the current canonical enrollment model. No hosted grants/RPCs.
-- Separately authorized migration must be CLI-generated and verified on disposable PG.
create schema n88_private;
revoke all on schema n88_private from public;
create table n88_private.contexts (
  namespace text primary key check(namespace ~ '^[A-Za-z0-9_-]{24,64}$'),
  owner_id uuid not null unique, active boolean not null default false,
  unique(namespace, owner_id)
);
create table n88_private.memberships (
  owner_id uuid not null, class_id text not null, student_id text not null,
  enrollment_id text not null, revision bigint not null check(revision >= 1),
  active boolean not null default false,
  primary key(owner_id,class_id,student_id,enrollment_id)
);
create table n88_private.credentials (
  id uuid primary key, namespace text not null, owner_id uuid not null,
  class_id text not null, student_id text not null, enrollment_id text not null,
  membership_revision bigint not null, version bigint not null check(version >= 1),
  verifier text not null check(verifier ~ '^[a-f0-9]{64}$'), revoked_at timestamptz,
  foreign key(namespace,owner_id) references n88_private.contexts(namespace,owner_id),
  foreign key(owner_id,class_id,student_id,enrollment_id)
    references n88_private.memberships(owner_id,class_id,student_id,enrollment_id),
  unique(namespace,verifier), -- tombstones prevent reactivation of old codes
  unique(id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision)
);
create unique index n88_current_credential on n88_private.credentials
  (owner_id,class_id,student_id,enrollment_id) where revoked_at is null;
create table n88_private.sessions (
  id uuid primary key, credential_id uuid not null, namespace text not null,
  owner_id uuid not null, class_id text not null, student_id text not null,
  enrollment_id text not null, version bigint not null, membership_revision bigint not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null, revoked_at timestamptz,
  foreign key(credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision)
    references n88_private.credentials(id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision)
); -- many sessions per credential; NO credential expiry/consumption
create index n88_session_credential on n88_private.sessions(credential_id);
create index n88_session_retention on n88_private.sessions(expires_at);
create table n88_private.publications (
  id uuid primary key, owner_id uuid not null, class_id text not null,
  student_id text not null, enrollment_id text not null,
  source_teaching_id text not null, source_item_id text not null,
  title text not null check(length(title) between 1 and 160),
  instruction text not null default '' check(length(instruction)<=500),
  deadline date, status text not null check(status in ('todo','working','done')),
  published boolean not null default false,
  foreign key(owner_id,class_id,student_id,enrollment_id)
    references n88_private.memberships(owner_id,class_id,student_id,enrollment_id)
); -- no grades/private notes/attendance in student projection
create index n88_published_student on n88_private.publications
  (owner_id,class_id,student_id,enrollment_id) where published;
create table n88_private.guess_budgets (
  key text primary key, count integer not null check(count >= 0), until_at timestamptz not null
); -- keys: server-HMAC source/context; global; context/global failure counters
alter table n88_private.contexts enable row level security;
alter table n88_private.memberships enable row level security;
alter table n88_private.credentials enable row level security;
alter table n88_private.sessions enable row level security;
alter table n88_private.publications enable row level security;
alter table n88_private.guess_budgets enable row level security;
revoke all on all tables in schema n88_private from public;
-- No policies/grants to frontend anon/authenticated; private schema unexposed.
-- Future backend repository implementation MUST:
-- 1. Verify current teacher Auth/session independently; ignore supplied owner/metadata.
-- 2. Lock a bounded shared budget keyspace in sorted order, BEFORE any context/code
--    lookup. Atomic all-attempt reservations: source 6/context 30/global 100 per 15m;
--    failed-attempt counters context 60/global 500 per 24h checked BEFORE lookup.
--    Unknown namespace/code uses identical status/body; failures must COMMIT counters.
--    Never roll counters back just because credentials failed. Max 10000 keys;
--    expiry cleanup + fail-closed admission; no reset on restart or instance switch.
-- 3. Lock context -> canonical membership -> credentials -> sessions in consistent
--    order for issue/rotate/revoke/login/read/publication/lifecycle. Read current
--    enrollment/student/class status and revision; this illustrative membership
--    table is NOT permission to use stale snapshot copies in a hosted adapter.
-- 4. Generate randomInt server-side; HMAC-SHA256(JSON array n88-v2/code/namespace/code)
--    using injected secret in server secret storage, NEVER plain SHA of six digits.
--    Under locks retry uniqueness collisions without losing previous credential.
--    Rotate/revoke old credential + ALL sessions atomically; rollback exceptions.
-- 5. Login creates a NEW 256-bit session, bound to namespace/all four membership keys,
--    credential ID/version/revision, expires after 8h; code remains reusable.
-- 6. Every read rechecks current context/membership/credential/version/session and
--    published=true within same transaction. Return explicit title/instruction/
--    deadline/status + progress derived from same snapshot. No SELECT * response.
-- 7. Publish validates owner/member + canonical source item. No browser-selected
--    owner, no definer bypass or public service-role endpoint. Commit updates atomically.
-- 8. Durable rate-limit/proxy, transaction races, roles/RLS and canonical lifecycle
--    tests are REQUIRED before hosting. This draft deliberately grants no service role.
