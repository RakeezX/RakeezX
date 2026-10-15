// AI: N107 reviewed-resume fixture adapter for the unchanged supplemental suite.
// Run this entry instead of running subject-flexibility.test.mjs directly.
// Its original workspace helper mounts an account but supplies no authenticated
// user/persisted session/verified offline lease. Production correctly refuses it.
// Supply those real synthetic prerequisites; retain every original assertion.
import { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
  key: index => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
beforeEach(async () => {
  const owner = store.getActiveWorkspace()?.authUserId;
  assert.ok(owner, 'The original suite must mount its account workspace first');
  // Same lower-level synthetic descriptor used by n12-import-store: the legacy
  // registry resolver predates leaseGeneration. This is not UI provenance.
  const workspace = store.getActiveWorkspace();
  assert.equal(workspace.ownershipState, 'claimed');
  store.activateWorkspace({ ...workspace, leaseGeneration: JSON.stringify([owner, null, null, null]) });
  const session = { access_token: 'n107-supplemental-synthetic-only', user: { id: owner } };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  cloud.setMockAuth(session.user, session);
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async () => ({ id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() }));
  assert.equal(store.getOfflineLeaseStatus().editable, true);
});

await import('./subject-flexibility.test.mjs');
