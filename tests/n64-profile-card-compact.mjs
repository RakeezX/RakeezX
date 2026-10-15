import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootDemoSettings, bootSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { writeFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:19873';
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n64-email-hints-only-pending-compact-profile-20261015.json';
const runId = 'ea1d4c5d-b0d0-40b3-954f-aaafcd6a0616';
const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19873, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const colorScheme of ['light', 'dark']) {
      const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', colorScheme });
      const page = await context.newPage();
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      const { errors } = await bootSettings(page);
      await expect(page.locator('[data-email-change-feedback]')).toHaveCount(0);
      await expect(page.locator('[data-email-change-instructions]')).toHaveCount(0);
      await expect(page.locator('[data-act="change-email"]')).toHaveText('تعديل');
      await expect(page.locator('[data-account-email]')).toHaveText('teacher@example.test');
      await expect(page.locator('[data-act="teacher-setup-import"]')).toBeVisible();
      await expect(page.locator('.n44-settings-link')).toHaveAttribute('href', '#/settings/notifications');

      const profile = page.locator('[data-settings-profile]');
      const summary = profile.locator(':scope > summary');
      await profile.evaluate(el => { el.open = false; });
      const widths = [];
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const metrics = await summary.evaluate(el => ({ height: el.getBoundingClientRect().height, contentWidth: el.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        assert.ok(metrics.height <= 90, `${colorScheme} ${width}px summary height ${metrics.height}px`);
        assert.equal(metrics.overflow, false, `${colorScheme} ${width}px horizontal overflow`);
        widths.push({ viewportWidth: width, ...metrics });
      }
      await page.evaluate(async () => {
        const store = await import('/src/store.js');
        store.patchProfile({ teacherName: 'معلمة ذات اسم عربي طويل جداً يتجاوز المساحة المخصصة لعنوان بطاقة البيانات في الهاتف' });
        (await import('/src/repaint.js')).repaint();
      });
      await page.setViewportSize({ width: 320, height: 844 });
      await profile.evaluate(el => { el.open = true; });
      const name = profile.locator('.row__sub');
      await expect(name).toHaveAttribute('title', /اسم عربي طويل/);
      const nameLayout = await name.evaluate(el => ({ whiteSpace: getComputedStyle(el).whiteSpace, overflow: getComputedStyle(el).overflow, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
      assert.equal(nameLayout.whiteSpace, 'nowrap');
      assert.ok(nameLayout.scrollWidth > nameLayout.clientWidth, 'Long Arabic name is clipped within its one-line summary slot');
      await summary.focus();
      assert.equal(await summary.evaluate(el => el === document.activeElement), true, 'Profile disclosure remains keyboard focusable');
      assert.deepEqual(errors, []);
      results.push({ colorScheme, widths, longArabicNameEllipsis: true, keyboardFocus: true, ordinaryEmailHintsHidden: true, n44NotificationsLinkPreserved: true, n36ImportEntryVisible: true });
      await context.close();
    }
    const context = await createContext({ viewport: { width: 320, height: 700 }, locale: 'ar-SA' });
    const page = await context.newPage();
    const goto = page.goto.bind(page);
    page.goto = (url, options) => goto(new URL(url, origin).href, options);
    await bootSettings(page, { pending: true });
    await expect(page.locator('[data-email-change-pending]')).toBeVisible();
    await expect(page.locator('[data-email-change-instructions]')).toBeAttached();
    await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
    const ownerId = await page.evaluate(async () => (await import('/src/lib/cloud.js')).user.id);
    await page.route(`${SUPABASE_URL}/auth/v1/user`, route => route.fulfill({ json: { id: ownerId, email: 'pending@example.test' } }));
    await page.evaluate(async id => (await import('/src/lib/cloud.js')).verifyCurrentAuthIdentity(id), ownerId);
    await expect(page.locator('[data-email-change-completed]')).toBeVisible();
    await expect(page.locator('[data-email-change-instructions]')).toHaveCount(0);
    await context.close();

    const emptyContext = await createContext({ viewport: { width: 320, height: 700 }, locale: 'ar-SA' });
    const emptyPage = await emptyContext.newPage();
    const emptyGoto = emptyPage.goto.bind(emptyPage);
    emptyPage.goto = (url, options) => emptyGoto(new URL(url, origin).href, options);
    await bootDemoSettings(emptyPage);
    await expect(emptyPage.locator('[data-settings-profile] .row__sub')).toHaveText('معلم التجربة');
    await expect(emptyPage.locator('[data-email-change-feedback]')).toHaveCount(0);
    await emptyContext.close();
  });
} finally { await server.close(); }
const evidence = { scope: 'Actual app DOM, handlers and CSS in isolated synthetic loopback contexts', results, pendingOnlyGuidance: true, verifiedSameOwnerCompletion: true, n36ImportEntryVisible: true, emptyAccountFixture: true, ownedServerClosed: true };
await writeFile('tests/n64-profile-card-compact.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
