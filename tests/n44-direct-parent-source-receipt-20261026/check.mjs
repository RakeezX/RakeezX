// AI: actual mounted store/cloud and existing synthetic account/lease helpers.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import * as cloud from '../../src/lib/cloud.js';
import { prepareAccount, owner } from '../n44-fixture.mjs';
import { renewSyntheticLease } from '../n73-live/local-env.mjs';
import { createPushRuntime } from '../../src/lib/notification-push-runtime.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
globalThis.matchMedia = () => ({ matches: false });
const results = [];
let remote, hook, cleanup = null, reads = 0, cleanupReads = 0;
async function arrange(mode = 'direct', children = false) {
  cloud.setMockBackend({});
  await prepareAccount();
  await renewSyntheticLease(owner);
  await db.clearStore('outbox');
  store.state.items = [{ ...store.state.items.find(r => r.id === 'n44-item'), scoreMode: mode }];
  store.state.scoreSubitems = children ? [store.state.scoreSubitems[0]] : [];
  remote = { items: [{ id: 'n44-item', owner_id: owner, teaching_id: 'n44-teaching', revision: 1, deleted_at: null }],
    children: store.state.scoreSubitems.map(r => ({ id: r.id, owner_id: owner, item_id: 'n44-item', revision: 1, deleted_at: null })) };
  hook = null; cleanup = null; reads = 0; cleanupReads = 0;
  cloud.setMockBackend({ async readNotificationSourceIdentity() { reads++; if (hook) await hook(); return structuredClone(remote); },
    async readRetiredScoreSourceCleanup() { cleanupReads++; return cleanup ? [cleanup] : []; } });
}
const read = () => store.readNotificationSourceStatus('n44-item');
async function check(name, fn) { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
try {
  await arrange();
  if (process.argv.includes('--red')) {
    assert.equal(store.notificationSourceGroups().some(r => r.parentId === 'n44-item'), false);
    assert.deepEqual(await read(), { status: 'rejected' }); assert.equal(reads, 0);
    console.log('RED reproduced: actual direct/no-child parent omitted; explicit store read rejected before canonical transport.');
  } else {
    await check('direct and unconfigured subitems exact canonical parent, no due projection or writes', async () => {
      for (const mode of ['direct', 'subitems']) {
        await arrange(mode);
        const before = await db.getAll('outbox');
        assert.equal(store.notificationSourceGroups()[0].childIds.length, 0);
        assert.equal((await read()).status, 'confirmed'); assert.equal(reads, 1);
        assert.deepEqual(await db.getAll('outbox'), before);
        assert.equal((await store.confirmedNotificationSources()).some(r => r.kind === 'due'), false);
      }
    });
    await check('existing normal Support runtime issues and reads the direct parent choice only on request', async () => {
      await arrange();
      const runtime = createPushRuntime({ store, cloud, configuration: { enabled: false },
        window: { navigator: {}, localStorage }, fetch: () => { throw Error('Unexpected request'); } });
      try {
        const ui = runtime.normalUiSnapshot(), choice = ui.sources.find(r => r.parentId === 'n44-item');
        assert.ok(choice?.token); assert.equal(reads, 0);
        assert.equal(ui.reminders.some(r => r.itemId === 'n44-item'), false);
        assert.equal((await runtime.readSourceStatus(choice.token)).status, 'confirmed');
        assert.equal(reads, 1); assert.equal(runtime.normalUiSnapshot().sourceStatus.status, 'confirmed');
        assert.equal((await runtime.readSourceStatus('invented-choice')).status, 'rejected');
        assert.equal(reads, 1);
      } finally { runtime.dispose(); }
    });
    await check('pending and unknown commands, pending create and unconfirmed ancestry', async () => {
      for (const state of ['pending', 'unknown']) {
        await arrange(); await db.put('outbox', { id: 'command', state, store: 'items', recordId: 'n44-item' });
        assert.equal((await read()).status, 'pending');
      }
      for (const field of ['syncCreatePending', 'serverRevision']) {
        await arrange(); store.state.items[0][field] = field === 'syncCreatePending' ? true : null;
        assert.equal((await read()).status, 'unknown');
      }
      await arrange(); store.state.teachings.find(r => r.id === 'n44-teaching').serverRevision = null;
      assert.equal((await read()).status, 'unknown');
    });
    await check('canonical absent, revision, parent, teaching, deleted, malformed and child guards', async () => {
      const variants = [r => r.items = [], r => r.items[0].revision++, r => r.items[0].id = 'other',
        r => r.items[0].owner_id = 'foreign', r => r.items[0].teaching_id = 'other', r => r.items[0].deleted_at = 1,
        r => r.children = {}, r => r.items[0].revision = null,
        r => r.children = [{ id: 'orphan', item_id: 'other', owner_id: owner, revision: 1 }],
        r => r.children = [{ id: 'foreign', item_id: 'n44-item', owner_id: 'foreign', revision: 1 }],
        r => r.children = Array.from({ length: 201 }, (_, i) => ({ id: 'c' + i, item_id: 'n44-item', owner_id: owner, revision: 1 }))];
      for (const change of variants) { await arrange(); change(remote); assert.equal((await read()).status, 'unknown'); }
      for (const change of [r => r.items = [null], r => r.children = [null]]) {
        await arrange(); change(remote); await assert.rejects(read); // Existing runtime converts failure to UNKNOWN.
      }
      for (const change of [r => r.children[0].revision++, r => r.children[0].item_id = 'orphan',
        r => r.children.push({ ...r.children[0], id: 'foreign', owner_id: 'foreign' }),
        r => r.children.push({ ...r.children[0] }), r => r.children = []]) {
        await arrange('subitems', true); change(remote); assert.equal((await read()).status, 'unknown');
      }
    });
    await check('owner session workspace lease device ancestry and revision fenced after canonical await', async () => {
      const variants = [() => cloud.setMockAuth({ id: 'foreign' }, { ...cloud.session, user: { id: 'foreign' } }),
        () => cloud.setMockAuth(cloud.user, { ...cloud.session, access_token: 'changed' }),
        () => store.deactivateWorkspace(), () => {},
        () => store.state.device.deviceId = 'changed', () => store.state.items[0].teachingId = 'other',
        () => store.state.items[0].serverRevision++];
      // MemoryStorage intentionally has no clear(); remove the actual lease key.
      variants[3] = () => { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('rakeezx-offline-lease-v1:')) localStorage.removeItem(k); } };
      for (const [index, change] of variants.entries()) { await arrange(); hook = async () => change(); await assert.rejects(read, undefined, 'context fence ' + index); }
    });
    await check('outbox drift returns unknown; unsupported/direct-with-children/local foreign children rejected', async () => {
      await arrange(); hook = async () => db.put('outbox', { id: 'late', state: 'unknown', store: 'items', recordId: 'n44-item' });
      assert.equal((await read()).status, 'unknown');
      await arrange('unsupported'); assert.equal((await read()).status, 'rejected');
      await arrange('direct', true); assert.equal((await read()).status, 'rejected');
      await arrange('subitems', true); store.state.scoreSubitems[0].ownerId = 'foreign'; assert.equal((await read()).status, 'rejected');
      await arrange('subitems', true); store.state.scoreSubitems = Array.from({length:201}, (_,i) => ({...store.state.scoreSubitems[0],id:'c'+i})); assert.equal((await read()).status, 'rejected');
    });
    await check('configured subitem and exact cleanup tombstone receipt retained; empty is never cleanup ACK', async () => {
      await arrange('subitems', true); assert.equal((await read()).status, 'confirmed');
      const stamp = Date.now(), parent = store.state.items[0], child = store.state.scoreSubitems[0];
      parent.deleted = child.deleted = true; parent.updatedAt = stamp;
      await db.put('items', parent); remote.items[0].deleted_at = remote.children[0].deleted_at = stamp;
      assert.equal((await read()).status, 'unknown');
      const deviceId = store.state.device.deviceId, mutationId = 'cleanup-synthetic';
      cleanup = { owner_id: owner, mutation_id: mutationId, record_id: parent.id, device_id: deviceId, client_updated_at: stamp,
        request_envelope: { mutationId, command: 'delete_item', targetId: parent.id, deviceId, clientUpdatedAt: stamp },
        result: { mutationId, command: 'delete_item', targetId: parent.id, outcome: 'deleted' } };
      assert.equal((await read()).status, 'cleanup_confirmed');
      await arrange(); store.state.items[0].deleted = true; remote.items[0].deleted_at = stamp;
      assert.equal((await read()).status, 'unknown'); assert.equal(cleanupReads, 0);
    });
    await writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ taskId: 'continuous-n44-direct-parent-source-receipt-20261026', runId: '79fe5e31-4e73-4c6e-9053-f904a015cac6', baseSha: '7d4b7db15278f04c1fd59414e4b42357fbb053ab', red: 'Actual base module omitted direct/no-child and returned rejected, zero canonical reads (--red).', checks: results, liveSource4: 'UNKNOWN; no live operations', renderedUI: 'NOT_RUN; view unchanged' }, null, 2) + '\n');
  }
} finally { store.deactivateWorkspace(); await db.closeDB(); }
