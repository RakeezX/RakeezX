import { test, expect } from '@playwright/test';

import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const OWNER = '77777777-7777-4777-8777-777777777777';
const session = {
  access_token: 'email-otp-access', refresh_token: 'email-otp-refresh', expires_at: 4_102_444_800,
  user: { id: OWNER, email: 'existing@example.test' },
};

async function openLogin(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready);
  await page.locator('.teacher-mini-hub-trigger, .topbar__teacher-btn').filter({ visible: true }).click();
  await page.locator('[data-act="mini-hub-login"]').click();
  return page.locator('.sheet-backdrop').last();
}

test('existing-account OTP request forbids signup and six normalized digits restore the same Auth UUID', async ({ page }) => {
  const requests = [];
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    requests.push({ path, body });
    if (path.endsWith('/otp')) return route.fulfill({ status: 204 });
    if (path.endsWith('/verify')) return route.fulfill({ json: session });
    if (path.endsWith('/user')) return route.fulfill({ json: session.user });
    return route.fulfill({ status: 204 });
  });

  const login = await openLogin(page);
  await expect(login.locator('input[name="password"]')).toHaveCount(0);
  await login.locator('input[name="email"]').fill(' Existing@Example.Test ');
  await login.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  expect(requests[0]).toEqual({
    path: '/auth/v1/otp', body: { email: 'existing@example.test', create_user: false },
  });
  await expect(login.locator('[data-email-otp-resend]')).toBeDisabled();
  await expect(login.locator('[data-email-otp-resend]')).toContainText('إعادة الإرسال بعد');
  await login.locator('input[name="token"]').fill('١٢٣۴۵۶abc');
  await expect(login.locator('input[name="token"]')).toHaveValue('123456');
  await login.getByRole('button', { name: 'تحقق وتسجيل الدخول' }).click();
  expect(requests[1]).toEqual({
    path: '/auth/v1/verify', body: { email: 'existing@example.test', token: '123456', type: 'email' },
  });
  await expect(page.locator('.mini-hub-sheet')).toContainText('existing@example.test');
});

test('unknown email and invalid or expired OTP fail neutrally without creating a Product workspace', async ({ page }) => {
  let verifyFailure = 'otp_invalid';
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    if (path.endsWith('/otp')) {
      expect(body.create_user).toBe(false);
      if (body.email === 'unknown@example.test') {
        return route.fulfill({ status: 400, json: { code: 'user_not_found', message: 'User not found' } });
      }
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/verify')) {
      return route.fulfill({ status: 403, json: { code: verifyFailure, message: verifyFailure === 'otp_expired' ? 'OTP expired' : 'Invalid OTP' } });
    }
    return route.fulfill({ status: 204 });
  });

  const login = await openLogin(page);
  await login.locator('input[name="email"]').fill('unknown@example.test');
  await login.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await expect(page.locator('#toast')).toContainText('تعذر إرسال رمز التحقق');
  await expect(login.locator('[data-email-otp-code-step]')).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), AUTH_STORAGE_KEY)).toBeNull();

  await login.locator('input[name="email"]').fill('existing@example.test');
  await login.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await login.locator('input[name="token"]').fill('123456');
  await login.getByRole('button', { name: 'تحقق وتسجيل الدخول' }).click();
  await expect(page.locator('#toast')).toContainText('غير صحيح');
  verifyFailure = 'otp_expired';
  await login.getByRole('button', { name: 'تحقق وتسجيل الدخول' }).click();
  await expect(page.locator('#toast')).toContainText('انتهت صلاحية');
  expect(await page.evaluate((key) => localStorage.getItem(key), AUTH_STORAGE_KEY)).toBeNull();
});

test('offline state cannot initiate OTP and never falls back to SMS or password', async ({ page }) => {
  let authRequests = 0;
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => { authRequests += 1; return route.abort(); });
  const login = await openLogin(page);
  await login.locator('input[name="email"]').fill('existing@example.test');
  await login.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await expect(page.locator('#toast')).toContainText('يلزم الاتصال بالإنترنت');
  expect(authRequests).toBe(0);
  await expect(login.locator('input[name="password"]')).toHaveCount(0);
  await expect(login.locator('input[type="tel"]')).toHaveCount(0);
});
