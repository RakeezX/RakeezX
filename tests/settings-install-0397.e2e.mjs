import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { bootSettings, bootDemoSettings } from './helpers/settings-0397.mjs';
import { BUILD_META } from '../src/lib/build-meta.js';

test.use({ serviceWorkers: 'block', browserName: process.env.RAKEEZX_SETTINGS_BROWSER || 'chromium' });
test.beforeEach(async ({ browser }) => {
  expect(browser.browserType().name()).toBe(process.env.RAKEEZX_SETTINGS_BROWSER || 'chromium');
});
const sizes = [[1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 740]];
async function safe(page, evidence) {
  expect(evidence.errors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function simulateDevice(page, { ua = 'Mozilla Windows Chrome/144.0 Safari/537', standalone = false, native = false } = {}) {
  await page.addInitScript(({ ua, standalone, native }) => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
    Object.defineProperty(navigator, 'platform', { configurable: true, get: () => /iPhone/.test(ua) ? 'iPhone' : /Macintosh/.test(ua) ? 'MacIntel' : 'Win32' });
    if (standalone) Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
    if (native) {
      window.installCalls = 0;
      window.deferredInstallPrompt = { prompt() { window.installCalls += 1; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
    }
  }, { ua, standalone, native });
}
async function manualGuide(page) {
  await page.locator('[data-act="install-guide"]').focus();
  await page.locator('[data-act="install-guide"]').press('Enter');
  await expect(page.locator('.n43-install-guide')).toBeVisible();
}

test.describe('Settings and install guidance', () => {
  for (const [width, height] of sizes) test(`N42/N43 ${width}x${height} light/dark geometry and accessible controls`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await simulateDevice(page);
    const evidence = await bootSettings(page);
    await expect(page.locator('[data-settings-profile]')).toHaveAttribute('open', '');
    const measurements = [];
    for (const theme of ['light', 'dark']) {
      await page.locator(`[data-act="theme"][data-theme="${theme}"]`).click();
      await expect(page.locator(`[data-theme="${theme}"][data-act="theme"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { name: 'المظهر والتفاعل' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'البيانات والمساعدة' })).toBeVisible();
      for (const href of ['#/settings/backup', '#/archive', '#/support']) await expect(page.locator(`.settings-link-group a[href="${href}"]`)).toBeVisible();
      const measured = await page.locator('.settings-compact').evaluate(el => ({
        height: el.getBoundingClientRect().height, pageHeight: document.documentElement.scrollHeight,
        controls: [...el.querySelectorAll('button, summary, a.settings-destination')].filter(e => e.getClientRects().length).map(e => ({ text: e.textContent.trim(), height: e.getBoundingClientRect().height })),
      }));
      expect(measured.controls.every(control => control.height >= 44)).toBe(true);
      await page.screenshot({ path: info.outputPath(`settings-${theme}.png`), fullPage: true });
      await page.locator('[data-act="about-rakeez"]').focus();
      await page.locator('[data-act="about-rakeez"]').press('Enter');
      await expect(page.locator('[data-about-version]')).toHaveText(`الإصدار ${BUILD_META.appVersion}`);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-act="about-rakeez"]')).toBeFocused();
      await manualGuide(page);
      await expect(page.locator('.visual-cards > li')).toHaveCount(3);
      await expect.poll(async () => (await page.locator('.n43-install-guide').boundingBox()).width).toBeCloseTo(Math.min(900, width - 28), 0);
      expect(await page.locator('.n43-install-guide [data-sheet-close]').evaluate(el => el.offsetHeight)).toBeGreaterThanOrEqual(44);
      if (width === 1440) {
        await page.locator('.device-switch summary').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.device-switch')).toHaveAttribute('open', '');
        await page.keyboard.press('Tab');
        await expect(page.locator('[data-device="ios"]')).toBeFocused();
        await page.locator('.device-switch summary').click();
      }
      const rects = await page.locator('.visual-step').evaluateAll(elements => elements.map(el => ({ top: el.getBoundingClientRect().top, left: el.getBoundingClientRect().left })));
      if (width > 700) expect(Math.max(...rects.map(r => r.top)) - Math.min(...rects.map(r => r.top))).toBeLessThan(2);
      else expect(rects[2].top).toBeGreaterThan(rects[1].top);
      await page.locator('.visual-step').last().scrollIntoViewIfNeeded();
      await expect(page.locator('.visual-step p').last()).toBeInViewport();
      if (width === 1440 || width === 390) {
        const audit = await new AxeBuilder({ page }).include('.n43-install-guide').analyze();
        expect(audit.violations).toEqual([]);
      }
      await safe(page, evidence);
      await page.screenshot({ path: info.outputPath(`install-${theme}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      measurements.push({ width, viewportHeight: height, theme, ...measured, guide: rects });
      if (width === 1440 || width === 390) {
        const audit = await new AxeBuilder({ page }).include('.settings-compact').analyze();
        expect(audit.violations).toEqual([]);
      }
    }
    await writeFile(info.outputPath('measurements.json'), JSON.stringify(measurements, null, 2));
    await safe(page, evidence);
  });

  test('N42 expand, persist profile/preferences, required/error discoverability, destinations', async ({ page }) => {
    const evidence = await bootSettings(page);
    const summary = page.locator('[data-settings-profile] summary');
    if (await page.locator('[data-settings-profile]').getAttribute('open') === null) {
      await summary.focus(); await page.keyboard.press('Enter');
    }
    await expect(page.locator('input[name="teacherName"]')).toBeVisible();
    await page.locator('input[name="schoolName"]').fill('مدرسة اختبار محلية');
    await page.locator('input[name="schoolName"]').blur();
    await expect.poll(() => page.evaluate(() => window.store.state.profile.schoolName)).toBe('مدرسة اختبار محلية');
    await page.locator('input[name="phone"]').fill('0412345678');
    await page.locator('input[name="phone"]').blur();
    await expect(page.locator('[data-profile-attention]')).toHaveText('راجع البيانات غير الصالحة');
    await summary.click();
    await expect(page.locator('[data-settings-profile]')).toHaveAttribute('open', '');
    await page.locator('input[name="phone"]').fill('0500000000');
    await page.locator('input[name="phone"]').blur();
    await page.locator('[data-act="sound"][data-val="off"]').click();
    await page.locator('[data-act="visual-fx"][data-val="off"]').click();
    await page.reload();
    if (await page.locator('[data-settings-profile]').getAttribute('open') === null) await page.locator('[data-settings-profile] summary').click();
    await expect(page.locator('input[name="schoolName"]')).toHaveValue('مدرسة اختبار محلية');
    await expect(page.locator('input[name="phone"]')).toHaveValue('0500000000');
    await expect(page.locator('[data-act="sound"][data-val="off"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-act="visual-fx"][data-val="off"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('input[name="teacherName"]').fill(''); await page.locator('input[name="teacherName"]').blur();
    await page.locator('[data-act="sound"][data-val="on"]').click();
    await expect(page.locator('[data-profile-attention]')).toHaveText('أكمل بياناتك المطلوبة');
    await expect(page.locator('[data-settings-profile]')).toHaveAttribute('open', '');
    await page.locator('input[name="teacherName"]').fill('معلمة الاختبار'); await page.locator('input[name="teacherName"]').blur();
    for (const href of ['#/settings/backup', '#/archive', '#/support']) {
      await page.locator(`a.settings-destination[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(href));
      await expect(page.locator('[data-settings-profile]')).toHaveCount(0);
      await page.locator('nav a[href="#/settings"]').click();
      await page.locator('[data-settings-profile]').waitFor();
    }
    await safe(page, evidence);
  });
  for (const state of ['pending', 'unavailable']) test(`N42 ${state} account state exposes and expands profile`, async ({ page }) => {
    const evidence = await bootSettings(page, { [state]: true });
    await expect(page.locator('[data-profile-attention]')).toHaveText(state === 'pending' ? 'تغيير البريد قيد التأكيد' : 'تعذر التحقق من حالة الوصول الآن');
    await expect(page.locator('[data-settings-profile]')).toHaveAttribute('open', '');
    if (state === 'pending') await safe(page, evidence);
    else expect(evidence.errors.filter(e => !/account|contract/i.test(e))).toEqual([]);
  });

  test('N43 native invocation is direct; cancellation never claims success', async ({ page }) => {
    await simulateDevice(page, { native: true });
    const evidence = await bootSettings(page);
    await expect(page.locator('[data-install-state="native"]')).toContainText('سيكمل المتصفح عملية التثبيت.');
    await page.locator('[data-act="pwa-prompt-install"]').click();
    expect(await page.evaluate(() => window.installCalls)).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#toast')).not.toContainText('جارٍ تثبيت');
    await safe(page, evidence);
  });
  test('N43 standalone has no install action or manual cards', async ({ page }) => {
    await simulateDevice(page, { standalone: true, native: true });
    const evidence = await bootSettings(page);
    await expect(page.locator('[data-install-state="standalone"]')).toContainText('ركيز يعمل كتطبيق مستقل على هذا الجهاز.');
    await expect(page.locator('[data-act="pwa-prompt-install"], [data-act="install-guide"], .visual-cards')).toHaveCount(0);
    await safe(page, evidence);
  });
  test('N43 unknown starts limited; explicit device/browser choices show all approved paths', async ({ page }) => {
    await simulateDevice(page, { ua: 'Mozilla Linux Firefox/140.0' });
    const evidence = await bootSettings(page);
    await expect(page.locator('[data-install-state="limited"]')).toContainText('افتح ركيز في متصفح يدعم التثبيت');
    await manualGuide(page);
    await expect(page.locator('.visual-cards')).toHaveCount(0);
    await page.getByRole('button', { name: 'اختر جهازك', exact: true }).click();
    for (const device of ['ios', 'android', 'windows', 'mac']) {
      await page.locator(`[data-device="${device}"]`).click();
      await expect(page.locator('.visual-cards > li')).toHaveCount(3);
      await expect(page.locator(`[data-device="${device}"]`)).toHaveAttribute('aria-pressed', 'true');
      if (device === 'ios') await expect(page.locator('.visual-step').last()).toContainText('إذا ظهر خيار «فتح كتطبيق ويب»، فعّله ثم اضغط «إضافة».');
      if (device === 'android') await expect(page.locator('.small-hint')).toContainText('قد يظهر خيار');
      if (device === 'windows') {
        await expect(page.locator('.visual-step').nth(1)).toContainText('المزيد من الأدوات');
        await page.locator('[data-browser]').selectOption('chrome');
        await expect(page.locator('.visual-step').nth(1)).toContainText('بثّ وحفظ ومشاركة');
      }
      if (device === 'mac') await expect(page.locator('.visual-step').first()).toContainText('macOS Sonoma 14 أو أحدث');
    }
    await page.keyboard.press('Escape'); await expect(page.locator('[data-act="install-guide"]')).toBeFocused();
    await safe(page, evidence);
  });
  test('N43 iOS Safari opens manual visual cards even with synthetic native prompt', async ({ page }) => {
    await simulateDevice(page, { ua: 'Mozilla iPhone Safari/605.1', native: true });
    const evidence = await bootSettings(page);
    await expect(page.locator('[data-act="pwa-prompt-install"]')).toHaveCount(0);
    await manualGuide(page); await expect(page.locator('.visual-step').first()).toContainText('افتح المشاركة');
    await expect(page.locator('[data-native]')).toHaveCount(0);
    await safe(page, evidence);
  });
  test('N42/N43 bounded synthetic Demo retains identity/actions and makes zero Product cloud requests', async ({ page }) => {
    const evidence = await bootDemoSettings(page);
    await expect(page.locator('[data-act="demo-reset"]')).toBeVisible();
    await expect(page.locator('[data-act="demo-exit"]')).toBeVisible();
    if (await page.locator('[data-settings-profile]').getAttribute('open') === null) await page.locator('[data-settings-profile] summary').click();
    await expect(page.locator('[data-account-email], [data-act="change-email"], [data-account-access]')).toHaveCount(0);
    await page.locator('[data-act="about-rakeez"]').click(); await expect(page.locator('[data-about-version]')).toBeVisible(); await page.keyboard.press('Escape');
    await manualGuide(page); await expect(page.locator('.visual-cards > li')).toHaveCount(3);
    await safe(page, evidence); expect(evidence.requests).toEqual([]);
  });
});
