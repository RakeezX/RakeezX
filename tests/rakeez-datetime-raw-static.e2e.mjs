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

test('date/time adapter imports and mounts from raw repository files offline', async ({ page, request }) => {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (req) => {
    if (new URL(req.url()).origin !== origin) externalRequests.push(req.url());
  });

  const paths = [
    '/src/lib/rakeez-datetime.js',
    '/src/lib/rakeez-datetime-values.js',
    '/src/styles/rakeez-datetime.css',
    '/src/vendor/flatpickr/flatpickr.min.js',
    '/src/vendor/flatpickr/ar.js',
    '/src/vendor/flatpickr/flatpickr.min.css',
  ];
  for (const path of paths) expect((await request.get(`${origin}${path}`)).status(), path).toBe(200);

  await page.goto(`${origin}/tests/fixtures/raw-static-neutral.html`);
  await page.evaluate(async () => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/src/styles/rakeez-datetime.css';
    document.head.append(stylesheet);
    await new Promise((resolve, reject) => {
      stylesheet.addEventListener('load', resolve, { once: true });
      stylesheet.addEventListener('error', reject, { once: true });
    });
    await import('/src/lib/rakeez-datetime.js');
  });
  expect(await page.evaluate(() => typeof globalThis.flatpickr)).toBe('function');
  expect(await page.evaluate(() => Boolean(globalThis.flatpickr.l10ns.ar))).toBe(true);

  await page.evaluate(() => {
    for (const kind of ['date', 'time']) {
      const input = document.createElement('input');
      input.dataset.rakeezDatetime = kind;
      if (kind === 'date') input.dataset.rakeezDateScope = 'planning';
      input.id = `raw-static-${kind}`;
      document.body.append(input);
    }
  });
  for (const kind of ['date', 'time']) {
    const input = page.locator(`#raw-static-${kind}`);
    await expect(input).toHaveClass(new RegExp(`rakeez-datetime--${kind}`));
    expect(await input.evaluate((node) => Boolean(node._flatpickr?.calendarContainer))).toBe(true);
  }
  expect(await page.locator('.flatpickr-calendar').count()).toBe(2);

  await page.locator('#raw-static-date').click();
  const planning = page.locator('.flatpickr-calendar.open').filter({ has: page.locator('.rakeez-year-select') });
  await expect(planning.locator('.rakeez-year-select')).toBeVisible();
  await expect(planning.locator('.rakeez-year-input-hidden')).toBeHidden();
  const year = await page.evaluate(() => new Date().getFullYear());
  expect(await planning.locator('.rakeez-year-select option').allTextContents()).toEqual(
    Array.from({ length: Math.max(0, year + 1 - 2026 + 1) }, (_, index) => String(2026 + index)));
  await page.locator('#raw-static-date').press('Escape');

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'raw-static-historical';
    input.dataset.rakeezDatetime = 'date';
    input.dataset.rakeezDateScope = 'historical';
    document.body.append(input);
  });
  await page.locator('#raw-static-historical').click();
  const historical = page.locator('.flatpickr-calendar.open').filter({ has: page.locator('.rakeez-year-select') });
  expect(await historical.locator('.rakeez-year-select option').allTextContents()).toEqual(
    Array.from({ length: Math.max(0, year - 2026 + 1) }, (_, index) => String(2026 + index)));
  expect(await page.locator('#raw-static-historical').evaluate((input) => input._flatpickr.config.maxDate.toDateString()))
    .toBe(await page.evaluate(() => new Date().toDateString()));

  const timeInput = page.locator('#raw-static-time');
  await timeInput.fill('10:45');
  await timeInput.press('Tab');
  await timeInput.click();
  const timeCalendar = page.locator('.flatpickr-calendar.open').filter({ has: page.locator('.flatpickr-time') });
  await expect(timeCalendar.locator('.flatpickr-am-pm')).toHaveText(/صباحًا|مساءً/);
  const hour = timeCalendar.locator('.flatpickr-hour');
  const separator = timeCalendar.locator('.flatpickr-time-separator');
  const minute = timeCalendar.locator('.flatpickr-minute');
  const amPm = timeCalendar.locator('.flatpickr-am-pm');
  await expect(hour).toHaveValue('10');
  await expect(minute).toHaveValue('45');
  await expect(amPm).toHaveText('صباحًا');
  const [hourBox, separatorBox, minuteBox, amPmBox] = await Promise.all(
    [hour, separator, minute, amPm].map((locator) => locator.boundingBox()));
  expect(minuteBox.x).toBeGreaterThan(separatorBox.x);
  expect(separatorBox.x).toBeGreaterThan(hourBox.x);
  expect(hourBox.x).toBeGreaterThan(amPmBox.x);
  expect(hourBox.x).toBeGreaterThanOrEqual(amPmBox.x + amPmBox.width);
  expect(minuteBox.x).toBeGreaterThanOrEqual(hourBox.x + hourBox.width);
  expect(await hour.inputValue()).toMatch(/^[0-9]{2}$/);
  expect(await minute.inputValue()).toMatch(/^[0-9]{2}$/);
  expect(`${await hour.inputValue()}${await minute.inputValue()}`).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
  await amPm.click();
  await expect(amPm).toHaveText('مساءً');
  await expect(timeInput).toHaveValue('22:45');
  await amPm.click();
  await expect(timeInput).toHaveValue('10:45');
  await timeInput.fill('١٠:٣٠');
  await expect(timeInput).toHaveValue('10:30');

  await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return Promise.all(['/src/vendor/flatpickr/flatpickr.min.js', '/src/vendor/flatpickr/ar.js', '/src/vendor/flatpickr/flatpickr.min.css', '/src/lib/rakeez-datetime.js', '/src/lib/rakeez-datetime-values.js', '/src/styles/rakeez-datetime.css'].map((path) => cache.match(path).then(Boolean)));
  }, cacheName)).toEqual([true, true, true, true, true, true]);
  await page.context().setOffline(true);
  expect(await page.evaluate(async (paths) => Promise.all(paths.map(async (path) => (await fetch(path)).status)), paths)).toEqual(paths.map(() => 200));
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});
