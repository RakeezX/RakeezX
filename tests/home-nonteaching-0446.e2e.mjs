import { test, expect } from '@playwright/test';

for (const kind of ['suspension', 'holiday', 'remote', 'normal']) {
  test(`Home follows Calendar authority after sessions exist: ${kind}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-01T07:00:00+03:00'));
    await page.goto('/#/home');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    const before = await page.evaluate(async (kind) => {
      const store = await import('/src/store.js');
      const { weekday } = await import('/src/models.js');
      const section = await store.createSection({ grade: 5, label: `منزل-${Date.now()}` });
      const teaching = await store.createTeaching({ sectionId: section.id });
      const student = await store.addStudent(section.id, 'طالب محفوظ');
      await store.addSlot(teaching.id, weekday('2026-10-01'), 1);
      const session = await store.ensureSession(teaching.id, '2026-10-01', 1, {
        startTime: '10:25', endTime: '11:10',
      });
      if (kind === 'suspension' || kind === 'holiday') {
        await store.save({ attendance: [{ id: `at:home:0446:${session.id}:${student.id}`,
          sessionId: session.id, teachingId: teaching.id, studentId: student.id,
          date: '2026-10-01', status: 'present', deleted: false, updatedAt: Date.now() }] });
      }
      return { sessionId: session.id, teachingId: teaching.id, studentId: student.id,
        status: store.sessionsOn('2026-10-01').find((row) => row.id === session.id)?.status,
        attendanceCount: store.attendanceIn(session.id).length };
    }, kind);
    await page.goto('/#/home');
    if (kind !== 'normal') {
      await page.evaluate(async ({ kind }) => {
        const store = await import('/src/store.js');
        const calendar = await store.ensureCalendar(store.activeYear().id, 'custom');
        await store.saveCalendarRange({ calendarId: calendar.id, startDate: '2026-10-01', kind,
          label: kind === 'suspension' ? 'تعليق دراسة تجريبي' : kind === 'holiday' ? 'إجازة تجريبية' : 'دراسة عن بُعد' });
      }, { kind });
    }
    await page.reload();
    await page.waitForFunction(() => window.store?.state?.ready === true);
    const nonTeaching = kind === 'suspension' || kind === 'holiday';
    if (nonTeaching) {
      await expect(page.locator('.today-focus')).toHaveCount(0);
      await expect(page.locator('.home-session-row')).toHaveCount(0);
      await expect(page.locator('.today-empty-card')).toContainText(kind === 'suspension' ? 'تعليق دراسة' : 'إجازة');
      await expect(page.locator('.home-day-progress')).not.toContainText(/0 من \d+ حصص/);
      await expect(page.locator('.home-day-progress')).not.toContainText(/1 من \d+ حصص/);
      await expect(page.locator('.home-sessions')).not.toContainText(/الحصة التالية|رصد الحضور|قادمة/);
    } else {
      await expect(page.locator('.today-focus')).toHaveAttribute('data-session-id', before.sessionId);
      await expect(page.locator('.today-focus')).toContainText(/حصتك الحالية|الحصة التالية/);
      await expect(page.locator('.today-focus').getByRole('link', { name: 'رصد الحضور' })).toBeVisible();
      await expect(page.locator('.home-day-progress')).toContainText('0 من 1 حصص');
    }
    const after = await page.evaluate(async ({ sessionId }) => {
      const store = await import('/src/store.js');
      return { status: store.sessionsOn('2026-10-01').find((row) => row.id === sessionId)?.status,
        attendanceCount: store.attendanceIn(sessionId).length };
    }, before);
    expect(after).toEqual({ status: before.status, attendanceCount: before.attendanceCount });
    expect(errors).toEqual([]);
  });
}
