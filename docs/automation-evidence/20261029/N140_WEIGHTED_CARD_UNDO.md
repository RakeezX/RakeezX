# N140 weighted points and card-local Undo

AI-authored implementation and evidence, 2026-10-29.

- Task: `n140-weighted-card-undo-20261029`
- Run: `75a08539-9f69-4367-97a7-fc1aa67b451c`
- Base: `aaae8f43e34f9da80b1537e4e44b5f22e86dbaa4`
- Authority: activated card and PO-20261029-N140-SCREENSHOT-FIX; local synthetic preparation only.

## Result

The mismatch came from counting event rows in QuickLog while the grade projection sums signed point deltas and may include compatible transferred participation. QuickLog now reads the current `store.teachingContext` and a shared pure model presentation projection. The displayed participation item is the first automatic participation item in the existing ordered items, explicitly named on each card with its factor, computed score and maximum. Its positive/negative totals use the same `automaticByItem` log scope as `itemScore`. Ambiguous transfer configuration displays unknown totals and score, preserving null versus zero. Behavior points remain separate documentation only. Day activity filters and Undo use only the current teaching/kind/day, even when grade totals include compatible carry-forward records.

Global Undo is removed. Each card has an accessible 16px Undo icon in its own 32×36px button beside point totals. It targets only that roster student's latest nonzero current-day record for the selected kind/current teaching. The existing `store.patch('logs', id, { deleted: true })` path preserves the synchronized tombstone. Success waits for persistence; null/throw failures report failure. A per-student pending lock and 350ms cooldown prevent repeated deletion from double taps, including fast local commits. Empty actions are quietly disabled. Name spacing clears the existing minus control at narrow RTL widths.

`itemScore`, `portableAutomaticByItem`, store mutations, owner/lease safeguards and Sync code are unchanged. No grades, history or real account data were edited. No new backend operation or startup dependency was introduced.

## Affected verification

Command (active task/run environment required):

```powershell
$env:N140_BROWSER_TASK_FILE='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n140-weighted-card-undo-20261029.json'
$env:N140_BROWSER_RUN_ID='75a08539-9f69-4367-97a7-fc1aa67b451c'
node --test tests/n140-weighted-card-undo.test.mjs
```

Final result: all three focused subtests PASS (four Node test results including the parent; no skipped checks, exit 0, 15.09 seconds). Actual application DOM, handlers, model/store modules and source CSS served by task-owned Vite at `http://127.0.0.1:5141`, using the canonical isolated local browser helper and fresh synthetic context. Existing served-demo and synthetic account/provisioning helpers reused. External requests and Service Workers blocked; no credentials or personal profiles. Browser/context cleaned by helper finally; server closed in test finally. This eligible isolated phase does not reserve the shared live-browser lease.

| Required check | Actual proof |
| --- | --- |
| `n140_weighted_points_match_participation_item_for_same_eligible_logs` | Four one-point records render +2/−2 and grade 0; four mixed-weight records render +3/−2 and grade 1. Factor 2 visibly yields grade 2. Compatible transfer included once; duplicated ID, deleted and unlinked cross-teaching records excluded. Representative current roster agrees with actual `itemScore`; no-participation null differs from observed zero. Transfer factor conflict renders unknown, then compatible restoration restores totals. Actual 320/390 RTL geometry fits with identity clear of minus/Undo controls. |
| `n140_student_card_undo_only_own_latest_event_no_compensating_log` | Real IndexedDB transaction held while two handler calls run: exactly one matching minus is tombstoned, all other rows unchanged, row count unchanged. Actual card double-click undoes only one next minus; plus and selected behavior also undo correctly. Other student, prior teaching, deleted and past-day rows never win. Past-day-only and empty actions disabled. Behavior remains separate. |
| `n140_preserve_owner_scoring_history_and_sync_tombstone` | Actual protected synthetic account UI/store entry commits one durable owner-bound logs delete in outbox and retains the deleted log row. Scores/items/closed reports unchanged. Missing durable row returns null, reports failure, rolls back memory and permits retry without an outbox entry. Real account identity mismatch rejects the same action, reports failure and preserves durable row/outbox. No page errors. This checks local enqueue/ownership, not remote delivery certification. |

Additional scoped checks: `node --check src/views/quicklog.js`, `node --check src/models.js`, and `git diff --check` PASS. No blanket build/suite or Preview performed.

During focused geometry refinement, the stricter name-versus-minus check initially failed at 320px: the name began 2px above the minus control's bottom. The final 16px name margin corrected that overlap; final actual-DOM checks pass at both widths. This original local failure is retained here rather than recast as an initial pass.

## Delivery boundary

Local candidate only; no push, deploy, queue/status edit or live data mutation. The independent publisher owns integration, served-asset/Production evidence and overlap checks. Owner acceptance and real-pupil verification remain separate; N140 is not claimed CLOSED. `src/views/teaching-hub.js` and N44/N88 sources were not edited. The requested tiny floating class-hub entry remains a separate dependent UX follow-up after N44: icon-only, without colliding with the support button.
