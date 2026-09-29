import { test, expect, chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, AUTH_STORAGE_KEY } from '../src/lib/cloud.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.png':'image/png', '.ico':'image/x-icon' };
let host;
test.beforeAll(async () => {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  host = { server, url: `http://127.0.0.1:${server.address().port}` };
});
test.afterAll(async () => {
  await new Promise((resolve,reject) => host.server.close(error => error ? reject(error) : resolve()));
});

const session = {
  access_token: 'synthetic-otp-access', refresh_token: 'synthetic-otp-refresh', expires_at: 4_102_444_800,
  user: { id: '77777777-7777-4777-8777-777777777777', email: 'teacher@example.test' },
};

async function fixture(page, state = {}) {
  const calls = [];
  await page.route(`${SUPABASE_URL}/rest/v1/**`, route => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/otp')) {
      calls.push({ path, body: route.request().postDataJSON() });
      if (state.sendFailure) return route.fulfill({ status: state.sendFailure === 'rate' ? 429 : 400,
        headers: state.sendFailure === 'rate' ? { 'Retry-After': '42', 'Access-Control-Expose-Headers': 'Retry-After' } : {},
        json: { code: state.sendFailure === 'rate' ? 'over_email_send_rate_limit' : 'email_address_invalid' } });
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/verify')) {
      calls.push({ path, body: route.request().postDataJSON() });
      if (state.verifyFailure) return route.fulfill({ status: 403, json: { code: state.verifyFailure } });
      state.verified = true;
      return route.fulfill({ json: session });
    }
    if (path.endsWith('/user')) return state.verified ? route.fulfill({ json: session.user }) : route.fulfill({ status: 204 });
    return route.fulfill({ status: 204 });
  });
  await page.goto(`${host.url}/#/`);
  await expect(page.locator('[data-workspace-login]')).toBeVisible();
  return calls;
}

for (const [name, launcher] of Object.entries({ chromium, webkit })) {
  test(`${name}: inline email, OTP, cooldown, errors, and back`, async () => {
    const browser = await launcher.launch();
    try {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const state = {};
      const calls = await fixture(page, state);
      const card = page.locator('.n56-auth');
      await page.locator('[data-workspace-login]').click();
      await expect(card).toBeVisible();
      await expect(card.locator('input[name=email]')).toBeFocused();
      await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
      await expect(page.locator('.n37-benefits')).toBeHidden();
      await expect(page.locator('.n37-continuity')).toBeHidden();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await card.getByRole('button', { name: 'متابعة' }).click();
      await expect(card.locator('[data-email-otp-feedback]')).toContainText('صحيحًا');
      await expect(card.locator('input[name=email]')).toHaveAttribute('aria-invalid', 'true');
      expect(calls).toHaveLength(0);
      await card.getByRole('button', { name: 'رجوع' }).click();
      await expect(page.locator('[data-workspace-login]')).toBeFocused();
      await expect(page.locator('.n37-benefits')).toBeVisible();
      await expect(page.locator('.n37-continuity')).toBeVisible();
      await page.locator('[data-workspace-login]').click();
      const email = card.locator('input[name=email]');
      await email.fill(' Teacher@Example.Test ');
      state.sendFailure = 'rate';
      await email.press('Enter');
      await expect(card.locator('[data-email-otp-feedback]')).toContainText('انتظر قليلًا');
      await expect(card.locator('[data-email-otp-cooldown]')).toContainText('42 ثانية');
      expect(calls).toHaveLength(1);
      await email.fill('different@example.test');
      state.sendFailure = null;
      await email.press('Enter');
      await expect(card.getByRole('heading', { name: 'تحقق من بريدك' })).toBeVisible();
      await expect(card.locator('[data-email-otp-sent]')).toHaveText('different@example.test');
      await expect(card.locator('input[name=token]')).toBeFocused();
      await expect(card.locator('[data-email-otp-resend]')).toBeDisabled();
      expect(calls[1]).toEqual({ path: '/auth/v1/otp', body: { email: 'different@example.test', create_user: true } });
      const token = card.locator('input[name=token]');
      await token.fill('١٢٣۴۵');
      await expect(token).toHaveValue('12345');
      await token.press('Enter');
      await expect(card.locator('[data-email-otp-feedback]')).toContainText('6 أرقام');
      expect(calls).toHaveLength(2);
      state.verifyFailure = 'otp_invalid';
      await token.fill('١٢٣۴۵۶abc');
      await expect(token).toHaveValue('123456');
      await token.press('Enter');
      await expect(card.locator('[data-email-otp-feedback]')).toContainText('غير صحيح');
      state.verifyFailure = 'otp_expired';
      await token.press('Enter');
      await expect(card.locator('[data-email-otp-feedback]')).toContainText('انتهت صلاحية');
      expect(calls.at(-1)).toEqual({ path: '/auth/v1/verify', body: { email: 'different@example.test', token: '123456', type: 'email' } });
      await card.getByRole('button', { name: 'تغيير البريد' }).click();
      await expect(email).toHaveValue('different@example.test');
      await expect(email).toBeFocused();
      await expect(token).toHaveValue('');
      expect(errors).toEqual([]);
      await context.close();
    } finally { await browser.close(); }
  });

  test(`${name}: N37 default and N56 pressure geometry, accessibility`, async () => {
    const browser = await launcher.launch();
    try {
      const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await context.newPage();
      await fixture(page);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
        for (const [width,height] of [[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[375,812],[320,740],[390,430],[390,350],[375,300],[320,227]]) {
          await page.setViewportSize({ width, height });
          const check = async () => {
            const geometry = await page.evaluate(() => ({
              viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              bodyOverflow: getComputedStyle(document.body).overflowY,
              cardOverflow: getComputedStyle(document.querySelector('.n56-auth')).overflowY,
              modal: document.querySelectorAll('[aria-modal=true], .sheet-backdrop').length,
              inputFont: parseFloat(getComputedStyle(document.querySelector('.n56-auth input[name=email]')).fontSize),
              submitHeight: document.querySelector('.n56-auth button[type=submit]').getBoundingClientRect().height,
            }));
            expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
            expect(geometry.modal).toBe(0);
            expect(geometry.bodyOverflow).not.toBe('hidden');
            expect(geometry.cardOverflow).not.toBe('auto');
            expect(geometry.inputFont).toBeGreaterThanOrEqual(16);
            if (await page.locator('.n56-auth').isVisible()) {
              expect(geometry.submitHeight).toBeGreaterThanOrEqual(44);
              const reachable = await page.evaluate(() => {
                const action = document.querySelector('.n56-auth button[type=submit]');
                action.scrollIntoView({ block:'nearest' });
                const rect = action.getBoundingClientRect();
                return rect.top >= -1 && rect.bottom <= innerHeight + 1;
              });
              expect(reachable).toBe(true);
            }
          };
          await expect(page.locator('[data-workspace-login]')).toBeVisible();
          await check();
          if (width === 390 && height === 844) expect((await new AxeBuilder({ page }).include('[data-workspace-gate]').analyze()).violations).toEqual([]);
          await page.locator('[data-workspace-login]').click();
          await expect(page.locator('.n56-auth input[name=email]')).toBeFocused();
          await check();
          if (width === 390 && height === 844) expect((await new AxeBuilder({ page }).include('[data-workspace-gate]').analyze()).violations).toEqual([]);
          await page.locator('.n56-auth input[name=email]').fill(`teacher-${width}-${height}-${theme}@example.test`);
          await page.locator('.n56-auth button[type=submit]').click();
          await expect(page.locator('[data-email-otp-code-step]')).toBeVisible();
          await check();
          if (width === 390 && height === 844) {
            expect((await new AxeBuilder({ page }).include('[data-workspace-gate]').analyze()).violations).toEqual([]);
            await page.locator('.n56-auth input[name=token]').fill('12345');
            await page.locator('.n56-auth input[name=token]').press('Enter');
            await expect(page.locator('[data-email-otp-feedback]')).toBeVisible();
            expect((await new AxeBuilder({ page }).include('[data-workspace-gate]').analyze()).violations).toEqual([]);
          }
          await page.locator('[data-email-otp-change]').click();
          await page.locator('[data-n56-back]').click();
          await expect(page.locator('.n37-benefits')).toBeVisible();
        }
      }
      await context.close();
    } finally { await browser.close(); }
  });

  test(`${name}: offline send is local-only; resend and verify keep the original handoff`, async () => {
    const browser = await launcher.launch();
    try {
      const offline = await browser.newContext({ serviceWorkers: 'block' });
      await offline.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable:true, get:()=>false }));
      const offlinePage = await offline.newPage();
      const offlineCalls = await fixture(offlinePage);
      await offlinePage.locator('[data-workspace-login]').click();
      await offlinePage.locator('.n56-auth input[name=email]').fill('teacher@example.test');
      await offlinePage.locator('.n56-auth button[type=submit]').click();
      await expect(offlinePage.locator('[data-email-otp-feedback]')).toContainText('يلزم الاتصال');
      expect(offlineCalls).toEqual([]);
      await offline.close();

      const context = await browser.newContext({ serviceWorkers:'block' });
      const page = await context.newPage();
      await page.clock.install({ time:new Date('2026-09-29T12:00:00Z') });
      const calls = await fixture(page);
      await page.locator('[data-workspace-login]').click();
      await page.locator('.n56-auth input[name=email]').fill('teacher@example.test');
      await page.locator('.n56-auth button[type=submit]').click();
      await expect(page.locator('[data-email-otp-code-step]')).toBeVisible();
      await expect(page.locator('[data-email-otp-resend]')).toBeDisabled();
      await page.clock.runFor(60_000);
      await expect(page.locator('[data-email-otp-resend]')).toBeEnabled();
      await page.locator('[data-email-otp-resend]').click();
      await expect(page.locator('[data-email-otp-resend]')).toBeDisabled();
      expect(calls.filter(call => call.path === '/auth/v1/otp')).toHaveLength(2);
      await page.locator('.n56-auth input[name=token]').fill('123456');
      await Promise.all([
        page.waitForEvent('load'),
        page.locator('.n56-auth input[name=token]').press('Enter'),
      ]);
      expect(calls.at(-1)).toEqual({ path:'/auth/v1/verify',
        body:{ email:'teacher@example.test', token:'123456', type:'email' } });
      expect(await page.evaluate(key => localStorage.getItem(key) !== null, AUTH_STORAGE_KEY)).toBe(true);
      await context.close();
    } finally { await browser.close(); }
  });

  test(`${name}: Mini Hub still opens its existing OTP sheet`, async () => {
    const browser = await launcher.launch();
    try {
      const context = await browser.newContext({ serviceWorkers:'block' });
      const page = await context.newPage();
      await page.route(`${SUPABASE_URL}/rest/v1/**`, route => route.fulfill({ json:[] }));
      await page.route(`${SUPABASE_URL}/auth/v1/**`, route => route.fulfill({ status:204 }));
      await page.goto('http://127.0.0.1:5173/#/');
      await page.waitForFunction(() => window.store?.state?.ready);
      await page.locator('[data-act="open-teacher-mini-hub"]').first().click();
      await page.locator('[data-act="mini-hub-login"]').click();
      const sheet = page.locator('.sheet-backdrop').last();
      await expect(sheet.getByRole('dialog')).toBeVisible();
      await expect(sheet.locator('input[name=email]')).toBeVisible();
      await expect(sheet.getByRole('button', { name:'إرسال رمز التحقق' })).toBeVisible();
      await expect(page.locator('.n56-auth')).toHaveCount(0);
      await context.close();
    } finally { await browser.close(); }
  });
}
