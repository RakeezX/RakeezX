import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskId = 'continuous-n64-account-email-status-page-20261018';
const runId = '68be00d0-2ba9-4a83-9cea-8bdc30ee77ee';
const origin = 'http://127.0.0.1:19868';
const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19868, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const width of [390, 1280]) {
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
      const page = await context.newPage();
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      const boot = await bootSettings(page, { pending: true });
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await page.waitForTimeout(400);
      const owner = await page.evaluate(async () => {
        const store = await import('/src/store.js'), cloud = await import('/src/lib/cloud.js');
        if (store.getActiveWorkspace()?.authUserId !== cloud.user.id) throw Error('No actual owner-bound account entry');
        return cloud.user.id;
      });
      const requests = [];
      page.on('request', req => { if (req.url().startsWith(SUPABASE_URL)) requests.push({ method: req.method(), url: req.url() }); });
      let response = { id: owner, email: 'teacher@example.test', new_email: 'pending@example.test' };
      let failure = false, release = null, held = false;
      await page.route(`${SUPABASE_URL}/auth/v1/user`, async route => {
        if (held) await new Promise(resolve => { release = resolve; });
        await route.fulfill(failure ? { status: 500, json: { message: 'synthetic failure' } } : { json: response });
      });
      const open = async () => {
        await page.evaluate(() => { location.hash = '/settings/email-status'; });
        await expect(page.locator('[data-email-status]')).toBeVisible();
      };
      const leave = async () => {
        await page.locator('.email-status-page > a').click();
        await expect(page.locator('[data-settings-profile]')).toBeVisible();
        await page.waitForTimeout(150);
      };
      await page.locator('a[href="#/settings/email-status"]').click();
      await expect(page.locator('[data-status-pending]')).toContainText('pending@example.test');
      await expect(page.locator('[data-status-current]')).toHaveText('teacher@example.test');
      await expect(page.locator('[data-status-pending]')).toContainText('التأكيد الأول');
      await expect(page.locator('[data-status-completed]')).toHaveCount(0);
      assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.locator('.email-status-page').evaluate(el => getComputedStyle(el).maxWidth), '832px', 'Actual source stylesheet applied');
      await mkdir('tests/fixtures/n64-email-status', { recursive: true });
      await page.screenshot({ path: `tests/fixtures/n64-email-status/pending-${width}.png`, fullPage: true });
      // Returning reads server truth; repeated wake events share one request.
      response = { id: owner, email: 'pending@example.test' };
      const before = requests.filter(r => r.url.endsWith('/auth/v1/user')).length;
      await page.evaluate(() => { dispatchEvent(new Event('focus')); dispatchEvent(new Event('focus')); });
      await expect(page.locator('[data-status-completed]')).toBeVisible();
      assert.equal(requests.filter(r => r.url.endsWith('/auth/v1/user')).length - before, 1);
      await expect(page.locator('[data-status-guidance]')).toContainText('لم تتحقق هذه الصفحة');
      await page.screenshot({ path: `tests/fixtures/n64-email-status/completed-${width}.png`, fullPage: true });
      await page.reload();
      await expect(page.locator('[data-status-current]')).toHaveText('pending@example.test');
      await expect(page.locator('[data-status-completed]')).toHaveCount(0);
      await expect(page.locator('[data-status-pending]')).toHaveCount(0);
      await expect(page.locator('[data-email-status]')).toContainText('المعتمد حاليًا');
      // Failure and actual cloud ownership guard: neither may display cached email.
      await leave(); failure = true; await open();
      await expect(page.locator('[data-status-message]')).toContainText('تعذر التحقق');
      await expect(page.locator('[data-status-current]')).toHaveCount(0);
      failure = false; await leave();
      response = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'other@example.test' };
      await open();
      await expect(page.locator('[data-status-message]')).toContainText('تعذر التحقق');
      await expect(page.locator('[data-status-current]')).toHaveCount(0);
      assert.equal((await page.locator('[data-email-status]').innerText()).includes('other@example.test'), false);
      response = { id: owner, email: 'pending@example.test' };
      await leave(); held = true; await open();
      await expect(page.locator('[data-status-current]')).toHaveCount(0);
      await expect.poll(() => Boolean(release)).toBe(true);
      // Late verified response cannot render into a route already unmounted.
      await page.locator('.email-status-page > a').click();
      await expect(page.locator('[data-settings-profile]')).toBeVisible();
      held = false; release(); release = null;
      await page.waitForTimeout(250);
      await expect(page.locator('[data-email-status]')).toHaveCount(0);
      await open();
      await expect(page.locator('[data-status-current]')).toHaveText('pending@example.test');
      held = true;
      await page.evaluate(() => dispatchEvent(new Event('focus')));
      await expect.poll(() => Boolean(release)).toBe(true);
      // Exercise session/owner invalidation with the existing synthetic Auth hook.
      const neutral = await page.evaluate(async () => {
        const cloud = await import('/src/lib/cloud.js');
        cloud.setMockAuth({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'other@example.test' }, { access_token: 'different-synthetic-session' });
        const view = (await import('/src/views/email-status.js')).default;
        const wrongOwner = String(view.render());
        dispatchEvent(new StorageEvent('storage', { key: cloud.AUTH_STORAGE_KEY }));
        const cleared = !document.querySelector('[data-status-current]');
        cloud.setMockAuth(null, null);
        return { wrongOwner, noSession: String(view.render()), cleared };
      });
      assert.ok(!neutral.wrongOwner.includes('pending@example.test'));
      assert.ok(!neutral.noSession.includes('pending@example.test'));
      assert.ok(neutral.noSession.includes('لا توجد جلسة'));
      assert.ok(neutral.cleared);
      held = false; release(); release = null;
      await page.waitForTimeout(200);
      await expect(page.locator('[data-status-current]')).toHaveCount(0);
      assert.equal(await page.evaluate(async () => (await import('/src/lib/cloud.js')).user), null, 'Late old-session response cannot restore identity');
      assert.deepEqual(requests.filter(r => r.url.includes('/auth/v1/') && (r.method !== 'GET' || !r.url.endsWith('/auth/v1/user'))), []);
      const existingReadRpcs = ['account_contract', 'owner_sync_change_marker', 'score_foundation_capability', 'n71_restore_capability'];
      assert.deepEqual(requests.filter(r => r.method !== 'GET' && !(r.method === 'POST' && existingReadRpcs.some(name => r.url.endsWith('/rpc/' + name)))), [], 'No mutation endpoints; existing app read RPCs are POST transports');
      assert.deepEqual(boot.errors.filter(message => message !== 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)'), []);
      results.push({ width, actualAccountEntry: true, pending: true, completedOnFreshMatchingRead: true, returnDeduplicated: true, reloadCurrentWithoutFalseSuccess: true, errorNeutral: true, wrongOwnerGuard: true, lateUnmount: true, sessionSwitchCleared: true, lateSessionResponseIgnored: true, noSessionNeutral: true, readonlyAuthRequests: requests.filter(r => r.url.includes('/auth/v1/')).length });
      await context.close();
    }
  });
} finally { await server.close(); }
const sources = ['src/views/email-status.js', 'src/router.js', 'src/views/settings.js', 'src/styles/settings.css', 'sw.js', 'src/lib/cloud.js', 'src/lib/settings-profile-ui.js', 'tests/n64-confirmed-email-state.test.mjs', 'tests/n64-confirmed-email-evidence.json'];
const hashes = {};
for (const file of sources) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const reusedLiveness = JSON.parse(await readFile('tests/n64-bounded-verification-evidence.json', 'utf8'));
const priorCloudHashMatches = hashes['src/lib/cloud.js'] === reusedLiveness.sourceSha256['src/lib/cloud.js'];
const sw = await readFile('sw.js', 'utf8');
assert.ok(sw.includes("'./src/views/email-status.js'"));
for (const dependency of ['dom', 'cloud', 'settings-profile-ui']) assert.ok(sw.includes(`'./src/lib/${dependency}.js'`));
for (const dependency of ['store', 'repaint']) assert.ok(sw.includes(`'./src/${dependency}.js'`));
assert.ok(sw.includes("'./src/styles/settings.css'"));
assert.ok((await readFile('src/views/email-status.js', 'utf8')).includes('href="./src/styles/settings.css"'));
await writeFile('tests/n64-email-status-evidence.json', JSON.stringify({ taskId, runId, scope: 'Actual app account/store, DOM, handlers and source CSS; synthetic HTTP only; no live certification', results, offlineImports: true, hashes, priorCloudHashMatches, priorRecordedCloudHash: reusedLiveness.sourceSha256['src/lib/cloud.js'], ownedBrowserAndServerClosed: true }, null, 2) + '\n');
console.log(JSON.stringify(results));
