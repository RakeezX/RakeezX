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
          identity: {
            badge: document.querySelector('.calendar-identity__meta .calendar-eyebrow').getBoundingClientRect().toJSON(),
            year: document.querySelector('.calendar-identity__meta .calendar-year').getBoundingClientRect().toJSON(),
            title: document.querySelector('.calendar-identity h1').getBoundingClientRect().toJSON(),
          },
          undersized: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
            .map(el => el.textContent.trim()),
        };
      });
      expect(geometry.overflow, `${width} ${theme} horizontal overflow`).toBe(false);
      expect(geometry.direction).toBe('rtl');
      expect(geometry.undersized, `${width} ${theme} actionable controls`).toEqual([]);
      expect(geometry.identity.title.top, `${width} ${theme} region title below metadata`).toBeGreaterThanOrEqual(geometry.identity.badge.bottom);
      expect(geometry.identity.title.top, `${width} ${theme} region title below dates`).toBeGreaterThanOrEqual(geometry.identity.year.bottom);
      if (width >= 390) expect(Math.abs(geometry.identity.badge.top - geometry.identity.year.top), `${width} ${theme} identity metadata row`).toBeLessThanOrEqual(3);
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

test('Demo Calendar keeps official reference, local identities and history through a switch roundtrip', async ({ page }) => {
  const productRequests = [];
  const errors = [];
  page.on('request', request => {
    if (/supabase\.co|\/rest\/v1\/|\/auth\/v1\//i.test(request.url())) productRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  const firstRunDemo = page.getByRole('button', { name: 'جرّب ركيز المعلم' });
  if (await firstRunDemo.isVisible()) await firstRunDemo.click();
  else {
    await page.getByRole('button', { name: /مركز المعلم/ }).click();
    await page.getByRole('button', { name: 'جرّب ركيز', exact: true }).click();
  }
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.getByRole('link', { name: 'التقويم', exact: true }).click();
  await expect(page).toHaveURL(/#\/calendar$/);
  await expect(page.locator('.calendar-work-0417')).toBeVisible();
  await expect(page.locator('.calendar-identity h1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'أين نحن الآن؟' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الإجازات والفترات الدراسية' })).toBeVisible();
  await expect(page.getByText('إجازة الخريف').first()).toBeVisible();
  const readDemo = () => page.evaluate(async () => {
    const store = await import('/src/store.js');
    const db = await import('/src/lib/db.js');
    return {
      workspace: store.getActiveWorkspace()?.type,
      years: store.years().map(({ id }) => id),
      terms: store.termsOf('demo:year:1448').map(({ id, startDate, endDate }) => [id, startDate, endDate]),
      calendars: store.state.calendars.filter(({ yearId, deleted }) => yearId === 'demo:year:1448' && !deleted).map(({ id }) => id),
      projectedOfficial: store.calendarsOf('demo:year:1448').filter(({ projected }) => projected).map(({ presetId }) => presetId),
      officialDays: store.calendarsOf('demo:year:1448').filter(({ projected }) => projected)
        .flatMap(({ id }) => store.calendarDaysOf(id)).filter((day) => day.presetId).length,
      selected: store.getYear('demo:year:1448')?.calendarPresetId,
      history: Object.fromEntries(['students', 'teachings', 'sections', 'scores', 'sessions', 'attendance']
        .map((name) => [name, store.state[name].map(({ id, updatedAt }) => [id, updatedAt])])),
      outbox: (await db.getAll('outbox')).length,
    };
  });
  const original = await readDemo();
  expect(original.workspace).toBe('demo');
  expect(original.years).toEqual(['demo:year:1448']);
  expect(original.terms.map(([id]) => id)).toEqual(['demo:term:1', 'demo:term:2']);
  expect(original.calendars).toEqual(['demo:calendar']);
  expect(original.selected).toBe('sa-western-1448-1449');
  expect(original.officialDays).toBeGreaterThan(0);
  for (const [region, expected] of [
    ['sa-general-1448-1449', 'جميع مناطق المملكة'],
    ['sa-western-1448-1449', 'مكة المكرمة'],
  ]) {
    await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
    await page.locator(`[data-act="set-region"][data-id="${region}"]`).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.calendar-identity h1')).toContainText(expected);
    await page.reload();
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await expect(page.locator('.calendar-identity h1')).toContainText(expected);
    const current = await readDemo();
    expect(current.years).toEqual(original.years);
    expect(current.terms.map(([id]) => id)).toEqual(original.terms.map(([id]) => id));
    expect(current.calendars).toEqual(original.calendars);
    expect(current.projectedOfficial).toEqual([region]);
    expect(current.selected).toBe(region);
    expect(current.officialDays).toBeGreaterThan(0);
    expect(current.history).toEqual(original.history);
    expect(current.outbox).toBe(0);
  }
  expect(productRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('Product Calendar selection closes settings only after success', async ({ page }) => {
  await page.goto('/#/calendar');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
  await page.locator('[data-act="set-region"][data-id="sa-general-1448-1449"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.calendar-identity h1')).toContainText('جميع مناطق المملكة');

  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
  await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const year = store.state.years.find((item) => item.id === store.activeYear()?.id);
    year.deleted = true; // Synthetic in-memory failure fixture; no persisted Product row changes.
  });
  await page.locator('[data-act="set-region"][data-id="sa-western-1448-1449"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('لا يمكن تطبيق التقويم على سنة أو فصل محذوف.')).toBeVisible();
  await expect(page.locator('.calendar-identity h1')).toContainText('جميع مناطق المملكة');
});
