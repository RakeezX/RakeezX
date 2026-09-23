import { test, expect } from '@playwright/test';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const OWNER = '55555555-5555-4555-8555-555555555555';
const session = {
  access_token: 'initial-restore-access', refresh_token: 'initial-restore-refresh',
  expires_at: 4_102_444_800, user: { id: OWNER, email: 'restore@example.test' },
};

async function installAuth(page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: AUTH_STORAGE_KEY, value: session,
  });
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/user')) return route.fulfill({ json: session.user });
    return route.fulfill({ status: 204 });
  });
}

async function installRestoreCloud(page, { manifest, delayManifest = false } = {}) {
  let releaseManifest;
  const manifestWaiting = new Promise((resolve) => { releaseManifest = resolve; });
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/rpc/score_foundation_capability')) {
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith('/rpc/sync_v2_restore_manifest_full')) {
      if (delayManifest) await manifestWaiting;
      return route.fulfill({ json: manifest });
    }
    if (url.pathname.endsWith('/profile')) {
      return route.fulfill({ json: [{
        owner_id: OWNER, revision: 7, field_revisions: {}, deleted_at: null,
        teacher_name: 'معلّم الاستعادة', school_name: 'مدرسة الاستعادة', phone: null,
        report_principal_name: null, active_time_profile_id: null, client_updated_at: 100,
      }] });
    }
    return route.fulfill({ json: [] });
  });
  return releaseManifest;
}

test('fresh Account A stays gated until actual CORE_V1 restore completes and then mounts A', async ({ page }, testInfo) => {
  await installAuth(page);
  const releaseManifest = await installRestoreCloud(page, {
    manifest: [{ entity: 'profile', id: 'profile', revision: 7, deleted: false }],
    delayManifest: true,
  });
  await page.addInitScript(() => {
    window.__restoreVisualTransitions = JSON.parse(sessionStorage.getItem('__restoreVisualTransitions') ?? '[]');
    let firstCard = null;
    const record = () => {
      const root = document.querySelector('[data-initial-restore-state]');
      const card = root?.querySelector('.first-run-card');
      const state = root?.dataset.initialRestoreState;
      if (!root || !card || window.__restoreVisualTransitions.some((entry) => entry.state === state)) return;
      firstCard ||= card;
      window.__restoreVisualTransitions.push({
        state,
        heading: root.querySelector('h1')?.textContent,
        progress: root.querySelector('[data-restore-progress]')?.textContent,
        sameCard: card === firstCard,
      });
      sessionStorage.setItem('__restoreVisualTransitions', JSON.stringify(window.__restoreVisualTransitions));
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true, attributes: true });
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/');
  const preflight = page.locator('[data-initial-restore-state="RESTORE_PREFLIGHT"]');
  await expect(preflight).toBeVisible();
  await expect(preflight.locator('.first-run-card')).toBeVisible();
  await expect(preflight.getByRole('heading', { name: 'جارٍ تجهيز مساحة حسابك' })).toBeVisible();
  await expect(preflight.locator('[data-restore-progress]')).toHaveText('جارٍ التحقق من بيانات الحساب...');
  await page.screenshot({ path: testInfo.outputPath('first-run-restore-loading.png'), fullPage: true });
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(false);
  releaseManifest();
  await expect(page.locator('.topbar__title')).toBeVisible({ timeout: 15_000 });
  const transitions = await page.evaluate(() => window.__restoreVisualTransitions);
  expect(transitions).toEqual(expect.arrayContaining([
    expect.objectContaining({ state: 'RESTORE_PREFLIGHT', heading: 'جارٍ تجهيز مساحة حسابك', progress: 'جارٍ التحقق من بيانات الحساب...', sameCard: true }),
    expect.objectContaining({ state: 'RESTORING', heading: 'جارٍ تجهيز مساحة حسابك', progress: 'جارٍ تجهيز مساحة العمل...', sameCard: true }),
    expect.objectContaining({ state: 'RESTORE_FINALIZING', heading: 'جارٍ تجهيز مساحة حسابك', progress: 'أوشكنا على الانتهاء...', sameCard: true }),
  ]));
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(true);
  expect(await page.evaluate(() => window.store.getActiveWorkspace())).toMatchObject({
    type: 'account', authUserId: OWNER, ownershipState: 'claimed', syncEligible: true,
  });
  expect(await page.evaluate(() => window.store.state.profile.teacherName)).toBe('معلّم الاستعادة');
  expect(await page.evaluate(async () => {
    const databaseName = window.store.getActiveWorkspace().databaseName;
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = database.transaction(['units', 'lessons', 'assignments', 'submissions'], 'readonly');
      const result = {};
      let left = 4;
      for (const name of ['units', 'lessons', 'assignments', 'submissions']) {
        const read = request.objectStore(name).getAll();
        read.onsuccess = () => { result[name] = read.result; if (--left === 0) resolve(result); };
        read.onerror = () => reject(read.error);
      }
    });
    database.close();
    return rows;
  })).toEqual({ units: [], lessons: [], assignments: [], submissions: [] });
  expect(errors).toEqual([]);
});

test('authoritative zero-row core manifest shows provisioning-required without editable Home', async ({ page }) => {
  await installAuth(page);
  await installRestoreCloud(page, { manifest: [] });
  await page.goto('/#/');
  const provisioning = page.locator('[data-initial-restore-state="PROVISIONING_REQUIRED"]');
  await expect(provisioning).toBeVisible();
  await expect(provisioning.getByRole('heading', { name: 'لا توجد مساحة عمل قابلة للاستعادة' })).toBeVisible();
  await expect(provisioning.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
  await expect(provisioning.getByRole('link', { name: 'الدعم' })).toHaveAttribute('href', 'mailto:support@rakeezx.com');
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(false);
  await expect(page.locator('.topbar__title')).toHaveCount(0);
});

test('fresh offline account remains gated and cannot create an account workspace', async ({ page }) => {
  await installAuth(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.goto('/#/');
  const offline = page.locator('[data-initial-restore-state="RESTORE_REQUIRES_ONLINE"]');
  await expect(offline).toBeVisible();
  await expect(offline.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible();
  await expect(offline.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
  await expect(offline.getByRole('link', { name: 'الدعم' })).toBeVisible();
  expect(await page.evaluate(() => window.store?.state?.ready)).toBe(false);
  const databases = await page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name));
  expect(databases.some((name) => name?.startsWith('rakeezx-user-'))).toBe(false);
});
