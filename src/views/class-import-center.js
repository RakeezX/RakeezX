import { compareAcademicClasses } from '../lib/class-order.js';
// AI: real local-file entry, shared class selector, no portal login or bulk save.
import { html, confirmSheet, icon, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { isDemo } from '../lib/demo.js';
import { classGroups, detectClassNameColumn } from '../lib/class-import-file.js';
import { GRADES, gradeLabel, sectionLabel } from '../models.js';
import { classKoshoofBundle, downloadKoshoofBundle } from '../lib/class-koshoof-bundle.js';
import { repaint } from '../repaint.js';

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
function resetDestination() {
  draft = {};
  if (!transfer.rows) return;
  const items = hub.kind === 'existing' && hub.existing ? store.teachingContext(hub.existing).items : [];
  Object.assign(transfer, suggestGradeMappings(transfer.rows[0], items, {teachingId:hub.existing,ownerId:workspace?.authUserId}),
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
    // A prospective value review only. Actual identities/revisions are reviewed
    // again after creation and normal Sync; this object is never dispatched.
    proposal = reviewGradeTransfer({...transfer,idColumn:-1,roster:[],items:[],scores:[],
      teaching:{id:'prospective',sectionId:'prospective',termId:review.termId,serverRevision:1},
      term:store.activeTerm(),ownerId:workspace.authUserId,databaseName:workspace.databaseName,allowNewStudents:true,
      newStudentIds:Object.fromEntries(transfer.rows.slice(1).map((_,i)=>[i+2,{id:`prospective-${i}`,enrollmentId:`prospective-enrollment-${i}`}]))});
    if (proposal.rejected.length) throw Error(proposal.rejected.map(r=>`صف ${r.row}: ${r.reason}`).join('؛ '));
  }
  draft.review = review; draft.proposal = proposal; draft.message = ''; transfer.message = '';
}
function rosterFilePane(list) {
  const immutable = locked() || !!draft.review || !!transfer.created || !!transfer.recovery.length;
  transfer.panel = 'import';
  return html`<section class="card card--pad" data-roster-file-flow><h3>استيراد كشف طلاب</h3>
    <label class="field"><span>${transfer.rows ? html`الملف المحدد: ${transfer.fileName}` : 'اختر الكشف من جهازك'}</span><input class="input" type="file" accept=".csv,.xlsx" style="${transfer.rows ? 'display:none' : ''}" data-change="grade-file" ${immutable ? 'disabled' : ''}></label>
    <p class="grade-transfer__hint">CSV أو XLSX بعناوين أعمدة · حتى 300 طالب و1 MB. قراءة ومراجعة قبل أي حفظ؛ الفراغ لا يغيّر الدرجة والصفر يُرصد.</p>
    ${!transfer.rows && extensionPreview ? html`<label class="field"><span>فصل موجود لاستقبال أسماء الإضافة فقط</span><select class="select" data-existing-class><option value="">اختر الفصل</option>${list.map(row=>html`<option value="${row.id}" ${hub.existing === row.id ? 'selected' : ''}>${teachingLabel(row)}</option>`)}</select></label>` : ''}
    ${transfer.rows ? html`<label class="field"><span>وجهة الاستيراد</span><select class="select" data-import-kind ${immutable ? 'disabled' : ''}><option value="existing" ${hub.kind === 'existing' ? 'selected' : ''}>فصل موجود</option><option value="new" ${hub.kind === 'new' ? 'selected' : ''}>إنشاء فصل جديد</option></select></label>
    ${hub.kind === 'new' ? html`<div class="class-import-manual" data-roster-create>
      <label class="field"><span>الصف</span><select class="select" data-roster-field="grade" ${immutable ? 'disabled' : ''}><option value="">اختر الصف</option>${GRADES.map(g=>html`<option value="${g.v}" ${String(draft.manual?.grade) === String(g.v) ? 'selected' : ''}>${g.label}</option>`)}</select></label>
      <label class="field"><span>رمز الفصل</span><input class="input" maxlength="8" data-roster-field="label" value="${draft.manual?.label ?? ''}" ${immutable ? 'disabled' : ''}></label>
      <label class="field"><span>المادة</span><select class="select" data-roster-field="subject" ${immutable ? 'disabled' : ''}><option value="">اختر المادة</option>${store.subjectOptions().map(o=>html`<option value="${o.name}" ${draft.manual?.subject === o.name ? 'selected' : ''}>${o.name}</option>`)}</select></label>
    </div>` : html`<label class="field"><span>الفصل والمادة</span><select class="select" data-existing-class aria-label="الفصل الموجود" ${immutable ? 'disabled' : ''}><option value="">اختر الفصل</option>${list.map(row=>html`<option value="${row.id}" ${hub.existing === row.id ? 'selected' : ''}>${teachingLabel(row)}</option>`)}</select></label>`}
    <div class="segmented grade-transfer__modes" role="group" aria-label="محتوى الكشف">${['names','grades'].map(mode=>html`<button class="segmented__btn ${transfer.importMode === mode ? 'is-on' : ''}" data-act="grade-import-mode" data-mode="${mode}" aria-pressed="${transfer.importMode === mode}" ${immutable ? 'disabled' : ''}>${mode === 'names' ? 'أسماء فقط' : 'أسماء ودرجات'}</button>`)}</div>
    ${transfer.created ? html`<p data-roster-partial role="status">حُفظ الفصل والمادة و${transfer.created.added} من الأسماء. ${transfer.successTeaching ? 'تأكد إيصال الدرجات.' : 'الدرجات معلقة حتى مراجعتها وتأكيد إيصالها؛ لن يعاد إنشاء الفصل أو الطلاب.'}</p>` : ''}
    ${hub.kind === 'new' ? transferPanel(null) : existingPane()}
    ${draft.proposal && !transfer.created ? html`<section data-roster-proposed-grades><h4>الدرجات المقترحة — لم تُحفظ</h4><p>سيُحفظ الفصل والمادة والأسماء أولًا. بعد المزامنة ستراجع الدرجات على هويات الطلاب المحفوظة وتؤكدها مرة أخرى دون رفع الملف.</p>
      <ul>${draft.proposal.entries.map(e=>html`<li>صف ${e.row} · ${e.student} · ${e.item} / ${e.max}: ${e.value === null ? 'فارغ؛ دون تغيير' : e.value}${e.capped ? html` (الأصل ${e.original}؛ حُدّت للعظمى)` : ''}</li>`)}</ul></section>` : ''}
    ${draft.review && (!transfer.created || transfer.importMode === 'names') ? reviewed() : ''}
    <p role="status">${draft.message ?? ''}</p>` : html`${hub.existing ? existingPane() : html`<p role="status">${transfer.message}</p>`}`}
  </section>`;
}

let closeTeacherSetupImport = () => {};
let setupRequest = 0;
let extensionPreview = null, extensionOwner = null, extensionBusy = false, extensionMessage = '', extensionTimer;
function extensionOwnerBinding() {
  store.assertClassImportAccess();
  const w = store.getActiveWorkspace(), access = runtimeSyncOwnershipGuard.cloudAccess({operation:'preview',authenticatedUserId:cloud.user?.id});
  if (!store.state.ready || w?.type !== 'account' || !cloud.session || cloud.session.user?.id !== cloud.user?.id ||
      cloud.authStatus().state !== 'authenticated' || !access.allowed || access.workspaceOwnerId !== w.authUserId) throw Error('OWNER');
  store.assertLeaseWritable();
  return JSON.stringify([w.authUserId,w.id,w.databaseName,w.leaseGeneration]);
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
    <p>ثبّت الإضافة لمتصفح كروم، وسجّل دخولك إلى منصة مدرستي، ثم شغّل الإضافة لجلب أسماء الطلاب وبيانات فصولهم المتاحة. راجع البيانات وأكّد حفظها في ركيز.</p>
    <a class="btn btn--primary" href="/assets/extensions/rakeez-teacher-import-helper-0.5.9.zip" download>تنزيل إضافة ركيز 0.5.9</a>
    <details><summary>طريقة التثبيت</summary><ol>
      <li>فك ضغط الحزمة في مجلد واحد مخصص للإضافة.</li>
      <li>من صفحة إضافات Chrome، فعّل وضع المطوّر واختر «تحميل إضافة غير مضغوطة»، ثم اختر المجلد.</li>
      <li>عند تحديث ملفات الإضافة في المجلد نفسه، اضغط «إعادة تحميل» في صفحة الإضافات.</li>
    </ol></details>
    ${extensionPreview ? html`<p role="status">${extensionPreview.envelope.source === 'noor' ? 'نور — عمود ظاهر مختار؛ صفحات وأعمدة أخرى غير مجمّعة' : 'مدرستي — الأسماء التي راجعتها في الإضافة فقط'} · ${extensionPreview.envelope.rows.length} اسمًا. اختر الفصل والمادة أدناه.</p><button class="btn btn--primary" data-act="n36-extension-review" ${!hub.existing || hub.kind === 'new' ? 'disabled' : ''}>مراجعة أسماء الإضافة</button><button class="btn btn--quiet" data-act="n36-extension-cancel">إلغاء ومسح النقل</button>` : ''}
    <p role="status" data-n36-handoff-status>${extensionBusy ? 'جار استلام المعاينة المؤقتة…' : extensionMessage}</p>
  </section>`;
}
async function receiveExtension() {
  let request; try { request=handoffRequest(); } catch { extensionMessage='رابط النقل غير صالح. أعد النقل من الإضافة أو استخدم الخيارات المتقدمة.'; history.replaceState(null,'','#/classes/koshoof?import=1'); repaint(); return; }
  if(!request || extensionBusy)return;
  let owner; try { owner=extensionOwnerBinding(); } catch { return; }
  const route=location.hash;
  extensionBusy=true; clearExtensionPreview();
  try {
    const result=await claimHandoff(request);
    if(location.hash !== route || extensionOwnerBinding() !== owner) throw Error('OWNER_CHANGED');
    extensionPreview=result; extensionOwner=owner; extensionMessage='استُلمت المعاينة لمرة واحدة دون حفظ. تنتهي بعد دقيقتين من إرسالها.';
    extensionTimer=setTimeout(()=>{clearExtensionPreview();extensionMessage='انتهت المعاينة. أعد النقل من الإضافة أو استخدم الخيارات المتقدمة.';repaint();},Math.max(0,result.envelope.expiresAt-Date.now()));
  } catch { extensionMessage='تعذّر النقل: الإضافة غير متاحة أو انتهت الصلاحية أو تغيّر الحساب. أعد النقل أو استخدم الخيارات المتقدمة.'; }
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
  const { items } = teachingId ? store.teachingContext(teachingId) : { items: [] };
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
  const mappingSummary = html`<div data-grade-mapping-summary>
        <p>اسم الطالب: ${opts[transfer.nameColumn] ?? 'يلزم اختيار العمود'}${transfer.idColumn >= 0 ? html` · المعرف: ${opts[transfer.idColumn]}` : ''}</p>
        ${transfer.importMode !== 'names' ? html`<p class="grade-transfer__hint">بنود يدوية مرتبطة: ${transfer.mappings.filter(m => m.kind === 'existing').length} · آلية / قراءة فقط متجاهلة: ${transfer.reasons?.filter(r => r === 'readonly').length ?? 0} · تحتاج مراجعة: ${transfer.mappings.filter((m,c) => m.kind === 'new' || transfer.reasons?.[c] === 'exception' && m.kind === 'ignore').length}</p>` : ''}
        ${transfer.importMode !== 'names' ? html`<p class="grade-transfer__hint">الأعمدة المختارة: ${opts.filter((v,c)=>transfer.mappings[c]?.kind !== 'ignore').join('، ') || 'لا شيء'} · المتجاهلة: ${opts.filter((v,c)=>![transfer.nameColumn,transfer.idColumn].includes(c) && transfer.mappings[c]?.kind === 'ignore').join('، ') || 'لا شيء'}</p>` : ''}
        ${transfer.reasons?.includes('metadata') ? html`<p class="grade-transfer__hint">تُتجاهل بيانات الفصل والمادة ونوع الملف.</p>` : ''}
      </div>`;
  return html`<div class="grade-transfer noprint" data-grade-transfer ${!transfer.panel ? 'hidden' : ''}>
    ${transfer.panel === 'import' ? html`<section id="grade-import-panel" data-grade-import-panel aria-label="استيراد الكشوف" ${transfer.panel !== 'import' ? 'hidden' : ''}>
    <div class="grade-transfer__heading"><h3>مراجعة الكشف</h3></div>
    <div data-roster-review-controls>
    ${store.getActiveWorkspace()?.type === 'account' ? html`<details class="grade-transfer__school"><summary>خيارات مدرستي المتقدمة</summary>
      <button class="btn btn--quiet" type="button" data-act="teacher-setup-import" aria-describedby="school-import-hint">${icon('upload')} بيانات مدرستي</button>
      <span id="school-import-hint" class="grade-transfer__hint">حزمة JSON محلية · أسماء بتأكيدك لفصل واحد، وبقية الفئات للقراءة · دون اتصال مباشر بمدرستي</span>
    </details>` : ''}
    ${!hub.fileFlow ? html`<div class="segmented grade-transfer__modes" role="group" aria-label="نوع الاستيراد">
      ${['names','grades'].map(value => html`<button type="button" class="segmented__btn ${transfer.importMode === value ? 'is-on' : ''}" data-act="grade-import-mode" data-mode="${value}" data-fk="grade-import-${value}" aria-pressed="${transfer.importMode === value ? 'true' : 'false'}" ${transfer.busy ? 'disabled' : ''}>${value === 'names' ? 'أسماء فقط' : 'أسماء ودرجات'}</button>`)}
    </div>` : ''}
    ${!transfer.rows && !hub.fileFlow ? html`<button class="btn grade-transfer__template" data-act="grade-template">تنزيل نموذج أسماء فارغ</button><label class="grade-transfer__file">اختر الكشف <input class="input" type="file" accept=".csv,.xlsx" data-change="grade-file" ${transfer.busy ? 'disabled' : ''}></label>
      <p class="grade-transfer__hint">CSV أو XLSX بعناوين أعمدة · حتى 300 طالب و1 MB · الفراغ لا يغيّر الدرجة والصفر يُرصد.</p>` : ''}
    ${transfer.busy && !transfer.writing ? html`<button class="btn" data-act="grade-cancel">إلغاء القراءة</button>` : ''}
    ${transfer.rows ? html`<p data-grade-file-name>${transfer.fileName}</p>
      ${review || draft.review ? html`<details data-grade-reviewed-mapping><summary>مطابقة الأعمدة</summary>${mappingSummary}</details>` : mappingSummary}
      ${!review && (!draft.review || transfer.created) ? html`<details data-grade-mapping-details ${transfer.editMapping || transfer.nameColumn < 0 || transfer.importMode !== 'names' && transfer.reasons?.some(r => ['exception','proposal'].includes(r)) ? 'open' : ''}>
      <summary>تعديل المطابقة${transfer.importMode !== 'names' && transfer.reasons?.some(r => ['exception','proposal'].includes(r)) ? ' — أعمدة تحتاج مراجعة أو تجاهل' : ''}</summary><div class="grade-transfer__mapping">
      <div class="grade-transfer__identity">
      <label class="grade-transfer__field">عمود اسم الطالب <select class="input" data-grade-name data-change="grade-mapping" data-fk="grade-name"><option value="-1">اختر العمود</option>${opts.map((v,c) => html`<option value="${c}" ${transfer.nameColumn === c ? 'selected' : ''}>${c+1}: ${v}</option>`)}</select></label>
      <label class="grade-transfer__field">معرف ركيز الثابت (اختياري) <select class="input" data-grade-id data-change="grade-mapping" data-fk="grade-id" ${transfer.created ? 'disabled' : ''}><option value="-1">مطابقة الاسم الفريد في الفصل</option>${opts.map((v,c) => html`<option value="${c}" ${transfer.idColumn === c ? 'selected' : ''}>${c+1}: ${v}</option>`)}</select></label>
      </div>
      ${opts.map((v,c) => {
        if (transfer.importMode === 'names') return '';
        if ([transfer.nameColumn,transfer.idColumn].includes(c) || ['metadata','readonly'].includes(transfer.reasons?.[c])) return '';
        const m = transfer.mappings[c] ?? { kind: 'ignore' };

        return html`<div class="grade-transfer__column" data-grade-column="${c}"><label for="grade-column-${c}">${c+1}: ${v}</label>
          ${transfer.reasons?.[c] === 'exception' && m.kind === 'ignore' ? html`<p class="grade-transfer__hint">لم تُطابق هذه الدرجة؛ اختر بندًا أو اتركها للتجاهل.</p>` : ''}
          <select id="grade-column-${c}" class="input" data-grade-kind data-change="grade-mapping" data-fk="grade-column-${c}">
            <option value="ignore" ${m.kind === 'ignore' ? 'selected' : ''}>تجاهل</option>
            ${items.filter(isTransferItem).map(i => html`<option value="${i.id}" ${m.itemId === i.id ? 'selected' : ''}>${i.name} — العظمى ${i.max}</option>`)}
            <option value="new" ${m.kind === 'new' ? 'selected' : ''}>إنشاء بند يدوي مسمّى صراحة</option>
          </select>
          ${m.kind === 'new' ? html`<label>اسم البند <input class="input" data-grade-new-name data-fk="grade-new-name-${c}" maxlength="50" value="${m.name ?? ''}" data-change="grade-mapping"></label>
            <label>العظمى <input class="input" data-grade-new-max data-fk="grade-new-max-${c}" inputmode="decimal" value="${m.max ?? ''}" data-change="grade-mapping"></label>
            <label><input type="checkbox" data-grade-new-confirm data-fk="grade-new-confirm-${c}" data-change="grade-mapping" ${m.confirmed ? 'checked' : ''}> أؤكد إنشاء هذا البند بهذه العظمى</label>` : ''}
        </div>`;
      })}

      </div></details>` : html`<button class="btn" data-act="grade-edit-mapping" ${transfer.busy || draft.review && !transfer.created ? 'disabled' : ''}>تعديل المطابقة</button>`}
      ${!review && (!draft.review || transfer.created) ? html`<button class="btn btn--primary" data-act="grade-review" ${transfer.busy || transfer.recovery.length ? 'disabled' : ''}>مراجعة الاستيراد</button>` : ''}
      <button class="btn" data-act="grade-cancel" ${transfer.writing ? 'disabled' : ''}>إلغاء</button>
    ` : ''}
    ${review && transfer.importMode === 'names' ? html`<div data-grade-review><p>أسماء جديدة ${review.counts.new}، موجودة ${review.counts.existing}، تحتاج مراجعة ${review.counts.invalid + review.counts.ambiguous}.</p><ul>${review.entries.map(e => html`<li>${e.name} — ${e.status === 'new' ? 'إضافة جديدة' : e.status === 'existing' ? 'موجود؛ لن يتكرر' : 'يحتاج مراجعة؛ لن يضاف'}</li>`)}</ul><label><input type="checkbox" data-grade-match-confirm> راجعت الأسماء الجديدة التي ستضاف</label><p class="grade-transfer__notice" data-grade-confirm-alert role="alert" hidden></p><button class="btn btn--primary" data-act="grade-confirm" ${transfer.busy || !review.names.length ? 'disabled' : ''}>تأكيد الأسماء</button></div>` : ''}
    ${review && transfer.importMode !== 'names' ? html`<div data-grade-review><p>إضافات ${review.additions}، استبدالات ${review.overwrites}، دون تغيير ${review.unchanged}، أخطاء ${review.rejected.length}.</p>
      ${review.capped ? html`<p class="grade-transfer__notice" role="status">حُدّت ${review.capped} قيمة إلى العظمى الحالية؛ راجع الأصل والمقترح.</p>` : ''}
      ${review.newStudents.length ? html`<p>سيُضاف ${review.newStudents.length} طالبًا بانتساب جديد إلى هذا الفصل مع الدرجات في دفعة واحدة:</p><ul>${review.newStudents.map(e => html`<li>${e.name} — إضافة جديدة</li>`)}</ul><label><input type="checkbox" data-grade-enroll-confirm> أؤكد إضافة هؤلاء الطلاب الجدد إلى الفصل</label>` : ''}
      <div class="grade-transfer__scroll"><table><thead><tr><th>صف</th><th>الطالب</th><th>البند / العظمى</th><th>الحالي ← المقترح</th></tr></thead><tbody>
        ${review.entries.filter(e => e.value !== null && e.value !== e.old).map(e => html`<tr><td>${e.row}</td><td>${e.student}</td><td>${e.item} / ${e.max}</td><td>${e.old ?? 'فارغ'} ← ${e.value}${e.capped ? html` · <b dir="ltr">${e.original}→${e.value}</b> (حُدّت للعظمى)` : ''}</td></tr>`)}
      </tbody></table></div>
      ${transfer.rows.slice(1).map((row,index) => {
        const roster = store.teachingContext(teachingId).roster;
        const candidates = roster.filter(s => gradeNameKey(s.name) === gradeNameKey(row[transfer.nameColumn]));
        if (candidates.length < 2 || transfer.idColumn >= 0 && row[transfer.idColumn]) return '';
        const choice = transfer.studentChoices?.[index+2];
        return html`<div class="grade-transfer__column"><label>صف ${index+2}: ${row[transfer.nameColumn]} — اختر الطالب في هذا الفصل
          <select class="input" data-grade-student-row="${index+2}" data-fk="grade-student-${index+2}" data-change="grade-student-choice" ${transfer.busy?'disabled':''}><option value="">اختر الطالب؛ لا مطابقة تلقائية</option>${candidates.map((s,i)=>html`<option value="${i}" ${choice?.studentId===s.id?'selected':''}>${s.name} — رقم الكشف ${s.displayNo ?? roster.indexOf(s)+1}</option>`)}</select></label>
          <label><input type="checkbox" data-grade-student-confirm="${index+2}" data-fk="grade-student-confirm-${index+2}" data-change="grade-student-choice" ${choice?.confirmed?'checked':''} ${!choice || transfer.busy?'disabled':''}> أؤكد مطابقة هذا الصف مع الطالب المختار</label></div>`;
      })}
      ${review.rejected.map(e => html`<p role="alert">صف ${e.row} · ${e.student}${e.item ? html` · ${e.item} · القيمة ${e.value} · العظمى ${e.max}` : ''}: ${e.reason}</p>`)}
      ${review.unchanged ? html`<details data-grade-unchanged><summary>دون تغيير (${review.unchanged})</summary><ul>${review.entries.filter(e => e.value === null || e.value === e.old).map(e => html`<li>صف ${e.row} · ${e.student} · ${e.item}: ${e.old ?? 'فارغ'} ← ${e.value ?? 'فراغ؛ لا تغيير'}${e.capped ? html` · <b dir="ltr">${e.original}→${e.value}</b> (حُدّت للعظمى)` : ''}</li>`)}</ul></details>` : ''}
      ${review.rejected.length ? html`<p>صحّح الأخطاء قبل التأكيد؛ لم تتغير أي درجة.</p>` : !review.cells.length && !review.newStudents?.length ? html`<p>لا توجد درجات متغيرة لتأكيدها.</p>` : html`<label><input type="checkbox" data-grade-match-confirm> راجعت هوية الطلاب والمطابقة والدرجات المعروضة</label>
      ${review.overwrites ? html`<label><input type="checkbox" data-grade-overwrite-confirm> أوافق على استبدال ${review.overwrites} درجة بالقيم المعروضة</label>` : ''}`}
      <p class="grade-transfer__notice" data-grade-confirm-alert role="alert" hidden></p><button class="btn btn--primary" data-act="grade-confirm" ${transfer.busy || transfer.recovery.length || review.rejected.length || !review.cells.length && !review.newStudents?.length ? 'disabled' : ''}>تأكيد الأسماء والدرجات</button>
    </div>` : ''}
    ${transfer.message ? html`<p class="grade-transfer__message ${transfer.error ? 'is-error' : ''}" role="${transfer.error ? 'alert' : 'status'}">${transfer.message}</p>` : ''}
    ${transfer.successTeaching && !transfer.error ? html`<a class="btn btn--quiet" href="#/teaching/${transfer.successTeaching}">فتح الفصل</a>` : ''}
    ${transfer.recovery.map(r => html`<p role="alert">طلب محفوظ: ${r.mutationId} — ${r.state === 'rejected' ? 'مرفوض، يلزم تصحيح سبب الرفض قبل دفعة جديدة' : 'لم يتأكد الإيصال بعد؛ أعد الطلب نفسه فقط'}
      ${r.state !== 'rejected' ? html`<button class="btn" data-act="grade-retry" data-mutation="${r.mutationId}" ${transfer.busy ? 'disabled' : ''}>استعادة إيصال الطلب نفسه</button>`
        : html`<label><input type="checkbox" data-grade-retire-confirm> أفهم أن الدفعة رُفضت بالكامل وأريد إلغاء هذا الطلب المرفوض مع حفظ سببه</label><button class="btn" data-act="grade-retire" data-mutation="${r.mutationId}">إلغاء الطلب المرفوض وحفظ الرفض</button>`}</p>`)}
    </div></section>
    ` : html`<section id="grade-export-panel" data-grade-export-panel aria-label="تصدير الكشوف" ${transfer.panel !== 'export' ? 'hidden' : ''}>
    <details data-noor-grouping ${transfer.noorOpen ? 'open' : ''}><summary>تصدير كشف نور <bdi dir="ltr">40 / 60</bdi></summary>
    <div class="grade-transfer__chips" role="group" aria-label="بنود كشف نور">${items.map(i => html`<label><input type="checkbox" data-change="grade-export-selection" data-grade-export-item value="${i.id}" ${!transfer.exportItems || transfer.exportItems.has(i.id) ? 'checked' : ''}> ${i.name} / ${i.max}</label>`)}</div>
    <p class="grade-transfer__hint">40: المهام الأدائية والمشاركة والتفاعل.</p><p class="grade-transfer__hint">60: تقويمات تحريرية وتطبيقات عملية.</p>
    ${selectedItems.map(i => html`<div class="grade-transfer__noor-row"><label for="noor-${i.id}">${i.name} <small> / ${i.max}</small></label><select id="noor-${i.id}" class="input" aria-label="مجموعة ${i.name}" data-noor-item="${i.id}" data-fk="grade-noor-${i.id}" data-change="grade-noor-group"><option value="">اختر</option>${['40','60'].map(group => html`<option value="${group}" ${(transfer.noorGroups?.[i.id] ?? suggestNoorGroup(i)) === group ? 'selected' : ''}>${group}</option>`)}</select></div>`)}
    <p data-noor-totals role="status">مجموع العظمى: 40 ← ${groupTotal('40')} · 60 ← ${groupTotal('60')}</p>
    <p data-noor-alert role="alert" hidden></p><label><input type="checkbox" data-noor-confirm> أؤكد تعيين البنود المختارة؛ مجموع العظمى 40 و60 دون تكرار أو تحجيم</label>
    <p class="grade-transfer__hint">أي مجموعة فيها درجة غير مسجلة تبقى فارغة. ثلاثة أعمدة للرصد اليدوي فقط، ليس للرفع المباشر.</p>
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
    if (value !== 'new') { mappings[c] = {kind:'existing',itemId:value}; continue; }
    const prior = transfer.mappings[c];
    mappings[c] = {kind:'new',id:prior?.kind === 'new' ? prior.id : crypto.randomUUID(),name:el.querySelector('[data-grade-new-name]')?.value ?? '',
      max:el.querySelector('[data-grade-new-max]')?.value ?? '',confirmed:el.querySelector('[data-grade-new-confirm]')?.checked ?? false};
  }
  [transfer.nameColumn, transfer.idColumn].forEach(c => { if (c >= 0) mappings[c] = {kind:'ignore'}; });
  transfer.mappings = mappings;
}

async function transferConfirm(el, retry = false) {
  const root = el.closest('[data-grade-transfer]');
  const current = transfer;
  if (!root?.isConnected || transfer.busy || !retry && transfer.recovery.length || !retry && (!transfer.review || transfer.review.rejected?.length || !transfer.review.cells?.length && !transfer.review.names?.length && !transfer.review.newStudents?.length)) return;
  if (!retry && (!root.querySelector('[data-grade-match-confirm]')?.checked || transfer.review?.overwrites && !root.querySelector('[data-grade-overwrite-confirm]')?.checked || transfer.review?.newStudents?.length && !root.querySelector('[data-grade-enroll-confirm]')?.checked)) {
    const alert = root.querySelector('[data-grade-confirm-alert]');
    alert.textContent = !root.querySelector('[data-grade-match-confirm]')?.checked ? 'أكد مراجعة هوية الطلاب والقيم المعروضة أولًا.'
      : transfer.review?.newStudents?.length && !root.querySelector('[data-grade-enroll-confirm]')?.checked ? 'أكد إضافة الطلاب الجدد إلى هذا الفصل أولًا.' : 'أكد الموافقة على استبدال الدرجات المعروضة أولًا.';
    alert.hidden = false; return;
  }
  const overwriteConfirmed = root.querySelector('[data-grade-overwrite-confirm]')?.checked ?? false;
  const enrollmentConfirmed = root.querySelector('[data-grade-enroll-confirm]')?.checked ?? false;
  transfer.busy = true; transfer.writing = true; repaint();
  try {
    assertFileCurrent();
    const reviewed = current.review;
    if (retry) await store.retryGradeImport(el.dataset.mutation);
    else if (transfer.importMode === 'names') await store.confirmNamesImport(transfer.review, true);
    else {
      const fresh = store.reviewGradeImport(transfer.review.teachingId, transfer);
      if (JSON.stringify(fresh) !== JSON.stringify(transfer.review)) throw new Error('تغيّرت بيانات المراجعة؛ راجع المطابقة من جديد.');
      await store.confirmGradeImport(transfer.review, { approved: true, overwriteConfirmed, enrollmentConfirmed });
    }
    const teaching = store.getTeaching(reviewed?.teachingId ?? current.created?.teachingId);
    const savedNames = current.created?.added ?? reviewed?.names?.length ?? reviewed?.newStudents?.length ?? 0;
    current.rows = null; current.review = null; current.created = null; draft = {}; current.error = false; current.successTeaching = teaching?.id;
    current.message = teaching ? `${teachingLabel(teaching)} · الأسماء المحفوظة: ${savedNames} · الأسماء المعلقة: 0${reviewed.cells ? ` · الدرجات المحفوظة: ${reviewed.cells.length}` : ''}` : 'تم تأكيد إيصال الطلب المحفوظ.';
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
      noorConfirmed: root.querySelector('[data-noor-confirm]')?.checked }), { noorReview: true, className, filenameClassName: filenameTeachingLabel(teaching) });
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
    async 'teacher-setup-import'(el, ev, params) {
      const request = ++setupRequest, workspace = store.getActiveWorkspace(), route = location.hash;
      try {
        const binding = setupBinding(params.id);
        const { openTeacherSetupImport } = await import('./teacher-setup-import.js');
        if (request !== setupRequest || !el.isConnected || location.hash !== route ||
            store.getActiveWorkspace() !== workspace || setupBinding(params.id) !== binding) return;
        closeTeacherSetupImport();
        closeTeacherSetupImport = openTeacherSetupImport({ isContextCurrent: () =>
          location.hash === route && store.getActiveWorkspace() === workspace && setupBinding(params.id) === binding });
      } catch (error) { toast(error.message); }
    },
    async 'grade-file'(el, ev, params) {
      const prior = transfer;
      if (allowed()) return;
      draft = {}; fileSession = cloud.session;
      const file = el.files?.[0];
      if (!file || prior.writing) return;
      const current = transfer = { ...prior, rows:null, mappings:[], review:null, busy:false, writing:false, successTeaching:null };
      current.busy = true; current.rows = null; current.review = null; current.message = 'جار قراءة الملف محليًا…'; current.error = false; repaint();
      try {
        let rows = await readGradeFile(file);
        const detected = detectClassNameColumn(rows);
        rows = detected.header < 0 ? [['اسم الطالب'], ...rows] : rows.slice(detected.header);
        bind(); if (transfer !== current || fileSession !== cloud.session || allowed()) return;
        transfer.rows = rows; transfer.fileName = file.name; Object.assign(transfer, suggestGradeMappings(rows[0], params.id ? store.teachingContext(params.id).items : [], {teachingId:params.id,ownerId:store.getActiveWorkspace()?.authUserId}));
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
    'grade-edit-mapping'() { if (transfer.busy) return; transfer.review = null; transfer.editMapping = true; repaint(); },
    'grade-export-selection'(el) { transfer.exportOpen = true; transfer.noorOpen = el.closest('[data-grade-transfer]').querySelector('[data-noor-grouping]').open; const confirm = el.closest('[data-grade-transfer]').querySelector('[data-noor-confirm]'); if (confirm) confirm.checked = false; transfer.exportItems = new Set([...el.closest('[data-grade-transfer]').querySelectorAll('[data-grade-export-item]:checked')].map(e => e.value)); repaint(); },
    'grade-review'(el, ev, params) {
      try { assertFileCurrent(); readTransferMappings(el.closest('[data-grade-transfer]')); if (hub.kind === 'new') { reviewNewRoster(); repaint(); return; } transfer.review = transfer.importMode === 'names' ? store.reviewNamesImport(params.id, transfer) : store.reviewGradeImport(params.id, transfer); transfer.message = ''; transfer.error = false; }
      catch (error) { transfer.review = null; transfer.message = error.message === 'GRADE_NEW_ITEM_CONFIRM_REQUIRED' ? 'أكد إنشاء كل بند جديد باسمه وعظماه، أو اختر تجاهله قبل المراجعة.' : error.message === 'GRADE_CONTEXT_INVALID' ? 'بيانات الفصل لم تتأكد بالمزامنة بعد. أكمل المزامنة ثم أعد المراجعة؛ الملف والأعمدة محفوظة.' : error.message === 'GRADE_DUPLICATE_ITEM' ? 'اختر بندًا مختلفًا لكل عمود درجات؛ لا يمكن ربط عمودين بالبند نفسه.' : 'راجع الأعمدة والبنود والعظمى: ' + error.message; transfer.error = true; }
      repaint();
    },
    'grade-cancel'() { if (transfer.writing) return; draft = {}; transfer = { ...emptyTransfer(), recovery:transfer.recovery, message:'أُغلقت مراجعة الملف دون كتابة جديدة. أي بيانات حُفظت سابقًا تبقى محفوظة.' }; repaint(); },
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
  if (focusRoute !== location.hash) { focusRoute = location.hash; root.querySelector('h2')?.focus({ preventScroll: true }); }
}
function reviewed() {
  const review = draft.review, receipt = store.classImportReceipt(review);
  if (!receipt) return '';
  return html`<section class="card card--pad class-import-review" aria-label="مراجعة الفصل المحدد">
    <h3>${draft.complete ? 'اكتمل استيراد الفصل بنجاح' : 'مراجعة فصل واحد'}: ${GRADES.find(g => g.v === review.grade)?.label} / ${review.label} · ${review.subject}</h3>
    <p>${store.getYear(review.yearId)?.label ?? 'السنة الحالية'} · ${store.getTerm(review.termId)?.name ?? 'الفصل الدراسي الحالي'}</p>
    <p>الأسماء المحفوظة: ${receipt.added} · الأسماء المعلقة: ${receipt.pendingNames.length}</p>
    ${draft.failed ? html`<p>لم تكتمل العملية. ${receipt.sectionId ? 'حُفظ الفصل.' : 'لم يُحفظ الفصل.'} ${receipt.teachingId ? 'حُفظ إسناد المادة وبنودها.' : 'لم يُحفظ إسناد المادة.'} راجع الأسماء المتبقية ثم أكد إكمال الخطوات.</p>` : ''}
    ${receipt.pendingNames.length ? html`<details open><summary>الأسماء المعلقة (${receipt.pendingNames.length})</summary><ul>${receipt.pendingNames.map(name => html`<li>${name}</li>`)}</ul></details>` : ''}
    ${draft.complete ? html`<a class="btn btn--primary" href="#/teaching/${receipt.teachingId}">فتح الفصل</a><a class="btn btn--quiet" href="#/classes/koshoof">العودة للكشوف</a>` : html`
      <button class="btn btn--primary" data-act="class-import-confirm" ${draft.busy ? 'disabled' : ''}>${receipt.sectionId ? 'مراجعة وتأكيد الخطوات المتبقية' : 'تأكيد حفظ هذا الفصل'}</button>`}
    <button class="btn btn--ghost" data-act="class-import-reset" ${draft.busy ? 'disabled' : ''}>${receipt.sectionId ? 'إنهاء هذه المراجعة' : 'إلغاء المراجعة'}</button>
  </section>`;
}
const classImport = { actions: {
    async 'class-import-confirm'() {
      const current = draft; if (!current.review || current.busy || current.complete || allowed()) return;
      current.busy = true;
      try {
        assertFileCurrent();
        store.refreshClassImportReview(current.review);
        const approved = await confirmSheet({ title: 'حفظ فصل واحد', desc: `الصف ${current.review.grade} / ${current.review.label} · ${current.review.subject} · ${current.review.names.length} طالبًا. سيُحفظ هذا الفصل فقط.`, confirmLabel: 'تأكيد الحفظ' });
        bind(); if (draft !== current || !approved) return;
        await store.confirmClassImport(current.review, true);
        bind(); if (draft !== current) return;
        current.complete = true; current.failed = false; current.message = '';
        if (transfer.importMode === 'grades') {
          const receipt = store.classImportReceipt(current.review);
          // IDs come from the creation receipt, never a fresh name search.
          const ids = new Map(receipt.students.map(row => [row.name, row.id]));
          const column = transfer.rows[0].length;
          transfer.rows = transfer.rows.map((row,index) => [...Array.from({length:column},(_,i)=>row[i] ?? ''), index ? ids.get(String(row[transfer.nameColumn] ?? '').replace(/\s+/g,' ').trim()) ?? '' : 'معرف ركيز المحفوظ']);
          transfer.idColumn = column; transfer.mappings.push({kind:'ignore'});
          transfer.reasons.push('identity'); transfer.created = receipt;
          transfer.message = 'حُفظ الفصل والمادة والأسماء. الدرجات لم تُحفظ بعد. أكمل المزامنة ثم راجع الدرجات وأكدها؛ الملف والأعمدة محفوظة.';
          hub.existing = receipt.teachingId; hub.kind = 'existing'; transfer.review = null;
          transferBinding = JSON.stringify([store.getActiveWorkspace(),store.activeYear()?.id,store.activeTerm()?.id,hub.existing]);
        }
      } catch (error) { if (draft === current) { current.failed = true; current.message = `لم تكتمل العملية: ${error.message} راجع الفصل المحفوظ والأسماء المعلقة أدناه قبل إعادة التأكيد.`; } }
      finally { current.busy = false; repaint(); }
    },
    'class-import-reset'() { if (!draft.busy) { draft = {}; transfer = emptyTransfer(); repaint(); } },
  },
};
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
  const current = transfer; rosterRecovery().then(rows=>{if(transfer === current){current.recovery=rows;repaint();}});
}
const locked = () => draft.busy || transfer.busy || transfer.writing;
function tabs() {
  return html`<nav class="koshoof-modes" aria-label="مهام الكشوف">${['import','export'].map(tab => html`<button class="btn ${hub.tab === tab ? 'btn--primary' : 'btn--quiet'}" data-act="koshoof-tab" data-tab="${tab}" aria-pressed="${hub.tab === tab}" ${locked() ? 'disabled' : ''}>${tab === 'import' ? 'استيراد' : 'تصدير'}</button>`)}</nav>`;
}
function existingPane() {
  if (!hub.existing || !canOpenKoshoof({ id: hub.existing })) { return ''; }
  transfer.panel = 'import';
  return transferPanel(hub.existing);
}
export const koshoofCenter = {
  title: () => 'الكشوف', back, onMount: focus,
  onUnmount() { hub.route = null; setupRequest++; closeTeacherSetupImport(); closeTeacherSetupImport = () => {}; clearExtensionPreview(); },
  render(p = {}) {
    bind(); const denial = allowed(); if (denial) { bindTransfer(null); return classAccessFeedback(p.id ? p : {}) || unavailable(denial); }
    contextRoute(p);
    const list = accessible(), ids = new Set(list.map(row => row.id));
    hub.selected = new Set([...hub.selected].filter(id => ids.has(id)));
    if (hub.existing && !ids.has(hub.existing)) {
      bindTransfer(null);
      return classAccessFeedback({ id: hub.existing });
    }
    return html`<div class="management-page class-import-page"><h2 tabindex="-1">استيراد وتصدير الكشوف</h2>
      ${tabs()}
      ${hub.tab === 'import' ? html`${rosterFilePane(list)}${directExtensionEntry()}` : html`
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
    listen('[data-import-kind]', event => { if (!locked()) { hub.kind = event.target.value; resetDestination(); repaint(); } });
    listen('[data-existing-class]', event => { if (!locked()) { hub.existing = event.target.value; if(!transfer.rows)hub.kind='existing'; resetDestination(); repaint(); } });
    listen('[data-roster-field]', event => { if (!locked() && !draft.review) { draft.manual ??= {}; draft.manual[event.target.dataset.rosterField] = event.target.value; } });
    const invalidate = () => { hub.message = ''; };
    listen('[data-koshoof-class]', event => { event.target.checked ? hub.selected.add(event.target.value) : hub.selected.delete(event.target.value); invalidate(); repaint(); });
    listen('[data-koshoof-all]', event => { hub.selected = new Set(event.target.checked ? accessible().map(row => row.id) : []); invalidate(); repaint(); });
    listen('[data-koshoof-content]', event => { hub.namesOnly = event.target.value !== 'grades'; invalidate(); repaint(); });
  },
  actions: {
    ...classImport.actions,
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
