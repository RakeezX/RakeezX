// One exact N73 run. All credentials remain in the protected, ignored .env.state.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { securePrivateDirectory, writePrivateState, readPrivateState, withPrivateRun } from './private-state.mjs';
import { buildAccountFoundationDefaults } from '../../src/lib/account-provisioning.js';
import { device } from './device.mjs';
import { itemScore } from '../../src/models.js';
import { decodeSyncV2Canonical, encodeSyncV2Patch } from '../../src/lib/sync-v2.js';

// Every invocation must name the same controller-created run, including recovery.
export const runId=process.argv.find(arg=>arg.startsWith('--run-id='))?.slice(9);
assert.match(runId??'',/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.notEqual(runId,'0892c4c0-9a0e-4c6b-b1ee-ab3e085ac52e','Retired phase cannot be rearmed');
const repo='C:/Users/Abody/Projects/RakeezX';
const privateDir=path.join(repo,'artifacts/ops-supervisor-v4/capabilities/n73',runId,'private');
const project='xlrubcwjqktzzunrvuns', base='https://'+project+'.supabase.co';
const key='sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_'; // public application key
const suffix=runId.replaceAll('-','').slice(0,20);
const names={provision:'ops-n73-fixture-'+suffix,retire:'ops-n73-retire-'+suffix};
const prefix='n73:'+runId.replaceAll('-','')+':';
const hash=v=>createHash('sha256').update(v).digest('hex');
const artifact=path.resolve('test-results/n73-live-'+suffix);
const fail=(message,code)=>Object.assign(new Error(message),{code});
const safe=(error)=>({code:error?.code??error?.safeCode??'N73_HARNESS_FAILED',message:String(error?.message??'failure').slice(0,600),diagnostic:error?.diagnostic??null});
let state;
let cleanupInProgress=false;
async function save() { await writePrivateState(privateDir,state); }
async function request(url,{token=null,body,method=body?'POST':'GET',headers={}}={}) {
  if(state?.liveStartedAt && !cleanupInProgress && (Date.now()-Date.parse(state.liveStartedAt)>45*60000 ||
      Date.now()>Date.parse(state.manifests.retire.expiresAt)-15*60000)) throw fail('N73 live work deadline reached; cleanup only','N73_LIVE_DEADLINE');
  const started=performance.now(),endpoint=new URL(url).pathname;
  const diagnostic={stage:body?.operation??endpoint.split('/').at(-1),endpoint,method,status:null,code:null,elapsedMs:null};
  try {
    const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,
      ...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json().catch(()=>null);
    Object.assign(diagnostic,{elapsedMs:Math.round(performance.now()-started),status:response.status,code:result?.errorCode??result?.code??null});
    state.diagnostics??=[];state.diagnostics.push(diagnostic);await save();
    if(!response.ok) throw Object.assign(fail(`HTTP ${response.status} ${diagnostic.code??'REQUEST_REJECTED'}`,diagnostic.code??'HTTP_'+response.status),{status:response.status,diagnostic});
    return result;
  } catch(error) {
    if(!error.diagnostic) {
      Object.assign(diagnostic,{elapsedMs:Math.round(performance.now()-started),code:error.name==='TimeoutError'?'N73_REQUEST_TIMEOUT':'N73_NETWORK_ABORT'});
      state.diagnostics??=[];state.diagnostics.push(diagnostic);await save();
      throw Object.assign(fail(diagnostic.code,diagnostic.code),{diagnostic});
    }
    throw error;
  }
}
async function fn(role,operation,extra={}) {
  return request(base+'/functions/v1/'+names[role],{body:{version:1,runId,operation,...extra},
    headers:{'x-n73-capability':state.capabilities[role]}});
}
const rpc=(session,name,body={})=>request(base+'/rest/v1/rpc/'+name,{token:session.access_token,body,
  headers:{'Accept-Profile':'rakeezx','Content-Profile':'rakeezx'}});
async function table(session,name) {
  return request(base+'/rest/v1/'+name+'?owner_id=eq.'+session.user.id+'&select=*&order=id.asc&limit=1000',
    {token:session.access_token,headers:{'Accept-Profile':'rakeezx'}});
}
async function login(slot,label) {
  const account=state.accounts.find(a=>a.slot===slot);
  const session=await request(base+'/auth/v1/token?grant_type=password',{body:{email:account.email,password:state.passwords[slot]}});
  assert.equal(session.user.id,account.id);
  state.sessions[label]=session; await save(); return session;
}
async function generic(session,entity,id,patch,operation='create',revision=0) {
  const result=await rpc(session,'apply_sync_v2_mutation',{p_entity:entity,p_record_id:id,p_mutation_id:randomUUID(),
    p_device_id:prefix+'A1',p_base_revision:revision,p_patch:patch,p_operation:operation,p_client_updated_at:Date.now()});
  assert.equal(result.outcome,'applied'); return result.canonical;
}
function backend(session) {
  return {fetchRecords:entity=>table(session,entity),
    getScoreDomainSnapshot:()=>rpc(session,'sync_v2_score_domain_snapshot'),
    applyScoreDistributionPlan:envelope=>rpc(session,'apply_score_distribution_plan',{
      p_mutation_id:envelope.mutationId,p_device_id:envelope.deviceId,p_plan_id:envelope.planId,p_token:envelope.token,p_confirmed:envelope.confirmed}),
    applyMutation:envelope=>rpc(session,'apply_sync_v2_mutation',{p_entity:envelope.entity,p_record_id:envelope.recordId,
      p_mutation_id:envelope.mutationId,p_device_id:envelope.deviceId,p_base_revision:envelope.baseRevision,
      p_patch:envelope.patch,p_operation:envelope.operation,p_client_updated_at:envelope.clientUpdatedAt})};
}
const stores=['items','scoreSubitems','scoreSubitemCompletions','scores','students','logs','attendance'];
async function pull(actor) { const result=await actor.engine.pullAll({stores,scoreDomainSnapshot:true}); assert.deepEqual(result.failures,[]); }
const report=(name,evidence)=>{state.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};

async function prepare() {
  await securePrivateDirectory(repo,privateDir,{create:true});
  const accounts=['A','B'].map(slot=>({slot,id:randomUUID(),email:`n73-${runId.replaceAll('-','')}-${slot.toLowerCase()}@example.invalid`}));
  for(const account of accounts) assert.ok(!['268f2d00-92a1-4c6d-a2a1-ef94a45a43c9','2f507c7e-8c11-4207-94d7-595eeccc2677'].includes(account.id));
  const passwords=Object.fromEntries(accounts.map(a=>[a.slot,'N73!aA1'+randomBytes(32).toString('base64url')]));
  const capabilities={provision:randomBytes(32).toString('base64url'),retire:randomBytes(32).toString('base64url')};
  const defaults=structuredClone(buildAccountFoundationDefaults()); defaults.calendarDays=defaults.calendarDays.slice(0,1);
  const ids={sections:[1,2,10,11].map(n=>prefix+'s'+n),teachings:[1,2,10,11].map(n=>prefix+'t'+n),
    defaults:[1,2,10,11].map(n=>Array.from({length:5},(_,i)=>prefix+'t'+n+'-default'+i)),
    students:[prefix+'student1',prefix+'student2',prefix+'student3'],extra:prefix+'extra',extraScore:prefix+'extra-score',duplicate:prefix+'duplicate',
    sourceScore:prefix+'source-score',capScore:prefix+'cap-score',validScore:prefix+'valid-score',manualAutoScore:prefix+'manual-auto-score',
    sourceSub:prefix+'source-sub',targetSub:prefix+'target-sub',completion:prefix+'target-completion',
    sourceLog:prefix+'source-log',targetLog:prefix+'target-log',missing:prefix+'missing',missingSub:prefix+'missing-sub'};
  const foundationIds=Object.fromEntries(Object.entries(defaults).map(([entity,rows])=>[entity,rows.map(row=>row.id)]));
  ids.completion='ssc:'+ids.students[0]+':'+ids.targetSub;
  ids.subitemScore='sc:'+ids.students[0]+':'+ids.defaults[1][2];
  ids.possibleCreatedItems=ids.teachings.slice(1).flatMap(t=>[...ids.defaults[0],ids.missing].map(s=>'n73:i:'+createHash('md5').update(accounts[0].id+':'+t+':'+s).digest('hex')));
  ids.possibleCreatedSubitems=ids.teachings.slice(1).flatMap(t=>[ids.sourceSub,ids.missingSub].map(s=>'n73:d:'+createHash('md5').update(accounts[0].id+':'+t+':'+s).digest('hex')));
  const closure={disposition:'retained_banned',signOut:'global',banDuration:'876000h',passwordDenial:true,refreshDenial:true,
    residualAccessJWT:'Record signed token exp separately; no false immediate-expiry claim.',functions:'Redeploy exact pair to deny-all and verify source plus actual 410.'};
  const issuedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+90*60000).toISOString();
  const manifests={};
  for(const role of ['provision','retire']) {
    const dir='supabase/functions/ops-n73-'+(role==='provision'?'fixture':'retire');
    manifests[role]={version:1,purpose:'N73-D119',projectId:project,runId,mode:role==='retire'?'cleanup-only':'provision',issuedAt,expiresAt,
      capabilitySha256:hash(capabilities[role]),fixtureContractSha256:hash(JSON.stringify({ids,foundationIds,closure})),
      implementationSha256:hash(await readFile(dir+'/handler-core.mjs','utf8')),
      accounts:accounts.map(a=>({...a,passwordSha256:hash(passwords[a.slot])}))};
  }
  state={version:1,kind:'n73-private-run',runId,accounts,passwords,capabilities,manifests,defaults,ids,foundationIds,closure,
    sessions:{},checks:[],status:'PREPARED',candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),harnessSha256:hash(await readFile(new URL(import.meta.url))),diagnostics:[],
    base:execFileSync('git',['merge-base','HEAD','origin/main'],{encoding:'utf8'}).trim(),expectedEffects:'Only declared pair and Product IDs; caps, compatible target scores, target-only auto projection, source definitions, explicit extra tombstones.'};
  await save();
  console.log(JSON.stringify({runId,status:state.status,candidate:state.candidate,expiresAt,accounts:accounts.map(a=>({slot:a.slot,id:a.id})),names}));
}
async function bundle(role,closed=false) {
  state=await readPrivateState(repo,privateDir);
  const dir='supabase/functions/ops-n73-'+(role==='provision'?'fixture':'retire');
  const files=closed?[{name:'index.ts',content:await readFile(dir+'/closed-entry.ts','utf8')}]:[
    {name:'index.ts',content:await readFile(dir+'/index.ts','utf8')},
    {name:'handler-core.mjs',content:await readFile(dir+'/handler-core.mjs','utf8')},
    {name:'run-manifest.mjs',content:'export default '+JSON.stringify(state.manifests[role])+';\n'}];
  console.log(JSON.stringify({project_id:project,name:names[role],entrypoint_path:'index.ts',verify_jwt:false,files}));
}
async function cleanup() {
  cleanupInProgress=true;
  const outcomes=[]; let incomplete=false;
  for(const account of state.accounts) {
    const sessions=Object.entries(state.sessions).filter(([,s])=>s.user.id===account.id);
    const result={slot:account.slot,id:account.id,accessJwtExp: sessions.map(([label,s])=>({label,expiresAt:new Date(JSON.parse(Buffer.from(s.access_token.split('.')[1],'base64url')).exp*1000).toISOString()}))};
    try {
      const inspected=await fn('retire','inspect',{slot:account.slot});
      if(inspected.state!=='absent') {
        if(sessions.length) result.globalSignOut=await fn('retire','revoke',{slot:account.slot,accessToken:sessions[0][1].access_token});
        else result.globalSignOut={state:'no_session_issued'};
        result.ban=await fn('retire','retire',{slot:account.slot});
        assert.equal(result.ban.state,'retained_banned');
        for(const [label,s] of sessions) {
          await assert.rejects(()=>request(base+'/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:s.refresh_token}}),error=>[400,401,403].includes(error.status));
          result.refreshDenial??=[]; result.refreshDenial.push(label);
        }
        await assert.rejects(()=>request(base+'/auth/v1/token?grant_type=password',{body:{email:account.email,password:state.passwords[account.slot]}}),error=>[400,401,403].includes(error.status));
        result.passwordDenied=true;
        result.finalInspect=await fn('retire','inspect',{slot:account.slot});assert.equal(result.finalInspect.state,'retained_banned');
      } else result.state='absent';
      outcomes.push(result);
    } catch(error) {incomplete=true;outcomes.push({...result,error:safe(error)});}
    state.disposition=outcomes; state.status=incomplete?'CLEANUP_PENDING':'DISARM_PENDING';await save();
  }
  if(incomplete) throw fail('Exact-pair cleanup remains pending','N73_CLEANUP_PENDING');
  report('exact_pair_retained_banned','Global sign-out, fixed bans verified by Auth admin read-back; password and all A1/A2/B1 refresh attempts denied. Access-JWT expiry is recorded separately.');
}

async function run() {
  const actors=[];
  try {
    assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),state.candidate);
    assert.equal(hash(await readFile(new URL(import.meta.url))),state.harnessSha256);
    assert.equal(state.status,'PREPARED');
    const provision=await fn('provision','probe'),retire=await fn('retire','probe');
    assert.ok(provision.configured&&retire.configured);
    for(const role of ['provision','retire']) assert.equal((role==='retire'?retire:provision).manifestSha256,
      hash((await import('../../supabase/functions/ops-n73-fixture/handler-core.mjs')).canonical(state.manifests[role])));
    state.status='PROVISIONING'; state.liveStartedAt=new Date().toISOString();await save();
    for(const slot of ['A','B']) {
      assert.equal((await fn('provision','inspect',{slot})).state,'absent');
      assert.equal((await fn('provision','ensure',{slot,password:state.passwords[slot]})).state,'provisioned');
      await login(slot,slot==='A'?'A1':'B1');
      if(slot==='A') await login(slot,'A2');
    }
    const A=state.sessions.A1,A2=state.sessions.A2,B=state.sessions.B1,i=state.ids;
    for(const session of [A,B]) {
      await rpc(session,'provision_account_profile');
      await rpc(session,'complete_account_profile',{p_teacher_name:'N73 Synthetic',p_phone:'0500000073',p_teacher_form:'masculine',p_school_name:'N73 Synthetic'});
      await rpc(session,'begin_account_provisioning');
      const ready=await rpc(session,'provision_account_workspace',{p_defaults:state.defaults});
      assert.equal(ready.contract.provisioning.state,'READY');
    }
    const term=state.defaults.terms[0].id,year=state.defaults.years[0].id,subject=state.defaults.subjects[0].id;
    for(let index=0;index<4;index++) {
      await generic(A,'sections',i.sections[index],{year_id:year,grade:4,label:String([1,2,10,11][index]),name:'N73 Synthetic '+[1,2,10,11][index],status:'active'});
      await rpc(A,'apply_sync_v2_teaching_creation_command',{p_mutation_id:randomUUID(),p_device_id:prefix+'A1',p_teaching_id:i.teachings[index],
        p_section_id:i.sections[index],p_subject_id:subject,p_term_id:term,p_order:index,p_item_ids:i.defaults[index],p_client_updated_at:Date.now()});
    }
    for(const id of i.students) await generic(A,'students',id,{name:'N73 Synthetic Student',status:'active'});
    const source=i.defaults[0],target=i.defaults[1];
    for(const [id,patch] of [[source[1],{name:'Exam',max:20}],[target[1],{name:' Exam ',max:25}],
      [source[0],{name:'Participation'}],[target[0],{name:'Participation',auto:null}],[i.defaults[3][1],{name:'Exam'}]]) {
      const current=(await table(A,'items')).find(row=>row.id===id);await generic(A,'items',id,patch,'patch',current.revision);
    }
    await generic(A,'items',i.extra,{teaching_id:i.teachings[1],name:'Extra',max:5,order:5});
    await generic(A,'items',i.duplicate,{teaching_id:i.teachings[3],name:'Exam',max:25,order:5});
    await generic(A,'items',i.missing,{teaching_id:i.teachings[0],name:'Missing',max:6,order:5});
    for(const [id,item,student,value] of [[i.sourceScore,source[1],i.students[0],19],[i.capScore,target[1],i.students[0],23],
      [i.validScore,target[1],i.students[1],18],[i.extraScore,i.extra,i.students[0],4],[i.manualAutoScore,target[0],i.students[0],8]]) {
      await generic(A,'scores',id,{item_id:item,student_id:student,value});
    }
    for(const [parent,sub,value] of [[source[2],i.sourceSub,3],[target[2],i.targetSub,5],[i.missing,i.missingSub,6]]) {
      await rpc(A,'apply_score_configuration_command',{p_mutation_id:randomUUID(),p_device_id:prefix+'A1',p_item_id:parent,p_expected_version:1,
        p_payload:{scoreMode:'subitems',distributionMode:'manual',max:parent===i.missing?6:20,subitems:[{id:sub,name:'Part',value,startDate:'2026-10-01',dueDate:'2026-10-02',latePoints:1}],conversionStrategy:'retain-as-manual'}});
    }
    const completion=await rpc(A,'apply_score_subitem_command_n94',{p_mutation_id:randomUUID(),p_device_id:prefix+'A1',p_command:'set_completion',
      p_item_id:target[2],p_student_id:i.students[0],p_subitem_id:i.targetSub,p_completion_state:'late',p_manual_value:null});
    assert.equal(completion.completion.id,i.completion);
    for(const [student,selectedState] of [[i.students[1],'regular'],[i.students[2],null]]) await rpc(A,'apply_score_subitem_command_n94',{
      p_mutation_id:randomUUID(),p_device_id:prefix+'A1',p_command:'set_completion',p_item_id:target[2],p_student_id:student,p_subitem_id:i.targetSub,p_completion_state:selectedState,p_manual_value:null});
    await rpc(A,'apply_score_subitem_command',{p_mutation_id:randomUUID(),p_device_id:prefix+'A1',p_command:'set_manual',
      p_item_id:target[2],p_student_id:i.students[0],p_subitem_id:null,p_checked:null,p_manual_value:2});
    for(const [id,t,delta] of [[i.sourceLog,i.teachings[0],9],[i.targetLog,i.teachings[1],2]]) {
      await generic(A,'logs',id,{student_id:i.students[0],teaching_id:t,date:'2026-10-12',kind:'participation',delta});
    }
    const before=await table(A,'scores');
    const plan=(targets,removals=[])=>rpc(A,'plan_score_distribution',{p_plan_id:randomUUID(),p_source:i.teachings[0],p_targets:targets,p_remove:removals});
    const p=await plan(i.teachings.slice(1));
    assert.equal(p.targets.length,2);assert.equal(p.excludedTargets[0].teachingId,i.teachings[3]);
    assert.equal((await table(B,'items')).length,0);
    await assert.rejects(()=>rpc(B,'apply_score_distribution_plan',{p_mutation_id:randomUUID(),p_device_id:'B1',p_plan_id:p.planId,p_token:p.token,p_confirmed:true}));
    await assert.rejects(()=>rpc(B,'plan_score_distribution',{p_plan_id:randomUUID(),p_source:i.teachings[0],p_targets:[i.teachings[1]],p_remove:[]}));
    assert.deepEqual(await table(A,'scores'),before);
    report('live_owner_A_B_and_ambiguous_exclusion','Real authenticated B cannot read A items, plan or apply; two accepted targets and one explicitly excluded duplicate target.');
    await generic(A,'scores',i.capScore,{value:22},'patch',before.find(row=>row.id===i.capScore).revision);
    const domain=async()=>Object.fromEntries(await Promise.all(['items','score_subitems','score_subitem_completions','scores'].map(async name=>[name,await table(A,name)])));
    const receipts=()=>request(base+'/rest/v1/score_domain_receipts?owner_id=eq.'+A.user.id+'&select=mutation_id,request_envelope,result&order=mutation_id.asc&limit=1000',
      {token:A.access_token,headers:{'Accept-Profile':'rakeezx'}});
    const staleBefore=await domain(),receiptsBefore=await receipts(),staleMutation=randomUUID();
    await assert.rejects(()=>rpc(A,'apply_score_distribution_plan',{p_mutation_id:staleMutation,p_device_id:'A1',p_plan_id:p.planId,p_token:p.token,p_confirmed:true}),error=>error.status===409&&error.code==='PT409');
    assert.deepEqual(await domain(),staleBefore);
    assert.deepEqual(await receipts(),receiptsBefore);
    assert.ok(!(await receipts()).some(row=>row.mutation_id===staleMutation));
    report('live_stale_whole_plan_atomic','Actual HTTP 409 / PT409 rejects a score-stale plan within the unchanged 15000ms deadline; all canonical domain rows and receipts remain exactly unchanged.');
    const fresh=await plan(i.teachings.slice(1));
    const transport=backend(A);let lost=false;
    const original=transport.applyScoreDistributionPlan;
    transport.applyScoreDistributionPlan=async envelope=>{const receipt=await original(envelope);if(!lost){lost=true;throw new Error('synthetic lost committed receipt');}return receipt;};
    const actor1=await device(A.user.id,'live-A1-'+suffix,transport),actor2=await device(A.user.id,'live-A2-'+suffix,backend(A2),{primary:true});actors.push(actor1,actor2);
    await pull(actor2);
    const command=await actor1.engine.queueCommand({store:'items',recordId:i.teachings[0],command:'score:distribution_apply',patch:{planId:fresh.planId,token:fresh.token,confirmed:true}});
    assert.equal((await actor1.engine.dispatchPending()).failed,1);
    assert.equal((await actor1.database.getAll('items')).length,0);
    await pull(actor2); // A2 sees the real server commit before A1 gets its receipt.
    assert.equal((await actor1.engine.dispatchPending()).acknowledged,1);
    assert.equal(await actor1.database.get('outbox',command.id),undefined);
    const after=await table(A,'scores');
    assert.equal(after.find(r=>r.id===i.capScore).value,20);assert.equal(after.find(r=>r.id===i.validScore).value,18);
    assert.equal(after.find(r=>r.id===i.extraScore).value,4);assert.equal(after.find(r=>r.id===i.sourceScore).value,19);
    assert.equal(after.find(r=>r.id===i.manualAutoScore).value,null);
    const auto=decodeSyncV2Canonical('items',(await table(A,'items')).find(r=>r.id===target[0]));
    const logs=(await table(A,'logs')).filter(r=>r.teaching_id===i.teachings[1]).map(r=>decodeSyncV2Canonical('logs',r));
    assert.equal(itemScore(auto,{logs,classHasParticipation:true}),2);
    const targetSub=await actor2.database.get('scoreSubitems',i.targetSub);assert.equal(targetSub.distributionOriginId,i.sourceSub);
    assert.equal(targetSub.startDate,'2026-10-01');assert.equal(targetSub.dueDate,'2026-10-02');assert.equal(targetSub.latePoints,1);
    assert.equal((await actor2.database.get('scoreSubitemCompletions',i.completion)).completionState,'late');
    const targetSubScores=(await actor2.database.getAll('scores')).filter(r=>r.itemId===target[2]);
    const targetSubScore=targetSubScores.find(r=>r.studentId===i.students[0]);assert.equal(targetSubScore.value,3);assert.equal(targetSubScore.manualValue,2);
    assert.equal(targetSubScores.find(r=>r.studentId===i.students[1]).value,3);
    assert.equal(targetSubScores.find(r=>r.studentId===i.students[2]).value,null);
    report('live_late_regular_unmarked_roundtrip','Actual A2 receives dates, latePoints=1 and stable origin; target late+manual=3, regular=3, unmarked=NULL; explicit completion states retained.');
    report('live_cap_preserve_auto_and_idempotent_retry','Persisted cap=20, compatible score=18 and extra=4 retained; source grade=19 unchanged; target-only participation projects 2 rather than source 9; lost-receipt retry adopts one canonical result.');
    const repeat=await plan(i.teachings.slice(1));assert.equal(repeat.changedCount,0);
    const itemsBeforeRepeat=await table(A,'items');
    await rpc(A,'apply_score_distribution_plan',{p_mutation_id:randomUUID(),p_device_id:'A1',p_plan_id:repeat.planId,p_token:repeat.token,p_confirmed:true});
    assert.deepEqual(await table(A,'items'),itemsBeforeRepeat);
    // A2 has a genuine pending stale edit before explicit deletion by A1.
    const extra=await actor2.database.get('items',i.extra);
    await actor2.engine.commitMutation({store:'items',recordId:extra.id,patch:{name:'Stale synthetic extra'},op:'patch'});
    const removal=await plan([i.teachings[1]],[i.extra]);
    await assert.rejects(()=>rpc(A,'apply_score_distribution_plan',{p_mutation_id:randomUUID(),p_device_id:'A1',p_plan_id:removal.planId,p_token:removal.token,p_confirmed:false}));
    assert.equal((await table(A,'items')).find(r=>r.id===i.extra).deleted_at,null);
    const removed=await rpc(A,'apply_score_distribution_plan',{p_mutation_id:randomUUID(),p_device_id:'A1',p_plan_id:removal.planId,p_token:removal.token,p_confirmed:true});
    assert.ok(removed.items.find(r=>r.id===i.extra).deleted_at);
    assert.ok(removed.scores.find(r=>r.id===i.extraScore).deleted_at);
    await pull(actor2);await actor2.engine.dispatchPending();await pull(actor2);
    assert.equal((await actor2.database.get('items',i.extra)).deleted,true);
    assert.equal((await actor2.database.get('scores',i.extraScore)).deleted,true);
    assert.equal((await table(A,'items')).filter(r=>r.id===i.extra).length,1);
    assert.ok((await table(A,'items')).find(r=>r.id===i.extra).deleted_at);
    const {buildBackup,restoreBackup,validateBackupIntegrity}=await import('../../src/lib/export.js');
    const backup=await buildBackup({sourceOwnerId:A.user.id});assert.equal((await validateBackupIntegrity(backup)).ok,true);
    assert.equal(backup.data.scoreSubitems.find(r=>r.id===i.targetSub).distributionOriginId,i.sourceSub);
    assert.equal(backup.data.scoreSubitems.find(r=>r.id===i.targetSub).latePoints,1);
    assert.equal(backup.data.scoreSubitemCompletions.find(r=>r.id===i.completion).completionState,'late');
    await assert.rejects(()=>restoreBackup(backup,'replace'),error=>error.code==='LOCAL_RESTORE_DISABLED');
    const serialized=JSON.parse(JSON.stringify(backup));
    for(const [storeName,id,expected] of [['scoreSubitems',i.targetSub,{distributionOriginId:i.sourceSub,dueDate:'2026-10-02',latePoints:1}],
      ['scoreSubitemCompletions',i.completion,{completionState:'late'}]]) {
      const row=serialized.data[storeName].find(r=>r.id===id);
      const decoded=decodeSyncV2Canonical(storeName,{id,...encodeSyncV2Patch(storeName,row)});
      for(const [key,value] of Object.entries(expected)) assert.equal(decoded[key],value);
    }
    assert.equal(serialized.data.items.find(r=>r.id===i.extra).deleted,true);
    assert.equal((await actor2.database.get('items',i.extra)).deleted,true);
    report('live_device_convergence_and_backup','Actual A2 Sync converges canonical data and tombstones without resurrection. V5 backup plus actual field serializers preserve origins/dates/late state; N77 legacy local restore remains denied. Focused current restore contract covers canonical reconciliation.');
    state.status='CHECKS_COMPLETE';await save();
  } catch(error) {state.failure=safe(error);await save();throw error;}
  finally {
    for(const actor of actors) await actor.close();
    await cleanup();await save();await mkdir(artifact,{recursive:true});
    await writeFile(path.join(artifact,'result.json'),JSON.stringify({runId,candidate:state.candidate,status:state.status,accounts:state.accounts.map(a=>({slot:a.slot,id:a.id})),
      tree:state.tree,harnessSha256:state.harnessSha256,ids:state.ids,checks:state.checks,diagnostics:state.diagnostics,failure:state.failure??null,disposition:state.disposition},null,2));
  }
}

const [mode,role]=process.argv.slice(2);
try {
  if(mode==='prepare') await prepare();
  else if(mode==='bundle') await bundle(role,false);
  else if(mode==='closed-bundle') await bundle(role,true);
  else if(mode==='run'||mode==='recover') await withPrivateRun(repo,privateDir,async saved=>{state=saved;if(mode==='run')await run();else{await cleanup();await save();}});
  else if(mode==='verify-disarm') {
    state=await readPrivateState(repo,privateDir);
    for(const role of ['provision','retire']) {
      const response=await fetch(base+'/functions/v1/'+names[role],{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,410);assert.equal((await response.json()).errorCode,'N73_DISARMED');
    }
    assert.equal(state.status,'DISARM_PENDING');
    report('both_actual_deny_all_endpoints','Exact provisioning and cleanup companion endpoints both returned HTTP 410 N73_DISARMED after deny-all redeployment.');
    state.status='DISARMED';await save();
    const resultPath=path.join(artifact,'result.json');
    const result=JSON.parse(await readFile(resultPath,'utf8'));result.status=state.status;result.checks=state.checks;
    await writeFile(resultPath,JSON.stringify(result,null,2));console.log(JSON.stringify({status:state.status,runId,names}));
  } else throw fail('Unsupported N73 harness mode','N73_MODE');
} catch(error) {console.error(JSON.stringify(safe(error)));process.exitCode=1;}
