import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MessageChannel} from 'node:worker_threads';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const pendingOnly=process.argv.includes('--pending-only');
const coldOnly=process.argv.includes('--cold-only'),compatOnly=process.argv.includes('--compat-only');
const baseline=process.argv.includes('--baseline'), root=process.cwd(), origin='http://127.0.0.1:43128';
const baseSha='3d3f9a61d3c6a138f0326e3a7b563a163b52a141';
const source=baseline?execFileSync('git',['show',baseSha+':sw.js'],{encoding:'utf8'}):await readFile('sw.js','utf8');
const hostSource="/** AI: synthetic facilities only; actual app, owner guard, runtime/client/gateway and router. */\nexport async function arrange({ delay = 0, consumed = false, bootstrapCase = null } = {}) {\n  const consumedContract = consumed ? await (await fetch('/tests/n44-pr6-completion-20261026/postclick-native-contract.json')).json() : null;\n  if (consumed && (consumedContract.status !== 'PASS' || consumedContract.actualCompiledNative !== true)) throw Error('Compiled Native contract fixture missing');\n  const store = await import('/src/store.js'), cloud = await import('/src/lib/cloud.js');\n  const fixture = await import('/tests/n44-fixture.mjs');\n  await fixture.prepareAccount();\n  store.getOfflineLeaseStatus();\n  await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id => ({ id, verifiedAt: Date.now(), source: 'supabase-auth-user' }));\n  const db = await import('/src/lib/db.js');\n  const day = (await import('/src/models.js')).todayISO();\n  const due = await db.get('scoreSubitems', 'n44-due'); await db.put('scoreSubitems', { ...due, dueDate: day });\n  await store.refreshSyncedState();\n  const events = await import('/src/lib/notification-events.js');\n  const scope = events.currentNotificationContext(store, cloud);\n  if (!scope || store.state.device.accountProvisioningReceipt.ownerId !== fixture.owner) throw Error('Actual mounted owner guard failed');\n  const f = window.clickFixture = { calls: [], navigations: [], controller: {}, listener: null, store, cloud, mode: 'authorized' };\n  const binding = '44444444-4444-4444-8444-444444444444', expiresAt = Date.now() + 3600000;\n  f.receipt = { status: 'registered', registrationId: binding, expiresAt };\n  localStorage.setItem('rakeezx-n44-registration:' + JSON.stringify([scope.ownerId, scope.workspaceId, scope.deviceId]), JSON.stringify({ registrationId: binding, workspaceId: scope.workspaceId, deviceId: scope.deviceId }));\n  if (bootstrapCase === 'retired-saved') localStorage.setItem('rakeezx-n44-registration:' + JSON.stringify([scope.ownerId,scope.workspaceId,scope.deviceId]), JSON.stringify({registrationId:binding,workspaceId:scope.workspaceId,deviceId:scope.deviceId,retired:true}));\n  const remote = { workspaceId: scope.workspaceId, deviceId: scope.deviceId, active: true, sessionRevision: 'synthetic-session', sessionExpiresAt: expiresAt, consentRevision: 'synthetic-existing-consent', pushConsent: true };\n  const active = { scriptURL: location.origin + '/sw.js', postMessage(data, ports) {\n    f.calls.push(data.type);\n    ports[0].postMessage(data.type === 'n44-consent-status' ? { ok: true, enabled: true, binding: bootstrapCase === 'wrong-worker' ? '55555555-5555-4555-8555-555555555555' : binding, expiresAt } : { ok: true });\n  } };\n  const sub = { toJSON: () => ({ endpoint: 'https://synthetic.invalid/existing', keys: { p256dh: 'SYNTHETIC', auth: 'SYNTHETIC' } }), unsubscribe: async () => true };\n  const win = { location, isSecureContext: true, localStorage, MessageChannel, atob: value => atob(value), Notification: { permission: bootstrapCase === 'permission-denied' ? 'denied' : 'granted' }, PushManager: {},\n    navigator: { serviceWorker: { controller: f.controller,\n      getRegistration: async () => ({ active, getNotifications: async () => [], pushManager: { getSubscription: async () => sub } }),\n      addEventListener: (type, fn) => { if (type === 'message') f.listener = fn; }, removeEventListener() {} } } };\n  const m = await import('/src/lib/notification-push-runtime.js');\n  f.runtime = m.createPushRuntime({ store, cloud, window: win, navigate(path) {\n    f.navigations.push(path); void import('/src/router.js').then(r => r.go(path));\n  }, fetch: async (url) => {\n    f.calls.push(url);\n    if (url.endsWith('/push/config')) {\n      if (delay) await new Promise(r => setTimeout(r, delay));\n      if (consumed) return Response.json(consumedContract.configReply);\n      return Response.json({ status: 'ready', protocol: 'n44-browser-v2', capability: 'n44-single-device-20261019-v1', serviceRevision: 'n44-browser-service-v2', serviceSourceSha: 'a'.repeat(40), publicKey: 'B' + 'A'.repeat(86), expiresAt, deliveryEnabled: false, schedulerEnabled: false });\n    }\n    if (url.endsWith('/context/read')) {\n      if (bootstrapCase === 'unknown-context') return Response.json({}, { status: 503 });\n      if (bootstrapCase === 'revoked-context') return Response.json({ status: 'current', protocol: 'n44-browser-v2', context: { ...remote,pushConsent:false }, registration:null });\n      if (bootstrapCase === 'expired-receipt') return Response.json({ status: 'current', protocol: 'n44-browser-v2', context:remote,registration:{...f.receipt,expiresAt:Date.now()-1} });\n      return Response.json({ status: 'current', protocol: 'n44-browser-v2', context: remote, registration: f.receipt });\n    }\n    // Existing synthetic registration restoration only, no real registration or opt-in.\n    if (url.endsWith('/push/register')) return Response.json(f.receipt);\n    if (url.endsWith('/events/update')) return Response.json({ status: 'updated', sourceStamp: 'a'.repeat(64) });\n    if (url.endsWith('/events/authorize')) {\n      if (f.mode === 'delayed') await new Promise(r => f.release = r);\n      return f.mode === 'unknown' ? Response.json({}, { status: 503 }) : Response.json({ status: f.mode === 'revoked' ? 'rejected' : 'authorized' });\n    }\n    throw Error('Unexpected synthetic request ' + url);\n  } });\n  f.pending = f.runtime.refresh();\n  const e = events.currentNotificationEvents(store, scope).find(e => e.targetId === 'n44-due');\n  if (!e) throw Error('Current actual source event absent: ' + day);\n  f.envelope = { v: 1, binding, expiresAt, event: { id: e.id, kind: e.kind, expiresAt: e.expiresAt, actionPath: events.notificationDestination(store, scope, e.id, Date.now()) } };\n  f.message = (data, trusted = true) => new Promise(resolve => f.listener({ source: trusted ? f.controller : {}, data, ports: [{ postMessage: resolve, close() {} }] }));\n  return { ownerGuard: true, envelope: f.envelope };\n}\n";
const report={phase:baseline?'baseline':coldOnly?'cold-corrected':compatOnly?'compatibility':pendingOnly?'pending-isolation':'corrected',checks:[],liveOperations:0,actualBrowserServiceWorkers:false,workerMode:'original source in synthetic VM; no physical/offline-browser certification',fixtureSha256:createHash('sha256').update(hostSource).digest('hex')};
const types={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,origin);
 if(u.pathname.startsWith('/api/'))return res.writeHead(200,{'content-type':'application/json'}).end('{"status":"disabled"}');
 if(u.pathname==='/tests/n44-pr6-completion-20261026/click-host.mjs')return res.writeHead(200,{'content-type':'text/javascript'}).end(hostSource);
 if(baseline&&u.pathname==='/src/lib/notification-push-runtime.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(execFileSync('git',['show',baseSha+':src/lib/notification-push-runtime.js']));
 const f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.writeHead(200,{'content-type':types[path.extname(f)]??'application/octet-stream'}).end(await readFile(f));}catch{res.writeHead(404).end();}
});
const record=async(name,fn)=>{try{report.checks.push({name,status:'PASS',evidence:await fn()});}catch(e){report.checks.push({name,status:'FAIL',evidence:e.message});}};
let started=false;
try{
 await new Promise(r=>server.listen(43128,'127.0.0.1',r));started=true;
 if(!compatOnly)await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n44-core-click-1028.json',runId:'d7f34bc7-111e-4146-bf2b-e13d4e8ef453',url:origin,timeoutMs:120000},async({createContext})=>{
  async function boot(width=390){
   const context=await createContext({viewport:{width,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();
   await openReadyServedDemo(page,origin);
   await page.evaluate(async()=>{await(await import('/tests/n44-pr6-completion-20261026/click-host.mjs')).arrange();await clickFixture.pending;});
   assert.equal(await page.evaluate(()=>clickFixture.runtime.snapshot().status),'subscribed');
   return {context,page};
  }
  async function cold({listenerDelay=0,dataDelay=0,width=390}){
   let page,context,booting,available=false,opens=0,actions=0,probes=0,pendingText=null;
   const prepared=await boot(width), envelope=await prepared.page.evaluate(()=>clickFixture.envelope);
   await prepared.context.close();
   const handlers={},client={id:'owned-cold',type:'window',url:origin+'/',postMessage(data,ports){
    if(data.type==='n44-push-click')actions++;else probes++;
    if(!available)return;
    void page.evaluate(async data=>{const reply=await clickFixture.message(data);return {...reply,hint:document.querySelector('#toast.is-on')?.textContent};},data).then(v=>{if(!v.ok&&v.hint)pendingText=v.hint;ports[0].postMessage(v);}).catch(()=>{});
   }};
   const self={location:{origin},addEventListener:(k,v)=>handlers[k]=v,clients:{matchAll:async()=>[],openWindow:async url=>{
    assert.equal(url,origin+'/');opens++;
    booting=(async()=>{
     ({page,context}=await boot(width));
     if(dataDelay)await page.evaluate(ms=>{const f=clickFixture,items=f.store.state.items;f.store.state.items=[];setTimeout(()=>f.store.state.items=items,ms);},dataDelay);
     await new Promise(r=>setTimeout(r,listenerDelay));available=true;
    })();return client;
   }},registration:{getNotifications:async()=>[]}};
   const sandbox={self,URL,Response,Request,MessageChannel,Date,Map,Set,console,setTimeout,clearTimeout,caches:{open:async()=>({match:async()=>new Response(JSON.stringify({binding:envelope.binding,expiresAt:envelope.expiresAt,seen:[]}))})}};
   vm.createContext(sandbox);vm.runInContext(source,sandbox);
   const click=()=>{let work;handlers.notificationclick({notification:{tag:'n44:'+envelope.binding,data:envelope,close(){}},waitUntil:p=>work=p});return work;};
   try{
    await Promise.all([click(),click()]);await booting;
    const actual=await page.evaluate(()=>({navigations:clickFixture.navigations,authorizations:clickFixture.calls.filter(v=>v.endsWith('/events/authorize')).length,owner:clickFixture.store.getActiveWorkspace()?.authUserId,receipt:clickFixture.store.state.device.accountProvisioningReceipt.ownerId,ready:clickFixture.store.state.ready}));
    assert.equal(opens,1);assert.equal(actions,1);assert.equal(actual.authorizations,1);assert.equal(actual.navigations.length,1);assert.equal(actual.owner,actual.receipt);
    await page.waitForURL('**/#/teaching/n44-teaching/items');
    assert(await page.locator('.layout').isVisible());
    if(dataDelay&&!baseline)assert.match(pendingText??'',/جارٍ استعادة الحساب/);
    return {opens,actions,probes,...actual,url:await page.url(),width,realAppDom:true,pendingText};
   }finally{await context?.close();}
  }
  if(!pendingOnly){await record('cold_listener_after_11_seconds',()=>cold({listenerDelay:11000}));
  await record('ready_store_before_source_restoration',()=>cold({dataDelay:1400,width:1100}));}
  if(pendingOnly)await record('owner_switch_while_source_pending',async()=>{
   const {context,page}=await boot();try{
    const result=await page.evaluate(async()=>{const f=clickFixture,items=f.store.state.items;f.store.state.items=[];
     const before=await f.message({type:'n44-push-ready',event:f.envelope});
     const hint=document.querySelector('#toast')?.textContent;
     f.cloud.setMockAuth({id:'b4400000-0000-4000-8000-000000000002'},f.cloud.session);f.store.state.items=items;
     const after=await f.message({type:'n44-push-ready',event:f.envelope});
     return {before:before.ok,after:after.ok,hint,navigations:f.navigations.length,authorizations:f.calls.filter(v=>v.endsWith('/events/authorize')).length};});
    assert.equal(result.before,false);assert.equal(result.after,false);assert.equal(result.navigations,0);assert.equal(result.authorizations,0);assert.match(result.hint,/جارٍ استعادة الحساب/);assert(!result.hint.includes('n44-'));return result;
   }finally{await context.close();}
  });
  if(!baseline&&!coldOnly&&!pendingOnly){
   for(const mode of ['owner','revoked','expired','binding','offline','lease']){
    await record('deny_'+mode,async()=>{
     const {context,page}=await boot();
     try{
      await page.evaluate(mode=>{
       const f=clickFixture;
       if(mode==='owner')f.cloud.setMockAuth({id:'b4400000-0000-4000-8000-000000000002'},f.cloud.session);
       if(mode==='revoked')f.mode='revoked';
       if(mode==='expired')f.envelope.event.expiresAt=Date.now()-1;
       if(mode==='binding')f.envelope.binding='55555555-5555-4555-8555-555555555555';
       if(mode==='offline')f.mode='unknown';
       if(mode==='lease')f.store.deactivateWorkspace();
      },mode);
      const r=await page.evaluate(()=>clickFixture.message({type:'n44-push-click',event:clickFixture.envelope}));
      assert.equal(r.ok,false);assert.equal(await page.evaluate(()=>clickFixture.navigations.length),0);
      return 'Actual authenticated synthetic store/owner/runtime/client/gateway rejects navigation; original safe warning retained.';
     }finally{await context.close();}
    });
   }
   await record('owner_changes_during_authorization',async()=>{
    const {context,page}=await boot();
    try{
     await page.evaluate(()=>clickFixture.mode='delayed');
     const action=page.evaluate(()=>clickFixture.message({type:'n44-push-click',event:clickFixture.envelope}));
     await page.waitForFunction(()=>!!clickFixture.release);
     await page.evaluate(()=>{clickFixture.cloud.setMockAuth({id:'b4400000-0000-4000-8000-000000000002'},clickFixture.cloud.session);clickFixture.release();});
     assert.equal((await action).ok,false);assert.equal(await page.evaluate(()=>clickFixture.navigations.length),0);
     return 'Owner revalidated after authorization; no stale navigation.';
    }finally{await context.close();}
   });
  }
 });
 if(compatOnly)await record('offline_shell_and_expiring_wait',async()=>{
  const handlers={},deleted=[],matches=[],origin='http://127.0.0.1:43128';
  const cached=new Response('<!doctype html><title>owned cached application shell</title>');
  const self={location:{origin},addEventListener:(k,v)=>handlers[k]=v,clients:{claim:async()=>{}},registration:{}};
  const caches={keys:async()=>['rakeezx-v94','rakeezx-v95','rakeezx-v96','n44-private'],delete:async k=>deleted.push(k),match:async k=>{matches.push(k);return k==='./'?cached.clone():null;},open:async()=>({match:async()=>null,put:async()=>{throw Error('offline must not write');}})};
  const box={self,caches,URL,Response,Request:class{constructor(r){Object.assign(this,r);}},fetch:async()=>{throw Error('synthetic offline');},console,Date,Map,Set,MessageChannel,setTimeout,clearTimeout};
  vm.createContext(box);vm.runInContext(source,box);let response;
  handlers.fetch({request:{method:'GET',url:origin+'/',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await(await response).text(),await cached.text());assert.deepEqual(deleted,['rakeezx-v94']);
  let privateIntercept=false;handlers.fetch({request:{method:'GET',url:origin+'/api/n44/context/read',mode:'cors'},respondWith:()=>privateIntercept=true});assert.equal(privateIntercept,false);
  assert(source.includes("'./src/lib/notification-push-runtime.js'"));
  const binding='44444444-4444-4444-8444-444444444444';let actions=0,opens=0,probes=0;
  const envelope={v:1,binding,expiresAt:Date.now()+700,event:{id:'due:synthetic',kind:'due',expiresAt:Date.now()+700,actionPath:'/teaching/synthetic/items'}};
  self.clients={matchAll:async()=>[],openWindow:async u=>{assert.equal(u,origin+'/');opens++;return {postMessage(d,p){if(d.type==='n44-push-click')actions++;else probes++;p[0].postMessage({ok:false});}};}};
  caches.open=async()=>({match:async()=>new Response(JSON.stringify({binding,expiresAt:envelope.expiresAt,seen:[]}))});
  let work;handlers.notificationclick({notification:{tag:'n44:'+binding,data:envelope,close(){}},waitUntil:p=>work=p});await work;
  assert.equal(actions,0);assert.equal(opens,1);assert(probes>0);assert(probes<8);
  return {cachedRootReturned:true,privateApiNotCached:true,newerAndForeignCachesPreserved:true,noNewShellDependency:true,expiredWhileWaiting:{opens,probes,actions},actualBrowserOfflineCertification:false};
 });
 report.cleanup={browser:'canonical helper finally',server:'owned finally'};
}finally{
 if(started){server.closeAllConnections();await new Promise(r=>server.close(r));}
 const file='tests/n44-core-click-1028/qualification.json';let previous={};try{previous=JSON.parse(await readFile(file));}catch{}
 if(previous[report.phase]){previous.history??=[];previous.history.push(previous[report.phase]);}
 previous[report.phase]=report;await writeFile(file,JSON.stringify(previous,null,2)+'\n');
 console.log(JSON.stringify(report));
}
if(!baseline&&report.checks.some(c=>c.status==='FAIL'))process.exitCode=1;
