// AI: real application HTTP DOM/handlers/CSS, actual store/engine, isolated browser.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createECDH } from 'node:crypto';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';
import { installNative } from './runtime.mjs';
const taskId = 'continuous-n44-confirmed-command-ack-projection-20261024', runId = '6ba4eff8-3925-4c3b-899d-a0df22ac4dc2';
const baseSha = '2afc3eb4ee11a982ba7991ec7630a7ccea18ada5';
const folder = 'tests/n44-confirmed-projection-20261024/';
const report = { taskId, runId, baseSha, checks: [], baseline: {}, cleanup: {} };
const root = process.cwd(), curve = createECDH('prime256v1'); curve.generateKeys();
const publicKey = curve.getPublicKey().toString('base64url');
const old = Object.fromEntries(['src/store.js', 'src/app.js', 'src/lib/sync.js', 'src/lib/notification-push-runtime.js'].map(file => [file, execFileSync('git', ['show', baseSha + ':' + file])]));
let baseline = true, enabled = false, projects = [], remote = null, receipt = null, materializations = new Map(), projectMode = 'ok';
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname.startsWith('/api/n44/')) {
    let raw = ''; for await (const part of req) raw += part;
    const body = JSON.parse(raw || '{}'); let value = { status: 'disabled' };
    if (u.pathname.endsWith('/push/config') && enabled) value = { status: 'ready', protocol: 'n44-browser-v2', capability: 'n44-single-device-20261019-v1', serviceRevision: 'n44-browser-service-v2', serviceSourceSha: 'a'.repeat(40), publicKey, expiresAt: Date.now() + 3600000, deliveryEnabled: false, schedulerEnabled: false };
    if (u.pathname.endsWith('/context/read')) value = { protocol: 'n44-browser-v2', status: remote ? 'current' : 'absent', context: remote, registration: receipt, expectedRevision: null };
    if (u.pathname.endsWith('/context/update')) { remote = { ...body, active: true, sessionRevision: 'synthetic-session', consentRevision: 'synthetic-consent', sessionExpiresAt: Date.now() + 3600000 }; value = { status: 'updated', context: remote }; }
    if (u.pathname.endsWith('/push/register')) { receipt ??= { status: 'registered', registrationId: body.registrationId, expiresAt: Date.now() + 1800000 }; value = receipt; }
    if (u.pathname.endsWith('/push/revoke')) { receipt = null; value = { status: 'revoked' }; }
    if (u.pathname.endsWith('/events/update')) {
      projects.push({ kind: body.kind, id: body.sourceId, expectedStamp: body.expectedStamp });
      if (projectMode === 'delay') await new Promise(ok => server.releaseProject = ok);
      if (projectMode === 'unknown') value = { status: 'unknown' };
      else { const stamp = 'b'.repeat(64); materializations.set(body.kind + ':' + body.sourceId, stamp); value = { status: 'updated', sourceStamp: stamp }; }
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(value));
  }
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const relative = path.relative(root, file).replaceAll('\\', '/'); const bytes = baseline && old[relative] || await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(bytes); } catch { res.writeHead(404).end(); }
});
const pass = (name, evidence) => report.checks.push({ name, status: 'PASS', evidence });
const settle = async page => { await page.waitForTimeout(100); await page.waitForFunction(() => n44Native.inflight === 0 && performance.now() - (n44Native.lastProjection ?? 0) > 80); };
let started = false;
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok)); started = true;
  const url = 'http://127.0.0.1:' + server.address().port;
  await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/' + taskId + '.json', runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const original of [true, false]) {
      baseline = original; enabled = false; projects = []; remote = null; receipt = null; materializations = new Map();
      const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
      await context.addInitScript(installNative); const page = await context.newPage(); page.setDefaultTimeout(10000);
      await openReadyServedDemo(page, url); enabled = true;
      assert.deepEqual(await page.evaluate(async () => (await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare()), { ownerMatches: true, receiptMatches: true, editable: true });
      await page.locator('[data-act="notification-push"]').click();
      await page.waitForFunction(async () => (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().snapshot().status === 'subscribed');
      // Await the actual opt-in handler's projection, not just its subscribed render.
      await page.evaluate(async () => { const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime(); await r.optIn(); });
      if (!original) await page.waitForFunction(() => n44Native.projected.includes('n44-due') && n44Native.inflight === 0);
      await settle(page);
      const bootstrap = projects.some(row => row.id === 'n44-due');
      projects = [];
      await page.evaluate(async () => (await import('/src/store.js')).renameScoreParent('n44-item', 'Synthetic acknowledged rename'));
      await page.waitForFunction(async () => (await import('/src/lib/db.js')).getAll('outbox').then(rows => !rows.length));
      // Let asynchronous observer requests settle through the browser request queue.
      await settle(page);
      const direct = projects.some(row => row.id === 'n44-due');
      if (original) { assert.equal(bootstrap, false); assert.equal(direct, false); report.baseline = { bootstrapMissing: true, durableRenameMissing: true, source: baseSha }; await context.close(); continue; }
      assert.equal(bootstrap, true); assert.equal(direct, true); pass('baseline causal reproduction and corrected opt-in/direct canonical rename', 'Original app/store/runtime misses both; patched real handler and V2 adoption project due source.');
      assert.equal(await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), e = await import('/src/lib/notification-events.js'); return e.currentNotificationEvents(s, e.currentNotificationContext(s, c)).some(row => row.targetId === 'n44-due'); }), true);
      pass('ordinary notification adapter recognizes the current synthetic due source', 'Current-day fixture, valid parent/child and actual owner context.');
      projects = [];
      const noChange = await page.evaluate(async () => { const sync = await import('/src/lib/sync.js'); const before = n44Engine.ackSignals; const ok = await sync.syncAll(); return { ok, ackDelta: n44Engine.ackSignals - before, reads: n44Engine.readSignals }; });
      await settle(page);
      assert.equal(noChange.ok, true); assert.equal(noChange.ackDelta, 0); assert.ok(noChange.reads > 0); assert.ok(projects.some(row => row.id === 'n44-due')); pass('no-change actual Sync read projects without pushed ACK', JSON.stringify(noChange));
      // A normal configured child create/update is optimistic until the real Sync engine adopts its receipt.
      for (const operation of ['create', 'update']) {
        projects = [];
        const prepared = await page.evaluate(async operation => {
          const s = await import('/src/store.js');
          const subs = s.scoreSubitemsOf('n44-item').map(row => ({ ...row }));
          if (operation === 'create') subs.push({ id: 'n44-new-child', name: 'Synthetic new child', value: 0, dueDate: (await import('/src/models.js')).todayISO() });
          else subs.find(row => row.id === 'n44-new-child').name = 'Synthetic updated child';
          const proposed = { scoreMode: 'subitems', distributionMode: 'manual', subitems: subs };
          const review = s.previewScoreConfiguration('n44-item', proposed);
          await s.applyConfirmedScoreConfiguration('n44-item', proposed, { expectedVersion: review.expectedVersion, confirmed: true });
          return { fenced: !(await s.confirmedNotificationSources()).some(row => row.id === 'n44-new-child'), grade: s.state.scores[0].value };
        }, operation);
        assert.equal(prepared.fenced, true); assert.equal(prepared.grade, 4); assert.equal(projects.length, 0);
        const ok = await page.evaluate(async () => (await import('/src/lib/sync.js')).syncAll()); await settle(page); assert.equal(ok, true);
        assert.ok(projects.some(row => row.id === 'n44-new-child'));
        assert.equal(await page.evaluate(async () => (await import('/src/store.js')).state.scores[0].value), 4);
      }
      pass('actual configured subitem create/update ACK projection with grade preserved', 'Normal store configuration, durable outbox, actual full Sync engine/receipt adoption; no projection while optimistic. Grade remains 4.');
      // Independently committed direct ACK remains useful when unrelated work fails later.
      projects = [];
      await page.evaluate(() => { n44Engine.mode = 'delay'; window.n44PendingRename = import('/src/store.js').then(s => s.renameScoreParent('n44-item', 'Independent durable ACK')); });
      await page.waitForFunction(() => typeof n44Engine.release === 'function');
      await page.evaluate(async () => { const db = await import('/src/lib/db.js'); await db.put('outbox', { id: 'n44-unrelated-failed', state: 'rejected', store: 'notes', recordId: 'unrelated' }); n44Engine.release(); await n44PendingRename; n44Engine.mode = 'ok'; });
      await settle(page); assert.ok(projects.some(row => row.id === 'n44-due'));
      assert.equal(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).some(row => row.id === 'n44-unrelated-failed')), true);
      await page.evaluate(async () => (await import('/src/lib/db.js')).clearStore('outbox'));
      pass('direct canonical ACK is independent of unrelated failed outbox', 'Failed unrelated row retained across committed direct rename and projection; no whole-Sync success inferred.');
      const geometry = await page.locator('.n44-settings-page').evaluate(el => ({ display: getComputedStyle(el).display, overflow: document.documentElement.scrollWidth > innerWidth + 1 })); assert.notEqual(geometry.display, 'none'); assert.equal(geometry.overflow, false); pass('actual notification DOM/delegated opt-in/source CSS', '390px real application render; synthetic native ports only.');
      // Pending/unknown/rejected receipts use the real direct command path.
      for (const mode of ['lost', 'unknown', 'rejected']) {
        projects = []; const result = await page.evaluate(async mode => { const s = await import('/src/store.js'), db = await import('/src/lib/db.js'); n44Engine.mode = mode; let rejected = false; try { await s.renameScoreParent('n44-item', 'Unconfirmed'); } catch { rejected = true; } const rows = await db.getAll('outbox'); return { rejected, pending: rows.length, candidates: await s.confirmedNotificationSources() }; }, mode);
        assert.equal(result.rejected, true); assert.ok(result.pending); assert.ok(!result.candidates.some(row => row.id === 'n44-due')); assert.equal(projects.length, 0);
        await page.evaluate(async () => { await (await import('/src/lib/db.js')).clearStore('outbox'); n44Engine.mode = 'ok'; });
      }
      pass('lost unknown rejected direct receipts never project', 'Actual queue/dispatch/receipt rejection leaves source fenced; no projection request.');
      const guards = await page.evaluate(async () => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js');
        const before = JSON.stringify(await db.getAll('scores'));
        await db.put('outbox', { id: 'synthetic-unrelated', state: 'rejected', store: 'notes', recordId: 'unrelated' });
        const independent = (await s.confirmedNotificationSources()).some(row => row.id === 'n44-due');
        await db.put('outbox', { id: 'synthetic-delete', state: 'pending', store: 'items', recordId: 'n44-item', op: 'delete' });
        const deletionFenced = !(await s.confirmedNotificationSources()).some(row => row.id === 'n44-due');
        await db.remove('outbox', 'synthetic-delete');
        const child = await db.get('scoreSubitems', 'n44-due');
        await db.put('scoreSubitems', { ...child, serverRevision: 0 }); await s.refreshSyncedState();
        const localFenced = !(await s.confirmedNotificationSources()).some(row => row.id === child.id);
        await db.put('scoreSubitems', { ...child, deleted: true }); await s.refreshSyncedState();
        const unknownDeleteFenced = !(await s.confirmedNotificationSources()).some(row => row.id === child.id);
        await db.put('scoreSubitems', child); await s.refreshSyncedState(); await db.clearStore('outbox');
        return { independent, deletionFenced, localFenced, unknownDeleteFenced, gradesUnchanged: before === JSON.stringify(await db.getAll('scores')), sourceRevisionUnchanged: (await db.get('scoreSubitems', child.id)).serverRevision === child.serverRevision };
      }); assert.deepEqual(guards, { independent: true, deletionFenced: true, localFenced: true, unknownDeleteFenced: true, gradesUnchanged: true, sourceRevisionUnchanged: true }); pass('unrelated failed outbox separation and pending-delete/local-only/grade guards', JSON.stringify(guards));
      projects = [];
      const materializedBeforeDuplicate = materializations.size;
      await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime(); const checkpoint = { workspace: s.getActiveWorkspace(), session: c.session }; await r.afterSyncAck(checkpoint); await r.afterSyncAck(checkpoint); });
      assert.ok(projects.length); assert.equal(materializations.size, materializedBeforeDuplicate); assert.ok(projects.every(row => row.expectedStamp === 'b'.repeat(64))); pass('duplicate canonical notification retains revision CAS', 'All duplicate source requests carry acknowledged CAS stamp; synthetic service source count unchanged.');
      projects = [];
      await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime(); await r.afterSyncAck({ workspace: { ...s.getActiveWorkspace() }, session: c.session }); await r.afterSyncAck({ workspace: s.getActiveWorkspace(), session: { ...c.session } }); });
      assert.equal(projects.length, 0); pass('foreign workspace/session checkpoints cannot cross-bind', 'Same fields with a different mounted workspace/session identity are refused.');
      // Real parent deletion must cascade to its real child and stay fenced until ACK.
      const deletion = await page.evaluate(async () => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js'), v = await import('/src/lib/sync-v2.js');
        const item = { ...s.state.items.find(row => row.id === 'n44-item'), id: 'n44-cleanup-parent', ownerId: c.user.id };
        const child = { ...s.state.scoreSubitems.find(row => row.id === 'n44-due'), id: 'n44-cleanup-child', itemId: item.id, ownerId: c.user.id };
        await db.put('items', item); await db.put('scoreSubitems', child);
        for (const [name, row] of [['items', item], ['scoreSubitems', child]]) n44Engine.remote[name].push({ ...v.encodeSyncV2Patch(name, row), id: row.id, revision: row.serverRevision, owner_id: c.user.id, deleted_at: null });
        await s.refreshSyncedState();
        const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime();
        await r.projectConfirmedSources({ workspace: s.getActiveWorkspace(), session: c.session });
        const ok = await s.deleteItem(item.id), pending = await db.getAll('outbox');
        return { ok, parentDeleted: (await db.get('items', item.id)).deleted, childDeleted: (await db.get('scoreSubitems', child.id)).deleted,
          durableDelete: pending.some(row => row.command === 'lifecycle:delete_item' && row.patch.targetId === item.id), fenced: !(await s.confirmedNotificationSources()).some(row => row.id === child.id) };
      });
      assert.deepEqual(deletion, { ok: true, parentDeleted: true, childDeleted: true, durableDelete: true, fenced: true });
      assert.equal(await page.evaluate(async () => (await import('/src/lib/sync.js')).syncAll()), true); await settle(page);
      assert.ok(projects.some(row => row.id === 'n44-cleanup-child'));
      // A canonical physical removal retains the acknowledged source key for server cleanup.
      projects = [];
      await page.evaluate(async () => { const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js'); await db.remove('scoreSubitems', 'n44-cleanup-child'); await s.refreshSyncedState(); await (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().projectConfirmedSources({ workspace: s.getActiveWorkspace(), session: c.session }); });
      assert.ok(projects.some(row => row.id === 'n44-cleanup-child'));
      pass('actual parent-child deletion and canonical missing-source cleanup', 'Normal deleteItem cascade/outbox/engine ACK, pending deletion fenced; previously acknowledged absent source retains cleanup key only.');
      // Restore a current registration using the actual client/gateway/storage path.
      projects = [];
      await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), m = await import('/src/lib/notification-push-runtime.js'); window.n44Restored = m.createPushRuntime({ store: s, cloud: c, window, navigate() {} }); await n44Restored.refresh(); });
      await settle(page); assert.ok(projects.some(row => row.id === 'n44-due'));
      assert.equal(await page.evaluate(() => n44Restored.snapshot().status), 'subscribed');
      pass('current-device restore projects existing canonical source', 'Actual restore registration ACK and worker-consent binding; no user edit or fabricated Sync ACK.');
      // A fresh restored runtime cannot turn HTTP 200/unknown projection into a CAS ACK.
      projectMode = 'unknown'; projects = [];
      await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), m = await import('/src/lib/notification-push-runtime.js'); window.n44Unknown = m.createPushRuntime({ store: s, cloud: c, window, navigate() {} }); await n44Unknown.refresh(); });
      assert.equal(projects.length, 1); assert.equal(projects[0].expectedStamp, null);
      projectMode = 'ok'; projects = [];
      await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'); await n44Unknown.projectConfirmedSources({ workspace: s.getActiveWorkspace(), session: c.session }); });
      assert.ok(projects.length); assert.ok(projects.every(row => row.expectedStamp === null));
      pass('HTTP200 unknown projection never becomes confirmed materialization', 'Unknown response stops pass; later explicit checkpoint retains null CAS, no fabricated source stamp.');
      projects = [];
      await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), guard = (await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard; guard.setWorkspace({ ...s.getActiveWorkspace(), authUserId: 'b4400000-0000-4000-8000-000000000002' }); await n44Restored.projectConfirmedSources({ workspace: s.getActiveWorkspace(), session: c.session }); guard.setWorkspace(s.getActiveWorkspace()); });
      assert.equal(projects.length, 0); pass('actual ownership guard refuses foreign-owner projection', 'Mounted store plus actual ownership guard; no guard disabled.');
      // Retire in-flight direct receipt by changing the authenticated session.
      await page.evaluate(() => { n44Engine.mode = 'delay'; n44Engine.release = null; window.n44Late = import('/src/store.js').then(s => s.renameScoreParent('n44-item', 'Late receipt')); });
      await page.waitForFunction(() => typeof n44Engine.release === 'function');
      await page.evaluate(async () => { const c = await import('/src/lib/cloud.js'); c.setMockAuth(c.user, { ...c.session, access_token: 'synthetic-replaced-session' }); n44Engine.release(); await n44Late; });
      await settle(page); assert.equal(projects.length, 0); pass('late canonical direct receipt cannot notify a replacement session', 'Real deferred command/receipt path; checkpoint identity fenced after Auth session replacement.');
      await page.evaluate(async () => n44Restored.dispose());
      await page.evaluate(async () => n44Unknown.dispose());
      await page.evaluate(async () => { const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime(); await r.dispose(); const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'); await r.afterSyncAck({ workspace: s.getActiveWorkspace(), session: c.session }); });
      assert.equal(projects.length, 0); pass('dispose cleanup and late notification fence', 'Disposed runtime produces zero new projection requests; owned native mock unsubscribed.');
      await context.close();
    }
  }); report.cleanup.ownedBrowserClosed = true; report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = String(error.stack).slice(0, 2400); process.exitCode = 1; }
finally { if (started) { server.closeAllConnections(); await new Promise(ok => server.close(ok)); report.cleanup.ownedServerClosed = true; } report.cleanup.phase = 'canonical isolated local helper; no shared lease'; await writeFile(folder + 'app.json', JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(report));
