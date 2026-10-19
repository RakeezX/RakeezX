/** AI: affected original composition on owned PostgreSQL, synthetic data only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {startNativePg} from './fixtures/n88-integrated-class/native-pg.mjs';
import {A,B,SESSION,authUrl,providerFixture} from './fixtures/n88-existing-host/provider.mjs';
import {composeService,createTeacherVerifier} from '../drafts/n88-student-portal/runtime.mjs';
import {createRolloutGuard} from '../drafts/n88-student-portal/rollout-guard.mjs';
import manifest from '../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
const taskId='continuous-n88-official-student-portal-activation-20261018',runId='78c0cde1-994b-441a-9ab5-3ffb68508b66';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',checks:[],hostedProof:false,renderedUiProof:false,cleanup:{}};
let pg,leased=false;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 // Existing helper predates the deployed typed boundary; complete ONLY this owned fixture.
 await q('set role postgres');await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));await q('reset role');
 await q('delete from n88_private.contexts'); // owned empty first-access fixture
 // Add one excluded same-owner member to prove synchronization is bounded.
 await q("insert into rakeezx.students(owner_id,id,name,status,revision) values($1,'excluded','Synthetic excluded','active',1)",[A]);
 await q("insert into rakeezx.enrollments(owner_id,id,student_id,section_id,status,revision,start_date) values($1,'excluded-enrollment','excluded','class','active',1,'2026-08-01')",[A]);
 const binding={ownerId:A,sessionId:SESSION,leaseId:'synthetic-pilot',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const pilotBinding={ownerId:A,classId:'class',teachingId:'teaching',studentIds:['student','other']};
 const policy=e=>createRolloutGuard(n=>e[n]);
 const pilot=policy({N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(pilotBinding)});
 const provider=providerFixture(),origin='https://synthetic.invalid';
 let auth='Bearer '+provider.token(),commitFault=false;
 const base={...manifest,origin,authUrl,apiKey:'SYNTHETIC',fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,
  numericKey:randomBytes(32),reservationKey:randomBytes(32),secretKey:randomBytes(32),ingressKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',
  acquire:async()=>{const c=await pg.acquire();return {release:e=>c.release(e),query:async(sql,args)=>{if(commitFault&&sql==='commit'){commitFault=false;throw Error('synthetic precommit failure');}try{return await c.query(sql,args);}catch(e){report.lastSyntheticQueryFailure={code:e.code,statement:sql.slice(0,160)};throw e;}}};}};
 const verifier=createTeacherVerifier(base),adapter={verifyIngress:async()=>({clientKey:'synthetic-pilot-source'}),verifyTeacher:async(r,p)=>{const a=await verifier(auth,AbortSignal.timeout(5000),p);report.lastAuthAccepted=a?.current===true;report.providerPaths=provider.calls;return a;}};
 const service=g=>composeService({...base,rollout:g,canonicalBounds:{rollout:g}},adapter);
 let handle=service(pilot);
 const teacher=(action,body={},b=binding)=>handle({path:'/teacher/class/'+action,method:'POST',headers:{origin,'x-n88-csrf':'1','content-type':'application/json'},body:{binding:b,teachingId:b.teachingId,...body}});
 const student=(action,body={},cookie='')=>handle({path:'/student/'+action,method:action==='read'?'GET':'POST',headers:{origin,'x-n88-csrf':'1','content-type':'application/json',cookie},body});
 const count=async table=>(await q('select count(*)::int as n from n88_private.'+table)).rows[0].n;
 const publicGuard=policy({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'});
 handle=service(policy({N88_ROLLOUT_MODE:'public'}));assert.equal((await teacher('list',{uiProtocol:'n88-public-ui-v1'})).status,401);assert.equal(await count('contexts'),0);
 handle=service(publicGuard);auth='Bearer '+provider.token({sub:B});assert.equal((await teacher('list',{uiProtocol:'n88-public-ui-v1'}, {...binding,ownerId:B})).status,401);assert.equal(await count('contexts'),0);
 auth='Bearer '+provider.token();assert.equal((await teacher('list',{uiProtocol:'n88-public-ui-v1'}, {...binding,classId:'wrong-source'})).status,401);assert.equal(await count('contexts'),0);
 const legacy=await teacher('list');assert.equal(legacy.status,200);assert.equal(legacy.body.rollout,'pilot');assert.equal(await count('contexts'),1);
 const current=await teacher('list',{uiProtocol:'n88-public-ui-v1'});assert.equal(current.status,200);assert.equal(current.body.rollout,'public');assert.equal(await count('contexts'),1);assert.deepEqual(current.body.data,legacy.body.data);
 const contexts=JSON.stringify((await q('select * from n88_private.contexts')).rows);assert.equal((await teacher('list',{uiProtocol:'unrecognized'})).status,401);assert.equal(JSON.stringify((await q('select * from n88_private.contexts')).rows),contexts);
 await q('update n88_private.contexts set active=false');assert.equal((await teacher('list',{uiProtocol:'n88-public-ui-v1'})).status,503);assert.equal((await q('select active from n88_private.contexts')).rows[0].active,false);assert.equal(await count('contexts'),1);
 assert.equal(await count('numeric_credentials'),0);assert.equal(await count('class_visibility'),0);
 report.checks=['actual typed PG repository/Auth/session/source entry','missing public proof and wrong owner/source deny before private context creation','first admitted public teacher list creates one private context with durable ACK','legacy and public UI list response protocols return same authorized roster','repeat list never duplicates context','unknown protocol denied without context mutation','existing inactive context never reactivated','no codes issued and no fields published'];report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message?.startsWith('Expected')?'assertion failed':String(e.message).slice(0,150),stack:e.stack?.split('\n').filter(s=>s.includes('pilot-service.mjs')).join('\n')};process.exitCode=1;}
finally{try{await pg?.close();report.cleanup.ownedNativePgClosed=true;}finally{if(leased)report.cleanup.lease=lease('release');}await writeFile('tests/n88-official-activation-public-entry-service.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
