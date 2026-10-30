// AI: actual HTTP application DOM/store/guards; disposable synthetic account only.
import assert from 'node:assert/strict';
import http from 'node:http';import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants,createHash} from 'node:crypto';
import {expect} from '@playwright/test';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/Abody/Projects/RakeezX/package.json')('playwright');
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
if(process.argv.includes('--host-only')){
 const {assemblePhoneReadiness}=await import('../src/lib/notification-push-gateway.js');
 const now=Date.now(),scope={ownerId:'synthetic-owner',workspaceId:'synthetic-workspace',devices:['android','ios']},runId='synthetic-run',grantId='efedbcea-f227-4a91-bbab-79cad814fc81';
 const reports=scope.devices.map((deviceId,i)=>{const context={mode:'account',verified:true,ownerId:scope.ownerId,workspaceId:scope.workspaceId,deviceId};return {challengeDigest:String(i+1).repeat(64),receiptSha256:String(i+3).repeat(64),value:{...scope,deviceId,ownerId:scope.ownerId,workspaceId:scope.workspaceId,kind:'n44-phone-readiness',runId,grantId,observedAt:now,provenance:{serverProof:false,peerProof:false},ancestry:{synthetic:true},existingSourceIds:[],proposed:{dueAt:now+600000},phone:{deviceId,gesture:'trusted-support-click',timezone:'Asia/Riyadh',preferences:{lessonMinutes:15,dueDays:[0,1,2,3]},runtime:{context,quiet:null,deviceOutcome:{source:'browser-service-worker',scopeHash:createHash('sha256').update(JSON.stringify(context)).digest('hex'),nonce:String(i+5).repeat(64),binding:null,observedAt:now,state:'empty',stage:null,minute:null,present:false}}}}};});
 const host={...scope,runId,grantId,observedAt:now,documentCheckpoint:'synthetic-host',authenticated:true,peerReadbackAuthenticated:true,peerBeforeSha256:'a'.repeat(64),peerAfterSha256:'a'.repeat(64),devices:scope.devices.map(deviceId=>({deviceId,authenticated:true,registrationEnabled:false,registrationSource:'authenticated-context-read'}))};
 const options={reports,scope,runId,grantId,verifyHostReadback:async()=>host};
 const joined=await assemblePhoneReadiness(options);assert.equal(joined.phones[0].receiveReceiptSource,'browser-service-worker');assert.equal(joined.phones[0].receiveReceipt,null);
 const bad=structuredClone(host);delete bad.devices[0].registrationSource;await assert.rejects(()=>assemblePhoneReadiness({...options,verifyHostReadback:async()=>bad}));
 const unknown=structuredClone(reports);unknown[0].value.phone.runtime.deviceOutcome={source:'browser-service-worker',state:'unknown'};assert.equal((await assemblePhoneReadiness({...options,reports:unknown})).status,'BROWSER_OUTCOME_REQUIRED');
 const stale=structuredClone(reports);stale[0].value.phone.runtime.deviceOutcome.observedAt-=60001;await assert.rejects(()=>assemblePhoneReadiness({...options,reports:stale}));
 console.log('PASS targeted host: explicit server registration provenance, browser-empty provenance, unknown and stale rejection.');process.exit(0);
}
const root=process.cwd(), requests=[];
const TASK='n44-browser-outcome-producer-1030',RUN='206e95a5-fb31-4421-80c4-c860d3164d36';
let browser,timer;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');requests.push(u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});return res.end('{"status":"disabled"}');}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=publicKey.export({format:'jwk'});
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 const lease=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));assert.equal(lease.taskId,TASK);assert.equal(lease.owner.token,RUN);
 browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),120000);timer.unref();
 const createContext=async options=>{const c=await browser.newContext({...options,serviceWorkers:'allow'});await c.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());return c;};
 {
  const ctx=await createContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});await ctx.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await ctx.newPage();await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await openReadyServedDemo(page,base);
  if(!process.argv.includes('--ui-only'))await page.evaluate(async()=>{
   const {createPushBrowser}=await import('/src/lib/notification-push-browser.js'),b=createPushBrowser({window,publicKey:null});
   const scopeHash='a'.repeat(64),binding='11111111-1111-4111-8111-111111111111',name='rakeezx-n44-consent-v1',key='/__n44_device_consent';
   const read=()=>b.readinessOutcome({scopeHash});
   // Disposable fixture writes; the actual read under test must preserve storage.
   await caches.delete(name);let r=await read();if(r.state!=='empty')throw Error('actual_empty:'+JSON.stringify(r));if(await caches.has(name))throw Error('read_created_cache');
   const cache=await caches.open(name);await cache.put(key,new Response('{bad'));r=await read();if(r.state!=='unknown'||await(await cache.match(key)).text()!=='{bad')throw Error('corrupt_read');
   const value={binding,expiresAt:Date.now()+300000,seen:[]};await cache.put(key,new Response(JSON.stringify(value)));
   if((await read()).state!=='unknown')throw Error('missing_binding');
   if((await b.readinessOutcome({scopeHash,binding})).state!=='empty')throw Error('bound_empty');
   if((await b.readinessOutcome({scopeHash,binding:'22222222-2222-4222-8222-222222222222'})).state!=='unknown')throw Error('foreign_binding');
   value.outcome={stage:'unknown',minute:Math.floor(Date.now()/60000)};await cache.put(key,new Response(JSON.stringify(value)));
   if((await b.readinessOutcome({scopeHash,binding})).state!=='unknown')throw Error('unknown_promoted');
   value.outcome.stage='received';await cache.put(key,new Response(JSON.stringify(value)));r=await b.readinessOutcome({scopeHash,binding});if(r.state!=='observed'||r.stage!=='received')throw Error('existing_outcome');
   value.expiresAt=Date.now()-1;await cache.put(key,new Response(JSON.stringify(value)));const raw=await(await cache.match(key)).text();if((await b.readinessOutcome({scopeHash,binding})).state!=='unknown'||await(await cache.match(key)).text()!==raw)throw Error('expiry_mutation');
   await cache.delete(key);
  });
  if(!process.argv.includes('--ui-only')){
   const worker=ctx.serviceWorkers().find(w=>w.url()===base+'/sw.js');assert(worker);
   await worker.evaluate(()=>{globalThis.savedCacheMatch=caches.match.bind(caches);caches.match=async()=>{throw Error('synthetic storage read failure');};});
   assert.equal(await page.evaluate(async()=>{const b=(await import('/src/lib/notification-push-browser.js')).createPushBrowser({window,publicKey:null});return(await b.readinessOutcome({scopeHash:'a'.repeat(64)})).state;}),'unknown');
   await worker.evaluate(()=>{caches.match=globalThis.savedCacheMatch;delete globalThis.savedCacheMatch;});
   const unavailable=await createContext({});const unavailablePage=await unavailable.newPage();await unavailablePage.goto(base+'/',{waitUntil:'domcontentloaded'});
   assert.equal(await unavailablePage.evaluate(async()=>{const b=(await import('/src/lib/notification-push-browser.js')).createPushBrowser({window,publicKey:null});return(await b.readinessOutcome({scopeHash:'a'.repeat(64)})).state;}),'unknown');await unavailable.close();
  }
  if(!process.argv.includes('--ui-only'))console.log('PASS actual SW/client read: scoped empty, corruption, foreign/missing binding, UNKNOWN, existing received and expired nonmutation.');
  await page.evaluate(async()=>{
   await(await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare();
   const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),cloud=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js');
   const remote=n44Engine.remote,names=Object.fromEntries(Object.entries(v.SYNC_V2_SCHEMAS).map(([k,x])=>[x.entity,k]));
   cloud.setMockBackend({
    async fetchRecords(entity){return structuredClone(remote[names[entity]]??[]);},
    async applySyncV2Mutation(e){const name=names[e.entity],row={...e.patch,id:e.recordId,owner_id:cloud.user.id,revision:(e.baseRevision??0)+1,deleted_at:null};remote[name]=[...(remote[name]??[]).filter(r=>r.id!==row.id),row];return {mutationId:e.mutationId,outcome:'applied',canonicalId:row.id,canonical:structuredClone(row),resultRevision:row.revision,conflictedGroups:[]};},
    async getScoreFoundationCapability(){return {scoreDomainVersion:1,configurationVersion:1,n94SubitemVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1};},
    async getScoreDistributionCapability(){return {distributionApplyVersion:2,protocol:'N73_D119_V2'};},
    async getScoreDomainSnapshot(){return {items:structuredClone(remote.items),score_subitems:structuredClone(remote.scoreSubitems),score_subitem_completions:[],scores:structuredClone(remote.scores)};}
   });
   await db.put('device',{...s.state.device,activeYearId:'n44-year',activeTermId:'n44-term'});await s.init();
   await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id=>({id,verifiedAt:Date.now(),source:'supabase-auth-user'}));
   await(await import('/src/lib/sync.js')).syncAll();
   location.hash='#/teaching/n44-teaching';
  });
  await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();return s.state==='synced'&&s.cloudSyncHealthy;},{},{timeout:15000});

  const panel=page.locator('[data-source-readiness]');await panel.waitFor();await expect(panel).not.toHaveAttribute('open','');
  await panel.locator('summary').click();
  const button=panel.locator('[data-act=phone-readiness-capture]'),paste=panel.locator('textarea'),status=panel.locator('[role=status]');
  const challenge=await page.evaluate(async publicKey=>{
   const m=await import('/src/lib/notification-source-readiness.js'),s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
   const context=(await import('/src/lib/notification-events.js')).currentNotificationContext(s,c);
   let due=(Math.floor((Date.now()+10800000)/86400000)+1)*86400000-10800000;
   while(!s.isSessionEligibleDate(new Date(due+10800000).toISOString().slice(0,10),{year:s.getYear('n44-year'),term:s.getTerm('n44-term')})){due+=86400000;if(due-Date.now()>604800000)throw Error('calendar');}
   return {version:2,kind:'n44-phone-readiness',deviceHash:await m.readinessHash(context.deviceId),taskId:'n44-core-live-1028',grantId:'efedbcea-f227-4a91-bbab-79cad814fc81',runId:'11111111-1111-4111-8111-111111111111',nonce:'c'.repeat(64),issuedAt:Date.now(),expiresAt:Date.now()+240000,ownerHash:await m.readinessHash(context.ownerId),workspaceHash:await m.readinessHash(context.workspaceId),dueAt:due,publicKey};
  },{kty:jwk.kty,n:jwk.n,e:jwk.e});
  const send=async c=>{await paste.fill(JSON.stringify(c));await button.click();};
  await send({...challenge,expiresAt:Date.now()-1});await expect(status).toHaveAttribute('data-source-error','challenge_expired');
  await send({...challenge,deviceHash:'0'.repeat(64)});await expect(status).toHaveAttribute('data-source-error','device_mismatch');
  await send({...challenge,ownerHash:'0'.repeat(64)});await expect(status).toHaveAttribute('data-source-error','scope_mismatch');
  await paste.fill(JSON.stringify(challenge));
  const noGesture=await page.evaluate(async c=>{try{await(await import('/src/lib/notification-source-readiness.js')).captureNotificationPhoneReadiness(JSON.stringify(c),'n44-teaching',document.querySelector('[data-source-readiness]'),{type:'click',isTrusted:false});return 'bad';}catch(e){return e.message;}},challenge);assert.equal(noGesture,'gesture_required');
  await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();return s.state==='synced'&&s.cloudSyncHealthy&&['queuedCount','pendingCount','failedCount','blockedCount','rejectedCount'].every(k=>s[k]===0);},{},{timeout:15000});
  const apiBefore=requests.filter(x=>x.startsWith('/api/')).length;
  await button.focus();
  await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();if(s.state!=='synced'||!s.cloudSyncHealthy){window.syntheticSyncedSince=0;return false;}window.syntheticSyncedSince ||= performance.now();return performance.now()-window.syntheticSyncedSince>1500;},{},{timeout:10000});
  let download;
  for(let attempt=0;attempt<2;attempt++){
   const event=page.waitForEvent('download',{timeout:2500}).catch(()=>null);await button.click();download=await event;if(download)break;
   assert.equal(await status.getAttribute('data-source-error'),'sync_pending');assert.equal(await status.getAttribute('data-source-stage'),'sync');
   await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();return s.state==='synced'&&s.cloudSyncHealthy;});
  }
  assert(download,'normal UI download');assert.equal(download.suggestedFilename(),'rakeez-phone-readiness.encrypted.json');
  const receipt=JSON.parse(await readFile(await download.path()));const b=s=>Buffer.from(s,'base64url'),e=receipt.envelope;
  const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},b(e.key));const d=createDecipheriv('aes-256-gcm',key,b(e.iv));d.setAuthTag(b(e.tag));const payload=JSON.parse(Buffer.concat([d.update(b(e.ciphertext)),d.final()]));key.fill(0);
  assert.equal(payload.version,2);assert.equal(payload.kind,'n44-phone-readiness');assert.equal(payload.phone.gesture,'trusted-support-click');assert.equal(payload.phone.deviceId,payload.captureDevice.deviceId);
  assert.equal(payload.phone.runtime.deviceOutcome.state,'empty');
  assert.equal(payload.provenance.serverProof,false);assert.equal(payload.provenance.peerProof,false);assert.equal(payload.phone.runtime.registration.state,'unknown');assert.equal(payload.phone.runtime.quiet,null);
  assert(!JSON.stringify(receipt).includes(payload.ownerId));assert(!JSON.stringify(payload).includes('access_token'));assert.equal(requests.filter(x=>x.startsWith('/api/')).length,apiBefore);
  await button.click();await expect(status).toHaveAttribute('data-source-error','challenge_used');
  // Restore original owner after a mid-flight session replacement; reject export.
  await paste.fill(JSON.stringify({...challenge,nonce:'d'.repeat(64)}));
  await page.evaluate(()=>{window.savedDigest=crypto.subtle.digest;window.didSwap=false;crypto.subtle.digest=async function(...args){const v=await window.savedDigest.apply(this,args);if(!window.didSwap){window.didSwap=true;const c=await import('/src/lib/cloud.js');window.savedSession=c.session;c.setMockAuth(c.user,{...c.session});}return v;};});
  await button.click();await expect(status).toHaveAttribute('data-source-error','context_replaced');
  await page.evaluate(async()=>{crypto.subtle.digest=window.savedDigest;const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,window.savedSession);delete window.savedDigest;delete window.savedSession;delete window.didSwap;});
  await paste.fill(JSON.stringify({...challenge,nonce:'e'.repeat(64)}));const restored=page.waitForEvent('download');await button.click();await restored;
  const runtimeFence=await page.evaluate(async()=>{
   const runtime=(await import('/src/lib/notification-push-runtime.js')).getPushRuntime(),cloud=await import('/src/lib/cloud.js');
   const original=navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker),session=cloud.session;
   let release,started;const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r);
   navigator.serviceWorker.getRegistration=async(...args)=>{started();await gate;return original(...args);};
   try{const pending=runtime.readReadinessOutcome();await entered;cloud.setMockAuth(cloud.user,{...session});release();return(await pending)===null;}
   finally{navigator.serviceWorker.getRegistration=original;cloud.setMockAuth(cloud.user,session);}
  });assert.equal(runtimeFence,true);
  const {admitPhoneReadinessExport,assemblePhoneReadiness}=await import('../src/lib/notification-push-gateway.js');
  const privateCryptoKey=await crypto.subtle.importKey('pkcs8',privateKey.export({format:'der',type:'pkcs8'}),{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
  const bytes=new Uint8Array(await readFile(await download.path())),observedSha256=createHash('sha256').update(bytes).digest('hex'),claims=new Set();
  const admission={bytes,challenge,observedSha256,scope:{ownerId:payload.ownerId,workspaceId:payload.workspaceId,deviceId:payload.phone.deviceId},privateKey:privateCryptoKey,claimOnce:async c=>{assert(!claims.has(c.nonce));claims.add(c.nonce);}};
  const admitted=await admitPhoneReadinessExport(admission);assert.equal(admitted.value.phone.deviceId,payload.phone.deviceId);
  await assert.rejects(()=>admitPhoneReadinessExport(admission));
  await assert.rejects(()=>admitPhoneReadinessExport({...admission,scope:{...admission.scope,deviceId:'foreign'}}));
  await assert.rejects(()=>admitPhoneReadinessExport({...admission,observedSha256:'0'.repeat(64)}));
  await assert.rejects(()=>admitPhoneReadinessExport({...admission,now:challenge.expiresAt+1}));
  // Synthetic assembly fixture only: not a second actual phone/UI observation.
  const other=structuredClone(admitted);other.value.phone.deviceId='fixture-peer';other.value.phone.runtime.context.deviceId='fixture-peer';other.value.phone.runtime.deviceOutcome.scopeHash=createHash('sha256').update(JSON.stringify(other.value.phone.runtime.context)).digest('hex');other.challengeDigest='f'.repeat(64);
  const assembly={reports:[admitted,other],scope:{ownerId:payload.ownerId,workspaceId:payload.workspaceId,devices:[payload.phone.deviceId,'fixture-peer']},runId:challenge.runId,grantId:challenge.grantId,verifyHostReadback:async()=>null};
  assert.equal((await assemblePhoneReadiness(assembly)).status,'HOST_READBACK_REQUIRED');
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,reports:[admitted,admitted]}));
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,verifyHostReadback:undefined}));
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,now:Date.now()+60001}));
  const host={runId:challenge.runId,grantId:challenge.grantId,ownerId:payload.ownerId,workspaceId:payload.workspaceId,observedAt:Date.now(),authenticated:true,peerReadbackAuthenticated:true,peerBeforeSha256:'a'.repeat(64),peerAfterSha256:'a'.repeat(64),documentCheckpoint:'synthetic-host-document',devices:assembly.scope.devices.map(deviceId=>({deviceId,authenticated:true,registrationEnabled:false,registrationSource:'authenticated-context-read'}))};
  const joined=await assemblePhoneReadiness({...assembly,verifyHostReadback:async()=>host});assert.equal(joined.phones.length,2);assert.equal(joined.hardEnd,null);assert.equal(joined.peerUnchanged,true);
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,verifyHostReadback:async()=>({...host,peerAfterSha256:'b'.repeat(64)})}));
  const unknown=structuredClone(admitted);unknown.value.phone.runtime.deviceOutcome={source:'browser-service-worker',state:'unknown'};assert.equal((await assemblePhoneReadiness({...assembly,reports:[unknown,other],verifyHostReadback:async()=>host})).status,'BROWSER_OUTCOME_REQUIRED');
  const foreign=structuredClone(admitted);foreign.value.phone.runtime.deviceOutcome.scopeHash='0'.repeat(64);await assert.rejects(()=>assemblePhoneReadiness({...assembly,reports:[foreign,other],verifyHostReadback:async()=>host}));
  assert.equal(joined.phones[0].receiveReceiptSource,'browser-service-worker');
  console.log('PASS host decrypt/binding/durable-claim boundary; duplicate/foreign/stale rejection; absent host proof remains pending; synthetic authenticated host assembly only.');
  console.log('PASS real mounted HTTP UI: device/owner/expiry/gesture rejection, encrypted own-device export, no provider calls, replay denial, changing-session rejection and restored owner export.');
  await ctx.close();
 }
}finally{clearTimeout(timer);await browser?.close().catch(()=>{});server.closeAllConnections();await new Promise(ok=>server.close(ok));}

