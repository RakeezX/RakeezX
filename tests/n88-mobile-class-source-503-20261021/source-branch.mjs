/** AI: actual integrated service, SDK verifier, typed boundary and owned PG17.
 * Fabricated owners/rows only; never a hosted request or UI acceptance claim. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {startNativePg} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {A,B,SESSION,authUrl,providerFixture} from '../fixtures/n88-existing-host/provider.mjs';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
import manifest from '../../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
import boundary from '../../drafts/n88-student-portal/activation/error-boundary-contract.json' with {type:'json'};
const taskId='continuous-n88-mobile-class-source-503-20261021',runId='c7c4a888-7a84-4ca5-b5ce-58351c7b6dcb';
const root='C:/Users/Abody/Projects/RakeezX',dir='tests/n88-mobile-class-source-503-20261021/',red=process.argv.includes('--red-first'),native=process.argv.includes('--native');
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',redFirst:red,native,scope:'Actual local service/SDK/typed-boundary/PG17; fabricated only, no rendered UI or real-account proof',checks:[],cleanup:{}};
let pg,leased=false,operation='setup',hook=async()=>{},trace=[],lastResponse;
const sha=s=>createHash('sha256').update(s.replaceAll('\r\n','\n')).digest('hex');
try {
 report.sourceSha256=sha(await readFile('drafts/n88-student-portal/integrated-service.mjs','utf8'));
 // Reuse the established pinned SDK resolver, without installing dependencies or
 // altering the application package graph in this isolated worktree.
 const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const sdk=createRequire(root+'/.worktrees/continuous-n88-official-student-portal-activation-20261018/drafts/n88-student-portal/package.json').resolve('@supabase/auth-js');
 const nativeFile='drafts/n88-student-portal/activation/bundle/edge/index.mjs';
 const nativeText=native?(red?execFileSync('git',['show','9c658ade13bddc0289f3e2cf3a7769533280c2ae:'+nativeFile],{encoding:'utf8',maxBuffer:2097152}):await readFile(nativeFile,'utf8')):null;
 if(native)report.nativeSha256=sha(nativeText);
 const serveMarker='// supabase/functions/n88-student-portal/index.ts';
 if(native)assert.equal(nativeText.split(serveMarker).length,2);
 const built=await esbuild.build({...(native?{stdin:{contents:nativeText.slice(0,nativeText.indexOf(serveMarker))+'\nexport {composeService,createTeacherVerifier,readCanonical,createPostgresRepository,createCanonicalAdapter};',resolveDir:process.cwd(),sourcefile:'actual-native-without-listener.mjs'}}:{entryPoints:['drafts/n88-student-portal/runtime.mjs']}),bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'existing-pinned-sdk',setup(b){b.onResolve({filter:/^@supabase\/auth-js$/},()=>({path:sdk}));b.onResolve({filter:/^pg$/},()=>({path:pathToFileURL(require.resolve(root+'/artifacts/n77-native-pg17/client/node_modules/pg')).href,external:true}));}}]});
 const actual=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
 const {composeService,createTeacherVerifier}=actual;
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));await q('reset role');
 const provider=providerFixture(),origin='https://synthetic.invalid';let token=provider.token(),commitFault=false;
 const rollout=createRolloutGuard(n=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[n]);
 const options={...manifest,origin,authUrl,apiKey:'SYNTHETIC',fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,rollout,canonicalBounds:{rollout},
  numericKey:randomBytes(32),reservationKey:randomBytes(32),secretKey:randomBytes(32),ingressKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',
  acquire:async()=>{const c=await pg.acquire();return {release:e=>c.release(e),query:async(sql,args=[])=>{
   const op=boundary.operations.find(o=>sql.startsWith('select * from n88_private.'+o.name+'('));
   const source=op?.sql??sql;trace.push(source);
   if(commitFault&&sql==='commit'){commitFault=false;throw Error('synthetic_private_detail_must_not_escape');}
   const result=await c.query(sql,args);return await hook(source,result)??result;
  }};}};
 const verifier=createTeacherVerifier(options),handle=composeService(options,{verifyIngress:async()=>({clientKey:'fabricated-source'}),verifyTeacher:(r,p)=>verifier('Bearer '+token,AbortSignal.timeout(5000),p)});
 const binding={ownerId:A,sessionId:SESSION,leaseId:'synthetic-lease',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const call=async(action='list',extra={},b=binding)=>{trace=[];lastResponse=await handle({path:'/teacher/class/'+action,method:'POST',headers:{origin,'x-n88-csrf':'1','content-type':'application/json'},body:{binding:b,teachingId:b.teachingId,uiProtocol:'n88-public-ui-v1',...extra}});return lastResponse;};
 const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
 const privateFailure=(r,stage)=>{assert.equal(r.status,503);assert.deepEqual(r.body,{error:'unavailable',stage});assert.equal(r.headers['Cache-Control']??r.headers['cache-control'],'no-store, private');};
 operation='bounded baseline';assert.equal((await call()).status,200);assert.equal(lastResponse.body.data.students.length,2);
 const baseline=structuredClone(lastResponse.body.data);
 // Valid parent/child dependencies: every extra log references an existing owner,
 // teaching and student; canonical seven-family sources stay bounded.
 await q("insert into rakeezx.logs(owner_id,id,revision,student_id,teaching_id,kind,delta) select $1,'projection-only-'||n,1,'student','teaching','participation',1 from generate_series(1,2001) n",[A]);
 report.fabricatedProjectionRows=Number((await q('select count(*) as n from rakeezx.logs where owner_id=$1',[A])).rows[0].n);
 operation='projection-only overbound list';const large=await call();report.projectionOnlyResult={status:large.status,...(large.status===503?{body:large.body}:{students:large.body.data.students.length})};
 assert.equal(large.status,200,'bounded list must not fail for unrelated projection-only rows');assert.deepEqual(large.body.data,baseline);
 assert.equal(trace.filter(s=>s.includes('lock_canonical_sources')).length,3);assert(!trace.some(s=>s.includes('lock_projection_sources')));
 assert.equal(trace.filter(s=>s.includes('row_to_json(x)')&&s.includes('order by id limit')).length,2);
 assert.equal(trace.at(-1),'commit');check('projection-only overbound list','2003 valid logs; same roster/policy/recovery result as bounded baseline; resolver/read/synchronize canonical locks, terms/teachings only and durable COMMIT');
 operation='full projection overbound';
 for(const action of ['visibility','guidance-list']){privateFailure(await call(action),'source');assert(trace.some(s=>s.includes('lock_projection_sources')));assert(!trace.includes('commit'));}
 // Full student projection uses the same default read and must still fail closed.
 const {readCanonical}=native?actual:await import('../../drafts/n88-student-portal/integrated-service.mjs');
 const {createPostgresRepository}=native?actual:await import('../../drafts/n88-student-portal/postgres-repository.mjs');
 const {createCanonicalAdapter}=native?actual:await import('../../drafts/n88-student-portal/canonical-adapter.mjs');
 const repo=createPostgresRepository({...options,synchronize:createCanonicalAdapter({rollout})});
 await assert.rejects(repo.transaction(async(_db,p)=>{await p.query('select n88_private.lock_canonical_sources($1::uuid,$2::integer)',[A,2000]);return readCanonical(p,A);}));
 check('full projection guard retained','Visibility and guidance actual handlers return private source503; default student projection reader still invokes the actual projection lock and denies overbound');
 await q("delete from rakeezx.logs where id like 'projection-only-%'");
 operation='canonical overbound';await q("insert into rakeezx.items(owner_id,id,revision,name,teaching_id,max) select $1,'canonical-only-'||n,1,'Synthetic','teaching',10 from generate_series(1,2001) n",[A]);
 privateFailure(await call(),'source');assert(!trace.includes('commit'));check('canonical overbound','2007 items still deny in resolver canonical lock before list read; no cap raised');
 await q("delete from rakeezx.items where id like 'canonical-only-%'");
 operation='wrong owner/session and stale scope';
 assert.equal((await call('list',{}, {...binding,ownerId:B})).status,401);assert(!trace.some(s=>s.includes('lock_canonical_sources')));
 assert.equal((await call('list',{}, {...binding,sessionId:'22222222-2222-4222-8222-222222222222'})).status,401);
 assert.equal((await call('list',{}, {...binding,classId:'stale-class'})).status,401);
 assert.equal((await call('list',{}, {...binding,termId:'stale-term'})).status,401);
 await q("update rakeezx.terms set start_date='2999-01-01' where id='term'");assert.equal((await call()).status,401);
 await q("update rakeezx.terms set start_date='2026-08-01',end_date='2000-01-01' where id='term'");assert.equal((await call()).status,401);
 await q("update rakeezx.terms set end_date='2027-01-01' where id='term'");
 await q("update rakeezx.sections set status='inactive' where id='class'");assert.equal((await call()).status,401);await q("update rakeezx.sections set status='active' where id='class'");
 provider.denied=true;assert.equal((await call()).status,401);provider.denied=false;
 const savedSession=(await q('delete from auth.sessions where id=$1 returning *',[SESSION])).rows[0];assert.equal((await call()).status,401);
 await q('insert into auth.sessions(id,user_id,not_after) values($1,$2,$3)',[savedSession.id,savedSession.user_id,savedSession.not_after]);
 token=provider.token({exp:Math.floor(Date.now()/1000)-1});assert.equal((await call()).status,401);token=provider.token();
 check('owner Auth current session term/class fences','Wrong owner/session echo, stale term/class, future/expired term, inactive class, denied provider, absent current DB session and expired signed token deny');
 operation='canonical membership synchronization';await q("update rakeezx.enrollments set status='inactive',revision=revision+1 where id='enrollment'");
 assert.equal((await call()).body.data.students.length,1);await q("update rakeezx.enrollments set status='active',revision=revision+1 where id='enrollment'");assert.equal((await call()).body.data.students.length,2);
 await q("insert into rakeezx.enrollments(owner_id,id,student_id,section_id,status,revision,start_date) values($1,'ambiguous','student','class','active',1,'2026-08-01')",[A]);assert.equal((await call()).status,401);await q("delete from rakeezx.enrollments where id='ambiguous'");
 check('membership guards','Real canonical synchronizeOwner excludes inactive enrollment; re-read revision updates; ambiguous active enrollment denies');
 operation='concurrent source revision';let contested=false;
 hook=async(sql)=>{if(!contested&&sql.includes('from rakeezx.terms where owner_id')){contested=true;await q("set lock_timeout='120ms'");await assert.rejects(q("update rakeezx.teachings set revision=revision+1 where owner_id=$1 and id='teaching'",[A]),e=>e.code==='55P03');await q("set lock_timeout='0'");}};
 const locked=await call();assert.equal(locked.status,200);assert(contested);hook=async()=>{};
 await q("update rakeezx.teachings set revision=revision+1 where owner_id=$1 and id='teaching'",[A]);const revised=await call();assert.equal(revised.status,200);assert.notEqual(revised.body.data.rosterRevision,locked.body.data.rosterRevision);
 check('concurrent source revision','Independent PG writer cannot revise teaching while resolver/list transaction holds source locks; after COMMIT revision changes produce a different roster stamp');
 operation='code recovery';const roster=revised.body.data.rosterRevision;
 const issued=await call('issue-missing',{requestId:'fabricated_request_0001',expectedRosterRevision:roster});assert.equal(issued.status,200);assert.equal(issued.body.data.created.length,2);
 const recovered=await call();assert.equal(recovered.status,200);assert(recovered.body.data.students.every(s=>s.recoveryStatus==='recoverable'&&/^1[0-9]{5}$/.test(s.credential)));
 const recoveredCodes=recovered.body.data.students.map(s=>s.credential);
 operation='actual full student/visibility/guidance entries';
 const student=async(action,body={},cookie='')=>{trace=[];return handle({path:'/student/'+action,method:action==='read'?'GET':'POST',headers:{origin,'x-n88-csrf':'1','content-type':'application/json',cookie},body});};
 const claimed=await student('claim',{code:recoveredCodes[0]});assert.equal(claimed.status,200);
 const cookie=claimed.headers['Set-Cookie'].split(';')[0];assert.equal((await student('read',{},cookie)).status,200);assert(trace.some(s=>s.includes('lock_projection_sources')));
 assert.equal((await call('guidance-list')).status,200);assert(trace.some(s=>s.includes('lock_projection_sources')));
 const visibility={...recovered.body.data.visibility};
 const published=await call('visibility',{requestId:'fabricated_visibility_001',policyRevision:recovered.body.data.policyRevision,expectedRosterRevision:recovered.body.data.rosterRevision,fields:visibility});assert.equal(published.status,200);assert(trace.some(s=>s.includes('lock_projection_sources')));
 await q("insert into rakeezx.logs(owner_id,id,revision,student_id,teaching_id,kind,delta) select $1,'projection-only-'||n,1,'student','teaching','participation',1 from generate_series(1,2001) n",[A]);
 assert.deepEqual((await call()).body.data.students.map(s=>s.credential),recoveredCodes);
 const deniedStudent=await student('read',{},cookie);assert.equal(deniedStudent.status,401);assert.deepEqual(deniedStudent.body,{error:'unavailable'});assert(trace.some(s=>s.includes('lock_projection_sources')));assert(!trace.includes('commit'));
 await q("delete from rakeezx.logs where id like 'projection-only-%'");assert.equal((await student('read',{},cookie)).status,200);
 check('actual full projection entries','Cookie-backed actual student read, visibility save and guidance-list succeed when bounded and invoke full projection lock; student read with 2003 logs still privately denies and rolls back, then bounded fresh read succeeds');
 check('recovery retained','Actual issue-missing durable ACK then AEAD list recovery returns the same active codes with 2003 unrelated logs; credentials never recorded in report');
 operation='Auth beforeCommit and COMMIT ACK';let sessionChecks=0;
 const revision=async()=>Number((await q("select revision from n88_private.memberships where owner_id=$1 and enrollment_id='enrollment'",[A])).rows[0].revision);
 const beforeRevision=await revision();await q("update rakeezx.enrollments set revision=revision+1 where id='enrollment'");
 hook=async(sql,r)=>{if(sql.includes('lock_current_session')&&++sessionChecks===2)return {...r,rows:[]};};
 privateFailure(await call(),native?'projection-commitguards':'projection');assert(!trace.includes('commit'));assert.equal(await revision(),beforeRevision);hook=async()=>{};
 commitFault=true;privateFailure(await call(),native?'projection-commit':'projection');assert(trace.includes('rollback'));assert.equal(await revision(),beforeRevision);
 assert.equal((await call()).status,200);assert.equal(await revision(),beforeRevision+1);
 check('commit fences and truthful private failure','Actual SDK beforeCommit current-session failure prevents COMMIT; injected pre-COMMIT failure rolls back already-flushed membership revision; both keep original durable revision and expose only fixed private503; fresh committed list alone advances it');
 report.status='PASS';
} catch(e) {
 report.failure={operation,name:e.name,message:e.code??(operation==='setup'?e.message.slice(0,300):e.name==='AssertionError'?e.message.split('\n')[0]:'local fixture failure')};
 if(lastResponse?.status>=400)report.lastFailureResponse={status:lastResponse.status,body:lastResponse.body};
 process.exitCode=1;
} finally {
 try {await pg?.close();report.cleanup.ownedNativePgClosed=!!pg;}finally{if(leased)report.cleanup.integrationLease=lease('release');}
 await writeFile(dir+(native?'native-':'')+(red?'red-first.json':'source-branch.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
