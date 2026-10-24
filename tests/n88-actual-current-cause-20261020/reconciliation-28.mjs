/** AI: actual pinned native operations + existing repository fixture + teacher client.
 * No live SQL, credentials, sockets or browser mutation. Not a full hosted/PG proof.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
import {credentialStateRevision,reconcileIssuanceReceipts} from '../../drafts/n88-student-portal/receipt-reconciliation.mjs';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const base='cbdfb4d8cd91f6e7588e0512b64f692935d2462d';
const native=await readFile('drafts/n88-student-portal/activation/denied-read-20261023/postdelivery-20261024/native74-reconciliation.inactive.mjs','utf8');
const built=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf('// supabase/functions/n88-student-portal/index.ts'))+'\nexport {createClassCredentialOperations,createNumericCredentialOperations,createRolloutGuard};',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent',plugins:[{name:'no-provider',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export class AuthClient{constructor(){throw Error("forbidden provider");}}',loader:'js'}));}}]});
const nativeUrl='data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64');
let fixtureSource=await readFile('tests/fixtures/n88-class-credentials/fixture.mjs','utf8');
fixtureSource=fixtureSource.replace(/import \{ createNumericCredentialOperations \}[^\n]+\nimport \{ createClassCredentialOperations \}[^\n]+/,`const {createNumericCredentialOperations,createClassCredentialOperations,createRolloutGuard}=await import(${JSON.stringify(nativeUrl)});`);
fixtureSource=fixtureSource.replaceAll('owner-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').replaceAll('owner-b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
fixtureSource=fixtureSource.replace('export function fixture',`const rollout=createRolloutGuard(n=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[n]);\nexport function fixture`).replace('({repository,verifyTeacher','({rollout,repository,verifyTeacher').replace('({keys:new Map','({rollout,keys:new Map');
fixtureSource=fixtureSource.replace('const ports={synchronizeOwner:', 'const ports={query:async()=>({rows:[]}),synchronizeOwner:');
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from(fixtureSource).toString('base64'));
function prepare(){const f=fixture();f.mutate(s=>{const m=s.memberships[0];s.memberships=Array.from({length:28},(_,i)=>({...m,studentId:'fabricated-'+i,enrollmentId:'enrollment-'+i,label:'Fabricated'}));});return f;}
const context={ownerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionId:'synthetic-current-session',leaseId:'synthetic',teachingId:'teaching-a',classId:'class-a',termId:'term',contextRevision:'1',enabled:true,validUntil:Date.now()+60000};
function teacherClient(f){return createClassPortalClient({getContext:()=>context,request:async(url,init)=>{
 const body=JSON.parse(init.body);const r=url.endsWith('/list')?await f.ops.listClass(body.teachingId):await f.ops.issueMissingClassCodes(body.teachingId,body);
 let data;if(url.endsWith('/list'))data={classId:'class-a',rosterRevision:r.body.rosterRevision,policyRevision:0,credentialRevision:credentialStateRevision(f.snapshot(),f.snapshot().memberships),reconciliation:reconcileIssuanceReceipts(f.snapshot(),{ownerId:context.ownerId,classId:context.classId,teachingId:context.teachingId,current:true},f.snapshot().memberships,body.reconcile??[]),visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false])),students:r.body.students?.map(s=>({studentId:s.studentId,enrollmentId:s.enrollmentId,revision:s.revision,label:s.label,hasActiveCode:s.hasActiveCredential,credentialVersion:s.credentialVersion,recoveryStatus:s.hasActiveCredential?'legacy':'inactive',credential:null}))};
 else data={requestId:r.body.requestId,created:r.body.results?.filter(x=>x.status==='created').map(x=>({studentId:x.studentId,enrollmentId:x.enrollmentId,credentialVersion:x.credentialVersion,credential:r.body.secrets.find(y=>y.studentId===x.studentId).code})),skipped:r.body.results?.filter(x=>x.status==='skipped').map(x=>({studentId:x.studentId,reason:'existing'})),failed:r.body.results?.filter(x=>x.status==='failed').map(x=>({studentId:x.studentId,reason:'unavailable'})),uncertain:r.body.results?.some(x=>x.status==='uncertain')};
 return {ok:r.status===200,json:async()=>({ack:true,binding:body.binding,requestId:body.requestId??null,data})};
 }});}
const outcomes=[];
let durableExample;
for(const mode of ['ack','rollback','lost-ack']){
 const f=prepare(),client=teacherClient(f),list=await client.listClass('teaching-a');assert.equal(list.students.length,28);
 if(mode==='rollback')f.failCommit();if(mode==='lost-ack')f.loseAck();
 const input={requestId:'synthetic-command-'+mode,expectedRosterRevision:list.rosterRevision};
 if(mode==='ack'){const result=await client.issueMissingClassCodes('teaching-a',input);assert.equal(result.created.length,28);}
 else await assert.rejects(()=>client.issueMissingClassCodes('teaching-a',input));
 const state=f.snapshot();assert.equal(state.numericCredentials.length,mode==='rollback'?0:28);assert.equal(state.classReceipts.length,mode==='rollback'?0:1);
 if(mode==='ack')durableExample=state;
 const reconciled=await client.listClass('teaching-a');if(mode==='lost-ack'){assert.equal(reconciled.reconciliation[0].state,'committed');assert.equal(reconciled.reconciliation[0].created,28);}if(mode==='rollback')assert.equal(reconciled.reconciliation[0].state,'unknown');assert.equal(reconciled.students.filter(s=>s.hasActiveCode).length,mode==='rollback'?0:28);
 const count=state.numericCredentials.length;f.authOwner='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const denied=await f.ops.issueMissingClassCodes('teaching-a',input);assert.equal(denied.status,401);assert.equal(f.snapshot().numericCredentials.length,count);
 outcomes.push({mode,clientOutcome:mode==='ack'?'ACK':'UNKNOWN',durableCredentials:count,durableReceipts:state.classReceipts.length,ownerDenial:true});
}
const scope={ownerId:context.ownerId,classId:context.classId,teachingId:context.teachingId,current:true};
const fresh=prepare(),revision=(await fresh.ops.listClass('teaching-a')).body.rosterRevision;
const cas={requestId:'fresh-cas-command-0001',expectedRosterRevision:revision,expectedCredentialRevision:credentialStateRevision(fresh.snapshot(),fresh.snapshot().memberships)};
fresh.mutate(s=>s.numericCredentials.push(structuredClone(durableExample.numericCredentials[0])));
assert.equal((await fresh.ops.issueMissingClassCodes('teaching-a',cas)).status,409);
assert.equal(fresh.snapshot().numericCredentials.length,1);assert.equal(fresh.snapshot().classReceipts.length,0);
const request={requestId:'synthetic-command-ack',expectedRosterRevision:revision,expectedCredentialRevision:credentialStateRevision(prepare().snapshot(),prepare().snapshot().memberships)};
assert.equal(reconcileIssuanceReceipts(durableExample,scope,durableExample.memberships,[request])[0].state,'committed');
for(const edit of [d=>d.classReceipts[0].ownerId='foreign',d=>d.classReceipts[0].results[0].studentId='foreign',d=>d.classReceipts[0].binding='f'.repeat(64)]){const d=structuredClone(durableExample);edit(d);assert.equal(reconcileIssuanceReceipts(d,scope,d.memberships,[request])[0].state,'unknown');}
assert.throws(()=>reconcileIssuanceReceipts(durableExample,{...scope,classId:'foreign'},durableExample.memberships,[request]));
assert.throws(()=>reconcileIssuanceReceipts(durableExample,scope,durableExample.memberships,Array(9).fill(request)));
assert.throws(()=>reconcileIssuanceReceipts(durableExample,scope,durableExample.memberships,[{...request,extra:'private'}]));
assert.deepEqual(Object.keys(reconcileIssuanceReceipts(durableExample,scope,durableExample.memberships,[request])[0]).sort(),['created','failed','skipped','state']);
await writeFile('tests/n88-actual-current-cause-20261020/reconciliation-28.json',JSON.stringify({aiAuthored:true,status:'PASS',nativeBaseline:base,teacherClientRevision:'changed actual source',students:28,outcomes,scope:'actual native credential operations and teacher client through existing fabricated repository; not full signed native/PG integration',liveAttemptsReplayed:0,providerOperations:0,actualPriorAttempts:'UNKNOWN'},null,2)+'\n');
console.log('PASS: current-version28 ACK, rollback, lostACK read-only receipt recovery and owner fence');
