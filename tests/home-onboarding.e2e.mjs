import { test, expect } from '@playwright/test';

test('Home guides a teacher from first class to students to a weekly schedule', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);

  await expect(page.getByRole('heading', { name: 'أنشئ فصلك الأول' })).toBeVisible();
  await expect(page.getByText('حصص اليوم', { exact: true })).toHaveCount(0);

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

test('Home renders a single current focus and uses attendance wording', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  const fixture = await page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 4, label: `تركيز-${Date.now()}`, name: 'الرابع / تركيز' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    await window.store.addStudent(section.id, 'طالب تركيز المنزل');
    await window.store.addSlot(teaching.id, 0, 2);
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await window.store.ensureSession(teaching.id, date, 9, { startTime: '00:00', endTime: '23:59' });
    const session = window.store.sessionsOn(date).find((candidate) => candidate.teachingId === teaching.id && candidate.period === 9);
    return { teachingId: teaching.id, sessionId: session.id };
  });
  await page.goto('/#/');
  const focus = page.locator('.today-focus');
  await expect(focus).toBeVisible();
  await expect(focus.getByRole('link', { name: 'رصد الحضور' })).toBeVisible();
  await expect(focus).not.toContainText('تحضير الحصة');
  await expect(focus.getByRole('link', { name: 'رصد الحضور' })).toHaveAttribute('href', new RegExp(`#/teaching/${fixture.teachingId}/attendance\\?session=`));

  await page.evaluate(async ({ sessionId }) => window.store.fillAttendance(sessionId, 'present'), fixture);
  await expect(page.locator('.today-focus')).toHaveCount(0);
  await expect(page.getByText('تم رصد الحضور', { exact: true }).first()).toBeVisible();
});
