import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n64-pending-guidance-viewonly-20261014.json';
const runId = process.env.RAKEEZ_RUN_ID || '56921269-afd2-45a9-b0ec-fe056992abea';
const origin = 'http://127.0.0.1:19664';
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19664, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const width of [1280, 390]) {
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
      const page = await context.newPage();
      // Existing helper uses relative navigation; retain its fixture and real application boot.
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      // Only synthetic owner switching in this fresh document; no endpoint/session persistence.
      const cloudSource = await readFile('src/lib/cloud.js', 'utf8');
      await page.route('**/src/lib/cloud.js', route => route.fulfill({ contentType: 'text/javascript', body: cloudSource + '\nexport function __n64PresentationOwner(next) { user = next; }' }));
      const evidence = await bootSettings(page);
      let release, calls = 0;
      await page.route(`${SUPABASE_URL}/auth/v1/user`, async route => {
        if (route.request().method() !== 'PUT') return route.fallback();
        calls++;
        const outcome = await new Promise(resolve => { release = resolve; });
        if (outcome === 'error') return route.fulfill({ status: 400, json: { message: 'تعذر الإرسال الاصطناعي' } });
        return route.fulfill({ json: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'teacher@example.test', new_email: route.request().postDataJSON().email } });
      });
      const rejectedBefore = await page.evaluate(async () => {
        const db = await import('/src/lib/db.js');
        const rows = Array.from({ length: 5 }, (_, i) => ({ id: `n64:rejected:${i}`, protocol: 'v2', mutationId: `n64:${i}`, deviceId: 'device:account-profile', store: 'sessions', entity: 'sessions', recordId: `prior:${i}`, serverRecordId: `prior:${i}`, logicalRecordKey: `sessions:prior:${i}`, ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', op: 'create', state: 'rejected', sequence: i, patch: { note: `preserve:${i}` }, localPatch: { note: `preserve:${i}` }, dependencies: [], envelopeLocked: true, attemptCount: 1, lastError: { code: '22023', message: 'N58_SESSION_CONTEXT_REQUIRED', at: 1 }, queuedAt: 1 }));
        await db.putMany('outbox', rows);
        const sync = await import('/src/lib/sync.js');
        await sync.getSyncOperationalSummary();
        (await import('/src/repaint.js')).repaint();
        return JSON.stringify(rows);
      });
      async function open() {
        const details = page.locator('[data-settings-profile]');
        if (await details.getAttribute('open') === null) await details.locator('summary').click();
        await page.locator('[data-act="change-email"]').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
      }
      async function localControls() {
        assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
        await page.locator('[data-act="about-rakeez"]').click();
        await expect(page.locator('[data-about-version]')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-act="about-rakeez"]')).toBeFocused();
        await page.locator('[data-act="sound"][data-val="off"]').click();
        await expect(page.locator('[data-act="sound"][data-val="off"]')).toHaveAttribute('aria-pressed', 'true');
      }
      await open();
      await page.evaluate(async () => { void (await import('/src/views/settings.js')).default.actions['change-email'](); });
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await page.locator('.sheet__foot [data-sheet-close]').click();
      assert.equal(calls, 0);
      await localControls();
      await open();
      await page.locator('[name="newEmail"]').fill('pending@example.test');
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.locator('[data-email-change-sending]')).toBeVisible();
      await expect.poll(() => calls).toBe(1);
      await page.locator('#email-change-form').evaluate(el => { el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      assert.equal(calls, 1);
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('button[form="email-change-form"]')).toBeDisabled();
      // Shared modal keyboard trap remains active.
      await page.locator('.sheet__foot [data-sheet-close]').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('.sheet__head [data-sheet-close]')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-email-change-page-sending]')).toBeVisible();
      await expect(page.locator('[data-act="change-email"]')).toBeDisabled();
      await localControls();
      release('pending');
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await expect(page.locator('[data-account-email]')).toHaveText('teacher@example.test');
      for (const text of ['الحالي والجديد', 'غير المرغوب', 'حتى يكتمل التأكيد']) await expect(page.locator('[data-email-change-pending]')).toContainText(text);
      await page.locator('[data-settings-profile] summary').click();
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      // Next request fails and its error survives dismissal and repaint.
      await open();
      await page.locator('[name="newEmail"]').fill('failure@example.test');
      await page.locator('button[form="email-change-form"]').click();
      await expect.poll(() => calls).toBe(2);
      release('error');
      await expect(page.locator('[data-email-change-error]')).toContainText('تعذر الإرسال الاصطناعي');
      await expect(page.locator('button[form="email-change-form"]')).toBeEnabled();
      await page.keyboard.press('Escape');
      await localControls();
      await expect(page.locator('[data-email-change-page-error]')).toContainText('تعذر الإرسال الاصطناعي');
      const rejectedAfter = await page.evaluate(async () => {
        const rows = (await (await import('/src/lib/db.js')).getAll('outbox')).filter(row => row.id.startsWith('n64:rejected:'));
        if (rows.length !== 5) throw Error('Rejected fixture rows changed');
        return JSON.stringify(rows);
      });
      assert.equal(rejectedAfter, rejectedBefore);
      assert.equal(await page.evaluate(async () => (await (await import('/src/lib/sync.js')).getSyncOperationalSummary()).rejectedCount), 5);
      await open();
      await page.locator('[name="newEmail"]').fill('stale@example.test');
      await page.evaluate(async () => {
        (await import('/src/lib/cloud.js')).__n64PresentationOwner({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'other@example.test' });
        (await import('/src/repaint.js')).repaint();
      });
      await page.locator('button[form="email-change-form"]').click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      assert.equal(calls, 2);
      await expect(page.locator('[data-email-change-page-error], [data-email-change-pending], [data-email-change-page-sending]')).toHaveCount(0);
      assert.deepEqual(evidence.errors.filter(error => !error.includes('400 (Bad Request)')), []);
      console.log(`PASS actual settings DOM/CSS ${width}px: delay, duplicate, cancel, error, pending, local controls, owner reset; five rejected entries byte-preserved; all service traffic synthetically fulfilled`);
      await context.close();
    }
  });
} finally { await server.close(); }
