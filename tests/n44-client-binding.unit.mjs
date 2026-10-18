import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushGateway} from '../src/lib/notification-push-gateway.js';
const context={ownerId:'synthetic-A',workspaceId:'db-A',deviceId:'device-A'};
const scope={workspaceId:context.workspaceId,deviceId:context.deviceId};
const first='11111111-1111-4111-8111-111111111111',newer='22222222-2222-4222-8222-222222222222';
function fixture() {
 const values=new Map(),calls=[];let register='registered',revoke='revoked';
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const remote={...scope,active:true,sessionRevision:'synthetic-session',consentRevision:'synthetic-revision',sessionExpiresAt:Date.now()+3600000,pushConsent:true};
 const gateway=createPushGateway({context,authorization:'Bearer FABRICATED',preferences:()=>({}),storage,randomUUID:()=>first,bindConsent:async()=>true,
  fetch:async(path,init)=>{assert.ok(path.startsWith('/api/n44/'));assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
   const body=JSON.parse(init.body);calls.push({path,body});
   return Response.json(path.endsWith('/read')?{status:'current',protocol:'n44-browser-v2',context:remote}:
    path.endsWith('/update')?{status:'updated',context:remote}:path.endsWith('/register')?{status:register,registrationId:first,expiresAt:remote.sessionExpiresAt}:{status:revoke});
  }});
 return {gateway,values,calls,remote,setRegister:v=>register=v,setRevoke:v=>revoke=v};
}
test('original cleanup identity cannot revoke or erase a newer tab registration',async()=>{
 const f=fixture();await f.gateway.read();assert.equal(await f.gateway.register(context,{toJSON:()=>({endpoint:'https://synthetic.invalid/push',keys:{}})}),true);
 const [key]=f.values.keys();f.values.set(key,JSON.stringify({registrationId:newer,...scope}));
 assert.equal(await f.gateway.remove(),true);
 assert.equal(f.calls.at(-1).body.registrationId,first);
 assert.equal(JSON.parse(f.values.get(key)).registrationId,newer);
});
test('HTTP 200 with failed server ACK never becomes register/revoke success; cleanup survives failed ACK',async()=>{
 const f=fixture();await f.gateway.read();f.setRegister('rejected');f.setRevoke('rejected');
 assert.equal(await f.gateway.register(context,{toJSON:()=>({endpoint:'https://synthetic.invalid/push',keys:{}})}),false);
 assert.equal(await f.gateway.remove(),false);assert.equal(f.values.size,1);
 f.setRevoke('revoked');assert.equal(await f.gateway.remove(),true);assert.equal(f.values.size,0);
});
test('backend revision and expired context fail closed before permission eligibility',async()=>{
 const f=fixture();f.remote.sessionExpiresAt=Date.now()-1;await assert.rejects(f.gateway.read());
 const g=createPushGateway({context,authorization:'Bearer FABRICATED',preferences:()=>({}),storage:{getItem:()=>null},fetch:async()=>Response.json({status:'absent'})});
 await assert.rejects(g.read());
});
import {makeFixture} from './fixtures/n44-crypto-sender/fixture.mjs';
import {issueCommittedPermit} from '../drafts/n44-push/committed-permit.mjs';
import {normalizePushEnvelope} from '../src/lib/notification-push-core.js';
test('legacy audited cipher and committed-delivery path remain compatible',async()=>{
 const f=makeFixture();try{assert.equal((await f.register()).status,'registered');assert.equal((await f.deliver()).status,'sent');assert.deepEqual(f.received,f.event);assert.equal(f.networkCalls,1);assert.equal(f.transportFailure,undefined);}finally{f.shutdown();}
});
test('opaque envelope has exact public fields; expired binding cannot cause DNS/decrypt/send',async()=>{
 const f=makeFixture();try{
  const binding={id:'11111111-1111-4111-8111-111111111111',expiresAt:f.now+60000};
  const valid={v:1,binding:binding.id,expiresAt:binding.expiresAt,event:f.event};assert.ok(normalizePushEnvelope(valid,f.now));
  assert.equal(normalizePushEnvelope({...valid,bearer:'rejected'},f.now),null);
  assert.equal(normalizePushEnvelope({...valid,event:{...f.event,student:'rejected'}},f.now),null);
  const permit=issueCommittedPermit({...f.protector.protect(f.subscription),payload:f.event,binding:{...binding,expiresAt:f.now-1}});
  assert.ok(Object.isFrozen(permit.binding));assert.equal(await f.sender.send(permit),'uncertain');assert.equal(f.dnsCalls,0);assert.equal(f.networkCalls,0);
 }finally{f.shutdown();}
});
import {supportedSessionPolicy} from '../drafts/n44-push/session-policy.mjs';
import {createBackend} from '../drafts/n44-push/backend.mjs';
const approvedPolicy=(now,patch={})=>({v:2,approvalId:'cd'.repeat(32),approvalState:'active',serviceRevision:'n44-browser-service-v2',serviceSourceSha:'ab'.repeat(20),policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,observedAt:now,activatedAt:now,metadataSha256:'ab'.repeat(32),...patch});
test('activation-bound policy has no daily operator cutoff; unknown, retired or unsupported stays OFF',()=>{
 const now=Date.now(),profile=approvedPolicy(now),sourceSha=profile.serviceSourceSha;
 assert.equal(supportedSessionPolicy(profile,now,sourceSha),true);
 assert.equal(supportedSessionPolicy(profile,now+26*3600000,sourceSha),true,'normal runtime/cold start continues after 24h without daily renewal');
 for(const candidate of [undefined,{},approvedPolicy(now,{timeboxSeconds:3600}),approvedPolicy(now,{inactivityTimeoutSeconds:3600}),approvedPolicy(now,{singleSessionPerUser:true}),approvedPolicy(now,{approvalState:'retired'}),approvedPolicy(now,{observedAt:now-2*86400000}),approvedPolicy(now,{serviceSourceSha:'ef'.repeat(20)})]){
  assert.equal(supportedSessionPolicy(candidate,now,sourceSha),false);
  assert.throws(()=>createBackend({sessionPolicy:candidate,serviceSourceSha:sourceSha,now:()=>now,acquire(){throw Error('must not acquire');}}));
 }
});
import {createExistingHost} from '../drafts/n44-push/existing-host.mjs';
test('existing host requires exact source revision and policy approval before DB/key access',async()=>{
 const disabled=createExistingHost(name=>{assert.equal(name,'N44_ENABLED');return 'false';});assert.equal((await disabled.handle()).status,503);await disabled.close();
 const profile=approvedPolicy(Date.now(),{inactivityTimeoutSeconds:3600});
 const values={N44_ENABLED:'true',N44_AUTH_URL:'https://auth.synthetic.invalid',N44_PUBLIC_ORIGIN:'https://synthetic.invalid',N44_SERVICE_REVISION:'n44-browser-service-v2',N44_SERVICE_SOURCE_SHA:profile.serviceSourceSha,N44_SESSION_POLICY_JSON:JSON.stringify(profile)};
 assert.throws(()=>createExistingHost(name=>{assert.ok(name in values,'no DB or key reads before policy qualification');return values[name];}),/n44_session_policy_readback_missing/);
});
