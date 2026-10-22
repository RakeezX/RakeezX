import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n72-webkit-sheet-date-20261022.json';
const task = JSON.parse(await readFile(taskFile, 'utf8'));
const runId = task.attempt.runId;
const origin = 'http://127.0.0.1:43173';
const viteFile = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
const vite = spawn(process.execPath, [viteFile, '--host', '127.0.0.1', '--port', '43173', '--strictPort'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
const viteLines = [];
for (const stream of [vite.stdout, vite.stderr]) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    viteLines.push(...lines.filter(Boolean));
    if (viteLines.length > 60) viteLines.splice(0, viteLines.length - 60);
  });
}

async function waitForVite() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Owned Vite exited before readiness (${vite.exitCode})`);
    try { if ((await fetch(origin)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Owned Vite did not become ready on port 43173');
}

try {
  await waitForVite();
  let result;
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, engine: 'webkit', timeoutMs: 60000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 740 }, locale: 'ar-SA', hasTouch: true });
    try {
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
      const page = await context.newPage();
      const errors = [];
      const failedRequests = [];
      const moduleResponses = [];
      const frameNavigations = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? null }));
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) frameNavigations.push({ url: frame.url(), at: Date.now() });
      });
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === origin && ['/src/app.js', '/src/router.js', '/src/views/calendar.js'].includes(url.pathname)) {
          moduleResponses.push({ path: url.pathname, status: response.status() });
        }
      });
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      const capture = () => page.evaluate(async () => {
        const [store, router] = await Promise.all([import('/src/store.js'), import('/src/router.js')]);
        const route = router.match(router.currentPath());
        return {
          timeOrigin: performance.timeOrigin,
          navigationEntries: performance.getEntriesByType('navigation').length,
          href: location.href,
          hash: location.hash,
          route: route?.route?.path ?? null,
          ready: store.state.ready,
          workspace: store.getActiveWorkspace()?.type ?? null,
          teachingCount: store.teachings().length,
          layoutCount: document.querySelectorAll('.layout').length,
          bootCount: document.querySelectorAll('.boot').length,
          routing: window.__workspaceRouting ?? null,
          demoRequest: sessionStorage.getItem('rakeezx-demo-session-v1'),
          databaseNames: (await indexedDB.databases()).map(database => database.name),
          databaseCounts,
          body: document.body.innerText.slice(0, 500),
        };
      });
      const bootSamples = [];
      let before = null;
      for (let i = 0; i < 24; i += 1) {
        const sample = await capture();
        bootSamples.push(sample);
        if (sample.ready && sample.workspace === 'demo' && sample.teachingCount > 0 && sample.layoutCount > 0) {
          before = sample;
          break;
        }
        await page.waitForTimeout(500);
      }
      before ??= bootSamples.at(-1);
      const routeSamples = [];
      await page.evaluate(() => { location.hash = '#/calendar'; });
      for (let i = 0; i < 12; i += 1) {
        const sample = await capture();
        routeSamples.push(sample);
        if (sample.body.includes('الإعدادات') || sample.body.includes('الفصول') || sample.body.includes('التقويم')) break;
        await page.waitForTimeout(250);
      }
      const after = routeSamples.at(-1);
      const summarize = sample => ({ at: sample.timeOrigin, hash: sample.hash, route: sample.route, ready: sample.ready,
        workspace: sample.workspace, teachingCount: sample.teachingCount, layoutCount: sample.layoutCount,
        routing: sample.routing, demoRequest: sample.demoRequest, databaseNames: sample.databaseNames });
      result = { before: summarize(before), after: summarize(after), sameDocument: before.timeOrigin === after.timeOrigin && before.navigationEntries === after.navigationEntries,
        bootSamples: bootSamples.map(summarize), routeSamples: routeSamples.map(summarize), frameNavigations, errors, failedRequests, moduleResponses, viteOutput: [...viteLines] };
    } finally { await context.close(); }
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  if (vite.exitCode === null) {
    const exited = new Promise(resolve => vite.once('exit', resolve));
    vite.kill();
    await exited;
  }
}
