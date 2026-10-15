import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const origin = 'http://127.0.0.1:19865';
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n64-verified-email-result-stable-layout-20261015.json';
const runId = 'b6290522-31b4-47ea-acf1-b52faf3d095b';
const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19865, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const width of [1280, 390]) {
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
      const page = await context.newPage();
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      const mutations = [];
      page.on('request', req => { if (req.url().includes('/auth/v1/') && req.method() !== 'GET') mutations.push(req.method() + ' ' + req.url()); });
      const evidence = await bootSettings(page, { pending: true });
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(async () => {
        const store = await import('/src/store.js');
        const cloud = await import('/src/lib/cloud.js');
        return store.getActiveWorkspace().type === 'account' && store.getActiveWorkspace().authUserId === cloud.user.id;
      }), true, 'Real owner-bound app/store entry');
      const topOf = selector => page.evaluate(selector => { const el = document.querySelector(selector); if (!el?.isConnected) throw Error('No current layout node'); return el.getBoundingClientRect().top + scrollY; }, selector);
      const accessTop = () => topOf('.settings-access-summary');
      await page.evaluate(() => { window.__n64Trace = []; document.addEventListener('toggle', e => { if (e.target.matches('[data-settings-profile]')) window.__n64Trace.push({open:e.target.open, connected:e.target.isConnected, time:performance.now()}); }, true); });
      const initialTop = await accessTop();
      const ownerId = await page.evaluate(async () => (await import('/src/lib/cloud.js')).user.id);
      const input = page.locator('[name="teacherName"]');
      await input.focus();
      await input.evaluate(el => el.setSelectionRange(2, 4));
      // Delayed contract, null-to-ready contract, and actual Auth GET old -> new.
      await page.route(`${SUPABASE_URL}/auth/v1/user`, async route => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return route.fulfill({ json: { id: ownerId, email: 'pending@example.test' } });
      });
      await page.evaluate(async () => {
        (await import('/src/lib/account-profile.js')).clearAccountContract();
        (await import('/src/repaint.js')).repaint();
        (await import('/src/views/settings.js')).default.onMount();
      });
      await expect(page.locator('[data-email-change-completed]')).toHaveText('تم اعتماد البريد الإلكتروني الجديد.');
      await expect(page.locator('[data-account-email]')).toHaveText('pending@example.test');
      await expect(page.locator('[data-email-change-pending]')).toHaveCount(0);
      await expect(input).toBeFocused();
      assert.deepEqual(await input.evaluate(el => [el.selectionStart, el.selectionEnd]), [2, 4]);
      const completionShift = (await accessTop()) - initialTop;
      console.log(JSON.stringify({width, initialTop, completionShift, trace: await page.evaluate(() => window.__n64Trace), open: await page.locator('[data-settings-profile]').evaluate(el => el.open)}));
      assert.equal(await accessTop(), initialTop, 'Access stays in place across pending-to-complete and null-to-ready');
      // Immediate user toggle + paint in one task catches the queued toggle race.
      await page.evaluate(async () => {
        document.querySelector('[data-settings-profile]').open = false;
        (await import('/src/repaint.js')).repaint();
      });
      await expect(page.locator('[data-settings-profile]')).not.toHaveAttribute('open');
      const collapsedTop = await topOf('.settings-section--experience');
      for (let i = 0; i < 4; i++) {
        await page.evaluate(async () => (await import('/src/repaint.js')).repaint());
        await page.waitForTimeout(60);
        await expect(page.locator('[data-settings-profile]')).not.toHaveAttribute('open');
        assert.equal(await topOf('.settings-section--experience'), collapsedTop);
      }
      await page.locator('[data-settings-profile] > summary').click();
      await expect(page.locator('[data-email-change-completed]')).toBeVisible();
      await page.reload();
      await expect(page.locator('[data-settings-profile]')).toBeVisible();
      await expect(page.locator('[data-account-email]')).toHaveText('pending@example.test');
      await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
      await expect(page.locator('[data-email-change-pending]')).toHaveCount(0);
      await expect(page.locator('[data-email-change-feedback]')).toContainText('بريد حسابك الحالي');
      assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(mutations, []);
      assert.deepEqual(evidence.errors, []);
      results.push({ width, pending: true, verifiedCompletion: true, stalePendingCleared: true, accessShift: completionShift, focusAndSelection: true, immediateToggleRace: true, reloadNeutral: true, authMutations: mutations });
      await context.close();
    }
  });
} finally { await server.close(); }
await writeFile('tests/n64-confirmed-email-evidence.json', JSON.stringify({ taskId: taskFile.split('/').at(-1).replace('.json', ''), runId, scope: 'Actual app DOM/handlers/CSS; loopback synthetic owner only; no live service certification', results, ownedBrowserAndServerClosed: true }, null, 2) + '\n');
console.log(JSON.stringify(results));
