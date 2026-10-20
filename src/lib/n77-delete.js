import { STORES } from './db.js';

export const DELETE_RETRY_MESSAGE = 'يتطلب حذف الفصل اتصالًا بالإنترنت. تحقّق من الاتصال ثم أعد المحاولة؛ لم تتغير بياناتك.';
export const DELETE_SERVER_UNAVAILABLE_MESSAGE = 'التحقق من الحذف على الخادم غير متاح مؤقتًا. لم تتغير بياناتك؛ أعد المحاولة لاحقًا.';
export const DELETE_AMBIGUOUS_MESSAGE = 'تعذّر تأكيد نتيجة الحذف. اتصل بالإنترنت وأعد المحاولة؛ سيتحقق ركيز من العملية ويكملها بأمان.';
export const DELETE_STALE_MESSAGE = 'تغيّرت بيانات الفصل. حدّث الصفحة ثم راجع نطاق الحذف وأعد المحاولة؛ لم تتغير بياناتك على هذا الجهاز.';

const localStores = new Set(['assignments', 'submissions']);
const productStores = STORES.filter((name) => !['device', 'meta', 'outbox', 'profile', 'closedTermReports'].includes(name));

export function validateDeletePlan(plan, { teachingId, sectionId, ownerId }) {
  if (!plan || plan.ownerId !== ownerId || plan.selectedTeachingId !== teachingId || plan.sectionId !== sectionId ||
      !['teaching', 'section'].includes(plan.scope) || typeof plan.fingerprint !== 'string' || !plan.fingerprint ||
      !Array.isArray(plan.teachingIds) || !plan.teachingIds.includes(teachingId) ||
      new Set(plan.teachingIds).size !== plan.teachingIds.length ||
      (plan.scope === 'teaching' && (plan.teachingIds.length !== 1 || plan.teachingIds[0] !== teachingId)) ||
      (plan.scope === 'section' && plan.teachingIds.length !== 1)) {
    throw new Error(DELETE_STALE_MESSAGE);
  }
  return plan;
}

/** Plan from the transaction's current rows. Stored snapshots are deliberately excluded. */
export function localDeleteWrites(current, receipt, stamp) {
  const teachingIds = new Set(receipt.cascadeTeachingIds ?? receipt.teachingIds);
  const sectionId = receipt.sectionId;
  const scoped = receipt.scope === 'section';
  const rows = (name) => current[name] ?? [];
  const itemIds = new Set(rows('items').filter((row) => teachingIds.has(row.teachingId)).map((row) => row.id));
  const subitemIds = new Set(rows('scoreSubitems').filter((row) => itemIds.has(row.itemId)).map((row) => row.id));
  const sessionIds = new Set(rows('sessions').filter((row) => teachingIds.has(row.teachingId)).map((row) => row.id));
  const assignmentIds = new Set(rows('assignments').filter((row) => teachingIds.has(row.teachingId)).map((row) => row.id));
  const orphanIds = new Set(scoped ? receipt.orphanStudentIds ?? [] : []);
  const belongs = {
    sections: (r) => scoped && r.id === sectionId,
    teachings: (r) => teachingIds.has(r.id),
    enrollments: (r) => scoped && r.sectionId === sectionId,
    students: (r) => orphanIds.has(r.id),
    items: (r) => teachingIds.has(r.teachingId),
    scoreSubitems: (r) => itemIds.has(r.itemId),
    scoreSubitemCompletions: (r) => subitemIds.has(r.subitemId) || orphanIds.has(r.studentId),
    scores: (r) => itemIds.has(r.itemId) || orphanIds.has(r.studentId),
    slots: (r) => teachingIds.has(r.teachingId),
    sessions: (r) => teachingIds.has(r.teachingId),
    sessionRosterSnapshots: (r) => teachingIds.has(r.teachingId) || sessionIds.has(r.sessionId) || (scoped && r.sectionId === sectionId),
    attendance: (r) => teachingIds.has(r.teachingId) || sessionIds.has(r.sessionId) || orphanIds.has(r.studentId),
    logs: (r) => teachingIds.has(r.teachingId) || sessionIds.has(r.sessionId) || orphanIds.has(r.studentId),
    notes: (r) => teachingIds.has(r.teachingId) || sessionIds.has(r.sessionId) || orphanIds.has(r.studentId),
    classRules: (r) => teachingIds.has(r.teachingId),
    classGoals: (r) => teachingIds.has(r.teachingId) || sessionIds.has(r.sessionId),
    classCharterSelections: (r) => teachingIds.has(r.teachingId),
    groupArrangements: (r) => teachingIds.has(r.teachingId),
    assignments: (r) => teachingIds.has(r.teachingId),
    submissions: (r) => assignmentIds.has(r.assignmentId) || orphanIds.has(r.studentId),
  };
  const writes = {};
  const deleted = new Map();
  for (const name of productStores) {
    const predicate = belongs[name];
    if (!predicate) continue;
    const hit = rows(name).filter((row) => !row.deleted && predicate(row));
    if (!hit.length) continue;
    deleted.set(name, new Set(hit.map((row) => row.id)));
    writes[name] = { put: hit.map((row) => ({ ...row, deleted: true, updatedAt: stamp, syncCreatePending: false })), remove: [] };
  }
  const pending = rows('outbox').filter((row) => deleted.get(row.store)?.has(row.recordId) ||
    (String(row.command ?? '').startsWith('lifecycle:') && receipt.teachingIds.includes(row.patch?.targetId)));
  writes.outbox = { put: [], remove: pending.map((row) => row.id) };
  const device = rows('device').find((row) => row.id === 'device');
  if (!device || device.studentLifecycleResume || device.n77DeleteIntent?.mutationId !== receipt.mutationId) throw new Error(DELETE_STALE_MESSAGE);
  writes.device = { put: [{ ...device, n77DeleteIntent: null,
    n77DeleteReceipt: { mutationId: receipt.mutationId, ownerId: receipt.ownerId, sectionId,
      selectedTeachingId: receipt.selectedTeachingId, scope: receipt.scope, fingerprint: receipt.fingerprint,
      committedAt: stamp }, updatedAt: stamp }], remove: [] };
  return writes;
}

// AI: separate protocol. Never relax the existing N77 teaching validator.
export function validateSubjectlessPlan(plan, {ownerId,sectionId,yearId,termId}, receipt=false) {
 const fields=['protocol','ownerId','sectionId','yearId','termId','scope','selectedTeachingId','teachingIds','cascadeTeachingIds','enrollmentIds','fingerprint',...(receipt?['mutationId','outcome','orphanStudentIds']:[])];
 const ids=a=>Array.isArray(a)&&a.length<=10000&&a.every(id=>typeof id==='string'&&id.length>0&&id.length<=240)&&new Set(a).size===a.length;
 if(!plan||Object.getPrototypeOf(plan)!==Object.prototype||Object.keys(plan).sort().join()!==fields.sort().join()||
 plan.protocol!=='N36_SECTION_DELETE_V1'||plan.ownerId!==ownerId||plan.sectionId!==sectionId||plan.yearId!==yearId||plan.termId!==termId||plan.scope!=='section'||
 plan.selectedTeachingId!==null||!Array.isArray(plan.teachingIds)||plan.teachingIds.length||!ids(plan.cascadeTeachingIds)||!ids(plan.enrollmentIds)||
 !/^[a-f0-9]{32}$/.test(plan.fingerprint)||receipt&&(!plan.mutationId||plan.outcome!=='deleted'||!Array.isArray(plan.orphanStudentIds)||plan.orphanStudentIds.length))throw Error(DELETE_STALE_MESSAGE);
 return plan;
}
export function subjectlessDeleteWrites(current,receipt,stamp) {
 const device=current.device.find(d=>d.id==='device'),intent=device?.n77DeleteIntent;
 if(intent?.kind!=='subjectless-section'||intent.sectionId!==receipt.sectionId||intent.ownerId!==receipt.ownerId||
 intent.mutationId!==receipt.mutationId||intent.plan.fingerprint!==receipt.fingerprint||device.studentLifecycleResume||device.cloudRestoreResume)throw Error(DELETE_STALE_MESSAGE);
 validateSubjectlessPlan(receipt,intent.plan,true);
 if(current.sections.some(s=>s.id===receipt.sectionId&&s.ownerId&&s.ownerId!==receipt.ownerId)||
 current.teachings.some(t=>t.sectionId===receipt.sectionId&&!t.deleted)||
 receipt.cascadeTeachingIds.some(id=>current.teachings.some(t=>t.id===id&&t.sectionId!==receipt.sectionId))||
 current.enrollments.some(e=>!e.deleted&&e.sectionId===receipt.sectionId&&!receipt.enrollmentIds.includes(e.id)))throw Error(DELETE_STALE_MESSAGE);
 if(device.activeYearId!==receipt.yearId||device.activeTermId!==receipt.termId||
 !current.years.some(y=>y.id===receipt.yearId&&!y.deleted&&y.status==='active')||
 !current.terms.some(t=>t.id===receipt.termId&&!t.deleted&&t.status==='active'&&t.yearId===receipt.yearId))throw Error(DELETE_STALE_MESSAGE);
 const writes=localDeleteWrites(current,receipt,stamp);
 for(const [name,op]of Object.entries(writes))if(!['device','outbox'].includes(name)&&op.put?.some(r=>r.ownerId!=null&&r.ownerId!==receipt.ownerId))throw Error(DELETE_STALE_MESSAGE);
 writes.device.put[0].n77DeleteReceipt={...writes.device.put[0].n77DeleteReceipt,kind:'subjectless-section',yearId:receipt.yearId,termId:receipt.termId};
 return writes;
}
