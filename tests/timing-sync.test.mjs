import 'fake-indexeddb/auto';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { DEFAULT_TIME_PROFILES } from '../src/models.js';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });

beforeEach(async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
});

test('owner-global activation queues only a profile V2 mutation and ignores legacy device selection', async () => {
  const [summer, winter] = DEFAULT_TIME_PROFILES;
  await store.patchDevice({ activeTimeProfileId: winter.id }, { queue: false });
  assert.equal(store.activeTimeProfile().id, summer.id, 'old device-local selection is not promoted');

  await store.setActiveTimeProfile(winter.id);
  assert.equal(store.state.profile.activeTimeProfileId, winter.id);
  assert.equal(store.activeTimeProfile().id, winter.id);
  const outbox = await db.getAll('outbox');
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].store, 'profile');
  assert.equal(outbox[0].patch.active_time_profile_id, winter.id);
});

test('null, missing, and deleted owner selections use deterministic fallback without resurrection', async () => {
  const [summer, winter] = DEFAULT_TIME_PROFILES;
  await store.patchProfile({ activeTimeProfileId: null }, { queue: false });
  assert.equal(store.activeTimeProfile().id, summer.id);
  await store.patchProfile({ activeTimeProfileId: 'missing-profile' }, { queue: false });
  assert.equal(store.activeTimeProfile().id, summer.id);

  await store.patchProfile({ activeTimeProfileId: winter.id }, { queue: false });
  await store.patch('timeProfiles', winter.id, { deleted: true }, null, { queue: false });
  assert.equal(store.activeTimeProfile().id, summer.id);
  assert.equal(store.state.timeProfiles.find((profile) => profile.id === winter.id)?.deleted, true);
  assert.equal(store.timeProfiles().length, 3);
});
