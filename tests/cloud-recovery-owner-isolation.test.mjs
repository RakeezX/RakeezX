import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => null };
global.matchMedia = () => ({ matches: false });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import { buildBackup, validateBackupIntegrity } from '../src/lib/export.js';
import { previewCloudRestore, restoreBackupToCloud } from '../src/lib/backup-v2.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const auth = (id) => cloud.setMockAuth({ id }, { access_token: 'synthetic-only', user: { id } });

test('V5 backup from A cannot restore into B, including after B reload and retry', async () => {
  auth(OWNER_A);
  await activateSyntheticAccountWorkspace({ ownerId: OWNER_A });
  await db.clearAll();
  await db.put('students', { id: 'a:student', name: 'synthetic A', status: 'active', deleted: false, updatedAt: 1 });
  const aDatabase = store.getActiveWorkspace().databaseName;
  const backup = await buildBackup({ sourceOwnerId: OWNER_A, backupId: 'synthetic-a-v5' });
  assert.equal(backup.version, 5);
  assert.equal(backup.sourceOwnerId, OWNER_A);
  assert.equal((await validateBackupIntegrity(backup)).ok, true);

  store.deactivateWorkspace('synthetic-owner-switch');
  auth(OWNER_B);
  await activateSyntheticAccountWorkspace({ ownerId: OWNER_B });
  await db.clearAll();
  await store.init();
  await db.put('students', { id: 'b:student', name: 'synthetic B', status: 'active', deleted: false, updatedAt: 2 });
  const bDatabase = store.getActiveWorkspace().databaseName;
  assert.notEqual(bDatabase, aDatabase);
  assert.equal(store.getActiveWorkspace().authUserId, OWNER_B);
  const beforeStudents = await db.getAll('students');
  const beforeOutbox = await db.getAll('outbox');
  let stageCalls = 0;
  let finalizeCalls = 0;
  cloud.setMockBackend({ async fetchRecords() { return []; } });
  const preview = await previewCloudRestore(backup);
  assert.equal(preview.plan.ready, false);
  assert.equal(preview.plan.entries[0].reason, 'v5-owner-mismatch');
  const transport = {
    async stageScoreRestoreV2() { stageCalls++; throw new Error('cross-owner stage must not run'); },
    async finalizeScoreRestoreV2() { finalizeCalls++; throw new Error('cross-owner finalize must not run'); },
  };
  const coordinator = { async assertCloudRestoreReady() {}, async runCloudRestoreExclusive(task) { return task(); } };
  const attempt = () => restoreBackupToCloud(backup, {
    transport, coordinator, sourceFetcher: async () => ({}),
  });
  await assert.rejects(attempt(), (error) => error.code === 'RESTORE_REVIEW_REQUIRED' && !error.plan.ready);
  assert.deepEqual(await db.getAll('students'), beforeStudents);
  assert.deepEqual(await db.getAll('outbox'), beforeOutbox);
  assert.equal(await db.get('students', 'a:student'), undefined);
  assert.equal(store.getActiveWorkspace().authUserId, OWNER_B);
  assert.deepEqual([stageCalls, finalizeCalls], [0, 0]);

  store.deactivateWorkspace('synthetic-reload');
  auth(OWNER_B);
  await activateSyntheticAccountWorkspace({ ownerId: OWNER_B });
  await store.init();
  assert.equal(store.getActiveWorkspace().databaseName, bDatabase);
  assert.equal(store.getActiveWorkspace().authUserId, OWNER_B);
  await assert.rejects(attempt(), (error) => error.code === 'RESTORE_REVIEW_REQUIRED');
  assert.deepEqual(await db.getAll('students'), beforeStudents);
  assert.deepEqual(await db.getAll('outbox'), beforeOutbox);
  assert.equal(await db.get('students', 'a:student'), undefined);
  assert.deepEqual([stageCalls, finalizeCalls], [0, 0]);
  await store.save({ years: [{ id: 'b:year', label: 'synthetic B', hijriStart: 1450,
    hijriEnd: 1451, status: 'active' }] });
  const bOutbox = await db.getAll('outbox');
  assert.ok(bOutbox.length > 0);
  assert.ok(bOutbox.every((entry) => entry.ownerId === OWNER_B));
  store.deactivateWorkspace('synthetic-proof-complete');
  cloud.setMockBackend(null);
});

after(() => { store.deactivateWorkspace('test-complete'); store.closeChannel(); });
