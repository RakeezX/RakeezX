import { test, expect } from '@playwright/test';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { STORES } from '../src/lib/db.js';

const CLOUD_URL = `${SUPABASE_URL}/rest/v1/`;
const SYNC_UX_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SYNC_UX_CLAIM_ID = 'claim:sync-ux';

// Same field-group conventions as the current generic Sync V2 protocol.
const FIELD_GROUPS = {
  profile: { active_time_profile_id: 'timing_selection' },
  time_profiles: { active_from: 'activation', active_to: 'activation' },
  subjects: { slug: 'identity' },
};

function mockCloud() {
  const tables = {};
  const calls = { get: {}, post: {} };
  const receipts = new Map();
  let failing = false;
  return {
    tables,
    calls,
    fail(value) { failing = value; },
    async route(page) {
      // Never send fixture credentials or mutations to an unmocked cloud endpoint.
      await page.route('https://*.supabase.co/**', (route) => route.abort());
      await page.route(`${CLOUD_URL}**`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        const kind = request.method() === 'GET' ? 'get' : 'post';
        expect(request.headers().authorization).toBe('Bearer sync-ux-test-token');
        expect(request.headers()['accept-profile']).toBe('rakeezx');
        calls[kind][table] = (calls[kind][table] ?? 0) + 1;
        if (failing && table !== 'score_foundation_capability') {
          await route.fulfill({ status: 503, json: { message: 'temporary test failure' } });
          return;
        }
        if (request.method() === 'GET') {
          await route.fulfill({ json: tables[table] ?? [] });
          return;
        }
        if (request.method() === 'POST') {
          if (table === 'score_foundation_capability') {
            await route.fulfill({ status: 204 });
            return;
          }
          expect(table).toBe('apply_sync_v2_mutation');
          expect(request.headers()['content-profile']).toBe('rakeezx');
          const envelope = JSON.parse(request.postData() ?? '{}');
          const previous = receipts.get(envelope.p_mutation_id);
          if (previous) {
            expect(envelope).toEqual(previous.envelope);
            await route.fulfill({ json: previous.receipt });
            return;
          }
          const { p_entity: entity, p_record_id: recordId, p_operation: operation, p_patch: patch, p_base_revision: baseRevision } = envelope;
          expect(envelope.p_mutation_id).toBeTruthy();
          expect(envelope.p_device_id).toBeTruthy();
          expect(['create', 'update', 'delete']).toContain(operation);
          const rows = (tables[entity] ??= []);
          const index = rows.findIndex((row) => row.id === recordId);
          const existing = rows[index];
          const group = (field) => FIELD_GROUPS[entity]?.[field] ?? field;
          const groups = [...new Set(Object.keys(patch).map(group))];
          // This fixture exercises successful writes, not conflict resolution.
          if (operation === 'create') expect(existing).toBeUndefined();
          else {
            expect(existing).toBeTruthy();
            expect(baseRevision).toBe(existing.revision);
          }
          const revision = (existing?.revision ?? 0) + 1;
          const canonical = {
            ...existing, id: recordId, ...patch, revision,
            field_revisions: { ...existing?.field_revisions, ...Object.fromEntries(groups.map((key) => [key, revision])) },
            deleted_at: operation === 'delete' ? new Date().toISOString() : null,
            client_updated_at: envelope.p_client_updated_at,
          };
          if (index < 0) rows.push(canonical);
          else rows[index] = canonical;
          const receipt = {
            mutationId: envelope.p_mutation_id, entity, recordId, canonicalId: recordId,
            outcome: operation === 'delete' ? 'deleted' : 'applied',
            appliedGroups: operation === 'delete' ? ['__deleted__'] : groups,
            conflictedGroups: [], resultRevision: revision, canonical,
          };
          receipts.set(envelope.p_mutation_id, { envelope, receipt });
          await route.fulfill({ json: receipt });
          return;
        }
        await route.fulfill({ status: 200, json: [] });
      });
    },
  };
}

async function seedClaimedWorkspace(page) {
  await page.route('**/__sync-ux-workspace__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>sync ux workspace fixture</title>',
  }));
  await page.goto('/__sync-ux-workspace__');
  await page.evaluate(async ({ stores, authKey, ownerId, claimId }) => {
    const request = (operation) => new Promise((resolve, reject) => {
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
    });
    const transaction = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const productRequest = indexedDB.open('rakeezx', 7);
    productRequest.onupgradeneeded = () => {
      for (const store of stores) {
        if (!productRequest.result.objectStoreNames.contains(store)) {
          productRequest.result.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    const product = await request(productRequest);
    const productTx = product.transaction(['device', 'profile'], 'readwrite');
    productTx.objectStore('device').put({
      id: 'device', deviceId: 'device:sync-ux', schemaVersion: 7,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:sync-ux',
        evidenceHash: 'sync-ux-evidence', createdAt: 100, updatedAt: 100,
      },
    });
    productTx.objectStore('profile').put({ id: 'profile', serverRevision: 1, updatedAt: 100 });
    await transaction(productTx);
    product.close();

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rakeezx-workspace-v1:${ownerId}`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const registryRequest = indexedDB.open('rakeezx-workspace-registry', 1);
    registryRequest.onupgradeneeded = () => {
      const workspaceStore = registryRequest.result.createObjectStore('workspaces', { keyPath: 'id' });
      workspaceStore.createIndex('authUserId', 'authUserId', { unique: false });
    };
    const registry = await request(registryRequest);
    const registryTx = registry.transaction('workspaces', 'readwrite');
    registryTx.objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: ownerId,
      databaseName: 'rakeezx', ownershipState: 'claimed', workspaceKind: 'legacy-in-place',
      claimId, evidenceHash: 'sync-ux-evidence', createdAt: 100, updatedAt: 100,
    });
    await transaction(registryTx);
    registry.close();
    localStorage.setItem(authKey, JSON.stringify({
      access_token: 'sync-ux-test-token', user: { id: ownerId },
    }));
  }, { stores: STORES, authKey: AUTH_STORAGE_KEY, ownerId: SYNC_UX_OWNER, claimId: SYNC_UX_CLAIM_ID });
  await page.unroute('**/__sync-ux-workspace__');
}

test('automatic sync is quiet, coalesced, resumes pending writes, and retries a temporary failure', async ({ page, context }) => {
  test.setTimeout(30_000);
  const cloud = mockCloud();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await cloud.route(page);
  await seedClaimedWorkspace(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule?.getSyncOperationalSummarySnapshot().cloudSyncHealthy);

  // Nearby writes share the 900ms automatic-sync window rather than starting a storm.
  const beforeWrites = cloud.calls.get.years ?? 0;
  await page.evaluate(async () => {
    await window.store.save({ years: [
      { id: 'sync-ux:year:a', label: 'أ', hijriStart: 1450, hijriEnd: 1451, status: 'active' },
    ] });
    await window.store.save({ years: [
      { id: 'sync-ux:year:b', label: 'ب', hijriStart: 1451, hijriEnd: 1452, status: 'active' },
    ] });
  });
  await expect.poll(() => cloud.tables.years?.some((item) => item.id === 'sync-ux:year:b') ?? false).toBe(true);
  await page.waitForFunction(() => window.__syncModule.getSyncOperationalSummarySnapshot().cloudSyncHealthy &&
    window.store.state.years.some((item) => item.id === 'sync-ux:year:b'));
  // One current V2 cycle has one pre-dispatch and one post-dispatch pull.
  expect((cloud.calls.get.years ?? 0) - beforeWrites).toBe(2);
  expect(cloud.tables.years.map((item) => item.id)).toEqual(expect.arrayContaining(['sync-ux:year:a', 'sync-ux:year:b']));

  // Offline writes remain local; the online event resumes them automatically.
  await context.setOffline(true);
  await page.evaluate(() => window.store.save({ years: [{
    id: 'sync-ux:year:offline', label: 'دون اتصال', hijriStart: 1452, hijriEnd: 1453, status: 'active',
  }] }));
  await page.waitForFunction(() => window.__syncModule.state.status === 'offline');
  // The development shell is not precached; restore transport before reloading
  // so this test exercises IndexedDB/outbox persistence rather than asset cache.
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true && window.__syncModule);
  await expect.poll(() => page.evaluate(() => window.store.state.years.some((item) => item.id === 'sync-ux:year:offline'))).toBe(true);
  await expect.poll(() => cloud.tables.years?.some((item) => item.id === 'sync-ux:year:offline') ?? false).toBe(true);
  await page.waitForFunction(() => window.__syncModule.getSyncOperationalSummarySnapshot().cloudSyncHealthy &&
    window.store.state.years.some((item) => item.id === 'sync-ux:year:offline'));
  expect(cloud.tables.years.some((item) => item.id === 'sync-ux:year:offline')).toBe(true);

  // A failed upload keeps the outbox pending and the bounded automatic retry succeeds later.
  cloud.fail(true);
  const beforeFailure = cloud.calls.get.years ?? 0;
  await page.evaluate(() => window.store.save({ years: [{
    id: 'sync-ux:year:retry', label: 'إعادة', hijriStart: 1453, hijriEnd: 1454, status: 'active',
  }] }));
  await expect.poll(() => cloud.calls.get.years ?? 0).toBeGreaterThan(beforeFailure);
  cloud.fail(false);
  await page.waitForFunction(() => window.__syncModule.getSyncOperationalSummarySnapshot().cloudSyncHealthy, null, { timeout: 10_000 });
  await expect.poll(() => cloud.tables.years.some((item) => item.id === 'sync-ux:year:retry')).toBe(true);

  // Resume is quiet: stale state requests sync without replacing the active page.
  const beforeResume = cloud.calls.get.years ?? 0;
  await page.evaluate(() => {
    window.__syncUxMountedPage = document.getElementById('main').firstElementChild;
    window.__syncModule.state.lastSyncedAt = 0;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => cloud.calls.get.years ?? 0).toBeGreaterThan(beforeResume);
  await page.waitForFunction(() => window.__syncModule.getSyncOperationalSummarySnapshot().cloudSyncHealthy);
  expect(await page.evaluate(() => window.__syncUxMountedPage.isConnected)).toBe(true);

  // The visible fallback still requests a full sync without a success toast.
  const beforeManual = cloud.calls.get.years ?? 0;
  await page.locator('.teacher-mini-hub-trigger').click();
  await page.locator('[data-act="mini-hub-sync-now"]').click();
  await expect.poll(() => cloud.calls.get.years ?? 0).toBeGreaterThan(beforeManual);
  await expect(page.locator('.mini-hub-sync .badge')).toHaveText('متزامن');
  await expect(page.locator('#toast')).not.toHaveClass(/is-on/);

  // A genuinely newer remote record still reaches the visible page.
  const remote = cloud.tables.years.find((item) => item.id === 'sync-ux:year:a');
  remote.label = 'تحديث سحابي';
  remote.revision += 1;
  remote.field_revisions.label = remote.revision;
  remote.client_updated_at = Date.now() + 10_000;
  await page.evaluate(async () => {
    window.__syncUxMountedPage = document.getElementById('main').firstElementChild;
    await window.__syncModule.syncAll({ full: true });
  });
  await expect.poll(() => page.evaluate(() => ({
      rendered: !window.__syncUxMountedPage.isConnected,
      label: window.store.state.years.find((item) => item.id === 'sync-ux:year:a')?.label,
  }))).toEqual({ rendered: true, label: 'تحديث سحابي' });
  expect(errors.filter((message) => !message.includes('503'))).toEqual([]);
});
