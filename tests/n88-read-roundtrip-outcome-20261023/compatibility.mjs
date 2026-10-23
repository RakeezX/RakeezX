/** AI-authored. New wire-compatibility scenario only; no benchmark/UI/provider. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {startNativePg,canonicalRoot} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {dir,base,digest} from '../../drafts/n88-student-portal/activation/read-roundtrip-20261023/prepare.mjs';
import * as oldBoundary from '../../drafts/n88-student-portal/activation/private-error-boundary.mjs';
import * as stagedBoundary from '../../drafts/n88-student-portal/activation/read-roundtrip-20261023/private-error-boundary.mjs';
import contract from '../../drafts/n88-student-portal/activation/read-roundtrip-20261023/error-boundary-contract.json' with {type:'json'};
import identities from '../../drafts/n88-student-portal/activation/read-roundtrip-20261023/error-boundary-identities.json' with {type:'json'};
import {createCloudflareEntry} from '../../drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
const taskId='continuous-n88-read-roundtrip-outcome-20261023',runId='fbc57f79-e4dc-461c-bca6-912edcd6ba5a',out='tests/n88-read-roundtrip-outcome-20261023/compatibility.json';
const read=async f=>(await readFile(f,'utf8')).replaceAll('\r\n','\n');
const manifest=JSON.parse(await read(dir+'manifest.json'));
const report={taskId,runId,status:'FAIL',checks:[],manifestSha256:digest(await read(dir+'manifest.json')),cleanup:{}};
const wireOnly=process.argv.includes('--wire-only');
if(wireOnly){const file='tests/n88-read-roundtrip-outcome-20261023/compatibility-initial-client-assertion-failure.json',prior=JSON.parse(await read(file));assert.equal(prior.manifestSha256,report.manifestSha256);assert.equal(prior.checks.length,2);report.checks=prior.checks;report.reusedChecks={path:file,sha256:digest(await read(file)),reason:'Correct client assertion to actual getDiagnostic API; reuse finite dispatch and old/new native catalog checks.'};}
const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds',action==='acquire'?'30':'0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:45000}).trim();
let pg,held,leased=false,failure,stage='source verification';
try{
 for(const [f,hash] of Object.entries(manifest.outputs))assert.equal(digest(await read(dir+f)),hash);
 for(const [f,hash] of Object.entries(manifest.inputs))assert.equal(digest(await read(f)),hash);
 // Exhaustive finite-dispatch compatibility check, WITHOUT executing old effects.
 // Actual catalog identities/routine bodies are proven in staged-result.json.
 if(!wireOnly){let dispatched;const dispatcher={query:async(sql,values)=>{
  if(sql===stagedBoundary.boundaryCatalogSql)return {rows:identities};
  dispatched={sql,values};return {rows:[{affected:'0'}]};
 }};await stagedBoundary.assertVerifiedBoundary(dispatcher);
 for(const op of contract.operations.slice(0,manifest.oldOperationCount)){
  dispatched=null;await stagedBoundary.privateQuery(dispatcher,op.sql,op.parameters.map(()=>null));assert(dispatched);assert(dispatched.sql.startsWith('select * from n88_private.'+op.name+'('));assert.equal(dispatched.values.length,op.parameters.length);
 }
 check('all_76_old_operations_finite_dispatch_accepted','Every unchanged SQL entry maps to its unchanged fixed typed function. Dispatcher-only test does not execute side effects; exact native catalog/body/ACL preservation is separately proven.');
 }
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await read('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql'));await q('reset role');
 if(!wireOnly){held=await pg.acquire();await oldBoundary.assertVerifiedBoundary(held);held.release();held=null;}
 await q('set role postgres');await q(await read(dir+'additive-boundary.inactive.sql'));await q('reset role');
 if(!wireOnly){held=await pg.acquire();await assert.rejects(()=>oldBoundary.assertVerifiedBoundary(held),/n88_database_unavailable/);await stagedBoundary.assertVerifiedBoundary(held);held.release();held=null;
 check('old_native_catalog_cutover_requires_coordination','Actual old boundary accepts preimage but fails closed after additive functions; staged boundary accepts new catalog. No seamless rolling coexistence claim; original custodian needs explicit coordinated cutover authority.');
 }
 stage='signed web entry and unchanged carrier/client';
 const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const sdk=createRequire(canonicalRoot+'/.worktrees/continuous-n88-official-student-portal-activation-20261018/drafts/n88-student-portal/package.json').resolve('@supabase/auth-js');
 const source=await read(dir+'native63-candidate.inactive.mjs'),marker='// supabase/functions/n88-student-portal/index.ts';
 const built=await esbuild.build({stdin:{contents:source.slice(0,source.indexOf(marker))+'\nexport {composeService,createWebEntry};',resolveDir:process.cwd(),sourcefile:'inactive-native63-wire-without-listener.mjs'},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'installed-sdk-no-provider-pool',setup(b){b.onResolve({filter:/^pg$/},()=>({path:'pg',namespace:'forbidden'}));b.onLoad({filter:/.*/,namespace:'forbidden'},()=>({contents:'export default {Pool:class {constructor(){throw Error("provider pool forbidden");}}};',loader:'js'}));b.onResolve({filter:/^@supabase\/auth-js$/},()=>({path:sdk}));}}]});
 const actual=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session='11111111-1111-4111-8111-111111111111',origin='https://synthetic.invalid',authUrl='https://auth.synthetic.invalid';
 const rollout={mode:'public',allowsOwner:()=>true,allowsMember:()=>true,admitsStudent:m=>!!m,admitsTeacher:()=>true};
 const opts={...JSON.parse(await read(base+'deployment.inactive.json')),sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin,authUrl,apiKey:'fabricated',numericKey:randomBytes(32),reservationKey:randomBytes(32),secretKey:randomBytes(32),ingressKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',rollout,canonicalBounds:{rollout},acquire:()=>pg.acquire(),fetch:async()=>{throw Error('provider request forbidden');}};
 const setup=actual.composeService(opts,{verifyIngress:async()=>({clientKey:'fabricated'}),verifyTeacher:async()=>({ownerId:owner,sessionId:session,current:true})});
 const binding={ownerId:owner,sessionId:session,leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const headers={origin,'x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin'};
 const teacher=(action,extra={})=>setup({path:'/teacher/class/'+action,method:'POST',headers,body:{binding,teachingId:'teaching',uiProtocol:'n88-public-ui-v1',...extra}});
 const roster=await teacher('list');assert.equal(roster.status,200);const issued=await teacher('issue-missing',{requestId:'synthetic-wire-issue-001',expectedRosterRevision:roster.body.data.rosterRevision});assert.equal(issued.status,200);
 const code=issued.body.data.created.find(s=>s.studentId==='student').credential;const current=await teacher('list');
 assert.equal((await teacher('visibility',{requestId:'synthetic-wire-visibility',policyRevision:current.body.data.policyRevision,expectedRosterRevision:current.body.data.rosterRevision,fields:{name:true,class:true,grades:true,required:true,completed:true,scheduled:true}})).status,200);
 const web=actual.createWebEntry(opts);let wireCalls=0;
 const carrier=createCloudflareEntry({fetch:async(url,init)=>{wireCalls++;return web(new Request(url,init));}});
 const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:opts.ingressKey.toString('hex')};
 let cookie='';
 const call=async(path,init={})=>{const request=new Request(origin+path,{...init,headers:{...headers,cookie,'cf-connecting-ip':'192.0.2.1',...init.headers}});request.cf={tlsVersion:'TLSv1.3'};return carrier(request,env);};
 const claim=await call('/api/n88/student/claim',{method:'POST',body:JSON.stringify({code})});assert.equal(claim.status,200);cookie=claim.headers.get('set-cookie').split(';')[0];
 const reply=await call('/api/n88/student/read');assert.equal(reply.status,200);assert.match(reply.headers.get('cache-control'),/no-store/);const projection=await reply.json();assert(projection.grades&&projection.work);
 const client=createUnifiedStudentPortalClient({fetch:call});const result=await client.read();assert.deepEqual(result,projection);assert(client.getDiagnostic().readPhases);assert.equal(wireCalls,3);client.dispose();
 const missing=await carrier(Object.assign(new Request(origin+'/api/n88/student/read',{headers:{...headers,'cf-connecting-ip':'192.0.2.1'}}),{cf:{tlsVersion:'TLSv1.3'}}),env);assert.equal(missing.status,401);
 report.localCarrierSha256=digest(await read(base+'activation/bundle/cloudflare/worker.mjs'));report.nativeCandidateSha256=manifest.outputs['native63-candidate.inactive.mjs'];
 check('actual_signed_native_carrier_client_projection_compatibility','Candidate native Web Request signature/nonce/ingress -> actual verified repository -> unchanged local carrier -> actual client succeeds with private validated projection and finite phases; missing cookie denies. All fetches injected in-process, no real network or TLS/browser claim.');
 report.status='PASS';report.localStatus='LOCAL_VALIDATED';
}catch(e){failure=e;report.failure={stage,name:e.name,message:e.message,code:e.code??null,stack:e.stack?.replace(/data:text\/javascript;base64,[^\s)]+/g,'<inactive-native>')};}
finally{held?.release();if(pg){await pg.close();report.cleanup.ownedNativePgStoppedAndRemoved=true;}if(leased)report.cleanup.integrationLease=lease('release');await writeFile(out,JSON.stringify(report,null,2)+'\n');}
if(failure)throw failure;
