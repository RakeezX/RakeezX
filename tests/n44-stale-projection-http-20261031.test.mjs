// AI: exact HTTP400 transport boundary and actual mounted application regression.
import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createECDH } from 'node:crypto';
import { createPushGateway } from '../src/lib/notification-push-gateway.js';
import { withIsolatedLocalBrowser } from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { installNative } from './n44-confirmed-projection-20261024/runtime.mjs';

const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const scope = { ownerId: 'synthetic-owner', workspaceId: 'synthetic-workspace', deviceId: 'synthetic-device' };
const json = (body, status = 400, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const stale = sourceStamp => ({ status: 'stale', sourceStamp });
function fixture(respond, options = {}) {
  const calls = [];
  const gateway = createPushGateway({ context: scope, authorization: () => 'Bearer synthetic', storage: { getItem: () => null },
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body), init }); return respond(calls.length, init); }, ...options });
  return { calls, gateway };
}
const reject = async (gateway, disposition = 'rejected') => assert.rejects(gateway.project('due', 'source', C), error => (error.projectionDisposition ?? 'unknown') === disposition);

test('n44_http400_stale_single_cas_recovery', async () => {
  for (const stamp of [A, null]) {
    const { gateway, calls } = fixture(n => n === 1 ? json(stale(stamp)) : json({ status: 'updated', sourceStamp: B }, 200));
    assert.equal(await gateway.project('due', 'source', C), B);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(c => c.body), [
      { workspaceId: scope.workspaceId, deviceId: scope.deviceId, kind: 'due', sourceId: 'source', expectedStamp: C },
      { workspaceId: scope.workspaceId, deviceId: scope.deviceId, kind: 'due', sourceId: 'source', expectedStamp: stamp },
    ]);
    for (const c of calls) {
      assert.equal(c.url, '/api/n44/events/update'); assert.equal(c.init.credentials, 'omit');
      assert.equal(c.init.redirect, 'error'); assert.equal(c.init.cache, 'no-store');
      assert.equal(c.init.headers.authorization, 'Bearer synthetic'); assert.equal(c.init.headers['x-n44-csrf'], '1');
    }
  }
  const twice = fixture(() => json(stale(A)));
  await reject(twice.gateway); assert.equal(twice.calls.length, 2);
});

test('n44_stale_response_boundaries_and_context_fence', async () => {
  const invalid = [
    () => json({ ...stale(A), extra: true }), () => json({ status: 'stale' }),
    ...['A'.repeat(64), 'a'.repeat(63), 1, {}, [], false].map(v => () => json(stale(v))),
    () => json({ status: 'rejected', sourceStamp: A }), () => json([stale(A)]), () => json(null),
    () => json(stale(A), 400, 'text/plain'), () => new Response(JSON.stringify(stale(A)), { status: 400 }),
    () => new Response('{', { status: 400, headers: { 'content-type': 'application/json' } }),
    () => new Response(' '.repeat(2048) + JSON.stringify(stale(A)), { status: 400, headers: { 'content-type': 'application/json' } }),
    () => json({ ...stale(A), __proto__: null, constructor: 'bad' }),
    ...[401, 403, 429].map(status => () => json(stale(A), status)),
  ];
  for (const respond of invalid) { const f = fixture(respond); await reject(f.gateway); assert.equal(f.calls.length, 1); }
  // Streamed size limit must stop before EOF and cancel the owned reader.
  let cancelled = false;
  const oversized = fixture(() => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(2049)); }, cancel() { cancelled = true; } }), { status: 400, headers: { 'content-type': 'application/json' } }));
  await reject(oversized.gateway); assert.equal(cancelled, true); assert.equal(oversized.calls.length, 1);
  for (const reason of ['context', 'credential']) {
    let current = true, release;
    const f = fixture(() => new Response(new ReadableStream({ start(c) { release = () => { current = false; c.enqueue(new TextEncoder().encode(JSON.stringify(stale(A)))); c.close(); }; } }), { status: 400, headers: { 'content-type': 'application/json' } }), { valid: () => current, authorization: () => reason === 'credential' && !current ? null : 'Bearer synthetic' });
    const attempt = reject(f.gateway, 'unknown'); await Promise.resolve(); release(); await attempt; assert.equal(f.calls.length, 1);
  }
  // Another owned action must never accept the events/update exception.
  const config = fixture(() => json(stale(A)));
  await assert.rejects(config.gateway.configuration()); assert.equal(config.calls.length, 1);
  const mixed = fixture(n => n === 1 ? json(stale(A), 400, 'Application/JSON; charset=utf-8') : json({ status: 'updated', sourceStamp: B }, 200));
  assert.equal(await mixed.gateway.project('due', 'source', C), B); assert.equal(mixed.calls.length, 2);
});

test('transport,503,lost response and body deadline remain one UNKNOWN attempt', async () => {
  for (const respond of [() => { throw Error('transport lost'); }, () => json(stale(A), 503),
    () => new Response(new ReadableStream({ start(c) { c.error(Error('lost body')); } }), { status: 200 })]) {
    const f = fixture(respond); await reject(f.gateway, 'unknown'); assert.equal(f.calls.length, 1);
  }
  // Use the actual15s gateway deadline, including an indefinitely delayed400 body.
  let cancelled = false;
  const f = fixture(() => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 400, headers: { 'content-type': 'application/json' } }));
  await reject(f.gateway, 'unknown'); assert.equal(f.calls.length, 1); assert.equal(cancelled, true);
});

test('n44_mounted_projection_ack_and_unknown_replay_guard', { timeout: 120000 }, async () => {
  const taskId = 'continuous-n44-stale-projection-http-20261031', runId = '9b8abb69-a965-46d4-b2ef-b2a0cb3d8a1b';
  const curve = createECDH('prime256v1'); curve.generateKeys(); const publicKey = curve.getPublicKey().toString('base64url');
  const root = process.cwd(), mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  let enabled = false, remote = null, receipt = null, mode, projects = [];
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname.startsWith('/api/n44/')) {
        let raw = ''; for await (const part of req) raw += part;
        const body = JSON.parse(raw || '{}'); let value = { status: 'disabled' }, status = 200;
        if (u.pathname.endsWith('/push/config') && enabled) value = { status: 'ready', protocol: 'n44-browser-v2', capability: 'n44-single-device-20261019-v1', serviceRevision: 'n44-browser-service-v2', serviceSourceSha: 'a'.repeat(40), publicKey, expiresAt: Date.now() + 3600000, deliveryEnabled: false, schedulerEnabled: false };
        if (u.pathname.endsWith('/context/read')) value = { protocol: 'n44-browser-v2', status: remote ? 'current' : 'absent', context: remote, registration: receipt, expectedRevision: null };
        if (u.pathname.endsWith('/context/update')) { remote = { ...body, active: true, sessionRevision: 'synthetic-session', consentRevision: 'synthetic-consent', sessionExpiresAt: Date.now() + 3600000 }; value = { status: 'updated', context: remote }; }
        if (u.pathname.endsWith('/push/register')) { receipt ??= { status: 'registered', registrationId: body.registrationId, expiresAt: Date.now() + 1800000 }; value = receipt; }
        if (u.pathname.endsWith('/push/revoke')) { receipt = null; value = { status: 'revoked' }; }
        if (u.pathname.endsWith('/events/update')) {
          projects.push(body);
          if (mode === 'unknown') { status = 503; value = { status: 'unavailable' }; }
          else if (projects.filter(p => p.kind === body.kind && p.sourceId === body.sourceId).length === 1) { status = 400; value = stale(A); }
          else value = { status: 'updated', sourceStamp: B };
        }
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(value));
      }
      const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      const bytes = await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  try {
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
    const url = 'http://127.0.0.1:' + server.address().port;
    await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/' + taskId + '.json', runId, url, timeoutMs: 110000 }, async ({ createContext }) => {
      for (mode of ['stale', 'unknown']) {
        enabled = false; remote = null; receipt = null; projects = [];
        const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
        await context.addInitScript(installNative); const page = await context.newPage(); page.setDefaultTimeout(15000);
        try {
          await openReadyServedDemo(page, url); enabled = true;
          assert.deepEqual(await page.evaluate(async () => (await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare()), { ownerMatches: true, receiptMatches: true, editable: true });
          await page.locator('[data-act="notification-push"]').click();
          await page.waitForFunction(async () => (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().snapshot().status === 'subscribed');
          await page.waitForFunction(() => n44Native.projected.includes('n44-due') && n44Native.inflight === 0);
          await page.waitForFunction(async mode => {
            const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime();
            return n44Native.inflight === 0 && (mode === 'unknown' ? r.snapshot().eligibility.reason === 'projection_unknown'
              : n44Native.projected.filter(id => id === 'n44-due').length === 2 && !Object.keys(localStorage).some(k => k.startsWith('rakeezx-n44-projection-pending:')));
          }, mode);
          const rows = projects.filter(p => p.sourceId === 'n44-due');
          assert.equal(rows.length, mode === 'stale' ? 2 : 1);
          assert.equal(rows[0].expectedStamp, null);
          if (mode === 'stale') { assert.equal(rows[1].expectedStamp, A); assert.deepEqual({ ...rows[1], expectedStamp: null }, rows[0]); }
          const observed = await page.evaluate(async () => {
            const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime();
            return { pending: Object.keys(localStorage).filter(k => k.startsWith('rakeezx-n44-projection-pending:')), reason: r.snapshot().eligibility.reason,
              display: getComputedStyle(document.querySelector('.n44-settings-page')).display };
          });
          // Read grade in the same current document checkpoint (not a serialized Promise).
          assert.equal(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('scores'))[0].value), 4);
          assert.notEqual(observed.display, 'none');
          if (mode === 'stale') { assert.equal(observed.pending.length, 0); assert.notEqual(observed.reason, 'projection_rejected'); }
          else { assert.ok(observed.pending.some(k => k.includes('n44-due'))); assert.equal(observed.reason, 'projection_unknown'); }
          const count = projects.length;
          await page.evaluate(async () => { const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime(); await r.refresh(); r.snapshot(); r.normalUiSnapshot(); (await import('/src/app.js')).repaint(); });
          await page.waitForTimeout(150); assert.equal(projects.length, count);
          if (mode === 'unknown') {
            await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'); await (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().projectConfirmedSources({ workspace: s.getActiveWorkspace(), session: c.session }); });
            assert.equal(projects.length, count);
          }
          // Actual owner guard must still fence an explicit foreign-owner checkpoint.
          await page.evaluate(async () => { const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js'), guard = (await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard; guard.setWorkspace({ ...s.getActiveWorkspace(), authUserId: 'b4400000-0000-4000-8000-000000000002' }); try { await (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().projectConfirmedSources({ workspace: s.getActiveWorkspace(), session: c.session }); } finally { guard.setWorkspace(s.getActiveWorkspace()); } });
          assert.equal(projects.length, count);
          await page.evaluate(async () => (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().dispose());
        } finally { await context.close(); }
      }
    });
  } finally { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
});
