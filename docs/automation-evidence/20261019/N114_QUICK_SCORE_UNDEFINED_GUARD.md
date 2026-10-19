# N114 — automatic participation + / − missing guard import

AI-authored implementation and evidence, 2026-10-19.

- Task: `continuous-n114-quick-score-undefined-guard-20261019`
- Run: `78e4d164-0c2d-4cf1-8111-142a764b43d2`
- Base: `3fce1195b9c840259e0acea6973efd1436288c29` (HEAD and origin/main matched at start).
- Authority: activated N114 card and current canonical Product ledger N114 row. No queue, ledger, service, Auth, schema or real-data changes.

## Cause and correction

The actual grade view's `n84-log` action called `runtimeSyncOwnershipGuard.enqueueAccess()` without importing its binding. The reported toast spelled the identifier `runtimeSyncOnwershipGuard`; current source and the reproduced runtime failure use `runtimeSyncOwnershipGuard`. Added the missing named import from the existing `sync-ownership.js` dependency. Existing enqueue/owner guards, save durability checks, pending lock, score projection and feedback remain unchanged. No new startup dependency or offline shell change.

## Focused actual application check

`node tests/n114-1019-plus-minus.mjs --baseline` reproduced the ReferenceError using the immutable base grade module, actual application HTML/CSS/router and a real + click over task-owned `http://127.0.0.1:49114`. No log persisted. Evidence: `tests/n114-1019-baseline.json`.

`node tests/n114-1019-plus-minus.mjs` passed `n114_actual_plus_minus_owned_score_ack_no_undefined_guard`:

- Fresh disposable local account fixture, actual IndexedDB/store, valid enrollment and actual ownership/offline lease guards; existing served-demo readiness and account fixture helpers reused.
- Actual grade-view participation tab and + / − event handlers: exactly one durable log each, deltas +1 and −1, projection null → 2 → 0. Manual score, students, enrollments, teaching and item records unchanged; no automatic score materialized.
- Unresolved and foreign-bound owner rejected by the actual UI handler without a log/outbox change. Foreign authenticated dispatch sends zero transport requests and retains commands with truthful ownership-blocked state.
- Restored matching owner receives two canonical synthetic transport ACKs through the real Sync engine. Two unique remote logs, empty outbox, zero repeat dispatch attempts. This is local synthetic transport evidence, not hosted service/Production certification.
- No page errors or undefined-guard toast after the correction.

The candidate JSON retains two harness assertion failures and their original stacks: an incorrect insertion-order expectation for IndexedDB `getAll` (random primary-key order), then an incorrect expectation that ownership denial leaves outbox status pending (the actual engine correctly records blocked/error metadata). Assertions now check both deltas independent of key order, and unchanged command identity/payload alongside exact truthful blocked metadata. No Product guard or failure was suppressed. An initial pre-fix existing N84 Node probe failed and was stopped when it retained handles; the bounded browser baseline supplies the precise runtime reproduction. N84 scope was not reopened or rerun as a suite.

`node --check src/views/grades.js`, `node --check tests/n114-1019-plus-minus.mjs` and `git diff --check` passed. No full build or broad scoring suite was needed.

The canonical isolated-local-browser helper validated the active synthetic task and closed its owned contexts/browser in finally; the task-owned loopback HTTP server closed in finally on every attempt. External requests and Service Workers were blocked. No shared live browser or live mutation phase was used.

Result: source-local readiness only. The independent controller/publisher owns integration, build, publication and served Production verification; PO acceptance remains separate.
