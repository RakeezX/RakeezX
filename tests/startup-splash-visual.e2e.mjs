import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test.use({ ...(process.env.RAKEEZX_E2E_BASE_URL ? { baseURL: process.env.RAKEEZX_E2E_BASE_URL } : {}) });
test.setTimeout(120_000);

const output = 'test-results/startup-splash-visual';
const options = [
  { key: 'A', scale: 1.08 },
  { key: 'B', scale: 1.12 },
  { key: 'C', scale: 1.15 },
];

async function loadStartup(page, { width, height = 844, theme = 'light' }) {
  const response = await page.request.get('/');
  const fixtureBase = new URL('/', response.url()).href;
  const source = (await response.text())
    .replace('<head>', `<head><base href="${fixtureBase}">`)
    .replace(/<script type="module" src="src\/app\.js"><\/script>/, '');
  await page.setViewportSize({ width, height });
  await page.setContent(source);
  await page.locator('html').evaluate((node, nextTheme) => { node.dataset.theme = nextTheme; }, theme);
  await page.locator('.boot__mark img:visible').evaluate(image => image.complete || new Promise(resolve => {
    image.addEventListener('load', resolve, { once: true });
  }));
}

async function geometry(page) {
  return page.locator('.boot').evaluate(node => {
    const box = selector => {
      const rect = node.querySelector(selector).getBoundingClientRect();
      return { width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2 };
    };
    const message = node.querySelector('.boot__msg');
    return {
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      composition: box('.boot__composition'),
      mark: box('.boot__mark'),
      image: box('.boot__mark .brand-lockup'),
      message: box('.boot__msg'),
      progress: box('.boot__progress'),
      textSize: Number.parseFloat(getComputedStyle(message).fontSize),
      logoToText: node.querySelector('.boot__msg').getBoundingClientRect().top - node.querySelector('.boot__mark').getBoundingClientRect().bottom,
      textToProgress: node.querySelector('.boot__progress').getBoundingClientRect().top - node.querySelector('.boot__msg').getBoundingClientRect().bottom,
    };
  });
}

test('startup scale options keep one shared optical center', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadStartup(page, { width: 390, theme: 'light' });

  for (const option of options) {
    await page.locator('.boot__composition').evaluate((node, scale) => node.style.setProperty('--boot-identity-scale', scale), option.scale);
    const measured = await geometry(page);
    const targetCenter = measured.viewportWidth / 2;
    for (const item of [measured.composition, measured.mark, measured.message, measured.progress]) {
      expect(item.centerX).toBeCloseTo(targetCenter, 1);
    }
    expect(measured.documentWidth).toBeLessThanOrEqual(measured.viewportWidth);
    expect(measured.textSize).toBe(16);
    expect(measured.logoToText).toBeCloseTo(14, 1);
    expect(measured.textToProgress).toBeCloseTo(10, 1);
    await page.screenshot({ path: `${output}/option-${option.key}-390-light.png`, fullPage: true });
  }

  await page.locator('.boot__composition').evaluate(node => node.style.setProperty('--boot-identity-scale', 1.12));
  expect((await new AxeBuilder({ page }).include('.boot').analyze()).violations).toEqual([]);
});

test('recommended startup is balanced across mobile sizes and settled themes', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cases = [
    { width: 320, height: 844, theme: 'light' },
    { width: 360, height: 800, theme: 'dark' },
    { width: 384, height: 854, theme: 'light' },
    { width: 390, height: 844, theme: 'dark', screenshot: 'recommended-390-dark.png' },
    { width: 412, height: 915, theme: 'light', screenshot: 'recommended-412-light.png' },
  ];

  for (const item of cases) {
    await loadStartup(page, item);
    const measured = await geometry(page);
    const targetCenter = item.width / 2;
    for (const part of [measured.composition, measured.mark, measured.message, measured.progress]) {
      expect(part.centerX).toBeCloseTo(targetCenter, 1);
    }
    expect(measured.documentWidth).toBeLessThanOrEqual(item.width);
    await expect(page.locator('.boot__mark')).toBeInViewport();
    await expect(page.locator('.boot__msg')).toHaveText('جارٍ تجهيز مساحة عملك…');
    await expect(page.locator('.boot__progress')).toBeInViewport();
    if (item.screenshot) await page.screenshot({ path: `${output}/${item.screenshot}`, fullPage: true });
  }
});

test('current production and recommended composition comparison', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadStartup(page, { width: 390, height: 844, theme: 'light' });
  await page.setViewportSize({ width: 796, height: 844 });
  await page.evaluate(() => {
    const original = document.querySelector('.boot');
    const legacy = original.cloneNode(true);
    const candidate = original.cloneNode(true);
    legacy.classList.add('boot--legacy-preview');
    const frame = document.createElement('div');
    frame.className = 'splash-comparison';
    const panel = (label, boot) => {
      const wrapper = document.createElement('section');
      wrapper.className = 'splash-comparison__panel';
      const title = document.createElement('div');
      title.className = 'splash-comparison__label';
      title.textContent = label;
      wrapper.append(title, boot);
      return wrapper;
    };
    frame.append(panel('Current Production', legacy), panel('Recommended B', candidate));
    document.body.replaceChildren(frame);
  });
  await page.addStyleTag({ content: `
    html, body { margin: 0; inline-size: auto; min-inline-size: 0; overflow: hidden; }
    .splash-comparison { direction: ltr; display: grid; grid-template-columns: repeat(2, 390px); gap: 16px; background: #cbd5e1; }
    .splash-comparison__panel { position: relative; inline-size: 390px; block-size: 844px; overflow: hidden; background: var(--bg); }
    .splash-comparison__label { position: absolute; z-index: 2; inset-block-start: 16px; inset-inline-start: 16px; padding: 5px 9px; border-radius: 999px; background: var(--bg-sunk); color: var(--text-2); font: 600 12px/1.4 sans-serif; }
    .splash-comparison .boot { min-block-size: 844px; }
    .boot--legacy-preview .boot__composition { inline-size: auto; }
    .boot--legacy-preview .boot__mark { position: static; inline-size: 216px; block-size: auto; overflow: visible; }
    .boot--legacy-preview .boot__mark .brand-lockup { position: static; inline-size: 216px; max-inline-size: 100%; }
    .boot--legacy-preview .boot__msg { margin-block-start: 12px; font-size: 14px; font-weight: 400; line-height: normal; }
    .boot--legacy-preview .boot__progress { margin-block-start: 12px; }
  ` });
  await page.locator('.splash-comparison').screenshot({ path: `${output}/current-vs-recommended.png` });
});
