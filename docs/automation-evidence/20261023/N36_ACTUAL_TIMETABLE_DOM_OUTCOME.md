# N36 — actual timetable DOM, bounded outcome

Latest continuation: run `52da0f25-3635-4831-8a38-3d1d0d09cd23` implements and locally qualifies a rendered worker path below. Release remains BLOCKED pending complete actual-source parity; no new ZIP/version was made. Earlier sections retain their original run outcomes and consumed-read history.

AI-authored, 23 October 2026. Task `continuous-n36-actual-timetable-dom-20261023`, run `370692a5-ce70-4d20-965e-ba09b56c10e4`; base `7fa9b61259df3036caf8e6eda6bf03196d7d4d2e`.

**BLOCKED: actual rendered structure is now observed, but the collector-response seam remains unproved. No source correction or new extension release is certified.** The conditional instruction to establish the actual cause before another release is not satisfied by a fabricated response. This finding does not close N36.

## Authorized observation

Used the documented browser inventory, Chrome user-tab claim and read-only DOM APIs under this run's shared browser lease. Only the named Madrasati tab was claimed. The normal Chrome Rakeez N44 tab and Incognito Rakeez tab were not read or operated. No CDP, credentials, cookies, storage, private runtime state, source-script execution, injected requests, extension control, result reader, roster reads or source writes were used.

The original route was `/SchoolManagment/Actions/Teacher/[bound-school]`, title `مدرستي | الصفحة الرئيسية`. The visible `a.analytic-schedule-card` labelled `الجدول الدراسي` pointed to `/SchoolSchedule/Schedule/TeacherSchedule` with exactly the `SchoolId` query key. The same label also existed in a non-rendered dropdown. A role-based locator did not match; a fresh DOM inspection identified the visible anchor's observed class and the click succeeded. This was a locator miss, not a browser security refusal.

After navigation completed, the title was `مدرستي | الجدول الأسبوعي للمعلم`. Bounded facts:

- One visible `table.table.table-sm.table-bordered`, six rows. Blank corner followed by explicit `الحصة الأولى` through `الحصة الثامنة` headers; line breaks normalize to spaces.
- The sampled first lesson cell was column 1 in the `الأحد` row: `td.day-cell.text-center > div.cs-lesson-card > a > div.schedule-card.done`. The card contained `div.title > i.fa-solid.fa-circle-check + h2` and one direct `small`. The subject h2 label was `المهارات الرقمية`; the small label was `خامس 5`. A final focused structural check established the h2/icon nesting that the earlier bounded tree display had collapsed; the decorative icon is omitted in the reproduction.
- There was **one anchor in that sampled cell**, containing both labels. The two initial sampled anchors from the page belonged to different lesson cells; they were not evidence of a same-cell two-anchor pair. The current parser already has a single `.schedule-card` branch.
- The anchor had exactly `SchoolId, lectureId, dateTicks, subjectId, classroomId`. Its SchoolId was SAME as the schedule route's SchoolId. No raw identifiers were emitted or persisted. The table ancestor was `div.hijriSchedule.teacherSchedule.table-responsive.dga-table`.
- Sampled anchor/card/label nodes were rendered with visible CSS visibility. The anchor was inline, the card/title flex, and the small block. The document contained six `style` elements and 22 stylesheet links, and no `base[href]`.
- A separate hidden auxiliary table had file/download/selection headers; it was not treated as timetable data.
- A targeted inspection of `.school-name`, explicit school/teacher labels, teacher welcome labels and teacher-role/status attributes found no matching visible identity markers on the schedule page. This bounded absence does not establish that every possible header identity representation is absent; it supplies no positive teacher-role checkpoint for replacing the existing reader.

The tab was restored to its original harmless dashboard after each limited inspection. The final restoration was read back. All three live-read lease phases were released; no user tab was closed.

## Reproduction and source boundary

`tests/n36-actual-timetable-20261023/reproduce.mjs` reuses the existing synthetic dashboard fixture and the actual current `readAutomaticTeacherPage`, route policy and `readSourceReportPage('fetch')` over task-owned loopback HTTP. A fresh installed browser context blocked Service Workers and non-loopback requests. Because this card has a live authorization reference, the test used the normal shared browser phase, **not** the non-live isolated-helper exception. It made no real account or service request.

The minimal fixture retains only observed structural facts and the material/class labels needed to distinguish their roles. Every identifier, dashboard, CSS declaration and omitted/decorative descendant is fabricated. It is not captured portal HTML, source CSS, a lookalike application UI acceptance result, or proof of the collector's actual response.

Four parser-seam cases passed their stated expectations:

| Synthetic response | Actual .40 result |
| --- | --- |
| Observed retained card nesting + benign fabricated inline style | `SCHOOL_CONTEXT_UNCONFIRMED`, `response-school-absent` |
| Same nesting + fabricated stylesheet link | same rejection |
| Same nesting + fabricated hiding CSS | same rejection; safety reason remains material |
| Same nesting, no CSS | maps `الأحد / 1 / خامس 5 / المهارات الرقمية` |

The no-CSS case is an experimental control only. No portal CSS was stripped, remote stylesheet fetched, or Product gate weakened. It shows that the observed retained single-card nesting is supported and that CSS presence is sufficient to reproduce the rejection at this seam; it does **not** show that removing CSS from a real response is safe.

The existing collector executes a guarded same-origin GET from the dashboard, streams bounded HTML into an inert template and requires response identity proof. `lesson-school-proof` refuses to establish absent-school binding in a response containing style/stylesheet/base. The worker classifies the optional `response-school-absent` failure and continues with a truthful unavailable timetable. The authorized normal rendered navigation exercised a different document. Its DOM cannot establish what that collector GET returned. No actual collector response was obtained in this read scope, and forbidden result/extension readers were not retried.

The first local listener failed with `listen EACCES: permission denied 127.0.0.1:49976` before browser launch. The original error is preserved in `original-port-failure.json`. The harness now asks the OS for an ephemeral port, handles server errors and uses ownership-matched finally cleanup. No ACL, global configuration or browser security setting changed. The completed reproduction records server closed, browser closed, zero external requests and `RELEASED browser`.

## Preserved state and outstanding gates

All Product source and package files are unchanged from the base. No .39/.40 ZIP bytes, department logic, receipts, roster collection, store, Sync, ownership guards, historical 56/2+29 data, service function or fixture identity was changed. There was no service deployment, temporary function or identity to clean up/disarm in this attempt.

The card's latest PO result remains **302 existing / 10 receipts / 0 pending**, department saved, school/principal/teacher/classes current, complete/saved/failure none. That is PO-supplied evidence, not a new live read by this worker. Timetable remains missing; partial roster coverage remains seven proved pages with terminal completeness unproven. No 302-vs-303 inference was made.

Reuse the unchanged .40 `tests/n36-lesson-link-20261023/guards.json`, `department-guards.json`, `candidate.json`, `restarted.json`, `partial-roster.json` and package evidence for their original exact synthetic scopes. They do not prove this new source's rendered/GET equivalence or a new rendered transport. No repeated app/store suite, package build, Preview or Production operation was run.

| Required gate | Outcome |
| --- | --- |
| Actual timetable structure read or exact blocker | PASS, bounded structural observation above |
| Actual cause before correction / release | NOT ESTABLISHED: only the CSS parser seam is reproduced; actual GET response relation UNKNOWN |
| Corrected real source mapping and secure rendered transport | NOT RUN; no correction certified |
| Identity/visibility/stale-context protections | Unchanged .40 evidence reused; no new transport claimed |
| Receipts/department/partial coverage | Unchanged; latest PO outcome preserved, no real mutation |
| New package and actual-source parity | NOT RUN; no new package |

Retry only with materially new evidence: a permitted bounded structural/visibility projection of the actual collector response tied to the observed route, or a positively proved teacher/role/document checkpoint design for an authorized rendered-read transport. Any such route still needs targeted local worker/app/store, identity, hidden/mixed-link, atomicity, idempotence and reopen certification before a new package. Do not resume an unchanged .40/package retry, invent a teacher marker, weaken CSS/school proof, or use the prohibited extension/result-reader operations. Existing controller/publisher owns delivery; whole N36 still requires the user's explicit actual import outcome.

## Materially authorized continuation — run 91d0d908-8d14-4069-acf5-2fc6c4175ce3

Resumed exactly from `a46ee23008340d8b8b17fea612939149d1b38e0c`. The new card authorized the supported CUA tab's passive Network capability for one successful timetable main-document response body. Its narrow Network grant superseded the earlier no-CDP instruction; no raw socket, direct debugger helper, extension operation or result reader was used. Existing Product source, ZIPs and the earlier evidence remain unchanged.

**The one permitted response body read is now consumed. The structural projection failed; no new package is justified.** This was a harness projection defect, not a source/security denial. The original failure is retained, and it is not recast as Product PASS. No further live body read or replay was attempted.

Read the current supported capability documentation first. Refreshed browser metadata and claimed only the named Madrasati dashboard user tab. The exact observed visible timetable link supplied the target. Commands were only `Network.enable`, one `Network.getResponseBody`, and `Network.disable`; event methods were requestWillBeSent, responseReceived and loadingFinished. No headers, credentials, cookies or raw events were emitted/inspected. No Runtime, Fetch, interception, replay, emulation, security or permission commands were sent.

The first observation stopped too early when the first batch had no more buffered events; it captured no response body. The materially corrected waiter waited for the matching response and loadingFinished within eight seconds. It verified one exact target GET Document request, HTTP 200, exact response/top-level URL, matching frame/loader and no redirectResponse on the matched request before its single body read. The subsequent regex expected exactly one `table-sm` table and threw `Expected response timetable table not unique`. The body existed and passed the two-million-character bound, but CSS/base/table facts were not projected before that throw discarded the local body. Zero versus multiple matches was not retained. It would be false to infer either a missing table, a different portal layout or CSS presence from this error. No raw response, personal identifiers or HTML was persisted.

Both observations disabled their owned passive Network observation in finally and restored the exact original dashboard URL; the shared lease was released. `tests/n36-actual-timetable-20261023/passive-observation.json` records these finite facts and the original failures. No service function, fixture identity or live data operation was created; there is nothing to disarm/delete in this run.

The navigation response would in any event establish only its own GET. The current collector's code uses `fetch` with GET, same-origin credentials, `redirect: error`, `cache: no-store`, a bounded stream and no explicit request headers. Navigation has a different request destination/mode and potentially different negotiation/cache behavior. No headers were read, and equivalence was not established. The supplied authority forbids replaying the collector fetch through the tool.

### Local identity-chain evaluation, not an impossibility claim

The prior observation that timetable-local identity labels were absent **does not prove a secure rendered transport impossible**. The new local-only `checkpoint-design.mjs` experiment composes canonical dashboard proof before navigation, an exact observed same-origin school timetable route, a new main-document checkpoint, rendered visibility/strict school lesson tuples, a stable post-read document, and a return to the canonical dashboard with the same teacher/school/role proof. Rows remain quarantined until the return proof and synthetic app owner/session predicates pass. The actual existing dashboard reader and timetable/role parser execute over HTTP in fresh synthetic browser DOMs; the design adds a local candidate tuple envelope without changing the Product parser or globally ignoring CSS.

Twenty new local scenarios passed exact expected outcomes: matching mapping; teacher/school/role switch on return; return login; synthetic owner/session switch; redirect; base; foreign/mixed school; duplicate key; CSS-hidden and nav-only lesson; missing period/day; timetable login/role change; post-read stale document; timeout. The matching case maps Sunday/1/class/subject without a new timetable teacher label. All negative cases return no admitted rows. Owned context/browser/server were closed and the shared lease released. These are **design/parser checks**, not actual application UI/store or real account acceptance. Owner/session predicates are synthetic; the existing real receiver/store guards were not replaced or certified by this experiment. The prototype is not imported by any Product file, and no extension navigation behavior is enabled.

The first local design harness accepted arbitrary negative errors; its base case therefore stopped at a dynamic-import failure rather than the intended guard. That original output is preserved as `original-design-base-import-failure.json` and is not valid guard evidence. The harness now imports its module from the explicit local origin and asserts every exact expected rejection code; the base case reaches `UNSAFE_SETUP_LINK`. A transient checkpoint-file sharing failure before lease acquisition is separately retained in `original-design-lease-read-failure.json`; no lease was acquired in that failed launch. The corrected completed run is `checkpoint-design.json`. Unchanged .40 suites/package/build were not repeated.

### Current result and precise retry condition

BLOCKED remains due to the consumed one-response live allowance and missing actual response corpus/structural projection. A feasible local checkpoint composition is now demonstrated; it still needs actual-source parity, integration into the real worker with restart/ownership checkpoints, and affected app/store idempotence/reopen/atomicity qualification before release. No claim is made that the prototype is a finished secure Product transport. No real import, Production deployment or whole-N36 acceptance occurred.

Resume only with separately authorized new bounded source evidence sufficient to establish the actual timetable response/rendered seam, preserving the consumed read and original failures. Validate a corrected projection locally before any such new read. Do not repeat this live observation automatically or rebuild .40. The PO's 302/10/0, saved department, historical data and partial roster coverage remain preserved.

## Corrected projection and actual worker implementation — run 52da0f25

The latest card materially authorizes one distinct corrected passive observation after local qualification. It explicitly identifies the prior one-read limit as an operator scope limit, not a PO restriction or tool denial. **The old consumed marker is preserved; this new read is unspent.** `observation-52da0f25.json` appends the new preflight and actual scope result without resetting the old marker.

### Projection corrected before any new read

`passive-projection.mjs` uses an injected inert HTML structural parser and returns finite counts/reasons even when there is no target, ambiguous targets, nesting or malformed input. It does not require `table-sm`, execute response HTML or export raw failures. It validates the response body/encoding shape and byte bound, projects CSS/base facts before selecting a table, and emits only bounded relevant header/card facts and a consistently fabricated lesson tuple for its one projected cell. It is a diagnostic projection, not a visibility authorization: nav/hidden facts and CSS presence are retained rather than waved away. A corrected event waiter follows both backlog and delayed loadingFinished, with exact GET/document/route/frame/loader/status matching and bounded timeout.

`projection-qualified.json` records 24 PASS cases over HTTP in a fresh synthetic context: zero/one/multiple/nested tables, arbitrary/unquoted/quoted class attributes, full document styles/base, hidden/nav structures, malformed and absent targets, body limits, base64/body-shape/error handling, no script/resource execution, delayed finish/backlog/ambiguous/redirect/timeout events. No actual source input was used in those tests.

The supported CUA command-scope probe returned `DOMParser: undefined`, `TextDecoder: function`, `Buffer: function`. No documented inert structural-parser API is exposed there. A DOMParser available in the local synthetic browser does not authorize transferring a real response to that separate browser/helper. No package import, raw socket, source Runtime evaluation, proxy or guessed parser API was used to bridge that gap. Therefore **no new Network command or response-body read was issued**. This is a specific passive-projection capability limitation, not a claim that rendered transport is impossible or a request for more ordinary read authority.

### Rendered transport implemented in Product source

The actual extension worker now has a narrow fallback only for the already-classified timetable `response-school-absent` result, an already-bound school/teacher proof, the exact previously observed TeacherSchedule route, and departure from the canonical teacher dashboard. Other optional/unsafe response failures keep their existing behavior. The worker persists an issued navigation, a fixed 30-second deadline and the new source document before reading, then quarantines normalized timetable data. It returns to the exact original home route and obtains the original canonical teacher/school/role proof again, with the actual receiver owner/session/document guard around the phase, before any setup rows reach the receiver. Restarts continue an evidenced transition without resetting its deadline or replaying an uncertain navigation.

The new `rendered-timetable` adapter mode checks the exact route/SchoolId, loading/login/role/base conditions, explicit conflicting school/teacher fields, all foreign/mixed SchoolId links, computed visibility, strict five-key lesson tuples, subject/class identity consistency and explicit day/period coordinates. The existing shared parser produces the normalized timetable. CSS-defined visibility is used only for an actually rendered document. **The inert response stylesheet rejection remains in force.** No new default subject, permission, service operation, store or Sync behavior was introduced. No new startup dependency or offline-shell path was added.

### Red-first and affected actual application verification

The new fixture retains the earlier actual observed `cs-lesson-card > a > schedule-card > title > i + h2`, direct small label, blank corner and explicit Sunday/period structure, plus the observed separate hidden auxiliary table. All IDs, CSS and other source/app/roster data are fabricated. The fixture explicitly omits unobserved rows/columns; it is not represented as the full portal or a captured response corpus.

- `rendered-baseline.json`: immutable .40 runtime at base `7fa9b61259df3036caf8e6eda6bf03196d7d4d2e` reproduces complete names receipts with `response-school-absent`, no timetable teaching/slot. This is a new input/transport reproduction, not an unchanged .40 package/build rerun.
- `rendered-candidate.json`: actual current serialized worker/popup, mounted application DOM/handlers/source CSS, account/store guards and native IndexedDB save the observed structural fixture's subject/class/day/period association. Duplicate replay adds no students/sections/teachings/slots; popup/app reopen and same-document owner/database/receipt readback after reload pass. Grades, years/terms and calendars are unchanged.
- `rendered-restart.json`: the real worker is stopped after the issued return navigation and before canonical return proof, then resumed with the observed document identity. Quarantined data does not reach the receiver until canonical proof succeeds; normal save/idempotence/reopen pass.
- `rendered-delayed-partial.json`: a delayed rendered readiness fixture is reread in the same bound document, then imports while preserving truthful partial roster coverage. No terminal completeness is invented.
- `worker-source-guards.json` and `worker-link-guards.json`: 14 actual-worker/app scenarios PASS with no admitted rows/setup: real mock-auth account switch, actual document reload/stale binding, timeout, CSS-hidden/nav-only nodes, foreign/mixed school, duplicate/unsafe keys/path, base, login/role, missing weekday and explicit conflicting teacher.
- The four canonical teacher/school/role/login-return cases and auth-session case in `worker-identity-guards.json` passed individually. Its aggregate run also includes an intentionally retained failed **profile-owner corruption** injection described next; that aggregate is not labelled PASS. Together the individually evidenced cases cover 19 new worker rejection scenarios. These replace neither the old .40 negative guards nor their original evidence scopes.

The first implementation used URL.searchParams on a browser Location object and stopped before data writes; `original-rendered-location-failure.json` preserves it. The fix constructs an explicit URL; later rendered application tests pass. The first owner test changed only an in-memory profile row's owner, which is not an authenticated-account switch. It reached the existing receiver's honest `SETUP_PROFILE_OWNER` unknown outcome after names for the still-current authenticated owner were saved; no setup was accepted. This original failure is retained in `original-worker-profile-owner-injection.json` and the original aggregate. It is not erased or counted as pre-row account-isolation PASS. The corrected account-switch scenario changes the actual mock auth user/session and is rejected by the real receiver guard before rows, as recorded in `worker-source-guards.json`. No existing ownership guard was disabled or changed to obtain that result.

The .40 receiver/store atomicity, receipt history, department and original source guards are reused only within their unchanged scopes. No receiver/store/protocol code, .39/.40 ZIP, batch receipt, historical 56/2+29 data, real roster or cloud state was changed. The latest actual PO 302/10/0 and saved department remain PO evidence, not a newly automated real import. All new app tests are synthetic and use shared browser leases, fresh owned contexts, loopback HTTP, Service Worker/external-request blocking and finally cleanup.

### Remaining exact source boundary and delivery result

An ordinary read-only attempt to extend structural parity for the **chosen rendered path**, rather than impose equality to the unused inert response, found that the named teacher/timetable tab is no longer available. Fresh supported Chrome user-tab metadata shows a Madrasati tab only at `/Dashboards/Schools`. No gateway content was read/claimed, school selected, alternate tab substituted or unapproved source action attempted. The earlier single-cell rendered evidence remains valid for its exact scope; it does not establish every current row/cell or the complete current source checkpoint chain.

Thus full actual-source parity and a release-ready package are still NOT RUN. This is a concrete current target/capability boundary after feasible local implementation, not a blanket rejection of the rendered design. No version bump, ZIP, Preview, Production publication, user extraction/save automation, live fixture identity or service change was performed. There is nothing new to disarm/delete. Owned local browsers/servers were closed; all phase leases were released.

Resume the exact saved candidate when the authorized teacher/timetable tab is available for the remaining bounded rendered structural/checkpoint proof. The optional passive read still additionally needs a supported inert parser in its own command scope; its new allowance remains unspent. Do not reset old failures, repeat unchanged local suites, rebuild .40 or route through the schools gateway without matching scope. Only after actual-source parity is established should a new immutable version/package be certified. Whole N36 still requires the user's actual explicit import outcome.

## Current source selection, narrow correction and delivery candidate — run 913a4635

This run resumes candidate `068bd4c5db8c5cdf56dd7599328157d890b04d75` under the new explicit schools-dashboard read scope. The historical BLOCKED results, failed observations and original consumed passive-read marker above remain unchanged history. The new corrected passive response allowance is still **UNSPENT**. No Network observation or response-body read was needed for the chosen rendered transport; equality with an unused inert GET is not claimed or required.

### Actual source and identity chain

Supported CUA user-tab metadata identified one existing authorized Madrasati source at `/Dashboards/Schools`. Only that tab was claimed. Its unique visible school-entry read link had the exact same-origin teacher-selection route, query-key shape `Name`, normalized full known school name, and visible teacher role. Its opaque entry target matched the previously observed canonical teacher-route identity; it was **not** treated as a literal SchoolId. The exact visible link led to that same canonical teacher route. A fresh checkpoint established the teacher marker, unique school identifier from read links and all five semantic teacher controls. No old teacher/account proof was substituted for this fresh document.

The exact visible timetable read link then showed one visible `table.table.table-sm.table-bordered`, a blank corner plus eight explicit period headers, five explicit weekday rows, and nine cells per row with unit spans. Twenty visible strict lesson anchors used the previously observed card/title/small-label structure and exact five-key tuples. All lesson school identifiers matched the fresh canonical home SchoolId; no foreign SchoolId link, duplicate tuple, hidden/nav/form lesson, base element or login was observed. The twenty non-lesson cells were empty. Six style elements and 22 stylesheet links were present; the chosen rendered path uses actual computed visibility rather than discarding CSS.

`actual-source-parity-913a4635.json` retains only finite structure, SAME relations and two necessary subject/class labels/coordinates with consistently fabricated identifiers. No raw HTML, screenshots of the source, source IDs, teacher/student names, credentials, storage, headers or private runtime state were saved. It distinguishes actual observed facts from synthetic fixture data and omitted records. The source was restored to its original schools dashboard after each bounded inspection and the owned shared lease released. No Rakeez/personal trial tab, roster, ManageLecture action, extension start/result reader or real import was touched.

### Newly reproduced defect and bounded correction

The actual source had four subject-label-to-ID conflicts **globally**, but zero within a classroom; ID-to-label and classroom bijections were consistent. Two observed associations are reproduced: digital skills in fifth/5 on Sunday period 1 and sixth/6 on Monday period 2, with distinct synthetic subject IDs. Immutable candidate `068bd4c5` rejects this structure as `AMBIGUOUS_LESSON_LINKS` and saves no rows (`cross-class-baseline.json`). The narrow fix scopes only the reverse subject-label-to-ID relation to the explicit classroom tuple. Global ID-to-label, classroom bijection and within-class subject contradiction rejection remain intact. No name-only binding, subject default or inferred coordinate was added.

The first actual canonical return comparison was false, with its detailed differences not retained; it is preserved as a failed observation, not a PASS. A later immediate return differed only in semantic controls/markers while every non-semantic identity field matched. Subsequent fresh full checkpoints matched exactly, including all five controls. The worker now waits only during its owned return for this semantic settling when **all non-semantic original proof fields already match**. It still requires the exact original complete proof before admitting quarantined rows; login, school, teacher and role differences reject immediately. The existing fixed 30-second deadline is not reset. The return document is persisted before a pending read, so reload/restart cannot manufacture a new authorization.

### Affected verification and retained failures

- `cross-class-candidate.json`: actual serialized worker/popup, mounted application handlers/source CSS, receiver ownership guards and native IndexedDB save four synthetic students/two receipts, two explicit classroom/subject teachings and two exact weekday/period slots. Duplicate replay, reopen and same-document durable readback pass; grade/year/calendar state remains unchanged.
- `cross-class-delayed-home.json`: fabricated CSS delays one canonical semantic control on return; rows remain quarantined until complete original proof. Actual app save, replay and reopen pass. This models the observed finite transient; it does not execute or copy portal scripts/styles.
- `cross-class-stale-return.json`: an actual source reload while return proof is pending stops with `SOURCE_BINDING_CHANGED`, zero rows/slots/outcomes.
- `cross-class-restart.json`: the worker stops after issued return navigation, resumes its persisted document/deadline and completes only after full return proof. Save/replay/reopen pass.
- `scoped-source-guards.json`: ten affected PASS cases cover cross-class valid mapping, same-class subject contradiction, global subject-ID label contradiction, class-label ambiguity, retained inert-CSS refusal, semantic pending then exact proof, and immediate teacher/role/school/login denials.

The original stale test lease-token failure, first delayed-repeat fixture failure and download listen `EACCES` remain in separate `original-*.json` artifacts. The first delayed-repeat failure occurred because the synthetic animation was incorrectly active at the next explicit Start; it is now armed only for return, without weakening the initial proof. The download server now asks the OS for a unique loopback port and restricts its fresh context to that origin; no policy, ACL or security setting changed. The original .40/.39 suites/build were not repeated. The prior 19 worker rejection scenarios and 24 projection tests are reused only within their recorded unchanged scopes, including the expressly retained failed profile-owner corruption aggregate. They are not relabelled wholesale PASS.

### Immutable package and limits

The newly certified extension is **0.5.41**, 29 files, archive SHA-256 `62f0ae5a34b8199b63210586039bd833a727beb489e1fb330106969966f0b5d9`. `certified-runtime-913a4635.json` pins the tested three runtime modules before metadata-only packaging; `package.json` checks every archived file against source and hashes, unchanged permissions/CSP, syntax and diff whitespace. The actual application HTTP DOM/download event returns those exact archive bytes with the 0.5.41 label (`download.json`, inspected `download-line.png`). The synthetic class UI screenshot was also inspected. The .39/.40 ZIP and manifest bytes are unchanged. No startup dependency, offline shell, receiver/store/protocol, grade, Sync, department, receipt or roster-coverage logic changed.

The PO's real **302 existing / 10 receipts / 0 pending**, saved department and historical 56/2+29 remain prior actual evidence, not a new automated real save. Truthful partial roster coverage stays unchanged; no 302-vs-303 inference or replay/reset occurred. All owned local browser contexts/processes/servers and phase leases were released. No service function/fixture identity was created, so no new cleanup/disarm service operation exists. No Preview, integration, provider check or Production publication ran in this worker.

This candidate is **LOCAL_READY for the independent publisher**. Whole N36 is still OPEN and requires the PO's explicit import after verified delivery; this subfix does not claim Product acceptance or closure.
