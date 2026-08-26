import { test, expect } from '@playwright/test';

test('aggregate execution reports navigate, filter, persist, and stay responsive', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/#/reports'); await page.waitForFunction(() => window.store);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'y:er', label: 'سنة اختبار' }], terms: [{ id: 'tm:er', yearId: 'y:er', name: 'الفصل الأول' }], subjects: [{ id: 'sub:er', name: 'اختبار رياضيات' }], sections: [{ id: 'sec:er', yearId: 'y:er', grade: 4, label: 'أ' }], teachings: [{ id: 'tch:er', sectionId: 'sec:er', subjectId: 'sub:er', termId: 'tm:er' }],
      students: [{ id: 'st:er1', name: 'طالب اختبار ١' }, { id: 'st:er2', name: 'طالب اختبار ٢' }], enrollments: [{ id: 'en:er1', studentId: 'st:er1', sectionId: 'sec:er', status: 'active' }, { id: 'en:er2', studentId: 'st:er2', sectionId: 'sec:er', status: 'active' }],
      sessions: [{ id: 'ses:er-done', teachingId: 'tch:er', date: '2026-08-23', period: 1, startTime: '07:00', endTime: '07:45' }, { id: 'ses:er-pending', teachingId: 'tch:er', date: '2026-08-24', period: 2, startTime: '07:00', endTime: '07:45' }, { id: 'ses:er-future', teachingId: 'tch:er', date: '2026-08-26', period: 1, startTime: '07:00', endTime: '07:45' }, { id: 'ses:er-holiday', teachingId: 'tch:er', date: '2026-08-24', period: 3, status: 'cancelled_holiday' }],
      attendance: [{ id: 'at:er1', studentId: 'st:er1', sessionId: 'ses:er-done' }, { id: 'at:er2', studentId: 'st:er2', sessionId: 'ses:er-done' }],
    }); await window.store.patchDevice({ activeYearId: 'y:er', activeTermId: 'tm:er' }); window.store.repaint();
  });
  await expect(page.getByText('ملخّص التنفيذ', { exact: true })).toBeVisible(); await page.getByText('ملخّص التنفيذ', { exact: true }).click();
  await expect(page.getByText('تنفيذ الحصص', { exact: true })).toBeVisible(); await expect(page.getByText('اكتمال الحضور', { exact: true })).toBeVisible(); await expect(page.locator('.gtable--report')).toBeVisible();
  await page.selectOption('select[data-change="status"]', 'pending'); await expect(page.locator('.gtable--report')).toContainText('لم يُرصد الحضور'); await expect(page.locator('.gtable--report')).not.toContainText('تم رصد الحضور');
  await page.reload(); await expect(page.getByText('تنفيذ الحصص', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});