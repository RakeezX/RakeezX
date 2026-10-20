/** AI: staged browser composition. No config from URLs/storage/globals; no fallback. */
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { createClassPortalClient } from './student-portal-class-client.js';
import { mountClassPortal } from '../views/student-portal-class.js';

// Last operational checkpoint only: never IDs, token, request/response data or route URLs.
let portalDiagnostic=null;
export function studentPortalDiagnostic(){return portalDiagnostic?{...portalDiagnostic}:null;}
const diagnosticCodes=['none','timeout','rejected','invalid_ack','stale_context','unavailable','uncertain'];
const diagnosticStages=['none','configuration','key-configuration','envelope','upstream','upstream-body','upstream-http-5xx','reply','reply-shape','acquire','begin','snapshot','repository','teacher','source','synchronize','projection'];
function checkpoint(phase,httpStatus=0,elapsedMs=0,code='none',stage='none'){
 if(!['binding','queue','dispatch','http','response','admitted','failure'].includes(phase))return;
 portalDiagnostic={phase,httpStatus:Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:0,elapsedMs:Math.min(30000,Math.max(0,Math.round(elapsedMs/100)*100)),sourceVersion:'n88-class-deadline-v1',code:diagnosticCodes.includes(code)?code:'uncertain',stage:diagnosticStages.includes(stage)?stage:'none'};
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
  return {token:session.access_token,context,key:JSON.stringify([w.id,w.databaseName,w.leaseGeneration,identity,snapshot])};
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
  if(!ready(readiness)){classEntryState(root,'disabled');return {dispose(){root.replaceChildren();}};}
  let initial;try{initial=getBinding(false);checkpoint('binding');}catch(e){checkpoint('binding',0,0,'unavailable');classEntryState(root,e.portalState||'context');return {dispose(){root.replaceChildren();}};}
  let disposed=false,handle=null,admitted=false,failure='connection';const entryStarted=performance.now(),lifetime=new AbortController();
  const current=write=>{try{const b=getBinding(write);if(disposed||b.key!==initial.key)throw bindingError('context');return b;}catch(e){failure=e.portalState||'context';throw e;}};
  const getContext=()=>{try{return current(false).context;}catch{return null;}};
  const client=createClassPortalClient({getContext,readTimeoutMs,request:(path,init)=>{
    // List/guidance share the same authoritative short DB lock. Serialize this
    // owner's browser requests before dispatch, retaining all binding/lease checks.
    const started=performance.now();checkpoint('queue');
    return enqueue(async()=>{
    if(init.signal?.aborted)throw bindingError('connection');
    const b=current(true);
    // Version only the list response contract; this marker grants no admission.
    // Older published pilot clients keep working during the public source rollout.
    const body=path.endsWith('/list')&&readiness.mode==='public'?JSON.stringify({...JSON.parse(init.body),uiProtocol:'n88-public-ui-v1'}):init.body;
    checkpoint('dispatch',0,performance.now()-started);
    const signal=AbortSignal.any([init.signal,lifetime.signal]);
    const response=await send(path,{...init,signal,body,headers:{...init.headers,Authorization:'Bearer '+b.token}});
    if(signal.aborted)throw bindingError('context');
    const stage=response.headers?.get('x-n88-service-stage')||response.headers?.get('x-n88-transport-stage')||'none';
    checkpoint('http',response.status,performance.now()-started,'none',stage);
    if(!response.ok)failure=[401,403].includes(response.status)?'denied':'connection';
    current(false);return {ok:response.ok,async json(){const data=await response.json();if(signal.aborted)throw bindingError('context');current(false);
      // Server admission follows verified Auth/session/current source ownership.
      // Strip its rollout metadata before the existing exact ACK validator.
      if(path.endsWith('/list')){
        if(data.rollout!==readiness.mode){failure='revision';throw bindingError('revision');}
        admitted=true;
      }
      const {rollout,...ack}=data;checkpoint('response',response.status,performance.now()-started,'none',stage);return ack;}};
    });
  }});
  classEntryState(root,'loading');
  // No controls/private roster until the normal authenticated service admits this owner.
  void client.listClass(initial.context.teachingId).then(initialList=>{
    current(false);if(!admitted)throw Error('unavailable');checkpoint('admitted',200,portalDiagnostic?.elapsedMs||0);
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
  }).catch(e=>{if(!disposed){const last=portalDiagnostic;checkpoint(last?.phase||'binding',last?.httpStatus||0,performance.now()-entryStarted,e.code||'uncertain',last?.stage);classEntryState(root,e.portalState||(e.code==='timeout'?'timeout':failure));}});
  return {dispose(){disposed=true;lifetime.abort();handle?.dispose();root.replaceChildren();}};
}
const classEntryMessages={timeout:'لم تكتمل قراءة الفصل خلال المهلة. أعد المحاولة؛ لم نغيّر أي رمز أو إعداد.',loading:'جارٍ فتح مساحة طلاب الفصل…',disabled:'مساحة طلاب الفصل غير متاحة حاليًا.',account:'يلزم حساب معلم متصل لفتح مساحة الفصل.',owner:'تعذّر تأكيد سياق الحساب. أعد فتح الفصل من حساب مالكه.',source:'هذا الفصل غير متاح ضمن السياق الدراسي الحالي.',lease:'تعذّر تأكيد صلاحية المزامنة لهذا التبويب. أعد فتح الفصل في التبويب النشط.',session:'انتهت صلاحية الاتصال بالحساب. أعد الاتصال ثم حاول مجددًا.',context:'تغيّر سياق الاتصال. أعد المحاولة لفتح الفصل من جديد.',denied:'لم يسمح الخادم بفتح المساحة لهذا السياق. تحقق من الحساب والفصل ثم أعد المحاولة.',revision:'تحتاج مساحة الطلاب إلى تحديث التطبيق. حدّث الصفحة ثم أعد المحاولة.',connection:'تعذّر الاتصال بمساحة الطلاب. حاول مجددًا.'};
function entryShell(root){
 let body=root.querySelector('[data-n88-entry-body]');if(body)return body;
 root.classList.add('n88-entry');
  body=root.ownerDocument.createElement('div');body.dataset.n88EntryBody='';root.replaceChildren(body);return body;
}
function classEntryState(root,state){
 if(!Object.hasOwn(classEntryMessages,state))state='context';
 const body=entryShell(root);body.replaceChildren();root.dataset.n88EntryState=state;root.setAttribute('aria-busy',String(state==='loading'));
 const message=root.ownerDocument.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.textContent=classEntryMessages[state];body.append(message);
 if(!['loading','disabled'].includes(state)){const button=root.ownerDocument.createElement('button');button.type='button';button.className='btn';button.dataset.n88Retry='';button.textContent='إعادة المحاولة';body.append(button);}
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
