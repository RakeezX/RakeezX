// AI: actual old bootstrap -> current reviewed recovery UI, official LOCAL services.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {withOfficialServices,freePort,hash} from './n58-empty-recovery-services.mjs';
const runId='79f2600c-16c3-4f27-9092-8c1aedd2f9cc',port=await freePort(),origin='http://127.0.0.1:'+port;
const oldStore=execFileSync('git',['show','a256a1cce6f0368a1a4dbe3dc24ead677cfaf0d5:src/store.js'],{encoding:'utf8'});
const receipt={runId,checks:[],calls:[],externalAttempts:0,hostedCalls:0,oldStoreHash:hash(oldStore)};
let server,browser,phase='old';
const checkpoint=async page=>{const deadline=Date.now()+25000;let result;while(Date.now()<deadline){result=await page.evaluate(async()=>{
 const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
 const workspace=s.getActiveWorkspace(),database=d.getActiveDatabaseName(),owner=c.user?.id;
 if(document.readyState!=='complete'||!s.state.ready||workspace?.authUserId!==owner||workspace.databaseName!==database)return {pending:true,observed:{ready:s.state.ready,workspace,database,owner}};
 const restore=await d.readInitialRestoreReceipt();if(restore?.ownerId!==owner)return {pending:true,observed:{restore,owner,database}};
 const rows=Object.fromEntries(await Promise.all(['years','terms','calendars','calendarDays','outbox','sessions','sections','students'].map(async n=>[n,await d.getAll(n)])));
 if(s.getActiveWorkspace()!==workspace||d.getActiveDatabaseName()!==database||c.user?.id!==owner)throw Error('Checkpoint changed');
 return {owner,database,restore,rows};
});if(!result.pending)return result;await page.waitForTimeout(100);}throw Error('Current-document checkpoint timeout: '+JSON.stringify(result));};
try {
 const lease=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));assert.equal(lease.owner.token,runId);
 await withOfficialServices({runId,appOrigin:origin},async svc=>{
  receipt.identities=svc.identities;receipt.migrations=svc.migrations;receipt.schema=await svc.inspectAtomic();
  receipt.sourceHashes=Object.fromEntries(await Promise.all(['src/app.js','src/store.js','src/lib/calendar-recovery.js','src/lib/cloud.js','src/lib/sync-v2.js','sw.js'].map(async file=>[file,hash((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n'))])));
  const startServer=async()=>{server=await createServer({configFile:false,root:process.cwd(),define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'true'},plugins:[{name:'n58-local-source-fixture',enforce:'pre',transform(code,id){
   if(id.endsWith('/src/lib/cloud.js'))return code.replace("'https://xlrubcwjqktzzunrvuns.supabase.co'",JSON.stringify(origin)).replace("'sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_'",JSON.stringify(svc.anonKey));
   if(phase==='old'&&id.endsWith('/src/store.js'))return oldStore;
  }}],server:{hmr:false,host:'127.0.0.1',port,strictPort:true,proxy:{'/auth/v1':{target:svc.authUrl,rewrite:p=>p.replace(/^\/auth\/v1/,'')},'/rest/v1':{target:svc.restUrl,rewrite:p=>p.replace(/^\/rest\/v1/,'')}}},logLevel:'error'});await server.listen();};
  await startServer();browser=await chromium.launch({headless:true});
  for(const testCase of [{width:1280,lost:false,dispatches:1},{width:390,lost:true,dispatches:4}].filter(c=>!process.env.N58_RECOVERY_WIDTH||c.width===Number(process.env.N58_RECOVERY_WIDTH))) {
   if(phase!=='old'){await server.close();phase='old';await startServer();}
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width:testCase.width,height:900},timezoneId:'Asia/Riyadh'});
   try {
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));receipt.documentErrors=errors;page.on('console',m=>{if(m.type()==='error')(receipt.consoleErrors??=[]).push(m.text().slice(0,500));});let lose=testCase.lost;
    await page.route('**/*',async route=>{
     const url=new URL(route.request().url());if(url.origin!==origin){receipt.externalAttempts++;return route.abort('blockedbyclient');}
     if(url.pathname==='/rest/v1/rpc/apply_n58_empty_foundation'){
      const body=route.request().postDataJSON(),response=await route.fetch(),result=await response.json();receipt.calls.push({width:testCase.width,body,status:response.status(),result});
      if(lose&&response.ok()){lose=false;return route.abort('failed');}return route.fulfill({response});
     }return route.continue();
    });await page.routeWebSocket('**/*',socket=>socket.close());
    const email='n58-ui-'+randomUUID()+'@example.invalid',password='Local!Aa1'+randomBytes(24).toString('hex');
    const signup=await fetch(origin+'/auth/v1/signup',{method:'POST',headers:{apikey:svc.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const a=await signup.json();assert.equal(signup.status,200);
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.evaluate(async({email,password,owner})=>{
     const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');
     await c.signIn(email,password);await c.provisionAccountProfile();await c.completeAccountProfile({teacherName:'Local empty repair',phone:'0500000001',teacherForm:'masculine',schoolName:'Local'});
     s.deactivateWorkspace('n58-old-source-repair-fixture');
     const restored=await(await import('/src/lib/initial-restore.js')).runInitialRestore({expectedOwnerId:owner});if(restored.status!=='ready')throw Error('Restore '+restored.status);
     const route=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:c.user});if(route.status!=='ready')throw Error('Route '+route.reason);
     s.activateWorkspace(route.workspace);await s.renewOfflineLease();await s.init();
    },{email,password,owner:a.user.id});
    for(let i=0;i<testCase.dispatches;i++)await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js'),g=await import('/src/lib/sync-ownership.js');return v.createSyncV2Engine({ownershipGuard:g.runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>c.user?.id}).dispatchPending();});
    const old=await checkpoint(page);assert.ok(old.rows.outbox.some(r=>r.store==='years'&&r.lastError?.message==='N58_EXISTING_TERMS_REQUIRED'));
    await server.close();phase='current';await startServer();await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(async owner=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');return s.state.ready&&c.user?.id===owner&&s.getActiveWorkspace()?.authUserId===owner;},a.user.id);
    const before=await checkpoint(page),review=await page.evaluate(()=>(import('/src/store.js')).then(s=>s.reviewCalendarFoundationRepair()));assert.equal(review.status,'review',JSON.stringify(review));
    const open=async()=>{await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();await page.locator('[data-act="review-calendar-repair"]').click();await page.locator('[data-calendar-repair-review]').waitFor();};
    await open();assert.ok(await page.locator('[data-calendar-repair-confirm]').isDisabled());
    const metrics=await page.locator('[data-calendar-repair-review]').evaluate(el=>({text:el.textContent,width:el.getBoundingClientRect().width,font:getComputedStyle(el).fontFamily,viewport:innerWidth,css:!!document.querySelector('link[href*="app.css"]')}));assert.ok(metrics.width<=testCase.width);assert.ok(metrics.css);assert.ok(!metrics.text.includes('ستة'));
    await page.getByRole('button',{name:'إلغاء',exact:true}).last().click();assert.deepEqual((await checkpoint(page)).rows.outbox,before.rows.outbox);assert.equal(receipt.calls.filter(c=>c.width===testCase.width).length,0);
    // Existing hub remains open after cancel. Close it before support/review.
    await page.keyboard.press('Escape');
    await open();await page.locator('[data-calendar-repair-support]').click();await page.waitForURL('**/#/support');assert.equal(await page.locator('[data-calendar-repair-review]').count(),0);
    await page.goto(origin+'/#/calendar');await open();
    await page.locator('[data-calendar-repair-ack]').check();assert.ok(await page.locator('[data-calendar-repair-confirm]').isEnabled());
    await page.locator('[data-calendar-repair-confirm]').click();
    if(testCase.lost){
     await page.locator('[data-calendar-repair-retry]').waitFor({state:'visible'});
     const pending=await checkpoint(page);assert.equal(pending.rows.outbox.filter(r=>r.protocol==='N58_EMPTY_V1').length,1);assert.equal(pending.rows.outbox.find(r=>r.protocol==='N58_EMPTY_V1').state,'pending');
     await page.reload({waitUntil:'domcontentloaded'});
     await page.waitForFunction(async owner=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId===owner;},a.user.id);
     await checkpoint(page);await open();assert.equal(await page.locator('[data-calendar-repair-confirm]').count(),0);await page.locator('[data-calendar-repair-retry]').click();
    }
    await page.locator('[data-calendar-repair-message]').filter({hasText:'تأكد إصلاح'}).waitFor();
    const after=await checkpoint(page),audit=after.rows.outbox.find(r=>r.protocol==='N58_EMPTY_V1');assert.equal(audit.state,'verified');
    assert.deepEqual(audit.review.originals,before.rows.outbox.filter(r=>['years','terms','calendars','calendarDays'].includes(r.store)&&r.protocol==='v2'&&r.state!=='superseded'));
    assert.equal(after.rows.outbox.filter(r=>r.recoveryReason==='N58_EMPTY_V1').length,audit.review.originals.length);
    assert.deepEqual(after.rows.calendars,before.rows.calendars);assert.deepEqual(after.rows.calendarDays,before.rows.calendarDays);
    if(testCase.lost){const calls=receipt.calls.filter(c=>c.width===testCase.width);assert.equal(calls.length,2);assert.deepEqual(calls[0].body,calls[1].body);assert.deepEqual(calls[0].result,calls[1].result);}
    await page.getByRole('button',{name:'إلغاء',exact:true}).last().click();await page.keyboard.press('Escape');
    await page.goto(origin+'/#/calendar');await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();assert.ok(await page.locator('[data-act="set-region"]').first().isDisabled());
    assert.equal(errors.length,0,JSON.stringify(errors));receipt.checks.push({testCase,metrics,oldFailureCount:old.rows.outbox.filter(r=>r.state==='rejected').length,before,after,status:'PASS'});
   }finally{await context.close();}
  }
 });receipt.completed=true;
}catch(error){receipt.problem={message:error.message,stack:error.stack};process.exitCode=1;}
finally{await browser?.close();await server?.close();await fs.writeFile('tests/n58-empty-recovery-ui.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({completed:receipt.completed,checks:receipt.checks.map(c=>({width:c.testCase.width,status:c.status})),problem:receipt.problem}));
