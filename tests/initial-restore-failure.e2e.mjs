import { test, expect } from '@playwright/test';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const OWNER = '56565656-5656-4565-8565-565656565656';
const session = {
  access_token: 'restore-failure-access', refresh_token: 'restore-failure-refresh',
  expires_at: 4_102_444_800, user: { id: OWNER, email: 'restore-failure@example.test' },
};

test('restore failure keeps the workspace closed and exposes retry, logout, and support', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: AUTH_STORAGE_KEY, value: session,
  });
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/user')) return route.fulfill({ json: session.user });
    return route.fulfill({ status: 204 });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({
    status: 503,
    json: { code: 'RESTORE_UNAVAILABLE', message: 'synthetic restore outage' },
  }));
  await page.goto('/#/');
  const failure = page.locator('[data-initial-restore-state="RESTORE_FAILED"]');
  await expect(failure).toBeVisible();
  await expect(failure.locator('.first-run-status')).toHaveAttribute('role', 'alert');
  await expect(failure.getByRole('heading', { name: 'تعذر استعادة بيانات الحساب' })).toBeVisible();
  await expect(failure.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible();
  await expect(failure.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
  await expect(failure.getByRole('link', { name: 'الدعم' })).toHaveAttribute('href', 'mailto:support@rakeezx.com');
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(false);
});
