/** AI: existing PG17 lifecycle, real new native composition/client; synthetic rows only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
let lifecycle=await readFile('tests/fixtures/n88-integrated-class/native-pg.mjs','utf8');
lifecycle=lifecycle.replace("path.join(root,'tests/fixtures/n88-integrated-class'),phase=", "path.join(root,'tests/n88-actual-current-cause-20261020'),phase=").replaceAll("path.join(parent,'canonical-extension.sql')","path.join(root,'tests/fixtures/n88-integrated-class/canonical-extension.sql')").replaceAll("path.join(parent,'seed.sql')","path.join(root,'tests/fixtures/n88-integrated-class/seed.sql')");
lifecycle=lifecycle.replace("createRequire(import.meta.url)(canonicalRoot","createRequire(path.join(root,'package.json'))(canonicalRoot");
const {startNativePg}=await import('data:text/javascript;base64,'+Buffer.from(lifecycle).toString('base64'));
const native=await readFile('drafts/n88-student-portal/activation/denied-read-20261023/postdelivery-20261024/native74-reconciliation.inactive.mjs','utf8');
const built=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf('// supabase/functions/n88-student-portal/index.ts'))+'\nexport {composeService};',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[{name:'no-provider',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export class AuthClient{constructor(){throw Error("provider forbidden");}}',loader:'js'}));}}]});
const {composeService}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const report={aiAuthored:true,status:'FAIL',providerOperations:0,syntheticStudents:28,checks:[],cleanup:{}};
let pg;
try{
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));await q(execFileSync('git',['cat-file','blob','cbdfb4d8cd91f6e7588e0512b64f692935d2462d:drafts/n88-student-portal/activation/read-roundtrip-20261023/additive-boundary.inactive.sql'],{encoding:'utf8'}));await q('reset role');
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 for(let i=0;i<26;i++){await q('insert into rakeezx.students(id,owner_id,revision,name,status) values($1,$2,1,$3,$4)',['extra'+i,owner,'Fabricated','active']);await q('insert into rakeezx.enrollments(id,owner_id,revision,student_id,section_id,status,start_date) values($1,$2,1,$3,$4,$5,$6)',['extra-enrollment'+i,owner,'extra'+i,'class','active','2026-08-01']);}
 let fault=null,broken=0;
 const acquire=async()=>{const c=await pg.acquire();return {query:async(sql,args)=>{if(sql==='commit'&&fault){const mode=fault;fault=null;if(mode==='lost')await c.query(sql,args);throw Error('synthetic commit fault');}return c.query(sql,args);},release:e=>{if(e)broken++;c.release(e);}};};
 const rollout={mode:'public',allowsOwner:id=>id===owner,allowsMember:m=>m?.ownerId===owner,admitsStudent:m=>!!m&&m.ownerId===owner&&m.status==='active'&&m.endDate===null&&m.studentActive&&m.classActive,admitsTeacher:(auth,s)=>auth?.ownerId===owner&&s?.ownerId===owner};
 const deployment=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
 const options={...deployment,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin:'https://synthetic.invalid',authUrl:'https://auth.synthetic.invalid',apiKey:'fabricated',secretKey:randomBytes(32),ingressKey:randomBytes(32),numericKey:randomBytes(32),reservationKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',rollout,canonicalBounds:{rollout},acquire};
 const binding={ownerId:owner,sessionId:'11111111-1111-4111-8111-111111111111',leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const service=composeService(options,{verifyIngress:async()=>({clientKey:'fabricated'}),verifyTeacher:async()=>({ownerId:owner,sessionId:binding.sessionId,current:true})});
 const headers={origin:options.origin,'x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin'};
 const teacher=(action,body={})=>service({path:'/teacher/class/'+action,method:'POST',headers,body:{binding,teachingId:'teaching',uiProtocol:'n88-public-ui-v1',...body}});
 const context={...binding,enabled:true,validUntil:Date.now()+120000};
 const client=createClassPortalClient({getContext:()=>context,request:async(url,init)=>{const r=await teacher(url.split('/').pop(),JSON.parse(init.body));return {ok:r.status===200,json:async()=>{const {rollout,...ack}=r.body;return ack;}};}});
 const first=await client.listClass('teaching');assert.equal(first.students.length,28);assert.match(first.credentialRevision,/^[a-f0-9]{64}$/);
 fault='before';await assert.rejects(()=>client.issueMissingClassCodes('teaching',{requestId:'pg-rollback-command-001',expectedRosterRevision:first.rosterRevision}));
 let list=await client.listClass('teaching');assert.equal(list.students.filter(s=>s.hasActiveCode).length,0);assert.equal(list.reconciliation[0].state,'unknown');
 fault='lost';await assert.rejects(()=>client.issueMissingClassCodes('teaching',{requestId:'pg-lost-ack-command-001',expectedRosterRevision:list.rosterRevision}));
 list=await client.listClass('teaching');assert.equal(list.students.filter(s=>s.hasActiveCode).length,28);assert(list.reconciliation.some(x=>x.state==='committed'&&x.created===28));
 const count=Number((await q('select count(*) from n88_private.numeric_credentials')).rows[0].count);assert.equal(count,28);
 const stale=await teacher('issue-missing',{requestId:'pg-stale-command-0001',expectedRosterRevision:first.rosterRevision,expectedCredentialRevision:first.credentialRevision});assert.equal(stale.status,409);
 const fresh=await client.issueMissingClassCodes('teaching',{requestId:'pg-fresh-intent-command-001',expectedRosterRevision:list.rosterRevision});assert.equal(fresh.created.length,0);assert.equal(fresh.skipped.length,28);
 assert.equal(Number((await q('select count(*) from n88_private.numeric_credentials')).rows[0].count),28);assert(broken>=2);
 const foreign=await service({path:'/teacher/class/list',method:'POST',headers,body:{binding:{...binding,ownerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},teachingId:'teaching',reconciliationVersion:1,reconcile:[]}});assert.equal(foreign.status,401);
 report.status='PASS';report.checks=['real PG17 exact78 native list/reconciliation on28 pupils','rollback0 credentials; durable lostCOMMIT ACK28 credentials and committed receipt recovered through guarded list','stale credential CAS409; fresh current intent skips28 active credentials without regeneration','foreign owner rejected; broken connections released'];
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;console.error(e.name+': '+e.message);}
finally{if(pg){await pg.close();report.cleanup.ownedPgStoppedAndRemoved=true;}await writeFile('tests/n88-actual-current-cause-20261020/reconciliation-pg.json',JSON.stringify(report,null,2)+'\n');}
