import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { STORES } from '../src/lib/db.js';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { createDemoDataset } from '../src/lib/demo-workspace.js';

test.setTimeout(120_000);

const output = 'test-results/0275-strict-work-fidelity';
const AUTH_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AUTH_SESSION = {
  access_token: 'visual-auth-token', refresh_token: 'visual-auth-refresh', expires_at: 4_102_444_800,
  user: { id: AUTH_OWNER, email: 'visual-review@example.test' },
};

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function expectAligned(page, primary, secondary) {
  const [primaryTop, secondaryTop] = await Promise.all([
    page.locator(primary).evaluate((node) => node.getBoundingClientRect().top),
    page.locator(secondary).evaluate((node) => node.getBoundingClientRect().top),
  ]);
  expect(Math.abs(primaryTop - secondaryTop)).toBeLessThanOrEqual(1);
}

async function enterDemo(page) {
  const action = page.getByRole('button', { name: 'جرّب ركيز', exact: true });
  if (!await action.isVisible().catch(() => false)) {
    await page.locator('.topbar__teacher-btn--home-account:visible').click();
  }
  await action.click();
  await expect(page.locator('[data-demo-indicator]:visible')).toHaveCount(1);
  await expect(page.locator('.home-dashboard')).toBeVisible();
}

async function seedAuthenticatedVisualWorkspace(page) {
  const snapshot = createDemoDataset();
  snapshot.profile[0] = { ...snapshot.profile[0], teacherName: 'نورة الاختبار', teacherForm: 'feminine' };
  snapshot.device[0] = {
    ...snapshot.device[0], deviceId: 'device:visual-auth',
    workspaceClaim: {
      version: 1, claimId: 'claim:visual-auth', state: 'claimed', ownerId: AUTH_OWNER,
      origin: 'http://127.0.0.1:5173', databaseName: 'rakeezx', deviceId: 'device:visual-auth',
      evidenceHash: 'visual-auth-evidence', createdAt: 100, updatedAt: 100,
    },
  };
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => route.fulfill({ json: AUTH_SESSION.user }));
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/account_contract`, (route) => route.fulfill({ json: {
    ownerId: AUTH_OWNER, profileStatus: 'READY',
    profile: { teacherName: 'نورة الاختبار', phone: '0500000000', teacherForm: 'feminine', schoolName: 'مدرسة الاختبار' },
    access: { grantType: 'beta_full', status: 'active', source: 'public_beta', expiresAt: null },
  } }));
  await page.route('**/__visual_auth_fixture__', (route) => route.fulfill({ body: '<!doctype html><title>fixture</title>' }));
  await page.goto('/__visual_auth_fixture__');
  await page.evaluate(async ({ stores, owner, authKey, session, data }) => {
    const result = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const done = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const productRequest = indexedDB.open('rakeezx', 7);
    productRequest.onupgradeneeded = () => stores.forEach((name) => {
      if (!productRequest.result.objectStoreNames.contains(name)) productRequest.result.createObjectStore(name, { keyPath: 'id' });
    });
    const product = await result(productRequest);
    const productTx = product.transaction(stores, 'readwrite');
    for (const [storeName, rows] of Object.entries(data)) {
      for (const row of rows) productTx.objectStore(storeName).put(row);
    }
    await done(productTx); product.close();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rakeezx-workspace-v1:${owner}`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const registryRequest = indexedDB.open('rakeezx-workspace-registry', 1);
    registryRequest.onupgradeneeded = () => {
      const workspaceStore = registryRequest.result.createObjectStore('workspaces', { keyPath: 'id' });
      workspaceStore.createIndex('authUserId', 'authUserId', { unique: false });
    };
    const registry = await result(registryRequest);
    const registryTx = registry.transaction('workspaces', 'readwrite');
    registryTx.objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: owner, databaseName: 'rakeezx', ownershipState: 'claimed',
      workspaceKind: 'legacy-in-place', claimId: 'claim:visual-auth', evidenceHash: 'visual-auth-evidence',
      createdAt: 100, updatedAt: 100,
    });
    await done(registryTx); registry.close();
    localStorage.setItem(authKey, JSON.stringify(session));
  }, { stores: STORES, owner: AUTH_OWNER, authKey: AUTH_STORAGE_KEY, session: AUTH_SESSION, data: snapshot });
  await page.unroute('**/__visual_auth_fixture__');
}

test.beforeEach(async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.clock.setFixedTime(new Date('2026-09-21T07:00:00+03:00'));
});

test('authenticated Home renders the Work composition with real synthetic Product bindings', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedAuthenticatedVisualWorkspace(page);
  await page.goto('/');
  await expect(page.locator('.home-dashboard')).toBeVisible();
  await expect(page.locator('.topbar__teacher-btn--home-account')).toContainText('نورة الاختبار');
  await expect(page.locator('.hero__hello')).toHaveText(/^(صباح الخير، أستاذة|أهلاً، أستاذة) نورة الاختبار$/);
  await expect(page.locator('.today-focus')).toHaveCount(1);
  if (await page.locator('[data-act="home-pwa-dismiss"]').isVisible().catch(() => false)) {
    await page.locator('[data-act="home-pwa-dismiss"]').click();
  }
  await page.screenshot({ path: `${output}/codex-desktop-1440-authenticated-home-light.png`, fullPage: true, animations: 'disabled' });
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('desktop shell and Home preserve real routes while matching the approved hierarchy', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await enterDemo(page);

  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBeCloseTo(248, 0);
  await expect(sidebar.locator('.sidebar__section-label')).toHaveCount(0);
  await expect(sidebar.locator('.sidebar__item')).toHaveCount(6);
  await expect(sidebar.locator('.sidebar__item[aria-current="page"]')).toContainText('الرئيسية');

  const topbar = page.locator('.topbar');
  await expect(topbar).toBeVisible();
  expect(await topbar.evaluate((node) => getComputedStyle(node).position)).toBe('sticky');
  expect((await page.locator('.page').boundingBox()).width).toBeLessThanOrEqual(1240);

  await expect(page.locator('.today-focus')).toHaveCount(1);
  await expect(page.locator('.home-sessions')).toBeVisible();
  await expect(page.locator('.home-shortcuts .tile')).toHaveCount(4);
  await expect(page.locator('.home-summary')).toBeVisible();
  await expect(page.locator('.home-hero__eyebrow')).toHaveCount(0);
  await expect(page.locator('.topbar__page > small')).toHaveCount(0);
  await expect(page.getByText('مساحة العمل', { exact: true })).toHaveCount(0);
  await expect(page.locator('.home-summary__stats .stat')).toHaveCount(3);
  await expect(page.locator('.home-summary__stats')).toContainText('فصول');
  await expect(page.locator('.home-summary__stats')).toContainText('طالبًا');
  await expect(page.locator('.home-summary__stats')).toContainText('حضور الأسبوع');
  await expect(page.locator('.home-day-progress')).toContainText('تقدم اليوم');
  await expect(page.locator('.home-day-progress')).toContainText(/\d+ من \d+ حصص/);
  await expect(page.locator('.home-dashboard__aside')).toBeVisible();
  expect(await page.locator('.home-dashboard').evaluate((node) => getComputedStyle(node).gridTemplateColumns !== 'none')).toBe(true);
  await expect(page.locator('.demo-mode-banner')).toHaveCount(0);
  await expect(page.locator('.demo-pill--desktop')).toBeVisible();
  await expectAligned(page, '.today-focus', '.home-shortcuts');
  const shortcutGeometry = await page.locator('.home-shortcuts .tile').first().evaluate((node) => {
    const icon = node.querySelector('.tile__icon').getBoundingClientRect();
    const copy = node.querySelector('.tile__copy').getBoundingClientRect();
    const card = node.getBoundingClientRect();
    return { height: card.height, icon: [icon.width, icon.height], copyTop: copy.top, cardTop: card.top };
  });
  expect(shortcutGeometry.height).toBe(66);
  expect(shortcutGeometry.icon).toEqual([38, 38]);
  expect(shortcutGeometry.copyTop).toBeGreaterThan(shortcutGeometry.cardTop);

  const routeHrefs = await sidebar.locator('.sidebar__item').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(routeHrefs).toEqual(['#/', '#/classes', '#/schedule', '#/reports', '#/calendar', '#/settings']);
  await noOverflow(page);

  await expect(page.locator('.home-pwa-prompt')).toBeVisible();
  await page.screenshot({ path: `${output}/codex-desktop-1440-install-light.png`, fullPage: true, animations: 'disabled' });
  await page.locator('[data-act="home-pwa-dismiss"]').click();
  await expect(page.locator('.home-pwa-prompt')).toHaveCount(0);

  await page.evaluate(async () => { await window.store.patchDevice({ theme: 'light' }, { queue: false }); window.store.applyTheme(); });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: `${output}/codex-desktop-1440-demo-light.png`, fullPage: true, animations: 'disabled' });
  await page.locator('.home-summary').screenshot({ path: `${output}/codex-desktop-1440-summary-closeup.png`, animations: 'disabled' });
  await page.locator('.home-shortcuts').screenshot({ path: `${output}/codex-desktop-1440-shortcuts-closeup.png`, animations: 'disabled' });
  await page.locator('.home-hero').screenshot({ path: `${output}/codex-desktop-1440-greeting-closeup.png`, animations: 'disabled' });
  await page.evaluate(async () => { await window.store.patchDevice({ theme: 'dark' }, { queue: false }); window.store.applyTheme(); });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await noOverflow(page);
  await page.screenshot({ path: `${output}/codex-desktop-1440-demo-dark.png`, fullPage: true, animations: 'disabled' });
  await page.evaluate(async () => { await window.store.patchDevice({ theme: 'light' }, { queue: false }); window.store.applyTheme(); });

  await page.evaluate(() => {
    window.store.state.sessions.splice(0);
    window.store.repaint();
  });
  await expect(page.getByRole('heading', { name: 'لا توجد حصص اليوم' })).toBeVisible();
  await expectAligned(page, '.today-empty-card', '.home-shortcuts');
  await page.screenshot({ path: `${output}/codex-desktop-1440-no-sessions-light.png`, fullPage: true, animations: 'disabled' });

  await page.evaluate(() => {
    window.store.state.teachings.splice(0);
    window.store.state.sessions.splice(0);
    window.store.repaint();
  });
  await expect(page.getByRole('heading', { name: 'أنشئ فصلك الأول' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'لا توجد حصص بعد' })).toBeVisible();
  await expectAligned(page, '.home-onboarding', '.home-shortcuts');
  await page.screenshot({ path: `${output}/codex-desktop-1440-setup-light.png`, fullPage: true, animations: 'disabled' });

  await sidebar.locator('.sidebar__item').nth(1).focus();
  await expect(sidebar.locator('.sidebar__item').nth(1)).toBeFocused();
  expect((await new AxeBuilder({ page }).include('.layout').analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);

  await page.locator('.topbar__teacher-btn--home-account').click();
  await expect(page.locator('.topbar__teacher-btn--home-account')).toContainText('تسجيل الدخول');
  await expect(page.getByRole('heading', { name: 'أنشئ فصلك الأول' })).toBeVisible();
  await page.screenshot({ path: `${output}/codex-desktop-1440-signed-out-light.png`, fullPage: true, animations: 'disabled' });
});

test('mobile shell keeps the approved five real destinations usable at 390, 360 and 320', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await enterDemo(page);
  if (await page.locator('[data-act="home-pwa-dismiss"]').isVisible().catch(() => false)) {
    await page.locator('[data-act="home-pwa-dismiss"]').click();
  }

  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.sidebar')).toBeHidden();
    const items = page.locator('.tabbar__item');
    await expect(items).toHaveCount(5);
    expect(await items.evaluateAll((nodes) => nodes.map((node) => ({
      label: node.textContent.trim(), href: node.getAttribute('href'), height: node.getBoundingClientRect().height,
    })))).toEqual([
      { label: 'الرئيسية', href: '#/', height: 62 },
      { label: 'الفصول', href: '#/classes', height: 62 },
      { label: 'الجدول', href: '#/schedule', height: 62 },
      { label: 'التقارير', href: '#/reports', height: 62 },
      { label: 'التقويم', href: '#/calendar', height: 62 },
    ]);
    await expect(page.locator('.home-shortcuts .tile')).toHaveCount(4);
    await noOverflow(page);
    expect(await page.locator('.home-summary .stat').count()).toBe(3);
    expect(await page.locator('.home-summary .grid--3').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(3);
    if (width === 390) await page.screenshot({ path: `${output}/codex-mobile-390-demo-light.png`, fullPage: true, animations: 'disabled' });
    if (width === 320) await page.screenshot({ path: `${output}/codex-mobile-320-demo-light.png`, fullPage: true, animations: 'disabled' });
  }

  await page.locator('.tabbar__item[href="#/schedule"]').click();
  await expect(page).toHaveURL(/#\/schedule$/);
  await expect(page.getByRole('heading', { name: /^الجدول/ })).toBeVisible();
  await page.locator('.tabbar__item[href="#/"]').click();
  await expect(page.locator('.home-dashboard')).toBeVisible();
  await expect(page.locator('[data-demo-indicator]:visible')).toContainText('تجريبي');
  await noOverflow(page);
  expect(errors).toEqual([]);
});
