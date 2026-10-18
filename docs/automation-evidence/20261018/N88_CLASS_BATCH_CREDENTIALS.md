# N88 class credentials — inactive implementation

AI-authored. Task `continuous-n88-class-batch-credentials-20261018`, run
`a4bcc5fd-5238-4805-8311-eb8d64bb091c`; base/origin-main observed locally
`8ff59100ead8802dec7ebb7f7d4f4d41c2c89f8c`.
Authority: activated card and canonical N88 PO18October12:47 row. This module
implements that row's new universal numeric access contract. Historical four-digit
private-entry source and evidence remain unchanged. No hosted apply, service/Auth
change, route activation, real identity, account, email or student-data operation.
No Product closure, Production verification or integrated-UI usability claim.

## Executable composition into the existing service

The new exports are unimported by the application and default-OFF runtime. They do
not start another service or read environment/configuration. Integration must keep
the existing activation preflight, authenticated signed ingress, deadline, request
envelopes, TLS, no-log transport and independent publisher. Only an explicitly
enabled branch of the existing dispatcher may call them. Never route both the old
four-digit/private-entry issuer and the universal issuer as alternative login paths.
The old issuer is preserved history, not the new module's issuance helper.

```js
import { withCredentialRepository, createClassCredentialOperations,
  createPgClassResolver } from '../../../drafts/n88-student-portal/class-credentials.mjs';
import { createNumericCredentialOperations }
  from '../../../drafts/n88-student-portal/numeric-credentials.mjs';

// baseRepository = existing createPostgresRepository with current canonical adapter.
// adapter = existing web-entry authenticated-envelope ingress/teacher verifier.
// All inputs below are trusted server dependencies, never request-body options.
const repository = withCredentialRepository(baseRepository);
const numeric = createNumericCredentialOperations({
  keys: serverVerifierKeys, activeKeyVersion: 'v1', reservationKey: stableReservationKey
});
const classes = createClassCredentialOperations({
  repository, origin, verifyTeacher: adapter.verifyTeacher,
  verifyIngress: adapter.verifyIngress,
  resolveClass: createPgClassResolver({ teachingId: classRouteTeachingId }),
  issueMember: numeric.issueMember, rotateMember: numeric.rotateMember,
  revokeMember: numeric.revokeMember
});
const classAPI = classes.forRequest(authenticatedEnvelopeRequest);
// GET: classAPI.listClass(teachingId)
// POST: classAPI.issueMissingClassCodes(teachingId, {requestId, expectedRosterRevision})
// POST: classAPI.rotate/revoke({studentId,enrollmentId,revision,credentialVersion,requestId})
const studentHandler = numeric.createStudentHandler({
  repository, origin, verifyIngress: adapter.verifyIngress,
  project: currentExplicitlyPublishedProjection
});
// Existing dispatcher: studentHandler(request) for these exact routes ONLY:
// POST /api/n88/student/claim   GET /api/n88/student/read   POST /api/n88/student/end
```

These are composition expressions, not a second executable HTTP server. Tests
instantiate these exact factories with fabricated dependencies. Bind class route
context separately for selective actions because their payload deliberately has no
owner or teaching ID. `createPgClassResolver` uses parameterized queries after
`synchronizeOwner` has acquired existing canonical source locks. It requires owned,
non-deleted active teaching/term/section/year; roster identity comes from current
canonical memberships. Duplicate current enrollment is a denial. It requests no
new canonical UPDATE privilege and relies on the existing lock helper rather than
issuing backend-role `FOR SHARE`. The existing teacher verifier supplies exact
server Auth user/session and registers its expiry/session recheck before COMMIT;
no caller-supplied current/owner/session or loose Auth fallback exists here.

Both entry factories verify trusted ingress in the same transaction, reject
cross-site requests, and require POST + exact origin/JSON/CSRF headers for writes.
The existing adapter must preserve its signature/replay checks and current request
envelope; do not consume the same ingress nonce again outside the selected handler.
The existing Web/Cloudflare response allowlists must allow the new fixed cookie
path during integration. No credentials belong in request URLs, access logs,
analytics, cache, localStorage, SW or query strings.

## Durable batches and explicit recovery

`listClass` returns rosterRevision plus current owned member identities, labels,
versions and active-code flags, never an old secret. RosterRevision hashes current
teaching/term revision and ordered enrollment identities/revisions/lineage stamps.
Batch creation requires exact roster CAS. Helpers are shared, transaction-local
single-member functions, not calls to the old HTTP issuer. They must never perform
independent commits, sends, logs or external side effects.

A new batch issues only to current active owned students with no credential
history. Existing active credentials are skipped, stable across a verified second
term by owner + durable student identity. Previously revoked credentials are
skipped with `revoked_rotate_required`; bulk issuance cannot undo a deliberate
revocation. Selective rotation is the explicit recovery operation and requires
current enrollment/revision plus expected latest credential version. Revocation
also invalidates all numeric sessions for that identity and never releases any
reservation. Source inactivity/deletion or owner/context inactivity blocks access.
Read binds credential/version, current class/enrollment/revision/lineage to the
same session; term changes require a fresh claim, not reuse of the old session.

Each member operation has a transaction-local rollback checkpoint. A safe local
member failure becomes `failed`, while successful siblings can commit. Final
constraint/deadline/Auth/COMMIT failure returns 503 with `outcome: uncertain` and
no fabricated member counts or secrets. No internal automatic transaction retry.
The original minimal receipt (binding + results, no secret) commits with credentials.
Request IDs are owner-scoped, 16–100 ASCII letters/digits/underscore/hyphen; use a
fresh cryptographic request ID for a deliberate new action and retain it until
the outcome is known. A different operation/body under the same ID returns 409.

Only the first acknowledged call returns `secrets` for created members. Retry of
that receipt returns `uncertain` for its created rows, zero new-created count,
`deliberate_rotate_required`, and no code. It never reruns even failed receipt
rows: retrying those is a separately deliberate action with a new request ID.
This deliberately treats a lost response as lost one-time delivery. It does not
guess that the teacher received a secret, regenerate it, recover plaintext or
silently rotate. A stale/deleted scope can deny even a receipt replay; it cannot
restore removed members. A revoked operation is a skipped row with reason
`revoked`, not an invented newly-created credential.

The integrating class sheet must show created/skipped/failed/uncertain honestly,
offer selective deliberate recovery, and clear its transient code array on close,
owner switch and stale result. Copy/print is allowed only inside that owned sheet.
The reusable module has no browser storage, UI or logging. This card does not
claim those future integrated DOM/handler checks have run.

## Numeric verifier and bounded universal claim

Exactly 12 ASCII digits, `/^1[0-9]{11}$/`; `randomInt(0,100000000000)` supplies
the cryptographic remaining eleven digits. No user-selected number, locale digit
coercion, numeric truncation or RK1/link/PIN wrapper. The explicit paste rule strips
only leading/trailing ASCII SPACE from a bounded string. Tabs, newline, interior
spaces, localized digits, numeric values, exponents and other lengths are denied.

Server-only versioned HMAC verifier binds owner/student/version/code. A separate
stable server-only reservation HMAC key makes one global uniqueness domain across
all issuers and all verifier-key versions. Every issuer instance MUST share that
reservation key and these same tables/transaction lock; it is not a per-teacher
key. Retain retired reservations forever. Keep old verifier keys for active old
credentials; missing keys deny, never select another owner. Key migration must
preserve the reservation domain and has no automatic path here. Each secret key
is an explicitly injected >=32-byte Buffer, copied at construction; none is read,
generated, stored or provisioned by these modules.

At most 128 random candidate attempts per issuance; no sequential scan/fallback.
Collision exhaustion leaves the existing credential intact. Atomic PG uniqueness
also protects reservations and the single-active owner/student invariant.
No plaintext can be recovered from persisted verifier/session/receipt state.

Claim debits durable trusted-client and global budgets before format validation
or credential matching: 6/client and 100/global per 15 minutes, max 10,000 rate
keys. These limits persist across handler instances. They apply to successful and
failed guesses; all denial paths have 401 `{error:'unavailable'}` and the same
cleared cookie shape, including invalid format, absent code, retired code, missing
membership, rate exhaustion and caught repository failure. This is uniform response
shape/status, not a constant-latency certification. Source keys come exclusively
from the existing trusted signed ingress, never body/forwarded-client assertions.
The bounded repository snapshot is loaded under its existing lock; no membership
synchronization or owner/credential match is performed for a rate-blocked guess.

Successful claim chooses the original issuer/student only. After selection it
synchronizes just that owner and requires exactly one current canonical membership.
Opaque 256-bit session tokens are returned only after durable commit. Server state
retains only token hash; sessions last at most eight hours. Reclaim with an existing
cookie invalidates that session. End clears it. Cookie is `__Secure-n88-student`,
`Path=/api/n88/student; HttpOnly; Secure; SameSite=Strict`. Responses reuse existing
`PRIVATE_HEADERS`: no-store/private, no-referrer, noindex, nosniff, Vary Cookie.
The project callback must reuse the current explicit teacher-publication projection
and owner/member filters; no grades/status/scoring are inferred by this module.

## Exact repository and SQL extension

`withCredentialRepository` wraps the EXISTING restricted PG repository; it does
not nest transactions or create a pool. Its queries use the same fenced capability,
private global advisory lock, deadlines, canonical source locks, Auth commit guards,
durable synchronous COMMIT/ACK and broken-client cleanup already implemented there.
The wrapper retains a bounded extension outside the old strict snapshot codec:

| State | Inactive table | Permanent boundary |
| --- | --- | --- |
| numericCredentials | numeric_credentials | Immutable owner/student/version/key/verifier/reservation; revocation only; no delete |
| numericSessions | numeric_sessions | Credential + owner/student/version FK, token hash; bounded expiry/revocation |
| numericRates | numeric_rates | Trusted-client keyed/global counters and window end |
| classReceipts | class_credential_receipts | Owner/request uniqueness, immutable binding and minimal result rows |

Every table has row_key and constrained JSONB payload; generated columns enforce
identity/version/global reservation/FKs. Payload keys are whitelisted to reject
plaintext credential fields. `numeric-credentials.inactive.sql` precedes
`class-credentials.inactive.sql`, after the existing private context/role setup.
New tables enable RLS, expose only the existing restricted backend role, and grant
no browser-role access, canonical writes or managed Auth rights. Receipt and
credential triggers/grants preserve immutability and retired reservations.

Default caps: 10,000 rows per extension table and 4 MiB combined payload. SQL
bounds row and cumulative transfer; flush checks aggregate bytes and affected-row
ACKs. Receipts/reservations cannot be TTL-evicted; capacity exhaustion fails closed.
Session/rate cleanup is bounded and transaction-local. No lock persists for user
review. These modest bounded snapshots intentionally retain current repository
architecture; no public-scale capacity claim. New global/login-specific SQL is
only a proposal. The integration card must discover CLI tooling, create/apply
fresh LOCAL staged migrations and update the exact activation/readback identity;
this worker neither edits the shared activation migration nor applies anything
hosted. Startup JS/SW graph is unchanged.

## Affected verification

`node --test tests/n88-class-credentials*.mjs`: **10/10 PASS**. Includes both exact
required check names, transaction-stub concurrent distinct/same request behavior,
partial rollback, lost batch/rotate/claim ACK, stale roster/member/version, selective
revoke/rotate, current Auth commit failure, trusted ingress/CSRF, source lifecycle,
duplicate enrollment, second-term stable identity, owner isolation, global/client
budgets, key-version reservation stability and no plaintext persistence.

The additional affected SQL test uses a fresh **in-process PGlite** instance and
real proposal SQL plus wrapper/issuer/batch/student handlers. It proves durable
receipt replay after simulated lost ACK, selective rotation, claim/read/revoke,
retired global reservation constraints, immutable receipts, rejected plaintext
fields and denied unprivileged reads. It closes the database in finally. This is
not a repetition of native PG qualification or proof of hosted Auth/RLS deployment.
No HTTP/browser/server/PG listener was started, so no shared phase lease was needed.

The initial SQL failure is preserved in
`tests/n88-class-credentials.initial-sql-failure.json`: BEFORE trigger inspected a
NEW generated column before computation. The corrected trigger inspects payload
directly; the successful rerun retains the original failure. Existing unchanged
native restricted-role/canonical/Auth/issuer historical evidence remains applicable
to those unchanged components; it does not certify the new numeric UI or live route.

No actual application DOM/browser check, hosted service operation, new migration
activation, integration/push/deployment or Production/PO acceptance was performed.
Those remain the bounded integration/controller responsibilities. The module and
inactive SQL are locally ready to integrate.
