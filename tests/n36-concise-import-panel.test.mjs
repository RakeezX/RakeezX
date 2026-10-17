// AI-authored: actual app/CSS copy check; no live account or extension collection.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { createServer } from 'node:http';
import { resolve, extname, sep, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const baseSha = '91b4adc8736f79c663512a2829eb3b57ec54998f';
const taskId = 'continuous-n36-simpler-reviewed-roster-flow-0510-20261017';
const runId = 'e1a6a4b5-41dd-4733-9627-1c8fe012cd34';
const root = resolve('.'), origin = 'http://127.0.0.1:49447';

test('concise card in actual app retains download binding and all surrounding review/owner controls', async () => {
  const file = 'src/views/class-import-center.js';
  const current = await fs.readFile(file, 'utf8');
  const before = execFileSync('git', ['show', baseSha + ':' + file], { encoding: 'utf8' });
  // Only the static introductory copy/actions may differ; preserve the entire
  // preview, partial-source notice, ownership, lease, review and receipt code.
  // Broader shared-hub data/guard equality is checked in n104-responsive-export.test.mjs.
  const omitCopy = s => s.slice(s.indexOf('function directExtensionEntry()'), s.indexOf('async function receiveExtension()')).replace(/\r\n/g, '\n').replace(/  return html`<section class="card card--pad n36-direct"[\s\S]*?(?=    \$\{extensionPreview)/, '');
  assert.equal(omitCopy(current), omitCopy(before));
  for (const ext of ['zip', 'manifest.json']) {
    const p = 'assets/extensions/rakeez-teacher-import-helper-0.5.9.' + ext;
    assert.deepEqual(await fs.readFile(p), execFileSync('git', ['show', baseSha + ':' + p]));
  }
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, origin);
      const path = resolve(root, u.pathname === '/' ? 'index.html' : '.' + decodeURIComponent(u.pathname));
      if (!path.startsWith(root + sep)) throw Error('outside root');
      res.setHeader('content-type', ({ '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(path)] || 'application/octet-stream');
      res.end(await fs.readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  try {
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(49447, '127.0.0.1', ok); });
    await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/' + taskId + '.json', runId, url: origin }, async ({ createContext }) => {
      const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await openReadyServedDemo(page, origin);
      await page.evaluate(() => { location.hash = '#/classes/koshoof?import=1'; });
      const card = page.locator('[data-n36-direct]');
      await card.waitFor();
      assert.equal(await card.locator('h3').innerText(), 'استيراد الطلاب والفصول بشكل مباشر من مدرستي بإضافة مساعد ركيز المعلم');
      assert.equal(await card.locator('p').first().innerText(), 'ثبّت الإضافة لمتصفح كروم، وسجّل دخولك إلى منصة مدرستي، ثم شغّل الإضافة لجلب أسماء الطلاب وبيانات فصولهم المتاحة. راجع البيانات وأكّد حفظها في ركيز.');
      assert.equal(await card.locator('a').count(), 1);
      const link = card.locator('a[download]');
      assert.equal(await link.getAttribute('href'), '/assets/extensions/rakeez-teacher-import-helper-0.5.10.zip');
      assert.equal(await link.innerText(), 'تنزيل إضافة ركيز 0.5.10');
      assert.equal(await card.locator('a[href$="manifest.json"]').count(), 0);
      assert.equal(await card.locator('details').getAttribute('open'), null);
      assert.equal(await card.locator('li').count(), 3);
      assert.doesNotMatch(await card.innerText(), /بصمات|المحدّث|إيصالات الدفعات|إجمالي صفوف|اكتمال الحسابات/);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await card.evaluate(el => getComputedStyle(el).direction), 'rtl');
        assert.equal(await card.evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth; }), true);
        assert.notEqual(await link.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        await page.screenshot({ path: join(os.tmpdir(), taskId + '-' + width + '.png'), fullPage: true });
      }
      await card.locator('summary').click();
      assert.equal(await card.locator('details').evaluate(el => el.open), true);
      assert.equal(await card.locator('li').first().isVisible(), true);
      await card.locator('summary').click();
      await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();
      await card.waitFor({ state: 'detached' });
      await page.locator('[data-act="koshoof-tab"][data-tab="import"]').click();
      await card.waitFor();
      const manifest = await (await context.request.get(origin + '/assets/extensions/rakeez-teacher-import-helper-0.5.10.manifest.json')).json();
      const archive = await (await context.request.get(origin + await link.getAttribute('href'))).body();
      assert.equal(createHash('sha256').update(archive).digest('hex'), manifest.archive.sha256);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ widths: [390, 1280], actualApp: true, css: true, detailsAndTabs: 'PASS', archiveSha256: manifest.archive.sha256, unchangedOutsideCardCopy: true, errors }));
    });
  } finally {
    server.closeAllConnections();
    await new Promise(ok => server.close(ok));
  }
});
