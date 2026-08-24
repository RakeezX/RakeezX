import { test, expect } from '@playwright/test';

const summaryChecks = {
  summer: ['التوقيت الصيفي', '6:45 ص', '7:00 ص', '45 دقيقة', '7'],
  winter: ['التوقيت الشتوي', '7:15 ص', '7:30 ص', '45 دقيقة', '7'],
  ramadan: ['توقيت رمضان', 'لا يوجد', '9:00 ص', '35 دقيقة', '6', 'لا توجد'],
  hybrid: ['التوقيت المدمج', 'حضوري', 'عن بعد', '7:00 ص', '30 دقيقة', '8', 'لا يوجد', 'لا توجد', 'الثلاثاء'],
};

test('Timing summaries and recess timeline rows remain compact across profiles', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/schedule/times');
  await page.evaluate(async () => {
    const profiles = [1, 2, 3].map((afterPeriod) => ({
      id: `recess-p${afterPeriod}`,
      name: `Recess P${afterPeriod}`,
      order: afterPeriod,
      periods: [],
      overrides: { config: { type: 'custom', assembly: { enabled: false }, recess: { enabled: true, duration: 20, transition: 5, afterPeriod } } },
    }));
    // Browser functions cannot cross the evaluate boundary; define period values here.
    for (const profile of profiles) {
      let minutes = 420;
      profile.periods = [];
      for (let period = 1; period <= 4; period += 1) {
        const stamp = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
        const start = stamp(minutes); minutes += 45;
        profile.periods.push({ period, start, end: stamp(minutes) });
        if (period === profile.overrides.config.recess.afterPeriod) minutes += 25;
      }
    }
    await window.store.save({ timeProfiles: profiles });
    await window.store.patchDevice({ activeTimeProfileId: 'recess-p1' });
    window.store.repaint();
  });
  await page.reload();
  await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });

  // Capture each reusable quick-generator summary at desktop width.
  await page.locator('[data-act="generate"]').click();
  for (const [preset, expected] of Object.entries(summaryChecks)) {
    await page.selectOption('#preset-sel', preset);
    const summary = page.locator('#preset-summary');
    for (const value of expected) await expect(summary).toContainText(value);
    await page.screenshot({ path: testInfo.outputPath(`summary-${preset}-desktop.png`), fullPage: true });
  }
  await page.keyboard.press('Escape');

  // Each recess position stays in the period-list rhythm and never precedes Period 1.
  for (const afterPeriod of [1, 2, 3]) {
    await page.locator(`[data-act="open"][data-id="recess-p${afterPeriod}"]`).click();
    const recess = page.locator('.row-recess');
    await expect(recess).toHaveCount(1);
    await expect(recess).toContainText('فسحة');
    await expect(recess).toContainText('20 دقيقة');
    await expect(recess).toContainText('تفويج 5 دقائق');
    await expect(recess.locator('[data-act="edit-recess"]')).toBeVisible();
    await expect(page.locator('.timerow').first().locator('.period')).toHaveText('1');
    await page.screenshot({ path: testInfo.outputPath(`recess-p${afterPeriod}-desktop.png`), fullPage: true });
  }

  // Mobile smoke check uses the most constrained recess state.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('recess-p3-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
