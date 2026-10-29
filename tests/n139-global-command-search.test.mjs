// AI N139: bounded catalog, real runtime owner guard and actual HTTP app smoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMMAND_PAGES, COMMAND_SERVICES, commandSearchScope, commandSearchResults } from '../src/lib/global-command-search.js';
import { match } from '../src/router.js';
import { createSyncOwnershipGuard } from '../src/lib/sync-ownership.js';

function fixture() {
  const workspace = { id: 'account:a', type: 'account', authUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', databaseName: 'synthetic-a', ownershipState: 'claimed', syncEligible: true };
  const sections = [{ id: 'five2', grade: 5, label: '2', yearId: 'year' }, { id: 'five3', grade: 5, label: '3', yearId: 'year' }];
  const subjects = [{ id: 'science', name: 'العلوم' }, { id: 'arabic', name: 'العربية' }];
  const teachings = [{ id: 'five2:science', sectionId: 'five2', subjectId: 'science', termId: 'term' }, { id: 'five3:science', sectionId: 'five3', subjectId: 'science', termId: 'term' }];
  const students = [{ id: 'durable:a', name: 'محمد أحمد عبدالله', status: 'active', enrollmentId: 'en:a' },
    { id: 'durable:b', name: 'محمد أحمد عبدالله', status: 'active', enrollmentId: 'en:b' },
    { id: 'former', name: 'محمد أحمد سابق', status: 'former', enrollmentId: 'en:former' },
    { id: 'foreign', name: 'محمد أحمد مالك آخر', status: 'active', ownerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', enrollmentId: 'en:foreign' }];
  const enrollments = students.map(student => ({ id: student.enrollmentId, studentId: student.id, sectionId: 'five2', status: 'active' }));
  const source = { state: { ready: true }, getActiveWorkspace: () => workspace,
    teachings: () => teachings, students: id => id === 'five2:science' ? students : [],
    getTeaching: id => teachings.find(row => row.id === id), getSection: id => sections.find(row => row.id === id),
    getSubject: id => subjects.find(row => row.id === id), sectionLabel: row => `الخامس / ${row.label}`,
    activeYear: () => ({ id: 'year' }), activeTerm: () => ({ id: 'term', yearId: 'year' }),
    enrollmentsOf: id => enrollments.filter(row => row.studentId === id) };
  const identity = { session: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, authStatus: () => ({ state: 'authenticated' }), AUTH_STORAGE_KEY: 'auth' };
  const guard = createSyncOwnershipGuard(); guard.setWorkspace(workspace);
  const storage = { getItem: () => JSON.stringify({ access_token: 'synthetic', user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }) };
  const scope = () => commandSearchScope(source, identity, guard, workspace.databaseName, storage);
  return { source, workspace, identity, storage, guard, scope, teachings, sections, students, enrollments };
}

test('explicit whitelist uses existing router pages and exact class/service context', () => {
  for (const [, , path] of COMMAND_PAGES) assert.ok(match(path), path);
  for (const [, , suffix] of COMMAND_SERVICES) assert.ok(match(`/teaching/synthetic/${suffix}`), suffix);
  const f = fixture(), find = query => commandSearchResults(query, f.source, f.scope());
  assert.deepEqual(find('حضور خامس ٢').map(row => row.href), ['#/teaching/five2:science/attendance']);
  assert.deepEqual(find('حضور خامس'), []); // two sections, never guess
  assert.deepEqual(find('حضور خامس 20'), []); // numeric labels are exact
  assert.deepEqual(find('حضور سادس 2'), []);
  f.teachings.push({ id: 'five2:arabic', sectionId: 'five2', subjectId: 'arabic', termId: 'term' });
  assert.deepEqual(find('حضور خامس 2'), []); // two subjects, ask for a material
  assert.deepEqual(find('حضور خامس 2 العلوم').map(row => row.href), ['#/teaching/five2:science/attendance']);
  for (const query of ['', 'درجات', 'رصد', 'توزيع', 'تقارير', 'خامس', 'محمد']) {
    for (const row of find(query)) assert.ok(match(row.href.slice(1)), row.href);
  }
});

test('real ownership guard and active student helper reject stale/foreign/unready context', () => {
  const f = fixture(), find = query => commandSearchResults(query, f.source, f.scope());
  assert.ok(f.scope());
  assert.deepEqual(find('مح اح عب').map(row => row.href), ['#/student/durable%3Aa?teaching=five2%3Ascience', '#/student/durable%3Ab?teaching=five2%3Ascience']);
  f.enrollments[0].ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(find('محمد').filter(row => row.group === 'الطلاب النشطون').length, 1);
  f.sections[0].ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; assert.deepEqual(find('محمد'), []);
  delete f.sections[0].ownerId;
  f.teachings[0].termId = 'past'; assert.deepEqual(find('محمد'), []);
  f.teachings[0].termId = 'term';
  f.source.activeTerm = () => ({ id: 'term', yearId: 'year', status: 'closed' }); assert.deepEqual(find('محمد'), []);
  f.source.activeTerm = () => ({ id: 'term', yearId: 'year' });
  f.identity.user = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }; assert.deepEqual(find('محمد'), []);
  f.identity.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  f.guard.setWorkspace({ ...f.workspace, databaseName: 'another' }); assert.equal(f.scope(), null);
  f.guard.setWorkspace(f.workspace);
  assert.equal(commandSearchScope(f.source, f.identity, f.guard, 'wrong-db', f.storage), null);
  f.storage.getItem = () => JSON.stringify({ access_token: 'synthetic', user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } }); assert.equal(f.scope(), null);
  f.source.state.ready = false; assert.deepEqual(find('محمد'), []);
});

test('actual application HTTP DOM, keyboard/mobile and offline reopen', { skip: process.env.N139_BROWSER !== '1', timeout: 120000 }, async () => {
  // The invoking worker must hold the browser phase lease: this smoke includes SW.
  const { chromium, expect } = await import('@playwright/test');
  const { makeIsolatedDemoContext, openReadyServedDemo } = await import('./helpers/served-demo-readiness.mjs');
  const { createServer } = await import('node:http');
  const path = await import('node:path');
  const root = process.cwd();
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      const content = await readFile(file);
      const type = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5139, '127.0.0.1', resolve); });
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await makeIsolatedDemoContext(browser, { width: 1440 });
    const page = await context.newPage(), base = 'http://127.0.0.1:5139';
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Synthetic app error:', error.message); });
    await openReadyServedDemo(page, base, { timeout: 15000 });
    const action = page.locator('[data-command-search]'), query = page.locator('[data-command-query]');
    await action.focus(); await page.keyboard.press('Control+k'); await expect(query).toBeFocused();
    await query.fill('حضور خامس ٢');
    await expect(page.locator('.command-search-result')).toHaveCount(1);
    const href = await page.locator('.command-search-result').getAttribute('href');
    assert.match(href, /\/attendance$/);
    await query.press('Tab'); await expect(page.locator('.command-search-result')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page).toHaveURL(base + '/' + href);
    await expect(query).toHaveCount(0); await expect(action).toBeVisible();
    await action.focus(); await page.keyboard.press('Meta+k'); await expect(query).toBeFocused();
    await page.keyboard.press('Escape'); await expect(action).toBeFocused();
    // Existing modal owns its shortcut; do not consume it or stack search.
    await page.evaluate(async () => { (await import('/src/lib/dom.js')).openSheet({ title: 'نافذة اختبار اصطناعية' }); });
    await page.keyboard.press('Control+k'); await expect(query).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.evaluate(async () => { (await import('/src/lib/global-command-search.js')).installCommandSearch(); });
    for (const route of ['/reports', '/settings', '/schedule', '/archive', '/classes']) {
      await page.goto(base + '/#' + route); await expect(action).toBeVisible();
      assert.equal(await action.count(), 1);
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await action.click(); await expect(query).toBeFocused(); await query.fill('محمد');
    assert.ok(await page.locator('.command-search-result').count() > 0);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      sheet: document.querySelector('.sheet').scrollWidth > document.querySelector('.sheet').clientWidth + 1,
      targets: [...document.querySelectorAll('.command-search-result')].every(el => el.getBoundingClientRect().height >= 44),
    }));
    assert.deepEqual(geometry, { overflow: false, sheet: false, targets: true });
    await page.keyboard.press('Escape'); await expect(action).toBeFocused();
    await action.click(); await page.locator('.sheet-backdrop').click({ position: { x: 1, y: 1 } }); await expect(query).toHaveCount(0);
    // Actual UI entry with actual store + runtime ownership guard. All data remains synthetic.
    await page.evaluate(async () => {
      const store = await import('/src/store.js'), cloud = await import('/src/lib/cloud.js');
      const workspace = store.getActiveWorkspace();
      store.activateWorkspace({ ...workspace, id: 'account:synthetic-n139', type: 'account', ownershipState: 'claimed', authUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', syncEligible: true });
      cloud.setMockAuth({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
      localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'synthetic-local-only', user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }));
    });
    await action.click(); await query.fill('محمد'); assert.ok(await page.locator('.command-search-result').count() > 0);
    await page.evaluate(async () => {
      const cloud = await import('/src/lib/cloud.js');
      cloud.setMockAuth(null, null);
      localStorage.removeItem(cloud.AUTH_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: cloud.AUTH_STORAGE_KEY }));
    });
    await expect(query).toHaveCount(0); await page.keyboard.press('Control+k'); await expect(query).toHaveCount(0);
    await context.close();
    // A separate fresh context permits only the local app and SW for this leased phase.
    const offline = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 320, height: 844 } });
    await offline.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await offline.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const reopened = await offline.newPage(); reopened.on('pageerror', error => errors.push(error.message));
    await openReadyServedDemo(reopened, base);
    await reopened.evaluate(() => navigator.serviceWorker.ready);
    await reopened.waitForFunction(async () => !!navigator.serviceWorker.controller && !!(await (await caches.open('rakeezx-v97')).match('/src/lib/global-command-search.js')));
    await offline.setOffline(true);
    await reopened.reload(); await expect(reopened.locator('[data-command-search]')).toBeVisible();
    await reopened.locator('[data-command-search]').click(); await reopened.locator('[data-command-query]').fill('حضور خامس 2');
    await expect(reopened.locator('.command-search-result')).toHaveCount(1);
    await reopened.locator('.command-search-result').click(); await expect(reopened.locator('.topbar')).toBeVisible();
    assert.equal(await reopened.locator('[data-command-search]').count(), 1);
    await offline.close(); assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
