import { test, expect } from '@playwright/test';

async function enterProduct(page, route) {
  await page.goto(route);
  await page.waitForFunction(() => window.store?.state?.ready === true || Boolean(document.querySelector('[data-workspace-demo]')));
  const demo = page.locator('[data-workspace-demo]');
  if (await demo.isVisible()) {
    await demo.click();
    await page.evaluate((hash) => { location.hash = hash; }, route.slice(1));
  }
}

test('Calendar planning picker shows only allowed years and selects a future date on mobile', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProduct(page, '/#/calendar');
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
  await enterProduct(page, '/#/classes');
  if (await page.evaluate(() => typeof window.store?.save === 'function')) {
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
  } else {
    await page.evaluate(() => { location.hash = '#/reports'; });
    await page.locator('.report-grade-group__summary').first().click();
    await page.locator('.report-class-row').first().click();
  }
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

test('RTL time picker shows minute, hour, period while preserving 10:45 and 22:45', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProduct(page, '/#/schedule/times');
  await page.locator('[data-act="edit-times"]').first().click();
  await page.locator('#sheet-btn-gen').click();
  const input = page.locator('#gen-form [name="firstPeriodStart"]');
  await input.click();
  const clock = page.locator('.flatpickr-calendar.open .flatpickr-time');
  const hour = clock.locator('.flatpickr-hour');
  const separator = clock.locator('.flatpickr-time-separator');
  const minute = clock.locator('.flatpickr-minute');
  const amPm = clock.locator('.flatpickr-am-pm');
  await hour.fill('10');
  await hour.press('Tab');
  await minute.fill('45');
  await minute.press('Tab');
  if (await amPm.textContent() !== 'صباحًا') await amPm.click();
  await expect(input).toHaveValue('10:45');
  const [hourBox, separatorBox, minuteBox, amPmBox] = await Promise.all(
    [hour, separator, minute, amPm].map((locator) => locator.boundingBox()));
  expect(minuteBox.x).toBeGreaterThan(separatorBox.x);
  expect(separatorBox.x).toBeGreaterThan(hourBox.x);
  expect(hourBox.x).toBeGreaterThan(amPmBox.x);
  expect(hourBox.x).toBeGreaterThanOrEqual(amPmBox.x + amPmBox.width);
  expect(minuteBox.x).toBeGreaterThanOrEqual(hourBox.x + hourBox.width);
  expect(await hour.inputValue()).toMatch(/^[0-9]{2}$/);
  expect(await minute.inputValue()).toMatch(/^[0-9]{2}$/);
  expect(`${await hour.inputValue()}${await minute.inputValue()}`).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
  await amPm.click();
  await expect(amPm).toHaveText('مساءً');
  await expect(input).toHaveValue('22:45');
  await amPm.click();
  await expect(input).toHaveValue('10:45');
  await clock.screenshot({ path: testInfo.outputPath('clock-1045-rtl.png') });
  await page.locator('#gen-form [name="assemblyStart"]').fill('');
  await page.locator('#gen-form button[type="submit"], .sheet:last-child button[form="gen-form"]').first().click();
  await expect(page.locator('.sheet')).toHaveCount(1);
  await expect(page.locator('.timerow__in[data-p="1"][data-key="start"]')).toHaveValue('10:45');
  await page.locator('#sheet-btn-save-all').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await page.reload();
  await page.locator('[data-act="edit-times"]').first().click();
  await expect(page.locator('.timerow__in[data-p="1"][data-key="start"]')).toHaveValue('10:45');
});
