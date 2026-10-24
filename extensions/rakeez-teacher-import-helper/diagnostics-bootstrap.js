// AI: first, dependency-free classic script. Only bounded aggregates leave memory.
(() => {
 'use strict';
 const run = new URLSearchParams(location.search).has('run');
 if (run) document.documentElement.classList.add('run-context');
 const assets = new Set(['popup.js','categories-popup.js','run-controller.js','handoff-protocol.js','handoff-worker.js','diagnostics-bootstrap.js','route-diagnostics.js','source-roster.js','source-adapter.js','selection.js','core.js','categories.js','navigation.js','class-order.js','background-runner.js','background-collector.js','rakeez-datetime.js','rakeez-datetime-values.js']);
 const modules = {'run-controller.js':'not-available'};
 const enums = {
  receiverCheckpoint:['none','unresolved','pending','rows-before-receipt','receipts'],receiverRelation:['unresolved','same','original-term'],
  setupKind:['none','metadata','classes','timetable'],setupRejectReason:['none','route-shape','live-link-absent','live-link-unsafe','live-link-event','live-link-context','live-link-download','live-link-method','live-link-duplicate','response-base','response-school-absent'],
  schoolBindingState:['none','preliminary','bound','unconfirmed','changed'],
  entryKind:['teacher-gateway','teacher-dashboard','unresolved-entry','none'],roleProofKind:['semantic-dashboard','active-role','greeting','none'],
  proofMismatch:['none','route','school','role','teacher','presentation','invalid-proof'],
  navigationPlannedKind:['none','home','role','gateway','metadata','classes','students','timetable'],
  navigationPlannedRoute:['none','other-origin','login-or-auth','schools-gateway','teacher-role-command','teacher-dashboard','my-students','teacher-schedule','student-report','teacher-report','other-path','invalid'],
  navigationObservedRoute:['none','other-origin','login-or-auth','schools-gateway','teacher-role-command','teacher-dashboard','my-students','teacher-schedule','student-report','teacher-report','other-path','invalid'],
  navigationRelation:['none','different-origin','different-path','different-query','exact-route','invalid'],navigationQuery:['none','present'],navigationDocument:['none','same','new','missing'],navigationStatus:['none','loading','complete'],
  jobPhase:['none','binding','collect','navigation','transfer','prepare','deliver','receipt','complete','stopped','cancelled'],
  receiverCapability:['source-profile-quiet-v1','unknown'],setupPhase:['none','source','envelope','receipt','receiver-update'],
  startPhase:['none','source-context','worker-ack','accepted','denied'],stage:['checking','idle','collecting','review','partial','paused','cancelled','expired','error','saving','saved','unresolved'],
  coverage:['complete','partial','paused','unknown'], terminal:['unproven','explicit-next','observed-anchor'],
  endpoint:['none','ambiguous','anchor','span'], transfer:['idle','sending','pending','error','unknown'],
  failure:['none','SOURCE_CHANGED','REVIEW_EXPIRED','HANDOFF_SCHEMA','HANDOFF_SETUP','HANDOFF_BATCH','HANDOFF_LIMIT_OR_EXPIRED','HANDOFF_VALUE','HANDOFF_DUPLICATE','HANDOFF_UNAVAILABLE','BATCH_EXPIRED','APP_CHANGED','APP_FRAME','APP_DOCUMENT_BINDING','HANDOFF_DOCUMENT_OR_ROUTE','HANDOFF_SENDER'],
  receipt:['not-available','pending','saved','existing','unknown','expired'],
  failureJobPhase:['none','binding','collect','navigation','transfer','prepare','deliver','receipt'],
  failurePhase:['none','profile','batch','source'],failureStep:['none','validation','transaction','readback','source-start','source-pre-read','source-post-read','source-navigation-settle']
 };
 enums.failure.push('SCHOOL_CONTEXT_UNCONFIRMED','UNSAFE_SETUP_LINK','UNOBSERVED_SETUP_LINK','SETUP_READER_UNAVAILABLE','TEACHER_CONTEXT_CHANGED','REPORT_RESPONSE_REJECTED','REPORT_CONTENT_TYPE','REPORT_SIZE','REPORT_FETCH_FAILED','FETCH_CANCELLED_OR_TIMEOUT','FETCH_CONCURRENCY','UNSAFE_ROSTER_LINK','AMBIGUOUS_SCHOOL_CONTEXT','AMBIGUOUS_ROLE','ROSTER_LINKS_UNAVAILABLE','ROLE_SWITCH_REPEATED','SCHOOL_CONTEXT_CHANGED','NON_TEACHER_ROLE','TEACHER_TRANSITION_UNRESOLVED','UNCONFIRMED_TEACHER_ROLE','LOGIN_OR_LOGOUT','ORIGIN_CHANGED','UNSAFE_ROUTE','SOURCE_ACCESS_REQUIRED','NO_ACTIVE_TAB','UNVERIFIED_START_ORIGIN','JOB_REQUEST','JOB_ACK_INVALID','BACKGROUND_UNAVAILABLE','HANDOFF_UNAVAILABLE','APP_NOT_READY','OPEN_ONE_RAKEEZ_TAB','SOURCE_BINDING_CHANGED','SOURCE_CONTEXT_CHANGED','SOURCE_CLOSED','APP_CLOSED','NAVIGATION_UNCONFIRMED','START_INTERRUPTED','SCHOOL_CHOICE_REQUIRED','RECEIPT_UNKNOWN','CANCELLED','APP_UPDATE_REQUIRED','APP_FINISH_CURRENT_EDIT','APP_ACADEMIC_SELECTION_REQUIRED','APP_BATCH_UNRESOLVED','SETUP_PROFILE_CHANGED','SETUP_PROFILE_OWNER','OFFLINE_LEASE_LIMITED','DataError','DataCloneError','QuotaExceededError','AbortError','ConstraintError','CLASS_MAPPING_REQUIRED','CLASS_ARCHIVED_OR_AMBIGUOUS','BATCH_OWNER_OR_SESSION_CHANGED','BATCH_PERSISTED_TERM_CHANGED','BATCH_PERSISTED_CONTEXT_CHANGED','WRITE_FAILED');
 const progressNumbers=['confirmedRows','confirmedReceipts','pendingRows','pendingSavedRows'];
 const numbers = [...progressNumbers,'valid','staged','observed','excluded','classes','processedPages','currentPage'];
 const fresh = () => Object.assign(Object.fromEntries(numbers.map(k=>[k,null])),{receiverCheckpoint:'none',receiverRelation:'unresolved',timings:{},setupKind:'none',setupRejectReason:'none',schoolBindingState:'none',schoolBadgePresent:null,schoolIdPresent:null,readProofPresent:null,entryKind:'none',roleProofKind:'none',proofMismatch:'none',proofNavMarkers:null,proofActionMarkers:null,proofReadLinks:null,navigationPlannedKind:'none',navigationPlannedRoute:'none',navigationObservedRoute:'none',navigationRelation:'none',navigationQuery:'none',navigationDocument:'none',navigationStatus:'none',jobPhase:'none',stage:'idle',startPhase:'none',coverage:'unknown',terminal:'unproven',endpoint:'none',hasNext:null,disabledNext:null,transfer:'idle',receipt:'not-available',failure:'none',failurePhase:'none',failureStep:'none',failureJobPhase:'none',fieldResults:[],setupPhase:'none',setupFields:[],receiverCapability:'unknown'});
 let state=fresh(), errors=[], background='not-available';
 const ownValue=(o,k)=>Object.getOwnPropertyDescriptor(o,k)?.value;
 function publish(input) {
  if (!input || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) return;
  for(const k of Object.keys(input)) {
   const v=ownValue(input,k);
   if(k==='coverageReasons'&&Array.isArray(v))state.coverageReasons=[...new Set(v.filter(r=>['excluded-rows','ambiguous-rows','missing-pages','page-gap','terminal-unverified','pending-pages','student-data-unverified'].includes(r)))];
   else if(k==='timings'&&v&&[Object.prototype,null].includes(Object.getPrototypeOf(v))){state.timings=Object.fromEntries(['home','sourceGuard','descriptor','appGuard','fetchPending'].map(key=>{const r=ownValue(v,key),count=r&&ownValue(r,'count'),ms=r&&ownValue(r,'ms');return [key,{count:Number.isSafeInteger(count)&&count>=0?Math.min(10000,count):0,ms:Number.isSafeInteger(ms)&&ms>=0?Math.min(3600000,ms):0}];}));}
   else if(['proofNavMarkers','proofActionMarkers','proofReadLinks'].includes(k))state[k]=Number.isInteger(v)&&v>=0&&v<=({proofNavMarkers:2,proofActionMarkers:3,proofReadLinks:20}[k])?v:null;
   else if(k==='setupFields'&&Array.isArray(v))state.setupFields=v.filter(f=>['teacher','school','principal','department','classes','timetable'].includes(f)).slice(0,6);
   else if(k==='fieldResults'&&Array.isArray(v))state.fieldResults=v.slice(0,36).filter(d=>d&&['teacher','school','principal','department','classes','timetable'].includes(ownValue(d,'field'))&&['saved','current','missing','conflict','unsupported','ambiguous','unrecognized','navigation-required'].includes(ownValue(d,'reason'))&&Number.isSafeInteger(ownValue(d,'count'))&&d.count>0&&d.count<=1200).map(d=>({field:d.field,reason:d.reason,count:d.count}));
   else if(numbers.includes(k)) state[k]=Number.isSafeInteger(v)&&v>=0&&v<=(progressNumbers.includes(k)?30000:1000000)?v:null;
   else if(Object.hasOwn(enums,k)) state[k]=enums[k].includes(v)?v:(['entryKind','roleProofKind','schoolBindingState'].includes(k)?'none':k==='stage'?'error':k==='terminal'?'unproven':k==='endpoint'?'none':k==='receipt'?'not-available':'unknown');
   else if(['hasNext','disabledNext','schoolBadgePresent','schoolIdPresent','readProofPresent'].includes(k)) state[k]=typeof v==='boolean'?v:null;
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
