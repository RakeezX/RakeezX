import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 680, label: '320px' },
  { width: 390, height: 844, label: '390px' },
  { width: 1024, height: 768, label: 'desktop' },
]) {
  test(`Demo class deletion stays confirmed and compact — ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    const deleteButton = page.getByRole('button', { name: 'حذف الفصل التجريبي' });
    await expect(deleteButton).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    if (viewport.width <= 540) {
      const box = await deleteButton.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(36);
      await expect(deleteButton.locator('.class-demo-del-btn__label')).toBeHidden();
    } else {
      await expect(deleteButton.locator('.class-demo-del-btn__label')).toHaveText('حذف');
    }
    await deleteButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
    await expect(deleteButton).toBeVisible();
  });
}