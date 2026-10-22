/** AI: exact retained native44 composition, fabricated Auth/PG/crypto ports only.
 * No net/env/run permissions; startup suffix is omitted, never invoked.
 */
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {readFile,writeFile} from 'node:fs/promises';
import {patchNative44,sourcePath,sourceSha256,sha256,before,after} from '../../drafts/n44-push/activation/disabled-recovery-20261022/patch-native44.mjs';
const retained=await readFile(sourcePath,'utf8');
assert.equal(sha256(retained),sourceSha256);
const receipt=JSON.parse(await readFile('drafts/n44-push/activation/register503-composition/native-source-readback.json','utf8'));
assert.equal(receipt.version,44);assert.equal(receipt.sourceSha256,sourceSha256);assert.equal(receipt.sourceExact,true);
const patched=patchNative44(retained);
assert.equal(patched.replace(after,before),retained,'exact reversible one-site patch');
assert.throws(()=>patchNative44(retained+' '),/source_mismatch/);
const startup='// supabase/functions/n44-notifications/index.ts';
assert.equal(retained.split(startup).length,2);
async function load(source){
 const code=source.slice(0,source.indexOf(startup))+'\nexport {createBackend,policySessionRevision,DEVICE_TEST_ID,oneDeviceGuard};\n';
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const baseline=await load(retained),candidate=await load(patched);
let {createBackend,policySessionRevision,DEVICE_TEST_ID}=baseline;
const start=Date.parse('2026-10-19T12:00:00Z'),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session='11111111-1111-4111-8111-111111111111',rid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const authUrl='https://auth.synthetic.invalid',source='a'.repeat(40),workspace='synthetic',device='synthetic';
const prefs={lesson:true,due:true,lessonMinutes:15,dueDays:[3,2,1,0],timezone:'Asia/Riyadh',quiet:null};
const realNow=Date.now; Date.now=()=>start;
const profile={v:2,approvalState:'active',approvalId:'a'.repeat(64),serviceRevision:'n44-browser-service-v2',serviceSourceSha:source,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:'b'.repeat(64),observedAt:start-1000,activatedAt:start-500};
// Reuse the existing official AuthClient synthetic ES256/JWKS arrangement.
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic',alg:'ES256',use:'sig'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const unsigned=enc({alg:'ES256',kid:'synthetic',typ:'JWT'})+'.'+enc({iss:authUrl+'/auth/v1',aud:'authenticated',role:'authenticated',sub:owner,session_id:session,iat:start/1000-1,exp:start/1000+3600});
const authorization='Bearer '+unsigned+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(unsigned))).toString('base64url');
// Standard public P-256 generator, as in the prior synthetic protector fixture.
const publicPoint=Buffer.from('046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5','hex').toString('base64url');
const body={registrationId:rid,workspaceId:workspace,deviceId:device,sessionRevision:policySessionRevision(session,profile),consent:{revision:'consent',push:true},subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/FABRICATED',keys:{p256dh:publicPoint,auth:'A'.repeat(22)}}};
const contract=JSON.parse(await readFile('drafts/n44-push/activation/error-boundary-contract.json','utf8'));
const permitted=new Set([...contract.controls,...contract.operations.map(o=>o.sql)]);
function fixture({rtt=0,retired=false,unknownCommit=false,consent=true, rows=[], expired=false, wrongOwner=false, budgetCount=0, consumed=false, staleConsent=false, invalidSession=false, claimConflict=false, expiresIn=3600000, deliveries=[]}={}){
 let tick=start,connections=0,snapshots=0,protects=0,commits=0,registeredAck=false;
 const trace=[],regs=new Map(),budgets=new Map(),claims=new Map();
 if(retired)regs.set(other,{registration_id:other,workspace_id:workspace,device_id:device,session_id:session,session_revision:body.sessionRevision,consent_revision:'consent',state:'revoked',expires_at_ms:String(start+60000),sealed:null,fingerprint:null,binding_fingerprint:null});
 for(const row of rows){regs.set(row.registration_id,structuredClone(row));if(row.state==='active')claims.set(row.fingerprint,{fingerprint:row.fingerprint,registration_id:row.registration_id});}
 if(budgetCount)budgets.set('register',{budget_key:'register',bucket:String(Math.floor(start/3600000)),count:budgetCount,expires_at_ms:String((Math.floor(start/3600000)+1)*3600000)});
 if(consumed)budgets.set('day:'+DEVICE_TEST_ID,{budget_key:'day:'+DEVICE_TEST_ID,bucket:String(Math.floor(start/86400000)),count:1,expires_at_ms:String((Math.floor(start/86400000)+1)*86400000)});
 const originalRows=structuredClone([...regs.values()]);
 const originalBudgets=structuredClone([...budgets.values()]);
 const acquire=async()=>{const connection=connections++;return {async query(sql,values=[]){
  assert.ok(permitted.has(sql),'only fixed existing SQL may reach fake capability');tick+=rtt;trace.push({connection,sql,at:tick-start});
  if(sql==='commit'&&connection===0){commits++;if(unknownCommit)throw Error('FABRICATED_UNKNOWN_COMMIT');}
  if(sql==='savepoint n44_owner')snapshots++;
  if(sql.includes('lock_current_session')){assert.deepEqual(values,[owner,session]);return {rows:[{user_id:owner,session_id:invalidSession?other:session,not_after_ms:null}]};}
  if(sql.startsWith('select key from n44_push_draft.ingress_rates'))return {rows:[]};
  if(sql.startsWith('insert into n44_push_draft.ingress_rates'))return {rows:[{count:1}]};
  if(sql.startsWith('select high_water_ms')){assert.equal(values[0],owner);return {rows:[{high_water_ms:'0'}]};}
  if(sql.startsWith('select floor(extract'))return {rows:[{now_ms:String(tick)}]};
  if(sql.startsWith('select workspace_id,device_id,active')){assert.equal(values[0],owner);return {rows:[{workspace_id:workspace,device_id:device,active:true,session_id:session,session_revision:body.sessionRevision,session_expires_at_ms:String(start+3600000),consent_revision:staleConsent?'stale':'consent',push_consent:consent,preferences:JSON.stringify(prefs)}]};}
  if(sql.startsWith('select registration_id,workspace_id')){assert.equal(values[0],owner);return {rows:structuredClone([...regs.values()])};}
  if(sql.startsWith('select workspace_id,device_id,event_id'))return {rows:structuredClone(deliveries)};
  if(sql.startsWith('select budget_key,bucket'))return {rows:structuredClone([...budgets.values()])};
  if(sql.startsWith('select fingerprint,registration_id'))return {rows:structuredClone([...claims.values()])};
  if(sql.startsWith('insert into n44_push_draft.registrations')){assert.equal(values[0],owner);const keys=['registration_id','workspace_id','device_id','session_id','session_revision','consent_revision','state','expires_at_ms','sealed','fingerprint','binding_fingerprint'];const row=Object.fromEntries(keys.map((k,i)=>[k,k==='expires_at_ms'?String(values[i+1]):values[i+1]]));regs.set(row.registration_id,row);}
  if(sql.startsWith('insert into n44_push_draft.budgets')){assert.equal(values[0],owner);budgets.set(values[1],{budget_key:values[1],bucket:String(values[2]),count:values[3],expires_at_ms:String(values[4])});}
  if(sql.startsWith('insert into n44_push_draft.endpoint_claims')){if(claimConflict)throw Object.assign(Error('FABRICATED_GLOBAL_ENDPOINT_COLLISION'),{code:'23505'});assert.equal(values[1],owner);assert.ok(regs.has(values[2]),'parent precedes claim');claims.set(values[0],{fingerprint:values[0],registration_id:values[2]});}
  return {rows:[],rowCount:1};
 },release(){}};};
 const backend=createBackend({acquire,authUrl,apiKey:'FABRICATED_PUBLIC',fetch:async url=>{assert.ok([authUrl+'/auth/v1/.well-known/jwks.json',authUrl+'/auth/v1/user'].includes(url));return url.endsWith('jwks.json')?Response.json({keys:[jwk]}):Response.json({id:owner,is_anonymous:false});},providerOrigins:['https://fcm.googleapis.com'],crypto:{protect(){protects++;return {sealed:'FABRICATED_EXISTING_CRYPTO_PORT',fingerprint:'1'.repeat(64),bindingFingerprint:'2'.repeat(64)};},sender:{send(){assert.fail('sender forbidden');}}},rateKey:Buffer.alloc(32,2),sessionPolicy:profile,serviceSourceSha:source,deviceTest:{testId:DEVICE_TEST_ID,runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',ownerId:wrongOwner?other:owner,workspaceId:workspace,deviceId:device,expiresAt:expired?start-1:start+expiresIn,target:null},deliveryEnabled:false,now:()=>tick});
 return {async run(path='/push/register',input=body){let result,error;try{result=await backend.teacher(path,authorization,input);registeredAck=result.status==='registered';}catch(e){error=e.message;}return {status:result?.status??'threw',elapsedMs:tick-start,queries:trace.length,snapshots,protects,outerCommitAttempts:commits,registeredAck,error,trace,originalRows,rows:structuredClone([...regs.values()]),originalBudgets,budgets:structuredClone([...budgets.values()])};}};
}

const cases=[];
async function run(name,options={},input=body){
 const outcome=await fixture(options).run('/push/register',input);
 cases.push({name,status:outcome.status,queries:outcome.queries,snapshots:outcome.snapshots,commits:outcome.outerCommitAttempts,registeredAck:outcome.registeredAck});
 return outcome;
}
function denied(outcome,status){
 if(status)assert.equal(outcome.status,status);
 assert.equal(outcome.registeredAck,false);
 assert.ok(!outcome.trace.some(x=>x.sql.startsWith('insert into n44_push_draft.registrations')),'no registration write');
}
const old={registration_id:other,workspace_id:workspace,device_id:device,session_id:session,session_revision:body.sessionRevision,consent_revision:'previous-consent',state:'revoked',expires_at_ms:String(start+60000),sealed:null,fingerprint:null,binding_fingerprint:null};
try {
 denied(await run('native44_ACK_revoked_same_device_obstruction',{rows:[old]}),'disabled');
 const originalClean=await run('native44_clean_control');assert.equal(originalClean.status,'registered');assert.equal(originalClean.snapshots,1);assert.equal(originalClean.queries,35);
 denied(await run('native44_expired_approval',{expired:true}),'disabled');
 const expiresDuring=await run('native44_approval_expires_during_snapshot',{rtt:250,expiresIn:5000});assert.equal(expiresDuring.status,'registered');
 createBackend=candidate.createBackend;
 const positive=await run('candidate_ACK_revoked_same_device_new_ID',{rows:[old]});
 assert.equal(positive.status,'registered');assert.equal(positive.snapshots,1);assert.equal(positive.queries,35);assert.equal(positive.outerCommitAttempts,1);
 assert.deepEqual(positive.rows.find(r=>r.registration_id===other),old,'tombstone preserved byte-for-byte');
 assert.equal(positive.budgets.find(b=>b.budget_key==='register').count,1);
 const older={...old,registration_id:'10000000-0000-4000-8000-000000000003'};
 assert.equal((await run('candidate_multiple_ACK_revoked_same_scope',{rows:[old,older]})).status,'registered');
 denied(await run('candidate_old_ID_reuse',{rows:[old]},{...body,registrationId:other}),'rejected');
 const active={...old,state:'active',sealed:'FABRICATED',fingerprint:'3'.repeat(64),binding_fingerprint:'4'.repeat(64)};
 denied(await run('candidate_other_active_identity',{rows:[active]}),'disabled');
 denied(await run('candidate_expired_active_identity_not_ACK_revoked',{rows:[{...active,expires_at_ms:String(start-1)}]}),'disabled');
 denied(await run('candidate_dead_identity_not_ACK_revoked',{rows:[{...old,state:'dead'}]}),'disabled');
 denied(await run('candidate_unknown_identity_state',{rows:[{...old,state:'uncertain'}]}),'threw');
 denied(await run('candidate_revoked_with_residual_material',{rows:[{...old,sealed:'UNRESOLVED'}]}),'threw');
 denied(await run('candidate_foreign_workspace_retired',{rows:[{...old,workspace_id:'foreign'}]}),'disabled');
 denied(await run('candidate_second_device_active',{rows:[{...active,device_id:'foreign'}]}),'disabled');
 denied(await run('candidate_foreign_device_retired',{rows:[{...old,device_id:'foreign'}]}),'disabled');
 denied(await run('candidate_wrong_approval_owner',{wrongOwner:true}),'disabled');
 denied(await run('candidate_mismatched_device',{}, {...body,deviceId:'different'}),'disabled');
 denied(await run('candidate_mismatched_workspace',{}, {...body,workspaceId:'different'}),'disabled');
 denied(await run('candidate_expired_approval',{expired:true}),'disabled');
 denied(await run('candidate_approval_expires_during_snapshot',{rtt:250,expiresIn:5000}),'disabled');
 denied(await run('candidate_no_current_consent',{consent:false}),'rejected');
 denied(await run('candidate_stale_consent',{staleConsent:true}),'rejected');
 denied(await run('candidate_owner_session_guard',{invalidSession:true}),'rejected');
 denied(await run('candidate_registration_write_budget_consumed',{rows:[old],budgetCount:6}),'limited');
 const uncertainDelivery={workspace_id:workspace,device_id:device,event_id:'old-event',registration_id:other,kind:'lesson',action_path:'/calendar',expires_at_ms:String(start+60000),attempts:1,state:'uncertain',started_at_ms:String(start-1000),next_at_ms:'0'};
 const journal=await run('candidate_uncertain_delivery_history_preserved',{rows:[old],deliveries:[uncertainDelivery],consumed:true});assert.equal(journal.status,'registered');assert.ok(!journal.trace.some(x=>/^(delete|insert into|update) n44_push_draft\.deliveries/.test(x.sql)));
 const uncertainCommit=await run('candidate_unknown_COMMIT_not_ACK',{rows:[old],unknownCommit:true});
 assert.equal(uncertainCommit.status,'threw');assert.equal(uncertainCommit.registeredAck,false);assert.equal(uncertainCommit.outerCommitAttempts,1);assert.equal(uncertainCommit.snapshots,1);
 const conflict=await run('candidate_foreign_endpoint_unique_claim_denied',{claimConflict:true});assert.equal(conflict.status,'threw');assert.equal(conflict.registeredAck,false);
 const already=fixture({rows:[old]});const first=await already.run();const repeat=await already.run();assert.equal(first.status,'registered');assert.equal(repeat.status,'registered');assert.equal(repeat.rows.filter(r=>r.state==='active').length,1);assert.equal(repeat.budgets.find(b=>b.budget_key==='register').count,1);
 cases.push({name:'candidate_same_ID_idempotent_active_retry',status:'registered',activeRows:1,registrationWrites:1});
 // A registration is NOT a send budget reset. Exercise the unchanged exact
 // composition's oneDeviceGuard on the persisted authority-wide marker.
 const consumed=await run('candidate_registration_preserves_consumed_send_marker',{rows:[old],consumed:true});
 assert.equal(consumed.status,'registered');
 assert.deepEqual(consumed.budgets.find(b=>b.budget_key==='day:'+DEVICE_TEST_ID),consumed.originalBudgets.find(b=>b.budget_key==='day:'+DEVICE_TEST_ID));
 const target={registrationId:rid,eventId:'fabricated-event'};
 const approval={testId:DEVICE_TEST_ID,runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',ownerId:owner,workspaceId:workspace,deviceId:device,expiresAt:start+3600000,target};
 const store=new Map([['day:'+DEVICE_TEST_ID,{bucket:Math.floor(start/86400000),count:1,expiresAt:(Math.floor(start/86400000)+1)*86400000}]]);
 const tx={get:(t,k)=>store.get(k),set:()=>assert.fail('consumed budget must not change')};
 const registration={registrationId:rid,workspaceId:workspace,deviceId:device};
 assert.equal(candidate.oneDeviceGuard(approval)(tx,owner,registration,{id:target.eventId},start),false);
 assert.equal(candidate.oneDeviceGuard({...approval,runId:other})(tx,owner,registration,{id:target.eventId},start),false);
 cases.push({name:'candidate_consumed_total_attempt_denies_send_and_new_run',status:'denied'});
 // Current time is outside the retained hard stop. Never widen it in this patch.
 assert.equal(candidate.oneDeviceGuard(approval)(tx,owner,registration,{id:target.eventId},Date.parse('2026-10-22T12:00:00Z')),false);
 cases.push({name:'unchanged_hard_stop_no_present_day_authority',status:'denied'});
 const oldProof='tests/n44-register503-1019-composition-corrected.json';
 const proof=JSON.parse(await readFile(oldProof,'utf8'));
 assert.equal(proof.cases[0].queries,35);assert.equal(proof.cases[0].snapshots,1);
 const report={aiAuthored:true,taskId:'continuous-n44-disabled-source-preparation-20261022',runId:'fadd3490-e38e-47f4-b35b-d0bc72a48622',status:'PASS',runtime:Deno.version,sourcePath,sourceSha256,candidateSourceSha256:sha256(patched),startupOmittedSha256:sha256(retained.slice(retained.indexOf(startup))),reusedEvidence:{path:oldProof,sha256:sha256(await readFile(oldProof)),note:'Unchanged 50-to-35/crypto/SQL evidence reused; this test adds focused exact bundled-composition coverage only.'},cases,liveOperations:0,limitations:['Fabricated fixed historical clock; existing hard stop unchanged.','Actual hosted disabled subcause and original503 unknown.','No service activation, registration, real send or OS arrival proof.','Unknown COMMIT withholds ACK; fake PG is not a new SQL/transaction certification.']};
 await writeFile('tests/n44-disabled-recovery-20261022/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,cases:cases.length,candidateSourceSha256:report.candidateSourceSha256,liveOperations:0}));
} finally { Date.now=realNow; }
