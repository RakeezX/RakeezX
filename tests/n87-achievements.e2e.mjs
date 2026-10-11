import { test, expect } from '@playwright/test';

test('teacher profile renders read-only evidence on desktop/mobile without changing records or share output', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://*.supabase.co/**', route => route.abort());
  await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'active'));
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.students.length > 0);
  const fixture = await page.evaluate(async () => {
    const store = window.store;
    const student = store.state.students.find(s => !s.deleted);
    const enrollment = store.activeEnrollment(student.id);
    const teaching = store.teachings().find(t => t.sectionId === enrollment.sectionId);
    const common = { updatedAt: Date.now(), deleted: false };
    await store.save({
      items: [{ id: 'demo:n87:item', teachingId: teaching.id, name: 'تقييم موثّق', max: 10, order: 99, ...common }],
      scores: [{ id: `sc:${student.id}:demo:n87:item`, studentId: student.id, itemId: 'demo:n87:item', value: 10, ...common }],
      logs: [{ id: 'demo:n87:log', studentId: student.id, teachingId: teaching.id, kind: 'participation', delta: 1, date: '2026-09-10', ...common }],
    });
    return { studentId: student.id, teachingId: teaching.id, name: student.name };
  });
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  const section = page.locator('.student-achievements');
  await expect(section).toBeVisible();
  await expect(page.locator('.student-profile-header__name')).toHaveText(fixture.name);
  await expect(section.locator('[data-achievement="participation"]')).toBeVisible();
  await expect(section.locator('[data-achievement="scores"]')).toBeVisible();
  await expect(section).toContainText('للمعلم · للقراءة فقط');
  await expect(section.locator('button, a')).toHaveCount(0);
  const snapshot = await page.evaluate(() => JSON.stringify(window.store.state));
  await page.setViewportSize({ width: 1280, height: 900 });
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('n87-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await section.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('n87-mobile.png'), fullPage: false });
  expect(await page.evaluate(() => JSON.stringify(window.store.state))).toBe(snapshot);
  await page.locator('.student-profile-actions [data-act="share"]').click();
  await expect(page.locator('.share-preview-box')).not.toContainText('إنجازات من السجل');
  await page.locator('[data-sheet-close]').last().click();
  await page.emulateMedia({ media: 'print' });
  await expect(section).toBeHidden();
  expect(errors).toEqual([]);
});
