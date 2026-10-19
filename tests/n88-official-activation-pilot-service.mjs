/** AI: affected original composition on owned PostgreSQL, synthetic data only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {startNativePg} from './fixtures/n88-integrated-class/native-pg.mjs';
import {A,B,SESSION,authUrl,providerFixture} from './fixtures/n88-existing-host/provider.mjs';
import {composeService,createTeacherVerifier} from '../drafts/n88-student-portal/runtime.mjs';
import {createRolloutGuard} from '../drafts/n88-student-portal/rollout-guard.mjs';
import manifest from '../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
const taskId='continuous-n88-official-student-portal-activation-20261018',runId='3576957c-1cf3-455d-8d62-150b1934b728';
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
 for(const env of [{},{N88_ROLLOUT_MODE:'invalid'},{N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:'{'}]){handle=service(policy(env));assert.equal((await teacher('list')).status,401);assert.equal(await count('memberships'),0);}
 handle=service(pilot);auth='Bearer '+provider.token({sub:B});assert.equal((await teacher('list',{}, {...binding,ownerId:B})).status,401);assert.equal(await count('memberships'),0);
 auth='Bearer '+provider.token();assert.equal((await teacher('list',{}, {...binding,classId:'wrong-source'})).status,401);assert.equal(await count('memberships'),0);
 let listed=await teacher('list');assert.equal(listed.status,200,'pilot actual list status '+listed.status);assert.equal(listed.body.rollout,'pilot');assert.equal(listed.body.data.students.length,2);assert.equal(await count('memberships'),2);
 const beforeExcluded=JSON.stringify((await q("select * from n88_private.memberships where student_id='excluded'")).rows);
 // Exact original current Auth session guard remains authoritative.
 await q("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[SESSION]);assert.equal((await teacher('list')).status,401);await q('update auth.sessions set not_after=null where id=$1',[SESSION]);
 assert.equal((await teacher('rotate',{requestId:'synthetic-pilot-excluded',studentId:'excluded',enrollmentId:'excluded-enrollment',revision:1,credentialVersion:0})).status,409);
 commitFault=true;assert.equal((await teacher('issue-missing',{requestId:'synthetic-pilot-failed-ack',expectedRosterRevision:listed.body.data.rosterRevision})).status,503);assert.equal(await count('numeric_credentials'),0);
 listed=await teacher('list');const issued=await teacher('issue-missing',{requestId:'synthetic-pilot-create-two',expectedRosterRevision:listed.body.data.rosterRevision});assert.equal(issued.status,200);assert.equal(issued.body.data.created.length,2);assert.equal(await count('numeric_credentials'),2);
 const recovered=await teacher('list');assert.deepEqual(recovered.body.data.students.map(s=>s.credential).sort(),issued.body.data.created.map(s=>s.credential).sort());
 const first=issued.body.data.created[0],claim=await student('claim',{code:first.credential});assert.equal(claim.status,200);const cookie=claim.headers['Set-Cookie'].split(';')[0];assert.equal((await student('read',{},cookie)).status,200);
 // Same existing credential/session becomes unavailable outside its pilot binding.
 handle=service(policy({N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify({...pilotBinding,studentIds:[...pilotBinding.studentIds.filter(id=>id!==first.studentId),'excluded']})}));
 assert.equal((await student('read',{},cookie)).status,401);assert.equal((await student('claim',{code:first.credential})).status,401);
 handle=service(pilot);await q("update rakeezx.enrollments set revision=revision+1 where owner_id=$1 and student_id=$2",[A,first.studentId]);assert.equal((await student('read',{},cookie)).status,401);
 assert.equal(JSON.stringify((await q("select * from n88_private.memberships where student_id='excluded'")).rows),beforeExcluded);
 assert.equal((await q("select count(*)::int as n from n88_private.publications where student_id='excluded'")).rows[0].n,0);
 report.checks=['actual Auth/session/source entry retained','missing/invalid mode denies before synchronization','wrong owner/source denies without private synchronization','same-owner excluded pupil omitted from synchronization and batch','only two credentials with durable ACK and recoverable current codes','precommit failure discloses no credential and rolls back','student claim/read pilot admission and changed-binding rejection','original source revision rejects stale student session'];report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message?.startsWith('Expected')?'assertion failed':String(e.message).slice(0,150),stack:e.stack?.split('\n').filter(s=>s.includes('pilot-service.mjs')).join('\n')};process.exitCode=1;}
finally{try{await pg?.close();report.cleanup.ownedNativePgClosed=true;}finally{if(leased)report.cleanup.lease=lease('release');}await writeFile('tests/n88-official-activation-pilot-service.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
