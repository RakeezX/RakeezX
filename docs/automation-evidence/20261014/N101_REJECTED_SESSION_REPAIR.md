# N101 — reviewed rejected-session recovery

Task: continuous-n101-reviewed-rejected-session-repair-20261014
Run: 445614fc-3975-4a8c-814f-0fc8be85d6a3
Base: ff7cf00187913bfaff55f773002828dc5a7b2d68
Result: source LOCAL_READY. No push, deployment, hosted service operation, real-account read/mutation or Product closure.

## Bounded behavior

The real Mini Hub Sync rejected summary opens **مراجعة وإصلاح الحصص المرفوضة**. This is a user-initiated read-only inventory of the current claimed account's exact protocol-v2 session CREATE/baseRevision=0, rejected 22023/N58_SESSION_CONTEXT_REQUIRED envelopes with missing original context and an owned, current, nondeleted local session. No grade/student/legacy/UPDATE/DELETE or other rejection is enrolled.

Read N101's current canonical Product row, N58's row, D-087 (including historical-outbox exclusion) and N101_CONFIRMED_CONTEXT.md. No reliable six-entry historical ID manifest exists in local Product source. Accordingly there is **no automatic selection/count-based boundary**. Every dated/classed entry shows its queued timestamp and request identity, starts unchecked and requires its own explicit declaration that it belongs to the current report. The historical-six warning remains visible. Native tests deliberately include six historical synthetic entries with the same otherwise qualifying signature and prove only the five explicitly selected current IDs are touched.

No original context is invented. The teacher sees the exact session's teaching → term → year, the named calendar, dated day kind/label and the acknowledged year calendar-selection revision, explicitly as a **correction with unverifiable creation-time context**. The review fingerprint retains the complete original envelope, local session, exact parent records and relevant custom-calendar/day source records. Missing/deleted/unacknowledged parents, changed local source, out-of-term dates, pending related/conflicting work and ambiguous day corrections remain untouched with an explanation. The current global active year/term is never substituted.

Explicit confirmation atomically writes a complete original rejection/error audit and ONE new owner-bound replacement per selected source. Original rejection rows stay rejected and counted until exact receipt reconciliation. No original raw deletion; stable session identity is reused. A durable original→replacement binding makes repeat confirmation/reopen/reload reuse the same ID. The engine never automatically creates repairs, and recoverRejectedScoreCreates is unchanged.

Before first send, the normal complete owner-scoped sessions read checks for an existing canonical ID or equivalent dated session, including tombstones; any existing match stays blocked. Source/parents/owner/revision are revalidated again in the locking transaction after that read. Account/workspace changes across the async preflight/response cannot apply status or receipt writes to another workspace. Locked response-loss retries preserve the identical envelope/ID and recover the existing server receipt through the normal Sync operation. Only an applied receipt with matching owner, stable identity, positive revision, nondeleted canonical row and every requested field/context can atomically reconcile the session, mark the audit verified and link/supersede the original. PostgreSQL HH:MM:00 and client HH:MM are compared as equivalent; nonzero seconds are not discarded. Failed/blocked/rejected replacements remain visible with a normal Sync receipt-recovery action and support path, without generating another replacement.

The local durable audit records that the context was a teacher-confirmed correction. The unchanged N58 server context format accepts only its existing seven fields; this implementation does not claim server-attested original provenance or introduce a service capability. No new migration, SQL/Auth/RLS or provider operation is needed. All new startup dependencies are in sw.js v61.

## Actual affected checks

| Check | Result | Evidence |
| --- | --- | --- |
| n101_exact_missing_context_repair_plan | PASS | Actual baseline app schedule DOM/handlers generated five contextless creates; exact immutable native N58 function rejected all five with 22023/N58_SESSION_CONTEXT_REQUIRED and zero canonical sessions. Current app inventories 11 synthetic exact-signature entries, named source/context/revision, all unchecked; selects the five by explicit IDs, not count. |
| n101_review_then_atomic_replacement | PASS | Current HTTP app Review → per-entry checkbox → confirm handler → store → real IndexedDB/engine. Cancel changes zero data; five atomic durable original audits/replacements; repeated confirmation returns the same IDs; original failures stay rejected before receipts. |
| n101_repair_native_ack_loss_retry | PASS | Owned disposable PostgreSQL 17.6, existing source sync/N58 functions and synthetic A/B owners: five canonical sessions and five exact receipts, no duplicates. 503 after one native commit, reload, identical mutation/envelope/receipt recovery. A second fresh actual-app context with delayed restore and reload obtains the exact five contexts. |
| n101_original_evidence_owner_history_preserved | PASS | Every full original rejection/error preserved in verified audit; all six frozen synthetic entries byte-identical/unreplayed. Client wrong-owner dispatch attempts zero requests; native B denied A receipt. Every other native domain table (including students, grades and item maxima) byte-equivalent before/after. Targeted account-switch-during-preflight, invalid/foreign receipt, tombstone and source-race negatives also pass. |
| n101_actual_repair_ui_and_shell | PASS | Actual app DOM/CSS at 390/1280px RTL, no page overflow; screenshots inspected. Separate actual raw HTTP app Service Worker v61 caches repair/Sync/calendar dependencies and serves the exact repair module after offline reload. |

Commands completed:

- node --test --test-timeout=15000 tests/n101-repair-plan.test.mjs tests/n101-context-runtime.test.mjs tests/n101-context-local.test.mjs — **10/10 PASS**, natural exit 0.
- node --test --test-timeout=15000 --test-name-pattern='session|receipt|canonical|rejected|owner' tests/sync-v2-client.test.mjs — **17/17 affected cases PASS**, natural exit 0. Includes alias/canonical reconciliation, delayed/lost receipt, owner-change and session tombstone cases.
- node tests/n101-repair-native.mjs — all six recorded local schema/Product gates PASS; no error; source hashes verified against current files.
- node tests/n101-repair-shell.mjs — PASS on final Product sources.
- node --check for five Product JS files and three new test files; git diff --check — PASS. No full build or repeated Preview.

Native report: test-results/n101-repair-fixed-1791955056998.json
SHA-256: 3b4c4960ecf1d7e3c51e157bf15846405d7cd4cc0dd1cdc7114192620b2f5946
Native N58 guard body MD5: 6fc9fcdf35f78d0ae295fe61a833f70d (same immutable source used by the prior prevention proof).
App source SHA-256 (recorded separately; earlier report's source list omitted app.js): 15853d1a046a4941180fda904ad64f9e4eada4b9292bffea5830bf41449bbd8f
Screenshots: test-results/n101-repair-review-390.png and test-results/n101-repair-review-1280.png.

## Preserved failures and disposition

Initial harness failures are retained in the process output and timestamped test-results reports; they are not acceptance passes. The inherited N71 ownerCheckpoint required an empty outbox, unsuitable for preserved rejections. Its first replacement read the DB receipt before boot ownership was ready and then exposed a cross-document JSHandle snapshot issue. The final checkpoint performs one serialized page.evaluate with ready/owner/database/lease/sync checks before any Product reads, then reads receipt plus data and rechecks the binding in that same document; it is exercised by delayed restore and reload. No ownership/lease guard is disabled. The first cleanup encountered Windows EBUSY on the already-stopped owned PG log; bounded fs.rm retries now handle this, and final cleanup completed.

Report 1791954739559 preserves the real incompatible-receipt failure from HH:MM versus PostgreSQL HH:MM:00. The implementation now compares only that exact time equivalence; native final proof and a nonzero-seconds negative pass. Report 1791954825647 preserves the earlier checkpoint result-shape failure; reports 1791954883401 and 1791954971179 passed earlier source revisions. Final 1791955056998 certifies the additional workspace-continuity guard. A new negative-receipt test initially lacked a requested time field; its fixture now explicitly requests 07:00 before testing incompatible 07:00:30, without removing any assertion.

Native browsers used the shared browser phase lease, because this card has liveAuthorizationRef and is ineligible for the isolated non-shared helper. No denied tool operation was attempted or rerouted. Fresh synthetic contexts block external network and Service Workers for native checks; only the separate shell check enables its owned loopback Service Worker. Unique loopback Vite/PG/static servers, contexts and browsers closed in finally; disposable cluster removed. Owned browser lease released successfully. No user profiles, credentials, hosted Auth accounts, private SQL, real rows, queue/status files or global configuration were touched.

Existing actual-user five remain unrecovered by this worker: after independent publication, the teacher must activate and confirm the deployed self-service correction. Production/provider evidence and N101 acceptance remain with their authorized owners.
