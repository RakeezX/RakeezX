import { test, expect } from '@playwright/test';

test('Calendar saves a distinct suspension through the real form and presents it after reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/calendar');
  await page.getByRole('button', { name: 'إضافة استثناء' }).click();
  const form = page.getByRole('dialog').locator('#range-form');
  const kind = form.locator('[name="kind"]');
  await expect(kind).toHaveCount(4);
  await expect(form.locator('.calendar-work-type-option').filter({ hasText: 'إجازة' })).toHaveCount(1);
  await expect(form.locator('.calendar-work-type-option').filter({ hasText: 'تعليق دراسة' })).toHaveCount(1);
  await form.getByLabel('من *').fill('2026-10-05');
  await form.locator('[name="kind"][value="suspension"]').check();
  await form.getByLabel('الوصف أو اسم الفترة *').fill('تعليق تجريبي 0446');
  await page.getByRole('dialog').getByRole('button', { name: 'إضافة الاستثناء' }).click();
  const row = page.locator('.holiday-row').filter({ hasText: 'تعليق تجريبي 0446' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('حصص متأثرة');
  await expect(row).not.toContainText('إجازة معتمدة');
  await expect(page.locator('.calendar-next-0415')).toContainText('تعليق تجريبي 0446');
  await expect(page.locator('.term-suspension-note')).toContainText('تعليق دراسة');
  await page.reload();
  await expect(page.locator('.holiday-row').filter({ hasText: 'تعليق تجريبي 0446' })).toHaveCount(1);
  const saved = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    return store.calendarRangesOf().find((range) => range.label === 'تعليق تجريبي 0446')?.kind;
  });
  expect(saved).toBe('suspension');
  expect(errors).toEqual([]);
});

test('suspension status is contextual across session screens without changing attendance exclusion', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-05T08:00:00'));
  await page.goto('/#/calendar');
  const fixture = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const { weekday } = await import('/src/models.js');
    const year = store.activeYear();
    const calendar = await store.ensureCalendar(year.id, 'custom');
    await store.saveCalendarRange({ calendarId: calendar.id, startDate: '2026-10-05',
      kind: 'suspension', label: '' });
    const section = await store.createSection({ grade: 5, label: 'تعليق 0446' });
    const subject = await store.resolveSubjectSelection({ token: 'builtin:science' });
    const teaching = await store.createTeaching({ sectionId: section.id, subjectId: subject.id });
    const student = await store.addStudent(section.id, 'طالب تجريبي 0446');
    await store.addSlot(teaching.id, weekday('2026-10-05'), 1);
    const session = await store.ensureSession(teaching.id, '2026-10-05', 1);
    return { teachingId: teaching.id, sessionId: session.id, studentId: student.id,
      status: session.status, completeness: store.attendanceCompleteness(session).state };
  });
  expect(fixture.status).toBe('cancelled_holiday');
  expect(fixture.completeness).toBe('excluded');
  await page.goto(`/#/teaching/${fixture.teachingId}/attendance?session=${fixture.sessionId}`);
  await expect(page.locator('.attendance-01c__status-pill')).toHaveText('تعليق دراسة');
  await expect(page.getByText('لا يُسجَّل حضور ولا غياب')).toBeVisible();
  await page.getByRole('button', { name: 'تعديل حالة الحصة' }).first().click();
  await expect(page.getByRole('dialog').getByText('تعليق دراسة', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).click();
  await page.goto(`/#/teaching/${fixture.teachingId}/sessions`);
  await expect(page.locator('.session-row').filter({ hasText: 'تعليق دراسة' })).toHaveCount(1);
  const generator = page.locator('form[data-submit="generate-sessions"]');
  await generator.locator('[name="startDate"]').fill('2026-10-05');
  await generator.locator('[name="endDate"]').fill('2026-10-05');
  await generator.getByRole('button', { name: 'توليد الحصص' }).click();
  await expect(page.getByText('تم تجاهل 1 يوم تعليق دراسة', { exact: false })).toBeVisible();
  await page.goto(`/#/teaching/${fixture.teachingId}`);
  await expect(page.getByText('تعليق دراسة', { exact: true }).first()).toBeVisible();
  await page.goto('/#/home');
  await expect(page.getByText('تعليق دراسة', { exact: true }).first()).toBeVisible();
  await page.goto('/#/schedule');
  await expect(page.getByText('اليوم: تعليق دراسة')).toBeVisible();
  // A retained historical attendance record can coexist with a later Calendar
  // correction. Its student-history status must use the same Calendar context.
  await page.evaluate(async ({ teachingId, sessionId, studentId }) => {
    const store = await import('/src/store.js');
    await store.save({ attendance: [{ id: `at:0446:${sessionId}:${studentId}`,
      studentId, sessionId, teachingId, date: '2026-10-05', status: 'present',
      deleted: false, updatedAt: Date.now() }] });
  }, fixture);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await page.locator('.student-attendance-history summary').click();
  await expect(page.locator('.student-history-row').filter({ hasText: 'تعليق دراسة' })).toHaveCount(1);
  expect(errors).toEqual([]);
});
