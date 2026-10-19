/** AI: focused synthetic ports, zero provider/SQL/Auth operations. */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {MessageChannel} from 'node:worker_threads';
import {fixture,RID,payload} from './fixtures/n44-server-preactivation/fakes.mjs';
import {createDeliveryBoundary} from '../drafts/n44-push/delivery.mjs';
import {oneDeviceGuard,deviceApproval,publicDeviceConfiguration,DEVICE_TEST_ID} from '../drafts/n44-push/one-device-test.mjs';
const checks=[];
const check=(name,evidence)=>checks.push({name,status:'PASS',evidence});
const approval=f=>({testId:DEVICE_TEST_ID,runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',ownerId:'owner-A',workspaceId:'workspace-A',deviceId:'device-A',expiresAt:f.now+3600000,target:{registrationId:RID,eventId:payload().id}});
for(const outcome of ['accepted','not_accepted_retryable','uncertain']) {
 const f=fixture(),a=approval(f);await f.register();f.outcome=outcome;
 const make=patch=>createDeliveryBoundary({...f.deliveryOptions,envelope:true,bindingExpiresAt:a.expiresAt,maxAttempts:1,beforePermit:oneDeviceGuard({...a,...patch})});
 let d=make();
 for(const [owner,rid,event] of [['owner-B',RID,payload()],['owner-A','22222222-2222-4222-8222-222222222222',payload()],['owner-A',RID,{...payload(),id:'wrong-event'}]])await d.deliver(owner,rid,event);
 assert.equal(f.sends.length,0);
 f.sendHook=()=>{
  const state=f.state();assert.equal(state.budgets.get('day:'+DEVICE_TEST_ID).count,1);
  assert.ok([...state.budgets.keys()].some(k=>k.startsWith('day:'+DEVICE_TEST_ID+':')));
  assert.equal([...state.deliveries.values()].find(j=>j.registrationId===RID).state,'sending');
 };
 await Promise.all([d.deliver('owner-A',RID,payload()),d.deliver('owner-A',RID,payload())]);
 assert.equal(f.sends.length,1);assert.ok(f.sends[0].binding.expiresAt<=a.expiresAt);
 f.now+=180000;
 await make().deliver('owner-A',RID,payload());
 await make({runId:'11111111-1111-4111-8111-111111111111'}).deliver('owner-A',RID,payload());
 assert.equal(f.sends.length,1,'restart/new run cannot replenish the committed total');
}
check('single_target_durable_total_attempt_budget','Actual delivery boundary with existing serializable synthetic repository: wrong owner/registration/event deny; two concurrent calls send once; fixed authority and run/target hash persisted before sender; accepted/429/unknown outcomes and new run cannot retry.');
{
 const f=fixture();await f.register();const a=approval(f);
 const d=createDeliveryBoundary({...f.deliveryOptions,maxAttempts:1,beforePermit:oneDeviceGuard(a)});
 f.failCommit=true;await d.deliver('owner-A',RID,payload());assert.equal(f.sends.length,0,'failed ACK never invokes sender');
 f.context.pushConsent=false;await d.deliver('owner-A',RID,payload());assert.equal(f.sends.length,0);
 assert.equal(deviceApproval({...a,expiresAt:f.now+2*86400000},f.now),null);
 assert.equal(publicDeviceConfiguration(a,'owner-B',a,'B'+'A'.repeat(86),'a'.repeat(40),f.now).status,'disabled');
 assert.equal(publicDeviceConfiguration(a,'owner-A',a,null,'a'.repeat(40),f.now).status,'disabled');
 assert.equal(publicDeviceConfiguration(a,'owner-A',a,'B'+'A'.repeat(86),'a'.repeat(40),f.now).status,'ready');
}
check('owner_consent_expiry_and_commit_ack_failclosed','Missing consent, wrong owner/key, approval expiry and failed durable commit prevent test transmission. No actual provider request.');
// Actual SW source is executed, not a duplicated implementation.
{
 const source=await readFile('sw.js','utf8'),handlers={},cache=new Map(),shown=[];
 const client={type:'window',url:'https://synthetic.invalid/'};
 const sandbox={URL,Request,Response,MessageChannel,Date,Map,setTimeout,clearTimeout,console,
  self:{location:{origin:'https://synthetic.invalid'},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>[]},registration:{getNotifications:async()=>[],showNotification:async(t,o)=>shown.push(o)}},
  caches:{keys:async()=>[],open:async()=>({match:async k=>cache.get(typeof k==='string'?k:k.url)?.clone(),put:async(k,v)=>cache.set(typeof k==='string'?k:k.url,v.clone())})},fetch:async()=>{throw Error('offline');}};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const fire=async(n,e)=>{let work;handlers[n]({...e,waitUntil:p=>work=p});await work;};
 const message=async(data,from=client)=>{let reply;await fire('message',{source:from,data,ports:[{postMessage:v=>reply=v,close(){}}]});return reply;};
 const expiresAt=Date.now()+60000,event={id:'due:synthetic:2026-10-19',kind:'due',expiresAt,actionPath:'/teaching/synthetic/items'};
 const envelope={v:1,binding:RID,expiresAt,event};
 const push=raw=>fire('push',{data:{text:()=>JSON.stringify(raw)}});
 await push(envelope);assert.equal(shown.length,0);
 assert.equal(await message({type:'n44-consent-bind',binding:RID,expiresAt},{type:'window',url:'https://foreign.invalid/'}),undefined);
 assert.equal((await message({type:'n44-consent-bind',binding:RID,expiresAt})).ok,true);
 await push({...envelope,binding:'22222222-2222-4222-8222-222222222222'});assert.equal(shown.length,0);
 await push(envelope);await push(envelope);assert.equal(shown.length,1);
 await message({type:'n44-consent-clear',binding:RID});await push({...envelope,event:{...event,id:'due:next:2026-10-19'}});assert.equal(shown.length,1);
 for(const file of ['runtime','browser','gateway','client','core'])assert.ok(vm.runInContext('SHELL',sandbox).includes('./src/lib/notification-push-'+file+'.js'));
 for(const url of ['/api/n44/push/config','/__n44_device_consent']){let intercepted=false;handlers.fetch({request:new Request('https://synthetic.invalid'+url),respondWith(){intercepted=true;}});assert.equal(intercepted,false);}
 const asset='https://synthetic.invalid/src/lib/notification-push-runtime.js';cache.set(asset,new Response('cached actual shell asset'));
 let response;handlers.fetch({request:new Request(asset),respondWith:p=>response=p,waitUntil(){}});assert.equal(await(await response).text(),'cached actual shell asset');
}
check('actual_sw_binding_dedupe_clear_and_offline_shell','Actual sw.js in disposable VM: no consent/no display, foreign-client bind denied, wrong binding denied, one generic callback, duplicate suppressed, clear blocks later callback; startup assets remain shell-listed/offline-served and config/private consent routes bypass cache. No OS notification or browser registration.');
await writeFile('tests/n44-device-1019-guards.json',JSON.stringify({taskId:'continuous-n44-single-device-optin-ready-20261019',runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',checks,actualProviderSendAttempts:0,actualRegistrations:0,hostedStatus:'NOT_RUN'},null,2)+'\n');
console.log('PASS: '+checks.length+' focused synthetic guard/SW checks; zero live operations.');
