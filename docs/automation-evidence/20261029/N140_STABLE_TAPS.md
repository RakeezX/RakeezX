# N140 — cancellation and tap stability

AI-authored implementation/evidence. Task `n140-stable-taps-1029`, run `f6844aa1-82b5-4bd4-b3d0-1fe386b1380c`.
Base: `d684828e76b17dc576bc956f7e14f5a4f1772a23`. Local candidate only; no push, deployment, real-account access or real-student writes.

## Diagnosis and bounded repair

The original application reproduced a disabled positive chip after participation / positive / X cancellation. The pending Set was cleared, but the live button remained disabled when the renderer's cached markup comparison skipped replacement. The original pending gate also rejected subsequent deliberate clicks during persistence. Changed page markup from store notifications can replace a pointer's target before its click.

The shared point helper now restores all mounted controls for the student explicitly, without repainting on a no-change cancellation. Reason/Undo locks remain exclusive; ordinary point presses enter a per-student promise chain with immediate saving feedback and real IndexedDB readback. Cancelling a picker behind another save unlocks immediately while retaining its queue link until the preceding save drains. Undo retains its existing double-Undo protection and tombstone command. Existing workspace/owner/day/teaching/student/item checks are retained and rechecked before queued commands commit.

Only QuickLog and grades opt into a small presentation wrapper that keeps their previous template between primary pointerdown and click, then requests the deferred paint. It does not modify the global renderer, store, Sync or backend. Workspace/route changes invalidate that cached presentation; existing application ownership/session/academic context invalidation still takes precedence.

CSS reserves note, name, signed-chip and saving-status space, removes pressed-button translation, and makes the behavior tab intrinsically sized and nonwrapping. Existing reasons and their ordered icons remain; three behavior reasons are appended: النوم أثناء الحصة 😴, مغادرة المكان دون إذن 🚪, استخدام الجهاز لغير الدرس 📱. Behavior remains documentation-only.

## Affected verification

Command: `node --test tests/n140-stable-taps-1029.test.mjs`, with `N140_BROWSER_TASK_FILE` pointing to the canonical activated card and `N140_BROWSER_RUN_ID` set to this run. `N140_FOCUS` selects one named affected check for subsequent material refinements.

Tests use actual app DOM, delegated handlers, store/model modules, IndexedDB and source CSS served by owned Vite at `http://127.0.0.1:5147`. They reuse `openReadyServedDemo`, the existing synthetic account/service fixtures and canonical `withIsolatedLocalBrowser`. Fresh disposable Chromium contexts, loopback-only requests and blocked Service Workers; no personal profiles/credentials or real cloud calls. Helper finally closes owned browser contexts/browser; test finally closes the owned server. This eligible isolated phase requires no shared live-browser reservation.

All three checks passed together (4 Node results, zero failures/skips, 30.68 seconds). Subsequent changed scenarios were verified with focused checks, reusing unaffected evidence:

| Required check | Actual evidence |
| --- | --- |
| `n140_cancel_reason_sheet_unlocks_each_student_and_gradebook` | PASS: final focused run, 2 results including parent, zero skips, 24.20s. 24 combinations: Escape/X/backdrop/إلغاء × positive/negative × participation/behavior/gradebook, alternating students. Cancellation writes nothing; first next single tap and reason choice writes exactly one durable row. Includes material background update while a sheet is open and stale original-day control rejection. |
| `n140_repeated_taps_during_repaint_save_and_sync_reliably_commit` | PASS: focused expanded run, 2 results, zero skips, 27.58s. Six real mouse presses per surface while another student's materially changed projection is saved/notified/repainted mid-press; held DOM node remains connected, saving feedback appears, six durable rows retain exact sign order, student, teaching, kind and day. Actual readonly confirmation is delayed 120ms without altering write transactions. Also tests cancel behind a save then one new reason choice (two additional durable rows per surface). A separate fresh synthetic current-owner account exercises gradebook cancellation and double tap, two durable rows and two owner-bound outbox commands, and rejects a stale-workspace UI entry. |
| `n140_stable_cards_one_line_behavior_and_useful_reasons` | PASS: final focused layout run, 2 results, zero skips, 21.45s. At 320/360/390px, tab text has one rendered line and fits without document overflow; card/name/note/44px touch targets remain inside each card, and all card/control rectangles stay identical across negative recording. Existing nine negative behavior reasons remain in order; three unique additions have rendered matching icons. |

The final day-guard refinement restored the original element-attribute checks; its negative and cancellation paths were checked by the final first-check run. Positive queue and geometry evidence was reused. Existing N140 grade projection, owner mismatch, lease/offline, historical tag and tombstone proofs in `N140_QUIET_CARD_GRADEBOOK.md` / `N140_WEIGHTED_CARD_UNDO.md` remain applicable; these engines were not changed.

Final syntax checks: `node --check` for the shared helper, QuickLog, grades, models and new test: PASS. `git diff --check`: PASS. No blanket build/suite or repeated Preview.

Failures retained: original X cancellation failure above; an early delay harness incorrectly delayed readwrite IndexedDB callbacks and produced transaction-finished errors, so that run is not Product evidence. The corrected harness delays readonly confirmation only. Early coordinate reads used a locator's already-detached element (zero rectangle), causing a press on the header; current measurements query the live document synchronously before real pointer actions. A day-negative harness initially modified the replacement button rather than the command's original opener; it now captures the actual click opener before changing its day. No guard was disabled or failure relabelled PASS.

## Reused publication identity and delivery boundary

Read-only inspection of the predecessor card's `deliveryReceipt` confirms published SHA `794a77ae5f573a9e41c7a50d40e8b83af17294fc`, provider check `123367459180` with matching head and success, deployment `2f561a98-20c8-4b4e-b57c-cf1e694171c2`, immutable origin `https://2f561a98.rakeezx.pages.dev`, and Production verification at `2026-10-29T09:31:07.274Z`. Both recorded immutable/Production asset sets have passed/verified flags. Git comparison confirms the five affected Product files are identical between that published revision and this task's declared base. This reuses the publisher's prior receipt; it is not a fresh worker deployment claim.

This candidate's integration, provider checks, served-asset/Production verification: NOT_RUN, owned by the independent controller/publisher. PO real-device acceptance remains separate. No queue/status files or unrelated Product paths changed; no new startup dependency or service operation.
