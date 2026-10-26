import { test, expect } from '@playwright/test';

async function openNewClass(page) {
  await page.getByRole('button', { name: /فصل جديد|إضافة فصل|إنشاء أول فصل/, exact: true }).first().click();
  return page.getByRole('dialog');
}

test('new class uses a searchable built-in/custom subject picker and stable subject IDs', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);

  let dialog = await openNewClass(page);
  await expect(dialog.locator('[name="grade"]')).toBeVisible();
  await expect(dialog.locator('[name="label"]')).toBeVisible();
  await expect(dialog.locator('[data-subject-trigger]')).toBeVisible();
  await expect(dialog.getByText('إعداد الفصول', { exact: true })).toHaveCount(0);
  await dialog.locator('[data-subject-trigger]').click();
  const search = dialog.getByRole('combobox', { name: 'ابحث عن مادة' });
  await search.fill('لغتي');
  await expect(dialog.locator('[data-subject-token]')).toHaveCount(1);
  await dialog.getByRole('option', { name: 'اللغة العربية' }).click();
  await expect(dialog.locator('[data-subject-selected]')).toHaveText('اللغة العربية');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-card__sub').first()).toHaveText('العربية');

  const arabic = await page.evaluate(() => {
    const teaching = window.store.teachings()[0];
    const subject = window.store.getSubject(teaching.subjectId);
    return { teachingSubjectId: teaching.subjectId, subject };
  });
  expect(arabic.teachingSubjectId).toBe('sub:arabic');
  expect(arabic.subject.slug).toBe('arabic');

  dialog = await openNewClass(page);
  await dialog.locator('[name="label"]').fill('2');
  await dialog.locator('[data-subject-trigger]').click();
  await expect(dialog.getByText('موادك الأخرى', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('option', { name: 'اللغة العربية' }).first()).toBeVisible();
  await dialog.locator('[data-subject-custom]').click();
  await dialog.getByRole('textbox', { name: 'اسم المادة المخصصة' }).fill('  علم   الأرض  ');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-card__sub').filter({ hasText: 'علم الأرض' })).toHaveCount(1);

  dialog = await openNewClass(page);
  await dialog.locator('[name="label"]').fill('3');
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.locator('[data-subject-custom]').click();
  await dialog.getByRole('textbox', { name: 'اسم المادة المخصصة' }).fill('عِلْم الأرض');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.waitForFunction(() => {
    const subjects = window.store.subjects().filter((subject) => subject.name === 'علم الأرض');
    return subjects.length === 1
      && window.store.teachings().filter((teaching) => teaching.subjectId === subjects[0].id).length === 2;
  });
  const customState = await page.evaluate(() => {
    const subjects = window.store.subjects().filter((subject) => subject.name === 'علم الأرض');
    const teachings = window.store.teachings().filter((teaching) => teaching.subjectId === subjects[0]?.id);
    return { subjects: subjects.length, teachings: teachings.length };
  });
  expect(customState).toEqual({ subjects: 1, teachings: 2 });

  // The card reflects memory before the asynchronous local transaction completes.
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('teachings')).filter(row => !row.deleted).length)).toBe(3);
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.locator('.class-card__sub').filter({ hasText: 'علم الأرض' })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('subject picker remains usable on desktop and dark theme without exposing a permanent long list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(() => window.store.patchDevice({ theme: 'dark' }));
  const dialog = await openNewClass(page);
  const menu = dialog.locator('[data-subject-menu]');
  await expect(menu).toBeHidden();
  await dialog.locator('[data-subject-trigger]').click();
  await expect(menu).toBeVisible();
  expect(await dialog.locator('[data-subject-options] [role="option"]').count()).toBeGreaterThan(12);
  await dialog.getByRole('combobox', { name: 'ابحث عن مادة' }).fill('physical education');
  await expect(dialog.getByRole('option', { name: 'التربية البدنية والدفاع عن النفس' })).toBeVisible();
  const tapHeight = await dialog.locator('[data-subject-token]').first().evaluate((node) => node.getBoundingClientRect().height);
  expect(tapHeight).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
