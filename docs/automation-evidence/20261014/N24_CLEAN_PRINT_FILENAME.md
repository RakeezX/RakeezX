# N24 clean print / filename — current scoped result LOCAL_READY

## Resumed run: corrected native-decoration proof

Run: `b7cd10ca-9035-4e44-bdd6-8b6b866cab7e`. Preserved first candidate `35b4ccc54d926360e024495087f5778eaba0519b` and original base `432f815bc83e2bce4b419bc05b36759be1e2a242`. The first-attempt failure below remains historical evidence, not the current acceptance result.

The materially different correction fixes a specific test-template defect. [Chromium's native header/footer template](https://raw.githubusercontent.com/chromium/chromium/main/components/printing/resources/print_header_footer_template_page.html) tests `.text` elements for intersection with the page content area and hides them. The first-attempt custom templates omitted `.text`, so they did not model the default browser-decoration behavior. The [renderer also distinguishes its native default templates](https://raw.githubusercontent.com/chromium/chromium/main/components/printing/renderer/print_render_frame_helper.cc) from custom templates. The new proof covers both default class conventions and the browser's unmodified native templates, with `displayHeaderFooter:true` in every case. Original failed PDFs are untouched; no earlier FAIL was relabelled.

The shared setup now uses zero page/first-page margins only when standard `box-decoration-break:clone` is supported, with 10mm landscape / 12mm portrait **inner** spacing cloned onto every page fragment. Engines without that CSS feature retain the original page margins. No browser preferences, global print options, data calculations or network PDF service changed. The actual print/confirmation action remains the existing single action.

Calibration ran **before** enabling the new geometry: the corrected marked templates displayed all URL/title/date sentinels on every page in 11-page landscape and 7-page portrait reports. Native default templates likewise displayed URL/title and their numeric date. This proves the test can detect decorations instead of supplying empty/disabled templates.

| Current required check | Result | Evidence |
| --- | --- | --- |
| `n24_responsive_metadata_top_brand_link` | PASS — Chromium 151.0.7922.34 | Actual screen preview metadata for grades/roster and screen controls for all five reports at 320/390; all five print-media headers passed value overflow and child containment checks. Execution/cross headers retain their existing print-only screen behavior. Native enabled-decoration A4 PDFs were also generated from 320/390 contexts for landscape grades and portrait roster. Both anchors remain the exact root URL and both are represented in PDF URI annotations. |
| `n24_browser_headers_enabled_suppressed` | PASS — Chromium | Marked default-convention templates and browser-native unmodified templates: URL/title/date sentinels/default numeric date absent from **all 88 candidate pages**, including first/middle/last. Original enabled controls are positive. No `displayHeaderFooter:false`, PDF stripping, white masks or altered templates that force hiding were used. |
| `n24_report_filename_restored_after_print` | PASS — Chromium | Reused unchanged cancellation/exception/sanitization/route-title evidence from first candidate. New actual print actions on all five surfaces again emitted the same distinct local-creation-date filenames once and restored the original title. |
| `n24_multipage_values_margins_preserved` | PASS — Chromium | 220 synthetic students; original IDs, calculated totals, row text and CSV snapshots match on all five surfaces. Every candidate page has safe text bounds, table/header/footer painted bounds, repeated table heading and root URI annotations. Both marked and native paths checked; first/middle/last marked pages rendered and visually compared with retained before/control evidence. Additional A4 PDFs from 320/390 contexts protect the mobile print entry. |

Page counts are unchanged: grades 11, roster 7, execution 2, cross-grades 12, cross-followup 12 per template path. Checks use every word, not an edge-region filter. Painted table/header/footer bounds are checked separately from the existing full-sheet **white** paper background. All text remains within at least about 8mm landscape / 10mm portrait printer-safe bounds; the nominal inner spacing is 10/12mm. Signatures/footer remain with the final data row. First-attempt screen, filename, sort/data and CSV evidence is reused where source is unchanged.

Commands: `node tests/n24-native-decoration.mjs control b7cd10ca-9035-4e44-bdd6-8b6b866cab7e`; `candidate` and `metadata` with that same explicit run ID; runtime Python `tests/n24-native-pdf.py`, then `--metadata` to append only the new mobile PDF checks without repeating unchanged candidate/control proofs. Local output: `test-results/n24-native/{control,candidate,metadata}/`, `proof.json` and their `data.json` records. Fresh contexts and bounded loopback servers use the canonical isolated helper and close in `finally`. JavaScript/Python syntax and scoped diff checks pass.

WebKit report certification remains **NOT_RUN**: reused first-attempt actual-app `.boot` timeout (30000ms). Its unchanged boot failure was not retried. This is Chromium proof, not universal-browser or physical-printer certification. No startup dependency or offline shell path changed. No push, deployment, queue/status or real-data mutation occurred. The controller/publisher owns delivery and served-source evidence; LOCAL_READY is not Product acceptance.

## Historical first attempt — retained BLOCKED result

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
