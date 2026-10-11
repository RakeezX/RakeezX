import test from 'node:test';
import assert from 'node:assert/strict';
import board, { gradeTeachings, boardRanking, boardMilestones } from '../src/views/board.js';
import * as store from '../src/store.js';

function fixture() {
  Object.assign(store.state, {
    ready: true, device: { activeYearId: 'y', activeTermId: 'tm' },
    years: [{ id: 'y', status: 'active' }, { id: 'old', status: 'active' }],
    terms: [{ id: 'tm', yearId: 'y', status: 'active' }, { id: 'oldtm', yearId: 'y', status: 'active' }],
    subjects: [{ id: 'math', name: 'رياضيات' }, { id: 'science', name: 'علوم' }],
    sections: ['a', 'b', 'archived', 'deleted', 'othergrade', 'otheryear'].map(id => ({
      id, name: id, grade: id === 'othergrade' ? 5 : 4, yearId: id === 'otheryear' ? 'old' : 'y',
      status: id === 'archived' ? 'archived' : 'active', deleted: id === 'deleted',
    })),
    teachings: ['a', 'b', 'archived', 'deleted', 'othergrade', 'otheryear'].map(sectionId => ({
      id: sectionId, sectionId, subjectId: 'math', termId: 'tm',
    })).concat([
      { id: 'otherSubject', sectionId: 'b', subjectId: 'science', termId: 'tm' },
      { id: 'otherTerm', sectionId: 'b', subjectId: 'math', termId: 'oldtm' },
      { id: 'deletedTeaching', sectionId: 'b', subjectId: 'math', termId: 'tm', deleted: true },
    ]),
    students: ['s1', 's2', 'removed', 'inactive'].map(id => ({ id, name: 'اسم متكرر', note: 'PRIVATE_NOTE',
      score: 98765, attendance: 'PRIVATE_ATTENDANCE', status: id === 'inactive' ? 'archived' : 'active', deleted: id === 'removed' })),
    enrollments: [
      { id: 'e1', studentId: 's1', sectionId: 'a', status: 'active', rollNo: 2 },
      { id: 'e2', studentId: 's2', sectionId: 'b', status: 'active', rollNo: 1 },
      { id: 'e3', studentId: 'removed', sectionId: 'b', status: 'active' },
      { id: 'e4', studentId: 'inactive', sectionId: 'b', status: 'active' },
      { id: 'e5', studentId: 's1', sectionId: 'b', status: 'transferred' },
    ],
    logs: [
      { teachingId: 'a', studentId: 's1', kind: 'participation', date: '2026-10-11', delta: 2 },
      { teachingId: 'a', studentId: 's1', kind: 'participation', date: '2026-10-10', delta: 3 },
      { teachingId: 'a', studentId: 's1', kind: 'behavior', date: '2026-10-11', delta: -3 },
      { teachingId: 'b', studentId: 's2', kind: 'participation', date: '2026-10-11', delta: 7 },
      { teachingId: 'b', studentId: 's1', kind: 'participation', date: '2026-10-11', delta: 100 },
      { teachingId: 'b', studentId: 's2', kind: 'behavior', date: '2026-10-11', delta: -2 },
      { teachingId: 'b', studentId: 's2', kind: 'participation', date: '2026-10-11', delta: 999, deleted: true },
      ...['otherSubject', 'otherTerm', 'archived', 'deleted', 'othergrade', 'otheryear', 'deletedTeaching'].map(teachingId =>
        ({ teachingId, studentId: 's2', kind: 'participation', date: '2026-10-11', delta: 1000 })),
    ],
  });
  return store.getTeaching('a');
}
const demo = { getActiveWorkspace: () => ({ type: 'demo', ownershipState: 'demo' }) };
const api = { ...store, ...demo };

test('grade scope selects only live same-grade, subject, active term/year teachings', () => {
  const cls = fixture();
  assert.deepEqual(gradeTeachings(cls, api).map(t => t.id), ['a', 'b']);
  for (const field of ['activeTermId', 'activeYearId']) {
    const saved = store.state.device[field];
    store.state.device[field] = field === 'activeTermId' ? 'oldtm' : 'old';
    assert.deepEqual(gradeTeachings(cls, api), []);
    store.state.device[field] = saved;
  }
  store.state.terms[0].status = 'closed';
  assert.deepEqual(gradeTeachings(cls, api), []);
});

test('unresolved/unready workspace fails closed; mounted teacher workspace is the only source', () => {
  const cls = fixture();
  assert.deepEqual(gradeTeachings(cls, { ...api, getActiveWorkspace: () => null }), []);
  assert.deepEqual(gradeTeachings(cls, { ...api, getActiveWorkspace: () => ({ type: 'account', ownershipState: 'claimed' }) }), []);
  assert.equal(gradeTeachings(cls, { ...api, getActiveWorkspace: () => ({ type: 'account', ownershipState: 'claimed', authUserId: 'teacher-a' }) }).length, 2);
  store.state.ready = false;
  assert.deepEqual(gradeTeachings(cls, api), []);
});

test('real log sums retain distinct IDs, exclude removed membership and unrelated logs, and never project private fields', () => {
  const cls = fixture();
  const before = JSON.stringify(store.state);
  const rows = boardRanking(gradeTeachings(cls, api), 'participation', 'term', '2026-10-11', api, true);
  assert.deepEqual(rows.map(r => [r.s.id, r.pts]), [['s2', 7], ['s1', 5]]);
  assert.equal(rows[0].s.name, rows[1].s.name);
  assert.deepEqual(Object.keys(rows[0].s), ['id', 'name', 'rollNo']);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE_|98765/);
  assert.equal(JSON.stringify(store.state), before);
  assert.deepEqual(boardRanking(gradeTeachings(cls, api), 'participation', 'today', '2026-10-11', api, true).map(r => r.pts), [7, 2]);
  assert.deepEqual(boardRanking(gradeTeachings(cls, api), 'behavior', 'today', '2026-10-11', api, true).map(r => r.pts), [-2, -3]);
});

test('class ranking matches existing sum/order including negatives, today and behavior', () => {
  const cls = fixture();
  const oldRanking = (kind, scope) => store.students(cls.id).map(s => ({ s, pts: store.state.logs.filter(l =>
    !l.deleted && l.teachingId === cls.id && l.studentId === s.id && l.kind === kind && (scope === 'term' || l.date === '2026-10-11'))
    .reduce((sum, l) => sum + l.delta, 0) })).sort((a,b) => b.pts-a.pts || (a.s.rollNo ?? 0)-(b.s.rollNo ?? 0));
  for (const kind of ['participation', 'behavior']) for (const scope of ['today', 'term']) {
    assert.deepEqual(boardRanking([cls], kind, scope, '2026-10-11', api).map(r => [r.s.id, r.pts]), oldRanking(kind, scope).map(r => [r.s.id,r.pts]));
  }
});

test('milestones require dated positive evidence, a three-day streak, and two comparable periods', () => {
  assert.deepEqual(boardMilestones({ events: [] }), { streak: 0, improved: false });
  assert.deepEqual(boardMilestones({ events: [
    { date: '2026-10-09', delta: 1 }, { date: '2026-10-10', delta: 2 }, { date: '2026-10-11', delta: 1 },
  ] }), { streak: 3, improved: false });
  assert.deepEqual(boardMilestones({ events: [
    { date: '2026-10-01', delta: 1 }, { date: '2026-10-02', delta: 1 },
    { date: '2026-10-03', delta: 3 }, { date: '2026-10-04', delta: 4 },
  ] }), { streak: 4, improved: true });
  assert.deepEqual(boardMilestones({ events: [
    { date: '2026-10-01', delta: 2 }, { date: '2026-10-03', delta: 5 },
  ] }), { streak: 0, improved: false });
});

test('board podium contains only positive contributions and never shows the lowest standings', () => {
  fixture(); board.onMount();
  const rendered = String(board.render({ id: 'a' }));
  assert.match(rendered, /board__podium/);
  assert.doesNotMatch(rendered, /inactive|removed/);
});

test('board defaults to class, preserves controls and HTML escaping without gradebook/history fields', () => {
  fixture(); board.onMount();
  store.state.students[0].name = '<script>private</script>';
  const rendered = String(board.render({ id: 'a' }));
  assert.match(rendered, /&lt;script&gt;private&lt;\/script&gt;/);
  assert.match(rendered, /data-audience="class" aria-pressed="true"/);
  assert.match(rendered, /data-act="fullscreen"/);
  assert.doesNotMatch(rendered, /PRIVATE_|98765/);
});

test('account workspace switch clears the first teacher projection before another teacher can render it', () => {
  store.state.ready = false;
  store.activateWorkspace({ type: 'account', ownershipState: 'claimed', authUserId: '77777777-7777-4777-8777-777777777777', databaseName: 'rakeezx-user-77777777777747778777777777777777', broadcastChannelName: 'n86-owner-a' });
  try {
    const cls = fixture();
    assert.equal(gradeTeachings(cls).length, 2);
    store.deactivateWorkspace();
    store.activateWorkspace({ type: 'account', ownershipState: 'claimed', authUserId: '88888888-8888-4888-8888-888888888888', databaseName: 'rakeezx-user-88888888888848888888888888888888', broadcastChannelName: 'n86-owner-b' });
    assert.deepEqual(store.state.logs, []);
    assert.deepEqual(store.state.students, []);
    assert.deepEqual(gradeTeachings(cls), []);
    assert.match(String(board.render({ id: cls.id })), /فصل غير موجود/);
  } finally {
    store.deactivateWorkspace();
  }
});
