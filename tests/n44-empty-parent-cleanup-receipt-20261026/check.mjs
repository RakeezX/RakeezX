// AI: actual store and cloud receipt validator; only the transport is synthetic.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import * as cloud from '../../src/lib/cloud.js';
import { prepareAccount, owner } from '../n44-fixture.mjs';
import { renewSyntheticLease } from '../n73-live/local-env.mjs';
import { createPushRuntime } from '../../src/lib/notification-push-runtime.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
globalThis.matchMedia = () => ({ matches: false });
globalThis.fetch = () => { throw Error('Live transport forbidden'); };
const resultUrl = new URL('./result.json', import.meta.url), checks = [];
const stamp = 1792980000000, parentId = 'n44-item', mutationId = 'existing-synthetic-delete';
let rows, remote, cleanupReads, receiptHook;
async function arrange(mode = 'direct') {
  cloud.setMockBackend({}); await prepareAccount(); await renewSyntheticLease(owner); await db.clearStore('outbox');
  const parent = { ...store.state.items[0], scoreMode: mode, deleted: true, updatedAt: stamp };
  store.state.items = [parent]; store.state.scoreSubitems = []; await db.put('items', parent);
  const deviceId = store.state.device.deviceId;
  rows = [{ owner_id: owner, mutation_id: mutationId, record_id: parentId, device_id: deviceId, client_updated_at: stamp,
    request_envelope: { mutationId, command: 'delete_item', targetId: parentId, deviceId, clientUpdatedAt: stamp },
    result: { mutationId, command: 'delete_item', targetId: parentId, outcome: 'deleted' } }];
  remote = { items: [{ id: parentId, owner_id: owner, teaching_id: parent.teachingId, revision: 1, deleted_at: stamp }], children: [] };
  cleanupReads = 0; receiptHook = null;
  cloud.setMockBackend({
    async readNotificationSourceIdentity() { return structuredClone(remote); },
    async readRetiredScoreSourceCleanup(args) {
      cleanupReads++; assert.deepEqual(args, { parentId, deviceId, cleanupStamp: stamp, cleanupMutationId: undefined, recoverCleanupMutationId: true });
      if (receiptHook) await receiptHook(); return structuredClone(rows);
    }
  });
}
const read = () => store.readNotificationSourceStatus(parentId);
async function check(name, fn) { await fn(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
try {
  if (process.argv.includes('--red')) {
    const observations = [];
    for (const mode of ['direct', 'subitems']) {
      await arrange(mode);
      const validated = await cloud.readRetiredScoreSourceCleanup({ parentId, deviceId: store.state.device.deviceId, cleanupStamp: stamp, recoverCleanupMutationId: true });
      assert.equal(validated.mutationId, mutationId); cleanupReads = 0;
      assert.equal((await read()).status, 'unknown'); assert.equal(cleanupReads, 0);
      observations.push({ mode, status: 'unknown', cleanupReads, rawReceiptValidatedSeparately: true });
    }
    await writeFile(resultUrl, JSON.stringify({ red: { baseSha: '8528d1995b36541c10529b9d268adf80b6d354b9', observations } }, null, 2) + '\n');
    console.log('RED reproduced: genuine receipt validates, but store skips its lookup for both empty parent modes.');
  } else {
    await check('n44_valid_empty_parent_cleanup_receipt_red_green', async () => {
      for (const mode of ['direct', 'subitems']) for (const outcome of ['deleted', 'already_deleted']) {
        await arrange(mode); rows[0].result.outcome = outcome;
        const before = await db.getAll('outbox'), saved = await db.get('items', parentId);
        const runtime = createPushRuntime({ store, cloud, configuration: { enabled: false }, window: { navigator: {}, localStorage }, fetch: globalThis.fetch });
        try {
          const choice = runtime.normalUiSnapshot().sources.find(r => r.parentId === parentId);
          assert.ok(choice?.token); assert.equal(cleanupReads, 0);
          const status = await runtime.readSourceStatus(choice.token);
          assert.equal(status.status, 'cleanup_confirmed'); assert.equal(cleanupReads, 1);
          assert.equal(status.cleanupReceipt.mutationId, mutationId); assert.equal(status.cleanupReceipt.outcome, outcome);
          assert.equal(runtime.normalUiSnapshot().sourceStatus.status, 'cleanup_confirmed');
        } finally { runtime.dispose(); }
        assert.deepEqual(await db.getAll('outbox'), before); assert.deepEqual(await db.get('items', parentId), saved);
        assert.equal((await store.confirmedNotificationSources()).some(r => r.kind === 'due'), false);
      }
    });
    await check('n44_real_cloud_receipt_validation_remains_strict', async () => {
      const variants = [
        () => rows = [], () => rows.push(structuredClone(rows[0])), () => rows = {},
        () => rows[0].owner_id = 'foreign', () => rows[0].device_id = 'other', () => rows[0].record_id = 'other',
        () => rows[0].client_updated_at++, () => rows[0].mutation_id = '', () => rows[0].mutation_id = 'different',
        () => rows[0].request_envelope = null, () => rows[0].result = null,
        ...['owner_id', 'device_id', 'record_id', 'client_updated_at', 'mutation_id'].map(key => () => delete rows[0][key]),
        ...['mutationId', 'command', 'targetId', 'deviceId', 'clientUpdatedAt'].map(key => () => rows[0].request_envelope[key] = 'mismatch'),
        ...['mutationId', 'command', 'targetId', 'deviceId', 'clientUpdatedAt'].map(key => () => delete rows[0].request_envelope[key]),
        ...['mutationId', 'command', 'targetId', 'outcome'].map(key => () => rows[0].result[key] = 'mismatch'),
        ...['mutationId', 'command', 'targetId', 'outcome'].map(key => () => delete rows[0].result[key]),
        ...['pending', 'unknown'].map(outcome => () => rows[0].result.outcome = outcome)
      ];
      for (const mode of ['direct', 'subitems']) for (const change of variants) {
        await arrange(mode); change(); const status = await read();
        assert.equal(status.status, 'unknown'); assert.equal(status.cleanupReceipt, null); assert.equal(cleanupReads, 1);
      }
    });
    await check('n44_existing_parent_source_status_fences_preserved', async () => {
      for (const mode of ['direct', 'subitems']) {
        for (const state of ['pending', 'unknown']) {
          await arrange(mode); await db.put('outbox', { id: 'command', state, store: 'items', recordId: parentId });
          assert.equal((await read()).status, 'pending');
        }
        for (const change of [() => remote.items[0].revision++, () => remote.items[0].deleted_at = null,
          () => remote.items[0].owner_id = 'foreign', () => remote.items[0].id = 'other',
          () => store.state.items[0].serverRevision = null, () => store.state.items[0].syncCreatePending = true,
          () => store.state.teachings.find(r => r.id === 'n44-teaching').serverRevision = null]) {
          await arrange(mode); change(); assert.equal((await read()).status, 'unknown');
        }
        for (const change of [async () => db.remove('items', parentId),
          async () => db.put('items', { ...store.state.items[0], ownerId: 'foreign' }),
          async () => db.put('items', { ...store.state.items[0], deleted: false }),
          async () => db.put('items', { ...store.state.items[0], updatedAt: null })]) {
          await arrange(mode); await change(); assert.equal((await read()).status, 'unknown'); assert.equal(cleanupReads, 0);
        }
        const drifts = [() => cloud.setMockAuth({ id: 'foreign' }, { ...cloud.session, user: { id: 'foreign' } }),
          () => cloud.setMockAuth(cloud.user, { ...cloud.session, access_token: 'changed' }), () => store.deactivateWorkspace(),
          () => { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('rakeezx-offline-lease-v1:')) localStorage.removeItem(k); } },
          () => store.state.device.deviceId = 'changed', () => store.state.items[0].serverRevision++,
          () => store.state.items[0].teachingId = 'other', () => db.put('items', { ...store.state.items[0], updatedAt: stamp + 1 })];
        for (const change of drifts) { await arrange(mode); receiptHook = change; await assert.rejects(read); }
        await arrange(mode); receiptHook = () => db.put('outbox', { id: 'late', state: 'unknown', store: 'items', recordId: parentId });
        assert.equal((await read()).status, 'unknown');
      }
    });
    const previous = JSON.parse(await readFile(resultUrl, 'utf8'));
    await writeFile(resultUrl, JSON.stringify({ taskId: 'continuous-n44-empty-parent-cleanup-receipt-20261026', runId: 'f801a14d-f183-49d5-ab9b-a58b6f777cce', baseSha: '8528d1995b36541c10529b9d268adf80b6d354b9', red: previous.red, checks, liveOperations: 0, renderedUI: 'NOT_RUN; no view changes' }, null, 2) + '\n');
  }
} finally { store.deactivateWorkspace(); await db.closeDB(); }
