import { test, expect } from '@playwright/test';

async function seedRangeFixture(page) {
  return page.evaluate(async () => {
    const profile = await window.store.createTimeProfile({
      name: 'توقيت اختبار النطاق RTL',
      activeFrom: '2000-01-01',
      periods: [
        { period: 1, start: '07:00', end: '07:45' },
        { period: 2, start: '07:45', end: '08:30' },
      ],
    });
    await window.store.setActiveTimeProfile(profile.id);
    const section = await window.store.createSection({ grade: 5, label: 'ز', name: 'الخامس / ز' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    await window.store.ensureSession(teaching.id, today, 1, { startTime: '07:00', endTime: '07:45' });
    await window.store.ensureSession(teaching.id, today, 2, { startTime: '07:45', endTime: '08:30' });
    return { teachingId: teaching.id, weekday: 0 };
  });
}

async function expectRTLRange(scope, startTime, endTime) {
  const expected = `${startTime} – ${endTime}`;
  const range = scope.locator('.time-range:visible').filter({ hasText: expected }).first();
  await expect(range).toHaveText(expected);
  await expect(range).not.toHaveAttribute('dir', 'ltr');

  const tokens = range.locator('[data-time-token], .time-range__token');
  await expect(tokens).toHaveCount(2);
  const start = tokens.first();
  const dash = range.locator('.time-range__dash');
  const end = tokens.last();
  await expect(start).toHaveText(startTime);
  await expect(end).toHaveText(endTime);

  const [startBox, dashCount, endBox] = await Promise.all([
    start.boundingBox(), dash.count(), end.boundingBox(),
  ]);
  expect(startBox).not.toBeNull();
  expect(endBox).not.toBeNull();
  expect(startBox.x).toBeGreaterThan(endBox.x);
  if (dashCount) {
    const dashBox = await dash.boundingBox();
    expect(dashBox).not.toBeNull();
    expect(startBox.x).toBeGreaterThan(dashBox.x);
    expect(dashBox.x).toBeGreaterThan(endBox.x);
  }

  const styles = await range.evaluate((element) => {
    const rangeStyle = getComputedStyle(element);
    const tokens = [...element.querySelectorAll('[data-time-token], .time-range__token')].map((token) => {
      const style = getComputedStyle(token);
      return { direction: style.direction, unicodeBidi: style.unicodeBidi };
    });
    return { direction: rangeStyle.direction, display: rangeStyle.display, tokens };
  });
  expect(styles.direction).toBe('rtl');
  expect(['inline-flex', 'flex']).toContain(styles.display);
  expect(styles.tokens).toEqual([
    { direction: 'ltr', unicodeBidi: 'isolate' },
    { direction: 'ltr', unicodeBidi: 'isolate' },
  ]);

  return { start: startBox.x, end: endBox.x };
}

async function expectRangesStayInViewport(page) {
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const animations = document.getAnimations().map((animation) => animation.finished.catch(() => undefined));
    await Promise.all(animations);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const rangesFit = await page.evaluate(() => [...document.querySelectorAll('.time-range')].every((range) =>
    range.scrollWidth <= Math.ceil(range.getBoundingClientRect().width)
  ));
  expect(rangesFit).toBe(true);
}
test('RTL time ranges keep starts physically right of ends at all required viewports', async ({ page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await seedRangeFixture(page);

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 1024, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/#/teaching/${fixture.teachingId}/sessions`);
    await expect(page.getByRole('heading', { name: 'الحصص' })).toBeVisible();
    await expectRTLRange(page, '07:00', '07:45');
    await expectRTLRange(page, '07:45', '08:30');
    await expectRangesStayInViewport(page);
  }
});

test('canonical range renderer covers home, execution report, weekly schedule, and add-lesson sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await seedRangeFixture(page);

  await page.goto('/#/');
  await expect(page.getByRole('region', { name: 'حصص اليوم' })).toBeVisible();
  await expectRTLRange(page, '07:00', '07:45');
  await expectRTLRange(page, '07:45', '08:30');

  await page.goto('/#/reports/execution');
  await expect(page.getByRole('heading', { name: 'تقارير التنفيذ' })).toBeVisible();
  await expectRTLRange(page, '07:00', '07:45');
  await expectRTLRange(page, '07:45', '08:30');

  await page.evaluate(async ({ teachingId, weekday }) => {
    await window.store.addSlot(teachingId, weekday, 1);
    await window.store.addSlot(teachingId, weekday, 2);
  }, fixture);
  await page.goto('/#/schedule');
  await expect(page.getByRole('heading', { name: 'الجدول' })).toBeVisible();
  await page.getByRole('tab', { name: 'الأحد', exact: true }).click();
  await expectRTLRange(page, '07:00', '07:45');
  await expectRTLRange(page, '07:45', '08:30');

  await page.getByRole('button', { name: 'حصة في الجدول' }).click();
  const sheet = page.locator('.sheet');
  await sheet.locator('[name="teachingId"]').selectOption(fixture.teachingId);
  await sheet.locator('[name="weekday"]').selectOption('1');
  await sheet.locator('[name="period"]').selectOption('1');
  await expectRTLRange(sheet, '07:00', '07:45');
  await expectRangesStayInViewport(page);

  await page.setViewportSize({ width: 1024, height: 800 });
  await expectRTLRange(sheet, '07:00', '07:45');
  await expectRangesStayInViewport(page);
});

test('Time Profiles recess display uses the canonical RTL range renderer', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/#/schedule/times');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const { generateAdvancedPeriods } = await import('/src/models.js');
    const config = {
      count: 4,
      firstPeriodStart: '08:00',
      periodDuration: 45,
      gap: 0,
      recess: { enabled: true, afterPeriod: 2, duration: 20, transition: 0 },
    };
    await window.store.save({
      timeProfiles: [{
        id: 'rtl-recess-browser',
        name: 'توقيت فسحة RTL',
        order: 99,
        periods: generateAdvancedPeriods(config),
        overrides: { config },
      }],
    }, { queue: false });
    await window.store.patchProfile({ activeTimeProfileId: 'rtl-recess-browser' }, { queue: false });
    window.store.repaint();
  });
  await page.locator('[data-act="edit-times"][data-id="rtl-recess-browser"]').click();
  const recessRange = page.locator('.row-recess .time-range').first();
  await expect(recessRange).toBeVisible();
  const values = await recessRange.locator('.time-range__token').evaluateAll((tokens) => tokens.map((token) => token.textContent.trim()));
  await expectRTLRange(page, values[0], values[1]);
  await expectRangesStayInViewport(page);
});
