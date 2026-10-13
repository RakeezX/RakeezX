/** Exact N71 same-pair runner. No admin key, real account, broad query or Product service seeding. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { canonical, fixtureEmail, PURPOSE, PROJECT_ID } from '../../supabase/functions/ops-n71-fixture/handler-core.mjs';
import { fixtureIds, portableFixture } from './fixture.mjs';
const exec=promisify(execFile);
const TASK='continuous-n71-unified-restore-20261012',RUN=process.env.N71_RUN_ID;
assert.match(RUN??'',/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,'Pass the activated run through N71_RUN_ID');
const root=path.resolve('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/capabilities/n71',RUN);
const stateFile=path.join(root,'.env.n71-state');
const url=`https://${PROJECT_ID}.supabase.co`,key='sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_';
const suffix=RUN.replaceAll('-','').slice(0,20);
const names={provision:'ops-n71-fixture-'+suffix,cleanup:'ops-n71-retire-'+suffix};
const evidenceRoot=path.resolve('coverage/n71-live',RUN);
const hash=value=>createHash('sha256').update(value).digest('hex');
const git=async(...args)=>(await exec('git',args,{windowsHide:true})).stdout.trim();
const save=async state=>{await fs.writeFile(stateFile+'.tmp',JSON.stringify(state,null,2));await fs.rename(stateFile+'.tmp',stateFile);};
const load=async()=>{const state=JSON.parse(await fs.readFile(stateFile,'utf8'));assert.equal(state.runId,RUN);return state;};
const evidence=async state=>{await fs.mkdir(evidenceRoot,{recursive:true});
  await fs.writeFile(path.join(evidenceRoot,'live-result.json'),JSON.stringify({taskId:TASK,runId:RUN,candidateSha:state.candidateSha,
    phase:state.phase,checks:state.checks,cleanup:state.cleanup,error:state.error,diagnostics:state.diagnostics},null,2));};
const publicError=error=>({name:error?.name,code:error?.code??null,message:String(error?.message??error).slice(0,400),stack:String(error?.stack??'').split('\n').slice(0,8).join('\n')});
function check(state,name,evidence){state.checks.push({name,status:'PASS',evidence});console.log(JSON.stringify({check:name,status:'PASS',evidence}));}
async function wire(endpoint,body,headers={}) {
  const response=await fetch(url+endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'content-type':'application/json',apikey:key,...headers},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
async function ops(state,mode,operation,extra={}) {
  if(operation==='ensure'&&Date.now()>=Date.parse(state.liveDeadline))throw Error('Live mutation deadline reached; retire same pair');
  const result=await wire('/functions/v1/'+names[mode],{version:1,runId:RUN,operation,...extra},
    {'x-n71-capability':state.capabilities[mode]});
  assert.equal(result.status,200,`N71 ${mode} ${operation} denied: ${result.body.errorCode}`);
  assert.equal(result.body.runId,RUN);assert.equal(result.body.projectId,PROJECT_ID);
  assert.equal(result.body.fixtureContractSha256,state.fixtureContractSha256);
  return result.body;
}
async function storeSession(state,slot,session,context) {
  assert.equal(session.user.id,state.accounts.find(a=>a.slot===slot).id);
  const existing=state.sessions.find(s=>s.refresh_token===session.refresh_token);
  if(!existing)state.sessions.push({slot,context,...session});await save(state);
}
async function passwordSession(account) {
  const result=await wire('/auth/v1/token?grant_type=password',{email:account.email,password:account.password});
  assert.equal(result.status,200,'Synthetic password sign-in failed');assert.equal(result.body.user.id,account.id);return result.body;
}
async function retire(state,pages=[]) {
  state.phase='RETIRE_PENDING';await save(state);
  for(const {page,slot,label}of pages)try{await storeSession(state,slot,await page.evaluate(async()=>structuredClone((await import('/src/lib/cloud.js')).session)),label);}catch{}
  const cleanup=[];
  for(const account of state.accounts){
    const inspection=await ops(state,'cleanup','inspect',{slot:account.slot});
    if(inspection.state==='absent'){cleanup.push({slot:account.slot,state:'absent'});continue;}
    let sessions=state.sessions.filter(s=>s.slot===account.slot);
    if(!sessions.length&&inspection.state!=='retained_banned'){
      await storeSession(state,account.slot,await passwordSession(account),'cleanup-recovery');sessions=state.sessions.filter(s=>s.slot===account.slot);
    }
    if(inspection.state!=='retained_banned'){
      assert.ok(sessions.length,'Cannot prove global sign-out without same-pair session');
      const current=sessions.at(-1);const revoked=await ops(state,'cleanup','revoke',{slot:account.slot,accessToken:current.access_token});
      assert.equal(revoked.state,'sign_out_acknowledged');
      state.revocations[account.slot]={verifiedAt:new Date().toISOString(),state:revoked.state};await save(state);
    } else assert.ok(state.revocations[account.slot],'Retained ban lacks durable global sign-out receipt');
    const retired=await ops(state,'cleanup','retire',{slot:account.slot});assert.equal(retired.state,'retained_banned');
    const password=await wire('/auth/v1/token?grant_type=password',{email:account.email,password:account.password});
    assert.ok([400,401,403].includes(password.status),'Banned password unexpectedly accepted');
    const refresh=[];
    for(const session of sessions){
      const denied=await wire('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
      assert.ok([400,401,403].includes(denied.status),'Revoked refresh unexpectedly accepted');
      const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
      assert.equal(claims.sub,account.id);
      refresh.push({context:session.context,status:denied.status,errorCode:denied.body.error_code??denied.body.code??denied.body.error,
        residualAccessJwtExpiresAt:new Date(claims.exp*1000).toISOString(),residualJwtRevoked:false});
    }
    cleanup.push({slot:account.slot,authId:account.id,state:retired.state,bannedUntil:retired.bannedUntil,
      globalSignOut:state.revocations[account.slot],passwordDenial:{status:password.status,errorCode:password.body.error_code??password.body.code},
      refresh,retention:'Exact synthetic foundation and purpose-created Product records retained; no deletion attempted'});
    state.cleanup=cleanup;await save(state);
  }
  state.phase='DISARM_REQUIRED';await save(state);await evidence(state);
}
async function prepare(preview,candidate){
  assert.match(candidate??'',/^[a-f0-9]{40}$/);assert.equal(await git('rev-parse','HEAD'),candidate);
  const card=JSON.parse(await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+TASK+'.json','utf8'));
  assert.equal(card.attempt.runId,RUN);assert.equal(card.productId,'N71');
  assert.equal(card.liveAuthorizationRef,card.preparationAuthority.liveAuthorizationRef);
  const verification=card.preparationAuthority.supabase.correctedVerificationPhase;
  const preflight=JSON.parse(await fs.readFile(path.join(evidenceRoot,'valid-deletion-preflight.json'),'utf8'));
  assert.equal(preflight.status,'PASS');assert.equal(preflight.runId,RUN);
  assert.equal(preflight.sharedLiveSequence,true);assert.equal(preflight.nativeSql,true);
  for(const [file,digest]of Object.entries(preflight.sourceHashes))assert.equal(hash((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')),digest,'Preflight source changed: '+file);
  const phaseBinding=path.join(path.dirname(root),'phase-'+verification.phase+'.json');
  try{const previous=JSON.parse(await fs.readFile(phaseBinding,'utf8'));throw Error('Verification phase already bound to '+previous.runId+'; resume its saved pair, never create again');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const retiredPairs=[verification,...(card.preparationAuthority.supabase.previousVerificationPhases??[])].map(phase=>phase.retiredPair);
  for(const retired of retiredPairs){assert.notEqual(RUN,retired.runId);assert.ok(!Object.values(names).some(name=>retired.functionNames.includes(name)));}
  const target=new URL(preview);assert.equal(target.protocol,'https:');assert.ok(target.hostname.endsWith('.pages.dev'));
  try{await fs.access(stateFile);throw Error('Same-run private state already exists; use recovery, never provision another pair');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  await fs.mkdir(path.dirname(root),{recursive:true});await fs.mkdir(root);
  // This is a new directory, before any secret is written; no ACL refusal is bypassed.
  await exec(process.env.N71_PWSH??'pwsh.exe',['-NoProfile','-File','tests/n71-live/protect-new-directory.ps1','-Directory',root,'-RunId',RUN],{windowsHide:true});
  const ignored=await exec('git',['-C','C:/Users/Abody/Projects/RakeezX','check-ignore',stateFile],{windowsHide:true});assert.ok(ignored.stdout.trim());
  const accounts=['A','B'].map(slot=>({slot,id:randomUUID(),email:fixtureEmail(RUN,slot),password:'N71!aA1'+randomBytes(32).toString('base64url')}));
  assert.ok(accounts.every(account=>retiredPairs.every(retired=>!retired.accountIds.includes(account.id))));
  const baseSha=await git('merge-base','HEAD','origin/main');
  assert.equal(baseSha,await git('rev-parse','origin/main'),'Reconcile observed remote main before preparation');
  const state={version:1,taskId:TASK,runId:RUN,projectId:PROJECT_ID,purpose:PURPOSE,baseSha,candidateSha:candidate,
    treeSha:await git('rev-parse','HEAD^{tree}'),harnessBlob:await git('rev-parse','HEAD:tests/n71-live/runner.mjs'),preview,
    verificationPhase:verification.phase,excludedPairs:retiredPairs.map(({runId,accountIds,functionNames})=>({runId,accountIds,functionNames})),
    phase:'PREPARING',accounts,productIds:fixtureIds(RUN),sessions:[],revocations:{},checks:[],cleanup:[]};
  await fs.writeFile(phaseBinding,JSON.stringify({version:1,phase:verification.phase,runId:RUN,candidateSha:candidate,accountIds:accounts.map(a=>a.id),functionNames:Object.values(names),createdAt:new Date().toISOString()},null,2),{flag:'wx'});
  await save(state);
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();await page.goto(preview);
    const defaults=await page.evaluate(async()=>{const m=await import('/src/lib/account-provisioning.js');return [m.buildAccountFoundationDefaults(),m.buildAccountFoundationDefaults()];});
    state.foundation=Object.fromEntries(accounts.map((a,i)=>[a.slot,defaults[i]]));
    state.fixture=portableFixture(state.productIds,state.foundation.A,new Date().toISOString());
  }finally{await browser.close();}
  state.expectedEffects={auth:accounts.map(({slot,id,email})=>({slot,id,email})),foundation:state.foundation,portableFixture:state.fixture,
    interruption:'Exactly one stage response lost after canonical staging and before finalize; no interrupted mutation elsewhere',
    disposition:'Global sign-out; fixed ban; password/refresh denial; retained closure; both functions deny-all/410'};
  state.fixtureContractSha256=hash(canonical(state.expectedEffects));
  const core=await fs.readFile('supabase/functions/ops-n71-fixture/handler-core.mjs','utf8');state.implementationSha256=hash(core);
  state.capabilities={provision:randomBytes(32).toString('base64url'),cleanup:randomBytes(32).toString('base64url')};
  const issuedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+90*60*1000).toISOString();
  state.manifests=Object.fromEntries(['provision','cleanup'].map(mode=>[mode,{version:1,purpose:PURPOSE,projectId:PROJECT_ID,runId:RUN,
    mode:mode==='provision'?'provision':'cleanup-only',issuedAt,expiresAt,capabilitySha256:hash(state.capabilities[mode]),
    fixtureContractSha256:state.fixtureContractSha256,implementationSha256:state.implementationSha256,
    accounts:accounts.map(({slot,id,email,password})=>({slot,id,email,passwordSha256:hash(password)}))}]));
  state.phase='PREDEPLOY_REQUIRED';await save(state);console.log(JSON.stringify({phase:state.phase,candidateSha:candidate,expiresAt}));
}
async function bundles(){const state=await load();const core=await fs.readFile('supabase/functions/ops-n71-fixture/handler-core.mjs','utf8');
  assert.equal(hash(core),state.implementationSha256);
  return Promise.all(['provision','cleanup'].map(async mode=>({name:names[mode],entrypoint_path:'index.ts',verify_jwt:false,
    files:[{name:'index.ts',content:await fs.readFile(`supabase/functions/ops-n71-${mode==='provision'?'fixture':'retire'}/index.ts`,'utf8')},
      {name:'handler-core.mjs',content:core},{name:'run-manifest.mjs',content:'export default '+JSON.stringify(state.manifests[mode])+';'}]})));}
async function pollDocument(page,predicate,argument,{timeout=120000}={}){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{const value=await page.evaluate(predicate,argument);if(value)return value;}
    catch(error){if(!/Execution context was destroyed|Cannot find context with specified id/.test(String(error?.message)))throw error;}
    await page.waitForTimeout(50);
  }
  throw Object.assign(new Error('Timeout waiting for a stable owner-bound document checkpoint'),{code:'N71_CHECKPOINT_TIMEOUT'});
}
async function ready(page){await pollDocument(page,async()=>{const s=await import('/src/store.js');const c=await import('/src/lib/cloud.js');return document.readyState==='complete'&&!document.querySelector('[data-initial-restore-state]')&&s.state.ready===true&&s.getActiveWorkspace()?.authUserId===c.user?.id&&s.getActiveWorkspace()?.type==='account'&&s.getActiveWorkspace()?.ownershipState==='claimed';},null,{timeout:120000});
  // The initial outbox scan may report "synced" before a full Product pull.
  // Require an actual completed pass, not that presentation status alone.
  await pollDocument(page,async()=>{const s=await import('/src/lib/sync.js');const store=await import('/src/store.js');return s.displayState().detailStatus==='synced'&&Number(s.state.lastSyncedAt)>0&&store.state.device?.lastSyncAt===s.state.lastSyncedAt;},null,{timeout:120000});}
export async function ownerCheckpoint(page,ownerId,{studentId=null,timeout=120000}={}){
  // Initial Restore automatically reloads after finalization. A predicate in
  // the preceding document cannot authorize reads in the replacement document.
  return pollDocument(page,async ({expectedOwner,studentId})=>{
    const db=await import('/src/lib/db.js');const sync=await import('/src/lib/sync.js');const store=await import('/src/store.js');
    const workspace=store.getActiveWorkspace(),databaseName=db.getActiveDatabaseName(),lastSyncedAt=sync.state.lastSyncedAt;
    if(document.readyState!=='complete'||document.querySelector('[data-initial-restore-state]')||!store.state.ready||
      workspace?.authUserId!==expectedOwner||workspace?.ownershipState!=='claimed'||workspace?.type!=='account'||
      databaseName!==workspace.databaseName||!(Number(lastSyncedAt)>0)||store.state.device?.lastSyncAt!==lastSyncedAt||
      sync.displayState().detailStatus!=='synced')return false;
    const receipt=await db.readInitialRestoreReceipt();
    if(receipt?.ownerId!==expectedOwner||receipt?.protocol!=='CORE_V2')return false;
    if((await db.getAll('outbox')).length)return false;
    const targetStudent=studentId?await db.get('students',studentId):null;
    if(studentId&&!targetStudent)return false;
    const counts=Object.fromEntries(await Promise.all(db.STORES.filter(name=>!['device','meta','outbox'].includes(name)).map(async name=>[name,(await db.getAll(name)).length])));
    if(!store.state.ready||store.getActiveWorkspace()!==workspace||db.getActiveDatabaseName()!==databaseName||
      sync.state.lastSyncedAt!==lastSyncedAt||document.querySelector('[data-initial-restore-state]'))return false;
    return {databaseName,workspace,receipt,lastSyncedAt,counts,targetStudent};
  },{expectedOwner:ownerId,studentId},{timeout});
}
async function login(state,browser,slot,label,provision=false){
  const context=await browser.newContext({serviceWorkers:'block',baseURL:state.preview});const page=await context.newPage();
  const account=state.accounts.find(a=>a.slot===slot);await page.goto(state.preview);
  if(label==='B1'){
    const signedOut=await page.evaluate(async state=>{const e=await import('/src/lib/export.js');
      const p={app:'rakeezx',version:5,backupId:'n71-signed-out',sourceOwnerId:state.accounts[0].id,
        exportedAt:new Date().toISOString(),data:state.fixture,baselines:{}};p.backupHash=await e.sha256Hex(e.backupHashInput(p));
      try{await(await import('/src/lib/backup-v2.js')).previewCloudRestore(p);return 'UNEXPECTED_SUCCESS';}catch(error){return error.code;}
    },{accounts:state.accounts.map(({id})=>({id})),fixture:state.fixture});
    assert.equal(signedOut,'AUTH_REQUIRED');check(state,'signed_out','Fresh B1 context rejects restore before authentication: '+signedOut);await save(state);
  }
  await page.evaluate(async({email,password})=>{const c=await import('/src/lib/cloud.js');await c.signIn(email,password);},{email:account.email,password:account.password});
  await storeSession(state,slot,await page.evaluate(async()=>structuredClone((await import('/src/lib/cloud.js')).session)),label);
  if(provision){await page.evaluate(async defaults=>{
    const c=await import('/src/lib/cloud.js');await c.provisionAccountProfile();
    await c.completeAccountProfile({teacherName:'N71 synthetic fixture',phone:'0500000000',teacherForm:'masculine',schoolName:'N71 synthetic'});
    await c.beginAccountProvisioning();await c.provisionAccountWorkspace(defaults);
  },state.foundation[slot]);}
  await page.reload();await ready(page);
  if(label==='A2'){
    const checkpoint=await ownerCheckpoint(page,account.id,{studentId:state.productIds.student});
    state.a2Checkpoint=checkpoint;await save(state);
    assert.equal(checkpoint.receipt?.ownerId,account.id,'A2 must finish owner-bound Initial Restore');
    assert.equal(checkpoint.receipt?.protocol,'CORE_V2');
  }
  return {page,context,slot,label};
}
export async function payload(page,extra={},changes=null){return page.evaluate(async({extra,changes})=>{
  const e=await import('/src/lib/export.js');const c=await import('/src/lib/cloud.js');const payload=await e.buildBackup({sourceOwnerId:c.user.id});
  for(const [name,rows]of Object.entries(extra))payload.data[name]=[...(payload.data[name]??[]),...rows];
  if(changes){const row=payload.data[changes.store].find(row=>row.id===changes.id);Object.assign(row,changes.patch);}
  payload.backupHash=await e.sha256Hex(e.backupHashInput(payload));return payload;
},{extra,changes});}
export async function restore(page,backup,id){return page.evaluate(async({backup,id})=>{const b=await import('/src/lib/backup-v2.js');
  const preview=await b.previewCloudRestore(backup);if(!preview.validation.ok||!preview.plan.ready)throw Error('Restore review rejected: '+JSON.stringify(preview.plan?.counts??preview.validation));
  return b.restoreBackupToCloud(backup,{restoreId:id});},{backup,id});}
async function denied(page,backup,expected){const code=await page.evaluate(async backup=>{try{await(await import('/src/lib/backup-v2.js')).previewCloudRestore(backup);return 'UNEXPECTED_SUCCESS';}catch(e){return e.code??e.message;}},backup);
  assert.ok(expected.includes(code),`Expected fail-closed ${expected.join(',')}; observed ${code}`);return code;}
export async function ordinarySyncCheckpoint(page,ownerId,{studentId,timeout=120000}={}){
  const request=await page.evaluate(async expectedOwner=>{
    const c=await import('/src/lib/cloud.js'),s=await import('/src/lib/sync.js'),store=await import('/src/store.js'),db=await import('/src/lib/db.js');
    const workspace=store.getActiveWorkspace(),device=await db.get('device','device');
    if(c.user?.id!==expectedOwner||workspace?.authUserId!==expectedOwner||workspace?.ownershipState!=='claimed'||
      db.getActiveDatabaseName()!==workspace.databaseName)throw Error('N71 ordinary Sync owner checkpoint mismatch');
    const receipt=await db.readInitialRestoreReceipt();
    if(receipt?.ownerId!==expectedOwner||receipt?.protocol!=='CORE_V2')throw Error('N71 ordinary Sync lacks its owner-bound Initial Restore receipt');
    if((await db.getAll('outbox')).length||device?.cloudRestoreResume||device?.studentLifecycleResume||device?.n77DeleteIntent)
      throw Error('N71 ordinary Sync has unresolved local work');
    const before=s.state.lastSyncedAt??0,directResult=await s.syncAll({full:true});
    const detailStatus=s.displayState().detailStatus;
    if(!directResult&&detailStatus!=='syncing')throw Error('N71 ordinary Sync refused: '+detailStatus);
    return {before,directResult,detailStatus};
  },ownerId);
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const checkpoint=await ownerCheckpoint(page,ownerId,{studentId,timeout:Math.max(1,deadline-Date.now())});
    if(checkpoint.lastSyncedAt>request.before)return {...request,checkpoint};
    await page.waitForTimeout(50);
  }
  throw Error('N71 ordinary Sync did not complete a new owner-bound pass');
}
export async function suppressionSequence(page,secondPage,state,exported,{beforeA2Pull=async()=>{}}={}){
    // Ordinary authenticated Sync makes deletion canonical before restoring stale export.
    assert.ok(Date.now()<Date.parse(state.liveDeadline),'Live deadline reached before deletion boundary');
    await page.evaluate(async ids=>{const c=await import('/src/lib/cloud.js');const db=await import('/src/lib/db.js');
      // Preserve a valid canonical deletion closure. Portable storage does not
      // imply an N88 assignment cascade: retire this purpose-created child first.
      for(const [entity,recordId]of [['submissions',ids.deletedSubmission],['assignments',ids.deletedAssignment]]){
        const row=await db.get(entity,recordId);
        if(!row||row.deleted)throw Error('Synthetic deletion fixture lacks its exact live canonical row');
        await c.applySyncV2Mutation({entity,recordId,mutationId:recordId+':delete',deviceId:'n71-synthetic',baseRevision:row.serverRevision,patch:{},operation:'delete',clientUpdatedAt:Date.now()});
      }
      await(await import('/src/lib/sync.js')).syncAll({full:true});},state.productIds);await ready(page);
    const stale=structuredClone(exported);stale.data.items.push({id:state.productIds.closedChild,teachingId:state.productIds.teaching,name:'N71 suppressed',max:10,deleted:false,updatedAt:1});
    // The current closed term itself is immutable; add a teaching referring to it to test backup-only descendant suppression.
    stale.data.teachings.push({id:state.productIds.closedChild+':teaching',sectionId:state.productIds.section,subjectId:state.foundation.A.subjects[0].id,termId:state.productIds.closedTerm,deleted:false,updatedAt:1});
    stale.data.items.at(-1).teachingId=state.productIds.closedChild+':teaching';
    await page.evaluate(async p=>{const e=await import('/src/lib/export.js');p.backupHash=await e.sha256Hex(e.backupHashInput(p));return p;},stale).then(p=>Object.assign(stale,p));
    // Preserve the restored non-overlapping student value while exercising stale deletion scope.
    stale.data.students.find(r=>r.id===state.productIds.student).note='after canonical restore';
    stale.backupHash=await page.evaluate(async p=>{const e=await import('/src/lib/export.js');return e.sha256Hex(e.backupHashInput(p));},stale);
    const suppression=await page.evaluate(async p=>(await import('/src/lib/backup-v2.js')).previewCloudRestore(p),stale);
    assert.equal(suppression.plan.ready,true);assert.ok(suppression.plan.entries.some(e=>e.id===state.productIds.deletedAssignment&&e.reason==='server-tombstone'));
    assert.ok(suppression.plan.entries.some(e=>e.id===state.productIds.closedChild&&e.reason==='closed-term-scope'));
    await restore(page,stale,'n71:'+RUN+':suppression');
    await beforeA2Pull();
    state.a2ConvergenceCheckpoint=await ordinarySyncCheckpoint(secondPage,state.ownerId??state.accounts?.[0]?.id,{studentId:state.productIds.student});
    const snapshot=async page=>page.evaluate(async()=>{const db=await import('/src/lib/db.js');const e=await import('/src/lib/export.js');const v2=await import('/src/lib/sync-v2.js');
      return Object.fromEntries(await Promise.all(db.STORES.filter(s=>!e.DEVICE_ONLY_STORES.includes(s)).map(async name=>[name,(await db.getAll(name)).map(row=>({id:row.id,deleted:row.deleted===true,revision:row.serverRevision,
        ...(name==='scoreSubitems'?{createdAt:row.createdAt}:{}),
        ...Object.fromEntries(Object.keys(v2.SYNC_V2_SCHEMAS[name].fields).map(f=>[f,row[f]??null]))})).sort((a,b)=>a.id.localeCompare(b.id))])));});
    await ready(page);await ready(secondPage);assert.deepEqual(await snapshot(secondPage),await snapshot(page));
    const a1Export=await payload(page),a2Export=await payload(secondPage);
    for(const [document,backup]of [[page,a1Export],[secondPage,a2Export]]){
      const validation=await document.evaluate(async p=>(await import('/src/lib/export.js')).validateBackupIntegrity(p),backup);
      assert.equal(validation.ok,true,JSON.stringify(validation));
    }
    assert.deepEqual(a2Export.data,a1Export.data,'A2 portable Product data differs');
    assert.deepEqual(a2Export.baselines,a1Export.baselines,'A2 canonical baselines differ');
    state.a2PortableEquality={dataSha256:hash(canonical(a1Export.data)),baselinesSha256:hash(canonical(a1Export.baselines)),
      stores:Object.keys(a1Export.data),validExports:true,verifiedAt:new Date().toISOString()};
    const final=await snapshot(page);assert.ok(final.assignments.find(r=>r.id===state.productIds.deletedAssignment).deleted);
    assert.ok(final.submissions.find(r=>r.id===state.productIds.deletedSubmission).deleted);
    assert.ok(!final.items.some(r=>r.id===state.productIds.closedChild));assert.equal(final.scores.find(r=>r.id===state.productIds.directScore).value,7);
    return final;
}
export async function backupUiCheckpoint(page,target){
  if(target)await page.goto(target);
  // Navigation completion precedes asynchronous account boot and view rendering.
  for(const action of ['export','pick-cloud-file']){
    const control=page.locator(`[data-act="${action}"]`);
    await control.waitFor({state:'visible',timeout:120000});
    assert.equal(await control.count(),1);
  }
  assert.equal(await page.locator('[data-act="pick-file"],[data-act="bootstrap-curriculum"],[data-act="claim-legacy-workspace"],[data-pick]').count(),0);
}
async function run(){
  const state=await load();assert.equal(await git('rev-parse','HEAD'),state.candidateSha);
  assert.equal(state.phase,'PREDEPLOY_REQUIRED','Use same-state recovery rather than re-running fixture setup');
  const browser=await chromium.launch();const pages=[];let primaryError;
  try{
    for(const mode of ['cleanup','provision']){const probe=await ops(state,mode,'probe');assert.equal(probe.configured,true);
      for(const slot of ['A','B'])assert.equal((await ops(state,mode,'inspect',{slot})).state,'absent');}
    check(state,'predeploy','Both independently protected handlers configured; exact pair absent before first Auth create');
    state.phase='PROVISION_INTENT';state.liveDeadline=new Date(Date.now()+30*60*1000).toISOString();await save(state);
    for(const account of state.accounts)await ops(state,'provision','ensure',{slot:account.slot,password:account.password});
    state.phase='LIVE';await save(state);
    const a=await login(state,browser,'A','A1',true);pages.push(a);
    const b=await login(state,browser,'B','B1',true);pages.push(b);
    const seed=await payload(a.page,state.fixture);await restore(a.page,seed,'n71:'+RUN+':seed');
    const exported=await payload(a.page);
    const exportedValidation=await a.page.evaluate(async p=>(await import('/src/lib/export.js')).validateBackupIntegrity(p),exported);
    assert.equal(exportedValidation.ok,true,'Immediate full-domain export invalid: '+JSON.stringify(exportedValidation));
    assert.equal(exported.data.scoreSubitems.find(r=>r.id===state.productIds.subitem).createdAt,
      state.fixture.scoreSubitems[0].createdAt,'Canonical restore must preserve N94 creation history');
    for(const name of Object.keys(exported.data))assert.ok(exported.data[name].length>0,`Domain ${name} has no portable fixture`);
    check(state,'full_domain_export','Actual authenticated client export contains nonempty records in every portable Product store; current calendar foundation and mixed score provenance retained');
    const changed=await payload(a.page,{}, {store:'students',id:state.productIds.student,patch:{note:'after canonical restore'}});
    assert.ok(Date.now()<Date.parse(state.liveDeadline),'Live deadline reached before restore boundary');
    const preview=await a.page.evaluate(async p=>(await import('/src/lib/backup-v2.js')).previewCloudRestore(p),changed);
    assert.equal(preview.validation.ok,true,JSON.stringify(preview.validation));assert.equal(preview.plan?.ready,true);
    const wrong=await b.page.evaluate(async p=>(await import('/src/lib/backup-v2.js')).previewCloudRestore(p),changed);
    assert.equal(wrong.validation.ok,true,JSON.stringify(wrong.validation));assert.equal(wrong.plan?.ready,false);
    const forbidden=await b.page.evaluate(async owner=>{const c=await import('/src/lib/cloud.js');const response=await fetch(c.SUPABASE_URL+'/rest/v1/rpc/n71_restore_manifest',
      {method:'POST',headers:{apikey:'sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_',Authorization:'Bearer '+c.session.access_token,
        'Content-Type':'application/json','Accept-Profile':'rakeezx','Content-Profile':'rakeezx'},body:JSON.stringify({p_owner:owner})});
      return {status:response.status,body:await response.json()};},state.accounts[0].id);
    assert.equal(forbidden.status,403);assert.equal(forbidden.body.code,'42501');
    // Owner-bound REST read is checked with real B bearer, never service role.
    const bSession=state.sessions.find(s=>s.slot==='B');const ownerResponse=await fetch(url+'/rest/v1/assignments?owner_id=eq.'+state.accounts[0].id,
      {headers:{apikey:key,Authorization:'Bearer '+bSession.access_token,'Accept-Profile':'rakeezx'},signal:AbortSignal.timeout(15000)});
    assert.equal(ownerResponse.status,200);assert.deepEqual(await ownerResponse.json(),[]);
    check(state,'owner_isolation','B review rejects A backup and B bearer cannot read A portable rows; owner-bound manifest denied='+forbidden.status);
    const guardManifest=await a.page.evaluate(async()=>await(await import('/src/lib/cloud.js')).getUnifiedRestoreManifest());
    let forbiddenStages=0;const stageMonitor=req=>{if(req.url().endsWith('/rpc/stage_n71_restore'))forbiddenStages++;};a.page.on('request',stageMonitor);
    await a.context.setOffline(true);const offline=await denied(a.page,changed,['OFFLINE']);await a.context.setOffline(false);await ready(a.page);
    await a.page.route('**/rpc/n71_restore_capability',route=>route.abort('failed'));
    const unhealthy=await denied(a.page,changed,['RESTORE_SYNC_NOT_HEALTHY']);
    await a.page.unroute('**/rpc/n71_restore_capability');await a.page.evaluate(async()=>await(await import('/src/lib/sync.js')).syncAll({full:true}));await ready(a.page);
    await a.page.evaluate(async()=>{const db=await import('/src/lib/db.js');await db.put('outbox',{id:'n71:guard-only',protocol:'v2',store:'students',state:'rejected',sequence:1});});
    const outbox=await denied(a.page,changed,['RESTORE_OUTBOX_NOT_EMPTY']);await a.page.evaluate(async()=>await(await import('/src/lib/db.js')).remove('outbox','n71:guard-only'));
    await a.page.evaluate(async()=>await(await import('/src/lib/sync.js')).syncAll({full:true}));await ready(a.page);
    a.page.off('request',stageMonitor);assert.equal(forbiddenStages,0,'Denied attempts must not stage');
    assert.deepEqual(await a.page.evaluate(async()=>await(await import('/src/lib/cloud.js')).getUnifiedRestoreManifest()),guardManifest,'Denied requests changed canonical source');
    check(state,'fail_closed','Offline='+offline+'; unhealthy Sync='+unhealthy+'; unresolved outbox='+outbox+'; zero stage requests and unchanged canonical manifest');
    const a2=await login(state,browser,'A','A2');pages.push(a2);
    assert.equal(state.a2Checkpoint.targetStudent?.note,'before restore','A2 canonical student missing before the mutation boundary');
    // This is the one declared synthetic interruption: server stages, its response is lost.
    let interrupted=false,stageReceipt,stageEnvelope,stageFailure;
    state.phase='STAGE_INTERRUPTION_INTENT';await save(state);
    await a.page.route('**/rpc/stage_n71_restore',async route=>{assert.equal(interrupted,false);interrupted=true;stageEnvelope=route.request().postDataJSON();
      try{const response=await route.fetch();stageReceipt=await response.json();assert.equal(response.status(),200,JSON.stringify(stageReceipt));}
      catch(error){stageFailure=error;}finally{await route.abort('failed');}});
    let lost=false;try{await restore(a.page,changed,'n71:'+RUN+':resume');}catch{lost=true;}assert.equal(lost,true);assert.equal(interrupted,true);
    await a.page.unroute('**/rpc/stage_n71_restore');
    if(stageFailure)throw stageFailure;
    const before=await a.page.evaluate(async id=>{const db=await import('/src/lib/db.js');return {student:await db.get('students',id),resume:await(await import('/src/lib/backup-v2.js')).getCloudRestoreResumeState()};},state.productIds.student);
    assert.equal(before.student.note,'before restore');assert.equal(before.resume.state,'staging');
    state.restoreEnvelope=stageEnvelope;state.restoreStageReceipt=stageReceipt;state.phase='STAGED_INTERRUPTED';await save(state);
    const resumed=await a.page.evaluate(async()=>await(await import('/src/lib/backup-v2.js')).resumeCloudRestore());
    assert.equal(await a.page.evaluate(async id=>(await(await import('/src/lib/db.js')).get('students',id)).note,state.productIds.student),'after canonical restore');
    const receipt=await a.page.evaluate(async({envelope,stage})=>await(await import('/src/lib/cloud.js')).finalizeUnifiedRestore({restoreId:envelope.p_restore_id,backupHash:envelope.p_backup_hash,expectedStageHash:stage.stageHash}),{envelope:stageEnvelope,stage:stageReceipt});
    assert.equal(receipt.receipt.status,'finalized');assert.equal(receipt.restoreId,stageEnvelope.p_restore_id);
    assert.deepEqual(receipt.receipt,resumed.receipt);
    const resumedExport=await payload(a.page);
    assert.equal(await a.page.evaluate(async p=>(await(await import('/src/lib/export.js')).validateBackupIntegrity(p)).ok,resumedExport),true);
    check(state,'owner_resume','Actual staged transaction survives lost acknowledgement; local state waits for canonical finalize; exact same stage/finalize identity resumes and finalized receipt reused');
    assert.ok(Date.now()<Date.parse(state.liveDeadline),'Live deadline reached before deletion boundary');
    const final=await suppressionSequence(a.page,a2.page,state,exported);
    check(state,'convergence_no_resurrection','Fresh A2 Initial Restore and ordinary Sync converge across every portable domain; tombstone, immutable closed-term scope, score provenance and current calendar identities retained');
    state.retainedClosure={ownerId:state.accounts[0].id,counts:Object.fromEntries(Object.entries(final).map(([name,rows])=>[name,rows.length])),canonicalSha256:hash(canonical(final)),verifiedAt:new Date().toISOString()};
    await fs.writeFile(path.join(evidenceRoot,'retained-closure.json'),JSON.stringify(state.retainedClosure,null,2));
    await backupUiCheckpoint(a.page,state.preview+'/#/settings/backup');
    await a.page.screenshot({path:path.join(evidenceRoot,'live-ui.png'),fullPage:true});
    state.phase='LIVE_VERIFIED';await save(state);
  }catch(error){primaryError=error;state.error=publicError(error);
    state.diagnostics=await Promise.all(pages.map(async({page,label})=>{try{return {label,...await page.evaluate(async()=>{const db=await import('/src/lib/db.js');const s=await import('/src/lib/sync.js');const store=await import('/src/store.js');return {databaseName:db.getActiveDatabaseName(),ready:store.state.ready,workspace:store.getActiveWorkspace(),initialRestoreReceipt:await db.readInitialRestoreReceipt(),sync:s.displayState(),lastSyncedAt:s.state.lastSyncedAt,restoreUiState:document.querySelector('[data-initial-restore-state]')?.dataset.initialRestoreState,counts:Object.fromEntries(await Promise.all(db.STORES.map(async name=>[name,(await db.getAll(name)).length])))};})};}catch{return {label,unavailable:true};}}));
    await save(state);}
  finally{
    try{await retire(state,pages);}catch(error){state.phase='RETIRE_PENDING';state.cleanupError=publicError(error);await save(state);await evidence(state);primaryError??=error;}
    await browser.close();
  }
  await evidence(state);console.log(JSON.stringify({phase:state.phase,checks:state.checks,error:state.error,cleanupError:state.cleanupError}));
  if(primaryError)process.exitCode=1;
}
async function recovery(){const state=await load();assert.equal(await git('rev-parse','HEAD'),state.candidateSha);await retire(state);console.log(JSON.stringify({phase:state.phase}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const [mode,arg,candidate]=process.argv.slice(2);
if(mode==='prepare')await prepare(arg,candidate);
else if(mode==='bundles')console.log(JSON.stringify(await bundles()));
else if(mode==='run')await run();
else if(mode==='recover')await recovery();
else throw Error('Use prepare/bundles/run/recover; never create a replacement pair');
}
