import { test, expect } from '@playwright/test';

const viewports = [
  { width: 320, height: 680, columns: 1 },
  { width: 350, height: 740, columns: 1 },
  { width: 390, height: 844, columns: 2 },
  { width: 430, height: 860, columns: 2 },
  { width: 1024, height: 768, columns: 2 },
  { width: 1440, height: 900, columns: 2 },
];

for (const viewport of viewports) {
  test(`IA cleanup keeps class workspace usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    const grid = page.locator('.class-cards-grid');
    await expect(grid).toBeVisible();
    const cards = page.locator('.class-card');
    await expect(cards).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const columnCount = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(columnCount).toBe(viewport.columns);
    if (viewport.columns === 2) {
      const [first, second] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(Math.abs(first.x - second.x) - first.width).toBeGreaterThanOrEqual(8);
    }
    await cards.nth(0).locator('.class-card__main').click();
    const tabs = page.locator('.class-context-nav__item');
    await expect(tabs).toHaveCount(5);
    expect((await tabs.allTextContents()).map((text) => text.trim())).toEqual(['الفصل', 'الحضور', 'الحصص', 'كشف الدرجات', 'الطلاب']);
    const trigger = page.getByRole('button', { name: 'تبديل الفصل' });
    await expect(trigger).toBeVisible();
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.height).toBeGreaterThanOrEqual(40);
    const headerChevron = trigger.locator('svg');
    const headerChevronBox = await headerChevron.boundingBox();
    expect(headerChevronBox?.width).toBeLessThanOrEqual(18);
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.class-switcher-option.is-current')).toHaveCount(1);
    await expect(dialog.locator('.class-switcher-option')).toHaveCount(2);
    for (const box of await dialog.locator('.class-switcher-option svg').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()))) {
      expect(box.width).toBeLessThanOrEqual(20);
      expect(box.height).toBeLessThanOrEqual(20);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}

test('Home timing indicator stays compact without a giant SVG', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.locator('.welcome__title')).toHaveCount(0);
  const pill = page.locator('.hub-head__timing-pill');
  const timingIcon = page.locator('.hub-head__timing-icon svg');
  await expect(pill).toBeVisible();
  const [pillBox, iconBox] = await Promise.all([pill.boundingBox(), timingIcon.boundingBox()]);
  expect(pillBox?.height).toBeLessThanOrEqual(32);
  expect(iconBox?.width).toBeLessThanOrEqual(16);
  expect(iconBox?.height).toBeLessThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollHeight < 1200)).toBe(true);
});

test('Class workspace pages share a wide shell and Grades exposes distribution as secondary action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
  const href = await page.locator('.class-card__main').getAttribute('href');
  const widths = [];
  for (const suffix of ['', '/attendance', '/sessions', '/grades', '/students']) {
    await page.goto('/#' + href.slice(1) + suffix);
    await expect(page.locator('.page--class-workspace')).toBeVisible();
    widths.push((await page.locator('.page--class-workspace').boundingBox()).width);
  }
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  await page.goto('/#' + href.slice(1) + '/grades');
  await expect(page.getByRole('link', { name: 'توزيع الدرجات' })).toBeVisible();
  await page.goto('/#' + href.slice(1) + '/items');
  await expect(page.locator('.topbar__title')).toHaveText('توزيع الدرجات');
});