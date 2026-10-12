import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import 'fake-indexeddb/auto';
import { createSyncStatusSeverity, isTransientTransportFailure } from '../src/lib/sync-status-severity.js';
import { syncOperationalPresentation, renderSyncOperationalSection } from '../src/lib/sync-operational-ui.js';
import { presentSyncWarning, wakeRecoveryCycle } from '../src/lib/sync-warning-policy.js';
import * as sync from '../src/lib/sync.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from './helpers/synthetic-workspace.mjs';

const transport = () => new TypeError('Failed to fetch');
const base = { state: 'error', failedCount: 0, rejectedCount: 0, blockedCount: 0,
  queuedCount: 0, actionableSyncIssue: true, safeToContinueUnrelatedWork: true };

test('transient_status: actual Product mapper uses time AND distinct attempts, never render/wake counts', () => {
  let now = 1_000;
  const tracker = createSyncStatusSeverity({ now: () => now });
  const token = tracker.bind('synthetic-A/workspace-A');
  tracker.failed(token, [transport()]);
  const summary = () => ({ ...base, presentationSeverity: tracker.snapshot() });
  const ui = () => syncOperationalPresentation(summary(), now);
  assert.equal(ui().status, 'pending');
  assert.equal(ui().badge, 'badge--neutral');
  assert.equal(ui().summary.cloudSyncHealthy, false);
  assert.doesNotMatch(String(renderSyncOperationalSection(summary())), /badge--danger|sync-dot--error|بياناتك الحالية متزامنة/);
  let cycle = null;
  for (const event of ['pageshow', 'visibilitychange', 'online', 'pageshow', 'visibilitychange']) {
    now += 1_000;
    cycle = wakeRecoveryCycle(cycle, now);
    const warning = presentSyncWarning(ui().summary, cycle, now);
    assert.equal(warning.strip, false, event);
    assert.equal(tracker.snapshot().failedAttempts, 1);
  }
  now = 91_000;
  assert.equal(ui().status, 'pending', 'time alone cannot escalate');
  tracker.failed(token, [transport()]);
  assert.equal(ui().status, 'error');
  assert.equal(ui().help, true);
  assert.equal(syncOperationalPresentation({ ...summary(), state: 'offline' }, now).status, 'offline');
  tracker.succeeded(token);
  assert.equal(syncOperationalPresentation({ ...summary(), state: 'synced' }, now).status, 'synced');
  assert.equal(tracker.snapshot().failedAttempts, 0);
  tracker.failed(token, [transport()]);
  now += 1;
  tracker.failed(token, [transport()]);
  assert.equal(ui().status, 'pending', 'attempts alone cannot escalate');
  now += 89_998;
  assert.equal(ui().status, 'pending');
  now += 1;
  assert.equal(ui().status, 'error');
});

test('fatal_visibility: hard categories bypass quiet windows and retain support/actions', () => {
  const tracker = createSyncStatusSeverity({ now: () => 1 });
  const token = tracker.bind('synthetic-A');
  tracker.failed(token, [transport()]);
  const cases = [
    [{ failedCount: 1 }, 'error'], [{ rejectedCount: 1 }, 'rejected'],
    [{ state: 'blocked', reasonCategory: 'workspace_ownership_blocked' }, 'blocked'],
    [{ state: 'auth_required' }, 'auth_required'],
    [{ safeToContinueUnrelatedWork: false, state: 'syncing' }, 'error'],
  ];
  for (const [override, status] of cases) {
    const summary = { ...base, presentationSeverity: tracker.snapshot(), ...override };
    const ui = syncOperationalPresentation(summary, 2);
    assert.equal(ui.status, status);
    assert.equal(presentSyncWarning(ui.summary, wakeRecoveryCycle(null, 2), 2).strip, true);
    assert.equal(ui.help, status !== 'auth_required');
    assert.match(String(renderSyncOperationalSection(summary)), status === 'auth_required' ? /يلزم تسجيل الدخول/ : /تحتاج مساعدة/);
  }
  for (const error of [new Error('Unknown failure'), Object.assign(transport(), { code: 'AUTH_NETWORK' }),
    Object.assign(transport(), { status: 403 }), new Error('Restore data loss'), new Error('Owner mismatch')]) {
    assert.equal(isTransientTransportFailure(error), false);
    tracker.failed(token, [error]);
    tracker.failed(token, [transport()]);
    assert.equal(syncOperationalPresentation({ ...base, presentationSeverity: tracker.snapshot() }, 2).status, 'error');
    tracker.succeeded(token);
  }
  tracker.failed(token, [transport(), new Error('Hard failure in another pulled store')]);
  assert.equal(syncOperationalPresentation({ ...base, presentationSeverity: tracker.snapshot() }, 2).status, 'error');
});

test('owner_reset: context tokens reject stale callbacks, logout/reload reset only presentation', () => {
  let now = 1;
  const tracker = createSyncStatusSeverity({ now: () => now });
  const a = tracker.bind('synthetic-A/workspace-1');
  tracker.failed(a, [transport()]);
  now += 90_000;
  tracker.failed(a, [transport()]);
  const b = tracker.bind('synthetic-B/workspace-2');
  assert.equal(syncOperationalPresentation({ ...base, state: 'synced', presentationSeverity: tracker.snapshot() }).status, 'pending');
  tracker.succeeded(a);
  assert.equal(syncOperationalPresentation({ ...base, state: 'synced', presentationSeverity: tracker.snapshot() }).status, 'pending', 'stale success cannot certify owner B');
  assert.equal(tracker.snapshot().failedAttempts, 0);
  tracker.failed(a, [transport()]);
  assert.equal(tracker.snapshot().failedAttempts, 0);
  tracker.failed(b, [new Error('Hard current-owner failure')]);
  tracker.succeeded(a);
  assert.equal(tracker.snapshot().hardFailure, true);
  tracker.clear();
  const resumed = tracker.bind('synthetic-B/workspace-2');
  tracker.failed(b, [transport()]);
  assert.equal(tracker.snapshot().failedAttempts, 0);
  tracker.failed(resumed, [transport()]);
  assert.equal(tracker.snapshot().failedAttempts, 1);
  assert.equal(syncOperationalPresentation({ ...base, failedCount: 1,
    presentationSeverity: createSyncStatusSeverity().snapshot() }).status, 'error', 'reload cannot quiet durable errors');
  assert.equal(syncOperationalPresentation(base).status, 'error', 'no classification cannot manufacture success');
});

test('fatal_visibility: Sync scheduling, I/O, persistence, authorization and recovery source remain unchanged', () => {
  const path = 'src/lib/sync.js';
  const before = execFileSync('git', ['show', `8e2d4800396996be43868a71057412afccd2150b:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
  let current = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
  const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  for (const [start, end] of [
    ['function scheduleAutomaticSync', 'async function scheduleResumeSync'],
    ['async function scheduleResumeSync', 'function failedResult'],
    ['export async function assertCloudRestoreReady', 'export async function suspendForWorkspaceDeactivation'],
    ['async function pendingOutbox', 'function scheduleAutomaticSync'],
  ]) assert.equal(between(current, start, end), between(before, start, end));
  current = current.replace(/^  const presentationToken = bindPresentationContext\(\);\n/m, '')
    .replace(/^  let presentationErrors = null;\n/m, '')
    .replace(/^    if \(pullError\) presentationErrors = pull.failures.map\(\(failure\) => failure.error\);\n/m, '')
    .replace(/^    if \(postPullError\) presentationErrors = postPull.failures.map\(\(failure\) => failure.error\);\n/m, '')
    .replace(/^    bindPresentationContext\(\);\n/gm, '')
    .replace(/^    presentationSeverity\.(succeeded|failed)\(.*\);\n/gm, '')
    .replaceAll('cacheOperationalSummary(v2Status, presentationToken)', 'cacheOperationalSummary(v2Status)');
  assert.equal(between(current, 'export async function syncAll', '/**\n * A cloud restore'),
    between(before, 'export async function syncAll', '/**\n * A cloud restore'));
  assert.match(current, /const RETRY_DELAYS_MS = \[2_000, 4_000, 8_000, 16_000, 30_000\]/);
  assert.match(current, /console.warn\('\[rakeezx sync\] Automatic sync failed:', err\)/);
});

const windowEvents = new EventTarget();
const documentEvents = new EventTarget();
globalThis.addEventListener = windowEvents.addEventListener.bind(windowEvents);
globalThis.document = { visibilityState: 'visible', addEventListener: documentEvents.addEventListener.bind(documentEvents),
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }) };
globalThis.matchMedia = () => ({ matches: false });
let online = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get onLine() { return online; } } });
globalThis.fetch = () => { throw new Error('Real network forbidden in N95 synthetic tests'); };
after(() => { cloud.setMockAuth(null, null); cloud.setMockBackend(null); store.closeChannel(); db.closeDB(); });

// Durable failure fixtures are persisted test inputs, not new Product commands.
// Seed through the native synthetic DB; do not mint edit/lease authority.
async function seedOutbox(row) {
  const handle = await db.openDB();
  await new Promise((resolve, reject) => {
    const tx = handle.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').put(row);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}

test('transient_status / fatal_visibility / owner_reset: actual synthetic coordinator and lifecycle events', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  let failure = transport();
  cloud.setMockBackend({ fetchRecords: async () => { if (failure) throw failure; return []; } });
  cloud.setMockAuth({ id: SYNTHETIC_WORKSPACE_OWNER }, { access_token: 'synthetic-only' });
  sync.init();
  assert.equal(await sync.syncAll(), false);
  const ui = () => syncOperationalPresentation(sync.getSyncOperationalSummarySnapshot());
  assert.equal(ui().status, 'pending');
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 1);
  for (const event of ['pageshow', 'pageshow']) windowEvents.dispatchEvent(new Event(event));
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 1);
  online = false;
  windowEvents.dispatchEvent(new Event('offline'));
  await sync.getSyncOperationalSummary();
  assert.equal(ui().status, 'offline');
  online = true;
  windowEvents.dispatchEvent(new Event('online'));
  await sync.getSyncOperationalSummary();
  assert.equal(ui().status, 'pending');
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 1);
  t.mock.timers.setTime(Date.now() + 90_000);
  assert.equal(ui().status, 'pending');
  assert.equal(await sync.syncAll(), false);
  assert.equal(ui().status, 'error');
  failure = null;
  assert.equal(await sync.syncAll(), true);
  assert.equal(ui().status, 'synced');
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 0);
  failure = Object.assign(new Error('Synthetic revoked Auth'), { code: 'AUTH_REQUIRED' });
  assert.equal(await sync.syncAll(), false);
  assert.equal(ui().status, 'auth_required');
  failure = null;
  assert.equal(await sync.syncAll(), true);
  failure = new Error('Synthetic data-loss failure');
  sync.state.status = 'pending';
  assert.equal(await sync.syncAll(), false);
  assert.equal(ui().status, 'error');
  failure = null;
  assert.equal(await sync.syncAll(), true);
  failure = transport();
  assert.equal(await sync.syncAll(), false);
  await seedOutbox({ id: 'n95-failed', protocol: 'v2', state: 'failed', store: 'students', recordId: 'synthetic', sequence: 1 });
  await sync.getSyncOperationalSummary();
  assert.equal(ui().status, 'error');
  await db.clearStore('outbox');
  await seedOutbox({ id: 'n95-rejected', protocol: 'v2', state: 'rejected', store: 'students', recordId: 'synthetic', sequence: 1 });
  await sync.getSyncOperationalSummary();
  assert.equal(ui().status, 'rejected');
  assert.equal(ui().help, true);
  await db.clearStore('outbox');
  store.state.device.studentLifecycleResume = { synthetic: true };
  await sync.getSyncOperationalSummary();
  assert.equal(ui().status, 'error');
  assert.equal(ui().summary.safeToContinueUnrelatedWork, false);
  delete store.state.device.studentLifecycleResume;
  await sync.suspendForWorkspaceDeactivation();
  cloud.setMockAuth(null, null);
  await sync.getSyncOperationalSummary();
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 0);
  const ownerB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  store.state.ready = false; // Synthetic reload boundary: Product prohibits in-place mounted switches.
  store.closeChannel();
  db.closeDB();
  await activateSyntheticAccountWorkspace({ ownerId: ownerB });
  cloud.setMockAuth({ id: ownerB }, { access_token: 'synthetic-B' });
  sync.state.status = 'pending';
  await sync.getSyncOperationalSummary();
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 0);
  assert.equal(await sync.syncAll(), false);
  assert.equal(ui().status, 'pending');
  assert.equal(ui().summary.presentationSeverity.failedAttempts, 1);
  cloud.setMockAuth({ id: SYNTHETIC_WORKSPACE_OWNER }, { access_token: 'synthetic-mismatch' });
  assert.equal(await sync.syncAll(), false);
  assert.equal(ui().status, 'blocked');
  assert.equal(ui().help, true);
  await sync.suspendForWorkspaceDeactivation();
  t.mock.timers.reset();
});
