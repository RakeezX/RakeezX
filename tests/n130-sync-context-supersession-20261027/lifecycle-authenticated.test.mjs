// AI: existing affected lifecycle cases with current session expiry fixture, not a Product guard change.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as db from '../../src/lib/db.js';
import * as store from '../../src/store.js';
import * as sync from '../../src/lib/sync.js';
import * as cloud from '../../src/lib/cloud.js';
import { getStudentLifecycleResumeState, resumeStudentLifecycle, localPristineBlocker, executeStudentLifecycle } from '../../src/lib/student-lifecycle.js';
import { lifecycleServer, academicFixture, LifecycleBackend, OWNER } from '../helpers/student-lifecycle-server.mjs';
import { activateSyntheticAccountWorkspace } from '../helpers/synthetic-workspace.mjs';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';
import { syncOperationalPresentation } from '../../src/lib/sync-operational-ui.js';
import { presentSyncWarning } from '../../src/lib/sync-warning-policy.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
const storage = new Map();
global.localStorage = { get length() { return storage.size; }, key: index => [...storage.keys()][index],
  getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
global.fetch = async url => {
  assert.equal(String(url), `${cloud.SUPABASE_URL}/auth/v1/user`, 'No real network in synthetic lifecycle tests');
  return new Response(JSON.stringify({ id: OWNER }), { status: 200 });
};
let pg, backend;
before(async () => { pg = await lifecycleServer({ migration32: true }); backend = new LifecycleBackend(pg); cloud.setMockBackend(backend); });
after(async () => { cloud.setMockBackend(null); cloud.setMockAuth(null, null); store.closeChannel(); db.closeDB(); await pg?.close(); });

async function device(factory = new IDBFactory()) {
  db.closeDB(); global.indexedDB = factory;
  // AI N130 fixture correction: a real unexpired fabricated session; unchanged lifecycle assertions.
  const session={access_token:'synthetic',user:{id:OWNER},expires_at:Math.floor(Date.now()/1000)+3600};
  cloud.setMockAuth(session.user,session);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));
  await activateSyntheticAccountWorkspace({ ownerId: OWNER });
  if (!await db.get('profile', 'profile')) await db.put('profile', { id: 'profile', serverRevision: 1, teacherName: 'Synthetic teacher' });
  if (!await db.get('device', 'device')) await db.put('device', { id: 'device', deviceId: 'synthetic-device' });
  await store.init();
  // This client fixture mounts an already resolved synthetic workspace; boot
  // provisioning is outside its scope. Still obtain actual intercepted Auth proof.
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(cloud.verifyCurrentAuthIdentity);
  assert.equal(await sync.syncAll({ full: true }), true);
  assert.equal((await sync.getSyncOperationalSummary()).queuedCount, 0);
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

const barrier = () => {
  let enter, release;
  return { entered: new Promise(resolve => { enter = resolve; }),
    wait: new Promise(resolve => { release = resolve; }), enter: () => enter(), release: () => release() };
};

function assertNeutral(summary) {
  assert.equal(summary.studentLifecycleInFlight, true);
  assert.equal(summary.state, 'syncing');
  assert.equal(summary.cloudSyncHealthy, false);
  assert.equal(summary.safeToContinueUnrelatedWork, false);
  assert.equal(syncOperationalPresentation(summary).badge, 'badge--neutral');
  assert.equal(presentSyncWarning(summary, null, Date.now()).strip, false);
}

test('N96 student_lifecycle_inflight_presentation: actual RPC and reconciliation barriers preserve write exclusion', async () => {
  const f = await academicFixture(pg, 'n96-inflight');
  await device();
  const rpc = barrier(), reconciliation = barrier();
  const apply = backend.applyStudentLifecycleCommand, fetch = backend.fetchRecords;
  let reconciling = false;
  backend.applyStudentLifecycleCommand = async function(envelope) {
    rpc.enter(); await rpc.wait;
    const result = await apply.call(this, envelope); reconciling = true; return result;
  };
  backend.fetchRecords = async function(table) {
    if (reconciling && table === 'students') { reconciliation.enter(); await reconciliation.wait; }
    return fetch.call(this, table);
  };
  const observed = [];
  const unsubscribe = sync.subscribe(() => {
    if (store.state.device?.studentLifecycleResume) observed.push(sync.getSyncOperationalSummarySnapshot());
  });
  const operation = store.deletePristineStudent(f.student);
  try {
    await rpc.entered;
    assertNeutral(await sync.getSyncOperationalSummary());
    assertNeutral(sync.getSyncOperationalSummarySnapshot());
    await assert.rejects(store.renameStudent(f.student, 'Forbidden edit'), { code: 'LIFECYCLE_RESUME_REQUIRED' });
    await assert.rejects(db.put('notes', { id: 'n96-forbidden', studentId: f.student }), { code: 'LIFECYCLE_RESUME_REQUIRED' });
    rpc.release(); await reconciliation.entered;
    assert.ok((await db.get('device', 'device')).studentLifecycleResume.result);
    assertNeutral(await sync.getSyncOperationalSummary());
    assertNeutral(sync.getSyncOperationalSummarySnapshot());
    reconciliation.release();
    assert.equal((await operation).ok, true);
    assert.equal(sync.getSyncOperationalSummarySnapshot().studentLifecycleInFlight, false);
    assert.equal((await sync.getSyncOperationalSummary()).safeToContinueUnrelatedWork, true);
    assert.ok(observed.length > 0);
    observed.forEach(assertNeutral);
  } finally { rpc.release(); reconciliation.release(); unsubscribe(); backend.applyStudentLifecycleCommand = apply; backend.fetchRecords = fetch; }
});

test('N96 student_lifecycle_recovery_visibility: failed live scope immediately exposes orphan recovery', async () => {
  for (const phase of ['rpc', 'reconciliation']) {
    const f = await academicFixture(pg, `n96-fail-${phase}`);
    await device();
    const held = barrier(), apply = backend.applyStudentLifecycleCommand, fetch = backend.fetchRecords;
    let reconciling = false;
    backend.applyStudentLifecycleCommand = async function(envelope) {
      if (phase === 'rpc') { held.enter(); await held.wait; throw new TypeError('Failed to fetch'); }
      const result = await apply.call(this, envelope); reconciling = true; return result;
    };
    backend.fetchRecords = async function(table) {
      if (reconciling && table === 'students') { held.enter(); await held.wait; throw new TypeError('Failed to fetch'); }
      return fetch.call(this, table);
    };
    const operation = store.deletePristineStudent(f.student);
    const rejected = assert.rejects(operation, /Failed to fetch/);
    try {
      await held.entered; assertNeutral(await sync.getSyncOperationalSummary());
      held.release(); await rejected;
      assert.ok((await db.get('device', 'device')).studentLifecycleResume);
      for (const summary of [sync.getSyncOperationalSummarySnapshot(), await sync.getSyncOperationalSummary()]) {
        assert.equal(summary.studentLifecycleInFlight, false);
        assert.equal(summary.state, 'error');
        assert.equal(summary.safeToContinueUnrelatedWork, false);
        assert.equal(presentSyncWarning(summary, null, Date.now()).strip, true);
      }
    } finally { held.release(); backend.applyStudentLifecycleCommand = apply; backend.fetchRecords = fetch; }
    assert.equal((await resumeStudentLifecycle()).ok, true);
  }
});

test('N96 context change, changed checkpoint and generic restore cannot borrow a live lifecycle exception', async () => {
  await device();
  const checkpoint = { ownerId: OWNER, envelope: { mutationId: 'n96-context' } };
  store.state.device.studentLifecycleResume = checkpoint;
  const held = barrier();
  const operation = sync.runStudentLifecycleExclusive(async () => { held.enter(); await held.wait; },
    { ownerId: OWNER, mutationId: 'n96-context' });
  try {
    await held.entered; assertNeutral(await sync.getSyncOperationalSummary());
    store.state.device.studentLifecycleResume = { ...checkpoint, envelope: { mutationId: 'different' } };
    assert.equal(sync.getSyncOperationalSummarySnapshot().state, 'error');
    store.state.device.studentLifecycleResume = checkpoint;
    cloud.setMockAuth({ id: '22222222-2222-4222-8222-222222222222' }, { access_token: 'synthetic' });
    assert.equal(sync.getSyncOperationalSummarySnapshot().studentLifecycleInFlight, false);
    cloud.setMockAuth({ id: OWNER }, { access_token: 'synthetic' });
    assert.equal(sync.getSyncOperationalSummarySnapshot().state, 'error', 'return to original owner does not revive expired scope');
    held.release(); await operation;
    assert.equal(sync.getSyncOperationalSummarySnapshot().state, 'error', 'stale completion cannot quiet checkpoint');
    await sync.runCloudRestoreExclusive(async () => {
      assert.equal(sync.getSyncOperationalSummarySnapshot().state, 'error');
    }, { scheduleAutomatic: false });
    const workspace = store.getActiveWorkspace();
    const changed = barrier();
    const workspaceOperation = sync.runStudentLifecycleExclusive(async () => { changed.enter(); await changed.wait; },
      { ownerId: OWNER, mutationId: 'n96-context' });
    await changed.entered;
    store.activateWorkspace({ ...workspace, authUserId: '22222222-2222-4222-8222-222222222222' });
    assert.equal(sync.getSyncOperationalSummarySnapshot().studentLifecycleInFlight, false);
    store.activateWorkspace(workspace);
    changed.release(); await workspaceOperation;
    assert.equal(sync.getSyncOperationalSummarySnapshot().state, 'error');
  } finally { held.release(); delete store.state.device.studentLifecycleResume; }
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
  await assert.rejects(executeStudentLifecycle('delete_pristine', { studentId: f.student }), { code: 'AUTH_REQUIRED' });
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
  const source = await readFile(new URL('../../src/views/student.js', import.meta.url), 'utf8');
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
