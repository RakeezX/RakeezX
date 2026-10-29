# N144 — individual attendance tap reliability (AI-authored)

- Task: `n144-attendance-tap-1029`
- Run: `ec72dfd5-8dff-4843-8bc9-f35b77214513`
- Base: `d684828e76b17dc576bc956f7e14f5a4f1772a23`
- Authority: activated N144 card, PO-20261029-N144-ATTENDANCE-TAP and current canonical Product Ledger row. Clean starting worktree. Candidate commit is returned in the runner result.

## Observed causes and bounded repair

The baseline test serves the immutable base attendance module in the actual mounted application. A native pointerdown on a visible attendance button, followed by changed-markup notification and pointerup at the same location, leaves attendance unrecorded. The old button was replaced between the events; the delegated click did not reach the old status action. Three deliberate clicks while the first store call is delayed also enter `setAttendance` three times, without pending row acknowledgement. This demonstrates lost click delivery and duplicate concurrent entry; it does **not** establish a cloud data-loss cause or prove that the native transactions commit out of order.

The candidate changes only `src/views/attendance.js`:

- Mount-owned pointer listeners retain the original student/status intent until pointerup and require the same visible choice, unchanged workspace/visit/session/date/teaching, primary pointer and bounded movement. Drag/cancel does not record attendance. The paired native click is consumed once, avoiding a second write. Keyboard/assistive click uses the same intent validation. AbortController removes these listeners on unmount.
- Per-student/session writes serialize only the latest deliberate choice. Duplicate pending choices do not create extra writes. A context change discards the unsent choice and explicitly reports that disposition; returning to the original session cannot revive it. An already-entered write retains its original session argument.
- The row displays pending/latest-choice feedback and `aria-busy`. Selection remains based on actual store records. Success requires the existing awaited store result and matching readback; null, storage rejection or owner/lease rejection shows failure and retires the queued chain without automatic retry. Stable focus keys preserve keyboard focus through repaint. “Saved” means local persistence, not cloud acknowledgement.

The original store, owner/lease checks, attendance identities, roster snapshots, status labels, scores, Sync implementation and global app renderer are unchanged. No absence is generated automatically. N141 bulk functions/markup and prestart confirmation remain unchanged.

## Affected verification

`node --test tests/n144-attendance-tap-1029.test.mjs`: **PASS**, five TAP tests including the parent, zero failures/skips. Actual app DOM, handlers, source CSS and native IndexedDB over owned `http://127.0.0.1:53144`, using `openReadyServedDemo` and canonical `withIsolatedLocalBrowser`. Fresh disposable Chromium context, Arabic locale/Riyadh timezone, touch enabled, 320/390px widths. The fixture only delays entry into the real store; it does not replace its write or ownership logic. Repaint churn uses `refreshSyncedState`, the actual post-reconciliation notification path, after synthetic local fixture changes. No remote Sync operation is performed.

| Check | Actual evidence |
| --- | --- |
| `n144_single_tap_present_absent_late_excused_durable_feedback` | One touch per status shows pending, then actual selected status and saved feedback. Memory and IndexedDB agree; reload retains selection. 320/390px targets are at least 40×40px and inside viewport. Enter preserves focus through pending/saved repaint. |
| `n144_attendance_sync_repaint_rapid_choice_session_owner_fence` | The old button is confirmed disconnected during pointerdown/pointerup churn; one release now persists the intended status. A drag away/back does not change it. Pending present/present/absent/excused produces exactly present then excused store entries; the final disk state is excused. |
| `n144_no_status_overwrite_from_stale_session_or_discarded_click` | Detached old-session and old-date controls cannot write. Switching away and back while present/absent waits commits only the entered present to its original session; no write reaches the other session, and discarded-choice feedback is visible. An actual IndexedDB transaction rejection returns null through the real store and shows row failure without changing selection. Workspace loss retires the pending chain. |
| Actual account entry/owner guard | Reuses `n73-account-flow-fixture.mjs` with loopback-only fixture responses. The real mounted account attendance entry saves into its owner-bound database and creates an owner-bound `attendance:record` outbox command. Replacing mock auth with a different synthetic owner while a choice waits invokes the existing native account/lease guard: row failure, one entered call, and attendance/outbox deeply unchanged. No guard is disabled. |

`N144_BASELINE=1 node --test tests/n144-attendance-tap-1029.test.mjs` (PowerShell environment assignment): baseline reproduction mode, loading attendance from the immutable base via Git; asserts zero records after the interrupted tap and three store entries for the pending repeated/changed clicks.

`node --check src/views/attendance.js` and `git diff --check`: **PASS**.

The harness was corrected during development: the initial manual pointer location intersected mobile navigation; centering the actual button and checking its hit target fixed that test defect. Demo initialization now preserves its session marker across reload instead of reseeding the fixture. Reopening explicitly navigates away/back because navigating to the unchanged hash did not remount a manually switched session. The baseline does not assert candidate-only HTML attributes. Account verification uses the same fixed clock as the browser, and owner binding is asserted on the workspace/outbox rather than requiring a server owner field on a newly optimistic record. These corrections do not suppress Product failures.

N141's unchanged bulk data/prestart coverage is reused from `N141_ANCHORED_CHOICE.md`; this run additionally opens the actual native two-choice popover with exactly حاضرين / غائبين, no dialog, Escape dismissal and the original prestart warning. No full build, blanket suite or Preview was needed.

Expected console output includes Service Worker blocking warnings from the isolation helper and the deliberately injected IndexedDB rejection. No uncaught page errors. The helper closes its context/browser in `finally`; the test closes its owned Vite server in `finally`. No shared live-browser lease is required for this eligible isolated phase. A port check found only closing TIME_WAIT entries, no listener.

Production publication/served-source evidence: **NOT_RUN**, owned by the original controller/publisher. No push, deploy, live teacher/student mutation, service operation, offline certification, Product closure or PO acceptance is claimed.
