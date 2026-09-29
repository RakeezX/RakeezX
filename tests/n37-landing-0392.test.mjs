import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { html, icon } from '../src/lib/dom.js';

// Exercise the actual gate in isolation without booting Auth, IndexedDB or Sync.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const gateSource = source.slice(source.indexOf('function mountWorkspaceGate('), source.indexOf('/** أفعال متاحة في كل الشاشات. */'));
function harness(signedIn) {
  const handlers = new Map();
  const calls = [];
  const app = { querySelector: selector => ({ addEventListener: (_event, handler) => handlers.set(selector,handler) }) };
  const cloud = { session:signedIn?{}:null, user:signedIn?{id:'synthetic-owner'}:null, signOut: async()=>calls.push('logout') };
  const mount = new Function('app','cloud','html','render','icon','brandLockup','WORKSPACE_NOT_READY','mountEmailOtpController','requestDemo','location', `${gateSource}; return mountWorkspaceGate;`)(
    app,cloud,html,(target,template)=>target.markup=String(template),icon,()=>html`<span>brand</span>`,'WORKSPACE_NOT_READY',
    (_root,_done,options) => { calls.push(['otp-mounted',options]); return {start:()=>calls.push('otp-start')}; },
    ()=>calls.push('demo'),{reload:()=>calls.push('reload')});
  mount({authState:signedIn?'authenticated':'signed_out',reason:'synthetic-readiness'});
  return {app,calls,handlers};
}
test('N37 leaves the signed-in fail-closed gate separate from landing presentation', async()=>{
  const {app,calls,handlers}=harness(true);
  assert.match(app.markup,/مساحة العمل غير جاهزة على هذا الجهاز/);
  assert.match(app.markup,/لم تُفتح أو تُنشأ أي قاعدة بيانات/);
  assert.match(app.markup,/data-workspace-logout/);
  assert.doesNotMatch(app.markup,/n37-|data-workspace-login|data-workspace-demo/);
  const button={disabled:false};
  await handlers.get('[data-workspace-logout]')({currentTarget:button});
  assert.equal(button.disabled,true);
  assert.deepEqual(calls,['logout','reload']);
});
test('N37 account CTA starts the inline controller with existing reload-on-success contract',()=>{
  const {calls,handlers}=harness(false);
  assert.deepEqual(calls,[['otp-mounted',{reloadOnSuccess:true,inline:true}]]);
  handlers.get('[data-workspace-login]')();
  assert.deepEqual(calls,[['otp-mounted',{reloadOnSuccess:true,inline:true}],'otp-start']);
});
test('N37 Demo CTA retains request-before-reload order',()=>{
  const {calls,handlers}=harness(false);
  handlers.get('[data-workspace-demo]')();
  assert.deepEqual(calls,[['otp-mounted',{reloadOnSuccess:true,inline:true}],'demo','reload']);
});
