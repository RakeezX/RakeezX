import { test, expect, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const calendar = (page) => page.locator('.calendar-management-page');
const filters = (page) => calendar(page).locator('.cal-filters-row');

test('fresh Calendar visit defaults to upcoming holidays and retains a chosen filter during the visit', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+03:00'));
  await page.goto('/#/calendar');
  await expect(filters(page).getByRole('button', { name: /القادمة/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(calendar(page).getByText('إجازة اليوم الوطني')).toHaveCount(0);
  await filters(page).getByRole('button', { name: /الكل/ }).click();
  await expect(calendar(page).getByText('إجازة اليوم الوطني')).toBeVisible();
  await calendar(page).getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'تم', exact: true }).click();
  await expect(filters(page).getByRole('button', { name: /الكل/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();
  await page.goto('/#/calendar');
  await expect(filters(page).getByRole('button', { name: /القادمة/ })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('Calendar keeps one exception entry, existing edit path, and balanced responsive overview', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+03:00'));
  await page.goto('/#/calendar');
  await expect(calendar(page)).toBeVisible();
  await expect(calendar(page).getByRole('heading', { name: 'المحطة القادمة' })).toBeVisible();
  await expect(calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true })).toHaveCount(1);
  await expect(calendar(page).getByText('إضافة استثناء أو تمديد لهذه الإجازة')).toHaveCount(0);
  await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('إضافة استثناء للتقويم')).toBeVisible();
  await page.getByRole('dialog').getByLabel('اختر الإجازة').selectOption('other');
  await page.getByRole('dialog').getByLabel('اسم الاستثناء *').fill('إجازة اختبار محلية');
  await page.getByRole('dialog').getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await expect(calendar(page).locator('.cal-period-title', { hasText: 'إجازة اختبار محلية' })).toBeVisible();
  await calendar(page).getByRole('button', { name: 'تفاصيل إجازة اختبار محلية' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تعديل الاستثناء' }).click();
  await expect(page.getByRole('dialog').getByText('تعديل الاستثناء')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
  await page.reload();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await expect(calendar(page).locator('.cal-period-title', { hasText: 'إجازة اختبار محلية' })).toBeVisible();

  for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.calendar-overview-card')].map((node) => node.getBoundingClientRect());
      const filterGrid = document.querySelector('.cal-filters-row');
      const row = document.querySelector('.holiday-row');
      const date = row.querySelector('.holiday-date').getBoundingClientRect();
      const info = row.querySelector('.holiday-info').getBoundingClientRect();
      const detail = row.querySelector('.holiday-detail').getBoundingClientRect();
      return { cards: cards.map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, filterColumns: getComputedStyle(filterGrid).gridTemplateColumns.split(' ').length, rowColumns: getComputedStyle(row).gridTemplateColumns.split(' ').length, row: { date: { x: date.x, y: date.y }, info: { x: info.x, y: info.y }, detail: { x: detail.x, y: detail.y } } };
    });
    expect(geometry.overflow, `${width}px overflow`).toBe(false);
    expect(geometry.row.info.y - geometry.row.date.y, `${width}px date and title beside one another`).toBeLessThan(22);
    expect(geometry.row.detail.y - geometry.row.date.y, `${width}px detail beside date`).toBeLessThan(22);
    expect(geometry.rowColumns, `${width}px Work holiday grid`).toBe(width < 600 ? 3 : 4);
    if (width >= 900) {
      expect(Math.abs(geometry.cards[0].width - geometry.cards[1].width), `${width}px widths`).toBeLessThan(1);
      expect(Math.abs(geometry.cards[0].height - geometry.cards[1].height), `${width}px heights`).toBeLessThan(1);
    } else {
      expect(geometry.cards[1].y, `${width}px stacked cards`).toBeGreaterThan(geometry.cards[0].y);
      if (width < 600) expect(geometry.filterColumns, `${width}px filter columns`).toBe(2);
    }
    await page.screenshot({ path: testInfo.outputPath(`calendar-list-${width}-light.png`), fullPage: true });
    if (width === 1440 || width === 390) {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.screenshot({ path: testInfo.outputPath(`calendar-list-${width}-dark.png`), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    }
  }
  await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('dialog').getByRole('group', { name: 'نوع الاستثناء' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), `${width}px form overflow`).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`calendar-form-${width}-light.png`), fullPage: true });
    if (width === 1440 || width === 390) {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.screenshot({ path: testInfo.outputPath(`calendar-form-${width}-dark.png`), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    }
  }
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
  await filters(page).getByRole('button', { name: /رسمية معتمدة/ }).click();
  const official = calendar(page).locator('.calendar-period', { hasText: 'إجازة اليوم الوطني' });
  await expect(official).toBeVisible();
  await expect(official.getByRole('button', { name: /تعديل|حذف/ })).toHaveCount(0);
  await official.getByRole('button', { name: 'تفاصيل إجازة اليوم الوطني' }).click();
  await expect(page.getByRole('dialog')).toContainText('الحصص المتأثرة');
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).last().click();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await calendar(page).getByRole('button', { name: 'تفاصيل إجازة اختبار محلية' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الاستثناء' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'احذف' }).click();
  await expect(calendar(page).locator('.cal-period-title', { hasText: 'إجازة اختبار محلية' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('official holiday context guides a local exception without persisting a reference', async ({ page }) => {
  await page.goto('/#/calendar');
  const add = calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true });
  await add.click();
  const dialog = page.getByRole('dialog');
  const reference = dialog.getByLabel('اختر الإجازة');
  await expect(reference).toBeVisible();
  await expect(reference.locator('option')).toContainText(['اختر الإجازة', 'إجازة اليوم الوطني']);
  await reference.selectOption(await reference.locator('option').filter({ hasText: 'إجازة اليوم الوطني' }).first().getAttribute('value'));
  await expect(dialog.getByText('الإجازة المرجعية:')).toBeVisible();
  const officialBefore = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    return store.calendarRangesOf().find((range) => range.label === 'إجازة اليوم الوطني');
  });
  await dialog.locator('[name="startDate"]').fill('2026-10-10');
  await dialog.locator('[name="endDate"]').fill('2026-10-11');
  await dialog.getByLabel('اسم الاستثناء *').fill('استثناء تجريبي مستقل');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await expect(calendar(page).locator('.cal-period-title', { hasText: 'استثناء تجريبي مستقل' })).toBeVisible();
  const saved = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    return {
      official: store.calendarRangesOf().find((range) => range.label === 'إجازة اليوم الوطني'),
      local: store.calendarRangesOf().find((range) => range.label === 'استثناء تجريبي مستقل'),
    };
  });
  expect(saved.official).toEqual(officialBefore);
  expect(saved.local.source).toBe('custom');
  expect(saved.local.startDate).toBe('2026-10-10');
  expect(saved.local.endDate).toBe('2026-10-11');
  expect(saved.local).not.toHaveProperty('officialHolidayId');
  expect(saved.local).not.toHaveProperty('referenceId');
  await calendar(page).getByRole('button', { name: 'تفاصيل استثناء تجريبي مستقل' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تعديل الاستثناء' }).click();
  await expect(page.getByRole('dialog').getByLabel('اختر الإجازة')).toHaveValue('other');
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
  await add.click();
  await dialog.getByRole('radio', { name: 'دراسة حضورية' }).check();
  await expect(reference).toBeHidden();
  await dialog.getByRole('radio', { name: 'دراسة عن بُعد' }).check();
  await expect(reference).toBeHidden();
  await dialog.getByRole('button', { name: 'إلغاء' }).click();
  await page.reload();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await expect(calendar(page).locator('.cal-period-title', { hasText: 'استثناء تجريبي مستقل' })).toBeVisible();
});

test('holiday auto-label follows the selected official range without replacing manual text', async ({ page }) => {
  await page.goto('/#/calendar');
  await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const reference = dialog.getByLabel('اختر الإجازة');
  const label = dialog.getByLabel('اسم الاستثناء *');
  const options = reference.locator('option:not([value=""]):not([value="other"])');
  const first = await options.nth(0).getAttribute('value');
  const second = await options.nth(1).getAttribute('value');
  await reference.selectOption(first);
  const generatedFirst = await label.inputValue();
  await reference.selectOption(second);
  expect(await label.inputValue()).not.toBe(generatedFirst);
  expect(await label.inputValue()).toMatch(/^استثناء /);
  await dialog.getByRole('radio', { name: 'دراسة عن بُعد' }).check();
  await expect(label).toHaveValue('');
  await dialog.getByRole('radio', { name: 'إجازة / تعليق دراسة' }).check();
  await reference.selectOption(first);
  await reference.selectOption('other');
  await expect(label).toHaveValue('');
  await reference.selectOption(first);
  await label.fill('استثناء باسمي');
  await reference.selectOption(second);
  await expect(label).toHaveValue('استثناء باسمي');
  await dialog.getByRole('radio', { name: 'دراسة حضورية' }).check();
  await expect(label).toHaveValue('استثناء باسمي');
  await dialog.getByRole('button', { name: 'إلغاء' }).click();
});

test('exception form keeps validation inline and does not save incomplete data', async ({ page }) => {
  await page.goto('/#/calendar');
  await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('اختر الإجازة أو إجازة أخرى.');
  await dialog.getByLabel('اختر الإجازة').selectOption('other');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('اكتب اسم الاستثناء.');
  await dialog.getByLabel('اسم الاستثناء *').fill('استثناء غير مكتمل');
  await dialog.locator('[name="startDate"]').fill('2026-10-11');
  await dialog.locator('[name="endDate"]').fill('2026-10-10');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await expect(dialog.getByRole('alert')).toContainText('تاريخ النهاية');
  await dialog.getByRole('button', { name: 'إلغاء' }).click();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await expect(calendar(page).locator('.holiday-row')).toHaveCount(0);
});

test('holiday reference selector works in local WebKit', async ({ baseURL }) => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseURL}/#/calendar`);
    await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const reference = dialog.getByLabel('اختر الإجازة');
    await reference.selectOption(await reference.locator('option').filter({ hasText: 'إجازة اليوم الوطني' }).first().getAttribute('value'));
    await expect(dialog.getByText('الإجازة المرجعية:')).toBeVisible();
    await dialog.getByRole('radio', { name: 'دراسة عن بُعد' }).check();
    await expect(reference).toBeHidden();
    await dialog.getByRole('radio', { name: 'إجازة / تعليق دراسة' }).check();
    await reference.selectOption('other');
    await expect(reference).toHaveValue('other');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await context.close();
  } finally {
    await browser.close();
  }
});

test('Work holiday row and exception form remain side-by-side and usable in WebKit mobile', async ({ baseURL }) => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/#/calendar`);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const row = calendar(page).locator('.holiday-row').first();
      await expect(row).toBeVisible();
      const geometry = await row.evaluate((node) => {
        const date = node.querySelector('.holiday-date').getBoundingClientRect();
        const info = node.querySelector('.holiday-info').getBoundingClientRect();
        return { columns: getComputedStyle(node).gridTemplateColumns.split(' ').length,
          dateY: date.y, infoY: info.y, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      expect(geometry.columns).toBe(3);
      expect(geometry.infoY - geometry.dateY).toBeLessThan(22);
      expect(geometry.overflow).toBe(false);
      await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
      await expect(page.getByRole('dialog').getByRole('radio', { name: 'إجازة / تعليق دراسة' })).toBeChecked();
      await expect(page.getByRole('dialog').getByLabel('اختر الإجازة')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
    }
    expect(errors).toEqual([]);
    await context.close();
  } finally {
    await browser.close();
  }
});

test('Calendar remains accessible in Chromium and WebKit with light and dark surfaces', async ({ page }) => {
  for (const browserPage of [page]) {
    await browserPage.goto('/#/calendar');
    await expect(calendar(browserPage)).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await browserPage.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      const result = await new AxeBuilder({ page: browserPage }).include('.calendar-management-page').analyze();
      expect(result.violations, `${theme} Calendar accessibility`).toEqual([]);
    }
  }
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const webkitPage = await context.newPage();
    await webkitPage.goto('/#/calendar');
    await expect(calendar(webkitPage)).toBeVisible();
    await expect(filters(webkitPage).getByRole('button', { name: /القادمة/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await webkitPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const result = await new AxeBuilder({ page: webkitPage }).include('.calendar-management-page').analyze();
    expect(result.violations).toEqual([]);
    await context.close();
  } finally {
    await browser.close();
  }
});

test('shared Calendar presentation works in isolated Demo without Product cloud calls', async ({ page }, testInfo) => {
  let cloudRequests = 0;
  await page.route('https://*.supabase.co/**', (route) => { cloudRequests += 1; return route.abort(); });
  await page.goto('/');
  const demoAction = page.getByRole('button', { name: 'جرّب ركيز', exact: true });
  if (!await demoAction.isVisible().catch(() => false))
    await page.getByRole('button', { name: /مركز المعلم/ }).click();
  await demoAction.click();
  await expect(page.getByRole('button', { name: 'الخروج من التجربة' }).first()).toBeVisible();
  await page.goto('/#/calendar');
  await expect(calendar(page).getByRole('heading', { name: 'المحطة القادمة' })).toBeVisible();
  await expect(calendar(page).locator('.holiday-row').first()).toBeVisible();
  await expect(calendar(page).locator('.holiday-row').first()).toContainText('إجازة');
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: testInfo.outputPath(`calendar-demo-${width}-light.png`), fullPage: true });
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: testInfo.outputPath('calendar-demo-390-dark.png'), fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(filters(page).getByRole('button', { name: /القادمة/ })).toHaveAttribute('aria-pressed', 'true');
  await calendar(page).getByRole('button', { name: 'إضافة استثناء', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('إضافة استثناء للتقويم')).toBeVisible();
  const choices = page.getByRole('dialog').getByLabel('اختر الإجازة').locator('option');
  await expect(choices.filter({ hasText: 'إجازة اليوم الوطني' })).toHaveCount(1);
  await expect(choices.filter({ hasText: 'إجازة نهاية أسبوع مطولة' })).toHaveCount(3);
  const repeatedLabels = await choices.filter({ hasText: 'إجازة نهاية أسبوع مطولة' }).allTextContents();
  expect(new Set(repeatedLabels).size).toBe(3);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('اختر الإجازة').selectOption('other');
  await dialog.getByLabel('اسم الاستثناء *').fill('إجازة Demo محلية');
  await dialog.getByRole('button', { name: 'إضافة الاستثناء' }).click();
  await filters(page).getByRole('button', { name: /استثناءات محلية/ }).click();
  await expect(calendar(page).locator('.holiday-row').getByText('إجازة Demo محلية')).toBeVisible();
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'إعادة ضبط البيانات التجريبية' }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('dialog').getByRole('button', { name: 'إعادة الضبط' }).click(),
  ]);
  await expect.poll(() => page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    const rows = await db.getAll('calendarDays');
    return { local: rows.filter((row) => row.label === 'إجازة Demo محلية').length,
      national: rows.filter((row) => row.label === 'إجازة اليوم الوطني').length };
  })).toEqual({ local: 0, national: 4 });
  expect(cloudRequests).toBe(0);
});
