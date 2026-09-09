import 'fake-indexeddb/auto';
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => null };
global.matchMedia = () => ({ matches: false });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import {
  buildBackup, restoreBackup, sha256Hex, backupHashInput, validateBackup, validateBackupIntegrity,
} from '../src/lib/export.js';
import {
  planCloudRestore, reconcileCanonicalRestore, restoreBackupToCloud,
} from '../src/lib/backup-v2.js';
import { SYNC_V2_SCHEMAS, SYNC_V2_STORES } from '../src/lib/sync-v2.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const emptyServer = () => Object.fromEntries(SYNC_V2_STORES.map((name) => [name, []]));
const canonicalPayload = (overrides = {}) => Object.fromEntries(SYNC_V2_STORES.map((name) => [
  SYNC_V2_SCHEMAS[name].entity, overrides[name] ?? [],
]));
const canonical = (record, revision = 1) => ({
  ...record, serverRevision: revision, fieldRevisions: { name: revision },
  serverCanonical: { ...record, serverRevision: revision, fieldRevisions: { name: revision } },
});

async function rehash(payload) {
  payload.backupHash = await sha256Hex(backupHashInput(payload));
  return payload;
}

beforeEach(async () => {
  cloud.setMockBackend(null);
  cloud.setMockAuth({ id: OWNER }, { access_token: 'test', user: { id: OWNER } });
  await db.clearAll();
});

afterEach(async () => {
  store.setCloudRestoreInProgress(false);
  await db.closeDB();
});
after(() => store.closeChannel());

test('V4 export is hash-bound with canonical baseline while V3 remains locally readable', async () => {
  const student = canonical({ id: 'student:a', name: 'قبل', note: '', status: 'active', deleted: false, updatedAt: 10 });
  await db.put('students', student);
  const backup = await buildBackup({ sourceOwnerId: OWNER, backupId: 'backup:a' });
  assert.equal(backup.version, 4);
  assert.equal(backup.sourceOwnerId, OWNER);
  assert.equal(backup.baselines.students[0].value.name, 'قبل');
  assert.equal((await validateBackupIntegrity(backup)).integrity, 'verified');
  const tampered = structuredClone(backup);
  tampered.data.students[0].name = 'تم العبث';
  assert.equal((await validateBackupIntegrity(tampered)).ok, false);

  const legacy = { app: 'rakeezx', version: 3, exportedAt: new Date().toISOString(),
    data: { students: [{ id: 'legacy:a', name: 'قديم', updatedAt: 1, deleted: false }] } };
  assert.equal(validateBackup(legacy).ok, true);
  await restoreBackup(legacy, 'replace');
  assert.equal((await db.get('students', 'legacy:a')).name, 'قديم');
});

test('three-way planner preserves server-only edits and applies non-overlapping local fields', async () => {
  const baseline = canonical({ id: 'student:a', name: 'الاسم', note: '', status: 'active', deleted: false, updatedAt: 1 });
  const payload = await rehash({
    app: 'rakeezx', version: 4, backupId: 'b', sourceOwnerId: OWNER, exportedAt: '2026-09-09T00:00:00Z',
    data: { students: [{ ...baseline, name: 'الاسم المحلي' }] },
    baselines: { students: [{ id: baseline.id, revision: 1, fieldRevisions: baseline.fieldRevisions, value: baseline.serverCanonical }] },
  });
  const server = emptyServer();
  server.students = [{ ...baseline.serverCanonical, note: 'تعديل أحدث من جهاز آخر', serverRevision: 2 }];
  const plan = planCloudRestore(payload, server, { ownerId: OWNER });
  assert.equal(plan.ready, true);
  assert.equal(plan.operations.length, 1);
  assert.deepEqual(plan.operations[0].patch, { name: 'الاسم المحلي' });
  assert.equal(plan.operations[0].baseRevision, 2);
});

test('same-field conflict and server tombstone are never silently applied', async () => {
  const base = canonical({ id: 'student:a', name: 'قبل', note: '', status: 'active', deleted: false, updatedAt: 1 });
  const payload = await rehash({ app: 'rakeezx', version: 4, backupId: 'b', sourceOwnerId: OWNER, exportedAt: 'x',
    data: { students: [{ ...base, name: 'محلي' }] },
    baselines: { students: [{ id: base.id, revision: 1, value: base.serverCanonical }] } });
  const conflictServer = emptyServer();
  conflictServer.students = [{ ...base.serverCanonical, name: 'سحابي', serverRevision: 2 }];
  let plan = planCloudRestore(payload, conflictServer, { ownerId: OWNER });
  assert.equal(plan.ready, false);
  assert.equal(plan.entries.find((row) => row.id === base.id).classification, 'CONFLICT');
  const tombstoneServer = emptyServer();
  tombstoneServer.students = [{ ...base.serverCanonical, deleted: true, serverRevision: 2 }];
  plan = planCloudRestore(payload, tombstoneServer, { ownerId: OWNER });
  assert.equal(plan.entries.find((row) => row.id === base.id).classification, 'TOMBSTONED_SERVER');
});

test('legacy cloud restore is safe only for a provably empty owner', () => {
  const legacy = { app: 'rakeezx', version: 3, data: { students: [{ id: 'legacy:a', name: 'قديم', deleted: false }] } };
  assert.equal(planCloudRestore(legacy, emptyServer(), { ownerId: OWNER }).ready, true);
  const occupied = emptyServer();
  occupied.students = [{ id: 'server:a', name: 'حالي', deleted: false, serverRevision: 1 }];
  const unsafe = planCloudRestore(legacy, occupied, { ownerId: OWNER });
  assert.equal(unsafe.ready, false);
  assert.equal(unsafe.entries[0].reason, 'legacy-backup-requires-empty-owner');
});

test('cloud restore stages/finalizes once and reconciles only the returned canonical state', async () => {
  const backup = await rehash({ app: 'rakeezx', version: 4, backupId: 'b', sourceOwnerId: OWNER, exportedAt: 'x',
    data: { students: [{ id: 'student:new', name: 'مستعاد', note: '', status: 'active', deleted: false, updatedAt: 4 }] },
    baselines: { students: [{ id: 'student:new', revision: 0, value: null }] } });
  const calls = [];
  const transport = {
    async stageSyncV2Restore(envelope) { calls.push(['stage', envelope]); return { backupHash: envelope.backupHash, stageHash: 'stage-hash' }; },
    async finalizeSyncV2Restore(envelope) {
      calls.push(['finalize', envelope]);
      return { receipt: { restoreId: envelope.restoreId, status: 'finalized' }, canonical: { students: [] } };
    },
  };
  let exclusive = false;
  const coordinator = {
    async assertCloudRestoreReady() { calls.push(['ready']); },
    async runCloudRestoreExclusive(task) { exclusive = true; try { return await task(); } finally { exclusive = false; } },
  };
  let reconciled = false;
  const result = await restoreBackupToCloud(backup, {
    restoreId: 'restore:a', transport, coordinator, sourceFetcher: async () => emptyServer(),
    reconciler: async () => { assert.equal(exclusive, true); reconciled = true; },
  });
  assert.equal(result.receipt.status, 'finalized');
  assert.deepEqual(calls.map(([name]) => name), ['ready', 'stage', 'finalize']);
  assert.equal(reconciled, true);
});

test('invalid hash is rejected before any stage write and pending writes are guarded during restore', async () => {
  const invalid = { app: 'rakeezx', version: 4, backupId: 'b', sourceOwnerId: OWNER, backupHash: '0'.repeat(64),
    data: { students: [{ id: 'a', name: 'أ', deleted: false }] }, baselines: { students: [] } };
  let touched = false;
  await assert.rejects(restoreBackupToCloud(invalid, {
    coordinator: { assertCloudRestoreReady: async () => { touched = true; } },
  }), (error) => error.code === 'INVALID_BACKUP');
  assert.equal(touched, false);

  await db.put('outbox', {
    id: 'v2:pending', protocol: 'v2', mutationId: 'pending', store: 'students', entity: 'students',
    recordId: 'a', state: 'pending', sequence: 1, queuedAt: 1,
  });
  await assert.rejects(sync.assertCloudRestoreReady(), (error) => error.code === 'RESTORE_OUTBOX_NOT_EMPTY');
  await db.clearStore('outbox');

  store.setCloudRestoreInProgress(true);
  await assert.rejects(store.save({ students: [{ id: 'blocked', name: 'ممنوع', deleted: false }] }),
    (error) => error.code === 'CLOUD_RESTORE_IN_PROGRESS');
  assert.equal(await db.get('students', 'blocked'), undefined);
});

test('canonical reconciliation is atomic and quarantines late outbox work so it cannot replay', async () => {
  const payload = { data: { units: [{ id: 'unit:a', name: 'محلي' }] } };
  await db.put('students', { id: 'old', name: 'قديم' });
  await db.put('device', { id: 'device', theme: 'light' });
  await db.put('outbox', { id: 'pending', protocol: 'v2', state: 'pending' });
  await reconcileCanonicalRestore(payload, canonicalPayload({ students: [{ id: 'new', name: 'جديد', note: '', status: 'active', revision: 1, field_revisions: {}, deleted_at: null }] }), { restoreId: 'restore:late' });
  assert.equal(await db.get('students', 'old'), undefined);
  assert.equal((await db.get('students', 'new')).name, 'جديد');
  assert.equal((await db.get('units', 'unit:a')).name, 'محلي');
  assert.deepEqual(await db.getAll('outbox'), []);
  const device = await db.get('device', 'device');
  assert.equal(device.restoreQuarantinedOutbox[0].restoreId, 'restore:late');
  assert.equal(device.restoreQuarantinedOutbox[0].entries[0].id, 'pending');
});
