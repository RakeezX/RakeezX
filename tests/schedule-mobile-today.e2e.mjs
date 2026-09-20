import { test, expect } from '@playwright/test';

const ARABIC_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

async function seedWeeklySchedule(page, { includeToday = true } = {}) {
  await page.evaluate(async ({ includeToday: withToday }) => {
    const stamp = (value) => {
      const normalized = (value + 1440) % 1440;
      return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
    };
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const profile = {
      id: `schedule-mobile-profile-${Date.now()}`,
      name: 'توقيت المراجعة',
      periods: [
        { period: 1, start: stamp(currentMinutes - 70), end: stamp(currentMinutes - 35) },
        { period: 2, start: stamp(currentMinutes - 10), end: stamp(currentMinutes + 20) },
        { period: 3, start: stamp(currentMinutes + 30), end: stamp(currentMinutes + 65) },
      ],
      overrides: { config: { recess: { enabled: false } } },
    };
    await window.store.save({ timeProfiles: [profile] });
    await window.store.setActiveTimeProfile(profile.id);
    const section = await window.store.createSection({ grade: 5, label: `مراجعة-${Date.now()}` });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const today = new Date().getDay();
    for (const day of [0, 1, 2, 3, 4]) {
      if (withToday || day !== today) await window.store.addSlot(teaching.id, day, day === today ? 2 : 1);
    }
  }, { includeToday });
}

test('mobile Schedule opens Today, highlights the current slot, and keeps every day reachable', async ({ page }, testInfo) => {
  test.skip([5, 6].includes(new Date().getDay()), 'Current-slot view requires a school day.');
  const fixedNow = new Date();
  fixedNow.setHours(8, 20, 0, 0);
  await page.clock.setFixedTime(fixedNow);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await seedWeeklySchedule(page);
  await page.reload();

  await expect(page.locator('.schedule-day-tab.is-active')).toHaveText(new RegExp(ARABIC_WEEKDAYS[new Date().getDay()]));
  await expect(page.locator('.week__day:visible')).toHaveCount(1);
  await expect(page.locator('.slot.is-current-slot')).toHaveCount(1);
  await expect(page.locator('.slot.is-current-slot')).toContainText('جارية الآن');
  await page.screenshot({ path: testInfo.outputPath('schedule-today-390.png'), fullPage: true });

  for (const width of [320, 360, 412, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`schedule-today-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [day, label] of [['all', 'الكل'], ['0', 'الأحد'], ['1', 'الاثنين'], ['2', 'الثلاثاء'], ['3', 'الأربعاء'], ['4', 'الخميس']]) {
    await page.locator(`.schedule-day-tab[data-day="${day}"]`).click();
    await expect(page.locator('.schedule-day-tab.is-active')).toHaveText(new RegExp(label));
  }
  await page.locator('.schedule-day-tab[data-day="all"]').click();
  await expect(page.locator('.week__day:visible')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('mobile Schedule uses the locked empty-Today wording on a teaching day', async ({ page }) => {
  test.skip([5, 6].includes(new Date().getDay()), 'Today is not a school day.');
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await seedWeeklySchedule(page, { includeToday: false });
  await page.reload();
  await expect(page.locator('.schedule-day-tab.is-active')).toHaveText(new RegExp(ARABIC_WEEKDAYS[new Date().getDay()]));
  await expect(page.locator('.week__empty')).toHaveText('لا توجد لديك حصص مجدولة اليوم.');
});

test('mobile Schedule defaults to All on a non-teaching calendar day', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await seedWeeklySchedule(page);
  await page.evaluate(async () => {
    const date = new Date();
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const calendar = await window.store.ensureCalendar();
    await window.store.setCalendarDay(calendar.id, iso, 'holiday', 'إجازة تجريبية');
  });
  await page.reload();
  await expect(page.locator('.schedule-day-tab.is-active')).toHaveText('الكل');
});
