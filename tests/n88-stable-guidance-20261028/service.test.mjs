/** AI: one affected native service comparison + closure/guard regression group.
 * Uses the current service, signed SDK, original repository and SQL boundary.
 * No hosted transport, browser, real identity or issuance operation.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomBytes,createHash} from 'node:crypto';
import {startNativePg} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {A,B,SESSION,authUrl,providerFixture} from '../fixtures/n88-existing-host/provider.mjs';
import {lease,taskId,runId} from './prepare.mjs';
import manifest from '../../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
import contract from '../../drafts/n88-student-portal/activation/error-boundary-contract.json' with {type:'json'};
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
const root='C:/Users/Abody/Projects/RakeezX',dir='tests/n88-stable-guidance-20261028';
const report={taskId,runId,status:'FAIL',checks:[],matrix:[],providerOperations:0,realDataOperations:0,cleanup:{}};
const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
let pg,owned=false,stage='setup',trace=[],delay=0,token;
try {
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');
 try {
  await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));
  await q(await readFile('drafts/n88-student-portal/guidance-closure.inactive.sql','utf8'));
 }finally{await q('reset role');}
 const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const sdk=createRequire(root+'/.worktrees/continuous-n88-official-student-portal-activation-20261018/drafts/n88-student-portal/package.json').resolve('@supabase/auth-js');
 const built=await esbuild.build({stdin:{contents:"export * from './drafts/n88-student-portal/runtime.mjs';export * from './drafts/n88-student-portal/integrated-service.mjs';export * from './drafts/n88-student-portal/postgres-repository.mjs';export * from './drafts/n88-student-portal/task-guidance.mjs';export * from './drafts/n88-student-portal/activation/private-error-boundary.mjs';",resolveDir:process.cwd(),sourcefile:'synthetic-service-entry.mjs'},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'existing-pinned-sdk',setup(b){b.onResolve({filter:/^@supabase\/auth-js$/},()=>({path:sdk}));}}]});
 const {composeService,createTeacherVerifier,readCanonical,readGuidanceCanonical,createPostgresRepository,authorizedGuidanceSources,assertVerifiedBoundary,privateQuery,boundaryCatalogSql}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
 const provider=providerFixture(),origin='https://synthetic.invalid';token=provider.token();
 const rollout=createRolloutGuard(n=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[n]);
 const options={...manifest,origin,authUrl,apiKey:'FABRICATED',fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,rollout,canonicalBounds:{rollout},numericKey:randomBytes(32),reservationKey:randomBytes(32),secretKey:randomBytes(32),ingressKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',acquire:async()=>{
  const c=await pg.acquire();return {release:e=>c.release(e),query:async(sql,args=[])=>{trace.push(sql);if(delay&&sql.includes(contract.guidanceClosure.operations[0].name+'('))await new Promise(r=>setTimeout(r,delay));return c.query(sql,args);}};
 }};
 const verifier=createTeacherVerifier(options),adapter={verifyIngress:async()=>({clientKey:'fabricated-ingress'}),verifyTeacher:(r,p)=>verifier('Bearer '+token,AbortSignal.timeout(5000),p)};
 const old=composeService(options,adapter),current=composeService({...options,executionMode:'synthetic',syntheticGuidanceClosureEnabled:true},adapter);
 const flagWithoutSynthetic=composeService({...options,syntheticGuidanceClosureEnabled:true},adapter);
 const binding={ownerId:A,sessionId:SESSION,leaseId:'synthetic-lease',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const call=async(handle,action='guidance-list',extra={},b=binding)=>{trace=[];return handle({path:'/teacher/class/'+action,method:'POST',headers:{origin,'x-n88-csrf':'1','content-type':'application/json'},body:{teachingId:b.teachingId,binding:b,...extra}});};
 const data=async(handle,action='guidance-list',extra={},b=binding)=>{const r=await call(handle,action,extra,b);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data;};
 const fields={name:true,class:true,grades:true,required:true,completed:true,scheduled:true};
 const publish=async()=>{const l=await data(old,'list');await data(old,'visibility',{fields,policyRevision:l.policyRevision,expectedRosterRevision:l.rosterRevision});};
 const repo=createPostgresRepository(options);
 const checkpoint=mode=>repo.transaction(async(_db,p)=>({canonical:await (mode==='full'?readCanonical(p,A):readGuidanceCanonical(p,A,'class','term')),policy:(await p.query('select payload from n88_private.class_visibility where owner_id=$1::uuid and class_id=$2 and term_id=$3',[A,'class','term'])).rows[0].payload}));
 const sources=({canonical,policy})=>authorizedGuidanceSources({ownerId:A,classId:'class',termId:'term',teachingId:'teaching',canonical},policy.members,policy,(s,m)=>({teacherContextVersion:'n88-canonical-teacher-context-v1',canonical:s.canonical,ownerId:A,classId:'class',termId:'term',studentId:m.studentId,enrollmentId:m.enrollmentId,now:'2026-10-28'}));
 const history=async()=>{
  await q("insert into rakeezx.sections(owner_id,id,revision,year_id,grade,status) values($1,'history-class',1,'year',4,'active')",[A]);
  await q("insert into rakeezx.teachings(owner_id,id,revision,section_id,term_id,subject_id) values($1,'history-teaching',1,'history-class','term','subject')",[A]);
  await q("insert into rakeezx.items(owner_id,id,revision,teaching_id,name,max,score_mode) values($1,'history-item',1,'history-teaching','SYNTHETIC',10,'subitems')",[A]);
  await q("insert into rakeezx.score_subitems(owner_id,id,revision,item_id,name,value) values($1,'history-definition',1,'history-item',repeat('s',2200000),1)",[A]);
  await q("insert into rakeezx.logs(owner_id,id,revision,student_id,teaching_id,kind,delta) select $1,'history-'||n,1,'other','history-teaching','participation',1 from generate_series(1,2001) n",[A]);
 };
 const clearHistory=async()=>{await q("delete from rakeezx.sections where id='history-class'");};
 stage='service 0/28/50 with unrelated count and byte history';
 await q("update rakeezx.enrollments set status='inactive',revision=revision+1");
 for(const count of [0,28,50]) {
  if(count){const start=count===28?1:29;
   await q("insert into rakeezx.students(owner_id,id,revision,name,status) select $1,'member-'||n,1,'SYNTHETIC','active' from generate_series($2::int,$3::int) n",[A,start,count]);
   await q("insert into rakeezx.enrollments(owner_id,id,revision,student_id,section_id,status,start_date) select $1,'enrollment-'||n,1,'member-'||n,'class','active','2026-08-01' from generate_series($2::int,$3::int) n",[A,start,count]);
  }
  assert.equal((await data(old,'list')).students.length,count);await publish();
  const baseline=await data(old),full=await checkpoint('full'),scoped=await checkpoint('scoped');
  assert.deepEqual(sources(scoped),sources(full));assert.deepEqual(await data(current),baseline);assert.equal(baseline.tasks.length,count?4:0);
  await history();
  const rosterOld=await data(old,'list'),rosterNew=await data(current,'list');assert.deepEqual(rosterNew,rosterOld);assert.equal(rosterOld.students.length,count);assert(rosterOld.students.every(s=>!s.hasActiveCode));
  const failed=await call(old);assert.equal(failed.status,503);assert.equal(failed.body.stage,'source');
  assert.deepEqual(await data(current),baseline);
  await q("delete from rakeezx.logs where id like 'history-%'");
  const byteFailure=await call(old);assert.equal(byteFailure.status,503);assert.equal(byteFailure.body.stage,'source');assert.deepEqual(await data(current),baseline);
  assert.equal((await call(old,'guidance-list',{syntheticGuidanceClosureEnabled:true,executionMode:'synthetic'})).status,503);
  assert.equal((await call(flagWithoutSynthetic)).status,503);
  report.matrix.push({members:count,listOld:200,listNew:200,oldLogBound:failed.status,oldByteBound:byteFailure.status,newGuidance:200,tasks:baseline.tasks.length,exactBindingsAndSourceStamps:true,zeroActiveCodes:true});
  await clearHistory();
 }
 pass('n88_guidance_source_503_actual_root_fixed_with_safe_class_read_and_unchanged_200_list','Actual signed-SDK service through original verified repository: 0/28/50, list200 identical; old guidance503/source independently for 2001 unrelated logs and 2.2MB unrelated score definitions; new200 exact baseline tasks/stamps; browser-body flag and constructor flag without synthetic mode cannot enable it.');

 stage='raw grade, revision, policy, term and owner parity';
 const baseline=await data(current);assert.equal(baseline.tasks.length,4);
 await q("insert into rakeezx.scores(owner_id,id,revision,student_id,item_id,value,manual_value,derived_value) select $1,'bad-grade-'||n,1,'member-'||n,'subitems',1,null,0 from generate_series(1,50) n",[A]);
 assert.deepEqual(await data(old),{tasks:[]});assert.deepEqual(await data(current),{tasks:[]});
 assert.deepEqual(sources(await checkpoint('scoped')),sources(await checkpoint('full')));
 await q("delete from rakeezx.scores where id like 'bad-grade-%'");assert.deepEqual(await data(current),baseline);
 await q("update rakeezx.score_subitems set revision=revision+1 where id='regular'");
 assert.deepEqual(await data(current),await data(old));assert.equal((await data(current)).tasks.length,3);
 await publish();assert.equal((await data(current)).tasks.length,4);
 await q("update n88_private.class_visibility set payload=jsonb_set(payload,'{members}','[]')");
 assert.deepEqual(await data(current),{tasks:[]});await publish();
 for(const b of [{...binding,ownerId:B},{...binding,sessionId:'22222222-2222-4222-8222-222222222222'},{...binding,termId:'absent'},{...binding,teachingId:'absent'}])assert.equal((await call(current,'guidance-list',{},b)).status,401);
 token=provider.token({exp:1});assert.equal((await call(current)).status,401);token=provider.token();
 await q("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[SESSION]);assert.equal((await call(current)).status,401);await q('update auth.sessions set not_after=null where id=$1',[SESSION]);
 // Same-year active membership in another class must still deny, not disappear
 // merely because the closure is class scoped.
 await q("insert into rakeezx.sections(owner_id,id,revision,year_id,grade,status) values($1,'duplicate-class',1,'year',4,'active')",[A]);
 await q("insert into rakeezx.enrollments(owner_id,id,revision,student_id,section_id,status) values($1,'duplicate-enrollment',1,'member-1','duplicate-class','active')",[A]);
 assert.equal((await call(old)).status,401);assert.equal((await call(current)).status,401);
 await q("delete from rakeezx.sections where id='duplicate-class'");
 pass('n88_guidance_policy_grade_owner_term_and_cross_class_source_parity','Full/scoped exact source and binding equality; all 50 raw grade inconsistencies suppress tasks identically; restoring grades restores tasks; source revision invalidates prior publication; absent policy gives no tasks. Wrong owner/session/teaching/term, expired signed JWT, revoked Auth session and cross-class same-year active membership denied by actual service.');

 stage='bounded closure locks and negative catalog';
 await q("insert into rakeezx.scores(owner_id,id,revision,student_id,item_id,value) values($1,'lock-grade',1,'member-1','direct',5)",[A]);
 const lockResults=[];
 await repo.transaction(async(_db,p)=>{
  await readGuidanceCanonical(p,A,'class','term');
  const c=await pg.acquire();
  try {
   await c.query('set role postgres');
   for(const sql of ["update rakeezx.scores set value=6 where id='lock-grade'","update rakeezx.enrollments set status='inactive' where id='enrollment-1'","update rakeezx.score_subitems set revision=revision+1 where id='regular'","insert into rakeezx.logs(owner_id,id,revision,student_id,teaching_id,kind,delta) values('"+A+"','late-log',1,'member-1','teaching','participation',1)"]) {
    await c.query('begin');await c.query("set local lock_timeout='120ms'");
    await assert.rejects(()=>c.query(sql),e=>{lockResults.push(e.code);return e.code==='55P03';});await c.query('rollback');
   }
  }finally{c.release();}
 });
 assert.equal(lockResults.length,4);report.lockSQLStates=lockResults;
 // Exact identity/ACL/config verification is still mandatory, no wildcard trust.
 const c=await pg.acquire();
 try {
  const catalog=(await c.query(boundaryCatalogSql)).rows;
  const corrupted={query:async()=>({rows:catalog.map(r=>r.name==='boundary_guidance_sources_v1'?{...r,owner:'postgres'}:r)})};
  await assert.rejects(()=>assertVerifiedBoundary(corrupted),/n88_database_unavailable/);
  await assertVerifiedBoundary(c);await assert.rejects(()=>privateQuery(c,'select 1'),/n88_database_unavailable/);
 }finally{c.release();}
 pass('native_closure_lock_and_exact_catalog','Concurrent grade, enrollment and definition updates and a new child insert each blocked with 55P03 under the closure; transaction completes after writer rollback. Tampered helper owner and unregistered SQL are rejected.');

 stage='absence and late transaction fences';
 await q("update rakeezx.score_subitems set deleted_at=now(),revision=revision+1 where id='regular'");assert.deepEqual(await data(current),await data(old));
 const timed=composeService({...options,executionMode:'synthetic',syntheticGuidanceClosureEnabled:true,timing:{...options.timing,transactionMs:800,acquireMs:400,statementMs:600,lockMs:300}},adapter);
 delay=1200;const late=await call(timed);delay=0;assert.equal(late.status,503);await new Promise(r=>setTimeout(r,1400));assert(!trace.includes('commit'));
 await q("update rakeezx.terms set status='inactive',revision=revision+1 where id='term'");assert.equal((await call(current)).status,401);await q("update rakeezx.terms set status='active',revision=revision+1 where id='term'");
 const counts=(await q('select (select count(*)::int from n88_private.numeric_credentials) credentials,(select count(*)::int from n88_private.class_credential_receipts) receipts,(select count(*)::int from n88_private.task_guidance) guidance')).rows[0];assert.deepEqual(counts,{credentials:0,receipts:0,guidance:0});
 report.privateCounts=counts;
 pass('n88_guidance_unknown_issuance_not_replayed_and_only_affected_checks_no_live_ops','No issuance/rotate/revoke/guidance save invoked; native credential/receipt/guidance counts remain zero. Missing definition and inactive term fail closed; delayed native closure exceeds transaction budget, returns503, rolls back and cannot commit late. No UI/build/provider or real-data operation.');
 report.sourceSha256=Object.fromEntries(await Promise.all(['integrated-service.mjs','guidance-closure.inactive.sql','activation/private-error-boundary.mjs','activation/error-boundary-contract.json'].map(async n=>[n,createHash('sha256').update(await readFile('drafts/n88-student-portal/'+n)).digest('hex')])));
 report.status='PASS';
}catch(e){report.failure={stage,name:e.name,message:e.message.slice(0,1600)};process.exitCode=1;}
finally {
 try{await pg?.close();report.cleanup.ownedNativePgClosed=!!pg;}
 finally{if(owned)report.cleanup.integrationLease=lease('release');}
 await writeFile(dir+'/'+(report.failure?'failure-'+Date.now():'result')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
