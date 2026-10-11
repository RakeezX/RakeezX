import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { html } from '../src/lib/dom.js';
import { sanitizeSupportDiagnostics, supportEnvironment } from '../src/lib/support.js';
import { supportWhatsAppContact, supportWhatsAppMessage, supportWhatsAppUrl } from '../src/lib/support-whatsapp.js';
import { OFFICIAL_SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_CONTACT } from '../src/lib/support-public-config.js';

const OWNER='11111111-1111-4111-8111-111111111111', OTHER='22222222-2222-4222-8222-222222222222';
const claimed=(id=OWNER)=>({type:'account',ownershipState:'claimed',syncEligible:true,authUserId:id,databaseName:`fixture-${id}`});
const source=await readFile(new URL('../src/views/support.js',import.meta.url),'utf8');

// Actual view/action bodies, synthetic app boundaries. Never browser/device evidence.
function fixture({workspace=claimed(),user={id:OWNER},contact=SUPPORT_WHATSAPP_CONTACT,openResult={}}={}) {
  const calls={open:[],post:[],toast:[],summary:0,groups:0};
  let active=workspace,summary={state:'rejected',rejectedCount:6,pendingCount:3},groups=[{code:'N58_SESSION_CONTEXT_REQUIRED',area:'sessions',count:6}];
  const context=vm.createContext({html,icon:()=>'',toast:(...a)=>calls.toast.push(a),
    BUILD_META:{appVersion:'1.0.0',buildSha:'a'.repeat(64),buildShaKind:'content'},
    supportWhatsAppContact,supportWhatsAppMessage,supportWhatsAppUrl,SUPPORT_WHATSAPP_CONTACT:contact,
    sanitizeSupportDiagnostics,supportEnvironment,currentSupportDeviceDetails:()=>({operatingSystem:'ios'}),warmSupportDeviceDetails:async()=>{},
    cloud:{user,session:user?{}:null},store:{state:{ready:true},getActiveWorkspace:()=>active},
    sync:{getSyncOperationalSummary:async()=>{calls.summary++;return summary;},
      getSyncOperationalSummarySnapshot:()=>({state:'rejected',pendingCount:999,rejectedCount:999}),
      displayState:()=>({detailStatus:'rejected'}),state:{lastSyncedAt:'2026-10-06T10:00:00Z'}},
    currentRejectedSyncGroups:async()=>{calls.groups++;return groups;},submitSupportRequest:async p=>calls.post.push(p),
    clearSupportOrigin:()=>{},supportVisitOrigin:()=>({routeCategory:'support'}),repaint:()=>{},
    window:{innerWidth:390,innerHeight:844,location:{origin:'https://fixture.rakeezx.pages.dev'},matchMedia:()=>({matches:false}),
      open:(...a)=>{calls.open.push(a);return openResult;}},navigator:{onLine:true,userAgent:'Version/18.0 Safari'},document:{referrer:''},
    addEventListener:()=>{},removeEventListener:()=>{},FormData:class {constructor(form){this.form=form;}get(k){return this.form[k];}},
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm,'').replace('export const SUPPORT_EMAIL','const SUPPORT_EMAIL')
    .replace('export function currentSafeSupportDiagnostics','function currentSafeSupportDiagnostics').replace('export default','globalThis.view ='),context);
  const view=context.view;
  return {view,context,calls,flush:async()=>new Promise(resolve=>setImmediate(resolve)),setWorkspace:w=>{active=w;},
    setSummary:s=>{summary=s;},setGroups:g=>{groups=g;},text:()=>new URL(calls.open.at(-1)[0]).searchParams.get('text'),
    type:t=>view.actions['support-type']({dataset:{type:t},closest:()=>null}),message:t=>view.actions['support-message']({value:t,form:null})};
}

test('raw module default and build substitution enforce the same designated identity',async()=>{
  const config=await readFile(new URL('../src/lib/support-public-config.js',import.meta.url),'utf8');
  assert.equal(SUPPORT_WHATSAPP_CONTACT,OFFICIAL_SUPPORT_WHATSAPP);
  for(const value of [undefined,OFFICIAL_SUPPORT_WHATSAPP,null,'','12345678901',`+${OFFICIAL_SUPPORT_WHATSAPP}`,` ${OFFICIAL_SUPPORT_WHATSAPP}`,'0534859038']) {
    const built=config.replace('import.meta.env?.VITE_RAKEEZ_SUPPORT_WHATSAPP_BUSINESS',value===undefined?'undefined':JSON.stringify(value));
    const module=await import(`data:text/javascript;base64,${Buffer.from(built).toString('base64')}`);
    assert.equal(module.SUPPORT_WHATSAPP_CONTACT,value===undefined||value===OFFICIAL_SUPPORT_WHATSAPP?OFFICIAL_SUPPORT_WHATSAPP:null);
  }
});

test('separate email-then-WhatsApp rail and synchronous one-click preserve draft without duplicate transport',async()=>{
  const f=fixture();f.view.onMount();await f.flush();f.message('PRIVATE_FORM student grade attendance OTP token SQL /student/private');f.type('suggestion');
  const rendered=String(f.view.render());
  assert.match(rendered,/support-contact-rail[\s\S]*تفضّل البريد؟[\s\S]*support-whatsapp-title[\s\S]*support-request-title/);
  assert.doesNotMatch(rendered.match(/<form[\s\S]*?<\/form>/)[0],/support-whatsapp/);
  assert.doesNotMatch(rendered,/واتساب خدمة خارجية/);
  assert.match(source,/icon\('whatsapp', 'inline'\)/);
  assert.match(rendered,/href="mailto:support@rakeezx.com"/);
  f.view.actions['support-whatsapp-open'](); // Check before microtasks: activation retained.
  assert.equal(f.calls.open.length,1);assert.equal(f.calls.open[0][0].split('?')[0],`https://wa.me/${OFFICIAL_SUPPORT_WHATSAPP}`);
  assert.deepEqual(f.calls.open[0].slice(1),['_blank','noopener,noreferrer']);
  assert.match(f.text(),/فكرة أو اقتراح/);assert.match(f.text(),/N58_SESSION_CONTEXT_REQUIRED\) × 6/);
  assert.doesNotMatch(f.text(),/PRIVATE_FORM|student grade|attendance|OTP|token|SQL|11111111|22222222/);
  assert.match(String(f.view.render()),/PRIVATE_FORM student grade/);assert.equal(f.calls.post.length,0);await f.flush();f.view.onUnmount();
  const css=await readFile(new URL('../src/styles/components.css',import.meta.url),'utf8');
  assert.match(css,/\.support-page \.support-request \{ order: -1;/);
  assert.match(css,/\.support-contact-rail \{ display: grid; gap:/);
  assert.match(css,/\.support-whatsapp > \.btn \{ min-height: 44px;/);
  // Only composition/CSS intent; actual desktop/390/320 RTL light/dark geometry stays OPEN.
});

test('Demo, ownerless, unclaimed and mismatched owners use reduced safe diagnostics',async()=>{
  for(const options of [{workspace:{type:'demo',databaseName:'fixture-demo'},user:null},{workspace:null,user:null},
    {workspace:{...claimed(),ownershipState:'unclaimed'}},{workspace:claimed(OTHER)}]) {
    const f=fixture(options);f.view.onMount();await f.flush();f.view.actions['support-whatsapp-open']();
    assert.equal(f.calls.open.length,1);assert.match(f.text(),/نوع الجهاز: mobile/);
    assert.doesNotMatch(f.text(),/مزامنة|معلقة|مرفوضة|N58_|999|11111111|22222222/);
    assert.equal(f.calls.summary,0);assert.equal(f.calls.groups,0);assert.equal(f.calls.post.length,0);f.view.onUnmount();
  }
});

test('offline, mobile Safari fixture, null popup result and invalid config keep typed form',async()=>{
  const f=fixture({openResult:null});f.view.onMount();await f.flush();f.message('PRIVATE_DRAFT');
  f.context.navigator.onLine=false;f.view.actions['support-whatsapp-open']();assert.equal(f.calls.open.length,0);
  assert.match(f.calls.toast.at(-1)[0],/اتصالًا بالإنترنت/);
  f.context.navigator.onLine=true;f.view.actions['support-whatsapp-open']();assert.equal(f.calls.open.length,1);
  assert.match(f.text(),/المتصفح: safari/);assert.match(f.calls.toast.at(-1)[0],/^إذا لم يفتح/);
  assert.match(String(f.view.render()),/PRIVATE_DRAFT/);assert.equal(f.calls.post.length,0);await f.flush();f.view.onUnmount();
  const invalid=fixture({contact:null});invalid.view.onMount();await invalid.flush();invalid.view.actions['support-whatsapp-open']();
  assert.equal(invalid.calls.open.length,0);assert.match(String(invalid.view.render()),/إعداد الرقم الرسمي غير صالح/);invalid.view.onUnmount();
});

test('workspace switch discards old Sync immediately and refreshes only the new verified owner',async()=>{
  const f=fixture();f.view.onMount();await f.flush();f.context.cloud.user={id:OTHER};f.setWorkspace(claimed(OTHER));
  f.setSummary({state:'synced',pendingCount:1,rejectedCount:0});f.setGroups([]);
  f.view.actions['support-whatsapp-open']();assert.doesNotMatch(f.text(),/N58_|معلقة: 3|مرفوضة: 6|999/);
  await f.flush();f.view.render();await f.flush();f.view.actions['support-whatsapp-open']();
  assert.match(f.text(),/عناصر معلقة: 1/);assert.doesNotMatch(f.text(),/N58_|11111111|22222222|999/);await f.flush();f.view.onUnmount();
});

test('late async diagnostics cannot cross workspace switch or unmount',async()=>{
  const f=fixture();let resolve;f.context.sync.getSyncOperationalSummary=()=>new Promise(r=>{resolve=r;});f.view.onMount();
  f.setWorkspace({type:'demo',databaseName:'fixture-demo'});f.context.cloud.user=null;f.context.cloud.session=null;
  f.view.render();resolve({state:'rejected',rejectedCount:6});await f.flush();
  f.view.actions['support-whatsapp-open']();assert.doesNotMatch(f.text(),/N58_|مرفوضة|11111111/);assert.equal(f.calls.groups,0);f.view.onUnmount();
  const unmounted=fixture();let finish;
  unmounted.context.sync.getSyncOperationalSummary=()=>new Promise(r=>{finish=r;});unmounted.view.onMount();unmounted.view.onUnmount();
  finish({state:'rejected',rejectedCount:6});await unmounted.flush();assert.equal(unmounted.calls.groups,0);
  const switching=fixture();let finishGroups;
  switching.context.currentRejectedSyncGroups=()=>new Promise(r=>{finishGroups=r;});switching.view.onMount();await switching.flush();
  switching.setWorkspace(claimed(OTHER));switching.context.cloud.user={id:OTHER};
  switching.context.currentRejectedSyncGroups=async()=>[];switching.view.render();await switching.flush();
  finishGroups([{code:'N58_SESSION_CONTEXT_REQUIRED',area:'sessions',count:6}]);await switching.flush();
  switching.view.actions['support-whatsapp-open']();assert.doesNotMatch(switching.text(),/N58_|11111111|22222222/);
  await switching.flush();switching.view.onUnmount();
});

test('existing in-app action sends intentional form text through exactly one unchanged transport',async()=>{
  const f=fixture();f.view.onMount();await f.flush();
  await f.view.actions['support-submit']({type:'technical',message:'intentional in-app message',querySelector:()=>null});
  assert.equal(f.calls.post.length,1);assert.equal(f.calls.post[0].message,'intentional in-app message');
  assert.equal(f.calls.open.length,0);assert.match(String(f.view.render()),/تم إرسال طلبك بنجاح/);f.view.onUnmount();
});
