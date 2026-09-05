import { test, expect } from '@playwright/test';

test('Timing profiles cards and modal period editing work cleanly across profiles', async ({ page }, testInfo) => {
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

  // Verify profile cards exist with two distinct actions
  const firstCard = page.locator('.timing-profile-card').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator('[data-act="edit-times"]')).toBeVisible();
  await expect(firstCard.locator('[data-act="rename"]')).toBeVisible();

  // Test modal period editing for each profile
  for (const afterPeriod of [1, 2, 3]) {
    await page.locator(`[data-act="edit-times"][data-id="recess-p${afterPeriod}"]`).click();
    await expect(page.locator('.sheet')).toBeVisible();

    // Verify recess row in modal
    const recess = page.locator('.row-recess');
    await expect(recess).toHaveCount(1);
    await expect(recess).toContainText('الفسحة');
    await expect(recess).toContainText('20 دقيقة');
    await expect(page.locator('.timerow').first().locator('.period')).toHaveText('1');

    await page.screenshot({ path: testInfo.outputPath(`recess-p${afterPeriod}-modal.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet')).not.toBeVisible();
  }

  // Mobile smoke check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-act="edit-times"]').first().click();
  await expect(page.locator('.sheet')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('recess-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});
test('timing models stay independent through stacked sheets, save, reload, and compact mobile recess controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/schedule/times');
  await page.evaluate(async () => {
    const periods = [1, 2, 3, 4].map((period) => {
      const start = 420 + (period - 1) * 45;
      const stamp = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return { period, start: stamp(start), end: stamp(start + 45) };
    });
    await window.store.save({ timeProfiles: [{ id: 'models-profile', name: 'التوقيت التجريبي', order: 1, periods, overrides: { config: { recess: { enabled: false } } } }] });
    await window.store.patchDevice({ activeTimeProfileId: 'models-profile' });
  });
  await page.reload();
  await page.locator('[data-act="edit-times"][data-id="models-profile"]').click();

  // Generator is a child sheet and returns to the same parent editor after Apply.
  await page.locator('#sheet-btn-gen').click();
  await expect(page.locator('.sheet')).toHaveCount(2);
  await page.locator('.sheet').last().getByRole('button', { name: 'توليد وتطبيق الأوقات' }).click();
  await expect(page.locator('.sheet')).toHaveCount(1);

  // Model 2 starts as an independent copy of Model 1 and receives its own grade metadata.
  await page.locator('#sheet-btn-add-model').click();
  await expect(page.locator('.sheet')).toHaveCount(2);
  await page.locator('#add-model-name-input').fill('نموذج 2 المخصص');
  await page.locator('input[name="grades"][value="5"]').check();
  await page.getByRole('button', { name: 'إضافة النموذج' }).click();
  await expect(page.locator('.sheet')).toHaveCount(1);
  await expect(page.locator('.models-tab')).toHaveCount(2);
  await page.locator('.models-tab', { hasText: 'نموذج 2 المخصص' }).click();
  const modelTwoStart = page.locator('.timerow__in[data-p="1"][data-key="start"]');
  await modelTwoStart.fill('07:10');
  await modelTwoStart.blur();

  // A recess is explicit, can be removed, and does not create a second recess.
  await page.locator('#sheet-btn-add-recess').click();
  await page.getByRole('button', { name: 'إضافة الفسحة' }).click();
  await expect(page.locator('.row-recess')).toHaveCount(1);
  await page.locator('[data-act="del-recess"]').click();
  await expect(page.locator('.row-recess')).toHaveCount(0);

  await page.locator('#sheet-btn-save-all').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await page.reload();
  await page.locator('[data-act="edit-times"][data-id="models-profile"]').click();
  await page.locator('.models-tab', { hasText: 'نموذج 2 المخصص' }).click();
  await expect(page.locator('.timerow__in[data-p="1"][data-key="start"]')).toHaveValue('07:10');
  await page.locator('.models-tab').first().click();
  await expect(page.locator('.timerow__in[data-p="1"][data-key="start"]')).toHaveValue('07:00');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('schedule remains daily-columns only with concise class labels and Home timing context', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/schedule');
  await page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'الخامس الابتدائي / تجريبي 5' });
    const teaching = await window.store.createTeaching({ sectionId: section.id, subjectId: window.store.subjects()[0].id });
    await window.store.addSlot(teaching.id, 0, 1);
  });
  await page.reload();
  await expect(page.locator('.schedule-head')).toBeVisible();
  await expect(page.locator('.week__day')).toHaveCount(5);
  await expect(page.locator('.schedule-layout-switcher')).toHaveCount(0);
  await expect(page.locator('.schedule-class-card')).toContainText('الخامس الابتدائي — تجريبي 5');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.goto('/#/');
  await expect(page.locator('.hero__main-row .compact-timing-pill')).toBeVisible();
  expect(errors).toEqual([]);
});
