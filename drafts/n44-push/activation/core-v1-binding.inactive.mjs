/** AI: inert contract only. No imports, CLI, credentials, clocks or live activation.
 * Injected functions are trusted custodian capabilities, never request payloads.
 * This module is deliberately NOT connected to the application or private runner.
 * @typedef {{scopeDigest:string, sourceSha:string, configDigest:string}} Scope
 * @typedef {{scopeDigest:string, sourceSha:string, configDigest:string,
 * deliveryEnabled:false, schedulerEnabled:false, targetBound:false}} Configuration
 * @typedef {{scopeDigest:string, sourceSha:string, receiptId:string,
 * authenticated:true, ready:true}} Receipt
 * @typedef {{scopeDigest:string, sourceSha:string, scheduleId:string,
 * installed:boolean}} Schedule
 * @typedef {{readConfiguration: (scope:Scope)=>Promise<Configuration>,
 * readReceipt: (scope:Scope)=>Promise<Receipt>,
 * installSchedule: (scope:Scope)=>Promise<Schedule>,
 * removeSchedule: (schedule:Schedule)=>Promise<Schedule>}} SyntheticPorts
 */
export class CustodianBindingError extends Error {
 constructor(code, port) {
  super(`n44_custodian_${code}:${port}`);
  this.name = 'CustodianBindingError'; this.code = code; this.port = port;
 }
}
const fail = (code, port) => { throw new CustodianBindingError(code, port); };
export const NOT_BOUND = 'NOT_BOUND';
// Source references are an inventory, NOT executable permission or current readback.
export const ORIGINAL_BINDINGS = Object.freeze({
 readConfiguration: 'drafts/n44-push/activation/device-custodian.mjs#execute(--preflight)',
 readReceipt: 'drafts/n44-push/activation/device-custodian.mjs#execute(--readiness)',
 installSchedule: NOT_BOUND,
 removeSchedule: NOT_BOUND,
 installService: NOT_BOUND,
 authenticatedPhoneReceipt: NOT_BOUND,
});
const names = ['readConfiguration', 'readReceipt', 'installSchedule', 'removeSchedule'];
const exact = (v, keys, port) => {
 if (!v || Object.getPrototypeOf(v) !== Object.prototype ||
     Object.keys(v).sort().join() !== [...keys].sort().join()) fail('INVALID_SHAPE', port);
};
const hex = (v, n) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(v);
function scopeValue(scope) {
 exact(scope, ['scopeDigest', 'sourceSha', 'configDigest'], 'scope');
 if (!hex(scope.scopeDigest, 64) || !hex(scope.sourceSha, 40) || !hex(scope.configDigest, 64)) fail('INVALID_SHAPE', 'scope');
 return Object.freeze({...scope});
}
const same = (r, s, port) => {
 if (r.scopeDigest !== s.scopeDigest || r.sourceSha !== s.sourceSha) fail('SCOPE_MISMATCH', port);
};
const id = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
function scheduleValue(r, scope, installed) {
 exact(r, ['scopeDigest', 'sourceSha', 'scheduleId', 'installed'], 'schedule');
 same(r, scope, 'schedule');
 if (!id(r.scheduleId) || r.installed !== installed) fail('INVALID_SHAPE', 'schedule');
 return Object.freeze({...r});
}

/** Known original read-only command mapping; no import or invocation on creation.
 * Historical commands retain their own pinned lease/custody guards. This mapping
 * does NOT make them compatible with a new grant. Both results remain unnormalized
 * original receipts; neither is an authenticated phone/UI witness.
 * @param {(action:string)=>Promise<object>} [execute]
 */
export function describeOriginalCustodian(execute) {
 const call = action => async () => {
  if (typeof execute !== 'function') fail(NOT_BOUND, action);
  // Deliberately not callable in this source-only card. A later authorized private
  // integration must implement its own scope/lease checks, not toggle a flag here.
  fail('INACTIVE', action);
 };
 return Object.freeze({bindings: ORIGINAL_BINDINGS,
  readConfiguration: call('--preflight'), readReceipt: call('--readiness'),
  installSchedule: async () => fail(NOT_BOUND, 'installSchedule'),
  removeSchedule: async () => fail(NOT_BOUND, 'removeSchedule'),
  installService: async () => fail(NOT_BOUND, 'installService'),
  authenticatedPhoneReceipt: async () => fail(NOT_BOUND, 'authenticatedPhoneReceipt')});
}

/** Synthetic lifecycle ONLY. No live mode exists. Idempotence is instance-local;
 * this is not a durable journal or authority to reuse a spent operation on restart.
 * @param {{mode?:'inactive'|'synthetic', scope?:Scope, ports?:Partial<SyntheticPorts>}} options
 */
export function createOriginalCustodianAdapter({mode = 'inactive', scope, ports = {}} = {}) {
 if (!['inactive', 'synthetic'].includes(mode)) fail('INACTIVE', 'mode');
 if (!ports || Object.getPrototypeOf(ports) !== Object.prototype ||
     Object.keys(ports).some(k => !names.includes(k) || typeof ports[k] !== 'function')) fail('INVALID_SHAPE', 'ports');
 const bound = Object.freeze({...ports});
 const target = mode === 'synthetic' ? scopeValue(scope) : null;
 let phase = 'IDLE', schedule = null, receipt = null, tail = Promise.resolve();
 const requirePorts = list => {
  if (mode !== 'synthetic') fail('INACTIVE', 'adapter');
  for (const name of list) if (!bound[name]) fail(NOT_BOUND, name);
 };
 const serial = fn => { const p = tail.then(fn); tail = p.catch(() => {}); return p; };
 const invoke = async (name, arg) => {
  try { return await bound[name](arg); } catch { fail('PORT_FAILED', name); }
 };
 async function readiness() {
  const c = await invoke('readConfiguration', target);
  exact(c, ['scopeDigest', 'sourceSha', 'configDigest', 'deliveryEnabled', 'schedulerEnabled', 'targetBound'], 'readConfiguration');
  same(c, target, 'readConfiguration');
  if (c.configDigest !== target.configDigest || c.deliveryEnabled !== false ||
      c.schedulerEnabled !== false || c.targetBound !== false) fail('NOT_READY', 'readConfiguration');
  const r = await invoke('readReceipt', target);
  exact(r, ['scopeDigest', 'sourceSha', 'receiptId', 'authenticated', 'ready'], 'readReceipt');
  same(r, target, 'readReceipt');
  if (!id(r.receiptId) || r.authenticated !== true || r.ready !== true) fail('NOT_READY', 'readReceipt');
  receipt = Object.freeze({...r}); return receipt;
 }
 async function remove() {
  if (phase === 'REMOVED') return schedule;
  if (phase !== 'INSTALLED') fail('INVALID_STATE', 'removeSchedule');
  phase = 'REMOVE_UNKNOWN'; // Reserve before dispatch; uncertainty never replays.
  const r = scheduleValue(await invoke('removeSchedule', schedule), target, false);
  if (r.scheduleId !== schedule.scheduleId) fail('SCOPE_MISMATCH', 'removeSchedule');
  schedule = r; phase = 'REMOVED'; return schedule;
 }
 return Object.freeze({
  status: () => Object.freeze({mode, phase, bindings: Object.freeze(Object.fromEntries(names.map(n =>
   [n, mode === 'synthetic' && bound[n] ? 'SYNTHETIC' : NOT_BOUND])))}),
  receiptReady: () => serial(async () => {
   requirePorts(['readConfiguration', 'readReceipt']);
   if (!['IDLE', 'INSTALLED'].includes(phase)) fail('INVALID_STATE', 'readReceipt');
   if (receipt) return receipt;
   return readiness();
  }),
  installSchedule: ({signal} = {}) => serial(async () => {
   requirePorts(names); // Teardown must exist BEFORE any read or installation.
   if (signal?.aborted) fail('CANCELLED', 'installSchedule');
   if (phase === 'INSTALLED') return schedule;
   if (phase !== 'IDLE') fail('INVALID_STATE', 'installSchedule');
   await readiness(); // Fresh configuration even if receiptReady was called.
   if (signal?.aborted) fail('CANCELLED', 'installSchedule');
   phase = 'INSTALL_UNKNOWN';
   schedule = scheduleValue(await invoke('installSchedule', target), target, true);
   phase = 'INSTALLED';
   if (signal?.aborted) { await remove(); fail('CANCELLED', 'installSchedule'); }
   return schedule;
  }),
  removeSchedule: () => serial(async () => { requirePorts(['removeSchedule']); return remove(); }),
 });
}
