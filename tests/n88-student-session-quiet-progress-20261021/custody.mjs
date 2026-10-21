/** AI: exercise the actual new custody phase with synthetic ports only; never load DPAPI/provider state. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {STUDENT_SESSION_STATIC as c,studentSessionStaticGate,verifyStudentStaticArtifacts,runStudentSessionStaticPhase,staticDigest as sha} from '../../drafts/n88-student-portal/activation/static-student-session-20261021-gate.mjs';
const dir=c.evidence,report={status:'FAIL',checks:[],providerOperations:0,privateStateReads:0,uploads:0};
const card=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+c.task+'.json','utf8')).replace(/^\uFEFF/,''));
const config=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/workflow-v5.json','utf8'));
const prior=await readFile('tests/n88-region-response-20261020/carrier.mjs'),prepared=await readFile(dir+'carrier.mjs'),student=await readFile('drafts/n88-student-portal/activation/bundle/private/assets/student.mjs');
const configuration=JSON.parse(await readFile('tests/n88-region-response-20261020/provider-preflight.json','utf8'));
const originalProof=JSON.parse(await readFile(dir+'qualification.json','utf8'));
const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try{
 // Preserve source and UI evidence pinned to the actual prepared Git candidate.
 for(const p of [...Object.keys(originalProof.changedSourceHashes),dir+'carrier.mjs',dir+'ui.json',dir+'ui-extra.json',dir+'qualification.json']){
  const current=(await readFile(p,'utf8')).replaceAll('\r\n','\n'),committed=execFileSync('git',['show',c.candidate+':'+p],{maxBuffer:2097152}).toString().replaceAll('\r\n','\n');assert.equal(current,committed,p);
 }
 verifyStudentStaticArtifacts(prior,prepared,student);pass('unchanged_product_and_ui_proof_reused','Exact prepared Git bytes retained; UI not rerun. Only student module differs in the current recorded carrier.');
 const lease={version:2,resource:'integration',taskId:c.task,activationId:config.controller.activationId,owner:{type:'worker',token:c.run}};
 studentSessionStaticGate(card,c.run,config.controller.activationId,lease);
 const delivery=structuredClone(card);delivery.status='delivery';delivery.deliveryOwner={instanceId:'synthetic-controller'};
 studentSessionStaticGate(delivery,c.run,config.controller.activationId,{...lease,owner:{type:'controller',token:'synthetic-controller'}});
 let denied=0;
 const mutants=[q=>q.id='wrong',q=>q.productId='wrong',q=>q.status='blocked',q=>q.sessionId='wrong',q=>q.attempt.runId='wrong',q=>q.liveAuthorizationRef=null,q=>q.activationId='wrong',q=>q.worktreePath='wrong',q=>q.baseSha='wrong'];
 for(const key of ['realAccountReads','realStudentTeacherWrites','providerServiceOperations','sqlAuthSchemaChanges','regionChanges','nativeDeployments','publicPinChanges','newReadinessRequests'])mutants.push(q=>q.preparationAuthority[key]=1);
 for(const key of ['publication','appendOnlyAttemptHistory'])mutants.push(q=>q.preparationAuthority[key]=false);
 mutants.push(q=>q.preparationAuthority.maxChangedPrivateStaticUploads=2,q=>q.preparationAuthority.resetConsumedMarkers=true);
 for(const change of mutants){const q=structuredClone(card);change(q);assert.throws(()=>studentSessionStaticGate(q,c.run,config.controller.activationId,lease));denied++;}
 for(const bad of [{...lease,resource:'browser'},{...lease,taskId:'wrong'},{...lease,activationId:'wrong'},{...lease,owner:{type:'controller',token:c.run}},{...lease,owner:{type:'worker',token:'wrong'}}]){assert.throws(()=>studentSessionStaticGate(card,c.run,config.controller.activationId,bad));denied++;}
 pass('task_run_candidate_scope_and_lease_fences',`${denied} identity/authority/lease variants deny; exact worker and publisher delivery leases admit.`);
 const nativeBytes=Buffer.from('SYNTHETIC NATIVE SOURCE; NO CREDENTIALS'),native=sha(nativeBytes),clock=Date.now();
 function fixture(){
  let state={directVerified:true,directSource:native,directAuthRefused:false,loginDisarmed:false,carrierCorrections:[{source:'older-history',immutable:true}]},loads=0,saves=0,failSave=false,verifyFailure=false;
  const pre={taskId:c.task,runId:c.run,preparedCandidate:c.candidate,observedAt:new Date(clock).toISOString(),nativeSource:native,nativeVersion:59,carrierVersion:'synthetic-prior-version',carrierPercentage:100,...Object.fromEntries(['settings','routes','subdomain'].map(k=>[k,structuredClone(configuration[k])]))};
  const receipt={...structuredClone(pre),source:c.carrier,version:'synthetic-new-version',uploads:1,servedUrl:'https://rakeezx.com/n88-private/assets/student.mjs',servedStatus:200,servedType:'text/javascript',servedHeaders:{noStore:true,noReferrer:true,nosniff:true}};
  const files=new Map([['prior-carrier.mjs',prior],['carrier.mjs',prepared],['student.mjs',student],['configuration-preimage.json',Buffer.from(JSON.stringify(configuration))],['provider-native.mjs',nativeBytes],['provider-native-after.mjs',nativeBytes],['provider-preimage.mjs',prior],['provider-carrier.mjs',prepared],['served-student.mjs',student],['provider-preflight.json',Buffer.from(JSON.stringify(pre))],['carrier-readback.json',Buffer.from(JSON.stringify(receipt))]]);
  const ports={card:structuredClone(card),run:c.run,activationId:config.controller.activationId,lease:structuredClone(lease),now:()=>clock,
   read:async name=>{if(!files.has(name))throw Object.assign(Error('absent'),{code:'ENOENT'});return files.get(name);},
   writeExclusive:async(name,bytes)=>{if(files.has(name))throw Object.assign(Error('exists'),{code:'EEXIST'});files.set(name,Buffer.from(bytes));},
   load:async()=>{loads++;return structuredClone(state);},save:async next=>{if(failSave)throw Error('synthetic save interruption');saves++;state=structuredClone(next);},readPublicPin:async()=>sha(native),verifyCandidate:async candidate=>{assert.equal(candidate,c.candidate);if(verifyFailure)throw Error('source drift');}};
  return {ports,files,pre,receipt,get state(){return state;},get loads(){return loads;},get saves(){return saves;},failSave:v=>failSave=v,failCandidate:()=>verifyFailure=true,put(name,obj){files.set(name,Buffer.from(JSON.stringify(obj)));}};
 }
 const attempt='owned/student-session-static-'+c.candidate+'-attempt.json',complete='owned/student-session-static-'+c.candidate+'-complete.json';
 const happy=fixture();await runStudentSessionStaticPhase('preflight',happy.ports);assert(!happy.files.has(attempt));assert.equal(happy.saves,0);
 await runStudentSessionStaticPhase('begin',happy.ports);assert(happy.files.has(attempt));await assert.rejects(runStudentSessionStaticPhase('begin',happy.ports),/attempt_consumed/);
 const oldHistory=structuredClone(happy.state.carrierCorrections);await runStudentSessionStaticPhase('complete',happy.ports);assert.equal(happy.saves,1);assert.deepEqual(happy.state.carrierCorrections.slice(0,-1),oldHistory);assert.equal(happy.state.carrierCorrections.at(-1).source,c.carrier);
 const again=await runStudentSessionStaticPhase('complete',happy.ports);assert.equal(again.alreadyRecorded,true);assert.equal(happy.saves,1);await assert.rejects(runStudentSessionStaticPhase('begin',happy.ports));
 pass('single_attempt_and_append_only_completion','Preflight read-only; begin reserves candidate-wide exclusive attempt; duplicate begin denied; complete appends once; repeated complete is idempotent.');
 const broken=fixture();broken.failCandidate();await assert.rejects(runStudentSessionStaticPhase('begin',broken.ports),/source drift/);assert.equal(broken.loads,0);
 for(const [name,value]of [['provider-preimage.mjs',student],['provider-native.mjs',student],['carrier.mjs',prior]]){
  const f=fixture();f.files.set(name,value);await assert.rejects(runStudentSessionStaticPhase('begin',f.ports));assert(!f.files.has(attempt));
 }
 const pin=fixture();pin.ports.readPublicPin=async()=>sha('wrong');await assert.rejects(runStudentSessionStaticPhase('begin',pin.ports),/public_pin/);
 for(const change of [s=>s.directVerified=false,s=>s.directAuthRefused=true,s=>s.loginDisarmed=true,s=>s.carrierCorrections=false]){const f=fixture();change(f.state);await assert.rejects(runStudentSessionStaticPhase('begin',f.ports));assert(!f.files.has(attempt));}
 const stale=fixture();stale.pre.observedAt=new Date(clock-16*60*1000).toISOString();stale.put('provider-preflight.json',stale.pre);await assert.rejects(runStudentSessionStaticPhase('begin',stale.ports),/freshness/);
 const changedPre=fixture();changedPre.pre.routes=[];changedPre.put('provider-preflight.json',changedPre.pre);await assert.rejects(runStudentSessionStaticPhase('begin',changedPre.ports),/configuration_preimage/);
 pass('preimage_and_freshness_fail_before_reservation','Candidate drift denies before custody load; native/carrier/source/pin/configuration drift and stale preflight cannot reserve.');
 let readbackNegatives=0;
 for(const alter of [f=>f.receipt.uploads=2,f=>f.receipt.nativeVersion++,f=>f.receipt.source='wrong',f=>f.receipt.version=f.pre.carrierVersion,f=>f.receipt.runId='wrong',f=>f.receipt.servedUrl='https://elsewhere.invalid/student.mjs',f=>f.receipt.servedStatus=503,f=>f.receipt.servedHeaders.noStore=false,f=>f.receipt.routes=[],f=>f.receipt.settings.placement={mode:'smart'}]){
  const f=fixture();await runStudentSessionStaticPhase('begin',f.ports);alter(f);f.put('carrier-readback.json',f.receipt);await assert.rejects(runStudentSessionStaticPhase('complete',f.ports));assert(!f.files.has(complete));assert.equal(f.saves,0);readbackNegatives++;
 }
 for(const name of ['provider-carrier.mjs','provider-native-after.mjs','served-student.mjs']){const f=fixture();await runStudentSessionStaticPhase('begin',f.ports);f.files.set(name,Buffer.from('wrong'));await assert.rejects(runStudentSessionStaticPhase('complete',f.ports));assert(!f.files.has(complete));readbackNegatives++;}
 pass('exact_readback_and_configuration_fences',`${readbackNegatives} negative completions reject metadata or actual carrier/native/served byte mismatch; no success marker/history appended.`);
 const historyDrift=fixture();await runStudentSessionStaticPhase('begin',historyDrift.ports);historyDrift.state.carrierCorrections.push({source:'another-owned-operation'});await assert.rejects(runStudentSessionStaticPhase('complete',historyDrift.ports),/history_changed/);assert.equal(historyDrift.saves,0);
 const interrupted=fixture();await runStudentSessionStaticPhase('begin',interrupted.ports);interrupted.failSave(true);await assert.rejects(runStudentSessionStaticPhase('complete',interrupted.ports),/save interruption/);assert(interrupted.files.has(complete));interrupted.failSave(false);interrupted.ports.now=()=>clock+24*60*60*1000;await runStudentSessionStaticPhase('complete',interrupted.ports);assert.equal(interrupted.state.carrierCorrections.length,2);assert.equal(interrupted.saves,1);
 pass('completion_save_interruption_recovers_without_upload','Exact completed receipt resumes one history append after synthetic protected-save failure; attempt marker is retained.');
 const cmd=spawnSync(process.execPath,['drafts/n88-student-portal/official-activation.mjs','--student-session-static-preflight'],{encoding:'utf8',windowsHide:true,env:{...process.env,N88_STUDENT_SESSION_RUN_ID:c.run}});
 assert.equal(cmd.status,1);assert.match(cmd.stderr,/n88_student_static_original_root/);pass('actual_official_entry_wrong_root_denies','Actual command in this non-custodian worktree denies before DPAPI, lease or provider access. No alternate channel attempted.');
 report.guardSha256=sha((await readFile('drafts/n88-student-portal/activation/static-student-session-20261021-gate.mjs','utf8')).replaceAll('\r\n','\n'));
 report.officialEntrySha256=sha((await readFile('drafts/n88-student-portal/official-activation.mjs','utf8')).replaceAll('\r\n','\n'));
 report.status='PASS';report.servedParity='NOT_RUN';report.publication='NOT_RUN';
}catch(e){report.failure={name:e.name,message:e.message.slice(0,600)};process.exitCode=1;}
await writeFile(dir+'custody.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
