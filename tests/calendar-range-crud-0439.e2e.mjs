import { test, expect } from '@playwright/test';

test('custom Calendar range edits, moves, deletes and recreates through the real controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-01T09:00:00+03:00'));
  await page.goto('/#/calendar');
  const dialog = page.getByRole('dialog');
  const openEditor = async (label) => {
    const row = page.locator('.calendar-period').filter({ hasText: label });
    await row.getByRole('button', { name: /تفاصيل/ }).click();
    await dialog.getByRole('button', { name: 'تعديل الاستثناء' }).click();
    return dialog.locator('#range-form');
  };

  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  let form = dialog.locator('#range-form');
  await form.getByLabel('من *').fill('2026-10-05');
  await form.getByLabel('إلى').fill('2026-10-07');
  await form.locator('[name="holidayContext"]').selectOption('other');
  await form.getByLabel('اسم الاستثناء *').fill('اختبار 0439');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'اختبار 0439' })).toHaveCount(1);

  form = await openEditor('اختبار 0439');
  await form.getByLabel('إلى').fill('2026-10-06');
  await form.getByLabel('اسم الاستثناء *').fill('اختبار 0439 معدّل');
  await dialog.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'اختبار 0439 معدّل' })).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.calendar-period').filter({ hasText: 'اختبار 0439 معدّل' })).toHaveCount(1);

  form = await openEditor('اختبار 0439 معدّل');
  await form.getByLabel('من *').fill('2026-10-08');
  await form.getByLabel('إلى').fill('2026-10-09');
  await dialog.getByRole('button', { name: 'حفظ التعديل' }).click();
  const moved = page.locator('.calendar-period').filter({ hasText: 'اختبار 0439 معدّل' });
  await expect(moved).toHaveCount(1);
  await expect(moved).toContainText('8–9');
  await moved.getByRole('button', { name: /تفاصيل/ }).click();
  await dialog.getByRole('button', { name: 'حذف الاستثناء' }).click();
  await dialog.getByRole('button', { name: 'احذف' }).click();
  await expect(moved).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  form = dialog.locator('#range-form');
  await form.getByLabel('من *').fill('2026-10-08');
  await form.getByLabel('إلى').fill('2026-10-08');
  await form.locator('[name="holidayContext"]').selectOption('other');
  await form.getByLabel('اسم الاستثناء *').fill('إعادة إنشاء 0439');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'إعادة إنشاء 0439' })).toHaveCount(1);
  expect(errors).toEqual([]);
});
