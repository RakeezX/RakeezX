# N88 canonical student projection — inactive implementation module

AI-authored for task `continuous-n88-canonical-student-projection-20261018`, run `dda1a75e-762c-452c-8f1c-709cc7bd74d0`.
Base and observed remote main: `8ff59100ead8802dec7ebb7f7d4f4d41c2c89f8c` (`git ls-remote origin refs/heads/main` on 18 October 2026). Read canonical operating contract, activated card, current canonical N88 ledger row including PO12:47 and source at that origin/main. The checkout ledger contains older notes; the canonical latest row supplies the corrected integrated-class direction.

## Callable contract

`drafts/n88-student-portal/student-projection.mjs` exports:

- `projectStudentPortal({ownerId,studentId,enrollmentId,classId,termId,now,canonical,visibility})` → exactly the `n88-student-v3` output contract. `now` is the explicit current teacher-calendar `YYYY-MM-DD`, computed by the trusted caller, never a student-request override. There are no new date inputs or pickers.
- `studentPortalPublicationBindings(input)` → internal scope/source revision stamps for a deliberate teacher publication. These are private preparation data, never part of the student response.
- `studentPortalProjectionQuality(input)` → internal provenance, supported coverage and exact unavailable-source requirements. Do not send this diagnostic or exception properties to a student.
- `CANONICAL_PROJECTION_REQUIREMENTS` → versioned adapter table requirements and unsupported-family explanations.

`visibility-policy.mjs` exports `validateVisibilityPolicy`, `VISIBILITY_FIELDS` and `VISIBILITY_VERSION`. Unknown keys, non-boolean field choices, malformed/duplicate grants and duplicate publication identifiers fail validation. Validation returns a detached copy, never mutates inputs.

Policy shape (private server representation):

```js
{
  version: 'n88-visibility-v1',
  ownerId, studentId, enrollmentId, classId, termId,
  scopeStamp, // current binding computed by this module
  fields: { name: true, class: true, grades: true,
            required: true, completed: true, scheduled: true },
  sources: [{ kind: 'item', sourceId, publicationId, stamp },
            { kind: 'subitem', sourceId, publicationId, stamp }]
}
```

Only explicit `true` enables a field; omitted fields are OFF. Missing policy returns `{version}` only. Only exact current source grants publish rows. `publicationId` must be a server-generated opaque UUID, never a raw/composite student, owner, enrollment or canonical source identifier. Do not accept scope, policy or stamps from student JSON. The teacher command must derive identity from the existing owner-bound Auth/session/lease guard. Policy editing belongs inside the existing class, not a separate teacher system.

Hidden profile properties, grades, work families and empty parent containers are absent on the server. The output never spreads source objects. Work has only opaque id, canonical subitem title, approved start/due dates and canonical completion state. Notes, editorial instruction/status/deadline, owner/student/enrollment IDs, stamps, raw scores/attendance/logs and private metadata cannot pass through. No scoring notes or arbitrary strings are used as identifiers.

## Real source contracts and mapping

Read-only sources: `src/models.js` (`makeEnrollment`, `makeItem`, `makeScoreSubitem`, `makeScoreSubitemCompletion`, `itemScore`, `studentTotal`, `sectionLabel`); `src/lib/score-foundation.js`; `src/store.js` (`portableScoresByItem`, `portableAutomaticByItem`, `preparedScore`, `studentContext`); migrations `0001`, `0012`, `0021`, `0033` and `20261012234116_n94_subitem_dates_late_scoring.sql`; existing N88 canonical adapter/repository/proposals. Applied/proposed SQL and shared code remain unchanged.

The input is a complete bounded current server snapshot with these **camel-case model rows**, not portal membership/editorial copies. Every row needs `id`, explicit `ownerId`, positive decimal integer `revision`, `deleted` boolean, and mapped `deletedAt` when present. Map `deleted_at != null` to `deleted`; never infer missing lifecycle fields as active. Parse PostgreSQL numeric grading fields into finite numbers, retain SQL NULL as JS null, keep revisions as decimal strings, and preserve date strings. Every listed array is required even when empty; missing/truncated families fail closed. Strict per-table ceiling is 10,000 rows; integration should use its existing tighter row/byte/time limits.

| Input array / real table | Needed fields in addition to common metadata |
| --- | --- |
| `years` / `years` | `status` |
| `terms` / `terms` | `yearId <- year_id`, `status`, `startDate <- start_date`, `endDate <- end_date` |
| `sections` / `sections` | `yearId`, `grade`, `label`, `status`, `archivedAt <- archived_at` |
| `students` / `students` | `name`, `status`; exclude private note |
| `enrollments` / `enrollments` | `studentId`, `sectionId`, `status`, `startDate`, `endDate` |
| `teachings` / `teachings` | `sectionId`, `termId`, `subjectId` |
| `items` / `items` | `teachingId`, `name`, `max`, `order`, `auto`, `perPoint`, `penalty`, `scoreMode`, `portabilityGroupId` |
| `scores` / `scores` | `studentId`, `itemId`, `value`, `manualValue`, `derivedValue` |
| `scoreSubitems` / `score_subitems` | `itemId`, `name`, `value`, `order`, `startDate`, `dueDate`, `latePoints` |
| `scoreSubitemCompletions` / `score_subitem_completions` | `studentId`, `subitemId`, `checked`, `completionState` |
| `sessions` / `sessions` | `teachingId`, `date`, `status` |
| `attendance` / `attendance` | `studentId`, `teachingId`, `sessionId`, `status` |
| `logs` / `logs` | `studentId`, `teachingId`, `kind`, `delta` |

Remaining camel-case fields map directly from corresponding snake-case columns. Enrollment has **no term_id**: it is student/section-bound; section year must equal selected term year. The caller must resolve the exact current term from trusted service state rather than selecting the first active term. The module requires one current active enrollment in that year, matching the supplied enrollment/class/student. It rejects an ended/future membership, foreign owner, archived/deleted/inactive source parent, expired/future term or duplicate identity. Current scope is never a union of terms/classes.

## Grade and work semantics

The module imports `itemScore`, `studentTotal`, `sectionLabel`, `sortByOrder`, `projectSubitemScore`, `subitemCompletionState` and `normalizeSubitemDatesAndPoints` directly from the existing model. There is no copied scoring arithmetic. Subitem projection must equal the persisted teacher value; an inconsistent atomic score snapshot is unavailable instead of silently displaying a different grade. Direct, automatic participation/attendance, regular/late subitems, manual top-up, missing and zero are exercised. The existing model's `excused` attendance is not an absence/penalty; there is no invented generic grade-exemption field.

`grades.total.possible` maps to teacher `studentTotal.outOfGraded`; missing items remain null and do not enter that denominator. A partial item publication omits total so that a subset does not masquerade as the full teacher total. Grade status is only recorded/unrecorded, not pass/fail or achievement inference.

**Explicit coverage boundary:** transferred/portable-grade items with `portabilityGroupId` require the existing store's exact portable manual/automatic context logic, which is not currently exported as a pure resolver. The module raises `n88_projection_unavailable` with that exact internal requirement when such a grade is published; it never uses direct/first/union fallback or duplicates those rules. Integration must preserve this fail-closed result unless it supplies a separately implemented and tested reuse of that existing resolver. This source module does not certify portable-grade display. `studentPortalProjectionQuality` exposes this limitation internally.

Supported canonical work is current subitem definitions under current class/term items. `checked=true` plus core `completion_state` gives regular/late completion. Unrecorded work with a future **start** is scheduled; other unrecorded work is required. A future due date alone is not a future start. Passing a deadline never marks done. A saved completion stays completed regardless of current time. The old portal `todo/working/done`, title/instruction/deadline and `published` copies cannot establish source completion. Deferred `assignments/submissions` have no active teacher completion workflow and are explicitly unavailable; there is no fabricated assignment/achievement/transcript family. A direct grade item is not automatically a task.

Scope stamps cover identities and current revisions of year/term/class/student/enrollment/teachings. Source stamps bind the current item revision, or subitem plus parent item revisions. Deletion removes rows; a restore's new revision cannot match an old grant. Current source changes require a deliberate current teacher grant. Canonical scores/completions can update under that current definition without republishing each mark. Correct revision advancement by canonical writers is a required existing server invariant.

## Integration query/locking requirements

This module performs no query, persistence, Auth operation, network call, route registration or activation. The existing canonical adapter currently supplies fewer fields/tables; it cannot be presented as already satisfying this expanded contract. The independent integration card owns that shared graph.

Before projecting, the trusted service must retain current server Auth/session, context, owner lease, credential version/revocation/expiry, membership revision/lineage and stale-result checks in the same transaction. A valid pure projection is not session authorization. Resolve exactly one membership/term, then fetch only the allowlisted columns above with explicit owner/FK equality on every join. Read only own score/completion/attendance rows, current-teaching participation-presence evidence and own logs. A class-level participation boolean may replace detailed other-student logs at integration; never send those logs to the client. No SELECT-star response, cross-owner scan, supplied browser owner, union fallback or frontend-only visibility check.

Keep existing deterministic context → canonical membership/parents → credential/session/publication lock order. Extend the canonical lock/query allowlist only in integration for the exact score/subitem/session/attendance/log columns needed above, in deterministic owner/table/id order. Guard absent-row/phantom writes with the existing canonical writer protocol or a justified transactional snapshot and final revision recheck; row locks alone do not cover missing records. Bound bytes, rows and time before materializing; reject truncation. Read policy and data in the same checkpoint; check again before emitting a result after a possible reload/concurrent source change. Never use a previously ready document or cached lineage as a current authorization.

Private policy persistence is intentionally a validated representation here. No new policy table/SQL privilege or repository write is introduced by this pure module, so no new SQL proposal or PG cluster is needed for its checks. Integration must explicitly round-trip this representation through its scoped private repository with default OFF, atomic teacher-only updates and current lineage; it must not claim the existing fixed-column repository already stores it. If that integration needs schema/privileges, its proposal remains inactive and must receive its exact applicable verification/authority. The original applied/staged SQL history is untouched.

## Affected verification and disposition

`node --test tests/n88-student-projection.test.mjs`: **27/27 PASS**. The two required checks are named tests:

- `n88_projection_matches_existing_teacher_scoring_and_canonical_task_states`
- `n88_projection_server_visibility_current_membership_and_lifecycle_isolation`

Additional cases exercise all 64 visibility choices, publication subsets, actual helper equivalence/null/zero/late/excused attendance, foreign rows with colliding IDs, another student's completions/grades, ambiguous/ended/future membership, term/class/year lifecycle, duplicates, missing arrays, delete/restore/source edits, unsupported portability and inconsistent atomic scores. No browser/UI PASS is claimed: this is a pure server module without DOM or runtime changes. No browser/server phase resources were acquired. No new private storage was added; existing SQL isolation evidence is unchanged, not rerun or relabeled.

`node --check` on both modules and `git diff --check`: PASS. The initial synthetic fixture omitted ordering fields; the first run exposed an ordering mismatch, corrected by adding real model `order` values to fabricated rows. Production scoring code was not changed.

Hosted access, service/schema/Auth/RLS changes, real identities/codes/messages, provider/Production checks and final integrated usability: **NOT_RUN / not activated**. No push/deploy or Product acceptance/closure. This candidate contains only the bounded inactive module and affected synthetic tests/evidence.
