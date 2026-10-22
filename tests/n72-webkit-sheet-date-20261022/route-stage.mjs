import { readFile, writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { startHost } from './host.mjs';

const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n72-webkit-sheet-date-20261022.json';
const task = JSON.parse(await readFile(taskFile, 'utf8'));
const runId = task.attempt.runId;
const host = await startHost({ instrument: true });
let result;
try {
  await withIsolatedLocalBrowser({ taskFile, runId, url: host.origin, engine: 'webkit', timeoutMs: 60000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 740 }, locale: 'ar-SA', hasTouch: true });
    try {
      await context.addInitScript(() => {
        sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing');
        window.__n72Stages = [];
        window.__n72Complete = new Promise(resolve => { window.__n72Finish = resolve; });
        window.__n72Trace = async (stage, action) => {
          window.__n72Stages.push({ stage, status: 'begin' });
          try {
            const value = await action();
            window.__n72Stages.push({ stage, status: 'end' });
            return value;
          } catch (error) {
            window.__n72Stages.push({ stage, status: 'error', error: String(error) });
            window.__n72Finish('error');
            throw error;
          }
        };
      });
      const page = await context.newPage();
      const errors = [], failedRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('requestfailed', request => failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
      await page.goto(host.origin, { waitUntil: 'domcontentloaded' });
      const stageOutcome = await page.evaluate(() => new Promise(resolve => {
        const timer = setTimeout(() => resolve('pending-boundary'), 45000);
        window.__n72Complete.then(value => { clearTimeout(timer); resolve(value); });
      }));
      const snapshot = await page.evaluate(async () => {
        const store = await import('/src/store.js');
        return { timeOrigin: performance.timeOrigin, navigationEntries: performance.getEntriesByType('navigation').length,
          ready: store.state.ready, workspace: store.getActiveWorkspace()?.type ?? null,
          teachingCount: store.teachings().length, layoutCount: document.querySelectorAll('.layout').length,
          demoRequest: sessionStorage.getItem('rakeezx-demo-session-v1'), stages: window.__n72Stages, counts: window.__n72Counts ?? null };
      });
      result = { runId, engine: 'webkit', stageOutcome, snapshot, errors, failedRequests, viteOutput: host.lines.slice(-30) };
    } finally { await context.close(); }
  });
  await writeFile(new URL('./route-stage-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await host.close(); }
