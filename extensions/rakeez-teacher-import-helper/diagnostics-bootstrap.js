// AI: first, dependency-free classic script. Only bounded aggregates leave memory.
(() => {
 'use strict';
 const run = new URLSearchParams(location.search).has('run');
 if (run) document.documentElement.classList.add('run-context');
 const assets = new Set(['popup.js','categories-popup.js','run-controller.js','handoff-protocol.js','handoff-worker.js','diagnostics-bootstrap.js','route-diagnostics.js','source-roster.js','source-adapter.js','selection.js','core.js','categories.js','navigation.js','class-order.js','rakeez-datetime.js','rakeez-datetime-values.js']);
 const modules = {'popup.js':'not-available','categories-popup.js':'not-available','run-controller.js':'not-available'};
 const enums = {
  stage:['idle','collecting','review','partial','paused','cancelled','expired','error','saving','saved','unresolved'],
  coverage:['complete','partial','paused','unknown'], terminal:['unproven','explicit-next','observed-anchor'],
  endpoint:['none','ambiguous','anchor','span'], transfer:['idle','sending','pending','error','unknown'],
  failure:['none','SOURCE_CHANGED','REVIEW_EXPIRED','HANDOFF_SCHEMA','HANDOFF_BATCH','HANDOFF_LIMIT_OR_EXPIRED','HANDOFF_VALUE','HANDOFF_DUPLICATE','HANDOFF_UNAVAILABLE','BATCH_EXPIRED','APP_CHANGED','APP_FRAME','APP_DOCUMENT_BINDING','HANDOFF_DOCUMENT_OR_ROUTE','HANDOFF_SENDER'],
  receipt:['not-available','pending','saved','existing','unknown','expired']
 };
 const numbers = ['valid','staged','observed','excluded','classes','processedPages','currentPage'];
 const fresh = () => Object.assign(Object.fromEntries(numbers.map(k=>[k,null])),{stage:'idle',coverage:'unknown',terminal:'unproven',endpoint:'none',hasNext:null,disabledNext:null,transfer:'idle',receipt:'not-available',failure:'none'});
 let state=fresh(), errors=[], background='not-available';
 const ownValue=(o,k)=>Object.getOwnPropertyDescriptor(o,k)?.value;
 function publish(input) {
  if (!input || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) return;
  for(const k of Object.keys(input)) {
   const v=ownValue(input,k);
   if(numbers.includes(k)) state[k]=Number.isSafeInteger(v)&&v>=0&&v<=1000000?v:null;
   else if(Object.hasOwn(enums,k)) state[k]=enums[k].includes(v)?v:(k==='stage'?'error':k==='terminal'?'unproven':k==='endpoint'?'none':k==='receipt'?'not-available':'unknown');
   else if(['hasNext','disabledNext'].includes(k)) state[k]=typeof v==='boolean'?v:null;
  }
 }
 function record(code,asset='unknown') { errors.push({code,asset:assets.has(asset)?asset:'unknown'});if(errors.length>6)errors.shift(); }
 function assetName(value) {try {const u=new URL(value,location.href);if(u.origin!==location.origin)return 'unknown';const n=u.pathname.split('/').pop();return assets.has(n)?n:'unknown';}catch{return 'unknown';} }
 addEventListener('error',event=>{
  if(event.target?.tagName==='SCRIPT') record('MODULE_RESOURCE_LOAD_FAILED',assetName(event.target.src));
  else record('RUNTIME_ERROR',assetName(event.filename));
 },true);
 addEventListener('unhandledrejection',event=>{
  // Never retain message, reason, stack, URL or an arbitrary exception code.
  const message=event.reason&&ownValue(event.reason,'message');
  record(message==='Extension context invalidated.'?'EXTENSION_CONTEXT_INVALIDATED':'MODULE_OR_RUNTIME_REJECTION');
 });
 const reset=()=>{state=fresh();errors=[];const field=document.getElementById('safe-report');if(field){field.value='';field.hidden=true;}};
 addEventListener('n36:clear',event=>{if(!event.detail?.finished)reset();});addEventListener('n36:discard',reset);addEventListener('pagehide',reset);
 Object.defineProperty(globalThis,'n36Diagnostics',{value:Object.freeze({
  publish, reset, moduleReady(asset){if(Object.hasOwn(modules,asset))modules[asset]='ready';}
 })});
 const bound=v=>Number.isFinite(v)&&v>=0?Math.min(100000,Math.round(v*100)/100):null;
 const box=el=>el?{clientWidth:bound(el.clientWidth),clientHeight:bound(el.clientHeight),scrollWidth:bound(el.scrollWidth),scrollHeight:bound(el.scrollHeight),computedWidth:bound(parseFloat(getComputedStyle(el).width))}:null;
 function report() {
  let version='unknown';try{const v=chrome.runtime.getManifest().version;if(/^\d{1,3}(\.\d{1,3}){2,3}$/.test(v))version=v;}catch{}
  const ua=navigator.userAgentData;
  const brand=ua?.brands?.find(b=>['Microsoft Edge','Google Chrome','Chromium'].includes(b.brand));
  const browser={family:brand?({'Microsoft Edge':'edge','Google Chrome':'chrome','Chromium':'chromium'}[brand.brand]):'unknown',major:brand&&/^\d{1,3}$/.test(brand.version)?Number(brand.version):null,platform:['Windows','macOS','Linux','Android','Chrome OS'].includes(ua?.platform)?ua.platform:'unknown'};
  return JSON.stringify({schema:'rakeez-safe-diagnostics',reportVersion:1,extensionVersion:version,context:run?'run-tab':'popup',browser,
   layout:{innerWidth:bound(innerWidth),innerHeight:bound(innerHeight),devicePixelRatio:bound(devicePixelRatio),visualScale:bound(visualViewport?.scale),root:box(document.documentElement),body:box(document.body),main:box(document.querySelector('main'))},
   health:{bootstrap:'ready',modules:{...modules},background},collection:{...state},errors:errors.map(e=>({...e}))},null,2);
 }
 addEventListener('click',async event=>{
  if(!event.target.closest?.('#copy-safe-report'))return;
  const text=report(),field=document.getElementById('safe-report'),status=document.getElementById('safe-report-status');
  try{await navigator.clipboard.writeText(text);field.hidden=true;field.value='';status.textContent='نُسخت معلومات التشخيص الآمنة فقط؛ لم تُرسل إلى أي جهة.';}
  catch{field.value=text;field.hidden=false;field.focus();field.select();status.textContent='تعذّر النسخ التلقائي؛ حدّد التقرير الآمن وانسخه يدويًا. لم يُرسل شيء.';}
 });
 addEventListener('DOMContentLoaded',async()=>{
  if(!globalThis.chrome?.runtime?.sendMessage)return;
  let timer;const timeout=Symbol('timeout');
  try{
   background='checking';
   const response=await Promise.race([chrome.runtime.sendMessage({type:'n36-health'}),new Promise(resolve=>{timer=setTimeout(()=>resolve(timeout),1500);})]);
   background=response===timeout?'timeout':response?.ok===true&&response?.health==='ready'?'ready':'unavailable';
   if(background==='timeout')record('BACKGROUND_TIMEOUT','handoff-worker.js');
  }catch(error){const invalid=ownValue(error,'message')==='Extension context invalidated.';background=invalid?'context-invalidated':'unavailable';record(invalid?'EXTENSION_CONTEXT_INVALIDATED':'BACKGROUND_UNAVAILABLE','handoff-worker.js');}
  finally{clearTimeout(timer);}
 },{once:true});
})();
