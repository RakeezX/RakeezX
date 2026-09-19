import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { DB_NAME, DB_VERSION, STORES } from '../src/lib/db.js';
import {
  WORKSPACE_REGISTRY_DB_NAME,
  WORKSPACE_REGISTRY_DB_VERSION,
  DEMO_WORKSPACE_DB_NAME,
  LEGACY_WORKSPACE_DB_NAME,
  accountWorkspaceDatabaseName,
  createWorkspaceRegistry,
  detectWorkspaceDatabase,
  openWorkspaceBroadcastChannel,
  resolveWorkspace,
} from '../src/lib/workspaces.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function registry(factory = new IDBFactory()) {
  return createWorkspaceRegistry({ indexedDBFactory: factory, now: () => 1_900_000_000_000 });
}

test('legacy foundation detects the unchanged Production database without claiming or migrating it', async () => {
  const factory = new IDBFactory();
  const workspaces = registry(factory);
  await workspaces.recordLegacyPresence();
  const result = await resolveWorkspace({ type: 'legacy', legacyDetected: true }, { registry: workspaces });

  assert.equal(result.status, 'resolved');
  assert.deepEqual(result.workspace, {
    id: 'legacy', type: 'legacy', authUserId: null,
    databaseName: 'rakeezx', ownershipState: 'unclaimed', syncEligible: false,
    broadcastChannelName: 'rakeezx-data',
  });
  assert.equal(DB_NAME, LEGACY_WORKSPACE_DB_NAME);
  assert.equal(DB_VERSION, 7);
  assert.equal(STORES.length > 25, true);
  assert.equal((await detectWorkspaceDatabase(DB_NAME, { indexedDBFactory: factory })).exists, false,
    'registry operations must not open or upgrade the Product database');
  assert.equal((await detectWorkspaceDatabase(WORKSPACE_REGISTRY_DB_NAME, { indexedDBFactory: factory })).exists, true);
  assert.equal(WORKSPACE_REGISTRY_DB_VERSION, 1);
  await workspaces.close();
});

test('account workspaces resolve deterministically and cannot cross-resolve', async () => {
  const factory = new IDBFactory();
  const workspaces = registry(factory);
  await workspaces.registerAccount(USER_A, { cryptoProvider: webcrypto });
  await workspaces.registerAccount(USER_B, { cryptoProvider: webcrypto });

  const [a1, a2, b] = await Promise.all([
    resolveWorkspace({ type: 'account', authUserId: USER_A }, { registry: workspaces, cryptoProvider: webcrypto }),
    resolveWorkspace({ type: 'account', authUserId: USER_A.toUpperCase() }, { registry: workspaces, cryptoProvider: webcrypto }),
    resolveWorkspace({ type: 'account', authUserId: USER_B }, { registry: workspaces, cryptoProvider: webcrypto }),
  ]);

  assert.equal(a1.status, 'resolved');
  assert.equal(b.status, 'resolved');
  assert.equal(a1.workspace.databaseName, a2.workspace.databaseName);
  assert.notEqual(a1.workspace.databaseName, b.workspace.databaseName);
  assert.notEqual(a1.workspace.broadcastChannelName, b.workspace.broadcastChannelName);
  assert.equal(a1.workspace.databaseName, await accountWorkspaceDatabaseName(USER_A, { cryptoProvider: webcrypto }));
  assert.equal(a1.workspace.databaseName.includes(USER_A), false);
  assert.match(a1.workspace.databaseName, /^rakeezx-user-[0-9a-f]{32}$/);
  assert.equal(a1.workspace.authUserId, USER_A);
  assert.equal(b.workspace.authUserId, USER_B);
  assert.equal(a1.workspace.syncEligible, true);
  await workspaces.close();
});

test('an explicit legacy claim resolves the existing database in place and remains owner-idempotent', async () => {
  const factory = new IDBFactory();
  const workspaces = registry(factory);
  await workspaces.recordLegacyPresence();
  const first = await workspaces.registerLegacyClaim(USER_A, {
    claimId: 'claim:legacy-a', evidenceHash: 'evidence-a', cryptoProvider: webcrypto,
  });
  const repeated = await workspaces.registerLegacyClaim(USER_A, {
    claimId: 'claim:legacy-a', evidenceHash: 'evidence-a', cryptoProvider: webcrypto,
  });
  const resolved = await resolveWorkspace({ type: 'account', authUserId: USER_A }, {
    registry: workspaces, cryptoProvider: webcrypto,
  });

  assert.equal(first.id, repeated.id);
  assert.equal(resolved.status, 'resolved');
  assert.deepEqual(resolved.workspace, {
    id: first.id,
    type: 'account', authUserId: USER_A,
    databaseName: LEGACY_WORKSPACE_DB_NAME,
    ownershipState: 'claimed', syncEligible: true,
    broadcastChannelName: 'rakeezx-data',
    workspaceKind: 'legacy-in-place', claimId: 'claim:legacy-a',
  });
  await assert.rejects(
    workspaces.registerLegacyClaim(USER_B, {
      claimId: 'claim:legacy-b', evidenceHash: 'evidence-b', cryptoProvider: webcrypto,
    }),
    (error) => error?.code === 'WORKSPACE_REGISTRY_MISMATCH',
  );
  await workspaces.close();
});

test('Demo resolves only to its isolated, cloud-ineligible workspace', async () => {
  const workspaces = registry();
  await workspaces.registerDemo();
  const demo = await resolveWorkspace({ type: 'demo' }, { registry: workspaces });

  assert.equal(demo.status, 'resolved');
  assert.equal(demo.workspace.type, 'demo');
  assert.equal(demo.workspace.databaseName, DEMO_WORKSPACE_DB_NAME);
  assert.equal(demo.workspace.authUserId, null);
  assert.equal(demo.workspace.ownershipState, 'demo');
  assert.equal(demo.workspace.syncEligible, false);
  assert.notEqual(demo.workspace.databaseName, LEGACY_WORKSPACE_DB_NAME);
  await workspaces.close();
});

test('unknown, unregistered, unconfirmed legacy, and ambiguous requests fail closed', async () => {
  const empty = { read: async () => null, findByAuthUserId: async () => [] };
  const ambiguous = {
    read: async () => null,
    findByAuthUserId: async (authUserId) => [
      { id: 'one', type: 'account', authUserId },
      { id: 'two', type: 'account', authUserId },
    ],
  };

  assert.deepEqual(await resolveWorkspace({ type: 'other' }, { registry: empty }), {
    status: 'unresolved', reason: 'unknown-workspace-request', workspace: null,
  });
  assert.equal((await resolveWorkspace({ type: 'legacy' }, { registry: empty })).reason, 'legacy-presence-unconfirmed');
  assert.equal((await resolveWorkspace({ type: 'account', authUserId: USER_A }, {
    registry: empty, cryptoProvider: webcrypto,
  })).reason, 'account-workspace-not-registered');
  assert.equal((await resolveWorkspace({ type: 'account', authUserId: USER_A, legacyDetected: true }, {
    registry: empty, cryptoProvider: webcrypto,
  })).reason, 'legacy-workspace-unclaimed');
  assert.equal((await resolveWorkspace({ type: 'account', authUserId: 'not-a-user-id' }, {
    registry: empty, cryptoProvider: webcrypto,
  })).reason, 'invalid-auth-user-id');
  assert.equal((await resolveWorkspace({ type: 'account', authUserId: USER_A }, {
    registry: ambiguous, cryptoProvider: webcrypto,
  })).reason, 'ambiguous-account-workspace');
});

test('registration refuses to overwrite mismatched registry ownership metadata', async () => {
  const factory = new IDBFactory();
  const workspaces = registry(factory);
  await workspaces.registerDemo();
  const expectedName = await accountWorkspaceDatabaseName(USER_A, { cryptoProvider: webcrypto });
  const key = expectedName.slice('rakeezx-user-'.length);
  const db = await new Promise((resolve, reject) => {
    const request = factory.open(WORKSPACE_REGISTRY_DB_NAME, WORKSPACE_REGISTRY_DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const request = db.transaction('workspaces', 'readwrite').objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: USER_B,
      databaseName: expectedName, ownershipState: 'claimed', createdAt: 1, updatedAt: 1,
    });
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();

  await assert.rejects(
    workspaces.registerAccount(USER_A, { cryptoProvider: webcrypto }),
    (error) => error?.code === 'WORKSPACE_REGISTRY_MISMATCH',
  );
  await workspaces.close();
});

test('workspace BroadcastChannel namespaces prevent A events reaching B or Demo', async () => {
  class FakeBroadcastChannel {
    static members = new Map();
    constructor(name) {
      this.name = name;
      const members = FakeBroadcastChannel.members.get(name) ?? [];
      members.push(this);
      FakeBroadcastChannel.members.set(name, members);
    }
    postMessage(data) {
      for (const member of FakeBroadcastChannel.members.get(this.name) ?? []) {
        if (member !== this) member.onmessage?.({ data });
      }
    }
    close() {
      FakeBroadcastChannel.members.set(this.name,
        (FakeBroadcastChannel.members.get(this.name) ?? []).filter((member) => member !== this));
    }
  }

  const workspaces = registry();
  await workspaces.registerAccount(USER_A, { cryptoProvider: webcrypto });
  await workspaces.registerAccount(USER_B, { cryptoProvider: webcrypto });
  const a = (await resolveWorkspace({ type: 'account', authUserId: USER_A }, {
    registry: workspaces, cryptoProvider: webcrypto,
  })).workspace;
  const b = (await resolveWorkspace({ type: 'account', authUserId: USER_B }, {
    registry: workspaces, cryptoProvider: webcrypto,
  })).workspace;
  const demo = (await resolveWorkspace({ type: 'demo' }, { registry: workspaces })).workspace;
  const sender = openWorkspaceBroadcastChannel(a, FakeBroadcastChannel);
  const aPeer = openWorkspaceBroadcastChannel(a, FakeBroadcastChannel);
  const bPeer = openWorkspaceBroadcastChannel(b, FakeBroadcastChannel);
  const demoPeer = openWorkspaceBroadcastChannel(demo, FakeBroadcastChannel);
  const received = { a: 0, b: 0, demo: 0 };
  aPeer.onmessage = () => { received.a += 1; };
  bPeer.onmessage = () => { received.b += 1; };
  demoPeer.onmessage = () => { received.demo += 1; };

  sender.postMessage({ changed: ['students'] });
  assert.deepEqual(received, { a: 1, b: 0, demo: 0 });

  sender.close(); aPeer.close(); bPeer.close(); demoPeer.close();
  await workspaces.close();
});
