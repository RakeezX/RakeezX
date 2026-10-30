// AI: mounted real application, HTTP, actual handlers/CSS, synthetic ports only.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createECDH,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {installNative} from './n44-confirmed-projection-20261024/runtime.mjs';
import {readSource,compareCurrentProjection} from '../drafts/n44-push/canonical-source.mjs';
const task='continuous-n44-current-projection-recovery-20261031',run='a28ecd62-83bf-4c8f-8aa7-b511048e76ec';
const root=process.cwd(),mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const curve=createECDH('prime256v1');curve.generateKeys();const publicKey=curve.getPublicKey().toString('base64url');
test('mounted reload lost ACK recovery and explicit retry without mutation or enrollment', {timeout:120000},async()=>{
 const lease=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json'));assert.equal(lease.taskId,task);assert.equal(lease.owner.token,run);
 let enabled=false,remote=null,receipt=null,mode='saved',updates=[],reads=[],stored=[],delayRelease;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const source={year:{revision:'1',id:'n44-year',status:'active'},terms:[{revision:'1',id:'n44-term',startDate:'2026-10-01',endDate:'2026-11-01'}],calendars:[],days:[],teaching:{revision:'1',id:'n44-teaching',termId:'n44-term'},section:{revision:'1',id:'n44-section',status:'active',yearId:'n44-year'},subject:{revision:'1',id:'n44-subject'},source:{revision:'1',id:'n44-due',itemId:'n44-item',itemRevision:'1',scoreMode:'subitems',dueDate:today}};
 const q=async(sql,v)=>sql.includes('read_source')?{rows:[{source}]}:{rows:[{ms:String(Date.parse(v[0]+'T'+v[1]+':00+03:00'))}]};
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/api/n44/')){let raw='';for await(const part of req)raw+=part;const b=JSON.parse(raw||'{}');let value={status:'disabled'},status=200;
   if(u.pathname.endsWith('/push/config')&&enabled)value={status:'ready',protocol:'n44-browser-v2',capability:'n44-single-device-20261019-v1',serviceRevision:'n44-browser-service-v2',serviceSourceSha:'a'.repeat(40),publicKey,expiresAt:Date.now()+3600000,deliveryEnabled:false,schedulerEnabled:false};
   if(u.pathname.endsWith('/context/read'))value={protocol:'n44-browser-v2',status:remote?'current':'absent',context:remote,registration:receipt,expectedRevision:null};
   if(u.pathname.endsWith('/context/update')){remote={...b,active:true,sessionRevision:'synthetic-session',consentRevision:'synthetic-consent',sessionExpiresAt:Date.now()+3600000};value={status:'updated',context:remote};}
   if(u.pathname.endsWith('/push/register')){receipt??={status:'registered',registrationId:b.registrationId,expiresAt:Date.now()+1800000};value=receipt;}
   if(u.pathname.endsWith('/push/revoke'))value={status:'revoked'};
   if(u.pathname.endsWith('/events/update')){updates.push(b);if(b.sourceId==='n44-due'){const s=await readSource(q,'synthetic',b.kind,b.sourceId,remote.preferences);stored=s.events.filter(e=>e.expiresAt>Date.now()).map(e=>({workspace_id:b.workspaceId,device_id:b.deviceId,source_kind:b.kind,source_id:b.sourceId,event_id:e.id,source_stamp:s.stamp,due_at_ms:e.dueAt,expires_at_ms:e.expiresAt,payload:{id:e.id,kind:e.kind,expiresAt:e.expiresAt,actionPath:e.actionPath}}));}status=503;value={status:'unavailable'};}
   if(u.pathname.endsWith('/events/read')){reads.push(b);if(mode==='delay')await new Promise(ok=>delayRelease=ok);const s=await readSource(q,'synthetic',b.sourceKind,b.sourceId,remote.preferences);let rows=structuredClone(stored);if(mode==='absent')rows=[];if(mode==='partial')rows=rows.slice(1);if(mode==='wrongfield')rows[0].payload.actionPath='/teaching/wrong/items';value={...compareCurrentProjection(s,rows,b,Date.now()),...b,sessionRevision:remote.sessionRevision,registrationExpiresAt:receipt.expiresAt,observedAt:Date.now()};if(mode==='nonce')value.nonce=randomUUID();if(mode==='revision')value.sourceRevisionDigest='f'.repeat(64);if(mode==='forged'){value.status='verified';value.events[0].actionPath='/teaching/wrong/items';}}
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(value));
  }
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));
 }catch{res.writeHead(404).end();}});
 let browser,context;
 try{await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});await context.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
  await context.addInitScript(installNative);
  await context.addInitScript(()=>{const saved=JSON.parse(sessionStorage.getItem('n44-synthetic-native')||'null');if(saved){if(saved.registration)localStorage.setItem(...saved.registration);if(saved.consent)localStorage.setItem(...saved.consent);n44Native.binding=saved.binding;n44Native.expiresAt=saved.expiresAt;n44Native.subscription={endpoint:'https://synthetic.invalid/n44',toJSON:()=>({endpoint:'https://synthetic.invalid/n44',keys:{p256dh:'synthetic',auth:'synthetic'}}),unsubscribe:async()=>true};}});
  const page=await context.newPage();page.setDefaultTimeout(15000);await openReadyServedDemo(page,url);enabled=true;
  const prepare=()=>page.evaluate(async()=> (await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare());
  await prepare();await page.locator('[data-act="notification-push"]').click();await page.waitForFunction(()=>n44Native.projected.includes('n44-due')&&n44Native.inflight===0);
  assert(stored.length);const before=updates.length;
  await page.evaluate(()=>sessionStorage.setItem('n44-synthetic-native',JSON.stringify({binding:n44Native.binding,expiresAt:n44Native.expiresAt,registration:Object.entries(localStorage).find(([k])=>k.startsWith('rakeezx-n44-registration:')),consent:Object.entries(localStorage).find(([k])=>k.startsWith('rakeezx-n44-consent:'))})));
  enabled=false;await page.reload({waitUntil:'domcontentloaded'});await openReadyServedDemo(page,url);await prepare();
  // Fixture setup deliberately switches Demo -> account; finish that old runtime's
  // cleanup before restoring native state for the fresh mounted account runtime.
  await page.evaluate(async()=>{const m=await import('/src/lib/notification-push-runtime.js');await m.getPushRuntime().dispose();const saved=JSON.parse(sessionStorage.getItem('n44-synthetic-native'));if(saved.registration)localStorage.setItem(...saved.registration);if(saved.consent)localStorage.setItem(...saved.consent);n44Native.binding=saved.binding;n44Native.expiresAt=saved.expiresAt;n44Native.subscription={endpoint:'https://synthetic.invalid/n44',toJSON:()=>({endpoint:'https://synthetic.invalid/n44',keys:{p256dh:'synthetic',auth:'synthetic'}}),unsubscribe:async()=>true};const r=m.createPushRuntime({store:await import('/src/store.js'),cloud:await import('/src/lib/cloud.js'),navigate:()=>{},changed:()=>{void import('/src/app.js').then(a=>a.repaint());}});m.setPushRuntime(r);await r.refresh();});
  await page.waitForFunction(async()=> (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().snapshot().status==='subscribed');
  const pending=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('rakeezx-n44-projection-pending:')&&k.includes('n44-due')));
  assert.equal((await pending()).length,1);
  await page.evaluate(async()=>{(await import('/src/app.js')).repaint();});
  await page.waitForTimeout(200);
  await page.locator('[data-n44-support]').evaluate(e=>{e.open=true;});
  const button=page.locator('[data-act="notification-verify"]').first();await button.waitFor();
  for(mode of ['absent','partial','wrongfield','nonce','revision','forged']){const n=reads.length;await button.click();await page.waitForTimeout(80);await page.waitForFunction(async()=>!(await import('/src/lib/notification-push-runtime.js')).getPushRuntime().normalUiSnapshot().verifying);assert.equal(reads.length,n+1);assert.equal((await pending()).length,1);assert.equal(updates.length,before);}
  mode='saved';await button.click();await page.locator('[data-n44-verification="current_verified"]').waitFor();assert.equal((await pending()).length,0);assert.equal(updates.length,before);const firstVerifiedReads=reads.length;await button.click();await page.waitForTimeout(80);assert.equal(reads.length,firstVerifiedReads+1);assert.equal(updates.length,before);
  assert.notEqual(await page.locator('.n44-settings-page').evaluate(e=>getComputedStyle(e).display),'none');
  const count=reads.length;await page.evaluate(async()=>{const r=(await import('/src/lib/notification-push-runtime.js')).getPushRuntime();await r.refresh();r.normalUiSnapshot();r.snapshot();(await import('/src/app.js')).repaint();});assert.equal(reads.length,count);assert.equal(updates.length,before);
  assert.equal(await page.evaluate(async()=>(await(await import('/src/lib/db.js')).getAll('scores'))[0].value),4);
  // Read-only restoration never grants enrollment or projection mutation.
  assert.equal(await page.evaluate(async()=>(await(await import('/src/lib/notification-push-runtime.js')).getPushRuntime().optIn()).status),'unavailable');
  // Delayed response fences exercise the real runtime, owner guard and store.
  for(const change of ['owner','device','credential','session','consent','source']){
   await page.evaluate(async()=>{const s=await import('/src/store.js'),w=s.getActiveWorkspace();localStorage.setItem('rakeezx-n44-projection-pending:'+JSON.stringify([w.authUserId,w.databaseName,JSON.stringify(['due','n44-due'])]),'unknown');});
   delayRelease=null;mode='delay';await page.locator('[data-n44-support]').evaluate(e=>{e.open=true;});await button.click();
   for(let i=0;i<100&&!delayRelease;i++)await new Promise(ok=>setTimeout(ok,10));assert(delayRelease);
   await page.evaluate(async change=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),g=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;window.n44Restore={workspace:g.getWorkspace(),device:s.state.device.deviceId,session:c.session,auth:localStorage.getItem(c.AUTH_STORAGE_KEY),consent:Object.entries(localStorage).find(([k])=>k.startsWith('rakeezx-n44-consent:')),source:JSON.stringify(s.state.scoreSubitems)};
    if(change==='owner')g.setWorkspace({...s.getActiveWorkspace(),authUserId:'b4400000-0000-4000-8000-000000000002'});
    if(change==='device')s.state.device.deviceId='foreign';
    if(change==='credential')localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify({...c.session,access_token:'changed'}));
    if(change==='session')c.setMockAuth(c.user,{...c.session,access_token:'changed'});
    if(change==='consent')localStorage.setItem(n44Restore.consent[0],'changed');
    if(change==='source')s.state.scoreSubitems.find(r=>r.id==='n44-due').dueDate='2026-11-01';
   },change);delayRelease();
   await page.waitForFunction(async()=>!(await import('/src/lib/notification-push-runtime.js')).getPushRuntime().normalUiSnapshot().verifying);assert.equal((await pending()).length,1);assert.equal(updates.length,before);
   await page.evaluate(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),g=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;g.setWorkspace(n44Restore.workspace);s.state.device.deviceId=n44Restore.device;c.setMockAuth(n44Restore.session.user,n44Restore.session);localStorage.setItem(c.AUTH_STORAGE_KEY,n44Restore.auth);localStorage.setItem(...n44Restore.consent);s.state.scoreSubitems=JSON.parse(n44Restore.source);(await import('/src/app.js')).repaint();});
  }

 }finally{delayRelease?.();await context?.close();await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
});
