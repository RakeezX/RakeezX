# N127 — plus-only class header, local candidate

AI implementation, 2026-10-27 Asia/Riyadh.

- Task: `continuous-n127-class-plus-only-prod-20261027`
- Run: `84342fdd-64a9-4468-8ef9-4b4a0907cfce`
- Base: `3b6a6b03beb2bad1a8365539a9caadc125da9957`
- Worktree: `C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n127-class-plus-only-prod-20261027`
- Source: `ddea41d5244065c7b60ed63a49ccdaf49e1de59c`, PR8. Only `src/views/teaching-hub.js` was ported into Product code; it matches that source file exactly. No whole-PR cherry-pick.

## Bounded result

Eligible class headers, including empty classes, expose one icon-only plus button with both title and aria-label `إضافة مادة أخرى لهذا الفصل`. The Settings button remains adjacent. The action calls the pre-existing `addSubjectToClass(teaching.sectionId)` workflow and retains its existing guards and persistence. Active-term eligibility and closed-term gating remain explicit. No Teaching subject reassignment is introduced.

The two source E2E scenarios were ported with current-main's existing dialog description (`إذا كان الفصل موجودًا، تُضاف المادة بقائمة الطلاب نفسها.`). No N128 dialog/catalog code was ported. Tests require a true Demo workspace, reject legacy/account contexts, and retain complete historical-record comparisons. They use the existing `openReadyServedDemo` helper and canonical `withIsolatedLocalBrowser`, with active task/run validation, a task-owned ephemeral loopback Vite server, fresh Chromium contexts, external-request blocking and blocked Service Workers. Only seeded disposable Demo rows are cleared before constructing each synthetic case. No credentials, real records or service operations are used.

## Affected verification

Invocation environment:

```powershell
$env:RAKEEZX_E2E_SERVER='external'
$env:RAKEEZX_LOCAL_TASK_FILE='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n127-class-plus-only-prod-20261027.json'
$env:RAKEEZX_LOCAL_RUN_ID='84342fdd-64a9-4468-8ef9-4b4a0907cfce'
node node_modules/@playwright/test/cli.js test tests/class-hub-add-subject.e2e.mjs
```

The initial invocation ran both tests: empty-class/duplicate/closed-term scenario PASS (20.8s); populated-class scenario stopped at an added test-only width assertion expecting 40px, while existing source CSS correctly rendered the standard 44px target. Product code was unchanged. The assertion was corrected to 44px and a screenshot plus explicit no-copied-score assertion were added. The materially affected populated-class scenario alone was rerun with `--grep 'visible addition'`: PASS (24.2s; process exit 0). The unchanged second scenario's PASS is reused; no blanket suite/build/Preview was run.

| Required check | Result | Evidence |
| --- | --- | --- |
| `n127_plus_only_accessible_header_and_term_gate` | PASS | Actual DOM/CSS at 390px: empty visible text, one SVG, exact accessible name/title, 44px source-CSS button, adjacent Settings and no horizontal overflow. Screenshot visually inspected. Empty-class plus visible at 1280px; after closing the synthetic term through fixture storage and actual refresh/repaint, the button is absent and actual store reports closed. |
| `n127_same_roster_existing_score_attendance_safe` | PASS | Actual UI creates first Teaching and student; fixtures add one existing score, historical session and attendance. Plus opens the existing dialog, locked grade/label remain, UI creates Mathematics as second Teaching in the same Section. Complete before/after equality for sections, students, enrollments, scores, sessions, attendance and original Teaching items; original subjectId unchanged; exactly five independent new items and no copied score; no page errors during the scenario. |
| `n127_duplicate_subject_guard_existing_creation_path` | PASS | Empty class plus opens existing dialog; choosing its existing Arabic subject keeps dialog open, shows exact existing duplicate message, leaves one Teaching/zero students and every snapshotted store including outbox unchanged. |
| `n127_current_main_scope_noninterference` | PASS | Product diff is exactly 11 added lines in teaching-hub.js. Header source equals inspected PR8 file. Only allowed hub/test/evidence paths change. `node --check` passes for hub and test; `git diff --check` passes. No teachings.js, N44 SW/runtime, N126 portfolio, Auth/RLS/schema/scoring/backup/restore changes. |

Screenshot: `test-results/class-hub-add-subject.e2e.-c2a1a-rks-in-the-original-subject-chromium/plus-header-390.png` (local ignored artifact, visually inspected: plus only and Settings on the next header row at 390px, without overlap).

Current remote main was fetched/read at `2db0ef8d89ebbf611dcd9daaff694f7d7a426d5b`. Relative to this task's base it changes only N44 evidence/test, sw.js and generated build metadata; hub and pre-existing teachings.js are unchanged. Integration remains the sole publisher's responsibility.

Both owned Vite servers closed in fixture `finally`; canonical helper closed its owned contexts/browser in `finally`. No shared/live browser lease was acquired because the approved isolated-local exception applies. Expected Service Worker-blocked console warnings were observed; this does not certify SW/offline behavior. No pushes, deployments, queue edits or Production claims. Candidate is local-ready for the independent controller/publisher.
