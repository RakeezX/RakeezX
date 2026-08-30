import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerSource = await readFile(path.join(ROOT, 'sw.js'), 'utf8');

async function startVersionedServer() {
  let release = 'A';
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const send = (body, type) => response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    if (pathname === '/versioned/' || pathname === '/versioned/index.html') {
      return send(`<!doctype html><link rel="stylesheet" href="app.css"><main id="release"></main><script type="module" src="app.js"></script>`, 'text/html');
    }
    if (pathname === '/versioned/app.js') {
      return send(`window.__release = '${release}'; document.getElementById('release').textContent = window.__release; navigator.serviceWorker.register('/versioned/sw.js', { updateViaCache: 'none' }).then((registration) => registration.update());`, 'text/javascript');
    }
    if (pathname === '/versioned/app.css') return send(`:root { --release: '${release}'; }`, 'text/css');
    if (pathname === '/versioned/sw.js') {
      const version = release === 'A' ? 'rakeezx-v4' : 'rakeezx-v5';
      return send(workerSource.replace("const VERSION = 'rakeezx-v5';", `const VERSION = '${version}';`), 'text/javascript');
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    deploy(nextRelease) { release = nextRelease; },
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test('Version A to Version B refreshes executable assets without removing teacher data', async ({ browser }) => {
  test.setTimeout(90_000);
  const deployment = await startVersionedServer();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${deployment.url}/versioned/`);
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await expect(page.locator('#release')).toHaveText('A');

    await page.evaluate(async () => {
      await fetch('/versioned/app.js');
      await fetch('/versioned/app.css');
      await caches.open('unrelated-cache').then((cache) => cache.put('/unrelated', new Response('keep')));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('pwa-update-retention', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('students', { keyPath: 'id' });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('students', 'readwrite');
          tx.objectStore('students').put({ id: 'teacher-data', name: 'TEST Teacher Data' });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      });
    });

    deployment.deploy('B');
    let reloads = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) reloads += 1; });
    await page.reload();
    await expect(page.locator('#release')).toHaveText('B');
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      const registration = await navigator.serviceWorker.getRegistration();
      return keys.includes('rakeezx-v5')
        && !keys.includes('rakeezx-v4')
        && registration?.active?.state === 'activated'
        && navigator.serviceWorker.controller === registration.active;
    });

    let onlineAssets;
    await expect.poll(async () => {
      onlineAssets = await page.evaluate(async () => ({
        js: await (await fetch('/versioned/app.js')).text(),
        css: await (await fetch('/versioned/app.css')).text(),
        caches: await caches.keys(),
        teacher: await new Promise((resolve, reject) => {
          const request = indexedDB.open('pwa-update-retention', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const get = db.transaction('students', 'readonly').objectStore('students').get('teacher-data');
            get.onsuccess = () => { resolve(get.result); db.close(); };
            get.onerror = () => reject(get.error);
          };
        }),
      }));
      return onlineAssets.js.includes("window.__release = 'B'")
        && onlineAssets.css.includes("--release: 'B'")
        && onlineAssets.caches.includes('unrelated-cache')
        && !onlineAssets.caches.includes('rakeezx-v4')
        && onlineAssets.teacher?.id === 'teacher-data';
    }, { timeout: 10_000 }).toBe(true);
    expect(onlineAssets.js).toContain("window.__release = 'B'");
    expect(onlineAssets.css).toContain("--release: 'B'");
    expect(onlineAssets.caches).toContain('unrelated-cache');
    expect(onlineAssets.caches).not.toContain('rakeezx-v4');
    expect(onlineAssets.teacher).toMatchObject({ id: 'teacher-data', name: 'TEST Teacher Data' });
    await page.waitForTimeout(500);
    expect(reloads).toBe(1);

    await context.setOffline(true);
    const offlineAssets = await page.evaluate(async () => ({
      js: await (await fetch('/versioned/app.js')).text(),
      css: await (await fetch('/versioned/app.css')).text(),
    }));
    expect(offlineAssets.js).toContain("window.__release = 'B'");
    expect(offlineAssets.css).toContain("--release: 'B'");
    await page.reload();
    await expect(page.locator('#release')).toHaveText('B');
  } finally {
    await context.close();
    await deployment.close();
  }
});