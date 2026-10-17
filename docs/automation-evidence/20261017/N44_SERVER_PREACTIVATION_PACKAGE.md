# N44 inactive server preactivation package

Task: `continuous-n44-server-preactivation-package-20261017`

Run: `dc291eff-721c-486c-8b0b-597fd322431a`

Base and freshly fetched `origin/main`: `7ff299e243883c2ab9768f41f3a838c5775ce64b`.
Candidate: the AI-identified commit containing this document (full SHA returned by
the runner result, avoiding a self-referential commit hash).

Authority: current activated N44 card, PO17October11:56 source-linked current
canonical N44 row; activation `po-20261012-continuous`; D-107/D-108. Read canonical
operating contract, row, decisions, previous inactive-primitives evidence and
actual notification center/events/preferences/core/client at that fetched source.
No history search or accepted UI repeat. Used ticket-router/evidence-manifest
skills. No queue/lifecycle/status changes; N44 remains OPEN.

## Prepared source

`drafts/n44-push/registration.mjs`, `delivery.mjs`, `shared.mjs` are inactive,
dependency-injected server boundaries, without an HTTP/server/SDK implementation.
They reuse existing minimal payload and timing/category contracts. Independently
verified session subject drives owner-scoped repository access; request owner
labels and editable metadata are rejected. Current authoritative context/consent
is rechecked after asynchronous work. Original UUID/session-bound revoke, secret
erasure, global endpoint-claim uniqueness, durable transaction interface,
immutable event identity/expiry, bounded rates/attempts/backoff, terminal quiet/
context/preference suppression, uncertain/crashed-send fencing, 404/410 and
cleanup are concrete executable source. No memory repository is shipped as a
production adapter. Encryption/curve validation and sender are trusted ports;
empty origins and absent sender disable capabilities by default.

`drafts/n44-push/schema-proposal.sql` is a DRAFT outside migration/function/deploy
paths: private unexposed schema, revoked user grants, explicit owner RLS predicates
and owner indexes, typed uniqueness/expiry/attempt constraints, invoker immutable
transition triggers, no PUBLIC execute or security-definer function. It does not
implement or certify actual transactions, hosted RLS or a least-privilege service
role. No existing migration was read/edited/applied.

`drafts/n44-push/README.md` is the concrete preactivation architecture/service
review: independent verifier and repository semantics, original-registration
crash/revoke reconciliation, private endpoints and outbound SSRF/redirect/DNS
gate, audited encryption/VAPID requirement, retention/abuse and numeric draft
resource limits, current preferences/timezone/quiet adapter, honest existing
resource cost, device/OS compatibility and bounded pilot/stop/disposition plan.
Real provider origins and credentials remain unconfigured. N78 authorization,
actual source-of-truth event/preference mapping, DB adapter, service deployment,
app/SW and actual ownership-guard entry/device verification remain explicit gates.

## Actual focused checks — simulated ports only

`node --test tests/n44-server-preactivation.test.mjs`: **16/16 PASS**.

| Required check | Evidence |
| --- | --- |
| `n44_server_registration_verified_owner_consent_revoke` | Five registration cases execute unauthenticated/self-asserted/foreign-owner rejection, strict records/consent, stale/expired/session/workspace/device eligibility, endpoint/key validation, 12 concurrent duplicate registrations, actual fake global endpoint collision, active-device/mutation limits, original-only revoke and tombstone replay. Cleanup/revoke case covers failed commit retry, new UUID preservation and late-result fencing. |
| `n44_delivery_atomic_idempotency_expiry_quiet_retry_and_dead_endpoint` | Nine delivery/cleanup cases execute 30 simultaneous reservations through two boundary instances sharing the atomic fake port: exactly one fake sender call, 29 duplicate results. Cover immutable expiry/action conflict, lesson/due and current resolver mismatch/null/promise, current preferences/quiet/IANA timezone, no catch-up, 60/120-second backoff/three attempts, expiry and monotonic clock rollback, revoked/deleted-event retries, unknown/500/exception uncertainty, failed reservation/completion commits, crash reconciliation, 404/410 secret erasure, bounded cleanup/rates/capacity. Fake resolver eligibility is not a real authenticated app/store proof. |
| `n44_private_inactive_package_no_live_calls_or_app_imports` | Fresh Node process imports/constructs boundaries with throwing network/browser/storage/timer capabilities; git binding check finds no app/SW/functions/scripts imports. Fixed statuses contain no exception/private values; fake protected store contains sealed material instead of raw endpoint. All eight changed files are within the card paths. Scoped syntax 5/5 PASS. No browser/server phase or child service acquired. |
| `n44_preactivation_gate_current_docs_schema_evidence_and_remaining_limits` | Concrete README gate and schema proposal inspected; gate test asserts documented remaining limitations. First consulted public changelog: web reader returned `Unsupported content-type: text/markdown`; public HTTPS retrieval of the same document succeeded. Then read current primary RLS, Edge-auth and API-hardening docs (linked in README). SQL/runtime/RLS and all live gates explicitly NOT_RUN. |

`node --check` on all three draft modules, test and fixture: **5/5 PASS**.
`git diff --cached --check`: **PASS**; staged scope is exactly the eight permitted
files listed in the candidate. Final inspection also added and executed rejection
of changed key material under the same UUID/endpoint (separate protected binding
fingerprint); the final affected run remains 16/16 PASS. No Vite
build, UI/browser re-test or repeated previous primitive suite needed: app,
bootstrap, SW, teacher UI and existing modules are unchanged.

## NOT_RUN and authority limits

**SQL runtime/RLS certification: NOT_RUN.** Installed `docker version` could not
connect to `npipe:////./pipe/dockerDesktopLinuxEngine`:
`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`
No daemon started, installation, container enumeration, other database access,
SQL execution or fabricated PASS. README specifies exact later disposable
two-connection atomicity, constraints, owner/anonymous/RLS/privilege, crash and
cleanup checks. The serialized memory fake proves executed policy/interface
behavior only, not Postgres atomicity/durability or hosted permissions.

Hosted SQL/migration/function/Auth/RLS/service configuration, credentials,
connected project, provider/VAPID creation, real permission or subscription,
network sender/real Push, actual app/SW wiring, real account/student/teacher,
real-device/app-closed/OS receipt, campaign/admin/marketing, Production and PO
acceptance: **NOT_RUN / NOT_ACTIVATED**. No secrets or environment files read.
No new paid service/plan/API or cost assumption. Existing infrastructure usage
still needs measured cost/quota approval at the future gate.

No browser/server/live-mutation/integration lease was needed or acquired, no
owned long-lived process remains, no shared resource/lock/STOP touched. This
worker only makes the exact AI-identified candidate commit. No push/deploy;
original controller/publisher owns authorized source-only integration/provider/
served-source evidence. Its generic frontend path cannot perform the missing
service operations. **LOCAL_READY means inactive source preparation only.**
