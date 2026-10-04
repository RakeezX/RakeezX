import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootSettings, bootDemoSettings } from './helpers/settings-0397.mjs';
import { EDUCATION_DEPARTMENT_OPTIONS } from '../src/lib/education-department-directory.js';

test.use({ serviceWorkers: 'block', browserName: 'chromium' });

for (const [width, height] of [[1440, 900], [390, 844], [320, 740]]) {
  test(`N03 combobox at ${width}px in light and dark`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const evidence = await bootSettings(page);
    const profile = page.locator('[data-settings-profile]');
    if (await profile.getAttribute('open') === null) await profile.locator('summary').click();
    const combo = page.getByRole('combobox', { name: 'إدارة التعليم' });
    const list = page.getByRole('listbox', { name: 'إدارات التعليم الرسمية' });
    await expect(combo).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toBeHidden();
    await expect(combo).toHaveValue('');
    await expect(page.locator('[data-education-department] .field__hint')).toBeVisible();
    const rows = await profile.locator('.field-row').evaluateAll((elements) => elements.slice(0, 3).map((element) =>
      [...element.querySelectorAll('.field')].map((field) => field.querySelector('.field__label')?.textContent.trim())));
    expect(rows[0][0]).toContain('المعلم');
    expect(rows[1][0]).toContain('المدرسة');
    expect(rows[1][1]).toBe('إدارة التعليم');
    expect(rows[2][1]).toBe('رقم الجوال');
    let selected = '';
    for (const theme of ['light', 'dark']) {
      await page.locator(`[data-act="theme"][data-theme="${theme}"]`).click();
      await combo.click();
      await expect(combo).toHaveAttribute('aria-expanded', 'true');
      await expect(list.getByRole('option')).toHaveCount(47);
      await combo.fill('ادارة التعليم بمحافظة مهد الذهب');
      await expect(list.getByRole('option', { name: 'مهد الذهب' })).toBeVisible();
      await expect(list.getByRole('option', { name: 'الرياض' })).toBeHidden();
      await combo.press('Home');
      await expect(combo).toHaveAttribute('aria-activedescendant', 'education-department-option-31');
      await combo.press('Escape');
      await expect(list).toBeHidden();
      await expect(combo).toHaveValue(selected);
      await combo.press('ArrowDown');
      await combo.fill('مهد الذهب');
      await combo.press('Enter');
      await expect(combo).toHaveAttribute('aria-expanded', 'false');
      await expect(combo).toHaveValue(EDUCATION_DEPARTMENT_OPTIONS[31].canonicalName);
      await expect(page.locator('[data-education-department] .field__hint')).toHaveCount(0);
      await combo.click();
      await expect(list.getByRole('option', { name: 'مهد الذهب' })).toHaveAttribute('aria-selected', 'true');
      await combo.press('End');
      await expect(combo).toHaveAttribute('aria-activedescendant', 'education-department-option-46');
      await combo.press('ArrowUp');
      await expect(combo).toHaveAttribute('aria-activedescendant', 'education-department-option-45');
      await combo.fill('الطائف');
      await list.getByRole('option', { name: 'الطائف' }).click();
      await expect(combo).toHaveValue(EDUCATION_DEPARTMENT_OPTIONS[3].canonicalName);
      selected = EDUCATION_DEPARTMENT_OPTIONS[3].canonicalName;
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const sizing = await page.locator('[data-education-department]').evaluate((element) => {
        const control = element.querySelector('[role="combobox"]').getBoundingClientRect();
        const popup = element.querySelector('[data-education-department-popup]').getBoundingClientRect();
        return { controlHeight: control.height, popupWidth: popup.width, fieldWidth: element.getBoundingClientRect().width };
      });
      expect(sizing.controlHeight).toBeGreaterThanOrEqual(44);
      expect(sizing.popupWidth).toBeLessThanOrEqual(sizing.fieldWidth + 1);
      const audit = await new AxeBuilder({ page }).include('[data-education-department]').analyze();
      expect(audit.violations).toEqual([]);
    }
    await page.reload();
    if (await profile.getAttribute('open') === null) await profile.locator('summary').click();
    await expect(page.getByRole('combobox', { name: 'إدارة التعليم' })).toHaveValue(EDUCATION_DEPARTMENT_OPTIONS[3].canonicalName);
    expect(evidence.errors).toEqual([]);
  });
}

test('Demo selection persists locally without a Product cloud call', async ({ page }) => {
  const evidence = await bootDemoSettings(page);
  if (await page.locator('[data-settings-profile]').getAttribute('open') === null) await page.locator('[data-settings-profile] summary').click();
  const combo = page.getByRole('combobox', { name: 'إدارة التعليم' });
  await combo.click();
  await combo.fill('الرياض');
  await page.getByRole('option', { name: 'الرياض' }).click();
  await expect(combo).toHaveValue(EDUCATION_DEPARTMENT_OPTIONS[0].canonicalName);
  await page.reload();
  if (await page.locator('[data-settings-profile]').getAttribute('open') === null) await page.locator('[data-settings-profile] summary').click();
  await expect(page.getByRole('combobox', { name: 'إدارة التعليم' })).toHaveValue(EDUCATION_DEPARTMENT_OPTIONS[0].canonicalName);
  expect(evidence.requests).toEqual([]);
  expect(evidence.errors).toEqual([]);
});
