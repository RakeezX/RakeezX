// AI: affected gateway ACK/CAS/UNKNOWN/owner fences, actual 15s deadline.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushGateway} from '../../src/lib/notification-push-gateway.js';
const stamp='a'.repeat(64), prefs={lesson:true,due:true,lessonMinutes:15,dueDays:[0],timezone:'Asia/Riyadh',quiet:null};
const scope={workspaceId:'workspace',deviceId:'device'};
const context={...scope,active:true,sessionRevision:'session',consentRevision:'before',pushConsent:true,preferences:prefs,sessionExpiresAt:Date.now()+3600000};
const gateway=options=>createPushGateway({authorization:'Bearer synthetic',context:{ownerId:'synthetic',...scope},preferences:()=>prefs,storage:{getItem:()=>null},...options});
test('projection: explicit null/hex stale retry only once; invalid, missing and UNKNOWN withhold ACK',async()=>{
 for(const current of [null,stamp]){
  const bodies=[];const g=gateway({fetch:async(_url,init)=>{bodies.push(JSON.parse(init.body));return Response.json(bodies.length===1?{status:'stale',sourceStamp:current}:{status:'updated',sourceStamp:stamp});}});
  assert.equal(await g.project('due','source',stamp),stamp);assert.equal(bodies.length,2);assert.equal(bodies[1].expectedStamp,current);
 }
 for(const response of [{status:'stale'}, {status:'stale',sourceStamp:'bad'}, {status:'unknown'}, {status:'updated'}, {status:'updated',sourceStamp:'bad'}, {status:'updated',sourceStamp:[stamp]}, {status:'stale',sourceStamp:[stamp]}]){
  let calls=0;const g=gateway({fetch:async()=>{calls++;return Response.json(response);}});await assert.rejects(g.project('due','source',null));assert.equal(calls,1);
 }
 let calls=0;const g=gateway({fetch:async()=>{calls++;return Response.json({status:'stale',sourceStamp:null});}});await assert.rejects(g.project('due','source',stamp));assert.equal(calls,2);
});
test('projection: owner/session invalidation during response never adopts stamp or retries',async()=>{
 let valid=true,calls=0;const g=gateway({valid:()=>valid,fetch:async()=>{calls++;valid=false;return Response.json({status:'stale',sourceStamp:null});}});await assert.rejects(g.project('due','source',stamp));assert.equal(calls,1);
});
test('stop: actual response deadline preserves UNKNOWN, committed stop reconciles read-only',async()=>{
 let phase='read',writes=0,reads=0;
 const after={...context,consentRevision:'after',pushConsent:false,preferences:{quiet:null,timezone:prefs.timezone,dueDays:[0],lessonMinutes:15,due:true,lesson:true}};
 const g=gateway({fetch:async(url,init)=>{
  if(url.endsWith('/context/read')){reads++;return Response.json({protocol:'n44-browser-v2',status:'current',context:phase==='read'?context:after,registration:null});}
  writes++;phase='committed';return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('synthetic timeout','AbortError')),{once:true}));
 }});
 await g.read();await assert.rejects(g.update(false,{cleanup:true}));assert.equal(writes,1);
 assert.equal((await g.update(false,{cleanup:true})).context.pushConsent,false);assert.equal(writes,1);assert.equal(reads,2);
});
test('stop: no committed change retries original CAS explicitly; changed/new consent or registration refuses',async()=>{
 for(const changed of ['none','consent','session','registration','preferences']){
  let fail=true,observed=context,writes=0;const bodies=[];
  const g=gateway({fetch:async(url,init)=>{
   if(url.endsWith('/context/read'))return Response.json({protocol:'n44-browser-v2',status:'current',context:observed,registration:changed==='registration'&&!fail?{registrationId:'new'}:null});
   writes++;bodies.push(JSON.parse(init.body));if(fail){fail=false;throw Error('lost');}return Response.json({status:'updated',context:{...context,pushConsent:false,consentRevision:'after'}});
  }});
  await g.read();await assert.rejects(g.update(false,{cleanup:true}));
  if(changed==='none'){await g.update(false,{cleanup:true});assert.equal(writes,2);assert.equal(bodies[1].expectedRevision,'before');}
  else{
   observed={...context,consentRevision:'new',sessionRevision:changed==='session'?'foreign':'session',pushConsent:changed==='consent',preferences:changed==='preferences'?{...prefs,due:false}:prefs};
   await assert.rejects(g.update(false,{cleanup:true}));assert.equal(writes,1);
  }
 }
});
