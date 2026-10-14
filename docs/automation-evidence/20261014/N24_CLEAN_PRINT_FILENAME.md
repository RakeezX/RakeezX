# N24 clean print / filename — scoped candidate, BLOCKED

Task: `continuous-n24-clean-print-filename-20261014`  
Run: `138e1001-c8a6-4c59-af07-b05af5d0bfb6`  
Base: `432f815bc83e2bce4b419bc05b36759be1e2a242`

Implemented responsive metadata grids in the existing shared report setup, wrapping Arabic school/subject values with adaptive gaps and compact label/value pairs. The top brand now uses the same exact `https://rakeezx.com/` anchor as the bottom. Existing report actions/confirmation now use a shared title helper: report type + `ركيز المعلم` + local `todayISO()` creation date. Reserved filename characters are removed. `afterprint` restores the previous title after print/cancel; thrown print errors restore it immediately. A subsequent route title is preserved. No report calculations, filters, IDs, sort, CSV generation, date controls or persistence contracts changed.

## Actual affected evidence

Fresh disposable contexts used the canonical `withIsolatedLocalBrowser`, a task-owned ephemeral loopback HTTP server, blocked external requests and Service Workers, and synthetic Demo data from `tests/n24-fixture.mjs`. Actual application modules, DOM, CSS and handlers were exercised. Each browser/server phase closed its owned resources in `finally`; no shared live browser was used. No credentials, real data, remote service or user browser settings were accessed.

Engine tested successfully: **Chromium 151.0.7922.34**. Installed WebKit launched, but the actual app remained on `.boot`: `openReadyServedDemo` failed with `locator.waitFor: Timeout 30000ms exceeded` waiting for `.boot` to detach. WebKit report behavior is **NOT_RUN**, not a universal browser PASS.

| Required check | Result | Evidence |
| --- | --- | --- |
| `n24_responsive_metadata_top_brand_link` | PASS (Chromium) | Actual screen and print media at 320/390; A4 grades landscape and roster/execution/cross reports portrait. Long school/subject values wrap, header/container overflow checks pass. Both anchors have the exact root URL. All five PDFs retain top and bottom URI annotations (five annotations per PDF due to the browser splitting the top wordmark). |
| `n24_browser_headers_enabled_suppressed` | **FAIL** | `displayHeaderFooter:true`, realistic 8px date/title and URL/page-number templates. `N24_TITLE_SENTINEL`, `N24_DATE_SENTINEL`, `N24_URL_SENTINEL` remain on **every** page, including first/middle/last, under zero-page-margin and explicit zero-first-page-margin trials. No disabled-header PDF was substituted. |
| `n24_report_filename_restored_after_print` | PASS (Chromium) | Real print buttons and existing confirmation called print exactly once with distinct type names; original title/route restored. Also tested asynchronous return before cancel, `afterprint`, reserved characters, exception cleanup and preservation of a later route title using the real imported helper. |
| `n24_multipage_values_margins_preserved` | PASS (fallback candidate, Chromium) | 220 synthetic students; IDs, calculated totals, displayed rows and CSV match the base snapshots exactly on five surfaces. PDF geometry checks cover every page and repeated table headers. First/middle/last pages rendered before/after and visually inspected; tables, final data rows, signatures and footer stay on paper within printer-safe margins. No clipping or new table split regression was observed. |

Observed filenames: `كشف الدرجات - ركيز المعلم - 2026-10-14`, `كشف الطلاب - ركيز المعلم - 2026-10-14`, `تقرير الحصص والحضور - ركيز المعلم - 2026-10-14`, `الدرجات - ركيز المعلم - 2026-10-14`, `طلاب يحتاجون متابعة - ركيز المعلم - 2026-10-14`. Historical fixture sessions remain in August; filename day is the October creation day.

Commands: `node tests/n24-clean-print.mjs before`; `node tests/n24-clean-print.mjs after`; targeted `after chromium mobile` checks; `after webkit` (readiness failure); runtime Python `tests/n24-clean-pdf.py` (geometry/link proof with explicit decoration failure). `node --check` passed for the four changed source modules and browser harness; `git diff --check` passed. No unrelated suite/build/Preview repeated.

Local evidence is retained in `test-results/n24-clean/`: `before-chromium/data.json`, `after-chromium/data.json`, `pdf-proof.json`, five PDFs per phase, screen/print metadata PNGs, and first/middle/last PDF QA sheets. Page counts before/after: grades 11, roster 7, execution 2, cross-grades 12, cross-followup 12. Original failed zero-margin PDFs and observed CSS rules are preserved separately in `zero-margin-failed-chromium/`.

## Exact blocker and disposition

[Chrome's documentation](https://developer.chrome.com/blog/print-margins) describes suppression of automatic decorations when the first page has insufficient margin space. We tested `@page margin:0`, then explicit `@page :first margin:0`, with `box-decoration-break:clone` inner spacing on the actual report. Observed CSS rules and computed spacing confirmed the applied zero-margin rules. The installed Chromium's enabled-template PDF path nevertheless painted all three sentinels. That is the observed limitation; it does not establish what every normal Chrome print dialog does.

After the second failed suppression result, the zero-margin experiment was **removed from the candidate**. Original 10mm landscape / 12mm portrait page margins are retained, as required when suppression cannot be safely certified. The candidate provides the other bounded improvements, but does **not** remove browser decorations and must **not** be delivered as satisfying this card. Final state is BLOCKED, not LOCAL_READY or Product acceptance. No push/deploy/queue mutation occurred.

Retry only after a materially different CSS/app-print solution or a permitted proof harness for the actual normal Chrome print-preview path can demonstrate enabled decorations absent with safe multipage layout. Preserve this candidate, baseline and failed evidence; do not repeat unchanged zero-margin trials or claim `displayHeaderFooter:false` as suppression.
