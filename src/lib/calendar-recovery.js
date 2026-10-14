// AI: reviewed empty-account academic recovery, never session recovery.
import * as db from './db.js';
import * as cloud from './cloud.js';
import { runtimeSyncOwnershipGuard, assertNewProductWrite } from './sync-ownership.js';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch, decodeSyncV2Canonical } from './sync-v2.js';
import { CALENDAR_PRESETS, getCalendarPreset, calendarPresetRecords } from './calendar-presets.js';
import { resolveCalendarRuntime, resolveCalendarDate } from './calendar-runtime.js';
import { validRestoreReceipt } from './workspaces.js';
export const FOUNDATION_REPAIR = 'N58_EMPTY_V1';
export const schoolStores = ['sections','teachings','students','enrollments','sessions','slots','items','scores','attendance','logs','notes','sessionRosterSnapshots','closedTermReports','classRules','classGoals','classCharterSelections','groupArrangements','assignments','submissions','scoreSubitems','scoreSubitemCompletions'];
const stores = [...schoolStores,'years','terms','calendars','calendarDays','outbox'];
export const foundationSnapshot = value => JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const equal = (a,b) => foundationSnapshot(a) === foundationSnapshot(b);
const subset = (row, expected) => Object.keys(row??{}).length>0 && Object.entries(row).every(([k,v])=>equal(v,expected[k]));
const snapshot = async () => Object.fromEntries(await Promise.all(stores.map(async n=>[n,await db.getAll(n)])));
function context() {
 const workspace=runtimeSyncOwnershipGuard.getWorkspace(),ownerId=cloud.user?.id;
 const access=runtimeSyncOwnershipGuard.cloudAccess({operation:'read',authenticatedUserId:ownerId});
 if(!access.allowed||workspace.type!=='account'||workspace.authUserId!==ownerId)throw Error('تعذّر توثيق مالك الحساب.');
 return {workspace,ownerId,database:db.getActiveDatabaseName()};
}
function assertContext(c) { const fresh=context();if(fresh.workspace!==c.workspace||fresh.ownerId!==c.ownerId||fresh.database!==c.database)throw Error('تغيّر الحساب أثناء المراجعة.'); }
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(foundationSnapshot(value))))).map(n=>n.toString(16).padStart(2,'0')).join('');

export function localFoundationReview(current,ownerId) {
 const stop=reason=>({status:'blocked',reason,ownerId,hasGroup:current.outbox.some(r=>r.ownerId===ownerId&&r.store==='years'&&r.lastError?.message==='N58_EXISTING_TERMS_REQUIRED'&&r.lastError?.code==='22023')});
 if(schoolStores.some(n=>current[n]?.length))return stop('الحساب يحتوي بيانات مدرسية أو سجلًا سابقًا؛ هذا الإصلاح مخصص لحساب فارغ فقط.');
 const roots=current.outbox.filter(r=>r.protocol==='v2'&&r.store==='years'&&r.entity==='years'&&r.op==='create'&&r.state==='rejected'&&r.ownerId===ownerId&&r.baseRevision===0&&r.lastError?.code==='22023'&&r.lastError?.message==='N58_EXISTING_TERMS_REQUIRED');
 if(roots.length!==1)return stop('لا يوجد رفض تهيئة تقويم موثّق ومؤهل لهذا الإصلاح.');
 const root=roots[0],year=current.years[0],preset=getCalendarPreset(year?.calendarPresetId);
 if(current.years.length!==1||year?.id!=='y:1448-1449'||year.deleted||root.recordId!==year.id||root.serverRecordId!==year.id||!preset)return stop('تعذّر توثيق هوية السنة أو اختيار المنطقة.');
 const catalogs=CALENDAR_PRESETS.map(p=>calendarPresetRecords(p)),desired=calendarPresetRecords(preset);
 const known=(store,id)=>catalogs.flatMap(c=>store==='years'?[c.year]:store==='terms'?c.terms:store==='calendars'?[c.calendar]:c.calendarDays).filter(r=>r.id===id);
 const payload=(store,row)=>({ ...encodeSyncV2Patch(store,row), ...(store==='calendars'&&row.presetId?{preset_id:row.presetId}:{}) });
 if(!known('years',root.recordId).some(r=>equal(root.patch,payload('years',r))))return stop('طلب السنة الأصلي ليس تهيئة الإصدار المعروفة.');
 if(current.terms.length!==2||desired.terms.some(t=>!current.terms.some(r=>r.id===t.id&&!r.deleted&&equal(payload('terms',r),payload('terms',t)))))return stop('الفصول ناقصة أو معدلة؛ لا يمكن اختراع سجلات أو تواريخ.');
 for(const name of ['years','calendars','calendarDays'])for(const row of current[name]) {
  if(!known(name,row.id).some(r=>equal(payload(name,row),payload(name,r))))return stop('توجد بيانات تقويم مخصصة أو غير معروفة.');
 }
 const originals=current.outbox.filter(r=>r.protocol==='v2'&&['years','terms','calendars','calendarDays'].includes(r.store)&&r.state!=='superseded');
 for(const row of originals) {
  if(row.ownerId!==ownerId||row.entity!==SYNC_V2_SCHEMAS[row.store].entity||row.serverRecordId!==row.recordId||!['create','patch','delete'].includes(row.op))return stop('عملية تقويم غير متطابقة أو ذات ملكية مختلفة.');
  const candidates=known(row.store,row.recordId);
  const matches=row.op==='delete'?['calendars','calendarDays'].includes(row.store)&&candidates.length&&Object.keys(row.patch??{}).every(k=>k==='deleted_at'):
   candidates.some(r=>subset(row.patch,payload(row.store,r)));
  if(!matches||row.dependencies?.some(d=>!['years','terms','calendars'].includes(d.store)||!known(d.store,d.recordId).length))return stop('توجد عملية أو علاقة خارج مجموعة التهيئة المعروفة.');
 }
 for(const t of desired.terms)if(!originals.some(r=>r.store==='terms'&&r.recordId===t.id&&r.op==='create'&&r.dependencies?.some(d=>d.store==='years'&&d.recordId===year.id)))return stop('لم تتأكد علاقة الفصول بمجموعة الرفض الأصلية.');
 // Reject non-academic commands that refer to this group, including retired session history.
 if(current.outbox.some(r=>r.protocol==='v2'&&r.state!=='superseded'&&!originals.includes(r)&&r.dependencies?.some(d=>['years','terms','calendars','calendarDays'].includes(d.store))))return stop('توجد عملية أخرى مرتبطة بالسنة؛ تحتاج مراجعة مستقلة.');
 const review={ownerId,presetId:preset.id,rootMutationId:root.mutationId,originals,academic:Object.fromEntries(['years','terms','calendars','calendarDays'].map(n=>[n,current[n]]))};
 return {status:'review',ownerId,presetId:preset.id,yearLabel:year.label,regionLabel:preset.regionLabel,review,fingerprint:foundationSnapshot(review)};
}

export async function reviewFoundationRepair() {
 const c=context(),receipt=await db.readInitialRestoreReceipt();assertContext(c);
 if(!validRestoreReceipt(receipt,c.ownerId))throw Error('لم تتأكد الاستعادة الأولية للحساب.');
 const current=await snapshot();assertContext(c);
 const audit=current.outbox.find(r=>r.protocol===FOUNDATION_REPAIR&&r.ownerId===c.ownerId&&r.state!=='verified');
 if(audit)return {status:'pending',ownerId:c.ownerId,repairId:audit.repairId,reason:'طلب الإصلاح محفوظ؛ استعد إيصال الطلب نفسه لإكمال التحقق.'};
 const local=localFoundationReview(current,c.ownerId);if(local.status!=='review')return local;
 const remote=await Promise.all(schoolStores.map(n=>cloud.fetchRecords(SYNC_V2_SCHEMAS[n].entity)));assertContext(c);
 if(remote.some(rows=>!Array.isArray(rows)||rows.length))return {status:'blocked',ownerId:c.ownerId,reason:'توجد بيانات في الحساب السحابي؛ لن يُرسل إصلاح الحساب الفارغ.'};
 const request={ownerId:c.ownerId,version:FOUNDATION_REPAIR,presetId:local.presetId,rootMutationId:local.review.rootMutationId,originalDigest:await digest(local.review)};
 let plan;try { plan=await cloud.reviewEmptyFoundation(request); } catch(error) { assertContext(c);return {...local,status:'blocked',hasGroup:true,reason:error.message}; }assertContext(c);
 if(plan?.protocol!==FOUNDATION_REPAIR||plan.ownerId!==c.ownerId||!equal(plan.request,request))throw Error('لم يتطابق رد مراجعة التقويم.');
 const fresh=localFoundationReview(await snapshot(),c.ownerId);assertContext(c);
 if(fresh.fingerprint!==local.fingerprint)throw Error('تغيّرت بيانات المراجعة.');
 return {...local,plan};
}

export async function confirmFoundationRepair(review,acknowledged=false) {
 if(!acknowledged||review?.status!=='review')throw Error('يلزم الإقرار قبل تأكيد الإصلاح.');
 const c=context();assertNewProductWrite();if(review.ownerId!==c.ownerId)throw Error('تغيّر مالك الحساب.');
 const id='calendar-repair:'+review.review.rootMutationId;
 await db.applyBatch(Object.fromEntries(stores.map(n=>[n,{}])),{prepare(current){
  assertContext(c);const prior=current.outbox.find(r=>r.id===id);
  if(prior){if(prior.ownerId!==c.ownerId||prior.fingerprint!==review.fingerprint||!equal(prior.plan,review.plan))throw Error('تغيّر طلب الإصلاح المحفوظ.');return {outbox:{put:[],remove:[]}};}
  const fresh=localFoundationReview(current,c.ownerId);if(fresh.fingerprint!==review.fingerprint)throw Error('تغيّرت خطة الإصلاح؛ راجعها من جديد.');
  return {outbox:{put:[{id,protocol:FOUNDATION_REPAIR,ownerId:c.ownerId,repairId:crypto.randomUUID(),state:'pending',review:review.review,fingerprint:review.fingerprint,plan:review.plan,createdAt:Date.now()}],remove:[]}};
 }});
 return resumeFoundationRepair();
}

export async function resumeFoundationRepair() {
 const c=context();assertNewProductWrite();
 let audit=(await db.getAll('outbox')).find(r=>r.protocol===FOUNDATION_REPAIR&&r.ownerId===c.ownerId&&r.state!=='verified');assertContext(c);
 if(!audit)throw Error('لا يوجد طلب إصلاح محفوظ.');
 if(!audit.sent) {
  await db.applyBatch(Object.fromEntries(stores.map(n=>[n,{}])),{prepare(current){
   assertContext(c);const saved=current.outbox.find(r=>r.id===audit.id);
   if(!equal(saved,audit))throw Error('تغيّر الطلب المحفوظ.');
   const fresh=localFoundationReview(current,c.ownerId);if(fresh.fingerprint!==audit.fingerprint)throw Error('تغيّرت بيانات الحساب قبل الإرسال.');
   return {outbox:{put:[{...audit,sent:true}],remove:[]}};
  }});
  audit=(await db.getAll('outbox')).find(r=>r.id===audit.id);assertContext(c);
 }
 const response=await cloud.applyEmptyFoundation(audit.repairId,audit.plan);assertContext(c);
 if(response?.protocol!==FOUNDATION_REPAIR||response.ownerId!==c.ownerId||response.repairId!==audit.repairId)throw Error('إيصال الإصلاح غير متطابق.');
 const canonical=response.canonical,desired=calendarPresetRecords(getCalendarPreset(audit.review.presetId));
 const year=decodeSyncV2Canonical('years',canonical?.years?.[0]),terms=canonical?.terms?.map(r=>decodeSyncV2Canonical('terms',r));
 if(canonical?.years?.length!==1||terms?.length!==2||year?.id!==desired.year.id||year.deleted||year.calendarPresetId!==audit.review.presetId||!(year.fieldRevisions?.calendar_selection>0)||canonical.years.some(r=>r.owner_id!==c.ownerId)||canonical.terms.some(r=>r.owner_id!==c.ownerId)||terms.some(r=>r.deleted))throw Error('لم يتأكد الإصلاح الأكاديمي.');
 for(const term of desired.terms) {
  const expected=encodeSyncV2Patch('terms',{...term,calendarId:null}),actual=terms.find(r=>r.id===term.id);
  if(!actual||!equal(encodeSyncV2Patch('terms',actual),expected))throw Error('لم تتطابق هويات وتواريخ الفصول مع الخطة.');
 }
 const readback={years:await cloud.fetchRecords('years'),terms:await cloud.fetchRecords('terms')};assertContext(c);
 if(!equal(readback.years,canonical.years)||!equal(readback.terms,canonical.terms))throw Error('تغيّر الإصلاح عند القراءة النهائية؛ بقي سجل المراجعة محفوظًا.');
 const projection=resolveCalendarRuntime({year,terms,presetId:year.calendarPresetId});if(!projection.ok)throw Error('تعذّر توثيق عرض التقويم بعد الإصلاح.');
 for(const day of audit.review.academic.calendarDays.filter(r=>!r.deleted&&desired.calendar.id===r.calendarId)) {
  const value=resolveCalendarDate(projection,day.date);if(!value.ok||value.kind!==day.kind||value.label!==day.label)throw Error('لم يتطابق عرض الأيام الرسمية.');
 }
 await db.applyBatch(Object.fromEntries(stores.map(n=>[n,{}])),{prepare(current){
  assertContext(c);const saved=current.outbox.find(r=>r.id===audit.id);if(!equal(saved,audit))throw Error('تغيّر سجل الإصلاح.');
  // A completed receipt may precede legitimate later school additions. Only
  // the reviewed academic source/group must remain exact for reconciliation.
  const fresh=localFoundationReview({...current,...Object.fromEntries(schoolStores.map(n=>[n,[]]))},c.ownerId);if(fresh.fingerprint!==audit.fingerprint)throw Error('تغيّر المصدر المحلي؛ الإيصال محفوظ على الخادم ولم تُخفَ الأخطاء.');
  return {years:{put:[{...current.years[0],...year,serverCanonical:year,syncCreatePending:false}],remove:[]},terms:{put:terms.map(r=>({...current.terms.find(t=>t.id===r.id),...r,serverCanonical:r,syncCreatePending:false})),remove:[]},
   outbox:{put:[...audit.review.originals.map(r=>({...r,state:'superseded',recoveryReason:FOUNDATION_REPAIR,repairId:audit.repairId,supersededAt:Date.now()})),{...audit,state:'verified',receipt:response,verifiedAt:Date.now()}],remove:[]}};
 }});
 return response;
}
