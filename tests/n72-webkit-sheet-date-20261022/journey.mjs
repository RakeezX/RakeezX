import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n72-webkit-sheet-date-20261022.json';
const task = JSON.parse(await readFile(taskFile, 'utf8'));
const runId = task.attempt.runId;
const engine = process.env.N72_ENGINE || 'webkit';
const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const origin = 'http://127.0.0.1:43172';
const vite = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', '43172', '--strictPort'], {
  cwd: root, stdio: 'ignore', windowsHide: true,
});

async function waitForVite() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Owned Vite exited before readiness (${vite.exitCode})`);
    try { if ((await fetch(origin)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Owned Vite did not become ready on port 43172');
}

try {
  await waitForVite();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, engine, timeoutMs: 90000 }, async ({ createContext }) => {
    const require = createRequire(new URL('../../package.json', import.meta.url));
    const { expect } = require('@playwright/test');
    const results = [];
    for (const scenario of [
      { name: 'mobile-390', viewport: { width: 390, height: 740 }, compressed: null },
      { name: 'short-sheet-simulated-viewport', viewport: { width: 320, height: 420 }, compressed: { height: 230, top: 0 } },
      { name: 'desktop', viewport: { width: 1280, height: 900 }, compressed: null },
    ]) {
      const context = await createContext({ viewport: scenario.viewport, locale: 'ar-SA', hasTouch: true });
      try {
        await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await page.waitForTimeout(1800);
        try {
          await page.waitForFunction(async () => {
            const store = await import('/src/store.js');
            return store.state.ready === true && store.getActiveWorkspace()?.type === 'demo' && store.teachings().length > 0 && !!document.querySelector('.layout');
          }, null, { timeout: 15000 });
        } catch {
          const stage = await page.evaluate(async () => {
            const store = await import('/src/store.js');
            return { body: document.body.innerText, routing: window.__workspaceRouting ?? null,
              demoRequest: sessionStorage.getItem('rakeezx-demo-session-v1'), ready: store.state.ready,
              workspace: store.getActiveWorkspace()?.type ?? null, teachingCount: store.teachings().length,
              databaseNames: (await indexedDB.databases()).map(db => db.name) };
          });
          throw new Error(`App startup stage did not resolve: ${JSON.stringify({ errors, stage })}`);
        }
        await page.evaluate(() => { location.hash = '#/calendar'; });
        try { await page.waitForSelector('[data-act="open-settings"]', { timeout: 10000 }); }
        catch {
          throw new Error(`Calendar route state: ${JSON.stringify(await page.evaluate(() => ({ hash: location.hash, title: document.querySelector('h1')?.innerText, body: document.body.innerText.slice(0, 1200), routing: window.__workspaceRouting ?? null })))}`);
        }
        const settingsOpener = page.locator('[data-act="open-settings"]');
        await settingsOpener.click();
        const settingsSheet = page.locator('.sheet-backdrop').last().locator('.sheet');
        await settingsSheet.locator('[data-settings-tab="terms"]').click();
        const termOpener = settingsSheet.locator('[data-act="edit-term-in-settings"]').first();
        await expect(termOpener).toBeVisible();
        await termOpener.click();
        const sheet = page.locator('.sheet-backdrop').last().locator('.sheet');
        const input = sheet.locator('#term-dates [name="startDate"]');
        await expect(input).toHaveAttribute('data-rakeez-date-scope', 'planning');
        await input.focus();
        const originalValue = await input.inputValue();
        if (scenario.compressed) {
          await page.evaluate(({ height, top }) => {
            Object.defineProperties(visualViewport, { height: { configurable: true, value: height }, offsetTop: { configurable: true, value: top }, scale: { configurable: true, value: 1 } });
            visualViewport.dispatchEvent(new Event('resize'));
          }, scenario.compressed);
          await page.waitForTimeout(80);
        }
        await input.click();
        const picker = page.locator('.flatpickr-calendar.open');
        await expect(picker).toBeVisible();
        const metrics = await page.evaluate(() => {
          const input = document.querySelector('#term-dates [name="startDate"]');
          const picker = document.querySelector('.flatpickr-calendar.open');
          const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const viewport = { width: innerWidth, height: visualViewport.height, top: visualViewport.offsetTop };
          const popup = box(picker);
          return { viewport, input: box(input), sheet: box(input.closest('.sheet')), picker: popup, pickerReachable: popup.left >= 0 && popup.right <= innerWidth && popup.top >= viewport.top && popup.bottom <= viewport.top + viewport.height, rtl: document.documentElement.dir, inputValue: input.value, focus: document.activeElement === input, pickerPosition: getComputedStyle(picker).position };
        });
        results.push({ scenario: scenario.name, simulatedCompression: Boolean(scenario.compressed), metrics });
        await sheet.locator('.sheet__head').click();
        await expect(picker).toBeHidden();
        await expect(input).toBeVisible();
        await input.focus();
        await expect(input).toBeFocused();
        await expect(input).toHaveValue(originalValue);
        expect(metrics.pickerReachable).toBe(true);
        await sheet.locator('[data-sheet-close]').click();
        const returnedSettings = page.locator('.sheet-backdrop').last().locator('.sheet');
        await expect(returnedSettings.locator('[data-settings-tab="terms"]')).toBeVisible();
        await returnedSettings.locator('[data-sheet-close]').click();
        await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
        await expect(settingsOpener).toBeFocused();
        expect(errors).toEqual([]);
        await mkdir(evidenceDir, { recursive: true });
        await page.screenshot({ path: path.join(evidenceDir, `${scenario.name}.png`), fullPage: true });
      } finally { await context.close(); }
    }
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  });
} finally {
  if (vite.exitCode === null) {
    vite.kill();
    await new Promise(resolve => vite.once('exit', resolve));
  }
}
