import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function assertMobileSheetFits(page, dialog) {
  await dialog.evaluate(async (element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      inputs: [...element.querySelectorAll('input')].map((input) => {
        const box = input.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }) };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.width).toBeLessThanOrEqual(bounds.viewport + 1);
  for (const input of bounds.inputs) {
    expect(input.left).toBeGreaterThanOrEqual(-1);
    expect(input.right).toBeLessThanOrEqual(bounds.viewport + 1);
  }
}

async function enterDemo(page) {
  await page.route('https://*.supabase.co/**', (route) => route.abort());
  await page.goto('/');
  const action = page.getByRole('button', { name: 'جرّب ركيز', exact: true });
  if (!await action.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  }
  await action.click();
  await page.waitForFunction(() => window.store?.state?.ready &&
    window.store?.getActiveWorkspace()?.type === 'demo');
}

test('Attendance and score contexts retain real Demo actions and fit mobile widths', async ({ page }) => {
  await enterDemo(page);
  for (const width of [1440, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/teaching/demo:teaching:1/attendance?session=demo:session:1:1');
    await expect(page.locator('.attendance-01c__context')).toBeVisible();
    await expect(page.locator('.attendance-01c__roster')).toBeVisible();
    await expect(page.locator('.attendance-01c__progress')).toBeVisible();
    await expect(page.locator('.attendance-01c__status-options').first().getByRole('button', { name: /حاضر/ })).toBeVisible();
    const attendanceOverflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().left < -1 ||
        el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((el) => ({
        tag: el.tagName, className: typeof el.className === 'string' ? el.className : '',
        left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right,
      })) }));
    if (attendanceOverflow.width > width + 1) console.log('Attendance overflow', attendanceOverflow);
    expect(attendanceOverflow.width).toBeLessThanOrEqual(width + 1);
    await page.goto('/#/teaching/demo:teaching:1/grades');
    await expect(page.locator('.grades-01c__context')).toBeVisible();
    await expect(page.locator('.grades-01c__subscore-row').first()).toBeVisible();
    await expect(page.locator('.grades-01c__manual').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
});

test('Demo subitem score distinguishes blank, zero, and capped manual contribution without cloud calls', async ({ page }) => {
  let cloudCalls = 0;
  await page.route('https://*.supabase.co/**', (route) => { cloudCalls++; return route.abort(); });
  await enterDemo(page);
  await page.goto('/#/teaching/demo:teaching:1/grades');
  await expect(page.locator('.grades-01c__subscore-row').nth(2)).toContainText('تم الرصد');
  await expect(page.locator('.grades-01c__subscore-row').nth(2).locator('.grades-01c__manual')).toHaveValue('0');
  const row = page.locator('.grades-01c__subscore-row').nth(6);
  await expect(row).toContainText('غير مرصود');
  await expect(row.locator('.grades-01c__equation strong')).toContainText('— / 10');
  const manual = row.locator('.grades-01c__manual');
  await manual.fill('11');
  await manual.blur();
  await expect(page.locator('.grades-01c__subscore-row').nth(6).locator('.grades-01c__manual')).toHaveValue('10');
  await expect(page.locator('.grades-01c__subscore-row').nth(6)).toContainText('الحد المتبقي');
  await page.reload();
  await expect(page.locator('.grades-01c__subscore-row').nth(6).locator('.grades-01c__manual')).toHaveValue('10');
  expect(cloudCalls).toBe(0);
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);
});

test('Distribution copy selects a subset and leaves unselected eligible class untouched', async ({ page }) => {
  await enterDemo(page);
  await page.goto('/#/teaching/demo:teaching:1/items');
  await expect(page.locator('.distribution-panel')).toBeVisible();
  await page.getByRole('button', { name: /تطبيق التوزيع على كل فصول/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-copy-target]')).toHaveCount(2);
  await dialog.locator('[data-copy-target]').nth(1).uncheck();
  await dialog.getByRole('button', { name: 'مراجعة التطبيق' }).click();
  await expect(dialog).toContainText('مراجعة بنود الفصول المحددة');
  await dialog.getByRole('button', { name: 'تطبيق التوزيع' }).click();
  await expect(dialog).toHaveCount(0);
  const result = await page.evaluate(() => ({
    selected: window.store.state.items.filter((row) => row.teachingId === 'demo:teaching:2' && row.distributionOriginId),
    unselected: window.store.state.items.filter((row) => row.teachingId === 'demo:teaching:6' && row.distributionOriginId),
  }));
  expect(result.selected.length).toBeGreaterThan(0);
  expect(result.unselected).toHaveLength(0);
  expect(result.selected.every((row) => row.portabilityGroupId == null)).toBe(true);
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);
});

test('Demo editor supports automatic and manual subitem allocation with reviewed recalculation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  await page.goto('/#/teaching/demo:teaching:1/items');
  const row = page.locator('.distribution-item').filter({ hasText: 'واجب' });
  await row.getByRole('button', { name: 'تحرير العناصر' }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.locator('[data-subitem-row]')).toHaveCount(3);
  await editor.getByRole('button', { name: 'توزيع تلقائي' }).click();
  await expect(editor.locator('[data-subitem-value]').nth(2)).toHaveValue('3.34');
  await assertMobileSheetFits(page, editor);
  await page.screenshot({ path: testInfo.outputPath('auto-editor-390.png'), fullPage: true });
  await editor.getByRole('button', { name: 'توزيع يدوي' }).click();
  await editor.locator('[data-subitem-value]').nth(0).fill('4');
  await editor.locator('[data-subitem-value]').nth(1).fill('3');
  await editor.locator('[data-subitem-value]').nth(2).fill('3');
  await expect(editor.locator('[data-subitem-total]')).toHaveText('10.00 / 10');
  await page.screenshot({ path: testInfo.outputPath('manual-editor-390.png'), fullPage: true });
  await editor.getByRole('button', { name: 'حفظ العناصر' }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toContainText('مراجعة تغيير توزيع الدرجات');
  await confirmation.getByRole('button', { name: 'تأكيد التغيير' }).click();
  await expect(confirmation).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.state.items
    .find((entry) => entry.id === 'demo:item:1:1')?.distributionMode)).toBe('manual');
  const updated = await page.evaluate(() => ({
    item: window.store.state.items.find((entry) => entry.id === 'demo:item:1:1'),
    values: window.store.scoreSubitemsOf('demo:item:1:1').map((entry) => entry.value),
  }));
  expect(updated.item.distributionMode).toBe('manual');
  expect(updated.values).toEqual([4, 3, 3]);
  await page.reload();
  await expect(page.locator('.distribution-panel')).toBeVisible();
  expect(await page.evaluate(() => window.store.scoreSubitemsOf('demo:item:1:1').map((entry) => entry.value))).toEqual([4, 3, 3]);
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);
});

test('copy conflict review offers retain or independent addition and zero selection disables action', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  await page.goto('/#/teaching/demo:teaching:1/items');
  await page.getByRole('button', { name: /تطبيق التوزيع على كل فصول/ }).click();
  const targets = page.getByRole('dialog');
  await assertMobileSheetFits(page, targets);
  await page.screenshot({ path: testInfo.outputPath('copy-targets-390.png'), fullPage: true });
  await targets.locator('[data-copy-target]').first().uncheck();
  await targets.locator('[data-copy-target]').last().uncheck();
  await expect(targets.getByRole('button', { name: 'مراجعة التطبيق' })).toBeDisabled();
  await targets.locator('[data-copy-target]').first().check();
  await targets.getByRole('button', { name: 'مراجعة التطبيق' }).click();
  const review = page.getByRole('dialog');
  await assertMobileSheetFits(page, review);
  await page.screenshot({ path: testInfo.outputPath('copy-review-390.png'), fullPage: true });
  await expect(review.locator('.review-status--conflict')).not.toHaveCount(0);
  await expect(review.getByText('الاحتفاظ بالبند الحالي').first()).toBeVisible();
  await expect(review.getByText('إضافة البند الجديد بشكل مستقل').first()).toBeVisible();
  await review.getByRole('button', { name: 'تطبيق التوزيع' }).click();
  await expect(review).toHaveCount(0);
});

test('01C visuals are responsive, themed, keyboard usable, and accessible in Demo', async ({ page }, testInfo) => {
  await enterDemo(page);
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/settings');
    await page.locator(`[data-act="theme"][data-theme="${theme}"]`).click();
    for (const width of [1440, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, route, selector] of [
        ['attendance', '/#/teaching/demo:teaching:1/attendance?session=demo:session:1:1', '.attendance-01c'],
        ['scores', '/#/teaching/demo:teaching:1/grades', '.grades-01c'],
        ['distribution', '/#/teaching/demo:teaching:1/items', '.distribution-01c'],
      ]) {
        await page.goto(route);
        await expect(page.locator(selector)).toBeVisible();
        const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth,
          offenders: [...document.querySelectorAll('body *')].filter((el) =>
            el.getBoundingClientRect().left < -1 || el.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 12).map((el) => ({ className: typeof el.className === 'string' ? el.className : el.tagName,
              left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })) }));
        if (overflow.width > width + 1) console.log(`${name} ${theme} ${width} overflow`, overflow);
        expect(overflow.width, `${name} ${theme} ${width}`).toBeLessThanOrEqual(width + 1);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${theme}-${width}.png`), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, selector] of [
    ['/#/teaching/demo:teaching:1/attendance?session=demo:session:1:1', '.attendance-01c'],
    ['/#/teaching/demo:teaching:1/grades', '.grades-01c'],
    ['/#/teaching/demo:teaching:1/items', '.distribution-01c'],
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).include(selector).analyze();
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact)),
      `${route}: ${JSON.stringify(results.violations.map((violation) => violation.id))}`).toEqual([]);
  }
  await page.getByRole('button', { name: /تطبيق التوزيع على كل فصول/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /تطبيق التوزيع على كل فصول/ })).toBeFocused();
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator('.distribution-item').filter({ hasText: 'واجب' })
    .getByRole('button', { name: 'تحرير العناصر' }).click();
  await assertMobileSheetFits(page, page.getByRole('dialog'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /تطبيق التوزيع على كل فصول/ }).click();
  await assertMobileSheetFits(page, page.getByRole('dialog'));
});
