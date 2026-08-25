import { test, expect } from '@playwright/test';

test('one-click local demo classes stay isolated, persistent, and deletable', async ({ page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  await expect(page.getByRole('button', { name: 'إضافة فصل تجريبي' })).toBeVisible();
  await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
  await expect(page.getByRole('link', { name: /تجريبي 1/ })).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'تجريبي' })).toBeVisible();
  const first = await page.evaluate(async () => ({
    sections: window.store.state.sections.filter((r) => r.id.startsWith('demo:') && !r.deleted).length,
    students: window.store.state.students.filter((r) => r.id.startsWith('demo:') && !r.deleted).length,
    outbox: (await (await import('/src/lib/db.js')).getAll('outbox')).filter((r) => r.recordId?.startsWith('demo:')).length,
  }));
  expect(first).toEqual({ sections: 1, students: 24, outbox: 0 });
  await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
  await expect(page.getByRole('link', { name: /تجريبي 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'حذف الفصل التجريبي' }).first().click();
  await page.getByRole('button', { name: 'حذف الفصل التجريبي' }).last().click();
  await expect(page.getByRole('link', { name: /تجريبي 1/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /تجريبي 2/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /تجريبي 2/ })).toBeVisible();
});