// AI-authored N125: final validation uses an operation-owned fresh read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteSync } from '../../src/lib/remote-sync.js';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
function setup(){
 let revision='4',read=async()=>marker(),release,pollCalls=0;
 const tasks=new Map();let id=0;
 const timers={setTimeout(fn,ms){tasks.set(++id,{fn,ms});return id;},clearTimeout(i){tasks.delete(i);},setInterval(){return 0;},clearInterval(){}};
 const context={ownerId:A,workspace:'synthetic-workspace',token:'synthetic-token',ready:true,proven:true,online:true,visible:true};
 const marker=()=>({protocol:'OWNER_SIGNAL_V1',ownerId:A,revision});
 const remote=createRemoteSync({getContext:()=>context,getMarker:options=>{pollCalls++;return read(options);},openChannel:()=>()=>{},requestSync(){},timers});
 return {remote,context,tasks,marker,get calls(){return pollCalls;},set revision(v){revision=v;},set read(v){read=v;},
  hold(){read=()=>new Promise(done=>{release=()=>done(marker());});},release(){release();}};
}
test('receiver stop cancels advisory check, not full validation; stale generation cannot acknowledge',async()=>{
 const f=setup();try{
  await f.remote.refresh();const capture=await f.remote.beforeFullSync();f.remote.beginSync();
  f.hold();const validation=f.remote.validateFullSync(capture);
  f.context.visible=false;await f.remote.refresh();f.revision='5';f.release();await validation;
  f.read=async()=>f.marker();f.context.visible=true;await f.remote.refresh();
  f.remote.afterFullSync(capture,true);
  assert.equal(f.remote.diagnostics().pending,true,'stale capture cannot acknowledge later revision');
 }finally{f.remote.stop();assert.equal(f.tasks.size,0);}
});
test('final validation never coalesces with a poll that predates the completed pull',async()=>{
 const f=setup();try{
  await f.remote.refresh();const capture=await f.remote.beforeFullSync();f.remote.beginSync();
  f.hold();const poll=f.remote.check();const calls=f.calls;
  f.revision='5';f.read=async()=>f.marker();await f.remote.validateFullSync(capture);
  assert.equal(f.calls,calls+1,'final read starts independently of inflight poll');
  f.remote.afterFullSync(capture,true);assert.equal(f.remote.diagnostics().pending,true,'later revision not acknowledged');
  f.release();await poll;
  const next=await f.remote.beforeFullSync();f.remote.afterFullSync(next,true);
  assert.equal(f.remote.diagnostics().pending,false);
 }finally{f.remote.stop();assert.equal(f.tasks.size,0);}
});
for(const [label,read,code] of [
 ['HTTP503',()=>{throw Object.assign(Error('private payload'),{status:503});},503],
 ['authorization',()=>{throw Object.assign(Error('private payload'),{status:403});},403],
 ['fetch failure',()=>{throw new TypeError('Failed to fetch');},'TypeError'],
 ['foreign marker',()=>({protocol:'OWNER_SIGNAL_V1',ownerId:B,revision:'4'}),'REMOTE_MARKER_INVALID'],
 ['malformed revision',()=>({protocol:'OWNER_SIGNAL_V1',ownerId:A,revision:'01'}),'REMOTE_MARKER_INVALID'],
 ['absent marker',()=>null,'REMOTE_MARKER_INVALID'],
 ['regressed revision',()=>({protocol:'OWNER_SIGNAL_V1',ownerId:A,revision:'3'}),'REMOTE_REVISION_REGRESSED'],
])test('genuine '+label+' cannot validate an earlier pull',async()=>{
 const f=setup();try{
  await f.remote.refresh();const capture=await f.remote.beforeFullSync();f.read=read;
  await assert.rejects(f.remote.validateFullSync(capture),e=>typeof code==='number'?e.status===code:code==='TypeError'?e.name===code:e.code===code);
  f.remote.afterFullSync(capture,false);assert.equal(f.remote.diagnostics().pending,true);
 }finally{f.remote.stop();assert.equal(f.tasks.size,0);}
});
test('unchanged 5000ms deadline aborts owned validation and reports finite timeout',async()=>{
 const f=setup();try{
  await f.remote.refresh();const capture=await f.remote.beforeFullSync();let signal;
  f.read=options=>{signal=options.signal;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('AbortError'))));};
  const validation=f.remote.validateFullSync(capture);const rejection=assert.rejects(validation,{code:'REMOTE_MARKER_TIMEOUT'});
  const deadline=[...f.tasks.values()].find(t=>t.ms===5000);assert.ok(deadline);deadline.fn();await rejection;assert.equal(signal.aborted,true);
 }finally{f.remote.stop();assert.equal(f.tasks.size,0);}
});
for(const field of ['ownerId','workspace','token','ready','proven','online'])test('context '+field+' change fails closed before/after final read',async()=>{
 const f=setup();try{
  await f.remote.refresh();const capture=await f.remote.beforeFullSync();f.hold();const validation=f.remote.validateFullSync(capture);
  const previous=f.context[field];f.context[field]=typeof previous==='boolean'?false:'changed';f.release();
  await assert.rejects(validation,{code:'AUTH_CONTEXT_CHANGED'});
  const count=f.calls;await assert.rejects(f.remote.validateFullSync(capture),{code:'AUTH_CONTEXT_CHANGED'});assert.equal(f.calls,count);
 }finally{f.remote.stop();assert.equal(f.tasks.size,0);}
});

test('new finite marker codes remain copyable without exposing arbitrary diagnostic payload',async()=>{
 const {renderSyncOperationalSection}=await import('../../src/lib/sync-operational-ui.js');
 for(const code of ['REMOTE_MARKER_TIMEOUT','REMOTE_MARKER_INVALID','REMOTE_REVISION_REGRESSED']){
  const summary={state:'error',actionableSyncIssue:true,lastSafeFailure:{phase:'revision_validation',code,event:'visible',elapsedMs:3401,at:'2026-10-20T10:31:30.915Z',token:'private-token',payload:'private-pupil'}};
  const output=String(renderSyncOperationalSection(summary));assert.ok(output.includes(code));assert.ok(!output.includes('private-'));
  summary.lastSafeFailure.code='private-pupil';assert.ok(!String(renderSyncOperationalSection(summary)).includes('data-sync-safe-failure'));
 }
});
