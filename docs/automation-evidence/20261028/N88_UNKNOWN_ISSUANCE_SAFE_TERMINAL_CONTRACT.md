# N88 — inactive original-request terminal transaction review

AI-authored, 2026-10-28. Task `n88-closure-1028`, run `87c816aa-2ce6-4238-b65b-bf26d42634b0`.
Source base: `9dc2acf8ce7cc070657116658a010cd0dd77adb0`.

## Result and limits

An **inactive source-only prototype** reserves the original owner/request key with an immutable terminal receipt. Synthetic transactions demonstrate that the actual current class issuer cannot mint after that reservation commits, even when its original request is already waiting. This does not fix the reported account, enable a button, advertise a capability, establish deployed database behavior, or close Product N88. No provider, browser, server, Auth, SQL, real-data or deployment operation was performed. There are no runtime imports of the new module and no UI changes.

Authority read: canonical `docs/RAKEEZ_OPS_CONTRACT.md`, the activated card, the current N88 ledger row including `[PO-20261028-N88-UNKNOWN-CODE-TERMINAL]`, and the affected receipt/issuer/client/repository implementation. Only the card's three new paths are changed. The existing schemas were read to assess the proposal; none was edited or executed.

## What current source proves

- `integrated-service.mjs` list handling emits `credentialRevision` and `reconcileIssuanceReceipts` for reconciliation version 1. It does not emit `terminalResolution` or implement a terminal branch. Its existing revoke route is not terminal closure authority.
- `student-portal-class-client.js` asks for `terminalResolutionVersion:1`, but offers closure only after the exact capability `n88-terminal-no-issuance-v1`. Successful list/zero active credentials never resolves an unknown hint. The actual client-function test preserves the hint and rejects replacement issuance/closure against a transport without that capability, with 0/28/50 fabricated members. This is a transport/function test, **not rendered UI evidence**.
- `receipt-reconciliation.mjs` treats absent/mismatched receipts as unknown. HTTP 200, 28 roster members, zero confirmed active, and missing recovery data cannot prove that an old command did not commit.
- `class-credentials.mjs` looks up `(ownerId,requestId)` before member issuance, checks the binding, and returns `409 stale_request` for a mismatch. Its normal batch digest binds teaching/roster/credential revisions, but not the full original session/lease/class/term/context. Existing receipts cannot retrospectively establish those missing facts.
- `postgres-repository.mjs` acquires the fixed transaction advisory lock `(1312307256,88)` **before** its snapshot, uses READ COMMITTED, runs commit guards and withholds results until COMMIT ACK. `withCredentialRepository` reads/flushes receipts under that same transaction and never deletes them. These are source observations, not provider readback.
- `class-credentials.inactive.sql` defines a unique owner/request key, insert-only immutable receipts, a 1 MiB row payload, four exact payload fields and bounded result rows. It permits a digest plus empty results. The prototype reuses that envelope; it does not claim this file describes the currently applied provider schema.

## Transaction protocol under review

The pure functions take an already synchronized, server-owned `verified` snapshot. Passing a client echo as that snapshot is forbidden. A future adapter must perform ingress/CSRF, current Auth/session, rollout, owner, canonical teaching/class/active term, lease/context, roster and credential validation inside the same authoritative transaction, using the existing source locks and owner isolation. It must recheck the applicable current Auth/source/expiry conditions at commit. `now` must come from the trusted server. Functions here do not supply these service primitives.

The request binds exactly owner, session, lease, teaching, class, term, context revision, the **original** request ID, expected roster revision and expected credential revision. IDs remain 16–100 ASCII command characters; binding IDs are bounded to 200 characters, members to 2000, receipts to 10000 with no eviction. Recorded outcomes have a 1 MiB payload ceiling; the existing repository's aggregate byte/row budgets remain mandatory. Exhaustion fails closed, never retires an idempotency boundary. No codes, credentials, member labels or exception details are logged or returned by this module.

The receipt remains `{ownerId, requestId, binding, results}`. Its SHA-256 binding is domain-separated by review version and terminal kind, includes the complete scope plus original expected revisions, and occupies the **same original owner/request slot**. `closed` has empty results. A fully bound reviewed `committed` receipt has one unique result per roster member, including honest `failed`/`skipped` rows for partial batches; it is never an empty fabricated success for a nonempty roster. No additional table, payload field or schema change is proposed in this card.

| State after acknowledged transaction | Meaning and response |
| --- | --- |
| `closed` | Matching durable no-issuance reservation for the original request; counts zero. This request can never mint later. |
| `committed` | Matching complete fully scoped reviewed issuance receipt; return counts only, never reissue/reveal secrets. All-failed and empty-roster batches are still committed outcomes. |
| `unknown` | Absent receipt on status, invalid/stale scope, missing authority, expired session, legacy/mismatched/partial/corrupt/duplicate receipt, capacity failure, or unacknowledged transaction. Counts zero; preserve the local hint and disable automatic replacement. |

Status never writes, closes, repairs or issues. Close inserts a tombstone only for an absent original key and exact current expected roster/credential revisions. An existing mismatched receipt is never overwritten. Repeated close/status with a matching terminal receipt is idempotent. Subsequent credential revisions do not erase already finalized outcomes; a different session/context cannot claim the old scoped proof. An originally committed legacy receipt stays UNKNOWN in this strict prototype because its full scope cannot be proved. The existing legacy reconciliation path is unchanged and retains its own current guarantees.

`reviewIssueAdmission` is a transaction-local planning predicate for a hypothetical fully scoped issuer. `recordReviewedCommit` only validates and records complete outcome metadata; **it does not issue credentials or prove that member operations occurred**. A future adapter must retain the real issuer's per-member savepoints, reservations, recovery writes, original receipts, revocation handling, current snapshot checks and late-response guards. Admission, member operations and receipt insertion must never be split into separate transactions. The prototype does not authorize any replacement request ID or automatic reissue.

## Why late issuance cannot cross a finalized close

Both operations must acquire the existing global database transaction lock before reading the key. No network cancellation or process-local busy flag is used as proof.

1. **Close wins:** it inserts the immutable owner/original-request row and commits. A delayed existing issuer then reads it and rejects the domain-separated binding before calling its member issuer. A reviewed issuer recognizes `closed` and refuses admission. Any changed original revisions still hit the occupied key and cannot bypass it.
2. **Original wins:** the original retains the lock through member writes, receipt flush and commit. Close waits. A reviewed complete receipt yields `committed`; a legacy receipt yields `unknown`, never `closed`. No extra credential is created by close or replay.
3. **Close rolls back:** there was no finalized close; the response is unknown and status stays unknown. The original may still commit. It is unsafe to clear a hint based on the provisional callback result.
4. **Close commits but ACK is lost:** response stays unknown; matching authoritative status can recover closed. A rollback, expired/changed owner guard or malformed receipt cannot be promoted into a successful ACK.

The synthetic repository reuses `createMemoryRepository`, adds a test-only commit guard/ACK wrapper, and exercises the actual current `createClassCredentialOperations` and numeric engine for both lock orderings. The other branch models fully bound future outcome receipts. These tests establish algorithm/interoperation behavior in one process; **they do not certify PostgreSQL isolation, RLS, deployed schema or service routing**. All real writers must honor the same lock/key protocol before activation. The stored receipt must never be TTL-evicted, deleted or overwritten.

## Separately authorized activation gate

The dormant candidate may be published as source by the independent controller. Do not import it into the runtime, advertise the client capability or send a live close request under this card.

A later bounded service rollout authorization must explicitly name the deployed N88 function/immutable bundle revision, `integrated-service.mjs`, `class-credentials.mjs`, the repository/receipt adapter and this reviewed module, the exact endpoint request/response mapping, applicable rollout cohort, and permitted fixture/service operations. It must bind the original request scope from authoritative state rather than trusting browser hints. Legacy receipts with missing original scope need a separate evidence-backed disposition; never infer it from zero active credentials. Existing client closure uses the revoke carrier: the service must distinguish resolution requests before normal revoke processing and preserve the normal route's ownership/version guards. Do not merely add an advertised capability to the current service.

The four-field envelope appears sufficient in the read source, so no new schema primitive is required by this model. Before rollout, provider readback must prove the actual unique `(owner_id,request_id)` boundary, immutable insert-only trigger/check constraints, payload bounds, private grants/RLS, permanent retention, common advisory lock, current canonical-source locks and commit guards. If any primitive is absent or incompatible, stop: obtain **separate exact schema/migration authorization** for those named objects and affected safeguards; this card grants none. Never weaken an immutable receipt constraint or convert old receipts in place. A preexisting receipt that lacks full provenance remains unknown.

Required later readback: exact deployed service revision/bundle identity implementing both closure and issuance fence; exact applied migration/constraint identities if separately approved; independent-connection synthetic race in both lock orders including delayed old original; COMMIT loss/status recovery; owner/session/source/version negative cases; 0/28/50-member complete/partial outcomes; current endpoint ACK and capability advertisement from the served revision. Any live account disposition needs its own explicit original-request/data authorization. The generic frontend publisher cannot perform these service/schema steps. No live proof budget is assumed or replenished here.

## Affected verification

Command: `node --test tests/n88-closure-20261028/terminal.test.mjs`.
The final run passes the four named card checks across 11 Node tests, including both actual-issuer lock orders, synthetic reviewed outcomes, owner/request/revision bounds, missing/corrupt/partial receipts, concurrent owners, commit failures/lost ACK, status recovery and actual client unknown-hint preservation. `node --check` covers the new module and test; `git diff --check` covers patch formatting. There is no app startup dependency, so no build/SW/browser gate is introduced.

Initial test history is preserved here: the first run passed 9/10 tests; the client test failed because `assert.rejects(promise)` could not catch the client's synchronous `review_required` guard. The harness was corrected to `assert.rejects(async () => call())`; no Product guard or implementation was changed to make that test pass. A further actual-issuer-first race case was then added. No service failure was replaced with a PASS.
