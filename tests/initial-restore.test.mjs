import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.crypto ??= webcrypto;

const restore = await import('../src/lib/initial-restore.js');
const db = await import('../src/lib/db.js');
const { createWorkspaceRegistry, accountWorkspaceDatabaseName } = await import('../src/lib/workspaces.js');
const { resolveWorkspaceForBoot } = await import('../src/lib/workspace-routing.js');

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';

function row(entity, id, owner = OWNER_A, revision = 1, deleted = false) {
  return { id, owner_id: owner, revision, field_revisions: {}, deleted_at: deleted ? '2026-01-01T00:00:00Z' : null };
}

test('CORE_V1 is explicit and excludes deferred stores', () => {
  assert.equal(restore.CORE_V1_STORES.length, 24);
  for (const name of ['units', 'lessons', 'assignments', 'submissions', 'device', 'meta', 'outbox']) {
    assert.equal(restore.CORE_V1_STORES.includes(name), false);
  }
});

test('full manifest filtering ignores curriculum consistently but rejects unknown entities', () => {
  const filtered = restore.filterCoreRestoreManifest([
    { entity: 'units', id: 'u1', revision: 1, deleted: false },
    { entity: 'items', id: 'i1', revision: 4, deleted: true },
    { entity: 'lessons', id: 'l1', revision: 1, deleted: false },
  ]);
  assert.deepEqual(filtered, [{ entity: 'items', id: 'i1', revision: 4, deleted: true }]);
  assert.throws(() => restore.filterCoreRestoreManifest([
    { entity: 'unexpected', id: 'x', revision: 1, deleted: false },
  ]), { code: 'RESTORE_MANIFEST_INVALID' });
});

test('paginated fetch requests a final empty page for exactly 500 rows', async () => {
  const calls = [];
  const cloud = {
    async fetchRestoreEntityPage(entity, { offset, limit }) {
      calls.push({ entity, offset, limit });
      if (entity !== 'students') return [];
      if (offset === 0) return Array.from({ length: 500 }, (_, index) => row(entity, `s-${String(index).padStart(3, '0')}`));
      return [];
    },
  };
  const snapshot = await restore.fetchCoreSnapshot({ ownerId: OWNER_A, cloud });
  assert.equal(snapshot.students.length, 500);
  assert.deepEqual(calls.filter((call) => call.entity === 'students').map((call) => call.offset), [0, 500]);
});

test('foreign-owner and duplicate canonical rows fail closed', async () => {
  const foreign = { fetchRestoreEntityPage: async (entity) => entity === 'students' ? [row(entity, 's1', OWNER_B)] : [] };
  await assert.rejects(restore.fetchCoreSnapshot({ ownerId: OWNER_A, cloud: foreign }), { code: 'RESTORE_OWNER_MISMATCH' });
  const duplicate = { fetchRestoreEntityPage: async (entity) => entity === 'students' ? [row(entity, 's1'), row(entity, 's1')] : [] };
  await assert.rejects(restore.fetchCoreSnapshot({ ownerId: OWNER_A, cloud: duplicate }), { code: 'RESTORE_ROW_DUPLICATE' });
});

test('zero-row authoritative manifest is provisioning-required and tombstone-only is recoverable', async () => {
  const empty = await restore.acquireConsistentCoreSnapshot({
    ownerId: OWNER_A, cloud: { getSyncV2RestoreManifestFull: async () => [] },
  });
  assert.equal(empty.status, 'provisioning_required');
  const tombstone = { entity: 'students', id: 's1', revision: 2, deleted: true };
  const cloud = {
    getSyncV2RestoreManifestFull: async () => [tombstone],
    fetchRestoreEntityPage: async (entity) => entity === 'students' ? [row(entity, 's1', OWNER_A, 2, true)] : [],
  };
  const result = await restore.acquireConsistentCoreSnapshot({ ownerId: OWNER_A, cloud });
  assert.equal(result.status, 'ready');
  assert.equal(result.snapshot.students[0].deleted, true);
});

test('M1/M2 mismatch retries whole operation and fails after three attempts', async () => {
  let manifests = 0;
  const cloud = {
    getSyncV2RestoreManifestFull: async () => {
      manifests += 1;
      return [{ entity: 'students', id: 's1', revision: manifests % 2 ? 1 : 2, deleted: false }];
    },
    fetchRestoreEntityPage: async (entity) => entity === 'students' ? [row(entity, 's1')] : [],
  };
  await assert.rejects(restore.acquireConsistentCoreSnapshot({ ownerId: OWNER_A, cloud }), { code: 'RESTORE_FAILED' });
  assert.equal(manifests, 6);
});

test('atomic import preserves opaque curriculum IDs and starts with empty outbox', async () => {
  globalThis.indexedDB = fakeIndexedDB;
  db.closeDB();
  const databaseName = `rakeezx-user-${'a'.repeat(32)}`;
  db.selectDatabase(databaseName);
  const receipt = { protocol: 'CORE_V1', restoreId: 'r1', ownerId: OWNER_A, manifestHash: 'hash', completedAt: 1 };
  await db.importInitialRestoreSnapshot({
    profile: [{ id: 'profile', serverRevision: 1, deleted: false }],
    items: [{ id: 'i1', unitId: 'u-missing', lessonId: 'l-missing', serverRevision: 2, deleted: false }],
    sessions: [{ id: 'ss1', lessonId: 'l-missing', serverRevision: 3, deleted: false }],
  }, { id: 'device', deviceId: 'd1', initialRestoreReceipt: receipt });
  assert.equal((await db.get('items', 'i1')).unitId, 'u-missing');
  assert.equal((await db.get('sessions', 'ss1')).lessonId, 'l-missing');
  assert.deepEqual(await db.getAll('units'), []);
  assert.deepEqual(await db.getAll('lessons'), []);
  assert.deepEqual(await db.getAll('outbox'), []);
  assert.deepEqual(await db.readInitialRestoreReceipt(), receipt);
  db.closeDB();
});

test('atomic import abort exposes no partial replacement', async () => {
  globalThis.indexedDB = fakeIndexedDB;
  db.closeDB();
  db.selectDatabase(`rakeezx-user-${'b'.repeat(32)}`);
  const receipt = { protocol: 'CORE_V1', restoreId: 'r2', ownerId: OWNER_A, manifestHash: 'hash', completedAt: 1 };
  await assert.rejects(db.importInitialRestoreSnapshot({
    students: [{ id: 'ok' }, { nope: true }],
  }, { id: 'device', deviceId: 'd2', initialRestoreReceipt: receipt }));
  assert.deepEqual(await db.getAll('students'), []);
  assert.equal(await db.readInitialRestoreReceipt(), null);
  db.closeDB();
});

test('real coordinator restores, binds, routes, and preserves deferred references', async () => {
  globalThis.indexedDB = fakeIndexedDB;
  const owner = '33333333-3333-4333-8333-333333333333';
  const canonical = {
    profile: [{ owner_id: owner, revision: 1, field_revisions: {}, deleted_at: null, teacher_name: 'معلّم' }],
    items: [{ ...row('items', 'i-core', owner, 3), teaching_id: 't1', name: 'بند', max: 10, unit_id: 'u-deferred', lesson_id: 'l-deferred' }],
    sessions: [{ ...row('sessions', 'session-core', owner, 2), teaching_id: 't1', date: '2026-09-20', lesson_id: 'l-deferred' }],
  };
  const manifest = [
    { entity: 'profile', id: 'profile', revision: 1, deleted: false },
    { entity: 'items', id: 'i-core', revision: 3, deleted: false },
    { entity: 'sessions', id: 'session-core', revision: 2, deleted: false },
    { entity: 'units', id: 'u-deferred', revision: 1, deleted: false },
  ];
  const cloud = {
    async verifyCurrentAuthIdentity(expected) { return { id: expected }; },
    async getSyncV2RestoreManifestFull() { return manifest; },
    async fetchRestoreEntityPage(entity) { return canonical[entity] ?? []; },
  };
  const registry = createWorkspaceRegistry({ indexedDBFactory: fakeIndexedDB });
  db.closeDB();
  const result = await restore.runInitialRestore({
    expectedOwnerId: owner, registry, cloud, database: db,
    indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.workspace.authUserId, owner);
  assert.equal((await db.get('items', 'i-core')).unitId, 'u-deferred');
  assert.equal((await db.get('sessions', 'session-core')).lessonId, 'l-deferred');
  assert.deepEqual(await db.getAll('units'), []);
  assert.deepEqual(await db.getAll('outbox'), []);
  db.closeDB();

  const routed = await resolveWorkspaceForBoot({
    authUser: { id: owner }, authState: 'authenticated', registry,
    indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto,
  });
  assert.equal(routed.status, 'ready');
  assert.equal(routed.mode, 'restored-account');
  const other = await resolveWorkspaceForBoot({
    authUser: { id: OWNER_B }, authState: 'authenticated', registry,
    indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto,
  });
  assert.equal(other.status, 'not_ready');
  assert.notEqual(other.workspace?.authUserId, owner);
  await registry.close();
});

test('post-import crash resumes by same-owner receipt without refetching cloud data', async () => {
  globalThis.indexedDB = fakeIndexedDB;
  const owner = '44444444-4444-4444-8444-444444444444';
  const registry = createWorkspaceRegistry({ indexedDBFactory: fakeIndexedDB });
  const databaseName = await accountWorkspaceDatabaseName(owner, { cryptoProvider: webcrypto });
  const restoreId = 'crash-resume';
  const manifestHash = 'manifest-hash';
  await registry.beginAccountRestore(owner, {
    protocol: 'CORE_V1', restoreId, manifestHash, phase: 'RESTORE_FINALIZING',
  }, { cryptoProvider: webcrypto });
  db.closeDB();
  db.selectDatabase(databaseName);
  const receipt = { protocol: 'CORE_V1', restoreId, ownerId: owner, manifestHash, completedAt: 10 };
  await db.importInitialRestoreSnapshot({ profile: [{ id: 'profile', serverRevision: 1, deleted: false }] }, {
    id: 'device', deviceId: 'resume-device', initialRestoreReceipt: receipt,
  });
  db.closeDB();
  let fetched = false;
  const result = await restore.runInitialRestore({
    expectedOwnerId: owner, registry, database: db, indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto,
    cloud: {
      async verifyCurrentAuthIdentity(expected) { return { id: expected }; },
      async getSyncV2RestoreManifestFull() { fetched = true; throw new Error('must not fetch'); },
    },
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.resumed, true);
  assert.equal(fetched, false);
  db.closeDB();
  await registry.close();
});
