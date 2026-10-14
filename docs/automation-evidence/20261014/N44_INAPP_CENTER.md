# N44 in-app center — locally verified bounded slice

Task: `continuous-n44-live-inapp-center-20261014`

Current run: `1e17c449-0207-46e1-8e56-baa2b7d99280`

Preserved implementation candidate: `a3072e44faf0332b3d50a11ec55d1168ca978c71`

Prior blocked run: `a68107da-12e1-4d90-a67a-b1afddecfcf3`

Base: `4ef8d86d51427553a320fa0126e77505a2d985a9`

The candidate adds a bell in the actual app topbar and uses its existing accessible sheet. Sources are current dated sessions (current or starting within 30 minutes) and active dated score subitems due today or within two days, after their optional start date. It uses the teaching's live term/year and existing session eligibility and subitem date rules rather than the selected historical calendar. It performs no Product database writes or external delivery. Push/closed-app reminders and admin publishing remain uncompleted N44 scope.

The preserved prototype receipt at `artifacts/ops-supervisor-v4/results/v5-n44-demo-current-main-20261012.json` was verified against all ten SHA256 sourceManifest entries before copying/adapting its reducer, renderer and CSS. No old app branch was promoted. These three files changed for account integration, so their old pure model/UI evidence is not reused as a PASS.

The adapter requires the current claimed account workspace, ready store, matching memory/persisted auth identity, existing runtime ownership guard, exact database and device. Explicit foreign record ownership is rejected; legacy/local records without ownership metadata are considered only inside that verified mounted account DB. Demo/unresolved accounts have no account bell or synthetic feed. Events stay ephemeral; bounded preferences (at most 100 event IDs plus read/dismiss timestamps, seven-day retention) use an owner/database/device namespace. Storage failure is nonblocking. Deactivation/auth mismatch clears the sheet and badge synchronously. Navigation is constructed internally and re-derived against current undeleted children/parents at click time. Sync severity and read-only/account protection banners are unchanged.

## Preserved verification from the implementation run

- `node --test tests/n44-inapp.test.mjs`: 5/5 PASS using real store, fake IndexedDB, registered disposable accounts and the actual runtime ownership guard. Covers stale selected calendar, historical/foreign/cancelled/past events, source-year holiday, current/start/end timing, closed term, unknown/mismatched auth/guard/storage, read/dismiss/dedup/expiry, backward clock adjustment, bounded preferences, storage failure, deleted parent/child and direct-mode item, internal destination and unchanged outbox.
- JavaScript syntax checks and `git diff --check`: PASS.
- `node --test tests/offline-route-graph.test.mjs`: PASS startup dependency graph check; this is source coverage, not rendered offline proof.
- New source JS/view/CSS dependencies are listed in `sw.js`, with cache generation advanced from 57 to 58.
- `tests/n44-browser.mjs` is prepared to exercise actual served app DOM/handlers/CSS at 320/390/1280, keyboard focus, registered synthetic account boot, escaped names, read/dismiss/reload/resume, deleted target, owner switch/logout synchronous clearing, expiry and real SW/offline reload. **NOT_RUN**: both browser-phase reservations returned `BUSY browser; the recorded owner must finish or be factually recovered` (exit 3). No application browser assertion, screenshot, Service Worker or rendered UI PASS is claimed.

## Historical blocker and resource disposition

The read-only lease snapshot records owner task `continuous-n58-fresh-live-20261012`, worker PID `5880`, birth `2026-10-14T00:23:59.5571150Z`, token `73f9352c-cac2-4636-be78-b71c6a17a143`, lease timestamp `2026-10-14T00:33:25.9184032Z`. This worker does not own or remove that lease. Its earlier preliminary acquire was released immediately (`ACQUIRED browser` / `RELEASED browser`); no browser/server was started. The two subsequent busy responses exhausted the unchanged-blocker retry rule. The prepared browser harness acquires before starting any server/browser and releases owned resources in finally.

Result: **BLOCKED**, with implementation and local model/store evidence preserved in an AI-identified candidate commit. The affected rendered-UI/account-entry and offline acceptance gates remain unrun. Resume this exact candidate/session only after the current owner releases the shared browser lease (or the controller records factual owner recovery), then run `node tests/n44-browser.mjs` and correct any observed failures. No queue/status, main, provider, service, live accounts or Production changes were made. No integration/deployment/PO acceptance is claimed.

## Resumed actual application proof — current run

The approved maintenance recovery recorded that the N58 worker was inactive and the browser lease absent. On resumption, the candidate and clean worktree matched the saved commit; the resource script reported `FREE`. Only the remaining affected browser checks were run. Product source, CSS and `sw.js` stayed byte-identical to the preserved implementation candidate. The existing 5/5 store/model and offline dependency graph proofs were reused.

`N44_RUN_ID=1e17c449-0207-46e1-8e56-baa2b7d99280 node tests/n44-browser.mjs`: **4/4 required checks PASS** on the actual unbundled application at owned loopback HTTP origins. Evidence: `tests/n44-ui-evidence/result.json`, runtime source hashes in `tests/n44-ui-evidence/source-manifest.json`, and five settled-animation screenshots in that directory.

- `n44_actual_account_event_generation`: actual registered synthetic account boot and existing ownership guard, correct three-event list at 320/390/1280, escaped markup with no injected elements, applied source CSS, no horizontal overflow, keyboard close/focus return. Demo has no account bell; selected historical holiday does not suppress the real current-year lesson.
- `n44_owner_read_dismiss_expiry`: actual handlers and reload/resume keep read/dismiss preferences without duplicate unread inflation; actual end-time/day expiry and quiet empty state. Account B starts with independent unread state. Existing unit proof covers bounded preference retention, backward clock adjustment and storage errors.
- `n44_safe_navigation_no_sensitive_leak`: stale deleted-child DOM cannot navigate; internal lesson action opens the exact session. Negative foreign-owner runtime guard removes the center/bell through the actual account entry. Owner deactivation/logout clears rendered private content synchronously. Preference rows contain only IDs/timestamps; outbox remains unchanged; LIMITED read-only banner remains visible.
- `n44_real_ui_offline_boot`: the real Service Worker precached all five new JS/view/CSS dependencies; with browser network offline, the actual app reloads and opens the center with source stylesheet applied. Owner/database/provisioning receipt and session targets were obtained together from the same reloaded document checkpoint.

The first checkpoint failure is preserved in `first-checkpoint-failure.json`. The harness now imports the store into a test-only document reference then synchronously polls and returns the complete identity/receipt/data snapshot from that successful checkpoint, rather than treating a pending async predicate or prior readiness as permission for a later read. The owner-preparation failure is preserved in `owner-preparation-failure.json`: fixture B had been mounted beside pending reads from A; the harness now disposes the old document and prepares fixtures in a non-app same-origin document before the real account reload, without weakening guards. The expiry expectation failure is preserved in `expiry-expectation-failure.json`: October 17 still had a valid due item, so the empty-state checkpoint was moved past the last actual deadline. Screenshot capture finishes shell animations to avoid presenting a partially transparent transition as final layout.

All browsers/contexts and the owned loopback server closed in finally. Every acquired phase lease was released; final saved receipt says `RELEASED browser`, and the resource status reports `FREE`. External requests were blocked by the synthetic harness, no page errors were recorded, and no live identities/service/provider operations occurred.

Current result: **LOCAL_READY** for this bounded in-app slice. The original candidate remains preserved; the follow-up AI commit adds only corrected harness and evidence. No push, integration, Production verification or Product/PO acceptance is claimed. N44 stays open for Push and admin publishing.
