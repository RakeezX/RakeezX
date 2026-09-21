import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

const noHorizontalOverflow = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
);

async function seedCoreDaily(page) {
  await page.evaluate(async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const weekday = new Date().getDay();
    const safeWeekday = [0, 1, 2, 3, 4].includes(weekday) ? weekday : 0;
    await window.store.save({
      years: [{ id: 'y:visual-a', label: 'سنة الاختبار' }],
      terms: [{ id: 'tm:visual-a', yearId: 'y:visual-a', index: 1, startDate: today, endDate: today, status: 'active' }],
      subjects: [{ id: 'sub:visual-a', name: 'المهارات الرقمية' }],
      sections: [{ id: 'sec:visual-a', yearId: 'y:visual-a', grade: 5, label: 'أ' }],
      teachings: [{ id: 'tch:visual-a', sectionId: 'sec:visual-a', subjectId: 'sub:visual-a', termId: 'tm:visual-a' }],
      students: [
        { id: 'std:visual-a-1', name: 'طالب اختبار أول', rollNo: 1 },
        { id: 'std:visual-a-2', name: 'طالب اختبار ثانٍ', rollNo: 2 },
      ],
      enrollments: [
        { id: 'en:visual-a-1', studentId: 'std:visual-a-1', sectionId: 'sec:visual-a', status: 'active' },
        { id: 'en:visual-a-2', studentId: 'std:visual-a-2', sectionId: 'sec:visual-a', status: 'active' },
      ],
      slots: [
        { id: 'sl:visual-a-1', teachingId: 'tch:visual-a', weekday: safeWeekday, period: 1 },
        { id: 'sl:visual-a-2', teachingId: 'tch:visual-a', weekday: safeWeekday, period: 2 },
      ],
      sessions: [
        { id: 'ses:visual-a-1', teachingId: 'tch:visual-a', slotId: 'sl:visual-a-1', date: today, period: 1, startTime: '07:00', endTime: '07:45', status: 'scheduled' },
        { id: 'ses:visual-a-2', teachingId: 'tch:visual-a', slotId: 'sl:visual-a-2', date: today, period: 2, startTime: '08:00', endTime: '08:45', status: 'scheduled' },
      ],
    });
    await window.store.patchDevice({ activeYearId: 'y:visual-a', activeTermId: 'tm:visual-a' });
  });
}

test('AppShell, Home, and Teacher Center share accessible daily primitives', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 412, 1280]) {
      await page.setViewportSize({ width, height: width >= 900 ? 900 : 844 });
      await page.goto('/#/');
      await page.waitForFunction(() => window.store?.state?.ready === true);
      await page.evaluate((value) => window.store.patchDevice({ theme: value }), theme);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.home-shortcuts__grid')).toBeVisible();
      await expect(page.locator('.tabbar')).toHaveAttribute('aria-label', 'التنقل الرئيسي');
      const shortcutAlignment = await page.locator('.home-shortcuts .tile').evaluateAll((tiles) => tiles.map((tile) => {
        const icon = tile.querySelector('.tile__icon');
        const tileBox = tile.getBoundingClientRect();
        const iconBox = icon.getBoundingClientRect();
        return {
          centerOffset: Math.abs((tileBox.left + tileBox.width / 2) - (iconBox.left + iconBox.width / 2)),
          textAlign: getComputedStyle(tile).textAlign,
          height: tileBox.height,
        };
      }));
      expect(shortcutAlignment.every(({ centerOffset, textAlign, height }) =>
        centerOffset <= 1 && textAlign === 'center' && height >= 44 && height <= 112
      ), `${theme}/${width}: ${JSON.stringify(shortcutAlignment)}`).toBe(true);
      const primaryContrast = await page.locator('.btn--primary').first().evaluate((node) => {
        const parse = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = (rgb) => rgb
          .map((channel) => channel / 255)
          .map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
          .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
        const style = getComputedStyle(node);
        const [light, dark] = [luminance(parse(style.color)), luminance(parse(style.backgroundColor))].sort((a, b) => b - a);
        return (light + .05) / (dark + .05);
      });
      expect(primaryContrast).toBeGreaterThanOrEqual(4.5);
      expect(await noHorizontalOverflow(page), `${theme}/${width}`).toBe(true);

      const trigger = page.locator('[data-act="open-teacher-mini-hub"]:visible');
      await trigger.focus();
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'مركز المعلم' });
      await expect(dialog).toBeVisible();
      const hubSectionBackgrounds = await dialog.locator(
        '.mini-hub-identity, .mini-hub-account, .mini-hub-sync, .mini-hub-pwa, .mini-hub-settings-link'
      ).evaluateAll((sections) => sections.map((section) => getComputedStyle(section).backgroundColor));
      expect(new Set(hubSectionBackgrounds).size, `${theme}/${width}: ${JSON.stringify(hubSectionBackgrounds)}`).toBe(1);
      await expect(page.locator('#app')).toHaveAttribute('aria-hidden', 'true');
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  }
  expect(errors).toEqual([]);
});

test('Schedule day tabs support RTL keyboard navigation and mobile targets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await seedCoreDaily(page);
  await page.reload();

  const selected = page.locator('.schedule-day-tab[aria-selected="true"]');
  await expect(selected).toHaveCount(1);
  await selected.focus();
  const before = await selected.getAttribute('data-day');
  await page.keyboard.press('ArrowLeft');
  const after = await page.locator('.schedule-day-tab[aria-selected="true"]').getAttribute('data-day');
  expect(after).not.toBe(before);
  await expect(page.locator('.schedule-day-tab[aria-selected="true"]')).toBeFocused();

  const targets = await page.locator('.schedule-day-tab, .slot__actions .iconbtn').evaluateAll((nodes) =>
    nodes
      .map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))
      .filter(({ width, height }) => width > 0 && height > 0)
  );
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every(({ width, height }) => width >= 44 && height >= 44), JSON.stringify(targets)).toBe(true);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('Attendance keeps 44px status actions without overflow at approved mobile widths', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await seedCoreDaily(page);
  await page.goto('/#/teaching/tch:visual-a/attendance?session=ses:visual-a-1');
  await expect(page.locator('.att-row')).toHaveCount(2);
  await expect(page.locator('.segbtns').first()).toHaveAttribute('role', 'group');

  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 412, 1280]) {
      await page.setViewportSize({ width, height: width >= 900 ? 900 : 844 });
      await page.evaluate((value) => window.store.patchDevice({ theme: value }), theme);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.att-row')).toHaveCount(2);

      const search = page.locator('.attendance-search');
      await expect(search).toBeVisible();
      const searchFrames = await search.evaluate((node) => {
        const input = node.querySelector('.searchbar__input');
        const icon = node.querySelector('.searchbar__icon');
        const inputStyle = getComputedStyle(input);
        const iconStyle = getComputedStyle(icon);
        return {
          inputBorders: [inputStyle.borderTopWidth, inputStyle.borderRightWidth, inputStyle.borderBottomWidth, inputStyle.borderLeftWidth],
          inputShadow: inputStyle.boxShadow,
          iconBorders: [iconStyle.borderTopWidth, iconStyle.borderRightWidth, iconStyle.borderBottomWidth, iconStyle.borderLeftWidth],
          iconBackground: iconStyle.backgroundColor,
          iconShadow: iconStyle.boxShadow,
        };
      });
      expect(searchFrames.inputBorders).toEqual(['0px', '0px', '0px', '0px']);
      expect(searchFrames.inputShadow).toBe('none');
      expect(searchFrames.iconBorders).toEqual(['0px', '0px', '0px', '0px']);
      expect(searchFrames.iconBackground).toBe('rgba(0, 0, 0, 0)');
      expect(searchFrames.iconShadow).toBe('none');
      await page.locator('.searchbar__input').focus();
      expect(await search.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');

      if (width < 900) {
        const sizes = await page.locator('.att-row .segbtn, .att-row__note').evaluateAll((nodes) =>
          nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))
        );
        expect(sizes.every(({ width: targetWidth, height }) => targetWidth >= 44 && height >= 44)).toBe(true);
      }
      expect(await noHorizontalOverflow(page), `${theme}/${width}`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
