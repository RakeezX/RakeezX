// AI: current atomic capability certification; historic unsafe race is NOT a current PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {withOfficialServices,hash,freePort} from './n58-empty-recovery-services.mjs';
const runId='79f2600c-16c3-4f27-9092-8c1aedd2f9cc';
const receipt={runId,checks:[],calls:[],hostedCalls:0};
const request=(owner)=>({ownerId:owner,version:'N58_EMPTY_V1',presetId:'sa-western-1448-1449',rootMutationId:randomUUID(),originalDigest:'a'.repeat(64)});
try {
 await withOfficialServices({runId,appOrigin:'http://127.0.0.1:'+await freePort()},async svc=>{
  receipt.identities=svc.identities;receipt.migrations=svc.migrations;receipt.schema=await svc.inspectAtomic();
  assert.ok(receipt.schema.receipt[0].relrowsecurity&&receipt.schema.receipt[0].relforcerowsecurity);
  for(const name of ['years','terms','calendars','calendar_days','sections','students','teachings','sessions','slots','scores','attendance','assignments','submissions'])assert.ok(receipt.schema.locks.some(r=>r.relname===name&&r.tgenabled==='O'));
  assert.ok(receipt.schema.functions.filter(f=>['review_n58_empty_foundation','apply_n58_empty_foundation'].some(n=>f.signature.includes(n))).every(f=>f.prosecdef&&f.proconfig.includes('search_path=""')&&!/[{,]=X\//.test(f.acl)));
  const account=async()=>{
   const email='n58-atomic-'+randomUUID()+'@example.invalid',password='Local!Aa1'+randomBytes(24).toString('hex');
   const r=await fetch(svc.authUrl+'/signup',{method:'POST',headers:{apikey:svc.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const b=await r.json();assert.equal(r.status,200);return {owner:b.user.id,token:b.access_token};
  };
  const rpc=async(a,name,body)=>{
   const r=await fetch(svc.restUrl+'/rpc/'+name,{method:'POST',headers:{apikey:svc.anonKey,Authorization:'Bearer '+a.token,'Content-Type':'application/json','Accept-Profile':'rakeezx','Content-Profile':'rakeezx'},body:JSON.stringify(body)});const b=await r.json();receipt.calls.push({owner:a.owner,name,body,status:r.status,result:b});return {status:r.status,body:b};
  };
  const rows=async(a,table)=>{const r=await fetch(svc.restUrl+'/'+table+'?owner_id=eq.'+a.owner+'&select=*',{headers:{apikey:svc.anonKey,Authorization:'Bearer '+a.token,'Accept-Profile':'rakeezx'}});return {status:r.status,body:await r.json()};};
  const review=async a=>{const r=await rpc(a,'review_n58_empty_foundation',{p_request:request(a.owner)});assert.equal(r.status,200,JSON.stringify(r));return r.body;};
  const apply=(a,plan,id=randomUUID())=>rpc(a,'apply_n58_empty_foundation',{p_repair_id:id,p_plan:plan});
  const mutate=(a,entity,id,patch,base=0,operation='create')=>rpc(a,'apply_sync_v2_mutation',{p_entity:entity,p_record_id:id,p_mutation_id:randomUUID(),p_device_id:randomUUID(),p_base_revision:base,p_patch:patch,p_operation:operation,p_client_updated_at:null});
  const a=await account(),b=await account(),plan=await review(a),repairId=randomUUID();
  assert.equal((await rows(a,'years')).body.length,0); // review/cancel no writes
  let result=await apply(a,plan,repairId);assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(result.body.mutationReceipts.length,4);assert.equal(result.body.canonical.terms.length,2);assert.ok(result.body.canonical.years[0].field_revisions.calendar_selection>0);
  assert.deepEqual((await apply(a,plan,repairId)).body,result.body); // lost response/restart same envelope
  assert.notEqual((await apply(a,{...plan,extra:true},repairId)).status,200);
  assert.notEqual((await apply(b,plan,repairId)).status,200);
  assert.notEqual((await rows(a,'n58_foundation_repair_receipts')).status,200);
  receipt.checks.push({name:'atomic_apply_receipt_replay_owner_and_acl',status:'PASS'});
  const section={year_id:'y:1448-1449',grade:4,label:'أ',name:'4/أ',color:'#0d9488',order:0,status:'active',archived_at:null,archive_date:null};
  assert.equal((await mutate(a,'sections','sec:'+randomUUID(),section)).body.outcome,'applied');
  assert.deepEqual((await apply(a,plan,repairId)).body,result.body,'Replay must recover receipt after later legitimate content');
  assert.notEqual((await rpc(a,'review_n58_empty_foundation',{p_request:request(a.owner)})).status,200);
  receipt.checks.push({name:'legitimate_later_content_and_completed_replay',status:'PASS'});
  const race=await account();
  const seed=JSON.parse(await fs.readFile('tests/n58-fresh-account-candidate.json','utf8')).calls.find(c=>c.envelope.p_entity==='years'&&c.envelope.p_operation==='create').envelope;
  assert.equal((await mutate(race,'years','y:1448-1449',seed.p_patch)).body.outcome,'applied');
  const racePlan=await review(race);
  assert.equal((await mutate(race,'sections','sec:'+randomUUID(),section)).body.outcome,'applied');
  const blocked=await apply(race,racePlan);assert.notEqual(blocked.status,200);assert.equal(blocked.body.message,'N58_REPAIR_ACCOUNT_NOT_EMPTY');assert.equal((await rows(race,'terms')).body.length,0);
  receipt.checks.push({name:'section_before_lock_no_write_rejection',status:'PASS'});
  const stale=await account();assert.equal((await mutate(stale,'years','y:1448-1449',seed.p_patch)).body.outcome,'applied');const stalePlan=await review(stale);
  assert.equal((await mutate(stale,'years','y:1448-1449',{label:'Custom label'},1,'patch')).body.outcome,'applied');assert.notEqual((await apply(stale,stalePlan)).status,200);assert.equal((await rows(stale,'terms')).body.length,0);
  receipt.checks.push({name:'changed_academic_snapshot_no_write',status:'PASS'});
  const failure=await account(),failurePlan=await review(failure);
  await svc.withTermFailure(async()=>{const r=await apply(failure,failurePlan);assert.notEqual(r.status,200);assert.equal(r.body.message,'LOCAL_INJECTED_TERM_FAILURE');});
  for(const table of ['years','terms','sync_mutation_receipts'])assert.equal((await rows(failure,table)).body.length,0,'Partial failure rolled back '+table);
  receipt.checks.push({name:'partial_failure_rollback',status:'PASS'});
  const serialized=await account();assert.equal((await mutate(serialized,'years','y:1448-1449',seed.p_patch)).body.outcome,'applied');const serializedPlan=await review(serialized);
  let repairing,creating;
  await svc.withOwnerLock(serialized.owner,async waiters=>{
   repairing=apply(serialized,serializedPlan);
   const until=Date.now()+10000;while(await waiters()<1){assert.ok(Date.now()<until);await new Promise(r=>setTimeout(r,50));}
   creating=mutate(serialized,'sections','sec:'+randomUUID(),section);
   while(await waiters()<2){assert.ok(Date.now()<until);await new Promise(r=>setTimeout(r,50));}
   receipt.lockedWaiters=await waiters();
  });
  assert.equal((await repairing).status,200);assert.equal((await creating).body.outcome,'applied');
  receipt.checks.push({name:'owner_mutex_serializes_ordinary_section_and_atomic_apply',status:'PASS'});
 });
 receipt.completed=true;
}catch(error){receipt.problem={message:error.message,stack:error.stack};process.exitCode=1;}
finally{await fs.writeFile('tests/n58-empty-recovery-atomic.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({completed:receipt.completed,checks:receipt.checks,problem:receipt.problem}));
