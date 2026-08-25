import { test, expect } from '@playwright/test';

async function seedSession(page) {
  return page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'ز', name: 'الخامس / ز' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const session = await window.store.ensureSession(teaching.id, today, 1, { startTime: '07:00', endTime: '07:45' });
    return { teachingId: teaching.id, sessionId: session.id, weekday: now.getDay() };
  });
}

async function expectChronologicalRange(page, expected) {
  const range = page.locator('.time-range').filter({ hasText: expected }).first();
  await expect(range).toHaveText(expected);
  await expect(range).toHaveAttribute('dir', 'ltr');
  await expect(range.locator('bdi')).toHaveText(expected.split(' – '));
}

test('RTL mobile renders canonical session, home, and report time ranges chronologically', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await seedSession(page);

  await page.goto(`/#/teaching/${fixture.teachingId}/sessions`);
  await expect(page.getByRole('heading', { name: 'الحصص' })).toBeVisible();
  await expectChronologicalRange(page, '07:00 – 07:45');

  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'الرئيسية' })).toBeVisible();
  await expectChronologicalRange(page, '07:00 – 07:45');

  await page.goto('/#/reports/execution');
  await expect(page.getByRole('heading', { name: 'تقارير التنفيذ' })).toBeVisible();
  await expectChronologicalRange(page, '07:00 – 07:45');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('timing profile and timetable preserve start-to-end order on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/schedule/times');
  await page.waitForFunction(() => window.store);
  const range = page.locator('.timerow__range').first();
  const start = range.getByLabel('بداية الحصة 1');
  const end = range.getByLabel('نهاية الحصة 1');
  await expect(range).toHaveAttribute('dir', 'ltr');
  await expect(start).toHaveValue('07:00');
  await expect(end).toHaveValue('07:45');
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  expect(startBox.x).toBeLessThan(endBox.x);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/schedule');
  const fixture = await seedSession(page);
  await page.evaluate(async ({ teachingId, weekday }) => window.store.addSlot(teachingId, weekday, 1), fixture);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'الجدول' })).toBeVisible();
  await expectChronologicalRange(page, '07:00 – 07:45');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});