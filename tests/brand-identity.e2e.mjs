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
    if (width >= 900) {
      await expect(page.locator('.sidebar__brand img')).toHaveJSProperty('naturalWidth', 192);
      expect((await page.locator('.sidebar__brand img').boundingBox()).width).toBe(64);
    } else {
      expect((await page.locator('.mobile-brand img').boundingBox()).width).toBe(54);
    }
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
  expect(manifest.icons).toEqual([
    { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'assets/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'assets/favicon-32.png?v=15');
  for (const size of [1024, 512, 256, 192, 180, 167, 152, 144, 120, 96, 87, 80, 76, 72, 64, 60, 58, 48, 40, 32, 29, 20]) {
    expect(await page.evaluate(async ({ file }) => {
      const image = new Image(); image.src = `/assets/${file}`; await image.decode(); return [image.naturalWidth, image.naturalHeight];
    }, { file: `icon-${size}.png` })).toEqual([size,size]);
  }
  for (const [file, size] of [['brand-icon-master-1254.png',1254],['icon-maskable.png',512],['favicon-32.png',32]]) {
    expect(await page.evaluate(async ({ file }) => {
      const image = new Image(); image.src = `/assets/${file}`; await image.decode(); return [image.naturalWidth, image.naturalHeight];
    }, { file })).toEqual([size,size]);
  }
  expect((await request.get('/assets/favicon-16.png')).headers()['content-type']).not.toMatch(/^image\//);
  expect((await request.get('/assets/icon.svg')).headers()['content-type']).not.toMatch(/^image\//);
});

test('locked 32px master favicon and full icon resolve without a substitute derivative', async ({ page, request }) => {
  await page.goto('/');
  const links = await page.locator('link[rel="icon"]').evaluateAll(nodes => nodes.map(node => node.href));
  for (const url of links) expect((await request.get(url)).ok()).toBe(true);
  const root = new URL(page.url()).origin;
  await page.setContent(`<html lang="ar" dir="rtl"><head><title>فحص الأيقونة المعتمدة</title><style>body{margin:0;font:16px Segoe UI,sans-serif}section{padding:32px;display:flex;align-items:center;gap:32px}section:nth-child(2){background:#101319;color:#fff}.sample{display:grid;gap:16px;justify-items:center}</style></head><body>${['فاتح','داكن'].map(theme=>`<section><h2>${theme}</h2><div class="sample"><img src="${root}/assets/favicon-32.png?v=15" width="32" height="32" alt="أيقونة رَكيز المعلم المعتمدة"><span>32px</span></div><img src="${root}/assets/icon-192.png" width="96" height="96" alt="رَكيز المعلم"></section>`).join('')}</body></html>`);
  await page.setViewportSize({ width: 820, height: 400 });
  await page.locator('img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
  await page.screenshot({ path: 'test-results/brand-implementation/tiny-native-size.png' });
});

test('locked master artwork survives desktop, Android-mask and iOS presentation', async ({ page }) => {
  await mkdir('test-results/brand-implementation', { recursive: true });
  await page.setViewportSize({ width: 940, height: 440 });
  await page.goto('/');
  const root = new URL(page.url()).origin;
  await page.setContent(`<html lang="ar" dir="rtl"><head><title>فحص منصات الأيقونة المعتمدة</title><style>
    *{box-sizing:border-box}body{margin:0;padding:40px;background:#eef4f0;color:#10251d;font:16px Segoe UI,sans-serif}
    main{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.sample{display:grid;justify-items:center;gap:14px;padding:24px;background:#fff;border:1px solid #dce7e1;border-radius:22px}
    .frame{width:160px;height:160px;overflow:hidden;background:#fff}.desktop{border-radius:28px}.android{border-radius:50%}.ios{border-radius:35px}.frame img{display:block;width:100%;height:100%}
    h2{margin:0;font-size:17px}
  </style></head><body><main>
    <section class="sample"><div class="frame desktop"><img src="${root}/assets/icon-192.png" alt="أيقونة تطبيق سطح المكتب"></div><h2>تطبيق سطح المكتب</h2></section>
    <section class="sample"><div class="frame android"><img src="${root}/assets/icon-maskable.png" alt="معاينة القص الدائري في أندرويد"></div><h2>منطقة أندرويد الآمنة</h2></section>
    <section class="sample"><div class="frame ios"><img src="${root}/assets/icon-180.png" alt="أيقونة آيفون وآيباد"></div><h2>iOS / iPadOS</h2></section>
  </main></body></html>`);
  await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await expect(page.locator('img')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/brand-implementation/platform-icon-contexts.png' });
});
