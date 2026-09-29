import { test, expect, chromium, webkit } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

let host, server;
test.beforeAll(async () => {
  host = process.env.N54_DIAGNOSTIC_PREVIEW;
  if (host) { expect(host).toMatch(/^https:\/\/[a-z0-9-]+\.rakeezx\.pages\.dev$/); return; }
  const root = process.cwd();
  server = createServer(async (req, res) => {
    const file = path.resolve(root, new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html');
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) throw Error();
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
const panel = '[data-viewport-diagnostic]';
async function settle(page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
  });
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return Object.fromEntries(['top', 'bottom', 'left', 'right', 'height', 'width'].map(k => [k, r[k]])); };
    return { sheet: rect('.sheet'), header: rect('.sheet__head'), body: rect('.sheet__body'), footer: rect('.sheet__foot'), input: rect('[name=email]'), overflow: document.documentElement.scrollWidth > innerWidth + 1, scrollY, scrollTop: document.querySelector('.sheet__body').scrollTop };
  });
}
async function fixture(browser, engine, viewport) {
  const context = await browser.newContext({ viewport, baseURL: host, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], external = [], modules = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', req => { if (req.url().includes('viewport-diagnostic.js')) modules.push(req.url()); });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === host) return route.continue();
    external.push(route.request().url()); return route.fulfill({ json: {} });
  });
  if (engine === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  else await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__n54TestClipboard = text; } } }));
  const copied = async () => JSON.parse(await page.evaluate(engine => engine === 'chromium' ? navigator.clipboard.readText() : window.__n54TestClipboard, engine));
  return { context, page, errors, external, modules, copied };
}
async function shrink(page) {
  await page.evaluate(() => {
    Object.defineProperties(visualViewport, { height: { configurable: true, value: 350 }, width: { configurable: true, value: 300 }, offsetTop: { configurable: true, value: 80 }, offsetLeft: { configurable: true, value: 10 }, pageTop: { configurable: true, value: 80 }, pageLeft: { configurable: true, value: 10 }, scale: { configurable: true, value: 1.25 } });
    visualViewport.dispatchEvent(new Event('resize'));
  }); await settle(page);
}
for (const engine of ['chromium', 'webkit']) for (const [width, height] of [[390,844],[375,812],[320,740]]) {
  test(`N54 diagnostic ${engine} ${width}: opt-in, privacy, copy/clear and no layout shift`, async ({}, info) => {
    const browser = await (engine === 'chromium' ? chromium : webkit).launch();
    const viewport = { width, height }, off = await fixture(browser, engine, viewport), on = await fixture(browser, engine, viewport);
    try {
      await off.page.goto('/'); await off.page.locator('[data-workspace-login]').click(); await settle(off.page);
      await expect(off.page.locator(panel)).toHaveCount(0); expect(off.modules).toEqual([]);
      const normal = await geometry(off.page);
      await shrink(off.page); const compressed = await geometry(off.page);
      await on.page.goto('/?debugViewport=1'); await expect(on.page.locator(panel)).toBeVisible();
      await on.page.locator('[data-workspace-login]').click(); await settle(on.page);
      expect(await geometry(on.page)).toEqual(normal);
      await on.page.locator(`${panel} .toggle`).click(); await settle(on.page);
      expect(await geometry(on.page)).toEqual(normal);
      await on.page.locator('[name=email]').fill('sensitive-sentinel@example.invalid');
      // Adversarial identifiers/storage must not become diagnostic content.
      await on.page.evaluate(() => {
        document.querySelector('[name=email]').id = 'private-owner-identity';
        document.querySelector('[name=email]').classList.add('private-owner-class');
        document.querySelector('[name=token]').value = '827193';
        localStorage.setItem('diagnostic-private-fixture', 'secret-token-identity');
        document.cookie = 'diagnostic-test=secret-cookie';
      });
      await shrink(on.page); expect(await geometry(on.page)).toEqual(compressed);
      expect(await on.page.locator('[name=email]').evaluate(el => document.activeElement === el)).toBe(true);
      await on.page.locator(`${panel} [data-copy]`).click();
      await expect(on.page.locator(`${panel} .status`)).toHaveText('تم نسخ بيانات التشخيص');
      const trace = await on.copied(), text = JSON.stringify(trace), latest = trace.events.at(-1);
      for (const privateValue of ['sensitive-sentinel', '827193', 'private-owner-identity', 'private-owner-class', 'secret-token-identity', 'secret-cookie']) expect(text).not.toContain(privateValue);
      expect(latest.visualViewport).toEqual({ width:300,height:350,offsetTop:80,offsetLeft:10,pageTop:80,pageLeft:10,scale:1.25 });
      expect(latest.css).toEqual({visibleHeight:'350px',visibleTop:'80px'});
      expect(latest.active.tag).toBe('INPUT'); expect(latest.active.id).toBe('[redacted]');
      for (const key of ['window','document','focusedInputRect','sheet','header','body','footer','primaryCTA','hasModal','scrollY','orientation','safeArea','layout']) expect(latest).toHaveProperty(key);
      expect(latest.body).toHaveProperty('scrollHeight'); expect(latest.body).toHaveProperty('clientHeight');
      expect(latest.performanceMs).toBeGreaterThan(0);
      const kinds = trace.events.map(e => e.event); expect(kinds).toContain('focusin'); expect(kinds).toContain('sheet.open'); expect(kinds).toContain('visualViewport.resize');
      expect(await on.page.locator('[name=email]').evaluate(el => document.activeElement === el)).toBe(true);
      await on.page.locator('[name=email]').evaluate(el => el.blur());
      await on.page.evaluate(() => {
        visualViewport.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('orientationchange'));
      }); await settle(on.page);
      await on.page.locator(`${panel} [data-copy]`).click();
      const lifecycle = await on.copied();
      for (const name of ['focusout','visualViewport.scroll','window.resize','window.scroll','orientationchange']) expect(lifecycle.events.some(e=>e.event===name)).toBe(true);
      await on.page.getByRole('button',{name:'إغلاق',exact:true}).click(); await settle(on.page);
      await on.page.locator(`${panel} [data-copy]`).click(); expect((await on.copied()).events.some(e=>e.event==='sheet.close')).toBe(true);
      await on.page.locator('[data-workspace-login]').click(); await settle(on.page);
      await on.page.evaluate(() => { for (let i=0;i<180;i++) visualViewport.dispatchEvent(new Event('scroll')); }); await settle(on.page);
      await on.page.locator(`${panel} [data-copy]`).click(); const bounded = await on.copied();
      expect(bounded.events).toHaveLength(120); expect(bounded.dropped).toBeGreaterThan(0);
      await on.page.locator(`${panel} [data-clear]`).click(); await expect(on.page.locator(`${panel} .status`)).toHaveText('تم مسح السجل');
      await on.page.locator(`${panel} [data-copy]`).click(); const cleared = await on.copied(); expect(cleared.events).toEqual([]); expect(cleared.dropped).toBe(0);
      await on.page.locator(`${panel} .toggle`).click(); await expect(on.page.locator(`${panel} .details`)).toBeHidden();
      await on.page.screenshot({path:info.outputPath('diagnostic-collapsed.png')});
      await on.context.close();
      // Flag 0 is not an opt-in; reloading also discards in-memory history.
      await off.page.goto('/?debugViewport=0'); await expect(off.page.locator(panel)).toHaveCount(0);
      expect(off.errors).toEqual([]); expect(on.errors).toEqual([]); expect(off.external).toEqual([]); expect(on.external).toEqual([]);
      await info.attach('sanitized-trace', {body:JSON.stringify(trace,null,2),contentType:'application/json'});
    } finally { await browser.close(); }
  });
}
