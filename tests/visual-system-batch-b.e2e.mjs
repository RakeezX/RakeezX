import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(90_000);

const toolTitles = [
  'هدف وميثاق الصف',
  'الرصد السريع',
  'القرعة',
  'المجموعات',
  'لوحة التميز',
  'الحصص',
  'التقارير',
  'توزيع الدرجات',
];

const viewports = [
  { width: 320, height: 760 },
  { width: 390, height: 844 },
  { width: 412, height: 860 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
];

async function seedClassroom(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  return page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'بصري', color: '#18A878' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    for (let index = 1; index <= 8; index += 1) {
      await window.store.addStudent(section.id, `طالب بصري ${index}`, { rollNo: index });
    }
    return teaching.id;
  });
}

const noHorizontalOverflow = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
);

test('class hub keeps the ordered tools responsive, equal, and accessible in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const teachingId = await seedClassroom(page);
  const hubUrl = `/#/teaching/${encodeURIComponent(teachingId)}`;

  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(hubUrl);
      await page.evaluate((value) => window.store.patchDevice({ theme: value }), theme);
      await page.reload();

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.class-context-nav__item span')).toHaveText(['الفصل', 'الطلاب', 'الحضور', 'كشف الدرجات']);
      const cards = page.locator('.class-tool-card');
      await expect(cards).toHaveCount(8);
      await expect(cards.locator('.tile__title')).toHaveText(toolTitles);
      expect(await noHorizontalOverflow(page), `${theme}/${viewport.width}`).toBe(true);

      const metrics = await cards.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        const iconBox = node.querySelector('.tile__icon').getBoundingClientRect();
        return {
          top: Math.round(box.top),
          width: box.width,
          height: box.height,
          iconWidth: iconBox.width,
          iconCenterOffset: Math.abs((box.left + box.width / 2) - (iconBox.left + iconBox.width / 2)),
          columns: getComputedStyle(node).gridTemplateColumns,
          textAlign: getComputedStyle(node).textAlign,
        };
      }));
      expect(metrics.every(({ height, iconWidth, columns, textAlign }) =>
        height >= 104 && iconWidth >= 40 && columns.startsWith('42px ') && textAlign === 'center'
      ), JSON.stringify(metrics)).toBe(true);

      if (viewport.width >= 1200) {
        expect(new Set(metrics.map(({ top }) => top)).size, `${viewport.width}: tools must form two balanced rows`).toBe(2);
        const widths = metrics.map(({ width }) => width);
        expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
        expect(metrics.every(({ iconWidth }) => iconWidth >= 44)).toBe(true);
      } else if (viewport.width <= 412) {
        expect(new Set(metrics.map(({ top }) => top)).size).toBe(4);
      }

      if (viewport.width <= 768) {
        const targets = await page.locator('.class-context-nav__item, .class-tool-card').evaluateAll((nodes) =>
          nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))
        );
        expect(targets.every(({ width, height }) => width >= 44 && height >= 44), JSON.stringify(targets)).toBe(true);
      }
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(hubUrl);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'critical')).toEqual([]);
  expect(errors).toEqual([]);
});

test('classroom tool surfaces keep hierarchy, mobile targets, and clean runtime', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const teachingId = await seedClassroom(page);
  const base = `/#/teaching/${encodeURIComponent(teachingId)}`;
  const routes = [
    { path: 'class-rules', selector: '.class-rules-surface' },
    { path: 'quicklog', selector: '.quicklog-toolbar' },
    { path: 'picker', selector: '.picker__stage' },
    { path: 'groups', selector: '.groups-setup' },
    { path: 'board', selector: '.board-controls' },
    { path: 'sessions', selector: '.sessions-page' },
    { path: 'items', selector: '.grade-distribution-page, .empty' },
  ];

  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 412, 1440]) {
      await page.setViewportSize({ width, height: width >= 900 ? 900 : 844 });
      await page.goto(base);
      await page.evaluate((value) => window.store.patchDevice({ theme: value }), theme);
      for (const route of routes) {
        await page.goto(`${base}/${route.path}`);
        await expect(page.locator(route.selector).first()).toBeVisible();
        expect(await noHorizontalOverflow(page), `${theme}/${width}/${route.path}`).toBe(true);
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/quicklog`);
  const search = page.getByRole('searchbox', { name: 'بحث الطلاب' });
  await search.focus();
  await expect(search).toBeFocused();
  const quickTargets = await page.locator('.qlcard__hit, .qlcard__minus, .quicklog-search__clear').evaluateAll((nodes) =>
    nodes.filter((node) => node.getBoundingClientRect().width > 0).map((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }))
  );
  expect(quickTargets.every(({ width, height }) => width >= 44 && height >= 44), JSON.stringify(quickTargets)).toBe(true);

  await page.goto(`${base}/groups`);
  await page.getByRole('button', { name: 'قسّم المجموعات' }).click();
  const member = page.locator('.group__member').first();
  await member.focus();
  await expect(member).toBeFocused();
  await expect(member).toHaveAttribute('aria-pressed', 'false');
  expect(await member.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

  expect(errors).toEqual([]);
});
