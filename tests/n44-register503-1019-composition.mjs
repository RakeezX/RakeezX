/** AI: actual backend/AuthClient/repository with fixed fake PG and virtual RTT.
 * No sockets, hosted SQL, browser, real keys, sessions or registration operation. */
import '../drafts/n44-push/node-globals.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createBackend} from '../drafts/n44-push/backend.mjs';
import {policySessionRevision} from '../drafts/n44-push/session-policy.mjs';
import {DEVICE_TEST_ID} from '../drafts/n44-push/one-device-test.mjs';
const mode=Deno.args[0];assert.ok(['baseline','corrected'].includes(mode));
const start=Date.parse('2026-10-19T12:00:00Z'),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session='11111111-1111-4111-8111-111111111111',rid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const authUrl='https://auth.synthetic.invalid',source='a'.repeat(40),workspace='synthetic',device='synthetic';
const prefs={lesson:true,due:true,lessonMinutes:15,dueDays:[3,2,1,0],timezone:'Asia/Riyadh',quiet:null};
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
function fixture({rtt=0,retired=false,unknownCommit=false,consent=true}={}){
 let tick=start,connections=0,snapshots=0,protects=0,commits=0,registeredAck=false;
 const trace=[],regs=new Map(),budgets=new Map(),claims=new Map();
 if(retired)regs.set(other,{registration_id:other,workspace_id:workspace,device_id:device,session_id:session,session_revision:body.sessionRevision,consent_revision:'consent',state:'revoked',expires_at_ms:String(start+60000),sealed:null,fingerprint:null,binding_fingerprint:null});
 const acquire=async()=>{const connection=connections++;return {async query(sql,values=[]){
  assert.ok(permitted.has(sql),'only fixed existing SQL may reach fake capability');tick+=rtt;trace.push({connection,sql,at:tick-start});
  if(sql==='commit'&&connection===0){commits++;if(unknownCommit)throw Error('FABRICATED_UNKNOWN_COMMIT');}
  if(sql==='savepoint n44_owner')snapshots++;
  if(sql.includes('lock_current_session')){assert.deepEqual(values,[owner,session]);return {rows:[{user_id:owner,session_id:session,not_after_ms:null}]};}
  if(sql.startsWith('select key from n44_push_draft.ingress_rates'))return {rows:[]};
  if(sql.startsWith('insert into n44_push_draft.ingress_rates'))return {rows:[{count:1}]};
  if(sql.startsWith('select high_water_ms')){assert.equal(values[0],owner);return {rows:[{high_water_ms:'0'}]};}
  if(sql.startsWith('select floor(extract'))return {rows:[{now_ms:String(tick)}]};
  if(sql.startsWith('select workspace_id,device_id,active')){assert.equal(values[0],owner);return {rows:[{workspace_id:workspace,device_id:device,active:true,session_id:session,session_revision:body.sessionRevision,session_expires_at_ms:String(start+3600000),consent_revision:'consent',push_consent:consent,preferences:JSON.stringify(prefs)}]};}
  if(sql.startsWith('select registration_id,workspace_id')){assert.equal(values[0],owner);return {rows:structuredClone([...regs.values()])};}
  if(sql.startsWith('select workspace_id,device_id,event_id'))return {rows:[]};
  if(sql.startsWith('select budget_key,bucket'))return {rows:structuredClone([...budgets.values()])};
  if(sql.startsWith('select fingerprint,registration_id'))return {rows:structuredClone([...claims.values()])};
  if(sql.startsWith('insert into n44_push_draft.registrations')){assert.equal(values[0],owner);const keys=['registration_id','workspace_id','device_id','session_id','session_revision','consent_revision','state','expires_at_ms','sealed','fingerprint','binding_fingerprint'];const row=Object.fromEntries(keys.map((k,i)=>[k,k==='expires_at_ms'?String(values[i+1]):values[i+1]]));regs.set(row.registration_id,row);}
  if(sql.startsWith('insert into n44_push_draft.budgets')){assert.equal(values[0],owner);budgets.set(values[1],{budget_key:values[1],bucket:String(values[2]),count:values[3],expires_at_ms:String(values[4])});}
  if(sql.startsWith('insert into n44_push_draft.endpoint_claims')){assert.equal(values[1],owner);assert.ok(regs.has(values[2]),'parent precedes claim');claims.set(values[0],{fingerprint:values[0],registration_id:values[2]});}
  return {rows:[],rowCount:1};
 },release(){}};};
 const backend=createBackend({acquire,authUrl,apiKey:'FABRICATED_PUBLIC',fetch:async url=>{assert.ok([authUrl+'/auth/v1/.well-known/jwks.json',authUrl+'/auth/v1/user'].includes(url));return url.endsWith('jwks.json')?Response.json({keys:[jwk]}):Response.json({id:owner,is_anonymous:false});},providerOrigins:['https://fcm.googleapis.com'],crypto:{protect(){protects++;return {sealed:'FABRICATED_EXISTING_CRYPTO_PORT',fingerprint:'1'.repeat(64),bindingFingerprint:'2'.repeat(64)};},sender:{send(){assert.fail('sender forbidden');}}},rateKey:Buffer.alloc(32,2),sessionPolicy:profile,serviceSourceSha:source,deviceTest:{testId:DEVICE_TEST_ID,runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',ownerId:owner,workspaceId:workspace,deviceId:device,expiresAt:start+3600000,target:null},deliveryEnabled:false,now:()=>tick});
 return {async run(path='/push/register',input=body){let result,error;try{result=await backend.teacher(path,authorization,input);registeredAck=result.status==='registered';}catch(e){error=e.message;}return {status:result?.status??'threw',elapsedMs:tick-start,queries:trace.length,snapshots,protects,outerCommitAttempts:commits,registeredAck,error,trace};}};
}
const cases=[];
async function run(name,options,path,input){const outcome=await fixture(options).run(path,input);cases.push({name,...outcome});return outcome;}
const fast=await run('isolated_registration_fixed_capability',{rtt:0});assert.equal(fast.status,'registered');assert.equal(fast.outerCommitAttempts,1);assert.equal(fast.registeredAck,true);
const delayed=await run('registration_250ms_per_roundtrip',{rtt:250});
if(mode==='baseline'){
 assert.equal(fast.snapshots,2);assert.equal(delayed.registeredAck,false);assert.ok(delayed.elapsedMs>=12000);assert.equal(delayed.outerCommitAttempts,0);
 const control=await run('context_update_same_250ms_capability',{rtt:250},'/context/update',{workspaceId:workspace,deviceId:device,expectedRevision:'consent',preferences:prefs,pushConsent:false});assert.equal(control.status,'updated');
}else{
 const before=JSON.parse(await readFile('tests/n44-register503-1019-composition-baseline.json','utf8'));
 assert.equal(fast.snapshots,1);assert.equal(delayed.status,'registered');assert.equal(delayed.outerCommitAttempts,1);assert.ok(delayed.elapsedMs<12000);assert.ok(fast.queries<before.cases[0].queries);
 const tombstone=await run('retired_other_identity_still_denied',{retired:true,rtt:0});assert.equal(tombstone.status,'disabled');assert.equal(tombstone.snapshots,1);assert.ok(!tombstone.trace.some(x=>x.sql.startsWith('insert into n44_push_draft.registrations')));
 const denied=await run('consent_false_still_denied',{consent:false});assert.equal(denied.status,'rejected');
 const unknown=await run('unknown_outer_commit_never_ACK_or_replay',{unknownCommit:true});assert.equal(unknown.status,'threw');assert.equal(unknown.registeredAck,false);assert.equal(unknown.outerCommitAttempts,1);assert.equal(unknown.snapshots,1);
}
const hashes={};for(const p of ['drafts/n44-push/backend.mjs','drafts/n44-push/registration.mjs','drafts/n44-push/postgres-repository.mjs'])hashes[p]=createHash('sha256').update((await readFile(p,'utf8')).replaceAll('\r\n','\n')).digest('hex');
const report={taskId:'continuous-n44-register503-existing-service-repair-20261019',runId:'0bc1d68d-dc66-4230-8172-3f77449f23f6',mode,status:'PASS',runtime:Deno.version,hashes,cases,scope:'Actual backend/AuthClient/repository, existing synthetic Auth and trusted crypto capability. Fixed fake PG charges250ms per known query; demonstrates source critical-path defect, NOT original hosted503 causality or hosted registration acceptance.',liveOperations:0};
await writeFile('tests/n44-register503-1019-composition-'+mode+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({mode,cases:cases.map(({name,status,queries,snapshots,elapsedMs,outerCommitAttempts})=>({name,status,queries,snapshots,elapsedMs,outerCommitAttempts}))}));
