import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test.setTimeout(120_000);

const output = 'test-results/0275-strict-work-fidelity';

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

test.beforeEach(async () => {
  await mkdir(output, { recursive: true });
});

test('desktop shell and Home preserve real routes while matching the approved hierarchy', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await enterDemo(page);

  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBeCloseTo(248, 0);
  await expect(sidebar.locator('.sidebar__section-label')).toHaveText(['مساحة العمل', 'النظام']);
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
  await expect(page.locator('.home-dashboard__aside')).toBeVisible();
  expect(await page.locator('.home-dashboard').evaluate((node) => getComputedStyle(node).gridTemplateColumns !== 'none')).toBe(true);
  await expect(page.locator('.demo-mode-banner')).toHaveCount(0);
  await expect(page.locator('.demo-pill--desktop')).toBeVisible();
  await expectAligned(page, '.today-focus', '.home-shortcuts');

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
