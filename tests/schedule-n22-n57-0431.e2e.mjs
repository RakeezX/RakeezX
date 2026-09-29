import { test, expect, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [1440, 1366, 1180, 1024, 900, 768, 430, 390, 375, 320];
const subjects = [
  'المهارات الرقمية', 'المهارات الحياتية والأسرية',
  'التربية البدنية والدفاع عن النفس', 'الدراسات الاجتماعية',
  'القرآن الكريم والدراسات الإسلامية',
];

async function populate(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready);
  await page.evaluate(async (names) => {
    for (let i = 0; i < names.length; i++) {
      const section = await window.store.createSection({ grade: 5, label: `اختبار ${i + 1}` });
      const subject = await window.store.createSubject({ name: names[i] });
      const teaching = await window.store.createTeaching({ sectionId: section.id, subjectId: subject.id });
      await window.store.addSlot(teaching.id, i, i + 1);
    }
  }, subjects);
}

async function checkLayout(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#/schedule');
  if (width <= 768) await page.locator('.schedule-day-tab[data-day="all"]').click();
  await expect(page.locator('.week .slot:visible')).toHaveCount(5);
  await expect.poll(async () => page.locator('.week .slot:visible').first().evaluate((card) => card.style.height)).not.toBe('');
  const result = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.week .slot')].filter((card) => card.getClientRects().length);
    const heights = cards.map((card) => Math.round(card.getBoundingClientRect().height));
    const labels = cards.map((card) => card.querySelector('.slot__subject')?.innerText);
    const days = [...document.querySelectorAll('.week__day')].map((day) => ({ x: Math.round(day.getBoundingClientRect().x), y: Math.round(day.getBoundingClientRect().y) }));
    const tabs = getComputedStyle(document.querySelector('.schedule-day-tabs')).gridTemplateColumns.split(' ').length;
    return { heights, labels, days, tabs, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  expect(new Set(result.heights).size, `${width}px equal height`).toBe(1);
  expect(result.labels).toEqual(subjects);
  expect(result.overflow, `${width}px overflow`).toBe(false);
  if (width >= 1440) expect(new Set(result.days.map((day) => day.y)).size).toBe(1);
  if (width >= 1001 && width < 1440) expect(new Set(result.days.map((day) => day.y)).size).toBe(2);
  if (width <= 390) expect(result.tabs).toBe(3);
  return result;
}

test('N22 dynamic visible-card height and N57 Schedule presentation across approved widths', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await populate(page);
  for (const width of widths) {
    await checkLayout(page, width);
    if (width === 1440 || width === 390)
      await page.screenshot({ path: testInfo.outputPath(`schedule-${width}-light.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/schedule');
  const allHeight = await page.locator('.week .slot:visible').first().evaluate((card) => card.style.height);
  await page.locator('.schedule-day-tab[data-day="0"]').click();
  await expect(page.locator('.week .slot:visible')).toHaveCount(1);
  await expect.poll(async () => page.locator('.week .slot:visible').first().evaluate((card) => card.style.height)).not.toBe('');
  const dayHeight = await page.locator('.week .slot:visible').first().evaluate((card) => card.style.height);
  expect(parseFloat(dayHeight)).toBeLessThanOrEqual(parseFloat(allHeight));
  await page.locator('.schedule-day-tab[data-day="all"]').click();
  await expect(page.locator('.week .slot:visible')).toHaveCount(5);
  await page.getByRole('button', { name: 'تصدير الجدول' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).last().click();
  await page.goto('/#/schedule/times');
  await expect(page.locator('.timing-profile-card')).not.toHaveCount(0);
  const rows = page.locator('.timing-profile-card__actions-row');
  await expect(rows.first().locator('.timing-profile-card__rename')).toContainText('تعديل الاسم وفترة سريان التوقيت');
  await expect(page.locator('.timing-profile-card.is-base-profile .timing-profile-card__delete')).toHaveCount(0);
  for (const deleteButton of await page.locator('.timing-profile-card__delete').all()) {
    await expect(deleteButton).toHaveAttribute('aria-label', 'حذف ملف التوقيت');
    const box = await deleteButton.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('timing-390-light.png'), fullPage: true });
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'داكن', exact: true }).click();
  for (const width of [390, 320]) {
    await checkLayout(page, width);
    await page.screenshot({ path: testInfo.outputPath(`schedule-${width}-dark.png`), fullPage: true });
  }
  await page.goto('/#/schedule/times');
  await page.screenshot({ path: testInfo.outputPath('timing-320-dark.png'), fullPage: true });
  expect((await new AxeBuilder({ page }).include('.timing-profiles-page').analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('N22/N57 local WebKit Schedule and Timing smoke', async ({ baseURL }) => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await populate(page);
    await checkLayout(page, 390);
    await page.goto(`${baseURL}/#/schedule/times`);
    await expect(page.locator('.timing-profile-card__rename').first()).toBeVisible();
    await context.close();
  } finally {
    await browser.close();
  }
});
