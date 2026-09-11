import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test.use({ baseURL: process.env.RAKEEZX_E2E_BASE_URL || 'http://localhost:5174' });
test.setTimeout(120_000);
const widths = [320, 390, 412, 1280, 1440];

test('brand identity: shell, Home, Teacher Center, login and install in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('test-results/brand-implementation', { recursive: true });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready);
  for (const theme of ['light', 'dark']) for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/settings');
    await page.getByRole('button', { name: theme === 'dark' ? 'داكن' : 'فاتح', exact: true }).click();
    await page.goto('/#/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveTitle('رَكيز المعلم');
    await expect(page.locator(width < 900 ? '.mobile-brand' : '.sidebar__brand')).toContainText('رَكيز');
    await expect(page.locator('.home-pwa-prompt')).toContainText('تطبيق رَكيز المعلم');
    await expect(page.locator('.brand-lockup:visible')).toHaveCount(1);
    await expect(page.locator('.hero .brand-lockup, .hero img')).toHaveCount(0);
    await expect(page.locator('.hero__hello')).toHaveText('أهلًا بك');
    await expect(page.locator('.hero__date')).toBeVisible();
    await expect(page.locator('.hero .compact-timing-pill')).toBeVisible();
    expect(await page.locator('.hero').evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(100);
    for (const selector of ['.home-pwa-brand-icon']) {
      await expect(page.locator(selector)).toHaveJSProperty('naturalWidth', 192);
      expect(await page.locator(selector).evaluate(img => img.getBoundingClientRect().width)).toBeGreaterThanOrEqual(56);
    }
    if (width >= 900) await expect(page.locator('.sidebar__brand img')).toHaveJSProperty('naturalWidth', 192);
    const heroAudit = await new AxeBuilder({ page }).include('.hero').analyze();
    expect(heroAudit.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/brand-implementation/home-${width}-${theme}.png` });
    await page.locator(width < 900 ? '.topbar__teacher-btn' : '.teacher-mini-hub-trigger').click();
    await expect(page.locator('.mini-hub-pwa')).toContainText('تطبيق رَكيز المعلم');
    await page.screenshot({ path: `test-results/brand-implementation/center-${width}-${theme}.png` });
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await expect(page.locator('.auth-brand')).toContainText('رَكيز');
    await expect(page.locator('.auth-brand img')).toHaveJSProperty('naturalWidth', 192);
    await page.getByRole('textbox', { name: 'البريد الإلكتروني' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="password"]')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).include('.auth-brand').analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: `test-results/brand-implementation/login-${width}-${theme}.png` });
    await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();
    await page.goto('/#/settings');
    await expect(page.locator('.settings-section--about')).toContainText('مساحة العمل الرقمية للمعلم');
    await expect(page.locator('.settings-section--about img')).toHaveJSProperty('naturalWidth', 192);
    await page.locator('.settings-section--about').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/brand-implementation/about-${width}-${theme}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/#/');
  }
  await page.reload();
  await expect(page).toHaveTitle('رَكيز المعلم');
  await page.evaluate(() => window.store.patchProfile({ teacherName: 'معلم الاختبار' }, { queue: false }));
  await page.reload();
  await expect(page.locator('.hero__hello')).toHaveText('أهلًا، معلم الاختبار');
  await expect(page.locator('.brand-lockup:visible')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('manifest and brand artwork keep internal identity and required icon sizes', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('رَكيز المعلم');
  expect(manifest.short_name).toBe('رَكيز المعلم');
  expect(manifest.id).toBe('rakeezx');
  expect(manifest.start_url).toBe('./');
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', 'assets/favicon.svg?v=12');
  for (const [file, size] of [['icon-180.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable.png',512],['favicon-16.png',16],['favicon-32.png',32]]) {
    expect(await page.evaluate(async ({ file }) => {
      const image = new Image(); image.src = `/assets/${file}`; await image.decode(); return [image.naturalWidth, image.naturalHeight];
    }, { file })).toEqual([size,size]);
  }
});

test('tiny derivative stays legible at native sizes and browser favicon URLs resolve', async ({ page, request }) => {
  await page.goto('/');
  const links = await page.locator('link[rel="icon"]').evaluateAll(nodes => nodes.map(node => node.href));
  for (const url of links) expect((await request.get(url)).ok()).toBe(true);
  const root = new URL(page.url()).origin;
  await page.setContent(`<html lang="ar" dir="rtl"><head><title>فحص الأيقونات المصغرة</title><style>body{margin:0;font:16px Segoe UI,sans-serif}section{padding:32px;display:flex;align-items:center;gap:32px}section:nth-child(2){background:#101319;color:#fff}.sample{display:grid;gap:16px;justify-items:center}</style></head><body>${['فاتح','داكن'].map(theme=>`<section><h2>${theme}</h2>${[16,24,32,48].map(size=>`<div class="sample"><img src="${root}/assets/favicon.svg?v=12" width="${size}" height="${size}" alt="رمز مساحة العمل"><span>${size}px</span></div>`).join('')}<img src="${root}/assets/icon-192.png" width="96" height="96" alt="رَكيز المعلم"></section>`).join('')}</body></html>`);
  await page.setViewportSize({ width: 820, height: 400 });
  await page.locator('img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
  await page.screenshot({ path: 'test-results/brand-implementation/tiny-native-size.png' });
});
