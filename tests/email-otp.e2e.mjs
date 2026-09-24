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
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.locator('[data-act="mini-hub-login"]').click();
  return page.locator('.sheet-backdrop').last();
}

test('pilot OTP request preserves the existing Auth UUID and six-digit verification', async ({ page }) => {
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
    path: '/auth/v1/otp', body: { email: 'existing@example.test', create_user: true },
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

test('closed signup gate and invalid or expired OTP fail neutrally without a Product workspace', async ({ page }) => {
  await page.route('**/src/lib/cloud.js*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const enabled = 'export const NEW_ACCOUNT_SIGNUP_ENABLED = true;';
    expect(source.split(enabled)).toHaveLength(2);
    await route.fulfill({ response, body: source.replace(enabled,
      'export const NEW_ACCOUNT_SIGNUP_ENABLED = false;') });
  });
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

test('email-specific cooldown survives back navigation, prevents duplicates, and maps server rate limits', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T12:00:00Z') });
  const requests = [];
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith('/otp')) return route.fulfill({ status: 204 });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.email === 'limited@example.test') {
      return route.fulfill({
        status: 429,
        headers: { 'Retry-After': '42', 'Access-Control-Expose-Headers': 'Retry-After' },
        json: { code: 'over_email_send_rate_limit', message: 'rate limit exceeded' },
      });
    }
    return route.fulfill({ status: 204 });
  });

  const login = await openLogin(page);
  const email = login.locator('input[name="email"]');
  const submit = login.getByRole('button', { name: 'إرسال رمز التحقق' });
  await email.fill(' Existing@Example.Test ');
  await submit.click();
  expect(requests).toHaveLength(1);

  await login.locator('[data-email-otp-change]').click();
  await expect(login.locator('[data-email-otp-cooldown]')).toHaveText('يمكنك طلب رمز جديد بعد 60 ثانية');
  await expect(submit).toBeDisabled();
  await login.locator('form').dispatchEvent('submit');
  expect(requests).toHaveLength(1);

  await email.fill('different@example.test');
  await expect(submit).toBeEnabled();
  await submit.click();
  expect(requests).toHaveLength(2);
  await expect(login.locator('[data-email-otp-resend]')).toBeDisabled();
  await login.locator('[data-email-otp-resend]').dispatchEvent('click');
  expect(requests).toHaveLength(2);

  await page.clock.runFor(60_000);
  await expect(login.locator('[data-email-otp-resend]')).toBeEnabled();
  await login.locator('[data-email-otp-change]').click();
  await email.fill('limited@example.test');
  await submit.click();
  expect(requests).toHaveLength(3);
  await expect(page.locator('#toast')).toContainText('تم إرسال رمز قبل قليل. انتظر قليلًا ثم أعد المحاولة.');
  await expect(login.locator('[data-email-otp-cooldown]')).toHaveText('يمكنك طلب رمز جديد بعد 42 ثانية');
  await expect(submit).toBeDisabled();
});
