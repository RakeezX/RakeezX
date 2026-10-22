// AI: DOM-free explicit-Start coordinator. Private rows live only in session storage.
import {consumePage,routeIdentity} from './background-collector.js';
import {readAutomaticTeacherPage} from './selection.js';
import {readSourceReportPage} from './source-adapter.js';
import {RUN_LIMITS,startOrigin,safeRoute} from './navigation.js';
import {sourceClasses,selectedSourceClass,sourceCoverage} from './source-roster.js';
import {HANDOFF_TTL,validateHandoff} from './handoff-protocol.js';
const JOB='n36:background-job',VIEW='n36:background-view',ALARM='n36:background-wake';
const hex=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
const encode=j=>({...j,visited:[...j.visited],rosterSchools:[...j.rosterSchools],series:[...j.series].map(([k,v])=>[k,{...v,pages:[...v.pages]}])});
const decode=j=>({...j,visited:new Set(j.visited),rosterSchools:new Set(j.rosterSchools),series:new Map(j.series.map(([k,v])=>[k,{...v,pages:new Set(v.pages)}]))});
// AI: diagnostic classification only; never an authorization/redirect allowlist.
// Exact fixed templates, no arbitrary segments, query keys/values or identifiers.
export function navigationDiagnostic(origin,n,observed,documentId,status){
 const category=value=>{try{
  const u=new URL(value);if(u.origin!==origin||u.username||u.password)return 'other-origin';
  const p=u.pathname;
  if(/(?:login|signin|signout|logout|oauth|auth)/i.test(p))return 'login-or-auth';
  if(/^\/Dashboards\/Schools\/?$/i.test(p))return 'schools-gateway';
  if(/^\/Dashboards\/Schools\/ChangeUserTypeToTeacherFromParent\/[a-f0-9]{32}\/?$/i.test(p))return 'teacher-role-command';
  if(/^\/SchoolManagment\/Actions\/Teacher\/[^/]+\/?$/i.test(p))return 'teacher-dashboard';
  if(/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(p))return 'my-students';
  if(/^\/SchoolSchedule\/Schedule\/TeacherSchedule\/?$/i.test(p))return 'teacher-schedule';
  if(/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(p))return 'student-report';
  if(/^\/TeachersReports\/(?:Statistics\/)?(?:MyInfo|TeacherSchedule|Teacher|ClassStudentInfo)\/[^/]+\/?$/i.test(p))return 'teacher-report';
  return 'other-path';
 }catch{return 'invalid';}};
 let relation='invalid',query='unknown';try{const p=new URL(n.target),o=new URL(observed);query=o.search?'present':'none';relation=o.origin!==p.origin?'different-origin':o.pathname!==p.pathname?'different-path':o.search!==p.search?'different-query':'exact-route';}catch{}
 return {navigationPlannedKind:['home','role','gateway','metadata','classes','students','timetable'].includes(n.kind)?n.kind:'unknown',navigationPlannedRoute:category(n.target),navigationObservedRoute:category(observed),navigationRelation:relation,navigationQuery:query,navigationDocument:typeof documentId!=='string'||!documentId?'missing':documentId===n.documentId?'same':'new',navigationStatus:['loading','complete'].includes(status)?status:'unknown'};
}
export function createBackgroundRunner({transport}){
 let running=null,wakeRequested=false,starting=Promise.resolve(),mutations=Promise.resolve();
 const mutate=operation=>{const r=mutations.then(operation);mutations=r.catch(()=>{});return r;};
 // AI: fixed, bounded, inclusive substep totals only. No source content,
 // route, identifier or arbitrary metric key is copied into diagnostics.
 const timingKeys=['home','sourceGuard','descriptor','appGuard','fetchPending'];
 const timingView=j=>Object.fromEntries(timingKeys.map(k=>[k,{count:Math.min(10000,Math.max(0,Math.trunc(j.timings?.[k]?.count??0))),ms:Math.min(3600000,Math.max(0,Math.trunc(j.timings?.[k]?.ms??0)))}]));
 async function timed(j,key,fn){const started=Date.now();try{return await fn();}finally{const r=(j.timings??={})[key]??={count:0,ms:0};r.count=Math.min(10000,r.count+1);r.ms=Math.min(3600000,r.ms+Math.max(0,Date.now()-started));}}
 const load=async()=>{const v=(await chrome.storage.session.get(JOB))[JOB];return v?decode(v):null;};
 const authority=j=>({jobId:j.id,windowId:j.windowId});
 const view=j=>({id:j.id,timings:timingView(j),phase:j.phase,startPhase:j.startPhase??'worker-ack',receiverCheckpoint:j.receiverProgress?.checkpoint??'none',receiverRelation:j.receiverProgress?.relation??'unresolved',confirmedRows:j.receiverProgress?.confirmedRows??0,confirmedReceipts:j.receiverProgress?.confirmedReceipts??0,pendingRows:j.receiverProgress?.pendingRows??0,pendingSavedRows:j.receiverProgress?.pendingSavedRows??0,failurePhase:j.receiverFailure?.phase??'none',failureStep:j.receiverFailure?.step??j.failureStep??'none',failureJobPhase:j.receiverFailure?'receipt':j.failureJobPhase??'none',code:j.code??null,added:j.added,existing:j.existing,fields:j.fields??[],staged:j.sourceRows.length,observed:j.studentRowsSeen,coverage:j.coverage?.coverage??'unknown',setupPartial:!!j.setupRejections?.length,setupUnavailable:[...new Set((j.setupRejections??[]).map(r=>r.setupKind))],setupKind:j.setupRejections?.at(-1)?.setupKind??'none',setupRejectReason:j.setupRejections?.at(-1)?.setupRejectReason??'none',receiverCapability:j.batchId?'source-profile-quiet-v1':'unknown',needsReview:!!j.needsReview,...j.navigationDiagnostic,...j.proofDiagnostic,schoolBindingState:j.code==='SCHOOL_CONTEXT_UNCONFIRMED'?'unconfirmed':j.code==='SCHOOL_CONTEXT_CHANGED'?'changed':j.context?.schoolBinding??'none',readProofPresent:!!j.context?.readProof});
 async function current(j){const v=await load();if(!v||v.id!==j.id)throw Error('CANCELLED');if(Date.now()>=j.expiresAt||j.expires&&Date.now()>=j.expires||!j.expires&&Date.now()>=j.createdAt+RUN_LIMITS.milliseconds)throw Error('REVIEW_EXPIRED');if(j.pending&&Date.now()>=j.pending.envelope.expiresAt)throw Error('RECEIPT_UNKNOWN');}
 async function save(j){return mutate(async()=>{await current(j);await chrome.storage.session.set({[JOB]:encode(j),[VIEW]:view(j)});await chrome.alarms.create(ALARM,{when:Math.min(j.expiresAt,j.expires??Infinity,j.navigation?.readDeadline??j.navigation?.deadline??Infinity,Date.now()+30000)});});}
 async function finish(j,phase,code=null,error=null){return mutate(async()=>{
  const v=await load();if(!v||v.id!==j.id)return;
  await chrome.storage.session.remove(JOB);await chrome.alarms.clear(ALARM);
  j.failureStep=error?.sourceFailureStep??'none';j.failureJobPhase=code?j.phase:'none';
  await chrome.storage.session.set({[VIEW]:{...view(j),phase,code}});
  try{await chrome.scripting.executeScript({target:{tabId:j.tabId,...(j.sourceDocument?{documentIds:[j.sourceDocument]}:{frameIds:[0]})},world:'ISOLATED',func:id=>{if(globalThis.rakeezTeacherReadGuard?.jobId===id){delete globalThis.rakeezTeacherReadGuard;delete globalThis.rakeezSetupPageReader;}for(const [key,c] of globalThis.rakeezReportRequests??[])if(key.startsWith(id+'|'))c.abort();},args:[j.id]});}catch{/* Lost source access is never recovered by navigation. */}
  // Revoke this job only. App-owned durable batches are never deleted.
  await transport({type:'n36-cancel'},authority(j));
 });}
 // AI: a denied receiver may still have reported a bounded UNKNOWN receipt.
 // Read only this job's nonce for diagnosis; never consume saved/current here.
 function noteUnknown(j,r){
  if(!r?.ok||r.status!=='unknown')return false;
  j.receiverProgress=r.progress??null;j.receiverFailure=r.failure??null;j.code=r.failure?.code??'RECEIPT_UNKNOWN';return true;
 }
 async function appGuard(j,wait=false){return timed(j,'appGuard',()=>appGuardRead(j,wait));}
 async function appGuardRead(j,wait=false){await current(j);const r=await transport({type:'n36-check',batchId:j.batchId,wait},authority(j));if(!r?.ok)throw Error('APP_CHANGED');await current(j);return r.ready;}
 // AI: tabs.url is advisory metadata, not the executing document's URL. Only
 // fragments may differ within a bound document; paths/queries remain byte exact.
 function sourceRoute(j,href){
  const u=new URL(href);if(u.origin!==j.origin)throw Error('SOURCE_CONTEXT_CHANGED');
  return safeRoute(j.origin,u.href,j.context);
 }
 async function descriptor(j){return timed(j,'descriptor',()=>descriptorRead(j));}
 async function descriptorRead(j){
  const r=await chrome.scripting.executeScript({target:{tabId:j.tabId,frameIds:[0]},world:'ISOLATED',func:()=>location.href});
  await current(j);
  if(r.length!==1||r[0].frameId!==0||!r[0].documentId||typeof r[0].result!=='string'||j.sourceDocument&&r[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
  return r[0];
 }
 async function source(j,mode='guard'){return timed(j,mode==='home'?'home':'sourceGuard',()=>sourceRead(j,mode));}
 async function sourceRead(j,mode='guard'){
  if(mode==='guard'&&j.context?.readProof)mode='read-proof';
  let step=j.phase==='binding'?'source-start':'source-pre-read';
  try{
  await current(j);const probe=await descriptor(j);
  if(sourceRoute(j,probe.result)!==sourceRoute(j,j.sourceURL))throw Error('SOURCE_CONTEXT_CHANGED');
  j.sourceDocument=probe.documentId;j.sourceURL=probe.result;
  const target={tabId:j.tabId,documentIds:[j.sourceDocument]};
  await chrome.scripting.executeScript({target,world:'ISOLATED',files:['route-diagnostics.js']});
  const r=await chrome.scripting.executeScript({target,world:'ISOLATED',func:readAutomaticTeacherPage,args:[mode==='students'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(new URL(j.sourceURL).pathname)?'roster-guard':['students','timetable'].includes(mode)?'guard':mode,null,mode==='read-proof'?{...j.context,readJobId:j.id}:j.context]});
  await current(j);
  if(r.length!==1||r[0].frameId!==0||!r[0].documentId||j.sourceDocument&&r[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
  if(r[0].result?.proofDiagnostic)j.proofDiagnostic={...j.proofDiagnostic,...r[0].result.proofDiagnostic};
  if(!r[0].result?.ok){const e=Error(r[0].result?.code??'SOURCE_UNAVAILABLE');e.retry=r[0].result?.retry;e.incomplete=r[0].result?.incomplete;throw e;}
  if(mode==='home'&&j.context?.kind==='selected-teacher-card'&&r[0].result.runContext?.kind==='selected-teacher-card'&&['roleTargetId','href','schoolName'].some(k=>j.context[k]!==r[0].result.runContext[k]))throw Error('SCHOOL_CONTEXT_CHANGED');
  j.sourceDocument=r[0].documentId;
  if(mode==='read-proof'){if(j.context.readProof&&j.context.readProof!==r[0].result.proof)throw Error('TEACHER_CONTEXT_CHANGED');j.context={...j.context,readProof:r[0].result.proof};}
  if(['guard','read-proof'].includes(mode)){
   const g=await chrome.scripting.executeScript({target,world:'ISOLATED',func:readSourceReportPage,args:['guard']});
   await current(j);if(g.length!==1||g[0].documentId!==j.sourceDocument||!g[0].result?.ok)throw Error(g[0]?.result?.code??'SOURCE_BINDING_CHANGED');
  }
  step='source-post-read';
  const post=await descriptor(j);if(sourceRoute(j,post.result)!==sourceRoute(j,j.sourceURL))throw Error('SOURCE_CONTEXT_CHANGED');
  j.sourceURL=post.result;
  if(['students','timetable'].includes(mode)){
   const a=await chrome.scripting.executeScript({target,world:'ISOLATED',func:readSourceReportPage,args:[mode,{...j.context,rowOffset:j.next?.rowOffset??0}]});
   await current(j);
   if(a.length!==1||a[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
   const end=await descriptor(j);if(sourceRoute(j,end.result)!==sourceRoute(j,j.sourceURL))throw Error('SOURCE_CONTEXT_CHANGED');
   j.sourceURL=end.result;
   // Failed reads also require post-read binding and app authority checks.
   await appGuard(j);
   if(!a[0].result?.ok){const e=Error(a[0]?.result?.code??'SOURCE_UNAVAILABLE');e.incomplete=a[0]?.result?.incomplete;e.retry=a[0]?.result?.retry;e.observedRows=a[0]?.result?.observedRows;e.rosterCause=a[0]?.result?.diagnostic?.roster?.cause;throw e;}
   return a[0].result;
  }
  return r[0].result;
  }catch(e){e.sourceFailureStep=step;throw e;}
 }
 // AI: source GETs remain read-only and receiver-free until school binding completes.
 async function fetchPage(j,n,setupKind=null){return timed(j,'fetchPending',()=>fetchPageRead(j,n,setupKind));}
 async function fetchPageRead(j,n,setupKind=null){
  let settled=false;
  const pending=chrome.scripting.executeScript({target:{tabId:j.tabId,documentIds:[j.sourceDocument]},world:'ISOLATED',func:readSourceReportPage,args:['fetch',{...j.context,...(setupKind?{setupKind}:{}),observedReport:n.readEvidence==='validated-response',rowOffset:n.rowOffset??0,path:n.path,sourceURL:j.sourceURL,requestId:j.id+'|'+n.path+'|'+(n.rowOffset??0),remainingMs:Math.min(8000,j.expiresAt-Date.now())}]}).finally(()=>{settled=true;});
  let r;
  try{
   // Receiver owner/session/batch and live teacher/document remain gates while
   // the bounded request is pending, as well as before and after it.
   // AI: elapsed cadence measured after each complete check; a slow guard does
   // not trigger a catch-up scan. Mandatory before/after gates remain intact.
   let checkedAt=Date.now();
   while(!settled){
    let timer;try{await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(resolve,Math.max(1,1000-(Date.now()-checkedAt)));})]);}finally{clearTimeout(timer);}
    if(!settled&&Date.now()-checkedAt>=1000){await appGuard(j);await source(j,'read-proof');checkedAt=Date.now();}
   }
   r=await pending;
  }catch(e){
   await chrome.scripting.executeScript({target:{tabId:j.tabId,documentIds:[j.sourceDocument]},world:'ISOLATED',func:key=>globalThis.rakeezReportRequests?.get(key)?.abort(),args:[j.id+'|'+n.path+'|'+(n.rowOffset??0)]}).catch(()=>{});
   await pending.catch(()=>{});throw e;
  }
  await current(j);if(r.length!==1||r[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
  await source(j,'read-proof');await appGuard(j);
  if(!r[0].result?.ok){const e=Error(r[0]?.result?.code??'REPORT_FETCH_FAILED');e.incomplete=r[0]?.result?.incomplete;
   if(setupKind&&r[0].result?.setupKind===setupKind&&['route-shape','live-link-absent','live-link-unsafe','live-link-event','live-link-context','live-link-download','live-link-method','live-link-duplicate','response-base'].includes(r[0].result?.setupRejectReason)){e.setupKind=setupKind;e.setupRejectReason=r[0].result.setupRejectReason;}throw e;}
  return r[0].result;
 }
 async function readNext(j){
  const n=j.next;if(n.page)return n;
  await appGuard(j);await source(j,['role','gateway'].includes(n.kind)?'home':'guard');
  const target=safeRoute(j.origin,n.path,n.context??j.context);
  const menu=n.kind==='students'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(new URL(target).pathname);
  const report=n.kind==='students'&&/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(new URL(target).pathname);
  if(menu||report){
   await source(j,'read-proof');await appGuard(j);
   if(report){const path=new URL(target).pathname;if(j.reportPath&&j.reportPath!==path)throw Error('REPORT_CONTEXT_CHANGED');j.reportPath=path;}
   return {...n,page:await fetchPage(j,n)};
  }
  // Unimplemented student routes never fall through to visible navigation.
  if(n.kind==='students')throw Error('UNSAFE_ROSTER_LINK');
  // AI: ordinary setup reads use only hrefs captured in this verified teacher
  // document. Never navigate or expand discovery from a fetched response.
  if(['metadata','classes','timetable'].includes(n.kind)){
   if(!j.context?.schoolId||j.context?.schoolBinding!=='bound'&&n.kind!=='metadata')return {...n,page:{tables:[],links:[],warnings:[{category:n.kind,code:'SETUP_SCHOOL_UNAVAILABLE'}],skipped:[]}};
   await source(j,'read-proof');await appGuard(j);
   if(!j.setupLinks?.some(l=>l.kind===n.kind&&l.path===n.path))throw Error('UNOBSERVED_SETUP_LINK');
   try{return {...n,page:await fetchPage(j,n,n.kind)};}catch(e){
    // AI: only a classified optional setup rejection may recover. All document,
    // teacher, owner/session/batch and roster failures retain their original stop.
    if(e.message!=='UNSAFE_SETUP_LINK'||e.setupKind!==n.kind||!e.setupRejectReason||!j.context.schoolId||!j.context.readProof)throw e;
    await source(j,'read-proof');await appGuard(j);
    (j.setupRejections??=[]).push({setupKind:n.kind,setupRejectReason:e.setupRejectReason});
    return {...n,page:{tables:[],links:[],warnings:[{category:n.kind,code:'SETUP_FIELDS_UNAVAILABLE'}],skipped:[]}};
   }
  }
  if(/\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(target).pathname)){if(j.roleSwitchUsed)throw Error('ROLE_SWITCH_REPEATED');j.roleSwitchUsed=true;}
  // A crash before update may only resume if still in the original document;
  // a crash after update may only accept the exact planned destination.
  j.navigation={from:j.sourceURL,documentId:j.sourceDocument,target,kind:n.kind,issued:true,deadline:Date.now()+30000};j.phase='navigation';await save(j);
  await source(j,['role','gateway'].includes(n.kind)?'home':'guard');await appGuard(j);
  await chrome.tabs.update(j.tabId,{url:target});return null;
 }
 function partialPage(j,next,e){
  if(!['students','timetable'].includes(next.kind)||!e.incomplete&&e.message!=='PAGE_TIMEOUT'||/CONTEXT|BINDING|ORIGIN|LOGIN|ROLE|UNSAFE|SCHOOL|SESSION|REPORT_RESPONSE|REPORT_CONTENT_TYPE|REPORT_SIZE|FETCH_/.test(e.message))throw e;
  if(e.observedRows)j.studentRowsSeen+=e.observedRows;
  const optional=e.message==='ROSTER_LINKS_UNAVAILABLE'&&e.rosterCause==='MAIN_FRAME_READ_LINK_ABSENT'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(new URL(next.path,j.origin).pathname);
  return {tables:[],links:[],warnings:[{category:next.kind,code:e.message,optional}],skipped:[]};
 }
 async function settleNavigation(j){
  try{
  await appGuard(j);const n=j.navigation,tab=await chrome.tabs.get(j.tabId);
  // Read back the top document ONLY during this exact owned navigation window.
  // Do not clear the old binding until destination, frame and deadline are verified.
  if(!n?.issued||!n.readDocument&&Date.now()>=n.deadline)throw Error('TEACHER_TRANSITION_UNRESOLVED');
  const r=await chrome.scripting.executeScript({target:{tabId:j.tabId,frameIds:[0]},world:'ISOLATED',func:()=>location.href});
  await current(j);
  j.navigationDiagnostic=navigationDiagnostic(j.origin,n,r.length===1?r[0].result:null,r.length===1?r[0].documentId:null,tab.status);
  if(r.length!==1||r[0].frameId!==0||!r[0].documentId||typeof r[0].result!=='string')throw Error('SOURCE_BINDING_CHANGED');
  const href=r[0].result,route=sourceRoute(j,href);
  const transition=/\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(n.target).pathname);
  // AI: the selected card command may return an opaque teacher dashboard ID.
  // It is neither the role target nor SchoolId; independent readers bind those.
  // This exception exists only inside the issued, single-use navigation window.
  const dashboard=new URL(href);
  const selectedTransition=transition&&j.roleSwitchUsed&&['role','gateway'].includes(n.kind)&&j.context?.kind==='selected-teacher-card'&&sourceRoute(j,n.target)===safeRoute(j.origin,j.context.href,j.context);
  const teacherDashboard=selectedTransition&&dashboard.origin===j.origin&&/^\/SchoolManagment\/Actions\/Teacher\/[a-f0-9]{32}\/?$/i.test(dashboard.pathname)&&!dashboard.href.split('#')[0].includes('?');
  const redirected=transition&&[j.origin+'/Dashboards/Schools',j.origin+'/Dashboards/Schools/'].includes(route)||teacherDashboard;
  if(route===sourceRoute(j,n.from)&&!(redirected&&r[0].documentId!==n.documentId)){
   if(r[0].documentId!==n.documentId)throw Error('SOURCE_BINDING_CHANGED');
   if(tab.status==='loading')return false;
   throw Error('NAVIGATION_UNCONFIRMED'); // Never replay an uncertain command.
  }
  if(route!==sourceRoute(j,n.target)&&!redirected)throw Error('SOURCE_CONTEXT_CHANGED');
  if(r[0].documentId===n.documentId||n.readDocument&&r[0].documentId!==n.readDocument)throw Error('SOURCE_BINDING_CHANGED');
  if(tab.status!=='complete'||transition&&!redirected){if(n.readDocument&&Date.now()>=n.readDeadline)throw Error('SOURCE_BINDING_CHANGED');return false;}
  j.sourceURL=href;j.sourceDocument=r[0].documentId;
  // AI: navigation and optional discovery have separate finite budgets. Once the
  // exact new MyStudents document is bound, a later alarm must read/guard it
  // again, not misclassify its missing optional links as a role transition.
  const roster=n.kind==='students'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(dashboard.pathname);
  if(roster&&!n.readDocument){n.readDocument=r[0].documentId;n.readDeadline=Date.now()+20000;}
  let page;try{page=await source(j,n.kind);}catch(e){
   if(roster&&e.retry&&e.message==='ROSTER_LINKS_PENDING'&&e.rosterCause==='MAIN_FRAME_READ_LINK_ABSENT'){
    if(Date.now()<n.readDeadline)return false;
    // Recheck role/school after the failed read, as well as URL/document/app.
    await source(j,'roster-guard');await appGuard(j);
    e.message='ROSTER_LINKS_UNAVAILABLE';page=partialPage(j,j.next,e);
   }else{if(e.retry&&Date.now()<(roster?n.readDeadline:n.deadline))return false;page=partialPage(j,j.next,e);}
  }if(page.schoolChoices)throw Error('SCHOOL_CHOICE_REQUIRED');
  await appGuard(j);
  if(!roster&&Date.now()>=n.deadline)throw Error('TEACHER_TRANSITION_UNRESOLVED');
  j.next={...j.next,page};j.navigation=null;delete j.navigationDiagnostic;j.phase='collect';await save(j);return true;
  }catch(e){e.sourceFailureStep??='source-navigation-settle';throw e;}
 }
 function setup(j){
  const out=j.categories.filter(c=>c.category!=='students'&&!j.warnings.some(w=>w.category===c.category)).map(c=>({...c,provenance:['teacher-readonly-run']}));
  if(!j.setupRejections?.some(r=>r.setupKind==='classes')&&!out.some(c=>c.category==='classes'))out.push({category:'classes',provenance:['teacher-readonly-run'],rows:[...new Set(j.sourceRows.map(r=>r.classroom))].map(classroom=>({classroom}))});
  if(j.context?.schoolName&&!j.warnings.some(w=>w.category==='school')&&!out.some(c=>c.category==='school'))out.push({category:'school',provenance:['teacher-readonly-run'],rows:[{name:j.context.schoolName}]});
  return out;
 }
 async function run(){
  let j=await load();if(!j)return;
  try{
   // Each wake is bounded work. A real pending-phase alarm, not a keepalive loop.
   const until=Date.now()+20000;
   while(Date.now()<until){
    await current(j);
    if(j.phase==='binding')throw Error('START_INTERRUPTED');
    if(!await appGuard(j,j.phase==='receipt')){
     if(j.phase==='receipt'){const r=await transport({type:'n36-result',actionId:j.pending.actionId},authority(j));if(!noteUnknown(j,r))j.code='APP_CHANGED';}
     break;
    }
    if(j.phase==='navigation'){if(!await settleNavigation(j))break;continue;}
    await source(j,j.phase==='collect'&&['home','role','gateway'].includes(j.next?.kind)?'home':'guard');
    if(j.phase==='collect'){
     let next;try{next=await readNext(j);}catch(e){next={...j.next,page:partialPage(j,j.next,e)};}if(!next)continue;
     consumePage(j,next);j.pages++;await save(j);
     if(j.next)continue;
     if(j.context?.schoolBinding!=='bound'||!j.context.schoolName||!j.context.schoolId||!j.context.readProof)throw Error('SCHOOL_CONTEXT_UNCONFIRMED');
     if(!j.sourceRows.length)throw Error('SOURCE_NOT_AVAILABLE');
     // AI: a pending optional rejection is recoverable only once the roster itself binds the school.
     if(j.setupRejections?.length&&(!j.reportPath||j.rosterSchools.size!==1||!j.rosterSchools.has(j.context.schoolName)))throw Error('SCHOOL_CONTEXT_UNCONFIRMED');
     j.coverage=sourceCoverage({series:j.series,warnings:j.warnings,pendingReportPages:j.remainingReportPages??0});j.phase='transfer';j.classIndex=0;j.offset=0;await save(j);continue;
    }
    if(['transfer','prepare','deliver'].includes(j.phase)&&(j.context?.schoolBinding!=='bound'||!j.context.schoolName||!j.context.schoolId||!j.context.readProof))throw Error('SCHOOL_CONTEXT_UNCONFIRMED');
    if(j.phase==='transfer'){
     const group=sourceClasses(j.sourceRows)[j.classIndex];
     if(!group){await finish(j,'complete');return;}
     const rows=selectedSourceClass(j.sourceRows,group.classroom,j.offset),createdAt=Date.now();
     const envelope=validateHandoff({schema:'rakeez-extension-names',version:3,source:'madrasati',scope:'reviewed-run',batchId:j.batchId,complete:j.coverage.complete,setup:setup(j),createdAt,expiresAt:Math.min(createdAt+HANDOFF_TTL,j.expiresAt,j.expires??Infinity),rows});
     j.pending={actionId:hex(),envelope};j.phase='prepare';await save(j);continue;
    }
    if(j.phase==='prepare'){
     // Identity and complete serialized envelope were checkpointed BEFORE transport.
     const r=await transport({type:'n36-create',...j.pending,defer:true},authority(j));if(!r.ok)throw Error(r.code??'HANDOFF_UNAVAILABLE');
     j.phase='deliver';await save(j);continue;
    }
    if(j.phase==='deliver'){
     const r=await transport({type:'n36-deliver',actionId:j.pending.actionId,batchId:j.batchId},authority(j));if(!r.ok)throw Error(r.code??'APP_CHANGED');
     j.phase='receipt';await save(j);continue;
    }
    if(j.phase==='receipt'){
     const r=await transport({type:'n36-result',actionId:j.pending.actionId},authority(j));
     if(!r.ok||r.status==='expired')throw Error('RECEIPT_UNKNOWN');
     if(r.status==='failed')throw Error(r.code??'HANDOFF_UNAVAILABLE');
     if(r.status==='pending')break;
     if(noteUnknown(j,r)){await save(j);break;}
     if(!['saved','existing'].includes(r.status)||r.total!==j.pending.envelope.rows.length||!r.setup?.details?.length)throw Error('RECEIPT_UNKNOWN');
     j.receiverProgress=null;j.receiverFailure=null;j.added+=r.added;j.existing+=r.existing;j.needsReview ||= r.setup.unresolved>0;const ranks={missing:0,current:1,saved:2,conflict:3,unsupported:3,ambiguous:3,unrecognized:3},fields=new Map((j.fields??[]).map(d=>[d.field,d]));
     for(const d of r.setup.details)if(!fields.has(d.field)||ranks[d.reason]>=ranks[fields.get(d.field).reason])fields.set(d.field,d);j.fields=[...fields.values()];j.code=null;
     j.offset+=r.total;const group=sourceClasses(j.sourceRows)[j.classIndex];if(j.offset===group.count){j.classIndex++;j.offset=0;}
     // Checkpoint cursor BEFORE removing a consumed receipt. Crashes cannot double ACK.
     const actionId=j.pending.actionId;j.pending=null;j.phase='transfer';await save(j);
     await chrome.storage.session.remove('receipt:'+actionId);await chrome.alarms.clear('handoff:'+actionId);continue;
    }
    throw Error('JOB_PHASE');
   }
   await save(j);
  }catch(e){await finish(j,e.message==='CANCELLED'?'cancelled':'stopped',/^[A-Z_]+$/.test(e.message)?e.message:'BACKGROUND_UNAVAILABLE',e);}
 }
 function wake(){
  if(running){wakeRequested=true;return running;}
  running=run().finally(()=>{running=null;if(wakeRequested){wakeRequested=false;queueMicrotask(()=>wake().catch(()=>{}));}});return running;
 }
 async function message(m,sender){
  if(m.type==='n36-job-status'&&Object.keys(m).join()==='type')return {ok:true,view:(await chrome.storage.session.get(VIEW))[VIEW]??null};
  if(m.type==='n36-job-cancel'&&Object.keys(m).sort().join()==='jobId,type'){
   const j=await load();if(j?.id===m.jobId)await finish(j,'cancelled','CANCELLED');return {ok:true};
  }
  if(m.type!=='n36-job-start'||Object.keys(m).sort().join()!=='sourceTabId,type'||!Number.isInteger(m.sourceTabId))throw Error('JOB_REQUEST');
  const op=starting.then(async()=>{
   const existing=await load();if(existing){try{await current(existing);return {ok:true,view:view(existing)};}catch{await finish(existing,'stopped','REVIEW_EXPIRED');}}
   // An action popup is not a tab and optional MessageSender.documentId is
   // not an authorization source. The own-extension popup URL is checked by
   // the worker; bind the explicit active browser tab and its REAL document.
   const tab=await chrome.tabs.get(m.sourceTabId);
   if(!Number.isInteger(tab?.windowId))throw Error('SOURCE_BINDING_CHANGED');
   const selected=await chrome.tabs.query({active:true,windowId:tab.windowId});
   const focused=await chrome.tabs.query({active:true,lastFocusedWindow:true});
   if(selected.length!==1||selected[0].id!==tab.id||focused.length!==1||focused[0].id!==tab.id)throw Error('SOURCE_BINDING_CHANGED');
   const origin=startOrigin(tab.url);safeRoute(origin,new URL(tab.url).pathname+new URL(tab.url).search);
   if(!Number.isInteger(tab.windowId))throw Error('SOURCE_BINDING_CHANGED');
   const now=Date.now(),j={id:hex(),tabId:tab.id,windowId:tab.windowId,sourceURL:tab.url,origin,sourceDocument:null,createdAt:now,expiresAt:now+1800000,phase:'binding',added:0,existing:0,routes:[],categories:[],visited:new Set(),warnings:[],skipped:[],pages:0,loops:0,series:new Map(),context:null,rosterSchools:new Set(),roleSwitchUsed:false,pendingSchoolTables:[],studentRowsSeen:0,sourceRows:[],excluded:0,sourceBytes:0,expires:null};
   let probe;try{probe=await chrome.scripting.executeScript({target:{tabId:j.tabId,frameIds:[0]},world:'ISOLATED',func:()=>location.href});}catch{throw Error('SOURCE_ACCESS_REQUIRED');}
   if(probe.length!==1||probe[0].frameId!==0||!probe[0].documentId||typeof probe[0].result!=='string'||sourceRoute(j,probe[0].result)!==sourceRoute(j,j.sourceURL))throw Error('SOURCE_BINDING_CHANGED');
   j.sourceDocument=probe[0].documentId;j.sourceURL=probe[0].result;
   // The trusted click is durable before ACK and before any school read.
   await chrome.storage.session.set({[JOB]:encode(j),[VIEW]:view(j)});await chrome.alarms.create(ALARM,{when:now+30000});
   try{
    let begin;try{begin=await transport({type:'n36-begin'},authority(j));}catch(e){throw Error(['APP_ACADEMIC_SELECTION_REQUIRED','APP_BATCH_UNRESOLVED'].includes(e.message)?e.message:'APP_NOT_READY');}if(!begin.ok)throw Error(begin.code??'APP_NOT_READY');j.batchId=begin.batchId;j.appTabId=begin.appTabId;
    await appGuard(j);const page=await source(j,'home');if(page.schoolChoices)throw Error('SCHOOL_CHOICE_REQUIRED');
    j.visited.add(routeIdentity(origin,j.sourceURL));j.next={kind:'home',page};j.startPhase='accepted';j.phase='collect';await save(j);return {ok:true,view:view(j)};
   }catch(e){await finish(j,'stopped',e.message,e);throw e;}
  });starting=op.catch(()=>{});const result=await op;
  // ACK now; the action popup has no ownership of this Promise or job.
  queueMicrotask(()=>wake().catch(()=>{}));return result;
 }
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)wake().catch(()=>{});});
 chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='complete'||change.url)load().then(j=>{if(j&&(j.tabId===id||j.appTabId===id))wake().catch(()=>{});}).catch(()=>{});});
 chrome.tabs.onRemoved.addListener(id=>{load().then(j=>{if(j&&(j.tabId===id||j.appTabId===id))finish(j,'stopped',j.tabId===id?'SOURCE_CLOSED':'APP_CLOSED');});});
 return {message,wake,async bootstrap(){const j=await load();if(!j)return;await chrome.alarms.create(ALARM,{when:Math.min(j.expiresAt,j.expires??Infinity,j.navigation?.readDeadline??j.navigation?.deadline??Infinity,Date.now()+30000)});return wake();}};
}
