import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [1440, 1366, 1024, 768, 390, 320];

test('accepted Schedule and Timing surfaces retain content, geometry and accessibility', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'فصل المراجعة' });
    const teaching = await window.store.createTeaching({ sectionId: section.id, subjectId: window.store.subjects()[0].id });
    for (const day of [0, 1, 2, 3, 4]) {
      await window.store.addSlot(teaching.id, day, 1);
      await window.store.addSlot(teaching.id, day, 2);
    }
  });
  await page.reload();

  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/schedule');
      await expect(page.getByText('تعديل ملفات أوقات الحصص')).toBeVisible();
      await expect(page.locator('.slot').first()).toContainText('فصل المراجعة');
      const scheduleGeometry = await page.evaluate(() => {
        const slots = [...document.querySelectorAll('.slot')].filter(el => el.getClientRects().length);
        const heights = slots.map(el => el.getBoundingClientRect().height);
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          spread: Math.max(...heights) - Math.min(...heights),
          direction: getComputedStyle(document.documentElement).direction,
        };
      });
      expect(scheduleGeometry.overflow, `Schedule ${width} ${theme}`).toBe(false);
      expect(scheduleGeometry.direction).toBe('rtl');
      if (width >= 900) expect(scheduleGeometry.spread, `Schedule equal-height ${width} ${theme}`).toBeLessThanOrEqual(2);
      await page.screenshot({ path: testInfo.outputPath(`schedule-${width}-${theme}.png`), fullPage: true });

      await page.goto('/#/schedule/times');
      await expect(page.getByRole('heading', { name: 'ملفات توقيت الحصص' })).toBeVisible();
      await expect(page.locator('.seasonal-activation-bar')).toHaveCount(1);
      await expect(page.getByText('الجدول · إدارة التوقيت')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `Timing ${width} ${theme}`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`times-${width}-${theme}.png`), fullPage: true });
    }
  }

  for (const route of ['/#/schedule', '/#/schedule/times']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations.map(({ id, nodes }) => ({ id, count: nodes.length })), route).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('Demo Schedule and Timing remain local and open their real controls', async ({ page }) => {
  const productRequests = [];
  const errors = [];
  page.on('request', request => {
    if (/supabase\.co|\/rest\/v1\/|\/auth\/v1\//i.test(request.url())) productRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const firstRunDemo = page.getByRole('button', { name: 'جرّب ركيز المعلم' });
  if (await firstRunDemo.isVisible()) await firstRunDemo.click();
  else {
    await page.getByRole('button', { name: /مركز المعلم/ }).click();
    await page.getByRole('button', { name: 'جرّب ركيز', exact: true }).click();
  }
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.getByRole('navigation').getByRole('link', { name: 'الجدول', exact: true }).click();
  await expect(page).toHaveURL(/#\/schedule$/);
  await expect(page.getByText('تعديل ملفات أوقات الحصص')).toBeVisible();
  await page.getByText('تعديل ملفات أوقات الحصص').click();
  await expect(page.getByRole('heading', { name: 'ملفات توقيت الحصص' })).toBeVisible();
  await page.locator('[data-act="edit-times"]').first().click();
  await expect(page.locator('.sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).not.toBeVisible();
  expect(productRequests).toEqual([]);
  expect(errors).toEqual([]);
});
