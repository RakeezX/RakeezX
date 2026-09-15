import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const workerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const currentCache = workerSource.match(/const VERSION = '([^']+)'/)?.[1];
if (!currentCache) throw new Error('Service Worker cache version is missing.');

test.describe('PWA and Service Worker', () => {
  // Ensure we can see console errors
  let errors = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`);
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
  });

  test('Offline App Shell and Cache Versioning', async ({ context, page }) => {
    // A. INITIAL ONLINE LOAD
    await page.goto('/');

    // Wait for service worker to register and become active
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;
      return reg.active && reg.active.state === 'activated';
    }, { timeout: 15000 });

    // C. CACHE VERSIONING — activation can precede the install cache becoming
    // observable when another service-worker test just released its context.
    // Wait for the final lifecycle invariant, not a one-time cache snapshot.
    let cacheKeys = [];
    await expect.poll(async () => {
      cacheKeys = await page.evaluate(async () => await caches.keys());
      return cacheKeys.includes(currentCache)
        && !cacheKeys.some((key) => key.startsWith('rakeezx-') && key !== currentCache);
    }, { timeout: 15_000 }).toBe(true);
    console.log("Caches found:", cacheKeys);

    // Check no unexpected caches after the service-worker lifecycle settles.
    const oldCaches = cacheKeys.filter(k => k.startsWith('rakeezx-') && k !== currentCache);
    expect(oldCaches.length).toBe(0);
    // B. CONTROLLED RELOAD
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 5000 });

    // D. OFFLINE APP SHELL
    await context.setOffline(true);
    
    // We should be able to reload the app shell when offline
    let failed = false;
    try {
      await page.reload();
    } catch (e) {
      failed = true;
      console.log("Offline reload failed:", e);
    }
    
    expect(failed).toBeFalsy();
    
    // Shell should be visible
    await expect(page.locator('.boot__mark').or(page.locator('.sidebar__brand'))).toBeVisible();

    // E. ONLINE RECOVERY
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('.boot__mark').or(page.locator('.sidebar__brand'))).toBeVisible();

    // G. ERR_FAILED REGRESSION
    // If the SW was doing something bad, we would see page errors
    // Filter out expected errors if any
    const realErrors = errors.filter(e => !e.includes('favicon.ico') && !e.includes('vite'));
    const hasErrFailed = realErrors.some(e => e.includes('ERR_FAILED'));
    if (hasErrFailed) {
      console.error("Caught ERR_FAILED console errors:", realErrors);
    }
    expect(hasErrFailed).toBeFalsy();
    // We do not strict assert empty because vite dev server might log some WebSocket disconnects offline
  });
});
