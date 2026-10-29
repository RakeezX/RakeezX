# N140 quiet cards, reasons and gradebook participation

AI-authored implementation and local evidence, 2026-10-29.

- Task: `n140-quiet-card-gradebook-20261029`
- Run: `a04a2709-5fff-48d8-b449-c23ec0a6add7`
- Base: `1d9b72ac639ef88034cf3a51e7d8a7e6df312160`
- Authority: activated card, current N140 Product row and PO-20261029-N140-QUIET-CARD-AND-GRADEBOOK.
- Scope: synthetic/local preparation, no real accounts or student writes, no push/deployment or queue changes.

## Implemented

QuickLog cards have exactly three separate buttons: signed positive total, signed negative total, and a curved-arrow Undo. Names and card whitespace do not mutate records. Controls are at least 44px, use stable focus keys, and preserve keyboard focus after persistence. The card has current alphabetical displayNo, name, and one short today/negative note. Stored rollNo and historical numbering are untouched. Default factor 1 is hidden; a nondefault factor says `كل نقطة = N درجة`. Each action still creates one signed one-point log; the existing participation projection supplies totals and gradebook scores.

The shared reason picker retains all existing canonical tag strings, adds neutral reasons (8 participation positives, 8 participation negatives, 8 behavior positives, 9 behavior negatives), and presents a small relevant icon separately from the saved text. General buttons say `رصد عام` / `خصم عام` for participation and explicit positive/negative behavior-log language. Typed reasons receive a `تسجيل السبب` submit label. Behavior remains documentation without grade deductions.

Only gradebook's existing `auto === 'participation'` inline entry uses the shared chips, optional reasons and student-local Undo. Other automatic items have no such controls. The shared command helper uses existing store.addLog and store.patch tombstones, the actual runtime ownership preflight, a student/workspace pending lock, durable add readback and 350ms Undo cooldown. It rechecks workspace identity, teaching/student membership, current day, route, selected kind/item and item eligibility after a reason sheet. It does not set scores or introduce a score model. Mount-time repaints keep reset reason controls in sync when returning between tools.

`sw.js` adds exactly `./src/lib/quicklog-reason-sheet.js` to the existing offline shell. Store, ownership/Sync implementation, score computation and portable log projection are unchanged.

## Actual affected verification

Actual app DOM, handlers, store and source CSS served over `http://127.0.0.1:5143` by task-owned Vite. Existing served-demo readiness and N73/N36 synthetic account helpers reused. Canonical `withIsolatedLocalBrowser` validated the active task/run and created fresh Chromium contexts; external requests and Service Workers were blocked. No credentials, user browser/profile, live service operations or shared live-browser lease were used. Owned browser/context and server closed in their respective finally blocks; test processes exited.

Command:

```powershell
$env:N140_BROWSER_TASK_FILE='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n140-quiet-card-gradebook-20261029.json'
$env:N140_BROWSER_RUN_ID='a04a2709-5fff-48d8-b449-c23ec0a6add7'
node --test tests/n140-quiet-card-gradebook.test.mjs
```

All three subtests passed: 4 Node results including parent, zero skips, exit 0, 22.63 seconds. Product source was unchanged afterward. The third check was then extended for the actual account gradebook entry and rerun alone using `N140_FOCUS=n140_alphabetical_roster_numbers_owner_scoring_and_offline`: PASS, 2 results including parent, zero skips, exit 0, 14.74 seconds. First two successful proofs were reused.

| Required check | Actual evidence |
| --- | --- |
| n140_quiet_card_clickable_signed_totals_and_student_undo | Real +2/−2 and weighted +3/−2 totals; name click creates no event; positive and negative chip click each creates exactly one event and updates its signed total; double Undo tombstones one event without increasing row count. Past-day-only student's Undo disabled. Exactly three nonnested buttons. Actual 320/390 RTL geometry fits, buttons do not overlap and are at least 44px. Enter adds one point and retains focus; Tab reaches minus and Undo. No default factor text. |
| n140_reason_icon_choices_both_kinds_and_gradebook_parity | All four kind/direction sheets show expanded icon-bearing choices and contextual general text; choosing a reason saves canonical text without emoji. Actual gradebook participation shows the same signed totals, saves a negative with old tag `لم يشارك`, and tombstones it through local Undo. Switching selected item while a picker is pending creates no log; other item shows no controls. Gradebook controls, identity and score badge fit 320/390. A stale-day picker creates no log. |
| n140_alphabetical_roster_numbers_owner_scoring_and_offline | Actual card numbers match displayRoster with unchanged saved numbers; all old tag strings retained; every student projection agrees with itemScore; nondefault factor text is explicit. Offline shell contains the shared module exactly once and both views import it. Actual synthetic account QuickLog Undo persists one owner-bound outbox delete. Actual account gradebook adds one durable delta=1 log with projected score=1, queues it under the correct owner, then Undo preserves its tombstone. Scores/items/closed reports unchanged. Stale workspace and forged nonparticipation-auto entry create no log. Missing durable Undo row reports failure and rolls back without queuing a delete. Auth identity mismatch rejects the actual UI action and preserves durable row/outbox. No page errors. |

Additional checks: node --check for quicklog.js, grades.js, shared helper, models.js, sw.js and the test file; git diff --check PASS. No blanket suite/build or Preview.

Earlier local failures retained: the initial UI run found lost button focus after Enter and a reason-toggle mismatch on tool reentry (no reason dialog). The final source repairs lost focus after the pending lock ends and repaints reset mount state; both affected UI checks then passed. During the later third-check-only extension, its harness initially read numbering before the destination DOM was ready; it now awaits the actual card. Its first account assertion also incorrectly expected ownerId on a newly created raw local log; existing addLog does not put that field there. The assertion was corrected to the existing canonical owner-bound outbox contract, with actual durable delta, projected score, unchanged grade/history snapshot, and mismatch rejection verified. No Product guard was weakened and no failed result is represented as an initial pass.

Reuse: [previous weighted-card evidence](N140_WEIGHTED_CARD_UNDO.md) at this task's base preserves unchanged scoring/null-versus-zero, compatible transfer/deduplication and current-kind/current-day selector proofs. New affected UI and shared command paths were exercised above. Offline evidence here is shell dependency integrity, not Service Worker or remote Sync certification; those phases were not run. Production publication/served-asset verification remains NOT_RUN by this worker and belongs to the independent controller/publisher.

## Unactivated design note

The requested future quiet 34–36px class-hub entry remains a separate, unactivated design slice after N44, with support-button collision avoidance. No teaching-hub.js, app.js or N44/N88 source was edited. This candidate does not claim Production delivery, PO acceptance or N140 CLOSED.
