import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

globalThis.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
globalThis.matchMedia = () => ({ matches: false });

import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

after(() => { store.closeChannel(); db.closeDB(); });

test('optimistic patch renders before Sync is ready, then signals only after durable outbox commit', async () => {
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  await store.init();
  const updates = [];
  const unsubscribe = store.subscribe((_state, update) => updates.push(update));
  const saved = await store.patchProfile({ teacherName: 'Synthetic durable patch' });
  await Promise.resolve();
  unsubscribe();

  assert.equal(saved.teacherName, 'Synthetic durable patch');
  assert.deepEqual(updates.map((update) => update.syncReady), [false, true]);
  assert.equal(updates[0].render, true);
  assert.equal(updates[1].render, false);
  assert.ok((await db.getAll('outbox')).some((entry) => entry.store === 'profile'));
});

test('batch save signals Sync only after its outbox is durable', async () => {
  const updates = [];
  const unsubscribe = store.subscribe((_state, update) => updates.push(update));
  const saved = await store.save({
    subjects: [{ id: 'synthetic-cadence-subject', name: 'Synthetic Subject', updatedAt: Date.now(), deleted: false }],
  });
  await Promise.resolve();
  unsubscribe();

  assert.equal(saved, true);
  assert.deepEqual(updates.map((update) => update.syncReady), [false, true]);
  assert.ok((await db.getAll('outbox')).some((entry) => entry.store === 'subjects' && entry.recordId === 'synthetic-cadence-subject'));
});
