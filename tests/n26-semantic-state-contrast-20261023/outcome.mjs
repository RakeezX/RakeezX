import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const baseline = process.argv.includes('--baseline');
const dir = new URL('./', import.meta.url);
const origin = 'http://127.0.0.1:4187/';
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n26-semantic-state-contrast-20261023.json';
const runId = '996fc5a8-ec58-4d71-837d-064d294d54bb';
const rows = [];
const server = await createServer({ root: process.cwd(), configFile: false, server: { host: '127.0.0.1', port: 4187, strictPort: true }, logLevel: 'error' });
const luminance = color => {
  const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
};
const contrast = ({ foreground, background }) => {
  const a = luminance(foreground), b = luminance(background);
  return +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(3);
};
const measure = locator => locator.evaluate(el => {
  const css = getComputedStyle(el), rect = el.getBoundingClientRect();
  return { foreground: css.color, background: css.backgroundColor, width: rect.width, height: rect.height,
    outline: css.outlineStyle, outlineWidth: css.outlineWidth, pressed: el.getAttribute('aria-pressed'), role: el.getAttribute('role'), live: el.getAttribute('aria-live') };
});
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const state of [
      { name: 'light', theme: 'light', os: 'light', width: 1365 },
      { name: 'explicit-dark', theme: 'dark', os: 'light', width: 1365 },
      { name: 'automatic-dark', theme: 'auto', os: 'dark', width: 1365 },
      { name: 'forced-light-dark-os', theme: 'light', os: 'dark', width: 1365 },
      { name: 'mobile-dark', theme: 'dark', os: 'dark', width: 390 },
    ]) {
      const context = await createContext({ viewport: { width: state.width, height: 844 }, colorScheme: state.os, locale: 'ar-SA' });
      try {
        await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
        const page = await context.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(origin);
        await page.waitForSelector('.app-shell');
        await page.goto(origin + '#/settings');
        await page.locator(`[data-act="theme"][data-theme="${state.theme}"]`).click();
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), state.theme === 'auto' ? null : state.theme);
        const tokens = await page.evaluate(() => {
          const css = getComputedStyle(document.documentElement);
          return Object.fromEntries(['--bg', '--bg-elev', '--text-3', '--brand', '--danger', '--warn', '--info', '--present', '--late', '--absent', '--excused'].map(k => [k, css.getPropertyValue(k).trim()]));
        });
        const items = {};
        for (const kind of ['danger', 'warn', 'info']) {
          await page.evaluate(async kind => (await import('/src/lib/dom.js')).toast('تنبيه اصطناعي لاختبار وضوح الحالة', kind), kind);
          await page.waitForTimeout(220);
          items['toast-' + kind] = await measure(page.locator('#toast'));
          assert.equal(items['toast-' + kind].role, kind === 'danger' ? 'alert' : 'status');
          assert.equal(items['toast-' + kind].live, kind === 'danger' ? 'assertive' : 'polite');
          if (!baseline && state.name === 'explicit-dark') await page.screenshot({ path: new URL('toast-' + kind + '.png', dir).pathname.replace(/^\/(.:)/, '$1') });
        }
        // The real confirmation helper creates and wires the danger action; cancel only.
        await page.evaluate(() => { import('/src/lib/dom.js').then(m => { window.n26Confirm = m.confirmSheet({ title: 'اختبار اصطناعي', danger: true }); }); });
        const danger = page.locator('[data-confirm]');
        await danger.waitFor();
        await danger.hover(); await page.waitForTimeout(220);
        items['danger-hover'] = await measure(danger);
        await danger.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        items['danger-focus'] = await measure(danger);
        if (!baseline && state.name === 'explicit-dark') await page.screenshot({ path: new URL('danger-hover-focus.png', dir).pathname.replace(/^\/(.:)/, '$1') });
        await page.locator('.sheet__foot [data-sheet-close]').click();
        assert.equal(await page.evaluate(() => window.n26Confirm), false);
        await page.goto(origin + '#/archive');
        const info = page.locator('.btn--info').first();
        await info.waitFor(); await info.hover(); await page.waitForTimeout(220);
        items['info-hover'] = await measure(info);
        if (!baseline && state.name === 'explicit-dark') await page.screenshot({ path: new URL('info-hover.png', dir).pathname.replace(/^\/(.:)/, '$1') });
        // Use existing fabricated Demo sessions and actual attendance handler, never a mock roster.
        const target = await page.evaluate(async () => {
          const s = await import('/src/store.js');
          for (const t of s.teachings()) {
            const session = s.sessionsOf(t.id).find(x => x.status !== 'cancelled' && x.status !== 'cancelled_holiday' && s.sessionRoster(x).members.length);
            if (session) return { teaching: t.id, session: session.id };
          }
        });
        assert.ok(target, 'Demo must provide a real session roster');
        await page.goto(origin + `#/teaching/${target.teaching}/attendance?session=${target.session}`);
        await page.waitForSelector('.attendance-01c__status');
        for (const status of ['present', 'late', 'excused', 'absent']) {
          const button = page.locator(`.attendance-01c__status[data-status="${status}"]`).first();
          await button.click();
          await page.waitForTimeout(180);
          await page.waitForFunction(status => document.querySelector(`.attendance-01c__status[data-status="${status}"]`)?.getAttribute('aria-pressed') === 'true', status);
          items['attendance-' + status] = await measure(button);
        }
        await page.keyboard.press('Tab');
        await page.locator('.attendance-01c__status[data-status="absent"]').first().focus();
        items['attendance-focus'] = await measure(page.locator('.attendance-01c__status[data-status="absent"]').first());
        const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth,
          row: (() => { const r = document.querySelector('.attendance-01c__row').getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })(), height: document.documentElement.scrollHeight }));
        assert.equal(geometry.scrollWidth, state.width, 'no horizontal overflow');
        assert.deepEqual(errors, [], 'no app errors');
        for (const item of Object.values(items)) item.ratio = contrast(item);
        rows.push({ ...state, tokens, items, geometry });
        console.log(`${baseline ? 'baseline' : 'candidate'}: ${state.name} measured`);
        if (!baseline) {
          await page.locator('#toast.is-on').waitFor({ state: 'hidden', timeout: 6000 });
          await page.screenshot({ path: new URL(state.name + '.png', dir).pathname.replace(/^\/(.:)/, '$1'), fullPage: true });
        }
      } finally { await context.close(); }
    }
  });
} finally { await server.close(); }
await fs.writeFile(new URL(baseline ? 'baseline.json' : 'measurements.json', dir), JSON.stringify({ runId, origin, rows }, null, 2) + '\n');
if (baseline) {
  assert.ok(rows.some(row => Object.values(row.items).some(item => item.ratio < 4.5)), 'reproduce actual DOM failure');
} else {
  const before = JSON.parse(await fs.readFile(new URL('baseline.json', dir), 'utf8')).rows;
  for (const [i, row] of rows.entries()) {
    assert.deepEqual(row.tokens, before[i].tokens, 'palette unchanged');
    assert.deepEqual(row.geometry, before[i].geometry, 'attendance geometry unchanged');
    for (const [name, item] of Object.entries(row.items)) {
      assert.ok(item.ratio >= 4.5, `${row.name}/${name}: ${item.ratio}`);
      assert.equal(item.background, before[i].items[name].background, 'semantic backgrounds unchanged');
      assert.equal(item.width, before[i].items[name].width); assert.equal(item.height, before[i].items[name].height);
    }
    assert.notEqual(row.items['attendance-focus'].outline, 'none');
    assert.notEqual(row.items['danger-focus'].outline, 'none');
  }
}
console.log(JSON.stringify({ baseline, states: rows.map(row => ({ name: row.name, ratios: Object.fromEntries(Object.entries(row.items).map(([k,v]) => [k,v.ratio])) })) }));
