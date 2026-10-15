# N36 class / roster import and export entries

Task: continuous-n36-class-roster-import-export-entries-20261015
Run: 89d274f4-677e-4900-b7dd-274a6a98e36a
Base: 307e709ccc52b483ca2638cdf8c810c23985d036

Implemented four labeled actions on the empty class hub: استيراد الكشوف, تصدير الكشوف, لصق الأسماء, إضافة طالب يدويًا. The populated hub and empty/populated Students pages have a compact wrapping import/export row. Existing roster paste/add controls remain. Hub paste delegates directly to studentsView.actions.import with the same element/event/params; no importer was duplicated.

Both file entries preserve teaching identity and navigate to existing N90 grades?import=1 / grades?export=1. A shared read-only entry guard rejects missing/archived classes, invalid/closed teaching contexts, foreign teaching ownership and account Auth drift. Existing store mutation, ownership, grade and Sync guards remain in place. No service, schema, receiver, grade logic or startup dependency changed.

## Affected verification

- `node tests/n36-roster-entry-buttons-browser.mjs`: PASS, eight recorded checks. Canonical withIsolatedLocalBrowser, task-owned loopback HTTP port 49362, fresh disposable account fixture contexts, Service Workers blocked and external traffic blocked. Existing served-demo-readiness and N73/N36 account fixtures reused.
- Real app DOM, event delegation and source CSS exercised at RTL widths 320, 390, 768, 1280: empty hub four actions; populated hub; empty/populated Students page; correct exclusive N90 panel and same teaching ID; existing paste/add open and cancel; empty grade template download contains headers and no student rows. Entry controls have aria-labels and dimensions at least 44px; no document overflow. Visual inspection included empty hub 320 and populated Students 320/1280. Screenshots: `test-results/n36-roster-entries/` (local artifacts).
- Direct stale handlers tested with actual store archive state, foreign teaching ownership and Auth drift: no navigation or modal. Complete persisted database/outbox checkpoint unchanged; zero IndexedDB writes and zero fixture-service calls after setup across interaction checks. No public service or real teacher/student data used.
- Syntax checks for both changed views and browser harness: PASS. `git diff --check`: PASS.
- Owned contexts/browser closed by canonical helper finally; owned HTTP server closed in finally, recorded in `tests/n36-roster-entry-buttons.json`. No shared browser lease required by approved isolated-local policy.

Harness corrections preserved: first attempt stopped after 320 checks with `TypeError: h.render(...).includes is not a function`; corrected the template value assertion. Subsequent visual inspection found synthetic enrollment lacked `status: active`, so its supposed populated class was empty. Added the actual active enrollment and a rendered roster/stats assertion; reran the materially corrected matrix successfully. These were harness defects, not Product acceptance passes from those initial attempts.

Production integration, immutable Cloudflare and served Production evidence are NOT RUN here; the independent controller/publisher owns them. This is local readiness only. Full N36 school/classes/roster/timetable ingestion remains open; this change adds no portal extraction or direct school-data integration. Existing N36 review-only JSON receiver is unchanged.
