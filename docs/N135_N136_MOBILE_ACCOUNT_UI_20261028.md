# N135/N136 — Mobile class identity and repeated account messages
28 October 2026 — isolated Preview candidate, not a Production deploy.

## N135 — Class title vs status badge (reproduced)
A narrow two-column class card shrinks the compact name to "خام..." when the status chip "رُصد" or "حصة اليوم" consumes the first row. Baseline Chromium test failed at width 320px on the marked class. A CSS-only, screen-only rule at <=520px gives the class identity a full first row and a separate small second row for its badge. No attendance or grade derivation changes, and the full stored name/title/ARIA remains untouched.

**Evidence:** tests/n135-class-badge-layout.e2e.mjs passes with 3 synthetic fixtures (fully marked, today's unmarked lesson, no badge) at widths 320,360,390,430,520,768; no title clipping or horizontal document overflow. Image test-results/n135-class-badge-320.png. Existing n133 label tests 3/3 pass.

## N136 — Repeated sign-in/lease/class warnings (separate from N130)
The 27 October 00:22 screenshot shows overlapping sync authentication strip, offline lease sign-in notice, and class-scoped verification feedback, leaving the teacher with a blocked class but no direct login action in the class message.
- Added pure presentation dedupe policy for this exact overlap, and reused it for initial rendering and subsequent sync status repaint. Suppress the sync strip only if the class feedback already displays verification and the Sync state is auth_required; never suppress errors, blocked/rejected records or other notices.
- When the class-scoped verification message already explains a logged-out account, suppress a second offline lease sign-in card. The class message now includes a direct button opening the **existing login sheet** and an unchanged link back to Classes.
- **Identity/ownership, offline lease, Sync, score, database, server and Auth remain completely unchanged**. A class still stays blocked when its account cannot be safely verified; this is not a bypass or fix for unexpected account expiry. Production owner/lease investigation is a separate remaining task if authentication continues failing after login.

Evidence: tests/n136-auth-notice-policy.test.mjs PASS for auth vs genuine Sync errors and unrelated routes. tests/n136-class-login-action.e2e.mjs PASS in fake Demo-only missing-class guarded path opening existing login sheet. This does NOT reproduce the actual account state; real account test remains necessary. Screenshot date predates the verified N130 supersession warning correction by about 20 hours.

## Checks
- 5/5 Chromium E2E tests (3 pre-existing N133 + N135 + N136), 10/10 targeted Node unit checks, Vite build PASS.
- Read-only synthetic data only, outside official N44/N88 runtime and their working branches.
- No automatic Production authorization or claim. Deliver through one original controller/publisher and verify current served assets and actual 320px visuals.
