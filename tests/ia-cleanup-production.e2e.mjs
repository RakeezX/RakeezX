import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 680, columns: 1 },
  { width: 350, height: 740, columns: 1 },
  { width: 390, height: 844, columns: 2 },
  { width: 430, height: 860, columns: 2 },
  { width: 1024, height: 768, columns: 2 },
]) {
  test(`IA cleanup keeps class workspace usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    const grid = page.locator('.class-cards-grid');
    await expect(grid).toBeVisible();
    await expect(page.locator('.class-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const columnCount = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(columnCount).toBe(viewport.columns);
    await page.locator('.class-card__main').first().click();
    const tabs = page.locator('.class-context-nav__item');
    await expect(tabs).toHaveCount(5);
    expect((await tabs.allTextContents()).map((text) => text.trim())).toEqual(['الفصل', 'الحضور', 'الحصص', 'كشف الدرجات', 'الطلاب']);
    await expect(page.locator('.class-name-switcher-btn')).toBeVisible();
    await page.getByRole('button', { name: 'تبديل الفصل' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'كل الفصول' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}

test('Home omits the persistent profile prompt and retains the timing indicator', async ({ page }) => {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.locator('.welcome__title')).toHaveCount(0);
  await expect(page.locator('.hub-head__timing-pill')).toBeVisible();
});
