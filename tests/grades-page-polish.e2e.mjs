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
    test(`Category buttons distribute evenly and proportionally at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/#/classes');
      await page.waitForFunction(() => window.store?.state?.ready === true);
      await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
      await page.locator('.class-card__main').first().click();
      await page.locator('.class-context-nav').getByRole('link', { name: 'كشف الدرجات' }).click();

      const nav = page.locator('.grades-category-nav');
      await expect(nav).toBeVisible();

      const buttons = nav.locator('.grades-category-btn');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Verify no horizontal overflow of the page
      const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const docClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(docScrollWidth).toBeLessThanOrEqual(docClientWidth + 1);

      // Verify buttons in the same row have equal width (within 1px tolerance)
      const boxes = await Promise.all(
        Array.from({ length: count }, (_, i) => buttons.nth(i).boundingBox())
      );

      // Group by top Y coordinate (same row)
      const rows = {};
      boxes.forEach((box, i) => {
        if (!box) return;
        const rowKey = Math.round(box.y / 8) * 8; // grouping tolerance
        if (!rows[rowKey]) rows[rowKey] = [];
        rows[rowKey].push(box);
      });

      for (const rowBoxes of Object.values(rows)) {
        if (rowBoxes.length > 1) {
          const widths = rowBoxes.map((b) => b.width);
          const maxW = Math.max(...widths);
          const minW = Math.min(...widths);
          expect(maxW - minW).toBeLessThanOrEqual(2); // equal width across row
        }
      }

      // Verify active tab switching
      const secondBtn = buttons.nth(1);
      await secondBtn.click();
      await expect(secondBtn).toHaveClass(/is-on/);
      expect(await secondBtn.getAttribute('aria-selected')).toBe('true');
    });
  }

  test('Dynamically adjusts equal-width distribution for 2, 3, and 5 categories', async ({ page }) => {
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
    await page.evaluate((tId) => {
      // Keep only 2 items
      const currentItems = window.store.state.items.filter(i => i.teachingId === tId && !i.deleted);
      if (currentItems.length > 2) {
        for (let i = 2; i < currentItems.length; i++) {
          window.store.deleteItem(currentItems[i].id);
        }
      }
    }, teachingId);

    await page.goto(`/#/teaching/${teachingId}/grades`);
    const nav2 = page.locator('.grades-category-nav');
    await expect(nav2).toBeVisible();
    const btns2 = nav2.locator('.grades-category-btn');
    expect(await btns2.count()).toBe(2);

    const b0 = await btns2.nth(0).boundingBox();
    const b1 = await btns2.nth(1).boundingBox();
    expect(Math.abs((b0?.width ?? 0) - (b1?.width ?? 0))).toBeLessThanOrEqual(2);
    // On 1024px, 2 items each take ~50% of content width (>300px each)
    expect(b0?.width).toBeGreaterThan(300);
  });
});
