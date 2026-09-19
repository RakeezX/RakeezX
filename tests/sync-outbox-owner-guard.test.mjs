import test from 'node:test';
import assert from 'node:assert/strict';

import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import {
  createSyncOwnershipGuard,
  LEGACY_UNCLAIMED_SYNC_WORKSPACE,
  SYNC_OWNERSHIP_BLOCKED,
} from '../src/lib/sync-ownership.js';
import { GenericV2Backend } from './helpers/generic-v2-backend.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const accountWorkspace = (ownerId) => ({
  id: `account:${ownerId}`,
  type: 'account',
  authUserId: ownerId,
  databaseName: `rakeezx-user-${ownerId.slice(0, 8)}`,
  ownershipState: 'claimed',
  syncEligible: true,
});

const demoWorkspace = {
  id: 'demo', type: 'demo', authUserId: null, databaseName: 'rakeezx-demo',
  ownershipState: 'demo', syncEligible: false,
};

class MemoryDatabase {
  constructor() { this.stores = new Map(); }
  rows(name) { if (!this.stores.has(name)) this.stores.set(name, new Map()); return this.stores.get(name); }
  async getAll(name) { return structuredClone([...this.rows(name).values()]); }
  async get(name, id) { return structuredClone(this.rows(name).get(id)); }
  async applyBatch(batch, { prepare } = {}) {
    const current = Object.fromEntries(await Promise.all(Object.keys(batch).map(async (name) => [name, await this.getAll(name)])));
    const writes = prepare ? prepare(current) : batch;
    if (writes && typeof writes.then === 'function') throw new TypeError('prepare must be synchronous');
    for (const [name, operations] of Object.entries(writes ?? {})) {
      const rows = this.rows(name);
      for (const id of operations.remove ?? []) rows.delete(id);
      for (const record of operations.put ?? []) rows.set(record.id, structuredClone(record));
    }
  }
  async put(name, record) { this.rows(name).set(record.id, structuredClone(record)); }
}

function harness({ workspace = accountWorkspace(A), authenticatedUserId = null } = {}) {
  const database = new MemoryDatabase();
  const backend = new GenericV2Backend();
  const calls = { mutations: 0, pulls: 0 };
  const auth = { id: authenticatedUserId };
  const ownershipGuard = createSyncOwnershipGuard({ workspace });
  const engine = createSyncV2Engine({
    database,
    ownershipGuard,
    currentAuthenticatedUserId: () => auth.id,
    now: (() => { let value = 1_900_000_000_000; return () => ++value; })(),
    makeId: (() => { let value = 0; return () => `owner-guard-${++value}`; })(),
    transport: {
      async applyMutation(envelope) {
        calls.mutations++;
        return backend.applySyncV2Mutation(envelope);
      },
      async fetchRecords(entity) {
        calls.pulls++;
        return backend.fetchRecords(entity);
      },
    },
  });
  return { database, backend, calls, auth, ownershipGuard, engine };
}

async function createStudent(client, id = 'student-owner-guard') {
  return client.engine.commitMutation({
    store: 'students', recordId: id, op: 'create',
    create: { id, name: 'طالب اختبار', note: '', status: 'active' },
  });
}

test('claimed workspace binds offline local mutations to its persisted owner without live Auth', async () => {
  const client = harness({ authenticatedUserId: null });
  const { mutation } = await createStudent(client);
  const command = await client.engine.queueCommand({
    store: 'students', recordId: 'student-owner-guard-command', command: 'test:owner-binding',
    patch: { status: 'active' },
  });
  assert.equal(mutation.ownerId, A);
  assert.equal(command.ownerId, A);
  assert.equal((await client.database.getAll('outbox')).every((row) => row.ownerId === A), true);
  assert.equal(client.calls.mutations, 0);
  assert.equal(client.calls.pulls, 0);
  assert.throws(
    () => client.ownershipGuard.bindNewCommand({ id: 'invalid-owner', ownerId: 'not-a-user-id' }),
    (error) => error.code === SYNC_OWNERSHIP_BLOCKED && error.reason === 'command-owner-mismatch',
  );
  assert.throws(
    () => client.ownershipGuard.bindNewCommand({ id: 'other-owner', ownerId: B }),
    (error) => error.code === SYNC_OWNERSHIP_BLOCKED && error.reason === 'command-owner-mismatch',
  );
});

test('matching account dispatches and ownerId remains local-only metadata', async () => {
  const client = harness({ authenticatedUserId: A });
  const { mutation } = await createStudent(client);
  const result = await client.engine.dispatchPending();
  assert.equal(result.acknowledged, 1);
  assert.equal(client.calls.mutations, 1);
  assert.equal(client.backend.table('students')[0]?.ownerId, undefined);
  assert.equal((await client.database.getAll('outbox')).length, 0);
  assert.equal(mutation.ownerId, A);
});

test('Account A command cannot leave the client while Account B is authenticated and resumes as A', async () => {
  const client = harness({ authenticatedUserId: B });
  const { mutation } = await createStudent(client);
  const first = await client.engine.dispatchPending();
  const retained = await client.database.get('outbox', mutation.id);
  assert.equal(first.ownershipBlocked, 1);
  assert.equal(first.blockReason, 'authenticated-user-owner-mismatch');
  assert.equal(client.calls.mutations, 0);
  assert.equal(retained.state, 'blocked');
  assert.equal(retained.blockedReason, 'ownership:authenticated-user-owner-mismatch');
  assert.equal(retained.lastError.code, SYNC_OWNERSHIP_BLOCKED);
  assert.equal(retained.lastError.retryable, false);
  assert.equal(retained.attemptCount, 0);
  assert.equal(retained.ownerId, A);

  const repeated = await client.engine.dispatchPending();
  assert.equal(repeated.ownershipBlocked, 1);
  assert.equal(client.calls.mutations, 0);
  assert.equal((await client.database.get('outbox', mutation.id)).attemptCount, 0);

  client.auth.id = A;
  const resumed = await client.engine.dispatchPending();
  assert.equal(resumed.acknowledged, 1);
  assert.equal(client.calls.mutations, 1);
  assert.equal(await client.database.get('outbox', mutation.id), undefined);
});

test('wrong workspace and ownerless claimed commands remain safety-blocked', async () => {
  const wrongWorkspace = harness({ authenticatedUserId: A });
  const { mutation } = await createStudent(wrongWorkspace, 'student-wrong-workspace');
  wrongWorkspace.ownershipGuard.setWorkspace(accountWorkspace(B));
  wrongWorkspace.auth.id = B;
  const wrong = await wrongWorkspace.engine.dispatchPending();
  const retained = await wrongWorkspace.database.get('outbox', mutation.id);
  assert.equal(wrong.ownershipBlocked, 1);
  assert.equal(wrong.blockReason, 'command-owner-mismatch');
  assert.equal(wrongWorkspace.calls.mutations, 0);
  assert.equal(retained.ownerId, A);

  const ownerless = harness({ authenticatedUserId: A });
  await ownerless.database.put('outbox', {
    ...mutation, id: 'v2:ownerless', mutationId: 'ownerless', recordId: 'student-ownerless',
    serverRecordId: 'student-ownerless', canonicalId: 'student-ownerless',
    logicalRecordKey: 'students:student-ownerless', state: 'pending',
    ownerId: undefined,
  });
  const missing = await ownerless.engine.dispatchPending();
  const missingRetained = await ownerless.database.get('outbox', 'v2:ownerless');
  assert.equal(missing.ownershipBlocked, 1);
  assert.equal(missing.blockReason, 'command-owner-missing');
  assert.equal(ownerless.calls.mutations, 0);
  assert.equal(missingRetained.state, 'blocked');
  assert.equal(missingRetained.ownerId, undefined);
});

test('cross-account pull is blocked before network or reconciliation', async () => {
  const client = harness({ authenticatedUserId: B });
  const result = await client.engine.pullAll({ stores: ['students'] });
  assert.equal(result.ownershipBlocked, true);
  assert.equal(result.blockReason, 'authenticated-user-owner-mismatch');
  assert.equal(result.retryable, false);
  assert.equal(client.calls.pulls, 0);
  assert.equal((await client.database.getAll('students')).length, 0);
  await assert.rejects(
    client.engine.pullStore('students'),
    (error) => error.code === SYNC_OWNERSHIP_BLOCKED && error.retryable === false,
  );
  assert.equal(client.calls.pulls, 0);
});

test('Demo is never cloud eligible and cannot create a cloud outbox command', async () => {
  const client = harness({ workspace: demoWorkspace, authenticatedUserId: A });
  await assert.rejects(
    createStudent(client, 'demo:student'),
    (error) => error.code === SYNC_OWNERSHIP_BLOCKED && error.reason === 'demo-sync-disabled',
  );
  const pull = await client.engine.pullAll({ stores: ['students'] });
  const push = await client.engine.dispatchPending();
  assert.equal(pull.ownershipBlocked, true);
  assert.equal(push.attempted, 0);
  assert.equal(client.calls.pulls, 0);
  assert.equal(client.calls.mutations, 0);
  assert.equal((await client.database.getAll('outbox')).length, 0);
});

test('temporary legacy-unclaimed path preserves ownerless Production behavior without implicit claim', async () => {
  const client = harness({ workspace: LEGACY_UNCLAIMED_SYNC_WORKSPACE, authenticatedUserId: B });
  const { mutation } = await createStudent(client, 'legacy-student');
  assert.equal('ownerId' in mutation, false);
  const pull = await client.engine.pullAll({ stores: ['students'] });
  const push = await client.engine.dispatchPending();
  assert.equal(pull.ownershipBlocked, false);
  assert.equal(push.acknowledged, 1);
  assert.ok(client.calls.pulls > 0);
  assert.equal(client.calls.mutations, 1);
  assert.deepEqual(client.ownershipGuard.getWorkspace(), LEGACY_UNCLAIMED_SYNC_WORKSPACE);
});
