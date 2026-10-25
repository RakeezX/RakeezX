// AI: actual HTTP application, guarded synthetic account, existing native ports.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createECDH } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { installNative } from './n44-confirmed-projection-20261024/runtime.mjs';
import { createPushGateway, N44_CONFIG_SERVICE_PHASES } from '../src/lib/notification-push-gateway.js';
const taskId = 'continuous-n44-existing-config-phase-public-dependency-20261025';
const runId = '47a28f9b-b24d-4f46-92c7-4446135a956d';
const root = process.cwd(), curve = createECDH('prime256v1'); curve.generateKeys();
const publicKey = curve.getPublicKey().toString('base64url');
let mode = 'disabled', release;
const privateValue = 'PRIVATE_CONFIG_SENTINEL';
const phases = ['configuration', 'configuration_origin', 'configuration_revision', 'configuration_policy', 'configuration_transport', 'configuration_crypto', 'configuration_provider', 'connect', 'identity', 'set_role', 'private_session', 'source', 'ingress', 'query', 'deadline', 'registration_input', 'registration_auth', 'registration_protect', 'registration_repository'];
assert.deepEqual(N44_CONFIG_SERVICE_PHASES, phases);
function failureBody(selected) {
  if (selected === 'unknown') return JSON.stringify({error:'unavailable',phase:'private_future_phase'});
  if (selected === 'wrong_error') return JSON.stringify({error:'other',phase:'query'});
  if (selected === 'array') return '[{"error":"unavailable","phase":"query"}]';
  if (selected === 'null') return 'null';
  if (selected === 'prototype') return '{"error":"unavailable","phase":"query","__proto__":{}}';
  if (selected === 'nested_prototype') return '{"error":"unavailable","phase":"query","identity":{"constructor":{}}}';
  if (selected === 'malformed') return '{PRIVATE_CONFIG_SENTINEL';
  if (selected === 'utf8') return Buffer.from([0xff,0xfe]);
  if (selected === 'oversize') return JSON.stringify({error:'unavailable',phase:'query',padding:privateValue.repeat(110)});
  return JSON.stringify({error:'unavailable',phase: selected.startsWith('phase:') ? selected.slice(6) : 'query', identity:{loginExact:true,ownerId:privateValue},token:privateValue,stack:privateValue,url:privateValue});
}
const requests = [];
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname.startsWith('/api/n44/')) {
    requests.push(u.pathname);
    let body = { status: 'disabled' }, status = 200;
    if (u.pathname.endsWith('/push/config')) {
      const selected = mode;
      if (selected === 'late') {
        res.writeHead(503, {'content-type':'application/json'});
        res.write('{"error":"unavailable",');
        await new Promise(ok => release = ok);
        return res.end('"phase":"query"}');
      }
      if (selected.startsWith('phase:') || ['unknown','wrong_error','array','null','prototype','nested_prototype','malformed','utf8','oversize','nonjson'].includes(selected)) {
        res.writeHead(503, {'content-type':selected === 'nonjson' ? 'text/plain' : 'application/json; charset=utf-8'});
        return res.end(failureBody(selected));
      }
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
// AI: replaces the former blanket exact-config503 no-read assumption only.
// All other non-2xx requests must still avoid even acquiring a body reader.
const gateway = (fetcher, valid = () => true) => createPushGateway({context:{ownerId:'synthetic',workspaceId:'db',deviceId:'device'},storage:{getItem:()=>null},preferences:()=>({}),fetch:fetcher,valid});
for (const status of [400,401,403,404,413,429,500,502,504]) {
  let attempts=0;
  const g=gateway(async (url, init) => { attempts++; assert.equal(init.method,'POST'); return {ok:false,status,headers:new Headers({'content-type':'application/json'}),get body(){assert.fail('Forbidden non2xx body');},text(){assert.fail('Forbidden text');}}; });
  await assert.rejects(g.configuration(), e => {assert.deepEqual(e.configOutcome,{httpStatus:status,phase:'http'});return true;});
  assert.equal(attempts,1);
}
for (const type of [null,'text/plain','application/jsonp','application/problem+json']) {
  const g=gateway(async()=>({ok:false,status:503,headers:new Headers(type?{'content-type':type}:{}),get body(){assert.fail('Non-JSON body');}}));
  await assert.rejects(g.configuration(),e=>{assert.deepEqual(e.configOutcome,{httpStatus:503,phase:'http'});return true;});
}
let validContext=true;
await assert.rejects(gateway(async()=>{validContext=false;return {ok:false,status:503,headers:new Headers({'content-type':'application/json'}),get body(){assert.fail('Stale-context body');}};},()=>validContext).configuration(),e=>{assert.deepEqual(e.configOutcome,{httpStatus:503,phase:'context'});return true;});
for (const action of ['read','update','project','authorizationReceipt']) {
  let attempts=0;
  const g=gateway(async () => {attempts++;return {ok:false,status:503,headers:new Headers({'content-type':'application/json'}),get body(){assert.fail('Other action body');}};});
  const result=action==='authorizationReceipt'?await g[action]({}):await g[action](false).catch(()=>null);
  assert.equal(attempts,1);
  if(result) assert.equal(result.status,'unknown');
}
for (const kind of ['overflow','read_failure','exact_bytes','multibyte_overflow','utf8','prototype','constructor','missing_error','number','nonjson']) {
  let cancelled=false,reads=0;
  const g=gateway(async () => ({ok:false,status:503,headers:new Headers({'content-type':kind==='nonjson'?'text/plain':'application/json'}),
    body:new ReadableStream({pull(c){reads++;if(kind==='read_failure')return c.error(Error(privateValue));
      const base=JSON.stringify({error:'unavailable',phase:'query'});
      let bytes=new TextEncoder().encode(kind==='exact_bytes'?base+' '.repeat(2048-base.length):kind==='multibyte_overflow'?base+'é'.repeat(1024):kind==='utf8'?'':kind==='prototype'?'{"error":"unavailable","phase":"query","prototype":{}}':kind==='constructor'?'{"error":"unavailable","phase":"query","constructor":{}}':kind==='missing_error'?'{"phase":"query"}':kind==='number'?'{"error":"unavailable","phase":12}':base+' '.repeat(2049));
      if(kind==='utf8')bytes=new Uint8Array([255]);c.enqueue(bytes);if(!['overflow','multibyte_overflow','nonjson'].includes(kind))c.close();},cancel(){cancelled=true;}})}));
  await assert.rejects(g.configuration(), e=>{assert.deepEqual(e.configOutcome,kind==='exact_bytes'?{httpStatus:503,phase:'http',servicePhase:'query'}:{httpStatus:503,phase:'http'});assert.ok(!JSON.stringify(e.configOutcome).includes(privateValue));return true;});
  if(['overflow','multibyte_overflow'].includes(kind))assert.equal(cancelled,true);
}
console.log('PASS bounded bytes, cancellation, fatal decoding, shape rejection and all other non2xx no-read guards');
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
        const t = configTest; await t.runtime?.dispose(); t.attempts = 0; t.bodyRead = false;
        t.runtime = t.r.createPushRuntime({ store: t.s, cloud: t.c, navigate() {}, changed: () => import('/src/app.js').then(m => m.repaint()),
          fetch: async (url, init) => {
            if (String(url).endsWith('/push/config')) {
              t.attempts++;
              if (selected === 'read_failure') return {ok:false,status:503,headers:new Headers({'content-type':'application/json'}),body:new ReadableStream({start(c){c.error(Error('PRIVATE_CONFIG_SENTINEL'));}})};
              if (selected === 'body_deadline') return {ok:false,status:503,headers:new Headers({'content-type':'application/json'}),body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"error":"unavailable",'));}})};
            } else if (!String(url).endsWith('/context/read')) t.sideEffects++;
            const response = await fetch(url, init);
            if (selected === 'late') {
              const stream = response.body, getReader = stream.getReader.bind(stream);
              stream.getReader = (...args) => { t.bodyRead = true; return getReader(...args); };
            }
            return response;
          } });
        t.r.setPushRuntime(t.runtime); t.pending = t.runtime.refresh();
      }, selected);
    };
    for (const [selected, servicePhase] of [
      ...phases.map(p => ['phase:'+p,p]),
      ...['unknown','wrong_error','array','null','prototype','nested_prototype','malformed','utf8','oversize','nonjson','read_failure','body_deadline','disabled'].map(p=>[p,null]),
    ]) {
      const status = selected === 'disabled' ? 200 : 503;
      const phase = selected === 'body_deadline' ? 'deadline' : selected === 'disabled' ? 'complete' : 'http';
      const category = selected === 'disabled' ? 'disabled' : 'request_failed';
      if (selected === 'body_deadline') await page.clock.install();
      await start(selected);
      if (selected === 'body_deadline') await page.clock.runFor(15001);
      await page.evaluate(() => configTest.pending);
      const details = page.locator('[data-n44-config-outcome]'); await details.waitFor();
      if (await details.getAttribute('open') === null) await details.locator('summary').click();
      const text = await details.innerText(); assert.ok(text.includes(status ?? 'UNKNOWN'),selected+': '+text+' / '+JSON.stringify(await page.evaluate(()=>configTest.runtime.snapshot()))); assert.ok(text.includes(phase));
      const snapshot = await page.evaluate(() => configTest.runtime.snapshot());
      assert.deepEqual(snapshot.configOutcome, servicePhase ? { httpStatus: status, phase, servicePhase } : { httpStatus: status, phase });
      assert.equal(await details.locator('[data-n44-config-service-phase]').count(),servicePhase?1:0);
      if(servicePhase) assert.equal(await details.locator('[data-n44-config-service-phase]').innerText(),servicePhase);
      assert.ok(!JSON.stringify(snapshot).includes(privateValue));
      assert.ok(!JSON.stringify(snapshot).includes('loginExact'));
      assert.ok(!(await page.locator('body').innerHTML()).includes(privateValue));
      assert.ok(!(await details.innerText()).includes('loginExact'));
      assert.equal(await page.locator('[data-n44-config-outcome]').count(),1); assert.equal(snapshot.eligibility.configuration, category);
      if (selected === 'disabled') {
        assert.equal(snapshot.eligibility.reason, 'configuration_disabled'); assert.ok(text.includes('غير متاحة لهذه المساحة')); assert.ok(!text.includes('تعذر تحميل'));
      }
      assert.equal(await page.locator('[data-act="notification-push"]').count(), selected === 'ready' ? 1 : 0);
      assert.equal(await page.locator('[data-n44-current-identity]').count(), 1);
      if (await page.locator('[data-n44-current-identity]').getAttribute('open') === null) await page.locator('[data-n44-current-identity] summary').click();
      const identity = await page.locator('[data-n44-current-identity]').innerText();
      for (const value of [checkpoint.owner, checkpoint.context.workspaceId, checkpoint.context.deviceId]) assert.ok(identity.includes(value));
      assert.equal(await page.locator('[data-n44-source]').count(), 0);
      assert.equal(await page.evaluate(() => configTest.attempts), 1); assert.equal(await page.evaluate(() => configTest.sideEffects), 0);
      assert.ok(requests.every(p => p.endsWith('/push/config') || selected === 'ready' && p.endsWith('/context/read')));
      assert.equal(await details.locator('button').count(), 0);
      assert.ok(!(await page.locator('.n44-settings').innerText()).includes('PRIVATE_CONFIG_SENTINEL'));
      const layout = await page.locator('.n44-settings-page').evaluate(el => ({ visible: el.getBoundingClientRect().height > 0, overflow: document.documentElement.scrollWidth > innerWidth + 1, css: getComputedStyle(el).display }));
      assert.equal(layout.visible, true); assert.equal(layout.overflow, false); assert.notEqual(layout.css, 'none');
      if (selected === 'body_deadline') await page.clock.resume();
      console.log('PASS actual config -> runtime -> settings: ' + selected);
    }
    for (const guard of ['owner', 'session', 'workspace', 'device', 'lease', 'consent']) {
      await start('phase:query'); await page.evaluate(() => configTest.pending);
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
    await page.waitForFunction(() => configTest.bodyRead === true);
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
  console.log('PASS n44_existing_phase_bounded_exact_config503_only; n44_existing_phase_no_identity_or_raw_body_disclosure; n44_existing_phase_context_and_single_attempt (actual HTTP app, synthetic account; no live/backend proof)');
} finally { release?.(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
