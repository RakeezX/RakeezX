import { compareAcademicClasses } from '../lib/class-order.js';
// AI: real local-file entry, shared class selector, no portal login or bulk save.
import { html, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { isDemo } from '../lib/demo.js';
import { classGroups, detectClassNameColumn } from '../lib/class-import-file.js';
import { GRADES, gradeLabel, sectionLabel, defaultItemsFor } from '../models.js';
import { classKoshoofBundle, downloadKoshoofBundle } from '../lib/class-koshoof-bundle.js';
import { repaint } from '../repaint.js';
import { CUSTOM_SUBJECT_NAME_MAX } from '../lib/subject-catalog.js';

import { canOpenRoster, classAccessFeedback } from './students.js';
import * as cloud from '../lib/cloud.js';
import { runtimeSyncOwnershipGuard } from '../lib/sync-ownership.js';
import { go } from '../router.js';
import { readGradeFile } from '../lib/grade-transfer-parsers.js';
import { isTransferItem, suggestGradeMappings, gradeNameKey, rosterChoiceBinding, reviewGradeTransfer } from '../lib/grade-transfer.js';
import { exportGradeCsv, downloadGradeCsv, exportNamesTemplate, suggestNoorGroup } from '../lib/grade-transfer-export.js';
import { handoffRequest, claimHandoff, reportHandoffOutcome } from '../lib/n36-extension-handoff.js';



let transferBinding = null;
let transferRoute = null;
let transfer = { importMode: 'names', panel: null, rows: null, mappings: [], nameColumn: -1, idColumn: -1, review: null, recovery: [], message: '', busy: false };

// AI-authored N107: the parsed file belongs to the hub, not its destination.
const emptyTransfer = () => ({ importMode:'names', panel:'import', rows:null, mappings:[], nameColumn:-1, idColumn:-1, review:null, recovery:[], message:'', busy:false });
function assertFileCurrent() {
  const previous = transfer;
  bind();
  if (previous !== transfer || fileSession !== cloud.session || allowed()) throw Error('تغيّر الحساب أو الفصل الدراسي أو صلاحية العمل. اختر الملف وراجعه من جديد.');
}
async function rosterRecovery(id = hub.existing) {
  return (await store.gradeImportRecovery()).filter(row => row.recordId === id);
}
// AI-authored N107: preview the same definition resolver used by createTeaching.
// Prospective revisions exist only in review data; never write or dispatch them.
const prospectiveItems = defaultItemsFor('prospective').map((item,i)=>({...item,id:`prospective-default-${i}`,serverRevision:1}));
const destinationItems = () => hub.kind === 'existing' && hub.existing ? store.teachingContext(hub.existing).items : prospectiveItems;
function resetDestination() {
  draft = {};
  if (!transfer.rows) return;
  const items = destinationItems();
  Object.assign(transfer, suggestGradeMappings(transfer.rows[0], items, {teachingId:hub.kind === 'existing' ? hub.existing : 'prospective',ownerId:workspace?.authUserId}),
    { review:null, newStudentIds:{}, studentChoices:{}, message:'', recovery:[], created:null });
  transfer.mappings = transfer.mappings.map(m => m.kind === 'new' ? {...m,id:crypto.randomUUID()} : m);
  const current = transfer, destination = hub.existing, kind = hub.kind;
  rosterRecovery(destination).then(rows => { if(transfer === current && hub.existing === destination && hub.kind === kind) { current.recovery = rows; repaint(); } });
}
function reviewNewRoster() {
  const groups = classGroups(transfer.rows, {header:0,mapping:{grade:-1,label:-1,subject:-1,name:transfer.nameColumn},manual:draft.manual ?? {},schoolName:store.state.profile?.schoolName});
  if (groups.length !== 1) throw Error('اختر بيانات فصل واحد وعمود الأسماء.');
  const review = store.reviewClassImport(groups[0]);
  let proposal = null;
  if (transfer.importMode === 'grades') {
    // Semantic proposal only. Receipt identities are bound after normal Sync; never dispatch prospective IDs.
    transfer.mappings=transfer.mappings.map(m=>m.kind==='new'?{...m,confirmed:true}:m);
    proposal = reviewGradeTransfer({...transfer,idColumn:-1,roster:[],items:prospectiveItems,scores:[],
      teaching:{id:'prospective',sectionId:'prospective',termId:review.termId,serverRevision:1},
      term:store.activeTerm(),ownerId:workspace.authUserId,databaseName:workspace.databaseName,allowNewStudents:true,
      newStudentIds:Object.fromEntries(transfer.rows.slice(1).map((_,i)=>[i+2,{id:`prospective-${i}`,enrollmentId:`prospective-enrollment-${i}`}]))});
    if (proposal.rejected.length) throw Error(proposal.rejected.map(r=>`صف ${r.row}: ${r.reason}`).join('؛ '));
  }
  transfer.page=0;draft.review = review; draft.proposal = proposal; draft.message = ''; transfer.message = '';
}
function rosterFilePane(list) {
  const immutable = locked() || !!draft.review || !!transfer.review || !!transfer.created || !!transfer.recovery.length;
  transfer.panel = 'import';
  return html`<section class="card card--pad" data-roster-file-flow><h3>استيراد كشف طلاب</h3>
    <label class="field"><span data-grade-file-name>${transfer.rows ? html`الملف المحدد: ${transfer.fileName}` : 'اختر الكشف من جهازك'}</span><input class="input" type="file" accept=".csv,.xlsx" style="${transfer.rows ? 'display:none' : ''}" data-change="grade-file" ${immutable ? 'disabled' : ''}></label>
    <p class="grade-transfer__hint">ملفات CSV أو Excel (XLSX).</p>
    ${!transfer.rows && extensionPreview ? html`<label class="field"><span>فصل موجود لاستقبال أسماء الإضافة فقط</span><select class="select" data-existing-class><option value="">اختر الفصل</option>${list.map(row=>html`<option value="${row.id}" ${hub.existing === row.id ? 'selected' : ''}>${shortTeachingLabel(row)}</option>`)}</select></label>` : ''}
    ${transfer.rows ? html`<details class="n107-destination" ${!transfer.review && !draft.review ? 'open' : ''}><summary>الوجهة ومحتوى الكشف</summary><label class="field"><span>وجهة الاستيراد</span><select class="select" data-import-kind ${immutable ? 'disabled' : ''}><option value="existing" ${hub.kind === 'existing' ? 'selected' : ''}>فصل موجود</option><option value="new" ${hub.kind === 'new' ? 'selected' : ''}>إنشاء فصل جديد</option></select></label>
    ${hub.kind === 'new' ? html`<div class="class-import-manual" data-roster-create>
      <label class="field"><span>الصف</span><select class="select" data-roster-field="grade" ${immutable ? 'disabled' : ''}><option value="">اختر الصف</option>${GRADES.map(g=>html`<option value="${g.v}" ${String(draft.manual?.grade) === String(g.v) ? 'selected' : ''}>${g.label}</option>`)}</select></label>
      <label class="field"><span>رمز الفصل</span><input class="input" maxlength="8" data-roster-field="label" value="${draft.manual?.label ?? ''}" ${immutable ? 'disabled' : ''}></label>
      <label class="field"><span>المادة</span><select class="select" data-roster-subject ${immutable ? 'disabled' : ''}><option value="">اختر المادة</option>${store.subjectOptions().map(o=>html`<option value="${o.name}" ${!draft.customSubject && draft.manual?.subject === o.name ? 'selected' : ''}>${o.name}</option>`)}<option value="custom" ${draft.customSubject ? 'selected' : ''}>أخرى</option></select></label>
      ${draft.customSubject ? html`<label class="field"><span>اسم المادة</span><input class="input" data-roster-field="subject" maxlength="${CUSTOM_SUBJECT_NAME_MAX}" value="${draft.manual?.subject ?? ''}" ${immutable ? 'disabled' : ''}></label>` : ''}
    </div>` : html`<label class="field"><span>الفصل والمادة</span><select class="select" data-existing-class aria-label="الفصل الموجود" ${immutable ? 'disabled' : ''}><option value="">اختر الفصل</option>${list.map(row=>html`<option value="${row.id}" ${hub.existing === row.id ? 'selected' : ''}>${shortTeachingLabel(row)}</option>`)}</select></label>`}
    <div class="segmented grade-transfer__modes" role="group" aria-label="محتوى الكشف">${['names','grades'].map(mode=>html`<button class="segmented__btn ${transfer.importMode === mode ? 'is-on' : ''}" data-act="grade-import-mode" data-mode="${mode}" aria-pressed="${transfer.importMode === mode}" ${immutable ? 'disabled' : ''}>${mode === 'names' ? 'أسماء فقط' : 'أسماء ودرجات'}</button>`)}</div></details>
    ${hub.kind === 'new' ? transferPanel(null) : existingPane()}
    <p role="status">${draft.message ?? ''}</p>` : html`${hub.existing ? existingPane() : html`<p role="status">${transfer.message}</p>`}`}
  </section>`;
}

let closeTeacherSetupImport = () => {};
let extensionPreview = null, extensionOwner = null, extensionBusy = false, extensionMessage = '', extensionTimer;
function extensionOwnerBinding() {
  store.assertClassImportAccess();
  const w = store.getActiveWorkspace(), access = runtimeSyncOwnershipGuard.cloudAccess({operation:'preview',authenticatedUserId:cloud.user?.id});
  if (!store.state.ready || w?.type !== 'account' || !cloud.session || cloud.session.user?.id !== cloud.user?.id ||
      cloud.authStatus().state !== 'authenticated' || !access.allowed || access.workspaceOwnerId !== w.authUserId) throw Error('OWNER');
  store.assertLeaseWritable();
  return JSON.stringify([w.authUserId,w.id,w.databaseName,w.leaseGeneration]);
}
// AI: explicit extension Start grants one document/session-bound names batch.
let automaticBatch=null, automaticWriting=false;
export function prepareExtensionBatch(){
 const binding=extensionOwnerBinding();
 if(automaticWriting||store.state.device?.n36NamesBatch?.pending)throw Error('BATCH_PENDING');
 const id=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 automaticBatch={id,binding,session:cloud.session,year:store.activeYear().id,term:store.activeTerm().id,yearState:JSON.stringify(store.activeYear()),termState:JSON.stringify(store.activeTerm()),expires:Date.now()+1800000};
 return id;
}
// Stable bridge survives the publisher's bundled asset names; no source-URL injection.
window.rakeezBeginNamesBatch=prepareExtensionBatch;
window.rakeezCancelNamesBatch=id=>{if(automaticBatch?.id===id)automaticBatch=null;};
function automaticGuard(batch){
 if(automaticBatch!==batch||Date.now()>=batch.expires||extensionOwnerBinding()!==batch.binding||cloud.session!==batch.session||
 store.activeYear().id!==batch.year||store.activeTerm().id!==batch.term||batch.route&&location.hash!==batch.route)throw Error('BATCH_OWNER_OR_SESSION_CHANGED');
}
function automaticPersistedGuard(batch,current){
 automaticGuard(batch);
 const device=current.device?.find(d=>d.id==='device');
 if(device&&(device.activeYearId!==batch.year||device.activeTermId!==batch.term))throw Error('BATCH_PERSISTED_TERM_CHANGED');
 if(current.years&&JSON.stringify(current.years.find(y=>y.id===batch.year))!==batch.yearState||
 current.terms&&JSON.stringify(current.terms.find(t=>t.id===batch.term))!==batch.termState)throw Error('BATCH_PERSISTED_CONTEXT_CHANGED');
}
async function batchCheckpoint(batch,change){
 automaticGuard(batch);
 const db=await import('../lib/db.js');
 const committed=await db.applyBatch({device:{}},{prepare(current){
  automaticPersistedGuard(batch,current);
  const device=current.device.find(d=>d.id==='device');if(!device)throw Error('BATCH_DEVICE');
  const prior=device.n36NamesBatch;
  if(prior?.pending&&prior.batchId!==batch.id)throw Error('BATCH_PENDING');
  if(prior&&prior.ownerId!==store.getActiveWorkspace().authUserId)throw Error('BATCH_OWNER');
  return {device:{put:[{...device,n36NamesBatch:change(prior?.batchId===batch.id?prior:{batchId:batch.id,ownerId:store.getActiveWorkspace().authUserId,receipts:{}})}]}};
 }});
 automaticGuard(batch);store.state.device={...store.state.device,n36NamesBatch:committed.device.put[0].n36NamesBatch};
}
function sourceSection(classroom){
 const saved=store.state.device?.n36NamesBatch?.classMappings?.[classroom];
 if(saved){const section=store.getSection(saved);if(!section||section.yearId!==store.activeYear().id||section.status==='archived')throw Error('CLASS_MAPPING_CHANGED');return {section};}

 const key=v=>String(v).normalize('NFC').replace(/[إأآٱ]/g,'ا').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\s+/g,' ').trim();
 const name=key(classroom).replace(/^الصف /,'');
 const exact=store.state.sections.filter(s=>!s.deleted&&s.yearId===store.activeYear().id&&key(s.name)===name);
 if(exact.length===1)return {section:exact[0]};if(exact.length>1)throw Error('CLASS_AMBIGUOUS');
 let grade,label;
 for(const g of GRADES){const prefix=key(g.label);if(name.startsWith(prefix+' ')||name.startsWith(prefix+'/')){grade=g.v;label=name.slice(prefix.length).replace(/^[ /(-]+|[ )]+$/g,'').trim();break;}}
 const numeric=name.match(/^(1[0-2]|[1-9])\s*[/(-]\s*([\p{L}\p{N} ._-]{1,8})\)?$/u);
 if(numeric){grade=Number(numeric[1]);label=numeric[2].trim();}
 if(!grade||!label||label.length>8||!/^[\p{L}\p{N} ._-]+$/u.test(label))throw Error('CLASS_MAPPING_REQUIRED');
 const matches=store.state.sections.filter(s=>s.yearId===store.activeYear().id&&Number(s.grade)===grade&&key(s.label)===key(label));
 if(matches.length>1||matches.some(s=>s.deleted||s.status==='archived'))throw Error('CLASS_ARCHIVED_OR_AMBIGUOUS');
 return {section:matches[0],grade,label};
}
async function saveAutomaticNames(result){
 const batch=automaticBatch;
 if(!batch||result.envelope.batchId!==batch.id)throw Error('BATCH_NOT_INITIATED');
 automaticGuard(batch);if(automaticWriting)throw Error('BATCH_BUSY');automaticWriting=true;batch.route=location.hash;
 const envelope=result.envelope,rows=envelope.rows;
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows))))].map(n=>n.toString(16).padStart(2,'0')).join('');
 try{
  const prior=store.state.device?.n36NamesBatch;
  if(prior?.batchId===batch.id&&prior.receipts?.[digest])return prior.receipts[digest];
  await batchCheckpoint(batch,p=>{
   return {...p,batchId:batch.id,pending:{...p.pending,[digest]:{rows,complete:envelope.complete}},yearId:batch.year,termId:batch.term};
  });
  const {previewStudentRows}=await import('../lib/student-import.js');
  let added=0,existing=0;
  for(const classroom of new Set(rows.map(r=>r.classroom))){
   automaticGuard(batch);
   const names=rows.filter(r=>r.classroom===classroom).map(r=>[r.name]);
   let {section,grade,label}=sourceSection(classroom);
   if(!section){
    section=await store.createSection({yearId:batch.year,grade,label,name:classroom},{verifyCurrent(current){
     automaticPersistedGuard(batch,current);
     if(current.sections.some(s=>s.yearId===batch.year&&Number(s.grade)===grade&&gradeNameKey(s.label)===gradeNameKey(label)))throw Error('CLASS_CHANGED');
    }});
    section=store.getSection(section.id);
   }
   if(section.deleted||section.status==='archived'||section.ownerId&&section.ownerId!==store.getActiveWorkspace().authUserId)throw Error('CLASS_OWNER_OR_ARCHIVED');
   const teachings=store.state.teachings.filter(t=>!t.deleted&&t.status!=='archived'&&t.sectionId===section.id&&t.termId===batch.term);
   const roster=store.sectionRoster(section.id),owner=store.getActiveWorkspace().authUserId;
   if(roster.some(r=>r.ownerId!=null&&r.ownerId!==owner)||store.state.enrollments.some(e=>!e.deleted&&e.sectionId===section.id&&e.ownerId!=null&&e.ownerId!==owner))throw Error('NAMES_OWNER');
   const preview=previewStudentRows(names,0,false,roster);
   if(preview.entries.length!==names.length||preview.counts.invalid||preview.counts.ambiguous)throw Error('NAMES_AMBIGUOUS');
   existing+=preview.counts.existing;
   if(teachings.length){
    const review=store.reviewNamesImport(teachings[0].id,{rows:names,nameColumn:0});
    store.assertClassOperationsAccess(teachings[0].id);
    if(preview.counts.new){const saved=await store.confirmNamesImport(review,true,{verifyCurrent:()=>automaticGuard(batch)});added+=saved.added;}
   }else if(preview.counts.new){
    // A names-only source supplies no subject. Keep a section roster without inventing one.
    const saved=await store.importStudents(section.id,preview.names,{verifyCurrent(current){
     automaticPersistedGuard(batch,current);
     const target=current.sections.find(s=>s.id===section.id);
     if(JSON.stringify(target)!==JSON.stringify(section))throw Error('CLASS_CHANGED');
     const ids=new Set(current.enrollments.filter(e=>!e.deleted&&e.status==='active'&&e.sectionId===section.id).map(e=>e.studentId));
     const roster=current.students.filter(s=>!s.deleted&&ids.has(s.id));
     if(roster.some(s=>s.ownerId!=null&&s.ownerId!==owner)||current.enrollments.some(e=>e.sectionId===section.id&&!e.deleted&&e.ownerId!=null&&e.ownerId!==owner))throw Error('NAMES_OWNER');
     if(JSON.stringify(previewStudentRows(names,0,false,roster).entries)!==JSON.stringify(preview.entries))throw Error('NAMES_CHANGED');
    }});added+=saved.added;
   }
   automaticGuard(batch);
   const after=previewStudentRows(names,0,false,store.sectionRoster(section.id));
   if(after.counts.existing!==names.length||after.counts.ambiguous)throw Error('NAMES_RECEIPT_UNKNOWN');
  }
  const outcome={status:added?'saved':'existing',added,existing,remaining:0,total:rows.length};
  await batchCheckpoint(batch,p=>{const pending={...p.pending};delete pending[digest];return {...p,pending:Object.keys(pending).length?pending:null,receipts:{...p.receipts,[digest]:outcome}};});
  extensionMessage=`حُفظت الدفعة محليًا: ${added} جديد، ${existing} موجود سابقًا. ${envelope.complete?'':'الكشف غير مكتمل؛ لم تُفترض أسماء الصفحات غير المحسومة.'} المزامنة لم تتأكد بعد.`;
  return outcome;
 }finally{automaticWriting=false;batch.route=null;}
}
function clearExtensionPreview() { extensionPreview = extensionOwner = null; clearTimeout(extensionTimer); }
store.onWorkspaceDeactivation(clearExtensionPreview);
cloud.subscribe(() => {
  if(!extensionOwner)return;
  try { if(extensionOwnerBinding() !== extensionOwner) clearExtensionPreview(); } catch { clearExtensionPreview(); }
});
function directExtensionEntry() {
  try { if(extensionOwner && extensionOwnerBinding() !== extensionOwner) clearExtensionPreview(); } catch { clearExtensionPreview(); }
  return html`<section class="card card--pad n36-direct" data-n36-direct><h3>استيراد الطلاب والفصول بشكل مباشر من مدرستي بإضافة مساعد ركيز المعلم</h3>
    <p>ثبّت الإضافة لمتصفح كروم، وسجّل دخولك إلى منصة مدرستي، ثم شغّل الإضافة لجلب أسماء الطلاب وبيانات فصولهم المتاحة. ابدأ مرة واحدة لجمع واستيراد أسماء جميع الفصول المتاحة إلى هذا الحساب المفتوح؛ تُعرض الحالات غير المحسومة فقط.</p>
    <a class="btn btn--primary" href="/assets/extensions/rakeez-teacher-import-helper-0.5.12.zip" download>تنزيل إضافة ركيز 0.5.12</a>
    <details><summary>طريقة التثبيت</summary><ol>
      <li>فك ضغط الحزمة في مجلد واحد مخصص للإضافة.</li>
      <li>من صفحة إضافات Chrome، فعّل وضع المطوّر واختر «تحميل إضافة غير مضغوطة»، ثم اختر المجلد.</li>
      <li>عند تحديث ملفات الإضافة في المجلد نفسه، اضغط «إعادة تحميل» في صفحة الإضافات.</li>
    </ol></details>
    ${extensionPreview ? html`<p role="status">${extensionPreview.envelope.source === 'noor' ? 'نور — عمود ظاهر مختار؛ صفحات وأعمدة أخرى غير مجمّعة' : 'مدرستي — الأسماء التي راجعتها في الإضافة فقط'} · ${extensionPreview.envelope.rows.length} اسمًا. اختر الفصل والمادة أدناه.</p><button class="btn btn--primary" data-act="n36-extension-review" ${!hub.existing || hub.kind === 'new' ? 'disabled' : ''}>مراجعة أسماء الإضافة</button><button class="btn btn--quiet" data-act="n36-extension-cancel">إلغاء ومسح النقل</button>` : ''}
    ${store.state.device?.n36NamesBatch?.pending ? html`<details open><summary>الفصول غير المحسومة فقط</summary>${[...new Set(Object.values(store.state.device.n36NamesBatch.pending).flatMap(p=>p.rows.map(r=>r.classroom)))].map(classroom=>html`<label class="field"><span>${classroom} — حدّد فصلًا موجودًا إذا لم تُحسم المطابقة</span><select class="select" data-n36-batch-map data-classroom="${classroom}"><option value="">المطابقة من اسم المصدر</option>${store.sections().filter(s=>s.status!=='archived'&&(!s.ownerId||s.ownerId===store.getActiveWorkspace().authUserId)).map(s=>html`<option value="${s.id}" ${store.state.device.n36NamesBatch.classMappings?.[classroom]===s.id?'selected':''}>${sectionLabel(s)}</option>`)}</select></label>`)}</details><button class="btn" data-act="n36-batch-resume">استكمال دفعة الأسماء المحفوظة لهذا الحساب</button>` : ''}
    <p role="status" data-n36-handoff-status>${extensionBusy ? 'جار استلام المعاينة المؤقتة…' : extensionMessage}</p>
  </section>`;
}
async function receiveExtension() {
  let request; try { request=handoffRequest(); } catch { extensionMessage='رابط النقل غير صالح. أعد النقل من الإضافة ثم أعد المحاولة.'; history.replaceState(null,'','#/classes/koshoof?import=1'); repaint(); return; }
  if(!request || extensionBusy)return;
  let owner; try { owner=extensionOwnerBinding(); } catch { return; }
  const route=location.hash;
  extensionBusy=true; clearExtensionPreview();
  try {
    const result=await claimHandoff(request);
    if(location.hash !== route || extensionOwnerBinding() !== owner) throw Error('OWNER_CHANGED');
    if(result.envelope.version===2){
      try{const outcome=await saveAutomaticNames(result);await reportHandoffOutcome(request,outcome);}
      catch(error){extensionMessage='لم يتأكد حفظ هذه الدفعة ('+error.message+'). التقدم محفوظ في هذا الحساب؛ استكمل الدفعة نفسها من الإضافة أو زر الاستكمال.';await reportHandoffOutcome(request,{status:'unknown',added:0,existing:0,remaining:result.envelope.rows.length,total:result.envelope.rows.length});}
      return;
    }
    extensionPreview=result; extensionOwner=owner; extensionMessage='استُلمت المعاينة لمرة واحدة دون حفظ. تنتهي بعد دقيقتين من إرسالها.';
    extensionTimer=setTimeout(()=>{clearExtensionPreview();extensionMessage='انتهت المعاينة. أعد النقل من الإضافة ثم أعد المحاولة.';repaint();},Math.max(0,result.envelope.expiresAt-Date.now()));
  } catch { extensionMessage='تعذّر النقل: الإضافة غير متاحة أو انتهت الصلاحية أو تغيّر الحساب. أعد النقل ثم أعد المحاولة.'; }
  finally { extensionBusy=false;if(location.hash===route)history.replaceState(null,'','#/classes/koshoof?import=1');repaint(); }
}
function setupBinding(teachingId) {
  store.assertClassOperationsAccess(teachingId);
  const workspace = store.getActiveWorkspace(), teaching = store.getTeaching(teachingId);
  const access = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'preview', authenticatedUserId: cloud.user?.id });
  if (!store.state.ready || workspace?.type !== 'account' || !cloud.session ||
      cloud.session.user?.id !== cloud.user?.id || cloud.authStatus().state !== 'authenticated' ||
      !access.allowed || access.workspaceOwnerId !== workspace.authUserId ||
      !teaching || store.isTeachingArchived(teaching)) throw new Error('يلزم حساب وفصل نشطان لفتح المعاينة.');
  store.assertLeaseWritable();
  store.validateTeachingContext(teaching.sectionId, teaching.termId);
  return JSON.stringify([workspace.authUserId, workspace.id, workspace.databaseName, workspace.leaseGeneration,
    teaching.id, teaching.sectionId, teaching.termId, teaching.subjectId]);
}

function transferPanel(teachingId) {
  const items = teachingId ? store.teachingContext(teachingId).items : prospectiveItems;
  if (transferRoute !== location.hash) {
    transferRoute = location.hash;
    const request = new URLSearchParams(location.hash.split('?')[1]);
    if (request.get('import') === '1') transfer.panel = 'import';
    else if (request.get('export') === '1') transfer.panel = 'export';
  }
  const selectedItems = items.filter(i => !transfer.exportItems || transfer.exportItems.has(i.id));
  const groupTotal = group => selectedItems.filter(i => (transfer.noorGroups?.[i.id] ?? suggestNoorGroup(i)) === group).reduce((sum,i) => sum + Number(i.max),0);
  const review = transfer.review;
  const opts = transfer.rows?.[0] ?? [];
  const mappingSummary = html`<p data-grade-mapping-summary>${transfer.importMode === 'grades' ? html`أعمدة الدرجات المختارة: ${transfer.mappings.filter((m,c)=>m.kind !== 'ignore' && ![transfer.nameColumn,transfer.idColumn].includes(c)).length}` : html`عمود الأسماء: ${opts[transfer.nameColumn] ?? 'اختر العمود'}`}</p>`;
  return html`<div class="grade-transfer noprint" data-grade-transfer ${!transfer.panel ? 'hidden' : ''}>
    ${transfer.panel === 'import' ? html`<section id="grade-import-panel" data-grade-import-panel aria-label="استيراد الكشوف" ${transfer.panel !== 'import' ? 'hidden' : ''}>
    <div data-roster-review-controls>
    ${!hub.fileFlow ? html`<div class="segmented grade-transfer__modes" role="group" aria-label="نوع الاستيراد">
      ${['names','grades'].map(value => html`<button type="button" class="segmented__btn ${transfer.importMode === value ? 'is-on' : ''}" data-act="grade-import-mode" data-mode="${value}" data-fk="grade-import-${value}" aria-pressed="${transfer.importMode === value ? 'true' : 'false'}" ${transfer.busy ? 'disabled' : ''}>${value === 'names' ? 'أسماء فقط' : 'أسماء ودرجات'}</button>`)}
    </div>` : ''}
    ${!transfer.rows && !hub.fileFlow ? html`<button class="btn grade-transfer__template" data-act="grade-template">تنزيل نموذج أسماء فارغ</button><label class="grade-transfer__file">اختر الكشف <input class="input" type="file" accept=".csv,.xlsx" data-change="grade-file" ${transfer.busy ? 'disabled' : ''}></label>
      <p class="grade-transfer__hint">CSV أو XLSX بعناوين أعمدة · حتى 300 طالب و1 MB · الفراغ لا يغيّر الدرجة والصفر يُرصد.</p>` : ''}
    ${transfer.busy && !transfer.writing ? html`<button class="btn" data-act="grade-cancel">إلغاء القراءة</button>` : ''}
    ${transfer.rows ? html`
      ${review || draft.review ? html`<details data-grade-reviewed-mapping><summary>مطابقة الأعمدة</summary>${mappingSummary}</details>` : ''}
      ${!review && !draft.review && (!transfer.created || transfer.needsReview && !transfer.plan) ? html`<details data-grade-mapping-details ${transfer.editMapping || transfer.nameColumn < 0 || transfer.importMode !== 'names' && transfer.reasons?.some(r => r === 'exception') ? 'open' : ''}>
      <summary>مطابقة الأعمدة</summary><div class="grade-transfer__mapping">
      <div class="grade-transfer__identity">
      <label class="grade-transfer__field">اسم الطالب <select class="input" data-grade-name data-change="grade-mapping" data-fk="grade-name"><option value="-1">اختر العمود</option>${opts.map((v,c) => html`<option value="${c}" ${transfer.nameColumn === c ? 'selected' : ''}>${c+1}: ${v}</option>`)}</select></label>
      <details data-grade-identity-optional ${transfer.idColumn >= 0 ? 'open' : ''}><summary>معرف ركيز (اختياري)</summary><label class="grade-transfer__field"><select aria-label="عمود معرف ركيز" class="input" data-grade-id data-change="grade-mapping" data-fk="grade-id" ${transfer.created ? 'disabled' : ''}><option value="-1">مطابقة الاسم الفريد في الفصل</option>${opts.map((v,c) => html`<option value="${c}" ${transfer.idColumn === c ? 'selected' : ''}>${c+1}: ${v}</option>`)}</select></label></details>
      </div>
      ${transfer.importMode === 'grades' ? html`<div class="n107-mapping-head" aria-hidden="true"><span>عمود الملف</span><span>الوجهة في ركيز</span><span>الحالة</span></div>` : ''}
      ${opts.map((v,c) => {
        if (transfer.importMode === 'names') return '';
        if ([transfer.nameColumn,transfer.idColumn].includes(c)) return '';
        if (['metadata','readonly'].includes(transfer.reasons?.[c])) return html`<div class="n107-mapping-row" data-grade-ignored="${c}"><strong>${v}</strong><span>لا يُستورد</span><small>${transfer.reasons[c] === 'readonly' ? 'بند محسوب تلقائيًا أو للقراءة فقط' : 'بيانات وصفية وليست درجات'}</small></div>`;
        const m = transfer.mappings[c] ?? { kind: 'ignore' };
        const source = suggestGradeMappings([v], []).mappings[0];
        const sameName = source.kind === 'new' ? items.filter(i=>gradeNameKey(i.name) === gradeNameKey(source.name) && isTransferItem(i)) : [];
        const destination = m.kind === 'existing' ? items.find(i=>i.id === m.itemId) : sameName.length === 1 ? sameName[0] : null;
        const mismatch = source.kind === 'new' && destination && Number(source.max) !== Number(destination.max);
        const impact=m.kind==='existing' && m.fileMax!=null && Number(destination?.max)!==m.fileMax ? `${destination?.name} ${destination?.max}→${m.fileMax}` : '';
        const status = impact || (mismatch ? `العظمى مختلفة: الملف ${source.max}، البند ${destination.max}؛ اختر الوجهة صراحة أو تجاهل العمود` : m.kind === 'existing' ? 'بند محدد' : m.kind === 'new' ? 'سيُنشأ بعد تأكيد المراجعة' : transfer.reasons?.[c] === 'exception' ? 'اختر الوجهة أو تجاهل العمود' : 'لن يُستورد');

        return html`<div class="grade-transfer__column n107-mapping-row" data-grade-column="${c}"><label for="grade-column-${c}">${c+1}: ${v}</label>
          <select id="grade-column-${c}" class="input" data-grade-kind data-change="grade-mapping" data-fk="grade-column-${c}">
            <option value="ignore" ${m.kind === 'ignore' ? 'selected' : ''}>عدم استيراد العمود</option>
            ${items.filter(isTransferItem).map(i => html`<option value="${i.id}" ${m.itemId === i.id ? 'selected' : ''}>${i.name} — العظمى ${i.max}</option>`)}
            <option value="new" ${m.kind === 'new' ? 'selected' : ''}>إنشاء بند جديد</option>
          </select>
          <small data-mapping-state>${status}</small>
          ${m.kind === 'new' ? html`<div class="n107-new-fields"><label>اسم البند <input class="input" data-grade-new-name data-fk="grade-new-name-${c}" maxlength="50" value="${m.name ?? ''}" data-change="grade-mapping"></label>
            <label>الدرجة العظمى <input class="input" data-grade-new-max data-fk="grade-new-max-${c}" inputmode="decimal" value="${m.max ?? ''}" data-change="grade-mapping"></label></div>
` : ''}
        </div>`;
      })}

      </div></details>` : html`<button class="btn" data-act="grade-edit-mapping" ${transfer.busy || transfer.created && (!transfer.needsReview || transfer.plan) ? 'disabled' : ''}>تعديل المطابقة</button>`}
      ${!review && !draft.review && (!transfer.created || transfer.needsReview && !transfer.plan) ? html`<button class="btn btn--primary" data-act="grade-review" ${transfer.busy || transfer.recovery.length ? 'disabled' : ''}>مراجعة الاستيراد</button>` : ''}
      <button class="btn" data-act="grade-cancel" >إلغاء</button>
    ` : ''}
    ${review || draft.review ? html`<div data-grade-review>
      ${compactReview(draft.proposal ?? review, draft.review)}
      ${transfer.importMode==='grades' ? transfer.rows.slice(1).map((row,index) => {
        const roster = teachingId ? store.teachingContext(teachingId).roster : [];
        const candidates = roster.filter(s => gradeNameKey(s.name) === gradeNameKey(row[transfer.nameColumn]));
        if (candidates.length < 2 || transfer.idColumn >= 0 && row[transfer.idColumn]) return '';
        const choice = transfer.studentChoices?.[index+2];
        return html`<div class="grade-transfer__column"><label>صف ${index+2}: ${row[transfer.nameColumn]} — اختر الطالب في هذا الفصل
          <select class="input" data-grade-student-row="${index+2}" data-fk="grade-student-${index+2}" data-change="grade-student-choice" ${transfer.busy?'disabled':''}><option value="">اختر الطالب؛ لا مطابقة تلقائية</option>${candidates.map((s,i)=>html`<option value="${i}" ${choice?.studentId===s.id?'selected':''}>${s.name} — رقم الكشف ${s.displayNo ?? roster.indexOf(s)+1}</option>`)}</select></label>
          <label><input type="checkbox" data-grade-student-confirm="${index+2}" data-fk="grade-student-confirm-${index+2}" data-change="grade-student-choice" ${choice?.confirmed?'checked':''} ${!choice || transfer.busy?'disabled':''}> أؤكد مطابقة هذا الصف مع الطالب المختار</label></div>`;
      }) : ''}
      ${(review?.rejected ?? review?.entries?.filter(e=>!['new','existing'].includes(e.status)).map(e=>({...e,student:e.name,reason:'اسم غير صالح أو ملتبس؛ صحّحه قبل الاستيراد'})) ?? []).map(e => html`<p role="alert">صف ${e.row} · ${e.student}${e.item ? html` · ${e.item} · القيمة ${e.value} · العظمى ${e.max}` : ''}: ${e.reason}</p>`)}
      ${(!transfer.created || transfer.needsReview && !transfer.plan) ? html`
        ${review?.overwrites ? html`<label><input type="checkbox" data-grade-overwrite-confirm> أوافق على استبدال ${review.overwrites} درجة بالقيم المعروضة</label>` : ''}
        <p class="grade-transfer__notice" data-grade-confirm-alert role="alert" hidden></p>
        <button class="btn btn--primary" data-act="${draft.review ? 'class-import-confirm' : 'grade-confirm'}" ${locked() || transfer.recovery.length || review?.rejected?.length || review?.counts?.invalid || review?.counts?.ambiguous ? 'disabled' : ''}>${draft.failed ? 'استكمال الاستيراد' : 'تأكيد الاستيراد'}</button>` : ''}
    </div>` : ''}
    ${transfer.writing && !transfer.created ? html`<p data-roster-progress role="status">${draft.review ? 'حفظ الفصل والطلاب…' : 'حفظ الأسماء والدرجات…'}</p>` : ''}
    ${transfer.created ? html`<p data-roster-partial role="status">${transfer.created.existing ? 'لم يتأكد حفظ درجات الملف بعد.' : `حُفظ الفصل والمادة و${transfer.created.added} اسمًا.`} ${transfer.stage ?? 'الدرجات لم يتأكد حفظها.'}</p>
      ${!transfer.busy && !transfer.recovery.length && transfer.plan ? transfer.needsReview ? html`<button class="btn" data-act="roster-changed-review">مراجعة الأثر المتغيّر</button>` : html`<button class="btn btn--primary" data-act="roster-resume">استكمال الاستيراد</button>` : ''}` : ''}
    ${draft.failed && !transfer.created ? html`<p data-roster-partial role="status">لم تكتمل العملية. ${store.classImportReceipt(draft.review)?.sectionId ? 'حُفظ الفصل.' : 'لم يُحفظ الفصل.'} ${store.classImportReceipt(draft.review)?.teachingId ? 'حُفظ إسناد المادة.' : 'لم يُحفظ إسناد المادة.'} الأسماء المحفوظة: ${store.classImportReceipt(draft.review)?.added ?? 0}؛ المتبقية: ${store.classImportReceipt(draft.review)?.pendingNames.length ?? 0}.</p>` : ''}
    ${transfer.message ? html`<p class="grade-transfer__message ${transfer.error ? 'is-error' : ''}" role="${transfer.error ? 'alert' : 'status'}">${transfer.message}</p>` : ''}
    ${transfer.successTeaching && !transfer.error ? html`<a class="btn btn--quiet" href="#/teaching/${transfer.successTeaching}">فتح الفصل</a>` : ''}
    ${transfer.recovery.map(r => html`<p role="alert">طلب محفوظ: ${r.mutationId} — ${r.state === 'rejected' ? 'مرفوض، يلزم تصحيح سبب الرفض قبل دفعة جديدة' : 'لم يتأكد الإيصال بعد؛ أعد الطلب نفسه فقط'}
      ${r.state !== 'rejected' ? html`<button class="btn" data-act="grade-retry" data-mutation="${r.mutationId}" ${transfer.busy ? 'disabled' : ''}>استعادة إيصال الطلب نفسه</button>`
        : html`<label><input type="checkbox" data-grade-retire-confirm> أفهم أن الدفعة رُفضت بالكامل وأريد إلغاء هذا الطلب المرفوض مع حفظ سببه</label><button class="btn" data-act="grade-retire" data-mutation="${r.mutationId}">إلغاء الطلب المرفوض وحفظ الرفض</button>`}</p>`)}
    </div></section>
    ` : html`<section id="grade-export-panel" data-grade-export-panel aria-label="تصدير الكشوف" ${transfer.panel !== 'export' ? 'hidden' : ''}>
    <details data-noor-grouping ${transfer.noorOpen ? 'open' : ''}><summary>تصدير كشف نور درجات أعمال السنة (40) والاختبارات (60)</summary>
    <div class="n107-noor-items" role="group" aria-label="بنود كشف نور">${items.map(i => {
      const included = !transfer.exportItems || transfer.exportItems.has(i.id);
      return html`<div class="n107-noor-row"><label><input type="checkbox" data-change="grade-export-selection" data-fk="grade-export-${i.id}" data-grade-export-item value="${i.id}" ${included ? 'checked' : ''}> <span>${i.name} <small>· العظمى ${i.max}</small></span></label><select id="noor-${i.id}" class="input" aria-label="مجموعة ${i.name}" data-noor-item="${i.id}" data-fk="grade-noor-${i.id}" data-change="grade-noor-group" ${included ? '' : 'disabled'}><option value="">اختر المجموعة</option>${['40','60'].map(group => html`<option value="${group}" ${(transfer.noorGroups?.[i.id] ?? suggestNoorGroup(i)) === group ? 'selected' : ''}>${group === '40' ? 'درجات أعمال السنة (40)' : 'درجات الاختبارات (60)'}</option>`)}</select></div>`;
    })}</div>
    <div class="n107-noor-totals" data-noor-totals role="status">${['40','60'].map(group=>html`<span>${group === '40' ? 'درجات أعمال السنة (40)' : 'درجات الاختبارات (60)'}: <bdi dir="ltr">${groupTotal(group)}/${group}</bdi></span>`)}</div>
    ${selectedItems.some(i=>!['40','60'].includes(transfer.noorGroups?.[i.id] ?? suggestNoorGroup(i))) || groupTotal('40') !== 40 || groupTotal('60') !== 60 ? html`<p class="grade-transfer__hint" data-noor-invalid>عيّن مجموعة لكل بند مختار؛ يجب أن يساوي المجموع <bdi dir="ltr">40/40</bdi> و<bdi dir="ltr">60/60</bdi>.</p>` : ''}
    <p data-noor-alert role="alert" hidden></p>
    <button class="btn btn--primary" data-act="grade-noor-export">تصدير كشف نور</button></details>
    </section>`}
  </div>`;

}

function readTransferMappings(root) {
  if (!root.querySelector('[data-grade-name]')) return;
  transfer.nameColumn = Number(root.querySelector('[data-grade-name]').value);
  transfer.idColumn = Number(root.querySelector('[data-grade-id]').value);
  const mappings = transfer.mappings.map(m => ({...m}));
  for (const el of root.querySelectorAll('[data-grade-column]')) {
    const c = Number(el.dataset.gradeColumn), value = el.querySelector('[data-grade-kind]').value;
    if (value === 'ignore') { mappings[c] = {kind:'ignore'}; continue; }
    if (value !== 'new') { const safe=suggestGradeMappings(transfer.rows[0],destinationItems(),{teachingId:hub.kind==='new'?'prospective':hub.existing,ownerId:workspace?.authUserId}).mappings[c]; mappings[c] = {kind:'existing',itemId:value,...(safe?.itemId===value && safe.fileMax!=null ? {fileMax:safe.fileMax}: {})}; continue; }
    const prior = transfer.mappings[c];
    const proposal = prior?.kind === 'new' ? prior : suggestGradeMappings([transfer.rows[0][c]], []).mappings[0];
    mappings[c] = {kind:'new',id:prior?.kind === 'new' ? prior.id : crypto.randomUUID(),name:el.querySelector('[data-grade-new-name]')?.value ?? (proposal.kind === 'new' ? proposal.name : ''),
      max:el.querySelector('[data-grade-new-max]')?.value ?? (proposal.kind === 'new' ? proposal.max : ''),confirmed:true};
  }
  [transfer.nameColumn, transfer.idColumn].forEach(c => { if (c >= 0) mappings[c] = {kind:'ignore'}; });
  transfer.mappings = mappings;
}

async function transferConfirm(el, retry = false) {
  const root = el.closest('[data-grade-transfer]');
  const current = transfer;
  if (!root?.isConnected || transfer.busy || !retry && transfer.recovery.length || !retry && (!transfer.review || transfer.review.rejected?.length || !transfer.review.cells?.length && !transfer.review.names?.length && !transfer.review.newStudents?.length && !transfer.review.entries?.length)) return;
  if (!retry && transfer.review?.overwrites && !root.querySelector('[data-grade-overwrite-confirm]')?.checked) {
    const alert=root.querySelector('[data-grade-confirm-alert]');alert.textContent='أكد الموافقة على استبدال الدرجات المعروضة أولًا.';alert.hidden=false;return;
  }
  const overwriteConfirmed=root.querySelector('[data-grade-overwrite-confirm]')?.checked ?? false;
  const enrollmentConfirmed=true;
  const plan=current.maximumReview && current.plan ? current.plan : capturePlan();current.plan=plan;
  transfer.busy = true; transfer.writing = true; repaint();
  try {
    assertPlan(current,plan);
    const reviewed = current.review;
    const recovered = retry ? await store.retryGradeImport(el.dataset.mutation) : null;
    if (!retry && transfer.importMode === 'names') await store.confirmNamesImport(transfer.review, true,{verifyCurrent:()=>assertPlan(current,plan)});
    else if (!retry) {
      let fresh = store.reviewGradeImport(transfer.review.teachingId, transfer);
      if (!current.maximumReview && JSON.stringify(fresh) !== JSON.stringify(transfer.review)) throw new Error('تغيّرت بيانات المراجعة؛ راجع المطابقة من جديد.');
      if(fresh.maxChanges.length || current.maximumReview){
        current.created ??= {teachingId:fresh.teachingId,existing:true};
        current.maximumReview ??= fresh;current.overwriteConfirmed=overwriteConfirmed;
        await saveRosterContinuation(current);
        fresh=await acknowledgeMaximums(current,plan,current.maximumReview);current.review=fresh;
      }
      if(!fresh.cells.length) {
        await store.confirmNamesImport(store.reviewNamesImport(fresh.teachingId,current),true,{verifyCurrent:()=>assertPlan(current,plan)});
      } else await store.confirmGradeImport(fresh, { approved: true, overwriteConfirmed, enrollmentConfirmed,verifyCurrent:()=>{assertPlan(current,plan);assertGradePreservation(current);if(JSON.stringify(store.reviewGradeImport(fresh.teachingId,current))!==JSON.stringify(fresh))throw importChanged();} });
    }
    const teaching = store.getTeaching(recovered?.teachingId ?? reviewed?.teachingId ?? current.created?.teachingId);
    const savedNames = current.created?.added ?? recovered?.addedNames ?? reviewed?.names?.length ?? reviewed?.newStudents?.length ?? 0;
    const gradeCount = recovered?.gradeCount ?? reviewed?.cells?.length ?? 0;
    await clearRosterContinuation(current);
    current.rows = null; current.review = null; current.created = null;current.plan=null;current.maximumReview=null; draft = {}; current.error = false; current.successTeaching = teaching?.id;
    current.message = teaching ? `${teachingLabel(teaching)} · الأسماء المحفوظة: ${savedNames} · الأسماء المعلقة: 0${gradeCount ? ` · الدرجات المحفوظة: ${gradeCount}` : ''}` : 'تم تأكيد إيصال الطلب المحفوظ.';
  } catch (error) { current.message = error.message; current.error = true; }
  finally { current.busy = false; current.writing = false; if (transfer === current) { current.recovery = await rosterRecovery(); repaint(); } }
}

function transferExport(el, ev, params) {
  if (el.dataset.act === 'grade-template') { downloadGradeCsv(exportNamesTemplate(), { blankTemplate: true }); return; }
  if (el.dataset.act !== 'grade-noor-export') return;
  const root = el.closest('[data-grade-transfer]'), alert = root.querySelector('[data-noor-alert]');
  alert.hidden = true; alert.textContent = '';
  try {
    const selected = new Set([...root.querySelectorAll('[data-grade-export-item]:checked')].map(e => e.value));
    const context = store.teachingContext(params.id), teaching = store.getTeaching(params.id);
    const className = teachingLabel(teaching);
    downloadGradeCsv(exportGradeCsv({ ...context, items: context.items.filter(i => selected.has(i.id)), noorReview: true,
      noorGroups: Object.fromEntries([...root.querySelectorAll('[data-noor-item]')].map(e => [e.dataset.noorItem, e.value])),
      noorConfirmed: true }), { noorReview: true, className, filenameClassName: filenameTeachingLabel(teaching) });
  } catch (error) { alert.textContent = error.message; alert.hidden = false; }
}

function bindTransfer(id) {
  const binding = JSON.stringify([store.getActiveWorkspace(), store.activeYear()?.id, store.activeTerm()?.id, id]);
  if (binding === transferBinding) return;
  transfer = { importMode: 'names', panel: null, rows: null, mappings: [], nameColumn: -1, idColumn: -1, review: null, recovery: [], message: '', busy: false };
  transferBinding = binding;
  transferRoute = null;
  // AI-authored N105: render can rebind after onMount; reload recovery for this exact binding.
  if (id) {
    const current = transfer;
    rosterRecovery(id).then(rows => { if (transfer === current) { current.recovery = rows; repaint(); } });
  }
}
function canOpenKoshoof(p) {
  if (!canOpenRoster(p)) return false;
  try {
    if (store.getActiveWorkspace()?.type === 'account') setupBinding(p.id);
    else store.assertLeaseWritable();
    return true;
  } catch { return false; }
}

const transferActions = {
    async 'grade-file'(el, ev, params) {
      const prior = transfer;
      if (allowed()) return;
      draft = {}; fileSession = cloud.session;
      const file = el.files?.[0];
      if (!file || prior.writing) return;
      const current = transfer = { ...prior, maximumReview:null,plan:null,created:null, rows:null, mappings:[], review:null, busy:false, writing:false, successTeaching:null };
      current.busy = true; current.rows = null; current.review = null; current.message = 'جار قراءة الملف محليًا…'; current.error = false; repaint();
      try {
        if(file.size>1024*1024)throw Error('حجم الملف يتجاوز 1 MB.');
        let rows = await readGradeFile(file);
        const detected = detectClassNameColumn(rows);
        rows = detected.header < 0 ? [['اسم الطالب'], ...rows] : rows.slice(detected.header);
        bind(); if (transfer !== current || fileSession !== cloud.session || allowed()) return;
        transfer.rows = rows; transfer.fileName = file.name; Object.assign(transfer, suggestGradeMappings(rows[0], params.id ? store.teachingContext(params.id).items : prospectiveItems, {teachingId:params.id ?? 'prospective',ownerId:store.getActiveWorkspace()?.authUserId}));
        transfer.mappings = transfer.mappings.map(m => m.kind === 'new' ? {...m,id:crypto.randomUUID()} : m);
        if (transfer.nameColumn < 0) transfer.nameColumn = detected.mapping.name;
        const suggested = transfer.mappings.flatMap((m,c) => m.kind !== 'ignore' ? [c] : []);
        transfer.visibleColumns = new Set(suggested.concat(transfer.reasons.flatMap((reason,c) => reason === 'exception' ? [c] : [])));
        transfer.mappings = transfer.mappings.map((m,c) => transfer.visibleColumns.has(c) ? m : {kind:'ignore'});
        transfer.importMode ??= 'names';
        transfer.editMapping = false; transfer.review = null; transfer.newStudentIds = {}; transfer.studentChoices = {}; transfer.message = ''; transfer.error = false;
      } catch (error) { if (transfer === current) { transfer.rows = null; transfer.review = null; transfer.message = 'تعذّر قراءة الملف: ' + error.message; transfer.error = true; } }
      finally { current.busy = false; if (transfer === current) repaint(); }
    },
    'grade-student-choice'(el, ev, params) {
      if (transfer.busy || !el.isConnected) return;
      try {
        store.assertClassOperationsAccess(params.id);
        const root = el.closest('[data-grade-transfer]'), row = Number(el.dataset.gradeStudentRow ?? el.dataset.gradeStudentConfirm);
        const roster = store.teachingContext(params.id).roster, teaching = store.getTeaching(params.id), workspace = store.getActiveWorkspace();
        const candidates = roster.filter(s => gradeNameKey(s.name) === gradeNameKey(transfer.rows[row-1][transfer.nameColumn]));
        const selected = root.querySelector(`[data-grade-student-row="${row}"]`).value;
        transfer.studentChoices ??= {};
        if (selected === '') delete transfer.studentChoices[row];
        else transfer.studentChoices[row] = {studentId:candidates[Number(selected)]?.id,
          confirmed:!!el.dataset.gradeStudentConfirm && root.querySelector(`[data-grade-student-confirm="${row}"]`).checked,
          binding:rosterChoiceBinding({roster,teaching,ownerId:workspace.authUserId,databaseName:workspace.databaseName})};
        // Unconfirmed selections remain rejected in review until explicit row approval.
        const input = {...transfer,studentChoices:Object.fromEntries(Object.entries(transfer.studentChoices).filter(([,c])=>c.confirmed))};
        transfer.review = store.reviewGradeImport(params.id,input); transfer.message = ''; transfer.error = false;
      } catch(error) { transfer.review = null; transfer.message = error.message; transfer.error = true; }
      repaint();
    },
    'grade-mapping'(el) { if (draft.review && !transfer.created || transfer.recovery.length) return; readTransferMappings(el.closest('[data-grade-transfer]')); transfer.review = null; transfer.editMapping = true; repaint(); },
    'grade-edit-mapping'() { if (transfer.busy || transfer.created && (!transfer.needsReview || transfer.plan)) return; draft={manual:draft.manual};transfer.plan=null;transfer.page=0;transfer.review = null; transfer.editMapping = true; repaint(); },
    'grade-export-selection'(el) { transfer.exportOpen = true; transfer.noorOpen = el.closest('[data-grade-transfer]').querySelector('[data-noor-grouping]').open; transfer.exportItems = new Set([...el.closest('[data-grade-transfer]').querySelectorAll('[data-grade-export-item]:checked')].map(e => e.value)); repaint(); },
    'grade-review'(el, ev, params) {
      try { assertFileCurrent(); readTransferMappings(el.closest('[data-grade-transfer]')); transfer.mappings=transfer.mappings.map(m=>m.kind==='new'?{...m,confirmed:true}:m); transfer.page=0; if (hub.kind === 'new') { reviewNewRoster(); repaint(); return; } transfer.review = transfer.importMode === 'names' ? store.reviewNamesImport(params.id, transfer) : store.reviewGradeImport(params.id, transfer); transfer.message = ''; transfer.error = false; }
      catch (error) { transfer.review = null; transfer.message = error.message === 'GRADE_NEW_ITEM_CONFIRM_REQUIRED' ? 'أكد إنشاء كل بند جديد باسمه وعظماه، أو اختر تجاهله قبل المراجعة.' : error.message === 'GRADE_CONTEXT_INVALID' ? 'بيانات الفصل لم تتأكد بالمزامنة بعد. أكمل المزامنة ثم أعد المراجعة؛ الملف والأعمدة محفوظة.' : error.message === 'GRADE_DUPLICATE_ITEM' ? 'اختر بندًا مختلفًا لكل عمود درجات؛ لا يمكن ربط عمودين بالبند نفسه.' : 'راجع الأعمدة والبنود والعظمى: ' + error.message; transfer.error = true; }
      repaint();
    },
    'grade-cancel'() { cancelImport(); },
    'grade-confirm': el => transferConfirm(el),
    'grade-retry': el => transferConfirm(el, true),
    async 'grade-retire'(el) {
      const confirmed = el.closest('[data-grade-transfer]').querySelector('[data-grade-retire-confirm]')?.checked;
      if (!confirmed) { toast('أكد إلغاء الطلب المرفوض وحفظ سبب الرفض أولًا', 'danger'); return; }
      const current = transfer;
      try { await store.retireRejectedGradeImport(el.dataset.mutation, true); current.review = null; current.message = 'حُفظ الرفض وأُلغي الطلب المرفوض. أكمل المزامنة ثم راجع ملفك من جديد.'; }
      catch (error) { current.message = error.message; current.error = true; }
      if (transfer === current) { current.recovery = await rosterRecovery(); repaint(); }
    },
    'grade-import-mode'(el) { if (transfer.busy || draft.review || transfer.created) return; transfer.importMode = el.dataset.mode; transfer.review = null; transfer.message = ''; transfer.error = false; repaint(); },
    'grade-noor-group'(el) { transfer.noorGroups ??= {}; transfer.noorGroups[el.dataset.noorItem] = el.value; transfer.noorOpen = true; repaint(); },
    'grade-template': transferExport,
    'grade-noor-export': transferExport,
};

let draft = {}, workspace, focusRoute, scope, fileSession;
let hub = { selected: new Set(), namesOnly: true };
function bind() {
  const next = JSON.stringify([store.activeYear()?.id, store.activeTerm()?.id, store.getActiveWorkspace()?.leaseGeneration, cloud.user?.id]);
  if (workspace !== store.getActiveWorkspace() || scope !== next || fileSession !== cloud.session) {
    draft = {}; transferBinding = null; transfer = emptyTransfer(); hub = { selected: new Set(), namesOnly: true }; fileSession = cloud.session; workspace = store.getActiveWorkspace(); scope = next;
  }
}
function allowed() { try { store.assertClassImportAccess(); return ''; } catch (error) { return error.message; } }
const unavailable = message => html`<div class="empty"><h2>الاستيراد غير متاح الآن</h2><p>${message}</p><a class="btn" href="#/classes">العودة للفصول</a></div>`;
const back = () => '#/classes';
function focus(root) {
  if (focusRoute !== location.hash) { focusRoute = location.hash; root.querySelector('.class-import-page, [data-class-access-status], h2')?.focus({ preventScroll: true }); }
}
// AI-authored N107: one immutable semantic approval, bounded foreground continuation.
const importChanged = () => Error('تغيّر أثر الاستيراد أو سياقه؛ يلزم مراجعة جديدة قبل حفظ درجات إضافية.');
const planInput = () => JSON.stringify([transfer.fileName,transfer.rows,transfer.nameColumn,transfer.idColumn,transfer.mappings,transfer.studentChoices,transfer.importMode,draft.manual]);
const academicBinding = row => JSON.stringify(row, (key,value)=>['serverRevision','syncCreatePending','ownerId','updatedAt','canonicalId','serverCanonical','fieldRevisions','syncConflicts'].includes(key)?undefined:value);
function capturePlan() {
  return Object.freeze({workspace:store.getActiveWorkspace(),workspaceBinding:JSON.stringify(store.getActiveWorkspace()),session:cloud.session,scope,route:location.hash,
    year:academicBinding(store.activeYear()),term:academicBinding(store.activeTerm()),input:planInput(),
    expires:Date.now()+10*60*1000,proposal:JSON.stringify(draft.proposal),classReview:draft.review});
}
function assertPlan(current, plan) {
  assertFileCurrent();
  if (transfer !== current || current.plan !== plan || current.cancelled || location.hash !== plan.route ||
      hub.tab !== 'import' || JSON.stringify(store.getActiveWorkspace()) !== plan.workspaceBinding || workspace !== plan.workspace || cloud.session !== plan.session || scope !== plan.scope ||
      academicBinding(store.activeYear()) !== plan.year || academicBinding(store.activeTerm()) !== plan.term ||
      planInput() !== plan.input || Date.now() > plan.expires) throw importChanged();
}
const itemSemantics = items => JSON.stringify(items.map(i=>[i.name,i.max,i.auto??null,i.scoreMode??'direct',!!i.deleted]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
function gradeSemantics(review) {
  return JSON.stringify({entries:review.entries.map(({row,student,item,max,old,original,value})=>({row,student,item,max,old,original,value})),
    items:review.newItems,overwrites:review.overwrites,rejected:review.rejected});
}
// Only listed item revisions may advance; numeric grades, identities and consent stay bound.
function assertGradePreservation(current) {
  if(current.maximumReview)store.assertImportMaximumReviewCurrent(current.maximumReview);
}
function reboundSemantics(review, changes) {
  return JSON.stringify({...review,maxChanges:[],cells:review.cells.map(c=>({...c,
    itemRevision:changes.some(m=>m.itemId===c.itemId)?0:c.itemRevision}))});
}
async function acknowledgeMaximums(current,plan,review) {
  assertPlan(current,plan);current.stage='انتظار إيصال تغيير العظمى';repaint();
  await store.confirmImportMaximums(review,{verifyCurrent:()=>assertPlan(current,plan)});
  assertPlan(current,plan);
  const fresh=current.created?.existing ? store.reviewGradeImport(review.teachingId,current) : boundGradeReview(current,plan);
  if(reboundSemantics(fresh,review.maxChanges)!==reboundSemantics(review,review.maxChanges))throw importChanged();
  return fresh;
}
function boundGradeReview(current, plan) {
  assertPlan(current,plan);
  const receipt=current.created, proposal=JSON.parse(plan.proposal), original=JSON.parse(plan.input)[1];
  if (!receipt?.teachingId || receipt.pendingNames.length || receipt.added !== plan.classReview.names.length ||
      receipt.students.length !== receipt.added || new Set(receipt.students.map(s=>s.id)).size !== receipt.added) throw importChanged();
  const byName=new Map(receipt.students.map(s=>[s.name,s.id]));
  if(byName.size !== receipt.added || plan.classReview.names.some(n=>!byName.get(n)))throw importChanged();
  const rows=original.map((row,i)=>[...row,...Array(Math.max(0,original[0].length-row.length)).fill(''),i ? byName.get(String(row[current.nameColumn]??'').replace(/\s+/g,' ').trim()) ?? '' : 'معرف ركيز المحفوظ']);
  store.assertClassOperationsAccess(receipt.teachingId);
  const section=store.getSection(receipt.sectionId);
  if(section?.grade!==plan.classReview.grade || section.label!==plan.classReview.label || section.yearId!==plan.classReview.yearId)throw importChanged();
  const teaching=store.getTeaching(receipt.teachingId), context=store.teachingContext(receipt.teachingId);
  if(!teaching || teaching.sectionId !== receipt.sectionId || teaching.termId !== plan.classReview.termId ||
     store.getSubject(teaching.subjectId)?.name !== plan.classReview.subject || context.roster.length !== receipt.added ||
     context.roster.some(s=>byName.get(s.name)!==s.id) || itemSemantics(context.items.map(i=>{const c=current.maximumReview?.maxChanges.find(c=>c.itemId===i.id);return c && Number(i.max)===c.max?{...i,max:c.oldMax}:i;}))!==current.createdItems)throw importChanged();
  const parents=[teaching,store.getSection(receipt.sectionId),store.getSubject(teaching.subjectId),...context.roster,
    ...store.state.enrollments.filter(e=>!e.deleted && e.sectionId===receipt.sectionId)];
  if(parents.some(r=>!(Number(r.serverRevision)>0) || r.syncCreatePending))throw Error('GRADE_CONTEXT_INVALID');
  const mappings=current.mappings.map(mapping=>{
    if(mapping.kind!=='existing')return mapping;
    const expected=prospectiveItems.find(item=>item.id===mapping.itemId);
    if(!expected)throw importChanged();
    const matches=context.items.filter(item=>isTransferItem(item) && gradeNameKey(item.name)===gradeNameKey(expected.name));
    if(matches.length!==1)throw importChanged();
    return {...mapping,itemId:matches[0].id};
  });
  const actual=store.reviewGradeImport(receipt.teachingId,{...current,rows,idColumn:original[0].length,mappings:[...mappings,{kind:'ignore'}],studentChoices:{}});
  if(actual.newStudents.length || gradeSemantics(actual)!==gradeSemantics(proposal) || actual.entries.some(e=>byName.get(e.student)!==e.studentId))throw importChanged();
  return actual;
}
function waitForCreation(current,plan) {
  // Notify-driven, one bounded deadline. No polling, background writes or synthetic Sync acknowledgment.
  return new Promise((resolve,reject)=>{
    let stop=()=>{},timer;
    const finish=(error,value)=>{stop();clearTimeout(timer);current.stopWait=null;error?reject(error):resolve(value);};
    const check=()=>{try{finish(null,boundGradeReview(current,plan));}catch(error){
      try{assertPlan(current,plan);}catch(changed){finish(changed);return;}
      if(error.message !== 'GRADE_CONTEXT_INVALID' && error.message !== 'GRADE_ITEM_UNAVAILABLE')finish(error);
    }};
    stop=store.subscribe(check);current.stopWait=()=>finish(importChanged());
    timer=setTimeout(()=>finish(Error('انتظار المزامنة لم يكتمل. الأسماء محفوظة والدرجات لم تُحفظ؛ استكمل الطلب نفسه بعد المزامنة.')),6000);
    check();
  });
}
// Owner-database device state only: retain the reviewed file while creation ACKs
// are pending. Reload never starts a write; the teacher explicitly resumes.
async function saveRosterContinuation(current) {
  const plan=current.plan;assertPlan(current,plan);
  await store.saveClassFileImportContinuation({version:1,ownerId:workspace.authUserId,databaseName:workspace.databaseName,
    year:plan.year,term:plan.term,expires:plan.expires,route:plan.route,input:plan.input,proposal:plan.proposal,
    classReview:plan.classReview,created:current.created,createdItems:current.createdItems,newStudentIds:current.newStudentIds,maximumReview:current.maximumReview,overwriteConfirmed:current.overwriteConfirmed,...(store.state.device?.classFileImportContinuation?.maxProgress ? {maxProgress:store.state.device.classFileImportContinuation.maxProgress}: {})}, {verifyCurrent:()=>assertPlan(current,plan)});
  assertPlan(current,plan);
}
function restoreRosterContinuation() {
  const saved=store.state.device?.classFileImportContinuation;
  if(!saved || saved.version!==1 || saved.ownerId!==workspace?.authUserId || saved.databaseName!==workspace?.databaseName ||
      !saved.created?.teachingId)return;
  const stale=saved.year!==academicBinding(store.activeYear()) || saved.term!==academicBinding(store.activeTerm()) || Date.now()>saved.expires;
  const [fileName,rows,nameColumn,idColumn,mappings,studentChoices,importMode,manual]=JSON.parse(saved.input);
  draft={manual,review:saved.classReview,proposal:saved.proposal ? JSON.parse(saved.proposal) : undefined};
  transfer={...emptyTransfer(),fileName,rows,nameColumn,idColumn,mappings,studentChoices,importMode,
    reasons:suggestGradeMappings(rows[0],prospectiveItems,{teachingId:'prospective',ownerId:workspace.authUserId}).reasons,
    created:saved.created,createdItems:saved.createdItems,newStudentIds:saved.newStudentIds,maximumReview:saved.maximumReview,overwriteConfirmed:saved.overwriteConfirmed,review:saved.created.existing?saved.maximumReview:null,needsReview:stale,stage:stale?'انتهت المراجعة أو تغيّر سياقها؛ عُد إلى سياق الطلب وراجعه من جديد، أو ألغِ المراجعة.':'الأسماء محفوظة؛ استكمل الطلب المحفوظ بعد المزامنة.'};
  hub.kind=saved.created.existing?'existing':'new';hub.existing=saved.created.teachingId;transfer.plan=Object.freeze({...capturePlan(),expires:saved.expires});
}
async function clearRosterContinuation(current) {
  const saved=store.state.device?.classFileImportContinuation;
  if(saved?.ownerId===store.getActiveWorkspace()?.authUserId && saved.created?.teachingId===current.created?.teachingId)
    await store.saveClassFileImportContinuation(null,{expectedTeachingId:current.created.teachingId});
}
async function continueRoster(current) {
  const plan=current.plan;
  try {
    assertPlan(current,plan);current.stage='انتظار المزامنة';repaint();
    let actual;
    if(current.created?.existing)actual=current.maximumReview;
    else actual=await waitForCreation(current,plan);
    if(actual.maxChanges.length || current.maximumReview){current.maximumReview ??= actual;await saveRosterContinuation(current);actual=await acknowledgeMaximums(current,plan,current.maximumReview);}
    assertPlan(current,plan);current.stage='حفظ الدرجات';current.review=actual;repaint();
    if(actual.cells.length)await store.confirmGradeImport(actual,{approved:true,overwriteConfirmed:current.overwriteConfirmed===true,enrollmentConfirmed:true,verifyCurrent:()=>{assertPlan(current,plan);assertGradePreservation(current);const fresh=current.created?.existing?store.reviewGradeImport(actual.teachingId,current):boundGradeReview(current,plan);if(JSON.stringify(fresh)!==JSON.stringify(actual))throw importChanged();}});
    assertPlan(current,plan);
    await clearRosterContinuation(current);
    current.rows=null;current.review=null;current.plan=null;current.created=null;current.maximumReview=null;draft={};current.successTeaching=actual.teachingId;
    hub.kind='existing';hub.existing=actual.teachingId;
    current.message=`اكتمل الاستيراد. الأسماء المحفوظة: ${plan.classReview?.names.length ?? actual.newStudents.length} · الدرجات المحفوظة: ${actual.cells.length}`;current.error=false;
  } catch(error) {current.stage='الدرجات لم يتأكد حفظها.';current.message=error.message;current.error=true;current.needsReview=error.message===importChanged().message;}
  finally{current.busy=false;current.writing=false;current.recovery=await rosterRecovery(current.created?.teachingId);if(transfer===current)repaint();}
}
const classImport = { actions: {
  async 'class-import-confirm'() {
    const current=transfer,currentDraft=draft,review=draft.review;
    if(!review || locked() || allowed())return;
    const plan=current.plan ?? capturePlan();current.plan=plan;current.busy=true;current.writing=true;repaint();
    try {
      assertPlan(current,plan);
      const receipt=await store.confirmClassImport(review,true,{verifyCurrent:()=>assertPlan(current,plan)});
      assertPlan(current,plan);draft.failed=false;
      if(draft.proposal?.cells.length || draft.proposal?.maxChanges?.length){current.created=receipt;current.createdItems=itemSemantics(store.teachingContext(receipt.teachingId).items);current.stage='حفظ الفصل والطلاب';await saveRosterContinuation(current);await continueRoster(current);}
      else {hub.kind='existing';hub.existing=receipt.teachingId;current.plan=null;current.rows=null;current.review=null;current.successTeaching=receipt.teachingId;current.message=`اكتمل الاستيراد. الأسماء المحفوظة: ${receipt.added}${current.importMode==='grades'?' · لا توجد درجات مدخلة في الملف؛ لم تُنشأ بنود درجات من الكشف.':''}`;draft={};}
    }catch(error){if(transfer===current && draft===currentDraft){draft.failed=true;current.message=error.message;current.error=true;}}
    finally{current.busy=false;current.writing=false;if(transfer===current)repaint();}
  },
  'roster-changed-review'(){
    const current=transfer,plan=current.plan;if(locked() || !current.created || !plan || allowed())return;
    try{
      assertFileCurrent();
      if(current.created.existing){current.message='تغيّر البند أو السياق. ألغِ المراجعة، عالج تعارض المزامنة ثم اختر الملف وراجعه من جديد؛ الدرجات لم تُرسل.';repaint();return;}
      const original=JSON.parse(plan.input)[1],ids=new Map(current.created.students.map(s=>[s.name,s.id]));
      const column=original[0].length;
      current.rows=original.map((row,i)=>[...Array.from({length:column},(_,c)=>row[c]??''),i?ids.get(String(row[current.nameColumn]??'').replace(/\s+/g,' ').trim())??'':'معرف ركيز المحفوظ']);
      const items=store.teachingContext(current.created.teachingId).items;
      current.idColumn=column;current.mappings=[...current.mappings.slice(0,column).map((mapping,c)=>{
        if(mapping.kind!=='existing')return mapping;
        const expected=prospectiveItems.find(item=>item.id===mapping.itemId);
        const matches=expected?items.filter(item=>isTransferItem(item) && gradeNameKey(item.name)===gradeNameKey(expected.name)):[];
        if(matches.length===1)return {...mapping,itemId:matches[0].id};
        current.reasons[c]='exception';return {kind:'ignore'};
      }),{kind:'ignore'}];
      current.plan=null;current.needsReview=true;current.editMapping=true;current.page=0;
      hub.existing=current.created.teachingId;hub.kind='existing';draft={};
      current.review=store.reviewGradeImport(hub.existing,current);current.message='تغيّر أثر الخطة السابقة. راجع الأثر الحالي وأكّده صراحة قبل أي حفظ جديد.';
    }catch(error){current.message=error.message;current.error=true;}
    repaint();
  },
  async 'roster-resume'(){if(locked() || !transfer.plan || transfer.needsReview || transfer.recovery.length)return;transfer.cancelled=false;transfer.busy=true;transfer.writing=true;await continueRoster(transfer);},
  'class-import-reset'(){cancelImport();},
}};
async function cancelImport(){
  const current=transfer;if(current.cancelling)return;current.cancelling=true;current.cancelled=true;current.stopWait?.();
  try{if(current.created)await store.cancelClassFileImportContinuation(current.created.teachingId);else await clearRosterContinuation(current);}
  catch(error){if(transfer===current){current.cancelling=false;current.cancelled=false;current.message=error.message;current.error=true;repaint();}return;}
  if(transfer!==current)return;
  draft={};transfer={...emptyTransfer(),recovery:current.recovery,message:'أُغلقت المراجعة. أي بيانات حُفظت سابقًا تبقى محفوظة.'};repaint();
}
function compactReview(review,creation) {
  const entries=creation ? transfer.rows.slice(1).map((r,i)=>({row:i+2,name:String(r[transfer.nameColumn]??''),status:'new'})) : review.entries;
  const grades=review?.cells ? review : null, blank=grades && grades.entries.every(e=>e.value===null);
  const columns=blank ? [] : [...new Map((grades?.entries??[]).map(e=>[e.item,{name:e.item,max:e.max}])).values()];
  const rows=creation || !grades ? entries : transfer.rows.slice(1).map((r,i)=>({row:i+2,name:String(r[transfer.nameColumn]??''),status:grades.rejected.some(e=>e.row===i+2)?'invalid':grades.newStudents.some(s=>s.name===String(r[transfer.nameColumn]??'').trim())?'new':'existing'}));
  const pages=Math.max(1,Math.ceil(rows.length/10)),page=Math.min(transfer.page??0,pages-1);
  const added=creation?.names.length ?? (grades ? grades.newStudents.length : review.names.length);
  return html`<section class="n107-review" aria-label="معاينة الاستيراد">
    <h3>معاينة الاستيراد</h3><p>${creation ? html`${GRADES.find(g=>g.v===creation.grade)?.label} / ${creation.label} · ${creation.subject}` : shortTeachingLabel(store.getTeaching(review.teachingId))} · ${store.activeYear()?.label} · ${store.activeTerm()?.name}</p>
    <p>${rows.length} طالبًا${added ? html` · سيُضاف ${added} اسمًا` : ' · الأسماء موجودة'}${grades?.cells.length ? html` · ${grades.cells.length} درجة${grades.overwrites ? html` · استبدال ${grades.overwrites}` : ''}` : ''}</p>
    ${blank ? html`<p>لا توجد درجات مدخلة في الملف. ${grades.maxChanges?.length ? 'سيُحفظ كشف الأسماء وتعديل العظمى المعروض.' : 'سيُحفظ كشف الأسماء فقط.'}</p>` : ''}
    ${grades?.maxChanges?.length ? html`<p data-grade-max-impact>${grades.maxChanges.map(c=>{const item=JSON.parse(c.item);return `${item.name} ${c.oldMax}→${c.max}`;}).join('، ')} · العظمى المحددة في الملف؛ الدرجات السابقة تبقى بقيمها.</p>` : ''}
    ${grades?.newItems.length ? html`<p data-grade-proposed-items>سيُنشأ: ${grades.newItems.map(i=>`${i.name} / ${i.max}`).join('، ')}.</p>` : ''}
    ${grades && !blank && !grades.newItems.length && transfer.mappings.some(m=>m.kind==='new') ? html`<p>البنود المقترحة بلا درجات متغيرة لن تُنشأ.</p>` : ''}
    <div class="grade-transfer__scroll" tabindex="0" role="region" aria-label="جدول الطلاب والدرجات"><table data-roster-preview><thead><tr><th scope="col">الطالب</th><th scope="col">الحالة</th>${columns.map(c=>html`<th scope="col">${c.name} / ${c.max}</th>`)}</tr></thead><tbody>
      ${rows.slice(page*10,page*10+10).map(r=>html`<tr><th scope="row">${r.name}</th><td>${r.status==='new'?'جديد':r.status==='existing'?'موجود':'يحتاج مراجعة'}</td>${columns.map(c=>{const e=grades.entries.find(e=>e.row===r.row&&e.item===c.name);return html`<td>${!e || e.value===null || e.old===e.value ? '—' : html`${e.old===null?'':`${e.old} ← `}${e.value}${e.capped?html` (الأصل ${e.original})`:''}`}</td>`;})}</tr>`)}
    </tbody></table></div>
    ${pages>1 ? html`<nav aria-label="صفحات معاينة الطلاب"><button class="btn btn--quiet" data-act="roster-page" data-page="${page-1}" ${page===0?'disabled':''}>السابق</button><span role="status">${page+1} / ${pages} · ${rows.length} طالبًا</span><button class="btn btn--quiet" data-act="roster-page" data-page="${page+1}" ${page===pages-1?'disabled':''}>التالي</button></nav>`:''}
    ${grades?.capped ? html`<p role="status">حُدّت ${grades.capped} قيمة إلى العظمى؛ الأصل والمقترح ظاهران في الجدول.</p>`:''}
  </section>`;
}
const accessible = () => store.teachings().filter(row => { try { store.assertClassOperationsAccess(row.id); return true; } catch { return false; } }).sort((a,b) => Number(isDemo(a)) - Number(isDemo(b)) || compareAcademicClasses(store.getSection(a.sectionId),store.getSection(b.sectionId)));
const teachingLabel = row => `${sectionLabel(store.getSection(row.sectionId))} · ${store.getSubject(row.subjectId)?.name ?? ''} · ${store.getYear(store.getSection(row.sectionId)?.yearId)?.label ?? ''} · ${store.getTerm(row.termId)?.name ?? ''}`;
// Presentation only: full teachingLabel remains in the workbook export context.
const shortTeachingLabel = row => `${sectionLabel(store.getSection(row.sectionId))} · ${store.getSubject(row.subjectId)?.name ?? ''}`;
const filenameTeachingLabel = row => {
  const section = store.getSection(row.sectionId);
  return `${gradeLabel(section?.grade)} ${section?.label ?? ''} · ${store.getSubject(row.subjectId)?.name ?? ''}`;
};
// AI: every entry uses this hub; legacy per-teaching URLs only redirect context.
function contextRoute(p = {}) {
  const request = new URLSearchParams(location.hash.split('?')[1]);
  const id = p.id || request.get('teaching');
  if (p.id) {
    const query = new URLSearchParams({ teaching: p.id });
    if (p.export === '1') query.set('tab', 'export');
    go('/classes/koshoof?' + query, { replace: true });
  }
  if (hub.route === location.hash) return;
  hub.route = location.hash;
  hub.tab = request.get('tab') === 'export' || p.export === '1' ? 'export' : 'import';
  hub.kind = location.hash.split('?')[0] === '#/classes/import' || request.get('new') === '1' ? 'new' : 'existing';
  // Preserve an explicit request through temporary denial; a new context-free
  // entry must not inherit a stale class from a previous visit.
  // Rendering and handlers still require the original access guard.
  if (hub.fileFlow) { transfer = emptyTransfer(); draft = {}; }
  hub.fileFlow = true;
  hub.existing = id || '';
  hub.selected = new Set(hub.existing ? [hub.existing] : []);
  restoreRosterContinuation();
  const current = transfer; rosterRecovery(current.created?.teachingId).then(rows=>{if(transfer === current){current.recovery=rows;repaint();}});
}
const locked = () => draft.busy || transfer.busy || transfer.writing;
function tabs() {
  return html`<nav class="koshoof-modes" aria-label="مهام الكشوف">${['import','export'].map(tab => html`<button class="btn ${hub.tab === tab ? 'btn--primary' : 'btn--quiet'}" data-act="koshoof-tab" data-tab="${tab}" aria-pressed="${hub.tab === tab ? 'true' : 'false'}" ${locked() ? 'disabled' : ''}>${tab === 'import' ? 'استيراد' : 'تصدير'}</button>`)}</nav>`;
}
function existingPane() {
  if (!hub.existing || !canOpenKoshoof({ id: hub.existing })) { return ''; }
  transfer.panel = 'import';
  return transferPanel(hub.existing);
}
export const koshoofCenter = {
  title: () => 'استيراد وتصدير الكشوف', back, onMount: focus,
  onUnmount() { transfer.cancelled=true;transfer.stopWait?.();hub.route = null; closeTeacherSetupImport(); closeTeacherSetupImport = () => {}; clearExtensionPreview(); },
  render(p = {}) {
    bind(); const denial = allowed(); if (denial) { bindTransfer(null); return classAccessFeedback(p.id ? p : {}) || unavailable(denial); }
    contextRoute(p);
    const list = accessible(), ids = new Set(list.map(row => row.id));
    hub.selected = new Set([...hub.selected].filter(id => ids.has(id)));
    if (hub.existing && !ids.has(hub.existing)) {
      bindTransfer(null);
      return classAccessFeedback({ id: hub.existing });
    }
    return html`<div class="management-page class-import-page" role="region" aria-label="استيراد وتصدير الكشوف" tabindex="-1">
      ${tabs()}
      ${hub.tab === 'import' ? html`${directExtensionEntry()}${rosterFilePane(list)}` : html`
      <section aria-label="تصدير الكشوف">
        <label><input type="checkbox" data-koshoof-all ${list.length && hub.selected.size === list.length ? 'checked' : ''} ${!list.length ? 'disabled' : ''}> تحديد الكل</label>
        <div class="koshoof-selection">${list.map(row => html`<label><input type="checkbox" data-koshoof-class value="${row.id}" ${hub.selected.has(row.id) ? 'checked' : ''}> ${shortTeachingLabel(row)}</label>`)}</div>
        <p role="status">الفصول المحددة: ${hub.selected.size}</p>
        <label class="field"><span>محتوى الكشوف</span><select class="select" data-koshoof-content><option value="names" ${hub.namesOnly ? 'selected' : ''}>أسماء فقط</option><option value="grades" ${!hub.namesOnly ? 'selected' : ''}>أسماء ودرجات</option></select></label>
        <p>ملف Excel مستقل لكل فصل. قد يطلب المتصفح السماح بتنزيلات متعددة.</p>
        <button class="btn btn--primary" data-act="koshoof-export" ${hub.selected.size ? '' : 'disabled'}>تنزيل الكشوف المحددة</button>
        <p role="status">${hub.message ?? ''}</p>

        ${hub.selected.size === 1 ? noorPane([...hub.selected][0]) : ''}
      </section>`}
    </div>`;
  },
  afterPaint(root) {
    focus(root);
    if (root.querySelector('[data-class-access-status]')) return;
    if (hub.tab === 'import') void receiveExtension();
    const listen = (selector, handler) => root.querySelectorAll(selector).forEach(el => { if (el.dataset.bound) return; el.dataset.bound = 'true'; el.addEventListener('change', handler); });
    listen('[data-n36-batch-map]',async event=>{
      if(automaticWriting)return;
      const p=store.state.device?.n36NamesBatch;if(!p?.pending||p.ownerId!==store.getActiveWorkspace()?.authUserId)return;
      try{
       automaticBatch={id:p.batchId,binding:extensionOwnerBinding(),session:cloud.session,year:p.yearId,term:p.termId,yearState:JSON.stringify(store.activeYear()),termState:JSON.stringify(store.activeTerm()),expires:Date.now()+1800000};
       await batchCheckpoint(automaticBatch,current=>({...current,classMappings:{...current.classMappings,[event.target.dataset.classroom]:event.target.value}}));
       extensionMessage='حُفظت مطابقة الفصل لهذه الدفعة فقط. اضغط الاستكمال للتحقق والحفظ.';
      }catch(error){extensionMessage='تعذّر اعتماد المطابقة: '+error.message;}repaint();
    });
    listen('[data-import-kind]', event => { if (!locked()) { hub.kind = event.target.value; resetDestination(); repaint(); } });
    listen('[data-existing-class]', event => { if (!locked()) { hub.existing = event.target.value; if(!transfer.rows)hub.kind='existing'; resetDestination(); repaint(); } });
    listen('[data-roster-field]', event => { if (!locked() && !draft.review) { draft.manual ??= {}; draft.manual[event.target.dataset.rosterField] = event.target.value; } });
    listen('[data-roster-subject]', event => { if (!locked() && !draft.review) { draft.manual ??= {};draft.customSubject=event.target.value==='custom';draft.manual.subject=draft.customSubject?'':event.target.value;repaint(); } });
    const invalidate = () => { hub.message = ''; };
    listen('[data-koshoof-class]', event => { event.target.checked ? hub.selected.add(event.target.value) : hub.selected.delete(event.target.value); invalidate(); repaint(); });
    listen('[data-koshoof-all]', event => { hub.selected = new Set(event.target.checked ? accessible().map(row => row.id) : []); invalidate(); repaint(); });
    listen('[data-koshoof-content]', event => { hub.namesOnly = event.target.value !== 'grades'; invalidate(); repaint(); });
  },
  actions: {
    ...classImport.actions,
    async 'n36-batch-resume'(){
      if(automaticWriting)return;
      const p=store.state.device?.n36NamesBatch;if(!p?.pending||p.ownerId!==store.getActiveWorkspace()?.authUserId)return;
      try{
       // Fresh explicit resume, never automatic continuation into a switched account/session.
       automaticBatch={id:p.batchId,binding:extensionOwnerBinding(),session:cloud.session,year:p.yearId,term:p.termId,yearState:JSON.stringify(store.activeYear()),termState:JSON.stringify(store.activeTerm()),expires:Date.now()+1800000};
       for(const pending of Object.values(p.pending))await saveAutomaticNames({envelope:{version:2,batchId:p.batchId,...pending}});
      }catch(error){extensionMessage='الدفعة محفوظة ولم يتأكد اكتمالها: '+error.message;}repaint();
    },
    'roster-page'(el){transfer.page=Number(el.dataset.page);repaint();},
    ...Object.fromEntries(Object.entries(transferActions).map(([name, action]) => [name, (el, ev) => {
      const id = hub.tab === 'export' ? [...hub.selected][0] : hub.existing;
      if (name !== 'grade-file' && !(['grade-mapping','grade-cancel','grade-import-mode','grade-edit-mapping'].includes(name) || hub.kind === 'new' && name === 'grade-review') && !canOpenKoshoof({ id })) { ev?.preventDefault(); bindTransfer(null); repaint(); return; }
      try { if(hub.tab === 'import' && name !== 'grade-file') assertFileCurrent(); return action(el, ev, { id: hub.tab === 'import' && hub.kind === 'new' ? null : id }); }
      catch(error) { transfer.message = error.message; transfer.error = true; repaint(); }
    }])),
    'n36-extension-cancel'() { clearExtensionPreview(); extensionMessage='أُلغي النقل ومُسحت المعاينة.'; repaint(); },
    async 'n36-extension-review'() {
      if(hub.kind !== 'existing') { extensionMessage='نقل الإضافة للأسماء فقط إلى فصل موجود؛ اختر الفصل الموجود أولًا.'; repaint(); return; }
      const pending=extensionPreview,id=hub.existing,route=location.hash;
      try {
        const binding=setupBinding(id);
        if(!pending || extensionOwnerBinding() !== extensionOwner || Date.now() >= pending.envelope.expiresAt) throw Error('STALE');
        const {openTeacherSetupImport}=await import('./teacher-setup-import.js');
        if(extensionPreview!==pending || hub.existing!==id || location.hash!==route || setupBinding(id)!==binding) return;
        closeTeacherSetupImport();
        closeTeacherSetupImport=openTeacherSetupImport({initialBundle:pending.bundle,onOutcome:outcome=>reportHandoffOutcome(pending.request,outcome),onClose:()=>{if(extensionPreview===pending){clearExtensionPreview();repaint();}},sourceNotice:pending.envelope.source==='noor'?'نور: كشف ظاهر جزئي؛ الصفحات والأعمدة الأخرى غير مجمّعة.':'مدرستي: استيراد المتاح فقط؛ قد يكون الكشف ناقصًا ولا يثبت نقل هذه الدفعة اكتماله. طابق فصل المصدر بفصلك المملوك وراجع الأسماء.',
          isContextCurrent:()=>extensionPreview===pending && hub.existing===id && location.hash===route && setupBinding(id)===binding && Date.now()<pending.envelope.expiresAt});
      } catch { clearExtensionPreview();extensionMessage='تغيّر الحساب أو الفصل أو انتهت المعاينة؛ أعد النقل.';repaint(); }
    },
    'koshoof-tab'(el) { if (!locked()) { hub.tab = el.dataset.tab; repaint(); } },
    'koshoof-export'() {
      bind(); if (allowed()) return;
      try {
        const entries = exportEntries();
        const files = classKoshoofBundle(entries, hub.namesOnly);
        let attempted = 0, failed = 0;
        // Fresh guarded snapshot; request every selected independent XLSX in this gesture.
        for (const file of files) {
          try { downloadKoshoofBundle(file); attempted++; } catch { failed++; }
        }
        hub.message = `طُلب تنزيل ${attempted} من ${files.length} ملف Excel${failed ? `؛ تعذّر طلب ${failed}` : ''}. تحقق من تنزيلات المتصفح؛ لا يمكن تأكيد حفظ الملفات.`;
      } catch (error) { hub.message = error.message; }
      repaint();
    },

  },
};
function exportEntries() {
  const list = accessible();
  if (!hub.selected.size || [...hub.selected].some(id => !list.some(row => row.id === id))) throw Error('تغيّر الفصل المتاح. أعد الاختيار.');
  return list.filter(row => hub.selected.has(row.id)).map(row => {
    store.assertClassOperationsAccess(row.id);
    return { ...store.teachingContext(row.id), className: teachingLabel(row), filenameClassName: filenameTeachingLabel(row), subject: store.getSubject(row.subjectId)?.name,
      term: store.getTerm(row.termId)?.name, year: store.activeYear()?.label };
  });
}
function noorPane(id) {
  if (!canOpenKoshoof({ id })) return '';
  bindTransfer(id); transfer.panel = 'export';
  return transferPanel(id);
}
export default koshoofCenter;
