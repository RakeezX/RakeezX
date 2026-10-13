import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKETING_COLLECTOR } from '../src/lib/marketing-analytics.js';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { bootSettings } from './helpers/settings-0397.mjs';

// Existing N37/Demo static-serving pattern: actual application ESM, DOM and CSS.
// A synthetic HTTPS origin is intercepted entirely; no real Umami or Product traffic.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let server, browser, local;
before(async () => {
  server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) throw new Error('missing');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  local = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function fixture({ origin = 'https://rakeezx.com', init, blocked = false, viewport } = {}) {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: 'block', viewport });
  const events = [], errors = [];
  await context.route('https://*.supabase.co/**', route => route.abort());
  await context.route(origin + '/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: local + url.pathname + url.search });
    await route.fulfill({ response });
  });
  await context.addCookies([{ name: 'synthetic-private-cookie', value: 'private', url: 'https://cloud.umami.is' }]);
  await context.route(MARKETING_COLLECTOR, async route => {
    const request = route.request();
    events.push({ body: request.postDataJSON(), headers: await request.allHeaders() });
    if (blocked) return route.abort('blockedbyclient');
    return route.fulfill({ json: { synthetic: true }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await context.addInitScript(() => {
    const nativeFetch = window.fetch;
    window.__n99Dispatch = [];
    window.fetch = function(url, options) {
      if (url === 'https://cloud.umami.is/api/send') window.__n99Dispatch.push({
        name: JSON.parse(options.body).payload.name, credentials: options.credentials,
        referrerPolicy: options.referrerPolicy,
        landing: !!document.querySelector('.n37-landing'), layout: !!document.querySelector('.layout'),
      });
      return nativeFetch.call(this, url, options);
    };
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  return { context, page, events, errors, origin };
}
const settle = page => page.waitForTimeout(200);
const gate = async page => { await page.locator('[data-workspace-demo]').waitFor(); await settle(page); };
const exact = name => ({ type: 'event', payload: { website: 'a0f3bd66-07fc-4082-956d-70c17ff621c5',
  hostname: 'rakeezx.com', url: '/', title: 'رَكيز المعلم', name } });

test('n99_public_integration: painted public landing, successful ordinary Demo, reload dedupe and internal privacy', async () => {
  const f = await fixture();
  try {
    await f.page.goto('/?email=private@example.test&utm_campaign=student-secret'); await gate(f.page);
    assert.deepEqual(f.events.map(e => e.body), [exact('landing_view')]);
    assert.deepEqual(await f.page.evaluate(() => window.__n99Dispatch), [{ name: 'landing_view',
      credentials: 'omit', referrerPolicy: 'no-referrer', landing: true, layout: false }]);
    for (const e of f.events) { assert.equal(e.headers.referer, undefined); assert.equal(e.headers.cookie, undefined); }
    assert.match(await f.page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'), /connect-src 'self'.*https:\/\/cloud\.umami\.is$/);
    await f.page.locator('[data-marketing-privacy] summary').click();
    assert.match(await f.page.locator('[data-marketing-privacy]').innerText(), /IP.*الولايات المتحدة وألمانيا/);
    assert.equal(await f.page.locator('.n37-message').evaluate(e => getComputedStyle(e).direction), 'rtl');
    await f.page.screenshot({ path: 'tests/n99-landing-desktop.png', fullPage: true });
    await f.page.locator('[data-workspace-demo]').click();
    await f.page.locator('.layout').waitFor(); await settle(f.page);
    assert.deepEqual(f.events.map(e => e.body), [exact('landing_view'), exact('demo_started')]);
    assert.equal((await f.page.evaluate(() => window.__n99Dispatch))[0].layout, true);
    const ready = await openReadyServedDemo(f.page, f.origin);
    assert.equal(ready.ready, true); assert.ok(ready.students > 100);
    for (const route of ['/#/teaching/demo:teaching:1/grades?email=private@example.test', '/#/reports', '/#/support', '/#/settings/backup']) {
      await f.page.goto(route); await f.page.locator('.layout').waitFor();
    }
    await settle(f.page);
    assert.equal(f.events.length, 2);
    assert.equal(await f.page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test('failed ordinary Demo initialization has zero demo event', async () => {
  const f = await fixture({ init: () => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = function(name, ...args) { if (name === 'rakeezx-demo') throw new Error('synthetic Demo storage failure'); return open(name, ...args); };
  } });
  try {
    await f.page.goto('/'); await gate(f.page);
    await f.page.locator('[data-workspace-demo]').click();
    await f.page.locator('.empty--error').waitFor(); await settle(f.page);
    assert.deepEqual(f.events.map(e => e.body), [exact('landing_view')]);
  } finally { await f.context.close(); }
});

test('authenticated account uses existing synthetic helper, zero analytics through account/grades/settings', async () => {
  const f = await fixture();
  try {
    const { errors } = await bootSettings(f.page);
    await settle(f.page); assert.equal(f.events.length, 0); assert.deepEqual(errors, []);
    assert.equal(await f.page.evaluate(async () => (await import('/src/store.js')).getActiveWorkspace().type), 'account');
    await f.page.goto('/#/reports'); await f.page.locator('.layout').waitFor();
    await settle(f.page); assert.equal(f.events.length, 0);
  } finally { await f.context.close(); }
});

test('unknown initial identity sends zero; internal signed-out route sends zero', async () => {
  const f = await fixture({ init: () => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { if (key === 'rakeezx-auth-v2-xl-rubcwjqktzzunrvuns') throw new Error('synthetic unknown auth'); return get.call(this, key); };
  } });
  try { await f.page.goto('/'); await f.page.locator('.empty--error').waitFor(); await settle(f.page); assert.equal(f.events.length, 0); }
  finally { await f.context.close(); }
  const internal = await fixture();
  try { await internal.page.goto('/#/teaching/private-id/grades'); await gate(internal.page); assert.equal(internal.events.length, 0); }
  finally { await internal.context.close(); }
  const malformed = await fixture({ init: () => localStorage.setItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns', '{invalid') });
  try { await malformed.page.goto('/'); await gate(malformed.page); assert.equal(malformed.events.length, 0); }
  finally { await malformed.context.close(); }
});

test('DNT/GPC/Preview/localhost and offline prevent actual browser requests', async () => {
  for (const options of [
    { init: () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }) },
    { init: () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }) },
    { init: () => Object.defineProperty(navigator, 'onLine', { get: () => false }) },
    { origin: 'https://synthetic.rakeezx.pages.dev' }, { origin: local },
  ]) {
    const f = await fixture(options);
    try {
      await f.page.goto('/'); await gate(f.page);
      await f.page.locator('[data-workspace-demo]').click(); await f.page.locator('.layout').waitFor();
      await settle(f.page); assert.equal(f.events.length, 0); assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  }
});

test('blocked collector leaves Demo/login operational, pending send aborted on account entry', async () => {
  const f = await fixture({ blocked: true, viewport: { width: 390, height: 844 } });
  try {
    await f.page.goto('/'); await gate(f.page);
    await f.page.locator('[data-marketing-privacy] summary').click();
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await f.page.screenshot({ path: 'tests/n99-landing-mobile.png', fullPage: true });
    await f.page.locator('[data-workspace-demo]').click(); await f.page.locator('.layout').waitFor(); await settle(f.page);
    assert.deepEqual(f.events.map(e => e.body), [exact('landing_view'), exact('demo_started')]);
    assert.equal(await f.page.locator('#toast').innerText(), ''); assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
  const login = await fixture({ init: () => {
    const native = fetch;
    window.__n99Aborted = false;
    window.fetch = function(url, options) {
      if (url === 'https://cloud.umami.is/api/send') {
        options.signal.addEventListener('abort', () => { window.__n99Aborted = true; });
        return new Promise(() => {});
      }
      return native.call(this, url, options);
    };
  } });
  try {
    await login.page.goto('/'); await gate(login.page);
    await login.page.locator('[data-workspace-login]').click();
    await login.page.locator('#n56-email').waitFor();
    assert.equal(await login.page.evaluate(() => window.__n99Aborted), true);
    await login.page.locator('[data-n56-back]').click(); await settle(login.page);
    assert.equal(login.events.length, 0); assert.equal(await login.page.locator('#toast').innerText(), '');
  } finally { await login.context.close(); }
});
