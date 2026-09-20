import { test, expect } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { DB_NAME, DB_VERSION, STORES } from '../src/lib/db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serviceWorkerSource = await readFile(path.join(ROOT, 'sw.js'), 'utf8');
const currentServiceWorkerCache = serviceWorkerSource.match(/const VERSION = '([^']+)'/)?.[1];
const ROUTING_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROUTING_CLAIM_ID = 'claim:local-sync-pwa';
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};

function observeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not-file');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const routingSession = {
  access_token: 'local-sync-pwa-token',
  refresh_token: 'local-sync-pwa-refresh',
  expires_at: 4_102_444_800,
  user: { id: ROUTING_OWNER, email: 'local-sync-pwa@example.test' },
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
    if (pathname.endsWith('/token')) return route.fulfill({ json: routingSession });
    if (pathname.endsWith('/user')) return route.fulfill({ json: routingSession.user });
    return route.fulfill({ status: 204 });
  });
  return unexpectedCloudRequests;
}

async function seedClaimedWorkspace(page, origin) {
  await page.route('**/__local-sync-workspace__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>local sync workspace fixture</title>',
  }));
  await page.goto(`${origin}/__local-sync-workspace__`);
  await page.evaluate(async ({ stores, authKey, authSession, ownerId, claimId }) => {
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
      id: 'device', deviceId: 'device:local-sync-pwa', schemaVersion: 7,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:local-sync-pwa',
        evidenceHash: 'local-sync-pwa-evidence', createdAt: 100, updatedAt: 100,
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
      claimId, evidenceHash: 'local-sync-pwa-evidence', createdAt: 100, updatedAt: 100,
    });
    await transaction(registryTx);
    registry.close();
    localStorage.setItem(authKey, JSON.stringify(authSession));
  }, {
    stores: STORES,
    authKey: AUTH_STORAGE_KEY,
    authSession: routingSession,
    ownerId: ROUTING_OWNER,
    claimId: ROUTING_CLAIM_ID,
  });
  await page.unroute('**/__local-sync-workspace__');
}

async function expectClaimedWorkspaceReady(page) {
  await expect.poll(() => page.evaluate(async () => (await import('/src/store.js')).state.ready)).toBe(true);
  await expect(page.locator('[data-workspace-gate]')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/store.js')).getActiveWorkspace())).toMatchObject({
    type: 'account', authUserId: ROUTING_OWNER, databaseName: 'rakeezx', ownershipState: 'claimed',
  });
}

async function hasIndexedRecord(page, store, id) {
  return page.evaluate(({ store, id, dbName, dbVersion }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(store, 'readonly');
      const get = tx.objectStore(store).get(id);
      get.onsuccess = () => { resolve(!!get.result); db.close(); };
      get.onerror = () => reject(get.error);
    };
  }), { store, id, dbName: DB_NAME, dbVersion: DB_VERSION });
}

async function seed(page, prefix) {
  await page.evaluate(async ({ prefix }) => {
    const date = new Date().toISOString().slice(0, 10);
    await window.store.save({
      years: [{ id: `${prefix}-year`, name: 'TEST Year' }],
      terms: [{ id: `${prefix}-term`, yearId: `${prefix}-year`, name: 'TEST Term', index: 1 }],
      subjects: [{ id: `${prefix}-subject`, name: 'TEST Subject' }],
      sections: [{ id: `${prefix}-section`, yearId: `${prefix}-year`, grade: 4, label: 'A', name: 'TEST 4/A', order: 0 }],
      teachings: [{ id: `${prefix}-teaching`, sectionId: `${prefix}-section`, subjectId: `${prefix}-subject`, termId: `${prefix}-term`, order: 0 }],
      students: [{ id: `${prefix}-student`, name: 'TEST Local Student', status: 'active' }],
      enrollments: [{ id: `${prefix}-enrollment`, studentId: `${prefix}-student`, sectionId: `${prefix}-section`, rollNo: 1, status: 'active' }],
      items: [{ id: `${prefix}-item`, teachingId: `${prefix}-teaching`, name: 'TEST Local Score', max: 10 }],
      sessions: [{ id: `${prefix}-session`, teachingId: `${prefix}-teaching`, date, weekday: new Date().getDay(), period: 1, status: 'held' }],
    });
    await window.store.patchDevice({ activeYearId: `${prefix}-year`, activeTermId: `${prefix}-term` });
    window.store.repaint();
  }, { prefix });
}

const countsFor = (prefix) => ({
  sections: window.store.state.sections.filter((record) => !record.deleted && record.id === `${prefix}-section`).length,
  slots: window.store.state.slots.filter((record) => !record.deleted && record.teachingId === `${prefix}-teaching`).length,
  attendance: window.store.state.attendance.filter((record) => !record.deleted && record.sessionId === `${prefix}-session`).length,
  scores: window.store.state.scores.filter((record) => !record.deleted && record.itemId === `${prefix}-item`).length,
});

async function seedProductionIndexedDB(page, prefix) {
  await page.evaluate(async ({ prefix, dbName, dbVersion }) => {
    const date = new Date().toISOString().slice(0, 10);
    const stamp = Date.now();
    const records = {
      years: [{ id: `${prefix}-year`, name: 'TEST Year', updatedAt: stamp }],
      terms: [{ id: `${prefix}-term`, yearId: `${prefix}-year`, name: 'TEST Term', index: 1, updatedAt: stamp }],
      subjects: [{ id: `${prefix}-subject`, name: 'TEST Subject', updatedAt: stamp }],
      sections: [{ id: `${prefix}-section`, yearId: `${prefix}-year`, grade: 4, label: 'A', updatedAt: stamp }],
      teachings: [{ id: `${prefix}-teaching`, sectionId: `${prefix}-section`, subjectId: `${prefix}-subject`, termId: `${prefix}-term`, updatedAt: stamp }],
      students: [{ id: `${prefix}-student`, name: 'TEST Offline Student', status: 'active', updatedAt: stamp }],
      enrollments: [{ id: `${prefix}-enrollment`, studentId: `${prefix}-student`, sectionId: `${prefix}-section`, rollNo: 1, status: 'active', updatedAt: stamp }],
      items: [{ id: `${prefix}-item`, teachingId: `${prefix}-teaching`, name: 'TEST Offline Score', max: 10, updatedAt: stamp }],
      sessions: [{ id: `${prefix}-session`, teachingId: `${prefix}-teaching`, date, weekday: new Date().getDay(), period: 1, status: 'held', updatedAt: stamp }],
    };
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction([...Object.keys(records), 'device'], 'readwrite');
      for (const [store, rows] of Object.entries(records)) rows.forEach((row) => tx.objectStore(store).put(row));
      const getDevice = tx.objectStore('device').get('device');
      getDevice.onsuccess = () => tx.objectStore('device').put({ ...getDevice.result, activeYearId: `${prefix}-year`, activeTermId: `${prefix}-term`, updatedAt: stamp });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, { prefix, dbName: DB_NAME, dbVersion: DB_VERSION });
}

const OFFLINE_ROUTE_MATRIX = [
  ['#/', 'الرئيسية'],
  ['#/classes', 'الفصول'],
  ['#/teaching/offline-graph-teaching', 'فصل'],
  ['#/teaching/offline-graph-teaching/class-rules', 'هدف وميثاق الصف'],
  ['#/teaching/offline-graph-teaching/students', 'الطلاب'],
  ['#/teaching/offline-graph-teaching/attendance', 'الحضور'],
  ['#/teaching/offline-graph-teaching/quicklog', 'الرصد السريع'],
  ['#/teaching/offline-graph-teaching/grades', 'كشف الدرجات'],
  ['#/teaching/offline-graph-teaching/items', 'توزيع الدرجات'],
  ['#/teaching/offline-graph-teaching/picker', 'القرعة'],
  ['#/teaching/offline-graph-teaching/groups', 'المجموعات'],
  ['#/teaching/offline-graph-teaching/board', 'لوحة التميز'],
  ['#/teaching/offline-graph-teaching/sessions', 'الحصص'],
  ['#/teaching/offline-graph-teaching/reports', 'التقارير'],
  ['#/student/offline-graph-student', 'الطالب'],
  ['#/schedule', 'الجدول'],
  ['#/schedule/times', 'أوقات الحصص'],
  ['#/curriculum', 'المنهج'],
  ['#/reports', 'التقارير'],
  ['#/reports/execution', 'تقارير التنفيذ'],
  ['#/archive', 'الأرشيف'],
  ['#/archive/former-students', 'الطلاب السابقون'],
  ['#/archive/year/offline-year/term/offline-term/execution', 'تقارير التنفيذ'],
  ['#/archive/year/offline-year/term/offline-term', 'السجل التاريخي'],
  ['#/calendar', 'التقويم الدراسي'],
  ['#/settings', 'الإعدادات'],
  ['#/settings/backup', 'البيانات والنسخ الاحتياطي'],
  ['#/support', 'الدعم'],
];

test('same-context tabs converge section, timetable, attendance, and scoring changes without duplicates', async ({ context }) => {
  test.setTimeout(90_000);
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  const errorsA = observeErrors(pageA);
  const errorsB = observeErrors(pageB);
  await pageA.goto('/#/classes');
  await pageB.goto('/#/classes');
  await Promise.all([
    pageA.waitForFunction(() => window.store, { timeout: 15_000 }),
    pageB.waitForFunction(() => window.store, { timeout: 15_000 }),
  ]);
  await seed(pageA, 'local');
  await expect.poll(() => pageB.evaluate(() => window.store.state.sections.some((record) => record.id === 'local-section'))).toBe(true);

  // Section edit through Tab A's real sheet propagates and updates Tab B's report UI.
  await pageA.goto('/#/teaching/local-teaching');
  await pageB.goto('/#/reports');
  await pageA.locator('[data-act="edit-sec"]').click();
  await pageA.selectOption('select[name="grade"]', '5');
  await pageA.fill('input[name="label"]', 'Z');
  await pageA.click('button[form="edit-sec-form"]');
  await expect(pageA.locator('#toast')).toContainText('تم تعديل');
  await expect(pageB.locator('.report-class-row[href="#/teaching/local-teaching/reports"] .row__title'))
    .toContainText('الخامس الابتدائي / Z');

  // Add and then move the same recurring slot through Tab A's schedule UI.
  await pageA.goto('/#/schedule');
  await pageB.goto('/#/schedule');
  await pageA.locator('[data-act="add"]').first().click();
  await pageA.selectOption('select[name="teachingId"]', 'local-teaching');
  await pageA.selectOption('select[name="weekday"]', '0');
  await pageA.selectOption('select[name="period"]', '1');
  await pageA.click('button[form="slot-form"]');
  const slotId = await pageA.evaluate(() => window.store.state.slots.find((record) => !record.deleted && record.teachingId === 'local-teaching').id);
  await expect.poll(() => pageB.evaluate((id) => window.store.state.slots.find((record) => record.id === id), slotId)).toMatchObject({ weekday: 0, period: 1 });
  await pageA.locator(`[data-act="edit"][data-id="${slotId}"]`).click();
  await pageA.selectOption('select[name="weekday"]', '1');
  await pageA.selectOption('select[name="period"]', '4');
  await pageA.click('button[form="slot-form"]');
  await expect.poll(() => pageB.evaluate((id) => window.store.state.slots.find((record) => record.id === id), slotId)).toMatchObject({ id: slotId, weekday: 1, period: 4 });
  const movedSlot = pageB.locator('.slot').filter({ has: pageB.locator(`[data-act="edit"][data-id="${slotId}"]`) });
  await expect(movedSlot.locator('.slot__period-num')).toHaveText('4');

  // Attendance and scoring controls write in Tab A and Tab B re-renders the propagated records.
  await pageA.goto('/#/teaching/local-teaching/attendance?session=local-session');
  await pageB.goto('/#/teaching/local-teaching/attendance?session=local-session');
  await pageA.locator('.att-row', { hasText: 'TEST Local Student' }).locator('[data-status="late"]').click();
  await expect(pageB.locator('.att-row', { hasText: 'TEST Local Student' }).locator('[data-status="late"]')).toHaveClass(/is-on/);
  await pageA.goto('/#/teaching/local-teaching/grades');
  await pageB.goto('/#/teaching/local-teaching/grades');
  await pageA.locator('[data-act="mode"][data-mode="table"]').click();
  await pageB.locator('[data-act="mode"][data-mode="table"]').click();
  const scoreInput = pageA.locator('input[data-fk="t-local-student-local-item"]');
  await scoreInput.fill('8');
  await scoreInput.press('Tab');
  await expect(pageB.locator('input[data-fk="t-local-student-local-item"]')).toHaveValue('8');

  // Receipt in Tab B is read-only: it must not cause extra records or repeated outbox writes.
  expect(await pageA.evaluate(countsFor, 'local')).toEqual({ sections: 1, slots: 1, attendance: 1, scores: 1 });
  const outboxBefore = await pageA.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length);
  await pageB.waitForTimeout(300);
  const outboxAfter = await pageA.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length);
  expect(outboxAfter).toBe(outboxBefore);

  await pageA.reload();
  await pageB.reload();
  await expect.poll(() => pageA.evaluate(countsFor, 'local')).toEqual({ sections: 1, slots: 1, attendance: 1, scores: 1 });
  await expect.poll(() => pageB.evaluate(countsFor, 'local')).toEqual({ sections: 1, slots: 1, attendance: 1, scores: 1 });
  await pageB.locator('[data-act="mode"][data-mode="table"]').click();
  await expect(pageB.locator('input[data-fk="t-local-student-local-item"]')).toHaveValue('8');

  await pageB.close();
  await pageA.goto('/#/reports');
  await expect(pageA.locator('.report-class-row[href="#/teaching/local-teaching/reports"] .row__title'))
    .toContainText('الخامس الابتدائي / Z');
  expect(errorsA).toEqual([]);
  expect(errorsB).toEqual([]);
});

test('raw static production-like shell serves cached local routes and IndexedDB data offline', async ({ browser }) => {
  test.setTimeout(90_000);
  const { server, url } = await startStaticServer();
  const context = await browser.newContext();
  const unexpectedCloudRequests = await installCloudMock(context);
  const page = await context.newPage();
  const errors = observeErrors(page);
  try {
    await seedClaimedWorkspace(page, url);
    await page.goto(`${url}/#/classes`, { waitUntil: 'networkidle' });
    await expectClaimedWorkspaceReady(page);
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.state === 'activated';
    }, { timeout: 15_000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });
    const cacheEntries = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys.find((key) => key.startsWith('rakeezx-')));
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    });
    expect(cacheEntries).toEqual(expect.arrayContaining([
      '/index.html',
      '/src/app.js',
      '/src/views/attendance.js',
      '/src/views/grades.js',
      '/src/lib/schedule-export.js',
      '/src/lib/session-editor-ui.js',
      '/src/lib/session-delete-ui.js',
    ]));
    const dependencyOrigins = await page.evaluate(() => [
      ...document.querySelectorAll('link[rel="stylesheet"], link[rel="manifest"], link[rel="icon"], link[rel="apple-touch-icon"], script[src]'),
    ].map((node) => new URL(node.href || node.src, location.href).origin));
    expect(dependencyOrigins.length).toBeGreaterThan(0);
    expect(dependencyOrigins.every((origin) => origin === new URL(page.url()).origin)).toBe(true);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://rakeezx.com/');

    await seedProductionIndexedDB(page, 'offline');
    await page.reload({ waitUntil: 'networkidle' });
    await context.setOffline(true);
    for (const [route, title] of [
      ['/#/classes', 'الفصول'],
      ['/#/schedule', 'الجدول'],
      ['/#/teaching/offline-teaching/attendance?session=offline-session', 'الحضور'],
      ['/#/teaching/offline-teaching/grades', 'كشف الدرجات'],
    ]) {
      await page.goto(`${url}${route}`);
      await expect(page.locator('.topbar__title')).toContainText(title);
      expect(await hasIndexedRecord(page, 'students', 'offline-student')).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.locator('[data-act="mode"][data-mode="table"]').click();
    await page.locator('input[data-fk="t-offline-student-offline-item"]').fill('7');
    await page.locator('input[data-fk="t-offline-student-offline-item"]').press('Tab');
    await expect.poll(() => page.evaluate(({ dbName, dbVersion }) => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction('scores', 'readonly').objectStore('scores').get('sc:offline-student:offline-item');
        get.onsuccess = () => { resolve(get.result?.value ?? null); db.close(); };
        get.onerror = () => reject(get.error);
      };
    }), { dbName: DB_NAME, dbVersion: DB_VERSION })).toBe(7);
    await page.reload();
    await page.locator('[data-act="mode"][data-mode="table"]').click();
    await expect(page.locator('input[data-fk="t-offline-student-offline-item"]')).toHaveValue('7');

    await context.setOffline(false);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.topbar__title')).toBeVisible();
    expect(unexpectedCloudRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('one online load precaches every lazy route and supports offline reload and reopen', async ({ browser }) => {
  test.setTimeout(150_000);
  const { server, url } = await startStaticServer();
  const context = await browser.newContext();
  const unexpectedCloudRequests = await installCloudMock(context);
  const page = await context.newPage();
  const errors = observeErrors(page);
  const badResponses = [];
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  try {
    await seedClaimedWorkspace(page, url);
    // This is the only route visited online. Every lazy route below must come
    // from the installed app shell after the origin server is unavailable.
    await page.goto(`${url}/#/`, { waitUntil: 'networkidle' });
    await expectClaimedWorkspaceReady(page);
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated';
    }, { timeout: 15_000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), { timeout: 15_000 });

    const cacheAudit = await page.evaluate(async (expectedCache) => {
      const key = (await caches.keys()).find((candidate) => candidate === expectedCache);
      const cache = key ? await caches.open(key) : null;
      return {
        key,
        paths: cache ? (await cache.keys()).map((request) => new URL(request.url).pathname) : [],
      };
    }, currentServiceWorkerCache);
    expect(cacheAudit.key).toBe(currentServiceWorkerCache);
    expect(cacheAudit.paths).toEqual(expect.arrayContaining([
      '/index.html',
      '/src/generated/build-meta.generated.js',
      '/src/lib/backup-v2.js',
      '/src/lib/build-meta.js',
      '/src/lib/cloud-recovery-ui.js',
      '/src/lib/student-lifecycle-ui.js',
      '/src/lib/support.js',
      '/src/views/former-students.js',
      '/src/views/settings.js',
      '/src/views/support.js',
    ]));

    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

    for (const [hash, title] of OFFLINE_ROUTE_MATRIX) {
      await page.evaluate((nextHash) => { location.hash = nextHash; }, hash);
      await expect(page).toHaveURL(`${url}/${hash}`);
      await expect(page.locator('.topbar__title')).toContainText(title);
      await expect(page.locator('#toast')).not.toContainText('تعذّر فتح هذه الشاشة');
    }

    await page.evaluate(() => { location.hash = '#/'; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.topbar__title')).toContainText('الرئيسية');

    await page.evaluate(() => { location.hash = '#/settings'; });
    await expect(page.locator('.topbar__title')).toContainText('الإعدادات');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.topbar__title')).toContainText('الإعدادات');
    await page.evaluate(() => { location.hash = '#/schedule'; });
    await expect(page.locator('.topbar__title')).toContainText('الجدول');

    const reopened = await context.newPage();
    const reopenedErrors = observeErrors(reopened);
    await reopened.goto(`${url}/#/support`, { waitUntil: 'domcontentloaded' });
    await expect(reopened.locator('.topbar__title')).toContainText('الدعم');
    await reopened.evaluate(() => { location.hash = '#/'; });
    await expect(reopened.locator('.topbar__title')).toContainText('الرئيسية');

    expect(badResponses).toEqual([]);
    expect(unexpectedCloudRequests).toEqual([]);
    expect(errors).toEqual([]);
    expect(reopenedErrors).toEqual([]);
  } finally {
    await context.close();
    if (server.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});

test('visited Schedule and Attendance remain available across offline reload and navigation', async ({ browser }) => {
  test.setTimeout(90_000);
  const { server, url } = await startStaticServer();
  const context = await browser.newContext();
  const unexpectedCloudRequests = await installCloudMock(context);
  const page = await context.newPage();
  const errors = observeErrors(page);
  try {
    await seedClaimedWorkspace(page, url);
    await page.goto(`${url}/#/classes`, { waitUntil: 'networkidle' });
    await expectClaimedWorkspaceReady(page);
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated';
    }, { timeout: 15_000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), { timeout: 15_000 });
    await seedProductionIndexedDB(page, 'warm-offline');
    await page.reload({ waitUntil: 'networkidle' });

    await page.goto(`${url}/#/schedule`);
    await expect(page.locator('.topbar__title')).toContainText('الجدول');
    await expect(page.locator('.schedule-head__title')).toBeVisible();
    await page.goto(`${url}/#/teaching/warm-offline-teaching/attendance?session=warm-offline-session`);
    await expect(page.locator('.topbar__title')).toContainText('الحضور');
    await expect(page.locator('.attendance-session-summary')).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.topbar__title')).toContainText('الحضور');
    await expect(page.locator('.attendance-session-summary')).toBeVisible();
    await page.goto(`${url}/#/schedule`);
    await expect(page.locator('.topbar__title')).toContainText('الجدول');
    await expect(page.locator('.schedule-head__title')).toBeVisible();
    await page.reload();
    await expect(page.locator('.schedule-head__title')).toBeVisible();
    await page.goto(`${url}/#/teaching/warm-offline-teaching/attendance?session=warm-offline-session`);
    await expect(page.locator('.attendance-session-summary')).toBeVisible();
    expect(unexpectedCloudRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
