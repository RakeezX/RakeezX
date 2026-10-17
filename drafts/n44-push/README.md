# N44 server preactivation contract — INACTIVE DRAFT

Prepared source only. Nothing here is imported by the app, Service Worker,
Supabase functions or deployment scripts. No server entry point, SDK, credentials,
provider configuration, network implementation, permission prompt, VAPID key or
crypto implementation exists here. Default sender and provider-origin list are
disabled/empty. **N44 stays OPEN**; accepted in-app UI is unchanged. N78 remains a
separately gated privileged authorizer; this is no campaign executor.

## Architecture and executable boundary

- `registration.mjs`: `createRegistrationBoundary` exposes `register(transport,
  body)` and `revoke(transport, body)`. Return value is only a fixed status. A
  successful register is `registered`; revoke is `revoked`. Future gateway must
  map only those to literal `true` for the prepared
  `src/lib/notification-push-client.js`; no current client is wired. Cleanup must
  retain the original UUID and binding privately, never find/delete by endpoint
  or by the newly selected context.
- `delivery.mjs`: private scheduler `deliver(ownerId, registrationId, payload)`
  with durable transactional policy and disabled-by-default sender;
  `cleanup(ownerId)` reconciles stale sessions, secret erasure and uncertain
  attempts. These functions are trusted server capabilities, never public routes
  accepting a caller's ownerId. No admin/user enumeration is implemented.
- `shared.mjs`: fixed statuses, draft limits, rate and context checks.
- `schema-proposal.sql`: private typed schema proposal and immutable transition
  constraints. **NOT an applied/generated migration or a production adapter.**
- `tests/n44-native-postgres-qualification.mjs`: explicitly invoked, synthetic
  PostgreSQL 17.6 runner using existing native binaries and Node `pg`. Applies
  this SQL only to a new owned disposable loopback cluster; never imported by
  app/deployment code. See [local SQL qualification](../../docs/automation-evidence/20261017/N44_NATIVE_POSTGRES_QUALIFICATION.md).
- `tests/n44-server-preactivation.test.mjs` and
  `tests/fixtures/n44-server-preactivation/fakes.mjs`: executed fake-port cases;
  their serialized memory repository is not SQL atomicity or hosted RLS evidence.

The minimal payload is validated by existing `normalizePushPayload`: stable event
ID/stage, lesson/due, immutable expiry (maximum seven-day horizon), internal action
path only. No title, body, student, grade or endpoint belongs in it. Reuse
`notification-events.js` generation/ownership/parent-child/date/cancellation and
`notificationDestination` semantics in a future authoritative server resolver;
route equality is not authorization. Do not regenerate IDs on retries. Account,
service, announcements and optional marketing need separate channel contracts;
mandatory notices do not authorize OS permission. No duplicate email channel.

## Independent authorization and registration protocol

`verifySession(transport)` is a trusted injected authenticated-server verifier,
not a boolean passed by the client. It must independently verify signature,
issuer, audience, expiry, current session/revocation and authenticated subject,
returning `{ ownerId, sessionId, sessionRevision, expiresAt }` from that proof.
Never decode-and-trust JWTs, `user_metadata`, `verified:true`, body ownerId or
client workspace ownership. No SDK/auth adapter is supplied. The protected
repository must independently map that subject to current workspace/device,
session revision and persisted consent. Recheck those in the commit transaction
after asynchronous authentication/protection. Revisions change on every logout,
login, A→B→A, workspace/device switch and consent change; never reuse a revision.

Register body has exactly `{ registrationId, workspaceId, deviceId,
sessionRevision, consent: { revision, push: true }, subscription: { endpoint,
keys: { p256dh, auth } } }`. UUIDv4 is client-generated for idempotent crash
reconciliation, not authorization. Identical original registration is idempotent;
same-context second UUID and cross-owner endpoint reuse fail closed. A UUID
cannot update ownership, expiry, session or endpoint. Revoke body is exactly
`{ registrationId, workspaceId, deviceId }`; derive owner from fresh auth and
match the original session, UUID and binding. Revoke absent/foreign UUID returns
generic absence without touching another owner's row. Logout must await removal
before destroying original auth; lost auth cannot be replaced by a foreign/new
session to revoke an original. Server context invalidation blocks further sends;
cleanup erases secrets if the browser dies or loses auth. Session-expiry cap is
deliberately conservative: refresh does not silently renew a registration.

Crash reconciliation contract: the future gateway must record the original UUID
and owner/workspace/device/session revision in a private owner-scoped receipt
before registration, retain it across an uncertain response, and retry only that
same UUID with the still-current verified original session. Do not persist raw
endpoints/keys in that receipt or use general exports/localStorage. On boot compare
the receipt to the same document's current owner guard; a changed or lost session
blocks opt-in and relies on authenticated context invalidation plus the server
cleanup sweep, never removal using the new owner. Before deliberate rebind, the
server must complete cleanup of the previous active context. A lost receipt with
an otherwise active binding fails closed until original authenticated cleanup or
session expiry/sweep; do not allocate another UUID to evade it. Browser receipt
storage and reconciliation UI are unimplemented integration gates.

Future HTTP adapter must enforce authenticated POST, same-origin/CSRF protection
for cookie auth, CORS allowlist, JSON-only bounded streaming body (4 KiB), reject
duplicate JSON keys and non-JSON/accessor records, normalize exceptions to fixed
codes, and apply ingress rate limits before expensive work. No token/body in
URLs, responses or logs. Browser opt-in still requires real explicit gesture and
permission; the server cannot prove OS permission from a client claim. Consent
records must come from the separately reviewed device-consent protocol, not a
self-asserted request. No permission operation is executed here.

## Endpoint, encryption, privacy and outbound-network gate

`validateSubscription` requires canonical HTTPS, no userinfo/fragment/custom port,
maximum 2048-character endpoint, exact preapproved origin and bounded canonical
base64url keys (65-byte uncompressed P-256 point and 16-byte auth secret).
No real provider origin is guessed or configured. The synthetic `.test` origin
exists only in fixtures. `protect(subscription)` must validate the actual curve
point with an audited implementation, encrypt the full endpoint/keys with an
authenticated versioned envelope and produce a server-keyed HMAC endpoint
`fingerprint` plus a separate HMAC `bindingFingerprint` of canonical endpoint and
both keys. The latter rejects key changes under an existing UUID even if endpoint
is unchanged. The draft stores only that sealed envelope and fingerprints. No new cryptography
or keys are created. Cross-owner claims must return a generic failure. New
protection keys, rotation/re-encryption and deletion/backup policies require the
privacy/security gate; fingerprint keys and envelope keys stay outside the DB.

A future audited Web Push sender decrypts only a committed permit, revalidates
the approved origin and curve/key shape, uses the correct encryption and VAPID
protocol, sets TTL no greater than remaining immutable expiry, and emits generic
privacy-reviewed lock-screen text. Never fetch an arbitrary supplied URL. Require
reviewed exact origins, canonical endpoint/path policy, DNS resolution and egress
enforcement rejecting loopback, private, link-local, metadata, reserved and
IPv4-mapped/IPv6 destinations at connection time (including DNS rebinding).
Disable redirects entirely; never forward authorization or retry at a redirected
origin. Unknown origin/provider or unavailable audited encryption means disabled,
not a fallback sender. Syntax validation alone is NOT an SSRF proof.

No raw payload, endpoints, keys, userIDs, exceptions, bearer tokens or device
details in diagnostics/exports. Public results are fixed status codes only;
trusted storage/crypto/sender ports necessarily see their minimum private inputs.
Production adapters must disable request/bind/exception-body logging and use
aggregate fixed-code counts only. Do not log SQL constraint DETAIL (it can contain
key values). No analytics/user telemetry is added here. Endpoint secrets are
cleared on revoke, 404/410, context invalidation or expiry; sealed envelopes must
also be covered by the later backup-retention/deletion decision.

## Durable atomic repository contract (not supplied)

`repository.atomic(ownerId, synchronousWork)` must **commit durably before its
promise resolves**, roll back on any callback/commit failure, and never resolve an
uncommitted permit. There is no in-memory fallback. The callback's transaction is
owner-scoped: `time(observedMs)`, `context(workspaceId, deviceId)`,
`get/set/rows/entries/delete(table,key)`, `claimEndpoint(fingerprint, uuid)` and
`releaseEndpoint(fingerprint, uuid)`. Tables are registrations, deliveries and
budgets; contexts come only from trusted current server state. Mapping camelCase
objects to SQL snake_case columns, and payload fields to deliveries columns, is
an explicit future adapter responsibility. Delivery key maps to the four-column
PK `(owner, workspace, device, stable eventID)`, independent of registration UUID.

Use one owner-clock row lock acquired before reading ANY relevant context,
preferences, events, subscriptions, delivery or rate rows. All writers (including
logout, workspace switching, preference edits and event cancellation/deletion)
must follow the same serialization/revision protocol; a resolver on stale cloud
data cannot satisfy this contract. `time` uses authoritative database time and a
persisted maximum, never client time, preventing rollback resurrection. Insert
owner rows safely, recheck auth expiry using effective DB time, lock in consistent
order, use bounded transaction timeouts, map global fingerprint uniqueness races
to generic denial. Never read all owners. Resolve/cleanup bounded batches (at most
100 jobs/owner); implement registered-device and mutation rate limits under lock.
SQL schema alone does not implement any of these transactions.

`recompute(tx, registration, eventId, now, preferences)` is trusted synchronous
code within that same transaction. It must independently rederive the current
event from actual owned teaching/term/year/section/subject/session/item/subitem
rows, valid parent/child deletion dependencies, lifecycle/date/cancellation,
current lesson lead/due stages and IANA timezone; return exactly the minimal
payload or null. Callback promises fail closed. Existing timing choices are
reused: `[5,10,15,20,30,45,60]` minutes and due stages `[3,2,1,0]`; current app
preferences are local-only and are NOT assumed to exist on the server. A real
versioned authoritative preference-sync mapping is still a gate. Unknown/missing
timezone or malformed timing fails closed. Quiet adapter draft uses minute-of-day
half-open `[start,end)`, wrapping overnight; equal bounds mean quiet all day;
explicit `quiet:null` means none. `Intl` handles the configured zone's current DST
offset. Quiet/context/preference/rate suppression persists a terminal receipt
for that stage (zero attempts if never sent); later observations cannot replay it.
Timezone changes must retain the high-water and immutable existing expiry.

On eligible reservation, atomically check event identity, current consent/context,
expiry, device/owner budgets and attempts; commit `sending` with increasing attempt
number **before** handing the private permit to the sender. This is the send
authorization linearization point. A revocation committed earlier blocks it; one
committed later cannot recall an already authorized/in-flight packet. No claim of
distributed exactly-once receipt is made. Do not hold a database transaction over
network I/O. No await is inserted between receiving a committed permit and
invoking the sender. Sender must have a 10-second bounded transport deadline;
deadline, exception, crash, unknown outcome or non-certified HTTP failure is
`uncertain` and suppresses retries until immutable expiry. Recovery changes stale
`sending` (30 seconds) to `uncertain`, never back to pending. Claim/commit failure
never sends; result-commit failure leaves the persisted `sending` fence.

Only `not_accepted_retryable`, certified by the audited adapter as definitive
non-acceptance, may retry. HTTP 500/429 alone or a timeout is NOT that certificate.
Backoff is 60 then 120 seconds, maximum three attempts including the original.
Each retry recomputes eligibility/quiet/preferences/context/event/expiry and
consumes budgets again. If the next attempt cannot precede expiry, suppress.
404/410 erases only that registration's endpoint and records dead. Any other
outcome is uncertain; accepted is terminal. Completion is fenced by key, attempt
and `sending` state; late completions cannot overwrite revocation/reconciliation.
Replacing a device registration never bypasses an existing event key or extends
its expiry. Cleanup never evicts an unexpired delivery identity to admit new work.

## Draft numeric limits and cost decision

These are **draft technical defaults pending the architecture gate**, not new
Product policy or deployed enforcement. Three active devices/owner limits fan-out;
one active registration/context avoids duplicate bindings; six registration
writes/owner/hour bounds churn. Proposed ingress: 30 authenticated requests/owner/
minute and 60 unauthenticated requests/IP/minute, enforced by a later trusted
gateway, not this module. Device budgets: six attempts/hour and 20/day, owner
budget: 40/day including retries; fixed UTC buckets can burst across a boundary
(up to twice the hourly limit), so review a sliding-window adapter if necessary.
100 retained event records/owner fails closed at capacity; limits are conservative
relative to the existing center's 100-item bound. Quiet/stale stages are dropped,
never bulk catch-up. Max three attempts and short backoff favor calm delivery over
noisy reliability claims. 30-second uncertainty horizon exceeds proposed
10-second transport deadline. Per-registration expiry is at most 30 days AND at
most the current authenticated session's expiry, whichever is earlier.

Erase secret material immediately on known invalidation; hard-delete registration
tombstones at original expiry +24h, delivery receipts at immutable event expiry
+24h, expired rate buckets on cleanup. Use an authorized bounded cleanup sweep at
least hourly (proposal only; no scheduler configured). Inactive contexts/owner
clock deletion after all receipts and sessions expire requires a later adapter
cleanup policy; retain the clock while any context is active. Auth-account
deletion cascades owner rows. Event generators must never reuse an expired stable
logical ID with a later expiry, even after tombstone retention; actual schema
tests must enforce that source contract. Backups require a separate bounded
retention decision; this draft cannot erase provider backups.

No new paid notification subscription/service/provider/API is approved. Existing
intended Supabase/server + browser push infrastructure is an **unconfigured target
only**, not a finding that it is available. No new subscription does not imply
zero cost: DB rows/locks, function invocations, egress, logs, cleanup, encryption
and device fan-out consume existing quotas/resources. Before activation, measure
a bounded pilot against current entitlements without reading credentials here;
PO must decide acceptable existing usage/cost and stop thresholds. No automatic
upgrade, paid API, quota reset or new service.

## Primary documentation reviewed 17 October 2026

First consulted [Supabase changelog](https://supabase.com/changelog.md). Web reader
returned `Unsupported content-type: text/markdown`; ordinary read-only HTTPS
retrieval of that same public documentation succeeded (latest 14 October .NET
telemetry, 12 October upcoming TLS cipher removal; no connected project queried).
Then reviewed [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Edge authentication](https://supabase.com/docs/guides/functions/auth) and
[API hardening](https://supabase.com/docs/guides/api/securing-your-api).

Relevant constraints applied: independently verified user auth; never authorize
from editable user metadata; service-role access is server-only and bypasses RLS;
use explicit owner USING/WITH CHECK and indexed owner predicates, unexposed
private schema, no direct client grants. No views/security-definer functions are
needed here. Draft trigger helpers are invoker functions with empty search_path
and no PUBLIC/anon/authenticated execute grant. Current Edge docs describe user
mode with platform JWT verification retained; this draft does not select/install
an SDK or weaken `verify_jwt`. Actual runtime APIs must be reverified at wiring.

## Preactivation gates and bounded pilot plan

1. **Architecture/authorization gate:** approve real authoritative workspace/
   device/session/consent/preference/event model, revocation transaction protocol,
   separate scheduler identity and least-privilege DB role. Prove changed actual
   authenticated UI/store entry with existing ownership guard, negative foreign
   owner and stale revisions. No general admin role/framework; N78 separately.
2. **Local SQL qualification PASS; hosted/runtime adapter NOT_RUN:** on 17 October,
   the actual draft executed on a newly initialized owned PostgreSQL **17.6**
   cluster using existing native binaries, without Docker or installation.
   [Exact results and preserved failures](../../docs/automation-evidence/20261017/N44_NATIVE_POSTGRES_QUALIFICATION.md)
   cover six forced-RLS tables, 24 owner policies, actual constraints/triggers,
   DDL rollback, separate grant-denial and non-owner/non-BYPASSRLS owner A/B CRUD,
   two independent backend connections and observed database lock waits, active
   context/global endpoint races, 20 first reservations producing one committed
   permit, rollback/crash fences, budget upserts/clock maximum, original revoke,
   tombstones and context-switch serialization. Two executed trigger defects
   were repaired: retry→sending now requires the next attempt; attempt three
   cannot transition back to retry. All role grants used to exercise RLS were
   temporary fixture grants rolled back; the draft still denies client access.
   Auth users/roles/`auth.uid()` are **local stubs**, and all identities, sealed
   values and callbacks are fabricated. This proves actual local SQL behavior
   under the explicit test transactions, not hosted Auth/PostgREST, intended
   service-role configuration, a real send or the JS `repository.atomic` port.
   The complete synchronous repository adapter, authoritative event/preference
   resolver, all-writer serialization protocol, retention sweep and real ingress
   limits remain unimplemented and require separate qualification. Historical
   Docker/SQL NOT_RUN evidence remains unchanged; the prior 16 simulated tests
   are reused with exact code/fixture/dependency hashes, not rerun as SQL proof.
3. **Real service gate — NOT_RUN:** separately authorized CLI-generated migration
   (`supabase migration new`, never invent a filename), fresh protected-schema
   and role plan, applied identity readback, actual repository/verifier/resolver,
   provider origin/egress/redirect/DNS policy, audited encryption, server-only
   VAPID custody/rotation and rate/cleanup configuration. Generic frontend
   publisher cannot apply this service work. No hosted operations here.
4. **Privacy/abuse/cost/device gate — NOT_RUN:** approve generic lock-screen copy,
   consent/retention/backup deletion, request-log suppression, concrete quotas and
   kill switch before pilot. Reconcile subscription state after crash with the
   original private UUID. Lost auth erases browser binding and server sweep
   revokes stale context; no automatic opt-in or reactivation.
5. **App/SW and real device gate — NOT_RUN:** separately wire prepared client,
   actual owner guard and lifecycle callbacks, gateway's original-registration
   cleanup, service worker push/click, current event authorization on click,
   approved offline shell paths. Verify installed iOS/iPadOS Safari (supported
   Home Screen setup), Android Chrome and desktop Chrome/Edge support matrix,
   user gesture/denial/revoke, background/app-closed receipt, click, expiry,
   logout/A→B→A/workspace/device switch, delayed/reload state, timezone/DST,
   offline/reconnect. Browser/OS delivery is best effort; no exact timing promise.
6. **Separately approved pilot:** at most two consenting synthetic operator
   accounts and three owned supported devices for 48 hours, operational lesson/
   due only, maximum ten logical events/account/day within stricter module limits.
   No students/real teachers, marketing or broadcast. Stop on any foreign/stale
   target, secret diagnostic, duplicate noisy send, incorrect quiet/expiry, budget
   overrun or unbounded retry. Disable sender first, invalidate contexts, revoke
   original registrations, erase secrets, retain bounded receipts for disposition.
   Read back actual schema/service identities and device receipts against the
   exact candidate. Only after those gates may a new bounded Product rollout be
   considered. This plan grants none of those permissions now.

Prepared source, historical simulated policy evidence and local native SQL
qualification are distinct from hosted service/current Auth adapter, real TLS/
network, app/offline/Service Worker, browser/OS, real-send, Production and PO
acceptance. Those latter gates remain **NOT_RUN**. Sole original publisher owns source-only integration and
served-source verification; this worker does not push/deploy or close N44.
