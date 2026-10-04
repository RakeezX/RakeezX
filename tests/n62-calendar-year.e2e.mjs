import { test, expect } from '@playwright/test';

test('Calendar year add and edit keep visible Latin digits and numeric identity', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/calendar');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async (value) => { await window.store.patchDevice({ theme: value }); window.store.applyTheme(); }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'السنوات', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'سنة جديدة' }).click();
      const input = page.getByRole('dialog').locator('[name="hijriStart"]');
      await expect(input).toHaveAttribute('type', 'text');
      await expect(input).toHaveAttribute('inputmode', 'numeric');
      await expect(input).toHaveAttribute('dir', 'ltr');
      await input.fill('١٦٠١');
      await expect(input).toHaveValue('1601');
      expect(await input.evaluate((element) => element.checkValidity())).toBe(false);
      await input.fill('۱۲۹۹');
      await expect(input).toHaveValue('1299');
      expect(await input.evaluate((element) => element.checkValidity())).toBe(false);
      await input.fill('١٥٩٩');
      await expect(input).toHaveValue('1599');
      expect(await input.evaluate((element) => element.checkValidity())).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await page.getByRole('dialog').getByRole('button', { name: 'تم', exact: true }).click();
    }
  }
  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'السنوات', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'سنة جديدة' }).click();
  await page.getByRole('dialog').locator('[name="hijriStart"]').fill('١٥٩٩');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByRole('dialog')).toContainText('1599-1600');
  expect(await page.evaluate(() => {
    const y = window.store.getYear('y:1599-1600');
    return { id: y?.id, hijriStart: y?.hijriStart, type: typeof y?.hijriStart };
  })).toEqual({ id: 'y:1599-1600', hijriStart: 1599, type: 'number' });
  await page.getByRole('dialog').locator('[data-act="edit-year"][data-id="y:1599-1600"]').click();
  await expect(page.getByRole('dialog').locator('[name="hijriStart"]')).toHaveValue('1599');
  await expect(page.getByRole('dialog').locator('[name="hijriStart"]')).toHaveAttribute('readonly');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  expect(await page.evaluate(() => window.store.getYear('y:1599-1600')?.hijriStart)).toBe(1599);
  expect(errors).toEqual([]);
});
