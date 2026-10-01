import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [1440, 1366, 1024, 768, 390, 320];

test('frozen Calendar R2 presents the approved hierarchy across widths and themes', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/#/calendar');
  await page.waitForFunction(() => window.store?.state?.ready === true);

  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 390 ? 780 : 900 });
      await expect(page.locator('.calendar-work-0417')).toBeVisible();
      await expect(page.locator('.calendar-identity h1')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'أين نحن الآن؟' })).toBeVisible();
      await expect(page.locator('.calendar-next-0415')).toBeVisible();
      await expect(page.locator('.timeline-track[role="progressbar"]')).toHaveCount(1);
      await expect(page.getByText('أنت هنا')).toBeVisible();
      await expect(page.locator('.calendar-term')).toHaveCount(2);
      await expect(page.getByRole('heading', { name: 'الإجازات والفترات الدراسية' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'إضافة استثناء' })).toBeVisible();
      await expect(page.locator('.holiday-filters button')).toHaveCount(4);

      const geometry = await page.evaluate(() => {
        const top = [...document.querySelectorAll('.calendar-top-0415 > article')].map(el => el.getBoundingClientRect());
        const controls = [...document.querySelectorAll('.calendar-work-0417 button')].filter(el => el.getClientRects().length);
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          direction: getComputedStyle(document.documentElement).direction,
          topHeights: top.map(rect => rect.height),
          topRows: top.map(rect => rect.y),
          undersized: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
            .map(el => el.textContent.trim()),
        };
      });
      expect(geometry.overflow, `${width} ${theme} horizontal overflow`).toBe(false);
      expect(geometry.direction).toBe('rtl');
      expect(geometry.undersized, `${width} ${theme} actionable controls`).toEqual([]);
      if (width >= 900) {
        expect(Math.abs(geometry.topHeights[0] - geometry.topHeights[1]), `${width} ${theme} top card height`).toBeLessThanOrEqual(2);
        expect(Math.abs(geometry.topRows[0] - geometry.topRows[1]), `${width} ${theme} top card alignment`).toBeLessThanOrEqual(2);
      }
      await page.screenshot({ path: testInfo.outputPath(`calendar-r2-${width}-${theme}.png`), fullPage: true });
    }
  }

  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole('button', { name: 'إضافة استثناء' }).click();
  await expect(page.getByRole('dialog').locator('[name="kind"]')).toHaveCount(4);
  await expect(page.getByRole('dialog')).toContainText('دراسة حضورية');
  await expect(page.getByRole('dialog')).toContainText('دراسة عن بُعد');
  await expect(page.getByRole('dialog')).toContainText('تعليق دراسة');
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
  await expect(page.locator('.calendar-work-settings-tabs button')).toHaveCount(3);
  await page.getByRole('dialog').getByRole('button', { name: 'تم', exact: true }).click();
  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await page.goto('/#/home');
  await page.goto('/#/calendar');
  await expect(page.locator('[data-filter="upcoming"]')).toHaveAttribute('aria-pressed', 'true');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(scan.violations.map(({ id, nodes }) => ({ id, count: nodes.length }))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Demo Calendar uses official reference data without Product cloud traffic', async ({ page }) => {
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
  await page.goto('/#/calendar');
  await expect(page.locator('.calendar-work-0417')).toBeVisible();
  const reference = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const db = await import('/src/lib/db.js');
    const { getCalendarPreset, calendarPresetRecords } = await import('/src/lib/calendar-presets.js');
    const preset = getCalendarPreset();
    const year = store.activeYear();
    const terms = store.termsOf(year.id);
    return {
      workspace: store.getActiveWorkspace()?.type,
      year: year.id,
      terms: terms.map(term => [term.startDate, term.endDate]),
      expectedTerms: preset.terms.map(term => [term.startDate, term.endDate]),
      officialDays: store.calendarDaysOf('demo:calendar').length,
      expectedDays: calendarPresetRecords(preset).calendarDays.length,
      outbox: (await db.getAll('outbox')).length,
    };
  });
  expect(reference.workspace).toBe('demo');
  expect(reference.year).toBe('demo:year:1448');
  expect(reference.terms).toEqual(reference.expectedTerms);
  expect(reference.officialDays).toBe(reference.expectedDays);
  expect(reference.officialDays).toBeGreaterThan(0);
  expect(reference.outbox).toBe(0);
  expect(productRequests).toEqual([]);
  expect(errors).toEqual([]);
});
