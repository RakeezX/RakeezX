/** AI: characterize the receipt-bound native GET with fabricated local PG17 data.
 * The Pool port fabricates transport attestations; this is NOT hosted TLS/pool proof.
 * No Product source, credentials, service config or provider operation is changed.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {startNativePg} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {A,SESSION,authUrl} from '../fixtures/n88-existing-host/provider.mjs';
import boundary from '../../drafts/n88-student-portal/activation/error-boundary-contract.json' with {type:'json'};
import {FORWARDED,encodeBytes,sha,mac,signingText} from '../../drafts/n88-student-portal/web-protocol.mjs';

const taskId='continuous-n88-student-read-phase-latency-20261021',runId='5f1e5bac-172f-4c84-a95e-81370ee532dd';
const root='C:/Users/Abody/Projects/RakeezX',dir='tests/n88-student-read-phase-latency-20261021/';
const nativeFile='drafts/n88-student-portal/activation/bundle/edge/index.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',scope:'Receipt-bound native host -> signed Web Request -> service -> typed boundary -> fabricated local PG17 -> acknowledged reply. Synthetic Pool/TLS attestations, not real network latency.',runs:[],guards:[],cleanup:{}};
let pg,host,leased=false,operation='setup',events=[],delayPhase=null,delayMs=0,delayUsed=false,commitFault=null;
const port=Symbol.for('n88-student-phase-local-pool');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function measured(phase,action){
 const start=performance.now();
 try {if(delayPhase===phase&&!delayUsed){delayUsed=true;await sleep(delayMs);}return await action();}
 finally{events.push({phase,ms:performance.now()-start});}
}
function classify(sql){
 if(sql.startsWith('select session_user')||sql.startsWith('select current_user as role,')||sql.includes('pg_get_functiondef'))return 'transportBoundary';
 const source=boundary.operations.find(o=>sql.startsWith('select * from n88_private.'+o.name+'('))?.sql??sql;
 if(source==='commit')return 'commit';
 if(source==='rollback')return 'rollback';
 if(source.includes('consume_ingress'))return 'ingress';
 if(source.includes('task_guidance'))return 'guidance';
 if(source.includes('class_visibility'))return 'visibility';
 if(source.includes('lock_projection_sources')||source.includes('order by id limit'))return 'projectionRead';
 if(source.includes('lock_canonical_sources')||source.includes('from rakeezx.enrollments e join')||source.includes('from rakeezx.items i join'))return 'synchronize';
 if(source.startsWith('select')&&source.includes('from n88_private.'))return 'snapshot';
 if(source.startsWith('begin')||source.startsWith('select set_config')||source.includes('pg_advisory_xact_lock'))return 'begin';
 return 'flushOrOther';
}
try{
 const source=await readFile(nativeFile,'utf8'),receipt=JSON.parse(await readFile('tests/n88-mobile-class-source-503-20261021/native-complete.json','utf8'));
 assert.equal(digest(source.replaceAll('\r\n','\n')),receipt.source);assert.equal(receipt.status,'PASS');assert.equal(receipt.sourceExact,true);assert.equal(receipt.publicPinMatches,true);
 report.source={baseSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),nativeSha256:receipt.source,version:receipt.nativeVersion,receipt:'tests/n88-mobile-class-source-503-20261021/native-complete.json',receiptSha256:digest(await readFile('tests/n88-mobile-class-source-503-20261021/native-complete.json'))};
 const marker='// supabase/functions/n88-student-portal/index.ts';assert.equal(source.split(marker).length,2);
 const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const sdk=createRequire(root+'/.worktrees/continuous-n88-official-student-portal-activation-20261018/drafts/n88-student-portal/package.json').resolve('@supabase/auth-js');
 const built=await esbuild.build({stdin:{contents:source.slice(0,source.indexOf(marker))+'\nexport {createExistingHost,composeService,deployment_inactive_default};',resolveDir:process.cwd(),sourcefile:'receipt-bound-native-without-listener.mjs'},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'fabricated-pool-only',setup(b){b.onResolve({filter:/^pg$/},()=>({path:'pool',namespace:'fabricated'}));b.onLoad({filter:/.*/,namespace:'fabricated'},()=>({contents:'export default {Pool:globalThis[Symbol.for("n88-student-phase-local-pool")]};',loader:'js'}));b.onResolve({filter:/^@supabase\/auth-js$/},()=>({path:sdk}));}}]});
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 pg=await startNativePg(process.cwd());const q=pg.fixtureQuery;
 await q('set role postgres');await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));await q('reset role');
 let badTransport=false;
 globalThis[port]=class {
  constructor(config){assert.equal(config.max,2);assert.equal(config.connectionTimeoutMillis,5000);assert.equal(config.idleTimeoutMillis,10000);assert.equal(config.ssl.rejectUnauthorized,true);}
  on(){}
  async connect(){return measured('poolConnect',async()=>{
   const c=await pg.acquire();return {connection:{stream:{authorized:true}},release:e=>c.release(e),query:(sql,args=[])=>measured(classify(sql),async()=>{
    if(sql.startsWith('select session_user'))return {rows:[{login:'n88_backend',role:'n88_backend',ssl:!badTransport}]};
    if(sql.startsWith('select current_user as role,'))return {rows:[{role:'n88_backend',error_verbosity:'terse',error_parameters:'0',statements:'none',duration:'-1',duration_sample:'-1',transaction_sample:'0',audit:null,explain_duration:null,explain_nested:null}]};
    if(sql==='commit'&&commitFault){const fault=commitFault;commitFault=null;if(fault==='unknown')await c.query(sql,args);throw Error('fabricated commit acknowledgment lost');}
    return c.query(sql,args);
   })};
  });}
  async end(){}
 };
 const actual=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
 const origin='https://synthetic.invalid',keyNames=['N88_HMAC_KEY','N88_INGRESS_KEY','N88_NUMERIC_KEY','N88_RESERVATION_KEY','N88_RECOVERY_KEY_r1'];
 const env={N88_ENABLED:'true',N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true',N88_PUBLIC_ORIGIN:origin,N88_AUTH_URL:authUrl,N88_AUTH_API_KEY:'fabricated',N88_DATABASE_URL:'postgresql://n88_backend:synthetic@db.xlrubcwjqktzzunrvuns.supabase.co/postgres',N88_SERVICE_REVISION:actual.deployment_inactive_default.serviceRevision,N88_DATABASE_CA_CERT:await readFile('drafts/n88-student-portal/activation/ca/supabase-prod-ca-2021.crt','utf8'),N88_RECOVERY_ACTIVE_VERSION:'r1',N88_RECOVERY_VERSIONS:'r1',...Object.fromEntries(keyNames.map(n=>[n,randomBytes(32).toString('hex')]))};
 const asKey=n=>Buffer.from(env[n],'hex');
 // Provision the existing fabricated class through the actual service. No teacher
 // provider or hosted request; the trusted teacher verifier is a fixture port.
 const rollout={mode:'public',allowsOwner:()=>true,allowsMember:()=>true,admitsStudent:m=>!!m,admitsTeacher:()=>true};
 const setup=actual.composeService({...actual.deployment_inactive_default,origin,authUrl,apiKey:'fabricated',sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,acquire:()=>pg.acquire(),numericKey:asKey('N88_NUMERIC_KEY'),reservationKey:asKey('N88_RESERVATION_KEY'),secretKey:asKey('N88_HMAC_KEY'),ingressKey:asKey('N88_INGRESS_KEY'),recoveryKeys:new Map([['r1',asKey('N88_RECOVERY_KEY_r1')]]),recoveryActiveKeyVersion:'r1',rollout,canonicalBounds:{rollout}},{verifyIngress:async()=>({clientKey:'fabricated'}),verifyTeacher:async()=>({ownerId:A,sessionId:SESSION,current:true})});
 const binding={ownerId:A,sessionId:SESSION,leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const teacher=async(action,extra={})=>setup({path:'/teacher/class/'+action,method:'POST',headers:{origin,'x-n88-csrf':'1','content-type':'application/json'},body:{binding,teachingId:'teaching',uiProtocol:'n88-public-ui-v1',...extra}});
 const roster=await teacher('list');assert.equal(roster.status,200,'fabricated teacher roster');
 const issued=await teacher('issue-missing',{requestId:'synthetic-phase-issue',expectedRosterRevision:roster.body.data.rosterRevision});assert.equal(issued.status,200);
 const code=issued.body.data.created.find(s=>s.studentId==='student').credential;
 const current=await teacher('list');assert.equal(current.status,200);
 assert.equal((await teacher('visibility',{requestId:'synthetic-phase-visibility',policyRevision:current.body.data.policyRevision,expectedRosterRevision:current.body.data.rosterRevision,fields:{name:true,class:true,grades:true,required:true,completed:true,scheduled:true}})).status,200,'fabricated visibility');
 host=actual.createExistingHost(n=>env[n]);
 const call=async(action='read',cookie='',body={})=>{
  const path='/api/n88/student/'+action,method=action==='read'?'GET':'POST',headers=new Headers({'origin':origin,'content-type':'application/json','x-n88-csrf':'1','sec-fetch-site':'same-origin',cookie});
  const bytes=method==='GET'?new Uint8Array():new TextEncoder().encode(JSON.stringify(body)),time=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID(),source='b'.repeat(64);
  const signature=await mac(asKey('N88_INGRESS_KEY'),signingText({origin,path,method,headers,bodyHash:await sha(bytes),time,nonce,source}));
  const wire=new Headers({'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-source':source,'x-n88-signature':signature});
  const r=await host.handle(new Request(authUrl+'/functions/v1/n88-student-portal/dispatch',{method:'POST',headers:wire,body:JSON.stringify({path,method,headers:FORWARDED.map(n=>headers.get(n)||''),body:encodeBytes(bytes)})}));assert.equal(r.status,200);
  assert.match(r.headers.get('cache-control'),/no-store/);return r.json();
 };
 const claim=await call('claim','',{code});assert.equal(claim.status,200);const cookie=claim.cookie.split(';')[0];
 const baseline=await call('read',cookie);assert.equal(baseline.status,200);assert.equal(baseline.body.version,'n88-student-v3');assert(baseline.body.grades);assert(baseline.body.work);
 const measure=async(name,phase=null,ms=0)=>{
  events=[];delayPhase=phase;delayMs=ms;delayUsed=false;const start=performance.now(),reply=await call('read',cookie),wallMs=performance.now()-start;
  assert.equal(reply.status,200);assert.deepEqual(reply.body,baseline.body);
  const groups={};for(const e of events){const g=groups[e.phase]??={queryCount:0,ms:0};g.queryCount++;g.ms+=e.ms;}
  assert.equal(groups.poolConnect.queryCount,1);assert.equal(groups.commit.queryCount,1);assert.equal(groups.projectionRead.queryCount,14);assert.equal(groups.synchronize.queryCount,3);
  if(phase){assert(delayUsed);assert(groups[phase].ms>=ms-2);assert(wallMs>=ms-2);}
  const phaseMs=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{queryCount:k==='poolConnect'?0:v.queryCount,ms:Math.round(v.ms)}]));
  report.runs.push({name,injectedPhase:phase,injectedMs:ms,wallMs:Math.round(wallMs),queryCount:events.length-1,phases:phaseMs,residualJsAndEnvelopeMs:Math.round(wallMs-events.reduce((sum,e)=>sum+e.ms,0)),projectionAndGuidanceEqual:true});delayPhase=null;
 };
 operation='warm/idle red-first characterization';
 if(process.argv.includes('--guards-only')){
  const file=dir+'measurement-before-owner-fixture-failure.json',prior=JSON.parse(await readFile(file,'utf8'));
  assert.equal(prior.source.nativeSha256,report.source.nativeSha256);assert.equal(prior.runs.length,11);assert.equal(prior.failure.message,'23503');
  report.runs=prior.runs;report.reusedMeasurements={path:file,sha256:digest(await readFile(file)),reason:'Original characterization complete; correct invalid wrong-owner fixture without replaying unchanged phase runs.'};
 }else{
 await measure('warm-1');await measure('warm-2');
 // Explicit fixture idle: evict the LOCAL PG pool and recreate it. This does not
 // claim native remote session-pooler/TLS behavior or use a real-account request.
 await pg.restart();await measure('idle-local-restarted');
 for(const phase of ['poolConnect','transportBoundary','snapshot','synchronize','projectionRead','visibility','guidance','commit'])await measure('controlled-'+phase,phase,180);
 }
 report.causalConclusion='Every injected phase contributes to wall time; no unnecessary operation or real-account bottleneck established. Diagnostic branch required; no speed fix claimed.';
 operation='guard parity';
 const deny=async(name,c=cookie)=>{const r=await call('read',c);assert.equal(r.status,401);assert.deepEqual(r.body,{error:'unavailable'});assert.deepEqual(Object.keys(r).sort(),['body','cookie','status']);report.guards.push(name);};
 await deny('missing cookie','');await deny('wrong cookie','__Secure-n88-student='+'X'.repeat(43));
 const sessionRow=(await q('select row_key,payload from n88_private.numeric_sessions')).rows.find(r=>r.payload.studentId==='student');
 const saveSession=async payload=>q('update n88_private.numeric_sessions set payload=$2::jsonb where row_key=$1',[sessionRow.row_key,JSON.stringify(payload)]);
 await saveSession({...sessionRow.payload,expiresAt:1});await deny('expired cookie');await saveSession(sessionRow.payload);
 // Valid second-owner context/credential/session parents: never disable the
 // composite FK merely to manufacture an impossible cross-owner session row.
 const otherOwner='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',otherToken='Y'.repeat(43),otherId=randomUUID(),otherSessionId=randomUUID();
 await q("insert into n88_private.contexts(namespace,owner_id,active) values('n88_phase_other_owner_fixture',$1,true)",[otherOwner]);
 const originalCredential=(await q('select payload from n88_private.numeric_credentials')).rows.find(r=>r.payload.studentId==='student').payload;
 await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[otherId,JSON.stringify({...originalCredential,id:otherId,ownerId:otherOwner,reservation:randomBytes(32).toString('hex')})]);
 await q('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)',[otherSessionId,JSON.stringify({...sessionRow.payload,id:otherSessionId,credentialId:otherId,ownerId:otherOwner,tokenHash:digest(otherToken)})]);
 await deny('other-owner valid cookie cannot read first owner membership','__Secure-n88-student='+otherToken);
 await q("update rakeezx.enrollments set status='inactive',revision=revision+1 where id='enrollment'");await deny('membership change immediate retirement');
 await q("update rakeezx.enrollments set status='active',revision=revision+1 where id='enrollment'");await deny('restored membership cannot revive old cookie');
 const freshClaim=await call('claim','',{code});assert.equal(freshClaim.status,200,'claim after membership revision');const fresh=freshClaim.cookie.split(';')[0];
 // Membership revisions invalidate the old explicit publication binding. Republish
 // deliberately using the current fabricated roster; never weaken that safeguard.
 const revisedRoster=await teacher('list');assert.equal(revisedRoster.status,200,'revised roster');
 assert.equal((await teacher('visibility',{requestId:'synthetic-phase-republish',policyRevision:revisedRoster.body.data.policyRevision,expectedRosterRevision:revisedRoster.body.data.rosterRevision,fields:revisedRoster.body.data.visibility})).status,200,'republish revised membership');
 assert.equal((await call('read',fresh)).status,200,'fresh read after explicit republish');
 await q("update rakeezx.terms set end_date='2000-01-01' where id='term'");await deny('expired term',fresh);await q("update rakeezx.terms set end_date='2027-01-01' where id='term'");
 const policies=(await q('select payload from n88_private.class_visibility')).rows[0].payload;
 await q("update n88_private.class_visibility set payload=jsonb_set(payload,'{members}','[]'::jsonb)");
 const hidden=await call('read',fresh);assert.equal(hidden.status,200);assert(!hidden.body.profile&&!hidden.body.grades&&!hidden.body.work);report.guards.push('visibility removal omits private sections on next authoritative GET');
 await q('update n88_private.class_visibility set payload=$1::jsonb',[JSON.stringify(policies)]);
 commitFault='before';await deny('COMMIT failure no success projection',fresh);
 commitFault='unknown';await deny('unknown COMMIT acknowledgment no success projection',fresh);
 assert.equal((await call('read',fresh)).status,200);
 badTransport=true;await deny('failed transport invariant denies',fresh);badTransport=false;
 assert.equal((await call('end',fresh)).status,200);await deny('End Session immediate server revocation',fresh);
 const reClaim=await call('claim','',{code});assert.equal(reClaim.status,200);const newest=reClaim.cookie.split(';')[0];
 const member=(await teacher('list')).body.data.students.find(s=>s.studentId==='student');
 const rotated=await teacher('rotate',{requestId:'synthetic_phase_rotate_001',studentId:member.studentId,enrollmentId:member.enrollmentId,revision:member.revision,credentialVersion:member.credentialVersion});
 assert.equal(rotated.status,200,'actual fabricated rotation');await deny('rotated credential cookie',newest);
 const rotatedClaim=await call('claim','',{code:rotated.body.data.credential});assert.equal(rotatedClaim.status,200);const rotatedCookie=rotatedClaim.cookie.split(';')[0];
 assert.equal((await call('read',rotatedCookie)).status,200);
 const afterRotate=(await teacher('list')).body.data.students.find(s=>s.studentId==='student');
 assert.equal((await teacher('revoke',{requestId:'synthetic_phase_revoke_001',studentId:afterRotate.studentId,enrollmentId:afterRotate.enrollmentId,revision:afterRotate.revision,credentialVersion:afterRotate.credentialVersion})).status,200);
 await deny('revoked credential cookie',rotatedCookie);
 report.status='PASS';
}catch(e){report.failure={operation,name:e.name,message:e.name==='AssertionError'?e.message.split('\n')[0]:e.code??e.message.slice(0,180),...(e.name==='AssertionError'&&typeof e.actual==='number'?{actual:e.actual,expected:e.expected}:{})};process.exitCode=1;}
finally{
 delete globalThis[port];await host?.close();
 try{await pg?.close();report.cleanup.ownedPgClosed=!!pg;}finally{if(leased)report.cleanup.integrationLease=lease('release');}
 await writeFile(dir+'measurement.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
