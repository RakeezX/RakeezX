// AI: exact existing N95 coordinator assertions retained with current owner/session/lease setup.
// Standalone presentation assertions already passed; historical source-diff test is unrelated to N107.
// Original SHA256: 430b088626a3075c3ebee7866592da932eabd3d83ec411614a2f1fa42a0b6bbf
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import 'fake-indexeddb/auto';
import { authenticate, renew } from './authenticated-fixture.mjs';
import { createSyncStatusSeverity, isTransientTransportFailure } from '../../src/lib/sync-status-severity.js';
import { syncOperationalPresentation, renderSyncOperationalSection } from '../../src/lib/sync-operational-ui.js';
import { presentSyncWarning, wakeRecoveryCycle } from '../../src/lib/sync-warning-policy.js';
import * as sync from '../../src/lib/sync.js';
import * as cloud from '../../src/lib/cloud.js';
import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from '../helpers/synthetic-workspace.mjs';

const transport = () => new TypeError('Failed to fetch');
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
  authenticate(SYNTHETIC_WORKSPACE_OWNER);
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await renew(SYNTHETIC_WORKSPACE_OWNER);
  await db.clearStore('outbox');
  let failure = transport();
  cloud.setMockBackend({ fetchRecords: async () => { if (failure) throw failure; return []; } });
  authenticate(SYNTHETIC_WORKSPACE_OWNER);
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
  authenticate(ownerB, 'synthetic-B');
  await renew(ownerB);
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
