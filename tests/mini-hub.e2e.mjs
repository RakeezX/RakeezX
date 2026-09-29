import { test, expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';

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
    const evidence = await bootSettings(page);
    await page.goto('/#/classes');
    await expect(page.locator('.topbar')).toBeVisible();
    await page.waitForFunction(async () => {
      const sync = await import('/src/lib/sync.js');
      const summary = await sync.getSyncOperationalSummary();
      return summary.state === 'synced' && !summary.automaticSyncActive && summary.queuedCount === 0;
    });
    await page.waitForLoadState('networkidle');

    const trigger = viewport.width < 900
      ? page.locator('.topbar__teacher-btn')
      : page.locator('.teacher-mini-hub-trigger');
    await trigger.click();

    const sheet = page.locator('.sheet');
    await expect(sheet.getByText('حالة المزامنة:', { exact: true })).toBeVisible();
    await expect(sheet.getByText('مركز المعلمة', { exact: true })).toHaveCount(1);
    await expect(sheet.getByText('حالة المزامنة السحابية', { exact: true })).toHaveCount(0);
    await expect(sheet.getByRole('link', { name: 'الإعدادات' })).toHaveAttribute('href', '#/settings');
    await expect(sheet.getByText('المؤثرات الصوتية', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('الأرشيف', { exact: true })).toHaveCount(0);
    await expect(sheet).not.toContainText('[object Object]');
    const badge = sheet.locator('.badge');
    await expect(badge).toHaveText(/متزامن|جارٍ مزامنة التغييرات/);
    const manual = sheet.locator('[data-act="mini-hub-sync-now"]');
    if (await manual.isEnabled()) {
      await manual.click();
      await expect(page.locator('.sheet [data-act="mini-hub-sync-now"]')).toContainText(/مزامنة الآن|جارٍ المزامنة/);
    } else {
      await expect(badge).toHaveText('جارٍ مزامنة التغييرات');
      await expect(manual).toBeDisabled();
      await expect(manual).toContainText('جارٍ المزامنة');
    }
    await expect(page.locator('.sheet')).not.toContainText('[object Object]');

    const installed = sheet.locator('.mini-hub-installed');
    await expect(installed).toContainText('مثبّت');
    await expect(installed).not.toContainText('يعمل كبرنامج مستقل وسريع على هذا الجهاز دون إنترنت.');
    await expect(installed.locator('.mini-hub-installed__icon svg')).toBeVisible();
    const installedBox = await installed.boundingBox();
    expect(installedBox?.height).toBeLessThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    expect(evidence.errors).toEqual([]);
  });
}
