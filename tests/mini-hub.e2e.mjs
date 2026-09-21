import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 390, height: 844, label: '390px' },
  { width: 320, height: 680, label: '320px' },
]) {
  test(`Teacher Mini Hub keeps sync text clean and installed state compact — ${viewport.label}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => query.includes('display-mode: standalone')
        ? { matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
        : nativeMatchMedia(query);
    });
    await page.setViewportSize(viewport);
    await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.evaluate(async () => {
      const cloud = await import('/src/lib/cloud.js');
      const sync = await import('/src/lib/sync.js');
      const db = await import('/src/lib/db.js');
      await db.clearStore('outbox');
      cloud.setMockAuth({ id: 'mini-hub-test-owner', email: 'teacher@example.test' }, { access_token: 'test-only' });
      await sync.getSyncOperationalSummary();
    });

    const trigger = viewport.width < 768
      ? page.locator('.topbar__teacher-btn')
      : page.locator('.teacher-mini-hub-trigger');
    await trigger.click();

    const sheet = page.locator('.sheet');
    await expect(sheet.getByText('حالة المزامنة', { exact: true })).toBeVisible();
    await expect(sheet.getByText('مركز المعلم', { exact: true })).toHaveCount(1);
    await expect(sheet.getByText('حالة المزامنة السحابية', { exact: true })).toHaveCount(0);
    await expect(sheet.getByRole('link', { name: 'الإعدادات' })).toHaveAttribute('href', '#/settings');
    await expect(sheet.getByText('المؤثرات الصوتية', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('الأرشيف', { exact: true })).toHaveCount(0);
    await expect(sheet).not.toContainText('[object Object]');
    await sheet.locator('[data-act="mini-hub-sync-now"]').click();
    await expect(page.locator('.sheet [data-act="mini-hub-sync-now"]')).toContainText('مزامنة الآن');
    await expect(page.locator('.sheet')).not.toContainText('[object Object]');

    const installed = sheet.locator('.mini-hub-installed');
    await expect(installed).toContainText('مثبت على هذا الجهاز');
    await expect(installed).not.toContainText('يعمل كبرنامج مستقل وسريع على هذا الجهاز دون إنترنت.');
    await expect(installed.locator('.mini-hub-installed__icon svg')).toBeVisible();
    const installedBox = await installed.boundingBox();
    expect(installedBox?.height).toBeLessThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
