import { test, expect, chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const START = Date.parse('2026-10-12T07:00:00Z');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

async function serve(testMode) {
  const server = http.createServer(async (request, response) => {
    const relative = new URL(request.url, 'http://127.0.0.1').pathname.replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(path.resolve(ROOT) + path.sep)) return response.writeHead(403).end();
    try {
      let body = await readFile(file);
      if (testMode && relative === 'src/lib/offline-lease.js') {
        // Compile only the isolated test module env. All Product DOM, routing,
        // durable storage, Auth and handlers are served from the real source.
        body = (await transformWithOxc(body.toString(), file, {
          define: { 'import.meta.env': JSON.stringify({ MODE: 'n49-test' }) },
        })).code;
      }
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
const sessionFor = (id) => ({ access_token: `synthetic-n49-${id}`, refresh_token: 'synthetic-refresh', expires_at: 4102444800, user: { id, email: 'n49@example.test' } });

async function seed(page, origin, owners = [A, B]) {
  await page.route('**/__n49_fixture__', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>N49 fixture</title>' }));
  await page.goto(origin + '/__n49_fixture__');
  await page.evaluate(async ({ owners, authKey, session }) => {
    const db = await import('/src/lib/db.js');
    const { createWorkspaceRegistry } = await import('/src/lib/workspaces.js');
    const { buildAccountFoundationDefaults } = await import('/src/lib/account-provisioning.js');
    const m = await import('/src/models.js');
    const registry = createWorkspaceRegistry();
    for (const owner of owners) {
      const receipt = { ownerId: owner, contractVersion: 1, foundationHash: 'synthetic-foundation-' + owner };
      const record = await registry.registerProvisionedAccount(owner, receipt);
      db.selectDatabase(record.databaseName);
      const defaults = buildAccountFoundationDefaults();
      const term = defaults.terms.find((term) => term.status === 'active') || defaults.terms[0];
      const section = m.makeSection({ id: 'section-' + owner, yearId: defaults.years[0].id, grade: 4, label: 'أ' });
      const teaching = m.makeTeaching({ id: 'teaching-' + owner, sectionId: section.id, subjectId: defaults.subjects[0].id, termId: term.id });
      const student = m.makeStudent({ id: 'student-' + owner, name: owner === owners[0] ? 'طالب ألف' : 'طالب باء' });
      const enrollment = m.makeEnrollment({ studentId: student.id, sectionId: section.id, rollNo: 1, startDate: '2026-08-01' });
      const item = m.makeItem({ id: 'item-' + owner, teachingId: teaching.id, name: 'تقييم الاختبار', max: 10 });
      const canonical = Object.fromEntries(Object.entries({ ...defaults, sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], items: [item] })
        .map(([name, rows]) => [name, rows.map((row) => ({ ...row, serverRevision: 1 }))]));
      await db.putAcross({ ...canonical,
        profile: [m.makeProfile({ teacherName: owner === owners[0] ? 'معلم ألف' : 'معلم باء', phone: '0500000001', serverRevision: 1 })],
        device: [m.makeDevice({ deviceId: 'device-' + owner, activeYearId: defaults.years[0].id, activeTermId: term.id, schemaVersion: 8, accountProvisioningReceipt: receipt })],
        outbox: [{ id: 'prior-' + owner, protocol: 'v2', mutationId: 'keep-' + owner, ownerId: owner, store: 'students', recordId: student.id,
          op: 'patch', state: 'rejected', sequence: 1, deviceId: 'device-' + owner, patch: { name: student.name }, localPatch: { name: student.name },
          fields: ['name'], groups: [], dependencies: [], baseRevision: 1, lastError: { code: 'fixture-rejected', message: 'synthetic pending envelope' } }],
      });
      db.closeDB();
    }
    await registry.close();
    localStorage.setItem(authKey, JSON.stringify(session));
  }, { owners, authKey: AUTH_STORAGE_KEY, session: sessionFor(owners[0]) });
  await page.unroute('**/__n49_fixture__');
}
async function mock(context, allowed, owner = A) {
  // Zero requests can escape to the real provider. /user is deterministic client evidence.
  await context.route('https://*.supabase.co/**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/v1/user') && allowed()) return route.fulfill({ json: { id: owner, email: 'n49@example.test' } });
    return route.abort('internetdisconnected');
  });
}
const status = (page) => page.evaluate(async () => (await import('/src/store.js')).getOfflineLeaseStatus());
const repaint = (page) => page.evaluate(async () => (await import('/src/app.js')).repaint());
const ready = (page) => expect.poll(() => page.evaluate(async () => (await import('/src/store.js')).state.ready)).toBe(true);
const snapshot = (page) => page.evaluate(async () => {
  const db = await import('/src/lib/db.js');
  return Object.fromEntries(await Promise.all(db.STORES.map(async (name) => [name, await db.getAll(name)])));
});

test('account Product: durable offline browser restart, 3/6 minute reminder/LIMITED, RTL reads/Backup/Export, renewal and tab/device isolation', async ({}, testInfo) => {
  const preview = await serve(true);
  const profile = await mkdtemp(path.join(os.tmpdir(), 'rakeez-n49-owned-profile-'));
  let context, secondDevice;
  let canVerify = true;
  const pageErrors = [];
  const launch = () => chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  try {
    context = await launch(); await mock(context, () => canVerify);
    let page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.clock.setFixedTime(START);
    await seed(page, preview.url);
    await page.goto(preview.url + '/'); await ready(page);
    await expect.poll(async () => (await status(page)).state).toBe('NORMAL');
    await expect(page.locator('[data-offline-lease]')).toHaveCount(0);
    const binding = await page.evaluate(async () => (await import('/src/store.js')).getActiveWorkspace());
    const leaseKey = 'rakeezx-offline-lease-v1:' + binding.id;
    const verifiedAt = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).verifiedAt, leaseKey);
    expect(verifiedAt).toBe(START);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const newModuleCached = await page.evaluate(async () => Boolean(await caches.match('/src/lib/offline-lease.js')));
    expect(newModuleCached).toBe(true);
    // Freeze cloud responses before any offline restart or age transition.
    canVerify = false;
    await page.clock.setFixedTime(START + 60000);
    await context.close(); context = null;
    // Complete Chromium process restart; only disk IndexedDB/localStorage/cache survive.
    context = await launch(); await mock(context, () => canVerify); await context.setOffline(true);
    page = await context.newPage(); page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.clock.setFixedTime(START + 60000);
    await page.goto(preview.url + '/'); await ready(page);
    expect((await status(page)).state).toBe('NORMAL');
    await page.goto(preview.url + '/#/teaching/teaching-' + A + '/grades');
    const grade = page.locator('input[data-change="score"]').first();
    await expect(grade).toBeVisible(); await grade.fill('6'); await grade.blur();
    await expect.poll(() => page.evaluate(async () => (await import('/src/lib/db.js')).getAll('scores').then((rows) => rows[0]?.value))).toBe(6);
    // Exact reminder boundary: 3 minutes still has no warning, then reminder only.
    await page.clock.setFixedTime(START + 180000); expect((await status(page)).state).toBe('NORMAL');
    await page.clock.setFixedTime(START + 180001); await repaint(page);
    await expect(page.locator('[data-offline-lease="REMINDER"]')).toBeVisible();
    expect((await status(page)).editable).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('reminder-desktop.png'), fullPage: true });
    await page.clock.setFixedTime(START + 359999);
    expect((await status(page)).state).toBe('REMINDER');
    expect((await status(page)).editable).toBe(true);
    await page.clock.setFixedTime(START + 360000); await repaint(page);
    await expect(page.locator('[data-offline-lease="LIMITED"]')).toBeVisible();
    const before = await snapshot(page);
    // Both cloud Restore entry points must stop before any provider request or write.
    expect(await page.evaluate(async () => {
      const cloud = await import('/src/lib/cloud.js');
      return Promise.all(['stageSyncV2Restore', 'stageScoreRestoreV2'].map(async (name) => {
        try { await cloud[name]({}); return 'unexpected-success'; }
        catch (error) { return error.code; }
      }));
    })).toEqual(['OFFLINE_LEASE_LIMITED', 'OFFLINE_LEASE_LIMITED']);
    expect(await snapshot(page)).toEqual(before);
    await grade.fill('9'); await grade.blur();
    await expect(page.locator('#toast')).toContainText('يلزم التحقق');
    expect(await snapshot(page)).toEqual(before);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'التحقق من الحساب', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('limited-mobile.png'), fullPage: true });
    // Actual Backup action and report CSV remain available in LIMITED offline.
    await page.goto(preview.url + '/#/settings/backup');
    const backupDownload = page.waitForEvent('download');
    await page.locator('[data-act="export"]').click();
    const downloaded = await backupDownload;
    const payload = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
    expect(payload.data.students.some((row) => row.name === 'طالب ألف')).toBe(true);
    expect(payload.data.device).toBeUndefined(); expect(payload.data.outbox).toBeUndefined();
    await page.goto(preview.url + '/#/reports/grades');
    await expect(page.locator('#main')).toContainText('طالب ألف');
    const csvDownload = page.waitForEvent('download'); await page.locator('[data-act="n70-csv"]').click();
    expect((await csvDownload).suggestedFilename()).toContain('.csv');
    await expect(page.locator('[data-offline-lease="LIMITED"]')).toBeVisible();
    const beforeRenewal = await snapshot(page);
    // A second tab sharing storage cannot bypass LIMITED by a fresh module.
    const staleTab = await context.newPage(); await staleTab.clock.setFixedTime(START + 360000);
    await staleTab.goto(preview.url + '/'); await ready(staleTab);
    expect((await status(staleTab)).editable).toBe(false);
    await staleTab.close();
    // Trusted renewal works while ordinary Sync still fails and outbox is rejected/pending.
    canVerify = true; await context.setOffline(false);
    await page.getByRole('button', { name: 'التحقق من الحساب', exact: true }).click();
    await expect.poll(async () => (await status(page)).state, { timeout: 20000 }).toBe('NORMAL');
    expect((await snapshot(page)).outbox.find((row) => row.id === 'prior-' + A)?.mutationId).toBe('keep-' + A);
    expect((await snapshot(page)).scores).toEqual(beforeRenewal.scores);
    // Device B has an independent account-capable Product DB and no A authority.
    secondDevice = await chromium.launch();
    const deviceContext = await secondDevice.newContext({ serviceWorkers: 'block' }); await mock(deviceContext, () => false, B);
    const devicePage = await deviceContext.newPage(); await devicePage.clock.setFixedTime(START + 360000);
    await seed(devicePage, preview.url, [B]); await devicePage.goto(preview.url + '/'); await ready(devicePage);
    expect((await status(devicePage)).editable).toBe(false);
    const receiptA = await page.evaluate((key) => localStorage.getItem(key), leaseKey);
    await devicePage.evaluate(async (receipt) => {
      const workspace = (await import('/src/store.js')).getActiveWorkspace();
      localStorage.setItem('rakeezx-offline-lease-v1:' + workspace.id, receipt);
    }, receiptA);
    expect((await status(devicePage)).editable).toBe(false);
    await devicePage.evaluate(async () => { await (await import('/src/store.js')).renameStudent('student-' + 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ممنوع').catch((error) => { window.n49Error = error.code; }); });
    expect(await devicePage.evaluate(() => window.n49Error)).toBe('OFFLINE_LEASE_LIMITED');
    // Corruption matrix hits the actual browser localStorage reader. Locally
    // recomputed checksums are fixtures, not server signatures or live trust.
    canVerify = false;
    const corruptStates = await page.evaluate(async (key) => {
      const store = await import('/src/store.js');
      const raw = localStorage.getItem(key), original = JSON.parse(raw);
      const sealed = (changes) => {
        const { checksum: ignored, ...body } = { ...original, ...changes };
        let hash = 2166136261;
        for (const char of JSON.stringify(body)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        return JSON.stringify({ ...body, checksum: (hash >>> 0).toString(16) });
      };
      const cases = [null, '{', raw.slice(0, -5), sealed({ version: 99 }), sealed({ verifiedAt: null }),
        sealed({ highWater: Infinity }), sealed({ binding: 'another-workspace' }),
        sealed({ verifiedAt: Date.now() + 86400000, highWater: Date.now() + 86400000, renewalId: 'future-conflicting' })];
      const results = [];
      for (const value of cases) {
        if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        results.push(store.getOfflineLeaseStatus().editable);
      }
      localStorage.setItem(key, raw);
      return results;
    }, leaseKey);
    expect(corruptStates).toEqual(Array(8).fill(false));
    // Persist a high-water observation, then restart the complete browser with
    // the wall clock clearly behind it. Ordinary restart cannot reset age.
    const beforeRollback = await snapshot(page);
    await page.clock.setFixedTime(START + 360000 + 86400000); await status(page);
    await context.close(); context = null;
    context = await launch(); await mock(context, () => canVerify); await context.setOffline(true);
    page = await context.newPage(); page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.clock.setFixedTime(START + 360000);
    await page.goto(preview.url + '/#/settings/backup'); await ready(page);
    expect((await status(page)).reason).toBe('clock-rollback');
    expect(await snapshot(page)).toEqual(beforeRollback);
    canVerify = true; await context.setOffline(false);
    await page.getByRole('button', { name: 'التحقق من الحساب', exact: true }).click();
    await expect.poll(async () => (await status(page)).state, { timeout: 20000 }).toBe('NORMAL');
    const priorData = (await snapshot(page)).students;
    await page.evaluate(async () => { await (await import('/src/lib/cloud.js')).signOut(); });
    expect((await status(page)).editable).toBe(false);
    expect((await snapshot(page)).students).toEqual(priorData);
    expect(pageErrors).toEqual([]);
  } finally {
    await secondDevice?.close(); await context?.close(); await preview.close();
    // Only the explicit mkdtemp-owned browser profile is removed.
    if (!profile.startsWith(path.join(os.tmpdir(), 'rakeez-n49-owned-profile-'))) throw new Error('Unexpected owned profile path');
    await rm(profile, { recursive: true, force: true });
  }
});

test('raw Production shell keeps 7/14 days despite query and persisted Preview preferences', async ({ browser }) => {
  const production = await serve(false); const context = await browser.newContext({ serviceWorkers: 'block' });
  let canVerify = true;
  try {
    await mock(context, () => canVerify);
    const page = await context.newPage(); await page.clock.setFixedTime(START);
    await seed(page, production.url, [A]);
    await page.evaluate(() => localStorage.setItem('n49-test-mode', 'true'));
    await page.goto(production.url + '/?n49TestMode=1'); await ready(page);
    await expect.poll(async () => (await status(page)).state).toBe('NORMAL');
    canVerify = false;
    await page.clock.setFixedTime(START + 360000);
    expect((await status(page)).state).toBe('NORMAL');
    await page.clock.setFixedTime(START + 7 * 86400000);
    expect((await status(page)).state).toBe('NORMAL');
    await page.clock.setFixedTime(START + 7 * 86400000 + 1);
    expect((await status(page)).state).toBe('REMINDER');
    await page.clock.setFixedTime(START + 14 * 86400000);
    expect((await status(page)).state).toBe('LIMITED');
    await page.reload(); await ready(page);
    expect((await status(page)).state).toBe('LIMITED');
  } finally { await context.close(); await production.close(); }
});
