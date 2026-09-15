import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {
  makeEnrollment, makeSection, makeSession, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

async function fixture() {
  await db.clearAll();
  await store.init();
  const year = makeYear({ id: 'history:year', hijriStart: 1450 });
  const term = makeTerm({ id: 'history:term', yearId: year.id, index: 1, startDate: '2026-08-01', endDate: '2026-10-01' });
  const subject = makeSubject({ id: 'history:subject', name: 'مادة السجل', slug: 'history-subject' });
  const x = makeSection({ id: 'history:X', yearId: year.id, grade: 4, label: 'أ' });
  const y = makeSection({ id: 'history:Y', yearId: year.id, grade: 4, label: 'ب' });
  const teachingX = makeTeaching({ id: 'history:teaching:X', sectionId: x.id, subjectId: subject.id, termId: term.id });
  const teachingY = makeTeaching({ id: 'history:teaching:Y', sectionId: y.id, subjectId: subject.id, termId: term.id });
  const a = makeStudent({ id: 'history:student:A', name: 'طالب أ' });
  const b = makeStudent({ id: 'history:student:B', name: 'طالب ب' });
  const c = makeStudent({ id: 'history:student:C', name: 'طالب ج' });
  const enrollments = [
    makeEnrollment({ id: 'history:en:A:X', studentId: a.id, sectionId: x.id, rollNo: 1, startDate: '2026-08-01' }),
    makeEnrollment({ id: 'history:en:B:X', studentId: b.id, sectionId: x.id, rollNo: 2, startDate: '2026-08-01' }),
    makeEnrollment({ id: 'history:en:C:Y', studentId: c.id, sectionId: y.id, rollNo: 1, startDate: '2026-08-01' }),
  ];
  const session = makeSession({ id: 'history:session:X', teachingId: teachingX.id, date: '2026-08-20', period: 1, status: 'scheduled' });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [x, y], teachings: [teachingX, teachingY], students: [a, b, c], enrollments, sessions: [session] });
  return { a, b, c, x, y, session };
}

test('first attendance freezes a session roster across transfer, return, and reload', async () => {
  const f = await fixture();

  await store.setAttendance(f.session.id, f.a.id, 'present');
  const initial = store.sessionRosterSnapshot(f.session.id);
  assert.deepEqual(initial?.members, [
    { studentId: f.a.id, rollNo: 1 },
    { studentId: f.b.id, rollNo: 2 },
  ], 'the first actual attendance mutation captures the active X roster');
  const command = (await db.getAll('outbox')).find((entry) => entry.command === 'attendance:record');
  assert.equal(command?.patch?.sessionId, f.session.id, 'Sync V2 queues the attendance command that atomically creates the server roster snapshot');

  assert.ok(await store.transferStudent(f.a.id, f.y.id, { date: '2026-08-21' }));
  assert.deepEqual(store.sessionRoster(f.session).members.map((student) => student.id), [f.a.id, f.b.id]);
  assert.equal(store.sessionRoster(f.session).members.some((student) => student.id === f.c.id), false, 'a later Y student is not added to old X');
  await store.fillAttendance(f.session.id, 'present');
  assert.deepEqual(store.attendanceIn(f.session.id).map((record) => record.studentId).sort(), [f.a.id, f.b.id].sort(), 'fill uses frozen members only');
  assert.equal(store.attendanceCompleteness(store.getSession(f.session.id)).expected, 2);

  assert.ok(await store.transferStudent(f.a.id, f.x.id, { date: '2026-08-22' }));
  assert.deepEqual(store.sessionRosterSnapshot(f.session.id)?.members, initial.members, 'X → Y → X cannot change old snapshot');

  store.state.ready = false;
  await store.init();
  assert.deepEqual(store.sessionRosterSnapshot(f.session.id)?.members, initial.members, 'reload keeps snapshot');

});

after(async () => {
  store.closeChannel();
  db.closeDB();
});
