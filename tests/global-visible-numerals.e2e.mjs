import { test, expect } from '@playwright/test';

test('Latin digits remain visible across representative surfaces and viewports', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  const fixture = await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'latin-year', name: 'TEST ١٤٤٨' }],
      terms: [{ id: 'latin-term', yearId: 'latin-year', name: 'TEST ١' }],
    });
    await window.store.patchDevice({ activeYearId: 'latin-year', activeTermId: 'latin-term' });
    const section = await window.store.createSection({ grade: 4, label: '٤', name: 'TEST ٤/ب' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const today = new Date();
    const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const session = await window.store.ensureSession(teaching.id, date, 1, { startTime: '08:02:00', endTime: '08:32:00' });
    return { teachingId: teaching.id, sessionId: session.id };
  });
  const routes = [
    '/#/', '/#/reports', '/#/settings',
    `/#/teaching/${fixture.teachingId}/attendance?session=${fixture.sessionId}`,
  ];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await page.waitForFunction(() => window.store?.state?.ready === true);
      await page.waitForTimeout(250);
      const visible = await page.locator('body').innerText();
      expect(visible, `${width} ${route}`).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
