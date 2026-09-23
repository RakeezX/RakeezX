import { test, expect } from '@playwright/test';

test.describe('Grades Page Polish (Ticket 03)', () => {
  test('Green CTA for توزيع الدرجات is discoverable and navigates to items distribution', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    await page.locator('.class-card__main').first().click();

    // Navigate to Grades page
    await page.locator('.class-context-nav').getByRole('link', { name: 'كشف الدرجات' }).click();

    // Check distribution CTA
    const cta = page.locator('.grades-distribution-action');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('توزيع الدرجات');

    // Verify it uses brand green styling
    const bgColor = await cta.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    // #18A878 in rgb is rgb(24, 168, 120)
    expect(bgColor).toMatch(/rgb\(24,\s*168,\s*120\)/);

    // Click CTA and verify navigation
    await cta.click();
    await expect(page.locator('.topbar__title')).toHaveText('توزيع الدرجات');
  });

  const viewports = [
    { width: 1440, height: 900, name: '1440px' },
    { width: 1024, height: 768, name: '1024px' },
    { width: 430, height: 932, name: '430px' },
    { width: 390, height: 844, name: '390px' },
    { width: 350, height: 700, name: '350px' },
    { width: 320, height: 600, name: '320px' },
  ];

  for (const vp of viewports) {
    test(`Assessment item tabs stay usable without page overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/#/classes');
      await page.waitForFunction(() => window.store?.state?.ready === true);
      await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
      await page.locator('.class-card__main').first().click();
      await page.locator('.class-context-nav').getByRole('link', { name: 'كشف الدرجات' }).click();

      const nav = page.getByRole('tablist', { name: 'بنود التقييم' });
      await expect(nav).toBeVisible();

      const buttons = nav.getByRole('tab');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(2);
      await expect(buttons.first()).toHaveAttribute('aria-selected', 'true');

      // Verify no horizontal overflow of the page
      const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const docClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(docScrollWidth).toBeLessThanOrEqual(docClientWidth + 1);

      const geometry = await nav.evaluate((el) => ({ width: el.clientWidth, content: el.scrollWidth }));
      expect(geometry.width).toBeGreaterThan(0);
      expect(geometry.content).toBeGreaterThanOrEqual(geometry.width);
      const firstBox = await buttons.first().boundingBox();
      expect(firstBox?.height).toBeGreaterThanOrEqual(42);

      // Verify active tab switching
      const secondBtn = buttons.nth(1);
      await secondBtn.click();
      await expect(secondBtn).toHaveClass(/is-active/);
      expect(await secondBtn.getAttribute('aria-selected')).toBe('true');
    });
  }

  test('Assessment tabs track the live item count after item deletion', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    await page.locator('.class-card__main').first().click();

    // Navigate to Items page to set exactly 2 items
    await page.locator('.class-context-nav').getByRole('link', { name: 'كشف الدرجات' }).click();
    await page.locator('.grades-distribution-action').click();

    // Verify we can modify items and then go back to grades to check 2-category layout
    const teachingId = await page.evaluate(() => window.store.state.teachings[0]?.id);
    await page.evaluate(async (tId) => {
      // Keep only 2 items
      const currentItems = window.store.state.items.filter(i => i.teachingId === tId && !i.deleted);
      if (currentItems.length > 2) {
        for (let i = 2; i < currentItems.length; i++) {
          await window.store.deleteItem(currentItems[i].id);
        }
      }
    }, teachingId);

    await page.goto(`/#/teaching/${teachingId}/grades`);
    const nav2 = page.getByRole('tablist', { name: 'بنود التقييم' });
    await expect(nav2).toBeVisible();
    const btns2 = nav2.getByRole('tab');
    await expect(btns2).toHaveCount(2);
    await btns2.nth(1).click();
    await expect(btns2.nth(1)).toHaveAttribute('aria-selected', 'true');
  });
});
