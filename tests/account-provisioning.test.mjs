import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { IDBFactory } from 'fake-indexeddb';
import * as db from '../src/lib/db.js';
import { buildAccountFoundationDefaults, runAccountProvisioning } from '../src/lib/account-provisioning.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';
import { createWorkspaceRegistry } from '../src/lib/workspaces.js';
import { resolveWorkspaceForBoot } from '../src/lib/workspace-routing.js';
import { defaultItemsFor } from '../src/models.js';

globalThis.crypto ??= webcrypto;
globalThis.indexedDB = fakeIndexedDB;
const OWNER = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const mapping = { years: 'years', terms: 'terms', subjects: 'subjects', calendars: 'calendars',
  calendarDays: 'calendar_days', timeProfiles: 'time_profiles' };

function snapshot(owner = OWNER) {
  const defaults = buildAccountFoundationDefaults();
  const canonical = { profile: [{ owner_id: owner, revision: 1, field_revisions: {}, deleted_at: null,
    teacher_name: 'Teacher', phone: '0500000001', teacher_form: 'masculine' }] };
  for (const [store, entity] of Object.entries(mapping)) {
    canonical[entity] = defaults[store].map((record) => ({ id: record.id, owner_id: owner,
      revision: 1, field_revisions: {}, deleted_at: null,
      ...encodeSyncV2Patch(store, record) }));
  }
  return canonical;
}

function contract(state = 'PROVISIONING_REQUIRED', owner = OWNER) {
  return { ownerId: owner, profileStatus: 'READY', profile: { teacherName: 'Teacher', phone: '0500000001',
    teacherForm: 'masculine', schoolName: '' },
  access: { grantType: 'beta_full', status: 'active' },
  provisioning: { state, version: 1, foundationHash: state === 'READY' ? 'server-hash' : null } };
}

function apiFor(owner = OWNER) {
  let state = 'PROVISIONING_REQUIRED';
  let writes = 0;
  const api = { user: { id: owner, email: 'synthetic@example.test' },
    async verifyCurrentAuthIdentity(expected) { return { id: expected }; },
    async getAccountContract() { return contract(state, owner); },
    async beginAccountProvisioning() { if (state !== 'READY') state = 'PROVISIONING'; return contract(state, owner); },
    async provisionAccountWorkspace() { writes += 1; state = 'READY'; return { contract: contract(state, owner), snapshot: snapshot(owner) }; },
  };
  return { api, getWrites: () => writes };
}

test('server READY imports empty foundation once and reload routes only verified owner', async () => {
  db.closeDB();
  const registry = createWorkspaceRegistry({ indexedDBFactory: fakeIndexedDB });
  const { api } = apiFor();
  try {
    const first = await runAccountProvisioning({ expectedOwnerId: OWNER, api, database: db, registry,
      indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto });
    assert.equal(first.status, 'ready');
    assert.equal((await db.getAll('years')).length, 1);
    assert.equal((await db.getAll('terms')).length, 2);
    assert.equal((await db.getAll('subjects')).length, 1);
    assert.equal((await db.getAll('timeProfiles')).length, 4);
    for (const store of ['sections','students','enrollments','slots','sessions','attendance','scores','items','outbox']) {
      assert.equal((await db.getAll(store)).length, 0, `${store} starts empty`);
    }
    db.closeDB();
    const routed = await resolveWorkspaceForBoot({ authUser: { id: OWNER }, authState: 'authenticated', registry,
      indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto });
    assert.equal(routed.status, 'ready');
    assert.equal(routed.mode, 'provisioned-account');
    const other = await resolveWorkspaceForBoot({ authUser: { id: OTHER }, authState: 'authenticated', registry,
      indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto });
    assert.equal(other.status, 'not_ready');
    assert.notEqual(other.workspace?.databaseName, routed.workspace.databaseName);
    db.selectDatabase(first.workspaceDatabaseName);
    await db.put('sections', { id: 'teacher-added', name: 'teacher-owned' });
    await runAccountProvisioning({ expectedOwnerId: OWNER, api, database: db, registry,
      indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto });
    assert.equal((await db.getAll('sections')).length, 1, 'repeat never clears later Product data');
  } finally { db.closeDB(); await registry.close(); }
});

test('profile-required path does not create Product database or call provisioning', async () => {
  db.closeDB();
  const registry = createWorkspaceRegistry({ indexedDBFactory: fakeIndexedDB });
  const { api, getWrites } = apiFor(OTHER);
  api.getAccountContract = async () => ({ ...contract('PROFILE_REQUIRED', OTHER), profileStatus: 'PENDING_PROFILE' });
  try {
    const result = await runAccountProvisioning({ expectedOwnerId: OTHER, api, database: db, registry,
      indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto });
    assert.equal(result.status, 'profile_required');
    assert.equal(getWrites(), 0);
  } finally { db.closeDB(); await registry.close(); }
});

test('wrong verified owner fails before any Product write', async () => {
  db.closeDB();
  const registry = createWorkspaceRegistry({ indexedDBFactory: fakeIndexedDB });
  const { api, getWrites } = apiFor(OTHER);
  try {
    await assert.rejects(runAccountProvisioning({ expectedOwnerId: OWNER, api, database: db, registry,
      indexedDBFactory: fakeIndexedDB, cryptoProvider: webcrypto }), { code: 'ACCOUNT_PROVISIONING_OWNER_MISMATCH' });
    assert.equal(getWrites(), 0);
  } finally { db.closeDB(); await registry.close(); }
});

test('teaching score defaults remain fresh-ID, direct, editable and without portability', () => {
  const a = defaultItemsFor('teaching:a');
  const b = defaultItemsFor('teaching:b');
  assert.deepEqual(a.map((item) => item.max), [10, 10, 20, 20, 40]);
  assert.equal(new Set([...a, ...b].map((item) => item.id)).size, 10);
  assert.ok(a.every((item) => item.scoreMode === 'direct' && item.portabilityGroupId == null));
});

test('a new second device with an already READY server uses full restore, not foundation-only import', async () => {
  const isolated = new IDBFactory();
  const registry = createWorkspaceRegistry({ indexedDBFactory: isolated });
  const { api, getWrites } = apiFor(OWNER);
  api.getAccountContract = async () => contract('READY', OWNER);
  try {
    const result = await runAccountProvisioning({ expectedOwnerId: OWNER, api, database: db, registry,
      indexedDBFactory: isolated, cryptoProvider: webcrypto });
    assert.equal(result.status, 'not_applicable');
    assert.equal(getWrites(), 0);
    assert.deepEqual(await registry.findByAuthUserId(OWNER), []);
  } finally { db.closeDB(); await registry.close(); }
});

test('local registration crash resumes from server READY without reimporting or losing records', async () => {
  db.closeDB();
  const isolated = new IDBFactory();
  const registry = createWorkspaceRegistry({ indexedDBFactory: isolated });
  const { api } = apiFor(OTHER);
  let first = true;
  const interrupted = { ...registry,
    async registerProvisionedAccount(...args) {
      if (first) { first = false; throw new Error('synthetic crash before registry commit'); }
      return registry.registerProvisionedAccount(...args);
    },
  };
  try {
    await assert.rejects(runAccountProvisioning({ expectedOwnerId: OTHER, api, database: db,
      registry: interrupted, indexedDBFactory: isolated, cryptoProvider: webcrypto }),
    /synthetic crash/);
    assert.equal((await db.getAll('years')).length, 1);
    assert.equal((await registry.findByAuthUserId(OTHER))[0].ownershipState, 'provisioning');
    db.closeDB();
    const recovered = await runAccountProvisioning({ expectedOwnerId: OTHER, api, database: db,
      registry, indexedDBFactory: isolated, cryptoProvider: webcrypto });
    assert.equal(recovered.status, 'ready');
    assert.equal((await db.getAll('years')).length, 1);
    assert.equal((await registry.findByAuthUserId(OTHER))[0].ownershipState, 'claimed');
  } finally { db.closeDB(); await registry.close(); }
});

test('same-owner READY foundation repair preserves an already mounted local workspace', async () => {
  db.closeDB();
  const isolated = new IDBFactory();
  const registry = createWorkspaceRegistry({ indexedDBFactory: isolated });
  const { api, getWrites } = apiFor(OTHER);
  try {
    const first = await runAccountProvisioning({ expectedOwnerId: OTHER, api, database: db,
      registry, indexedDBFactory: isolated, cryptoProvider: webcrypto });
    await db.put('sections', { id: 'teacher-added-after-ready', name: 'Keep this Product row' });
    api.getAccountContract = async () => ({ ...contract('PROVISIONING', OTHER),
      provisioning: { state: 'PROVISIONING', version: 1, foundationHash: first.receipt.foundationHash } });
    const repaired = await runAccountProvisioning({ expectedOwnerId: OTHER, api, database: db,
      registry, indexedDBFactory: isolated, cryptoProvider: webcrypto });
    assert.equal(repaired.status, 'ready');
    assert.equal(getWrites(), 2, 'only the server repair RPC repeats');
    assert.equal((await db.getAll('sections')).length, 1, 'local Product rows are never reimported');
  } finally { db.closeDB(); await registry.close(); }
});

test('new offline dependency is precached under the next service-worker generation', async () => {
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const cacheGeneration = worker.match(/const VERSION = 'rakeezx-v(\d+)';/);
  assert.ok(cacheGeneration && Number(cacheGeneration[1]) >= 31,
    'the provisioning dependency must remain cached in this or a later generation');
  assert.match(worker, /\.\/src\/lib\/account-provisioning\.js/);
});
