import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('local file preview, cancellation, confirmation, duplicate no-op, XLSX and paste in isolated Demo', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
  await page.reload();
  await expect(page.locator('.boot')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await import('/src/store.js')).teachings().length)).toBeGreaterThan(0);
  const context = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const teaching = store.teachings()[0];
    return { id: teaching.id, before: store.sectionRoster(teaching.sectionId).length };
  });
  await page.evaluate(async () => {
    const store = await import('/src/store.js');
    window.n12GradesBefore = JSON.stringify({ scores: store.state.scores, items: store.state.items, attendance: store.state.attendance });
    await navigator.serviceWorker.ready;
  });
  await page.goto(`/#/teaching/${context.id}/students`);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'استيراد ملف الأسماء', exact: true }).click();
  const csv = { name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFاسم الطالب,درجة\nطالب ملف اصطناعي,10\nطالب مكرر اصطناعي,9\nطالب مكرر اصطناعي,8\n123,7') };
  await page.locator('#student-file').setInputFiles(csv);
  await expect(page.locator('#file-count')).toHaveText('جديد: 1 · موجود: 0 · غير صالح: 1 · يحتاج مراجعة: 2');
  await expect(page.locator('#file-preview')).toContainText('طالب ملف اصطناعي');
  await page.screenshot({ path: 'test-results/n12-preview.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/n12-preview-mobile.png', animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  const count = () => page.evaluate(async (id) => {
    const store = await import('/src/store.js');
    return store.sectionRoster(store.getTeaching(id).sectionId).length;
  }, context.id);
  expect(await count()).toBe(context.before);
  await page.getByRole('button', { name: 'استيراد ملف الأسماء', exact: true }).click();
  await page.locator('#student-file').setInputFiles(csv);
  await page.getByRole('button', { name: 'تأكيد إضافة 1 طالبًا جديدًا' }).click();
  await expect.poll(count).toBe(context.before + 1);
  await page.getByRole('button', { name: 'استيراد ملف الأسماء', exact: true }).click();
  await page.locator('#student-file').setInputFiles(csv);
  await expect(page.locator('#file-count')).toHaveText('جديد: 0 · موجود: 1 · غير صالح: 1 · يحتاج مراجعة: 2');
  await expect(page.locator('#file-confirm')).toBeDisabled();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await page.getByRole('button', { name: 'استيراد ملف الأسماء', exact: true }).click();
  await page.locator('#student-file').setInputFiles({ name: 'synthetic.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await readFile(new URL('./n12-students.xlsx', import.meta.url)) });
  await expect(page.locator('#file-count')).toHaveText('جديد: 1 · موجود: 0 · غير صالح: 0 · يحتاج مراجعة: 0');
  await page.getByRole('button', { name: 'تأكيد إضافة 1 طالبًا جديدًا' }).click();
  await expect.poll(count).toBe(context.before + 2);
  await page.getByRole('button', { name: 'لصق كشف', exact: true }).first().click();
  await page.locator('#names-box').fill('طالب لصق اصطناعي');
  await page.locator('#names-go').click();
  await expect.poll(count).toBe(context.before + 3);
  const state = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const db = await import('/src/lib/db.js');
    return { type: store.getActiveWorkspace().type, outbox: (await db.getAll('outbox')).length };
  });
  expect(state).toEqual({ type: 'demo', outbox: 0 });
  expect(await page.evaluate(async () => {
    const store = await import('/src/store.js');
    return window.n12GradesBefore === JSON.stringify({ scores: store.state.scores, items: store.state.items, attendance: store.state.attendance });
  })).toBe(true);
  await page.context().setOffline(false);
});
