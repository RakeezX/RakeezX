# N138 — earned-total grade ordering

- Task: `continuous-n138-grade-total-sort-20261029`
- Run: `45ffb2db-083a-4892-94a7-713782ea4d4b`
- Base: `dbf800accf271888f5a88ca3cc0f5a37f95071f0`
- Authority: approved N138 Product Ledger note `[PO-20261029-N138-IMPLEMENT]` and activated card. Local synthetic preparation only.
- AI-authored source and focused regression; no push, integration, service operation or deployment by this worker.

## Change

`grades.js` compares the selected item in item mode, or existing `studentTotal(...).earned` in table mode. Missing item values / totals with `outOfGraded === 0` sort last in either direction. Recorded zero remains graded. Equal values return zero, preserving the original display roster order via stable Array.sort.

`reports.js` uses earned totals only for the Grades tab's high/low sort. Other tabs retain their existing comparator. The existing CSV handler already calls the same `sortRoster` as rendering; no separate CSV rewrite was necessary. No scoring/storage/subject-scope code changed.

## Actual affected verification — PASS

Command: `node --test tests/n138-total-grade-sort.test.mjs`

Final result: 4 tests passed, 0 failed/skipped; duration 14938.8346 ms on 2026-10-29. Three named acceptance subtests:

| Check | Observed result |
| --- | --- |
| `n138_all_grades_sorted_by_earned_total_and_ungraded_last` | Table high B,A,C,Z,U,V; low Z,A,C,B,U,V; repeated direction preserves ties. A=10/10 (100%), B=80/100 (80%), C ties A, Z is recorded 0/10, U/V fully ungraded. |
| `n138_single_item_sort_and_recorded_zero_semantics` | Selected first item high A,C,B,Z,U,V and low B,Z,A,C,U,V. Selecting the 90-point item puts its sole recorded student B first and all missing students after, in both directions. |
| `n138_report_grade_print_and_csv_order_match_visible_sort` | Grades screen, both six-item paper chunks, A4 preview, print-media DOM and actual downloaded CSV match high/low total order. Support retains percentage order in screen/paper/CSV; roster CSV matches roster display. A second subject on the same students independently sorts V,U,Z,C,B,A in grades table/report/CSV. |

The test served the actual application via Vite at owned `http://127.0.0.1:53138`, reused `openReadyServedDemo`, and used canonical `withIsolatedLocalBrowser` with the active card/run. Fresh disposable Chromium context, synthetic Demo data only, no credentials/persistent profile; external requests and Service Workers blocked. Actual application DOM, event handlers and source CSS were used, including the grades stylesheet. Scores/items in memory and persisted scores/items/outbox were identical before and after sorting/export/preview.

Earlier harness failures are preserved here: initial fixture assumed two Demo subjects (only one existed); corrected by creating two synthetic subjects. Next run selected a lingering grades control before report navigation completed; corrected by awaiting the actual Grades report DOM. Next run counted A4 tables before repaint; corrected with retrying DOM assertion. Next run used a grade-table anchor selector for Support's list; corrected to actual Support screen/paper selectors. These runs did not pass the full report gate. The final corrected harness above passed; no Product source changes followed the first source patch. Initial misleading unconditional test log saying PASS was removed; node:test results determine acceptance.

Expected isolation warnings: Service Worker registration blocked and the app's related update/inventory checks logged undefined registration warnings. This is not Service Worker/offline certification or a browser/tool denial.

Additional checks: `node --check src/views/grades.js`, `node --check src/views/reports.js`, and `git diff --check` passed. No full suite or Vite production build was run, per card.

Owned Vite server and browser contexts/browser closed through finally. The approved isolated phase does not acquire the shared live-browser lease. No shared resources, queue/status files or real data were changed.

## Delivery boundary

LOCAL_READY evidence only. Original controller/publisher must integrate, build and verify the exact Production-served modified JavaScript. Production publication and PO acceptance are NOT_RUN by this worker; N138 is not declared CLOSED.
