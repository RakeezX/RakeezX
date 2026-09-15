import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerSource = await readFile(path.join(ROOT, 'sw.js'), 'utf8');
const currentGeneration = Number(workerSource.match(/const VERSION = 'rakeezx-v(\d+)'/)?.[1]);

if (!Number.isInteger(currentGeneration) || currentGeneration < 2) {
  throw new Error('Unable to derive the current RAKEEZ service-worker generation');
}

const versions = {
  A: `rakeezx-v${currentGeneration - 1}`,
  B: `rakeezx-v${currentGeneration}`,
};

const versionedShell = `const SHELL = [
  './',
  './index.html',
  './app.js',
  './app.css',
  './lazy.js',
  './install-gate.js',
];`;

async function startVersionedServer() {
  let release = 'A';
  let installGateOpen = true;
  let closed = false;
  const gatedResponses = new Set();
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const send = (body, type) => response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    if (pathname === '/versioned/') {
      return send('<!doctype html><link rel="stylesheet" href="app.css"><main id="release"></main><output id="lazy"></output><script type="module" src="app.js"></script>', 'text/html');
    }
    if (pathname === '/versioned/index.html') {
      response.writeHead(308, { Location: '/versioned/', 'Cache-Control': 'no-store' });
      return response.end();
    }
    if (pathname === '/versioned/app.js') {
      return send(`
        window.__release = '${release}';
        document.getElementById('release').textContent = window.__release;
        const renderRoute = async () => {
          if (location.hash === '#/lazy') {
            const { lazyRelease } = await import('./lazy.js');
            document.getElementById('lazy').textContent = lazyRelease;
          }
        };
        addEventListener('hashchange', renderRoute);
        renderRoute();
        navigator.serviceWorker.register('/versioned/sw.js', { updateViaCache: 'none' });
      `, 'text/javascript');
    }
    if (pathname === '/versioned/app.css') return send(`:root { --release: '${release}'; }`, 'text/css');
    if (pathname === '/versioned/lazy.js') return send(`export const lazyRelease = 'lazy-${release}';`, 'text/javascript');
    if (pathname === '/versioned/install-gate.js') {
      if (release === 'B' && !installGateOpen) {
        gatedResponses.add(response);
        response.on('close', () => gatedResponses.delete(response));
        return;
      }
      return send(`export const installGate = '${release}';`, 'text/javascript');
    }
    if (pathname === '/versioned/sw.js') {
      const source = workerSource
        .replace(/const VERSION = 'rakeezx-v\d+';/, `const VERSION = '${versions[release]}';`)
        .replace(/const SHELL = \[[\s\S]*?\n\];/, versionedShell);
      return send(source, 'text/javascript');
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const releaseInstall = () => {
    installGateOpen = true;
    for (const response of gatedResponses) {
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      response.end("export const installGate = 'B';");
    }
    gatedResponses.clear();
  };

  const close = async () => {
    if (closed) return;
    closed = true;
    for (const response of gatedResponses) response.destroy();
    gatedResponses.clear();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  };

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    deploy(nextRelease) {
      release = nextRelease;
      installGateOpen = nextRelease !== 'B';
    },
    releaseInstall,
    close,
  };
}

test('Version A to Version B preserves the new shell during install and supports offline reload/reopen', async ({ browser }) => {
  test.setTimeout(90_000);
  const deployment = await startVersionedServer();
  const context = await browser.newContext();
  let page = await context.newPage();
  try {
    await page.goto(`${deployment.url}/versioned/`);
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await expect(page.locator('#release')).toHaveText('A');
    await expect.poll(() => page.evaluate(async () => ({
      controlled: Boolean(navigator.serviceWorker.controller),
      active: (await navigator.serviceWorker.getRegistration())?.active?.state,
      caches: await caches.keys(),
    }))).toMatchObject({ controlled: true, active: 'activated', caches: expect.arrayContaining([versions.A]) });

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
    await page.evaluate(() => {
      navigator.serviceWorker.getRegistration().then((registration) => registration.update());
    });
    await page.waitForFunction(async (nextVersion) => {
      const [registration, keys] = await Promise.all([
        navigator.serviceWorker.getRegistration(),
        caches.keys(),
      ]);
      return Boolean(registration?.installing && keys.includes(nextVersion));
    }, versions.B);

    // A still controls this fetch while B is installing. A must not delete the
    // newer generation's partially populated cache.
    await page.evaluate(() => fetch('/versioned/app.js?upgrade-race=1').then((response) => response.text()));
    expect(await page.evaluate(() => caches.keys())).toContain(versions.B);

    deployment.releaseInstall();
    await page.waitForFunction(async ({ nextVersion, priorVersion }) => {
      const keys = await caches.keys();
      const registration = await navigator.serviceWorker.getRegistration();
      return keys.includes(nextVersion)
        && !keys.includes(priorVersion)
        && registration?.active?.state === 'activated'
        && navigator.serviceWorker.controller === registration.active;
    }, { nextVersion: versions.B, priorVersion: versions.A });

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
        && onlineAssets.caches.includes(versions.B)
        && !onlineAssets.caches.includes(versions.A)
        && onlineAssets.teacher?.id === 'teacher-data';
    }, { timeout: 10_000 }).toBe(true);
    expect(onlineAssets.teacher).toMatchObject({ id: 'teacher-data', name: 'TEST Teacher Data' });

    await page.evaluate(() => { location.hash = '#/lazy'; });
    await deployment.close();
    await context.setOffline(true);

    const reloadResponse = await page.reload();
    expect(reloadResponse?.status()).toBe(200);
    expect(reloadResponse?.fromServiceWorker()).toBe(true);
    await expect(page.locator('#release')).toHaveText('B');
    await expect(page.locator('#lazy')).toHaveText('lazy-B');

    await page.close();
    page = await context.newPage();
    const reopenResponse = await page.goto(`${deployment.url}/versioned/#/lazy`);
    expect(reopenResponse?.status()).toBe(200);
    expect(reopenResponse?.fromServiceWorker()).toBe(true);
    await expect(page.locator('#release')).toHaveText('B');
    await expect(page.locator('#lazy')).toHaveText('lazy-B');
  } finally {
    deployment.releaseInstall();
    await context.close();
    await deployment.close();
  }
});
