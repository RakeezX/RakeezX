# N24 report presentation candidate - 2026-10-13

Task: `continuous-n24-report-design-after-current-20261013`
Run: `60661dff-1000-48b4-b4f1-7b9248d33ba6`
Base: `750791535fb4229c98b4887f31f1cef77a87df8d`

## Eligibility and exact scope

Read the canonical operating contract, current activated card, N23/N24 ledger entries and D-048 references. The declared dependencies have publisher-owned verified delivery: N71 unified restore at `2026-10-13T10:52:58.404Z`, published `0076df007820ddac1dd54b23b2b3c97e821923bc`; N100 delivery completeness at `2026-10-13T11:00:23.421Z`, published at this candidate's base. N100's validation includes original migration application/readback and offline dependency verification. Both are awaiting PO, not claimed Product CLOSED.

Inventoried only the listed report views and shared print foundation. Changed actual class grades, roster, attendance summary, detailed attendance and support; execution; cross-class grades and follow-up. The report index already provides grouped destinations and was inspected without modification. No separate achievement surface exists in these listed views; support/follow-up are the current relevant surfaces. CSV exports retain their existing generators and fields. No XLSX generator in these report views was changed.

N23 remains a separate Product identity. This pass covers its shared signature columns, spacing, optional principal behavior already defined by the helper, footer spacing, and keeping the last data row with the closing block. Neither N23 nor N24 is automatically accepted or closed.

## Before / after evidence map

All paths below are relative to this worktree. Actual binary evidence is retained in ignored `test-results/n24/`; this document and reproducible harnesses are committed.

| Actual surface | Before | After | Observed result |
| --- | --- | --- | --- |
| Grades | `before/small-grades.pdf`, `before/small-grades-screen.png` | `after/small-grades.pdf`, `qa-grades-1.png`, `qa-grades-2.png` | Compact aligned header; legible 9pt print cells; complete long labels; final student and signatures stay together. |
| Roster | `before/small-roster.pdf` | `after/small-roster.pdf`, `qa-roster-1.png` | Narrow number column; student name gets the useful page width; 85-name fixture occupies 3 portrait pages. |
| Attendance | `before/small-attendance.pdf` | `after/small-attendance.pdf`, `qa-attendance-1.png`, `qa-attendance-2.png` | Same tallies, names and order; no isolated first header page; repeated column headings. |
| Detailed attendance | `before/small-detailed.pdf` | `after/small-detailed.pdf`, `qa-detailed-1.png` through `qa-detailed-3.png` | Existing 12-session horizontal chunks and all remaining sessions/totals preserved; long names wrap instead of clipping; repeated headings on every data page. |
| Support | `before/small-support.pdf` | `after/small-support.pdf`, `qa-support-1.png`, `qa-support-2.png` | Reasons and priority order unchanged; closing block aligned with last student. |
| Execution | `before/small-execution.pdf` | `after/small-execution.pdf`, `qa-execution-1.png` | Full seven-column table, dates, times and completion values remain; shared header/footer presentation. |
| Cross-class grades | `before/small-cross-grades.pdf` | `after/small-cross-grades.pdf`, `qa-cross-grades-1.png`, `qa-cross-grades-2.png` | Existing purpose/columns maintained; shared quiet header and closing block. |
| Cross-class follow-up | `before/small-cross-followup.pdf` | `after/small-cross-followup.pdf`, `qa-cross-followup-1.png`, `qa-cross-followup-2.png` | Reasons, class/subject context and grade values preserved; readable portrait output. |

The header now has one title/quiet wordmark row and two wrapping metadata groups rather than separate identity, academic and date lines. The redundant caption and second creation date are removed. Existing fonts, profile values and central date formatting are reused. Unknown values remain omitted. The footer keeps a small wordmark; no email, technical Sync text or ornamental content is added.

Dense grade reports retain every screen/CSV column. On paper, more than five items use groups of five through the same `gradesTable` renderer; every group's totals and maximum still use the complete selected item set. `after/wide-grades.json` proves all 12 item names in order and unchanged model totals across the three groups of the 16-column fixture. `after/wide-grades.pdf` and its three `wide-grades-render-*.png` pages were inspected: no lost columns or tiny type. Its 320/390px screen checks retain deliberate table overflow without document overflow. This addresses the initially observed unreadable wrapping when all 16 columns were forced onto one page.

The native print path remains the actual report action and its existing confirmation. The harness observes its print call, then Chromium saves that same document as PDF with CSS page size and backgrounds disabled. Poppler renders those PDFs, not a reconstructed report. A4 preview screenshots (`after/a4-*.png`), actual screen screenshots, controls screenshots and PDF page images were visually inspected. The A4 screenshots use the longer roster retained in that synthetic context; the `small-*.pdf` fixtures genuinely have 8 students in a fresh context before expansion to 85.

## Checks and retained failures

- `n24_real_report_data_unchanged`: PASS. `before/data.json` and `after/data.json` compare exact roster IDs, totals from `studentTotal`, report data-row text/order, student/teaching links, attendance records and full downloaded CSV bytes across 8 surfaces at 8 and 85 students. Closing rows are presentation rows and explicitly excluded from data-row comparison. Fixture is extracted from the existing print test and shared with it; no scoring formulas were copied.
- `n24_compact_brand_header_and_n23_footer`: PASS. Actual app screen/A4 and rendered PDF inspection; one date, calm branding, stable aligned signatures and no printed controls/help launcher. The helper moves the already escaped final row into a final tbody with its closing row; it never regenerates student data or export values.
- `n24_actual_multpage_print_render`: PASS. `pdf-geometry.json` records actual page dimensions/text bounds. Every final student-report page contains its repeated student heading and data; no empty, header-only or signature-only page remains. Final multi fixture page counts: grades 5 landscape; roster 3 portrait; attendance 5 portrait; detailed 12 landscape; support 5 portrait; execution 1 portrait; cross-class grades/follow-up 5 portrait each. The detailed fixture has the original historical session plus 16 additional dated sessions. More pages than the old 7pt compressed detailed output are deliberate to retain 9pt legibility and full names.
- Final rendered set: 17 actual app PDFs / 53 pages, including the three-page dense grade fixture. Representative before PDFs and actual application screenshots provide the comparison; all final page renders were inspected.
- `n24_mobile_report_controls`: PASS. All 8 surfaces at 320/390px: no document overflow; print controls pass an actionable trial click; table overflow stays in its existing wrapper. `after/{320,390}-*-controls.png` and `after/{320,390}-*.png` inspected. No overall-grade +/- controls introduced.
- Actual selected-scope regression: PASS. `after/scopes.json`: roll order remains IDs 0-7; approved historical date adapter selects August 3-5 and only its 3 session columns; cross-class search narrows to one student and reset restores 8; grade report DOM remains read-only.
- Related unit checks: 7/7 report tests PASS after fixture correction. Reused unchanged initial passing 6 closed-term tests and 1 execution test; no Product/data implementation was changed by this pass.
- Syntax and Git whitespace checks: PASS for changed Product JS and harnesses. No new startup module/style asset was added; existing cached `report-print.js` and `components.css` paths suffice, so no app boot/Sync or Service Worker change is needed.

Original failures are retained rather than reclassified: the first unit invocation failed with `OFFLINE_LEASE_LIMITED` because the old synthetic account setup lacked an Auth/lease receipt. The scoped test now supplies a synthetic Auth response through the actual verification path, asserts the initial rejection, renews the real lease and leaves the guard enabled. Early mobile harness scrolling raced a scheduled DOM repaint; actionable trial clicks resolve the actual current locator. Initial PDF inspection found the existing printed help launcher and header-only pages from a generic unbreakable table wrapper. A later candidate also produced an isolated signature/footer page; `failed-detailed-signature-page.png` and `pdf-geometry-before-pagination-fix.json` preserve that failure. The final table-ending group addresses it structurally, and final app-generated PDFs pass the retained gates.

## Resource cleanup and remaining acceptance

Every browser phase used canonical `withIsolatedLocalBrowser` for this matching active local card: installed Chromium, fresh synthetic contexts, Service Workers blocked, exact task-owned loopback origin, external requests blocked and unique OS-assigned port. Contexts/browser and owned server close in finally; completed phase processes exited. This approved isolated phase does not take the shared live-browser lease. No live accounts, service changes, messages, integration, push, deployment or queue/status edits occurred.

The bounded implementation and local affected checks are complete. Appearance still requires PO acceptance after independent publisher delivery; this evidence does not claim Production verification or Product closure. Printed output cannot cover every physical printer/browser setting; tested output is the installed Chromium native print engine with actual A4 CSS and Poppler rendering. No unrelated deferred work is activated.
