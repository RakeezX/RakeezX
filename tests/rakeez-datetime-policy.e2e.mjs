import { test, expect } from '@playwright/test';

test('Calendar planning picker shows only allowed years and selects a future date on mobile', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/calendar');
  await page.getByRole('button', { name: 'إضافة استثناء' }).click();
  const input = page.locator('#range-form [name="startDate"]');
  await expect(input).toHaveAttribute('data-rakeez-date-scope', 'planning');
  await input.click();
  const calendar = page.locator('.flatpickr-calendar.open');
  const years = calendar.locator('.rakeez-year-select');
  await expect(years).toBeVisible();
  await expect(calendar.locator('.rakeez-year-input-hidden')).toBeHidden();
  const nextYear = await page.evaluate(() => new Date().getFullYear() + 1);
  expect(await years.locator('option').allTextContents()).toEqual(
    Array.from({ length: nextYear - 2026 + 1 }, (_, index) => String(2026 + index)));
  await years.selectOption(String(nextYear));
  expect(await input.evaluate((node) => node._flatpickr.currentYear)).toBe(nextYear);
  const box = await calendar.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  await calendar.screenshot({ path: testInfo.outputPath('planning-390.png') });
  await calendar.locator('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay):not(.nextMonthDay)').first().click();
  await expect(input).toHaveValue(new RegExp(`^${nextYear}-\\d{2}-\\d{2}$`));
  expect(errors).toEqual([]);
});

test('Attendance report picker hides future years and caps dates at today', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'n38-policy-year', name: 'N38 Year' }],
      terms: [{ id: 'n38-policy-term', yearId: 'n38-policy-year', name: 'N38 Term' }],
      subjects: [{ id: 'n38-policy-subject', name: 'N38 Subject' }],
      sections: [{ id: 'n38-policy-section', yearId: 'n38-policy-year', grade: 4, label: 'A', name: 'N38 4/A', order: 0 }],
      teachings: [{ id: 'n38-policy-teaching', sectionId: 'n38-policy-section', subjectId: 'n38-policy-subject', termId: 'n38-policy-term', order: 0 }],
      students: [{ id: 'n38-policy-student', name: 'N38 Student', status: 'active' }],
      enrollments: [{ id: 'n38-policy-enrollment', studentId: 'n38-policy-student', sectionId: 'n38-policy-section', status: 'active', rollNo: 1 }],
      sessions: [{ id: 'n38-policy-session', teachingId: 'n38-policy-teaching', date: '2026-08-02', weekday: 0, period: 1 }],
      attendance: [{ id: 'n38-policy-attendance', studentId: 'n38-policy-student', sessionId: 'n38-policy-session', teachingId: 'n38-policy-teaching', date: '2026-08-02', status: 'present' }],
    });
    await window.store.patchDevice({ activeYearId: 'n38-policy-year', activeTermId: 'n38-policy-term' });
  });
  await page.goto('/#/teaching/n38-policy-teaching/reports');
  await page.locator('[data-act="tab"][data-tab="attendance"]').click();
  const inputs = page.locator('input[data-rakeez-date-scope="historical"]');
  await expect(inputs).toHaveCount(2);
  await inputs.first().click();
  const calendar = page.locator('.flatpickr-calendar.open');
  await expect(calendar.locator('.rakeez-year-select')).toBeVisible();
  const currentYear = await page.evaluate(() => new Date().getFullYear());
  expect(await calendar.locator('.rakeez-year-select option').allTextContents()).toEqual(
    Array.from({ length: Math.max(0, currentYear - 2026 + 1) }, (_, index) => String(2026 + index)));
  const today = await page.evaluate(() => new Date().toDateString());
  expect(await inputs.first().evaluate((node) => node._flatpickr.config.maxDate.toDateString())).toBe(today);
  const box = await calendar.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(321);
  await calendar.screenshot({ path: testInfo.outputPath('historical-320.png') });
});
