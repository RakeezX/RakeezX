import { test, expect } from '@playwright/test';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createAttendanceServer } from './helpers/attendance-server-fixture.mjs';
import { DB_VERSION, STORES } from '../src/lib/db.js';
import { SYNC_V2_SCHEMAS, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const root = process.cwd();
const owner = '11111111-1111-4111-8111-111111111111';
const evidenceDir = path.join(root, 'artifacts/attendance-incident-0456-3');
const modules = ['class-subject-default', 'complete-read', 'display-identity', 'group-count-ui',
  'install-guide-ui', 'session-start-ui', 'settings-profile-ui', 'student-search-ui', 'visible-viewport']
  .map(name => `src/lib/${name}.js`).concat('src/views/calendar-0417-ui.js');
test.use({ serviceWorkers: 'allow', timezoneId: 'Asia/Riyadh' });

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
  const file = path.join(root, 'src/generated/build-meta.generated.js');
  const original = await readFile(file);
  try {
    const meta = execFileSync(process.execPath, ['scripts/generate-build-meta.mjs'], { cwd: root });
    const built = execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: root });
    const checks = execFileSync(process.execPath, ['--test', 'tests/build-meta.test.mjs'], { cwd: root });
    await writeFile(path.join(evidenceDir, 'browser-release-build.log'), Buffer.concat([meta, built, checks]));
  } finally { await writeFile(file, original); }
});

for (const scenario of ['fresh-static-release', 'released-worker-update', 'bundled-output']) {
test(`normal worker: ${scenario}, exact module cache, offline reopen and retained history/intent`, async ({ browser }) => {
  test.setTimeout(90_000);
  const pg = await createAttendanceServer();
  await pg.pg.exec(`update rakeezx.sessions set date='2026-10-01',start_time='07:31:00',end_time='08:01:00.250000';
    insert into rakeezx.sessions(id,teaching_id,date,period,status,start_time,end_time)
      values('history-session','override-teaching','2026-09-30',2,'scheduled','07:15:00','08:01:00');
    insert into rakeezx.attendance(id,session_id,student_id,teaching_id,date,status)
      values('history-attendance','history-session','override-c','override-teaching','2026-09-30','absent');`);
  const foundation = Object.fromEntries(await Promise.all(Object.entries(SYNC_V2_SCHEMAS).map(async ([store, schema]) =>
    [store, (await pg.fetchRecords(schema.entity)).map(row => decodeSyncV2Canonical(store, row))])));
  const currentWorker = await readFile(path.join(root, 'sw.js'));
  let worker = scenario === 'released-worker-update'
    ? execFileSync('git', ['show', '494bb7519b23fa72572b9d628dc9cc0f6f3f965e:sw.js'], { cwd: root }) : currentWorker;
  const bundled = scenario === 'bundled-output';
  const requests = [];
  const http = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    requests.push(url.pathname);
    if (url.pathname === '/seed') return res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Synthetic bootstrap</title>');
    if (url.pathname === '/sw.js') return res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end(worker);
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    let file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (bundled) {
      const compiled = path.resolve(root, 'dist', relative);
      try { if ((await stat(compiled)).isFile()) file = compiled; } catch {}
    }
    try {
      const body = await readFile(file);
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml',
        '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${http.address().port}`;
  const context = await browser.newContext({ serviceWorkers: 'allow', timezoneId: 'Asia/Riyadh' });
  const external = [], errors = [], failedCloudReads = [];
  const api = `${SUPABASE_URL}/rest/v1/attendance?owner_id=eq.${owner}&select=*`;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.href === `${SUPABASE_URL}/rest/v1/rpc/score_foundation_capability`) {
      return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Synthetic score capability unavailable' } });
    }
    if (route.request().url() === api) return route.fulfill({ json: [{ id: 'synthetic-api-cache-sentinel' }],
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', 'Content-Range': '0-0/1' } });
    // Foreground/reconnect may request a pull. A disposable unavailable cloud
    // must preserve queued local intent; no request is forwarded externally.
    if (url.origin === SUPABASE_URL && url.pathname.startsWith('/rest/v1/') && route.request().method() === 'GET') {
      failedCloudReads.push(url.pathname);
      return route.fulfill({ status: 503, json: { message: 'Synthetic reconnect read failure' } });
    }
    external.push(url.origin); return route.abort();
  });
  try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-01T09:33:00+03:00'));
    await page.goto(base + '/seed');
    await page.evaluate(async ({ records, stores, version, authKey, owner }) => {
      const request = indexedDB.open('rakeezx', version);
      request.onupgradeneeded = () => stores.forEach(name => request.result.createObjectStore(name, { keyPath: 'id' }));
      const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const tx = db.transaction([...Object.keys(records), 'device'], 'readwrite');
      for (const [name, rows] of Object.entries(records)) for (const row of rows) tx.objectStore(name).put(row);
      tx.objectStore('device').put({ id: 'device', deviceId: 'synthetic-offline-device', schemaVersion: version,
        activeYearId: 'override-year', activeTermId: 'override-term' });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
      localStorage.setItem(authKey, JSON.stringify({ access_token: 'synthetic-only', user: { id: owner }, expires_at: Date.now() / 1000 + 86400 }));
    }, { records: foundation, stores: STORES, version: DB_VERSION, authKey: AUTH_STORAGE_KEY, owner });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    });
    const attendanceUrl = base + '/#/teaching/override-teaching/attendance?session=override-session';
    await page.goto(attendanceUrl);
    await expect(page.locator('.att-row')).toHaveCount(3);
    expect(await page.evaluate(() => [typeof window.store, typeof window.__syncModule])).toEqual(['undefined', 'undefined']);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.locator('[data-act="set"][data-id="override-a"][data-status="present"]').click();
    await expect(page.locator('.att-pill')).toContainText('1 من 3');
    const snapshot = () => page.evaluate(async () => {
      const request = indexedDB.open('rakeezx');
      const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
      const result = {};
      for (const name of ['attendance', 'outbox', 'sessionRosterSnapshots']) {
        const read = db.transaction(name).objectStore(name).getAll();
        result[name] = await new Promise(resolve => { read.onsuccess = () => resolve(read.result); });
        result[name].sort((a, b) => a.id.localeCompare(b.id));
      }
      db.close(); return result;
    });
    const before = await snapshot();
    expect(before.attendance.some(row => row.id === 'history-attendance' && row.status === 'absent')).toBe(true);
    expect(before.outbox.length).toBeGreaterThan(0);
    if (scenario === 'released-worker-update') {
      const oldCounts = await page.evaluate(async () => (await (await caches.open('rakeezx-v33')).keys()).length);
      await page.evaluate(() => { window.workerChanges = 0; navigator.serviceWorker.addEventListener('controllerchange', () => window.workerChanges++); });
      worker = currentWorker;
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await page.waitForFunction(() => window.workerChanges > 0);
      expect(await snapshot()).toEqual(before);
      expect(oldCounts).toBeGreaterThan(0);
    }
    await page.waitForFunction(async paths => {
      const cache = await caches.open('rakeezx-v33');
      return (await Promise.all(paths.map(relative => cache.match(new URL(relative, location.origin))))).every(Boolean);
    }, modules);
    const responses = [];
    for (const module of modules) {
      const expected = await readFile(path.join(root, module), 'utf8');
      const response = await page.evaluate(async relative => {
        const url = new URL(relative, location.origin);
        const online = await fetch(url);
        const cache = await (await caches.open('rakeezx-v33')).match(url);
        return { url: url.pathname, status: online.status, type: online.headers.get('content-type'), body: await online.text(),
          cachedType: cache.headers.get('content-type'), cachedBody: await cache.text() };
      }, module);
      expect(response.status).toBe(200); expect(response.type).toMatch(/javascript/);
      expect(response.cachedType).toMatch(/javascript/);
      expect(response.body).toBe(expected); expect(response.cachedBody).toBe(expected);
      responses.push({ path: response.url, status: response.status, type: response.type });
    }
    expect(await page.evaluate(url => fetch(url).then(r => r.json()), api)).toEqual([{ id: 'synthetic-api-cache-sentinel' }]);
    await page.reload(); // Normal controller fetches the actual executing bundle/modules.
    await expect(page.locator('.att-pill')).toContainText('1 من 3');
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(attendanceUrl);
    await expect(reopened.locator('.att-row')).toHaveCount(3);
    await expect(reopened.locator('.att-pill')).toContainText('1 من 3');
    await expect(reopened.getByRole('status', { name: 'حالة الرصد: غير مكتمل' })).toBeVisible();
    expect(await snapshot()).toEqual(before);
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('.att-pill')).toContainText('1 من 3');
    expect(await snapshot()).toEqual(before);
    const cached = await page.evaluate(async () => {
      const records = [];
      for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) {
        const response = await (await caches.open(key)).match(request);
        records.push({ key, url: request.url, sentinel: (await response.text()).includes('synthetic-api-cache-sentinel') });
      }
      return records;
    });
    expect(cached.every(row => new URL(row.url).origin === base && !row.sentinel && !row.url.includes('/rest/v1/'))).toBe(true);
    expect(external).toEqual([]); expect(errors).toEqual([]);
    await writeFile(path.join(evidenceDir, `worker-${scenario}.json`), JSON.stringify({ scenario,
      servingLayout: bundled ? 'Vite-built index/assets with unchanged shipping static shell files' : 'shipping static release index/src/assets/worker without Vite or development hooks',
      responses, offlineReopen: true, updateRetainsIndexedDB: true, retainedAttendance: before.attendance.length,
      retainedPendingCommands: before.outbox.length, failedCloudReads, cacheEntries: cached, requests }, null, 2));
  } finally {
    await context.close(); await new Promise(resolve => http.close(resolve)); await pg.close();
  }
});
}
