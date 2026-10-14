import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { IDBFactory } from 'fake-indexeddb';
import * as db from '../src/lib/db.js';
import { buildAccountFoundationDefaults, runAccountProvisioning } from '../src/lib/account-provisioning.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';
import { createWorkspaceRegistry } from '../src/lib/workspaces.js';

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

test('same-owner READY foundation repair preserves an already mounted local workspace', async () => {
  db.closeDB();
  const isolated = new IDBFactory();
  globalThis.indexedDB = isolated;
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

