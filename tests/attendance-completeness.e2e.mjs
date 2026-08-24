import { test, expect } from '@playwright/test';

function isoOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

test('Sessions exposes derived attendance completeness and reuses the same dated session', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const yesterday = isoOffset(-1);
  const tomorrow = isoOffset(1);

  await page.goto('/#/teaching/tch:attendance-ui/sessions');
  await page.waitForFunction(() => window.store);
  await page.evaluate(async ({ yesterday, tomorrow }) => {
    await window.store.save({
      years: [{ id: 'y:attendance-ui', label: 'سنة الاختبار' }],
      terms: [{ id: 'tm:attendance-ui', yearId: 'y:attendance-ui', index: 1, startDate: yesterday, endDate: tomorrow, status: 'active' }],
      subjects: [{ id: 'sub:attendance-ui', name: 'اختبار الحضور' }],
      sections: [{ id: 'sec:attendance-ui', yearId: 'y:attendance-ui', grade: 4, label: 'أ' }],
      teachings: [{ id: 'tch:attendance-ui', sectionId: 'sec:attendance-ui', subjectId: 'sub:attendance-ui', termId: 'tm:attendance-ui' }],
      students: [{ id: 'std:attendance-ui-a', name: 'طالب اختبار أ' }, { id: 'std:attendance-ui-b', name: 'طالب اختبار ب' }],
      enrollments: [
        { id: 'en:attendance-ui-a', studentId: 'std:attendance-ui-a', sectionId: 'sec:attendance-ui', status: 'active' },
        { id: 'en:attendance-ui-b', studentId: 'std:attendance-ui-b', sectionId: 'sec:attendance-ui', status: 'active' },
      ],
      slots: [{ id: 'sl:attendance-ui', teachingId: 'tch:attendance-ui', weekday: 0, period: 1 }],
      sessions: [
        { id: 'ses:attendance-past', teachingId: 'tch:attendance-ui', slotId: 'sl:attendance-ui', date: yesterday, period: 1, startTime: '07:00', endTime: '07:45', status: 'scheduled' },
        { id: 'ses:attendance-future', teachingId: 'tch:attendance-ui', date: tomorrow, period: 2, startTime: '07:00', endTime: '07:45', status: 'scheduled' },
        { id: 'ses:attendance-holiday', teachingId: 'tch:attendance-ui', date: yesterday, period: 3, startTime: '08:00', endTime: '08:45', status: 'cancelled_holiday' },
      ],
    });
    await window.store.patchDevice({ activeYearId: 'y:attendance-ui', activeTermId: 'tm:attendance-ui' });
    window.store.repaint();
  }, { yesterday, tomorrow });

  await expect(page.getByText('لم يُرصد الحضور', { exact: true })).toBeVisible();
  await expect(page.locator('.row').filter({ hasText: 'مجدولة' }).first()).toBeVisible();
  await expect(page.getByText('رصد الحضور', { exact: true })).toBeVisible();
  await page.getByText('رصد الحضور', { exact: true }).click();
  await expect(page.locator('.att-row')).toHaveCount(2);
  await page.locator('[data-act="fill-present"]').click();
  await expect(page.getByText('اكتمل الرصد', { exact: false })).toBeVisible();

  await page.goto('/#/teaching/tch:attendance-ui/sessions');
  await expect(page.getByText('تم رصد الحضور', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({
    attendance: window.store.attendanceIn('ses:attendance-past').length,
    sessionId: window.store.getSession('ses:attendance-past').id,
  }))).toEqual({ attendance: 2, sessionId: 'ses:attendance-past' });

  await page.evaluate(async () => {
    await window.store.editSlot('sl:attendance-ui', { teachingId: 'tch:attendance-ui', weekday: 1, period: 4 });
  });
  await page.reload();
  await expect(page.getByText('تم رصد الحضور', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.store.getSession('ses:attendance-past').slotId)).toBe('sl:attendance-ui');
  expect(errors).toEqual([]);
});