import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { A1_RASTERS, A1_VECTORS } from './helpers/a1-production-assets.mjs';

test('native v18 to v19 Brand cache refresh preserves IndexedDB and unrelated caches', async ({ browser }) => {
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  let generation = 18;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const send = (body, type) => response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    if (pathname === '/' || pathname === '/index.html') return send('<!doctype html><title>Brand cache fixture</title><main>synthetic cache verification</main>', 'text/html');
    if (pathname === '/sw.js') return send(worker.replace("const VERSION = 'rakeezx-v19';", `const VERSION = 'rakeezx-v${generation}';`), 'text/javascript');
    if (pathname.startsWith('/assets/')) {
      const name = pathname.slice('/assets/'.length);
      if (![...A1_RASTERS, ...A1_VECTORS].some(([file]) => file === name)) return response.writeHead(404).end();
      if (generation === 18) return send('previous-release', name.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
      return send(await readFile(new URL(`../assets/${name}`, import.meta.url)), name.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
    }
    response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      await caches.open('unrelated-cache').then(cache => cache.put('/keep', new Response('keep')));
      await new Promise((resolve, reject) => { const request = indexedDB.open('brand-synthetic-retention', 1); request.onupgradeneeded = () => request.result.createObjectStore('records'); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put('retain', 'synthetic'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    expect(await page.evaluate(async () => (await (await (await caches.open('rakeezx-v18')).match('/assets/icon-192.png')).text()))).toBe('previous-release');
    generation = 19;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => page.evaluate(async () => { const keys = await caches.keys(); return keys.includes('rakeezx-v19') && !keys.includes('rakeezx-v18'); })).toBe(true);
    await context.setOffline(true);
    for (const [file,,,sha256] of [...A1_RASTERS, ...A1_VECTORS]) {
      expect(await page.evaluate(async file => { const bytes = await (await fetch(`/assets/${file}`)).arrayBuffer(); return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join(''); }, file)).toBe(sha256);
    }
    await page.reload();
    expect(await page.evaluate(async () => (await (await (await caches.open('unrelated-cache')).match('/keep')).text()))).toBe('keep');
    expect(await page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.open('brand-synthetic-retention', 1); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, get = db.transaction('records').objectStore('records').get('synthetic'); get.onsuccess = () => { db.close(); resolve(get.result); }; get.onerror = () => reject(get.error); }; }))).toBe('retain');
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});
