// AI: actual HTTP application, guarded synthetic account, existing native ports.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createECDH } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { installNative } from './n44-confirmed-projection-20261024/runtime.mjs';
import { createPushGateway } from '../src/lib/notification-push-gateway.js';
const taskId = 'continuous-n44-config-readiness-public-dependency-20261025';
const runId = '2826b3bf-ecec-45bb-8863-d06922271cd3';
const root = process.cwd(), curve = createECDH('prime256v1'); curve.generateKeys();
const publicKey = curve.getPublicKey().toString('base64url');
let mode = 'disabled', release;
const requests = [];
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname.startsWith('/api/n44/')) {
    requests.push(u.pathname);
    let body = { status: 'disabled' }, status = 200;
    if (u.pathname.endsWith('/push/config')) {
      const selected = mode;
      if (selected === 'late') await new Promise(ok => release = ok);
      if (/^http/.test(selected)) status = Number(selected.slice(4));
      if (selected === 'ready') body = { status: 'ready', protocol: 'n44-browser-v2', capability: 'n44-single-device-20261019-v1', serviceRevision: 'n44-browser-service-v2', serviceSourceSha: 'a'.repeat(40), publicKey, expiresAt: Date.now() + 3600000, deliveryEnabled: false, schedulerEnabled: false };
      if (selected === 'shape') body = { status: 'ready', privatePayload: 'PRIVATE_CONFIG_SENTINEL' };
      res.writeHead(status, { 'content-type': 'application/json' });
      return res.end(status !== 200 ? 'PRIVATE_CONFIG_SENTINEL' : selected === 'decode' ? '{PRIVATE_CONFIG_SENTINEL' : selected === 'response_size' ? 'x'.repeat(8193) : JSON.stringify(body));
    }
    if (u.pathname.endsWith('/context/read')) body = { protocol: 'n44-browser-v2', status: 'absent', expectedRevision: null, registration: null };
    res.writeHead(status, { 'content-type': 'application/json' }); return res.end(JSON.stringify(body));
  }
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const bytes = await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(bytes); } catch { res.writeHead(404).end(); }
});
// Config-specific read failures cannot leak a raw exception or invent HTTP200.
for (const [fetcher, expected] of [
  [async () => { throw Error('PRIVATE_CONFIG_SENTINEL'); }, { httpStatus: null, phase: 'transport' }],
  [async () => ({ ok: true, status: 200, text: async () => { throw Error('PRIVATE_CONFIG_SENTINEL'); } }), { httpStatus: 200, phase: 'response_read' }],
  [async () => ({ ok: false, status: 403, text: async () => { assert.fail('Non-2xx body must never be read'); } }), { httpStatus: 403, phase: 'http' }],
]) {
  let calls = 0;
  const g = createPushGateway({ context: { ownerId: 'synthetic', workspaceId: 'db', deviceId: 'device' }, storage: { getItem: () => null }, fetch: async (...args) => { calls++; return fetcher(...args); } });
  await assert.rejects(g.configuration(), e => { assert.deepEqual(e.configOutcome, expected); assert.equal(e.message, 'unavailable'); return true; });
  assert.equal(calls, 1);
}
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const url = 'http://127.0.0.1:' + server.address().port;
  await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/' + taskId + '.json', runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await context.addInitScript(installNative);
    await context.addInitScript(() => { navigator.serviceWorker.register = async () => navigator.serviceWorker.getRegistration(); });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    await openReadyServedDemo(page, url);
    const checkpoint = await page.evaluate(async () => {
      const r = await import('/src/lib/notification-push-runtime.js'); await r.getPushRuntime().dispose();
      await (await import('/tests/n44-fixture.mjs')).prepareAccount();
      const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js');
      await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id => ({ id, verifiedAt: Date.now(), source: 'supabase-auth-user' }));
      for (const name of ['scoreSubitems', 'items', 'sessions']) await db.clearStore(name);
      await s.refreshSyncedState();
      location.hash = '#/settings/notifications'; (await import('/src/app.js')).repaint();
      window.configTest = { s, c, r, attempts: 0, sideEffects: 0 };
      Notification.requestPermission = async () => { configTest.sideEffects++; return 'granted'; };
      return { owner: s.getActiveWorkspace().authUserId, receipt: s.state.device.accountProvisioningReceipt.ownerId,
        context: (await import('/src/lib/notification-events.js')).currentNotificationContext(s, c), editable: s.getOfflineLeaseStatus().editable, sources: s.notificationSourceGroups().length };
    });
    assert.equal(checkpoint.owner, checkpoint.receipt); assert.equal(checkpoint.context.ownerId, checkpoint.owner); assert.equal(checkpoint.editable, true); assert.equal(checkpoint.sources, 0);
    const start = async selected => {
      mode = selected; requests.length = 0;
      await page.evaluate(async selected => {
        const t = configTest; await t.runtime?.dispose(); t.attempts = 0;
        t.runtime = t.r.createPushRuntime({ store: t.s, cloud: t.c, navigate() {}, changed: () => import('/src/app.js').then(m => m.repaint()),
          fetch: async (url, init) => {
            if (String(url).endsWith('/push/config')) {
              t.attempts++;
              if (selected === 'transport') throw Error('PRIVATE_CONFIG_SENTINEL');
              if (selected === 'deadline') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('PRIVATE_CONFIG_SENTINEL')), { once: true }));
            } else if (!String(url).endsWith('/context/read')) t.sideEffects++;
            return fetch(url, init);
          } });
        t.r.setPushRuntime(t.runtime); t.pending = t.runtime.refresh();
      }, selected);
    };
    for (const [selected, status, phase, category] of [
      ['disabled', 200, 'complete', 'disabled'], ['ready', 200, 'complete', 'ready'],
      ...[401, 403, 429, 503].map(n => ['http' + n, n, 'http', 'request_failed']),
      ['transport', null, 'transport', 'request_failed'], ['decode', 200, 'decode', 'request_failed'],
      ['response_size', 200, 'response_size', 'request_failed'], ['shape', 200, 'shape', 'invalid'], ['deadline', null, 'deadline', 'request_failed'],
    ]) {
      if (selected === 'deadline') await page.clock.install();
      await start(selected);
      if (selected === 'deadline') await page.clock.runFor(15001);
      await page.evaluate(() => configTest.pending);
      const details = page.locator('[data-n44-config-outcome]'); await details.waitFor();
      await details.locator('summary').click();
      const text = await details.innerText(); assert.ok(text.includes(status ?? 'UNKNOWN')); assert.ok(text.includes(phase));
      const snapshot = await page.evaluate(() => configTest.runtime.snapshot());
      assert.deepEqual(snapshot.configOutcome, { httpStatus: status, phase }); assert.equal(snapshot.eligibility.configuration, category);
      if (selected === 'disabled') {
        assert.equal(snapshot.eligibility.reason, 'configuration_disabled'); assert.ok(text.includes('غير متاحة لهذه المساحة')); assert.ok(!text.includes('تعذر تحميل'));
      }
      assert.equal(await page.locator('[data-act="notification-push"]').count(), selected === 'ready' ? 1 : 0);
      assert.equal(await page.locator('[data-n44-current-identity]').count(), 1);
      await page.locator('[data-n44-current-identity] summary').click();
      const identity = await page.locator('[data-n44-current-identity]').innerText();
      for (const value of [checkpoint.owner, checkpoint.context.workspaceId, checkpoint.context.deviceId]) assert.ok(identity.includes(value));
      assert.equal(await page.locator('[data-n44-source]').count(), 0);
      assert.equal(await page.evaluate(() => configTest.attempts), 1); assert.equal(await page.evaluate(() => configTest.sideEffects), 0);
      assert.ok(requests.every(p => p.endsWith('/push/config') || selected === 'ready' && p.endsWith('/context/read')));
      assert.equal(await details.locator('button').count(), 0);
      assert.ok(!(await page.locator('.n44-settings').innerText()).includes('PRIVATE_CONFIG_SENTINEL'));
      const layout = await page.locator('.n44-settings-page').evaluate(el => ({ visible: el.getBoundingClientRect().height > 0, overflow: document.documentElement.scrollWidth > innerWidth + 1, css: getComputedStyle(el).display }));
      assert.equal(layout.visible, true); assert.equal(layout.overflow, false); assert.notEqual(layout.css, 'none');
      if (selected === 'deadline') await page.clock.resume();
      console.log('PASS actual config -> runtime -> settings: ' + selected);
    }
    for (const guard of ['owner', 'session', 'workspace', 'device', 'lease', 'consent']) {
      await start('disabled'); await page.evaluate(() => configTest.pending);
      const cleared = await page.evaluate(guard => {
        const t = configTest, workspace = t.s.getActiveWorkspace(), device = t.s.state.device;
        const context = t.runtime.snapshot();
        if (!context.configOutcome) throw Error('Missing initial diagnostic');
        let restore;
        if (guard === 'owner') { const u = t.c.user, s = t.c.session; t.c.setMockAuth({ id: 'foreign' }, s); restore = () => t.c.setMockAuth(u, s); }
        if (guard === 'session') { const u = t.c.user, s = t.c.session; t.c.setMockAuth(u, { ...s, access_token: 'synthetic-new-session' }); restore = () => t.c.setMockAuth(u, s); }
        if (guard === 'workspace') { t.s.activateWorkspace({ ...workspace }); restore = () => {}; }
        if (guard === 'device') { const old = device.deviceId; device.deviceId = 'synthetic-other-device'; restore = () => device.deviceId = old; }
        if (guard === 'lease' || guard === 'consent') {
          const key = guard === 'lease' ? 'rakeezx-offline-lease-v1:' + workspace.id : 'rakeezx-n44-consent:' + JSON.stringify([workspace.authUserId, workspace.databaseName, device.deviceId]);
          t.guardKey = key;
          const old = localStorage.getItem(key); localStorage.setItem(key, guard === 'lease' ? JSON.stringify({ renewalId: 'foreign' }) : 'foreign');
          restore = () => old === null ? localStorage.removeItem(key) : localStorage.setItem(key, old);
        }
        const hidden = t.runtime.snapshot().configOutcome === null;
        dispatchEvent(new StorageEvent('storage'));
        const clearedDom = !document.querySelector('[data-n44-config-outcome]');
        restore();
        return hidden && clearedDom && t.runtime.snapshot().configOutcome === null;
      }, guard);
      assert.equal(cleared, true, guard);
    }
    // Late response under a deactivated owner cannot populate even a hidden receipt.
    await start('late'); await page.waitForFunction(() => configTest.attempts === 1);
    while (!release) await new Promise(ok => setTimeout(ok, 10));
    await page.evaluate(() => configTest.s.deactivateWorkspace('synthetic-context-switch'));
    assert.equal(await page.locator('[data-n44-current-identity]').count(), 0);
    assert.equal(await page.locator('[data-n44-config-outcome]').count(), 0);
    release(); await page.evaluate(() => configTest.pending);
    assert.equal(await page.evaluate(() => configTest.runtime.snapshot().configOutcome), null);
    await page.evaluate(async () => { await configTest.runtime.refresh(); (await import('/src/app.js')).repaint(); });
    assert.equal(await page.locator('[data-n44-current-identity]').count(), 0); assert.equal(await page.locator('[data-n44-config-outcome]').count(), 0);
    assert.equal(await page.evaluate(() => configTest.attempts), 1);
    await page.evaluate(() => configTest.runtime.dispose());
    console.log('PASS context switch / late response / no context / disposal; no stale identity or diagnostic');
  });
  console.log('PASS n44_config_actual_http_and_finite_phase; n44_config_prewindow_identity_context_isolation; n44_config_empty_approval_disabled_normal_ui (controlled response fixture, not real PG/backend approval proof)');
} finally { release?.(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
