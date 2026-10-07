import { test, expect } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORES } from '../src/lib/db.js';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLAIM_ID = 'claim:routing-browser-a';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

const sessionFor = (ownerId) => ({
  access_token: `routing-token-${ownerId}`,
  refresh_token: `routing-refresh-${ownerId}`,
  expires_at: 4_102_444_800,
  user: { id: ownerId, email: `${ownerId.slice(0, 8)}@example.test` },
});

async function installCloudMock(page, loginOwnerId = A) {
  await page.route('https://*.supabase.co/**', (route) => route.abort());
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/otp')) return route.fulfill({ status: 204 });
    if (path.endsWith('/verify')) return route.fulfill({ json: sessionFor(loginOwnerId) });
    if (path.endsWith('/user')) return route.fulfill({ json: sessionFor(loginOwnerId).user });
    return route.fulfill({ status: 204 });
  });
}

async function seedClaimedWorkspace(page, { authOwnerId = A, markerOwnerId = A, registryOwnerId = A, origin = '' } = {}) {
  await page.route('**/__routing-fixture__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>routing fixture</title>',
  }));
  await page.goto(`${origin}/__routing-fixture__`);
  await page.evaluate(async ({ stores, authKey, authSession, markerOwner, registryOwner, claimId }) => {
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
      id: 'device', deviceId: 'device:routing-browser', schemaVersion: 7,
      theme: 'dark',
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId: markerOwner,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:routing-browser',
        evidenceHash: 'routing-browser-evidence', createdAt: 100, updatedAt: 100,
      },
    });
    productTx.objectStore('profile').put({
      id: 'profile', teacherName: 'معلم التوجيه', schoolName: 'مدرسة الاختبار',
      serverRevision: 1, updatedAt: 100,
    });
    await transaction(productTx);
    product.close();

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rakeezx-workspace-v1:${registryOwner}`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const registryRequest = indexedDB.open('rakeezx-workspace-registry', 1);
    registryRequest.onupgradeneeded = () => {
      const workspaceStore = registryRequest.result.createObjectStore('workspaces', { keyPath: 'id' });
      workspaceStore.createIndex('authUserId', 'authUserId', { unique: false });
    };
    const registry = await request(registryRequest);
    const registryTx = registry.transaction('workspaces', 'readwrite');
    registryTx.objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: registryOwner,
      databaseName: 'rakeezx', ownershipState: 'claimed', workspaceKind: 'legacy-in-place',
      claimId, evidenceHash: 'routing-browser-evidence', createdAt: 100, updatedAt: 100,
    });
    await transaction(registryTx);
    registry.close();
    if (authSession) localStorage.setItem(authKey, JSON.stringify(authSession));
    else localStorage.removeItem(authKey);
  }, {
    stores: STORES,
    authKey: AUTH_STORAGE_KEY,
    authSession: authOwnerId ? sessionFor(authOwnerId) : null,
    markerOwner: markerOwnerId,
    registryOwner: registryOwnerId,
    claimId: CLAIM_ID,
  });
  await page.unroute('**/__routing-fixture__');
  await page.addInitScript(() => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    window.__routingDatabaseOpens = [];
    indexedDB.open = (...args) => {
      window.__routingDatabaseOpens.push(String(args[0]));
      return originalOpen(...args);
    };
  });
}

async function expectReadyForA(page) {
  await expect.poll(() => page.evaluate(async () => (await import('/src/store.js')).state.ready)).toBe(true);
  await expect(page.locator('[data-workspace-gate]')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/store.js')).getActiveWorkspace())).toMatchObject({
    type: 'account', authUserId: A, databaseName: 'rakeezx', ownershipState: 'claimed',
  });
}

test('claimed A boots from cached identity, works offline, and keeps workspace/theme after reload', async ({ browser }) => {
  const host = await startStaticServer();
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await installCloudMock(page);
    await seedClaimedWorkspace(page, { origin: host.url });
    await page.goto(`${host.url}/#/classes`);
    await expectReadyForA(page);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!await page.evaluate(() => !!navigator.serviceWorker.controller)) await page.reload();
    await expectReadyForA(page);

    // Removing only Cache Storage and the PWA worker must not remove or
    // invalidate the claimed IndexedDB workspace.
    await page.evaluate(async () => {
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
      await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()));
    });
    await page.reload();
    await expectReadyForA(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!await page.evaluate(() => !!navigator.serviceWorker.controller)) await page.reload();
    await expectReadyForA(page);

    await context.setOffline(true);
    await page.reload();
    await expectReadyForA(page);

    const write = await page.evaluate(async () => {
      const store = await import('/src/store.js');
      const profile = await store.patchProfile({ schoolName: 'مدرسة عمل محلي دون اتصال' });
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rakeezx');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const outbox = await new Promise((resolve, reject) => {
        const request = database.transaction('outbox', 'readonly').objectStore('outbox').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return { schoolName: profile?.schoolName, owners: outbox.map((entry) => entry.ownerId) };
    });
    expect(write.schoolName).toBe('مدرسة عمل محلي دون اتصال');
    expect(write.owners.length).toBeGreaterThan(0);
    expect(write.owners.every((owner) => owner === A)).toBe(true);
    await page.reload();
    await expectReadyForA(page);
    expect(await page.evaluate(async () => (await import('/src/store.js')).state.profile.schoolName)).toBe('مدرسة عمل محلي دون اتصال');
    expect(pageErrors).toEqual([]);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
    await host.close();
  }
});

test('explicit logout hides claimed data and same-account login restores the same local workspace', async ({ page }) => {
  const unexpectedSyncWarnings = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('[rakeezx sync] Automatic sync failed')) {
      unexpectedSyncWarnings.push(message.text());
    }
  });
  await installCloudMock(page, A);
  await seedClaimedWorkspace(page);
  await page.goto('/#/');
  await expectReadyForA(page);

  await page.locator('.teacher-mini-hub-trigger').click();
  await page.waitForFunction(() => window.__syncModule?.displayState().detailStatus !== 'syncing');
  unexpectedSyncWarnings.length = 0;
  await page.locator('[data-act="mini-hub-logout"]').click();
  await expect(page.locator('[data-workspace-gate]')).toHaveAttribute('data-workspace-reason', 'claimed-workspace-signed-out');
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(false);
  expect(await page.evaluate(() => window.__routingDatabaseOpens.includes('rakeezx'))).toBe(false);
  expect(unexpectedSyncWarnings).toEqual([]);

  await page.locator('[data-workspace-login]').click();
  const login = page.locator('#first-run-inline-form');
  await expect(login.locator('input[name="email"]')).toBeVisible();
  await login.locator('input[name="email"]').fill('a@example.test');
  await login.getByRole('button', { name: 'متابعة' }).click();
  await expect(login.locator('input[name="token"]')).toBeVisible();
  await login.locator('input[name="token"]').fill('123456');
  await Promise.all([
    page.waitForEvent('framenavigated'),
    login.getByRole('button', { name: 'تحقق' }).click(),
  ]);
  await expectReadyForA(page);
});

test('Auth B and claim-marker drift fail closed before A Product DB is mounted', async ({ page }) => {
  await installCloudMock(page, B);
  await seedClaimedWorkspace(page, { authOwnerId: B });
  await page.goto('/#/');
  await expect(page.locator('[data-workspace-gate]')).toHaveAttribute('data-workspace-reason', 'authenticated-account-workspace-mismatch');
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(false);
  expect(await page.evaluate(() => window.__syncModule == null)).toBe(true);
  expect(await page.evaluate(() => window.__routingDatabaseOpens.includes('rakeezx'))).toBe(false);
});
