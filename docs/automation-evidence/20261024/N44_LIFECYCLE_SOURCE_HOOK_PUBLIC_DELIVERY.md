# N44 qualified lifecycle / SourceSync public dependency

AI-prepared source-only delivery candidate. Task: continuous-n44-lifecycle-source-hook-public-dependency-20261024. Run: 5976978d-df3e-4cf7-9177-7203c323a82f.

## Exact source identity

- Qualified immutable parent: 782d6862c6be0fc344bce7b5875e8cedb1623440. Evidence below is read directly from this Git object; no private branch history is copied into this candidate.
- Base and observed origin/main: f1fe51190b5688228136c8628362035d8e9068da. HEAD matched this base before editing; worktree was clean.
- Manifest: tests/n44-current-closed-page-followup-20261024/lifecycle-combined-public-manifest.json (SHA-256 0c67d22122d5f888e0c1b40b6f1c82d69b11fd30201b4cfea20856526a9a9f8e).
- Exact patch: tests/n44-current-closed-page-followup-20261024/lifecycle-combined-current-main.patch (SHA-256 bd043fa7aa7c4d0c7f8b59079d84c31c5ef279f18e2b935becd0382dd86e5464).
- Verified each raw preimage against both working file and origin/main, and each qualified target against the parent object before applying only the patch. git apply --check succeeded. Git initially materialized CRLF; normalized only these three files to the qualified LF bytes and reverified. No configuration was changed.
- Entire resulting three-file git diff has the exact patch SHA-256 above. app.js differs only in the existing Auth storage listener: invalidate becomes refresh. Current UI, academic, import, Sync and existing hook wiring remain intact.

| Path | Base SHA-256 | Target SHA-256 |
| --- | --- | --- |
| src/app.js | af6a33ba4a9715832184bcd28b3c8602e753f9cba469f0a8af4804c7bc1d379f | f4eda5681e1182ea9e0a2b692266deea29e5bec82c9bc7fbbf1b551b8d2e98e4 |
| src/lib/notification-push-runtime.js | 95d1a678e3c770a2ff7ecc75e016171ac7efd28ce9f0da855f6a7ed653f20a45 | eda9ce630d18ab26f1013bc02df09aa91d492f912f7ebb78711b020cd0aaed19 |
| src/lib/notification-push-gateway.js | 5e207e3bfdc64383ceb765b789cf30dcba3350b13dedab1355e0843cef6ac353 | cda1b0efedf8796ff26d3e734f1c847721dd355886a34af623dbad2e90a45789 |

## Required affected checks

All three checks PASS for this bounded source dependency. These are exact-byte qualification reuse plus fresh scoped assertions, not newly executed browser/backend tests.

| Check | Evidence |
| --- | --- |
| n44_actual_app_lifecycle_and_source_hook | Immutable lifecycle-session.json: 14 PASS; lifecycle-sync-hook.json: 7 PASS. Target files exactly match the qualified parent/combined manifest. Original lifecycle helper serves actual full app over HTTP with real cloud/store entry points and storage listener; hook proof exercises actual store, ownership guard, HTTP handlers, DOM and source CSS. |
| n44_exact_current_main_delta_and_owner_guards | Fresh assertions: all three preimage/target hashes, exact complete patch hash, sole app.js listener replacement; node --check passes for each changed JS file; git diff --check passes. Original full-App negatives retain new SID, unpersisted new SID, malformed/revoked credentials, logout, foreign owner, lease and consent retirement. |
| n44_unknown_and_original_cleanup_preserved | Fresh section comparisons preserve gateway UNKNOWN cleanup/CAS and original-only retire/restore/remove against current main. SourceSync projection and ancestry-filter bodies are unchanged through the parent lifecycle revision. sw.js hash matches immutable worker-binding proof; original cleanup cannot clear a newer binding. Hook proof retains overlap coalescing, independent definitive rejection, persisted UNKNOWN/no replay and pending-outbox/owner fences. |

## Reused immutable proof

All following paths are under tests/n44-current-closed-page-followup-20261024/ at the qualified parent above. Read with git show <parent>:<path>; these receipts are not copied or rewritten.

| Receipt | SHA-256 | Result |
| --- | --- | --- |
| lifecycle-session.json | 889777cbb011651776a94255e91d0190b3936cd5cabc5fb6c154f259d273d1b9 | PASS / 14 checks |
| lifecycle-sync-hook.json | 2a6749a50192881d39fba0a69b0e34e0c1e7ba63df712720a5fb46a6a1a3a933 | PASS / 7 checks |
| lifecycle-worker-binding.json | 7c3522d6add7bf455660ee3bbbf1dccde5392cc8b049b0d134056a947743f284 | PASS |
| second-capability-pg.json | feb8145feeab0fef0047bb52a98318f28008c083f02f0d92d8269432c5c36bbe | PASS / 13 checks |
| lifecycle-refresh-original-failure.json | 48c656375ce6c1b21d682817e56c63e2c0b5c9cef8c8a8934d7fd2d18ded5bb4 | FAIL / 2 checks |
| lifecycle-outcome.json | 844831424925226ca4460f1e0ab1e0b9989a148c766b44fb6f56dc36a521be4e | BLOCKED |

The 13 native checks in second-capability-pg.json are reused unchanged; no native/service proof is rerun. lifecycle-sync-hook.json records its earlier runtime capture b03da28787ece1a401d42604a2ca52f7836b9231356602e36647fd29641cc440, while the combined manifest binds the final lifecycle-qualified runtime target listed above. This is not presented as a new hook run on that final hash: the qualified parent retains both, its final 14-check full-App lifecycle covers refresh plus real hooks, and fresh comparison confirms the SourceSync projection/filter bodies remain identical through the lifecycle revision.

Preserved RED: verified cloud metadata replaced the session object, cleared the legitimate worker binding twice and revoked once. lifecycle-refresh-original-failure.json remains FAIL (2 !== 0); the later PASS receipt does not erase it. The fix establishes token-refresh continuity only by authenticated server context/read, matching SID, server session revision, consent and registration receipt. JWT parsing is an untrusted rejection/recheck hint, never Auth authority; fresh accepted credentials supply subsequent authorization. Existing failures/negative responses in synthetic reports remain recorded.

## Remaining device and delivery boundary

This worker performed zero provider, native, pin, SQL, Auth/account, registration, consent, fixture, send or browser operations. No lease or server was acquired and no process was started for a browser/server phase. No cloud.js, backend, schema, routing, startup dependency or Service Worker edit. No push or deployment was performed.

The first actual sender request remains application UNCERTAIN and OS arrival NOT_PROVEN. Existing registration retirement, journals, projections, UNKNOWN and no-replay markers are untouched. The one NEW additional-test authority remains wholly with the original N44 custodian; this child spends none of it.

The sole publisher must integrate/build and verify the actual served source against these three target hashes before the original custodian proceeds with current observer readiness and exact existing authority. This document is LOCAL_READY source evidence only, not a provider receipt, served-source proof, device acceptance or N44 closure.
