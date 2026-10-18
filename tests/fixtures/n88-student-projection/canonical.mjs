// AI: fabricated canonical model fixture; no real accounts or student data.
import { projectSubitemScore } from '../../../src/lib/score-foundation.js';
export function fixture() {
  const row = (id, props = {}) => ({ id, ownerId: 'synthetic-owner', revision: '1', deleted: false, ...props });
  const canonical = {
    years: [row('year', { status: 'active' })],
    terms: [row('term', { yearId: 'year', status: 'active', startDate: '2026-08-01', endDate: '2027-01-01' })],
    sections: [row('class', { yearId: 'year', grade: 4, label: 'أ', status: 'active' })],
    students: [row('student', { name: 'طالب اصطناعي', status: 'active', note: 'PRIVATE_NOTE' }), row('other', { name: 'OTHER_NAME', status: 'active' })],
    enrollments: [row('enrollment', { studentId: 'student', sectionId: 'class', startDate: '2026-08-01', endDate: null, status: 'active' })],
    teachings: [row('teaching', { sectionId: 'class', termId: 'term', subjectId: 'subject' })],
    items: [
      row('direct', { name: 'مباشر', teachingId: 'teaching', max: 10, scoreMode: 'direct' }),
      row('zero', { name: 'صفر', teachingId: 'teaching', max: 10 }),
      row('missing', { name: 'لم يرصد', teachingId: 'teaching', max: 10 }),
      row('participation', { name: 'مشاركة', teachingId: 'teaching', max: 10, auto: 'participation', perPoint: 2 }),
      row('attendance', { name: 'حضور', teachingId: 'teaching', max: 10, auto: 'attendance', penalty: 2 }),
      row('subitems', { name: 'مهام', teachingId: 'teaching', max: 10, scoreMode: 'subitems' }),
    ],
    scores: [row('score-direct', { studentId: 'student', itemId: 'direct', value: 8 }), row('score-zero', { studentId: 'student', itemId: 'zero', value: 0 }),
      row('score-other', { studentId: 'other', itemId: 'missing', value: 9, note: 'OTHER_GRADE' })],
    scoreSubitems: [
      row('regular', { itemId: 'subitems', name: 'مكتمل', value: 2, dueDate: '2026-10-01' }),
      row('late', { itemId: 'subitems', name: 'مكتمل متأخر', value: 3, latePoints: 1, dueDate: '2026-10-01' }),
      row('overdue', { itemId: 'subitems', name: 'مطلوب متأخر', value: 2, dueDate: '2026-10-01' }),
      row('future', { itemId: 'subitems', name: 'قادم', value: 3, startDate: '2026-10-20', dueDate: '2026-10-25' }),
    ],
    scoreSubitemCompletions: [row('completion-regular', { studentId: 'student', subitemId: 'regular', checked: true }),
      row('completion-late', { studentId: 'student', subitemId: 'late', checked: true, completionState: 'late' }),
      row('completion-other', { studentId: 'other', subitemId: 'overdue', checked: true })],
    sessions: [row('session', { teachingId: 'teaching', date: '2026-10-01', status: 'held' }), row('session2', { teachingId: 'teaching', date: '2026-10-02', status: 'held' })],
    attendance: [row('att-excused', { studentId: 'student', teachingId: 'teaching', sessionId: 'session', status: 'excused' }),
      row('att-absent', { studentId: 'student', teachingId: 'teaching', sessionId: 'session2', status: 'absent' })],
    logs: [row('log', { studentId: 'student', teachingId: 'teaching', kind: 'participation', delta: 2 }),
      row('log-other', { studentId: 'other', teachingId: 'teaching', kind: 'participation', delta: 10 })],
  };
  canonical.items.forEach((item, index) => { item.order = index; });
  canonical.scoreSubitems.forEach((item, index) => { item.order = index; });
  canonical.scores.push(row('score-subitems', { studentId: 'student', itemId: 'subitems',
    ...projectSubitemScore(canonical.items.at(-1), canonical.scoreSubitems, canonical.scoreSubitemCompletions, 1, { studentId: 'student', ownerId: 'synthetic-owner' }) }));
  return { ownerId: 'synthetic-owner', studentId: 'student', enrollmentId: 'enrollment', classId: 'class', termId: 'term', now: '2026-10-18', canonical };
}
