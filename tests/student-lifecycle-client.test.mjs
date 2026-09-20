import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import * as cloud from '../src/lib/cloud.js';
import { getStudentLifecycleResumeState, resumeStudentLifecycle, localPristineBlocker, executeStudentLifecycle } from '../src/lib/student-lifecycle.js';
import { lifecycleServer, academicFixture, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
let pg, backend;
before(async () => { pg = await lifecycleServer({ migration32: true }); backend = new LifecycleBackend(pg); cloud.setMockBackend(backend); });
after(async () => { cloud.setMockBackend(null); cloud.setMockAuth(null, null); store.closeChannel(); db.closeDB(); await pg?.close(); });

async function device(factory = new IDBFactory()) {
  db.closeDB(); global.indexedDB = factory;
  cloud.setMockAuth({ id: OWNER }, { access_token: 'synthetic' });
  await store.init();
  assert.equal(await sync.syncAll({ full: true }), true);
  assert.equal((await db.getAll('outbox')).length, 0);
  return factory;
}

test('local-only submissions and retained/deleted evidence block pristine deletion', () => {
  const studentId = 'synthetic';
  const base = { students: [{ id: studentId, status: 'active' }] };
  assert.equal(localPristineBlocker(base, studentId), null);
  for (const name of ['submissions', 'attendance', 'scores', 'logs', 'notes']) {
    assert.equal(localPristineBlocker({ ...base, [name]: [{ studentId, value: 0, deleted: true }] }, studentId), name);
  }
  assert.equal(localPristineBlocker({ ...base, closedTermReports: [{ payload: { roster: [{ id: studentId }] } }] }, studentId), 'closedTermReports');
});

test('end enrollment preserves the interval after reload and converges to two independent devices', async () => {
  const f = await academicFixture(pg, 'client-end');
  const a = await device();
  const original = store.getStudent(f.student).id;
  const en = store.activeEnrollment(f.student);
  const result = await store.endStudentEnrollment(f.student, en.id, { sourceRevision: en.serverRevision });
  assert.equal(result.ok, true);
  assert.equal(store.activeEnrollment(f.student), null);
  assert.equal(store.sectionRoster(f.section).some((row) => row.id === f.student), false);
  assert.equal(store.students(f.teaching).some((row) => row.id === f.student), false);
  assert.equal(store.getStudent(f.student).id, original);
  db.closeDB(); await store.init();
  assert.equal(store.getStudent(f.student).status, 'withdrawn');
  const b = await device();
  assert.equal(store.activeEnrollment(f.student), null);
  const ended = store.enrollmentsOf(f.student).find((row) => row.id === en.id);
  assert.equal(ended.startDate, '2026-08-01');
  assert.equal(ended.status, 'withdrawn');
  assert.ok(ended.endDate);
  await device(a);
  assert.equal(store.activeEnrollment(f.student), null);
  assert.deepEqual(store.enrollmentsOf(f.student).find((row) => row.id === en.id), ended);
  await device(b);
  assert.equal(store.activeEnrollment(f.student), null);
  assert.deepEqual(store.enrollmentsOf(f.student).find((row) => row.id === en.id), ended);
});

test('offline/auth/pending work cannot perform destructive lifecycle writes', async () => {
  const f = await academicFixture(pg, 'client-offline');
  await device();
  const before = structuredClone(await db.get('students', f.student));
  cloud.setMockAuth(null, null);
  await assert.rejects(store.deletePristineStudent(f.student), { code: 'AUTH_REQUIRED' });
  cloud.setMockAuth({ id: OWNER }, { access_token: 'synthetic' });
  Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true });
  await assert.rejects(store.deletePristineStudent(f.student), { code: 'OFFLINE' });
  delete global.navigator.onLine;
  await db.put('outbox', { id: 'synthetic-pending', protocol: 'v2', store: 'students', state: 'blocked' });
  await assert.rejects(store.deletePristineStudent(f.student), { code: 'RESTORE_OUTBOX_NOT_EMPTY' });
  assert.deepEqual(await db.get('students', f.student), before);
});

test('lost response after server commit survives reload and resumes SAME identity without duplicate mutation', async () => {
  const f = await academicFixture(pg, 'client-resume');
  const a = await device();
  const before = await db.get('students', f.student);
  backend.loseResponse = true;
  await assert.rejects(store.deletePristineStudent(f.student), /lost response/);
  const pending = await getStudentLifecycleResumeState();
  assert.equal(pending.state, 'confirmation_required');
  assert.deepEqual(await db.get('students', f.student), before, 'no optimistic cascade');
  await assert.rejects(db.put('notes', { id: 'stale-tab-note', studentId: f.student }), { code: 'LIFECYCLE_RESUME_REQUIRED' });
  await assert.rejects(store.deletePristineStudent(f.student), { code: 'LIFECYCLE_RESUME_REQUIRED' });
  db.closeDB(); await store.init();
  assert.equal((await getStudentLifecycleResumeState()).mutationId, pending.mutationId);
  const result = await resumeStudentLifecycle();
  assert.equal(result.ok, true);
  assert.equal(await getStudentLifecycleResumeState(), null);
  assert.equal(store.getStudent(f.student), null);
  const calls = backend.calls.filter((row) => row.payload.studentId === f.student);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.student_lifecycle_receipts where student_id=$1`, [f.student])).rows[0].n, 1);
  const b = await device();
  assert.equal(store.getStudent(f.student), null);
  await assert.rejects(store.save({ submissions: [{ id: 'stale-submission', studentId: f.student }] }), { code: 'STUDENT_TOMBSTONED' });
  await device(a); assert.equal(store.getStudent(f.student), null);
  await device(b); assert.equal(store.getStudent(f.student), null);
});

test('V1 rejects reinstatement before checkpoint or local activation; stale ending leaves history intact', async () => {
  const f = await academicFixture(pg, 'client-fail');
  await device();
  const en = store.activeEnrollment(f.student);
  assert.equal((await store.endStudentEnrollment(f.student, en.id, { sourceRevision: en.serverRevision })).ok, true);
  const before = structuredClone(store.enrollmentsOf(f.student));
  const calls = backend.calls.length;
  await assert.rejects(executeStudentLifecycle('reinstate', { studentId: f.student }), { code: 'UNSUPPORTED_LIFECYCLE_COMMAND' });
  assert.equal(backend.calls.length, calls);
  assert.equal(await getStudentLifecycleResumeState(), null);
  assert.deepEqual(store.enrollmentsOf(f.student), before);
  assert.equal((await store.endStudentEnrollment(f.student, en.id, { sourceRevision: en.serverRevision })).code, 'STALE_SOURCE_ENROLLMENT');
  assert.equal(store.getStudent(f.student).status, 'withdrawn');
  assert.equal(store.activeEnrollment(f.student), null);
  await assert.rejects(store.endStudentEnrollment(f.student, en.id, { sourceRevision: en.serverRevision, date: '2099-01-01' }), { code: 'IMMEDIATE_ONLY' });
  const source = await readFile(new URL('../src/views/student.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /reinstate|أعده للدراسة|أُعيد للدراسة/,
    'deferred reinstatement has neither a selectable UI action nor a delegated handler/success toast');
});

test('finalized receipt resumes local reconciliation after transaction failure without another server call', async () => {
  const f = await academicFixture(pg, 'client-reconcile');
  await device();
  await db.patchMany('students', [{ id: f.student, changes: { syncConflicts: [{ lifecycle: 'historical_reconciled', mutationId: 'retained-history' }] } }]);
  const before = structuredClone(await db.get('students', f.student));
  const handle = await db.openDB();
  const original = handle.transaction.bind(handle);
  handle.transaction = (names, mode, ...options) => {
    const tx = original(names, mode, ...options);
    if (mode === 'readwrite' && Array.isArray(names) && names.includes('students') && names.includes('enrollments') && names.length === 4) {
      queueMicrotask(() => tx.abort());
    }
    return tx;
  };
  try { await assert.rejects(store.deletePristineStudent(f.student), /أُلغيت|abort/i); }
  finally { handle.transaction = original; }
  assert.equal((await getStudentLifecycleResumeState()).state, 'reconciliation_required');
  assert.deepEqual(await db.get('students', f.student), before);
  db.closeDB(); await store.init();
  assert.equal((await resumeStudentLifecycle()).ok, true);
  assert.equal(backend.calls.filter((row) => row.payload.studentId === f.student).length, 1);
  assert.deepEqual((await db.get('students', f.student)).syncConflicts, before.syncConflicts);
});
