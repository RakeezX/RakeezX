// AI: original cadence assertions retained; only authenticated fixture setup corrected.
// Original SHA256: 60aa2f08f098ee3b14b5f847dd49476618749b58dfe4ee2380b15899c5f23043
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { authenticate, renew } from './authenticated-fixture.mjs';

globalThis.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
globalThis.matchMedia = () => ({ matches: false });

import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from '../helpers/synthetic-workspace.mjs';

after(() => { store.closeChannel(); db.closeDB(); });

test('optimistic patch renders before Sync is ready, then signals only after durable outbox commit', async () => {
  authenticate(SYNTHETIC_WORKSPACE_OWNER);
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  await store.init();
  assert.throws(() => store.assertLeaseWritable(), { code: 'OFFLINE_LEASE_LIMITED' });
  await renew(SYNTHETIC_WORKSPACE_OWNER);
  // Existing acknowledged account row: avoid testing a different bootstrap/create path.
  const profile = { ...store.state.profile, canonicalId: 'profile', serverRevision: 1, ownerId: SYNTHETIC_WORKSPACE_OWNER };
  await db.put('profile', profile);store.state.profile = profile;
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
