// AI: bounded actual app + official LOCAL Auth/PostgREST/Postgres experiment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {withOfficialServices,freePort,hash} from './n58-fresh-account-services.mjs';
const runId='ba07cfbe-1861-4a6b-a4b1-2137ec432a26';
const baseSha='a256a1cce6f0368a1a4dbe3dc24ead677cfaf0d5';
const mode=process.env.N58_FRESH_MODE ?? 'baseline';
const receipt={runId,baseSha,mode,checks:[],calls:[],externalAttempts:0,hostedAccounts:0};
const G='sa-general-1448-1449',W='sa-western-1448-1449';
const port=await freePort(),origin='http://127.0.0.1:'+port;
let server,browser,stage='services';
receipt.sourceHashes=Object.fromEntries(await Promise.all(['src/store.js','src/lib/sync-v2.js','src/lib/calendar-runtime.js','sw.js'].map(async file=>[file,hash((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n'))])));
try {
 await withOfficialServices({runId,appOrigin:origin},async services=>{
  receipt.identities=services.identities;receipt.migrations=services.migrations;
  const oldStore=execFileSync('git',['show',baseSha+':src/store.js'],{encoding:'utf8'});
  receipt.baselineStoreHash=hash(oldStore);
  server=await createServer({configFile:false,root:process.cwd(),define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'true'},
   plugins:[{name:'n58-only-local-fixture',enforce:'pre',transform(code,id){
    if(id.endsWith('/src/lib/cloud.js'))return code.replace("'https://xlrubcwjqktzzunrvuns.supabase.co'",JSON.stringify(origin)).replace("'sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_'",JSON.stringify(services.anonKey));
    // Test-only historical/candidate entry: shipped hold remains true.
    if(id.endsWith('/src/store.js'))return (mode==='baseline'?oldStore:code).replace('CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = true','CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = false');
   }}],server:{host:'127.0.0.1',port,strictPort:true,proxy:{'/auth/v1':{target:services.authUrl,rewrite:p=>p.replace(/^\/auth\/v1/,'')},'/rest/v1':{target:services.restUrl,rewrite:p=>p.replace(/^\/rest\/v1/,'')}}},logLevel:'error'});
  await server.listen();
  const lease=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));
  assert.equal(lease.owner.token,runId);assert.equal(lease.taskId,'continuous-n58-fresh-account-calendar-foundation-20261014');
  browser=await chromium.launch({headless:true});
  for(const timing of mode==='baseline'?['before-sync','after-sync']:['default-only','before-sync','after-sync']) {
   stage=timing;
   const email=`n58-${runId}-${mode}-${timing}@example.invalid`,password='Local!Aa1'+randomBytes(24).toString('base64url');
   const response=await fetch(origin+'/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json',apikey:services.anonKey},body:JSON.stringify({email,password})});
   const account=await response.json();assert.equal(response.status,200);const owner=account.user.id;
   const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Riyadh'});
   try {
    const page=await context.newPage();
    let loseSelectionAck=mode==='candidate'&&timing==='before-sync',lostMutation;
    await page.route('**/*',async route=>{
     const url=new URL(route.request().url());if(url.origin!==origin){receipt.externalAttempts++;return route.abort('blockedbyclient');}
     if(url.pathname==='/rest/v1/rpc/apply_sync_v2_mutation'){
      const envelope=route.request().postDataJSON(),r=await route.fetch(),result=await r.json();
      receipt.calls.push({timing,envelope,status:r.status(),result});
      if(loseSelectionAck&&envelope.p_entity==='years'&&envelope.p_operation==='patch'&&result.outcome==='applied'){
       loseSelectionAck=false;lostMutation=envelope.p_mutation_id;return route.abort('failed');
      }
      return route.fulfill({response:r});
     }
     return route.continue();
    });
    await page.routeWebSocket('**/*',socket=>socket.close());
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    // Profile-only real LOCAL account. Restore its actual manifest before first
    // store.init; no foundation SQL seed, mock transport or Product guard override.
    const boot=await page.evaluate(async ({email,password,owner})=>{
     const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');
     await c.signIn(email,password);await c.provisionAccountProfile();
     await c.completeAccountProfile({teacherName:'N58 local empty',phone:'0500000001',teacherForm:'masculine',schoolName:'Local fixture'});
     const initial=await c.fetchRecords('years');if(initial.length)throw Error('Account not empty');
     s.deactivateWorkspace('n58-profile-only-fixture');
     const r=await(await import('/src/lib/initial-restore.js')).runInitialRestore({expectedOwnerId:owner});
     if(r.status!=='ready')throw Error('Profile-only restore: '+r.status);
     const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:c.user});
     if(routing.status!=='ready')throw Error('Profile-only routing: '+routing.reason);
     s.activateWorkspace(routing.workspace);await s.renewOfflineLease();await s.init();
     const d=await import('/src/lib/db.js');
     return {workspace:s.getActiveWorkspace(),years:s.state.years,terms:s.state.terms,outbox:await d.getAll('outbox'),classes:s.state.sections.length};
    },{email,password,owner});
    assert.equal(boot.classes,0);assert.equal(boot.workspace.authUserId,owner);
    if(mode==='candidate'){
     const callCount=receipt.calls.length;
     const wrong=await page.evaluate(async()=>{
      const c=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js'),g=await import('/src/lib/sync-ownership.js');
      return v.createSyncV2Engine({ownershipGuard:g.runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=> '00000000-0000-4000-8000-000000000099'}).dispatchPending();
     });
     assert.equal(wrong.attempted,0);assert.ok(wrong.ownershipBlocked>0);assert.equal(receipt.calls.length,callCount);
    }
    const dispatch=()=>page.evaluate(async()=>{
     const c=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js'),g=await import('/src/lib/sync-ownership.js');
     return v.createSyncV2Engine({ownershipGuard:g.runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>c.user?.id}).dispatchPending();
    });
    if(timing==='after-sync')for(let i=0;i<4;i++)await dispatch();
    const selection=timing==='default-only'?{default:true}:await page.evaluate(async G=>(await import('/src/store.js')).applyCalendarPreset(G),G);
    let earlySession;
    if(mode==='candidate'&&timing==='before-sync'){
     earlySession=await page.evaluate(async()=>{
      const s=await import('/src/store.js'),m=await import('/src/models.js');
      const section=await s.createSection({yearId:s.activeYear().id,grade:4,label:'أ'});
      const teaching=await s.createTeaching({sectionId:section.id,termId:s.activeTerm().id,subjectId:'sub:digital-skills'});
      return s.ensureSession(teaching.id,m.todayISO(),1);
     });
     assert.ok(earlySession);assert.equal(earlySession.calendarContext.presetId,G);
     assert.equal(earlySession.calendarContext.selectionRevision,undefined);
    }
    for(let i=0;i<6;i++)await dispatch();
    const snapshot=await page.evaluate(async()=>{
     const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
     return {local:Object.fromEntries(await Promise.all(['years','terms','calendars','calendarDays','outbox'].map(async n=>[n,await d.getAll(n)]))),remote:{years:await c.fetchRecords('years'),terms:await c.fetchRecords('terms'),calendars:await c.fetchRecords('calendars'),days:await c.fetchRecords('calendar_days')}};
    });
    receipt.checks.push({timing,boot,selection,snapshot});
    if(mode==='candidate'){
     const selected=timing==='default-only'?W:G;
     assert.equal(snapshot.remote.years[0].calendar_preset_id,selected);
     assert.equal(snapshot.remote.terms.length,2);assert.equal(snapshot.remote.calendars.length,0);assert.equal(snapshot.remote.days.length,0);
     assert.equal(snapshot.local.outbox.length,0);
     assert.ok(snapshot.remote.years[0].field_revisions.calendar_selection>0);
     const calls=receipt.calls.filter(x=>x.timing===timing);
     const yearCreate=calls.find(x=>x.envelope.p_entity==='years'&&x.envelope.p_operation==='create');
     assert.ok(yearCreate);assert.equal(yearCreate.envelope.p_patch.calendar_preset_id,undefined);
     const firstSelection=calls.findIndex(x=>x.envelope.p_entity==='years'&&x.envelope.p_operation==='patch');
     assert.equal(calls.slice(0,firstSelection).filter(x=>x.envelope.p_entity==='terms'&&x.result.outcome==='applied').length,2);
     if(lostMutation){const repeated=calls.filter(x=>x.envelope.p_mutation_id===lostMutation);assert.equal(repeated.length,2);assert.deepEqual(repeated[0],repeated[1]);}
     if(earlySession){
      const saved=calls.find(x=>x.envelope.p_entity==='sessions'&&x.envelope.p_record_id===earlySession.id&&x.result.outcome==='applied');
      assert.ok(saved);assert.equal(saved.envelope.p_patch.calendar_context.selectionRevision,snapshot.remote.years[0].field_revisions.calendar_selection);
      receipt.checks.at(-1).sessionReceipt=saved;
     }
     // Actual store scoped override entry and server serializer. Raw terms stay
     // byte-preserved; a duplicate receipt cannot mint another scope.
     const rawTerms=structuredClone(snapshot.remote.terms);
     await page.evaluate(async()=>{const s=await import('/src/store.js');await s.updateTermDates(s.state.terms.find(t=>t.index===1).id,'2026-08-31','2027-01-06');});
     for(let i=0;i<3;i++)await dispatch();
     const scoped=await page.evaluate(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');return {terms:await c.fetchRecords('terms'),calendars:await c.fetchRecords('calendars'),effective:s.termsOf(s.activeYear().id)};});
     assert.deepEqual(scoped.terms,rawTerms);assert.equal(scoped.calendars.length,1);assert.equal(scoped.calendars[0].preset_id,selected);
     assert.equal(scoped.effective.find(t=>t.index===1).startDate,'2026-08-31');
     receipt.checks.at(-1).scoped=scoped;
     // Reload fixture: obtain owner/database/restore receipt and relevant rows
     // together from the current document, never from a prior readiness check.
     await page.reload({waitUntil:'domcontentloaded'});
     let checkpoint;
     const checkpointDeadline=Date.now()+25000;
     while(Date.now()<checkpointDeadline){
     checkpoint=await page.evaluate(async owner=>{
      const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js'),w=s.getActiveWorkspace(),database=d.getActiveDatabaseName();
      if(document.readyState!=='complete'||!s.state.ready||c.user?.id!==owner||w?.authUserId!==owner||w.databaseName!==database)return {pending:true,ready:s.state.ready,auth:c.user?.id,workspace:w,database};
      const r=await d.readInitialRestoreReceipt(),data={years:await d.getAll('years'),terms:await d.getAll('terms'),outbox:await d.getAll('outbox')};
      if(r?.ownerId!==owner||s.getActiveWorkspace()!==w||d.getActiveDatabaseName()!==database)return {pending:true,receipt:r,workspace:w,database};
      return {owner,database,receipt:r,data};
     },owner);
      if(!checkpoint.pending)break;
      await page.waitForTimeout(100);
     }
     receipt.checks.at(-1).reload=checkpoint;
     assert.equal(checkpoint.pending,undefined,'Current-document checkpoint: '+JSON.stringify(checkpoint));
     assert.equal(checkpoint.data.years[0].calendarPresetId,selected);assert.equal(checkpoint.data.outbox.length,0);
     await page.goto(origin+'/#/calendar');
     await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
     assert.equal(await page.locator('[data-act="set-region"][aria-pressed="true"]').getAttribute('data-id'),selected);
     assert.equal(await page.locator('link[href*="calendar-work-0417.css"]').count(),1);
     await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
     receipt.checks.at(-1).actualCalendarDOM=true;
    }
   } finally {await context.close();}
  }
 });
 receipt.completed=true;
} catch(error){receipt.problem={stage,message:error.message,code:error.code};process.exitCode=1;}
finally {await browser?.close();await server?.close();await fs.writeFile(`tests/n58-fresh-account-${mode}.json`,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({mode,completed:receipt.completed,problem:receipt.problem,checks:receipt.checks.map(x=>({timing:x.timing,outbox:x.snapshot.local.outbox.length,actualCalendarDOM:x.actualCalendarDOM})),firstRejected:receipt.calls.find(x=>x.status>=400)}));
