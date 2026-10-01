import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {
  makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeStudent,
  makeEnrollment, makeSession, makeSlot,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

const REF = new Date('2026-08-24T12:00:00');

async function setup() {
  await db.clearAll();
  await store.init();
  const year = makeYear({ id: 'y:attendance-completeness', hijriStart: 1450 });
  const term = makeTerm({ id: 'tm:attendance-completeness', yearId: year.id, index: 1, startDate: '2026-08-01', endDate: '2026-09-30' });
  const subject = makeSubject({ id: 'sub:attendance-completeness', name: 'اختبار الحضور', slug: 'attendance-completeness' });
  const section = makeSection({ id: 'sec:attendance-completeness', yearId: year.id, grade: 4, label: 'أ' });
  const teaching = makeTeaching({ id: 'tch:attendance-completeness', sectionId: section.id, subjectId: subject.id, termId: term.id });
  const students = [
    makeStudent({ id: 'std:attendance-a', name: 'طالب أ' }),
    makeStudent({ id: 'std:attendance-b', name: 'طالب ب' }),
  ];
  const enrollments = students.map((student, index) => makeEnrollment({ id: `en:${student.id}:${section.id}`, studentId: student.id, sectionId: section.id, rollNo: index + 1 }));
  const slot = makeSlot({ id: 'sl:attendance-completeness', teachingId: teaching.id, weekday: 0, period: 1 });
  const past = makeSession({ id: 'ses:past', teachingId: teaching.id, slotId: slot.id, date: '2026-08-23', period: 1, startTime: '07:00', endTime: '07:45' });
  const future = makeSession({ id: 'ses:future', teachingId: teaching.id, date: '2026-08-24', period: 2, startTime: '15:00', endTime: '15:45' });
  const holiday = makeSession({ id: 'ses:holiday', teachingId: teaching.id, date: '2026-08-24', period: 3, startTime: '08:00', endTime: '08:45', status: 'cancelled_holiday' });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students, enrollments, slots: [slot], sessions: [past, future, holiday] });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id });
  return { teaching, students, slot, past, future, holiday };
}

test('attendance completeness derives future, pending, completed, and excluded sessions from historical session data', async () => {
  try {
    const f = await setup();
    assert.equal(store.attendanceCompleteness(f.future, REF).state, 'future');
    assert.equal(store.attendanceCompleteness(f.past, REF).state, 'pending');
    assert.equal(store.attendanceCompleteness(f.holiday, REF).state, 'excluded');

    await store.setAttendance(f.past.id, f.students[0].id, 'present');
    assert.equal(store.attendanceCompleteness(store.getSession(f.past.id), REF).state, 'pending');
    await store.fillAttendance(f.past.id, 'present');
    assert.equal(store.attendanceCompleteness(store.getSession(f.past.id), REF).state, 'completed');
    assert.equal(store.getSession(f.past.id).status, 'held');

    const summary = store.attendanceCompletenessFor(f.teaching.id, '2026-08-24', REF);
    assert.deepEqual(summary, { sessions: 1, completed: 0, pending: 0, future: 1 });
  } finally {
  }
});

test('completeness persists and remains tied to the historical session after a recurring slot edit', async () => {
  try {
    const f = await setup();
    await store.fillAttendance(f.past.id, 'present');
    const before = store.attendanceCompleteness(store.getSession(f.past.id), REF);
    await store.editSlot(f.slot.id, { teachingId: f.teaching.id, weekday: 1, period: 4 });
    assert.deepEqual(store.attendanceCompleteness(store.getSession(f.past.id), REF), before);
    assert.equal(store.getSession(f.past.id).slotId, f.slot.id);

    store.state.ready = false;
    await store.init();
    assert.equal(store.attendanceCompleteness(store.getSession(f.past.id), REF).state, 'completed');
    assert.equal(store.attendanceIn(f.past.id).length, 2);
  } finally {
  }
});

test('server seconds time marks an incomplete ended session due without changing records', async () => {
  const f = await setup();
  const session = { ...f.future, date: '2026-08-24', startTime: '07:15:00', endTime: '08:01:00' };
  const before = structuredClone(session);
  for (const time of ['09:33:00', '19:25:00']) {
    const result = store.attendanceCompleteness(session, new Date(`2026-08-24T${time}`));
    assert.deepEqual({ state: result.state, expected: result.expected, recorded: result.recorded }, { state: 'pending', expected: 2, recorded: 0 });
  }
  assert.equal(store.attendanceCompleteness(session, new Date('2026-08-24T08:00:59')).state, 'future');
  assert.equal(store.attendanceCompleteness(session, new Date('2026-08-24T08:01:00')).state, 'pending');
  assert.deepEqual(session, before);
});

test('supported minute, second and fractional end times preserve partial and complete attendance', async () => {
  const f = await setup();
  for (const [endTime, before, at] of [
    ['08:01', '08:00:59', '08:01:00'],
    ['08:01:00', '08:00:59', '08:01:00'],
    ['08:01:00.250', '08:01:00.249', '08:01:00.250'],
    ['08:01:00.250000', '08:01:00.249', '08:01:00.250'],
  ]) {
    const session = { ...f.past, date: '2026-08-24', endTime };
    assert.equal(store.attendanceCompleteness(session, new Date(`2026-08-24T${before}`)).state, 'future', endTime);
    assert.equal(store.attendanceCompleteness(session, new Date(`2026-08-24T${at}`)).state, 'pending', endTime);
    assert.equal(store.attendanceCompleteness(session, new Date('2026-08-24T09:33:00')).state, 'pending', endTime);
  }
  await store.setAttendance(f.past.id, f.students[0].id, 'present');
  const partial = store.attendanceCompleteness({ ...store.getSession(f.past.id), date: '2026-08-24', endTime: '08:01:00' }, new Date('2026-08-24T19:25:00'));
  assert.equal(partial.state, 'pending');
  assert.equal(partial.recorded, 1);
  await store.fillAttendance(f.past.id, 'present');
  const completed = store.attendanceCompleteness({ ...store.getSession(f.past.id), date: '2026-08-24', endTime: '08:01:00.250' }, new Date('2026-08-24T19:25:00'));
  assert.equal(completed.state, 'completed');
  assert.equal(completed.recorded, 2);
});

test('missing and invalid times retain existing fallback; excluded sessions remain excluded', async () => {
  const f = await setup();
  const base = { ...f.future, date: '2026-08-24' };
  assert.equal(store.attendanceCompleteness({ ...base, endTime: '', startTime: '' }, new Date('2026-08-24T19:25:00')).state, 'future');
  assert.equal(store.attendanceCompleteness({ ...base, endTime: '', startTime: '' }, new Date('2026-08-24T23:59:00')).state, 'pending');
  assert.equal(store.attendanceCompleteness({ ...base, endTime: 'not-a-time' }, new Date('2026-08-24T19:25:00')).state, 'future');
  for (const status of ['cancelled_holiday', 'cancelled', 'missed', 'postponed']) {
    assert.equal(store.attendanceCompleteness({ ...base, endTime: '08:01:00', status }, new Date('2026-08-24T19:25:00')).state, 'excluded');
  }
});

after(async () => {
  store.closeChannel();
  await db.closeDB();
});
