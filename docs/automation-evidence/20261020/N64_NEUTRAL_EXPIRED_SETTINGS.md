# N64 — neutral settings after request expiry

Task: `continuous-n64-expired-request-neutral-settings-20261020`  
Run: `0b5a8eae-c3fe-442b-814a-797d2687dfb8`  
Base and freshly fetched origin/main: `4e70f0a3550910db58cfac0436c8d06303177de9`.

Latest PO 20 October 15:22 feedback rejects the persistent expired-request reminder. The application diff removes exactly that single rendered branch in `src/views/settings.js`. An expired request now shows the current email and existing change action without a replacement hint, page or toast. The pending, verified-success and unknown-timestamp branches are unchanged, as are lifecycle timing, request submission, failure handling, owner checks and provider metadata.

## Verification

`node tests/n64-neutral-expired-20261020/ui.mjs` — PASS. Existing `bootSettings` fixture exercises the actual account workspace/store, settings DOM/handlers and source CSS over task-owned loopback HTTP port 19965, using the canonical isolated browser helper and a fresh synthetic context. After reload with a 901-second-old provider timestamp, current email and change action remain visible, while pending instructions, expiry reminder and success are absent. The same actual view preserves nonexpired pending guidance and announces success only after the existing owner-verified GET returns the requested email. No Auth mutation requests or page errors occurred. See `tests/n64-neutral-expired-20261020/result.json` and visually inspected `neutral.png`.

`node --check src/views/settings.js`, `node --check tests/n64-neutral-expired-20261020/ui.mjs`, and `git diff --check` — PASS.

Reuse `tests/n64-expiry-20261020/result.json` for unchanged expiry boundary/timer, view-local pending/new request, owner isolation and failed-read logic. The one-line diff does not alter those mechanisms; the previous suite was not rerun. Existing synthetic Sync warnings and blocked Service Worker registration are outside this presentation check and are not Sync/offline acceptance claims.

Owned browser, contexts and server closed through their `finally` cleanup. No real account/student mutation, email send, Auth configuration, SQL, provider cancellation, deployment or push occurred. Provider pending metadata is preserved; its deletion is not claimed.

Local correction is ready for the sole publisher. Prior user-accepted successful email change remains accepted. After verified publication, this correction is ready for the authorized accepted-closure recording; this worker does not assert publication, Product closure or a newly tested live account journey.
