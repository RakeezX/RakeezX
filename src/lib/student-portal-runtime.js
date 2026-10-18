/** AI: staged browser composition. No config from URLs/storage/globals; no fallback. */
import { createStudentPortalClient } from './student-portal-client.js';
import { mountStudentPortal } from '../views/student-portal.js';
import { mountTeacherInvitations } from '../views/student-portal-teacher.js';
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { createClassPortalClient } from './student-portal-class-client.js';
import { mountClassPortal } from '../views/student-portal-class.js';

// Change only through a separately authorized, service-evidenced activation diff.
export const PORTAL_READINESS = Object.freeze({ enabled: false, serviceRevision: null });
const ready = r => r?.enabled === true && r.serviceRevision === 'n88-integrated-class-v1';

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
  if(!ready(readiness)){unavailable(root);return {dispose(){root.replaceChildren();}};}
  let initial;try{initial=getBinding(false);}catch{unavailable(root);return {dispose(){root.replaceChildren();}};}
  let disposed=false;
  const current=write=>{const b=getBinding(write);if(disposed||b.key!==initial.key)throw Error('unavailable');return b;};
  const getContext=()=>{try{return current(false).context;}catch{return null;}};
  const client=createClassPortalClient({getContext,request:async(path,init)=>{
    const b=current(true);
    const response=await send(path,{...init,headers:{...init.headers,Authorization:'Bearer '+b.token}});
    current(false);return {ok:response.ok,async json(){const data=await response.json();current(false);return data;}};
  }});
  const handle=mountClassPortal(root,{client,getContext,subscribe,classLabel});
  return {dispose(){disposed=true;handle.dispose();}};
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

export function mountStudentService(root, { readiness = PORTAL_READINESS, fetch: send = globalThis.fetch, location = window.location, history = window.history } = {}) {
  style(root);
  const match = /^\/s\/([A-Za-z0-9_-]{43})$/.exec(location.pathname);
  if (!ready(readiness) || !match || location.search || location.hash) { unavailable(root); return { dispose() { root.replaceChildren(); } }; }
  const client = createStudentPortalClient({ fetch: send, base: '/api/n88/s/' + match[1] });
  return mountStudentPortal(root, { client, location, history });
}

export function mountTeacherService(root, { readiness = PORTAL_READINESS, fetch: send = globalThis.fetch, getBinding, subscribe = () => () => {} } = {}) {
  style(root);
  let disposed = false, ui, stop = () => {};
  const dispose = () => { disposed = true; stop(); ui?.dispose(); root.replaceChildren(); };
  if (!ready(readiness)) { unavailable(root); return { dispose }; }
  let initial;
  try { initial = getBinding(false); } catch { unavailable(root); return { dispose }; }
  const assertCurrent = write => {
    const current = getBinding(write);
    if (disposed || current.key !== initial.key) throw Error('unavailable');
    return current;
  };
  const transport = async (path, init) => {
    assertCurrent(false);
    const response = await send(path, init);
    assertCurrent(false);
    // Body parsing may also complete after an owner/context change.
    return { ok: response.ok, async json() { const data = await response.json(); assertCurrent(false); return data; } };
  };
  const raw = createStudentPortalClient({ fetch: transport, authorize: write => assertCurrent(write).token });
  const scoped = Object.fromEntries(['issue', 'revoke', 'publish'].map(action => [action, (member, ...args) => {
    if (member.enrollmentId !== initial.enrollmentId) throw Error('unavailable');
    return raw[action](member, ...args);
  }]));
  scoped.students = async () => { const result = await raw.students(); return { ...result, students: result.students.filter(m => m.enrollmentId === initial.enrollmentId) }; };
  stop = subscribe(() => { try { assertCurrent(false); } catch { dispose(); unavailable(root); } });
  const pending = mountTeacherInvitations(root, { client: scoped });
  return { ready: pending.then(value => { ui = value; if (disposed) { ui.dispose(); unavailable(root); } }), dispose };
}
