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
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/#/archive'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.getByText('القديمة').click(); await expect(page.getByRole('link', { name: 'العودة إلى الأرشيف' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl'); await tabB.close();
});
test('archive parent navigation is deterministic from settings, direct loads, detail, and RTL mobile', async ({ page }) => {
  await seed(page);
  const activeContext = { y: 'cur', t: 'tc' };
  await page.goto('/#/settings');
  await page.getByRole('link', { name: 'الأرشيف' }).click();
  await expect(page).toHaveURL(/#\/archive$/);
  await page.getByRole('link', { name: 'العودة إلى الإعدادات' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.goto('/#/archive');
  await page.getByRole('link', { name: 'العودة إلى الإعدادات' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.goto('/#/archive');
  await page.getByText('القديمة').click();
  await expect(page).toHaveURL(/#\/archive\/year\/old\/term\/to$/);
  await page.getByRole('link', { name: 'العودة إلى الأرشيف' }).click();
  await expect(page).toHaveURL(/#\/archive$/);
  expect(await page.evaluate(() => ({ y: window.store.state.device.activeYearId, t: window.store.state.device.activeTermId }))).toEqual(activeContext);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/archive');
  const parent = page.getByRole('link', { name: 'العودة إلى الإعدادات' });
  await expect(parent).toBeVisible();
  expect(await parent.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});