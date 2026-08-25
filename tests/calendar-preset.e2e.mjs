import { test, expect } from '@playwright/test';

test('Western Region preset is visible and its official holiday is skipped through the real generator UI', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/calendar');
  await page.waitForFunction(() => window.store);
  await expect(page.getByText('التقويم المعتمد')).toBeVisible();
  await expect(page.getByText('1448–1449 هـ · المنطقة الغربية')).toBeVisible();
  await expect(page.getByText('إجازة اليوم الوطني').first()).toBeVisible();

  await page.evaluate(async () => {
    const year = window.store.activeYear(); const term = window.store.termsOf(year.id)[0];
    await window.store.save({
      subjects: [{ id: 'sub:calendar-e2e', name: 'اختبار', slug: 'calendar-e2e' }],
      sections: [{ id: 'sec:calendar-e2e', yearId: year.id, grade: 4, label: 'أ' }],
      teachings: [{ id: 'tch:calendar-e2e', sectionId: 'sec:calendar-e2e', subjectId: 'sub:calendar-e2e', termId: term.id }],
      slots: [{ id: 'sl:calendar-e2e:sun', teachingId: 'tch:calendar-e2e', weekday: 0, period: 1 }, { id: 'sl:calendar-e2e:wed', teachingId: 'tch:calendar-e2e', weekday: 3, period: 1 }],
    });
  });
  await page.goto('/#/teaching/tch:calendar-e2e/sessions');
  const form = page.locator('form[data-submit="generate-sessions"]');
  await form.locator('[name="startDate"]').fill('2026-09-20');
  await form.locator('[name="endDate"]').fill('2026-09-26');
  await form.getByRole('button', { name: 'توليد الحصص' }).click();
  await expect(page.getByText('تم إنشاء 1 حصة · تم تجاوز 0 حصة موجودة · تم تجاهل 1 يوم إجازة')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => window.store.getSession('se:tch:calendar-e2e:2026-09-20:1')?.teachingId)).toBe('tch:calendar-e2e');
  expect(await page.evaluate(() => window.store.getSession('se:tch:calendar-e2e:2026-09-23:1'))).toBeNull();
  expect(errors).toEqual([]);
});

test('calendar preset UI stays readable in RTL mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/calendar');
  await expect(page.getByText('التقويم المعتمد')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
});