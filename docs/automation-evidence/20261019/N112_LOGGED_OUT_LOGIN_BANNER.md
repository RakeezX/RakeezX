# N112 — signed-out account banner

AI implementation, 2026-10-19. Task `continuous-n112-logged-out-login-banner-20261019`, run `f6c1b1a8-5116-4eb6-9aee-8443038ea4db`.
Base: `80d7a264596cb38c1856796c0c30c23dbbb6b49f` (HEAD and observed origin/main at start).

The account lease banner now offers «تسجيل الدخول» through the existing Teacher Hub OTP login action when Auth has no session/user or requires authentication. A transition to the workspace's authenticated owner triggers the existing guarded lease renewal. Successful identity/workspace verification repaints and clears the warning automatically. Failed verification retains the warning; an authenticated offline account retains the existing connection/lease presentation. No data, Sync, ownership or lease guard was changed.

## Affected verification

- `node --check src/app.js` — PASS.
- `node tests/n112-1019-login-banner.mjs --baseline` — PASS reproduction: the base application shows «التحقق من الحساب» after synthetic `/user` rejects the session. Saved in `tests/n112-1019-baseline.json`.
- `node tests/n112-1019-login-banner.mjs` — PASS: actual application DOM, CSS, delegated login action, OTP controller, Auth persistence/notifications, restored registry and identity/workspace/lease verification. Rejected OTP keeps the warning; successful OTP plus `/user` verification clears it without refresh or another button. Saved in `tests/n112-1019-browser.json`.
- Same scenario — PASS offline distinction: network failure preserves the authenticated owner and editable eight-day REMINDER with the existing verification action, without a login prompt.
- Exact before/after snapshots of workspace and IndexedDB students, scores, pending outbox, sessions and device receipt remain equal across both scenarios. The pending row is not acknowledged or removed. Post-reload owner, database and restore receipt were checked together in the current document. No page errors.
- Visual inspection — PASS at 390×844: `tests/fixtures/n112-1019/signed-out.png` and `offline-verified.png` show readable, contained banners and the correct actions.
- `git diff --check` — PASS.

The test uses the canonical `withIsolatedLocalBrowser` with a fresh disposable context, blocked Service Workers/external requests and a task-owned loopback server on an OS-assigned unique port. Only the served cloud transport base is replaced with the local synthetic endpoint; Product source handlers and guards execute. Browser/context and server are closed in their owning finally blocks. No shared live-browser phase, real account/service call, credentials, live mutation, push or deployment was used. These are local synthetic proofs; controller publication and Production evidence remain outstanding.
