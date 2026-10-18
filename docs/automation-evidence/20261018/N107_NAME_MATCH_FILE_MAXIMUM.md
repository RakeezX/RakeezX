# N107 — exact declared file maximum on a unique name match (AI-authored)

Task: `continuous-n107-name-match-file-maximum-20261018`  
Run: `5a197e3e-6537-4e50-b57e-6e303d020622`  
Base/observed origin/main at preparation: `859de68d4e3368b2b42e52540da4a9aa7647926d`

Latest PO18October15:29 supersedes only the old name+maximum mismatch rule for a unique, active, same-teaching, owned, manual direct destination. Its ID is reused and its maximum becomes the exact valid declared file maximum, including a safe decrease. An absent/invalid declared maximum never invents a number. Duplicate normalized names/source columns and automatic/subitem/read-only/locked/foreign/deleted destinations remain protected.

The existing single preview shows `name old→file maximum`, original/capped incoming values and existing overwrite consent. Existing and prospective imports use the same defaultItemsFor resolver. The new class still waits for actual owned creation receipts before binding to its unique created manual destination. No second wizard or scoring engine was added.

The narrowly scoped max-only helper uses the same Product DB wrapper, outboxEntry/Sync field mapping and normal mutation/reconciliation transport as ordinary direct-item edits. Its local item/outbox/checkpoint write is atomic. The original mutation identity is checkpointed before dispatch; the same-request canonical receipt records identity, owner, outcome, conflicts, exact maximum and revision. Every maximum must ACK before fresh reviewed grade cells are built. N90 maximum/revision CAS remains enabled. Foreground/context, item fields, receipt and all preservation facts are rechecked during asynchronous grade preflight. A previous positive serverRevision or optimistic local maximum is never treated as ACK.

Max updates and grade batches remain separate transactions. All existing scores for a matched item are bound, including absent students, blank/no-change cells and zero. A lower maximum invalidating any stored grade blocks before mutation even if the file offers an overwrite. No clamp/rescale/drop/reassignment of existing grades is attempted. Unsafe lower-max/overwrite atomicity is deliberately unsupported; the current preview gives an actionable conflict. Incoming values still cap to the declared maximum, with the original value visible and overwrite consent retained.

The existing owner/database-bound device continuation now stores the exact reviewed maximum stages and new-student identities. Lost ACK, partial stage completion and reload retain the original requests. Reload does not start a write; ordinary background Sync does not dispatch these foreground stages. Explicit resume can recover the identical request; a rejection is never automatically retried. Stale cross-tab saves cannot replace immutable progress. Cancellation cannot erase a checkpoint while its maximum command remains uncertain/rejected; the teacher is told to resume or resolve that Sync rejection. Completed max stages survive failure of a later stage. Completion follows the durable grade receipt whenever grades actually change; blank-only files apply the approved maximum without manufacturing a grade batch.

## Actual affected checks

- `node --test tests/n107-name-max-contract.mjs`: **5/5 PASS**. Unique normalized name with increase/decrease/decimal maximum, no maximum invention, duplicate/read-only/foreign/deleted protection, all-score preservation/lower conflict, actual default resolver.
- `node --test tests/n107-name-max-state.mjs tests/n107-file-sync-state.test.mjs`: **5/5 PASS**. Atomic progress preservation, uncertain/rejected cancellation guard, metadata-tolerant grade binding, existing owner/database/cross-tab/session and persisted foreign-parent safeguards. The logged CLASS_IMPORT_FOREIGN_PARENT is the expected negative assertion.
- `node tests/n107-name-max-browser.mjs`: **13/13 PASS**, current failures **0**. Fresh disposable synthetic contexts, actual app DOM/handlers/source CSS and actual account store/ownership/lease + normal Sync/ACK transport over `http://127.0.0.1:49728`:
  - Existing class, same ID, exact20→30, one preview and one durable grade receipt, blank19 and untouched zero preserved.
  - Two maximum stages: first ACK retained when second ACK is lost; reload retries only the second immutable request, then one grade receipt.
  - Lost maximum ACK/cancellation/reload; explicit background Sync does not replay it; same-request resume completes once.
  - Rejected maximum persists across reload and explicit resume sends neither retry nor grade.
  - Delayed ACK plus double click produces one maximum mutation and one grade receipt.
  - Absent-student19 blocks max10 before any mutation.
  - Owner/term failure before dispatch, session change during maximum transport, item drift during asynchronous grade capability preflight: no grade dispatch/success.
  - Existing blank-only file preserves scores, applies exact max and sends no grade command.
  - Actual new-class creation/default ACK, homework10→20 ACK, then grades17/0 and blank unrecorded; also new-class blank-only maximum application.
- Product/harness syntax checks and `git diff --check`: PASS.
- `tests/fixtures/n107-name-max/existing-preview.png`: actual390px viewport inspected; one compact preview, visible exact maximum impact and normal confirmation. Desktop1000px DOM journeys use the same source CSS.

`tests/n107-name-max-browser.json` contains the exact current source/CSS/harness SHA256 bindings and checks. Initial development failures are retained separately: a receipt owner check initially inspected a decoded row that intentionally omits owner metadata (corrected to raw canonical owner_id); reload initially regenerated new-student IDs (now persisted); an overly broad preservation check initially ran after the import's own committed grades (now restricted to grade preflight). These are corrected implementation observations, not current passing claims for failed runs.

Existing `N107_FILE_IMPORT_SYNC_MATCHING.md`, candidate2780c6e and publicationca61990 evidence remain reused for unchanged business-fingerprint, creation and grade receipt logic. Its old name+max mismatch requirement is expressly superseded here. The previous28-row browser suite, unrelated N36 and native SQL qualification were not rerun.

The new Sync-to-grade-transfer import uses already cached application resources: sw.js already lists grade-transfer.js, grade-transfer-parsers.js, student-import.js, student-import-parsers.js, store.js and sync-v2.js. No new offline-shell resource or Service Worker rewrite is required; no offline certification is claimed.

Canonical isolated-local-browser helper used its task/run validation, fresh owned contexts, loopback-only policy, blocked external requests and Service Workers. It closes owned browser contexts in finally; the unique49728 server closes all owned connections/server in finally. No shared live-browser lease, real account, hosted backend, SQL/Auth/RLS/schema operation, push, deployment, queue/status/ledger mutation or unrelated suite was performed. The independent publisher owns integration/build and actual served-source Production evidence.
