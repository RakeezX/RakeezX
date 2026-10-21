# N107 — cross-tab Sync timestamp echo

AI-authored scoped evidence. Task `continuous-n107-cross-tab-sync-echo-20261021`, run `a321339f-42fe-41ab-a761-a391577d44e4`; base `ebb8aa4daf5c71f255941c9ffb71fae91c18a155`.

## Proven cause and correction

Successful `syncAll` persists `device.lastSyncAt` with `notify:false, queue:false`. `patch` still broadcasts that durable device update. The receiving store's `absorb` previously notified with default `syncReady:true`, entering the actual 325ms automatic scheduler again. Two same-workspace tabs could keep completing and broadcasting without any Product/outbox change.

The only Product-code change is in `src/store.js`: `absorb` still refreshes state and honors `render`, but requests Sync only when the batch contains a non-device change. Device-only metadata remains visible locally; mixed Product/device and outbox-only notifications retain their wake. No new dependency, transport, scheduling, indicator, owner/lease guard, persistence or recovery policy changed.

## Affected evidence

All new evidence is under `tests/n107-cross-tab-sync-echo-20261021/`.

- `baseline-result.json`: served immutable base store, real application modules, IndexedDB, native BroadcastChannel, two synthetic account-workspace tabs and actual Sync coordinator. Over 1.8 seconds, each tab completed three additional passes with empty outboxes. No extra Product edit was needed.
- `device-result-and-dom-harness-failure.json`: corrected store completed only the requested pass (`[1,0]`), peer performed no extra cloud reads, refreshed the exact timestamp and received `render:true, syncReady:false`; both outboxes remained empty. These successful device checks are reused unchanged.
- `queued-result.json`: real `patchProfile` durably queued the original owner's command; with only the writer scheduler suspended, the peer woke, read and dispatched. Deliberately unavailable synthetic mutation RPC left a durable failed command and an unhealthy `error` summary. Real `queueClosedTermReport` also retained its outbox-only `render:false, syncReady:true` peer notification.
- `affected-checks.txt`: 29/29 PASS across existing remote revision/duplicate/trailing-wake tests, owner/outbox isolation, authenticated durable patch/batch cadence and authenticated coordinator failure/recovery/foreground lifecycle tests. Includes wrong-owner and ownerless-command rejection, return as original owner, rejected/fatal/transient status and lease enforcement.
- `result.json`: compact combined result and checked source hash. `node --check` for store and harness and `git diff --check` passed. No full build was needed for this existing-module boundary correction.

Commands: `N107_BASELINE=1 node tests/n107-cross-tab-sync-echo-20261021/browser.mjs`; then normal browser harness. After the device checks passed, the additional DOM probe timed out; only the corrected queued portion was rerun with `N107_QUEUED_ONLY=1`. Existing unit checks: `node --test tests/remote-sync.test.mjs tests/sync-outbox-owner-guard.test.mjs tests/n107-focus-sync-stability-20261020/cadence-authenticated.test.mjs tests/n107-focus-sync-stability-20261020/coordinator-authenticated.test.mjs`.

## Preserved harness failures and limits

`initial-harness-overlap.json` records the baseline's initial manual-pass assertion while another automatic pass was already running. The corrected measurement observed the ongoing baseline loop instead. The later DOM timeout is preserved in `device-result-and-dom-harness-failure.json`: switching a running Demo fixture to account storage does not boot an account header. It is not a rendered-UI PASS. The fixture was narrowed to the affected actual account store/coordinator entry; no Product guard was disabled. Existing unchanged actual account-boot/rendered pending/synced/blocked/rejected/error and Sync-failure evidence remains in `tests/n107-focus-sync-stability-20261020/result.json`; current coordinator failure truth is additionally checked above. No indicator code changed.

The canonical isolated-local-browser helper owned fresh synthetic contexts on task-owned loopback HTTP port 49861, blocked external requests and Service Workers and closed its contexts/browser in finally. The server closed its connections/listener in finally. This local synthetic phase uses the approved non-shared exception, without a live-browser lease. No personal browser, real account, live writes, Auth/schema changes or live Sync certification was used.

LOCAL_READY is source readiness only. The independent publisher must integrate, build as needed and verify exact served Production assets. N107 remains OPEN pending user review; no push, deployment or Product acceptance is claimed here.

## Saved-session repair — run 5932cb85-e839-47b6-8b31-ffec129d95c2

The independent candidate validator rejected the prior result because it included a failed DOM probe. Candidate `36323be103b062eee72cfca5ae1b1ec268c93ec1` and its original failures are preserved. No Product source changed during this repair, and its exact source hash matches the reused device/queued/29-test evidence.

Concrete correction: `status-browser.mjs` uses the existing served-Demo and synthetic account preparation helpers, registers the fixture's provisioning receipt, and **reloads through the real account app boot** with `status-bootstrap.mjs` installing local-only transport before app startup. This replaces the erroneous assumption that changing a mounted Demo store automatically mounts an account header. It does not alter Product code or disable any guard.

`node tests/n107-cross-tab-sync-echo-20261021/status-browser.mjs` PASS: a single same-document checkpoint after reload verifies current owner, mounted workspace/database, provisioning receipt, data and empty outbox, and invokes the actual `assertClassImportAccess` guard. The real account header with source CSS starts green. Actual `patchProfile` saves an owner-bound outbox edit and its automatic dispatch fails against the deliberately absent synthetic RPC; the current account DOM turns red, the summary reports `error`/unhealthy and the durable failed command is retained. `status-result.json` records this corrected check, and `account-dispatch-error.png` was visually inspected at 390px. The original failed probe is historical evidence, now resolved by this new actual-app check, not relabeled as PASS.

Only the previously failed probe was rerun. The cross-tab and remote/owner/durability/recovery proofs are reused for the identical Product source. Syntax checks for the two new harness modules and `git diff --check` passed. The fresh isolated browser and owned loopback server on port 49862 closed in their finally blocks. No live request or mutation was used. The combined `result.json` now records the resumed run and references the original evidence run.
