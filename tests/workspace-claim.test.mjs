import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  CANONICAL_PRODUCTION_ORIGIN,
  LEGACY_WORKSPACE_CLAIM_CONFIRMATION,
  assessLegacyClaimEvidence,
  claimedWorkspaceAccess,
  createLegacyWorkspaceClaimService,
  stableClaimJSON,
} from '../src/lib/workspace-claim.js';
import { createSyncOwnershipGuard, LEGACY_UNCLAIMED_SYNC_WORKSPACE } from '../src/lib/sync-ownership.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = 1_900_000_000_000;

const confirmation = (ownerId = A) => ({
  action: LEGACY_WORKSPACE_CLAIM_CONFIRMATION,
  confirmed: true,
  otherTabsClosed: true,
  expectedOwnerId: ownerId,
  origin: CANONICAL_PRODUCTION_ORIGIN,
  databaseName: 'rakeezx',
});

const strongEvidence = () => ({
  online: true,
  canonicalEvidence: [{
    store: 'students', id: 'student:synthetic', meaningful: true,
    localRevision: 2, remoteRevision: 2,
    localHash: 'same-canonical-hash', remoteHash: 'same-canonical-hash', remotePresent: true,
  }],
});

class MemoryDatabase {
  constructor(outbox = []) {
    this.stores = new Map([
      ['device', new Map([['device', { id: 'device', deviceId: 'synthetic-device', updatedAt: 1 }]])],
      ['outbox', new Map(outbox.map((entry) => [entry.id, structuredClone(entry)]))],
    ]);
    this.applyCount = 0;
    this.failOnApply = null;
  }
  rows(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return this.stores.get(name);
  }
  async get(name, id) { return structuredClone(this.rows(name).get(id)); }
  async getAll(name) { return structuredClone([...this.rows(name).values()]); }
  async applyBatch(batch, { prepare } = {}) {
    this.applyCount += 1;
    if (this.failOnApply === this.applyCount) throw Object.assign(new Error('synthetic interruption'), { code: 'SYNTHETIC_INTERRUPTION' });
    const current = Object.fromEntries(Object.keys(batch).map((name) => [name, structuredClone([...this.rows(name).values()])]));
    const writes = prepare ? prepare(current) : batch;
    for (const [name, operations] of Object.entries(writes ?? {})) {
      const rows = this.rows(name);
      for (const id of operations.remove ?? []) rows.delete(id);
      for (const record of operations.put ?? []) rows.set(record.id, structuredClone(record));
    }
    return writes;
  }
}

class MemoryRegistry {
  constructor() { this.records = new Map(); this.failNext = false; }
  async list() { return structuredClone([...this.records.values()]); }
  async registerLegacyClaim(ownerId, { claimId, evidenceHash }) {
    if (this.failNext) { this.failNext = false; throw Object.assign(new Error('registry unavailable'), { code: 'REGISTRY_UNAVAILABLE' }); }
    const conflicting = [...this.records.values()].find((record) => record.databaseName === 'rakeezx' &&
      (record.authUserId !== ownerId || record.claimId !== claimId));
    if (conflicting) throw Object.assign(new Error('registry mismatch'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
    const record = {
      id: `account:${ownerId}`, type: 'account', authUserId: ownerId,
      databaseName: 'rakeezx', ownershipState: 'claimed', workspaceKind: 'legacy-in-place',
      claimId, evidenceHash,
    };
    this.records.set(record.id, structuredClone(record));
    return record;
  }
}

function outboxEntry(overrides = {}) {
  return {
    id: 'v2:synthetic', mutationId: 'synthetic', protocol: 'v2', store: 'students',
    recordId: 'student:synthetic', op: 'patch', patch: { name: 'Synthetic' },
    dependencies: [{ store: 'sections', recordId: 'section:synthetic' }],
    sequence: 7, queuedAt: 100, clientUpdatedAt: 100, state: 'failed', attemptCount: 3,
    lastError: { code: 'TEMPORARY', at: 101 }, blockedReason: null, envelopeLocked: true,
    ...overrides,
  };
}

function service({ database = new MemoryDatabase(), registry = new MemoryRegistry(), guard = createSyncOwnershipGuard(),
  evidenceProvider = strongEvidence, runExclusive = async (task) => task() } = {}) {
  return createLegacyWorkspaceClaimService({
    activationEnabled: true,
    database,
    registry,
    ownershipGuard: guard,
    verifyIdentity: async (ownerId) => ({ id: ownerId, source: 'supabase-auth-user', verifiedAt: NOW }),
    evidenceProvider,
    runExclusive,
    originProvider: () => CANONICAL_PRODUCTION_ORIGIN,
    now: () => NOW,
    makeId: () => 'claim:synthetic',
    cryptoProvider: webcrypto,
  });
}

test('claim activation is off by default and performs no storage access', async () => {
  let touched = false;
  const claimant = createLegacyWorkspaceClaimService({
    database: { get() { touched = true; }, getAll() { touched = true; } },
    registry: { list() { touched = true; } },
  });
  await assert.rejects(claimant.claim({ expectedOwnerId: A, confirmation: confirmation() }),
    (error) => error.code === 'WORKSPACE_CLAIM_DISABLED');
  assert.equal(touched, false);
});

test('same-owner claim is atomic, preserves command identity/state, and repeats idempotently', async () => {
  const original = outboxEntry();
  const database = new MemoryDatabase([original]);
  const registry = new MemoryRegistry();
  const guard = createSyncOwnershipGuard({ workspace: LEGACY_UNCLAIMED_SYNC_WORKSPACE });
  const claimant = service({ database, registry, guard });

  const first = await claimant.claim({ expectedOwnerId: A, confirmation: confirmation() });
  const stamped = await database.get('outbox', original.id);
  const marker = (await database.get('device', 'device')).workspaceClaim;
  assert.equal(first.status, 'claimed');
  assert.equal(first.stampedCommands, 1);
  assert.equal(marker.state, 'claimed');
  assert.equal(stamped.ownerId, A);
  const { ownerId: _ignored, ...withoutOwner } = stamped;
  assert.equal(stableClaimJSON(withoutOwner), stableClaimJSON(original));
  assert.equal(marker.databaseName, 'rakeezx');
  assert.equal(guard.getWorkspace().authUserId, A);

  const repeated = await claimant.claim({ expectedOwnerId: A, confirmation: confirmation() });
  assert.equal(repeated.status, 'already_claimed');
  assert.equal(repeated.claimId, first.claimId);
  assert.equal(repeated.stampedCommands, 0);
  assert.deepEqual(await database.get('outbox', original.id), stamped);
});

test('wrong owner, canonical contradiction, and conflicting outbox reject without mutation', async (t) => {
  await t.test('wrong verified owner', async () => {
    const database = new MemoryDatabase([outboxEntry()]);
    const claimant = createLegacyWorkspaceClaimService({
      activationEnabled: true, database, registry: new MemoryRegistry(),
      ownershipGuard: createSyncOwnershipGuard(),
      verifyIdentity: async () => ({ id: B, source: 'supabase-auth-user', verifiedAt: NOW }),
      evidenceProvider: strongEvidence, originProvider: () => CANONICAL_PRODUCTION_ORIGIN,
      runExclusive: async (task) => task(),
      now: () => NOW, cryptoProvider: webcrypto,
    });
    await assert.rejects(claimant.claim({ expectedOwnerId: A, confirmation: confirmation() }),
      (error) => error.code === 'WORKSPACE_CLAIM_IDENTITY_UNVERIFIED');
    assert.equal((await database.get('device', 'device')).workspaceClaim, undefined);
    assert.equal((await database.get('outbox', 'v2:synthetic')).ownerId, undefined);
  });

  await t.test('canonical mismatch', async () => {
    const database = new MemoryDatabase([outboxEntry()]);
    const claimant = service({ database, evidenceProvider: async () => ({ online: true, canonicalEvidence: [{
      meaningful: true, localRevision: 2, remoteRevision: 2,
      localHash: 'local', remoteHash: 'remote', remotePresent: true,
    }] }) });
    await assert.rejects(claimant.claim({ expectedOwnerId: A, confirmation: confirmation() }),
      (error) => error.code === 'WORKSPACE_CLAIM_EVIDENCE_CONFLICT');
    assert.equal((await database.get('device', 'device')).workspaceClaim, undefined);
  });

  await t.test('conflicting command owner', async () => {
    const database = new MemoryDatabase([outboxEntry({ ownerId: B })]);
    const claimant = service({ database });
    await assert.rejects(claimant.claim({ expectedOwnerId: A, confirmation: confirmation() }),
      (error) => error.code === 'WORKSPACE_CLAIM_EVIDENCE_CONFLICT');
    assert.equal((await database.get('outbox', 'v2:synthetic')).ownerId, B);
    assert.equal((await database.get('device', 'device')).workspaceClaim, undefined);
  });
});

test('registry interruption leaves a durable checkpoint and same-owner retry finishes safely', async () => {
  const original = outboxEntry();
  const database = new MemoryDatabase([original]);
  const registry = new MemoryRegistry();
  registry.failNext = true;
  const guard = createSyncOwnershipGuard();
  const claimant = service({ database, registry, guard });

  await assert.rejects(claimant.claim({ expectedOwnerId: A, confirmation: confirmation() }),
    (error) => error.code === 'REGISTRY_UNAVAILABLE');
  let device = await database.get('device', 'device');
  assert.equal(device.workspaceClaim.state, 'registry_pending');
  assert.deepEqual(device.workspaceClaimRecovery.outbox, [original]);
  assert.equal((await database.get('outbox', original.id)).ownerId, A);
  assert.equal(guard.getWorkspace().reason, 'workspace-claim-recovery-required');

  const resumed = await claimant.claim({ expectedOwnerId: A, confirmation: confirmation() });
  device = await database.get('device', 'device');
  assert.equal(resumed.status, 'claimed');
  assert.equal(device.workspaceClaim.state, 'claimed');
  assert.deepEqual(device.workspaceClaimRecovery.outbox, [original]);
});

test('finalization interruption resumes without restamping or replacing recovery evidence', async () => {
  const original = outboxEntry();
  const database = new MemoryDatabase([original]);
  database.failOnApply = 2;
  const registry = new MemoryRegistry();
  const claimant = service({ database, registry });

  await assert.rejects(claimant.claim({ expectedOwnerId: A, confirmation: confirmation() }),
    (error) => error.code === 'SYNTHETIC_INTERRUPTION');
  const checkpoint = await database.get('device', 'device');
  assert.equal(checkpoint.workspaceClaim.state, 'registry_pending');
  assert.deepEqual(checkpoint.workspaceClaimRecovery.outbox, [original]);

  database.failOnApply = null;
  const resumed = await claimant.claim({ expectedOwnerId: A, confirmation: confirmation() });
  assert.equal(resumed.status, 'claimed');
  assert.equal((await database.get('device', 'device')).workspaceClaim.state, 'claimed');
  assert.equal((await database.get('outbox', original.id)).attemptCount, original.attemptCount);
});

test('claim fence blocks dispatch, serializes concurrent owners, and enables offline owner binding', async () => {
  const database = new MemoryDatabase([outboxEntry()]);
  const registry = new MemoryRegistry();
  const guard = createSyncOwnershipGuard();
  let exclusiveActive = false;
  let releaseRegistry;
  let reportRegistryEntered;
  const registryGate = new Promise((resolve) => { releaseRegistry = resolve; });
  const registryEntered = new Promise((resolve) => { reportRegistryEntered = resolve; });
  const originalRegister = registry.registerLegacyClaim.bind(registry);
  registry.registerLegacyClaim = async (...args) => {
    reportRegistryEntered();
    await registryGate;
    return originalRegister(...args);
  };
  const claimant = service({
    database, registry, guard,
    runExclusive: async (task) => {
      assert.equal(exclusiveActive, false);
      exclusiveActive = true;
      try { return await task(); } finally { exclusiveActive = false; }
    },
    evidenceProvider: async () => {
      const access = guard.cloudAccess({ operation: 'pull', authenticatedUserId: A });
      assert.equal(access.allowed, false);
      assert.equal(access.reason, 'workspace-claim-in-progress');
      return strongEvidence();
    },
  });

  const first = claimant.claim({ expectedOwnerId: A, confirmation: confirmation() });
  const second = claimant.claim({ expectedOwnerId: B, confirmation: confirmation(B) });
  await registryEntered;
  assert.equal(exclusiveActive, true);
  assert.equal(guard.cloudAccess({ operation: 'pull', authenticatedUserId: A }).allowed, false);
  releaseRegistry();
  await first;
  await assert.rejects(second, (error) => ['WORKSPACE_CLAIM_CONFLICT', 'WORKSPACE_CLAIM_EVIDENCE_CONFLICT'].includes(error.code));

  const offlineCommand = guard.bindNewCommand({ id: 'offline:synthetic' });
  assert.equal(offlineCommand.ownerId, A);
  const marker = (await database.get('device', 'device')).workspaceClaim;
  assert.equal(claimedWorkspaceAccess({ claimMarker: marker, authenticatedUserId: A, authState: 'authenticated' }).allowed, true);
  assert.deepEqual(claimedWorkspaceAccess({ claimMarker: marker, authenticatedUserId: null, authState: 'signed_out' }), {
    allowed: false, reason: 'claimed-workspace-signed-out', ownerId: A,
  });
});

test('shared/default-only evidence never establishes ownership without explicit confirmation', () => {
  const assessment = assessLegacyClaimEvidence({
    expectedOwnerId: A, verifiedOwnerId: A, online: true,
    canonicalEvidence: [{ meaningful: false, localRevision: 4, remoteRevision: 4, remotePresent: true,
      localHash: 'default', remoteHash: 'default' }],
  });
  assert.equal(assessment.status, 'confirmation_required');
  assert.equal(assessment.strongMatches, 0);
});
