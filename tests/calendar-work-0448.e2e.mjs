import { test, expect } from '@playwright/test';

test('fresh Calendar entry starts at upcoming; distinct exceptions use existing durable range actions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-01T09:00:00+03:00'));
  await page.goto('/#/calendar');
  await expect(page.locator('.cal-filter-btn[data-filter="upcoming"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.cal-filter-btn[data-filter="all"]').click();
  await expect(page.locator('.cal-filter-btn[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'الجدول', exact: true }).click();
  await expect(page.getByRole('heading', { name: /الجدول الفصل/ })).toBeVisible();
  await page.getByRole('link', { name: 'التقويم', exact: true }).click();
  await expect(page.getByRole('button', { name: 'إضافة استثناء', exact: true })).toBeVisible();
  await expect(page.locator('.cal-filter-btn[data-filter="upcoming"]')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[name="kind"]')).toHaveCount(4);
  await dialog.getByLabel('تعليق دراسة').check();
  await expect(dialog.locator('.cal-holiday-choice')).toBeHidden();
  await dialog.locator('[name="label"]').fill('تعليق دراسة تجريبي 0448');
  await dialog.locator('[name="startDate"]').fill('2026-10-19');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(dialog).toHaveCount(0);
  const suspension = page.locator('.calendar-period').filter({ hasText: 'تعليق دراسة تجريبي 0448' });
  await expect(suspension).toContainText('تعليق دراسة');
  await page.reload();
  await expect(suspension).toBeVisible();
  expect(await page.evaluate(() => window.store.calendarRangesOf().find((r) => r.label === 'تعليق دراسة تجريبي 0448')?.kind)).toBe('suspension');

  await suspension.getByRole('button', { name: /تفاصيل/ }).click();
  await expect(dialog.getByText(/لا توجد حصص مجدولة أو جلسات مسجلة/)).toBeVisible();
  await dialog.getByRole('button', { name: 'تعديل الاستثناء' }).click();
  await dialog.locator('[name="label"]').fill('تعليق دراسة معدّل 0448');
  await dialog.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'تعليق دراسة معدّل 0448' })).toBeVisible();
  await page.locator('.calendar-period').filter({ hasText: 'تعليق دراسة معدّل 0448' }).getByRole('button', { name: /تفاصيل/ }).click();
  await dialog.getByRole('button', { name: 'حذف الاستثناء' }).click();
  await dialog.getByRole('button', { name: 'احذف' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'تعليق دراسة معدّل 0448' })).toHaveCount(0);

  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  await dialog.getByLabel('إجازة', { exact: true }).check();
  await dialog.locator('[name="holidayContext"]').selectOption('other');
  await dialog.locator('[name="label"]').fill('إجازة تجريبية 0448');
  await dialog.locator('[name="startDate"]').fill('2026-10-20');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'إجازة تجريبية 0448' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.calendar-period').filter({ hasText: 'إجازة تجريبية 0448' })).toBeVisible();
  expect(await page.evaluate(() => window.store.calendarRangesOf().find((r) => r.label === 'إجازة تجريبية 0448')?.kind)).toBe('holiday');

  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  await dialog.getByLabel('دراسة عن بُعد').check();
  await dialog.locator('[name="label"]').fill('دراسة بعيدة تجريبية 0448');
  await dialog.locator('[name="startDate"]').fill('2026-10-21');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await page.locator('.cal-filter-btn[data-filter="exceptions"]').click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'دراسة بعيدة تجريبية 0448' })).toContainText('دراسة عن بُعد');
  expect(await page.evaluate(() => window.store.calendarRangesOf().find((r) => r.label === 'دراسة بعيدة تجريبية 0448')?.kind)).toBe('remote');
  expect(errors).toEqual([]);
});

test('approved Calendar hierarchy stays responsive, RTL and operable across six widths in both themes', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/calendar');
  await expect(page.locator('.cal-radar-grid .cal-card')).toHaveCount(2);
  for (const width of [1440, 1366, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const geometry = await page.evaluate(() => {
        const a = document.querySelector('.cal-radar-grid .cal-card');
        const b = document.querySelector('.cal-radar-grid .cal-card + .cal-card');
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        const controls = [...document.querySelectorAll('.calendar-work-0448 :is(button,summary)')]
          .filter((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
        return {
          dir: getComputedStyle(document.documentElement).direction,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          a: { x: ar.x, y: ar.y, width: ar.width, height: ar.height },
          b: { x: br.x, y: br.y, width: br.width, height: br.height },
          shortControl: controls.find((el) => el.getBoundingClientRect().height < 44)?.textContent?.trim() ?? null,
        };
      });
      expect(geometry.dir, `${width}/${theme}`).toBe('rtl');
      expect(geometry.overflow, `${width}/${theme}`).toBe(false);
      expect(geometry.shortControl, `${width}/${theme}`).toBeNull();
      if ((width === 1440 || width === 390) && theme === 'light')
        await page.screenshot({ path: testInfo.outputPath(`calendar-${width}-light.png`), fullPage: true });
      if (width >= 900) {
        expect(Math.abs(geometry.a.width - geometry.b.width), `${width}/${theme} equal columns`).toBeLessThan(1);
        expect(Math.abs(geometry.a.height - geometry.b.height), `${width}/${theme} equal heights`).toBeLessThan(1);
        expect(Math.abs(geometry.a.y - geometry.b.y), `${width}/${theme} aligned tops`).toBeLessThan(1);
      } else expect(geometry.b.y, `${width}/${theme} stacked cards`).toBeGreaterThan(geometry.a.y);
    }
  }
  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('تعليق دراسة')).toBeVisible();
  await dialog.getByLabel('تعليق دراسة').focus();
  await expect(dialog.getByLabel('تعليق دراسة')).toBeFocused();
  await dialog.locator('[name="label"]').focus();
  await expect(dialog.locator('[name="label"]')).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'إضافة الاستثناء' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Demo Calendar uses the same exception UI without Product cloud access or outbox work', async ({ page }) => {
  let cloudRequests = 0;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://*.supabase.co/**', (route) => { cloudRequests += 1; return route.abort(); });
  await page.goto('/');
  const demo = page.getByRole('button', { name: 'جرّب ركيز', exact: true });
  if (!await demo.isVisible().catch(() => false))
    await page.getByRole('button', { name: /مركز المعلم/ }).click();
  await demo.click();
  await page.getByRole('link', { name: 'التقويم', exact: true }).click();
  await expect(page.locator('.cal-filter-btn[data-filter="upcoming"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('تعليق دراسة').check();
  await dialog.locator('[name="label"]').fill('تعليق محلي للعرض 0448');
  await dialog.locator('[name="startDate"]').fill('2026-10-19');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(page.locator('.calendar-period').filter({ hasText: 'تعليق محلي للعرض 0448' })).toBeVisible();
  const state = await page.evaluate(async () => ({
    kind: window.store.calendarRangesOf().find((range) => range.label === 'تعليق محلي للعرض 0448')?.kind,
    outbox: (await (await import('/src/lib/db.js')).getAll('outbox')).length,
  }));
  expect(state).toEqual({ kind: 'suspension', outbox: 0 });
  expect(cloudRequests).toBe(0);
  expect(errors).toEqual([]);
});
