import { test, expect } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORES } from '../src/lib/db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTH_STORAGE_KEY = 'rakeezx-auth-v2-xl-rubcwjqktzzunrvuns';
const THEME_STORAGE_KEY = 'rakeezx-theme';
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

const collectErrors = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};

async function provisionUnclaimedLegacyWorkspace(page) {
  await page.evaluate(async (stores) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('rakeezx', 7);
      request.onupgradeneeded = () => {
        for (const store of stores) {
          if (!request.result.objectStoreNames.contains(store)) {
            request.result.createObjectStore(store, { keyPath: 'id' });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
  }, STORES);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.topbar__title')).toContainText('الرئيسية');
}

test('a suspended expired-session refresh cannot keep the startup Splash mounted', async ({ browser }) => {
  const host = await startStaticServer();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: 'expired-synthetic-access',
      refresh_token: 'suspended-synthetic-refresh',
      expires_at: 1,
      user: { id: '00000000-0000-4000-8000-000000000152' },
    }));
  }, { key: AUTH_STORAGE_KEY });
  const page = await context.newPage();
  const errors = collectErrors(page);
  let releaseRefresh;
  await page.route('**/auth/v1/token?grant_type=refresh_token', async (route) => {
    await new Promise((resolve) => { releaseRefresh = resolve; });
    await route.abort().catch(() => {});
  });

  try {
    await page.goto(`${host.url}/#/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-initial-restore-state="RESTORE_PREFLIGHT"]')).toBeVisible({ timeout: 4_000 });
    await expect(page.locator('.boot')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    releaseRefresh?.();
    await context.close();
    await host.close();
  }
});

test('resume lifecycle primitives never re-mount Splash or duplicate startup listeners', async ({ browser }) => {
  const host = await startStaticServer();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    window.__rakeezBootProbe = { idbOpen: 0, window: {}, document: {} };
    indexedDB.open = (...args) => {
      window.__rakeezBootProbe.idbOpen += 1;
      return originalOpen(...args);
    };
    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const target = this === window ? 'window' : this === document ? 'document' : null;
      if (target && ['pageshow', 'pagehide', 'visibilitychange', 'online', 'offline'].includes(type)) {
        const counts = window.__rakeezBootProbe[target];
        counts[type] = (counts[type] ?? 0) + 1;
      }
      return originalAdd.call(this, type, listener, options);
    };
  });
  const page = await context.newPage();
  const errors = collectErrors(page);

  try {
    await page.goto(`${host.url}/#/`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-workspace-gate]')).toHaveAttribute('data-workspace-reason', 'workspace-not-provisioned');
    const initial = await page.evaluate(() => structuredClone(window.__rakeezBootProbe));

    for (let cycle = 0; cycle < 4; cycle += 1) {
      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.locator('.boot')).toHaveCount(0);
      await expect(page.locator('[data-workspace-gate]')).toHaveAttribute('data-workspace-reason', 'workspace-not-provisioned');
    }

    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.boot')).toHaveCount(0);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    const final = await page.evaluate(() => structuredClone(window.__rakeezBootProbe));
    expect(final.idbOpen).toBe(initial.idbOpen);
    expect(final.window).toEqual(initial.window);
    expect(final.document).toEqual(initial.document);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await host.close();
  }
});

async function inspectFirstPaint(browser, { savedTheme, colorScheme }) {
  const host = await startStaticServer();
  const context = await browser.newContext({ colorScheme, serviceWorkers: 'block' });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: THEME_STORAGE_KEY,
    value: savedTheme,
  });
  const page = await context.newPage();
  let releaseApp;
  await page.route('**/src/app.js', async (route) => {
    await new Promise((resolve) => { releaseApp = resolve; });
    await route.continue().catch(() => {});
  });

  try {
    await page.goto(`${host.url}/#/`, { waitUntil: 'commit' });
    await page.locator('.boot').waitFor({ state: 'visible' });
    return await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      background: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      ready: Boolean(window.store?.state?.ready),
    }));
  } finally {
    releaseApp?.();
    await context.close();
    await host.close();
  }
}

test('saved Light and Dark are applied before the application module can bootstrap', async ({ browser }) => {
  const light = await inspectFirstPaint(browser, { savedTheme: 'light', colorScheme: 'dark' });
  expect(light).toEqual({ theme: 'light', background: '#f4f7f5', ready: false });

  const dark = await inspectFirstPaint(browser, { savedTheme: 'dark', colorScheme: 'light' });
  expect(dark).toEqual({ theme: 'dark', background: '#0d1511', ready: false });

  const automatic = await inspectFirstPaint(browser, { savedTheme: 'auto', colorScheme: 'dark' });
  expect(automatic).toEqual({ theme: null, background: '#0d1511', ready: false });
});

test('canonical theme changes update the early-paint mirror and survive reload', async ({ browser }) => {
  const host = await startStaticServer();
  const context = await browser.newContext({ colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = collectErrors(page);

  try {
    await page.goto(`${host.url}/#/`, { waitUntil: 'networkidle' });
    await provisionUnclaimedLegacyWorkspace(page);
    await page.evaluate(async () => {
      const store = await import('/src/store.js');
      await store.patchDevice({ theme: 'light' });
      store.applyTheme();
    });
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe('light');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.boot')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await host.close();
  }
});

test('saved Light remains the first practical frame on an offline service-worker reload', async ({ browser }) => {
  const host = await startStaticServer();
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  const errors = collectErrors(page);

  try {
    await page.goto(`${host.url}/#/`, { waitUntil: 'networkidle' });
    await provisionUnclaimedLegacyWorkspace(page);
    await page.evaluate(async () => {
      const store = await import('/src/store.js');
      await store.patchDevice({ theme: 'light' });
      store.applyTheme();
    });
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated');
    if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: 'networkidle' });
    }
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'commit' });
    await page.locator('.boot, .topbar__title').first().waitFor({ state: 'visible' });
    expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
    await expect(page.locator('.boot')).toHaveCount(0);
    await expect(page.locator('.topbar__title')).toContainText('الرئيسية');
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
    await host.close();
  }
});
