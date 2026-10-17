# N44 inactive runtime gateway — local result

- Task: `continuous-n44-complete-runtime-gateway-20261018`
- Run: `f74393d7-a86f-43b7-8e90-df28b2d007c0`
- Base/current recorded origin/main at entry: `f2395c4841db30fb29e5908fe30e6154a925116a`
- Scope: inactive Node HTTP registration/revoke composition over the existing
  actual registration/delivery boundaries and PostgreSQL repository; private
  scheduler/cleanup entries; strict ingress and disabled dependency preflight.
- Result: **LOCAL_READY for source-only inactive publication**. This document is
  bound to the candidate commit containing it; it claims no publisher operation,
  hosted activation, real Auth/crypto/send/device proof, Production or N44 closure.

Implementation and exact deployment/port/HTTP contracts:
[RUNTIME.md](../../../drafts/n44-push/RUNTIME.md),
[disabled config](../../../drafts/n44-push/runtime-config.example.json),
[actual config preflight](../../../tests/n44-runtime-gateway.preflight.json).
No shared app, SW, N88, N64, N36, queue/status, Auth/RLS or hosted service path changed.

## Affected verification

Executed `node tests/n44-runtime-gateway.mjs` with Node **v24.19.0** and an owned
new loopback PostgreSQL **17.6** cluster. It reuses the prior owned native process/
driver harness, **not** the previous SQL suite. Schema and the original repository,
registration and delivery boundaries are unchanged. All identities, verifier,
limiter, protector, current-context writer, resolver and sender are synthetic;
HTTP, repository transactions, SQL commit/readback and independent-connection
observations are real. No browser is involved or UI PASS claimed.

Machine evidence: [result](../../../tests/n44-runtime-gateway.result.json),
[HTTP cases](../../../tests/fixtures/n44-runtime-gateway/cases.mjs).
The result records exact relevant source SHA-256 hashes, times, owned directory,
PG PID/birth/executable/port proof and per-case results.

| Required check | Actual result |
| --- | --- |
| `n44_actual_http_registration_and_private_runtime_composition` | PASS: real HTTP → actual registration boundary → actual repository/SQL. Original UUID replay leaves one row; failed COMMIT rolls back. Current serialized consent change denies registration. Private scheduler sees committed `sending` from another SQL connection before fake sender; repeat is suppressed. Reservation commit failure never invokes sender; thrown send becomes terminal uncertain. Cleanup erases sealed material; original revoke succeeds and receipt cannot resurrect. |
| `n44_ingress_auth_body_commit_failure_and_disabled_preflight` | PASS: malformed/oversize/nested duplicate/escaped duplicate JSON, invalid UTF-8, duplicate headers, compressed/wrong content type, missing/foreign origin, wrong paths/methods, forged Auth, peer and verified-owner limits, late Auth/protect deadline failures. No repository acquisition for these negatives; late completions drained. Missing dependencies produce one disabled preflight; >100 private jobs rejected. |
| Resource lifecycle | PASS: HTTP listener closed and exact port rebound; runtime closer called once across repeated close; work after close disabled. Owned PG stopped via ownership-verified `pg_ctl fast/wait`; exact PID absent and port rebound. Browser/server phase lease acquired and released by this run. Stopped disposable PG checkpoints retained outside the candidate under the task-specific artifacts prefix; no unknown process stopped. |
| Syntax and patch hygiene | PASS: `node --check` on runtime, scoped harness and HTTP cases; `git diff --check`. No Vite build or unrelated suite required for server-only unimported source. |

The generic publisher still owns integration/provider/build/served-source evidence.
No push or deploy was performed. Existing unaffected SQL qualification is reused;
it is not represented as Push completion.

## Preserved initial failures and corrections

1. [Fixture role failure](../../../tests/n44-runtime-gateway.failure-fixture-role.json):
   local probe role lacked inherited `authenticated` policy membership. Corrected
   only disposable fixture setup to match the already-qualified RLS harness; no
   policy, guard or production grant changed.
2. [Early HTTP response failure](../../../tests/n44-runtime-gateway.failure-early-response.json):
   `HPE_CLOSED_CONNECTION` after early body denial. Replaced async-iterator early
   exit with bounded event-driven read and prevented a parser-error handler from
   appending a second response after a denial. Same affected HTTP negatives pass.
3. [Fixture deadline failure](../../../tests/n44-runtime-gateway.failure-fixture-deadline.json):
   HTTP success expected after forced commit-discard but got 503 with a 700ms
   test budget. The native fixture verifies each cold connection through owned
   process/PowerShell readback; changed fixture to the documented normal 5000ms
   budget and made injected Auth/protect delays 5200ms. Deadline failures remain
   mandatory and passed; late operations still cannot enter repository work.

Every failed run stopped its owned HTTP/PG resources. No unchanged blocked retry,
real service/tool refusal or exhausted live-proof phase was repeated.

## Activation remains explicitly unavailable

Actual app `currentNotificationContext` uses the mounted account DB/cloud session
and ownership guard; notification timing/categories remain localStorage data.
There is no authoritative server Push consent/session/event writer in these
affected sources. The runtime therefore requires explicit authoritative mapper/
all-writer adoption and fails preflight without them; it does not use a fabricated
server store or local client cache. The existing `writeContexts` hook remains
private and follows the same owner-clock lock.

The concrete remaining operations are enumerated in RUNTIME.md: independent
current-session Auth port; canonical serialized session/context/consent/preference/
event writers; separately authorized hosted schema/role/service identity wiring;
audited protector and sender/key/egress configuration; distributed ingress and
private paginated scheduler/retention/kill-switch operations; then original-UUID
browser persistence, ownership entry, SW and real-device pilot qualification.
All are **NOT_RUN**, not delegated to the generic frontend publisher. No defaults,
origins, keys, credentials, notification prompts, real sends or real-data writes
are supplied or enabled by this candidate.
