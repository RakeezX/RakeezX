import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { SUPABASE_URL } from '../src/lib/cloud.js';

test.use({ serviceWorkers: 'block' });
const ROOT = path.resolve('.');
let host, server;
test.beforeAll(async () => {
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1));
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    try { if (!(await stat(file)).isFile()) throw Error(); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('concept Z landing uses real entry handlers and five isolated interactive tools', async ({ page }, info) => {
  const errors = [], productCalls = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.context().route(`${SUPABASE_URL}/**`, route => { productCalls.push(route.request().url()); return route.fulfill({ status: 204 }); });
  await page.goto(host);
  await page.screenshot({ path: info.outputPath('landing-desktop.png'), fullPage: true });
  await expect(page.locator('#first-run-title')).toHaveText('من أول حصة، متابعة أسهل، ويوم أكثر تنظيمًا.');
  await expect(page.locator('.n37-landing__intro>p')).toHaveText('فصولك وطلابك وحضورك ودرجاتك، في مساحة واحدة.');
  await expect(page.locator('[data-pf-tool]')).toHaveCount(5);
  await expect(page.locator('[data-pf-tool][aria-expanded=true]')).toHaveCount(1);
  await expect(page.locator('[data-pf-tool=attendance]')).toHaveAttribute('aria-expanded', 'true');
  const before = await page.evaluate(async () => ({ dbs: (await indexedDB.databases()).map(x => x.name).sort(), storage: { ...localStorage } }));
  await page.locator('[data-pf-att="1"][data-status=late]').click();
  await expect(page.locator('.att-pill')).toContainText('2 من 3');
  await page.locator('[data-pf-tool=quicklog]').click();
  await page.locator('[data-pf-plus="0"]').click();
  await expect(page.locator('.qlcard__score').first()).toHaveText('+1');
  await page.locator('[data-pf-minus="0"]').click();
  await expect(page.locator('.qlcard__score').first()).toHaveText('0');
  await page.locator('[data-pf-tool=grades]').click();
  await expect(page.locator('[data-pf-score]')).toHaveCount(4);
  const gradeRow = page.locator('.grades-01c__direct-row').first();
  expect(await gradeRow.locator('.rollno').evaluate(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= el.parentElement.getBoundingClientRect().top; })).toBe(true);
  expect(await gradeRow.locator('.graderow__in').evaluate(el => { const input = el.querySelector('input').getBoundingClientRect(), max = el.querySelector('.graderow__max').getBoundingClientRect(); return input.x > max.x; })).toBe(true);
  await page.locator('#pf-score-0').fill('7');
  await page.locator('#pf-score-0').press('Tab');
  await expect(page.locator('#pf-score-state-0')).toHaveText('تم الرصد');
  await page.locator('[data-pf-tool=groups]').click();
  await page.locator('[data-pf-count="3"]').click();
  await expect(page.locator('#pf-count-hint')).toContainText('2 + 2 + 2');
  await page.locator('#pf-count').fill('2');
  await expect(page.locator('#pf-count')).toHaveAttribute('aria-invalid', 'false');
  await page.locator('[data-pf-tool=schedule]').click();
  await expect(page.locator('#pf-panel-schedule')).toBeVisible();
  await expect(page.locator('[data-pf-tool][aria-expanded=true]')).toHaveCount(1);
  const after = await page.evaluate(async () => ({ dbs: (await indexedDB.databases()).map(x => x.name).sort(), storage: { ...localStorage } }));
  expect(after).toEqual(before);
  expect(productCalls).toEqual([]);
  await page.locator('[data-workspace-login]').click();
  await expect(page.locator('.first-run-auth')).toBeVisible();
  expect(errors).toEqual([]);
});

test('responsive landing and real trial entry stay isolated', async ({ page }, info) => {
  const errors = [], productCalls = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.context().route(`${SUPABASE_URL}/**`, route => { productCalls.push(route.request().url()); return route.fulfill({ status: 204 }); });
  await page.context().route('**/src/lib/demo-workspace.js', async route => {
    const response = await route.fetch(), source = await response.text();
    const plan = source.match(/const CLASS_PLAN = Object.freeze\(\[([\s\S]*?)\]\);/);
    expect(plan).not.toBeNull();
    await route.fulfill({ response, body: source.replace(plan[0], 'const CLASS_PLAN = Object.freeze([{grade:4,label:1,students:1,slots:[[0,1],[2,3]]}]);') });
  });
  await page.goto(host);
  for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    if (theme === 'light' && width === 390) await page.screenshot({ path: info.outputPath('landing-mobile.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator('[data-pf-tool][aria-expanded=true]')).toHaveCount(1);
    if (width < 760) { await page.locator('[data-pf-tool=schedule]').click(); await page.locator('[data-pf-day="1"]').click(); await expect(page.locator('[data-pf-day="1"]')).toHaveAttribute('aria-selected', 'true'); }
  }
  expect(productCalls).toEqual([]);
  await page.locator('[data-workspace-demo]').click();
  await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
  expect(productCalls).toEqual([]);
  expect(errors).toEqual([]);
});
