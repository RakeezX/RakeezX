import { test, expect } from '@playwright/test';

const primaryLabels = ['الرئيسية', 'الفصول', 'الجدول', 'التقارير'];

async function seedTeaching(page, label = '١') {
  return page.evaluate(async (sectionLabel) => {
    const section = await window.store.createSection({ grade: 5, label: sectionLabel, name: `الخامس / ${sectionLabel}` });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    await window.store.addStudent(section.id, 'طالب اختبار التنقل');
    return { sectionId: section.id, teachingId: teaching.id };
  }, label);
}

async function expectStablePrimaryNav(page, active) {
  const primary = page.locator('[data-nav-scope="primary"]');
  await expect(primary).toBeVisible();
  await expect(primary.locator('a')).toHaveText(primaryLabels);
  await expect(primary.locator('a[aria-current="page"]')).toHaveText(active);
}

test('mobile Reports → class report retains app nav and exposes class context in-page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await seedTeaching(page);

  await page.getByRole('link', { name: 'التقارير' }).click();

  await expectStablePrimaryNav(page, 'التقارير');
  await page.locator(`a[href="#/teaching/${fixture.teachingId}/reports"]`).click();
  await expect(page).toHaveURL(new RegExp(`#/teaching/${fixture.teachingId}/reports$`));
  await expectStablePrimaryNav(page, 'التقارير');
  const context = page.locator('[data-nav-scope="context"]');
  await expect(context).toBeVisible();
  await expect(context.getByRole('link', { name: 'الفصل' })).toBeVisible();
  await expect(context.getByRole('link', { name: 'الحضور' })).toBeVisible();
  await expect(context.getByRole('link', { name: 'الحصص' })).toBeVisible();
  await expect(context.getByRole('link', { name: 'كشف الدرجات' })).toBeVisible();
  await expect(context.getByRole('link', { name: 'الطلاب' })).toBeVisible();
  await expect(context.getByRole('link', { name: 'التقارير' })).toHaveCount(0);

  await page.getByRole('link', { name: 'الجدول' }).click();
  await expect(page).toHaveURL(/#\/schedule$/);
  await expectStablePrimaryNav(page, 'الجدول');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('mobile Classes context tabs preserve primary parent through students, attendance, grades, and reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await seedTeaching(page, '٢');

  await page.locator(`a[href="#/teaching/${fixture.teachingId}"]`).click();
  await expectStablePrimaryNav(page, 'الفصول');
  const context = page.locator('[data-nav-scope="context"]');
  await context.getByRole('link', { name: 'الطلاب' }).click();
  await expectStablePrimaryNav(page, 'الفصول');
  await expect(context.getByRole('link', { name: 'الطلاب' })).toHaveAttribute('aria-current', 'page');
  await context.getByRole('link', { name: 'الحضور' }).click();
  await expectStablePrimaryNav(page, 'الفصول');
  await expect(context.getByRole('link', { name: 'الحضور' })).toHaveAttribute('aria-current', 'page');
  await context.getByRole('link', { name: 'كشف الدرجات' }).click();
  await expectStablePrimaryNav(page, 'الفصول');
  await expect(context.getByRole('link', { name: 'كشف الدرجات' })).toHaveAttribute('aria-current', 'page');

  await page.reload();
  await expectStablePrimaryNav(page, 'الفصول');
  await expect(page.locator('[data-nav-scope="context"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Quick Start, Archive parent navigation, and desktop context bar remain intact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
  await expectStablePrimaryNav(page, 'الفصول');

  await page.goto('/#/archive');
  await expect(page.getByRole('link', { name: 'العودة إلى الإعدادات' })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  const fixture = await seedTeaching(page, '٣');
  await page.goto(`/#/teaching/${fixture.teachingId}/students`);
  await expect(page.locator('[data-nav-scope="context"]')).toBeVisible();
  await expect(page.locator('[data-nav-scope="primary"]')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
