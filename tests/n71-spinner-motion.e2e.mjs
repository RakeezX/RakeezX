import { test, expect } from '@playwright/test';
import { webkit } from 'playwright';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const OWNER = '71717171-7171-4171-8171-717171717171';
const SESSION = { access_token: 'synthetic-spinner-token', refresh_token: 'synthetic-spinner-refresh',
  expires_at: 4_102_444_800, user: { id: OWNER, email: 'spinner@example.test' } };

test.use({ serviceWorkers: 'block' });

async function configurePendingPreparation(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: AUTH_STORAGE_KEY, value: SESSION });
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ json: pathname.endsWith('/user') ? SESSION.user : {} });
  });

  let releaseProvisioning;
  const provisioningHeld = new Promise((resolve) => { releaseProvisioning = resolve; });
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/rpc/account_contract')) {
      return route.fulfill({ json: { ownerId: OWNER, profileStatus: 'READY',
        profile: { teacherName: 'معلمة اصطناعية', phone: '', teacherForm: 'feminine', schoolName: '' },
        access: { grantType: 'beta_full', status: 'active' },
        provisioning: { state: 'PROVISIONING_REQUIRED', version: 1, foundationHash: null } } });
    }
    if (pathname.endsWith('/rpc/begin_account_provisioning')) {
      await provisioningHeld;
      return route.fulfill({ json: { ownerId: OWNER, profileStatus: 'READY',
        profile: { teacherName: 'معلمة اصطناعية', phone: '', teacherForm: 'feminine', schoolName: '' },
        access: { grantType: 'beta_full', status: 'active' },
        provisioning: { state: 'PROVISIONING', version: 1, foundationHash: null } } });
    }
    return route.fulfill({ json: [] });
  });

  return releaseProvisioning;
}

async function verifySpinner(page, url = '/#/') {
  await page.goto(url);
  const status = page.locator('[data-initial-restore-state="PROVISIONING"]');
  await expect(status).toBeVisible();
  const spinner = status.locator('.first-run-status__spinner');
  await expect(spinner).toBeVisible();
  await expect(status.getByText('جارٍ تجهيز مساحة العمل...', { exact: true })).toBeVisible();
  const motion = await page.evaluate(async () => {
    const element = document.querySelector('.first-run-status__spinner');
    const animation = element.getAnimations()[0];
    const before = getComputedStyle(element).transform;
    await new Promise((resolve) => setTimeout(resolve, 180));
    const after = getComputedStyle(element).transform;
    return { name: animation?.animationName, playState: animation?.playState, before, after,
      width: innerWidth };
  });
  expect(motion.width).toBe(390);
  expect(motion.name).toBe('first-run-status-spinner-rotate');
  expect(motion.playState).toBe('running');
  expect(motion.before).not.toBe(motion.after);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => spinner.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await expect(status.getByText('جارٍ تجهيز مساحة العمل...', { exact: true })).toBeVisible();
}

test('first-account preparation spinner rotates on mobile in Chromium and WebKit, respecting reduced motion', async ({ page }) => {
  const releaseChromium = await configurePendingPreparation(page);
  let webkitBrowser;
  let webkitPage;
  let releaseWebkit;
  try {
    await verifySpinner(page);
    webkitBrowser = await webkit.launch({ headless: true });
    const webkitContext = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 },
      serviceWorkers: 'block' });
    webkitPage = await webkitContext.newPage();
    releaseWebkit = await configurePendingPreparation(webkitPage);
    await verifySpinner(webkitPage, new URL('/#/', page.url()).href);
  } finally {
    await page.close();
    await webkitPage?.close();
    releaseChromium();
    releaseWebkit?.();
    await webkitBrowser?.close();
  }
});
