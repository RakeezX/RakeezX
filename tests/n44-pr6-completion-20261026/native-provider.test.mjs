import '../../drafts/n44-push/node-globals.mjs';
/** AI: integrated original native branch, existing fixture, no network or subscriptions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFixture,ORIGIN} from '../fixtures/n44-crypto-sender/fixture.mjs';
import {createAuditedSender} from '../../drafts/n44-push/audited-sender.mjs';
import {WNS_WEBPUSH_ORIGIN} from '../../drafts/n44-push/shared.mjs';
const endpoint='https://wns2-ln2p.notify.windows.com/w/?token=SYNTHETIC_ONLY%2FABC%3D';
for(const [name,options,code,expected] of [
 ['WNS200',{origin:WNS_WEBPUSH_ORIGIN,endpoint,wns:true},200,'sent'],
 ['WNS201',{origin:WNS_WEBPUSH_ORIGIN,endpoint,wns:true},201,'sent'],
 ['FCM200',{},200,'uncertain'],
 ['FCM201',{},201,'sent']]) test('integrated native branch '+name+' preserves policy/opaque query and committed permit',async()=>{
 const f=makeFixture(options);let calls=0;f.sender.close();
 f.sender=createAuditedSender({...f.senderOptions,nativeExchange:async v=>{
  calls++;const u=new URL(f.subscription.endpoint);assert.equal(v.hostname,u.hostname);assert.equal(v.path,u.pathname+u.search);assert.equal(v.method,'POST');assert.equal(v.pin.address,'142.250.190.10');assert(v.body.length>0);assert(Number(v.headers.TTL)>0);assert(!Object.keys(v.headers).some(k=>k.toLowerCase()==='content-length'));
  if(options.wns){assert.equal(v.headers['X-WNS-Type'],'wns/raw');assert.equal(v.headers['Content-Type'],'application/octet-stream');assert(!('Urgency'in v.headers));}else{assert.equal(v.headers.Urgency,'normal');assert(!('X-WNS-Type'in v.headers));}
  return {statusCode:code,pinMatch:true,tlsVerified:true,requestWritten:true,closed:true};
 }});
 try{assert.equal((await f.register()).status,'registered');assert.equal((await f.deliver()).status,expected);assert.equal(calls,1);assert.equal(f.networkCalls,0);await f.deliver();assert.equal(calls,1,'same committed delivery cannot issue another request');}finally{f.shutdown();}
});
for(const broken of ['pinMatch','tlsVerified','requestWritten','closed'])test('native '+broken+' failure remains uncertain',async()=>{
 const f=makeFixture();let calls=0;f.sender.close();f.sender=createAuditedSender({...f.senderOptions,nativeExchange:async()=>{calls++;return{statusCode:201,pinMatch:true,tlsVerified:true,requestWritten:true,closed:true,[broken]:false};}});
 try{assert.equal((await f.register()).status,'registered');assert.equal((await f.deliver()).status,'uncertain');assert.equal(calls,1);assert.equal(f.networkCalls,0);}finally{f.shutdown();}
});
