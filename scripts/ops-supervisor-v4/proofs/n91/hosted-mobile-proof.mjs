/**
 * N91: actual hosted RAKEEZ app, fresh Demo context, unchanged served CSS/DOM.
 * The caller must own the browser lease. This program does not acquire leases,
 * mutate tickets, publish, read account profiles, or use a local HTTP/file server.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `Missing ${name} value`);
  return args[index + 1];
}
const manifest = JSON.parse(await readFile(arg('--manifest', path.join(here, 'preview-manifest.json')), 'utf8'));
const input = new URL(arg('--url', manifest.approvedOrigin));
assert.equal(input.protocol, 'https:', 'Only the approved hosted HTTPS application is allowed');
assert.equal(input.origin, manifest.approvedOrigin, 'Unapproved preview origin');
assert.equal(input.pathname, '/', 'The input must be the approved preview origin');
assert.ok(!input.username && !input.password && !input.search && !input.hash, 'Origin only; no credentials or query');
assert.equal(manifest.candidateSha, manifest.providerBinding.headSha);
assert.equal(manifest.providerBinding.status, 'completed');
assert.equal(manifest.providerBinding.conclusion, 'success');
assert.ok(/^[a-f0-9]{40}$/.test(manifest.candidateSha));
const origin = input.origin;
const output = path.resolve(arg('--out', path.join(here, 'results')));
await mkdir(output, { recursive: true });
const moduleRoot = path.resolve(arg('--module-root', process.cwd()));
const require = createRequire(path.join(moduleRoot, 'package.json'));
const { chromium } = require('playwright');
const widths = [320, 360, 390, 430];
const teaching = 'demo:teaching:1';
const hubHash = `#/teaching/${teaching}`;
const hubUrl = `${origin}/${hubHash}`;
const cardSelector = '.class-hub > .class-tools-section .class-tool-card';
const tools = [
  ['class-rules', 'هدف وميثاق الصف'], ['quicklog', 'الرصد السريع'],
  ['picker', 'القرعة'], ['groups', 'المجموعات'], ['board', 'لوحة التميز'],
  ['sessions', 'الحصص'], ['reports', 'التقارير'], ['items', 'توزيع الدرجات'],
].map(([route, title]) => ({ route, title, href: `${hubHash}/${route}` }));
const result = {
  schemaVersion: 1, taskId: manifest.taskId, candidateSha: manifest.candidateSha,
  origin, providerBinding: manifest.providerBinding, startedAt: new Date().toISOString(),
  engine: 'Chrome via Playwright; mobile CSS viewport emulation, not physical iOS Safari',
  isolation: { freshContextPerWidth: true, serviceWorkers: 'block', allowedMethods: ['GET', 'HEAD'], allowedOrigin: origin,
    externalRequests: 'blocked', webSockets: 'blocked', productAccount: 'none', workspace: 'Demo only' },
  widths: [], navigation: [], blockedRequests: [], errors: [],
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const briefUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return 'invalid-url'; } };
async function sourceEvidence(response, asset) {
  assert.equal(response.url(), new URL(asset.path, origin + '/').href, `Redirected source ${asset.path}`);
  assert.equal(response.status(), 200, `HTTP source ${asset.path}`);
  const bytes = await response.body();
  const observedSha256 = sha256(bytes);
  assert.equal(observedSha256, asset.sha256, `Served source differs from candidate: ${asset.path}`);
  assert.equal(bytes.length, asset.bytes);
  return { path: asset.path, url: response.url(), expectedSha256: asset.sha256, observedSha256,
    bytes: bytes.length, statusCode: response.status(), verified: true };
}
async function assertDemo(page) {
  const state = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const db = await import('/src/lib/db.js');
    return { ready: store.state.ready, workspace: store.getActiveWorkspace()?.type,
      database: db.getActiveDatabaseName(), teachings: store.teachings().length,
      outbox: (await db.getAll('outbox')).length };
  });
  assert.equal(state.ready, true); assert.equal(state.workspace, 'demo');
  assert.equal(state.database, 'rakeezx-demo'); assert.equal(state.outbox, 0);
  assert.ok(state.teachings > 0);
  return state;
}
async function measureTitles(page) {
  return page.locator(cardSelector).evaluateAll(cards => {
    const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const rows = cards.map(card => {
      const title = card.querySelector('.tile__title');
      const range = document.createRange(); range.selectNodeContents(title);
      const textRects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0)
        .map(r => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }));
      const clipping = [];
      for (let ancestor = title; ancestor && card.contains(ancestor); ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), rect = ancestor.getBoundingClientRect();
        const clipsX = /hidden|clip|scroll|auto/.test(style.overflowX);
        const clipsY = /hidden|clip|scroll|auto/.test(style.overflowY);
        if (textRects.some(r => (clipsX && (r.x < rect.x - 1 || r.right > rect.right + 1)) ||
          (clipsY && (r.y < rect.y - 1 || r.bottom > rect.bottom + 1)))) {
          clipping.push({ className: ancestor.className, overflowX: style.overflowX, overflowY: style.overflowY });
        }
      }
      const s = getComputedStyle(title);
      return { title: title.textContent.trim(), href: card.getAttribute('href'), card: box(card), titleBox: box(title),
        textRects, scrollWidth: title.scrollWidth, clientWidth: title.clientWidth, clipping,
        styles: { whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, overflowX: s.overflowX,
          overflowY: s.overflowY, fontSize: s.fontSize, lineHeight: s.lineHeight, overflowWrap: s.overflowWrap } };
    });
    return { direction: getComputedStyle(document.documentElement).direction, innerWidth,
      documentWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
      columns: getComputedStyle(document.querySelector('.class-tools-section .quick-tools-grid')).gridTemplateColumns,
      stylesheetHrefs: [...document.styleSheets].map(s => s.href).filter(Boolean), cards: rows };
  });
}
function validateGeometry(measurement, width) {
  assert.equal(measurement.direction, 'rtl'); assert.equal(measurement.innerWidth, width);
  assert.ok(measurement.documentWidth <= measurement.clientWidth + 1, `Page overflow at ${width}`);
  assert.deepEqual(measurement.cards.map(c => ({ title: c.title, href: c.href })), tools.map(t => ({ title: t.title, href: t.href })));
  assert.ok(measurement.stylesheetHrefs.includes(`${origin}/src/styles/components.css`), 'Candidate CSS is not an active stylesheet');
  for (const c of measurement.cards) {
    assert.ok(c.card.width > 0 && c.card.height > 0, `Empty card ${c.title}`);
    assert.ok(c.card.x >= -1 && c.card.right <= width + 1, `Card outside viewport ${c.title}`);
    assert.notEqual(c.styles.whiteSpace, 'nowrap', `nowrap title ${c.title}`);
    assert.notEqual(c.styles.textOverflow, 'ellipsis', `ellipsis title ${c.title}`);
    assert.ok(c.scrollWidth <= c.clientWidth + 1, `Title horizontal overflow ${c.title}`);
    assert.ok(c.textRects.length > 0, `No rendered title ${c.title}`);
    assert.deepEqual(c.clipping, [], `Clipped title ${c.title}`);
    assert.ok(c.textRects.every(r => r.x >= c.card.x - 1 && r.right <= c.card.right + 1 &&
      r.y >= c.card.y - 1 && r.bottom <= c.card.bottom + 1), `Title escapes actual card ${c.title}`);
  }
}
let browser;
const deadline = setTimeout(() => { result.errors.push('Overall 240-second proof deadline reached'); void browser?.close(); }, 240_000);
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of widths) {
    const sample = { width, height: 844, state: 'RUNNING', layoutStatus: 'NOT_RUN', sourceAssets: [] };
    result.widths.push(sample);
    const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ar-SA',
      timezoneId: 'Asia/Riyadh', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const request = route.request(); let url;
      try { url = new URL(request.url()); } catch { return route.abort('blockedbyclient'); }
      if (url.protocol !== 'https:' || url.origin !== origin || !['GET', 'HEAD'].includes(request.method()) ||
        /\/(auth|rest)\/v1\//.test(url.pathname)) {
        result.blockedRequests.push({ width, method: request.method(), url: briefUrl(url.href), reason: 'outside hosted-app read-only allowlist' });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await context.routeWebSocket('**/*', socket => {
      result.blockedRequests.push({ width, method: 'WEBSOCKET', url: briefUrl(socket.url()), reason: 'No WebSockets in hosted Demo proof' });
      return socket.close({ code: 1008, reason: 'Read-only hosted Demo proof' });
    });
    // Same supported Demo entry marker as tests/helpers/served-demo-readiness.mjs.
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage();
    page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(30_000);
    page.on('pageerror', error => { sample.pageErrors ??= []; sample.pageErrors.push(error.message); });
    page.on('popup', popup => { result.errors.push('Unexpected popup'); void popup.close(); });
    try {
      const css = manifest.sourceAssets.find(a => a.path === 'src/styles/components.css');
      const hub = manifest.sourceAssets.find(a => a.path === 'src/views/teaching-hub.js');
      const cssResponse = page.waitForResponse(r => r.url() === `${origin}/${css.path}`, { timeout: 30_000 });
      const hubResponse = page.waitForResponse(r => r.url() === `${origin}/${hub.path}`, { timeout: 45_000 });
      // Attach a rejection handler immediately; startup failure is reported below.
      cssResponse.catch(() => {}); hubResponse.catch(() => {});
      await page.goto(`${origin}/#/classes`, { waitUntil: 'domcontentloaded' });
      sample.sourceAssets.push(await sourceEvidence(await cssResponse, css));
      await page.locator('.boot').waitFor({ state: 'detached', timeout: 30_000 });
      await page.waitForFunction(async () => {
        const store = await import('/src/store.js');
        return store.state.ready && store.getActiveWorkspace()?.type === 'demo' && store.teachings().length > 0;
      }, null, { timeout: 30_000 });
      sample.demo = await assertDemo(page);
      await page.locator(`a.class-card__main[href="${hubHash}"]`).tap();
      await page.waitForURL(hubUrl);
      await page.locator(cardSelector).first().waitFor({ state: 'visible' });
      sample.sourceAssets.push(await sourceEvidence(await hubResponse, hub));
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      sample.measurement = await measureTitles(page);
      sample.screenshot = path.join(output, `n91-actual-class-tools-${width}.png`);
      await page.locator('.class-tools-section').screenshot({ path: sample.screenshot });
      validateGeometry(sample.measurement, width);
      sample.layoutStatus = 'PASS';
      sample.state = 'PASS';
      console.log(`PASS responsive_layout ${width}: 8 actual titles; source hashes match candidate`);
      // Eight actual links at 390px; no buttons that create/edit/delete records are clicked.
      if (width === 390) for (const tool of tools) {
        const observation = { viewportWidth: width, title: tool.title, expectedHash: tool.href, state: 'RUNNING' };
        result.navigation.push(observation);
        await page.locator(`${cardSelector}[href="${tool.href}"]`).tap();
        await page.waitForURL(url => url.origin === origin && url.hash === tool.href);
        await page.waitForFunction(expected => document.querySelector('.topbar__title')?.textContent.trim() === expected, tool.title);
        await page.locator('.class-hub').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.empty--error').count(), 0, `Error route ${tool.route}`);
        observation.observedHash = new URL(page.url()).hash;
        observation.demo = await assertDemo(page); observation.state = 'PASS';
        await page.goto(hubUrl, { waitUntil: 'domcontentloaded' });
        await page.locator(cardSelector).first().waitFor({ state: 'visible' });
      }
      sample.finalDemo = await assertDemo(page);
    } catch (error) {
      sample.state = 'FAIL'; sample.error = String(error.stack ?? error);
      if (sample.layoutStatus !== 'PASS') sample.layoutStatus = 'FAIL';
      const currentNavigation = result.navigation.find(n => n.state === 'RUNNING');
      if (currentNavigation) { currentNavigation.state = 'FAIL'; currentNavigation.error = String(error.message ?? error); }
      result.errors.push(`${width}: ${error.message ?? error}`);
      await page.screenshot({ path: path.join(output, `n91-failure-${width}.png`), fullPage: true }).catch(() => {});
    } finally { await context.close(); }
  }
} catch (error) { result.errors.push(String(error.stack ?? error)); }
finally {
  clearTimeout(deadline); await browser?.close().catch(() => {});
  result.finishedAt = new Date().toISOString();
  const layoutPass = result.widths.length === 4 && result.widths.every(r => r.layoutStatus === 'PASS');
  const navigationPass = result.navigation.length === 8 && result.navigation.every(r => r.state === 'PASS');
  result.checks = [{ name: 'responsive_layout', status: layoutPass ? 'PASS' : 'FAIL', evidence: '4 CSS viewports × 8 actual served app card titles, RTL, source hashes and geometry' },
    { name: 'card_navigation', status: navigationPass ? 'PASS' : result.navigation.length ? 'FAIL' : 'NOT_RUN', evidence: '8 actual class-tool link taps at 390px; route title, Demo workspace and empty outbox checked' }];
  result.status = layoutPass && navigationPass && result.errors.length === 0 ? 'PASS' : 'FAIL';
  await writeFile(path.join(output, 'N91_HOSTED_APP_PROOF.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, candidateSha: result.candidateSha, origin, checks: result.checks,
    resultPath: path.join(output, 'N91_HOSTED_APP_PROOF.json'), errors: result.errors }));
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}
