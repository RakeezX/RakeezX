/** Focused no-egress qualification. No real identities, VAPID or subscriptions. */
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { assertNoPrivatePushImports } from './n44-crypto-sender-import-guard.mjs';
import { execFileSync } from 'node:child_process';
import { createSubscriptionProtector } from '../drafts/n44-push/subscription-protector.mjs';
import { createAuditedSender } from '../drafts/n44-push/audited-sender.mjs';
import { issueCommittedPermit } from '../drafts/n44-push/committed-permit.mjs';
import { approvedProviderOrigins, publicAddress } from '../drafts/n44-push/provider-policy.mjs';
import { createPushClient } from '../src/lib/notification-push-client.js';
import { LIMITS } from '../drafts/n44-push/shared.mjs';
import { createPrivatePushPorts, createPrivateRuntime } from '../drafts/n44-push/private-runtime.mjs';
import { makeFixture, cryptoConfig, keys, ORIGIN, RID, PUBLIC } from './fixtures/n44-crypto-sender/fixture.mjs';

const report={taskId:'continuous-n44-audited-protector-and-sender-20261018',
  runId:'9c9ee4fd-ab29-43ae-b190-84c9dbcb3a6b',baseSha:'faa3cd5c32895148d5220ec9b34dd3f07a82cb5e',
  node:process.version,startedAt:new Date().toISOString(),cases:[],checks:[],networkAttempts:0};
const fixtures=new Set(), extras=new Set();
const fmake=options=>{const f=makeFixture(options);fixtures.add(f);return f;};
const pcreate=config=>{const p=createSubscriptionProtector(config);extras.add(p);return p;};
const screate=config=>{const s=createAuditedSender(config);extras.add(s);return s;};
const committed=(f,changes={})=>issueCommittedPermit({...f.protector.protect(f.subscription),payload:f.event,...changes});
const deny=fn=>assert.throws(fn,e=>e.message==='n44_crypto_unavailable');
const cases=[];
function test(name,run){cases.push({name,run});}

test('actual protection -> authenticated registration -> committed reservation -> audited bytes -> receiver',async()=>{
  for(const path of ['/wp/SYNTHETIC-DO-NOT-SEND','/fcm/send/SYNTHETIC-DO-NOT-SEND']){
    const f=fmake({assertCommitted:true});f.subscription.endpoint=ORIGIN+path;
    assert.equal((await f.register()).status,'registered');
    const row=f.state().registrations.get(RID);
    assert.equal(row.sealed.includes(ORIGIN),false);assert.equal(row.sealed.includes(f.subscription.keys.auth),false);
    assert.equal((await f.register()).status,'registered');
    const outcomes=await Promise.all(Array.from({length:12},()=>f.deliver()));
    assert.equal(outcomes.filter(r=>r.status==='sent').length,1);
    assert.equal(outcomes.filter(r=>r.status==='duplicate').length,11);
    assert.equal(f.networkCalls,1);assert.equal(f.dnsCalls,1);assert.equal(f.transportChecks,1);
    assert.equal(f.transportFailure,undefined);
    assert.ok(f.requests.every(r=>r.destroyed));assert.ok(f.responses.every(r=>r.destroyed));
  }
});
test('Mozilla and Apple Web Push use the same audited encrypted VAPID transport without egress', async () => {
  for (const [origin, path] of [
    ['https://updates.push.services.mozilla.com', '/wpush/v2/SYNTHETIC-DO-NOT-SEND'],
    ['https://web.push.apple.com', '/Q_SYNTHETIC-DO-NOT-SEND'],
  ]) {
    const f=fmake({origin,endpoint:origin+path,assertCommitted:true});
    assert.equal((await f.register()).status,'registered');
    assert.equal((await f.deliver()).status,'sent');
    assert.deepEqual(f.received,f.event);
    assert.equal(f.networkCalls,1);
    assert.equal(f.dnsCalls,1);
    assert.equal(f.transportChecks,1);
    assert.equal(f.transportFailure,undefined);
    assert.ok(f.requests.every(r=>r.destroyed));
  }
});
test('versioned authenticated envelope, independent HMAC domains and strict tamper denial',()=>{
  const f=fmake(),p=f.protector,a=p.protect(f.subscription),b=p.protect(f.subscription);
  assert.notEqual(a.sealed,b.sealed);assert.equal(a.fingerprint,b.fingerprint);
  assert.notEqual(a.bindingFingerprint,a.fingerprint);
  assert.deepEqual(p.open(a.sealed,a),{subscription:f.subscription,vapidKeyId:'vapid-1'});
  const next={...f.subscription,keys:{...f.subscription.keys,auth:randomBytes(16).toString('base64url')}};
  const changed=p.protect(next);assert.equal(changed.fingerprint,a.fingerprint);
  assert.notEqual(changed.bindingFingerprint,a.bindingFingerprint);deny(()=>p.open(changed.sealed,a));
  const swap=p.protect({...f.subscription,endpoint:ORIGIN+'/wp/OTHER-SYNTHETIC'});
  assert.notEqual(swap.fingerprint,a.fingerprint);deny(()=>p.open(swap.sealed,a));
  for(const [field,value] of [['v',2],['kid','unknown'],['hkid','unknown'],['vapidKeyId','unknown'],['fingerprint','0'.repeat(64)],
    ['bindingFingerprint','0'.repeat(64)],['iv',randomBytes(12).toString('base64url')],
    ['tag',randomBytes(16).toString('base64url')],['ciphertext',randomBytes(80).toString('base64url')]]){
    const e=JSON.parse(a.sealed);e[field]=value;deny(()=>p.open(JSON.stringify(e),a));
  }
  deny(()=>p.open(a.sealed+' ',a));deny(()=>p.open(a.sealed.replace('"v":1','"v":1,"v":1'),a));
  deny(()=>p.open(a.sealed,{}));
  const config=cryptoConfig();config.endpointHmacKeys=new Map([['fp-1',config.sealingKeys.get('seal-1')]]);
  deny(()=>pcreate(config));
  const shared=cryptoConfig();shared.bindingHmacKeys=shared.endpointHmacKeys;deny(()=>pcreate(shared));
});
test('decrypted minimal payload executes existing consumer action handler with current authorization and expiry',async()=>{
  const f=fmake();await f.register();assert.equal((await f.deliver()).status,'sent');
  let context={mode:'account',verified:true,ownerId:'owner-A',workspaceId:'workspace-A',deviceId:'device-A',authRevision:'revision-1'};
  let navigation=0,authorized=true;
  const client=createPushClient({getVerifiedContext:()=>context,clock:()=>f.now,
    browser:{navigate:path=>{assert.equal(path,f.event.actionPath);navigation++;}},
    gateway:{authorizeEvent:async ctx=>authorized&&ctx.ownerId==='owner-A'},resolveAction:()=>f.event.actionPath});
  assert.equal((await client.applyAction(f.received)).status,'action_applied');assert.equal(navigation,1);
  authorized=false;assert.equal((await client.applyAction(f.received)).status,'action_rejected');
  authorized=true;context={...context,ownerId:'owner-B'};
  assert.equal((await client.applyAction(f.received)).status,'action_rejected');
  context={...context,ownerId:'owner-A'};f.now=f.event.expiresAt;
  assert.equal((await client.applyAction(f.received)).status,'action_rejected');assert.equal(navigation,1);
});
test('seal key rotation and unknown/retired keys; fingerprint epoch stable across live bindings',()=>{
  const f=fmake(),old=f.protector.protect(f.subscription),config=f.cryptoConfig;
  const rotated=pcreate({...config,activeKeyId:'seal-2',sealingKeys:new Map([...config.sealingKeys,['seal-2',randomBytes(32)]])});
  assert.deepEqual(rotated.open(old.sealed,old),{subscription:f.subscription,vapidKeyId:'vapid-1'});
  const current=rotated.protect(f.subscription);assert.equal(JSON.parse(current.sealed).kid,'seal-2');
  assert.equal(current.fingerprint,old.fingerprint);assert.equal(current.bindingFingerprint,old.bindingFingerprint);
  deny(()=>f.protector.open(current.sealed,current));
  const retired=pcreate({...config,activeKeyId:'seal-2',sealingKeys:new Map([['seal-2',randomBytes(32)]])});
  deny(()=>retired.open(old.sealed,old));
  const unknownHash=pcreate({...config,fingerprintKeyId:'fp-2',endpointHmacKeys:new Map([['fp-2',randomBytes(32)]]),bindingHmacKeys:new Map([['fp-2',randomBytes(32)]])});
  deny(()=>unknownHash.open(old.sealed,old));
  const original=f.cryptoConfig.sealingKeys.get('seal-1');original.fill(0);
  assert.deepEqual(f.protector.open(old.sealed,old),{subscription:f.subscription,vapidKeyId:'vapid-1'}); // immutable key snapshot
});
test('OpenSSL curve validation, canonical encodings, exact documented provider and path',()=>{
  const f=fmake(),point=Buffer.alloc(65);point[0]=4;
  for(const p256dh of [point.toString('base64url'),'A'.repeat(87),f.subscription.keys.p256dh+'='])
    deny(()=>f.protector.protect({...f.subscription,keys:{...f.subscription.keys,p256dh}}));
  for(const endpoint of ['https://fcm.googleapis.com/','https://fcm.googleapis.com/v1/projects/x/messages:send',
    'https://fcm.googleapis.com/wp/a?x=1','https://fcm.googleapis.com/wp/a#x','https://fcm.googleapis.com:443/wp/a',
    'https://u:p@fcm.googleapis.com/wp/a','https://fcm.googleapis.com.evil.invalid/wp/a',
    'https://127.0.0.1/wp/a','http://fcm.googleapis.com/wp/a','https://fcm.googleapis.com/wp/a%2Fb',
    'https://fcm.googleapis.com/preprod/wp/a','https://push.example.test/device-1'])
    deny(()=>f.protector.protect({...f.subscription,endpoint}));
  deny(()=>approvedProviderOrigins(['https://push.example.test']));
  deny(()=>approvedProviderOrigins(['https://fcm.googleapis.com.evil.invalid']));
  const disabled=pcreate({...f.cryptoConfig,providerOrigins:[]});deny(()=>disabled.protect(f.subscription));
  assert.equal(publicAddress('8.8.8.8',4),true);assert.equal(publicAddress('2606:4700:4700::1111',6),true);
});
test('VAPID rotation retains authenticated per-subscription key ID and denies unknown/retired signing keys',async()=>{
  const f=fmake(),old=f.protector.protect(f.subscription),next=keys();
  const nextVapid={subject:'mailto:synthetic-rotation@example.invalid',publicKey:next.publicKey,privateKey:next.privateKey};
  const sender=screate({...f.senderOptions,vapidKeys:new Map([...f.vapidKeys,['vapid-2',nextVapid]])});
  assert.equal(await sender.send(issueCommittedPermit({...old,payload:f.event})),'accepted');
  const nextProtector=pcreate({...f.cryptoConfig,activeVapidKeyId:'vapid-2'});
  const current=nextProtector.protect(f.subscription);
  assert.equal(current.fingerprint,old.fingerprint);assert.notEqual(current.bindingFingerprint,old.bindingFingerprint);
  assert.equal(await f.sender.send(issueCommittedPermit({...current,payload:f.event})),'uncertain');
  assert.equal(f.networkCalls,1); // old signer never substitutes its key for unknown ID
  f.expectedVapid=nextVapid;
  assert.equal(await sender.send(issueCommittedPermit({...current,payload:f.event})),'accepted');
  assert.equal(f.transportFailure,undefined);assert.equal(f.networkCalls,2);
  const retired=screate({...f.senderOptions,vapidKeys:new Map([['vapid-2',nextVapid]])});
  assert.equal(await retired.send(issueCommittedPermit({...old,payload:f.event})),'uncertain');assert.equal(f.networkCalls,2);
  assert.throws(()=>createPrivatePushPorts({enabled:true,...f.cryptoConfig,vapidKeys:new Map([['vapid-2',nextVapid]])}),
    e=>e.message==='n44_crypto_unavailable');
});
test('uncommitted/serialized/replayed/expired capabilities never decrypt or send',async()=>{
  const f=fmake();let opens=0;
  const s=screate({...f.senderOptions,protector:{open(...args){opens++;return f.protector.open(...args);}}});
  const raw={...f.protector.protect(f.subscription),payload:f.event};
  assert.equal(await s.send(raw),'uncertain');assert.equal(await s.send(structuredClone(issueCommittedPermit(raw))),'uncertain');
  assert.equal(opens,0);assert.equal(f.networkCalls,0);
  const expired=committed(f);f.now=f.event.expiresAt;
  assert.equal(await s.send(expired),'uncertain');assert.equal(opens,0);
  f.now-=1000_000; // restore test clock only
  const permit=committed(f);assert.equal(await s.send(permit),'accepted');
  assert.equal(await s.send(permit),'uncertain');assert.equal(opens,1);assert.equal(f.networkCalls,1);
});
test('rollback before commit denies encryption/send; current owner/session/consent retained',async()=>{
  const f=fmake();f.failCommit=true;assert.equal((await f.register()).status,'unavailable');assert.equal(f.networkCalls,0);
  assert.equal((await f.register()).status,'registered');
  f.failCommit=true;assert.equal((await f.deliver()).status,'unavailable');assert.equal(f.dnsCalls,0);assert.equal(f.state().deliveries.size,0);
  f.auth.ownerId='owner-B';assert.equal((await f.register()).status,'rejected');f.auth.ownerId='owner-A';
  f.context.pushConsent=false;assert.equal((await f.deliver()).status,'suppressed');assert.equal(f.dnsCalls,0);
  const g=fmake();await g.register();g.context.active=false;await g.delivery.cleanup('owner-A');
  const row=g.state().registrations.get(RID);assert.equal(row.sealed,null);assert.equal(row.fingerprint,null);
  assert.equal(g.endpoints.size,0);assert.equal((await g.register()).status,'rejected');
});
test('sender rechecks sealed binding and current provider policy, with no transport on swaps',async()=>{
  const f=fmake();
  const a=f.protector.protect(f.subscription),b=f.protector.protect({...f.subscription,endpoint:ORIGIN+'/wp/ANOTHER-SYNTHETIC'});
  assert.equal(await f.sender.send(issueCommittedPermit({...a,sealed:b.sealed,payload:f.event})),'uncertain');
  const changed=f.protector.protect({...f.subscription,keys:{...f.subscription.keys,auth:randomBytes(16).toString('base64url')}});
  assert.equal(await f.sender.send(issueCommittedPermit({...a,sealed:changed.sealed,payload:f.event})),'uncertain');
  // Even a faulty trusted opener cannot widen the sender's provider policy.
  const s=screate({...f.senderOptions,protector:{open:()=>({subscription:{...f.subscription,endpoint:'https://push.example.test/device-1'},vapidKeyId:'vapid-1'})}});
  assert.equal(await s.send(committed(f)),'uncertain');assert.equal(f.dnsCalls,0);assert.equal(f.networkCalls,0);
});
test('DNS private/linklocal/metadata/reserved/mapped answers and mixed sets are rejected',async()=>{
  const bad=['0.0.0.0','10.0.0.1','127.0.0.1','169.254.169.254','168.63.129.16','172.16.0.1','192.168.1.1','100.64.0.1',
    '192.0.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','240.0.0.1','255.255.255.255',
    '::','::1','::ffff:8.8.8.8','::ffff:127.0.0.1','fc00::1','fe80::1','ff02::1','2001:db8::1','2001::1',
    '2002:0808:0808::1','64:ff9b::808:808','3fff::1','4000::1','fe80::1%eth0'];
  const f=fmake();
  for(const address of bad){
    const family=address.includes(':')?6:4;assert.equal(publicAddress(address,family),false);
    f.resolveHook=()=>[{address,family}];
    assert.equal(await f.sender.send(committed(f)),'uncertain');
  }
  for(const answers of [[],[{address:PUBLIC.address,family:6}],[{...PUBLIC},{address:'10.0.0.1',family:4}],Array(17).fill(PUBLIC)]){
    f.resolveHook=()=>answers;assert.equal(await f.sender.send(committed(f)),'uncertain');
  }
  assert.equal(f.networkCalls,0);
});
test('connection lookup pinned across rebinding, wrong certificate/address fail closed',async()=>{
  const f=fmake();f.resolveHook=()=>{f.resolveHook=()=>[{address:'169.254.169.254',family:4}];return [{...PUBLIC}];};
  assert.equal(await f.sender.send(committed(f)),'accepted');assert.equal(f.dnsCalls,1);assert.equal(f.transportChecks,1);
  for(const change of [{tlsAuthorized:false},{remoteAddress:'10.0.0.1'}]){
    const g=fmake();Object.assign(g,change);assert.equal(await g.sender.send(committed(g)),'uncertain');
    assert.equal(g.networkCalls,1);assert.ok(g.requests[0].destroyed);
  }
  const ipv6=fmake();ipv6.pin={address:'2606:4700:4700::1111',family:6};ipv6.resolveHook=()=>[ipv6.pin];
  assert.equal(await ipv6.sender.send(committed(ipv6)),'accepted');assert.equal(ipv6.transportChecks,1);
});
test('fixed definitive outcomes, no redirect/replay and original-only 404/410 erasure',async()=>{
  for(const [code,state] of [[201,'sent'],[202,'sent'],[404,'dead'],[410,'dead'],[429,'retry'],
    [200,'uncertain'],[301,'uncertain'],[302,'uncertain'],[307,'uncertain'],[308,'uncertain'],[401,'uncertain'],[500,'uncertain'],[503,'uncertain']]){
    const f=fmake();f.statusCode=code;await f.register();assert.equal((await f.deliver()).status,state);
    assert.equal(f.networkCalls,1);assert.equal(f.transportFailure,undefined);
    assert.equal((await f.deliver()).status,state==='retry'?'backoff':'duplicate');assert.equal(f.networkCalls,1);
    if(state==='dead'){assert.equal(f.state().registrations.get(RID).sealed,null);assert.equal(f.endpoints.size,0);}
    if(state==='retry'){
      f.now+=LIMITS.retryBaseMs;f.statusCode=201;assert.equal((await f.deliver()).status,'sent');assert.equal(f.networkCalls,2);
    }
  }
});
test('absolute DNS/transport deadline, abort/close and late accepted outcomes stay uncertain',async()=>{
  const f=fmake();f.hang=true;f.deadlineMs=20;await f.register();assert.equal((await f.deliver()).status,'uncertain');
  assert.equal(f.networkCalls,1);assert.ok(f.requests[0].destroyed);f.respond(201);
  assert.equal((await f.deliver()).status,'duplicate');assert.equal(f.networkCalls,1);
  const g=fmake();g.resolveHook=()=>new Promise(()=>{});
  assert.equal(await g.sender.send(committed(g),{deadlineMs:20}),'uncertain');assert.equal(g.networkCalls,0);
  const h=fmake(),abort=new AbortController();h.signal=abort.signal;h.sendHook=()=>abort.abort();
  await h.register();assert.equal((await h.deliver()).status,'uncertain');assert.ok(h.requests[0].destroyed);
  const i=fmake();i.sendHook=()=>i.sender.close();
  assert.equal(await i.sender.send(committed(i)),'uncertain');assert.ok(i.requests[0].destroyed);
  const j=fmake();j.requestError=true;await j.register();assert.equal((await j.deliver()).status,'uncertain');assert.equal(j.networkCalls,1);
  const k=fmake();k.resolveHook=()=>{k.now=k.event.expiresAt;return [PUBLIC];};
  assert.equal(await k.sender.send(committed(k)),'uncertain');assert.equal(k.networkCalls,0);
});
test('late revoke and completion-commit failure preserve uncertain fence and retention deletion',async()=>{
  const f=fmake();await f.register();f.sendHook=async respond=>{await f.revoke();respond(201);};
  assert.equal((await f.deliver()).status,'uncertain');assert.equal(f.state().registrations.get(RID).sealed,null);
  assert.equal((await f.deliver()).status,'duplicate');assert.equal(f.networkCalls,1);
  const g=fmake();await g.register();g.sendHook=respond=>{g.failCommit=true;respond(201);};
  assert.equal((await g.deliver()).status,'unavailable');assert.equal(g.networkCalls,1);
  g.now+=LIMITS.uncertainMs;await g.delivery.cleanup('owner-A');
  assert.equal((await g.deliver()).status,'duplicate');assert.equal(g.networkCalls,1);
  g.now+=LIMITS.registrationMs+LIMITS.receiptMs;await g.delivery.cleanup('owner-A');
  assert.equal(g.state().registrations.size,0);assert.equal(g.state().deliveries.size,0);assert.equal(g.state().budgets.size,0);assert.equal(g.endpoints.size,0);
});
test('disabled by default, key pair mismatch, abort and closed-key failures are private',async()=>{
  const f=fmake();assert.equal(await createAuditedSender().send(committed(f)),'uncertain');assert.equal(f.networkCalls,0);
  const leadingZero=keys(Buffer.from([1]));assert.equal(Buffer.from(leadingZero.privateKey,'base64url').length,32);
  screate({...f.senderOptions,vapidKeys:new Map([['vapid-1',{...f.vapid,...leadingZero}]])});
  assert.throws(()=>screate({...f.senderOptions,vapidKeys:new Map([['vapid-1',{...f.vapid,privateKey:keys().privateKey}]])}),e=>e.message==='n44_sender_unavailable');
  const a=new AbortController();a.abort();assert.equal(await f.sender.send(committed(f),{signal:a.signal}),'uncertain');
  deny(()=>f.protector.protect(f.subscription,{signal:a.signal}));
  f.protector.close();deny(()=>f.protector.protect(f.subscription));
  f.sender.close();assert.equal(await f.sender.send(issueCommittedPermit({payload:f.event})),'uncertain');
});
test('usable inactive host composition binds actual crypto ports; runtime stays disabled without prerequisites',async()=>{
  const f=fmake();
  const ports=createPrivatePushPorts({enabled:true,...f.cryptoConfig,vapidKeys:f.vapidKeys},
    {clock:()=>f.now,resolve:f.resolve,httpsRequest:f.httpsRequest});extras.add(ports);
  const sealed=ports.protect(f.subscription);
  assert.equal(await ports.sender.send(issueCommittedPermit({...sealed,payload:f.event})),'accepted');
  assert.equal(f.transportChecks,1);
  const runtime=createPrivateRuntime();extras.add(runtime);
  assert.equal(runtime.preflight.status,'disabled');assert.equal((await runtime.runDelivery()).status,'disabled');
  let closed=0;
  const configured=createPrivateRuntime({enabled:true,deliveryEnabled:true,providerOrigins:[ORIGIN],
    applicationOrigins:['https://app.example.invalid'],requestDeadlineMs:1000},
    {close:async()=>{closed++;}}, {...f.cryptoConfig,vapidKeys:f.vapidKeys},
    {clock:()=>f.now,resolve:f.resolve,httpsRequest:f.httpsRequest});
  assert.equal(configured.preflight.status,'disabled');
  assert.equal(configured.preflight.missing.includes('audited_sender'),false);
  assert.equal(configured.preflight.missing.includes('audited_protector'),false);
  for(const missing of ['postgres_acquire','current_session_verifier','ingress_limiter','authoritative_recompute',
    'private_schedule_batch','private_cleanup_batch','serialized_current_state_writers'])assert.ok(configured.preflight.missing.includes(missing));
  await configured.close();assert.equal(closed,1);
  ports.close();assert.throws(()=>ports.protect(f.subscription),e=>e.message==='n44_crypto_unavailable');
});
test('actual import/construction has no side effects and app/service executable sources do not import private drafts',async()=>{
  const code=`const deny=()=>{throw Error('forbidden capability');};
    for(const name of ['fetch','WebSocket','EventSource','setTimeout','setInterval'])globalThis[name]=deny;
    for(const name of ['localStorage','Notification','navigator'])Object.defineProperty(globalThis,name,{get:deny,configurable:true});
    const {createPrivateRuntime,createPrivatePushPorts}=await import('./drafts/n44-push/private-runtime.mjs');
    createPrivatePushPorts();const runtime=createPrivateRuntime();
    if(runtime.preflight.status!=='disabled')throw Error('unexpected readiness');
    await runtime.close();`;
  // Close uses bounded timers by contract. Import and construction must not.
  const construction=code.replace('await runtime.close();','');
  const out=execFileSync(process.execPath,['--input-type=module','-e',construction],
    {cwd:new URL('..',import.meta.url),env:{SystemRoot:process.env.SystemRoot},stdio:['ignore','pipe','pipe']});
  assert.equal(out.length,0);
  // Current production intentionally imports private modules through its exact
  // reviewed Edge entry; the shared guard still rejects public-app leakage.
  const inspection=assertNoPrivatePushImports();
  assert.ok(inspection.scanned>100);
});

const originalConnect=Socket.prototype.connect;
Socket.prototype.connect=function(){report.networkAttempts++;throw Error('n44_test_network_forbidden');};
try {
  for(const {name,run} of cases){
    try{await run();report.cases.push({name,status:'PASS'});}
    catch(e){report.cases.push({name,status:'FAIL',error:'Scoped assertion failed; sensitive values suppressed',
      location:e.stack?.split('\n').find(s=>s.includes('.mjs:'))?.trim()??null});}
  }
} finally {
  for(const f of fixtures)f.shutdown();for(const resource of extras)await resource.close();
  Socket.prototype.connect=originalConnect;
}
// Import-time library debug mode must fail before any encryption can print keys.
try {
  const stdout=execFileSync(process.execPath,['--input-type=module','-e',`
    const {makeFixture}=await import('./tests/fixtures/n44-crypto-sender/fixture.mjs');
    try{const f=makeFixture();f.shutdown();process.exitCode=2;}
    catch(e){if(e.message!=='n44_sender_unavailable')process.exitCode=3;}
  `],{cwd:new URL('..',import.meta.url),env:{SystemRoot:process.env.SystemRoot,ECE_KEYLOG:'1'},stdio:['ignore','pipe','pipe']});
  assert.equal(stdout.length,0);report.cases.push({name:'http_ece key logging mode denied before cryptographic operations',status:'PASS'});
} catch {report.cases.push({name:'http_ece key logging mode denied before cryptographic operations',status:'FAIL'});}
const files=['drafts/n44-push/provider-policy.mjs','drafts/n44-push/subscription-protector.mjs',
  'drafts/n44-push/audited-sender.mjs','drafts/n44-push/committed-permit.mjs','drafts/n44-push/delivery.mjs',
  'drafts/n44-push/private-runtime.mjs','drafts/n44-push/runtime-gateway.mjs','drafts/n44-push/registration.mjs',
  'drafts/n44-push/shared.mjs','tests/fixtures/n44-server-preactivation/fakes.mjs','tests/n44-server-preactivation.test.mjs',
  'src/lib/notification-push-core.js','src/lib/notification-push-client.js',
  'drafts/n44-push/package.json','drafts/n44-push/package-lock.json',
  'tests/n44-crypto-sender.mjs','tests/fixtures/n44-crypto-sender/fixture.mjs'];
report.sourceHashes={};for(const file of files)report.sourceHashes[file]=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
report.reusedEvidence=[];
for(const priorPath of ['tests/n44-runtime-gateway.result.json','tests/n44-postgres-repository.result.json']){
  const prior=JSON.parse(await readFile(new URL('../'+priorPath,import.meta.url),'utf8'));
  const matching=[];
  for(const [file,hash] of Object.entries(prior.sourceHashes??{})){
    // Delivery's wrapper changed here; do not relabel its old exact-source proof.
    if(file==='drafts/n44-push/delivery.mjs')continue;
    const actual=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
    if(actual===hash)matching.push({file,sha256:hash});
  }
  report.reusedEvidence.push({path:priorPath,runId:prior.runId,matching,
    limitation:'Unchanged files only; prior proof is not new hosted/Auth/network acceptance or qualification of the changed delivery wrapper.'});
}
report.status=report.cases.every(c=>c.status==='PASS')&&report.networkAttempts===0?'PASS':'FAIL';
for(const name of ['n44_actual_audited_subscription_protection_and_sender_protocol','n44_key_endpoint_dns_commit_timeout_and_uncertain_guards'])
  report.checks.push({name,status:report.status,evidence:'tests/n44-crypto-sender.result.json; '+report.cases.length+' focused cases; actual OpenSSL/web-push/http_ece, synthetic transaction/DNS/TLS transport; network attempts='+report.networkAttempts});
report.checks.push({name:'hosted_service_app_device_and_production_verification',status:'NOT_RUN',evidence:'Inactive source-only authority; no service/app/SW/device or Production operation.'});
report.finishedAt=new Date().toISOString();
const target=new URL('./n44-crypto-sender.result.json',import.meta.url);
if(report.status==='FAIL'){
  try{await writeFile(new URL('./n44-crypto-sender.original-failure.json',import.meta.url),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
}
await writeFile(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,cases:report.cases,networkAttempts:report.networkAttempts},null,2));
if(report.status!=='PASS')process.exitCode=1;
