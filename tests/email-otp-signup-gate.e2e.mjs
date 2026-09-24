import { test, expect } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const NEW_OWNER = '88888888-8888-4888-8888-888888888888';
const EXISTING_OWNER = '77777777-7777-4777-8777-777777777777';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.ico': 'image/x-icon' };
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

async function openUnifiedOtp(page) {
  await page.goto(`${host.url}/#/`);
  await page.getByRole('button', { name: 'ابدأ مع ركيز', exact: true }).click();
  return page.locator('.sheet-backdrop').last();
}

test('one approved email surface serves a new synthetic owner when Product gate is on', async ({ page }) => {
  const authRequests = [];
  const users = new Map();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/account_contract`, (route) => route.fulfill({ json: {
    ownerId: NEW_OWNER, profileStatus: 'PENDING_PROFILE', profile: null,
    access: { grantType: 'beta_full', status: 'active', source: 'public_beta' },
    provisioning: { state: 'PROFILE_REQUIRED', version: 1 },
  } }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON?.() ?? null;
    authRequests.push({ path, body });
    if (path.endsWith('/otp')) {
      expect(body).toEqual({ email: 'new@example.test', create_user: true });
      users.set(body.email, { id: NEW_OWNER, email: body.email });
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/verify')) return route.fulfill({ json: {
      access_token: 'synthetic-new-access', refresh_token: 'synthetic-new-refresh',
      expires_at: 4_102_444_800, user: users.get(body.email),
    } });
    if (path.endsWith('/user')) return route.fulfill({ json: users.get('new@example.test') });
    return route.fulfill({ status: 204 });
  });

  const sheet = await openUnifiedOtp(page);
  await sheet.locator('input[name="email"]').fill('new@example.test');
  await sheet.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await expect(sheet.locator('[data-email-otp-code-step]')).toBeVisible();
  await sheet.locator('input[name="token"]').fill('123456');
  await sheet.getByRole('button', { name: 'تحقق وتسجيل الدخول' }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.user?.id,
    AUTH_STORAGE_KEY)).toBe(NEW_OWNER);
  await expect(page.locator('[data-account-profile-required]')).toBeVisible();
  expect(users.size).toBe(1);
  expect(authRequests.filter(({ path }) => path.endsWith('/otp'))).toHaveLength(1);
  const session = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), AUTH_STORAGE_KEY);
  expect(session.user.id).toBe(NEW_OWNER);
  expect(errors).toEqual([]);
});

test('same unified OTP surface preserves an existing synthetic Auth UUID with gate on', async ({ page }) => {
  const users = new Map([['existing@example.test', { id: EXISTING_OWNER, email: 'existing@example.test' }]]);
  const requests = [];
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON?.() ?? null;
    requests.push({ path, body });
    if (path.endsWith('/otp')) return route.fulfill({ status: 204 });
    if (path.endsWith('/verify')) return route.fulfill({ json: {
      access_token: 'synthetic-existing-access', refresh_token: 'synthetic-existing-refresh',
      expires_at: 4_102_444_800, user: users.get(body.email),
    } });
    if (path.endsWith('/user')) return route.fulfill({ json: users.get('existing@example.test') });
    return route.fulfill({ status: 204 });
  });

  const sheet = await openUnifiedOtp(page);
  await sheet.locator('input[name="email"]').fill('existing@example.test');
  await sheet.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await sheet.locator('input[name="token"]').fill('123456');
  await sheet.getByRole('button', { name: 'تحقق وتسجيل الدخول' }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.user?.id,
    AUTH_STORAGE_KEY)).toBe(EXISTING_OWNER);
  expect(users.size).toBe(1);
  expect(requests.find(({ path }) => path.endsWith('/otp')).body).toEqual({
    email: 'existing@example.test', create_user: true,
  });
});
