import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { n13Account } from './n13-fixture.mjs';
import * as m from '../src/models.js';
import { capability, syntheticScoreBackend } from './n94-offline-backend.mjs';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
const storage = new Map();
global.localStorage = { get length() { return storage.size; }, key: i => [...storage.keys()][i] ?? null,
  getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key) };
const itemId = 'n94-offline:item', studentId = 'n94-offline:student';
const snapshot = async () => Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
const configure = async (subitems) => {
  const proposed = { scoreMode: 'subitems', distributionMode: 'manual', subitems };
  return store.applyConfirmedScoreConfiguration(itemId, proposed, {
    expectedVersion: store.previewScoreConfiguration(itemId, proposed).expectedVersion, confirmed: true });
};
async function fixture() {
  store.deactivateWorkspace(); await n13Account(); await db.clearAll(); await store.init();
  const y = m.makeYear({ id: 'y' }), term = m.makeTerm({ id: 'term', yearId: y.id });
  const section = m.makeSection({ id: 'section', yearId: y.id }), subject = m.makeSubject({ id: 'subject' });
  const teaching = m.makeTeaching({ id: 'teaching', sectionId: section.id, subjectId: subject.id, termId: term.id });
  await db.putAcross({ years: [y], terms: [term], sections: [section], subjects: [subject],
    teachings: [{ ...teaching, serverRevision: 1 }],
    students: [{ ...m.makeStudent({ id: studentId }), serverRevision: 1 }],
    enrollments: [m.makeEnrollment({ studentId, sectionId: section.id })],
    items: [{ ...m.makeItem({ id: itemId, teachingId: teaching.id, max: 10 }), serverRevision: 1 }],
  });
  await store.refreshSyncedState(); await db.clearStore('outbox');
  for (const key of Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))) {
    if (key.startsWith('rakeezx-score-capability-v1:')) localStorage.removeItem(key);
  }
  cloud.setMockBackend({ getScoreFoundationCapability: () => capability });
  return store.getActiveWorkspace();
}

test('offline configure/edit/completion is atomic, ordered, reload durable and reconnect idempotent (simulated backend)', async () => {
  const workspace = await fixture(), server = syntheticScoreBackend(await snapshot());
  await cloud.getScoreFoundationCapability({ workspace }); // actual adapter result, not a manufactured client grant
  cloud.setMockBackend({ getScoreFoundationCapability() { throw new TypeError('Failed to fetch'); } });
  await configure([{ name: 'Homework', value: 6, startDate: null, dueDate: '2026-01-01', latePoints: 2 }]);
  let definition = store.scoreSubitemsOf(itemId)[0], createdAt = definition.createdAt;
  await store.setScoreSubitemCompletion(studentId, definition.id, 'late');
  assert.equal(store.scoresOf(studentId)[0].value, 2);
  await db.closeDB(); store.state.ready = false; await store.init();
  await configure([{ ...store.scoreSubitemsOf(itemId)[0], name: 'Edited offline' }]);
  await store.setScoreSubitemCompletion(studentId, definition.id, 'regular');
  assert.equal(store.scoresOf(studentId)[0].value, 6);
  await store.setScoreSubitemCompletion(studentId, definition.id, 'unrecorded');
  assert.equal(store.scoresOf(studentId)[0].value, null);
  await store.setScoreSubitemCompletion(studentId, definition.id, 'late');
  definition = store.scoreSubitemsOf(itemId)[0];
  assert.deepEqual([definition.createdAt, definition.startDate, definition.dueDate, definition.latePoints],
    [createdAt, null, '2026-01-01', 2]);
  const commands = (await db.getAll('outbox')).sort((a,b) => a.sequence-b.sequence);
  assert.equal(commands.length, 6); assert.equal(new Set(commands.map(row => row.mutationId)).size, 6);
  assert.ok(commands.every(row => row.op === 'command' && row.ownerId === workspace.authUserId));
  assert.deepEqual(commands.map(row => row.command), ['score:configure', 'score:set_completion',
    'score:configure', 'score:set_completion', 'score:set_completion', 'score:set_completion']);
  assert.equal((await db.getAll('scoreSubitemCompletions')).length, 1);
  const before = await snapshot();
  await assert.rejects(() => store.setScoreSubitemCompletion('foreign-student', definition.id, 'regular'));
  assert.deepEqual(await snapshot(), before, 'aborted prepare cannot write score/completion/outbox separately');
  const engine = createSyncV2Engine({ database: db, transport: server, ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => workspace.authUserId });
  server.loseNextAcknowledgement();
  assert.equal((await engine.dispatchPending()).failed, 1);
  for (let pass = 0; pass < 10 && (await db.getAll('outbox')).length; pass++) await engine.dispatchPending();
  assert.equal((await db.getAll('outbox')).length, 0);
  assert.deepEqual(server.applied, commands.map(row => row.mutationId));
  assert.equal(server.calls[0].mutationId, server.calls[1].mutationId);
  assert.equal(server.state.scoreSubitemCompletions.length, 1);
  assert.equal(server.state.scores[0].value, 2);
  assert.equal((await db.getAll('scores'))[0].value, 2);
  assert.equal((await engine.dispatchPending()).acknowledged, 0);
});

test('owner/workspace/14-day expiry, unverified, incompatible and real rejection fail closed; restore guard survives async capability', async () => {
  const workspace = await fixture();
  const definition = [{ name: 'Homework', value: 6, dueDate: '2026-01-01', latePoints: 2 }];
  const noWrites = async (action, expected) => {
    const before = await snapshot(); await assert.rejects(action, expected); assert.deepEqual(await snapshot(), before);
  };
  const transportFailure = { getScoreFoundationCapability() { throw new TypeError('Failed to fetch'); } };
  cloud.setMockBackend(transportFailure);
  await noWrites(() => configure(definition), { code: 'SCORE_CAPABILITY_UNVERIFIED' });
  cloud.setMockBackend({ getScoreFoundationCapability: () => capability });
  await cloud.getScoreFoundationCapability({ workspace });
  const key = 'rakeezx-score-capability-v1:' + workspace.id, evidence = localStorage.getItem(key);
  cloud.setMockBackend(transportFailure);
  const persisted = localStorage.getItem(cloud.AUTH_STORAGE_KEY);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'foreign', user: { id: 'foreign' } }));
  await noWrites(() => configure(definition), { code: 'OFFLINE_LEASE_LIMITED' });
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, persisted);
  store.getOfflineLeaseStatus();
  await assert.rejects(() => cloud.getScoreFoundationCapability({ workspace: { ...workspace, id: 'other-workspace' }, allowOffline: true }),
    { code: 'SCORE_CAPABILITY_UNVERIFIED' });
  await assert.rejects(() => cloud.getScoreFoundationCapability({ workspace: { ...workspace, leaseGeneration: 'other-generation' }, allowOffline: true }),
    { code: 'SCORE_CAPABILITY_UNVERIFIED' });
  localStorage.setItem(key, evidence.replace('CORE_V2', 'CORRUPT'));
  await noWrites(() => configure(definition), { code: 'SCORE_CAPABILITY_UNVERIFIED' });
  localStorage.setItem(key, evidence);
  const originalNow = Date.now; Date.now = () => originalNow() + 14 * 86400000;
  try { await noWrites(() => configure(definition), { code: 'OFFLINE_LEASE_LIMITED' }); }
  finally { Date.now = originalNow; }
  // A fresh trusted renewal is necessary after the clock witness advances.
  store.deactivateWorkspace(); await n13Account(); await store.init();
  cloud.setMockBackend({ getScoreFoundationCapability: () => ({ ...capability, n94SubitemVersion: 0 }) });
  await noWrites(() => configure(definition), /N94 server capability is unavailable/);
  cloud.setMockBackend(transportFailure);
  await noWrites(() => configure(definition), /N94 server capability is unavailable/);
  cloud.setMockBackend({ getScoreFoundationCapability: () => capability });
  await cloud.getScoreFoundationCapability({ workspace: store.getActiveWorkspace() });
  cloud.setMockBackend({ getScoreFoundationCapability() { throw Object.assign(new Error('Denied by server'), { status: 403 }); } });
  await noWrites(() => configure(definition), /Denied by server/);
  cloud.setMockBackend(transportFailure);
  await noWrites(() => configure(definition), { code: 'SCORE_CAPABILITY_UNVERIFIED' });
  cloud.setMockBackend({ async getScoreFoundationCapability() { store.setCloudRestoreInProgress(true); return capability; } });
  try { await noWrites(() => configure(definition), { code: 'CLOUD_RESTORE_IN_PROGRESS' }); }
  finally { store.setCloudRestoreInProgress(false); }
});

test('raw online rejection retires evidence; fresh lease cannot extend expired capability; Auth switch and logout cannot retain a grant', async () => {
  const workspace = await fixture();
  const verify = async () => {
    cloud.setMockBackend({ getScoreFoundationCapability: () => capability });
    await cloud.getScoreFoundationCapability({ workspace });
  };
  const key = 'rakeezx-score-capability-v1:' + workspace.id;
  await verify();
  cloud.setMockBackend({ getScoreFoundationCapability: () => null });
  assert.equal(await cloud.getScoreFoundationCapability(), null);
  assert.equal(localStorage.getItem(key), null);
  await verify();
  cloud.setMockBackend({ getScoreFoundationCapability() { throw Object.assign(new Error('Real RPC refusal'), { status: 400, code: 'P0001' }); } });
  await assert.rejects(() => cloud.getScoreFoundationCapability(), /Real RPC refusal/);
  assert.equal(localStorage.getItem(key), null);
  await verify();
  const originalNow = Date.now;
  Date.now = () => originalNow() + 14 * 86400000 + 1000;
  try {
    await runtimeOfflineLease().renew(async () => ({ id: workspace.authUserId, source: 'supabase-auth-user', verifiedAt: Date.now() }));
    cloud.setMockBackend({ getScoreFoundationCapability() { throw new TypeError('Failed to fetch'); } });
    await assert.rejects(() => cloud.getScoreFoundationCapability({ workspace, allowOffline: true }), { code: 'SCORE_CAPABILITY_UNVERIFIED' });
  } finally { Date.now = originalNow; }
  store.deactivateWorkspace(); await n13Account(); await store.init();
  await verify();
  const originalSession = cloud.session;
  cloud.setMockBackend({ async getScoreFoundationCapability() {
    cloud.setMockAuth({ id: 'foreign-owner' }, { access_token: 'foreign' }); return capability;
  } });
  await assert.rejects(() => cloud.getScoreFoundationCapability({ workspace }), { code: 'AUTH_CONTEXT_CHANGED' });
  cloud.setMockAuth(originalSession.user, originalSession);
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('{}', { status: 200 });
  try { await cloud.signOut(); assert.equal(localStorage.getItem(key), null); }
  finally { global.fetch = originalFetch; }
});
after(async () => { store.closeChannel(); await db.closeDB(); cloud.setMockBackend(null); cloud.setMockAuth(null, null); });
