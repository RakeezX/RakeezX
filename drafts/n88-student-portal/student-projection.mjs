import { canonicalGradeContext } from './canonical-grade-context.mjs';
// AI: callable inactive server projection. Does not authorize a session or query.
import { createHash } from 'node:crypto';
import { itemScore, studentTotal, sectionLabel, sortByOrder } from '../../src/models.js';
import { projectSubitemScore, subitemCompletionState, normalizeSubitemDatesAndPoints } from '../../src/lib/score-foundation.js';
import { validateVisibilityPolicy } from './visibility-policy.mjs';

export const STUDENT_PROJECTION_VERSION = 'n88-student-v3';
export const CANONICAL_PROJECTION_REQUIREMENTS = Object.freeze({
  version: 'n88-canonical-projection-v1',
  tables: ['years', 'terms', 'sections', 'students', 'enrollments', 'teachings', 'items',
    'scores', 'scoreSubitems', 'scoreSubitemCompletions', 'sessions', 'attendance', 'logs'],
  unavailable: {
    assignments: 'Deferred assignments/submissions have no active teacher completion workflow; do not substitute portal todo/done.',
    portableGrades: 'Items with portabilityGroupId require the exact src/store.js portableScoresByItem/portableAutomaticByItem context resolver, not a first/union fallback.',
  },
});
const deny = (requirement = 'current_membership_and_policy') => {
  const error = new Error('n88_projection_unavailable'); error.requirement = requirement; throw error;
};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const active = row => row && row.deleted === false && row.deletedAt == null && row.archivedAt == null && row.status !== 'archived';
const revision = row => {
  if (!/^[1-9][0-9]*$/.test(String(row?.revision ?? ''))) deny('canonical_revision');
  return [row.id, String(row.revision)];
};
const date = value => {
  if (value == null) return null;
  return normalizeSubitemDatesAndPoints({ value: 0, startDate: value }).startDate;
};
const scopeKeys = ['ownerId', 'studentId', 'enrollmentId', 'classId', 'termId'];

/** Input is server-owned, explicitly camel-mapped canonical rows, never portal
 * editorial copies. Require complete bounded arrays (empty is distinct from absent).
 * The caller obtains all rows in one current locked transaction after Auth/lease.
 */
function readScope(input) {
  const { canonical: c, ownerId, studentId, enrollmentId, classId, termId, now } = input;
  if (!scopeKeys.every(key => typeof input[key] === 'string' && input[key]) ||
      typeof now !== 'string') deny();
  // Explicit teacher-calendar date, not implicit UTC/timezone conversion.
  const today = date(now);
  if (!today || !c) deny();
  const rows = {};
  for (const table of CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    if (!Array.isArray(c[table]) || c[table].length > 10000) deny(`complete_bounded_${table}`);
    rows[table] = c[table].filter(row => row.ownerId === ownerId);
    const ids = new Set();
    for (const row of rows[table]) {
      if (!row.id || ids.has(row.id) || typeof row.deleted !== 'boolean') deny('canonical_row_identity');
      ids.add(row.id); revision(row);
    }
  }
  const one = (table, id) => rows[table].find(row => row.id === id);
  const student = one('students', studentId), section = one('sections', classId), term = one('terms', termId);
  const year = one('years', section?.yearId), enrollment = one('enrollments', enrollmentId);
  if (![student, section, term, year, enrollment].every(active) ||
      [student, section, term, year, enrollment].some(row => row.status !== 'active') ||
      term.yearId !== section.yearId || enrollment.studentId !== studentId || enrollment.sectionId !== classId ||
      enrollment.endDate != null || (date(enrollment.startDate) && enrollment.startDate > today) ||
      (date(term.startDate) && term.startDate > today) || (date(term.endDate) && term.endDate < today)) deny();
  // Enrollment is year/section-bound, NOT term-bound in the real schema.
  const current = rows.enrollments.filter(row => active(row) && row.studentId === studentId && row.status === 'active' && row.endDate == null &&
    active(one('sections', row.sectionId)) && one('sections', row.sectionId).yearId === year.id);
  if (current.length !== 1 || current[0].id !== enrollmentId) deny('unique_current_enrollment');
  const teachings = rows.teachings.filter(row => active(row) && row.sectionId === classId && row.termId === termId);
  const items = sortByOrder(rows.items.filter(row => active(row) && teachings.some(t => t.id === row.teachingId)));
  const definitions = sortByOrder(rows.scoreSubitems.filter(row => active(row) && items.some(item => item.id === row.itemId && item.scoreMode === 'subitems')));
  const scopeStamp = digest(['n88-scope-v1', ...scopeKeys.map(key => input[key]),
    ...[year, term, section, student, enrollment].map(revision), ...teachings.sort((a,b) => a.id.localeCompare(b.id)).map(revision)]);
  const sourceStamp = (kind, row) => digest(['n88-source-v1', scopeStamp, kind, revision(row),
    ...(kind === 'subitem' ? [revision(items.find(item => item.id === row.itemId))] : [])]);
  return { rows, today, student, section, items, definitions, teachings, scopeStamp, sourceStamp };
}

/** For deliberate teacher policy preparation ONLY; never accept stamps from the
 * browser. Revision binding prevents deleted/restored sources silently republishing.
 */
export function studentPortalPublicationBindings(input) {
  const s = readScope(input);
  return { scopeStamp: s.scopeStamp, sources: [
    ...s.items.map(row => ({ kind: 'item', sourceId: row.id, stamp: s.sourceStamp('item', row) })),
    ...s.definitions.map(row => ({ kind: 'subitem', sourceId: row.id, stamp: s.sourceStamp('subitem', row) })),
  ] };
}

/** Internal integration diagnostics, NOT part of the student response. Makes
 * unavailable source families explicit without inventing work or score states.
 */
export function studentPortalProjectionQuality(input) {
  const s = readScope(input);
  return {
    version: 'n88-projection-quality-v1',
    grades: s.items.some(item=>item.portabilityGroupId) && input.teacherContextVersion!=='n88-canonical-teacher-context-v1' ? {available:false,requirement:CANONICAL_PROJECTION_REQUIREMENTS.unavailable.portableGrades} : { available: true, provenance: 'models.itemScore/studentTotal + score-foundation.projectSubitemScore; current canonical rows' },
    work: { available: true, provenance: 'score_subitems + own score_subitem_completions.checked/completion_state',
      coverage: 'Current subitem definitions only; required = unrecorded and not future start; completed = recorded regular/late; scheduled = unrecorded future start.',
      unavailable: CANONICAL_PROJECTION_REQUIREMENTS.unavailable.assignments },
  };
}

export function projectStudentPortal(input) {
  const s = readScope(input), { studentId, ownerId } = input;
  const out = { version: STUDENT_PROJECTION_VERSION };
  if (input.visibility == null) return out; // default: publish nothing
  const policy = validateVisibilityPolicy(input.visibility);
  if (scopeKeys.some(key => policy[key] !== input[key]) || policy.scopeStamp !== s.scopeStamp) deny();
  const enabled = key => policy.fields[key] === true;
  const grant = (kind, row) => policy.sources.find(source => source.kind === kind && source.sourceId === row.id && source.stamp === s.sourceStamp(kind, row));
  if (enabled('name')) out.profile = { name: s.student.name };
  if (enabled('class')) (out.profile ??= {}).classLabel = sectionLabel(s.section);

  if (enabled('grades')) {
    const published = s.items.filter(item => grant('item', item));
    // Only the integrated locked reader certifies complete teacher context.
    if(published.some(item=>item.portabilityGroupId) && input.teacherContextVersion!=='n88-canonical-teacher-context-v1') deny(CANONICAL_PROJECTION_REQUIREMENTS.unavailable.portableGrades);
    const contexts = new Map();
    for (const teaching of s.teachings) {
      const logs = s.rows.logs.filter(row => active(row) && row.teachingId === teaching.id);
      const sessions = s.rows.sessions.filter(row => active(row) && row.teachingId === teaching.id);
      const ctx = { ...canonicalGradeContext(s.rows,studentId,teaching.id), logs: logs.filter(row => row.studentId === studentId),
        classHasParticipation: logs.some(row => row.kind === 'participation'),
        attendance: s.rows.attendance.filter(row => active(row) && row.studentId === studentId && row.teachingId === teaching.id && sessions.some(session => session.id === row.sessionId)) };
      for (const item of published.filter(item => item.teachingId === teaching.id)) {
        const scores = s.rows.scores.filter(row => active(row) && row.studentId === studentId && row.itemId === item.id);
        if (scores.length > 1) deny('unique_student_item_score');
        const score = scores[0];
        if (item.scoreMode === 'subitems' && !item.auto) {
          const completions = s.rows.scoreSubitemCompletions.filter(row => active(row) && row.studentId === studentId);
          if (new Set(completions.map(row => row.subitemId)).size !== completions.length) deny('unique_student_subitem_completion');
          const projection = projectSubitemScore(item, s.definitions.filter(row => row.itemId === item.id),
            completions, score?.manualValue ?? null, { studentId, ownerId });
          // Core score commands save this projection atomically. Never show a
          // recalculated value different from the teacher's persisted grade.
          if (itemScore(item, { scoresByItem: { [item.id]: score } }) !== projection.value) deny('canonical_atomic_subitem_score');
          ctx.scoresByItem[item.id] = projection;
        } else if (score) ctx.scoresByItem[item.id] = score;
      }
      contexts.set(teaching.id, ctx);
    }
    out.grades = { items: published.map(item => {
      const value = itemScore(item, contexts.get(item.teachingId));
      return { id: grant('item', item).publicationId, label: item.name, value, max: item.max, status: value === null ? 'unrecorded' : 'recorded' };
    }) };
    // A partial publication cannot impersonate the full teacher total.
    if (published.length === s.items.length) {
      const totals = s.teachings.map(t => studentTotal(published.filter(item => item.teachingId === t.id), contexts.get(t.id)));
      out.grades.total = { earned: totals.reduce((n,t) => n + t.earned, 0), possible: totals.reduce((n,t) => n + t.outOfGraded, 0) };
    }
  }
  for (const family of ['required', 'completed', 'scheduled']) if (enabled(family)) (out.work ??= {})[family] = [];
  if (out.work) for (const definition of s.definitions) {
    const publication = grant('subitem', definition);
    if (!publication) continue;
    const completions = s.rows.scoreSubitemCompletions.filter(row => active(row) && row.studentId === studentId && row.subitemId === definition.id);
    if (completions.length > 1) deny('unique_student_subitem_completion');
    const completionState = subitemCompletionState(completions[0]);
    const { startDate, dueDate } = normalizeSubitemDatesAndPoints(definition);
    const family = completionState !== 'unrecorded' ? 'completed' : startDate && startDate > s.today ? 'scheduled' : 'required';
    if (enabled(family)) out.work[family].push({ id: publication.publicationId, title: definition.name, startDate, dueDate, completionState });
  }
  return out;
}
