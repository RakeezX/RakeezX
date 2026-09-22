import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test.setTimeout(120_000);

const output = 'test-results/0282-system-wide-visual-01b';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function expectNoOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function enterDemo(page) {
  await page.goto('/');
  const action = page.getByRole('button', { name: 'جرّب ركيز', exact: true });
  if (!await action.isVisible().catch(() => false)) {
    await page.locator('.topbar__teacher-btn--home-account:visible').click();
  }
  await action.click();
  await expect(page.locator('[data-demo-indicator]:visible')).toHaveCount(1);
  await expect(page.locator('.home-dashboard')).toBeVisible();
}

test.beforeEach(async () => mkdir(output, { recursive: true }));

test('Classes and Class Hub match the approved Work hierarchy with Production routes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await enterDemo(page);
  await page.goto('/#/classes');

  await expect(page.locator('.class-card')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'إضافة فصل', exact: true })).toHaveCount(1);
  await expect(page.locator('.classes-actions').getByRole('button', { name: 'إضافة فصل', exact: true })).toBeVisible();
  const cardHeights = await page.locator('.class-card').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(cardHeights.every((height) => height >= 110 && height <= 130)).toBe(true);
  const classType = await page.locator('.class-card').first().evaluate((node) => {
    const title = getComputedStyle(node.querySelector('.class-card__title'));
    const subject = getComputedStyle(node.querySelector('.class-card__sub'));
    return {
      titleSize: parseFloat(title.fontSize), titleWeight: parseFloat(title.fontWeight), titleLine: parseFloat(title.lineHeight),
      subjectSize: parseFloat(subject.fontSize), subjectWeight: parseFloat(subject.fontWeight), subjectLine: parseFloat(subject.lineHeight),
    };
  });
  expect(classType.titleSize).toBe(17);
  expect(classType.titleWeight).toBe(800);
  expect(classType.titleLine).toBeCloseTo(24.14, 1);
  expect(classType.subjectSize).toBe(12);
  expect(classType.subjectWeight).toBe(650);
  expect(classType.subjectLine).toBeCloseTo(16.8, 1);
  await expectNoOverflow(page);
  await page.screenshot({ path: `${output}/desktop-classes-light.png`, fullPage: true, animations: 'disabled' });

  await page.locator('.class-card__main').first().click();
  await expect(page.locator('.class-hub')).toBeVisible();
  await expect(page.locator('.class-context-nav__item')).toHaveCount(4);
  await expect(page.locator('.class-tool-card')).toHaveCount(8);
  await expect(page.getByText('بانتظار الرصد', { exact: true })).toHaveCount(1);
  const placement = await page.evaluate(() => {
    const tools = document.querySelector('.quick-tools-grid').getBoundingClientRect();
    const stats = document.querySelector('.class-hub-stats').getBoundingClientRect();
    return {
      after: stats.top > tools.bottom,
      aligned: Math.abs(stats.left - tools.left) <= 2 && Math.abs(stats.right - tools.right) <= 2,
    };
  });
  expect(placement).toEqual({ after: true, aligned: true });
  const statsAlignment = await page.locator('.class-hub-stats .stat').evaluateAll((nodes) => nodes.map((node) => {
    const value = node.querySelector('.stat__val');
    const label = node.querySelector('.stat__label');
    const style = getComputedStyle(node);
    return {
      placeItems: style.placeItems,
      alignContent: style.alignContent,
      textAlign: style.textAlign,
      valueAlign: getComputedStyle(value).textAlign,
      labelAlign: getComputedStyle(label).textAlign,
    };
  }));
  expect(statsAlignment.every((item) => item.placeItems === 'center' && item.alignContent === 'center' && item.textAlign === 'center' && item.valueAlign === 'center' && item.labelAlign === 'center')).toBe(true);
  const toolSizes = await page.locator('.class-tool-card').evaluateAll((nodes) => nodes.map((node) => ({
    height: node.getBoundingClientRect().height,
    title: parseFloat(getComputedStyle(node.querySelector('.tile__title')).fontSize),
    support: parseFloat(getComputedStyle(node.querySelector('.tile__sub')).fontSize),
  })));
  expect(toolSizes.every(({ height, title, support }) => height >= 76 && title >= 12 && support >= 10)).toBe(true);
  await expectNoOverflow(page);
  await page.screenshot({ path: `${output}/desktop-class-hub-light.png`, fullPage: true, animations: 'disabled' });
  await page.locator('.class-hub-stats').screenshot({ path: `${output}/desktop-class-hub-statistics-light.png`, animations: 'disabled' });

  const axe = await new AxeBuilder({ page }).include('.main').analyze();
  expect(axe.violations).toEqual([]);

  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'داكن', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/#/classes');
  await page.locator('.class-card__main').first().click();
  await expect(page.locator('.class-hub')).toBeVisible();
  await page.screenshot({ path: `${output}/desktop-class-hub-dark.png`, fullPage: true, animations: 'disabled' });
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('student roster, search and Demo-safe management preserve real behavior', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await enterDemo(page);
  await page.goto('/#/classes');
  await page.locator('.class-card__main').first().click();
  await page.getByRole('link', { name: 'الطلاب', exact: true }).click();

  const rows = page.locator('.roster-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(page.locator('.roster-search')).toBeVisible();
  const firstName = await rows.first().locator('.row__title').textContent();
  await page.locator('[data-input="search"]').fill(firstName.trim());
  await expect(page.locator('.roster-row')).toHaveCount(1);
  await page.locator('[data-input="search"]').fill('اسم غير موجود إطلاقًا');
  await expect(page.getByText('لا نتيجة لبحثك.', { exact: true })).toBeVisible();
  await page.locator('[data-act="clear-search"]').click();
  await page.screenshot({ path: `${output}/desktop-students-light.png`, fullPage: true, animations: 'disabled' });

  await rows.first().locator('.row__main').click();
  await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
  await expect(page.getByRole('button', { name: /نقل الطالب إلى فصل آخر/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /إزالة الطالب من الفصل/ })).toBeVisible();
  await page.getByRole('button', { name: /إزالة الطالب من الفصل/ }).click();
  await expect(page.getByText('هذا طالب في فصل تجريبي محلي. يمكن حذف الفصل التجريبي من إدارة الفصول.', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/desktop-student-management-demo-safe.png`, fullPage: true, animations: 'disabled' });
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('mobile 390, 360 and 320 preserve hierarchy, touch targets and overflow safety', async ({ page }) => {
  const errors = watchErrors(page);
  await enterDemo(page);
  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#/classes');
    await expect(page.locator('.class-card')).toHaveCount(8);
    const expectedTitleSize = width <= 360 ? 14 : 15;
    expect(await page.locator('.class-card__title').first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(expectedTitleSize);
    await expectNoOverflow(page);
    if (width === 390) await page.screenshot({ path: `${output}/mobile-390-classes-light.png`, fullPage: true, animations: 'disabled' });
    await page.locator('.class-card__main').first().click();
    await expect(page.locator('.topbar--class-hub .topbar__title')).toBeHidden();
    await expect(page.locator('.class-tool-card')).toHaveCount(8);
    await expectNoOverflow(page);
    const targets = await page.locator('.class-context-nav__item, .class-tool-card, .class-hub .iconbtn').evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return Math.min(rect.width, rect.height);
    }));
    expect(targets.every((size) => size >= 40)).toBe(true);
    if (width === 390 || width === 320) {
      await page.screenshot({ path: `${output}/mobile-${width}-class-hub-light.png`, fullPage: true, animations: 'disabled' });
    }
    if (width === 390) await page.locator('.class-hub-stats').screenshot({ path: `${output}/mobile-390-class-hub-statistics-light.png`, animations: 'disabled' });
  }
  expect(errors).toEqual([]);
});
