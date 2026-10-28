// AI: fixed schema labels only; no values/counts/identities or arbitrary error metadata.
const validationFamilies=Object.freeze(["contexts.active","contexts.duplicate-key","contexts.fields","contexts.namespace","contexts.ownerId","contexts.row-bytes","contexts.row-count","credentials.duplicate-key","credentials.entryVerifier","credentials.fields","credentials.id","credentials.namespace","credentials.ownerId","credentials.revokedAt","credentials.row-bytes","credentials.row-count","credentials.studentId","credentials.verifier","credentials.version","memberships.canonicalStamp","memberships.classActive","memberships.classId","memberships.duplicate-key","memberships.endDate","memberships.enrollmentId","memberships.fields","memberships.label","memberships.ownerId","memberships.revision","memberships.row-bytes","memberships.row-count","memberships.status","memberships.studentActive","memberships.studentId","publications.classId","publications.deadline","publications.duplicate-key","publications.enrollmentId","publications.fields","publications.id","publications.instruction","publications.ownerId","publications.published","publications.row-bytes","publications.row-count","publications.source","publications.source.itemId","publications.source.teachingId","publications.status","publications.studentId","publications.title","rates.count","rates.duplicate-key","rates.fields","rates.key","rates.row-bytes","rates.row-count","rates.until","sessions.canonicalStamp","sessions.classId","sessions.credentialId","sessions.duplicate-key","sessions.enrollmentId","sessions.entryVerifier","sessions.expiresAt","sessions.fields","sessions.id","sessions.membershipRevision","sessions.namespace","sessions.ownerId","sessions.revokedAt","sessions.row-bytes","sessions.row-count","sessions.studentId","sessions.tokenHash","sessions.version","snapshot.aggregate-bytes","snapshot.fields","snapshot.row-count"]);
/** AI: staged browser composition. No config from URLs/storage/globals; no fallback. */
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { createClassPortalClient, classListRegion, classResponseStage } from './student-portal-class-client.js';
import { mountClassPortal } from '../views/student-portal-class.js';

// Last operational checkpoint only: never IDs, token, request/response data or route URLs.
let portalDiagnostic=null;
export function studentPortalDiagnostic(){return portalDiagnostic?{...portalDiagnostic}:null;}
const diagnosticCodes=['none','timeout','rejected','invalid_ack','stale_context','unavailable','uncertain'];
const diagnosticStages=['none','configuration','key-configuration','envelope','upstream','upstream-body','upstream-http-5xx','reply','reply-shape','acquire','begin','snapshot','repository','teacher','source','synchronize','synchronize-lock','synchronize-memberships','synchronize-sessions','synchronize-sources','synchronize-publications','synchronize-validate','projection','projection-finalize','projection-membership-flush','projection-commitguards','projection-commit','issuance-synchronize','issuance-roster','issuance-receipt','issuance-members','issuance-savepoint','issuance-recovery','issuance-member-result','issuance-member-release','issuance-member-rollback','issuance-flush'];
// AI: deployed native v133 vocabulary; accept the pair only, never arbitrary body fields.
function sourceClassification(httpStatus,stage,value){
 return httpStatus===503&&stage==='source'&&value&&
  ['source-lock','source-resolver','source-read-lock','source-read','source-decode','source-context'].includes(value.sourcePhase)&&
  ['deadline','cancelled','canonical-lock-contention','unclassified'].includes(value.sourceReason)
  ?{sourcePhase:value.sourcePhase,sourceReason:value.sourceReason}:{};
}
function checkpoint(phase,httpStatus=0,elapsedMs=0,code='none',stage='none',validationFamily='none',source=null){
 if(!['binding','queue','dispatch','http','response','admitted','failure'].includes(phase))return;
 portalDiagnostic={phase,httpStatus:Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:0,elapsedMs:Math.min(30000,Math.max(0,Math.round(elapsedMs/100)*100)),sourceVersion:'n88-class-deadline-v1',code:diagnosticCodes.includes(code)?code:'uncertain',stage:diagnosticStages.includes(stage)?stage:'none',...(httpStatus===503&&stage==='synchronize-validate'&&validationFamilies.includes(validationFamily)?{validationFamily}:{})};
 Object.assign(portalDiagnostic,sourceClassification(httpStatus,stage,source));
 return portalDiagnostic;
}
function failureSnapshot(value){
 if(!value||!['binding','queue','dispatch','http','response','admitted','failure'].includes(value.phase)||!diagnosticCodes.includes(value.code)||!diagnosticStages.includes(value.stage)||value.sourceVersion!=='n88-class-deadline-v1')return null;
 if(!Number.isInteger(value.httpStatus)||(value.httpStatus!==0&&(value.httpStatus<100||value.httpStatus>599))||!Number.isFinite(value.elapsedMs)||value.elapsedMs<0||value.elapsedMs>30000)return null;
 return Object.freeze({phase:value.phase,code:value.code,stage:value.stage,httpStatus:value.httpStatus,elapsedMs:Math.round(value.elapsedMs/100)*100,sourceVersion:'n88-class-deadline-v1',...sourceClassification(value.httpStatus,value.stage,value),...(value.httpStatus===503&&value.stage==='synchronize-validate'&&validationFamilies.includes(value.validationFamily)?{validationFamily:value.validationFamily}:{})});
}
// AI: one finite SAME-list-request support snapshot; write outcomes stay separate.
function listResponseSnapshot(root,diagnostic=null){
 const safe=failureSnapshot(diagnostic);try{
  const raw=root.getAttribute('data-n88-list-response');if(!raw||raw.length>256)return safe?JSON.stringify({schema:'n88-support-read-v1',kind:'entry-without-list',...safe}):null;
  const v=JSON.parse(raw);if(!v||Object.keys(v).length!==3||!['region','elapsedMs','outcome'].every(k=>Object.hasOwn(v,k))||classListRegion(v.region)!==v.region||!Number.isInteger(v.elapsedMs)||v.elapsedMs<0||v.elapsedMs>30000||!['success','failure'].includes(v.outcome))return null;
  const failure=v.outcome==='failure'?safe:null;
  return JSON.stringify({schema:'n88-support-read-v1',kind:'teacher-list-read',phase:failure?.phase||'admitted',code:failure?.code||'none',httpStatus:failure?.httpStatus||(v.outcome==='success'?200:0),stage:failure?.stage||'none',...sourceClassification(failure?.httpStatus,failure?.stage,failure),region:v.region,elapsedMs:v.elapsedMs,outcome:v.outcome,...(failure?.validationFamily?{validationFamily:failure.validationFamily}:{})});
 }catch{return null;}
}
function listResponseSupport(root,isCurrent,getDiagnostic=()=>null){
 const body=entryShell(root),doc=root.ownerDocument;let details=body.querySelector('[data-n88-failure-details]');
 if(!details){details=doc.createElement('details');const summary=doc.createElement('summary');summary.textContent='تفاصيل الدعم';details.append(summary);body.append(details);}details.dataset.n88ListSupport='';
 const button=doc.createElement('button');button.type='button';button.className='btn';button.dataset.n88CopyList='';button.textContent='نسخ تفاصيل الدعم';
 const text=doc.createElement('pre');text.dataset.n88FailureText='';
 const status=doc.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.n88ListCopyStatus='';
 const fallback=doc.createElement('textarea');fallback.readOnly=true;fallback.hidden=true;fallback.dir='ltr';fallback.rows=4;fallback.setAttribute('aria-label','تفاصيل الدعم للنسخ اليدوي');fallback.dataset.n88ListCopyText='';details.append(text,button,status,fallback);
 const valid=()=>root.contains(details)&&root.contains(button)&&isCurrent(),snapshot=()=>valid()?listResponseSnapshot(root,getDiagnostic()):null;
 const clear=()=>{fallback.value='';fallback.hidden=true;status.textContent='';text.textContent='';};
 details.addEventListener('toggle',()=>{clear();if(details.open){const value=snapshot();if(value)text.textContent=JSON.stringify(JSON.parse(value),null,2);else status.textContent='لا تتوفر تفاصيل لهذه القراءة.';}});
 button.addEventListener('click',async()=>{if(button.disabled)return;clear();const value=snapshot();if(!value){status.textContent='لا تتوفر تفاصيل لهذه القراءة. لم يُنسخ شيء.';return;}text.textContent=JSON.stringify(JSON.parse(value),null,2);button.disabled=true;try{const clipboard=doc.defaultView.navigator.clipboard;if(!clipboard?.writeText)throw Error('unavailable');await clipboard.writeText(value);if(snapshot()===value)status.textContent='تم نسخ تفاصيل الدعم.';else clear();}catch{if(snapshot()===value){fallback.value=value;fallback.hidden=false;status.textContent='تعذّر النسخ التلقائي. حدّد النص وانسخه يدويًا.';}else clear();}finally{button.disabled=false;}});
}
// Change only through a separately authorized, service-evidenced activation diff.
export const PORTAL_READINESS = Object.freeze({ enabled: true, serviceRevision: 'n88-integrated-class-v1', mode: 'public' });
const bindingError = state => Object.assign(new Error('Student portal context unavailable'), { portalState: state });
const ready = r => r?.enabled === true && ['pilot','public'].includes(r.mode) && r.serviceRevision === 'n88-integrated-class-v1';

/** Current account/store/lease fence. JWT session ID is only an echo fence;
 * the server independently verifies the bearer and exact current Auth session. */
export function classBinding({cloud,store,teachingId,guard=runtimeSyncOwnershipGuard},write=false) {
  const w=store.getActiveWorkspace(),ownerId=cloud.user?.id,session=cloud.session;
  const teaching=store.getTeaching(teachingId),term=store.activeTerm();
  if(!ownerId || !session?.access_token || cloud.authStatus().state!=='authenticated' || w?.type!=='account')throw bindingError('account');
  if(w.authUserId!==ownerId)throw bindingError('owner');
  if(!teaching || teaching.termId!==term?.id || store.isTeachingArchived(teaching))throw bindingError('source');
  try{store.assertClassOperationsAccess(teachingId);}catch(e){const status=store.classOperationsStatus?.(teachingId);throw bindingError(e.code==='OFFLINE_LEASE_LIMITED'||status==='lease'?'lease':status==='ownership'?'owner':status==='verification'?'account':'source');}
  let command=null;try{if(write)command=guard.bindNewCommand({ownerId});}catch{throw bindingError('lease');}
  const access=guard.cloudAccess({operation:write?'dispatch':'read',authenticatedUserId:ownerId,command});
  if(!access.allowed || access.workspaceOwnerId!==ownerId)throw bindingError('owner');
  try{store.assertLeaseWritable();}catch{throw bindingError('lease');}
  let payload;try{payload=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw bindingError('session');}
  const validUntil=Number(payload.exp)*1000;
  if(typeof payload.session_id!=='string'||!Number.isFinite(validUntil)||validUntil<=Date.now())throw bindingError('session');
  const context={enabled:true,ownerId,sessionId:payload.session_id,leaseId:w.id,
    teachingId,classId:teaching.sectionId,termId:term.id,contextRevision:JSON.stringify([teaching.revision??1,term.revision??1]),validUntil};
  // Only this class's canonical dependencies participate; cloud progress/profile
  // notifications must not retire an otherwise identical admitted entry. Kept
  // transiently in memory, never persisted or sent as authorization metadata.
  const state=store.state||{}, enrolled=(state.enrollments||[]).filter(r=>r.sectionId===teaching.sectionId),
    studentIds=new Set(enrolled.map(r=>r.studentId)), items=(state.items||[]).filter(r=>r.teachingId===teachingId),itemIds=new Set(items.map(r=>r.id));
  const source=[(state.years||[]).filter(r=>r.id===term.yearId),(state.sections||[]).filter(r=>r.id===teaching.sectionId),
    enrolled,(state.students||[]).filter(r=>studentIds.has(r.id)),items,(state.scoreSubitems||[]).filter(r=>itemIds.has(r.itemId))];
  // Refreshing the bearer within the SAME verified Auth session is not a new
  // disclosure identity. Every request still obtains the current bearer and runs
  // all owner/lease/expiry/source guards. Canonical row order is not a revision.
  const {validUntil:deadline,...identity}=context;
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
  const snapshot=source.map(rows=>rows.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(stable));
  return {token:session.access_token,context,receiptScope:JSON.stringify([w.id,w.databaseName,w.leaseGeneration]),key:JSON.stringify([w.id,w.databaseName,w.leaseGeneration,identity,snapshot])};
}
export function mountClassService(root,{readiness=PORTAL_READINESS,fetch:send=globalThis.fetch,getBinding,subscribe=()=>()=>{},classLabel,readTimeoutMs=10000}={}) {
  let active, key, disposed=false;
  // The lane survives a binding renewal. Dispose cancels only its owned HTTP
  // work; the unchanged server transaction/lock/COMMIT guards remain authoritative.
  let requestTail=Promise.resolve();
  const enqueue=operation=>{const pending=requestTail.then(operation);requestTail=pending.then(()=>{},()=>{});return pending;};
  const reconcileEntry=force=>{if(disposed)return;let next;try{next=getBinding(false).key;}catch{next=null;}
    if(!force&&active&&next===key)return;portalDiagnostic=null;active?.dispose();key=next;
    active=mountBoundClassService(root,{readiness,fetch:send,getBinding,subscribe,classLabel,enqueue,readTimeoutMs});
  };
  const reconcile=()=>reconcileEntry(false);
  const retry=event=>{if(event.target.closest('[data-n88-retry]'))reconcileEntry(true);};
  root.addEventListener('click',retry);
  // Visibility/focus can reveal a renewed session or lease before a store event.
  // Re-admit through the original real guard, never reuse the old bound context.
  const doc=root.ownerDocument,win=doc.defaultView;
  const wake=()=>{if(doc.visibilityState==='visible')reconcile();};
  win.addEventListener('focus',wake);win.addEventListener('pageshow',wake);doc.addEventListener('visibilitychange',wake);
  reconcile();const unsubscribe=subscribe(reconcile);
  return {dispose(){disposed=true;unsubscribe?.();root.removeEventListener('click',retry);win.removeEventListener('focus',wake);win.removeEventListener('pageshow',wake);doc.removeEventListener('visibilitychange',wake);active?.dispose();root.replaceChildren();}};
}
function mountBoundClassService(root,{readiness,fetch:send,getBinding,subscribe,classLabel,enqueue,readTimeoutMs}) {
  root.removeAttribute('data-n88-list-response');
  if(!ready(readiness)){classEntryState(root,'disabled');return {dispose(){root.replaceChildren();}};}
  let ownDiagnostic=null;const record=(...args)=>{ownDiagnostic=checkpoint(...args);};
  let initial;try{initial=getBinding(false);record('binding');}catch(e){let retired=false;const state=e.portalState||'context';record('binding',0,0,'unavailable');classEntryState(root,state,ownDiagnostic,()=>{if(retired)return false;try{getBinding(false);return false;}catch(next){return (next.portalState||'context')===state;}});return {dispose(){retired=true;root.replaceChildren();}};}
  let disposed=false,handle=null,admitted=false,failure='connection';const entryStarted=performance.now(),lifetime=new AbortController();
  let ownListFailure=null;
  const current=write=>{try{const b=getBinding(write);if(disposed||b.key!==initial.key)throw bindingError('context');return b;}catch(e){failure=e.portalState||'context';throw e;}};
  const getContext=()=>{try{return current(false).context;}catch{return null;}};
  const client=createClassPortalClient({getContext,getReceiptScope:()=>current(false).receiptScope??'',readTimeoutMs,onListDiagnostic:value=>{
    if(disposed)return;
    if(value===null){ownListFailure=null;root.removeAttribute('data-n88-list-response');return;}
    try{current(false);ownListFailure=value.outcome==='failure'?failureSnapshot(ownDiagnostic):null;root.setAttribute('data-n88-list-response',JSON.stringify(value));}catch{root.removeAttribute('data-n88-list-response');}
  },onGuidanceDiagnostic:value=>{
    root.querySelector('[data-n88-guidance-details]')?.remove();
    if(disposed||!value)return;
    try{current(false);}catch{return;}
    // The client emits only fixed operational fields, never ACK data or request context.
    const snapshot=Object.freeze({...value});
    const details=root.ownerDocument.createElement('details');details.dataset.n88GuidanceDetails='';
    const summary=root.ownerDocument.createElement('summary');summary.textContent='تفاصيل دعم قراءة التعليمات';
    const text=root.ownerDocument.createElement('pre');text.dataset.n88FailureText='';details.append(summary,text);entryShell(root).append(details);
    details.addEventListener('toggle',()=>{try{current(false);text.textContent=details.open?JSON.stringify(snapshot,null,2):'';}catch{details.remove();}});
  },onMutationDiagnostic:value=>{
    root.querySelector('[data-n88-mutation-details]')?.remove();
    if(disposed||!value)return;
    try{current(false);}catch{return;}
    const snapshot=Object.freeze({...value,stage:diagnosticStages.includes(value.stage)?value.stage:'none'});
    record('http',snapshot.httpStatus,snapshot.elapsedMs,snapshot.code,snapshot.stage);
    const details=root.ownerDocument.createElement('details');details.dataset.n88MutationDetails='';
    const summary=root.ownerDocument.createElement('summary');summary.textContent='تفاصيل دعم العملية (ليست قراءة القائمة)';
    const text=root.ownerDocument.createElement('pre');details.append(summary,text);entryShell(root).append(details);
    details.addEventListener('toggle',()=>{try{current(false);text.textContent=details.open?JSON.stringify(snapshot,null,2):'';}catch{details.remove();}});
  },request:(path,init)=>{
    // List/guidance share the same authoritative short DB lock. Serialize this
    // owner's browser requests before dispatch, retaining all binding/lease checks.
    const started=performance.now();record('queue');
    return enqueue(async()=>{
    if(init.signal?.aborted)throw bindingError('connection');
    const b=current(true);
    // Version only the list response contract; this marker grants no admission.
    // Older published pilot clients keep working during the public source rollout.
    const body=path.endsWith('/list')&&readiness.mode==='public'?JSON.stringify({...JSON.parse(init.body),uiProtocol:'n88-public-ui-v1'}):init.body;
    record('dispatch',0,performance.now()-started);
    const signal=AbortSignal.any([init.signal,lifetime.signal]);
    // Retire this lane even when an injected/failed transport ignores abort.
    // The client deadline includes time queued here; a timed-out operation is
    // never dispatched later, and no command is replayed.
    let cancel;
    const cancelled=new Promise((_,reject)=>{cancel=()=>reject(bindingError('context'));signal.addEventListener('abort',cancel,{once:true});});
    let response;
    try{response=await Promise.race([send(path,{...init,signal,body,headers:{...init.headers,Authorization:'Bearer '+b.token}}),cancelled]);}
    finally{signal.removeEventListener('abort',cancel);}
    if(signal.aborted)throw bindingError('context');
    const stage=classResponseStage(response.status,response.headers);
    let validationFamily='none',source=null;
    // Existing failure body only, on this same owner-fenced response. No extra request or raw body retention.
    if(path==='/api/n88/teacher/class/list'&&response.status===503&&['synchronize-validate','source'].includes(stage)){
      // Keep metadata reads inside the existing cancellation/deadline fence, even
      // when a failed transport ignores abort while delivering its body.
      signal.addEventListener('abort',cancel,{once:true});
      try{const metadata=await Promise.race([response.json(),cancelled]);if(metadata?.stage===stage){if(stage==='synchronize-validate'&&validationFamilies.includes(metadata.validationFamily))validationFamily=metadata.validationFamily;if(stage==='source')source=sourceClassification(response.status,stage,metadata);}}catch{}
      finally{signal.removeEventListener('abort',cancel);}
      if(signal.aborted)throw bindingError('context');current(false);
    }
    record('http',response.status,performance.now()-started,'none',stage,validationFamily,source);
    if(!response.ok)failure=[401,403].includes(response.status)?'denied':'connection';
    const region=path==='/api/n88/teacher/class/list'?classListRegion(response.headers?.get('x-n88-service-region')):'unknown';
    current(false);return {ok:response.ok,status:response.status,headers:new Headers({'x-n88-service-region':region,'x-n88-service-stage':stage}),async json(){const data=await response.json();if(signal.aborted)throw bindingError('context');current(false);
      if(!data||typeof data!=='object'||Array.isArray(data))return data;
      // Server admission follows verified Auth/session/current source ownership.
      // Strip its rollout metadata before the existing exact ACK validator.
      if(path.endsWith('/list')){
        if(data.rollout!==readiness.mode){failure='revision';throw bindingError('revision');}
        admitted=true;
      }
      const {rollout,...ack}=data;record('response',response.status,performance.now()-started,'none',stage);return ack;}};
    });
  }});
  classEntryState(root,'loading');
  // No controls/private roster until the normal authenticated service admits this owner.
  void client.listClass(initial.context.teachingId).then(initialList=>{
    current(false);if(!admitted)throw Error('unavailable');record('admitted',200,ownDiagnostic?.elapsedMs||0);
    const content=root.ownerDocument.createElement('div');entryShell(root).replaceChildren(content);
    if(readiness.mode==='pilot'){
      const note=root.ownerDocument.createElement('p');note.setAttribute('role','status');
      note.textContent='تجربة محدودة · مساحة طلاب الفصل';content.before(note);
    }
    root.dataset.n88EntryState='ready';root.setAttribute('aria-busy','false');
    // Reuse this exact admitted/validated list instead of a second blocking read.
    let firstList=initialList;
    const admittedClient={...client,listClass:async teachingId=>{current(false);if(firstList&&teachingId===initial.context.teachingId){const data=firstList;firstList=null;return data;}return client.listClass(teachingId);}};
    handle=mountClassPortal(content,{client:admittedClient,getContext,subscribe,classLabel});
    listResponseSupport(root,()=>{try{current(false);return true;}catch{return false;}},()=>ownListFailure);
  }).catch(e=>{if(!disposed){const last=ownDiagnostic;record(last?.phase||'binding',last?.httpStatus||0,performance.now()-entryStarted,e.code||'uncertain',last?.stage,last?.validationFamily,last);classEntryState(root,e.portalState||(e.code==='timeout'?'timeout':failure),ownDiagnostic,()=>{try{current(false);return true;}catch{return false;}});}});
  return {dispose(){disposed=true;lifetime.abort();handle?.dispose();root.removeAttribute('data-n88-list-response');root.replaceChildren();}};
}
const classEntryMessages={timeout:'لم تكتمل قراءة الفصل خلال المهلة. أعد المحاولة؛ لم نغيّر أي رمز أو إعداد.',loading:'جارٍ فتح مساحة طلاب الفصل…',disabled:'مساحة طلاب الفصل غير متاحة حاليًا.',account:'يلزم حساب معلم متصل لفتح مساحة الفصل.',owner:'تعذّر تأكيد سياق الحساب. أعد فتح الفصل من حساب مالكه.',source:'هذا الفصل غير متاح ضمن السياق الدراسي الحالي.',lease:'تعذّر تأكيد صلاحية المزامنة لهذا التبويب. أعد فتح الفصل في التبويب النشط.',session:'انتهت صلاحية الاتصال بالحساب. أعد الاتصال ثم حاول مجددًا.',context:'تغيّر سياق الاتصال. أعد المحاولة لفتح الفصل من جديد.',denied:'لم يسمح الخادم بفتح المساحة لهذا السياق. تحقق من الحساب والفصل ثم أعد المحاولة.',revision:'تحتاج مساحة الطلاب إلى تحديث التطبيق. حدّث الصفحة ثم أعد المحاولة.',connection:'تعذّر الاتصال بمساحة الطلاب. حاول مجددًا.'};
function entryShell(root){
 let body=[...root.children].find(node=>node.hasAttribute('data-n88-entry-body'));
 root.classList.add('n88-entry');
 if(!body){body=root.ownerDocument.createElement('div');body.dataset.n88EntryBody='';}
 // This root is exclusively owned by the entry runtime. A retained/repainted
 // shell must never keep a second status fragment beside its authoritative body.
 if(root.childNodes.length!==1||root.firstChild!==body)root.replaceChildren(body);return body;
}
function classEntryState(root,state,diagnostic=null,isCurrent=()=>false){
 if(!Object.hasOwn(classEntryMessages,state))state='context';
 const body=entryShell(root);body.replaceChildren();root.dataset.n88EntryState=state;root.setAttribute('aria-busy',String(state==='loading'));
 const message=root.ownerDocument.createElement('p');message.dataset.n88EntryStatus='';message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.textContent=diagnostic?.stage==='source'&&diagnostic?.sourceReason==='canonical-lock-contention'?'بيانات الفصل مشغولة مؤقتًا بعملية أخرى. لم تُؤكَّد قراءة جديدة؛ راجع القائمة بعد اكتمال العملية.':classEntryMessages[state];body.append(message);
 if(!['loading','disabled'].includes(state)){const button=root.ownerDocument.createElement('button');button.type='button';button.className='btn';button.dataset.n88Retry='';button.textContent='مراجعة القائمة';body.append(button);}
 const snapshot=failureSnapshot(diagnostic);
 if(!['loading','disabled'].includes(state))listResponseSupport(root,isCurrent,()=>snapshot);
}
export function unavailable(root) {
  root.replaceChildren();
  const message = root.ownerDocument.createElement('p');
  message.setAttribute('role', 'status');
  message.textContent = 'مساحة الطالب غير متاحة حاليًا. لم تُفعّل الخدمة الخاصة بعد.';
  root.append(message);
}
function style(root) {
  const doc = root.ownerDocument;
  if (doc.querySelector('[data-n88-style]')) return;
  const link = doc.createElement('link'); link.rel = 'stylesheet'; link.dataset.n88Style = '';
  link.href = new URL('../styles/student-portal.css', import.meta.url).href; doc.head.append(link);
}

/** Same real owner guard as account dispatch, with an explicit owner-bound command. */
export function teacherBinding({ cloud, store, studentId, guard = runtimeSyncOwnershipGuard }, write = false) {
  const w = store.getActiveWorkspace(), ownerId = cloud.user?.id, token = cloud.session?.access_token;
  const member = store.activeEnrollment(studentId);
  if (!ownerId || !token || cloud.authStatus().state !== 'authenticated' ||
      w?.type !== 'account' || w.authUserId !== ownerId || !member || member.status !== 'active' || member.endDate) throw Error('unavailable');
  const command = write ? guard.bindNewCommand({ ownerId }) : null;
  const access = guard.cloudAccess({ operation: write ? 'dispatch' : 'read', authenticatedUserId: ownerId, command });
  if (!access.allowed || access.workspaceOwnerId !== ownerId) throw Error('unavailable');
  return { token, enrollmentId: member.id, key: JSON.stringify([w.id, w.databaseName, ownerId, token, studentId, member.id, member.revision]) };
}

/** Retired four-digit/private-link entry points stay unavailable even after class activation. */
export function mountStudentService(root) {
  style(root);unavailable(root);return {dispose(){root.replaceChildren();}};
}
export function mountTeacherService(root) {
  style(root);unavailable(root);return {dispose(){root.replaceChildren();}};
}
