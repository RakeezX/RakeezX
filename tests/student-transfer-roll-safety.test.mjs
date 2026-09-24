import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import { setMockAuth, setMockBackend } from '../src/lib/cloud.js';
import { lifecycleServer, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';
import {
  attendanceId, makeEnrollment, makeItem, makeNote, makeSection, makeSession,
  makeStudent, makeSubject, makeTeaching, makeTerm, makeYear, scoreId,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

class MembershipBackend extends LifecycleBackend {}

async function fresh() {
  await db.clearAll();
  await store.init();
  sync.state.status = 'idle';
  sync.state.results = { profile: null, structural: null, students: null, notes: null };
}

async function fixture() {
  await fresh();
  const year = makeYear({ id: 'transfer:y', hijriStart: 1450 });
  const term = makeTerm({ id: 'transfer:t', yearId: year.id, index: 1, startDate: '2026-08-01', endDate: '2026-12-31' });
  const subject = makeSubject({ id: 'transfer:subject', name: 'اختبار النقل', slug: 'transfer-test' });
  const x = makeSection({ id: 'transfer:X', yearId: year.id, grade: 4, label: 'أ' });
  const y = makeSection({ id: 'transfer:Y', yearId: year.id, grade: 4, label: 'ب' });
  const teachingX = makeTeaching({ id: 'transfer:teaching:X', sectionId: x.id, subjectId: subject.id, termId: term.id });
  const a = makeStudent({ id: 'transfer:A', name: 'أحمد' });
  const b = makeStudent({ id: 'transfer:B', name: 'بدر' });
  const c = makeStudent({ id: 'transfer:C', name: 'خالد' });
  const enrollmentA = makeEnrollment({ studentId: a.id, sectionId: x.id, rollNo: 1, startDate: '2026-08-01' });
  const enrollmentB = makeEnrollment({ studentId: b.id, sectionId: x.id, rollNo: 2, startDate: '2026-08-01' });
  const enrollmentC = makeEnrollment({ studentId: c.id, sectionId: y.id, rollNo: 1, startDate: '2026-08-01' });
  const session = makeSession({ id: 'transfer:session', teachingId: teachingX.id, date: '2026-08-20', period: 1, startTime: '08:00', endTime: '08:45' });
  const item = makeItem({ id: 'transfer:item', teachingId: teachingX.id, name: 'اختبار', max: 10 });
  // This transfer-only server fixture predates score-domain migration 0033.
  // Keep its item payload within the deliberately selected legacy protocol.
  for (const field of ['scoreMode','distributionMode','distributionVersion','distributionOriginId','portabilityGroupId']) delete item[field];
  const attendance = { id: attendanceId(a.id, session.id), studentId: a.id, sessionId: session.id, teachingId: teachingX.id, date: session.date, status: 'present', updatedAt: 1, deleted: false };
  const score = { id: scoreId(a.id, item.id), studentId: a.id, itemId: item.id, value: 8, updatedAt: 1, deleted: false };
  const note = makeNote({ id: 'transfer:note', studentId: a.id, teachingId: teachingX.id, sessionId: session.id, date: session.date, text: 'ملاحظة نقل' });
  const log = { id: 'transfer:log', studentId: a.id, teachingId: teachingX.id, sessionId: session.id, date: session.date, kind: 'participation', delta: 1, updatedAt: 1, deleted: false };
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [x, y], teachings: [teachingX], students: [a, b, c], enrollments: [enrollmentA, enrollmentB, enrollmentC], sessions: [session], items: [item], attendance: [attendance], scores: [score], notes: [note], logs: [log] });
  return { year, term, subject, x, y, teachingX, a, b, c, enrollmentA, enrollmentB, enrollmentC, session, item, attendance, score, note, log };
}

test('transfer atomically renumbers both local rosters, keeps student-linked records unchanged, and safely reactivates a prior membership', async () => {
  const f = await fixture();
  const before = {
    attendance: structuredClone(store.attendanceOf(f.a.id)),
    scores: structuredClone(store.scoresOf(f.a.id)),
    notes: structuredClone(store.notesOf(f.a.id)),
    logs: structuredClone(store.logsOf(f.a.id)),
  };

  const toY = await store.transferStudent(f.a.id, f.y.id, { date: '2026-08-25', note: 'اختبار' });
  assert.equal(toY.studentId, f.a.id);
  assert.equal(store.getStudent(f.a.id)?.id, f.a.id);
  assert.equal(store.enrollmentsOf(f.a.id).find((row) => row.sectionId === f.x.id)?.status, 'transferred');
  assert.equal(store.enrollmentsOf(f.a.id).find((row) => row.sectionId === f.y.id)?.status, 'active');
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => row.rollNo), [1]);
  assert.deepEqual(store.sectionRoster(f.y.id).map((row) => row.rollNo), [1, 2]);
  assert.deepEqual(store.attendanceOf(f.a.id), before.attendance);
  assert.deepEqual(store.scoresOf(f.a.id), before.scores);
  assert.deepEqual(store.notesOf(f.a.id), before.notes);
  assert.deepEqual(store.logsOf(f.a.id), before.logs);

  const backToX = await store.transferStudent(f.a.id, f.x.id, { date: '2026-09-01' });
  assert.equal(backToX.studentId, f.a.id);
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => row.rollNo).sort((a, b) => a - b), [1, 2]);
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => row.rollNo), [1, 2]);
  assert.equal((await store.transferStudent(f.a.id, f.x.id)).id, backToX.id, 'retry is write-free/idempotent');

  await db.closeDB();
  store.state.ready = false;
  await store.init();
  assert.equal(store.getStudent(f.a.id)?.id, f.a.id);
  assert.deepEqual(store.attendanceOf(f.a.id), before.attendance);
  assert.deepEqual(store.scoresOf(f.a.id), before.scores);
  assert.deepEqual(store.notesOf(f.a.id), before.notes);
  assert.deepEqual(store.logsOf(f.a.id), before.logs);
  assert.equal(new Set(store.sectionRoster(f.x.id).map((row) => row.rollNo)).size, 2);
});

test('moving source roll #2 from a 1,2,3 roster automatically closes both rosters and remains sequential on return', async () => {
  const f = await fixture();
  const d = makeStudent({ id: 'transfer:D', name: 'داليا' });
  await store.save({
    students: [d],
    enrollments: [makeEnrollment({ studentId: d.id, sectionId: f.x.id, rollNo: 3, startDate: '2026-08-01' })],
  });

  const toY = await store.transferStudent(f.b.id, f.y.id, { date: '2026-08-25' });
  assert.equal(toY.studentId, f.b.id);
  assert.equal(store.getStudent(f.b.id)?.id, f.b.id);
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => row.rollNo), [1, 2]);
  assert.deepEqual(store.sectionRoster(f.y.id).map((row) => row.rollNo), [1, 2]);
  assert.equal(new Set(store.sectionRoster(f.x.id).map((row) => row.rollNo)).size, 2);
  assert.equal(new Set(store.sectionRoster(f.y.id).map((row) => row.rollNo)).size, 2);

  const backToX = await store.transferStudent(f.b.id, f.x.id, { date: '2026-09-01' });
  assert.equal(backToX.studentId, f.b.id);
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => row.rollNo), [1, 2, 3]);
  assert.deepEqual(store.sectionRoster(f.y.id).map((row) => row.rollNo), [1]);
  assert.equal(new Set(store.sectionRoster(f.x.id).map((row) => row.rollNo)).size, 3);
});

test('failed destination validation and a destination tombstone leave the current membership unchanged', async () => {
  const f = await fixture();
  const before = structuredClone(store.activeEnrollment(f.a.id));
  assert.equal(await store.transferStudent(f.a.id, 'missing:section'), null);
  assert.deepEqual(store.activeEnrollment(f.a.id), before);

  const tombstoneId = `en:${f.a.id}:transfer:tombstoned`;
  await store.save({ sections: [makeSection({ id: 'transfer:tombstoned', yearId: f.year.id, grade: 4, label: 'ج' })], enrollments: [{ ...makeEnrollment({ id: tombstoneId, studentId: f.a.id, sectionId: 'transfer:tombstoned', rollNo: 1 }), deleted: true, deletedAt: Date.now() }] });
  assert.equal(await store.transferStudent(f.a.id, 'transfer:tombstoned'), null);
  assert.deepEqual(store.activeEnrollment(f.a.id), before);
  assert.equal(store.enrollmentsOf(f.a.id).some((row) => row.id === tombstoneId), false, 'tombstoned target remains non-live');
});

let pg;
test('offline V2 transfer commands converge through atomic RPCs without generic enrollment upserts', async () => {
  const f = await fixture();
  pg = await lifecycleServer({ migration32: true });
  const backend = new MembershipBackend(pg);
  setMockBackend(backend);
  setMockAuth({ id: OWNER }, { access_token: 'test' });

  assert.equal(await sync.syncAll({ full: true }), true, JSON.stringify(await db.getAll('outbox')));
  assert.equal((await db.getAll('outbox')).length, 0);
  backend.enrollmentUpserts = 0;
  backend.operations = [];

  await store.transferStudent(f.a.id, f.y.id, { date: '2026-08-25' });
  await store.transferStudent(f.a.id, f.x.id, { date: '2026-09-01' });

  const receipts = (await db.getAll('outbox')).filter((entry) => entry.command === 'enrollment:transfer');
  assert.deepEqual(receipts.map((entry) => entry.command), ['enrollment:transfer', 'enrollment:transfer']);
  assert.deepEqual(
    [...receipts].sort((a, b) => a.sequence - b.sequence).map((entry) => entry.patch.destinationSectionId),
    [f.y.id, f.x.id],
  );
  assert.equal(await sync.syncAll({ full: true }), true);

  assert.deepEqual(backend.operations.map((operation) => operation.type), ['transfer', 'transfer']);
  assert.equal(backend.enrollmentUpserts, 0, 'generic enrollment upsert is bypassed after transactional operations');
  backend.assertNoDuplicateActiveRolls();
  const remoteA = backend.records.enrollments.find((row) => row.id === f.enrollmentA.id);
  assert.equal(remoteA.status, 'active');
  assert.deepEqual(backend.activeRolls(f.x.id).sort((a, b) => a - b), [1, 2]);
  assert.ok([1, 2].includes(remoteA.roll_no), 'the returned student is part of the final sequential roster');
});

after(async () => {
  setMockBackend(null);
  setMockAuth(null, null);
  store.closeChannel();
  await db.closeDB();
  await pg?.close();
});
