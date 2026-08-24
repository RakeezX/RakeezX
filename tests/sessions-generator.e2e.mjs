import { test, expect } from '@playwright/test';

test('Sessions screen generates a bounded dated range through the real UI', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push(message.text());
  });

  await page.goto('/#/teaching/tch:session-ui/sessions');
  await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });

  await page.evaluate(async () => {
    const store = window.store;
    await store.save({
      years: [{ id: 'y:session-ui', hijriStart: 1450, label: 'سنة الاختبار', order: 99, deleted: false }],
      terms: [{ id: 'tm:session-ui:1', yearId: 'y:session-ui', index: 1, name: 'الفصل الأول', startDate: '2026-08-23', endDate: '2026-08-30', status: 'active', deleted: false }],
      subjects: [{ id: 'sub:session-ui', name: 'المهارات الرقمية', slug: 'session-ui', deleted: false }],
      sections: [{ id: 'sec:session-ui', yearId: 'y:session-ui', grade: 5, label: 'أ', name: '5/أ', deleted: false }],
      teachings: [{ id: 'tch:session-ui', sectionId: 'sec:session-ui', subjectId: 'sub:session-ui', termId: 'tm:session-ui:1', deleted: false }],
      timeProfiles: [{ id: 'tp:session-ui', name: 'صيف', periods: [{ period: 1, start: '07:00', end: '07:45' }], activeFrom: '2026-08-01', activeTo: '2026-09-30', overrides: { config: { type: 'summer' } }, deleted: false }],
      slots: [{ id: 'sl:session-ui', teachingId: 'tch:session-ui', weekday: 0, period: 1, deleted: false }],
    });
    await store.patchDevice({ activeYearId: 'y:session-ui', activeTermId: 'tm:session-ui:1', activeTimeProfileId: 'tp:session-ui' });
  });
  await page.reload();
  await expect(page.getByText('توليد الحصص من الجدول')).toBeVisible();
  await expect(page.locator('form[data-submit="generate-sessions"]')).toBeVisible();

  await page.locator('form[data-submit="generate-sessions"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('تم إنشاء 2 حصة');
  await expect(page.getByText('تم تجاوز 0 حصة موجودة')).toBeVisible();

  const first = await page.evaluate(() => window.store.sessionsOf('tch:session-ui').map((s) => ({ id: s.id, date: s.date, startTime: s.startTime })).sort((a, b) => a.date.localeCompare(b.date)));
  expect(first).toEqual([
    { id: 'se:tch:session-ui:2026-08-23:1', date: '2026-08-23', startTime: '07:00' },
    { id: 'se:tch:session-ui:2026-08-30:1', date: '2026-08-30', startTime: '07:00' },
  ]);

  await page.locator('form[data-submit="generate-sessions"] button[type="submit"]').click();
  await expect(page.getByText('تم تجاوز 2 حصة موجودة')).toBeVisible();
  expect(await page.evaluate(() => window.store.sessionsOf('tch:session-ui').length)).toBe(2);

  await page.reload();
  expect(await page.evaluate(() => window.store.sessionsOf('tch:session-ui').length)).toBe(2);

  await page.evaluate(async () => {
    await window.store.save({
      sections: [{ id: 'sec:no-slots', yearId: 'y:session-ui', grade: 5, label: 'ب', name: '5/ب', deleted: false }],
      teachings: [{ id: 'tch:no-slots', sectionId: 'sec:no-slots', subjectId: 'sub:session-ui', termId: 'tm:session-ui:1', deleted: false }],
    });
  });
  await page.goto('/#/teaching/tch:no-slots/sessions');
  await expect(page.getByText('لا توجد حصص في الجدول لهذا الفصل ضمن الإعداد الحالي.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'افتح الجدول' })).toHaveAttribute('href', '#/schedule');
  await expect(page.locator('form[data-submit="generate-sessions"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});