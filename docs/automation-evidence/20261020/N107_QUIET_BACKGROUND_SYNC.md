# N107 — quiet ordinary background import

AI-authored bounded follow-up for `continuous-n107-quiet-background-sync-20261020`, run `8c838923-1131-4655-8a58-7c085db2ff86`.
Base: `3789084a5142c785e97ae228ef9dbe1d451be397`.

Only `localImportPanel()` changed. Routine local_ready/waiting_creation/waiting_sync/syncing plans render no background panel, technical explanation or stop action. Uncertain/needs_review plans show a concise class/status/retry row; a closed “خيارات المتابعة” disclosure retains safe-stop access and its receipt warning. No raw plan IDs or internal phase names appear as user text. Current-plan local/cloud/cancelled receipt markup is unchanged.

Affected verification:

- `node --check src/views/class-import-center.js` — PASS.
- `node tests/n107-quiet-background-sync-20261020/browser.mjs` — PASS for `n107_routine_background_progress_hidden` and `n107_uncertain_recovery_and_safe_stop_reachable`; exact output in `tests/n107-quiet-background-sync-20261020/result.json`.
- Actual application DOM, native disclosure interaction and source CSS served from owned `http://127.0.0.1:49819` in the canonical isolated local browser helper. Fresh synthetic account workspace with existing ownership guard; routine/terminal and mixed recovery fixtures. Rendering/disclosure leaves plan/data/outbox snapshots identical; zero synthetic service commits. Retry/cancel plan bindings checked; no cancellation or Sync replay claimed.
- Visually inspected routine desktop/narrow, uncertain desktop, needs_review narrow, and expanded safe-stop narrow screenshots. At 1100px and 390px controls remain readable with no horizontal overflow. PNGs are in the same test directory.
- `node tests/n107-quiet-background-sync-20261020/scope.mjs` — PASS for `n107_affected_result_inspected_and_sync_unchanged`. It compares with the exact base and proves all source outside the render function and current receipt markup unchanged (line endings normalized). Initial harness assertion failed because Git uses LF and the Windows worktree uses CRLF; recorded in `scope-initial-failure.json`, then corrected only the comparator.
- `git diff --check` — PASS.

Queue, durable plans, owner/lease guards, grades, Sync, retry/cancel handlers, receipt engine and service code are unchanged. Existing N107 data/recovery evidence remains historical; no broad suite or new live proof was run. The browser closes its fresh contexts/browser in finally; the server closes connections/listener in finally. The approved isolated phase requires no shared browser lease. No live accounts, service operations, queue/status edits, push or deployment.

LOCAL_READY is source readiness only. Controller/publisher retains integration and changed served-asset verification. N107 umbrella remains OPEN; no wider Product acceptance claim.
