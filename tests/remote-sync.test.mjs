import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteSync, validOwnerMarker } from '../src/lib/remote-sync.js';
import { openOwnerInvalidationChannel } from '../src/lib/owner-invalidation-channel.js';
import * as cloud from '../src/lib/cloud.js';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('cloud boundary rejects foreign markers, forged owners/tokens and anonymous channel opens',async()=>{
  try {
    cloud.setMockAuth({id:A},{access_token:'synthetic'});
    cloud.setMockBackend({fetchOwnerSyncMarker:async()=>({protocol:'OWNER_SIGNAL_V1',ownerId:B,revision:'1'})});
    assert.equal(await cloud.fetchOwnerSyncMarker(),null);
    assert.throws(()=>cloud.openOwnerSyncChannel({ownerId:B,accessToken:'synthetic'}),/identity changed/);
    assert.throws(()=>cloud.openOwnerSyncChannel({ownerId:A,accessToken:'forged'}),/identity changed/);
    cloud.setMockAuth(null,null);
    assert.equal(await cloud.fetchOwnerSyncMarker(),null);
    assert.throws(()=>cloud.openOwnerSyncChannel({}),/identity changed/);
  }finally{cloud.setMockBackend(null);cloud.setMockAuth(null,null);}
});
function clock() {
  let now=0,id=0; const tasks=new Map();
  const timers={setTimeout(fn,ms){tasks.set(++id,{fn,at:now+ms});return id;},
    clearTimeout(i){tasks.delete(i);},setInterval(fn,ms){tasks.set(++id,{fn,at:now+ms,ms});return id;},
    clearInterval(i){tasks.delete(i);}};
  return {timers,tick(ms){const end=now+ms;while(true){const next=[...tasks].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!next)break;const[i,t]=next;now=t.at;tasks.delete(i);if(t.ms)tasks.set(i,{...t,at:now+t.ms});t.fn();}now=end;},tasks};
}
function fixture() {
  const time=clock(); let revision='0', wakes=0,closed=0,callbacks;
  let context={ownerId:A,workspace:'synthetic-a',token:'test-token',ready:true,proven:true,online:true,visible:true};
  const remote=createRemoteSync({getContext:()=>context,getMarker:async()=>({protocol:'OWNER_SIGNAL_V1',ownerId:context.ownerId,revision}),
    openChannel(c){callbacks=c;return()=>{closed++;};},requestSync(){wakes++;},timers:time.timers});
  return {remote,time,get callbacks(){return callbacks;},get wakes(){return wakes;},get closed(){return closed;},
    context,revision(v){revision=String(v);}};
}
test('strict marker handshake rejects wrong owner, malformed/unsafe revisions and wrong protocol',()=>{
  const m={protocol:'OWNER_SIGNAL_V1',ownerId:A,revision:'9007199254740993'};
  assert.ok(validOwnerMarker(m,A));assert.ok(!validOwnerMarker(m,B));
  for(const revision of [1,-1,'-1','1.2','01',null])assert.ok(!validOwnerMarker({...m,revision},A));
  assert.ok(!validOwnerMarker({...m,protocol:'wrong'},A));
});
test('rapid revisions coalesce; duplicates do not extend debounce; successful full capture suppresses echo',async()=>{
  const f=fixture();await f.remote.refresh(); const capture=await f.remote.beforeFullSync();f.remote.afterFullSync(capture,true);
  f.callbacks.onRevision('1');f.time.tick(100);f.callbacks.onRevision('2');f.time.tick(100);f.callbacks.onRevision('2');
  f.time.tick(224);assert.equal(f.wakes,0);f.time.tick(1);assert.equal(f.wakes,1);
  f.revision(2);f.remote.afterFullSync(await f.remote.beforeFullSync(),true);
  const duplicates=f.remote.stats.duplicates;
  for(let i=0;i<100;i++)f.callbacks.onRevision('2');f.time.tick(1000);assert.equal(f.wakes,1);
  assert.equal(f.remote.stats.duplicates-duplicates,100); f.remote.stop();
});
test('signal during full pull is not acknowledged by earlier captured marker; failure permits retry',async()=>{
  const f=fixture();await f.remote.refresh();const before=await f.remote.beforeFullSync();
  f.callbacks.onRevision('1');f.time.tick(325);assert.equal(f.wakes,1);
  f.remote.afterFullSync(before,true);f.time.tick(325);assert.equal(f.wakes,1);
  f.revision(1);const retry=await f.remote.beforeFullSync();f.remote.afterFullSync(retry,false);
  f.time.tick(325);assert.equal(f.wakes,1);f.remote.afterFullSync(retry,true);
  f.callbacks.onRevision('1');f.time.tick(1000);assert.equal(f.wakes,1);f.remote.stop();
});
test('a full pull covers its captured revision; only a newer signal requests trailing work',async()=>{
  const f=fixture();await f.remote.refresh();f.revision(1);
  const capture=await f.remote.beforeFullSync();
  f.callbacks.onRevision('1');f.time.tick(325);assert.equal(f.wakes,0);
  f.callbacks.onRevision('2');f.time.tick(325);assert.equal(f.wakes,1);
  f.remote.afterFullSync(capture,true);f.time.tick(325);assert.equal(f.wakes,1);
  f.revision(2);f.remote.afterFullSync(await f.remote.beforeFullSync(),true);
  f.time.tick(325);assert.equal(f.wakes,1);f.remote.stop();
});
test('logout/account switch tears down; stale callback cannot wake new identity; owner proof fails closed',async()=>{
  const f=fixture();await f.remote.refresh();const old=f.callbacks;
  f.context.ownerId=B;f.context.workspace='synthetic-b';await f.remote.refresh();assert.equal(f.closed,1);
  const c=await f.remote.beforeFullSync();f.remote.afterFullSync(c,true);old.onRevision('99');f.time.tick(325);assert.equal(f.wakes,0);
  f.context.proven=false;await f.remote.refresh();assert.equal(f.closed,2);
  f.callbacks.onRevision('9');f.time.tick(1000);assert.equal(f.wakes,0);
  f.context.ownerId=null;await f.remote.refresh();assert.equal(f.time.tasks.size,0);
});
test('missed event recovers by foreground watermark, reconnect and resubscribe checks',async()=>{
  const f=fixture();await f.remote.refresh();f.remote.afterFullSync(await f.remote.beforeFullSync(),true);
  f.revision(1);f.time.tick(60_000);await Promise.resolve();await Promise.resolve();f.time.tick(325);assert.equal(f.wakes,1);
  f.context.online=false;await f.remote.refresh();assert.equal(f.closed,1);
  f.context.online=true;await f.remote.refresh();f.time.tick(325);assert.equal(f.wakes,2);
  f.remote.afterFullSync(await f.remote.beforeFullSync(),true);f.revision(2);f.callbacks.onSubscribed();
  await Promise.resolve();await Promise.resolve();f.time.tick(325);assert.equal(f.wakes,3);f.remote.stop();
});
test('hidden workspace releases receiver; visible resumes; unsupported capability opens no channel',async()=>{
  const f=fixture();await f.remote.refresh();f.context.visible=false;await f.remote.refresh();assert.equal(f.closed,1);
  f.context.visible=true;await f.remote.refresh();assert.ok(f.callbacks);f.remote.stop();
  let opened=0;const r=createRemoteSync({getContext:()=>f.context,getMarker:async()=>null,openChannel(){opened++;},requestSync(){throw Error('unsafe');},timers:f.time.timers});
  await r.refresh();f.time.tick(120000);assert.equal(opened,0);r.stop();
});
test('unchanged foreground/reconnect/token refresh does not cause full Sync; owner watermarks stay isolated',async()=>{
  const f=fixture();await f.remote.refresh();f.revision(5);f.remote.afterFullSync(await f.remote.beforeFullSync(),true);
  f.context.visible=false;await f.remote.refresh();f.context.visible=true;await f.remote.refresh();
  f.time.tick(325);assert.equal(f.wakes,0);
  f.context.token='new-token';await f.remote.refresh();f.time.tick(325);assert.equal(f.wakes,0);
  f.context.ownerId=B;f.context.workspace='synthetic-b';f.revision(1);await f.remote.refresh();
  f.time.tick(325);assert.equal(f.wakes,1);f.remote.stop();
});
test('receive-only wire protocol joins exact private owner topic and rejects forged topics/prejoin signals',()=>{
  const time=clock(),messages=[],signals=[];let socket;
  class Socket{constructor(url){this.url=url;socket=this;}send(data){messages.push(JSON.parse(data));}close(){this.onclose?.();}}
  const close=openOwnerInvalidationChannel({url:'http://127.0.0.1:54321',apiKey:'synthetic',ownerId:A,accessToken:'synthetic',
    onRevision:r=>signals.push(r),WebSocketClass:Socket,timers:time.timers});
  socket.onopen();const join=messages[0];assert.equal(join.payload.config.private,true);
  assert.equal(join.topic,`realtime:rakeezx-owner:${A}`);
  const emit=m=>socket.onmessage({data:JSON.stringify(m)});
  const signal={topic:join.topic,event:'broadcast',payload:{event:'invalidate',payload:{revision:'1'}}};
  emit(signal);assert.equal(signals.length,0);
  emit({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'ok'}});
  emit({...signal,topic:`realtime:rakeezx-owner:${B}`});emit(signal);assert.deepEqual(signals,['1']);
  time.tick(25000);assert.equal(messages.at(-1).event,'heartbeat');
  assert.ok(messages.every(m=>m.event!=='broadcast'));close();assert.equal(time.tasks.size,0);
});
test('wire reconnect uses bounded backoff; failed joins and missed heartbeat disconnect',()=>{
  const time=clock();const sockets=[];
  class Socket{constructor(){sockets.push(this);}send(d){this.sent=JSON.parse(d);}close(){this.onclose?.();}}
  const close=openOwnerInvalidationChannel({url:'http://localhost',apiKey:'test',ownerId:A,accessToken:'test',onRevision(){},WebSocketClass:Socket,timers:time.timers});
  sockets[0].onopen();time.tick(10000);time.tick(1000);assert.equal(sockets.length,2);
  sockets[1].onopen();const join=sockets[1].sent;sockets[1].onmessage({data:JSON.stringify({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'ok'}})});
  time.tick(50000);time.tick(1000);assert.equal(sockets.length,3);close();
});

for(const seconds of [30,60,120])test(`idle foreground watermark cost: ${seconds}s virtual-hour interval`,async()=>{
  const time=clock();let checks=0,wakes=0;
  const remote=createRemoteSync({getContext:()=>({ownerId:A,workspace:'synthetic',token:'test',ready:true,proven:true,online:true,visible:true}),
    getMarker:async()=>{checks++;return {protocol:'OWNER_SIGNAL_V1',ownerId:A,revision:'0'};},
    openChannel:()=>()=>{},requestSync:()=>{wakes++;},timers:time.timers,checkMs:seconds*1000});
  await remote.refresh();remote.afterFullSync(await remote.beforeFullSync(),true);
  const baseline=checks;
  for(let second=0;second<3600;second+=seconds){time.tick(seconds*1000);await remote.check();}
  assert.equal(checks-baseline,3600/seconds);assert.equal(wakes,0);remote.stop();
});
test('unavailable marker is bounded; teardown aborts it and late replies cannot open or wake a channel',async()=>{
  const time=clock();let resolveMarker,opened=0,wakes=0;
  const remote=createRemoteSync({getContext:()=>({ownerId:A,workspace:'synthetic',token:'test',ready:true,proven:true,online:true,visible:true}),
    getMarker:()=>new Promise(resolve=>{resolveMarker=resolve;}),openChannel:()=>{opened++;return()=>{};},
    requestSync:()=>{wakes++;},timers:time.timers});
  const opening=remote.refresh();time.tick(5000);await opening;
  resolveMarker({protocol:'OWNER_SIGNAL_V1',ownerId:A,revision:'99'});await Promise.resolve();
  assert.equal(opened,0);assert.equal(wakes,0);
  const capture=remote.beforeFullSync();remote.stop();assert.equal(await capture,null);
  assert.equal(time.tasks.size,0);
});
test('transient initial capability failure retries at low frequency without refresh or a Product mutation',async()=>{
  const time=clock();let calls=0,opened=0;
  const remote=createRemoteSync({getContext:()=>({ownerId:A,workspace:'synthetic',token:'test',ready:true,proven:true,online:true,visible:true}),
    getMarker:async()=>{if(++calls===1)throw Error('Synthetic unavailable');return {protocol:'OWNER_SIGNAL_V1',ownerId:A,revision:'0'};},
    openChannel:()=>{opened++;return()=>{};},requestSync:()=>{},timers:time.timers});
  await remote.refresh();assert.equal(opened,0);time.tick(59999);assert.equal(calls,1);
  time.tick(1);await remote.check();await Promise.resolve();assert.equal(opened,1);
  remote.stop();assert.equal(time.tasks.size,0);
});

test('writer post-pull covers own echo and concurrent revisions captured before pulling',async()=>{
  const f=fixture();await f.remote.refresh();
  f.remote.afterFullSync(await f.remote.beforeFullSync(),true);
  f.remote.beginSync();f.revision(1);f.callbacks.onRevision('1');
  f.time.tick(1000);assert.equal(f.wakes,0,'signal before writer capture stays deferred');
  const post=await f.remote.beforeFullSync();
  f.remote.afterFullSync(post,true);f.remote.endSync();
  f.callbacks.onRevision('1');f.callbacks.onRevision('0');f.time.tick(1000);
  assert.equal(f.wakes,0,'same/older covered revisions do not resync writer');
  f.revision(2);f.callbacks.onRevision('2');f.time.tick(325);assert.equal(f.wakes,1);
  f.remote.stop();
});

test('newer concurrent revision during pull is not acknowledged; missed signal also requests follow-up',async()=>{
  const f=fixture();await f.remote.refresh();
  f.remote.afterFullSync(await f.remote.beforeFullSync(),true);
  f.remote.beginSync();f.revision(1);const pre=await f.remote.beforeFullSync();
  f.revision(2);await f.remote.check(); // Signal intentionally missed.
  f.time.tick(1000);assert.equal(f.wakes,0);
  f.remote.afterFullSync(pre,true);assert.equal(f.remote.diagnostics().pending,true);
  f.remote.endSync();f.time.tick(325);assert.equal(f.wakes,1);
  f.remote.beginSync();const retry=await f.remote.beforeFullSync();
  f.remote.afterFullSync(retry,true);f.remote.endSync();f.time.tick(1000);
  assert.equal(f.wakes,1);assert.equal(f.remote.diagnostics().pending,false);f.remote.stop();
});

test('failed writer pull never acknowledges own echo and account change invalidates active capture',async()=>{
  const f=fixture();await f.remote.refresh();f.remote.beginSync();f.revision(1);
  const pre=await f.remote.beforeFullSync();f.remote.afterFullSync(pre,false);
  f.remote.endSync();f.time.tick(325);assert.equal(f.wakes,1);
  f.remote.beginSync();f.context.ownerId=B;f.context.workspace='other';await f.remote.refresh();
  f.remote.afterFullSync(pre,true);f.remote.endSync();f.time.tick(325);
  assert.equal(f.remote.diagnostics().pending,true,'foreign capture cannot acknowledge new owner');f.remote.stop();
});
