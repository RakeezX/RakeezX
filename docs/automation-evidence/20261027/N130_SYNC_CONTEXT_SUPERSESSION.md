# N130 — Sync context supersession (AI-authored)

Task: `continuous-n130-sync-context-after-qualified-sw-20261027`
Run: `5b8f5719-114b-4dc1-8b1f-f571e3797f51`
Base: `c589904f955c2841794025dedda2606edfd2d2f8`

## Bounded result

The original actual app/coordinator reproduced `revision_validation / CONTEXT_CHANGED` after 14029ms actual elapsed, clean durable queue, same-owner replacement session, zero sends. The baseline source was served from the immutable base Git object over task-owned HTTP, not a lookalike page. See `baseline-result.json` and `baseline-desktop.png` in the test directory.

The repaired run retains workspace/session object fences and adds owner/token value fences (including in-place token changes). It checks the context before dispatch and before publishing/finishing. An explicitly identified obsolete attempt terminates false, does not certify whole-run success or emit the coordinator ACK, and requests one coalesced guarded full pass. Auth and ownership denial remain actionable. Real transport/HTTP/marker/durable failures use their existing failure/retry paths. Existing engine per-command confirmed receipts remain authoritative; uncertain receipts retain the exact mutation identity and are never converted to run success.

Supersession marks verification pending without resetting an existing hard failure or transient failure timeline. A matching successful full pass with a clean durable status clears `lastSafeFailure`; a partial pass does not. Failed/rejected/blocked Outbox states retain priority; historical conflicts remain history. No owner, lease, revision, tombstone, restore or deletion guard was weakened.

`sw.js` increments **v90 → v91 once**. A fresh controller snapshot showed this task as the sole active worker and no delivery in flight; the N44 qualified frontend task was `awaiting_po`. Verified shared SW SHA `e2f40e680edea6a546331d4adc58f5de9fcd392c` is an ancestor of this base. The SW source is byte-equivalent to base after normalizing line endings and replacing only VERSION; N44 Push handlers and shell remain intact.

## Required affected checks

| Check | Result | Evidence |
| --- | --- | --- |
| n130_context_supersession_same_owner_not_false_hard_failure | PASS | `context-output.txt`: 9 tests, including one fresh full pass (exactly two marker reads), session/token renewal and in-place token mutation. Actual-app baseline and repaired browser reproduction: 14038ms, false obsolete result, unchanged successful timestamp, zero sends, pending/non-hard severity. |
| n130_owner_auth_rejection_protection_and_unknown_ack_preserved | PASS | `guard-marker-warning-output.txt`: 49 tests, including existing owner/lease/remote marker/403/timeout checks and unchanged warning timing. `durable-convergence-output.txt`: 10 selected engine cases covering owner change during read, lost exact-id response, rejected/blocked work, tombstones, two-device identities, delayed receipt regression and fresh multi-client convergence. `cache-output.txt`: ignored abort/late response cannot certify validation. `context-output.txt`: real UI/store `patchProfile` command with lost response/auth renewal retains envelope; 2 receipt calls, same mutation ID, 1 commit, no premature coordinator ACK. |
| n130_current_full_success_clears_stale_warning_without_masking_outbox | PASS | `context-output.txt`: real 401/403 and durable failed/rejected/blocked counts remain visible; hard diagnostic survives supersession and partial success, matching full success clears it. `lifecycle-authenticated-output.txt`: 5 selected actual lifecycle/reload/convergence/retained-receipt cases PASS. |
| n130_pwa_sw_version_and_real_rendered_warning | PASS (local source/UI) | `cache-output.txt`: 2 tests, including executing actual SW install/fetch in a synthetic Cache API, current sync bytes served offline, shell/N44 retained and one version increment. `browser-result.json`: actual authenticated app DOM, handlers and CSS at desktop 1100px/mobile 390px. Pending is non-red; fresh success advances timestamp, is green, and removes stale detail. A real synthetic 403 is red with HTTP_403 detail until a matching full success. Screenshots: `desktop-pending.png`, `mobile-pending.png`, `desktop-success.png`, `mobile-success.png`, `mobile-real-failure.png`. |

Test evidence directory: `tests/n130-sync-context-supersession-20261027/`.

The browser used canonical `withIsolatedLocalBrowser`, fresh disposable contexts, loopback `http://127.0.0.1:49830`, external requests and Service Workers blocked. The owned browser and HTTP server closed in finally. The isolated local exemption requires no shared live-browser lease. The source cache test is a VM simulation, not browser offline/PWA or Production certification. No credentials, live users, real records, notification sends or provider/service operations were used. Production, served PWA evidence and Product acceptance remain for the independent publisher/PO.

## Harness findings retained

- Original baseline failure is retained unchanged.
- `initial-hidden-mobile-selector-failure.json`: desktop selector selected a hidden button at mobile width; corrected to the visible real control.
- Timestamp readback failures are retained in `initial-fresh-timestamp-failure.json`, `fresh-timestamp-readback-failure.json`, `async-predicate-readback-failure.json`. The async browser wait yielded a false handle and raced the in-flight full run. The corrected test uses a synchronous snapshot predicate in the same document, explicitly requiring a newer timestamp and settled full Sync. No Product success assertion was weakened. Final successful result is `browser-result.json`. `pre-stable-render-*` retains the earlier successful UI result/screenshots; final screenshots wait for the sheet transition.
- `lifecycle-output.txt` retains 5 original fixture failures before lifecycle operations: missing session expiry triggered current Auth credential fences. `lifecycle-authenticated.test.mjs` copies the existing test assertions with only import relocation and one consistent unexpired fabricated session in `device()`; actual guards and selected lifecycle expectations remain unchanged. Its first relocated source-read path also needed correction. The final 5 affected cases pass. The original test file was not edited.
- Initial new Node harness lacked a document shim; adding the existing store test shim allowed actual initialization. Mock Auth does not emit production Auth notifications; fixture renewal therefore uses an actual store device notification to refresh the receiver binding. These are fixture corrections, not guard overrides.

Syntax: `node --check src/lib/sync.js`, `node --check sw.js`; `git diff --check` PASS. No full build or unrelated suite was run.

## Reproducible commands

```powershell
node --test tests/n130-sync-context-supersession-20261027/context.test.mjs
node --test tests/n130-sync-context-supersession-20261027/cache-late-response.test.mjs
node --test tests/sync-outbox-owner-guard.test.mjs tests/remote-sync.test.mjs tests/n125-revision-20261020/validation.test.mjs tests/sync-warning-policy.test.mjs
node --test --test-name-pattern='owner identity change|lost response retries|blocked child|protocol-invalid|operational summary|two devices materializing|pull overlays pending|delayed receipt|three isolated clients|offline failure remains' tests/sync-v2-client.test.mjs
node --test --test-name-pattern='end enrollment preserves|offline/auth/pending|lost response after server commit|V1 rejects reinstatement|finalized receipt resumes' tests/n130-sync-context-supersession-20261027/lifecycle-authenticated.test.mjs
node tests/n130-sync-context-supersession-20261027/browser.mjs
```

The browser helper requires this exact active task/run; evidence is reusable for unchanged source without replaying after the task retires. No queue file or old pending card was edited. No push/deploy was performed.

## Source SHA-256 at verification

```json
{
  "src/lib/sync.js": "d8e6759080d71c9e1c48d9fa6a3380849eae791f68b9dc909bbf92178cd92d69",
  "sw.js": "83cae95cf0463e13cd81613448a3221ec20c276f8207c3cdcb48c4ed8aa4110e",
  "src/lib/sync-status-severity.js": "ca3fd72ac87ec14d02733e9d61cf672949b50e6566188d32fec48a2eeac9ffce",
  "src/lib/sync-operational-ui.js": "b2fb0bb2eba7d1bf60a8448a7d4ba404f7db996f31ed7769dd57b3f3da96e58a",
  "src/lib/sync-warning-policy.js": "65074c76d76e1543e7bd7adb18a27c266f0d57d8192fc0259d77503bf4a28273"
}
```
