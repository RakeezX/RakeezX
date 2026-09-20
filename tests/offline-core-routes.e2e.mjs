import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { STORES } from '../src/lib/db.js';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLAIM_ID = 'claim:offline-core-routes';
const authSession = {
  access_token: 'offline-core-routes-token',
  refresh_token: 'offline-core-routes-refresh',
  expires_at: 4_102_444_800,
  user: { id: OWNER_ID, email: 'offline-core-routes@example.test' },
};

async function installCloudMock(context) {
  const unexpectedCloudRequests = [];
  await context.route('https://*.supabase.co/**', (route) => {
    unexpectedCloudRequests.push(route.request().url());
    return route.abort();
  });
  await context.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await context.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/token')) return route.fulfill({ json: authSession });
    if (pathname.endsWith('/user')) return route.fulfill({ json: authSession.user });
    return route.fulfill({ status: 204 });
  });
  return unexpectedCloudRequests;
}

async function seedClaimedWorkspace(page, base) {
  await page.goto(base + '/cache-bootstrap');
  await page.evaluate(async ({ stores, authKey, session, ownerId, claimId }) => {
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
      id: 'device', deviceId: 'device:offline-core-routes', schemaVersion: 7,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:offline-core-routes',
        evidenceHash: 'offline-core-routes-evidence', createdAt: 100, updatedAt: 100,
      },
    });
    productTx.objectStore('profile').put({
      id: 'profile', teacherName: 'معلم الاختبار', schoolName: 'مدرسة الاختبار',
      serverRevision: 1, updatedAt: 100,
    });
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
      claimId, evidenceHash: 'offline-core-routes-evidence', createdAt: 100, updatedAt: 100,
    });
    await transaction(registryTx);
    registry.close();
    localStorage.setItem(authKey, JSON.stringify(session));
  }, { stores: STORES, authKey: AUTH_STORAGE_KEY, session: authSession, ownerId: OWNER_ID, claimId: CLAIM_ID });
}

test('unvisited core routes and dependencies open offline from the installed shell', async ({ browser }) => {
  const root = process.cwd();
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/cache-bootstrap') {
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><title>cache bootstrap</title>');
    }
    const file = path.resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      const content = await readFile(file);
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext();
  const unexpectedCloudRequests = await installCloudMock(context);
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await seedClaimedWorkspace(page, base);
    await page.evaluate(() => caches.open('rakeezx-v7'));
    await page.goto(base + '/#/classes');
    await page.waitForFunction(async (ownerId) => {
      const store = await import('/src/store.js');
      return store.state.ready && store.getActiveWorkspace()?.authUserId === ownerId &&
        Boolean(store.activeYear()) && Boolean(store.activeTerm());
    }, OWNER_ID);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      if ((await caches.keys()).includes('rakeezx-v7')) return false;
      const cache = await caches.open('rakeezx-v10');
      return (await Promise.all(['src/lib/sync-v2.js', 'src/lib/subject-catalog.js', 'src/lib/avatar.js', 'src/lib/report-print.js', 'src/views/archive.js', 'src/views/execution-report.js', 'src/views/class-rules.js'].map(p => cache.match(new URL(p, location.href))))).every(Boolean);
    });
    await page.evaluate(async () => {
      const store = await import('/src/store.js');
      const section = await store.createSection({ grade: 4, label: 'TEST' });
      const teaching = await store.createTeaching({ sectionId: section.id, subjectId: store.subjects()[0].id });
      window.testTeaching = teaching.id;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const teaching = await page.evaluate(() => window.testTeaching);
    await context.setOffline(true);
    for (const route of [`/teaching/${teaching}/students`, '/archive', '/reports/execution']) {
      await page.goto(base + '/#' + route);
      await expect(page.locator('.topbar__title')).toBeVisible();
      await expect(page.locator('#toast')).not.toHaveText('تعذّر فتح هذه الشاشة');
      if (route.endsWith('/students')) {
        await page.locator('[data-act="add"]').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.locator('[data-sheet-close]').first().click();
      }
    }
    expect(unexpectedCloudRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});
