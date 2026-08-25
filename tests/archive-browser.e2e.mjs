import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/#/archive'); await page.waitForFunction(() => window.store);
  await page.evaluate(async () => { await window.store.save({ years: [{ id: 'cur', label: 'الحالية' }, { id: 'old', label: 'القديمة', status: 'archived' }], terms: [{ id: 'tc', yearId: 'cur', name: 'الحالي' }, { id: 'to', yearId: 'old', name: 'الأول', status: 'closed' }] }); await window.store.patchDevice({ activeYearId: 'cur', activeTermId: 'tc' }); window.store.repaint(); });
}

test('archive routes stay route-scoped and validate safely', async ({ page }) => {
  await seed(page); await page.getByText('القديمة').click(); await expect(page.getByRole('heading', { name: 'بيانات مؤرشفة' })).toBeVisible();
  expect(await page.evaluate(() => ({ y: window.store.state.device.activeYearId, t: window.store.state.device.activeTermId }))).toEqual({ y: 'cur', t: 'tc' });
  await page.goto('/#/archive/year/cur/term/to'); await expect(page.getByText('سياق الأرشيف غير متاح')).toBeVisible();
  await page.goto('/#/'); expect(await page.evaluate(() => window.store.state.device.activeTermId)).toBe('tc');
});

test('archive route does not alter another tab or mobile layout', async ({ context, page }) => {
  await seed(page); const tabB = await context.newPage(); await tabB.goto('/#/archive/year/old/term/to'); await expect(tabB.getByRole('heading', { name: 'بيانات مؤرشفة' })).toBeVisible();
  expect(await page.evaluate(() => ({ y: window.store.state.device.activeYearId, t: window.store.state.device.activeTermId }))).toEqual({ y: 'cur', t: 'tc' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/#/archive'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.getByText('القديمة').click(); await expect(page.getByText('العودة للأرشيف')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl'); await tabB.close();
});