# N140 — separate QuickLog event indicators (local candidate)

- Task: `continuous-n140-symbolic-positive-negative-ui-20261029`
- Run: `faf3c6b8-cf81-48fa-8f95-7c49cc482175`
- Base: `851ac0514c89467023e90bdcae3882291cef821b`
- Authority: activated PO-20261029-N140-UI-ONLY card and current canonical Product Ledger N140 row, including PO-20261029-N140-UI-START.
- AI-authored implementation; candidate identity is the Git commit containing this evidence file. No push/deploy or queue changes performed.

## Bounded result

QuickLog now counts positive and negative **events** separately for the selected teaching and kind across retained dates. It never substitutes the net score for these counts. The latest negative retains a warning symbol, existing tag (or «بلا سبب») and stored ISO date, including when positives exceed negatives. Deleted/undone records stay excluded. A negative keeps warning styling even when positives outnumber it. Arabic labels and accessible descriptions explain both counts and the latest negative; the card keeps the existing plus/minus actions and 44px minus target.

Today's logged/unlogged filters use event existence, so +1 and −1 is logged. Undo selects the latest nondeleted event by updatedAt only within the selected kind, teaching and current date. No session binding was invented: native QuickLog records remain teaching/day scoped.

No store/schema, score calculation, item, Auth, ownership, Sync or backend code changed. Existing addLog and soft-delete patch paths remain in use. Behavior mode explicitly says it is documentation without grade deductions. An actual behavior grade penalty remains a separate decision requiring an explicit behavior item, accepted prospective rule and affected score/Sync authorization. This UI slice does not complete that work or Product N140.

## Affected verification

Ran the actual app using Vite at `http://127.0.0.1:5140`, canonical `withIsolatedLocalBrowser`, fresh disposable Demo context, blocked Service Workers and external requests. Reused `openReadyServedDemo`. No live account, credentials or real data. The isolated phase requires no shared browser lease. The helper closed owned context/browser and the test closed its owned server in finally.

Command (PowerShell, from this worktree):

```powershell
$env:N140_BROWSER_TASK_FILE='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n140-symbolic-positive-negative-ui-20261029.json'
$env:N140_BROWSER_RUN_ID='faf3c6b8-cf81-48fa-8f95-7c49cc482175'
$env:N140_SCREENSHOT_DIR='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/attempts/continuous-n140-symbolic-positive-negative-ui-20261029/faf3c6b8-cf81-48fa-8f95-7c49cc482175/n140-visual'
node --test tests/n140-symbolic-quicklog-events.test.mjs
```

Final result: **4 tests passed, 0 failed, 0 skipped** (parent plus three affected cases).

| Check | Actual evidence |
| --- | --- |
| n140_positive_negative_indicators_separate_even_if_net_zero | Actual DOM shows +1/−1 and +5/−1; untagged latest negative includes date; accessible plus description includes both counts and negative reason. 320px and 390px RTL cards fit source CSS without horizontal page overflow or out-of-card content. |
| n140_logged_today_filter_counts_events_not_net_and_undo_respects_kind | Clicked logged/unlogged filters for same-day net-zero student and historically logged but unlogged-today student. Clicked real Undo in participation and behavior; newer other-kind, other-teaching, old-date and deleted fixtures did not win; undone negative vanished from counts/details. |
| n140_teacher_only_readonly_ui_and_event_details_no_score_change | Used real reason sheet with existing «إزعاج» tag, then five real plus taps in behavior mode. DOM retained +5/−1 and negative tag. Scores and items remained byte-for-byte unchanged in the synthetic store. No page errors. |

Visual evidence: `n140-visual/n140-320.png` and `n140-visual/n140-390.png` in the run directory above. Manually inspected the 320px screenshot: two-column RTL cards, separate counters, warning/date and both actions remain visible. Long existing tags use ellipsis with full title/accessibility text.

Initial harness failures are preserved in session tool output: raw CSS selectors rejected colon-containing Demo IDs; immediate assertions raced scheduled repaint. Corrected selectors use quoted ID attributes/CSS.escape and assertions wait for the real DOM. No Product guard was relaxed. The final affected pass additionally verifies accessible descriptions after the final source change.

`node --check src/views/quicklog.js` and `git diff --check`: PASS. No blanket build/suite or repeated Preview performed. Publisher integration, served source SHA and Production verification: **NOT_RUN**, owned solely by the original controller/publisher.
