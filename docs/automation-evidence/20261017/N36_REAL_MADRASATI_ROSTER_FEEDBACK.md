# N36 — private 0.5.1, bounded response to October 17 feedback

Task: continuous-n36-madrasati-roster-official-feedback-20261017
Run: 6fedd671-7415-414b-82a9-57b0b9dab537
Base: e2abdfe3c10307f995bd237e9a39d66a6f419082
Authority: activated N36 card / PO October 17; local synthetic only. Product remains OPEN. No portal account, credentials, real data, backend calls, deployment or official completeness verification.

## Problem and bounded result

The supplied installed 0.5.0 observation was teacher-dashboard / complete / sourceTabMatch=true, navMarkers=2, actionMarkers=3, safeReadLinks=2, readPath=3, href=3, queryRejected=0, originRejected=0, iframeCount=4. Ten processed pages produced **21 total preview rows: one teacher plus 20 timetable, zero students**. School/principal/classes/students were absent. ROSTER_LINKS_UNAVAILABLE followed by EMPTY_OR_LIMIT was not student collection or source compatibility evidence.

The retained MyStudents reader returned from visible link discovery before inspecting an existing table. It accepted only two exact Arabic link labels. 0.5.1 adds a finite set of conservative student-report labels while retaining the exact ClassStudentInfo route and route/query/origin safeguards. A visibly labeled top-frame roster table can instead enter the existing names/class table reader; pager/series/all-page proof still controls admission. No route, SchoolId, role or iframe location is inferred. Unsupported relevant same-origin links are counted but never navigated. Inline handlers are refused. No frame document or src is read; all extension executions remain frameIds:[0].

Unresolved students stay unavailable. Fixed safe causes distinguish MAIN_FRAME_READ_LINK_ABSENT, RELEVANT_LINK_UNSUPPORTED and TABLE_AWAITING_DATA; iframe presence is explicitly unconfirmed. An empty/unloaded table is never called a true complete empty roster. A generic unverified student table (including a header-only table) cannot create the misleading EMPTY_OR_LIMIT follow-on; other category parsing safeguards are unchanged. The run reports students separately from the grand total and explains why transfer is disabled. Student tables outside the dedicated safeguarded report reader cannot bypass completeness through the generic metadata reader. Existing teacher/timetable category review remains.

The private popup now fits 320px without horizontal overflow. Central Koshoof links point to the checked 0.5.1 archive/manifest and give short optional installation guidance. No permission expansion, new dependency, Noor work, store listing, real-session automation or installation bypass.

## Evidence and scope

`tests/n36-madrasati-roster-current-feedback-browser.mjs` adapts the existing installed MV3/direct-handoff harness. It uses fresh owned Chrome 155 profiles, the actual installed ZIP runtime, its actual popup/handlers/CSS and the actual Rakeez app/store over intercepted synthetic HTTPS plus a task-owned loopback server. All source requests are fulfilled fixtures; unrelated requests are blocked. The shared browser phase lease and owned browser/server/profile are cleaned in finally. No user's browser/profile is attached.

The immutable 0.5.0 archive is installed separately to prove the old failure: exact entry counters; ten-page/21-row/zero-student flow; alternate label and complete inline table both fail to collect students. The separate structural entry fixture matches all supplied counters exactly. The ten-page fixture uses seven synthetic metadata pages to reproduce the supplied processed-page total; a student table with only its header visible in that fixture also exercises the duplicate generic warning. These are test composition, not claims about the unknown real page graph or real markup.

0.5.1 exercises the same previously failing fixtures, plus unsupported relevant link / four unconfirmed iframes, loading timeout, table without pager, missing middle page, repeated page response, unsafe link, denied origin/query and inline handler. Complete inline extraction asserts the literal current source name, not a guessed value. Ignored ID/contact cells do not enter the bundle. Before explicit transfer there is no session envelope. At 320/390/1280, actual Rakeez names preview preserves the store until explicit confirmation; owner switch invalidates the preview and writes nothing. The existing full explicit-confirm transport evidence remains applicable to the unchanged handoff/owner code; this change does not recertify a real import.

Machine evidence: `tests/n36-madrasati-roster-current-feedback-browser.json` (includes retained 0.5.0 baseline); screenshots and original harness failure records: `test-results/n36-madrasati-roster-current-feedback/`. Initial harness attempts exposed the old 320px overflow and used the wrong completion waiter for expected old partial failure; those failures are retained, not Product PASS claims. The waiter was corrected to expect the old failure. An entry-counter probe was corrected to grant activeTab via an explicit synthetic extension action, select the CDP tab target, and import the reader in an extension document (dynamic import is unavailable in ServiceWorkerGlobalScope). No policy denial was bypassed. Final evidence is a fresh sequential leased run of the packed candidate.

Affected unit checks: existing extension helper, receiver limits, Koshoof discovery and direct-handoff tests. Historical source equality assertions still protect unchanged navigation/route-diagnostics; intentional source-adapter changes are covered by installed before/after behavior. The package test verifies both immutable historical 0.5.0 bytes and current 0.5.1 bytes, including tamper rejection. No full Vite build or unrelated suite is required; the publisher owns build/provider/served parity.

## Package and remaining acceptance

0.5.1 ZIP SHA-256: `8fc7a5f68174458673f15c97bf477aa262f581d34a63f69ba85480e383eccf7c` (85752 bytes). Per-file full runtime hashes: `assets/extensions/rakeez-teacher-import-helper-0.5.1.manifest.json`.

0.5.0 rollback ZIP unchanged: `18a5fa59cb3cb6cdbaed7e89c6428702365f4a9ab1920da949a134f025a8e67d` (85049 bytes), with its original manifest untouched.

This is local readiness for a useful bounded correction and truthful fallback diagnostic. The real source structure is still unknown. A voluntary single updated user run may supply safe counts; N36 stays OPEN until an actual complete official roster and owner-confirmed Rakeez import are verified. Integration, Production and PO acceptance are NOT_RUN here.

Final observed result: Chrome 155.0.8059.80 — 13 candidate cases PASS and 4 retained baseline reproduction cases PASS (baseline proves missing students, not compatibility). Browser lease ACQUIRED / RELEASED; externalRequests=0; page errors=0; owned profile/browser/server cleaned. Affected Node suite: 17/17 PASS; changed JS syntax and Git whitespace checks PASS. Official-account, Production and PO acceptance NOT_RUN.
