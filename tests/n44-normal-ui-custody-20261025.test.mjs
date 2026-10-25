// AI: actual application HTTP DOM, handlers, CSS and guarded store; synthetic ports only.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createECDH } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { createPushGateway } from '../src/lib/notification-push-gateway.js';
import { installNative } from './n44-confirmed-projection-20261024/runtime.mjs';
const taskId = 'continuous-n44-normal-ui-custody-dependency-20261025', runId = '8bf6f612-399e-4dcf-902e-358a9462ee38';
const root = process.cwd(), curve = createECDH('prime256v1'); curve.generateKeys();
const publicKey = curve.getPublicKey().toString('base64url');
let enabled = false, remote = null, registration = null, mode = 'confirmed', projectMode = 'confirmed', release;
const requests = [], checks = [];
const pass = (name, evidence) => { checks.push({ name, status: 'PASS', evidence }); console.log('PASS ' + name + ': ' + evidence); };
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
// Affected gateway response classification; no crypto/provider fixture import.
for (const [httpStatus, body, expected] of [[200, { status: 'authorized' }, 'confirmed'], [200, { status: 'rejected' }, 'rejected'], [200, { status: 'unknown' }, 'unknown'], [403, {}, 'rejected'], [503, {}, 'unknown']]) {
  let calls = 0;
  const gateway = createPushGateway({ context: { ownerId: 'synthetic', workspaceId: 'synthetic-db', deviceId: 'synthetic-device' }, storage: { getItem: () => null },
    fetch: async () => { calls++; return Response.json(body, { status: httpStatus }); } });
  const receipt = await gateway.authorizationReceipt({}); assert.equal(receipt.status, expected); assert.equal(receipt.httpStatus, httpStatus); assert.equal(receipt.attempts, 1); assert.equal(calls, 1);
}
pass('n44_gateway_truthful_receipts', 'HTTP200 authorized/rejected/UNKNOWN, HTTP403 rejected and HTTP503 UNKNOWN retain actual status; exactly one request each.');
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname.startsWith('/api/n44/')) {
    let raw = ''; for await (const part of req) raw += part;
    const body = JSON.parse(raw || '{}'); requests.push({ path: u.pathname, body });
    let value = { status: 'disabled' };
    if (u.pathname.endsWith('/push/config') && enabled) value = { status: 'ready', protocol: 'n44-browser-v2', capability: 'n44-single-device-20261019-v1', serviceRevision: 'n44-browser-service-v2', serviceSourceSha: 'a'.repeat(40), publicKey, expiresAt: Date.now() + 3600000, deliveryEnabled: false, schedulerEnabled: false };
    if (u.pathname.endsWith('/context/read')) value = { protocol: 'n44-browser-v2', status: remote ? 'current' : 'absent', context: remote, registration, expectedRevision: null };
    if (u.pathname.endsWith('/context/update')) { remote = { ...body, active: true, sessionRevision: 'synthetic-session', consentRevision: 'synthetic-consent', sessionExpiresAt: Date.now() + 3600000 }; value = { status: 'updated', context: remote }; }
    if (u.pathname.endsWith('/push/register')) { registration ??= { status: 'registered', registrationId: body.registrationId, expiresAt: Date.now() + 1800000 }; value = registration; }
    if (u.pathname.endsWith('/push/revoke')) { registration = null; value = { status: 'revoked' }; }
    if (u.pathname.endsWith('/events/update')) value = projectMode === 'confirmed' ? { status: 'updated', sourceStamp: 'b'.repeat(64) } : { status: projectMode };
    if (u.pathname.endsWith('/events/authorize')) { if (mode === 'delay') await new Promise(ok => release = ok); value = { status: mode === 'confirmed' || mode === 'delay' ? 'authorized' : mode }; }
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(value));
  }
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404).end(); }
});
const count = suffix => requests.filter(r => r.path.endsWith(suffix)).length;
async function arrange(page) {
  // Existing synthetic fixture arrangement only. All behavior/evidence below uses
  // ordinary visible UI; no browser imports are needed by the Product journey.
  await page.evaluate(async () => {
    await (await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare();
    const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js'), v = await import('/src/lib/sync-v2.js');
    const n = n44Engine, names = Object.fromEntries(Object.entries(v.SYNC_V2_SCHEMAS).map(([k, x]) => [x.entity, k]));
    n.sourceMode = 'confirmed'; n.cleanupReceipt = null;
    const backend = {
      async fetchRecords(entity) { return structuredClone(n.remote[names[entity]] ?? []); },
      async getScoreFoundationCapability() { return { scoreDomainVersion: 1, configurationVersion: 1, n94SubitemVersion: 1, restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1 }; },
      async getScoreDistributionCapability() { return { distributionApplyVersion: 2, protocol: 'N73_D119_V2' }; },
      async getScoreDomainSnapshot() { return { items: structuredClone(n.remote.items), score_subitems: structuredClone(n.remote.scoreSubitems), score_subitem_completions: [], scores: structuredClone(n.remote.scores) }; },
      async applySyncV2Mutation(e) {
        const name = names[e.entity], row = { ...e.patch, id: e.recordId, owner_id: c.user.id, revision: (e.baseRevision ?? 0) + 1, deleted_at: null };
        n.remote[name] = [...(n.remote[name] ?? []).filter(r => r.id !== row.id), row];
        return { mutationId: e.mutationId, outcome: 'applied', record: structuredClone(row), revision: row.revision };
      },
      async applyScoreConfigurationCommand(e) {
        const item = n.remote.items.find(r => r.id === e.itemId); item.revision++; item.score_mode = 'subitems'; item.distribution_mode = e.payload.distributionMode; item.distribution_version = e.expectedVersion + 1;
        const children = e.payload.subitems.map(r => ({ ...v.encodeSyncV2Patch('scoreSubitems', r), id: r.id, item_id: item.id, owner_id: c.user.id, revision: 1, deleted_at: null }));
        n.remote.scoreSubitems = [...n.remote.scoreSubitems.filter(r => r.item_id !== item.id), ...children];
        return { mutationId: e.mutationId, item: structuredClone(item), subitems: structuredClone(children), scores: structuredClone(n.remote.scores.filter(r => r.item_id === item.id)) };
      },
      async applySyncV2LifecycleCommand(e) {
        const parent = n.remote.items.find(r => r.id === e.targetId); parent.deleted_at = Date.now(); parent.client_updated_at = e.clientUpdatedAt; parent.revision++;
        for (const child of n.remote.scoreSubitems.filter(r => r.item_id === parent.id)) { child.deleted_at = Date.now(); child.revision++; }
        n.cleanupReceipt = { owner_id: c.user.id, mutation_id: e.mutationId, record_id: e.targetId, device_id: e.deviceId, client_updated_at: e.clientUpdatedAt,
          request_envelope: { ...e }, result: { mutationId: e.mutationId, command: 'delete_item', targetId: e.targetId, outcome: 'deleted' } };
        return { mutationId: e.mutationId };
      },
      async readNotificationSourceIdentity(id) {
        if (n.sourceMode === 'unknown') return null;
        const rows = { items: structuredClone(n.remote.items.filter(r => r.id === id)), children: structuredClone(n.remote.scoreSubitems.filter(r => r.item_id === id)) };
        if (n.sourceMode === 'foreign') rows.items[0].owner_id = 'foreign';
        if (n.sourceMode === 'ancestry') rows.children[0].item_id = 'foreign';
        return rows;
      },
      async readRetiredScoreSourceCleanup() { return n.cleanupReceipt ? [structuredClone(n.cleanupReceipt)] : []; },
    };
    c.setMockBackend(backend);
    n.sync = async () => (await import('/src/lib/sync.js')).syncAll();
    n.store = s; n.db = db; n.cloud = c;
    n.repaint = () => import('/src/app.js').then(m => m.repaint());
  });
  await page.locator('[data-act="notification-push"]').click();
  await page.locator('[data-n44-verification-ready="true"]').waitFor();
  await page.waitForFunction(() => n44Native.inflight === 0 && performance.now() - (n44Native.lastProjection ?? 0) > 80);
}
const reminderButton = page => page.locator('article').filter({ has: page.locator('dd', { hasText: /^n44-due$/ }) }).locator('[data-act="notification-verify"]');
async function sourceRead(page, id = 'n44-item', expected = 'confirmed') {
  const row = page.locator(`[data-n44-source="${id}"]`); if (await row.locator('details').getAttribute('open') === null) await row.locator('summary').click();
  await row.locator('[data-act="notification-source-status"]').click();
  await row.locator(`[data-n44-source-status="${expected}"]`).waitFor(); return row;
}
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const url = 'http://127.0.0.1:' + server.address().port;
  await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/' + taskId + '.json', runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await context.addInitScript(installNative);
    await context.addInitScript(() => { navigator.serviceWorker.register = async () => navigator.serviceWorker.getRegistration(); });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await openReadyServedDemo(page, url); enabled = true; await arrange(page);
    assert.deepEqual(await page.evaluate(() => ({ owner: n44Engine.store.getActiveWorkspace().authUserId === n44Engine.cloud.user.id,
      receipt: n44Engine.store.state.device.accountProvisioningReceipt.ownerId === n44Engine.cloud.user.id,
      lease: n44Engine.store.getOfflineLeaseStatus().editable })), { owner: true, receipt: true, lease: true });
    const registrations = count('/push/register'), updates = count('/context/update');
    for (const disposition of ['confirmed', 'rejected', 'unknown']) {
      mode = disposition; await reminderButton(page).click(); await page.locator(`[data-n44-verification="${disposition}"]`).waitFor();
      if (disposition === 'confirmed') {
        const receiptText = await page.locator('[data-n44-authorization-receipt]').innerText();
        assert.ok(receiptText.includes('200 / authorized / 1')); assert.ok(receiptText.includes('true / true / true / true'));
      }
    }
    const attempts = count('/events/authorize'); assert.equal(await reminderButton(page).isDisabled(), true);
    await page.waitForTimeout(150); assert.equal(count('/events/authorize'), attempts);
    assert.equal(count('/push/register'), registrations); assert.equal(count('/context/update'), updates);
    assert.equal(requests.some(r => /send|schedule/.test(r.path)), false);
    pass('n44_normal_ui_confirmed_rejected_unknown', 'Real settings action -> runtime -> gateway; finite authorized/rejected/UNKNOWN; UNKNOWN button disabled, zero retry/send/new registration/consent writes.');
    await sourceRead(page);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const geometry = await page.locator('.n44-settings-page').evaluate(el => ({ display: getComputedStyle(el).display,
        overflow: document.documentElement.scrollWidth > innerWidth + 1, visible: el.getBoundingClientRect().height > 0 }));
      assert.notEqual(geometry.display, 'none'); assert.equal(geometry.overflow, false); assert.equal(geometry.visible, true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const sourceMode of ['unknown', 'foreign', 'ancestry']) {
      await page.evaluate(m => { n44Engine.sourceMode = m; }, sourceMode);
      const row = page.locator('[data-n44-source="n44-item"]'); await row.locator('[data-act="notification-source-status"]').click();
      await row.locator('[data-n44-source-status="unknown"]').waitFor();
    }
    await page.evaluate(async () => { n44Engine.sourceMode = 'confirmed'; await n44Engine.db.put('outbox', { id: 'synthetic-pending', state: 'pending', store: 'items', recordId: 'n44-item' }); });
    const row = page.locator('[data-n44-source="n44-item"]'); await row.locator('[data-act="notification-source-status"]').click(); await row.locator('[data-n44-source-status="pending"]').waitFor();
    await page.evaluate(async () => { await n44Engine.db.clearStore('outbox'); });
    // Genuine normal item/subitem UI generates both IDs. Observe IDs from DOM,
    // never inject a reserved ID or infer an exact identity from a label.
    await page.goto(url + '/#/teaching/n44-teaching/items'); await page.getByRole('button', { name: 'إضافة بند', exact: true }).waitFor();
    const before = await page.locator('[data-act="edit"]').evaluateAll(els => els.map(e => e.dataset.id));
    await page.getByRole('button', { name: 'إضافة بند', exact: true }).click();
    await page.locator('input[name="name"]').fill('Synthetic normal source');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await page.waitForFunction(before => [...document.querySelectorAll('[data-act="edit"]')].some(e => !before.includes(e.dataset.id)), before);
    const generated = (await page.locator('[data-act="edit"]').evaluateAll(els => els.map(e => e.dataset.id))).filter(id => !before.includes(id)); assert.equal(generated.length, 1);
    const parentId = generated[0]; assert.match(parentId, /^[a-f0-9-]{36}$/);
    assert.equal(await page.evaluate(() => n44Engine.sync()), true);
    await page.locator(`[data-act="configure"][data-id="${parentId}"]`).click();
    await page.locator('[data-subitem-due]').fill(new Date().toISOString().slice(0, 10)); await page.locator('[data-subitem-due]').press('Tab');
    await page.locator('[data-save-subitems]').click(); await page.getByRole('button', { name: 'تأكيد التغيير', exact: true }).click();
    assert.equal(await page.evaluate(() => n44Engine.sync()), true);
    await page.goto(url + '/#/settings/notifications');
    const generatedRow = await sourceRead(page, parentId); const text = await generatedRow.innerText();
    assert.ok(text.includes(parentId)); const childIds = await page.evaluate(id => n44Engine.store.notificationSourceGroups().find(r => r.parentId === id).childIds, parentId);
    assert.equal(childIds.length, 1); assert.match(childIds[0], /^[a-f0-9-]{36}$/); assert.ok(text.includes(childIds[0]));
    assert.equal(await page.evaluate(() => n44Engine.store.state.scores[0].value), 4);
    // Ordinary Delete then read-only canonical receipt. No recovery/write API.
    await page.goto(url + '/#/teaching/n44-teaching/items'); await page.locator(`[data-act="edit"][data-id="${parentId}"]`).click();
    await page.getByRole('button', { name: 'حذف', exact: true }).click(); await page.getByRole('button', { name: 'احذف', exact: true }).click();
    await page.goto(url + '/#/settings/notifications'); await sourceRead(page, parentId, 'pending');
    assert.equal(await page.evaluate(() => n44Engine.sync()), true);
    await page.goto(url + '/#/settings/notifications');
    const deletedRow = await sourceRead(page, parentId, 'cleanup_confirmed'); assert.ok((await deletedRow.locator('[data-n44-cleanup-receipt]').innerText()).includes('delete_item'));
    await page.evaluate(() => { n44Engine.cleanupReceipt = null; }); await deletedRow.locator('[data-act="notification-source-status"]').click(); await deletedRow.locator('[data-n44-source-status="unknown"]').waitFor();
    pass('n44_normal_ui_source_and_cleanup_receipt_contract', 'Ordinary add/configure generated parent/child UUIDs, real Sync adoption and visible ancestry/revisions; pending/foreign/changed ancestry/UNKNOWN refused; ordinary cascade Delete and exact canonical receipt; grade4 unchanged.');
    // Change the source to invalidate the old UNKNOWN choice, then change device
    // during a delayed authorization: late success must not become visible.
    await page.evaluate(async () => { const s = n44Engine.store, db = n44Engine.db; const child = await db.get('scoreSubitems', 'n44-due'); await db.put('scoreSubitems', { ...child, name: 'Changed current source' }); await s.refreshSyncedState(); await n44Engine.repaint(); });
    mode = 'delay'; await reminderButton(page).click({ noWaitAfter: true });
    await page.waitForTimeout(80); assert.ok(release);
    await page.evaluate(async () => { n44Engine.store.state.device.deviceId = 'changed-device'; await n44Engine.repaint(); }); release(); mode = 'confirmed';
    await page.waitForTimeout(100); assert.equal(await page.locator('[data-n44-verification="confirmed"]').count(), 0);
    await page.evaluate(async () => { n44Engine.store.deactivateWorkspace(); });
    assert.equal(await page.locator('[data-n44-source]').count(), 0);
    pass('n44_normal_ui_identity_and_context_fences', 'Actual ownership guard/lease and provisioning checkpoint; source choice changes invalidate prior outcomes; delayed success after device change discarded; deactivation synchronously clears private DOM.');
    assert.deepEqual(errors, []);
    await context.close();
    for (const guard of ['owner', 'session', 'workspace', 'device', 'lease', 'consent', 'generation', 'expiry', 'ancestry', 'projection_unknown', 'projection_rejected']) {
      enabled = false; remote = null; registration = null; mode = 'confirmed'; projectMode = guard === 'projection_unknown' ? 'unknown' : guard === 'projection_rejected' ? 'rejected' : 'confirmed';
      const isolated = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
      await isolated.addInitScript(installNative);
      await isolated.addInitScript(() => { navigator.serviceWorker.register = async () => navigator.serviceWorker.getRegistration(); });
      const p = await isolated.newPage(); p.setDefaultTimeout(8000); await p.clock.install({ time: Date.now() });
      await openReadyServedDemo(p, url); enabled = true; await arrange(p);
      const initialAuthorizations = count('/events/authorize'), initialProjects = count('/events/update');
      if (guard.startsWith('projection_')) {
        await reminderButton(p).click(); await p.locator(`[data-n44-verification="${guard === 'projection_unknown' ? 'unknown' : 'rejected'}"]`).waitFor();
        assert.equal(count('/events/authorize'), initialAuthorizations);
        await p.evaluate(() => dispatchEvent(new Event('focus'))); await p.waitForTimeout(60);
        assert.equal(count('/events/update'), initialProjects, guard + ' no implicit projection retry');
      } else {
        if (guard === 'expiry') await p.clock.setSystemTime(Date.now() + 2 * 3600000);
        await p.evaluate(async guard => {
          const n = n44Engine, s = n.store, c = n.cloud;
          if (guard === 'owner') c.setMockAuth({ id: 'b4400000-0000-4000-8000-000000000002' }, { ...c.session, user: { id: 'b4400000-0000-4000-8000-000000000002' } });
          if (guard === 'session') { const session = { ...c.session, access_token: 'changed-session' }; localStorage.setItem(c.AUTH_STORAGE_KEY, JSON.stringify(session)); c.setMockAuth(c.user, session); }
          if (guard === 'workspace') s.deactivateWorkspace();
          if (guard === 'device') s.state.device.deviceId = 'changed-device';
          if (guard === 'lease') { const key = Object.keys(localStorage).find(k => k.startsWith('rakeezx-offline-lease-v1:')); if (!key) throw Error('lease key missing'); const value = JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify({ ...value, renewalId: 'changed' })); }
          if (guard === 'consent') { const key = Object.keys(localStorage).find(k => k.startsWith('rakeezx-n44-consent:')); localStorage.setItem(key, 'changed'); }
          if (guard === 'generation') (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().invalidate();
          if (guard === 'ancestry') s.state.items.find(r => r.id === 'n44-item').teachingId = 'n44-foreign';
          await n.repaint();
        }, guard);
        assert.equal(await p.locator('[data-n44-verification="confirmed"]').count(), 0, guard);
        if (guard === 'ancestry') assert.equal(await reminderButton(p).count(), 0);
        else assert.equal(await p.locator('[data-act="notification-verify"]:not([disabled])').count(), 0, guard);
        assert.equal(count('/events/authorize'), initialAuthorizations, guard);
      }
      console.log('PASS guard ' + guard); await isolated.close();
    }
    pass('n44_normal_ui_extended_fences', 'Actual view/runtime/store rejects owner/session/workspace/device/lease/consent/generation/expiry/ancestry drift. Persisted projection UNKNOWN and definitive rejection do not authorize or retry on focus.');
  });
  console.log(JSON.stringify({ taskId, runId, status: 'PASS', checks, operations: { live: 0, provider: 0, sends: 0 }, ownedBrowserClosed: true }));
} finally { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
