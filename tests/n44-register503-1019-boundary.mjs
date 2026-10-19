/** AI: affected registration composition only; fabricated material, no network/Auth/DB. */
import '../drafts/n44-push/node-globals.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {p256} from '@noble/curves/nist.js';
import {createSubscriptionProtector} from '../drafts/n44-push/subscription-protector.mjs';
import {createRegistrationBoundary} from '../drafts/n44-push/registration.mjs';
import {requestFailure,runtimeFailure} from '../drafts/n44-push/runtime-failure.mjs';
const now=1792410000000,owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const auth={ownerId:owner,sessionId:'fabricated-session',sessionRevision:'fabricated-revision',expiresAt:now+60000};
const ctx={active:true,sessionId:auth.sessionId,sessionRevision:auth.sessionRevision,sessionExpiresAt:auth.expiresAt,consentRevision:'fabricated-consent',pushConsent:true};
const body={registrationId:'10000000-0000-4000-8000-000000000001',workspaceId:'fabricated-workspace',deviceId:'fabricated-device',sessionRevision:auth.sessionRevision,consent:{revision:ctx.consentRevision,push:true},subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/FABRICATED_NOT_A_DEVICE',keys:{p256dh:Buffer.from(p256.ProjectivePoint.BASE.toRawBytes(false)).toString('base64url'),auth:Buffer.alloc(16,4).toString('base64url')}}};
const protector=createSubscriptionProtector({providerOrigins:['https://fcm.googleapis.com'],activeKeyId:'s',sealingKeys:new Map([['s',Buffer.alloc(32,1)]]),fingerprintKeyId:'h',endpointHmacKeys:new Map([['h',Buffer.alloc(32,2)]]),bindingHmacKeys:new Map([['h',Buffer.alloc(32,3)]]),activeVapidKeyId:'v'});
let committed=false,calls=0;const rows=new Map(),budgets=new Map();
const repository={async atomic(id,work){assert.equal(id,owner);calls++;const value=work({time:()=>now,context:()=>structuredClone(ctx),get:(t,k)=>(t==='registrations'?rows:budgets).get(k),rows:()=>[...rows.values()],set:(t,k,v)=>(t==='registrations'?rows:budgets).set(k,v),claimEndpoint:()=>true});await Promise.resolve();committed=true;return value;}};
const options={verifySession:async()=>({...auth}),repository,protect:v=>protector.protect(v),clock:()=>now,approvedOrigins:['https://fcm.googleapis.com'],receipt:true,failureProjection:true};
const checks=[];const pass=name=>checks.push({name,status:'PASS'});
try{
 const r=await createRegistrationBoundary(options).register(null,body);assert.equal(r.status,'registered');assert.equal(committed,true);assert.equal(rows.size,1);assert.ok(rows.get(body.registrationId).sealed);pass('real_registration_guard_and_Deno_protector_synthetic_commit_ack');
 const count=calls;assert.equal((await createRegistrationBoundary({...options,verifySession:async()=>null}).register(null,body)).status,'rejected');assert.equal(calls,count);
 ctx.pushConsent=false;assert.equal((await createRegistrationBoundary(options).register(null,body)).status,'rejected');ctx.pushConsent=true;
 assert.equal((await createRegistrationBoundary(options).register(null,{...body,consent:{revision:'wrong',push:true}})).status,'rejected');pass('missing_principal_and_current_consent_fail_closed');
 const secretError=()=>Object.defineProperties(new Error('FABRICATED_PRIVATE_ENDPOINT_KEY_SQL'),{detail:{get(){throw Error('getter must not execute');}}});
 for(const [phase,overrides] of [['registration_protect',{protect(){throw secretError();}}],['registration_repository',{repository:{atomic(){throw secretError();}}}],['registration_auth',{verifySession(){throw secretError();}}]]){
  let error;try{await createRegistrationBoundary({...options,...overrides}).register(null,body);}catch(e){error=e;}
  assert.ok(error);const response=requestFailure(error);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:503,body:{error:'unavailable',phase}});
 }
 const legacy=await createRegistrationBoundary({...options,failureProjection:false,protect(){throw secretError();}}).register(null,body);assert.deepEqual(legacy,{status:'unavailable'});
 const tagged=runtimeFailure('identity',secretError(),{loginExact:false,private:'FABRICATED_PRIVATE'});let caught;
 try{await createRegistrationBoundary({...options,repository:{atomic(){throw tagged;}}}).register(null,body);}catch(e){caught=e;}
 assert.deepEqual((await requestFailure(caught).json()).body,{error:'unavailable',phase:'identity',identity:{loginExact:false}});pass('finite_phase_envelope_no_messages_getters_keys_or_rows_and_prior_guard_preserved');
}finally{protector.close();}
const report={aiAuthored:true,taskId:'continuous-n44-register503-existing-service-repair-20261019',runId:'f6beb7aa-5700-4ef2-b759-129b88b7ac11',runtime:Deno.version,checks,scope:'Actual registration and protector; trusted fabricated synchronous repository capability. Not hosted DB/owner acceptance or reproduction of the original503.',liveRegistrations:0,providerSendAttempts:0};
await writeFile('tests/n44-register503-1019-boundary.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,status:'PASS',liveRegistrations:0,providerSendAttempts:0}));
