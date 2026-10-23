/** AI-authored. Explicit fabricated PG qualification of the INACTIVE package.
 * Reuses the saved comparison; never connects to a provider or opens a browser.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {prepare,finish,dir,base,digest} from '../../drafts/n88-student-portal/activation/read-roundtrip-20261023/prepare.mjs';
import {startNativePg,canonicalRoot} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {createCanonicalAdapter} from '../../drafts/n88-student-portal/canonical-adapter.mjs';
import {createIntegratedService as legacyService} from '../../drafts/n88-student-portal/integrated-service.mjs';
import {projectStudentPortal,studentPortalPublicationBindings} from '../../drafts/n88-student-portal/student-projection.mjs';
const taskId='continuous-n88-read-roundtrip-outcome-20261023',runId='fbc57f79-e4dc-461c-bca6-912edcd6ba5a';
const out='tests/n88-read-roundtrip-outcome-20261023/staged-result.json';
const serviceOnly=process.argv.includes('--service-only');
const read=async f=>(await readFile(f,'utf8')).replaceAll('\r\n','\n');
const report={taskId,runId,status:'FAIL',checks:[],cleanup:{},timingComparison:'REUSED tests/n88-read-roundtrip-outcome-20261023/result.json; no new timing benchmark'};
if(serviceOnly){const prior=JSON.parse(await read('tests/n88-read-roundtrip-outcome-20261023/staged-native-entry-fixture-failure.json'));assert.equal(prior.checks.length,4);report.checks=prior.checks;report.reusedStagedChecks={path:'tests/n88-read-roundtrip-outcome-20261023/staged-native-entry-fixture-failure.json',sha256:digest(await read('tests/n88-read-roundtrip-outcome-20261023/staged-native-entry-fixture-failure.json')),reason:'Correct invalid fixture requestId/namespace; preserve completed boundary/repository/bounds checks; staged artifact hashes must match.'};}
const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds',action==='acquire'?'30':'0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:45000}).trim();
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',session='11111111-1111-4111-8111-111111111111';
const origin='https://synthetic.invalid',headers={origin,'x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin'};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let pg,leased=false,held,stage='prepare',failure;
const original=await prepare();
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await read('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql'));await q('reset role');
 assert.deepEqual((await q(original.catalog)).rows,original.identities);
 stage='install candidate only in fabricated PG';
 await q('set role postgres');await q(await read(dir+'additive-boundary.inactive.sql'));await q('reset role');
 const manifest=await finish(original,(await q(original.catalog)).rows);
 if(serviceOnly)assert.deepEqual(manifest.outputs,JSON.parse(await read('tests/n88-read-roundtrip-outcome-20261023/staged-prior-manifest.json')).outputs);
 assert.deepEqual(manifest.newOperations.map(o=>o.sql),original.operations.map(o=>o.sql));
 // Rerunning the exact candidate cannot replace functions or rewrite history.
 if(!serviceOnly){await q('set role postgres');const candidateSql=await read(dir+'additive-boundary.inactive.sql');
 await assert.rejects(()=>q(candidateSql),e=>e.message==='n88_roundtrip_preimage_unavailable');
 await q('rollback');await q('reset role');}
 const boundary=await import('../../'+dir+'private-error-boundary.mjs');
 const stagedReader=await import('../../'+dir+'integrated-service.mjs');
 const stagedRepo=await import('../../'+dir+'postgres-repository.mjs');
 if(!serviceOnly){
 assert.deepEqual((JSON.parse(await read(dir+'error-boundary-contract.json'))).operations.slice(0,original.original.operations.length),original.original.operations);
 assert.equal(await read(dir+'private-error-boundary.mjs'),await read(base+'activation/private-error-boundary.mjs'));
 assert.equal((await read(dir+'postgres-repository.mjs')).replace("from './private-error-boundary.mjs'","from './activation/private-error-boundary.mjs'").replace("from '../../web-protocol.mjs'","from './web-protocol.mjs'"),await read(base+'postgres-repository.mjs'));
 check('old_operations_and_guard_bytes_preserved',`${original.original.operations.length} exact old SQL/typed operations and all old catalog identities unchanged; two fixed INVOKER additions only; actual boundary and repository code unchanged apart from staged imports.`);
 held=await pg.acquire();await boundary.assertVerifiedBoundary(held);
 let calls=0;const observed={query:(...a)=>{calls++;return held.query(...a);}};await boundary.assertVerifiedBoundary(observed);const before=calls;
 for(const sql of ['select 1',original.operations[0].sql+' ',original.operations[1].sql+' --changed'])await assert.rejects(()=>boundary.privateQuery(observed,sql,[owner,2001,2097152]),/n88_database_unavailable/);
 assert.equal(calls,before);
 for(const values of [[owner,2002,2097152],[owner,2001,2097153],[null,2001,2097152],['invalid',2001,2097152]])await assert.rejects(()=>boundary.privateQuery(observed,original.operations[0].sql,values),e=>e.message==='n88_private_database_error'&&!(e.detail||e.hint));
 const newName=original.operations[0].name;
 await q('set role postgres');await q(`alter function n88_private.${newName}(text,text,text) set search_path=pg_catalog,public`);await q('reset role');
 await assert.rejects(()=>boundary.assertVerifiedBoundary(observed),/n88_database_unavailable/);
 const driftBefore=calls;await assert.rejects(()=>boundary.privateQuery(observed,original.operations[0].sql,[owner,2001,2097152]),/n88_database_unavailable/);assert.equal(calls,driftBefore);
 await q('set role postgres');await q(`alter function n88_private.${newName}(text,text,text) set search_path=pg_catalog`);await q('reset role');
 await boundary.assertVerifiedBoundary(observed);held.release();held=null;
 check('fixed_sql_catalog_drift_and_bound_parameter_rejections','Unknown/changed SQL blocked before driver; null owner, invalid UUID and changed bound parameters sanitized in fixed function; actual catalog drift invalidates verified capability, exact restoration required.');
 }
 const deployment=JSON.parse(await read(base+'deployment.inactive.json'));
 const rollout={mode:'public',allowsOwner:id=>id===owner||id===foreign,allowsMember:()=>true,admitsStudent:m=>!!m,admitsTeacher:()=>true};
 let commands=[],commitFault=null,cancelGate=null,backendPid;
 const acquire=async()=>{
  const inner=await pg.acquire();backendPid=(await inner.query('select pg_backend_pid() as pid')).rows[0].pid;
  return {query:async(sql,args)=>{
   commands.push(sql);if(cancelGate&&sql.includes('boundary_')&&sql.includes(original.original.operations.find(o=>o.sql.includes('lock_projection_sources')).name))cancelGate();
   if(sql==='commit'&&commitFault){const fault=commitFault;commitFault=null;if(fault==='unknown')await inner.query(sql,args);throw Error('synthetic commit fault');}
   return inner.query(sql,args);
  },release:error=>{commands.push(error?'release-broken':'release-clean');inner.release(error);}};
 };
 const options={...deployment,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin,authUrl:'https://auth.synthetic.invalid',apiKey:'fabricated',numericKey:randomBytes(32),reservationKey:randomBytes(32),secretKey:randomBytes(32),ingressKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',rollout,canonicalBounds:{rollout},acquire};
 const repository=stagedRepo.createPostgresRepository({...options,synchronize:createCanonicalAdapter({rollout})});
 if(!serviceOnly){
 stage='actual repository reader';
 commands=[];const canonical=await repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner));
 assert(commands.includes('begin isolation level read committed'));assert(commands.includes('commit'));assert.equal(commands.at(-1),'release-clean');
 assert.equal(commands.filter(s=>s.includes(original.operations[0].name)).length,1);
 const sparse=await repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,foreign));assert(Object.values(sparse).every(rows=>rows.length===0));
 const list=await repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner,true));assert.deepEqual(Object.keys(list),['terms','teachings']);
 for(const rows of Object.values(canonical))assert.deepEqual(rows.map(r=>r.id),rows.map(r=>r.id).sort());
 check('staged_reader_verified_repository_commit_ack','Full/admission batch dispatch through actual privateQuery, source locks, unchanged READ COMMITTED repository and acknowledged COMMIT; empty foreign owner arrays; deterministic order.');
 // Exercise the materially changed boundary, including cross-TABLE byte overflow.
 await q("update rakeezx.students set revision=9007199254740993,name='FRESH' where owner_id=$1 and id='student'",[owner]);
 const fresh=await repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner));assert.equal(fresh.students.find(s=>s.id==='student').revision,'9007199254740993');assert.equal(fresh.students.find(s=>s.id==='student').name,'FRESH');
 await q("update rakeezx.students set name=repeat('س',600000) where owner_id=$1 and id='student'",[owner]);
 await q("update rakeezx.items set name=repeat('س',600000) where owner_id=$1 and id='direct'",[owner]);
 await assert.rejects(()=>repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner)),/n88_repository_unavailable/);
 await q("update rakeezx.students set name='طالب مصطنع',revision=1 where owner_id=$1 and id='student'",[owner]);await q("update rakeezx.items set name='مباشر' where owner_id=$1 and id='direct'",[owner]);
 await q("insert into rakeezx.students(owner_id,id,revision,name,status) select $1,'bound-'||lpad(n::text,4,'0'),1,'مصطنع','active' from generate_series(1,1998) n",[owner]);
 assert.equal((await repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner))).students.length,2000);
 await q("insert into rakeezx.students(owner_id,id,revision,name,status) values($1,'bound-over',1,'مصطنع','active')",[owner]);
 await assert.rejects(()=>repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner)),/n88_repository_unavailable/);
 await q("delete from rakeezx.students where owner_id=$1 and id like 'bound-%'",[owner]);
 await assert.rejects(()=>stagedReader.readCanonical({query:async sql=>sql.includes('lock_')?{rows:[]}:{rows:[{table_index:0,payload:null}]}},owner),/n88_projection_bound/);
 check('new_boundary_bounds_freshness_and_cross_table_bytes','Native verified repository preserves exact bigint text/current data, 2000 accepted/2001 rejected; actual student+item UTF8 aggregate >2MB rejects via sentinel; explicit decoder null rejected. Original single-row overflow proof reused.');
 }
 stage='native artifact and application service';
 const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const native=await read(dir+'native63-candidate.inactive.mjs'),marker='// supabase/functions/n88-student-portal/index.ts';assert.equal(native.split(marker).length,2);
 // Source-exact native body, no listener. Unused provider adapters throw if
 // accidentally invoked; the actual service/repository use only owned PG.
 const built=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf(marker))+'\nexport {composeService,readCanonical,createPostgresRepository};',resolveDir:process.cwd(),sourcefile:'inactive-native63-without-listener.mjs'},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'no-provider-adapters',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},a=>({contents:a.path==='pg'?'export default {Pool:class {constructor(){throw Error("provider adapter forbidden");}}};':'export class AuthClient {constructor(){throw Error("provider adapter forbidden");}}',loader:'js'}));}}]});
 const nativeModule=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
 const adapter={verifyIngress:async()=>({clientKey:'fabricated'}),verifyTeacher:async()=>({ownerId:owner,sessionId:session,current:true})};
 const service=nativeModule.composeService(options,adapter),sourceService=stagedReader.createIntegratedService(options,adapter,repository),oldService=legacyService(options,adapter,repository);
 const binding={ownerId:owner,sessionId:session,leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const teacher=(action,extra={})=>service({path:'/teacher/class/'+action,method:'POST',headers,body:{binding,teachingId:'teaching',uiProtocol:'n88-public-ui-v1',...extra}});
 const student=(action,cookie='',body={},target=service)=>target({path:'/student/'+action,method:action==='read'?'GET':'POST',headers:{...headers,cookie},body});
 const roster=await teacher('list');assert.equal(roster.status,200);
 const issued=await teacher('issue-missing',{requestId:'synthetic-staged-issue-001',expectedRosterRevision:roster.body.data.rosterRevision});assert.equal(issued.status,200);
 const code=issued.body.data.created.find(s=>s.studentId==='student').credential;
 const publish=async fields=>{const r=await teacher('list');assert.equal(r.status,200);assert.equal((await teacher('visibility',{requestId:randomUUID(),policyRevision:r.body.data.policyRevision,expectedRosterRevision:r.body.data.rosterRevision,fields:fields??{name:true,class:true,grades:true,required:true,completed:true,scheduled:true}})).status,200);};
 await publish();let claim=await student('claim','',{code});assert.equal(claim.status,200);let cookie=claim.cookie.split(';')[0];
 const nativeReply=await student('read',cookie),sourceReply=await student('read',cookie,{},sourceService),oldReply=await student('read',cookie,{},oldService);
 assert.equal(nativeReply.status,200);assert(nativeReply.body.grades&&nativeReply.body.work);assert.deepEqual(nativeReply.body,sourceReply.body);assert.deepEqual(nativeReply.body,oldReply.body);
 const deny=async(name,c=cookie)=>{const r=await student('read',c);assert.equal(r.status,401,name);assert.deepEqual(r.body,{error:'unavailable'});return r;};
 await deny('missing cookie','');await deny('invalid cookie','__Secure-n88-student='+'X'.repeat(43));
 const otherToken='Y'.repeat(43),otherId=randomUUID(),otherSessionId=randomUUID();
 const sessionRow=(await q('select payload from n88_private.numeric_sessions')).rows.find(r=>r.payload.studentId==='student').payload;
 const credential=(await q('select payload from n88_private.numeric_credentials')).rows.find(r=>r.payload.studentId==='student').payload;
 await q("insert into n88_private.contexts(namespace,owner_id,active) values('n88_staged_foreign_owner_fixture',$1,true)",[foreign]);
 await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[otherId,JSON.stringify({...credential,id:otherId,ownerId:foreign,reservation:randomBytes(32).toString('hex')})]);
 await q('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)',[otherSessionId,JSON.stringify({...sessionRow,id:otherSessionId,credentialId:otherId,ownerId:foreign,tokenHash:digest(otherToken)})]);
 await deny('valid foreign-owner session cannot read first-owner sources','__Secure-n88-student='+otherToken);
 await publish({name:false,class:false,grades:false,required:false,completed:false,scheduled:false});const hidden=await student('read',cookie);assert.equal(hidden.status,200);assert(!hidden.body.profile&&!hidden.body.grades&&!hidden.body.work);await publish();
 await q("update rakeezx.enrollments set status='inactive',revision=revision+1 where owner_id=$1 and id='enrollment'",[owner]);await deny('membership retirement');
 await q("update rakeezx.enrollments set status='active',revision=revision+1 where owner_id=$1 and id='enrollment'",[owner]);await deny('restored membership cannot revive session');
 claim=await student('claim','',{code});assert.equal(claim.status,200);cookie=claim.cookie.split(';')[0];await publish();assert.equal((await student('read',cookie)).status,200);
 for(const fault of ['before','unknown']){commands=[];commitFault=fault;await deny('no success after '+fault+' COMMIT');assert.equal(commands.at(-1),'release-broken');}
 assert.equal((await student('read',cookie)).status,200);
 const member=(await teacher('list')).body.data.students.find(s=>s.studentId==='student');assert.equal((await teacher('revoke',{requestId:'staged-revoke-001',studentId:member.studentId,enrollmentId:member.enrollmentId,revision:member.revision,credentialVersion:member.credentialVersion})).status,200);await deny('revoked credential');
 check('native63_and_staged_source_actual_service_parity','Transformed native63 body + staged source + old reader on extended boundary produce equal validated projection. Actual list/issue/claim/visibility/revoke handlers, valid foreign credential/session parents, membership retirement/restore and unknown COMMIT deny preserve privacy. No browser/TLS/provider claim.');
 stage='late fences and cancellation';
 let retained;await repository.transaction(async(_db,ports)=>{retained=ports;return {ok:true};});const previousCalls=commands.length;await assert.rejects(()=>retained.query(original.operations[0].sql,[owner,2001,2097152]),/n88_repository_unavailable/);assert.equal(commands.length,previousCalls);
 let delayedDone;const completed=new Promise(resolve=>{delayedDone=resolve;});let lateDenied=false;
 const shortRepo=stagedRepo.createPostgresRepository({limits:options.limits,timing:{...options.timing,acquireMs:100,transactionMs:150,statementMs:100,lockMs:50},acquire});
 await assert.rejects(()=>shortRepo.transaction(async(_db,ports)=>{try{await pause(300);await ports.query(original.operations[0].sql,[owner,2001,2097152]);}catch{lateDenied=true;}finally{delayedDone();}return {mustNotReturn:true};}),/n88_repository_unavailable/);await completed;assert(lateDenied);
 // Hold an actual source row lock in the fixture's admin transaction, observe
 // the owned backend waiting, then cancel ONLY that backend's current query.
 await q('begin');await q("select id from rakeezx.students where owner_id=$1 for update",[owner]);
 let lockStarted;const started=new Promise(resolve=>{lockStarted=resolve;});cancelGate=lockStarted;
 commands=[];const pending=repository.transaction(async(_db,ports)=>stagedReader.readCanonical(ports,owner));const rejection=assert.rejects(()=>pending,/n88_repository_unavailable/);await started;cancelGate=null;
 let waiting=false;for(let i=0;i<30;i++){const state=(await q('select wait_event_type from pg_stat_activity where pid=$1',[backendPid])).rows[0];if(state?.wait_event_type==='Lock'){waiting=true;break;}await pause(10);}assert(waiting);
 assert.equal((await q('select pg_cancel_backend($1) as cancelled',[backendPid])).rows[0].cancelled,true);await rejection;await q('rollback');assert(!commands.includes('commit'));assert.equal(commands.at(-1),'release-broken');
 check('late_capability_timeout_and_actual_cancellation','Post-COMMIT retained port cannot query; delayed callback past test deadline cannot issue late SQL; actual source lock wait cancelled on owned backend returns no success/COMMIT and destroys connection. Production timing unchanged.');
 for(const [path,hash] of Object.entries(manifest.inputs))assert.equal(digest(await read(path)),hash,path+' unchanged');
 for(const [path,hash] of Object.entries(manifest.outputs))assert.equal(digest(await read(dir+path)),hash,path+' exact');
 const ownerCard=JSON.parse((await readFile(canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+manifest.originalCustodian.taskId+'.json','utf8')).replace(/^\uFEFF/,''));assert.equal(ownerCard.sessionId,manifest.originalCustodian.sessionId);
 report.manifestSha256=digest(await read(dir+'manifest.json'));report.nativeCandidateSha256=manifest.outputs['native63-candidate.inactive.mjs'];
 check('inactive_manifest_and_active_source_immutability','Exact recorded native63 receipt/source, source/SQL/identity/output hashes and public original custodian card/session bound; all active inputs and previous measurement bytes unchanged. No hosted operations.');
 report.status='PASS';report.localStatus='LOCAL_VALIDATED';report.externalBlocker='New additive service functions and native upload/pin/readback require separate exact sensitive authority and original custodian; zero live authority in this card.';
}catch(e){failure=e;report.failure={stage,name:e.name,message:e.message,code:e.code??null,stack:e.stack};}
finally{
 held?.release();if(pg){try{await pg.fixtureQuery('rollback');}catch{}await pg.close();report.cleanup.ownedNativePgStoppedAndRemoved=true;}
 if(leased)report.cleanup.integrationLease=lease('release');await writeFile(out,JSON.stringify(report,null,2)+'\n');
}
if(failure)throw failure;console.log('LOCAL_VALIDATED inactive typed integration; activation remains BLOCKED');
