import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co';

async function mockAuth(page, { rejectLogin = false, waitForLogout = null } = {}) {
  await page.route(`${CLOUD_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${CLOUD_URL}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) {
      if (rejectLogin) {
        await route.fulfill({ status: 400, json: { error_description: 'بيانات الدخول غير صحيحة' } });
        return;
      }
      await route.fulfill({ json: {
        access_token: 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.signature',
        refresh_token: 'teacher-hub-test-refresh',
        expires_in: 3600,
        user: { id: 'teacher-hub-test-user', email: 'teacher-hub@example.test' },
      } });
      return;
    }
    if (waitForLogout) await waitForLogout;
    await route.fulfill({ status: 204 });
  });
}

const hub = (page) => page.locator('.mini-hub-sheet');
const backdrops = (page) => page.locator('.sheet-backdrop');

async function openHub(page) {
  await page.locator('.teacher-mini-hub-trigger, .topbar__teacher-btn').filter({ visible: true }).click();
  await expect(hub(page)).toHaveCount(1);
  await expect(backdrops(page)).toHaveCount(1);
}

async function rememberHubSurface(page) {
  return page.locator('.sheet-backdrop').first().evaluate((node) => {
    window.__teacherHubSurfaceForTest = node;
    return node.isConnected;
  });
}

async function expectSameHubSurface(page) {
  expect(await page.locator('.sheet-backdrop').first().evaluate((node) =>
    node === window.__teacherHubSurfaceForTest && node.isConnected,
  )).toBe(true);
}

async function loginFromHub(page) {
  await page.locator('[data-act="mini-hub-login"]').click();
  await expect(backdrops(page)).toHaveCount(2);
  await expectSameHubSurface(page);
  const loginSheet = backdrops(page).last();
  await loginSheet.locator('input[name="email"]').fill('teacher-hub@example.test');
  await loginSheet.locator('input[name="password"]').fill('fictional-password');
  await loginSheet.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(hub(page)).toHaveCount(1);
  await expect(backdrops(page)).toHaveCount(1);
  await expectSameHubSurface(page);
  await expect(hub(page)).toContainText('teacher-hub@example.test');
}

async function closeHub(page) {
  await hub(page).locator('[data-sheet-close]').first().click();
  await expect(hub(page)).toHaveCount(0);
  await expect(backdrops(page)).toHaveCount(0);
}

test('Teacher Hub auth transitions update the same Hub surface without stacking sheets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockAuth(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);

  await openHub(page);
  await rememberHubSurface(page);
  await loginFromHub(page);
  await closeHub(page);

  await openHub(page);
  await rememberHubSurface(page);
  await page.locator('[data-act="mini-hub-logout"]').click();
  await expect(hub(page)).toHaveCount(1);
  await expect(backdrops(page)).toHaveCount(1);
  await expect(hub(page)).toContainText('غير مسجل الدخول');
  await expectSameHubSurface(page);
  await closeHub(page);

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await openHub(page);
    await rememberHubSurface(page);
    await loginFromHub(page);
    await page.locator('[data-act="mini-hub-logout"]').click();
    await expect(hub(page)).toHaveCount(1);
    await expect(backdrops(page)).toHaveCount(1);
    await expectSameHubSurface(page);
    await closeHub(page);
  }

  expect(errors).toEqual([]);
});

test('Teacher Hub keeps its surface usable when login is cancelled or rejected', async ({ page }) => {
  await mockAuth(page, { rejectLogin: true });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);

  await openHub(page);
  await rememberHubSurface(page);
  await page.locator('[data-act="mini-hub-login"]').click();
  await backdrops(page).last().locator('[data-sheet-close]').first().click();
  await expect(backdrops(page)).toHaveCount(1);
  await expectSameHubSurface(page);
  await expect(hub(page).locator('[data-act="mini-hub-login"]')).toBeVisible();

  await page.locator('[data-act="mini-hub-login"]').click();
  const loginSheet = backdrops(page).last();
  await loginSheet.locator('input[name="email"]').fill('teacher-hub@example.test');
  await loginSheet.locator('input[name="password"]').fill('wrong-password');
  await loginSheet.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(loginSheet.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled();
  await expectSameHubSurface(page);
  await loginSheet.locator('[data-sheet-close]').first().click();
  await closeHub(page);
});

test('Teacher Hub remains mounted while logout is pending', async ({ page }) => {
  let releaseLogout;
  const logoutGate = new Promise((resolve) => { releaseLogout = resolve; });
  await mockAuth(page, { waitForLogout: logoutGate });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);

  await openHub(page);
  await rememberHubSurface(page);
  await loginFromHub(page);
  await page.locator('[data-act="mini-hub-logout"]').click();
  await expect(hub(page)).toContainText('جارٍ تسجيل الخروج...');
  await expectSameHubSurface(page);
  releaseLogout();
  await expect(hub(page)).toContainText('غير مسجل الدخول');
  await expect(backdrops(page)).toHaveCount(1);
  await expectSameHubSurface(page);
  await closeHub(page);
});

test('Teacher Hub auth transitions remain single-sheet on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuth(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);

  await openHub(page);
  await rememberHubSurface(page);
  await loginFromHub(page);
  await page.locator('[data-act="mini-hub-logout"]').click();
  await expect(hub(page)).toHaveCount(1);
  await expect(backdrops(page)).toHaveCount(1);
  await closeHub(page);
});
