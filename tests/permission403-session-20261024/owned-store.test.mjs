// AI-authored: real account store, runtime ownership/lease guards and Sync dispatch.
import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../../src/lib/cloud.js';
import * as db from '../../src/lib/db.js';
import * as store from '../../src/store.js';
import { createSyncV2Engine } from '../../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../../src/lib/sync-ownership.js';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER as OWNER } from '../helpers/synthetic-workspace.mjs';
import { authenticate, renew } from '../n107-focus-sync-stability-20261020/authenticated-fixture.mjs';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; store.deactivateWorkspace('synthetic-complete'); store.closeChannel(); db.closeDB(); });

test('pending_sync_permission_failure_and_reopen_auth: real guarded store entry retains exact denied envelope', async () => {
  const auth = authenticate(OWNER);
  auth.refresh_token = 'fabricated-refresh';
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(auth));
  await activateSyntheticAccountWorkspace({ ownerId: OWNER });
  await db.clearAll();
  await store.init();
  await renew(OWNER);
  await db.clearStore('outbox');
  await store.save({ subjects: [{ id: 'synthetic-subject', name: 'Synthetic subject', deleted: false }] });
  const queued = (await db.getAll('outbox')).find(row => row.recordId === 'synthetic-subject');
  assert.equal(queued.ownerId, OWNER);
  const unknown = { id: 'unknown-prior-receipt', state: 'UNKNOWN', mutationId: 'unknown-fixed-id', envelopeLocked: true };
  await db.put('outbox', unknown);
  const before = await db.get('subjects', 'synthetic-subject');
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/apply_sync_v2_mutation');
    return Response.json({ code: '42501', message: 'permission denied' }, { status: 403 });
  };
  const engine = createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => cloud.user?.id,
    captureMutationContext: cloud.captureOwnedMutationContext });
  const result = await engine.dispatchPending({ onlyMutationId: queued.mutationId });
  assert.equal(calls, 1);
  assert.equal(result.acknowledged, 0);
  const retained = await db.get('outbox', queued.id);
  assert.equal(retained.mutationId, queued.mutationId);
  assert.deepEqual(retained.patch, queued.patch);
  assert.equal(retained.ownerId, OWNER);
  assert.equal(retained.envelopeLocked, true);
  assert.equal(retained.attemptCount, 1);
  assert.equal(retained.lastError.status, 403);
  assert.equal(retained.lastError.code, '42501');
  assert.notEqual(retained.state, 'acknowledged');
  assert.deepEqual(await db.get('subjects', 'synthetic-subject'), before);
  assert.deepEqual(await db.get('outbox', unknown.id), unknown);
  assert.equal(cloud.authStatus().state, 'authenticated');

  // Existing negative guards still run at the affected account entry.
  const foreign = { ...retained, ownerId: '22222222-2222-4222-8222-222222222222' };
  assert.equal(runtimeSyncOwnershipGuard.cloudAccess({ operation: 'dispatch', authenticatedUserId: OWNER, command: foreign }).allowed, false);
  cloud.setMockAuth({ id: foreign.ownerId }, { access_token: 'fabricated-foreign' });
  await assert.rejects(cloud.applySyncV2Mutation({}), { code: 'OWNED_MUTATION_CONTEXT_CHANGED' });
  assert.equal(calls, 1);
  cloud.setMockAuth(auth.user, auth);

  const database = store.getActiveWorkspace().databaseName;
  store.deactivateWorkspace('synthetic-reopen');
  await cloud.init();
  await activateSyntheticAccountWorkspace({ ownerId: OWNER });
  assert.equal(store.getActiveWorkspace().databaseName, database);
  assert.equal(cloud.user.id, OWNER);
  assert.equal(cloud.authStatus().state, 'authenticated');
  assert.deepEqual(await db.get('outbox', queued.id), retained);
  assert.deepEqual(await db.get('outbox', unknown.id), unknown);
  assert.deepEqual(await db.get('subjects', 'synthetic-subject'), before);
  assert.equal(calls, 1);
  runtimeOfflineLease().invalidate('synthetic-negative-lease-check');
  await assert.rejects(cloud.applySyncV2Mutation({}), { code: 'OFFLINE_LEASE_LIMITED' });
  assert.equal(calls, 1);
});
