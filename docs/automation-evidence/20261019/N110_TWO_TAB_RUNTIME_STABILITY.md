# N110 — two-tab runtime stability

AI implementation, 2026-10-19. Task `continuous-n110-two-tab-runtime-stability-20261019`, run `6463f4ca-f30b-41b2-8301-4ad7197a784e`.

Base: `81b892cc81a6622c05fcc291e9d7cfa00611245b` (HEAD, origin/main and remote main agreed at inspection).

## Cause and bounded correction

The notification presentation storage listener scheduled a full paint for **every** storage event. Rendering calls `getOfflineLeaseStatus()`, whose existing guard persists a per-runtime high-water clock witness. A peer tab painted in response to that witness, writing its own witness back. This generated a feedback storm without a Product edit. Notification clock updates were already filtered, but offline lease witnesses and unrelated coordination keys were not.

`src/app.js` now limits that notification listener to account/notification storage changes. The separate lease receipt/account listener still processes renewal and owner changes. Push refresh ignores clock witnesses as well. Clock persistence, fresh write-boundary lease checks, rollback checks, periodic lease presentation, ownership guards, Sync leadership and all Product storage implementations are unchanged. No startup dependency or offline shell change.

## Actual app evidence

`node tests/n110-1019-two-tab.mjs --baseline` serves the base app source; `node tests/n110-1019-two-tab.mjs` serves the corrected source. Both use the canonical isolated-local-browser helper, a fresh disposable context, two same-origin pages sharing actual IndexedDB/localStorage, source DOM/handlers/CSS and a task-owned ephemeral loopback HTTP server. Only service transport is pointed at a synthetic loopback endpoint and paint calls are counted. No user browser, profile, real service, service worker or shared live-browser phase is used. The helper closes contexts/browser; server closes in finally.

- Base reproduction: 306 and 305 additional paints/clock events per tab over one second; see `tests/n110-1019-baseline.json`.
- Corrected: 3/2 initial paints and zero additional paints or clock events in the idle window; see `tests/n110-1019-browser.json`.
- Actual store `patchDevice` propagated through the workspace BroadcastChannel and peer absorb handler. An interactive settings disclosure retained its state during repeated peer lease observations; source layout CSS computed to grid. A real notification category preference change still repainted its peer.
- Existing `browserRemoteLeadership` used actual shared browser Web Locks: one callback acquired leadership; its waiting peer acquired only after release. This is a local coordination check, not remote service/Sync certification.
- Guarded lease renewal was processed by the peer and settled. Same-document owner/database/restore-receipt checkpoints agreed. Student identity, grade, session history, a tombstone and ten actual app-generated pending owner-bound bootstrap commands compared deeply equal before/after. Wrong-owner commands were rejected by the real runtime ownership guard.
- Synthetic Sync service returned 503 without any successful ACK. Summary remained `error`, pending count 10, cloudSyncHealthy false, lastSuccessfulSyncAt null.
- Peer Auth removal retained the existing deactivation path: private account UI disappeared and login returned after exactly one reload, with no continuing reload loop.
- No page errors. `node --check src/app.js` and `node --check tests/n110-1019-two-tab.mjs` passed. No full build or unrelated suite was needed.

The first baseline harness asserted only a late idle window; a burst of 155/147 paints had already occurred before that window and the assertion failed. Its original result is preserved as `tests/n110-1019-initial-window.json`. The measurement was corrected to include second-tab boot, then base reproduction and the final corrected app passed. This was a harness observation-window correction, not suppression of a Product failure.

## Delivery boundary

Local candidate only. No push, deployment, provider check, real mutation, queue/status/ledger change or PO acceptance. The independent controller/publisher owns integration and Production evidence.
