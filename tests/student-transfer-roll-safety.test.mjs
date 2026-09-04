import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import { setMockAuth, setMockBackend } from '../src/lib/cloud.js';
import {
  attendanceId, makeEnrollment, makeItem, makeNote, makeSection, makeSession,
  makeStudent, makeSubject, makeTeaching, makeTerm, makeYear, scoreId,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

class MembershipBackend {
  constructor() {
    this.records = {};
    this.operations = [];
    this.enrollmentUpserts = 0;
  }

  async fetchRecords(table) { return structuredClone(this.records[table] ?? []); }

  async upsertRecords(table, records) {
    if (table === 'enrollments') this.enrollmentUpserts++;
    const target = this.records[table] ??= [];
    for (const record of records) {
      const index = target.findIndex((row) => row.id === record.id);
      if (index >= 0) target[index] = structuredClone(record);
      else target.push(structuredClone(record));
    }
    return { success: true };
  }

  activeRolls(sectionId) {
    return (this.records.enrollments ?? [])
      .filter((row) => row.section_id === sectionId && row.status === 'active' && !row.deleted_at && row.roll_no != null)
      .map((row) => row.roll_no);
  }

  assertNoDuplicateActiveRolls() {
    const bySection = new Map();
    for (const row of this.records.enrollments ?? []) {
      if (row.status !== 'active' || row.deleted_at || row.roll_no == null) continue;
      const seen = bySection.get(row.section_id) ?? new Set();
      assert.equal(seen.has(row.roll_no), false, `duplicate active roll ${row.roll_no} in ${row.section_id}`);
      seen.add(row.roll_no);
      bySection.set(row.section_id, seen);
    }
  }

  async commitEnrollmentTransfer({ source, destination }) {
    const target = this.records.enrollments ??= [];
    const sourceIndex = target.findIndex((row) => row.id === source.id);
    if (sourceIndex >= 0) target[sourceIndex] = structuredClone(source);
    else target.push(structuredClone(source));
    const destinationIndex = target.findIndex((row) => row.id === destination.id);
    if (destinationIndex >= 0) target[destinationIndex] = structuredClone(destination);
    else target.push(structuredClone(destination));
    this.assertNoDuplicateActiveRolls();
    this.operations.push({ type: 'transfer', source: source.id, destination: destination.id });
    return { source, destination };
  }

  async renumberEnrollmentRoster({ sectionId, roster }) {
    const target = this.records.enrollments ??= [];
    const active = target.filter((row) => row.section_id === sectionId && row.status === 'active' && !row.deleted_at);
    assert.equal(roster.length, active.length, 'renumber RPC receives the complete active roster');
    for (const row of active) row.roll_no = null;
    for (const plan of roster) {
      const row = target.find((candidate) => candidate.id === plan.id);
      assert.ok(row, `planned enrollment ${plan.id} exists remotely`);
      row.roll_no = plan.roll_no;
      row.client_updated_at = plan.client_updated_at;
      row.device_id = plan.device_id;
    }
    this.assertNoDuplicateActiveRolls();
    this.operations.push({ type: 'renumber', sectionId });
    return active;
  }
}

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
  const session = makeSession({ id: 'transfer:session', teachingId: teachingX.id, date: '2026-08-20', period: 1 });
  const item = makeItem({ id: 'transfer:item', teachingId: teachingX.id, name: 'اختبار', max: 10 });
  const attendance = { id: attendanceId(a.id, session.id), studentId: a.id, sessionId: session.id, teachingId: teachingX.id, date: session.date, status: 'present', updatedAt: 1, deleted: false };
  const score = { id: scoreId(a.id, item.id), studentId: a.id, itemId: item.id, value: 8, updatedAt: 1, deleted: false };
  const note = makeNote({ id: 'transfer:note', studentId: a.id, teachingId: teachingX.id, sessionId: session.id, date: session.date, text: 'ملاحظة نقل' });
  const log = { id: 'transfer:log', studentId: a.id, teachingId: teachingX.id, sessionId: session.id, date: session.date, kind: 'participation', delta: 1, updatedAt: 1, deleted: false };
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [x, y], teachings: [teachingX], students: [a, b, c], enrollments: [enrollmentA, enrollmentB, enrollmentC], sessions: [session], items: [item], attendance: [attendance], scores: [score], notes: [note], logs: [log] });
  return { year, term, subject, x, y, teachingX, a, b, c, enrollmentA, enrollmentB, enrollmentC, session, item, attendance, score, note, log };
}

test('transfer is atomic locally, keeps student-linked records unchanged, and safely reactivates a prior membership', async () => {
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
  assert.deepEqual(store.attendanceOf(f.a.id), before.attendance);
  assert.deepEqual(store.scoresOf(f.a.id), before.scores);
  assert.deepEqual(store.notesOf(f.a.id), before.notes);
  assert.deepEqual(store.logsOf(f.a.id), before.logs);

  assert.equal(await store.renumberRoster(f.x.id), true);
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => [row.id, row.rollNo]), [[f.b.id, 1]]);

  const backToX = await store.transferStudent(f.a.id, f.x.id, { date: '2026-09-01' });
  assert.equal(backToX.studentId, f.a.id);
  assert.deepEqual(store.sectionRoster(f.x.id).map((row) => row.rollNo).sort((a, b) => a - b), [1, 2]);
  assert.equal(new Set(store.sectionRoster(f.x.id).map((row) => row.rollNo)).size, 2);
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

test('offline transfer and renumber receipts converge through transactional RPCs without generic enrollment upserts', async () => {
  const f = await fixture();
  const backend = new MembershipBackend();
  setMockBackend(backend);
  setMockAuth({ id: 'transfer-owner' }, { access_token: 'test' });

  await sync.syncStudents();
  await db.clearStore('outbox');
  backend.enrollmentUpserts = 0;

  await store.transferStudent(f.a.id, f.y.id, { date: '2026-08-25' });
  await store.renumberRoster(f.x.id);
  await store.transferStudent(f.a.id, f.x.id, { date: '2026-09-01' });

  const receipts = (await db.getAll('outbox')).filter((entry) => entry.enrollmentOperation);
  assert.deepEqual(receipts.map((entry) => entry.enrollmentOperation.type).sort(), ['renumber', 'transfer', 'transfer']);
  assert.deepEqual(
    [...receipts].sort((a, b) => a.enrollmentOperation.order - b.enrollmentOperation.order)
      .map((entry) => entry.enrollmentOperation.type),
    ['transfer', 'renumber', 'transfer'],
  );
  await sync.syncStudents();

  assert.deepEqual(backend.operations.map((operation) => operation.type), ['transfer', 'renumber', 'transfer']);
  assert.equal(backend.enrollmentUpserts, 0, 'generic enrollment upsert is bypassed after transactional operations');
  backend.assertNoDuplicateActiveRolls();
  const remoteA = backend.records.enrollments.find((row) => row.id === f.enrollmentA.id);
  assert.equal(remoteA.status, 'active');
  assert.equal(remoteA.roll_no, 2);
});

after(async () => {
  setMockBackend(null);
  setMockAuth(null, null);
  store.closeChannel();
  await db.closeDB();
});
