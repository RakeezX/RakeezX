import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('protected font loads across signed-out and Demo surfaces, then offline', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/');
  await expect(page.locator('.boot')).toHaveCount(0);
  const faces = () => page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    regular: document.fonts.check('400 16px "Thmanyah Sans"'),
    medium: document.fonts.check('500 16px "Thmanyah Sans"'),
    bold: document.fonts.check('700 16px "Thmanyah Sans"'),
    black: document.fonts.check('900 16px "Thmanyah Sans"'),
    loaded: [...document.fonts].filter((face) => face.family.replaceAll('"', '') === 'Thmanyah Sans' && face.status === 'loaded').length,
  }));
  expect(await faces()).toMatchObject({ regular: true, medium: true, bold: true, black: true, loaded: 4 });
  expect((await faces()).body).toContain('Thmanyah Sans');
  for (const path of ['/assets/thmanyahsans-Regular.woff2', '/fonts/thmanyahsans-Regular.woff2', '/font/ThmanyahSans.otf']) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(404);
    expect((await response.body()).subarray(0, 4).toString()).not.toBe('wOF2');
    expect(response.headers()['content-type']).not.toMatch(/font|octet-stream/);
  }
  if (await page.locator('[data-workspace-demo]:visible').count()) {
    await page.locator('[data-workspace-demo]:visible').click();
    await expect(page.locator('[data-act="demo-login"]:visible').first()).toBeVisible();
  } else {
    const miniHub = page.locator('[data-act="open-teacher-mini-hub"]').filter({ visible: true }).first();
    await miniHub.click();
    const demoEntry = page.locator('[data-act="demo-enter"]').filter({ visible: true });
    if (await demoEntry.count()) {
      await demoEntry.click();
      await expect(page.locator('[data-act="demo-login"]:visible').first()).toBeVisible();
    }
  }
  for (const [width, height] of [[1440, 900], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      for (const route of ['/', '/schedule', '/calendar', '/teaching/demo:teaching:1/grades', '/settings', '/support']) {
        await page.evaluate((value) => { location.hash = `#${value}`; }, route);
        await page.waitForTimeout(100);
        const sample = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          family: getComputedStyle(document.body).fontFamily,
        }));
        expect(sample.family).toContain('Thmanyah Sans');
        expect(sample.width).toBeLessThanOrEqual(sample.viewport + 1);
        if (route === '/') {
          const heading = page.locator('.page--home .hero__hello').first();
          const shortcut = page.locator('.page--home .home-shortcuts .tile__title').first();
          if (await heading.count()) {
            expect(await heading.evaluate((element) => getComputedStyle(element).fontSize)).toBe(width === 1440 ? '25px' : '22px');
            expect(await shortcut.evaluate((element) => getComputedStyle(element).fontSize)).toBe(width === 1440 ? '12px' : width === 390 ? '11px' : '10px');
          }
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.locator('.page--home')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))).toEqual([]);
  const printProof = await page.evaluate(async () => {
    const { openSchedulePrint } = await import('/src/lib/schedule-export.js');
    const model = { title: 'الجدول الأسبوعي', identity: {}, academic: { year: '', term: '' }, timing: null, periods: [], days: [] };
    const popup = openSchedulePrint(model);
    popup.print = () => {
      window.__n08PrintProof = {
        family: popup.getComputedStyle(popup.document.body).fontFamily,
        loaded: [...popup.document.fonts].filter((face) => face.status === 'loaded').length,
        pageSize: popup.document.querySelector('style')?.textContent.includes('A4 landscape'),
      };
    };
    const deadline = Date.now() + 5000;
    while (!window.__n08PrintProof && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    const result = window.__n08PrintProof;
    popup.close();
    return result;
  });
  expect(printProof).toMatchObject({ loaded: 4, pageSize: true });
  expect(printProof.family).toContain('Thmanyah Sans');
  await page.waitForFunction(async () => (await navigator.serviceWorker?.ready)?.active?.state === 'activated');
  const cache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    const keys = (await (await caches.open('rakeezx-v35')).keys()).map((request) => new URL(request.url).pathname);
    return { keys, faces: [...document.fonts].filter((face) => face.status === 'loaded').length };
  });
  expect(cache.keys).toContain('/src/lib/thmanyah-payload.js');
  expect(cache.keys).toContain('/src/lib/thmanyah-font.js');
  expect(cache.keys.some((path) => /\.(?:woff2?|otf|ttf)$/i.test(path))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.boot')).toHaveCount(0);
  expect(await faces()).toMatchObject({ regular: true, medium: true, bold: true, black: true, loaded: 4 });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
