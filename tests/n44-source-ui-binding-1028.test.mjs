// AI: actual HTTP application DOM/store/guards; disposable synthetic account only.
import assert from 'node:assert/strict';
import http from 'node:http';import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const root=process.cwd(), requests=[];
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');requests.push(u.pathname);if(u.pathname.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});return res.end('{"status":"disabled"}');}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=publicKey.export({format:'jwk'});
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n44-source-ui-binding-1028.json',runId:'91ecdbed-1631-47c1-8fa3-73118518edd9',url:base,timeoutMs:120000},async({createContext})=>{
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
  assert(!requests.includes('/src/lib/notification-source-readiness.js'));
  await panel.locator('summary').click();await expect(panel.locator('input')).toBeVisible();
  await panel.locator('button').click();await expect(panel.locator('[role=status]')).toContainText('اختر ملف');
  const challenge=await page.evaluate(async publicKey=>{
   const m=await import('/src/lib/notification-source-readiness.js'),s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
   const context=(await import('/src/lib/notification-events.js')).currentNotificationContext(s,c);if(!context)throw Error('fixture owner checkpoint');
   const today=new Date(Date.now()+10800000);today.setUTCHours(0,0,0,0);let due=today.getTime()-10800000+86400000;
   while(!s.isSessionEligibleDate(new Date(due+10800000).toISOString().slice(0,10),{year:s.getYear('n44-year'),term:s.getTerm('n44-term')})) {due+=86400000;if(due-Date.now()>7*86400000)throw Error('fixture calendar');}
   return {version:1,taskId:'n44-core-live-1028',grantId:'efedbcea-f227-4a91-bbab-79cad814fc81',runId:'11111111-1111-4111-8111-111111111111',nonce:'a'.repeat(64),issuedAt:Date.now(),expiresAt:Date.now()+240000,ownerHash:await m.readinessHash(context.ownerId),workspaceHash:await m.readinessHash(context.workspaceId),dueAt:due,publicKey};
  },{kty:jwk.kty,n:jwk.n,e:jwk.e});
  const upload=async c=>panel.locator('input').setInputFiles({name:'challenge.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});
  for(const change of [c=>c.expiresAt=0,c=>c.ownerHash='0'.repeat(64),c=>c.taskId='foreign',c=>c.publicKey.d='private']){
   const bad=structuredClone(challenge);change(bad);await upload(bad);await panel.locator('button').click();await expect(panel.locator('[role=status]')).toContainText('تعذّر');await expect(panel.locator('button')).not.toHaveAttribute('aria-busy','true');
  }
  const before=await page.evaluate(async()=>{const s=await import('/src/store.js');return JSON.stringify(Object.fromEntries(['students','scores','items','scoreSubitems','sessions','teachings','sections','subjects'].map(k=>[k,s.state[k]])));});const apiBefore=requests.filter(x=>x.startsWith('/api/')).length;
  await upload(challenge);await panel.locator('button').focus();
  await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();if(s.state!=='synced'||!s.cloudSyncHealthy){window.syntheticSyncedSince=0;return false;}window.syntheticSyncedSince ||= performance.now();return performance.now()-window.syntheticSyncedSince>500;},{},{timeout:10000});
  let download;
  for(let attempt=0;attempt<2;attempt++){
   const event=page.waitForEvent('download',{timeout:2000}).catch(()=>null);
   await panel.locator('button').click();download=await event;if(download)break;
   assert.equal(await panel.locator('[role=status]').getAttribute('data-source-error'),'sync_pending');
   await page.waitForFunction(async()=>{const s=await(await import('/src/lib/sync.js')).getSyncOperationalSummary();return s.state==='synced'&&s.cloudSyncHealthy;});
  }
  assert(download,'normal UI download');const receipt=JSON.parse(await readFile(await download.path(),'utf8'));
  await expect(panel.locator('[role=status]')).toContainText('تم حفظ');
  const b=s=>Buffer.from(s,'base64url'),e=receipt.envelope;
  const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},b(e.key));
  const d=createDecipheriv('aes-256-gcm',key,b(e.iv));d.setAuthTag(b(e.tag));const payload=JSON.parse(Buffer.concat([d.update(b(e.ciphertext)),d.final()]));key.fill(0);
  assert.equal(payload.captureDevice.role,'read-only-capture');assert.equal(payload.captureDevice.sendRecipientVerified,false);assert.equal(payload.ancestry.teaching.id,'n44-teaching');
  assert(!JSON.stringify(payload).includes('access_token'));assert(!JSON.stringify(payload).includes('رياضيات'));assert(!JSON.stringify(payload).includes('scores'));assert.equal(payload.clockStarted,false);
  assert.equal(await page.evaluate(async()=>{const s=await import('/src/store.js');return JSON.stringify(Object.fromEntries(['students','scores','items','scoreSubitems','sessions','teachings','sections','subjects'].map(k=>[k,s.state[k]])));}),before);assert.equal(requests.filter(x=>x.startsWith('/api/')).length,apiBefore);
  await panel.locator('button').click();await expect(panel.locator('[role=status]')).toContainText('تعذّر');await expect(panel.locator('button')).not.toHaveAttribute('aria-busy','true');
  assert.equal(await panel.locator('[role=status]').getAttribute('data-source-error'),'challenge_used');
  assert(!JSON.stringify(receipt).includes(payload.ownerId));assert(!JSON.stringify(receipt).includes('n44-teaching'));
  const negatives=await page.evaluate(async c=>{
   const m=await import('/src/lib/notification-source-readiness.js'),s=await import('/src/store.js'),db=await import('/src/lib/db.js'),cloud=await import('/src/lib/cloud.js');
   const panel=document.querySelector('[data-source-readiness]'),results=[];
   const check=async(name,change,restore,element=panel)=>{const challenge={...c,nonce:crypto.randomUUID().replaceAll('-','').repeat(2)};try{await change();await m.captureNotificationSourceReadiness(JSON.stringify(challenge),'n44-teaching',element);throw Error('unexpected success '+name);}catch(e){if(e.message.startsWith('unexpected success'))throw e;results.push([name,e.message]);}finally{await restore();}};
   const subject=s.getSubject('n44-subject'),owner=subject.ownerId;
   await check('foreign-owner',()=>subject.ownerId='foreign',()=>subject.ownerId=owner);
   await check('missing-document',()=>{},()=>{},document.createElement('div'));
   const original=localStorage.getItem(cloud.AUTH_STORAGE_KEY);
   await check('missing-auth',()=>localStorage.removeItem(cloud.AUTH_STORAGE_KEY),()=>localStorage.setItem(cloud.AUTH_STORAGE_KEY,original));
   const term=s.getTerm('n44-term'),end=term.endDate;
   await check('invalid-calendar',()=>term.endDate='2026-08-01',()=>term.endDate=end);
   await check('pending-write',()=>db.put('outbox',{id:'synthetic-pending-capture',protocol:'v2',state:'pending',entity:'subjects',recordId:subject.id}),()=>db.remove('outbox','synthetic-pending-capture'));
   const lease=await import('/src/lib/offline-lease.js');
   await check('expired-lease',()=>lease.revokeOwnerLeases(cloud.user.id),()=>lease.runtimeOfflineLease().renew(async id=>({id,verifiedAt:Date.now(),source:'supabase-auth-user'})));
   const digest=crypto.subtle.digest;let changed=false;
   await check('replaced-session',()=>{crypto.subtle.digest=async function(...args){const result=await digest.apply(this,args);if(!changed){changed=true;cloud.setMockAuth(cloud.user,{...cloud.session});}return result;};},()=>{crypto.subtle.digest=digest;});
   return results;
  },challenge);
  assert.deepEqual(negatives.map(x=>x[0]),['foreign-owner','missing-document','missing-auth','invalid-calendar','pending-write','expired-lease','replaced-session']);
  assert.equal(negatives.find(x=>x[0]==='pending-write')[1],'sync_pending');
  assert.equal(negatives.find(x=>x[0]==='expired-lease')[1],'not_writable');
  assert.equal(negatives.find(x=>x[0]==='replaced-session')[1],'context_replaced');
  console.log('PASS guarded negative entries: '+negatives.map(x=>x.join(':')).join(', '));
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await panel.evaluate(el=>el.getBoundingClientRect().width<=innerWidth&&getComputedStyle(el).display!=='none'));}
  if(process.env.RAKEEZ_CAPTURE_SCREENSHOT)await panel.screenshot({path:process.env.RAKEEZ_CAPTURE_SCREENSHOT});
  console.log('PASS mounted_context_capture_readonly_guards; encrypted_receipt_no_student_payload; browser_visible_support_binding_default_inert');
 });
}finally{await new Promise(ok=>server.close(ok));}
