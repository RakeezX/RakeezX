// AI: real local-file entry, shared class selector, no portal login or bulk save.
import { html, icon, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import { readClassFile, detectClassColumns, classGroups } from '../lib/class-import-file.js';
import { GRADES, sectionLabel, normalizeSectionLabel } from '../models.js';
import { repaint } from '../repaint.js';

let draft = {}, workspace, focusRoute;
function bind() {
  if (workspace !== store.getActiveWorkspace()) {
    draft = {}; workspace = store.getActiveWorkspace();
  }
}
function allowed() { try { store.assertClassImportAccess(); return ''; } catch (error) { return error.message; } }
const unavailable = message => html`<div class="empty"><h2>الاستيراد غير متاح الآن</h2><p>${message}</p><a class="btn" href="#/classes">العودة للفصول</a></div>`;
const back = () => '#/classes';
function focus(root) {
  if (focusRoute !== location.hash) { focusRoute = location.hash; root.querySelector('h2')?.focus({ preventScroll: true }); }
}
const matches = group => store.state.sections.filter(row => !row.deleted && row.yearId === store.activeYear()?.id &&
  Number(row.grade) === group.grade && normalizeSectionLabel(row.label) === normalizeSectionLabel(group.label));
function preview() {
  return html`<div class="class-import-groups" aria-label="الفصول في الملف">${draft.groups.map((group, index) => html`
    <article class="card card--pad">
      <h3>${GRADES.find(g => g.v === group.grade)?.label ?? group.rawGrade} / ${group.label || 'الفصل غير محدد'} · ${group.subject || 'المادة غير محددة'}</h3>
      <p>${group.preview.names.length} طالبًا صالحًا فريدًا · ${group.preview.counts.ambiguous} اسمًا مكررًا · ${group.preview.counts.invalid} غير صالح</p>
      <p>${matches(group).length ? 'فصل موجود أو مؤرشف — راجعه في الكشوف' : 'فصل جديد'}</p>
      ${group.error ? html`<p role="alert">${group.error}</p>` : ''}
      <p>${draft.selected === index ? 'الفصل المحدد' : 'للمراجعة لاحقًا'}</p>
      <button class="btn btn--quiet" data-act="class-import-select" data-index="${index}" ${group.error || matches(group).length || group.preview.counts.invalid || group.preview.counts.ambiguous || draft.busy || draft.review ? 'disabled' : ''}>مراجعة هذا الفصل</button>
    </article>`)}
  </div>`;
}
function reviewed() {
  const review = draft.review, receipt = store.classImportReceipt(review);
  if (!receipt) return '';
  return html`<section class="card card--pad class-import-review" aria-label="مراجعة الفصل المحدد">
    <h3>مراجعة فصل واحد: ${review.grade} / ${review.label} · ${review.subject}</h3>
    <p>${store.getYear(review.yearId)?.name ?? review.yearId} · ${store.getTerm(review.termId)?.name ?? review.termId}</p>
    <p>سيُحفظ الفصل ثم المادة ببنود التقييم الافتراضية ثم الأسماء. قد تنجح خطوة وتتعثر التالية.</p>
    <p>${receipt.sectionId ? html`الفصل المحفوظ: ${review.grade} / ${review.label} (${receipt.sectionId})` : 'لم يُحفظ الفصل بعد.'}</p>
    <p>${receipt.teachingId ? html`إسناد المادة المحفوظ: ${review.subject} (${receipt.teachingId})` : 'إسناد المادة للفصل لم يُحفظ بعد.'} · الطلاب المحفوظون: ${receipt.added}</p>
    <details open><summary>الأسماء المعلقة (${receipt.pendingNames.length})</summary><ul>${receipt.pendingNames.map(name => html`<li>${name}</li>`)}</ul></details>
    ${draft.complete ? html`<a class="btn btn--primary" href="#/teaching/${receipt.teachingId}">فتح الفصل</a>` : html`
      <button class="btn btn--primary" data-act="class-import-confirm" ${draft.busy ? 'disabled' : ''}>${receipt.sectionId ? 'مراجعة وتأكيد الخطوات المتبقية' : 'تأكيد حفظ هذا الفصل'}</button>`}
    <button class="btn btn--ghost" data-act="class-import-reset" ${draft.busy ? 'disabled' : ''}>${receipt.sectionId ? 'إنهاء هذه المراجعة' : 'إلغاء المراجعة'}</button>
  </section>`;
}
const classImport = {
  title: () => 'استيراد الفصول', back,
  onMount: focus,
  render() {
    bind(); const denial = allowed(); if (denial) return unavailable(denial);
    return html`<div class="management-page class-import-page">
      <h2 tabindex="-1">استيراد الفصول من ملف</h2>
      <p>ارفع CSV أو XLSX من جهازك (حتى 1MB و300 صف و50 عمودًا). كل تأكيد يحفظ فصلًا واحدًا فقط.</p>
      <p>الأعمدة البسيطة: الصف، الفصل، المادة، اسم الطالب (اختياري). مثال: 4، أ، الرياضيات، أحمد علي.</p>
      <label class="field"><span>مصدر الملف</span><select class="select" aria-label="مصدر الملف" ${draft.busy || draft.review ? 'disabled' : ''}>
        <option>ملف من الجهاز</option><option>ملف صادر من نور</option><option>ملف صادر من مدرستي</option>
      </select></label><p>هذه ملفات مصدّرة ترفعها بنفسك؛ لا يوجد اتصال أو تسجيل دخول إلى نور أو مدرستي.</p>
      <label class="field"><span>اختر الملف</span><input class="input" type="file" accept=".csv,.xlsx" data-class-file ${draft.busy || draft.review ? 'disabled' : ''}></label>
      ${draft.fileName ? html`<p>الملف المحدد: ${draft.fileName}</p>` : ''}
      ${draft.rows ? html`<form data-class-mapping class="card card--pad"><fieldset ${draft.busy || draft.review ? 'disabled' : ''}>
        <h3>تحديد الأعمدة</h3>
        <label class="field"><span>صف العناوين</span><select class="select" name="header">${draft.rows.slice(0,12).map((row,i) => html`<option value="${i}" ${i === draft.header ? 'selected' : ''}>${i+1}: ${row.join(' · ').slice(0,100)}</option>`)}</select></label>
        ${[['grade','الصف'],['label','الفصل'],['subject','المادة'],['name','اسم الطالب (اختياري)']].map(([field,label]) => html`<label class="field"><span>${label}</span>
          <select class="select" name="${field}" ${draft.review ? 'disabled' : ''}><option value="-1">${field === 'name' ? 'دون أسماء طلاب' : 'اختيار يدوي لكل الملف'}</option>${draft.rows[draft.header].map((cell,i) => html`<option value="${i}" ${draft.mapping[field] === i ? 'selected' : ''}>${i+1}: ${cell}</option>`)}</select></label>`)}
        <p>للحقول غير الموجودة في الملف فقط: اختر الصف والمادة واكتب رمز الفصل. تُطبّق على الصفوف جميعها.</p>
        <div class="class-import-manual">
          <label class="field"><span>الصف اليدوي</span><select class="select" name="manualGrade"><option value="">اختر الصف</option>${GRADES.map(g=>html`<option value="${g.v}" ${String(draft.manual?.grade) === String(g.v) ? 'selected' : ''}>${g.label}</option>`)}</select></label>
          <label class="field"><span>رمز الفصل اليدوي</span><input class="input" name="manualLabel" maxlength="8" value="${draft.manual?.label ?? ''}"></label>
          <label class="field"><span>المادة اليدوية</span><select class="select" name="manualSubject"><option value="">اختر المادة</option>${store.subjectOptions().map(o=>html`<option value="${o.name}" ${draft.manual?.subject === o.name ? 'selected' : ''}>${o.name}</option>`)}</select></label>
        </div>
        <button type="submit" class="btn btn--quiet" ${draft.busy || draft.review ? 'disabled' : ''}>عرض المعاينة دون حفظ</button>
      </fieldset></form>` : ''}
      <p role="status" aria-live="polite" class="class-import-message">${draft.message ?? ''}</p>
      ${draft.groups ? preview() : ''}${draft.review ? reviewed() : ''}
    </div>`;
  },
  afterPaint(root) {
    focus(root);
    const file = root.querySelector('[data-class-file]');
    if (file && !file.dataset.bound) { file.dataset.bound = 'true'; file.addEventListener('change', async () => {
      const current = draft; if (current.busy || current.review || allowed()) return;
      const chosenFile = file.files[0];
      current.rows = null; current.groups = null;
      current.fileName = chosenFile?.name ?? ''; current.busy = true; current.message = 'جارٍ قراءة الملف محليًا…'; repaint();
      try {
        const rows = await readClassFile(chosenFile); bind();
        if (draft !== current || allowed()) return;
        Object.assign(current, { rows, ...detectClassColumns(rows), groups: null, message: '' });
      } catch { if (draft === current) current.message = 'تعذّر قراءة الملف. استخدم CSV بترميز UTF-8 أو XLSX ضمن الحدود الموضحة.'; }
      finally { current.busy = false; repaint(); }
    }); }
    const form = root.querySelector('[data-class-mapping]');
    if (form && !form.dataset.bound) { form.dataset.bound = 'true';
      form.querySelector('[name="header"]').addEventListener('change', event => {
        if (draft.busy || draft.review) return;
        draft.header = Number(event.target.value);
        draft.mapping = detectClassColumns([draft.rows[draft.header]]).mapping;
        draft.groups = null; repaint();
      });
      form.addEventListener('submit', event => {
      event.preventDefault(); if (draft.busy || draft.review || allowed()) return;
      const fd = new FormData(form);
      draft.header = Number(fd.get('header'));
      draft.mapping = Object.fromEntries(['grade','label','subject','name'].map(field => [field, Number(fd.get(field))]));
      draft.manual = { grade: fd.get('manualGrade'), label: fd.get('manualLabel'), subject: fd.get('manualSubject') };
      try { draft.groups = classGroups(draft.rows, { ...draft, schoolName: store.state.profile?.schoolName }); draft.message = draft.groups.length ? 'اختر فصلًا واحدًا للمراجعة. الأسماء المكررة وغير الصالحة تحتاج تصحيح الملف.' : 'لا توجد صفوف بيانات.'; }
      catch (error) { draft.groups = null; draft.message = error.message; }
      repaint();
    }); }
  },
  actions: {
    'class-import-select'(el) {
      if (draft.busy || draft.review || allowed()) return;
      try { const index = Number(el.dataset.index); draft.review = store.reviewClassImport(draft.groups[index]); draft.selected = index; draft.message = ''; }
      catch (error) { draft.message = error.message; }
      repaint();
    },
    async 'class-import-confirm'() {
      const current = draft; if (!current.review || current.busy || current.complete || allowed()) return;
      current.busy = true;
      try {
        store.refreshClassImportReview(current.review);
        const approved = await confirmSheet({ title: 'حفظ فصل واحد', desc: `الصف ${current.review.grade} / ${current.review.label} · ${current.review.subject} · ${current.review.names.length} طالبًا. لن تُحفظ الفصول الأخرى.`, confirmLabel: 'تأكيد الحفظ' });
        bind(); if (draft !== current || !approved) return;
        await store.confirmClassImport(current.review, true);
        bind(); if (draft !== current) return;
        current.complete = true; current.message = 'اكتمل حفظ الفصل المحدد. بقية الفصول للمراجعة لاحقًا.';
      } catch (error) { if (draft === current) current.message = `لم تكتمل العملية: ${error.message} راجع الفصل المحفوظ والأسماء المعلقة أدناه قبل إعادة التأكيد.`; }
      finally { current.busy = false; repaint(); }
    },
    'class-import-reset'() { if (!draft.busy) { draft = {}; repaint(); } },
  },
};
export const koshoofCenter = {
  title: () => 'استيراد وتصدير الكشوف', back, onMount: focus, afterPaint: focus,
  render() {
    const denial = allowed(); if (denial) return unavailable(denial);
    const list = store.teachings().filter(row => { try { store.assertClassOperationsAccess(row.id); return true; } catch { return false; } });
    return html`<div class="management-page class-import-page"><h2 tabindex="-1">اختر الفصل للكشوف</h2><p>استيراد أو تصدير كشف لفصل محدد.</p>
      <div class="class-import-groups">${list.map(row => html`<article class="card card--pad"><h3>${sectionLabel(store.getSection(row.sectionId))} · ${store.getSubject(row.subjectId)?.name}</h3>
        <div class="classes-toolbar"><a class="btn btn--primary" href="#/teaching/${row.id}/koshoof?import=1">${icon('upload')} استيراد لهذا الفصل</a><a class="btn btn--quiet" href="#/teaching/${row.id}/koshoof?export=1">${icon('download')} تصدير لهذا الفصل</a></div></article>`)}</div>
      ${!list.length ? html`<p>لا توجد فصول نشطة متاحة في حسابك لهذا الفصل الدراسي.</p><a class="btn btn--primary" href="#/classes/import">استيراد الفصول</a>` : ''}
    </div>`;
  },
};
export default classImport;
