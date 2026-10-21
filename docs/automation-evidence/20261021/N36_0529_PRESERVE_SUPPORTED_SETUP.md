# N36 — supported setup over bounded stationary GET, 0.5.30

AI-authored local candidate. Task `continuous-n36-0529-preserve-supported-setup-readonly-20261021`; run `8ca15b0a-67c6-4101-9512-211ebc5f4c7c`; base `1d2ba34a6004ec2915094103e96608ef2b70a768`. Authority: activated synthetic card and latest N36 PO supported-setup note. Product remains open; no school access, credentials, personal/dedicated browser, remote receiver or real-data mutation occurred.

## Result and boundaries

0.5.29's immutable ZIP reproduces the defect: it transfers 303 roster rows but returns `SOURCE_BOUND_READ_UNAVAILABLE` for observed metadata/classes/timetable routes, omitting the principal, class subject and weekly slot. 0.5.30 restores these supported reads without moving the source tab. Previously extracted dashboard/card fields are reused; only the selected teacher-card role command retains its existing single-use navigation.

The coordinator records exact setup hrefs from the verified entry document, and each GET also requires the same visible, enabled, non-form, handler-free anchor in the bound live teacher document. Metadata permits only observed MyInfo routes, classes only Teacher report routes, and timetable only the existing TeacherSchedule shapes. No URL is synthesized. The original route policy, source SchoolId/name/positive teacher proof, document and app owner/session/batch guards remain. App authority and source proof are checked while the request is pending, before it and after it; cancellation aborts only the job-owned request.

GET uses same-origin credentials, no-store, redirect refusal, an eight-second maximum and two-million-byte header/stream limits, exact response URL and HTML MIME. Returned HTML stays in an inert template; scripts, frames, images and styles are never inserted or run. Existing parsers read only the requested setup category plus teacher/school identity markers. Response links are never enqueued. Login/role, base URL, contradictory teacher/school/SchoolId and unsafe live hrefs fail closed. Missing links/fields produce category-specific `SETUP_LINK_UNAVAILABLE` / `SETUP_FIELD_UNAVAILABLE` (and group-specific unavailable responses), without suppressing other supported fields or converting roster coverage to a full Product success.

The 29 runtime paths, extension permissions/hosts/CSP, popup CSS, handoff protocol/worker, roster coverage/receipt logic, app ownership/data/scoring/Sync/date paths and review consent remain unchanged. The app view changes only its download href/label to 0.5.30. The existing receiver saves supported setup through its actual guards; no receiver implementation was changed.

## Affected evidence

All paths below are under `tests/n36-0529-preserve-supported-setup-20261021/`.

- `browser.json`: **47 PASS** scenarios using actual popup DOM/handlers/CSS and serialized source readers over owned loopback HTTP, with synthetic source documents and fabricated Chrome transport. Both dashboard and selected-card starts independently assert teacher/principal/school, class subject and weekly slot. Additional cases prove metadata-only teacher, reuse of card principal, absent links/empty fields, exact 300+3 batches, partial coverage, unknown receipt, source guards before/during/after GET, response teacher/school tables and labels, SchoolId, redirect/login/MIME/size/timeout, removed/foreign/handler-bearing hrefs and inert resources/no response crawl.
- `receiver.json`: **11 PASS** scenarios through actual app/store/serialized receiver/IndexedDB and existing synthetic account/service helpers. Two successful journeys persist 303 students, teacher/principal/school, class subject and one weekly slot, with exact 300+3 saved receipts. Scores and years are unchanged. Existing pre-read owner/session/receiver-document/batch/route negatives remain; owner/session/batch/source-document changes during a deliberately pending metadata response abort with no writes.
- `package.json`: **PASS**, exact same 29 runtime paths, source/ZIP/manifest SHA256 and sizes, unchanged historical packages and permissions, exact app-link-only diff and affected JavaScript syntax.
- `checks.json` and `resources.json`: consolidated required checks and final runtime fingerprint; owned browser contexts/engines and HTTP servers closed in finally, ports 49830 and 49831 refuse connections. Canonical isolated-local helper validates the active synthetic card; the approved isolated phase uses no shared live-browser lease.
- `actual-download-link.png`, `supported-result.png`, `role-result.png`, `partial-result.png`: actual HTTP app/popup screenshots. App link and popup were visually inspected. The real app download handler returned the exact archive without navigating.

Final archive: `assets/extensions/rakeez-teacher-import-helper-0.5.30.zip`, **142094 bytes**, SHA256 `f6945323c634e974fd6815c27648e0f1f0f6efaade9f05f656d54c55f48d8778`. Runtime fingerprint `995d7d0c55b6aca124cda3540d6be85fa19bba00a2e1139cca348b4391aed028` binds browser and receiver evidence to the final runtime.

Commands: `node --experimental-vm-modules tests/n36-0529-preserve-supported-setup-20261021/browser.mjs`; same for `receiver.mjs`; `node tests/n36-0529-preserve-supported-setup-20261021/package.mjs`; same for `checks.mjs`. `--remaining` reuses only already-passed cases with an identical runtime fingerprint. No blanket suite/build or repeated Preview was run.

Original local failures are preserved in `browser.json.previousFailures`: inert fragments initially lacked `document.title` (fixed in the adapter); fixture assertions used `day` rather than the established `weekday` key and a contradictory welcome string (corrected against the existing schema); a new refusal code was initially reduced to `unknown` by the diagnostic allowlist (fixed by adding fixed codes). Unchanged valid evidence was reused after harness-only corrections. Historical .29 roster-link/account/consent evidence remains at `tests/n36-0528-my-students-teacher-proof-20261021/`; unchanged branch behavior is not recertified as a new real-source result.

## Remaining delivery and acceptance

**NOT RUN here:** push, integration, provider/Production verification, stable installed-folder update/parity and Chrome reload. The independent sole publisher/controller owns those phases. After verified Production archive/link, the existing authorized stable updater must prove all 29 runtime files match that served package. This worker did not alter the stable folder, queue/status, controller locks or other processes.

**NOT RUN:** actual Madrasati school collection/save and full supported-setup acceptance. A later PO manual 0.5.30 trial is required; local synthetic PASS is neither real-school success nor Product CLOSED.
