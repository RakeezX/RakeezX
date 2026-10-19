/** AI: staged browser composition. No config from URLs/storage/globals; no fallback. */
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { createClassPortalClient } from './student-portal-class-client.js';
import { mountClassPortal } from '../views/student-portal-class.js';

// Change only through a separately authorized, service-evidenced activation diff.
export const PORTAL_READINESS = Object.freeze({ enabled: true, serviceRevision: 'n88-integrated-class-v1', mode: 'public' });
const ready = r => r?.enabled === true && ['pilot','public'].includes(r.mode) && r.serviceRevision === 'n88-integrated-class-v1';

/** Current account/store/lease fence. JWT session ID is only an echo fence;
 * the server independently verifies the bearer and exact current Auth session. */
export function classBinding({cloud,store,teachingId,guard=runtimeSyncOwnershipGuard},write=false) {
  const w=store.getActiveWorkspace(),ownerId=cloud.user?.id,session=cloud.session;
  const teaching=store.getTeaching(teachingId),term=store.activeTerm();
  if(!ownerId || !session?.access_token || cloud.authStatus().state!=='authenticated' || w?.type!=='account'||w.authUserId!==ownerId ||
    !teaching || teaching.termId!==term?.id || store.isTeachingArchived(teaching))throw Error('unavailable');
  store.assertClassOperationsAccess(teachingId);
  const command=write?guard.bindNewCommand({ownerId}):null;
  const access=guard.cloudAccess({operation:write?'dispatch':'read',authenticatedUserId:ownerId,command});
  if(!access.allowed || access.workspaceOwnerId!==ownerId)throw Error('unavailable');
  store.assertLeaseWritable();
  const payload=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  const validUntil=Number(payload.exp)*1000;
  if(typeof payload.session_id!=='string'||!Number.isFinite(validUntil)||validUntil<=Date.now())throw Error('unavailable');
  const context={enabled:true,ownerId,sessionId:payload.session_id,leaseId:w.id,
    teachingId,classId:teaching.sectionId,termId:term.id,contextRevision:JSON.stringify([teaching.revision??1,term.revision??1]),validUntil};
  return {token:session.access_token,context,key:JSON.stringify([w.id,w.databaseName,w.leaseGeneration,session.access_token,context])};
}
export function mountClassService(root,{readiness=PORTAL_READINESS,fetch:send=globalThis.fetch,getBinding,subscribe=()=>()=>{},classLabel}={}) {
  let active, key, disposed=false;
  // The lane survives a binding renewal. Retired reads must finish before the
  // replacement entry acquires the same authoritative server transaction lock.
  let requestTail=Promise.resolve();
  const enqueue=operation=>{const pending=requestTail.then(operation);requestTail=pending.then(()=>{},()=>{});return pending;};
  const reconcile=()=>{if(disposed)return;let next;try{next=getBinding(false).key;}catch{next=null;}
    if(active&&next===key)return;active?.dispose();key=next;
    active=mountBoundClassService(root,{readiness,fetch:send,getBinding,subscribe,classLabel,enqueue});
  };
  // Visibility/focus can reveal a renewed session or lease before a store event.
  // Re-admit through the original real guard, never reuse the old bound context.
  const doc=root.ownerDocument,win=doc.defaultView;
  const wake=()=>{if(doc.visibilityState==='visible')reconcile();};
  win.addEventListener('focus',wake);win.addEventListener('pageshow',wake);doc.addEventListener('visibilitychange',wake);
  reconcile();const unsubscribe=subscribe(reconcile);
  return {dispose(){disposed=true;unsubscribe?.();win.removeEventListener('focus',wake);win.removeEventListener('pageshow',wake);doc.removeEventListener('visibilitychange',wake);active?.dispose();root.replaceChildren();}};
}
function mountBoundClassService(root,{readiness,fetch:send,getBinding,subscribe,classLabel,enqueue}) {
  if(!ready(readiness)){unavailable(root);return {dispose(){root.replaceChildren();}};}
  let initial;try{initial=getBinding(false);}catch{unavailable(root);return {dispose(){root.replaceChildren();}};}
  let disposed=false,handle=null,admitted=false;
  const current=write=>{const b=getBinding(write);if(disposed||b.key!==initial.key)throw Error('unavailable');return b;};
  const getContext=()=>{try{return current(false).context;}catch{return null;}};
  const client=createClassPortalClient({getContext,request:(path,init)=>{
    // List/guidance share the same authoritative short DB lock. Serialize this
    // owner's browser requests before dispatch, retaining all binding/lease checks.
    return enqueue(async()=>{
    const b=current(true);
    // Version only the list response contract; this marker grants no admission.
    // Older published pilot clients keep working during the public source rollout.
    const body=path.endsWith('/list')&&readiness.mode==='public'?JSON.stringify({...JSON.parse(init.body),uiProtocol:'n88-public-ui-v1'}):init.body;
    const response=await send(path,{...init,body,headers:{...init.headers,Authorization:'Bearer '+b.token}});
    current(false);return {ok:response.ok,async json(){const data=await response.json();current(false);
      // Server admission follows verified Auth/session/current source ownership.
      // Strip its rollout metadata before the existing exact ACK validator.
      if(path.endsWith('/list')){
        if(data.rollout!==readiness.mode)throw Error('unavailable');
        admitted=true;
      }
      const {rollout,...ack}=data;return ack;}};
    });
  }});
  unavailable(root);
  // No controls/private roster until the normal authenticated service admits this owner.
  void client.listClass(initial.context.teachingId).then(()=>{
    current(false);if(!admitted)throw Error('unavailable');
    const content=root.ownerDocument.createElement('div');root.replaceChildren(content);
    if(readiness.mode==='pilot'){
      const note=root.ownerDocument.createElement('p');note.setAttribute('role','status');
      note.textContent='تجربة محدودة · مساحة طلاب الفصل';root.prepend(note);
    }
    handle=mountClassPortal(content,{client,getContext,subscribe,classLabel});
  }).catch(()=>{if(!disposed)unavailable(root);});
  return {dispose(){disposed=true;handle?.dispose();root.replaceChildren();}};
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
