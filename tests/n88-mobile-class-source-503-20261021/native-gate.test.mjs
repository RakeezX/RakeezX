/** AI: original-custodian phase gate with synthetic ports; zero provider I/O. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {writeFile} from 'node:fs/promises';
import {MOBILE503 as c,digest,runMobile503Phase} from './native-gate.mjs';
const factory=()=>{
 const own=new Map(),receipts=new Map(),calls={uploads:0,pins:0,saves:0};let state={directVerified:true,directSource:c.prior,sourceCorrections:[]},version=59,pinned=false;
 const read=async(m,k)=>{if(!m.has(k)){const e=Error('absent');e.code='ENOENT';throw e;}return structuredClone(m.get(k));};
 const p={card:{id:c.task,productId:'N88',status:'running',sessionId:c.session,attempt:{runId:c.run},activationId:'po-20261012-continuous',baseSha:c.base,worktreePath:c.taskRoot,liveAuthorizationRef:c.authorization,preparationAuthority:{kind:'PO-20261021-N88-actual-mobile-source-503',publication:true,realAccountReads:0,realStudentTeacherWrites:0,maxSafeProviderAggregateWindows:0,maxChangedPrivateStaticUploads:0,newReadinessRequests:0,sqlAuthSchemaChanges:0,regionChanges:0,maxChangedNativeFunctionUploads:1,maxPublicSourcePinUpdates:1,originalCustodianRoot:c.originalRoot,appendOnlyAttemptHistory:true,resetConsumedMarkers:false}},run:c.run,candidate:'b'.repeat(40),activationId:'po-20261012-continuous',leases:Object.fromEntries(['integration','live-mutation'].map(name=>[name,{version:2,resource:name,taskId:c.task,activationId:'po-20261012-continuous',owner:{type:'worker',token:c.run}}])),
  verifyCandidate:async candidate=>assert.equal(candidate,'b'.repeat(40)),load:async()=>structuredClone(state),save:async s=>{calls.saves++;state=structuredClone(s);},readOwned:name=>read(own,name),writeOwned:async(name,data)=>{assert(!own.has(name));own.set(name,structuredClone(data));},readReceipt:name=>read(receipts,name),writeReceipt:async(name,data)=>{assert(!receipts.has(name));receipts.set(name,structuredClone(data));},
  readProvider:async(when,expected)=>({source:expected,sourceExact:true,version,verifyJwt:false,pinDigest:digest(pinned?c.source:c.prior),otherConfigDigest:'a'.repeat(64),importMapDigest:'d'.repeat(64)}),
  upload:async()=>{calls.uploads++;version++;},pin:async()=>{calls.pins++;pinned=true;version++;},readTransport:async()=>({safeAnonymousDenial:true,region:'ap-south-1'})};
 return {p,own,receipts,calls,state:()=>state};
};
const results=[];
await test('fresh task/run/lease authority; exact one-upload/pin/history completion',async()=>{
 const f=factory();for(const action of ['preflight','upload','pin','complete'])assert.equal((await runMobile503Phase(action,f.p)).status,'PASS');
 assert.deepEqual(f.calls,{uploads:1,pins:1,saves:1});assert.equal(f.state().directSource,c.source);assert.equal(f.state().sourceCorrections.length,1);
 await assert.rejects(runMobile503Phase('upload',f.p));await assert.rejects(runMobile503Phase('pin',f.p));assert.equal(f.calls.uploads,1);assert.equal(f.calls.pins,1);results.push('one upload, pin and append-only completion; repeat mutations denied');
});
await test('wrong session/run/candidate/lease and expanded data authority deny before ports',async()=>{
 for(const mutate of [p=>p.run='wrong',p=>p.card.sessionId='other',p=>p.candidate='short',p=>p.leases.integration.owner.token='other',p=>p.leases['live-mutation'].taskId='other',p=>p.card.preparationAuthority.realAccountReads=1,p=>p.card.preparationAuthority.maxChangedNativeFunctionUploads=2,p=>p.card.liveAuthorizationRef='other']){
  const f=factory();mutate(f.p);await assert.rejects(runMobile503Phase('preflight',f.p));assert.equal(f.own.size,0);assert.equal(f.receipts.size,0);
 }results.push('identity, current leases and exact authority negatives');
});
await test('fresh source/config drift and stale receipt deny before reservation',async()=>{
 const f=factory();await runMobile503Phase('preflight',f.p);const original=f.p.readProvider;f.p.readProvider=async(...a)=>({...await original(...a),otherConfigDigest:'f'.repeat(64)});
 await assert.rejects(runMobile503Phase('upload',f.p));assert.equal(f.own.size,0);assert.equal(f.calls.uploads,0);
 const g=factory();await runMobile503Phase('preflight',g.p);g.receipts.get('native-preflight').observedAt='2000-01-01T00:00:00Z';await assert.rejects(runMobile503Phase('upload',g.p));assert.equal(g.calls.uploads,0);results.push('fresh provider preimage and receipt freshness fences');
});
await test('uncertain upload retains consumed marker; no unchanged retry',async()=>{
 const f=factory();await runMobile503Phase('preflight',f.p);f.p.upload=async()=>{f.calls.uploads++;throw Error('synthetic unknown upload');};
 await assert.rejects(runMobile503Phase('upload',f.p));assert(f.own.has('mobile503-native-attempt.json'));await assert.rejects(runMobile503Phase('upload',f.p));assert.equal(f.calls.uploads,1);assert.equal(f.calls.pins,0);results.push('uncertain upload is consumed and cannot repeat');
});
await test('pin requires exact uploaded receipt; uncertain pin cannot repeat',async()=>{
 const f=factory();await runMobile503Phase('preflight',f.p);await assert.rejects(runMobile503Phase('pin',f.p));assert.equal(f.calls.pins,0);
 await runMobile503Phase('upload',f.p);f.p.pin=async()=>{f.calls.pins++;throw Error('synthetic uncertain pin');};await assert.rejects(runMobile503Phase('pin',f.p));assert(f.own.has('mobile503-pin-attempt.json'));await assert.rejects(runMobile503Phase('pin',f.p));assert.equal(f.calls.pins,1);assert.equal(f.calls.saves,0);results.push('upload/pin ordering and uncertain-pin one-shot');
});
await test('served transport failure never records success or advances custody',async()=>{
 const f=factory();for(const a of ['preflight','upload','pin'])await runMobile503Phase(a,f.p);f.p.readTransport=async()=>({safeAnonymousDenial:false,region:'unknown'});await assert.rejects(runMobile503Phase('complete',f.p));assert.equal(f.state().directSource,c.prior);assert.equal(f.calls.saves,0);assert(!f.own.has('mobile503-native-complete.json'));results.push('served parity failure remains failure without custody advancement');
});
await writeFile('tests/n88-mobile-class-source-503-20261021/native-gate-tests.json',JSON.stringify({status:'PASS',scope:'Synthetic gate ports only; no live operation',checks:results},null,2)+'\n');
