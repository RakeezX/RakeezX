import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUPABASE_URL } from '../src/lib/cloud.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};
let host;

test.beforeAll(async () => {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = { server, url: `http://127.0.0.1:${server.address().port}` };
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => host.server.close((error) => error ? reject(error) : resolve()));
});

async function openFirstRun(page) {
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => route.fulfill({ status: 204 }));
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.goto(`${host.url}/#/`);
  return page.locator('[data-workspace-gate]');
}

test('signed-out first run uses the approved copy and remains responsive in light and dark modes', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const gate = await openFirstRun(page);
  await expect(gate.getByRole('heading', { name: 'رَكيزة المعلم الرقمية', exact: true })).toBeVisible();
  await expect(gate.getByText('كل ما يحتاجه المعلم، في مكان واحد.', { exact: true })).toBeVisible();
  await expect(gate.getByRole('button', { name: 'ابدأ مع ركيز', exact: true })).toBeVisible();
  await expect(gate.getByRole('button', { name: 'جرّب ركيز', exact: true })).toBeVisible();
  await expect(gate.getByText('تسجيل الدخول مخصص للحسابات الحالية.', { exact: false })).toHaveCount(0);
  await expect(gate.locator('.first-run-orb--green')).toHaveCSS('background-color', 'rgba(36, 164, 105, 0.14)');
  await expect(gate.locator('.first-run-orb--blue')).toHaveCSS('background-color', 'rgba(56, 131, 205, 0.11)');
  expect((await new AxeBuilder({ page }).include('[data-workspace-gate]').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('first-run-desktop-light.png'), fullPage: true });

  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await expect(gate.locator('.first-run-card')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('first-run-desktop-dark.png'), fullPage: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await gate.getByRole('button', { name: 'ابدأ مع ركيز', exact: true }).focus();
  await expect(gate.getByRole('button', { name: 'ابدأ مع ركيز', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('first-run-mobile-dark.png'), fullPage: true });

  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await context.close();
});

test('primary action opens the existing account-only OTP contract and code treatment', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const requests = [];
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/otp')) {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 204 });
  });
  await page.goto(`${host.url}/#/`);
  await page.getByRole('button', { name: 'ابدأ مع ركيز', exact: true }).click();
  const login = page.locator('.sheet-backdrop').last();
  await expect(login.getByRole('dialog')).toBeVisible();
  await expect(login.getByText('رَكيزة المعلم الرقمية', { exact: true })).toBeVisible();
  await expect(login.getByText('أدخل بريدك الإلكتروني لإرسال رمز التحقق.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('first-run-email-entry.png'), fullPage: true });
  await login.locator('input[name="email"]').fill(' Existing@Example.Test ');
  await login.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  expect(requests).toEqual([{ email: 'existing@example.test', create_user: false }]);
  await expect(login.getByRole('heading', { name: 'أدخل رمز التحقق', exact: true })).toBeVisible();
  await expect(login.locator('input[name="token"]')).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(login.locator('[data-email-otp-resend]')).toBeDisabled();
  await expect(login.locator('[data-email-otp-resend]')).toContainText('إعادة الإرسال بعد');
  await expect(login.getByRole('button', { name: 'تغيير الإيميل', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('first-run-otp.png'), fullPage: true });
  await context.close();
});

test('secondary action hands off to the current isolated Demo runtime', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route(`${SUPABASE_URL}/**`, (route) => route.abort());
  await page.goto(`${host.url}/#/`);
  await page.getByRole('button', { name: 'جرّب ركيز', exact: true }).click();
  await expect(page.locator('[data-demo-indicator]:visible')).toContainText('الوضع التجريبي');
  await page.getByRole('link', { name: 'الفصول', exact: true }).click();
  await expect(page.getByText('184', { exact: true })).toBeVisible();
  await expect(page.getByText('8', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'الخروج من الوضع التجريبي وتسجيل الدخول' }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('first-run-demo-entry.png'), fullPage: true });
  await context.close();
});
