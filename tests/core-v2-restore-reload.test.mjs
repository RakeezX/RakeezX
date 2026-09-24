import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';

import * as db from '../src/lib/db.js';
import { filterCoreRestoreManifest, runInitialRestore } from '../src/lib/initial-restore.js';
import { accountWorkspaceDatabaseName, createWorkspaceRegistry } from '../src/lib/workspaces.js';
import { resolveWorkspaceForBoot } from '../src/lib/workspace-routing.js';

const OWNER = '77777777-7777-4777-8777-777777777777';
const OTHER_OWNER = '88888888-8888-4888-8888-888888888888';

const row = (id, extra = {}) => ({ id, owner_id: OWNER, revision: 1,
  field_revisions: {}, deleted_at: null, ...extra });

const canonical = {
  profile: [row('profile', { teacher_name: 'Synthetic teacher' })],
  sections: [row('restore:class', { grade: 'الرابع الابتدائي', section: '1' })],
  teachings: [row('restore:teaching', { section_id: 'restore:class', subject_id: 'restore:subject' })],
  students: [row('restore:student', { name: 'Synthetic student' })],
  slots: [row('restore:slot', { teaching_id: 'restore:teaching', weekday: 1, period: 1 })],
  sessions: [row('restore:session', { teaching_id: 'restore:teaching', date: '2026-09-21' })],
  attendance: [row('restore:attendance', { session_id: 'restore:session', student_id: 'restore:student', status: 'present' })],
  items: [row('restore:direct-item', { teaching_id: 'restore:teaching', max: 10, score_mode: 'direct' }),
    row('restore:subitem-item', { teaching_id: 'restore:teaching', max: 10,
      score_mode: 'subitems', distribution_mode: 'manual' })],
  score_subitems: [row('restore:subitem', { item_id: 'restore:subitem-item', name: 'Task', value: 6, order: 0 })],
  score_subitem_completions: [row('restore:completion', { student_id: 'restore:student',
    subitem_id: 'restore:subitem', checked: true })],
  scores: [row('restore:direct-score', { student_id: 'restore:student', item_id: 'restore:direct-item', value: 8 }),
    row('restore:subitem-score', { student_id: 'restore:student', item_id: 'restore:subitem-item',
      derived_value: 6, manual_value: 4, value: 10 })],
};

const manifest = Object.entries(canonical).flatMap(([entity, rows]) => rows.map((entry) => ({
  entity, id: entry.id, revision: entry.revision, deleted: false,
})));

const cloud = {
  async verifyCurrentAuthIdentity(expected) { return { id: expected }; },
  async getScoreFoundationCapability() { return { scoreDomainVersion: 1, restoreProtocol: 'CORE_V2' }; },
  async getScoreRestoreManifestV2() { return manifest; },
  async fetchRestoreEntityPage(entity) { return canonical[entity] ?? []; },
};

const boot = (factory, registry, ownerId = OWNER) => resolveWorkspaceForBoot({
  authUser: { id: ownerId }, authState: 'authenticated', registry,
  indexedDBFactory: factory, cryptoProvider: webcrypto,
});

test('real CORE_V2 restore receipt remains valid after a runtime reload', async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  let registry = createWorkspaceRegistry({ indexedDBFactory: factory });
  try {
    assert.equal((await runInitialRestore({ expectedOwnerId: OWNER, registry, cloud, database: db,
      cryptoProvider: webcrypto, indexedDBFactory: factory })).status, 'ready');
    assert.equal((await db.readInitialRestoreReceipt()).protocol, 'CORE_V2');
    assert.equal((await db.getAll('sections')).length, 1);
    assert.equal((await db.getAll('students')).length, 1);
    assert.equal((await db.getAll('slots')).length, 1);
    assert.equal((await db.getAll('sessions')).length, 1);
    assert.equal((await db.getAll('attendance')).length, 1);
    assert.deepEqual((await db.getAll('scores')).map((score) => score.value).sort((a, b) => a - b), [8, 10]);
    assert.equal((await db.getAll('scoreSubitems')).length, 1);
    assert.equal((await db.getAll('scoreSubitemCompletions')).length, 1);
    assert.deepEqual(await db.getAll('outbox'), []);
    const pending = { id: 'synthetic:pending', ownerId: OWNER, state: 'pending', attempts: 2 };
    await db.put('outbox', pending);
    db.closeDB();
    await registry.close();
    registry = createWorkspaceRegistry({ indexedDBFactory: factory });
    const reloaded = await resolveWorkspaceForBoot({ authUser: { id: OWNER }, authState: 'authenticated',
      registry, indexedDBFactory: factory, cryptoProvider: webcrypto });
    assert.equal(reloaded.reason, null);
    assert.equal(reloaded.status, 'ready');
    assert.equal(reloaded.mode, 'restored-account');
    assert.equal((await resolveWorkspaceForBoot({ authUser: { id: OTHER_OWNER }, authState: 'authenticated',
      registry, indexedDBFactory: factory, cryptoProvider: webcrypto })).status, 'not_ready');
    assert.equal((await resolveWorkspaceForBoot({ authState: 'signed_out', registry,
      indexedDBFactory: factory, cryptoProvider: webcrypto })).status, 'not_ready');
    assert.equal((await runInitialRestore({ expectedOwnerId: OWNER, registry, cloud, database: db,
      cryptoProvider: webcrypto, indexedDBFactory: factory })).status, 'ready');
    assert.equal((await db.getAll('scores')).length, 2);
    assert.deepEqual(await db.getAll('outbox'), [pending]);
  } finally {
    db.closeDB();
    await registry.close();
  }
});

test('stale, corrupted, downgraded, or foreign CORE_V2 receipts fail closed', async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  const registry = createWorkspaceRegistry({ indexedDBFactory: factory });
  try {
    await runInitialRestore({ expectedOwnerId: OWNER, registry, cloud, database: db,
      cryptoProvider: webcrypto, indexedDBFactory: factory });
    const original = await db.get('device', 'device');
    for (const changes of [
      { ownerId: OTHER_OWNER }, { protocol: 'CORE_V1' }, { protocol: 'CORE_V3' },
      { restoreId: 'stale' }, { manifestHash: 'corrupted' }, { manifestHash: '' },
      { completedAt: original.initialRestoreReceipt.completedAt + 1 },
    ]) {
      await db.put('device', { ...original,
        initialRestoreReceipt: { ...original.initialRestoreReceipt, ...changes } });
      assert.equal((await boot(factory, registry)).reason, 'initial-restore-receipt-mismatch');
    }
    await db.put('device', original);
    assert.equal((await boot(factory, registry)).status, 'ready');
  } finally {
    db.closeDB();
    await registry.close();
  }
});

test('CORE_V2 crash after atomic import resumes without a duplicate pull', async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  const registry = createWorkspaceRegistry({ indexedDBFactory: factory });
  const restoreId = 'v2-interrupted-finalize';
  const manifestHash = 'v2-manifest-hash';
  try {
    await registry.beginAccountRestore(OWNER, {
      protocol: 'CORE_V2', restoreId, manifestHash, phase: 'RESTORE_FINALIZING',
    }, { cryptoProvider: webcrypto });
    db.closeDB();
    db.selectDatabase(await accountWorkspaceDatabaseName(OWNER, { cryptoProvider: webcrypto }));
    await db.importInitialRestoreSnapshot({ profile: [{ id: 'profile', serverRevision: 1, deleted: false }] }, {
      id: 'device', deviceId: 'v2-resume-device', initialRestoreReceipt: {
        protocol: 'CORE_V2', restoreId, ownerId: OWNER, manifestHash, completedAt: 123,
      },
    });
    db.closeDB();
    const resumed = await runInitialRestore({ expectedOwnerId: OWNER, registry, database: db,
      indexedDBFactory: factory, cryptoProvider: webcrypto,
      cloud: { ...cloud, async getScoreRestoreManifestV2() { throw new Error('duplicate pull'); } },
    });
    assert.equal(resumed.status, 'ready');
    assert.equal(resumed.resumed, true);
    assert.equal((await boot(factory, registry)).status, 'ready');
  } finally {
    db.closeDB();
    await registry.close();
  }
});

test('CORE_V2 interrupted before import safely completes the same owner checkpoint', async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  const registry = createWorkspaceRegistry({ indexedDBFactory: factory });
  const sorted = filterCoreRestoreManifest(manifest, { protocol: 'CORE_V2' });
  const hash = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(sorted))))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  try {
    await registry.beginAccountRestore(OWNER, {
      protocol: 'CORE_V2', restoreId: 'v2-before-import', manifestHash: hash, phase: 'RESTORING',
    }, { cryptoProvider: webcrypto });
    assert.equal((await boot(factory, registry)).reason, 'initial-restore-pending');
    const resumed = await runInitialRestore({ expectedOwnerId: OWNER, registry, cloud, database: db,
      indexedDBFactory: factory, cryptoProvider: webcrypto });
    assert.equal(resumed.status, 'ready');
    assert.equal((await boot(factory, registry)).status, 'ready');
    assert.equal((await db.getAll('scores')).length, 2);
  } finally {
    db.closeDB();
    await registry.close();
  }
});
