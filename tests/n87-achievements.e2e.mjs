import { test, expect } from '@playwright/test';

test('teacher profile renders read-only evidence on desktop/mobile with safe opt-in PNG and no record changes', async ({ page }, testInfo) => {
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
  await expect(section.locator('[data-act="share"]')).toHaveCount(1);
  const snapshot = await page.evaluate(() => JSON.stringify(window.store.state));
  await page.setViewportSize({ width: 1280, height: 900 });
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('n87-desktop.png'), fullPage: false });

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await section.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('n87-' + width + '.png'), fullPage: false });
    await section.locator('[data-act="share"]').click();
    const editor = page.locator('.achievement-card-editor');
    await expect(editor).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(editor.locator('[data-card-name]')).not.toBeChecked();
    await expect(editor.locator('[data-card-field]:checked')).toHaveCount(0);
    await expect(page.locator('[data-card-download]')).toBeDisabled();
    await expect(editor.locator('[data-card-field="attendance"]')).toHaveCount(0);
    await expect(editor.locator('a')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const requests = [];
    const observe = request => requests.push(request.url());
    page.on('request', observe);
    await editor.locator('[data-card-field="participation"]').check();
    await expect(editor.locator('canvas')).not.toHaveAttribute('aria-label', new RegExp(fixture.name));
    await expect(editor.locator('canvas')).toHaveAttribute('aria-label', /مشاركات إيجابية/);
    await editor.locator('[data-card-confirm]').check();
    await editor.locator('[data-card-name]').check();
    await expect(editor.locator('[data-card-confirm]')).not.toBeChecked();
    await expect(page.locator('[data-card-download]')).toBeDisabled();
    await expect(editor.locator('canvas')).toHaveAttribute('aria-label', new RegExp(fixture.name));
    await editor.locator('[data-card-name]').uncheck();
    await editor.locator('[data-card-field="participation"]').uncheck();
    await expect(editor.locator('[data-card-confirm]')).toBeDisabled();
    await editor.locator('[data-card-field="scores"]').check();
    await editor.locator('[data-card-confirm]').check();
    const pending = page.waitForEvent('download');
    await page.locator('[data-card-download]').click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('achievement-card.png');
    await download.saveAs(testInfo.outputPath('n87-card-' + width + '.png'));
    await expect(editor.locator('[data-card-confirm]')).not.toBeChecked();
    expect(requests).toEqual([]);
    page.off('request', observe);
    expect(await page.evaluate(() => JSON.stringify(window.store.state))).toBe(snapshot);
    await page.locator('[data-sheet-close]').last().click();
  }
  await page.emulateMedia({ media: 'print' });
  await expect(section).toBeHidden();
  expect(errors).toEqual([]);
});
