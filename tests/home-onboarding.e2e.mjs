import { test, expect } from '@playwright/test';

test('Home guides a teacher from first class to students to a weekly schedule', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);

  await expect(page.getByRole('heading', { name: 'أنشئ فصلك الأول' })).toBeVisible();
  await expect(page.getByText('حصص اليوم', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'لا توجد حصص بعد' })).toBeVisible();

  const fixture = await page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: `بدء-${Date.now()}`, name: 'الخامس / بدء' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    return { sectionId: section.id, teachingId: teaching.id };
  });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'أضف طلابك' })).toBeVisible();

  await page.evaluate(async ({ sectionId }) => window.store.addStudent(sectionId, 'طالب إعداد المنزل'), fixture);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'حدّد جدولك الأسبوعي' })).toBeVisible();
  await expect(page.getByText('أضف مواعيد حصصك الأسبوعية لتظهر حصص يومك تلقائيًا وفق الجدول المعتمد.')).toBeVisible();

  await page.evaluate(async ({ teachingId }) => window.store.addSlot(teachingId, 0, 1), fixture);
  await page.goto('/#/');
  await expect(page.locator('.home-onboarding')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('Home attendance completes the exact Focus session and advances to a distinct upcoming session', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  const fixture = await page.evaluate(async () => {
    const subjects = window.store.subjects();
    const currentSection = await window.store.createSection({ grade: 4, label: `تركيز-${Date.now()}`, name: 'الرابع / تركيز' });
    const upcomingSection = await window.store.createSection({ grade: 5, label: `تالي-${Date.now()}`, name: 'الخامس / تالي' });
    const currentTeaching = await window.store.createTeaching({ sectionId: currentSection.id, subjectId: subjects[0].id });
    const upcomingTeaching = await window.store.createTeaching({ sectionId: upcomingSection.id, subjectId: (subjects[1] ?? subjects[0]).id });
    await window.store.addStudent(currentSection.id, 'طالب تركيز المنزل');
    await window.store.addStudent(upcomingSection.id, 'طالب الحصة التالية');
    await window.store.addSlot(currentTeaching.id, 3, 2);
    await window.store.addSlot(upcomingTeaching.id, 3, 3);
    const currentSession = await window.store.ensureSession(currentTeaching.id, '2026-09-09', 2, {
      startTime: '08:00', endTime: '08:45',
    });
    const upcomingSession = await window.store.ensureSession(upcomingTeaching.id, '2026-09-09', 3, {
      startTime: '10:25', endTime: '11:10',
    });
    return {
      currentTeachingId: currentTeaching.id,
      currentSessionId: currentSession.id,
      currentClassLabel: currentSection.label,
      currentStartTime: currentSession.startTime,
      upcomingSessionId: upcomingSession.id,
      upcomingClassLabel: upcomingSection.label,
      upcomingStartTime: upcomingSession.startTime,
      upcomingEndTime: upcomingSession.endTime,
    };
  });
  await page.goto('/#/');
  const focus = page.locator('.today-focus');
  await expect(focus).toBeVisible();
  await expect(focus).toHaveAttribute('data-session-id', fixture.currentSessionId);
  const attendanceAction = focus.getByRole('link', { name: 'رصد الحضور' });
  await expect(attendanceAction).toBeVisible();
  await expect(focus).not.toContainText('تحضير الحصة');
  await expect(attendanceAction).toHaveAttribute(
    'href',
    `#/teaching/${fixture.currentTeachingId}/attendance?session=${fixture.currentSessionId}`,
  );

  await attendanceAction.click();
  await expect(page).toHaveURL(new RegExp(`session=${fixture.currentSessionId}$`));
  await page.getByRole('button', { name: /علّم الباقي \(1\) حاضرين/ }).click();
  await expect(page.getByRole('status', { name: 'حالة الرصد: مكتمل' })).toBeVisible();

  await page.locator('a[href="#/"]:visible').first().click();
  await expect(page).toHaveURL(/\/#\/$/);
  await expect(focus).toBeVisible();
  await expect(focus).toHaveAttribute('data-session-id', fixture.upcomingSessionId);
  expect(fixture.upcomingSessionId).not.toBe(fixture.currentSessionId);
  expect(fixture.upcomingStartTime).not.toBe(fixture.currentStartTime);
  await expect(focus.locator('.today-focus__class')).toContainText(fixture.upcomingClassLabel);
  await expect(focus.locator('.today-focus__class')).not.toContainText(fixture.currentClassLabel);
  await expect(focus.locator('.time-range__token[data-time-token="start"]')).toHaveText(fixture.upcomingStartTime);
  await expect(focus.locator('.time-range__token[data-time-token="end"]')).toHaveText(fixture.upcomingEndTime);
  await expect(focus.getByRole('link', { name: 'رصد الحضور' })).toHaveAttribute('data-session-id', fixture.upcomingSessionId);
  await expect(page.getByText('تم رصد الحضور', { exact: true }).first()).toBeVisible();
  console.log(`HOME_FOCUS_SESSIONS current=${fixture.currentSessionId} completed=${fixture.currentSessionId} advanced=${fixture.upcomingSessionId} advancedTime=${fixture.upcomingStartTime}-${fixture.upcomingEndTime}`);
});

for (const viewport of [
  { width: 390, height: 844, label: 'mobile' },
  { width: 1440, height: 900, label: 'desktop' },
]) {
  test(`Home upcoming Focus renders valid readable time and matching session identity — ${viewport.label}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-09T07:00:00+03:00'));
    await page.setViewportSize(viewport);
    await page.goto('/#/');
    await page.waitForFunction(() => window.store?.state?.ready === true);

    const fixture = await page.evaluate(async () => {
      const section = await window.store.createSection({ grade: 5, label: `بطاقة-${Date.now()}`, name: 'الخامس / بطاقة' });
      const subject = window.store.subjects()[0];
      const teaching = await window.store.createTeaching({ sectionId: section.id, subjectId: subject.id });
      await window.store.addStudent(section.id, 'طالب بطاقة التركيز');
      await window.store.addSlot(teaching.id, 0, 1);
      const session = await window.store.ensureSession(teaching.id, '2026-09-09', 8, {
        startTime: '10:25', endTime: '11:10',
      });
      return { sessionId: session.id, teachingId: teaching.id, subjectName: subject.name };
    });

    await page.goto('/#/');
    const focus = page.locator('.today-focus');
    await expect(focus).toBeVisible();
    await expect(focus).toHaveAttribute('data-session-id', fixture.sessionId);
    await expect(focus.getByText(fixture.subjectName, { exact: false })).toBeVisible();
    await expect(focus.locator('.time-range__token[data-time-token="start"]')).toHaveText('10:25');
    await expect(focus.locator('.time-range__token[data-time-token="end"]')).toHaveText('11:10');
    await expect(focus.locator('.today-focus__detail')).toContainText(/تبدأ\s*10:25\s*–\s*11:10/);
    const action = focus.getByRole('link', { name: 'رصد الحضور' });
    await expect(action).toHaveAttribute('data-session-id', fixture.sessionId);
    await expect(action).toHaveAttribute('href', `#/teaching/${fixture.teachingId}/attendance?session=${fixture.sessionId}`);

    const cardText = await focus.innerText();
    expect(cardText).not.toMatch(/<span|span class=|<\/span|\bdir=|data-time-token/);
    expect(await focus.evaluate((node) => node.checkVisibility())).toBe(true);
  });
}
