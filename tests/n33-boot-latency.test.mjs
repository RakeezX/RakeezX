import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { createWorkspaceRegistry } from '../src/lib/workspaces.js';
import { resolveWorkspaceForBoot } from '../src/lib/workspace-routing.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Existing workspace-routing fixture: matching registry + local claim receipt.
async function fixture() {
  const indexedDBFactory = new IDBFactory();
  const registry = createWorkspaceRegistry({ indexedDBFactory });
  await registry.registerLegacyClaim(A, { claimId: 'n33-claim', evidenceHash: 'synthetic', cryptoProvider: webcrypto });
  const database = await new Promise((resolve, reject) => {
    const request = indexedDBFactory.open('rakeezx', 7);
    request.onupgradeneeded = () => request.result.createObjectStore('device', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = database.transaction('device', 'readwrite');
    tx.objectStore('device').put({ id: 'device', workspaceClaim: {
      version: 1, state: 'claimed', ownerId: A, claimId: 'n33-claim', databaseName: 'rakeezx',
    } });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  database.close();
  await registry.close();
  return indexedDBFactory;
}

// Execute the actual boot function with UI/network boundaries stubbed. Routing
// and Sync V2's read-only status scan remain real; no network or Product writes.
async function bootProbe(code, { factory, user = A, scanDelay = 0, holdRouting = null, summaryError = false } = {}) {
  const events = [];
  const reads = [];
  const noop = () => {};
  const engine = createSyncV2Engine({ database: {
    applyBatch() { throw new Error('Read-only boot probe must never write'); },
    async getAll(name) { reads.push(name); await pause(scanDelay); return []; },
  }, transport: {} });
  const summaries = [];
  const sync = {
    init() { events.push('sync-init'); summaries.push(engine.status()); },
    getSyncOperationalSummary() {
      const p = summaryError ? Promise.reject(new Error('Synthetic status read failure')) : engine.status();
      summaries.push(p.catch(noop));
      return p;
    },
    subscribe: noop,
  };
  const env = {
    cleanupSessionAutoTriggers: noop, db: { setVersionChangeHandler: noop },
    cloud: { session: user ? {} : null, user: user ? { id: user } : null, init: noop, subscribe: noop },
    clearLegacyDemoRequest: noop, clearDemoRequest: noop, isDemoPreparing: () => false,
    isDemoRequested: () => false, isDemoWorkspace: () => false,
    createWorkspaceRegistry: () => createWorkspaceRegistry({ indexedDBFactory: factory }),
    async resolveWorkspaceForBoot(options) {
      if (holdRouting) await holdRouting;
      const result = await resolveWorkspaceForBoot({ ...options, indexedDBFactory: factory, cryptoProvider: webcrypto });
      events.push(`routing:${result.status}`);
      return result;
    },
    mountAndRunInitialRestore: () => events.push('restore-gate'),
    mountWorkspaceGate: () => events.push('workspace-gate'),
    registerServiceWorker: noop, store: {
      activateWorkspace: () => events.push('activate'), deactivateWorkspace: noop,
      init: () => events.push('store-init'), onWriteError: noop, subscribe: noop,
      applyTheme: noop,
    },
    sync, canMaterializeTodaySessions: () => false, delegate: noop,
    app: {}, document: { getElementById: noop, addEventListener: noop },
    window: { addEventListener: noop }, setRepaint: noop, scheduleRender: noop,
    onPresentationWake: noop, onNavigate: noop, installSessionAutoTriggers: noop,
    matchMedia: () => ({ addEventListener: noop }),
    resolve: () => events.push('paint'),
    paintSyncStatus: () => events.push('status-painted'),
    html: noop, render: () => events.push('error'), console,
  };
  const boot = code.slice(code.indexOf('async function boot() {'), code.indexOf('\nconst INITIAL_RESTORE_COPY'))
    .replaceAll('import.meta.env?.DEV', 'false')
    .replace("import('./lib/sync.js')", 'Promise.resolve(sync)');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const refresh = code.slice(code.indexOf('let syncSummaryRefresh ='), code.indexOf('/* ---------- الرسم'));
  const run = new AsyncFunction(...Object.keys(env), `let workspaceRouting, syncModule, view, stopSessionAutoTriggers; ${refresh}; ${boot}; await boot();`);
  const start = performance.now();
  const pending = run(...Object.values(env));
  return { events, reads, pending, elapsed: () => performance.now() - start,
    settle: () => Promise.all(summaries) };
}

test('trusted cold/warm offline boots paint without awaiting the status scan, then refresh', async () => {
  const factory = await fixture();
  for (const temperature of ['cold', 'warm']) {
    const probe = await bootProbe(source, { factory, scanDelay: 8 });
    await probe.pending;
    assert.deepEqual(probe.events, ['routing:ready', 'activate', 'store-init', 'sync-init', 'paint'], temperature);
    assert.ok(probe.reads.length <= 2, 'status scans are still pending at paint');
    await probe.settle();
    assert.ok(probe.reads.length > 2, 'real read-only status scan finishes after paint');
    assert.ok(probe.events.indexOf('status-painted') > probe.events.indexOf('paint'));
  }
});

test('routing must settle before paint; wrong, signed-out and fresh accounts stay gated', async () => {
  const factory = await fixture();
  let release;
  const probe = await bootProbe(source, { factory, holdRouting: new Promise((resolve) => { release = resolve; }) });
  await pause(5);
  assert.deepEqual(probe.events, []);
  release();
  await probe.pending;
  await probe.settle();
  for (const user of [B, null]) {
    const denied = await bootProbe(source, { factory, user });
    await denied.pending;
    assert.ok(denied.events.includes('workspace-gate'), `denied events: ${denied.events}`);
    assert.ok(!denied.events.includes('activate'));
    assert.ok(!denied.events.includes('paint'));
    assert.equal(denied.reads.length, 0);
  }
  const fresh = await bootProbe(source, { factory: new IDBFactory() });
  await fresh.pending;
  assert.ok(fresh.events.includes('restore-gate'));
  assert.ok(!fresh.events.includes('paint'));
});

test('background summary failure cannot remove or block the verified local shell', async () => {
  const probe = await bootProbe(source, { factory: await fixture(), summaryError: true });
  await probe.pending;
  await probe.settle();
  assert.ok(probe.events.includes('paint'));
  assert.ok(!probe.events.includes('error'));
  assert.ok(!probe.events.includes('status-painted'), 'failed scan keeps the previous safe snapshot');
});

if (process.env.N33_BASE_SHA) test('synthetic before/after first-paint checkpoint', async () => {
  const before = execFileSync('git', ['show', `${process.env.N33_BASE_SHA}:src/app.js`], { encoding: 'utf8' });
  const factory = await fixture();
  const baseline = await bootProbe(before, { factory, scanDelay: 10 });
  await baseline.pending;
  const beforeMs = baseline.elapsed();
  await baseline.settle();
  const candidate = await bootProbe(source, { factory, scanDelay: 10 });
  await candidate.pending;
  const afterMs = candidate.elapsed();
  await candidate.settle();
  console.log(JSON.stringify({ checkpoint: 'boot resolve/paint', syntheticScanDelayMs: 10, beforeMs, afterMs }));
  assert.ok(beforeMs - afterMs > 50, 'sequential status scan is removed from the first-paint path');
});
