// AI: mounted HTTP app, real settings handler/runtime/client/browser/gateway;
// disposable account fixture and deferred native ports, never device/service calls.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createECDH } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { installNative } from './n44-confirmed-projection-20261024/runtime.mjs';

const taskId = 'continuous-n44-permission-grant-race-20261030';
const runId = 'ebcb0f1c-abd3-4ecd-9d08-d496cfb44066';
const reproduce = process.argv.includes('--reproduce');
// Optional causal control serves only the pinned original runtime, not a mock.
const originalRuntime = reproduce ? execFileSync('git', ['show', '2ef68e981839db16450ad7927a0e9e8dd7a540c4:src/lib/notification-push-runtime.js']) : null;
const root = process.cwd(), curve = createECDH('prime256v1'); curve.generateKeys();
const publicKey = curve.getPublicKey().toString('base64url');
let enabled = false, remote = null, receipt = null, calls = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname.startsWith('/api/')) {
    let raw = ''; for await (const part of req) raw += part;
    const body = JSON.parse(raw || '{}'); calls.push(u.pathname);
    let value = { status: 'disabled' };
    if (enabled && u.pathname.endsWith('/push/config')) value = { status: 'ready', protocol: 'n44-browser-v2', capability: 'n44-single-device-20261019-v1', serviceRevision: 'n44-browser-service-v2', serviceSourceSha: 'a'.repeat(40), publicKey, expiresAt: Date.now() + 3600000, deliveryEnabled: false, schedulerEnabled: false };
    if (u.pathname.endsWith('/context/read')) value = { protocol: 'n44-browser-v2', status: remote ? 'current' : 'absent', context: remote, registration: receipt, expectedRevision: null };
    if (u.pathname.endsWith('/context/update')) {
      remote = { ...body, active: true, sessionRevision: 'synthetic-session', consentRevision: 'synthetic-consent', sessionExpiresAt: Date.now() + 3600000 };
      value = { status: 'updated', context: remote };
    }
    if (u.pathname.endsWith('/push/register')) value = receipt = { status: 'registered', registrationId: body.registrationId, expiresAt: Date.now() + 1800000 };
    if (u.pathname.endsWith('/push/revoke')) { receipt = null; value = { status: 'revoked' }; }
    if (u.pathname.endsWith('/events/update')) value = { status: 'updated', sourceStamp: 'b'.repeat(64) };
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(value));
  }
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const data = originalRuntime && u.pathname === '/src/lib/notification-push-runtime.js' ? originalRuntime : await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});

function installDeferredNative() {
  const n = window.n44Native;
  n.unsubscribes = 0; n.subscribes = 0; n.clears = 0;
  const permission = window.n44Permission = { state: 'default', onchange: null };
  Object.defineProperty(Notification, 'permission', { get: () => permission.state });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => permission } });
  const getRegistration = navigator.serviceWorker.getRegistration;
  navigator.serviceWorker.getRegistration = async () => {
    const r = await getRegistration();
    if (!r.active.countingClears) {
      const post = r.active.postMessage;
      r.active.postMessage = function (data, ports) {
        if (data.type === 'n44-consent-clear') n.clears++;
        return post.call(this, data, ports);
      };
      r.active.countingClears = true;
    }
    r.pushManager.subscribe = () => {
      n.subscribes++;
      return new Promise(resolve => { n.release = () => {
        const subscription = {
          endpoint: 'https://synthetic.invalid/deferred-n44',
          toJSON: () => ({ endpoint: subscription.endpoint, keys: { p256dh: 'synthetic', auth: 'synthetic' } }),
          async unsubscribe() { n.unsubscribes++; n.subscription = null; return true; },
        };
        n.subscription = subscription; resolve(subscription);
      }; });
    };
    return r;
  };
  n.permission = state => { permission.state = state; permission.onchange?.(); };
}

const count = suffix => calls.filter(p => p.endsWith(suffix)).length;
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}`;
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    const scenarios = reproduce ? ['grant'] : ['grant', 'idle-grant', 'denied', 'default', 'subscribed-denied', 'subscribed-default', 'owner', 'session', 'lease'];
    for (const scenario of scenarios) {
      enabled = false; remote = null; receipt = null; calls = [];
      const context = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
      await context.addInitScript(installNative); await context.addInitScript(installDeferredNative);
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      try {
        await openReadyServedDemo(page, url); enabled = true;
        assert.deepEqual(await page.evaluate(async () => (await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare()), { ownerMatches: true, receiptMatches: true, editable: true });
        await page.waitForFunction(async () => {
          const r = (await import('/src/lib/notification-push-runtime.js')).getPushRuntime();
          return typeof n44Permission.onchange === 'function' && r.snapshot().available;
        });
        // Observe the real runtime result without replacing any guard or handler.
        await page.evaluate(async () => {
          const m = await import('/src/lib/notification-push-runtime.js'), r = m.getPushRuntime();
          m.setPushRuntime({ ...r, async optIn() { const value = await r.optIn(); window.n44Result = value; return value; } });
        });
        const button = page.locator('[data-act="notification-push"]');
        await button.waitFor();
        assert(await button.evaluate(el => getComputedStyle(el).display !== 'none'));
        if (scenario === 'idle-grant') {
          await page.evaluate(() => n44Native.permission('granted'));
          await page.evaluate(async () => (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().refresh());
          assert.equal(await page.evaluate(() => n44Native.subscribes), 0);
        }
        await button.click();
        await page.waitForFunction(() => n44Native.subscribes === 1 && typeof n44Native.release === 'function');
        if (['owner', 'session', 'lease'].includes(scenario)) await page.evaluate(async scenario => {
          const cloud = await import('/src/lib/cloud.js');
          if (scenario === 'owner') cloud.setMockAuth({ id: 'b4400000-0000-4000-8000-000000000002' }, { access_token: 'synthetic-other-owner' });
          if (scenario === 'session') {
            const session = { ...cloud.session, access_token: 'synthetic-new-session' };
            localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session)); cloud.setMockAuth(cloud.user, session);
          }
          if (scenario === 'lease') {
            const s = await import('/src/store.js'), { LEASE_STORAGE_PREFIX } = await import('/src/lib/offline-lease.js');
            localStorage.removeItem(LEASE_STORAGE_PREFIX + s.getActiveWorkspace().id);
          }
        }, scenario);
        const next = ['denied', 'default'].includes(scenario) ? scenario : 'granted';
        const clearsBefore = await page.evaluate(() => n44Native.clears);
        // Native permission changes before subscribe resolves: the causal race.
        await page.evaluate(next => n44Native.permission(next), next);
        await page.evaluate(() => n44Native.release());
        await page.waitForFunction(() => !!window.n44Result);
        const observed = await page.evaluate(async () => ({ result: n44Result.status, unsubscribes: n44Native.unsubscribes, clears: n44Native.clears, status: (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().snapshot().status }));
        const rejected = ['denied', 'default', 'owner', 'session', 'lease'].includes(scenario) || reproduce;
        assert.equal(observed.result, rejected ? 'stale_context' : 'subscribed', JSON.stringify({ scenario, observed }));
        assert.equal(count('/push/register'), rejected ? 0 : 1);
        assert.equal(observed.unsubscribes, rejected ? 1 : 0);
        if (!rejected) assert.equal(observed.clears, clearsBefore, 'grant must not retire worker consent');
        if (scenario.startsWith('subscribed-')) {
          const revokesBefore = count('/push/revoke');
          await page.evaluate(state => n44Native.permission(state), scenario.slice('subscribed-'.length));
          await page.waitForFunction(() => n44Native.unsubscribes === 1 && n44Native.binding === null);
          await page.waitForFunction(async () => (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().snapshot().status !== 'subscribed');
          assert.equal(count('/push/revoke'), revokesBefore + 1);
          assert.equal(count('/push/register'), 1, 'revocation never registers again');
          observed.afterRevocation = await page.evaluate(() => ({ unsubscribes: n44Native.unsubscribes, binding: n44Native.binding }));
        }
        console.log(JSON.stringify({ scenario, ...observed, registers: count('/push/register'), reproduction: reproduce }));
      } finally {
        await page.evaluate(async () => (await import('/src/lib/notification-push-runtime.js')).getPushRuntime()?.dispose()).catch(() => {});
        await context.close();
      }
    }
  });
  console.log(reproduce ? 'REPRODUCED original mounted permission race: stale_context/register0/unsubscribe1' : 'PASS n44_first_permission_grant_preserves_optin; n44_non_granted_permission_revokes_and_cleans; n44_permission_event_preserves_owner_session_guards');
} finally {
  server.closeAllConnections(); await new Promise(ok => server.close(ok));
}
