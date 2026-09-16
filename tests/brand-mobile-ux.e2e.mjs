import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test.use({ ...(process.env.RAKEEZX_E2E_BASE_URL ? { baseURL: process.env.RAKEEZX_E2E_BASE_URL } : {}) });
test.setTimeout(120_000);
const output = 'test-results/brand-mobile-ux';
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

test('Home, Schedule and Calendar: compact RTL surfaces and real controls in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir(output, { recursive: true });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready);
  // Isolated, unauthenticated browser context: synthetic local schedule only.
  await page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'اختبار العرض' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    for (let day = 0; day < 5; day++) await window.store.addSlot(teaching.id, day, 1);
  });
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 412, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#/settings');
    await page.getByRole('button', { name: theme === 'dark' ? 'داكن' : 'فاتح', exact: true }).click();
    await page.goto('/#/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page).toHaveTitle('رَكيز المعلم');
    await expect(page.locator('.brand-lockup:visible')).toHaveCount(1);
    await expect(page.locator('.topbar__sub')).toHaveCount(0);
    await expect(page.locator('.hero .compact-timing-pill')).toBeVisible();
    if (width < 900) {
      await expect(page.locator('.mobile-brand img:visible')).toHaveJSProperty('naturalWidth', 295);
      expect((await page.locator('.mobile-brand img:visible').boundingBox()).width).toBeCloseTo(Math.min(220, Math.max(199, width * .225 + 127)), 1);
      await expect(page.locator('.topbar__account-name')).toHaveText('تسجيل الدخول');
      await expect(page.locator('.topbar__teacher-sync')).toHaveCount(0);
      expect((await page.locator('.topbar__teacher-btn').boundingBox()).height).toBeGreaterThanOrEqual(48);
      await page.locator('.topbar__teacher-btn').click();
      await expect(page.locator('.mini-hub-pwa')).toBeVisible();
      await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();
    }
    if (width < 769) expect((await page.locator('.hero .compact-timing-pill').boundingBox()).height).toBeLessThanOrEqual(34);
    await noOverflow(page);
    await page.screenshot({ path: `${output}/home-${width}-${theme}.png` });
    expect((await new AxeBuilder({ page }).include('.topbar').include('.hero').include('.home-pwa-prompt').analyze()).violations).toEqual([]);

    await page.goto('/#/schedule');
    await expect(page.locator('.schedule-day-tab')).toHaveCount(6);
    await expect(page.locator('.schedule-summary-bar__item').first()).toContainText('إجمالي الحصص: 5 حصص أسبوعيًا');
    if (width < 769) {
      await expect(page.locator('.schedule-summary-bar__classes')).toBeHidden();
      const summaryGeometry = await page.locator('.schedule-summary-bar').evaluate(node => {
        const total = node.querySelector('.schedule-summary-bar__item');
        const timing = node.querySelector('.compact-timing-pill');
        const lineHeight = Number.parseFloat(getComputedStyle(total).lineHeight);
        const totalBox = total.getBoundingClientRect();
        const timingBox = timing.getBoundingClientRect();
        return {
          sameRow: Math.abs((totalBox.y + totalBox.height / 2) - (timingBox.y + timingBox.height / 2)) < 2,
          totalHeight: totalBox.height,
          lineHeight,
        };
      });
      expect(summaryGeometry.sameRow).toBe(true);
      expect(summaryGeometry.totalHeight).toBeLessThanOrEqual(summaryGeometry.lineHeight + 2);
    } else {
      await expect(page.locator('.schedule-summary-bar__classes')).toBeVisible();
    }
    for (const day of (width < 769 ? ['all', '0', '1', '2', '3', '4'] : [])) {
      const tab = page.locator(`.schedule-day-tab[data-day="${day}"]`);
      const box = await tab.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (width < 769) expect(box.height).toBeGreaterThanOrEqual(44);
      await tab.click();
      await expect(tab).toHaveClass(/is-active/);
    }
    await expect(page.locator('.slot:visible')).toHaveCount(width < 769 ? 1 : 5);
    await noOverflow(page);
    await page.screenshot({ path: `${output}/schedule-${width}-${theme}.png` });
    expect((await new AxeBuilder({ page }).include('.schedule-head').include('.schedule-summary-bar').include('.schedule-day-tabs').analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'تصدير الجدول', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();

    await page.goto('/#/schedule/times');
    await expect(page.locator('.topbar__title')).toContainText('أوقات الحصص');
    if (width < 900) {
      await expect(page.locator('.timing-new-profile-action--header')).toBeHidden();
      await expect(page.locator('.timing-mobile-actions')).toBeVisible();
      expect((await page.locator('.timing-mobile-actions .btn').boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.locator('.timing-mobile-actions .btn').click();
    } else {
      await expect(page.locator('.timing-new-profile-action--header')).toBeVisible();
      await expect(page.locator('.timing-mobile-actions')).toBeHidden();
      await page.locator('.timing-new-profile-action--header').click();
    }
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء', exact: true }).last().click();
    await noOverflow(page);
    await page.screenshot({ path: `${output}/timing-${width}-${theme}.png` });
    expect((await new AxeBuilder({ page }).include('.topbar').include('.timing-profiles-page').analyze()).violations).toEqual([]);

    await page.goto('/#/calendar');
    await expect(page.locator('.cal-progress-track')).toBeVisible();
    await expect(page.locator('.cal-metric')).toHaveCount(3);
    if (width < 769) {
      const ys = await page.locator('.cal-metric').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
      expect(new Set(ys).size).toBe(1);
    }
    await noOverflow(page);
    await page.screenshot({ path: `${output}/calendar-${width}-${theme}.png` });
    expect((await new AxeBuilder({ page }).include('.cal-hero-strip').include('.cal-card--pulse').analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();
    await noOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('startup uses the approved single calm loading message', async ({ page }) => {
  const response = await page.request.get('/');
  const fixtureBase = new URL('/', response.url()).href;
  const source = (await response.text())
    .replace('<head>', `<head><base href="${fixtureBase}">`)
    .replace(/<script type="module" src="src\/app\.js"><\/script>/, '');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.setContent(source);
  await expect(page.locator('.boot')).toHaveAttribute('aria-label', 'جارٍ تجهيز مساحة عملك');
  await expect(page.locator('.boot__msg')).toHaveText('جارٍ تجهيز مساحة عملك…');
  await expect(page.locator('.boot__msg')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `${output}/startup-320.png` });
});

test('skip link: keyboard-only visibility, unchanged route, standalone/reduced-motion safety', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => {
      const result = original(query);
      if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto('/#/calendar');
  await page.waitForFunction(() => window.store?.state?.ready);
  const skip = page.locator('.skip-link');
  const clipped = () => skip.evaluate(node => getComputedStyle(node).clipPath);
  expect(await clipped()).toBe('inset(50%)');
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  expect(await clipped()).toBe('none');
  await page.screenshot({ path: `${output}/keyboard-skip-link.png` });
  const url = page.url();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  expect(page.url()).toBe(url);
  expect(await clipped()).toBe('inset(50%)');
  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة', exact: true }).click();
  await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();
  expect(await clipped()).toBe('inset(50%)');
  await page.goto('/#/');
  await expect(page.locator('.home-pwa-prompt')).toHaveCount(0);
  await noOverflow(page);
});
