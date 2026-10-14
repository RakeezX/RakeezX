import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const baseline = process.argv.includes('--baseline');
const base = 'b47a0ababa135a10b2e0bcb097b813b156b7063b';
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n64-stable-settings-layout-20261014.json';
const runId = 'a307ec98-cdd4-4f57-a80f-76ec440e51e6';
const origin = 'http://127.0.0.1:19764';
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19764, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const width of [1280, 390]) {
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
      const page = await context.newPage();
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, origin).href, options);
      if (baseline) {
        for (const file of ['src/views/settings.js', 'src/styles/components.css']) {
          const body = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
          await page.route(`**/${file}`, route => route.fulfill({ contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript', body }));
        }
      }
      // Observe actual paints and notify unchanged synthetic identity through real subscribers.
      const appSource = await readFile('src/app.js', 'utf8');
      await page.route('**/src/app.js', route => route.fulfill({ contentType: 'text/javascript', body: appSource.replace('function paint() {', 'function paint() { window.__n64Paints = (window.__n64Paints || 0) + 1;') }));
      const cloudSource = await readFile('src/lib/cloud.js', 'utf8');
      await page.route('**/src/lib/cloud.js', route => route.fulfill({ contentType: 'text/javascript', body: cloudSource + '\nexport function __n64SameOwnerNotification() { notify(); }' }));
      const evidence = await bootSettings(page, { pending: true });
      const rejectedBefore = await page.evaluate(async () => {
        const db = await import('/src/lib/db.js');
        const rows = Array.from({ length: 5 }, (_, i) => ({ id: `n64:rejected:${i}`, protocol: 'v2', mutationId: `n64:${i}`, deviceId: 'device:account-profile', store: 'sessions', entity: 'sessions', recordId: `prior:${i}`, serverRecordId: `prior:${i}`, logicalRecordKey: `sessions:prior:${i}`, ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', op: 'create', state: 'rejected', sequence: i, patch: { note: `preserve:${i}` }, localPatch: { note: `preserve:${i}` }, dependencies: [], envelopeLocked: true, attemptCount: 1, lastError: { code: '22023', message: 'N58_SESSION_CONTEXT_REQUIRED', at: 1 }, queuedAt: 1 }));
        await db.putMany('outbox', rows);
        await (await import('/src/lib/sync.js')).getSyncOperationalSummary();
        (await import('/src/repaint.js')).repaint();
        return JSON.stringify(rows);
      });
      await page.waitForTimeout(700);
      const details = page.locator('[data-settings-profile]');
      await details.locator(':scope > summary').click();
      await expect(details).not.toHaveAttribute('open');
      await page.waitForTimeout(100);
      const before = await page.locator('.settings-section--experience').evaluate(el => ({ y: el.getBoundingClientRect().top, paints: window.__n64Paints }));
      await page.evaluate(async () => { await (await import('/src/lib/sync.js')).getSyncOperationalSummary(); (await import('/src/repaint.js')).repaint(); });
      await page.waitForTimeout(300);
      const after = await page.locator('.settings-section--experience').evaluate(el => ({ y: el.getBoundingClientRect().top, paints: window.__n64Paints, open: document.querySelector('[data-settings-profile]').open, inert: document.querySelector('#app').inert }));
      console.log(JSON.stringify({ phase: baseline ? 'baseline' : 'corrected', width, before, after, shift: after.y - before.y }));
      if (baseline) {
        assert.equal(after.open, true, 'Baseline pending attention reopens the user-collapsed profile');
        assert.ok(after.y - before.y > 100);
        await context.close();
        continue;
      }
      assert.equal(after.open, false);
      assert.equal(after.y, before.y);
      await details.locator(':scope > summary').click();
      await expect(page.locator('[data-account-email]')).toHaveText('teacher@example.test');
      assert.equal(await page.locator('[data-email-change-pending]').evaluate(el => !!el.closest('.settings-email-field')), true);
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      const instructions = page.locator('[data-email-change-instructions]');
      await instructions.locator('summary').click();
      await expect(instructions).toContainText('الحالي والجديد');
      await expect(instructions).toContainText('غير المرغوب');
      await page.evaluate(async () => (await import('/src/repaint.js')).repaint());
      await expect(instructions).toHaveAttribute('open');
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-act="change-email"]').click();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
        await page.locator('[name="newEmail"]').fill(i ? 'new@example.test' : 'teacher@example.test');
        if (!i) {
          await page.locator('button[form="email-change-form"]').click();
          await expect(page.locator('[data-email-change-error]')).toContainText('مختلفًا');
        }
        await page.locator('button[form="email-change-form"]').focus();
        await page.keyboard.press('Tab');
        await expect(page.locator('.sheet__head [data-sheet-close]')).toBeFocused();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
        await expect(page.locator('[data-act="change-email"]')).toBeFocused();
      }
      await page.locator('[data-act="about-rakeez"]').click();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-act="about-rakeez"]')).toBeFocused();
      await page.locator('[data-act="sound"][data-val="off"]').click();
      await expect(page.locator('[data-act="sound"][data-val="off"]')).toHaveAttribute('aria-pressed', 'true');
      // Delayed current account read while the user has chosen to collapse the profile.
      await details.locator(':scope > summary').click();
      await page.route(`${SUPABASE_URL}/rest/v1/rpc/account_contract`, async route => {
        await new Promise(resolve => setTimeout(resolve, 250));
        return route.fallback();
      });
      await page.evaluate(async () => { (await import('/src/views/settings.js')).default.onMount(); });
      await page.waitForTimeout(600);
      await expect(details).not.toHaveAttribute('open');
      for (let i = 0; i < 3; i++) {
        await page.evaluate(async () => (await import('/src/lib/cloud.js')).__n64SameOwnerNotification());
        await page.waitForTimeout(350);
      }
      await expect(details).not.toHaveAttribute('open');
      await page.waitForTimeout(500);
      const paints = await page.evaluate(() => window.__n64Paints);
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.__n64Paints), paints, 'Equivalent events settle, no paint loop');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.locator('[data-act="about-rakeez"]').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
      // Re-enter through actual same-document router materialization, no new auth/session.
      await page.evaluate(() => { location.hash = '#/settings/backup'; });
      await expect(details).toHaveCount(0);
      await page.evaluate(() => { location.hash = '#/settings'; });
      await expect(details).toBeVisible();
      await expect(page.locator('[data-account-email]')).toHaveText('teacher@example.test');
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      const rejectedAfter = await page.evaluate(async () => JSON.stringify((await (await import('/src/lib/db.js')).getAll('outbox')).filter(row => row.id.startsWith('n64:rejected:'))));
      assert.equal(rejectedAfter, rejectedBefore);
      assert.equal(await page.evaluate(async () => (await (await import('/src/lib/sync.js')).getSyncOperationalSummary()).rejectedCount), 5);
      await expect(page.locator('[data-app-status]')).toHaveClass(/is-visible is-rejected/);
      await expect(page.locator('[data-app-status-text]')).toContainText('تعذر اعتماد');
      assert.deepEqual(evidence.errors, []);
      console.log(`PASS ${width}px actual DOM: pending context, controls, delayed read, same-owner events, settled paints; rejected rows byte-identical`);
      await context.close();
    }
  });
} finally { await server.close(); }
