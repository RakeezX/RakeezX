import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskId = 'continuous-n64-inline-email-change-guidance-20261018';
const runId = 'da509851-6aa9-431c-8f46-2765a12bc2d5';
const origin = 'http://127.0.0.1:21864';
const taskFile = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
await mkdir('tests/fixtures/n64-inline-guidance', { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 21864, strictPort: true, hmr: false } });
const results = [];
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const width of [390, 1280]) {
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
      const page = await context.newPage();
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      const boot = await bootSettings(page, { pending: true });
      const emailArea = page.locator('.settings-email-field');
      await expect(emailArea.locator('[data-account-email]')).toHaveText('teacher@example.test');
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await expect(page.locator('a[href="#/settings/email-status"]')).toHaveCount(0);
      await expect(page.locator('[data-email-change-check], button:has-text("تحقق من التغيير")')).toHaveCount(0);
      await expect(emailArea.locator('[data-act="change-email"]')).toHaveCount(1);
      await expect(emailArea.locator('[data-act="change-email"]')).toHaveText('تغيير');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await emailArea.screenshot({ path: `tests/fixtures/n64-inline-guidance/settings-pending-${width}.png` });

      let putMode = 'hold', releasePut, putCalls = 0;
      let authRead = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'teacher@example.test', new_email: 'pending@example.test' };
      await page.route(`${SUPABASE_URL}/auth/v1/user`, async route => {
        if (route.request().method() === 'PUT') {
          putCalls++;
          if (putMode === 'hold') await new Promise(resolve => { releasePut = resolve; });
          if (putMode === 'fail') return route.fulfill({ status: 400, json: { message: 'synthetic request failure' } });
          authRead = { ...authRead, new_email: route.request().postDataJSON().email };
          return route.fulfill({ json: authRead });
        }
        return route.fulfill({ json: authRead });
      });
      await emailArea.locator('[data-act="change-email"]').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      assert.equal(await dialog.locator('.sheet__foot').evaluate(el => getComputedStyle(el).display), 'flex', 'Existing application stylesheet is active on the real dialog');
      await page.locator('[name="newEmail"]').fill('invalid');
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.locator('[data-email-change-error]')).toContainText('صالح');
      assert.equal(putCalls, 0);
      await page.locator('[name="newEmail"]').fill('next@example.test');
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.locator('[data-email-change-sending]')).toBeVisible();
      await expect(page.locator('button[form="email-change-form"]')).toBeDisabled();
      await expect.poll(() => putCalls).toBe(1);
      await page.screenshot({ path: `tests/fixtures/n64-inline-guidance/dialog-sending-${width}.png`, fullPage: true });
      putMode = 'success'; releasePut();
      await expect(page.locator('[data-email-change-accepted]')).toBeVisible();
      for (const text of ['الحالي والجديد', 'غير المرغوب', 'ارجع إلى الإعدادات']) await expect(page.locator('[data-email-change-accepted]')).toContainText(text);
      await expect(page.locator('button[form="email-change-form"]')).toHaveCount(0);
      await expect(page.locator('.sheet__foot [data-sheet-close]')).toBeVisible();
      await page.screenshot({ path: `tests/fixtures/n64-inline-guidance/dialog-pending-${width}.png`, fullPage: true });
      await page.locator('.sheet__foot [data-sheet-close]').click();

      // A failed request stays retryable; only a fresh matching owner read may show completion.
      putMode = 'fail';
      await emailArea.locator('[data-act="change-email"]').click();
      await page.locator('[name="newEmail"]').fill('retry@example.test');
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.locator('[data-email-change-error]')).toContainText('synthetic request failure');
      await expect(page.locator('button[form="email-change-form"]')).toHaveText('إعادة المحاولة');
      putMode = 'success';
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.locator('[data-email-change-accepted]')).toBeVisible();
      await page.locator('.sheet__foot [data-sheet-close]').click();
      authRead = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'retry@example.test', new_email: '' };
      await page.evaluate(() => { const realNow = Date.now; Date.now = () => realNow() + 31000; dispatchEvent(new Event('focus')); });
      await expect(page.locator('[data-email-change-completed]')).toBeVisible();
      await page.screenshot({ path: `tests/fixtures/n64-inline-guidance/settings-verified-${width}.png`, fullPage: true });
      await page.reload();
      await expect(page.locator('[data-account-email]')).toHaveText('retry@example.test');
      await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
      await expect(page.locator('[data-email-change-pending]')).toHaveCount(0);

      // The already-published compatibility address now resolves to the ordinary settings UI.
      await page.evaluate(() => { location.hash = '/settings/email-status'; });
      await expect(page.locator('[data-settings-profile]')).toBeVisible();
      await expect(page.locator('[data-email-status]')).toHaveCount(0);
      await expect(page.locator('[data-act="change-email"]')).toHaveCount(1);
      await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
      assert.deepEqual(boot.errors.filter(message => !message.includes('400 (Bad Request)')), []);
      results.push({ width, currentEmailVisible: true, pendingGuidanceVisible: true, singleChangeAction: true, extraPageLinkAbsent: true, manualCheckAbsent: true, invalidInput: true, sending: true, acceptedGuidance: true, verifiedOutcomeAfterFreshMatchingRead: true, requestErrorRetry: true, closeAvailable: true, compatibilityRendersOrdinarySettings: true, reloadDoesNotRepeatSuccess: true, noHorizontalOverflow: true });
      await context.close();
    }
  });
} finally { await server.close(); }

await mkdir('tests/fixtures/n64-inline-guidance', { recursive: true });
const hashes = {};
for (const file of ['src/views/settings.js', 'src/router.js', 'src/styles/app.css', 'src/lib/settings-profile-ui.js', 'src/lib/cloud.js', 'sw.js']) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const offlineShell = await readFile('sw.js', 'utf8');
assert.equal(offlineShell.includes('./src/views/email-status.js'), false);
assert.equal(offlineShell.includes('./src/styles/settings.css'), false);
assert.equal(offlineShell.includes("'./src/router.js'"), true);
await writeFile('tests/n64-inline-guidance.json', JSON.stringify({ taskId, runId, status: 'PASS', results, sourceSha256: hashes, scope: 'Actual RAKEEZ application DOM, handlers, account/store fixture and source CSS at 390/1280; isolated loopback HTTP; synthetic provider responses only; no real account or message; owned browser/server closed.', reusedProofs: 'tests/n64-auto-pending-evidence.json covers automatic status refresh, current-owner/session fencing, pending/completion semantics, neutral errors/retry, cooldown and reload without false success. src/lib/cloud.js and src/lib/settings-profile-ui.js behavior were unchanged.', confirmationLanding: 'Confirmation link destination and automatic landing remain unchanged and are not delivered by this task.' }, null, 2) + '\n');
console.log(JSON.stringify(results));
