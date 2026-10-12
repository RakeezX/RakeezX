import { n77Account } from './n77-fixture.mjs';
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
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,String(value)), removeItem: key => memory.delete(key), key: i => [...memory.keys()][i], get length(){return memory.size;} };
import {
  buildBackup, restoreBackup, sha256Hex, backupHashInput, validateBackup, validateBackupIntegrity,
} from '../src/lib/export.js';
import {
  getCloudRestoreResumeState, planCloudRestore, reconcileCanonicalRestore,
  restoreBackupToCloud, resumeCloudRestore,
} from '../src/lib/backup-v2.js';
import { SYNC_V2_SCHEMAS, SYNC_V2_STORES } from '../src/lib/sync-v2.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';
import { renewSyntheticLease } from './n73-live/local-env.mjs';
import { seedBackupRows } from './n77-fixture.mjs';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ownerVerifier = async () => OWNER;
const historyFetcher = async () => ({ ownerId: OWNER, revision: '0' });
const testReconciler = (payload, canonicalRows, options) =>
  reconcileCanonicalRestore(payload, canonicalRows, { ...options, verifyOwner: ownerVerifier });
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
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(cloud.session));
  db.closeDB();
  await n77Account(OWNER);
  await db.clearAll();
  await store.init();
  await renewSyntheticLease(OWNER);
});

afterEach(async () => {
  store.setCloudRestoreInProgress(false);
  await db.closeDB();
});
after(() => store.closeChannel());

test('V5 export is hash-bound with canonical baseline while V3 remains locally readable', async () => {
  const student = canonical({ id: 'student:a', name: 'قبل', note: '', status: 'active', deleted: false, updatedAt: 10 });
  await db.put('students', student);
  const backup = await buildBackup({ sourceOwnerId: OWNER, backupId: 'backup:a' });
  assert.equal(backup.version, 5);
  assert.equal(backup.sourceOwnerId, OWNER);
  assert.equal(backup.baselines.students[0].value.name, 'قبل');
  assert.equal((await validateBackupIntegrity(backup)).integrity, 'verified');
  const tampered = structuredClone(backup);
  tampered.data.students[0].name = 'تم العبث';
  assert.equal((await validateBackupIntegrity(tampered)).ok, false);

  const legacy = { app: 'rakeezx', version: 3, exportedAt: new Date().toISOString(),
    data: { students: [{ id: 'legacy:a', name: 'قديم', updatedAt: 1, deleted: false }] } };
  assert.equal(validateBackup(legacy).ok, true);
  await assert.rejects(restoreBackup(legacy, 'replace'), (error) => error.code === 'LOCAL_RESTORE_DISABLED');
  assert.equal(await db.get('students', 'legacy:a'), undefined);
});

test('V5 backup survives disposable wipe/replace with mixed direct and SUBITEM provenance', async () => {
  const rows = {
    students: [{ id: 'student:one', name: 'synthetic' }, { id: 'student:missing', name: 'synthetic' }],
    items: [
      { id: 'item:direct', name: 'direct', max: 10, scoreMode: 'direct',
        portabilityGroupId: 'portability:reviewed' },
      { id: 'item:sub', name: 'subitem', max: 10, scoreMode: 'subitems',
        distributionMode: 'manual', portabilityGroupId: null },
    ],
    scoreSubitems: [
      { id: 'sub:three', itemId: 'item:sub', name: 'three', value: 3, order: 0,
        distributionOriginId: 'source:sub:three', createdAt: 123, startDate: '2026-10-01', dueDate: '2026-10-02', latePoints: 1 },
      { id: 'sub:deleted', itemId: 'item:sub', name: 'old', value: 2, order: 1, deleted: true },
    ],
    scoreSubitemCompletions: [
      { id: 'completion:three', studentId: 'student:one', subitemId: 'sub:three', checked: true, completionState: 'late' },
      { id: 'completion:deleted', studentId: 'student:missing', subitemId: 'sub:deleted',
        checked: true, deleted: true },
    ],
    scores: [
      { id: 'score:direct', studentId: 'student:one', itemId: 'item:direct', value: 7 },
      { id: 'score:sub', studentId: 'student:one', itemId: 'item:sub',
        derivedValue: 1, manualValue: 5, value: 6 },
      { id: 'score:zero', studentId: 'student:missing', itemId: 'item:sub',
        derivedValue: 0, manualValue: 0, value: 0 },
    ],
  };
  for (const [storeName, records] of Object.entries(rows)) {
    for (const record of records) await db.put(storeName, record);
  }
  const backup = await buildBackup({ sourceOwnerId: OWNER, backupId: 'backup:v5:mixed' });
  assert.equal((await validateBackupIntegrity(backup)).ok, true);
  assert.equal(backup.data.scoreSubitems.length, 2);
  await db.clearAll();
  await assert.rejects(restoreBackup(backup, 'merge'),
    (error) => error.code === 'LOCAL_RESTORE_DISABLED');
  await seedBackupRows(backup);
  for (const [storeName, records] of Object.entries(rows)) {
    assert.deepEqual((await db.getAll(storeName)).sort((a, b) => a.id.localeCompare(b.id)),
      records.sort((a, b) => a.id.localeCompare(b.id)));
  }
  assert.equal((await db.get('scores', 'score:zero')).value, 0);
  assert.equal((await db.get('scoreSubitems', 'sub:deleted')).deleted, true);
  assert.equal((await db.get('items', 'item:direct')).portabilityGroupId, 'portability:reviewed');
});

for (const mode of ['direct', 'subitems']) {
  test(`V5 ${mode}-only backup survives wipe/replace without manufacturing the other mode`, async () => {
    const rows = {
      students: [{ id: 'single:student', name: 'synthetic' }],
      items: [{ id: 'single:item', name: 'assessment', max: 10, scoreMode: mode,
        ...(mode === 'subitems' ? { distributionMode: 'manual' }
          : { portabilityGroupId: 'single:explicit-portability' }) }],
      scoreSubitems: mode === 'subitems'
        ? [{ id: 'single:subitem', itemId: 'single:item', name: 'part', value: 3, order: 0 }] : [],
      scoreSubitemCompletions: mode === 'subitems'
        ? [{ id: 'single:completion', studentId: 'single:student', subitemId: 'single:subitem', checked: true }] : [],
      scores: [{ id: 'single:score', studentId: 'single:student', itemId: 'single:item',
        ...(mode === 'subitems' ? { derivedValue: 3, manualValue: 0, value: 3 } : { value: 0 }) }],
    };
    for (const [name, records] of Object.entries(rows)) {
      for (const record of records) await db.put(name, record);
    }
    const backup = await buildBackup({ sourceOwnerId: OWNER, backupId: `backup:v5:${mode}` });
    assert.equal((await validateBackupIntegrity(backup)).ok, true);
    await db.clearAll();
    await seedBackupRows(backup);
    for (const [name, records] of Object.entries(rows)) assert.deepEqual(await db.getAll(name), records);
    assert.equal((await db.get('scores', 'single:score')).value, mode === 'direct' ? 0 : 3);
  });
}

test('V5 cloud restore selects versioned RPCs and reconciles complete canonical provenance', async () => {
  await db.put('sections', { id: 'v5:section', grade: 1, label: 'A' });
  await db.put('teachings', { id: 'v5:teaching', sectionId: 'v5:section' });
  await db.put('students', { id: 'v5:student', name: 'synthetic' });
  await db.put('items', { id: 'v5:item', teachingId: 'v5:teaching', name: 'assessment',
    max: 10, scoreMode: 'subitems', distributionMode: 'manual', distributionVersion: 1 });
  await db.put('scoreSubitems', { id: 'v5:subitem', itemId: 'v5:item', name: 'one',
    value: 3, order: 0 });
  await db.put('scoreSubitemCompletions', { id: 'v5:completion', studentId: 'v5:student',
    subitemId: 'v5:subitem', checked: true });
  await db.put('scores', { id: 'v5:score', studentId: 'v5:student', itemId: 'v5:item',
    derivedValue: 3, manualValue: 5, value: 8 });
  const backup = await buildBackup({ sourceOwnerId: OWNER, backupId: 'backup:v5:cloud' });
  let stageCalls = 0;
  let finalizeCalls = 0;
  const canonicalRows = canonicalPayload({
    sections: [{ id: 'v5:section', grade: 1, label: 'A', revision: 1, deleted_at: null }],
    teachings: [{ id: 'v5:teaching', section_id: 'v5:section', revision: 1, deleted_at: null }],
    students: [{ id: 'v5:student', name: 'synthetic', revision: 1, deleted_at: null }],
    items: [{ id: 'v5:item', teaching_id: 'v5:teaching', name: 'assessment', max: 10,
      score_mode: 'subitems', distribution_mode: 'manual', distribution_version: 1,
      revision: 1, deleted_at: null }],
    scoreSubitems: [{ id: 'v5:subitem', item_id: 'v5:item', name: 'one', value: 3,
      order: 0, revision: 1, deleted_at: null }],
    scoreSubitemCompletions: [{ id: 'v5:completion', student_id: 'v5:student',
      subitem_id: 'v5:subitem', checked: true, revision: 1, deleted_at: null }],
    scores: [{ id: 'v5:score', student_id: 'v5:student', item_id: 'v5:item',
      derived_value: 3, manual_value: 5, value: 8, revision: 1, deleted_at: null }],
  });
  const transport = {
    async stageUnifiedRestore(envelope) {
      stageCalls++;
      assert.equal(envelope.backupVersion, 5);
      const entities = envelope.operations.map((row) => row.entity);
      assert.ok(entities.indexOf('items') < entities.indexOf('score_subitems'));
      assert.ok(entities.indexOf('score_subitems') < entities.indexOf('score_subitem_completions'));
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash, stageHash: 'stage:v5' };
    },
    async finalizeUnifiedRestore(envelope) {
      finalizeCalls++;
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash,
        stageHash: envelope.expectedStageHash,
        receipt: { restoreId: envelope.restoreId, status: 'finalized' }, canonical: canonicalRows };
    },
  };
  const coordinator = { async assertCloudRestoreReady() {},
    async runCloudRestoreExclusive(action) { return action(); } };
  await restoreBackupToCloud(backup, { transport, coordinator, sourceFetcher: async () => emptyServer(),
    canonicalFetcher: async () => canonicalRows, ownerVerifier, historyFetcher, reconciler: testReconciler });
  assert.equal(stageCalls, 1);
  assert.equal(finalizeCalls, 1);
  assert.equal((await db.get('scores', 'v5:score')).value, 8);
  assert.equal((await db.get('scoreSubitemCompletions', 'v5:completion')).checked, true);
  assert.equal((await db.getAll('outbox')).length, 0);
});

test('V5 empty-owner recovery retains tombstones but rejects another owner', () => {
  const payload = { version: 5, sourceOwnerId: OWNER,
    data: { students: [{ id: 'v5:deleted-student', name: 'old', deleted: true,
      serverRevision: 4, updatedAt: 1 }] },
    baselines: { students: [{ id: 'v5:deleted-student', value: { id: 'v5:deleted-student' },
      revision: 4 }] } };
  const plan = planCloudRestore(payload, emptyServer(), { ownerId: OWNER, ownerHistoryRevision: '0' });
  assert.equal(plan.ready, true);
  assert.equal(plan.operations[0].operation, 'create_deleted');
  const wrongOwner = planCloudRestore(payload, emptyServer(), {
    ownerId: '22222222-2222-4222-8222-222222222222', ownerHistoryRevision: '0' });
  assert.equal(wrongOwner.ready, false);
  assert.equal(wrongOwner.entries[0].reason, 'v5-owner-mismatch');
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
  assert.equal(plan.entries.find((row) => row.id === base.id).classification, 'KEEP_SERVER');
  assert.equal(plan.entries.find((row) => row.id === base.id).reason, 'server-tombstone');
});

test('legacy cloud restore is safe only for a provably empty owner', () => {
  const legacy = { app: 'rakeezx', version: 3, data: { students: [{ id: 'legacy:a', name: 'قديم', deleted: false }] } };
  assert.equal(planCloudRestore(legacy, emptyServer(), { ownerId: OWNER, ownerHistoryRevision: '0' }).ready, true);
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
    async stageUnifiedRestore(envelope) { calls.push(['stage', envelope]); return { restoreId: envelope.restoreId, backupHash: envelope.backupHash, stageHash: 'stage-hash' }; },
    async finalizeUnifiedRestore(envelope) {
      calls.push(['finalize', envelope]);
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash,
        stageHash: envelope.expectedStageHash,
        receipt: { restoreId: envelope.restoreId, status: 'finalized' }, canonical: { students: [] } };
    },
  };
  let exclusive = false;
  const coordinator = {
    async assertCloudRestoreReady() { calls.push(['ready']); },
    async runCloudRestoreExclusive(task, {prepare} = {}) { await prepare?.(); exclusive = true; try { return await task(); } finally { exclusive = false; } },
  };
  let reconciled = false;
  const result = await restoreBackupToCloud(backup, {
    restoreId: 'restore:a', transport, coordinator, sourceFetcher: async () => emptyServer(),
    canonicalFetcher: async () => ({ students: [] }), ownerVerifier, historyFetcher,
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

test('unsupported backup versions are rejected before cloud staging with a stable code', async () => {
  let staged = 0;
  const transport = { async stageUnifiedRestore() { staged++; } };
  const coordinator = {
    async assertCloudRestoreReady() { throw new Error('must not reach readiness'); },
  };
  for (const version of [2, 6]) {
    const payload = { app: 'rakeezx', version, data: { students: [{ id: `student:v${version}`, name: 'نسخة' }] } };
    await assert.rejects(restoreBackupToCloud(payload, { transport, coordinator }),
      (error) => error.code === 'UNSUPPORTED_BACKUP_VERSION');
  }
  assert.equal(staged, 0);
});

test('canonical reconciliation is atomic and quarantines late outbox work so it cannot replay', async () => {
  const payload = { data: { units: [{ id: 'unit:a', name: 'محلي' }] } };
  await db.put('students', { id: 'old', name: 'قديم' });
  await db.put('device', { id: 'device', theme: 'light' });
  await db.put('outbox', { id: 'pending', protocol: 'v2', state: 'pending' });
  await testReconciler(payload, canonicalPayload({ students: [{ id: 'new', name: 'جديد', note: '', status: 'active', revision: 1, field_revisions: {}, deleted_at: null }] }), { restoreId: 'restore:late' });
  assert.equal(await db.get('students', 'old'), undefined);
  assert.equal((await db.get('students', 'new')).name, 'جديد');
  assert.equal(await db.get('units', 'unit:a'), undefined, 'reconcile must use canonical units, never local backup fallback');
  assert.deepEqual(await db.getAll('outbox'), []);
  const device = await db.get('device', 'device');
  assert.equal(device.restoreQuarantinedOutbox[0].restoreId, 'restore:late');
  assert.equal(device.restoreQuarantinedOutbox[0].entries[0].id, 'pending');
});

test('a finalized restore resumes local reconciliation with the same identity and no duplicate server mutation', async () => {
  const backup = await rehash({ app: 'rakeezx', version: 4, backupId: 'resume-backup', sourceOwnerId: OWNER, exportedAt: 'x',
    data: {
      students: [{ id: 'student:resume', name: 'مستعاد', note: '', status: 'active', deleted: false, updatedAt: 4 }],
      units: [{ id: 'unit:resume', name: 'وحدة محلية' }],
    },
    baselines: { students: [{ id: 'student:resume', revision: 0, value: null }] } });
  const canonical = canonicalPayload({ students: [{
    id: 'student:resume', name: 'مستعاد', note: '', status: 'active', revision: 1,
    field_revisions: { name: 1 }, deleted_at: null,
  }] });
  let finalized = false;
  let stageCalls = 0;
  let finalizeCalls = 0;
  let serverMutations = 0;
  const transport = {
    async stageUnifiedRestore(envelope) {
      stageCalls++;
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash, stageHash: 'resume-stage-hash' };
    },
    async finalizeUnifiedRestore(envelope) {
      finalizeCalls++;
      assert.equal(envelope.restoreId, 'restore:resume');
      if (!finalized) { finalized = true; serverMutations++; }
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash,
        stageHash: envelope.expectedStageHash,
        receipt: { restoreId: envelope.restoreId, status: 'finalized' }, canonical };
    },
  };
  const coordinator = {
    async assertCloudRestoreReady() {},
    async runCloudRestoreExclusive(task, {prepare} = {}) { await prepare?.(); return task(); },
  };

  await assert.rejects(restoreBackupToCloud(backup, {
    restoreId: 'restore:resume', transport, coordinator, sourceFetcher: async () => emptyServer(),
    canonicalFetcher: async () => canonical, ownerVerifier, historyFetcher,
    reconciler: async () => { throw new Error('TEST local quota failure'); },
  }), (error) => error.code === 'LOCAL_RECONCILIATION_REQUIRED' && error.restore.restoreId === 'restore:resume');

  assert.deepEqual(await getCloudRestoreResumeState(), {
    restoreId: 'restore:resume', backupHash: backup.backupHash, backupVersion: 4,
    protocol: 'N71_V1', stageHash: 'resume-stage-hash', state: 'finalized',
    receipt: { restoreId: 'restore:resume', status: 'finalized' },
    stagedAt: (await getCloudRestoreResumeState()).stagedAt,
    finalizedAt: (await getCloudRestoreResumeState()).finalizedAt,
  });
  await assert.rejects(restoreBackupToCloud(backup, {
    restoreId: 'restore:new', transport, coordinator, sourceFetcher: async () => emptyServer(),
  }), (error) => error.code === 'CLOUD_RESTORE_RESUME_REQUIRED');

  const resumed = await resumeCloudRestore({
    transport, coordinator, canonicalFetcher: async () => canonical, ownerVerifier, reconciler: testReconciler,
  });
  assert.equal(resumed.restoreId, 'restore:resume');
  assert.equal(resumed.resumed, true);
  assert.equal(stageCalls, 1);
  assert.equal(finalizeCalls, 2);
  assert.equal(serverMutations, 1);
  assert.equal((await db.get('students', 'student:resume')).name, 'مستعاد');
  assert.equal(await db.get('units', 'unit:resume'), undefined, 'backup-only rows must never bypass canonical cloud');
  assert.equal(await getCloudRestoreResumeState(), null);
});

test('missing finalize receipt leaves Product unchanged and exact retry reconciles once', async () => {
  const backup = await rehash({ app: 'rakeezx', version: 4, backupId: 'receipt-missing',
    sourceOwnerId: OWNER, exportedAt: 'x',
    data: { students: [{ id: 'student:receipt', name: 'recovered', deleted: false }] },
    baselines: { students: [{ id: 'student:receipt', revision: 0, value: null }] } });
  let finalizations = 0;
  const transport = {
    async stageSyncV2Restore(envelope) { return { restoreId: envelope.restoreId,
      backupHash: envelope.backupHash, stageHash: 'receipt-stage' }; },
    async finalizeSyncV2Restore(envelope) {
      finalizations++;
      if (finalizations === 1) return { restoreId: envelope.restoreId,
        backupHash: envelope.backupHash, stageHash: envelope.expectedStageHash,
        receipt: null, canonical: canonicalPayload() };
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash,
        stageHash: envelope.expectedStageHash,
        receipt: { restoreId: envelope.restoreId, status: 'finalized' },
        canonical: canonicalPayload({ students: [{ id: 'student:receipt', name: 'recovered',
          revision: 1, deleted_at: null }] }) };
    },
  };
  const coordinator = { async assertCloudRestoreReady() {},
    async runCloudRestoreExclusive(action) { return action(); } };
  await assert.rejects(restoreBackupToCloud(backup, { restoreId: 'restore:receipt', transport,
    coordinator, sourceFetcher: async () => emptyServer(), ownerVerifier, historyFetcher,
    canonicalFetcher: async () => canonicalPayload(),
    reconciler: testReconciler }), (error) => error.code === 'LOCAL_RECONCILIATION_REQUIRED' &&
      error.cause?.code === 'RESTORE_RECEIPT_INVALID');
  assert.equal(await db.get('students', 'student:receipt'), undefined);
  assert.equal((await getCloudRestoreResumeState()).state, 'staged');
  await resumeCloudRestore({ transport, coordinator, ownerVerifier,
    canonicalFetcher: async () => canonicalPayload({ students: [{ id: 'student:receipt',
      name: 'recovered', revision: 1, deleted_at: null }] }), reconciler: testReconciler });
  assert.equal((await db.get('students', 'student:receipt')).name, 'recovered');
  assert.equal(finalizations, 2);
  assert.equal(await getCloudRestoreResumeState(), null);
});
