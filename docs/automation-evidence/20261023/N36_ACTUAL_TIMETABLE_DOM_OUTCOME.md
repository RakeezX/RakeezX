# N36 — actual timetable DOM, bounded outcome

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
