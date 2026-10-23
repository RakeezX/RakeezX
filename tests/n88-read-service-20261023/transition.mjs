/** AI: actual disposable PG17, exact dual guard/source/native and existing service paths. No provider. */
import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID} from 'node:crypto';
import {startNativePg,canonicalRoot} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {createCanonicalAdapter} from '../../drafts/n88-student-portal/canonical-adapter.mjs';
import * as boundary from '../../drafts/n88-student-portal/activation/read-service-20261023/private-error-boundary.mjs';
import * as source from '../../drafts/n88-student-portal/activation/read-service-20261023/integrated-service.mjs';
import {createPostgresRepository} from '../../drafts/n88-student-portal/activation/read-service-20261023/postgres-repository.mjs';
import {dir,hash} from '../../drafts/n88-student-portal/activation/read-service-20261023/prepare.mjs';
const task='continuous-n88-typed-read-service-activation-20261023',run='4575c6a7-2cb8-459e-a779-8de667c5fea2',out='tests/n88-read-service-20261023/transition.json';
const read=async p=>(await readFile(p,'utf8')).replaceAll('\r\n','\n');
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{windowsHide:true,encoding:'utf8',timeout:15000}).trim();
const report={taskId:task,runId:run,status:'FAIL',checks:[],providerOperations:0,realAccountReads:0,cleanup:{}};let pg,leased=false,held,failure,stage='prepare';
const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
try{
 await mkdir('tests/n88-read-service-20261023',{recursive:true});const manifest=JSON.parse(await read(dir+'manifest.json'));
 for(const [p,h]of Object.entries(manifest.outputs))assert.equal(hash(await read(dir+p)),h);
 for(const p of ['staged-result.json','compatibility.json','result.json']){const file='tests/n88-read-roundtrip-outcome-20261023/'+p;assert.equal(JSON.parse(await read(file)).status,'PASS');(report.reusedProofs??=[]).push({file,sha256:hash(await read(file))});}
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await read('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql'));await q('reset role');
 const oldIds=JSON.parse(await read(dir+'error-boundary-identities.json')),newIds=JSON.parse(await read(dir+'typed-identities.json')),ops=JSON.parse(await read(dir+'typed-read-operations.json'));
 assert.deepEqual((await q(boundary.boundaryCatalogSql)).rows,oldIds);
 const native=await read(dir+'native63-compatible.inactive.mjs'),marker='// supabase/functions/n88-student-portal/index.ts';assert.equal(native.split(marker).length,2);
 const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const build=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf(marker))+'\nexport {composeService,readCanonical,createPostgresRepository,assertVerifiedBoundary,verifiedBoundaryMode,privateQuery};',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'no-provider',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},a=>({contents:a.path==='pg'?'export default {Pool:class {constructor(){throw Error("provider forbidden");}}};':'export class AuthClient {constructor(){throw Error("provider forbidden");}}',loader:'js'}));}}]});
 const compiled=await import('data:text/javascript;base64,'+Buffer.from(build.outputFiles[0].contents).toString('base64'));
 stage='fixed catalogs and rollback';
 const ddl=await read('drafts/n88-student-portal/activation/read-roundtrip-20261023/additive-boundary.inactive.sql');assert.equal(hash(ddl),manifest.sql);
 const admin={query:q};
 for(const b of [boundary,compiled]){await b.assertVerifiedBoundary(admin);assert.equal(b.verifiedBoundaryMode(admin),'serial');await assert.rejects(()=>b.privateQuery(admin,ops[0].sql,['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2001,2097152]),/n88_database_unavailable/);}
 await q('set role postgres');await q(ddl.replace(/commit;\s*$/,'rollback;'));await q('reset role');assert.deepEqual((await q(boundary.boundaryCatalogSql)).rows,oldIds);
 const partial=ddl.slice(0,ddl.indexOf('create function n88_private.'+ops[1].name));
 await q('set role postgres');await q(partial);
 for(const b of [boundary,compiled]){await assert.rejects(()=>b.assertVerifiedBoundary(admin),/n88_database_unavailable/);assert.throws(()=>b.verifiedBoundaryMode(admin),/n88_database_unavailable/);}
 await q('rollback');await q('reset role');
 for(const b of [boundary,compiled]){await b.assertVerifiedBoundary(admin);assert.equal(b.verifiedBoundaryMode(admin),'serial');}
 check('fixed_76_78_and_aborted_partial_migration','Actual old76 accepted as serial, new calls rejected before dispatch. Aborted full migration restores old76; one-of-two mixed catalog denies and invalidates connection capability; rollback restores serial. No live rollback/drop.');
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',session='11111111-1111-4111-8111-111111111111';
 const deployment=JSON.parse(await read('drafts/n88-student-portal/deployment.inactive.json')),rollout={mode:'public',allowsOwner:id=>id===owner||id===foreign,allowsMember:()=>true,admitsStudent:m=>!!m,admitsTeacher:()=>true};
 let commands=[],commitFault=null;
 const acquire=async()=>{const c=await pg.acquire();return {query:async(sql,args)=>{commands.push(sql);if(sql==='commit'&&commitFault){const f=commitFault;commitFault=null;if(f==='unknown')await c.query(sql,args);throw Error('synthetic commit fault');}return c.query(sql,args);},release:e=>{commands.push(e?'release-broken':'release-clean');c.release(e);}};};
 const options={...deployment,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin:'https://synthetic.invalid',authUrl:'https://auth.synthetic.invalid',apiKey:'fabricated',numericKey:randomBytes(32),reservationKey:randomBytes(32),secretKey:randomBytes(32),ingressKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',rollout,canonicalBounds:{rollout},acquire};
 const repo=createPostgresRepository({...options,synchronize:createCanonicalAdapter({rollout})});
 const nativeRepo=compiled.createPostgresRepository({...options,synchronize:createCanonicalAdapter({rollout})});
 commands=[];const prior=await repo.transaction(async(_db,p)=>{assert.equal(p.canonicalReadMode(),'serial');return source.readCanonical(p,owner);});assert(!commands.some(s=>s.includes(ops[0].name)));
 assert.deepEqual(await nativeRepo.transaction((_db,p)=>compiled.readCanonical(p,owner)),prior);
 stage='old-catalog actual service';
 const adapter={verifyIngress:async()=>({clientKey:'fabricated'}),verifyTeacher:async()=>({ownerId:owner,sessionId:session,current:true})};
 const service=compiled.composeService(options,adapter),headers={origin:options.origin,'x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin'};
 const binding={ownerId:owner,sessionId:session,leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const teacher=(action,extra={})=>service({path:'/teacher/class/'+action,method:'POST',headers,body:{binding,teachingId:'teaching',uiProtocol:'n88-public-ui-v1',...extra}});
 const student=(action,cookie='',body={})=>service({path:'/student/'+action,method:action==='read'?'GET':'POST',headers:{...headers,cookie},body});
 const roster=await teacher('list');assert.equal(roster.status,200);
 const issued=await teacher('issue-missing',{requestId:'dual-serial-issue-001',expectedRosterRevision:roster.body.data.rosterRevision});assert.equal(issued.status,200);const code=issued.body.data.created.find(s=>s.studentId==='student').credential;
 const publish=async fields=>{const r=await teacher('list');assert.equal(r.status,200);assert.equal((await teacher('visibility',{requestId:randomUUID(),policyRevision:r.body.data.policyRevision,expectedRosterRevision:r.body.data.rosterRevision,fields})).status,200);};
 const visible={name:true,class:true,grades:true,required:true,completed:true,scheduled:true};await publish(visible);
 const claim=await student('claim','',{code});assert.equal(claim.status,200);const cookie=claim.cookie.split(';')[0],before=await student('read',cookie);assert.equal(before.status,200);assert(before.body.grades&&before.body.work);
 check('pre_addition_native_and_source_service_reads','Dual native uses old serial reader through actual verified PG repository; list, code issuance, claim and published grade/work read succeed in synthetic fixture.');
 stage='inflight transition and new catalog';let ready,release;const admitted=new Promise(ok=>ready=ok),gate=new Promise(ok=>release=ok);
 const inflight=nativeRepo.transaction(async(_db,p)=>{assert.equal(p.canonicalReadMode(),'serial');ready();await gate;assert.equal(p.canonicalReadMode(),'serial');return compiled.readCanonical(p,owner);});await admitted;
 await q('set role postgres');await q(ddl);await q('reset role');assert.deepEqual((await q(boundary.boundaryCatalogSql)).rows,newIds);release();assert.deepEqual(await inflight,prior);
 for(const b of [boundary,compiled]){await b.assertVerifiedBoundary(admin);assert.equal(b.verifiedBoundaryMode(admin),'batch');}
 commands=[];const after=await nativeRepo.transaction(async(_db,p)=>{assert.equal(p.canonicalReadMode(),'batch');return compiled.readCanonical(p,owner);});assert.deepEqual(after,prior);assert.equal(commands.filter(s=>s.includes(ops[0].name)).length,1);
 assert.deepEqual(await repo.transaction((_db,p)=>source.readCanonical(p,owner)),prior);
 const readAfter=await student('read',cookie);assert.equal(readAfter.status,200);assert.deepEqual(readAfter.body,before.body);
 check('per_connection_inflight_and_post_addition_read','Connection verified before DDL remains serial and COMMITs safely; newly verified connections use batch. Same pre-existing student cookie and exact grades/work survive transition; source/native results equal.');
 stage='drift and recovery';await q('set role postgres');await q('begin');await q('alter function n88_private.'+ops[0].name+'(text,text,text) set search_path=pg_catalog,public');
 for(const b of [boundary,compiled]){await assert.rejects(()=>b.assertVerifiedBoundary(admin),/n88_database_unavailable/);await assert.rejects(()=>b.privateQuery(admin,ops[0].sql,[owner,2001,2097152]),/n88_database_unavailable/);}
 await q('rollback');await q('reset role');
 for(const b of [boundary,compiled]){await b.assertVerifiedBoundary(admin);assert.equal(b.verifiedBoundaryMode(admin),'batch');}
 check('catalog_drift_no_fallback_and_recovery','Changed exact function config fails closed, invalidates capability and never falls back to serial; exact transaction rollback restores batch. All old identities remain unchanged.');
 for(const fault of ['before','unknown']){commands=[];commitFault=fault;assert.equal((await student('read',cookie)).status,401);assert.equal(commands.at(-1),'release-broken');}assert.equal((await student('read',cookie)).status,200);
 await publish(Object.fromEntries(Object.keys(visible).map(k=>[k,false])));const hidden=await student('read',cookie);assert.equal(hidden.status,200);assert(!hidden.body.profile&&!hidden.body.grades&&!hidden.body.work);await publish(visible);
 assert.equal((await student('read','')).status,401);assert.equal((await student('read','__Secure-n88-student='+'X'.repeat(43))).status,401);
  const member=(await teacher('list')).body.data.students.find(s=>s.studentId==='student');assert.equal((await teacher('revoke',{requestId:'dual-transition-revoke-001',studentId:member.studentId,enrollmentId:member.enrollmentId,revision:member.revision,credentialVersion:member.credentialVersion})).status,200);assert.equal((await student('read',cookie)).status,401);
 let retained;await repo.transaction(async(_db,p)=>{retained=p;});assert.throws(()=>retained.canonicalReadMode(),/n88_repository_unavailable/);await assert.rejects(()=>retained.query(ops[0].sql,[owner,2001,2097152]),/n88_repository_unavailable/);
 check('commit_ack_privacy_revocation_and_retired_mode','Failed/unknown COMMIT cannot disclose success and destroys connection. Hidden grade/work fields remain hidden; bad/missing cookie and revocation deny. Retained query and mode capabilities fail after transaction. Existing cancellation/bounds/foreign-owner proofs reused.');
 report.status='PASS';report.native=manifest.native;report.catalogFingerprints={serial:manifest.oldCatalogFingerprint,batch:manifest.newCatalogFingerprint};
}catch(e){failure=e;report.failure={stage,name:e.name,message:e.message};}
finally{held?.release();if(pg){try{await pg.fixtureQuery('rollback');}catch{}await pg.close();report.cleanup.ownedNativePgStoppedAndRemoved=true;}if(leased)report.cleanup.integrationLease=lease('release');await writeFile(out,JSON.stringify(report,null,2)+'\n');}
if(failure)throw failure;console.log(JSON.stringify(report));
