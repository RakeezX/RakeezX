// AI: actual app/UI against the existing official disposable LOCAL protocol.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {withOfficialServices,freePort,hash} from './n58-switch-prevention-services.mjs';
const runId='fa5e0b7c-2b36-49be-8c28-ba15cf905f1f';
const taskId='continuous-n58-calendar-switch-prevention-finish-20261014';
const W='sa-western-1448-1449',G='sa-general-1448-1449';
const port=await freePort(),origin='http://127.0.0.1:'+port;
const receipt={runId,taskId,origin,cases:[],calls:[],externalAttempts:0,hostedAccounts:0};
let server,browser,stage='services';
const files=['src/store.js','src/views/calendar.js','src/lib/sync-v2.js','src/lib/calendar-runtime.js','src/lib/calendar-presets.js','sw.js'];
receipt.sourceHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,hash((await fs.readFile(f,'utf8')).replaceAll('\r\n','\n'))])));
async function checkpoint(page,owner) {
 let result;
 for(let i=0;i<250;i++) {
  result=await page.evaluate(async owner=>{
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
   const w=s.getActiveWorkspace(),database=d.getActiveDatabaseName();
   if(!s.state.ready||c.user?.id!==owner||w?.authUserId!==owner||w.databaseName!==database)return {pending:true};
   const restore=await d.readInitialRestoreReceipt();
   const data=Object.fromEntries(await Promise.all(['years','terms','calendars','calendarDays','sessions','outbox'].map(async n=>[n,await d.getAll(n)])));
   if(restore?.ownerId!==owner||s.getActiveWorkspace()!==w||d.getActiveDatabaseName()!==database)return {pending:true};
   return {owner,database,restore,data};
  },owner);
  if(!result.pending)return result;
  await page.waitForTimeout(100);
 }
 throw Error('Current-document checkpoint timeout: '+JSON.stringify(result));
}
async function clickPreset(page,id,{duplicate=false}={}) {
 await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
 const card=page.locator(`[data-act="set-region"][data-id="${id}"]`);
 await card.waitFor({state:'visible'});
 assert.equal(await card.isEnabled(),true);
 assert.equal(await page.locator('link[href*="calendar-work-0417.css"]').count(),1);
 assert.notEqual(await card.evaluate(e=>getComputedStyle(e).display),'none');
 if(duplicate)await card.dblclick();else await card.click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(async()=> (await import('/src/store.js')).activeYear().calendarPresetId),id);
}
try {
 const lease=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));
 assert.equal(lease.owner.token,runId);assert.equal(lease.taskId,taskId);
 await withOfficialServices({runId,appOrigin:origin},async services=>{
  receipt.identities=services.identities;receipt.migrations=services.migrations;
  server=await createServer({configFile:false,root:process.cwd(),define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'true'},
   plugins:[{name:'n58-owned-local-endpoint',enforce:'pre',transform(code,id){
    if(id.endsWith('/src/lib/cloud.js'))return code.replace("'https://xlrubcwjqktzzunrvuns.supabase.co'",JSON.stringify(origin)).replace("'sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_'",JSON.stringify(services.anonKey));
   }}],server:{host:'127.0.0.1',port,strictPort:true,proxy:{'/auth/v1':{target:services.authUrl,rewrite:p=>p.replace(/^\/auth\/v1/,'')},'/rest/v1':{target:services.restUrl,rewrite:p=>p.replace(/^\/rest\/v1/,'')}}},logLevel:'error'});
  await server.listen();browser=await chromium.launch({headless:true});
  for(const timing of ['before-sync','after-sync']) {
   stage=timing;const result={timing};receipt.cases.push(result);
   const email=`n58-${runId}-${timing}@example.invalid`,password='Local!Aa1'+randomBytes(24).toString('base64url');
   const signup=await fetch(origin+'/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json',apikey:services.anonKey},body:JSON.stringify({email,password})});
   assert.equal(signup.status,200);const owner=(await signup.json()).user.id;
   let loseAck=true,lostEnvelope,delay=false,arrived,releaseAck,holdDispatch=true;
   const dispatchWaiters=[];
   const allowDispatch=()=>{holdDispatch=false;for(const resolve of dispatchWaiters.splice(0))resolve();};
   const configure=async context=>{
    await context.route('**/*',async route=>{
     const url=new URL(route.request().url());if(url.origin!==origin){receipt.externalAttempts++;return route.abort('blockedbyclient');}
     if(url.pathname==='/rest/v1/rpc/apply_sync_v2_mutation'){
      if(holdDispatch)await new Promise(resolve=>dispatchWaiters.push(resolve));
      const envelope=route.request().postDataJSON(),r=await route.fetch(),body=await r.json();
      receipt.calls.push({timing,envelope,status:r.status(),result:body});
      if(delay&&envelope.p_entity==='years'&&envelope.p_operation==='patch'&&body.outcome==='applied'){
       delay=false;arrived();await new Promise(resolve=>{releaseAck=resolve;});
      }
      if(loseAck&&envelope.p_entity==='years'&&envelope.p_operation==='patch'&&body.outcome==='applied'){
       loseAck=false;lostEnvelope=envelope;return route.abort('failed');
      }
      return route.fulfill({response:r});
     }
     return route.continue();
    });
    await context.routeWebSocket('**/*',socket=>socket.close());
   };
   const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Riyadh'});
   try {
    await configure(context);const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});
    result.boot=await page.evaluate(async ({email,password,owner})=>{
     const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');await c.signIn(email,password);await c.provisionAccountProfile();
     await c.completeAccountProfile({teacherName:'N58 switch local',phone:'0500000001',teacherForm:'masculine',schoolName:'Local fixture'});
     if((await c.fetchRecords('years')).length)throw Error('Not an empty account');
     s.deactivateWorkspace('n58-switch-fixture');const r=await(await import('/src/lib/initial-restore.js')).runInitialRestore({expectedOwnerId:owner});if(r.status!=='ready')throw Error(r.status);
     const w=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:c.user});if(w.status!=='ready')throw Error(w.reason);
     s.activateWorkspace(w.workspace);await s.renewOfflineLease();await s.init();return {years:s.state.years,terms:s.state.terms,sections:s.state.sections};
    },{email,password,owner});
    assert.equal(result.boot.sections.length,0);assert.equal(result.boot.years.length,1);assert.equal(result.boot.terms.length,2);
    // Let the normal app boot mount its authenticated router. Hold transport
    // pending (never rejected) until the before-first-Sync clicks are complete.
    await page.reload({waitUntil:'domcontentloaded'});await checkpoint(page,owner);
    const dispatch=()=>page.evaluate(async()=>{const c=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js'),g=await import('/src/lib/sync-ownership.js');return v.createSyncV2Engine({ownershipGuard:g.runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>c.user?.id}).dispatchPending();});
    const drain=async()=>{for(let i=0;i<6;i++)await dispatch();};
    if(timing==='after-sync') {
     allowDispatch();
     await drain();
     result.recordedSession=await page.evaluate(async()=>{const s=await import('/src/store.js'),m=await import('/src/models.js');const section=await s.createSection({yearId:s.activeYear().id,grade:4,label:'أ'});const teaching=await s.createTeaching({sectionId:section.id,termId:s.activeTerm().id,subjectId:'sub:digital-skills'});return s.ensureSession(teaching.id,m.todayISO(),1);});
     assert.ok(result.recordedSession);await drain();result.historyBefore=(await checkpoint(page,owner)).data.sessions;
    }
    await page.goto(origin+'/#/calendar');
    await clickPreset(page,G,{duplicate:true});result.generalBeforeAck=await checkpoint(page,owner);
    const count=receipt.calls.length;
    result.wrongOwner=await page.evaluate(async()=>{const v=await import('/src/lib/sync-v2.js'),g=await import('/src/lib/sync-ownership.js');return v.createSyncV2Engine({ownershipGuard:g.runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=> '00000000-0000-4000-8000-000000000099'}).dispatchPending();});
    assert.equal(result.wrongOwner.attempted,0);assert.ok(result.wrongOwner.ownershipBlocked>0);assert.equal(receipt.calls.length,count);
    if(timing==='after-sync') {
     delay=true;const ackArrived=new Promise(resolve=>{arrived=resolve;});const inFlight=dispatch();
     try {await Promise.race([ackArrived,new Promise((_,reject)=>setTimeout(()=>reject(Error('No delayed selection request')),15000))]);
      result.pendingAck=await checkpoint(page,owner);
      assert.ok(result.pendingAck.data.outbox.some(x=>x.store==='years'&&x.state!=='rejected'));
      assert.ok(result.pendingAck.data.outbox.every(x=>x.state!=='rejected'));
      await clickPreset(page,W,{duplicate:true});
     } finally {releaseAck?.();await inFlight;}
    } else {await clickPreset(page,W,{duplicate:true});allowDispatch();}
    await drain();
    result.settled=await checkpoint(page,owner);
    result.remote=await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');return {years:await c.fetchRecords('years'),terms:await c.fetchRecords('terms'),calendars:await c.fetchRecords('calendars'),days:await c.fetchRecords('calendar_days'),sessions:await c.fetchRecords('sessions')};});
    assert.equal(result.settled.data.outbox.length,0);assert.equal(result.remote.years.length,1);assert.equal(result.remote.terms.length,2);
    assert.equal(result.remote.years[0].calendar_preset_id,W);assert.equal(result.remote.calendars.length,0);assert.equal(result.remote.days.length,0);
    assert.deepEqual(result.settled.data.years.map(x=>x.id),result.boot.years.map(x=>x.id));
    assert.deepEqual(result.settled.data.terms.map(x=>x.id).sort(),result.boot.terms.map(x=>x.id).sort());
    if(result.historyBefore)assert.deepEqual(result.settled.data.sessions,result.historyBefore);
    const calls=receipt.calls.filter(x=>x.timing===timing);
    assert.ok(calls.every(x=>x.status===200&&x.result.outcome==='applied'));
    assert.equal(calls.filter(x=>['calendars','calendar_days'].includes(x.envelope.p_entity)).length,0);
    assert.ok(lostEnvelope);const retries=calls.filter(x=>x.envelope.p_mutation_id===lostEnvelope.p_mutation_id);
    assert.equal(retries.length,2);assert.deepEqual(retries[0],retries[1]);result.lostAckImmutable=true;
    await page.reload({waitUntil:'domcontentloaded'});result.reload=await checkpoint(page,owner);
    assert.equal(result.reload.data.years[0].calendarPresetId,W);assert.equal(result.reload.data.outbox.length,0);
    if(result.historyBefore)assert.deepEqual(result.reload.data.sessions,result.historyBefore);
    await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
    assert.equal(await page.locator('[data-act="set-region"][aria-pressed="true"]').getAttribute('data-id'),W);
    await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
   } finally {allowDispatch();releaseAck?.();await context.close();}
   // A new context uses real sign-in + initial restore, not copied storage/cookies.
   const second=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Riyadh'});
   try {
    await configure(second);const page=await second.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.evaluate(async ({email,password,owner})=>{const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');await c.signIn(email,password);s.deactivateWorkspace('n58-second-context');const r=await(await import('/src/lib/initial-restore.js')).runInitialRestore({expectedOwnerId:owner});if(r.status!=='ready')throw Error(r.status);const w=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:c.user});if(w.status!=='ready')throw Error(w.reason);s.activateWorkspace(w.workspace);await s.renewOfflineLease();await s.init();},{email,password,owner});
    // The independent app document must boot the authenticated router after
    // fixture sign-in, just as the first context does.
    await page.reload({waitUntil:'domcontentloaded'});
    result.secondContext=await checkpoint(page,owner);
    assert.equal(result.secondContext.data.years[0].calendarPresetId,W);assert.equal(result.secondContext.data.outbox.length,0);
    assert.deepEqual(result.secondContext.data.terms.map(x=>x.id).sort(),result.boot.terms.map(x=>x.id).sort());
    if(result.historyBefore)assert.deepEqual(result.secondContext.data.sessions.map(x=>x.calendarContext),result.historyBefore.map(x=>x.calendarContext));
    await page.goto(origin+'/#/calendar');await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
    assert.equal(await page.locator('[data-act="set-region"][aria-pressed="true"]').getAttribute('data-id'),W);
    result.actualDOM=true;
   } finally {await second.close();}
   result.pass=true;
  }
 });receipt.completed=true;
} catch(error){receipt.problem={stage,message:error.message,stack:error.stack};process.exitCode=1;}
finally {await browser?.close();await server?.close();receipt.resourcesClosed=true;await fs.writeFile('tests/n58-switch-prevention-ui.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({completed:receipt.completed,problem:receipt.problem,cases:receipt.cases.map(x=>({timing:x.timing,pass:x.pass})),resourcesClosed:receipt.resourcesClosed}));
