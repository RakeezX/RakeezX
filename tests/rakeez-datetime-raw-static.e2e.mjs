import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const workerSource = await readFile(resolve(root, 'sw.js'), 'utf8');
const cacheName = workerSource.match(/const VERSION = '(rakeezx-v\d+)'/)?.[1];
if (!cacheName) throw new Error('Unable to read service worker cache version');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let server;
let origin;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      const body = await readFile(target);
      const extension = target.slice(target.lastIndexOf('.'));
      response.writeHead(200, { 'Content-Type': `${mime[extension] || 'application/octet-stream'}; charset=utf-8` }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
});

test('Calendar and Times boot from unbuilt repository files with local date/time assets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin);
  await page.getByRole('button', { name: 'جرّب ركيز المعلم' }).click();
  await expect(page.locator('.sidebar__brand')).toBeVisible();
  for (const [route, kind] of [['calendar', 'date'], ['schedule/times', 'time']]) {
    await page.goto(`${origin}/#/${route}`);
    await expect(page.locator('.sidebar__brand')).toBeVisible();
    await expect.poll(() => page.evaluate(() => typeof window.flatpickr)).toBe('function');
    expect(await page.evaluate(() => window.flatpickr.l10ns.ar.weekdays.longhand[0])).toBe('الأحد');
    await page.evaluate((controlKind) => {
      const input = document.createElement('input');
      input.dataset.rakeezDatetime = controlKind;
      input.id = 'raw-static-picker-smoke';
      document.body.append(input);
    }, kind);
    await expect(page.locator('#raw-static-picker-smoke')).toHaveClass(/rakeez-datetime/);
    await expect.poll(() => page.locator('.flatpickr-calendar').count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.locator('#raw-static-picker-smoke').evaluate((input) => input.remove());
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return Promise.all(['flatpickr.min.js', 'ar.js', 'flatpickr.min.css'].map((file) =>
      cache.match(`/src/vendor/flatpickr/${file}`).then(Boolean)));
  }, cacheName)).toEqual([true, true, true]);
  await page.context().setOffline(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.flatpickr)).toBe('function');
  expect(errors.filter((message) => !message.includes('Failed to load resource: the server responded with a status of 504'))).toEqual([]);
});
