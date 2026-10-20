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
export function createBackgroundRunner({transport}){
 let running=null,wakeRequested=false,starting=Promise.resolve(),mutations=Promise.resolve();
 const mutate=operation=>{const r=mutations.then(operation);mutations=r.catch(()=>{});return r;};
 const load=async()=>{const v=(await chrome.storage.session.get(JOB))[JOB];return v?decode(v):null;};
 const authority=j=>({jobId:j.id,windowId:j.windowId});
 const view=j=>({id:j.id,phase:j.phase,code:j.code??null,added:j.added,existing:j.existing,fields:j.fields??[],staged:j.sourceRows.length,observed:j.studentRowsSeen,coverage:j.coverage?.coverage??'unknown',receiverCapability:j.batchId?'source-profile-quiet-v1':'unknown',needsReview:!!j.needsReview});
 async function current(j){const v=await load();if(!v||v.id!==j.id)throw Error('CANCELLED');if(Date.now()>=j.expiresAt||j.expires&&Date.now()>=j.expires||!j.expires&&Date.now()>=j.createdAt+RUN_LIMITS.milliseconds)throw Error('REVIEW_EXPIRED');if(j.pending&&Date.now()>=j.pending.envelope.expiresAt)throw Error('RECEIPT_UNKNOWN');}
 async function save(j){return mutate(async()=>{await current(j);await chrome.storage.session.set({[JOB]:encode(j),[VIEW]:view(j)});await chrome.alarms.create(ALARM,{when:Math.min(j.expiresAt,j.expires??Infinity,Date.now()+30000)});});}
 async function finish(j,phase,code=null){return mutate(async()=>{
  const v=await load();if(!v||v.id!==j.id)return;
  await chrome.storage.session.remove(JOB);await chrome.alarms.clear(ALARM);
  await chrome.storage.session.set({[VIEW]:{...view(j),phase,code}});
  try{await chrome.scripting.executeScript({target:{tabId:j.tabId,...(j.sourceDocument?{documentIds:[j.sourceDocument]}:{frameIds:[0]})},world:'ISOLATED',func:id=>{for(const [key,c] of globalThis.rakeezReportRequests??[])if(key.startsWith(id+'|'))c.abort();},args:[j.id]});}catch{/* Lost source access is never recovered by navigation. */}
  // Revoke this job only. App-owned durable batches are never deleted.
  await transport({type:'n36-cancel'},authority(j));
 });}
 async function appGuard(j,wait=false){await current(j);const r=await transport({type:'n36-check',batchId:j.batchId,wait},authority(j));if(!r?.ok)throw Error('APP_CHANGED');await current(j);return r.ready;}
 async function source(j,mode='guard'){
  await current(j);const tab=await chrome.tabs.get(j.tabId);
  if(tab.url!==j.sourceURL||new URL(tab.url).origin!==j.origin)throw Error('SOURCE_CONTEXT_CHANGED');
  safeRoute(j.origin,new URL(tab.url).pathname+new URL(tab.url).search,j.context);
  const probe=await chrome.scripting.executeScript({target:{tabId:j.tabId,frameIds:[0]},world:'ISOLATED',func:()=>true});
  await current(j);
  if(probe.length!==1||probe[0].frameId!==0||!probe[0].documentId||j.sourceDocument&&probe[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
  j.sourceDocument=probe[0].documentId;
  const target={tabId:j.tabId,documentIds:[j.sourceDocument]};
  await chrome.scripting.executeScript({target,world:'ISOLATED',files:['route-diagnostics.js']});
  const r=await chrome.scripting.executeScript({target,world:'ISOLATED',func:readAutomaticTeacherPage,args:[['students','timetable'].includes(mode)?'guard':mode,null,j.context]});
  await current(j);
  if(r.length!==1||r[0].frameId!==0||!r[0].documentId||j.sourceDocument&&r[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
  if(!r[0].result?.ok){const e=Error(r[0].result?.code??'SOURCE_UNAVAILABLE');e.retry=r[0].result?.retry;e.incomplete=r[0].result?.incomplete;throw e;}
  if(mode==='home'&&j.context?.kind==='selected-teacher-card'&&r[0].result.runContext?.kind==='selected-teacher-card'&&['roleTargetId','href','schoolName'].some(k=>j.context[k]!==r[0].result.runContext[k]))throw Error('SCHOOL_CONTEXT_CHANGED');
  j.sourceDocument=r[0].documentId;
  if(mode==='guard'){
   const g=await chrome.scripting.executeScript({target,world:'ISOLATED',func:readSourceReportPage,args:['guard']});
   await current(j);if(g.length!==1||g[0].documentId!==j.sourceDocument||!g[0].result?.ok)throw Error(g[0]?.result?.code??'SOURCE_BINDING_CHANGED');
  }
  if((await chrome.tabs.get(j.tabId)).url!==j.sourceURL)throw Error('SOURCE_CONTEXT_CHANGED');
  if(['students','timetable'].includes(mode)){
   const a=await chrome.scripting.executeScript({target,world:'ISOLATED',func:readSourceReportPage,args:[mode,{...j.context,rowOffset:j.next?.rowOffset??0}]});
   await current(j);
   if(a.length!==1||a[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');
   if(!a[0].result?.ok){const e=Error(a[0]?.result?.code??'SOURCE_UNAVAILABLE');e.incomplete=a[0]?.result?.incomplete;e.retry=a[0]?.result?.retry;e.observedRows=a[0]?.result?.observedRows;throw e;}
   return a[0].result;
  }
  return r[0].result;
 }
 async function readNext(j){
  const n=j.next;if(n.page)return n;
  await appGuard(j);await source(j,['role','gateway'].includes(n.kind)?'home':'guard');
  const target=safeRoute(j.origin,n.path,n.context??j.context);
  if(n.kind==='students'&&/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(new URL(target).pathname)){
   const path=new URL(target).pathname;if(j.reportPath&&j.reportPath!==path)throw Error('REPORT_CONTEXT_CHANGED');j.reportPath=path;
   const r=await chrome.scripting.executeScript({target:{tabId:j.tabId,documentIds:[j.sourceDocument]},world:'ISOLATED',func:readSourceReportPage,args:['fetch',{...j.context,path:n.path,sourceURL:j.sourceURL,rowOffset:n.rowOffset??0,requestId:j.id+'|'+n.path+'|'+(n.rowOffset??0),remainingMs:Math.min(8000,j.expiresAt-Date.now())}]});
   await current(j);if(r.length!==1||r[0].documentId!==j.sourceDocument)throw Error('SOURCE_BINDING_CHANGED');if(!r[0].result?.ok){const e=Error(r[0]?.result?.code??'REPORT_FETCH_FAILED');e.incomplete=r[0]?.result?.incomplete;throw e;}
   await source(j);await appGuard(j);return {...n,page:r[0].result};
  }
  if(/\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(target).pathname)){if(j.roleSwitchUsed)throw Error('ROLE_SWITCH_REPEATED');j.roleSwitchUsed=true;}
  // A crash before update may only resume if still in the original document;
  // a crash after update may only accept the exact planned destination.
  j.navigation={from:j.sourceURL,documentId:j.sourceDocument,target,kind:n.kind,issued:true,deadline:Date.now()+30000};j.phase='navigation';await save(j);
  await source(j,['role','gateway'].includes(n.kind)?'home':'guard');await appGuard(j);
  await chrome.tabs.update(j.tabId,{url:target});return null;
 }
 function partialPage(j,next,e){
  if(!['students','timetable'].includes(next.kind)||!e.incomplete&&e.message!=='PAGE_TIMEOUT'||/CONTEXT|BINDING|ORIGIN|LOGIN|ROLE|UNSAFE|SCHOOL|SESSION/.test(e.message))throw e;
  if(e.observedRows)j.studentRowsSeen+=e.observedRows;
  const optional=e.message==='ROSTER_LINKS_UNAVAILABLE'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(new URL(next.path,j.origin).pathname);
  return {tables:[],links:[],warnings:[{category:next.kind,code:e.message,optional}],skipped:[]};
 }
 async function settleNavigation(j){
  await appGuard(j);const n=j.navigation,tab=await chrome.tabs.get(j.tabId);
  if(tab.url===n.from){
   if(tab.status==='loading')return false;
   throw Error('NAVIGATION_UNCONFIRMED'); // Never replay an uncertain role/navigation command.
  }
  const transition=/\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(n.target).pathname);
  const redirected=transition&&new URL(tab.url).origin===j.origin&&/^\/Dashboards\/Schools\/?$/i.test(new URL(tab.url).pathname);
  if(tab.url!==n.target&&!redirected)throw Error('SOURCE_CONTEXT_CHANGED');
  if(tab.status!=='complete'||transition&&!redirected){if(Date.now()>=n.deadline)throw Error('TEACHER_TRANSITION_UNRESOLVED');return false;}
  j.sourceURL=tab.url;j.sourceDocument=null;
  let page;try{page=await source(j,n.kind);}catch(e){if(e.retry&&Date.now()<n.deadline)return false;page=partialPage(j,j.next,e);}if(page.schoolChoices)throw Error('SCHOOL_CHOICE_REQUIRED');
  j.next={...j.next,page};j.navigation=null;j.phase='collect';await save(j);return true;
 }
 function setup(j){
  const out=j.categories.filter(c=>c.category!=='students'&&!j.warnings.some(w=>w.category===c.category)).map(c=>({...c,provenance:['teacher-readonly-run']}));
  if(!out.some(c=>c.category==='classes'))out.push({category:'classes',provenance:['teacher-readonly-run'],rows:[...new Set(j.sourceRows.map(r=>r.classroom))].map(classroom=>({classroom}))});
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
    if(!await appGuard(j,j.phase==='receipt'))break;
    if(j.phase==='navigation'){if(!await settleNavigation(j))break;continue;}
    await source(j,j.phase==='collect'&&['home','role','gateway'].includes(j.next?.kind)?'home':'guard');
    if(j.phase==='collect'){
     let next;try{next=await readNext(j);}catch(e){next={...j.next,page:partialPage(j,j.next,e)};}if(!next)continue;
     consumePage(j,next);j.pages++;await save(j);
     if(j.next)continue;
     if(!j.sourceRows.length)throw Error('SOURCE_NOT_AVAILABLE');
     j.coverage=sourceCoverage({series:j.series,warnings:j.warnings,pendingReportPages:j.remainingReportPages??0});j.phase='transfer';j.classIndex=0;j.offset=0;await save(j);continue;
    }
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
     if(r.status==='pending')break;
     if(r.status==='unknown'){j.code=r.failure?.code??'RECEIPT_UNKNOWN';await save(j);break;}
     if(!['saved','existing'].includes(r.status)||r.total!==j.pending.envelope.rows.length||!r.setup?.details?.length)throw Error('RECEIPT_UNKNOWN');
     j.added+=r.added;j.existing+=r.existing;j.needsReview ||= r.setup.unresolved>0;const ranks={missing:0,current:1,saved:2,conflict:3,unsupported:3,ambiguous:3,unrecognized:3},fields=new Map((j.fields??[]).map(d=>[d.field,d]));
     for(const d of r.setup.details)if(!fields.has(d.field)||ranks[d.reason]>=ranks[fields.get(d.field).reason])fields.set(d.field,d);j.fields=[...fields.values()];j.code=null;
     j.offset+=r.total;const group=sourceClasses(j.sourceRows)[j.classIndex];if(j.offset===group.count){j.classIndex++;j.offset=0;}
     // Checkpoint cursor BEFORE removing a consumed receipt. Crashes cannot double ACK.
     const actionId=j.pending.actionId;j.pending=null;j.phase='transfer';await save(j);
     await chrome.storage.session.remove('receipt:'+actionId);await chrome.alarms.clear('handoff:'+actionId);continue;
    }
    throw Error('JOB_PHASE');
   }
   await save(j);
  }catch(e){await finish(j,e.message==='CANCELLED'?'cancelled':'stopped',/^[A-Z_]+$/.test(e.message)?e.message:'BACKGROUND_UNAVAILABLE');}
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
   let probe;try{probe=await chrome.scripting.executeScript({target:{tabId:j.tabId,frameIds:[0]},world:'ISOLATED',func:()=>true});}catch{throw Error('SOURCE_ACCESS_REQUIRED');}
   if(probe.length!==1||probe[0].frameId!==0||!probe[0].documentId||(await chrome.tabs.get(j.tabId)).url!==j.sourceURL)throw Error('SOURCE_BINDING_CHANGED');
   j.sourceDocument=probe[0].documentId;
   // The trusted click is durable before ACK and before any school read.
   await chrome.storage.session.set({[JOB]:encode(j),[VIEW]:view(j)});await chrome.alarms.create(ALARM,{when:now+30000});
   try{
    let begin;try{begin=await transport({type:'n36-begin'},authority(j));}catch{throw Error('APP_NOT_READY');}if(!begin.ok)throw Error(begin.code??'APP_NOT_READY');j.batchId=begin.batchId;j.appTabId=begin.appTabId;
    await appGuard(j);const page=await source(j,'home');if(page.schoolChoices)throw Error('SCHOOL_CHOICE_REQUIRED');
    j.visited.add(routeIdentity(origin,tab.url));j.next={kind:'home',page};j.phase='collect';await save(j);return {ok:true,view:view(j)};
   }catch(e){await finish(j,'stopped',e.message);throw e;}
  });starting=op.catch(()=>{});const result=await op;
  // ACK now; the action popup has no ownership of this Promise or job.
  queueMicrotask(()=>wake().catch(()=>{}));return result;
 }
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)wake().catch(()=>{});});
 chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='complete'||change.url)load().then(j=>{if(j&&(j.tabId===id||j.appTabId===id))wake().catch(()=>{});}).catch(()=>{});});
 chrome.tabs.onRemoved.addListener(id=>{load().then(j=>{if(j&&(j.tabId===id||j.appTabId===id))finish(j,'stopped',j.tabId===id?'SOURCE_CLOSED':'APP_CLOSED');});});
 return {message,wake,async bootstrap(){const j=await load();if(!j)return;await chrome.alarms.create(ALARM,{when:Math.min(j.expiresAt,j.expires??Infinity,Date.now()+30000)});return wake();}};
}
