# N44 existing-host package — inactive

AI-authored, scoped source preparation for N44. This package is deployable source;
no hosted schema, Auth, configuration, account access, push or cron was activated.
`N44_ENABLED` is absent/false and delivery defaults false. There is no demo fallback.
The browser/app/SW now have staged bindings, with both source feature flags OFF.
Root packages and N88 sources remain unchanged. Current affected proof and exact
remaining activation gates: [N44_ACTUAL_CLIENT_BINDINGS.md](../../docs/automation-evidence/20261018/N44_ACTUAL_CLIENT_BINDINGS.md).

## Concrete composition

- `supabase/functions/n44-notifications/index.ts` -> `existing-host.mjs` ->
  `web-entry.mjs` -> `backend.mjs`: real Deno Web Request entry, verified DB TLS,
  bounded lazy `pg` pool (4 connections, 4 waiting admissions, 1s connect/4s query),
  role readback `n44_backend`, no service_role credential. Direct DB and qualified
  Supavisor usernames are supported. Disabled construction reads only the flag.
- `cloudflare-entry.mjs`: existing-zone `/api/n44/*` ingress, provider TLS/IP
  metadata, rejection of CF-Worker subrequests, same-origin/CSRF checks at Edge,
  canonical signed method/path/origin/allowlisted headers/body digest/time/nonce.
  Bearer, workspace/device and subscription exist only inside the upstream TLS
  body; never upstream URLs/invocation headers. Client owner/session/metadata
  labels never authenticate. There are no browser private keys or cookies.
- `auth-verifier.mjs`: pinned official AuthClient `getClaims` plus fresh `getUser`
  of the SAME bearer, strict verified issuer/audience/role/expiry/iat/nbf/session.
  The exact current user/session rows stay locked through the enclosing durable
  transaction; expiry/current-session is rechecked before commit. Only the
  read-only Auth JWKS/user paths are permitted, with 2s abort/deadline. No JWT
  implementation, getSession, refresh, email, callbacks or token administration.
  Session identity is the verified immutable Auth session UUID; request/context revision additionally binds the exact active policy approval ID. Teacher API
  requests still require an unexpired verified JWT. Background consent uses a
  separate lease capped at 30 days and original Auth session `not_after`; every
  scheduled attempt locks/rechecks that original session, ban, consent and source.
  `session-policy.mjs` additionally requires an activation-bound exact source/approval identity with fresh readonly policy evidence at that activation.
  Only an explicitly verified profile without refresh-enforced timebox/inactivity/
  single-session restrictions is currently supported; unknown/unsupported profiles
  keep readiness OFF. Normal work has no daily human renewal. Any Auth policy change first disables/drains N44, retires approval and old device bindings, then requalifies a new ID. No background Auth refresh token or bearer is retained.
- `/context/read`, `/context/update`: verified owner-only private record, target
  workspace/device labels, CAS against the last consent revision. Server creates
  the revision/session binding and validates the existing timing/quiet schema.
  Every context update retires prior registrations; A -> B -> A cannot restore
  the old binding. These endpoints establish a new explicit notification consent
  context. The staged app composition applies the real mounted-workspace,
  account, persisted-auth and offline-lease guards before transport or consent.
  `/events/authorize` independently rechecks the current original registration,
  session, source stamp, parent/child eligibility and preferences before clicks.
- `/events/update`: accepts only target kind/source ID and expected projection
  stamp, NEVER a payload/timestamp/owner assertion. Derives current parent/child
  data using `canonical-source.inactive.sql` and `canonical-source.mjs`. Exact
  source/teaching/section/subject/year/term keys, immediate composite FKs and
  revisions protect ownership/deletion/archive/restore. Current N58 calendar
  projection, explicit calendar days, N94 subitem dates, existing due stages,
  lesson lead choices and teacher IANA timezone are retained. Native PG timezone
  conversion does not reinterpret stored calendar dates as browser/server UTC.
  No students, scores, completions, names, grades or source writes are read/made.
- Canonical locking uses one target plus its parent keys. One year key and up to
  6 terms/3 calendars/800 calendar-day rows fence calendar insertion through
  immediate FK locks. No canonical table lock or global owner scan. Per-owner
  private events cap at 100. Unsupported/ambiguous/missing sources fail closed.
  Canonical updates need not cooperate: changed lineage suppresses a saved
  event until a new explicit source update; source restoration does not rearm
  an old delivery receipt. New source discovery remains a later app/Sync call
  to this implemented endpoint, not an unimplemented server port.
- `scheduler-entry.mjs`: real private signed scheduler WebRequest driver;
  a SEPARATE scheduler key and purpose/path-bound signature, replay receipts,
  maximum four 25-row due pages per invocation followed by cleanup. No trigger
  is installed. Due rows use indexed keyset pagination with full tie-breakers;
  no public owner enumeration or client-supplied sender exists.
- Scheduler freshly checks Auth session/ban, consent, context/device/session,
  source revision and expiry inside the owner-clock transaction. The concrete
  preparation hook holds those source/Auth locks while the existing delivery
  core issues a permit AFTER durable `sending` commit. Existing encryption,
  provider path allowlist, DNS public-address/pinning, TLS identity, minimal
  payload, quiet suppression, retry budgets and uncertain-result semantics
  remain. Timeout/crash after send becomes durable uncertain, never a blind retry.
  The SQL helper owns reads; the backend is not a canonical/Auth table reader.
- Private cleanup leases at most 25 owner-clock rows by indexed due time with
  SKIP LOCKED, then uses the existing cleanup core. Expired events and up to 100
  unused expired contexts are removed under the owner key; delivery/registration
  receipt retention remains unchanged. Ingress cleanup removes at most 100
  expired nonces and 100 expired rates. Public nonce capacity 4096 and scheduler
  reserve 128 prevent public saturation from disabling cleanup. Each rate kind
  has at most 2048 keys. Atomic limits persist across instances: peer 60/min,
  owner 30/min, public global 3000/min, private scheduler 30/min. Fail closed at
  capacity rather than evicting active rate/receipt state.

## Runtime compatibility and evidence

Official Supabase documentation supports npm/Node APIs and function-specific
`deno.json`: https://supabase.com/docs/guides/functions/dependencies . Deno's
Node API compatibility table is https://docs.deno.com/runtime/reference/node_apis/ .
Supabase runtime resource ceilings remain applicable:
https://supabase.com/docs/guides/functions/limits .

Existing Node 24.19.0, Deno 2.2.12 and owned native PostgreSQL 17.6 were used;
no host/runtime/account was purchased or installed. The actual Deno journey
ran cached/frozen with external networking denied and only loopback PG permitted.
Cloudflare metadata, signed ES256 Auth/JWKS/user and the push provider were
fabricated. Real app DOM/OS push, live network/provider and hosted readiness
are NOT claimed. The server entry has no browser UI change to inspect.

Deno 2.2.12 lacks `ECDH.convertKey`; an intermediate native invalid-point ECDH
check panicked. Preserved failures are listed in
`tests/n44-existing-host.compatibility-failures.json`. Final point validation
uses pinned `@noble/curves` 1.9.7 / `@noble/hashes` 1.8.0, a maintained library
with documented runtime support and validation API:
https://github.com/paulmillr/noble-curves/tree/1.9.7 . It checks canonical
uncompressed P256 points before sender-native ECDH; no custom curve/JWT parser.
Bad private VAPID scalars are rejected before native initialization. Unchanged
AES-GCM/HMAC/web-push/HTTPS implementation and transitive package integrities
retain the matching portions of the prior 18-case evidence; the changed validator
is separately exercised on both runtimes. The corrected 16-case boundary proof
is reused only for unchanged core/test hashes. See source-checks.json for the
explicit matching/changed hash lists; neither old proof certifies new composition.

Commands already executed in this worktree:

```text
node tests/n44-existing-host-config.mjs
node tests/n44-existing-host.mjs
node tests/n44-existing-host.mjs --deno-executable <existing Deno 2.2.12 executable>
deno check --frozen --config supabase/functions/n44-notifications/deno.json supabase/functions/n44-notifications/index.ts
```

Native harness is copied from the existing qualified ownership/lease helper:
canonical integration lease; unique loopback cluster; marker/PID/birth/executable/
-D/data_directory checks; bounded pg_ctl stop in finally; exact PID absence;
owned lease release; stopped data directories retained and ignored by Git.
Busy publisher attempts did not touch its lease. Increasing the harness's lease
wait from 0 to 20 seconds addressed the observed free/acquire publication race;
no controller/STOP/configuration edits or unknown-process cleanup occurred.

## Exact external activation operations — none performed

1. Obtain the separate named authority for hosted PRIVATE schema/roles/helper
   operations, secret custody, ingress route, Edge deployment and live push/cron.
   First read actual schema identities and confirm the private schema/role names
   are fresh. If already present, stop and compare exact identities; do not apply
   twice. Preserve existing migrations, Auth/RLS/Sync and real data permissions.
2. Verify canonical columns/PK/FKs/revision triggers from core/0012/N58/0033/N94,
   exact Auth `users.id/banned_until` and `sessions.id/user_id/not_after`, approved
   timezone/calendar mappings and no private Data API/GraphQL exposure. Apply
   the FRESH proposal sequence: `schema-proposal.sql`,
   `existing-host.inactive.sql`, `canonical-source.inactive.sql`. This is a
   concrete migration proposal, NOT an applied migration. Provision a privately
   held LOGIN for `n44_backend` using the approved vault/DB operator; do not grant
   role membership to browser/authenticated/anon/service_role. `n44_guard` stays
   NOLOGIN/NOBYPASSRLS and owns only the canonical-source helper. The exact Auth
   status/lock helper uses the existing management owner `postgres`, whose
   already-existing non-superuser BYPASSRLS capability is documented. Verify its
   existing exact column SELECT/UPDATE and Auth schema USAGE rights first. Do not
   create Auth policies, change managed Auth ownership, grant new BYPASSRLS, or
   assume membership in `supabase_auth_admin`. Managed Auth RLS remains enabled,
   not forced, with zero policies. The owned local fixture mirrors this condition.
3. Run `readback.inactive.sql`; compare function definitions/ACL/RLS/constraints/
   FKs/indexes and package source hashes to this candidate. Verify negative
   access and exact helper results using separately authorized synthetic hosted
   fixtures BEFORE any real access. No live verification pair is granted here.
4. Set ONLY server/worker secrets through the existing approved secret store.
   Edge names: `N44_ENABLED=false`, `N44_DELIVERY_ENABLED=false`,
   `N44_SERVICE_REVISION=n44-browser-service-v2`, `N44_SERVICE_SOURCE_SHA`, `N44_SESSION_POLICY_JSON`, `N44_AUTH_URL`,
   `N44_AUTH_API_KEY` (public provider API key), `N44_PUBLIC_ORIGIN`,
   `N44_DATABASE_URL` (n44_backend direct/Supavisor role; verified TLS), optional
   `N44_DATABASE_CA_CERT`, `N44_PROVIDER_ORIGINS_JSON` (only explicitly reviewed
   supported origins), `N44_INGRESS_KEY`, `N44_SCHEDULER_KEY`, `N44_RATE_KEY`,
   `N44_CRYPTO_JSON`. The last JSON is exactly `{activeKeyId,fingerprintKeyId,
   activeVapidKeyId,sealingKeys:[[id,64hex]],endpointHmacKeys:[[id,64hex]],
   bindingHmacKeys:[[id,64hex]],vapidKeys:[[id,{publicKey,privateKey,subject}]]}`.
   Versioned private seal/HMAC keys and the ingress/scheduler/rate roles are
   independently provisioned; VAPID keys/contact are approved provider material.
   The browser receives none of these private values. Keep old read keys only
   for their exact retained subscriptions; retirement must reconcile bindings.
5. Deploy the exact Edge entry/import graph/deno.lock inactive. The contained
   `config.inactive.toml` records the required `verify_jwt=false` stanza (equivalent
   deployment flag `--no-verify-jwt`), because the application independently
   verifies signed ingress AND teacher Auth. It is not merged into project
   configuration by this task. Verify disabled 503 with no external operations,
   exact package/hash/TLS/role/service readback. Config revision alone is not
   proof of an applied backend. The generic frontend publisher performs NONE of
   these schema/function/secret operations.
6. Deploy `cloudflare-entry.mjs` on the EXISTING zone only after route authority:
   set `N44_ENABLED=false`, `N44_PUBLIC_ORIGIN`, `N44_EDGE_URL` ending exactly
   `/functions/v1/n44-notifications`, `N44_INGRESS_KEY`. Later authorize the exact
   `/api/n44/*` route; retain private body/header/SQL/access-log suppression.
   Deploy the separate `scheduler-entry.mjs` with ONLY `N44_ENABLED=false`,
   `N44_SCHEDULER_ENABLED=false`, `N44_EDGE_URL`, `N44_SCHEDULER_KEY`. It has no
   public route and NO cron trigger. The inactive Wrangler file installs neither.
7. Under separate authority, certify the deployed origin/provider/TLS/limits/
   privacy/readbacks and one exact synthetic send disposition. Only then enable
   Edge/ingress and, separately, `N44_DELIVERY_ENABLED` / scheduler flags plus
   a bounded existing-platform cron (e.g. once/minute after explicit approval).
   No new Node/TLS host, Auth/context/scheduler implementation, subscription or
   outside executor is needed. A real provider refusal remains binding.
8. Browser composition is now implemented and locally qualified, inactive. There
   is no future browser/transport/SW implementation port. Actual register ACKs carry
   the original UUID and expiry. The exact encrypted envelope is
   `{v:1,binding:registrationId,expiresAt,event:{id,kind,expiresAt,actionPath}}`.
   The SW persists only the noncredential binding/expiry and bounded dedupe IDs,
   shows generic copy with zero open clients, and opens only the fixed public app
   root when a click needs boot. A current authenticated page validates source and
   original registration before private router navigation. Logout/context/permission/
   subscription changes retire bindings; close alone preserves background consent.
   Activation still requires the existing approved PUBLIC VAPID key, exact service
   revision/protocol/readback, supported fresh actual Auth policy profile, both
   source flags, and separately authorized hosted/device proof. No private service,
   HMAC, VAPID, database or Auth refresh/bearer material enters SW/cache/diagnostics.
   N78 admin/campaign activation remains separate.
