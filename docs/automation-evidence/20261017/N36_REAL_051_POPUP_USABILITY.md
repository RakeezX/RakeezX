# N36 — real 0.5.1 feedback: bounded 0.5.2 usability repair

AI implementation. Task `continuous-n36-chrome-popup-052-usability-20261017`, run `76096272-1655-4c14-8650-af6b87e19381`; base `668fc444bd7a470349048b416883afeab43c31f2`.

## Observed synthetic reproduction and result

Fresh owned unpacked MV3 **Google Chrome 155.0.8059.80**, using the existing installed-extension CDP action/start helper and shared browser phase lease. No personal profile or remote portal request. All school HTTPS requests were fulfilled with synthetic fixture HTML; the installed extension's actual external modules, DOM handlers, CSS, top-frame readers, one-time launch handshake and activeTab permission ran normally. No file navigation, guessed route, iframe-content read or denied-tool retry.

| Affected behavior | Untouched packaged 0.5.1 baseline | Packaged 0.5.2 |
| --- | --- | --- |
| Actual toolbar action viewport / body | 70 / 70px, illegible | 445 / 430px, readable; 510px viewport height, vertical scrolling |
| Full run page at 1280px | 380px body | 840px body |
| RTL at 320 / 390 / 768 / 1280 | constrained to 380px maximum | body 320 / 390 / 768 / 840px; no horizontal overflow |
| 11-page missing-roster fixture | 0 students, 23 other rows; long details auto-open | same honest counts; other categories collapsed; transfer disabled and explicitly not ready |
| Review expiry | technical REVIEW_EXPIRED stop | human Arabic explanation, scrubbed fields/picker DOM, voluntary popup-reopen guidance |

The source dashboard reader observed teacher-dashboard, complete, navMarkers=2, actionMarkers=3, safeReadLinks=2, iframeCount=1. The run's later entry-state is correctly recorded separately: it describes the last metadata page, not the initial dashboard. Source binding remained true in the live run. Structural diagnostics report MAIN_FRAME_READ_LINK_ABSENT and ROSTER_LINKS_UNAVAILABLE; no school values, names, URLs or query values appear in diagnostic output. An iframe is not evidence that the roster resides inside it.

The original user reported duplicate EMPTY_OR_LIMIT warnings. The current 0.5.1 synthetic fixture produces the main roster warning alone (the existing home-page student-table admission guard already skips that table). This limitation is preserved: no invented baseline duplicate. A focused test executes the actual display filter with both warnings and confirms only the students EMPTY_OR_LIMIT consequence is omitted when ROSTER_LINKS_UNAVAILABLE exists; independent student pagination and other-category failures remain. Validation/exclusion logic still uses all original warnings.

The clock harness captures the real application's review timer deadline, advances to deadline minus 1ms (fields still present), then exactly to deadline (fields/picker DOM gone, handoff unavailable). Both baseline and candidate use the unchanged 300000ms lease. The candidate also runs an actual complete one-page synthetic roster through the source reader: names/rows visible with details open; explicit review enables transfer, editing invalidates review, expiry scrubs names. No transfer or automatic application write was performed. The independent handoff TTL remains 120000ms.

## Verification and evidence

`tests/n36-popup-052-real-feedback-browser.json` contains the successful actual Chrome run and preserved baseline measurements; screenshots are in the ignored task-owned `test-results/n36-popup-052/`. The 320px collapsed feedback page and 390px expanded student-review page were visually inspected. The full run's optional 20 timetable rows remain editable via the accessible details summary without being auto-expanded when students are missing.

`node --test tests/n36-popup-052-real-feedback.test.mjs tests/n36-extension-direct-handoff.test.mjs tests/n36-koshoof-discoverability.test.mjs`: **10/10 PASS**. Syntax checks for run-controller, categories-popup and class-import-center PASS. Existing 0.5.1 browser evidence (`051_alternate`, `051_inline`) for unchanged app owner-switch/preview protections is reused; this patch changes only that app's download URLs/copy, not account/store handlers.

Harness corrections were local: initial missing candidate ZIP before packaging; initial entry-state assertion incorrectly expected dashboard counters after navigation; popup's first body-scroll design measured 460px and was replaced by a single root scroll container (445px); README update required repackaging; reinstalling Playwright's context-wide clock on the second page reset simulated time (observed remaining=598394ms), fixed by installing once per context. Original source failure and baseline are retained. No rejection/real portal operation was bypassed.

The owned temporary extension/profile and browser were closed and browser lease released in finally on each run. No local server was needed for extension pages; synthetic source documents used HTTPS request interception. No user Chrome extension was reloaded.

## Remaining scope

Production/provider/parity checks NOT RUN by this worker. Independent controller/publisher owns them. PO real Chrome retest remains necessary after verified delivery; only then may the existing guarded updater update the one stable folder. Full direct Madrasati roster extraction remains **OPEN**; neither real compatibility, an empty class, Product acceptance nor N36 closure is claimed. Noor stays second phase; JSON remains advanced.
