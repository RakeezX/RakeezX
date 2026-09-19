import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';

import { createWorkspaceRegistry } from '../src/lib/workspaces.js';
import {
  WORKSPACE_NOT_READY,
  readWorkspaceClaimMetadata,
  resolveWorkspaceForBoot,
} from '../src/lib/workspace-routing.js';
import { createSyncOwnershipGuard } from '../src/lib/sync-ownership.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLAIM_ID = 'claim:routing-a';

const marker = (overrides = {}) => ({
  version: 1,
  claimId: CLAIM_ID,
  state: 'claimed',
  ownerId: A,
  databaseName: 'rakeezx',
  ...overrides,
});

async function putDevice(factory, workspaceClaim = null) {
  const database = await new Promise((resolve, reject) => {
    const request = factory.open('rakeezx', 7);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('device')) {
        request.result.createObjectStore('device', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = database.transaction('device', 'readwrite');
    tx.objectStore('device').put({ id: 'device', deviceId: 'device:routing', ...(workspaceClaim ? { workspaceClaim } : {}) });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

async function claimedFixture({ markerOverrides = {}, includeRegistry = true } = {}) {
  const indexedDBFactory = new IDBFactory();
  await putDevice(indexedDBFactory, marker(markerOverrides));
  const registry = createWorkspaceRegistry({ indexedDBFactory, now: () => 123 });
  if (includeRegistry) {
    await registry.registerLegacyClaim(A, {
      claimId: CLAIM_ID,
      evidenceHash: 'evidence:routing',
      cryptoProvider: webcrypto,
    });
  }
  return { indexedDBFactory, registry };
}

test('claimed A resolves the exact in-place workspace online or from cached offline identity', async () => {
  for (const authSource of ['server', 'cached-offline']) {
    const { indexedDBFactory, registry } = await claimedFixture();
    const result = await resolveWorkspaceForBoot({
      authUser: { id: A }, authState: 'authenticated', registry,
      indexedDBFactory, cryptoProvider: webcrypto,
    });
    assert.equal(result.status, 'ready', authSource);
    assert.equal(result.mode, 'claimed-account');
    assert.equal(result.workspace.authUserId, A);
    assert.equal(result.workspace.databaseName, 'rakeezx');
    const guard = createSyncOwnershipGuard({ workspace: result.workspace });
    assert.equal(guard.enqueueAccess().allowed, true);
    assert.equal(guard.bindNewCommand({ id: authSource }).ownerId, A);
    await registry.close();
  }
});

test('explicit signed-out state protects a claimed workspace without opening its Product DB', async () => {
  const { indexedDBFactory, registry } = await claimedFixture();
  let productMetadataReads = 0;
  const result = await resolveWorkspaceForBoot({
    authUser: null, authState: 'signed_out', registry, indexedDBFactory,
    cryptoProvider: webcrypto,
    readClaimMetadata: async () => { productMetadataReads += 1; throw new Error('must not open'); },
  });
  assert.equal(result.status, 'not_ready');
  assert.equal(result.code, WORKSPACE_NOT_READY);
  assert.equal(result.reason, 'claimed-workspace-signed-out');
  assert.equal(productMetadataReads, 0);
  await registry.close();
});

test('Auth B cannot open, render, write, pull, or dispatch A workspace', async () => {
  const { indexedDBFactory, registry } = await claimedFixture();
  let productMetadataReads = 0;
  const result = await resolveWorkspaceForBoot({
    authUser: { id: B }, authState: 'authenticated', registry, indexedDBFactory,
    cryptoProvider: webcrypto,
    readClaimMetadata: async () => { productMetadataReads += 1; throw new Error('must not open'); },
  });
  assert.equal(result.status, 'not_ready');
  assert.equal(result.reason, 'authenticated-account-workspace-mismatch');
  assert.equal(result.workspace, null);
  assert.equal(productMetadataReads, 0);
  const guard = createSyncOwnershipGuard({ workspace: {
    type: 'unresolved', ownershipState: 'unresolved', reason: result.reason,
  } });
  assert.equal(guard.enqueueAccess().allowed, false);
  assert.equal(guard.cloudAccess({ operation: 'pull', authenticatedUserId: B }).allowed, false);
  assert.equal(guard.cloudAccess({ operation: 'dispatch', authenticatedUserId: B, command: { ownerId: A } }).allowed, false);
  await registry.close();
});

test('registry/marker owner, claim ID, and recovery mismatches fail closed', async (t) => {
  for (const [name, markerOverrides, reason] of [
    ['owner', { ownerId: B }, 'workspace-claim-registry-mismatch'],
    ['claim id', { claimId: 'claim:other' }, 'workspace-claim-registry-mismatch'],
    ['pending recovery', { state: 'registry_pending' }, 'workspace-claim-recovery-required'],
  ]) {
    await t.test(name, async () => {
      const { indexedDBFactory, registry } = await claimedFixture({ markerOverrides });
      const result = await resolveWorkspaceForBoot({
        authUser: { id: A }, authState: 'authenticated', registry,
        indexedDBFactory, cryptoProvider: webcrypto,
      });
      assert.equal(result.status, 'not_ready');
      assert.equal(result.reason, reason);
      await registry.close();
    });
  }
});

test('a claimed marker with a missing registry never falls back to ownerless legacy mode', async () => {
  const { indexedDBFactory, registry } = await claimedFixture({ includeRegistry: false });
  const result = await resolveWorkspaceForBoot({
    authUser: { id: A }, authState: 'authenticated', registry,
    indexedDBFactory, cryptoProvider: webcrypto,
  });
  assert.equal(result.status, 'not_ready');
  assert.equal(result.reason, 'claimed-workspace-registry-missing');
  await registry.close();
});

test('an existing unclaimed legacy database keeps the manual-claim transition', async () => {
  const indexedDBFactory = new IDBFactory();
  await putDevice(indexedDBFactory, null);
  const registry = createWorkspaceRegistry({ indexedDBFactory });
  const result = await resolveWorkspaceForBoot({
    authUser: null, authState: 'signed_out', registry,
    indexedDBFactory, cryptoProvider: webcrypto,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.mode, 'legacy-unclaimed');
  assert.equal(result.workspace.type, 'legacy');
  assert.equal(result.workspace.syncEligible, false);
  await registry.close();
});

test('fresh signed-out and unknown authenticated accounts are not provisioned and Demo is never selected', async () => {
  const indexedDBFactory = new IDBFactory();
  const registry = createWorkspaceRegistry({ indexedDBFactory });
  const signedOut = await resolveWorkspaceForBoot({
    authState: 'signed_out', registry, indexedDBFactory, cryptoProvider: webcrypto,
  });
  const unknown = await resolveWorkspaceForBoot({
    authUser: { id: A }, authState: 'authenticated', registry,
    indexedDBFactory, cryptoProvider: webcrypto,
  });
  assert.equal(signedOut.reason, 'workspace-not-provisioned');
  assert.equal(unknown.reason, 'initial-restore-required');
  assert.equal(signedOut.workspace, null);
  assert.equal(unknown.workspace, null);
  await registry.close();
});

test('claim metadata inspection is read-only and does not create a missing Product DB', async () => {
  const indexedDBFactory = new IDBFactory();
  const absent = { status: 'known', exists: false };
  const metadata = await readWorkspaceClaimMetadata('rakeezx', { indexedDBFactory, databasePresence: absent });
  assert.equal(metadata.status, 'unavailable');
  assert.deepEqual(await indexedDBFactory.databases(), []);
});
