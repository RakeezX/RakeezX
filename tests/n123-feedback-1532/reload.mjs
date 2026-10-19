// AI-authored bounded before/after actual-app reload and changed-path guards.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { fixture, syntheticService, owner } from '../n73-account-flow-fixture.mjs';
import { GenericV2Backend } from '../helpers/generic-v2-backend.mjs';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch } from '../../src/lib/sync-v2.js';

const taskId = 'continuous-n123-mobile-reload-real-wait-20261019';
const runId = '3bea38e5-a1ac-4c39-b9ae-8fa2f0392f9c';
const baseSha = '98885befd4f13c02210661309a4add21e04c72ca';
const baseSource = execFileSync('git', ['show', baseSha + ':src/lib/sync.js'], { encoding: 'utf8' });
const root = resolve('.'), measurements = [], checks = [];
const guardsOnly = process.env.N123_GUARDS_ONLY === '1';
const uiOnly = process.env.N123_UI_ONLY === '1';
let baseline = true, delay = guardsOnly || uiOnly ? 10 : 2500, requests = 0;
const service = syntheticService(), backend = new GenericV2Backend();
for (const [name, rows] of Object.entries(fixture())) if (SYNC_V2_SCHEMAS[name]) {
  backend.records[SYNC_V2_SCHEMAS[name].entity] = rows.map(row => ({
    ...encodeSyncV2Patch(name, row), id: row.id, owner_id: owner, revision: 1, deleted_at: null,
  }));
}
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1'), pathname = u.pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname.startsWith('/__n73/') || pathname.startsWith('/__n123/')) {
      let body = ''; for await (const part of req) body += part;
      const input = JSON.parse(body || '{}'); let result;
      if (pathname.startsWith('/__n73/')) result = await service.request(pathname.slice(7), input);
      else if (pathname.endsWith('/read')) {
        requests++; await new Promise(done => setTimeout(done, delay)); result = await backend.fetchRecords(input.entity);
      } else result = await backend.applySyncV2Mutation(input);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) throw Error('Outside task root');
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream');
    let content = baseline && pathname === '/src/lib/sync.js' ? baseSource : await readFile(file);
    if (pathname === '/') content = String(content).replace("import('./src/lib/app-update.js');",
      "await import('./tests/n123-feedback-1532/bootstrap.mjs'); if (!new URL(location.href).searchParams.has('seed')) import('./src/lib/app-update.js');");
    res.end(content);
  } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: error.message })); }
});
async function settled(page) {
  const deadline = Date.now() + 65000;
  while (Date.now() < deadline) {
    const value = await page.evaluate(async () => {
      if (typeof window.checkpoint !== 'function' || !document.querySelector('.layout')) return null;
      const sync = await import('/src/lib/sync.js');
      const value = await window.checkpoint();
      return sync.state.lastSyncedAt && value.summary.cloudSyncHealthy
        ? { ...value, reads: window.probe.reads, ms: performance.now() - window.probe.started } : null;
    });
    if (value) return value;
    await new Promise(done => setTimeout(done, 100));
  }
  throw Error('Actual account document did not reach a healthy Sync checkpoint');
}
try {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const url = 'http://127.0.0.1:' + server.address().port;
  await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/' + taskId + '.json', runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const version of guardsOnly || uiOnly ? ['candidate'] : ['baseline', 'candidate']) {
      baseline = version === 'baseline'; requests = 0;
      const context = await createContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', error => console.log('pageerror:', error.message));
      await page.goto(url + '/?seed=1'); await page.waitForFunction(() => window.seedReady);
      await page.goto(url + '/#/classes', { waitUntil: 'domcontentloaded' });
      const result = await settled(page);
      assert.equal(result.owner, owner); assert.equal(result.workspace.authUserId, owner);
      assert.equal(result.outbox.length, 0); assert.equal(result.score.value, 18);
      measurements.push({ version, phase: 'actual_account_boot', ms: result.ms, reads: result.reads, readDelayMs: delay });
      // A real reload must recover owner, database and grade in its NEW document.
      delay = 10;
      await page.reload({ waitUntil: 'domcontentloaded' });
      const reload = await settled(page);
      assert.equal(reload.owner, owner); assert.equal(reload.workspace.databaseName, result.workspace.databaseName);
      assert.equal(reload.score.value, 18); assert.equal(reload.outbox.length, 0);
      measurements.push({ version, phase: 'actual_reload', reads: reload.reads, ms: reload.ms });
      if (uiOnly) {
        await page.locator('.topbar__teacher-btn[data-act="open-teacher-mini-hub"]').tap();
        const readsBefore = await page.evaluate(() => window.probe.reads);
        await page.locator('[data-act="mini-hub-sync-now"]').tap();
        // Observe both actual HTTP reads and the real rendered settled state.
        const until = Date.now() + 10000;
        let manual;
        while (Date.now() < until) {
          manual = await page.evaluate(async before => ({ ...(await window.checkpoint()),
            reads: window.probe.reads - before, green: !!document.querySelector('.mini-hub-sync__state .sync-dot--synced') }), readsBefore);
          if (manual.reads && manual.summary.cloudSyncHealthy && manual.green) break;
          await new Promise(done => setTimeout(done, 50));
        }
        assert.equal(manual.reads, reload.reads); assert.equal(manual.summary.cloudSyncHealthy, true); assert.equal(manual.green, true);
        await page.screenshot({ path: 'tests/n123-feedback-1532/mobile-sync.png' });
        const wake = await page.evaluate(async () => {
          const sync = await import('/src/lib/sync.js'), before = window.probe.reads, last = sync.state.lastSyncedAt;
          window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          const deadline = performance.now() + 10000;
          while (performance.now() < deadline) {
            const value = await window.checkpoint();
            if (sync.state.lastSyncedAt > last && window.probe.reads > before && value.summary.cloudSyncHealthy)
              return { owner: value.owner, reads: window.probe.reads - before, healthy: value.summary.cloudSyncHealthy };
            await new Promise(done => setTimeout(done, 25));
          }
          throw Error('Actual pageshow did not reach fresh healthy checkpoint');
        });
        assert.equal(wake.owner, owner); assert.equal(wake.reads, reload.reads); assert.equal(wake.healthy, true);
        checks.push({ name: 'actual_mobile_manual_handler_and_pageshow', status: 'PASS', evidence: JSON.stringify({ manual: { reads: manual.reads, green: manual.green }, wake }) });
      }
      if (!baseline && !uiOnly) {
        await page.screenshot({ path: 'tests/n123-feedback-1532/mobile.png' });
        const finalValidation = await page.evaluate(async () => {
          const sync = await import('/src/lib/sync.js'), store = await import('/src/store.js');
          const results = {};
          for (const mode of ['fail-validation', 'switch-validation', 'new-revision']) {
            await sync.suspendForWorkspaceDeactivation();
            window.probe.mode = 'normal';
            const markers = window.probe.markers;
            // A real store notification rebinds the receiver, without bypassing
            // the ownership guard or directly accessing coordinator internals.
            await store.patchDevice({}, { queue: false });
            while (window.probe.markers === markers) await new Promise(done => setTimeout(done, 5));
            window.probe.readThreshold = window.probe.reads;
            window.probe.mode = mode;
            const before = window.probe.reads, ok = await sync.syncAll({ full: true });
            results[mode] = { ok, reads: window.probe.reads - before,
              healthy: (await sync.getSyncOperationalSummary()).cloudSyncHealthy };
          }
          await sync.suspendForWorkspaceDeactivation();
          window.probe.mode = 'normal';
          return results;
        });
        assert.equal(finalValidation['fail-validation'].ok, false);
        assert.equal(finalValidation['fail-validation'].healthy, false);
        assert.equal(finalValidation['switch-validation'].ok, false);
        assert.equal(finalValidation['switch-validation'].healthy, false);
        assert.equal(finalValidation['new-revision'].healthy, false);
        assert.equal(finalValidation['new-revision'].reads, result.reads);
        checks.push({ name: 'single_pull_final_marker_context_and_new_revision', status: 'PASS', evidence: JSON.stringify(finalValidation) });
        const guards = await page.evaluate(async () => {
          const sync = await import('/src/lib/sync.js'), store = await import('/src/store.js'), db = await import('/src/lib/db.js');
          await sync.suspendForWorkspaceDeactivation();
          const pass = async mode => {
            window.probe.mode = mode; const reads = window.probe.reads;
            const ok = await sync.syncAll({ full: true });
            return { ok, reads: window.probe.reads - reads, healthy: (await sync.getSyncOperationalSummary()).cloudSyncHealthy };
          };
          const readFailure = await pass('read-fail');
          await sync.suspendForWorkspaceDeactivation();
          const missingMarker = await pass('marker-absent');
          await sync.suspendForWorkspaceDeactivation();
          window.probe.mode = 'normal';
          await store.renameStudent('n73-student1', 'Synthetic held edit');
          window.probe.mode = 'hold';
          const startReads = window.probe.reads, pending = sync.syncAll({ full: true });
          while (!window.probe.release) await new Promise(done => setTimeout(done, 5));
          const held = await window.checkpoint(); window.probe.release(); await pending;
          const edited = { reads: window.probe.reads - startReads, outbox: await db.getAll('outbox') };
          await sync.suspendForWorkspaceDeactivation();
          window.probe.mode = 'normal';
          await store.renameStudent('n73-student1', 'Synthetic wrong ACK');
          const wrong = await pass('wrong');
          const retained = await db.getAll('outbox');
          await sync.suspendForWorkspaceDeactivation();
          const recovered = await pass('normal');
          const calls = window.probe.calls.map(call => call.mutationId);
          await sync.suspendForWorkspaceDeactivation();
          const cloud = await import('/src/lib/cloud.js');
          cloud.setMockAuth({ id: 'foreign-owner' }, { access_token: 'synthetic', user: { id: 'foreign-owner' } });
          const foreign = await pass('normal');
          return { readFailure, missingMarker, held: { queued: held.outbox.length, healthy: held.summary.cloudSyncHealthy }, edited, wrong, retained: retained.length, recovered, calls, foreign };
        });
        assert.equal(guards.readFailure.ok, false); assert.equal(guards.readFailure.healthy, false);
        assert.equal(guards.missingMarker.ok, true); assert.equal(guards.missingMarker.reads, result.reads * 2);
        assert.deepEqual(guards.held, { queued: 1, healthy: false });
        assert.equal(guards.edited.reads, result.reads * 2); assert.equal(guards.edited.outbox.length, 0);
        assert.equal(guards.wrong.ok, false); assert.equal(guards.retained, 1); assert.equal(guards.recovered.ok, true);
        assert.equal(guards.calls.at(-1), guards.calls.at(-2));
        assert.equal(guards.foreign.ok, false); assert.equal(guards.foreign.reads, 0);
        checks.push({ name: 'changed_path_guards', status: 'PASS', evidence: JSON.stringify(guards) });
      }
      await context.close(); delay = 2500;
    }
    if (!guardsOnly && !uiOnly) {
      const before = measurements[0], after = measurements[2];
      assert.ok(before.ms >= 30000); assert.equal(before.reads, after.reads * 2); assert.ok(after.ms < before.ms * 0.7);
      checks.push({ name: 'n123_actual_thirty_second_path_measured_and_true_ack_guards', status: 'PASS', evidence: 'Actual source app boot and reload, synthetic owner/lease/registry and 2500ms table-read delay; duplicate full pull removed only with valid revision evidence and no local dispatch. See measurements; no real mobile/network outcome claimed.' });
    }
  });
} catch (error) { checks.push({ name: 'scenario', status: 'FAIL', evidence: error.stack }); process.exitCode = 1; }
finally {
  await new Promise(done => server.close(done));
  await writeFile('tests/n123-feedback-1532/' + (uiOnly ? 'ui-result.json' : 'result.json'), JSON.stringify({ taskId, runId, baseSha, measurements, checks, cleanup: 'Owned browser/contexts and loopback server closed in finally' }, null, 2) + '\n');
}
console.log(JSON.stringify({ measurements, checks }, null, 2));
