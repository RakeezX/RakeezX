import test from 'node:test';
import assert from 'node:assert/strict';
import { quickLogAttendanceState } from '../src/models.js';

const roster = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const sessions = [{ id: 'early', period: 1 }, { id: 'late', period: 2 }];

function states(records) {
  return quickLogAttendanceState(roster, sessions, (id) => records[id] ?? []);
}

test('Quick Log keeps roster order within availability groups and resolves recorded attendance only', () => {
  const result = states({
    early: [{ studentId: 'a', status: 'absent' }, { studentId: 'b', status: 'absent' }, { studentId: 'c', status: 'excused' }],
    late: [{ studentId: 'a', status: 'present' }, { studentId: 'c', status: 'present' }],
  });
  const ordered = [...result.filter((x) => !x.unavailable), ...result.filter((x) => x.unavailable)];
  assert.deepEqual(ordered.map((x) => x.student.id), ['a', 'c', 'd', 'b']);
  assert.equal(result.find((x) => x.student.id === 'a').status, 'present');
  assert.equal(result.find((x) => x.student.id === 'b').status, 'absent');
  assert.equal(result.find((x) => x.student.id === 'c').status, 'present');
});

test('Quick Log does not let an unrecorded later session erase earlier absence', () => {
  const result = states({ early: [{ studentId: 'a', status: 'absent' }], late: [] });
  assert.deepEqual(result.find((x) => x.student.id === 'a'), { student: roster[0], status: 'absent', unavailable: true });
});