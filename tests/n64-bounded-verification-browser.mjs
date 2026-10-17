import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskId = 'continuous-n64-bounded-settings-verification-20261017';
const runId = '7e124420-8ef8-46c6-8252-3d77157380ea';
const taskFile = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const origin = 'http://127.0.0.1:19964';
const dialogOnly = process.argv.includes('--dialog-only');
const results = dialogOnly ? JSON.parse(await readFile('tests/n64-bounded-verification-evidence.json', 'utf8')).results.filter(row => !row.width) : [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19964, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const width of [1280, 320]) {
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
      const page = await context.newPage();
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      // Counters only: execute the real application, including real subscribers.
      for (const [file, needle, counter] of [
        ['src/app.js', 'function paint() {', '__paints'],
        ['src/lib/sync.js', 'function scheduleAutomaticSync({ full = false, immediate = false, remote = false } = {}) {', '__syncSchedules'],
      ]) {
        const source = await readFile(file, 'utf8');
        assert.ok(source.includes(needle));
        await page.route(`**/${file}`, route => route.fulfill({ contentType: 'text/javascript', body: source.replace(needle, `${needle} window.${counter} = (window.${counter} || 0) + 1;`) }));
      }
      const evidence = await bootSettings(page, { pending: true });
      await page.waitForTimeout(800);
      await page.evaluate(async () => {
        window.cloud = await import('/src/lib/cloud.js');
        window.settings = (await import('/src/views/settings.js')).default;
        window.__authWrites = 0;
        const originalSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === cloud.AUTH_STORAGE_KEY) window.__authWrites++;
          return originalSet.call(this, key, value);
        };
        window.__notifications = 0;
        cloud.subscribe(() => window.__notifications++);
        window.__originalFetch = window.fetch;
        window.__getCount = 0;
        window.fetch = (url, options) => {
          if (String(url).endsWith('/auth/v1/user') && options?.method === 'GET') window.__getCount++;
          return __originalFetch(url, options);
        };
      });
      const unchanged = await page.evaluate(async () => {
        const schedules = __syncSchedules, paints = __paints;
        for (let i = 0; i < 5; i++) {
          await Promise.all(Array.from({ length: 8 }, () => cloud.verifyCurrentAuthIdentity(cloud.user.id)));
          window.dispatchEvent(new Event('focus'));
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        return { requests: __getCount, notifications: __notifications, storageWrites: __authWrites, schedules: __syncSchedules - schedules, paints: __paints - paints };
      });
      assert.deepEqual(unchanged, { requests: 5, notifications: 0, storageWrites: 0, schedules: 0, paints: 0 });
      // Reordered nested JSON is equal; an actual user change notifies once.
      const changed = await page.evaluate(async () => {
        const owner = cloud.user.id;
        const payload = { new_email: cloud.user.new_email, email: cloud.user.email, id: owner, user_metadata: { b: 2, a: 1 } };
        window.fetch = async (url, options) => String(url).endsWith('/auth/v1/user') ? Response.json(payload) : __originalFetch(url, options);
        await cloud.verifyCurrentAuthIdentity(owner);
        const afterChange = __notifications;
        payload.user_metadata = { a: 1, b: 2 };
        await cloud.verifyCurrentAuthIdentity(owner);
        return { afterChange, afterEquivalent: __notifications };
      });
      assert.deepEqual(changed, { afterChange: 1, afterEquivalent: 1 });
      await page.waitForTimeout(500);
      // Existing send failure/retry and successful pending guidance in actual sheet.
      await page.evaluate(() => {
        window.__puts = 0;
        window.fetch = async (url, options) => {
          if (String(url).endsWith('/auth/v1/user')) {
            if (options.method === 'PUT') {
              if (++window.__puts === 1) throw new TypeError('Synthetic network unavailable');
              return Response.json({ ...cloud.user, new_email: 'next@example.test' });
            }
            return Response.json(cloud.user);
          }
          return __originalFetch(url, options);
        };
      });
      await page.locator('[data-act="change-email"]').click();
      await page.locator('[name="newEmail"]').fill('next@example.test');
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.locator('button[form="email-change-form"]')).toHaveText('إعادة المحاولة');
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('[data-email-change-sending]')).toContainText('التأكيدان');
      await expect(page.locator('button[form="email-change-form"]')).toHaveCount(0);
      await expect(page.locator('.sheet__foot [data-sheet-close]')).toBeFocused();
      await page.evaluate(async () => { (await import('/src/repaint.js')).repaint(); });
      await expect(page.locator('.sheet__foot [data-sheet-close]')).toBeFocused();
      await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
      await mkdir('tests/fixtures/n64-bounded-verification', { recursive: true });
      await page.screenshot({ path: `tests/fixtures/n64-bounded-verification/sent-${width}.png` });
      await page.locator('.sheet__foot [data-sheet-close]').click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.evaluate(async () => { await cloud.verifyCurrentAuthIdentity(cloud.user.id); settings.onMount(); });
      await page.waitForTimeout(200);
      await expect(page.locator('[data-email-change-completed]')).toHaveCount(0); // first confirmation still old email
      await page.evaluate(async () => {
        window.fetch = async (url, options) => String(url).endsWith('/auth/v1/user')
          ? Response.json({ ...cloud.user, email: 'next@example.test', new_email: '' }) : __originalFetch(url, options);
        // Actual settings entry performs its fresh same-owner server read.
        settings.onUnmount(); settings.onMount();
      });
      await expect(page.locator('[data-email-change-completed]')).toBeVisible();
      await expect(page.locator('[data-account-email]')).toHaveText('next@example.test');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.evaluate(async () => {
        const store = await import('/src/store.js');
        return store.getActiveWorkspace().type === 'account' && store.getActiveWorkspace().authUserId === cloud.user.id;
      }), true);
      if (width === 1280 && !dialogOnly) {
        // Real 12-second deadline, no shortened test timeout. Fetch ignores abort
        // deliberately, so the late-response mutation guard is exercised too.
        await page.evaluate(() => {
          window.__priorSession = JSON.stringify(cloud.session);
          window.__late = null;
          window.fetch = (url, options) => String(url).endsWith('/auth/v1/user')
            ? new Promise(resolve => { window.__late = () => resolve(Response.json({ ...cloud.user, email: 'late@example.test' })); window.__signal = options.signal; })
            : __originalFetch(url, options);
          settings.onUnmount(); settings.onMount();
        });
        await page.locator('[data-act="about-rakeez"]').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-act="retry-email-verification"]')).toBeVisible({ timeout: 15000 });
        assert.equal(await page.evaluate(() => __signal.aborted && JSON.stringify(cloud.session) === __priorSession), true);
        await page.evaluate(async () => { __late(); await new Promise(resolve => setTimeout(resolve, 50)); });
        assert.equal(await page.evaluate(() => JSON.stringify(cloud.session) === __priorSession), true);
        await page.evaluate(() => { window.fetch = async (url, options) => String(url).endsWith('/auth/v1/user') ? Response.json(cloud.user) : __originalFetch(url, options); });
        await page.locator('[data-act="retry-email-verification"]').click();
        await expect(page.locator('[data-act="retry-email-verification"]')).toHaveCount(0);
        assert.equal(await page.evaluate(() => Boolean(window.cloud && window.settings)), true, 'Retry must not submit the profile form or navigate');
        results.push({ userTimeout: '12s; aborted; late result ignored; UI retry succeeds' });

        // Stop only this view subscription before the isolated refresh scenario.
        await page.evaluate(() => { settings.onUnmount(); });
        const refreshPromise = page.evaluate(async () => {
          const owner = cloud.user.id;
          const expired = { ...cloud.session, expires_at: 1 };
          cloud.setMockAuth(expired.user, expired);
          localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(expired));
          let calls = 0, late, signal;
          window.fetch = (url, options) => {
            if (String(url).includes('grant_type=refresh_token')) {
              calls++; signal = options.signal;
              return new Promise(resolve => { late = () => resolve(Response.json({ ...expired, access_token: 'late-token', expires_at: 4102444800 })); });
            }
            return __originalFetch(url, options);
          };
          const started = performance.now();
          const settled = await Promise.allSettled([cloud.verifyCurrentAuthIdentity(owner), cloud.refreshSession(), cloud.refreshSession()]);
          const elapsed = performance.now() - started;
          late(); await new Promise(resolve => setTimeout(resolve, 50));
          const unchanged = JSON.stringify(cloud.session) === JSON.stringify(expired);
          window.fetch = async (url, options) => String(url).includes('grant_type=refresh_token')
            ? Response.json({ ...expired, access_token: 'retried-token', expires_at: 4102444800 })
            : String(url).endsWith('/auth/v1/user') ? Response.json(expired.user) : __originalFetch(url, options);
          await cloud.verifyCurrentAuthIdentity(owner);
          return { calls, codes: settled.map(x => x.reason?.code), elapsed, aborted: signal.aborted, unchanged, retryToken: cloud.session.access_token };
        });
        await page.waitForTimeout(100);
        await page.locator('[data-act="about-rakeez"]').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        const refresh = await refreshPromise;
        assert.equal(refresh.calls, 1);
        assert.deepEqual(refresh.codes, ['AUTH_TIMEOUT', 'AUTH_TIMEOUT', 'AUTH_TIMEOUT']);
        assert.ok(refresh.elapsed >= 11900 && refresh.elapsed < 14500);
        assert.equal(refresh.aborted && refresh.unchanged, true);
        assert.equal(refresh.retryToken, 'retried-token');
        results.push({ refresh });
      }
      assert.deepEqual(evidence.errors, []);
      results.push({ width, unchanged, changed, dialogRetryPendingCloseFocus: true, freshSameOwnerCompletionOnly: true, accountStoreOwner: true, noHorizontalOverflow: true });
      await context.close();
    }
  });
} finally { await server.close(); }
await writeFile('tests/n64-bounded-verification-evidence.json', JSON.stringify({ taskId, runId, scope: 'Actual app DOM/handlers/CSS, isolated loopback synthetic fetch only; no live certification', fixtureLimitations: ['Service Workers/external requests blocked. Existing synthetic helper returns incomplete Sync read fixtures; baseline automatic Sync warnings are expected, not a whole-Sync PASS. Measured unchanged-event scheduling delta is zero.'], reusedUnchangedCloudTimeoutEvidence: dialogOnly, preservedInitialFailures: ['Rendered screenshot showed .btn CSS overriding hidden after success; corrected by removing the completed submit control.', 'Browser first and second runs: retry button defaulted to form submit and navigated the document, losing test bindings. Actual implementation defect fixed with explicit type=button; same-document retry now asserted.', 'Unit initial fixtures: fresh session did not wait on refresh; follow-up refreshed fixture remained expired and hung until owned test process was stopped. Corrected expired-before/fresh-after fixture.'], results, ownedBrowserAndServerClosed: true }, null, 2) + '\n');
console.log(JSON.stringify(results));
