# Lesson preparation and annual teacher portfolio — implementation contract

**Status:** source-grounded product decision material; no application behavior is implemented or authorized by this study. The existing N36 Madrasati/Noor importer remains a separate open workstream. This document covers the requested Tahdiri 11.0.10 comparison and Rakeez lesson preparation/annual portfolio only.

## Decision summary

Rakeez already has reusable identities for school year, term, subject, section, teaching assignment, curriculum unit/lesson, weekly timetable slot and dated class session. It can report roster, recorded attendance, assessment items/scores, participation logs and assignment submissions. It does **not** currently model teacher lesson-preparation content, preparation approval, a provider save receipt, evidence that a strategy was used, school/principal portfolio provenance beyond profile names, parent-contact delivery receipts, or a teacher portfolio/certificate/reflection collection.

Build this as an additive, teacher-owned preparation/evidence layer linked to existing `teachingId`, `lessonId` and optionally a dated `sessionId`. Keep provider submission as an explicit future adapter boundary. A saved Rakeez draft, teacher approval, provider receipt and teacher confirmation that a class was conducted are distinct records/states. Do not infer delivery from grades, attendance, session creation, a browser click, or a provider page being opened.

## Preparation and delivery contract

| Concept | Existing source / proposed representation | Meaning and evidence rule |
|---|---|---|
| Weekly timetable slot | Existing `slot`: `teachingId`, `weekday`, `period` (`src/models.js:769-775`); resolved via `store.slotsOf` (`src/store.js:1854-1869`) | Recurring planned time only. It has no date, preparation, or delivery proof. |
| Dated class/session | Existing `session`: `teachingId`, `date`, `period`, optional `slotId`, time snapshot, status, `lessonId`, note/homework/covered (`src/models.js:778-800`). Status vocabulary includes scheduled/held/missed/etc. (`src/models.js:258-274`). | A dated operational record. `held` is a teacher-entered session status, not evidence that a specific strategy occurred or that an external provider accepted a preparation. Preserve its existing class/attendance meaning. |
| Curriculum lesson | Existing `lesson`: `unitId`, name, order, plannedSessions (`src/models.js:822-840`); units are subject/grade/term-index scoped (`src/models.js:822-831`). | Curriculum catalog item, not a dated preparation. No curriculum edition, region, year ID, provider mapping or preparation fields currently appear in this model. |
| Preparation draft | **Proposed additive record** (not current): stable `id`, `teachingId`, `lessonId?`, `sessionId?`, `date?`, stage/grade, subject ID, curriculum edition ID, year ID, region ID, term ID, week key, provider reference, version, prepared content, strategy/evidence plan, `status=draft`, timestamps. | Editable teacher-authored plan. Dates use the approved Rakeez date adapter and existing central bounds; optional date stays optional. Never overwrite a prior version silently. |
| Teacher-approved preparation | **Proposed state/event** on a versioned preparation: `approvedAt`, `approvedByTeacherId`/account identity, approved version/hash. | Explicit teacher review/confirmation of the exact content/version. Editing after approval creates a new draft/version and invalidates approval for the changed content. |
| Madrasati save receipt | **Proposed provider receipt**, separate from preparation: provider, provider record/reference if returned, submitted version/hash, accepted result, receipt timestamp, idempotency key, retry state. | Record only a response actually observed from a supported provider action. A click, navigation, timeout, or locally prepared payload is not a receipt. No provider write is currently authorized by this study. |
| Lesson actually conducted | **Proposed teacher confirmation** attached to a dated session: confirmed date/session and optional brief reflection/evidence reference. | Teacher attests the lesson occurred. Student grading/completion, attendance, scheduled/held status, provider receipt, or planned strategy alone does not establish that it was conducted or that a strategy was used. Strategy-use claim needs a separate teacher confirmation/evidence note. |

### Identity and version rules

Reuse IDs rather than labels: current graph is `yearId → termId → teachingId(sectionId, subjectId, termId)`, with curriculum `subjectId + grade + termIndex → unitId → lessonId` (`src/models.js:82-90, 632-696, 822-840`). Add explicit stable `curriculumEditionId` and `regionId` when known; neither is currently modeled on these records. Keep provider lesson IDs in a namespaced mapping, never as a replacement for Rakeez IDs. Do not join by subject display name. A preparation must retain year, term, teaching, grade and curriculum edition context as captured; do not reinterpret old records when active selections change. Use an opaque week key tied to the term/calendar context rather than deriving a week from a subject label.

Use the approved date utilities and `data-rakeez-datetime` / appropriate `data-rakeez-date-scope` for any future date input. Preserve existing central planning/historical/session limits, optional values, ISO storage semantics and supported 0–9 digit input. Do not introduce native-only date controls or a competing picker.

### Compact weekly flow

1. Select term/week; derive eligible teaching assignments and their curriculum lessons from existing identities. Load saved defaults only for the same teacher, teaching, curriculum edition and provider mapping.
2. Present the week as timetable-linked slots and dated sessions. For each row, make the stage explicit: timetable only, dated session, preparation missing/draft/approved, provider receipt present/missing, and conducted confirmation present/missing. Do not collapse these into one “done” badge.
3. Prefill only verified reusable lesson data; ask the teacher to review exceptions and add/edit objectives, strategy, resources, differentiation and planned evidence. Show the source of imported/saved defaults and leave unknown fields blank.
4. Teacher reviews the batch and explicitly approves the exact version. A later supported-provider adapter may submit the approved batch once, with one idempotency key per preparation version and durable per-item receipt/failure. Resume from saved receipts; never resend accepted items. Stop safely on uncertain outcome and reconcile before retry.
5. After teaching, the teacher may confirm a dated lesson conducted and optionally record reflection/strategy-use evidence. Do not infer it from scores, attendance, assignment status, or a provider receipt.

Subject examples are design cases only: Arabic may organize reading/writing/language activities; English may distinguish language skills; mathematics may center worked practice; Quran may track recitation/memorization; digital skills may use practical tasks; kindergarten may center activities/observation. These are examples of fields that should remain flexible, not supplied curriculum content, claims about Tahdiri coverage, or mandated assessment policy. A generalized schema does not prove all subject/grade content exists.

## Annual teacher portfolio contract

Portfolio is a year-scoped assembly of provenance-bearing evidence. Each section must show **source**, **evidence kind** (auto-derived, teacher-entered, externally confirmed), **time scope**, and any missing-data status. The annual view must not turn records into unsupported achievements or infer professional development, parent contact, teaching quality, or strategy use.

| Section | Current source and coverage | Classification / limits |
|---|---|---|
| Teacher and school identity | `profile.teacherName`, `schoolName`, `reportPrincipalName`/legacy `principalName`, phone and education department (`src/models.js:583-599`); report header consumes account/class identity (`src/views/reports.js:127-155`). | Auto-derived from profile, but names/school are user-entered values, not externally verified. Missing values display “غير مسجل”; never invent school/principal. |
| Teaching loads and timetable | `years`, `terms`, `subjects`, `sections`, `teachings`, `slots` models (`src/models.js:632-696, 769-775`); timetable queries `slotsOf`/`allSlots` (`src/store.js:1854-1869`). | Auto-derived planned assignments/slots, not proof that classes occurred. Filter by selected year and preserve archived context. |
| Lesson preparation and delivery | Curriculum `units`/`lessons` and dated `sessions` (`src/models.js:783-800, 822-840`). No prep/approval/receipt/strategy-use evidence currently. | Future teacher-entered preparation/confirmation, provider receipt externally confirmed. Empty stays “لا توجد بيانات مسجلة”. |
| Assessments and projects | Teaching `items` with optional curriculum links (`src/models.js:720-745`); default categories include participation, homework, activities/projects, quizzes and final assessment (`src/models.js:915-924`); `scores` and `assignments/submissions` (`src/models.js:890-910`); grade/report view uses teaching context (`src/views/reports.js:127-155`). | Auto-derived records of configured criteria and recorded student results; not a teacher achievement or proof every learner completed work. Preserve absent scores as absent, not zero. |
| Participation | `logs` are student-linked; scoring supports participation-derived item values (`src/models.js:726-729, 974-1005`; `src/store.js:1509-1512`). | Auto-derived recorded events only. Do not infer unrecorded participation. |
| Attendance | `sessions`, `attendance` and store selectors (`src/store.js:1509-1512, 1610-1625`); report attendance is period-filtered (`src/views/reports.js:133-150, 245-250`). | Auto-derived recorded attendance, not lesson-preparation or teacher performance evidence. Empty period remains explicitly empty. |
| Reports | Existing roster/grades/attendance/support reports and closed-term report snapshots (`src/views/reports.js:111-155`; `src/models.js:875-888`; `src/store.js:2187-2214, 2365-2376`). | Auto-derived/exported report artifacts. Snapshot/version/source manifest enables version provenance; retain superseded versions and label the selected version rather than silently duplicate or merge them. |
| Parent contact | No accepted-send receipt/source identified in the scoped current models/store. | Not available. Do not create contact counts from phone numbers, notes, or generated message text. Future inclusion only from an actual accepted send receipt, with recipient redaction. |
| Certificates, photos, reflection | No teacher portfolio attachment/certificate/reflection model identified in the scoped current models. Existing student notes are student-linked, not teacher professional evidence (`src/models.js:842-853`). | Teacher-entered evidence only after an explicit future feature; retain supplied date/source and label unverified. Do not generate courses, certificates, photos or timestamps. |

### Year scope, duplicates, export and empty state

- Default portfolio scope is one explicit `yearId`; cross-year view requires a deliberate year selector. Resolve term/teaching/section through stored IDs, not the current active term alone.
- Keep immutable evidence IDs and source/version references. Re-exporting the same source/version should update its presentation reference, not create a duplicate achievement. Changed report/preparation versions remain traceable; expose superseded state.
- Export only the selected year and requested sections. Default to teacher/school identity and aggregate class summaries; omit student names, per-student grades, attendance, phone numbers, parent recipients, private notes, and attachment URLs unless a separately authorized purpose and explicit user choice permits them. Show the exact included sections before export.
- A section with no source records is “لا توجد بيانات مسجلة” (or “لم يُضف بعد” for manual evidence). Do not fill gaps with zero, guessed dates, generated accomplishments, implicit current timestamps, or claims based on plans.

## Scope and decision boundary

This is documentation only. It does not implement a wizard, portfolio, schema migration, provider adapter, Madrasati write, account access, extension, live read/write, or claim of official curriculum completeness. Tahdiri's observed public snapshot may inform a separately sourced competitor-content study; this contract makes no assertion about Tahdiri backend semantics or full curriculum coverage. The existing public snapshot reference, if needed for that independent study, is `artifacts/research/tahdiri-11.0.10-20261014/package/manifest.json` (snapshot version 22058, raw SHA-256 `ef64f1250f4d8285aa281a4acde58769771f15144d4855ee4a75cdf1c4ad7691`). Do not execute it, query endpoints, index URLs, or access browser profiles/secrets.

## Source map

Line references are to the current worktree source at this candidate base. The field-level inventory is also machine-readable in [LESSON_PORTFOLIO_FIELD_MATRIX.json](LESSON_PORTFOLIO_FIELD_MATRIX.json).

- `src/models.js:82-95` — stable year/term/subject/teaching/slot/session identities.
- `src/models.js:583-599` — profile identity and principal compatibility fields.
- `src/models.js:632-696` — year, term, subject, section, teaching models.
- `src/models.js:707-745` — enrollment, assessment item, optional curriculum links.
- `src/models.js:769-800` — recurring slot versus dated session fields/status.
- `src/models.js:822-853` — curriculum units/lessons and student notes.
- `src/models.js:875-910` — closed report versions, assignments and submissions.
- `src/store.js:1509-1512, 1610-1625, 1854-1869, 2106+` — attendance/session/slot/curriculum selectors.
- `src/store.js:2162-2214, 2365-2376` — live/historical teaching contexts and report snapshots.
- `src/views/reports.js:111-155, 245-272` — current report composition and truthful empty-data guards.
- `src/lib/rakeez-datetime.js` and `src/lib/rakeez-datetime-values.js` — approved shared date-input adapter/value policy.
