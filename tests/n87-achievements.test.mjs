import test from 'node:test';
import assert from 'node:assert/strict';
import { studentAchievements } from '../src/lib/student-achievements.js';

test('factual achievements exclude other students, deleted/unsupported evidence and invalid maxima without mutating input', () => {
  const event = (record) => ({ record: { studentId: 'A', ...record } });
  const input = {
    studentId: 'A',
    history: {
      logs: [event({ kind: 'participation', delta: 2 }), event({ kind: 'participation', delta: -1 }),
        event({ kind: 'behavior', delta: 1 }), event({ kind: 'participation', delta: 1, deleted: true }),
        event({ kind: 'participation', delta: 1, studentId: 'B' }), event({ kind: 'participation', delta: NaN })],
      attendance: ['present', 'late', 'absent', 'excused'].map(status => event({ status }))
        .concat(event({ status: 'present', studentId: 'B' }), event({ status: 'present', deleted: true })),
    },
    items: ['full', 'partial', 'missing', 'overflow', 'deleted', 'other', 'auto', 'zero'].map(id =>
      ({ id, max: id === 'zero' ? 0 : 10, deleted: id === 'deleted', auto: id === 'auto' ? 'attendance' : null })),
    gradeCtx: { scoresByItem: Object.fromEntries(['full', 'partial', 'overflow', 'deleted', 'other', 'zero'].map(id =>
      [id, { studentId: id === 'other' ? 'B' : 'A', value: id === 'partial' ? 8 : id === 'overflow' ? 100 : id === 'zero' ? 0 : 10 }])) },
  };
  const before = structuredClone(input);
  assert.deepEqual(studentAchievements(input).map(({ key, count }) => [key, count]),
    [['participation', 1], ['attendance', 1], ['scores', 1]]);
  assert.deepEqual(input, before);
  assert.deepEqual(studentAchievements({ studentId: 'A', history: { logs: [], attendance: [] }, items: [], gradeCtx: {} }), []);
});
