# N44 in-app center — saved candidate, browser phase blocked

Task: `continuous-n44-live-inapp-center-20261014`

Run: `a68107da-12e1-4d90-a67a-b1afddecfcf3`

Base: `4ef8d86d51427553a320fa0126e77505a2d985a9`

The candidate adds a bell in the actual app topbar and uses its existing accessible sheet. Sources are current dated sessions (current or starting within 30 minutes) and active dated score subitems due today or within two days, after their optional start date. It uses the teaching's live term/year and existing session eligibility and subitem date rules rather than the selected historical calendar. It performs no Product database writes or external delivery. Push/closed-app reminders and admin publishing remain uncompleted N44 scope.

The preserved prototype receipt at `artifacts/ops-supervisor-v4/results/v5-n44-demo-current-main-20261012.json` was verified against all ten SHA256 sourceManifest entries before copying/adapting its reducer, renderer and CSS. No old app branch was promoted. These three files changed for account integration, so their old pure model/UI evidence is not reused as a PASS.

The adapter requires the current claimed account workspace, ready store, matching memory/persisted auth identity, existing runtime ownership guard, exact database and device. Explicit foreign record ownership is rejected; legacy/local records without ownership metadata are considered only inside that verified mounted account DB. Demo/unresolved accounts have no account bell or synthetic feed. Events stay ephemeral; bounded preferences (at most 100 event IDs plus read/dismiss timestamps, seven-day retention) use an owner/database/device namespace. Storage failure is nonblocking. Deactivation/auth mismatch clears the sheet and badge synchronously. Navigation is constructed internally and re-derived against current undeleted children/parents at click time. Sync severity and read-only/account protection banners are unchanged.

## Actual verification

- `node --test tests/n44-inapp.test.mjs`: 5/5 PASS using real store, fake IndexedDB, registered disposable accounts and the actual runtime ownership guard. Covers stale selected calendar, historical/foreign/cancelled/past events, source-year holiday, current/start/end timing, closed term, unknown/mismatched auth/guard/storage, read/dismiss/dedup/expiry, backward clock adjustment, bounded preferences, storage failure, deleted parent/child and direct-mode item, internal destination and unchanged outbox.
- JavaScript syntax checks and `git diff --check`: PASS.
- `node --test tests/offline-route-graph.test.mjs`: PASS startup dependency graph check; this is source coverage, not rendered offline proof.
- New source JS/view/CSS dependencies are listed in `sw.js`, with cache generation advanced from 57 to 58.
- `tests/n44-browser.mjs` is prepared to exercise actual served app DOM/handlers/CSS at 320/390/1280, keyboard focus, registered synthetic account boot, escaped names, read/dismiss/reload/resume, deleted target, owner switch/logout synchronous clearing, expiry and real SW/offline reload. **NOT_RUN**: both browser-phase reservations returned `BUSY browser; the recorded owner must finish or be factually recovered` (exit 3). No application browser assertion, screenshot, Service Worker or rendered UI PASS is claimed.

## Concrete blocker and resource disposition

The read-only lease snapshot records owner task `continuous-n58-fresh-live-20261012`, worker PID `5880`, birth `2026-10-14T00:23:59.5571150Z`, token `73f9352c-cac2-4636-be78-b71c6a17a143`, lease timestamp `2026-10-14T00:33:25.9184032Z`. This worker does not own or remove that lease. Its earlier preliminary acquire was released immediately (`ACQUIRED browser` / `RELEASED browser`); no browser/server was started. The two subsequent busy responses exhausted the unchanged-blocker retry rule. The prepared browser harness acquires before starting any server/browser and releases owned resources in finally.

Result: **BLOCKED**, with implementation and local model/store evidence preserved in an AI-identified candidate commit. The affected rendered-UI/account-entry and offline acceptance gates remain unrun. Resume this exact candidate/session only after the current owner releases the shared browser lease (or the controller records factual owner recovery), then run `node tests/n44-browser.mjs` and correct any observed failures. No queue/status, main, provider, service, live accounts or Production changes were made. No integration/deployment/PO acceptance is claimed.
