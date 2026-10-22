import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { startHost } from './host.mjs';
import { bootSynthetic } from './fixture.mjs';

const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n72-webkit-sheet-date-20261022.json';
const task = JSON.parse(await readFile(taskFile, 'utf8'));
const runId = task.attempt.runId;
const { expect } = createRequire(import.meta.url)('@playwright/test');
const label = process.env.N72_LABEL || 'baseline';
const scenarios = [
  { name: 'mobile-390', viewport: { width: 390, height: 740 } },
  { name: 'short-sheet', viewport: { width: 320, height: 420 }, compressed: { height: 230, top: 35 } },
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
].filter(s => !process.env.N72_SCENARIO || s.name === process.env.N72_SCENARIO);
assert(scenarios.length, 'Unknown scenario');
const host = await startHost({ port: 43172 });
try {
  for (const scenario of scenarios) {
    // Each affected check owns a fresh bounded phase; no live/shared browser lease.
    await withIsolatedLocalBrowser({ taskFile, runId, url: host.origin, engine: 'webkit', timeoutMs: 90000 }, async ({ createContext }) => {
      const context = await createContext({ viewport: scenario.viewport, locale: 'ar-SA', hasTouch: scenario.name !== 'desktop' });
      const result = { runId, engine: 'webkit', scenario, label, status: 'FAIL' };
      try {
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        result.boot = await bootSynthetic(page, host.origin);
        assert.equal(result.boot.workspace.type, 'demo');
        assert.equal(result.boot.workspace.syncEligible, false);
        assert.equal(result.boot.database, 'rakeezx-demo');
        assert.equal(result.boot.outboxCount, 0);
        const termsBefore = await page.evaluate(async () => (await import('/src/lib/db.js')).getAll('terms'));
        await page.evaluate(() => { location.hash = '#/calendar'; });
        const opener = page.locator('[data-act="open-settings"]');
        await expect(opener).toBeVisible();
        result.route = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, navigationEntries: performance.getEntriesByType('navigation').length, hash: location.hash }));
        assert.equal(result.route.timeOrigin, result.boot.timeOrigin);
        assert.equal(result.route.navigationEntries, result.boot.navigationEntries);
        await opener.focus(); await opener.press('Enter');
        const settings = page.locator('.sheet-backdrop').last().locator('.sheet');
        await settings.locator('[data-settings-tab="terms"]').click();
        const termOpener = settings.locator('[data-act="edit-term-in-settings"]').first();
        await termOpener.focus(); await termOpener.press('Enter');
        const sheet = page.locator('.sheet-backdrop').last().locator('.sheet');
        const input = sheet.locator('#term-dates [name="startDate"]');
        await expect(input).toHaveAttribute('data-rakeez-date-scope', 'planning');
        const original = await input.inputValue();
        await input.focus();
        if (scenario.compressed) {
          await page.evaluate(({ height, top }) => {
            Object.defineProperties(visualViewport, { height: { configurable: true, value: height }, offsetTop: { configurable: true, value: top }, scale: { configurable: true, value: 1 } });
            visualViewport.dispatchEvent(new Event('resize'));
          }, scenario.compressed);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
        await input.click();
        const picker = page.locator('.flatpickr-calendar.open');
        await expect(picker).toBeVisible();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        result.metrics = await page.evaluate(() => {
          const input = document.querySelector('#term-dates [name="startDate"]');
          const picker = document.querySelector('.flatpickr-calendar.open');
          const box = el => { const r = el.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
          const rect = box(picker), viewport = { width:innerWidth, height:visualViewport.height, top:visualViewport.offsetTop };
          return { viewport, picker:rect, input:box(input), sheet:box(input.closest('.sheet')),
            pickerReachable:rect.left >= 0 && rect.right <= innerWidth && rect.top >= viewport.top && rect.bottom <= viewport.top + viewport.height,
            focus:document.activeElement === input, value:input.value, rtl:document.documentElement.dir,
            bounds:{min:input._flatpickr.formatDate(input._flatpickr.config.minDate,'Y-m-d'),max:input._flatpickr.formatDate(input._flatpickr.config.maxDate,'Y-m-d')},
            constrained:picker.classList.contains('rakeez-datetime-viewport'),
            digits:[...picker.querySelectorAll('.flatpickr-day')].every(day=>/^[0-9]+$/.test(day.textContent.trim())) };
        });
        await page.screenshot({ path: new URL(`./${scenario.name}-${label}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),
          clip:{x:0,y:scenario.compressed?.top ?? 0,width:scenario.viewport.width,height:scenario.compressed?.height ?? scenario.viewport.height} });
        assert.equal(result.metrics.pickerReachable, true, 'Date picker extends outside visible viewport');
        assert.equal(result.metrics.focus, true, 'Date input lost focus');
        assert.equal(result.metrics.rtl, 'rtl');
        assert.equal(result.metrics.digits, true);
        if (scenario.compressed) {
          const last = picker.locator('.flatpickr-day:not(.flatpickr-disabled)').last();
          await last.scrollIntoViewIfNeeded();
          result.lastDayReachable = await last.evaluate(el => {
            const r=el.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2) === el;
          });
          assert.equal(result.lastDayReachable,true);
          await picker.evaluate(el=>{el.scrollTop=0;el.scrollLeft=0;});
          const year = picker.locator('.rakeez-year-select');
          result.yearReachable = await year.evaluate(el=>{
            const r=el.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2) === el;
          });
          assert.equal(result.yearReachable,true);
          result.viewportRecovery = [];
          for (const next of [{height:260,top:0},{height:420,top:0}]) {
            await page.evaluate(({height,top})=>{
              Object.defineProperties(visualViewport,{height:{configurable:true,value:height},offsetTop:{configurable:true,value:top}});
              visualViewport.dispatchEvent(new Event('resize'));
              visualViewport.dispatchEvent(new Event('scroll'));
            },next);
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
            const restored = await picker.evaluate(el=>{
              const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,visibleTop:visualViewport.offsetTop,
                visibleBottom:visualViewport.offsetTop+visualViewport.height,focus:document.activeElement.matches('#term-dates [name="startDate"]')};
            });
            assert(restored.top>=restored.visibleTop && restored.bottom<=restored.visibleBottom);
            assert.equal(restored.focus,true);
            result.viewportRecovery.push(restored);
          }
          await page.evaluate(()=>{for(const key of ['height','offsetTop','scale']) delete visualViewport[key];});
          await page.setViewportSize({width:320,height:740});
          await page.waitForTimeout(120); // flatpickr's existing debounced window resize
          result.nativeRecovery = await picker.evaluate(el=>{
            const r=el.getBoundingClientRect();return {constrained:el.classList.contains('rakeez-datetime-viewport'),top:r.top,bottom:r.bottom,height:innerHeight};
          });
          assert.equal(result.nativeRecovery.constrained,false);
          assert(result.nativeRecovery.top>=0 && result.nativeRecovery.bottom<=result.nativeRecovery.height);
        }
        await sheet.locator('.sheet__head').click();
        await expect(picker).toBeHidden();
        await expect(input).toBeVisible();
        await input.focus(); await expect(input).toBeFocused();
        await expect(input).toHaveValue(original);
        // Focusing is flatpickr's documented open trigger. Dismiss the popup
        // again before asking the surrounding sheet's Cancel button to receive a click.
        await sheet.locator('.sheet__head').click();
        await expect(picker).toBeHidden();
        await sheet.locator('.sheet__foot [data-sheet-close]').click();
        const returned = page.locator('.sheet-backdrop').last().locator('.sheet');
        await expect(returned.locator('[data-settings-tab="terms"]')).toBeVisible();
        await returned.locator('.sheet__head [data-sheet-close]').click();
        await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
        await expect(opener).toBeFocused();
        result.after = await page.evaluate(async () => {
          const [store,db] = await Promise.all([import('/src/store.js'),import('/src/lib/db.js')]);
          return { ready:store.state.ready, workspace:store.getActiveWorkspace().type,
            outboxCount:(await db.getAll('outbox')).length, terms:await db.getAll('terms') };
        });
        assert.equal(result.after.outboxCount, 0); assert.equal(result.after.ready, true);
        assert.equal(result.after.workspace, 'demo');
        assert.deepEqual(result.after.terms, termsBefore);
        assert.deepEqual(errors, []);
        result.status = 'PASS';
      } catch (error) { result.error = String(error); throw error; }
      finally {
        await writeFile(new URL(`./${scenario.name}-${label}.json`, import.meta.url), JSON.stringify(result,null,2)+'\n');
        console.log(JSON.stringify(result));
        await context.close();
      }
    });
  }
} finally { await host.close(); }
