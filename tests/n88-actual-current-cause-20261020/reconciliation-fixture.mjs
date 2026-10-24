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
async function requestForFixture(f,url,init){
 const body=JSON.parse(init.body);const r=url.endsWith('/list')?await f.ops.listClass(body.teachingId):await f.ops.issueMissingClassCodes(body.teachingId,body);
 let data;if(url.endsWith('/list'))data={classId:'class-a',rosterRevision:r.body.rosterRevision,policyRevision:0,credentialRevision:credentialStateRevision(f.snapshot(),f.snapshot().memberships),reconciliation:reconcileIssuanceReceipts(f.snapshot(),{ownerId:context.ownerId,classId:context.classId,teachingId:context.teachingId,current:true},f.snapshot().memberships,body.reconcile??[]),visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false])),students:r.body.students?.map(s=>({studentId:s.studentId,enrollmentId:s.enrollmentId,revision:s.revision,label:s.label,hasActiveCode:s.hasActiveCredential,credentialVersion:s.credentialVersion,recoveryStatus:s.hasActiveCredential?'legacy':'inactive',credential:null}))};
 else data={requestId:r.body.requestId,created:r.body.results?.filter(x=>x.status==='created').map(x=>({studentId:x.studentId,enrollmentId:x.enrollmentId,credentialVersion:x.credentialVersion,credential:r.body.secrets.find(y=>y.studentId===x.studentId).code})),skipped:r.body.results?.filter(x=>x.status==='skipped').map(x=>({studentId:x.studentId,reason:'existing'})),failed:r.body.results?.filter(x=>x.status==='failed').map(x=>({studentId:x.studentId,reason:'unavailable'})),uncertain:r.body.results?.some(x=>x.status==='uncertain')};
 return {ok:r.status===200,json:async()=>({ack:true,binding:body.binding,requestId:body.requestId??null,data})};
 }

export {prepare,requestForFixture,context};
