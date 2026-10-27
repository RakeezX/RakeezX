/** AI-authored: fabricated records shaped like models.js. No actual account/store. */
export const scope = { ownerId: 'fake-owner', teachingId: 'fake-teaching', sectionId: 'fake-section', termId: 'fake-term', subjectId: 'fake-subject' };
const row = value => ({ ownerId: scope.ownerId, revision: 1, deleted: false, ...value });
export function fixture(count = 1) {
  return { scope: { ...scope }, data: {
    ownerId: scope.ownerId,
    teachings: [row({ id: scope.teachingId, sectionId: scope.sectionId, termId: scope.termId, subjectId: scope.subjectId })],
    sections: [row({ id: scope.sectionId, yearId: 'fake-year' })], terms: [row({ id: scope.termId, yearId: 'fake-year' })],
    items: [row({ id: 'work', teachingId: scope.teachingId, name: 'واجبات الرياضيات', scoreMode: 'subitems', max: 10, distributionVersion: 1 }),
      row({ id: 'exam', teachingId: scope.teachingId, name: 'اختبار مستقل', scoreMode: 'direct', max: 10 })],
    scoreSubitems: [row({ id: 'first', itemId: 'work', name: 'تمارين الكسور', value: 5, startDate: '2026-10-26', dueDate: '2026-10-30' }),
      row({ id: 'second', itemId: 'work', name: 'مراجعة الجمع', value: 5, startDate: null, dueDate: null })],
    students: Array.from({ length: count }, (_, i) => ({ id: `fake-pupil-${i}` })),
  } };
}
export const membership = (studentId = 'fake-pupil-0') => ({ scope: { ...scope }, active: true, studentId, enrollmentId: `enrollment-${studentId}`, revision: 'roster-1' });
export const publication = row => ({ scope: { ...scope }, rowId: row.id, sourceRevision: row.sourceRevision, state: 'confirmed',
  publicationRevision: 1, membershipRevision: 'roster-1', tombstone: false, decisions: { ...row.decisions } });
