// AI: actual HTTP application DOM/store/guards; disposable synthetic account only.
import assert from 'node:assert/strict';
import http from 'node:http';import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants,createHash} from 'node:crypto';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const root=process.cwd(), requests=[], pasteOnly=process.argv.includes('--paste-only');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');requests.push(u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});return res.end('{"status":"disabled"}');}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=publicKey.export({format:'jwk'});
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n44-ready-producer-1029.json',runId:'462f9e8f-3364-4d9c-a24d-778d2860c050',url:base,timeoutMs:120000},async({createContext})=>{
  const ctx=await createContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});await ctx.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await ctx.newPage();await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
   await(await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare();
   const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),cloud=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js');
   const remote=n44Engine.remote,names=Object.fromEntries(Object.entries(v.SYNC_V2_SCHEMAS).map(([k,x])=>[x.entity,k]));
   cloud.setMockBackend({
    async fetchRecords(entity){return structuredClone(remote[names[entity]]??[]);},
    async applySyncV2Mutation(e){const name=names[e.entity],row={...e.patch,id:e.recordId,owner_id:cloud.user.id,revision:(e.baseRevision??0)+1,deleted_at:null};remote[name]=[...(remote[name]??[]).filter(r=>r.id!==row.id),row];return {mutationId:e.mutationId,outcome:'applied',record:structuredClone(row),revision:row.revision};},
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
  await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();if(s.state!=='synced'||!s.cloudSyncHealthy){window.syntheticSyncedSince=0;return false;}window.syntheticSyncedSince ||= performance.now();return performance.now()-window.syntheticSyncedSince>500;},{},{timeout:10000});
  let download;
  for(let attempt=0;attempt<2;attempt++){
   const event=page.waitForEvent('download',{timeout:2500}).catch(()=>null);await button.click();download=await event;if(download)break;
   assert.equal(await status.getAttribute('data-source-error'),'sync_pending');
   await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();return s.state==='synced'&&s.cloudSyncHealthy;});
  }
  assert(download,'normal UI download');assert.equal(download.suggestedFilename(),'rakeez-phone-readiness.encrypted.json');
  const receipt=JSON.parse(await readFile(await download.path()));const b=s=>Buffer.from(s,'base64url'),e=receipt.envelope;
  const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},b(e.key));const d=createDecipheriv('aes-256-gcm',key,b(e.iv));d.setAuthTag(b(e.tag));const payload=JSON.parse(Buffer.concat([d.update(b(e.ciphertext)),d.final()]));key.fill(0);
  assert.equal(payload.version,2);assert.equal(payload.kind,'n44-phone-readiness');assert.equal(payload.phone.gesture,'trusted-support-click');assert.equal(payload.phone.deviceId,payload.captureDevice.deviceId);
  assert.equal(payload.provenance.serverProof,false);assert.equal(payload.provenance.peerProof,false);assert.equal(payload.phone.runtime.registration.state,'unknown');assert.equal(payload.phone.runtime.quiet,null);
  assert(!JSON.stringify(receipt).includes(payload.ownerId));assert(!JSON.stringify(payload).includes('access_token'));assert.equal(requests.filter(x=>x.startsWith('/api/')).length,apiBefore);
  await button.click();await expect(status).toHaveAttribute('data-source-error','challenge_used');
  // Restore original owner after a mid-flight session replacement; reject export.
  await paste.fill(JSON.stringify({...challenge,nonce:'d'.repeat(64)}));
  await page.evaluate(()=>{window.savedDigest=crypto.subtle.digest;window.didSwap=false;crypto.subtle.digest=async function(...args){const v=await window.savedDigest.apply(this,args);if(!window.didSwap){window.didSwap=true;const c=await import('/src/lib/cloud.js');window.savedSession=c.session;c.setMockAuth(c.user,{...c.session});}return v;};});
  await button.click();await expect(status).toHaveAttribute('data-source-error','context_replaced');
  await page.evaluate(async()=>{crypto.subtle.digest=window.savedDigest;const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,window.savedSession);delete window.savedDigest;delete window.savedSession;delete window.didSwap;});
  await paste.fill(JSON.stringify({...challenge,nonce:'e'.repeat(64)}));const restored=page.waitForEvent('download');await button.click();await restored;
  const {admitPhoneReadinessExport,assemblePhoneReadiness}=await import('../../src/lib/notification-push-gateway.js');
  const privateCryptoKey=await crypto.subtle.importKey('pkcs8',privateKey.export({format:'der',type:'pkcs8'}),{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
  const bytes=new Uint8Array(await readFile(await download.path())),observedSha256=createHash('sha256').update(bytes).digest('hex'),claims=new Set();
  const admission={bytes,challenge,observedSha256,scope:{ownerId:payload.ownerId,workspaceId:payload.workspaceId,deviceId:payload.phone.deviceId},privateKey:privateCryptoKey,claimOnce:async c=>{assert(!claims.has(c.nonce));claims.add(c.nonce);}};
  const admitted=await admitPhoneReadinessExport(admission);assert.equal(admitted.value.phone.deviceId,payload.phone.deviceId);
  await assert.rejects(()=>admitPhoneReadinessExport(admission));
  await assert.rejects(()=>admitPhoneReadinessExport({...admission,scope:{...admission.scope,deviceId:'foreign'}}));
  await assert.rejects(()=>admitPhoneReadinessExport({...admission,observedSha256:'0'.repeat(64)}));
  await assert.rejects(()=>admitPhoneReadinessExport({...admission,now:challenge.expiresAt+1}));
  // Synthetic assembly fixture only: not a second actual phone/UI observation.
  const other=structuredClone(admitted);other.value.phone.deviceId='fixture-peer';other.challengeDigest='f'.repeat(64);
  const assembly={reports:[admitted,other],scope:{ownerId:payload.ownerId,workspaceId:payload.workspaceId,devices:[payload.phone.deviceId,'fixture-peer']},runId:challenge.runId,grantId:challenge.grantId,verifyHostReadback:async()=>null};
  assert.equal((await assemblePhoneReadiness(assembly)).status,'HOST_READBACK_REQUIRED');
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,reports:[admitted,admitted]}));
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,verifyHostReadback:undefined}));
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,now:Date.now()+60001}));
  const host={runId:challenge.runId,grantId:challenge.grantId,ownerId:payload.ownerId,workspaceId:payload.workspaceId,observedAt:Date.now(),authenticated:true,peerReadbackAuthenticated:true,peerBeforeSha256:'a'.repeat(64),peerAfterSha256:'a'.repeat(64),documentCheckpoint:'synthetic-host-document',devices:assembly.scope.devices.map(deviceId=>({deviceId,authenticated:true,registrationEnabled:false,receiveReceipt:null}))};
  const joined=await assemblePhoneReadiness({...assembly,verifyHostReadback:async()=>host});assert.equal(joined.phones.length,2);assert.equal(joined.hardEnd,null);assert.equal(joined.peerUnchanged,true);
  await assert.rejects(()=>assemblePhoneReadiness({...assembly,verifyHostReadback:async()=>({...host,peerAfterSha256:'b'.repeat(64)})}));
  console.log('PASS host decrypt/binding/durable-claim boundary; duplicate/foreign/stale rejection; absent host proof remains pending; synthetic authenticated host assembly only.');
  console.log('PASS real mounted HTTP UI: device/owner/expiry/gesture rejection, encrypted own-device export, no provider calls, replay denial, changing-session rejection and restored owner export.');
 });
}finally{await new Promise(ok=>server.close(ok));}

