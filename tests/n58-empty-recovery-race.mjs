// AI: bounded counterexample, actual application cloud/store + official LOCAL services.
// This is NOT a recovery implementation or a rendered recovery-UI acceptance proof.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {withOfficialServices,freePort,hash} from './n58-empty-recovery-services.mjs';
const runId='8ce51596-fd43-4453-bab9-fd05e8c13020';
const sourceSha='8103557323ae7e342d615c4844268e8d48a71465';
const root=path.resolve('../continuous-n58-fresh-account-calendar-foundation-20261014');
const port=await freePort(),origin='http://127.0.0.1:'+port;
const receipt={runId,sourceSha,scope:'ordinary Sync cannot atomically enforce empty-account repair eligibility',hostedCalls:0,calls:[]};
const git=file=>execFileSync('git',['show',sourceSha+':'+file],{encoding:'utf8'});
let server,browser;
try {
 for(const file of ['src/store.js','src/lib/sync-v2.js','src/lib/cloud.js','src/lib/calendar-runtime.js']) {
  const current=(await fs.readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n');
  assert.equal(current,git(file).replaceAll('\r\n','\n'),'Saved source drift: '+file);
  (receipt.sourceHashes??={})[file]=hash(current);
 }
 const lease=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));
 assert.equal(lease.taskId,'continuous-n58-empty-account-reviewed-recovery-20261014');assert.equal(lease.owner.token,runId);
 const historical=JSON.parse(git('tests/n58-fresh-account-baseline.json'));
 const certified=JSON.parse(git('tests/n58-fresh-account-candidate.json'));
 receipt.reusedRejection={artifactSha256:hash(git('tests/n58-fresh-account-baseline.json')),first:historical.calls.find(c=>c.status===400&&c.result.message==='N58_EXISTING_TERMS_REQUIRED')};
 assert.ok(receipt.reusedRejection.first);
 await withOfficialServices({runId,appOrigin:origin},async services=>{
  receipt.identities=services.identities;receipt.migrations=services.migrations;
  for(const fn of certified.identities.protocolFunctions) assert.equal(services.identities.protocolFunctions.find(x=>x.signature===fn.signature)?.body_md5,fn.body_md5);
  server=await createServer({configFile:false,root,define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'true'},plugins:[{name:'n58-owned-local-target',enforce:'pre',transform(code,id){
   if(id.endsWith('/src/lib/cloud.js'))return code.replace("'https://xlrubcwjqktzzunrvuns.supabase.co'",JSON.stringify(origin)).replace("'sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_'",JSON.stringify(services.anonKey));
  }}],server:{host:'127.0.0.1',port,strictPort:true,proxy:{'/auth/v1':{target:services.authUrl,rewrite:p=>p.replace(/^\/auth\/v1/,'')},'/rest/v1':{target:services.restUrl,rewrite:p=>p.replace(/^\/rest\/v1/,'')}}},logLevel:'error'});
  await server.listen();browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Riyadh'});
  try {
   const page=await context.newPage();
   await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
   await page.routeWebSocket('**/*',socket=>socket.close());
   const email=`n58-race-${runId}@example.invalid`,password='Local!Aa1'+randomBytes(24).toString('base64url');
   const signup=await fetch(origin+'/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json',apikey:services.anonKey},body:JSON.stringify({email,password})});
   const account=await signup.json();assert.equal(signup.status,200);const owner=account.user.id;
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   receipt.boot=await page.evaluate(async({email,password,owner})=>{
    const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    await c.signIn(email,password);await c.provisionAccountProfile();
    await c.completeAccountProfile({teacherName:'Local race fixture',phone:'0500000001',teacherForm:'masculine',schoolName:'Local'});
    s.deactivateWorkspace('n58-race-fixture');
    const r=await(await import('/src/lib/initial-restore.js')).runInitialRestore({expectedOwnerId:owner});
    if(r.status!=='ready')throw Error('Profile-only restore '+r.status);
    const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:c.user});
    if(routing.status!=='ready')throw Error('Workspace routing '+routing.reason);
    s.activateWorkspace(routing.workspace);await s.renewOfflineLease();await s.init();
    return {owner:c.user.id,workspace:s.getActiveWorkspace(),database:d.getActiveDatabaseName(),restore:await d.readInitialRestoreReceipt()};
   },{email,password,owner});
   assert.equal(receipt.boot.owner,owner);assert.equal(receipt.boot.restore.ownerId,owner);
   // Exact known foundation requests from actual app evidence. Fresh identities;
   // never change a failed/previously sent payload under its old mutation ID.
   const templates=certified.calls.filter(c=>c.timing==='before-sync').map(c=>c.envelope);
   const make=e=>({...structuredClone(e),p_mutation_id:randomUUID(),p_device_id:randomUUID(),p_client_updated_at:Date.now()});
   const year=make(templates.find(e=>e.p_entity==='years'&&e.p_operation==='create'));
   const terms=[1,2].map(index=>make(templates.find(e=>e.p_entity==='terms'&&e.p_patch.index===index)));
   const selection=make(templates.find(e=>e.p_entity==='years'&&e.p_operation==='patch'));
   const apply=async(envelope)=>{
    const result=await page.evaluate(async e=>(await import('/src/lib/cloud.js')).applySyncV2Mutation({entity:e.p_entity,recordId:e.p_record_id,mutationId:e.p_mutation_id,deviceId:e.p_device_id,baseRevision:e.p_base_revision,patch:e.p_patch,operation:e.p_operation,clientUpdatedAt:e.p_client_updated_at}),envelope);
    receipt.calls.push({actor:'repair-device',envelope,result});return result;
   };
   // Repeat the actual old selected-year boundary against metadata-matched bodies.
   const rejected=make({...year,p_patch:{...year.p_patch,calendar_preset_id:selection.p_patch.calendar_preset_id}});
   receipt.originalFailure=await page.evaluate(async e=>{
    try {await(await import('/src/lib/cloud.js')).applySyncV2Mutation({entity:e.p_entity,recordId:e.p_record_id,mutationId:e.p_mutation_id,deviceId:e.p_device_id,baseRevision:e.p_base_revision,patch:e.p_patch,operation:e.p_operation});return {unexpectedSuccess:true};}
    catch(error){return {message:error.message,code:error.code};}
   },rejected);
   assert.match(receipt.originalFailure.message,/N58_EXISTING_TERMS_REQUIRED/);
   assert.equal((await apply(year)).outcome,'applied');
   for(const term of terms)assert.equal((await apply(term)).outcome,'applied');
   const schoolStores=['sections','teachings','students','enrollments','sessions','slots','scores','attendance','items','scoreSubitems','scoreSubitemCompletions','notes','assignments','submissions'];
   receipt.before=await page.evaluate(async stores=>{
    const c=await import('/src/lib/cloud.js'),d=await import('/src/lib/db.js'),v=await import('/src/lib/sync-v2.js'),s=await import('/src/store.js');
    const checkpoint={owner:c.user.id,workspace:s.getActiveWorkspace(),database:d.getActiveDatabaseName(),restore:await d.readInitialRestoreReceipt()};
    const local=Object.fromEntries(await Promise.all(stores.map(async n=>[n,await d.getAll(n)])));
    const remote=Object.fromEntries(await Promise.all(stores.map(async n=>[n,await c.fetchRecords(v.SYNC_V2_SCHEMAS[n].entity)])));
    if(c.user.id!==checkpoint.owner||s.getActiveWorkspace()!==checkpoint.workspace||d.getActiveDatabaseName()!==checkpoint.database)throw Error('Checkpoint changed');
    return {checkpoint,local,remote,outbox:await d.getAll('outbox')};
   },schoolStores);
   for(const rows of [...Object.values(receipt.before.local),...Object.values(receipt.before.remote)])assert.equal(rows.length,0);
   // A genuinely independent second authenticated session commits AFTER the last
   // complete owner-filtered empty read but BEFORE the planned selection request.
   const login=await fetch(origin+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:services.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const second=await login.json();assert.equal(login.status,200);assert.equal(second.user.id,owner);
   const section=make(templates.find(e=>e.p_entity==='sections'));section.p_record_id='sec:'+randomUUID();
   const r=await fetch(origin+'/rest/v1/rpc/apply_sync_v2_mutation',{method:'POST',headers:{apikey:services.anonKey,Authorization:'Bearer '+second.access_token,'Content-Type':'application/json','Accept-Profile':'rakeezx','Content-Profile':'rakeezx'},body:JSON.stringify(section)});
   const added=await r.json();receipt.calls.push({actor:'other-device',envelope:section,status:r.status,result:added});assert.equal(r.status,200);assert.equal(added.outcome,'applied');
   receipt.selection=await apply(selection);assert.equal(receipt.selection.outcome,'applied');
   receipt.after=await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js'),d=await import('/src/lib/db.js');return {years:await c.fetchRecords('years'),sections:await c.fetchRecords('sections'),outbox:await d.getAll('outbox')};});
   assert.equal(receipt.after.sections.length,1);assert.equal(receipt.after.sections[0].id,section.p_record_id);
   assert.equal(receipt.after.years[0].calendar_preset_id,selection.p_patch.calendar_preset_id);
   assert.deepEqual(receipt.after.outbox,receipt.before.outbox,'Original local requests must remain untouched');
   receipt.counterexampleConfirmed=true;
   receipt.hold=git('src/store.js').includes('CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = true');assert.equal(receipt.hold,true);
  }finally{await context.close();}
 });
}catch(error){receipt.problem={message:error.message,stack:error.stack};process.exitCode=1;}
finally{await browser?.close();await server?.close();await fs.writeFile('tests/n58-empty-recovery-race.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({counterexampleConfirmed:receipt.counterexampleConfirmed,problem:receipt.problem,originalFailure:receipt.originalFailure,remoteSections:receipt.after?.sections.length,selection:receipt.selection?.outcome}));
