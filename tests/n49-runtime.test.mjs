import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { createOfflineLease, LEASE_STORAGE_PREFIX, workspaceLeaseBinding, leaseThresholds } from '../src/lib/offline-lease.js';
import * as cloud from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { createWorkspaceRegistry } from '../src/lib/workspaces.js';
import { resolveWorkspaceForBoot } from '../src/lib/workspace-routing.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { buildBackup } from '../src/lib/export.js';
import { todayISO, weekday } from '../src/models.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DAY = 86400000;
class Storage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const sessionFor = (id) => ({ access_token: `test-${id}`, refresh_token: 'refresh', expires_at: 4102444800, user: { id } });
const workspace = { id: 'account:fixture', type: 'account', authUserId: A, databaseName: 'rakeezx-user-' + 'a'.repeat(32), ownershipState: 'claimed', leaseGeneration: 'generation-1' };
const receiptKey = (w = workspace) => LEASE_STORAGE_PREFIX + w.id;
const dump = async () => Object.fromEntries(await Promise.all(db.STORES.map(async (name) => [name, await db.getAll(name)])));

test('exact official /user HTTP source remains unchanged; test thresholds cannot be set by preferences/query', () => {
  const base = execFileSync('git', ['show', 'b0834e785ccc7f2bcb50a20b812498f6687690c7:src/lib/cloud.js'], { encoding: 'utf8' });
  const current = readFileSync(new URL('../src/lib/cloud.js', import.meta.url), 'utf8');
  const network = (source) => {
    const canonical = source.replace(/\r\n/g, '\n');
    return canonical.slice(canonical.indexOf('async function sendRequest('), canonical.indexOf('export async function init('));
  };
  assert.equal(network(current), network(base));
  assert.ok(current.includes("verified = await request('/user', { method: 'GET' }, true);"));
  assert.deepEqual(leaseThresholds(), { reminder: 7 * DAY, limited: 14 * DAY });
  const leaseSource = readFileSync(new URL('../src/lib/offline-lease.js', import.meta.url), 'utf8');
  assert.match(leaseSource, /MODE === 'n49-test'/);
  assert.match(leaseSource, /hostname === '127\.0\.0\.1'/);
  assert.ok(!leaseSource.includes('URLSearchParams'));
  assert.ok(readFileSync(new URL('../sw.js', import.meta.url), 'utf8').includes("'./src/lib/offline-lease.js'"));
  const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const visited = new Set();
  const closure = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(worker.includes(`'./${file}'`), `offline shell dependency missing: ${file}`);
    if (!file.endsWith('.js')) return;
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
      closure(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
    }
  };
  closure('src/app.js');
});

test('receipt reader: exact 7/14 days, high-water/monotonic rollback survives module recreation, corruption fails closed', async () => {
  const storage = new Storage();
  let wall = 1900000000000, mono = 0;
  const create = async () => {
    // New ESM instance and reader, sharing only the durable adapter contents.
    const module = await import(`../src/lib/offline-lease.js?restart=${wall}-${mono}`);
    const lease = module.createOfflineLease({ storage, now: () => wall, monotonic: () => mono });
    lease.setContext(workspace, A); return lease;
  };
  let lease = await create();
  assert.equal(lease.observe().editable, false);
  await lease.renew(async () => ({ id: A, source: 'supabase-auth-user', verifiedAt: wall }));
  const start = wall;
  wall = start + 7 * DAY;
  assert.equal(lease.observe().state, 'NORMAL');
  wall++;
  assert.equal(lease.observe().state, 'REMINDER');
  mono = 0; lease = await create();
  assert.equal(lease.observe().editable, true);
  wall = start + 14 * DAY;
  assert.equal(lease.observe().state, 'LIMITED');
  lease = await create();
  assert.equal(lease.observe().state, 'LIMITED');
  wall -= DAY;
  lease = await create();
  assert.equal(lease.observe().reason, 'clock-rollback');
  wall += DAY;
  assert.equal((await create()).observe().editable, false, 'rollback is durably latched');
  await lease.renew(async () => ({ id: A, source: 'supabase-auth-user', verifiedAt: wall }));
  assert.equal(lease.observe().state, 'NORMAL');
  // A wall change cannot reset age while the process remains open.
  mono += 14 * DAY;
  assert.equal(lease.observe().editable, false);
  assert.equal((await create()).observe().editable, false);
  await lease.renew(async () => ({ id: A, source: 'supabase-auth-user', verifiedAt: wall }));
  const valid = storage.getItem(receiptKey());
  for (const value of ['', '{', valid.slice(0, -12), '{}', 'null', valid.replace('"version":1', '"version":2'),
    valid.replace('"verifiedAt":', '"verifiedAt":null,"unused":'), valid.replace('generation-1', 'generation-old')]) {
    storage.setItem(receiptKey(), value);
    assert.equal((await create()).observe().editable, false, value.slice(0, 45));
  }
  storage.setItem(receiptKey(), valid);
  for (const w of [{ ...workspace, authUserId: B }, { ...workspace, databaseName: 'rakeezx' }, { ...workspace, leaseGeneration: 'old' }]) {
    const other = createOfflineLease({ storage, now: () => wall, monotonic: () => 0 }); other.setContext(w, w.authUserId);
    assert.equal(other.observe().editable, false);
  }
  const unavailable = createOfflineLease({ storage: { getItem() { throw new Error('denied'); } }, now: () => wall });
  unavailable.setContext(workspace, A); assert.equal(unavailable.observe().editable, false);
  assert.ok(workspaceLeaseBinding(workspace));
  assert.equal(workspaceLeaseBinding({ ...workspace, leaseGeneration: null }), null);
});

test('authoritative local HTTP boundary: reject 401/wrong owner/offline/timeout/switch; refresh and Sync do not renew', async () => {
  globalThis.localStorage = new Storage();
  const originalFetch = globalThis.fetch;
  let response = { status: 200, id: A, delay: 0 }, calls = [];
  const server = http.createServer((request, reply) => {
    calls.push({ method: request.method, url: request.url, authorization: request.headers.authorization });
    const planned = { ...response };
    setTimeout(() => { reply.writeHead(planned.status, { 'Content-Type': 'application/json' });
      reply.end(JSON.stringify(request.url.includes('/token') ? sessionFor(planned.id) : { id: planned.id })); }, planned.delay);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  globalThis.fetch = (url, options) => originalFetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}${new URL(url).search}`, options);
  const login = async (id = A) => { localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(sessionFor(id))); await cloud.init(); };
  const lease = createOfflineLease({ storage: localStorage }); lease.setContext(workspace, A);
  try {
    await login();
    const result = await lease.renew(cloud.verifyCurrentAuthIdentity);
    assert.equal(result.state, 'NORMAL');
    assert.deepEqual(calls[0], { method: 'GET', url: '/auth/v1/user', authorization: `Bearer test-${A}` });
    let prior = localStorage.getItem(receiptKey());
    for (const planned of [{ status: 401, id: A }, { status: 200, id: B }]) {
      response = { ...planned, delay: 0 }; await login();
      await assert.rejects(lease.renew(cloud.verifyCurrentAuthIdentity));
      assert.equal(localStorage.getItem(receiptKey()), null, 'proven Auth rejection revokes edit evidence only');
    }
    response = { status: 200, id: A, delay: 0 }; await login();
    await lease.renew(cloud.verifyCurrentAuthIdentity);
    prior = localStorage.getItem(receiptKey());
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(lease.renew(cloud.verifyCurrentAuthIdentity));
    assert.equal(localStorage.getItem(receiptKey()), prior);
    globalThis.fetch = (url, options) => originalFetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, options);
    response = { status: 200, id: A, delay: 65 };
    await assert.rejects(lease.renew(cloud.verifyCurrentAuthIdentity, { timeoutMs: 5 }), { code: 'LEASE_VERIFY_TIMEOUT' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(localStorage.getItem(receiptKey()), prior, 'late HTTP completion cannot mint receipt');
    const pending = lease.renew(cloud.verifyCurrentAuthIdentity);
    await login(B); lease.setContext({ ...workspace, authUserId: B }, B);
    await assert.rejects(pending);
    assert.equal(cloud.user.id, B);
    assert.equal(localStorage.getItem(receiptKey()), null, 'switch revoked A evidence');
    await login(A); lease.setContext(workspace, A);
    response = { status: 200, id: A, delay: 0 };
    await lease.renew(cloud.verifyCurrentAuthIdentity);
    const renewed = localStorage.getItem(receiptKey());
    // Cached init + an ordinary token refresh never call lease.renew.
    await cloud.init();
    assert.equal(localStorage.getItem(receiptKey()), renewed);
    await cloud.refreshSession();
    assert.equal(localStorage.getItem(receiptKey()), renewed, 'access token refresh alone never renews');
    response = { status: 200, id: A, delay: 65 };
    const staleRefresh = cloud.refreshSession();
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(sessionFor(B)));
    await assert.rejects(staleRefresh, { code: 'AUTH_CONTEXT_CHANGED' });
    assert.equal(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)).user.id, B, 'stale refresh cannot resurrect A in another tab');
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(sessionFor(A)));
    response = { status: 200, id: A, delay: 65 };
    const signingOut = cloud.signOut();
    assert.equal(cloud.user, null);
    assert.equal(localStorage.getItem(receiptKey()), null);
    await signingOut;
  } finally { globalThis.fetch = originalFetch; await new Promise((resolve) => server.close(resolve)); }
});

test('independent tab clock witnesses retain rollback across restarts and recover only from a new trusted renewal', async () => {
  const storage = new Storage(); let wall = 1900000000000;
  const create = () => { const lease = createOfflineLease({ storage, now: () => wall, monotonic: () => 0 }); lease.setContext(workspace, A); return lease; };
  const tabA = create(), tabB = create();
  await tabA.renew(async () => ({ id: A, source: 'supabase-auth-user', verifiedAt: wall }));
  assert.equal(tabB.observe().editable, true);
  wall += DAY; assert.equal(tabA.observe().editable, true);
  wall -= DAY; assert.equal(tabB.observe().reason, 'clock-rollback');
  assert.equal(create().observe().editable, false);
  // A stale observer cannot replace either the receipt or B's invalid witness.
  assert.equal(tabA.observe().editable, false);
  await tabA.renew(async () => ({ id: A, source: 'supabase-auth-user', verifiedAt: wall }));
  assert.equal(tabB.observe().editable, true, 'new renewal ID releases same-owner peer tab');
  tabA.invalidate('workspace-generation-mismatch');
  assert.equal(create().observe().reason, 'workspace-generation-mismatch');
  await tabA.renew(async () => ({ id: A, source: 'supabase-auth-user', verifiedAt: wall }));
  assert.equal(create().observe().editable, true);
  const clockKey = [...storage.values.keys()].find((key) => key.includes(':clock:'));
  storage.setItem(clockKey, '{');
  assert.equal(create().observe().editable, false, 'truncated durable clock witness fails closed');
});

test('real registry/provisioning/restore readers and store/command boundaries: LIMITED preserves Product/outbox/Backup', async () => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage.values.clear();
  globalThis.document = { documentElement: { dataset: {}, setAttribute() {}, removeAttribute() {} }, querySelector() { return null; } };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const registry = createWorkspaceRegistry({ now: () => 1900000000000 });
  const originalFetch = globalThis.fetch;
  try {
    // A uses provisioning, B uses Initial Restore: both real durable readers.
    const provision = { ownerId: A, contractVersion: 1, foundationHash: 'foundation-a' };
    const aRecord = await registry.registerProvisionedAccount(A, provision, { cryptoProvider: webcrypto });
    db.selectDatabase(aRecord.databaseName);
    const today = todayISO();
    await db.putAcross({ profile: [{ id: 'profile', teacherName: 'معلم أ', serverRevision: 1 }],
      device: [{ id: 'device', deviceId: 'device-a', schemaVersion: 8, accountProvisioningReceipt: provision }],
      years: [{ id: 'year-a', status: 'active' }],
      terms: [{ id: 'term-a', yearId: 'year-a', index: 1, status: 'active', startDate: today, endDate: today }],
      calendars: [{ id: 'calendar-a', yearId: 'year-a' }],
      calendarDays: [{ id: 'day-a', calendarId: 'calendar-a', date: today, kind: 'study' }],
      sections: [{ id: 'section-a', yearId: 'year-a', status: 'active', grade: 4 }],
      teachings: [{ id: 'teaching-a', sectionId: 'section-a', termId: 'term-a' }],
      slots: [{ id: 'slot-a', teachingId: 'teaching-a', weekday: weekday(today), period: 3 }],
      timeProfiles: [{ id: 'time-a', name: 'وقت الاختبار', periods: [{ period: 3, start: '09:00', end: '09:40' }] }],
      students: [{ id: 'student-a', name: 'طالب أ', status: 'active' }],
      items: [{ id: 'item-a', teachingId: 'teaching-a', max: 10 }],
      sessions: [{ id: 'session-a', teachingId: 'teaching-a', date: '2026-10-12' }],
      outbox: [{ id: 'existing-envelope', mutationId: 'keep-mutation', ownerId: A, state: 'rejected' }] });
    db.closeDB();
    const checkpoint = { protocol: 'CORE_V2', restoreId: 'restore-b', manifestHash: 'hash-b' };
    const pending = await registry.beginAccountRestore(B, checkpoint, { cryptoProvider: webcrypto });
    db.selectDatabase(pending.databaseName);
    const restore = { ...checkpoint, ownerId: B, completedAt: 1900000000000 };
    await db.putAcross({ device: [{ id: 'device', deviceId: 'device-b', initialRestoreReceipt: restore }],
      profile: [{ id: 'profile', teacherName: 'معلم ب', serverRevision: 1 }] }); db.closeDB();
    await registry.finalizeAccountRestore(B, restore, { cryptoProvider: webcrypto });
    const routingA = await resolveWorkspaceForBoot({ authUser: { id: A }, registry, cryptoProvider: webcrypto });
    const routingB = await resolveWorkspaceForBoot({ authUser: { id: B }, registry, cryptoProvider: webcrypto });
    assert.equal(routingA.status, 'ready'); assert.equal(routingB.status, 'ready');
    assert.notEqual(routingA.workspace.databaseName, routingB.workspace.databaseName);
    assert.notEqual(routingA.workspace.leaseGeneration, routingB.workspace.leaseGeneration);
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(sessionFor(A))); await cloud.init();
    store.activateWorkspace(routingA.workspace); await store.init();
    const before = await dump();
    assert.equal(store.getOfflineLeaseStatus().state, 'LIMITED');
    assert.equal(store.isSessionEligibleDate(today), true);
    const actions = [
      () => store.setScore('student-a', 'item-a', 5),
      () => store.setAttendance('session-a', 'student-a', 'present'),
      () => store.renameStudent('student-a', 'اسم جديد'),
      () => store.patchProfile({ teacherName: 'تغيير' }),
      () => store.save({ sessions: [{ id: 'automatic-session' }] }),
      () => store.ensureSession('teaching-a', '2026-10-13'),
      () => store.ensureSessionsForDate(today),
      () => store.queueClosedTermReport({ termId: 'term-a' }),
      () => store.deletePristineStudent('student-a'),
    ];
    for (const action of actions) await assert.rejects(async () => action(), { code: 'OFFLINE_LEASE_LIMITED' });
    const engine = createSyncV2Engine({ database: db, ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => A });
    await assert.rejects(engine.commitMutation({ store: 'students', recordId: 'new-student', op: 'create', create: { id: 'new-student', name: 'جديد', status: 'active' } }), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(engine.queueCommand({ store: 'students', recordId: 'student-a', command: 'test:new', patch: {} }), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(db.writeAll({ students: [] }, 'replace'), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(db.put('outbox', { id: 'unapproved-envelope', ownerId: A }), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(db.applyBatch({ device: {} }, { prepare: (current) => ({ device: { put: [{ ...current.device[0], studentLifecycleResume: { envelope: { mutationId: 'new-lifecycle' } } }] } }) }), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(cloud.stageSyncV2Restore({}), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(cloud.stageScoreRestoreV2({}), { code: 'OFFLINE_LEASE_LIMITED' });
    await assert.rejects(cloud.contributeCurriculumSyncBootstrap({}), { code: 'OFFLINE_LEASE_LIMITED' });
    assert.deepEqual(await dump(), before);
    const backup = await buildBackup();
    assert.equal(backup.data.students[0].name, 'طالب أ');
    assert.ok(!('device' in backup.data)); assert.ok(!('outbox' in backup.data));
    // Pending/rejected outbox does not prevent trusted renewal.
    globalThis.fetch = async () => new Response(JSON.stringify({ id: A }), { status: 200 });
    assert.equal((await store.renewOfflineLease()).editable, true);
    assert.equal((await db.get('outbox', 'existing-envelope')).mutationId, 'keep-mutation');
    await store.renameStudent('student-a', 'طالب محفوظ');
    assert.equal((await db.get('students', 'student-a')).name, 'طالب محفوظ');
    const validReceipt = localStorage.getItem(receiptKey(routingA.workspace));
    let finishVerification;
    globalThis.fetch = () => new Promise((resolve) => { finishVerification = resolve; });
    const racingRenewal = store.renewOfflineLease();
    const registryDB = await new Promise((resolve) => { const request = indexedDB.open('rakeezx-workspace-registry'); request.onsuccess = () => resolve(request.result); });
    await new Promise((resolve) => { const tx = registryDB.transaction('workspaces', 'readwrite');
      tx.objectStore('workspaces').put({ ...aRecord, provisioningReceipt: { ...provision, foundationHash: 'changed-generation' } }); tx.oncomplete = resolve; });
    finishVerification(new Response(JSON.stringify({ id: A }), { status: 200 }));
    await assert.rejects(racingRenewal, { code: 'OFFLINE_LEASE_LIMITED' });
    assert.equal(localStorage.getItem(receiptKey(routingA.workspace)), validReceipt, 'async workspace change cannot extend receipt');
    await new Promise((resolve) => { const tx = registryDB.transaction('workspaces', 'readwrite'); tx.objectStore('workspaces').put(aRecord); tx.oncomplete = resolve; });
    registryDB.close();
    globalThis.fetch = async () => new Response(JSON.stringify({ id: A }), { status: 200 });
    // A second tab/context has no process-local age state and uses the same disk receipt.
    const tab = createOfflineLease({ storage: localStorage }); tab.setContext(routingA.workspace, A);
    assert.equal(tab.observe().editable, true);
    tab.setContext(routingB.workspace, B); assert.equal(tab.observe().editable, false);
    localStorage.setItem(receiptKey(routingB.workspace), localStorage.getItem(receiptKey(routingA.workspace)));
    assert.equal(tab.observe().editable, false);
    // A stale tab must reject B's cached auth before changing any durable row.
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(sessionFor(B)));
    await assert.rejects(store.renameStudent('student-a', 'ممنوع'), { code: 'OFFLINE_LEASE_LIMITED' });
    assert.equal((await db.get('students', 'student-a')).name, 'طالب محفوظ');
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(sessionFor(A)));
    // Raw canonical reconciliation stays distinct and never renews the lease.
    const receiptBeforeSync = localStorage.getItem(receiptKey(routingA.workspace));
    await db.put('students', { id: 'canonical-student', name: 'قراءة سحابية', status: 'active' });
    await store.refreshSyncedState();
    assert.equal(localStorage.getItem(receiptKey(routingA.workspace)), receiptBeforeSync);
    await cloud.signOut();
    assert.equal(store.getOfflineLeaseStatus().editable, false);
    assert.equal((await db.get('students', 'student-a')).name, 'طالب محفوظ');
  } finally { globalThis.fetch = originalFetch; store.deactivateWorkspace('test-finished'); await registry.close(); }
});
