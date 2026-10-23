/** AI: real disposable PG17; no hosted fixture, benchmark, browser or private custody. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {startNativePg,canonicalRoot} from '../fixtures/n88-integrated-class/native-pg.mjs';
const out='tests/n88-denied-read-20261023/session-recovery.json';
const task='continuous-n88-actual-denied-student-read-20261023',run='a6f80c84-cdb8-485e-ab3b-42c312d44abf';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const read=async p=>(await readFile(p,'utf8')).replaceAll('\r\n','\n');
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const plugins=[{name:'no-provider',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {}; export class AuthClient {constructor(){throw Error("provider forbidden");}}',loader:'js'}));}}];
const compile=async(stdin,entryPoints)=>{const b=await esbuild.build({...(stdin?{stdin:{contents:stdin,resolveDir:process.cwd()}}:{entryPoints}),bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));};
const native=await read('drafts/n88-student-portal/activation/denied-read-20261023/native66-successor.inactive.mjs');
const compiled=await compile(native.slice(0,native.indexOf('// supabase/functions/n88-student-portal/index.ts'))+'\nexport {composeService};');
const source=await compile(null,['drafts/n88-student-portal/runtime.mjs']);
const report={aiAuthored:true,status:'FAIL',checks:[],providerOperations:0,realAccountReads:0,cleanup:{}};
let pg,leased=false;
try {
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await read('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql'));
 await q(await read('drafts/n88-student-portal/activation/read-roundtrip-20261023/additive-boundary.inactive.sql'));await q('reset role');
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const rollout={mode:'public',allowsOwner:id=>id===owner,allowsMember:m=>m?.ownerId===owner,admitsStudent:m=>!!m&&m.ownerId===owner&&m.status==='active'&&m.endDate===null&&m.studentActive&&m.classActive,admitsTeacher:()=>true};
 let fault=null,broken=0;
 const acquire=async()=>{const c=await pg.acquire();return {query:async(sql,args)=>{
  if(fault==='projection'&&sql.includes('boundary_9e3f889e8b1e375a0a980496')){fault=null;throw Error('private projection fault');}
  if(sql==='commit'&&fault){const f=fault;fault=null;if(f==='unknown')await c.query(sql,args);throw Error('private commit fault');}
  return c.query(sql,args);
 },release:e=>{if(e)broken++;c.release(e);}};};
 const deployment=JSON.parse(await read('drafts/n88-student-portal/deployment.inactive.json'));
 const options={...deployment,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin:'https://synthetic.invalid',authUrl:'https://auth.synthetic.invalid',apiKey:'fabricated',secretKey:randomBytes(32),ingressKey:randomBytes(32),numericKey:randomBytes(32),reservationKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',rollout,canonicalBounds:{rollout},acquire};
 const adapter={verifyIngress:async()=>({clientKey:'fabricated'}),verifyTeacher:async()=>({ownerId:owner,sessionId:'11111111-1111-4111-8111-111111111111',current:true})};
 const binding={ownerId:owner,sessionId:'11111111-1111-4111-8111-111111111111',leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const headers={origin:options.origin,'x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin'};
 const service=compiled.composeService(options,adapter),other=source.composeService(options,adapter);
 const teacher=(action,extra={})=>service({path:'/teacher/class/'+action,method:'POST',headers,body:{binding,teachingId:'teaching',uiProtocol:'n88-public-ui-v1',...extra}});
 const student=(s,action,cookie='',body={})=>s({path:'/student/'+action,method:action==='read'?'GET':'POST',headers:{...headers,cookie},body});
 const roster=await teacher('list');assert.equal(roster.status,200);
 const issued=await teacher('issue-missing',{requestId:'denied-read-issue-001',expectedRosterRevision:roster.body.data.rosterRevision});assert.equal(issued.status,200);
 const code=issued.body.data.created.find(x=>x.studentId==='student').credential;
 const current=await teacher('list');assert.equal((await teacher('visibility',{requestId:randomUUID(),policyRevision:current.body.data.policyRevision,expectedRosterRevision:current.body.data.rosterRevision,fields:{name:true,class:true,grades:true,required:true,completed:true,scheduled:true}})).status,200);
 const claim=await student(service,'claim','',{code});assert.equal(claim.status,200);const cookie=claim.cookie.split(';')[0];
 assert.match(claim.cookie,/Path=\/api\/n88\/student; HttpOnly; Secure; SameSite=Strict/);
 const baseline=await student(service,'read',cookie);assert.equal(baseline.status,200);assert(baseline.body.grades&&baseline.body.work);
 for(const [name,s]of [['native',service],['source',other]]) {
  for(const mode of ['projection','before','unknown']) {
   fault=mode;const count=broken,r=await student(s,'read',cookie);assert.equal(fault,null);
   assert.equal(r.status,503);assert.deepEqual(r.body,{error:'unavailable'});assert.equal(r.cookie,undefined);assert.equal(r.headers['Set-Cookie'],undefined);assert(broken>count);
   const recovered=await student(s,'read',cookie);assert.equal(recovered.status,200);assert.deepEqual(recovered.body,baseline.body);
   report.checks.push(name+': '+mode+' failure503/no cookie or data; same cookie recovers exact grades/work');
  }
  for(const bad of ['', '__Secure-n88-student='+'X'.repeat(43)]){const r=await student(s,'read',bad);assert.equal(r.status,401);assert.match(r.cookie,/Max-Age=0/);}
 }
 const member=(await teacher('list')).body.data.students.find(x=>x.studentId==='student');
 assert.equal((await teacher('revoke',{requestId:'denied-read-revoke-001',studentId:member.studentId,enrollmentId:member.enrollmentId,revision:member.revision,credentialVersion:member.credentialVersion})).status,200);
 for(const s of [service,other])assert.equal((await student(s,'read',cookie)).status,401);
 report.checks.push('source/native missing, bad and revoked sessions still401; original membership/owner/SQL fences unchanged');
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;console.error(e.name+': '+e.message);}
finally{if(pg){await pg.close();report.cleanup.ownedPgStoppedAndRemoved=true;}if(leased)report.cleanup.integrationLease=lease('release');await writeFile(out,JSON.stringify(report,null,2)+'\n');}
