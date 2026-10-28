// AI: synthetic capabilities only; no original custodian import, vault or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalCustodianAdapter, describeOriginalCustodian, CustodianBindingError,
 ORIGINAL_BINDINGS, NOT_BOUND} from '../../drafts/n44-push/activation/core-v1-binding.inactive.mjs';

const scope = Object.freeze({scopeDigest:'a'.repeat(64), sourceSha:'b'.repeat(40), configDigest:'c'.repeat(64)});
const config = () => ({...scope, deliveryEnabled:false, schedulerEnabled:false, targetBound:false});
const receipt = () => ({scopeDigest:scope.scopeDigest, sourceSha:scope.sourceSha,
 receiptId:'synthetic-receipt', authenticated:true, ready:true});
const schedule = installed => ({scopeDigest:scope.scopeDigest, sourceSha:scope.sourceSha,
 scheduleId:'synthetic-owned-schedule', installed});
const error = (code, port) => e => e instanceof CustodianBindingError && e.code === code && (!port || e.port === port);
function mock(overrides = {}) {
 const calls = [];
 const ports = Object.fromEntries(Object.entries({
  readConfiguration: async () => config(), readReceipt: async () => receipt(),
  installSchedule: async () => schedule(true), removeSchedule: async () => schedule(false), ...overrides,
 }).map(([name, fn]) => [name, async arg => { calls.push({name, arg}); return fn(arg); }]));
 return {calls, ports, adapter:createOriginalCustodianAdapter({mode:'synthetic', scope, ports})};
}

test('inactive default and original inventory cannot invoke any injected live capability', async () => {
 let calls = 0;
 const original = describeOriginalCustodian(async () => { calls++; throw Error('must not run'); });
 assert.match(ORIGINAL_BINDINGS.readConfiguration, /execute\(--preflight\)/);
 assert.match(ORIGINAL_BINDINGS.readReceipt, /execute\(--readiness\)/);
 for (const name of ['installSchedule','removeSchedule','installService','authenticatedPhoneReceipt']) {
  assert.equal(ORIGINAL_BINDINGS[name], NOT_BOUND);
  await assert.rejects(original[name](), error(NOT_BOUND, name));
 }
 for (const name of ['readConfiguration','readReceipt']) await assert.rejects(original[name](), error('INACTIVE'));
 const a = createOriginalCustodianAdapter({ports:{installSchedule:async () => {calls++;}}});
 for (const name of ['receiptReady','installSchedule','removeSchedule']) await assert.rejects(a[name](), error('INACTIVE'));
 assert.equal(calls, 0);
 assert.throws(() => createOriginalCustodianAdapter({mode:'live'}), error('INACTIVE'));
 assert.equal(a.send, undefined);
});

test('all missing ports fail deterministically before any work, including teardown', async () => {
 for (const missing of ['readConfiguration','readReceipt','installSchedule','removeSchedule']) {
  const m = mock(); delete m.ports[missing];
  const a = createOriginalCustodianAdapter({mode:'synthetic', scope, ports:m.ports});
  await assert.rejects(a.installSchedule(), error(NOT_BOUND, missing));
  assert.deepEqual(m.calls, []); assert.equal(a.status().phase, 'IDLE');
 }
});

test('exact scope/port input shapes reject private extras and unknown send capability', () => {
 for (const bad of [{...scope, token:'secret'}, {...scope, sourceSha:'short'}, {...scope, configDigest:null}])
  assert.throws(() => createOriginalCustodianAdapter({mode:'synthetic',scope:bad}), error('INVALID_SHAPE'));
 assert.throws(() => createOriginalCustodianAdapter({ports:{send:async()=>{}}}), error('INVALID_SHAPE'));
});

test('mock configuration/receipt/install/teardown lifecycle is ordered, idempotent and exact scoped', async () => {
 const m = mock();
 const [r1,r2] = await Promise.all([m.adapter.receiptReady(),m.adapter.receiptReady()]);
 assert.strictEqual(r1,r2); assert.ok(Object.isFrozen(r1));
 assert.deepEqual(m.calls.map(c=>c.name), ['readConfiguration','readReceipt']);
 const [s1,s2] = await Promise.all([m.adapter.installSchedule(),m.adapter.installSchedule()]);
 assert.strictEqual(s1,s2);
 assert.deepEqual(m.calls.map(c=>c.name), ['readConfiguration','readReceipt','readConfiguration','readReceipt','installSchedule']);
 const [d1,d2] = await Promise.all([m.adapter.removeSchedule(),m.adapter.removeSchedule()]);
 assert.strictEqual(d1,d2); assert.equal(d1.installed,false);
 assert.deepEqual(m.calls.at(-1), {name:'removeSchedule',arg:s1});
 assert.equal(m.calls.filter(c=>c.name==='removeSchedule').length,1);
 assert.equal(m.adapter.status().phase,'REMOVED');
 await assert.rejects(m.adapter.installSchedule(),error('INVALID_STATE'));
});

test('foreign source/scope, drift, enabled flags and unauthenticated receipts never install', async () => {
 const cases = [
  {readConfiguration:async()=>({...config(),sourceSha:'d'.repeat(40)})},
  {readConfiguration:async()=>({...config(),scopeDigest:'d'.repeat(64)})},
  {readConfiguration:async()=>({...config(),configDigest:'d'.repeat(64)})},
  ...['deliveryEnabled','schedulerEnabled','targetBound'].map(k=>({readConfiguration:async()=>({...config(),[k]:true})})),
  {readConfiguration:async()=>({...config(),privateKey:'never-return'})},
  {readReceipt:async()=>({...receipt(),authenticated:false})},
  {readReceipt:async()=>({...receipt(),ready:false})},
  {readReceipt:async()=>({...receipt(),scopeDigest:'d'.repeat(64)})},
  {readReceipt:async()=>({...receipt(),sourceSha:'d'.repeat(40)})},
  {readReceipt:async()=>({...receipt(),receiptId:''})},
  {readReceipt:async()=>({...receipt(),token:'never-return'})},
 ];
 for (const overrides of cases) {
  const m=mock(overrides);
  await assert.rejects(m.adapter.installSchedule(), e=>e instanceof CustodianBindingError);
  assert.ok(m.calls.every(c=>!c.name.endsWith('Schedule')));
 }
});

test('cancel before start or after readiness never installs', async () => {
 for (const before of [true,false]) {
  const abort = new AbortController();
  const m=mock({readReceipt:async()=>{abort.abort();return receipt();}});
  if(before)abort.abort();
  await assert.rejects(m.adapter.installSchedule({signal:abort.signal}),error('CANCELLED'));
  assert.ok(m.calls.every(c=>!c.name.endsWith('Schedule')));
  if(before)assert.equal(m.calls.length,0);
 }
});

test('cancellation during install removes only acknowledged owned schedule, once', async () => {
 const abort=new AbortController();
 const m=mock({installSchedule:async()=>{abort.abort();return schedule(true);}});
 await assert.rejects(m.adapter.installSchedule({signal:abort.signal}),error('CANCELLED'));
 await m.adapter.removeSchedule();
 assert.equal(m.calls.filter(c=>c.name==='removeSchedule').length,1);
 assert.equal(m.adapter.status().phase,'REMOVED');
});

test('uncertain install or malformed receipt is reserved, redacted and never replayed', async () => {
 for(const installSchedule of [async()=>{throw Error('private credential');},async()=>({...schedule(true),sourceSha:'e'.repeat(40)})]) {
  const m=mock({installSchedule});
  await assert.rejects(m.adapter.installSchedule(), e=>e instanceof CustodianBindingError && !e.message.includes('private credential'));
  assert.equal(m.adapter.status().phase,'INSTALL_UNKNOWN');
  await assert.rejects(m.adapter.receiptReady(),error('INVALID_STATE'));
  await assert.rejects(m.adapter.installSchedule(),error('INVALID_STATE'));
  await assert.rejects(m.adapter.removeSchedule(),error('INVALID_STATE'));
  assert.equal(m.calls.filter(c=>c.name==='installSchedule').length,1);
  assert.equal(m.calls.filter(c=>c.name==='removeSchedule').length,0);
 }
});

test('failed or peer teardown acknowledgment never reports cleanup or retries', async () => {
 for(const removeSchedule of [async()=>{throw Error('private');},async()=>({...schedule(false),scheduleId:'peer'})]) {
  const m=mock({removeSchedule});await m.adapter.installSchedule();
  await assert.rejects(m.adapter.removeSchedule(),e=>e instanceof CustodianBindingError);
  assert.equal(m.adapter.status().phase,'REMOVE_UNKNOWN');
  await assert.rejects(m.adapter.receiptReady(),error('INVALID_STATE'));
  await assert.rejects(m.adapter.removeSchedule(),error('INVALID_STATE'));
  assert.equal(m.calls.filter(c=>c.name==='removeSchedule').length,1);
 }
});

test('injected map cannot be swapped after construction; no implicit removal before installation', async () => {
 const m=mock();m.ports.installSchedule=async()=>{throw Error('replaced');};
 await assert.rejects(m.adapter.removeSchedule(),error('INVALID_STATE'));
 await m.adapter.installSchedule();await m.adapter.removeSchedule();
 assert.equal(m.calls.filter(c=>c.name==='installSchedule').length,1);
});
