// AI: real local-file entry, shared class selector, no portal login or bulk save.
import { html, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import { readClassFile, detectClassNameColumn, classGroups } from '../lib/class-import-file.js';
import { GRADES, sectionLabel, normalizeSectionLabel } from '../models.js';
import { classKoshoofBundle, downloadKoshoofBundle } from '../lib/class-koshoof-bundle.js';
import { repaint } from '../repaint.js';

let draft = {}, workspace, focusRoute, scope;
let hub = { selected: new Set(), namesOnly: true };
function bind() {
  const next = JSON.stringify([store.activeYear()?.id, store.activeTerm()?.id]);
  if (workspace !== store.getActiveWorkspace() || scope !== next) {
    draft = {}; hub = { selected: new Set(), namesOnly: true }; workspace = store.getActiveWorkspace(); scope = next;
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
      <details open><summary>مراجعة الأسماء (${group.preview.entries.length})</summary><ul>${group.preview.entries.map(entry => html`<li>${entry.name} — ${entry.status === 'new' ? 'صالح' : entry.status === 'ambiguous' ? 'مكرر — يحتاج تصحيحًا' : 'غير صالح — يحتاج تصحيحًا'}</li>`)}</ul></details>
      <p>${matches(group).length ? 'فصل موجود أو مؤرشف — راجعه في الكشوف' : 'فصل جديد'}</p>
      ${group.error ? html`<p role="alert">${group.error}</p>` : ''}
      <p>${draft.selected === index ? 'الفصل المحدد' : 'للمراجعة لاحقًا'}</p>
      <button class="btn btn--quiet" data-act="class-import-select" data-index="${index}" ${group.error || !group.preview.names.length || matches(group).length || group.preview.counts.invalid || group.preview.counts.ambiguous || draft.busy || draft.review ? 'disabled' : ''}>مراجعة هذا الفصل</button>
    </article>`)}
  </div>`;
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
const classImport = {
  title: () => 'الكشوف', back,
  onMount: focus,
  render() {
    bind(); const denial = allowed(); if (denial) return unavailable(denial);
    if (draft.complete) return html`<div class="management-page class-import-page">${reviewed()}</div>`;
    return html`<div class="management-page class-import-page">
      <h2 tabindex="-1">استيراد فصل جديد من ملف</h2>
      <p>اختر CSV أو XLSX من جهازك (حتى 1MB و300 صف و50 عمودًا)، وحدد بيانات فصل واحد في ركيز. تُقرأ أسماء الطلاب فقط من الملف.</p>
      <label class="field"><span>اختر الملف</span><input class="input" type="file" accept=".csv,.xlsx" data-class-file ${draft.busy || draft.review ? 'disabled' : ''}></label>
      ${draft.fileName ? html`<p>الملف المحدد: ${draft.fileName}</p>` : ''}
      ${draft.rows ? html`<form data-class-mapping class="card card--pad"><fieldset ${draft.busy || draft.review ? 'disabled' : ''}>
        <h3>بيانات الفصل في ركيز</h3>
        ${draft.mapping.name < 0 || draft.chooseName ? html`<label class="field"><span>عمود اسم الطالب</span><select class="select" name="name" required><option value="-1">اختر عمود الأسماء</option>${draft.rows[Math.max(0, draft.header)].map((cell,i) => html`<option value="${i}" ${draft.mapping.name === i ? 'selected' : ''}>${i+1}: ${cell}</option>`)}</select></label>` : html`<p>عمود الأسماء: ${draft.header < 0 ? 'أسماء بلا عنوان' : draft.rows[draft.header][draft.mapping.name]}</p><input type="hidden" name="name" value="${draft.mapping.name}">`}
        <div class="class-import-manual">
          <label class="field"><span>الصف</span><select class="select" name="manualGrade"><option value="">اختر الصف</option>${GRADES.map(g=>html`<option value="${g.v}" ${String(draft.manual?.grade) === String(g.v) ? 'selected' : ''}>${g.label}</option>`)}</select></label>
          <label class="field"><span>رمز الفصل</span><input class="input" name="manualLabel" maxlength="8" value="${draft.manual?.label ?? ''}"></label>
          <label class="field"><span>المادة</span><select class="select" name="manualSubject"><option value="">اختر المادة</option>${store.subjectOptions().map(o=>html`<option value="${o.name}" ${draft.manual?.subject === o.name ? 'selected' : ''}>${o.name}</option>`)}</select></label>
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
        const detected = detectClassNameColumn(rows);
        Object.assign(current, { rows, ...detected, chooseName: detected.mapping.name < 0, groups: null, message: '' });
      } catch { if (draft === current) current.message = 'تعذّر قراءة الملف. استخدم CSV بترميز UTF-8 أو XLSX ضمن الحدود الموضحة.'; }
      finally { current.busy = false; repaint(); }
    }); }
    const form = root.querySelector('[data-class-mapping]');
    if (form && !form.dataset.bound) { form.dataset.bound = 'true';
      form.addEventListener('input', () => {
        if (draft.review || draft.busy) return;
        draft.groups = null;
        root.querySelector('.class-import-groups')?.remove();
        const message = root.querySelector('.class-import-message'); if (message) message.textContent = '';
      });
      form.addEventListener('submit', event => {
      event.preventDefault(); bind(); if (!draft.rows || draft.busy || draft.review || allowed()) return;
      const fd = new FormData(form);
      draft.mapping = { grade: -1, label: -1, subject: -1, name: Number(fd.get('name')) };
      if (draft.mapping.name < 0) { draft.message = 'اختر عمود اسم الطالب.'; repaint(); return; }
      draft.manual = { grade: fd.get('manualGrade'), label: fd.get('manualLabel'), subject: fd.get('manualSubject') };
      try { draft.groups = classGroups(draft.rows, { ...draft, schoolName: store.state.profile?.schoolName }); draft.message = draft.groups.length ? 'اختر فصلًا واحدًا للمراجعة. الأسماء المكررة وغير الصالحة تحتاج تصحيح الملف.' : 'لا توجد صفوف بيانات.'; }
      catch (error) { draft.groups = null; draft.message = error.message; }
      repaint();
    }); }
  },
  actions: {
    'class-import-select'(el) {
      bind(); if (draft.busy || draft.review || allowed()) return;
      try { const index = Number(el.dataset.index); draft.review = store.reviewClassImport(draft.groups[index]); draft.selected = index; draft.message = ''; }
      catch (error) { draft.message = error.message; }
      repaint();
    },
    async 'class-import-confirm'() {
      const current = draft; if (!current.review || current.busy || current.complete || allowed()) return;
      current.busy = true;
      try {
        store.refreshClassImportReview(current.review);
        const approved = await confirmSheet({ title: 'حفظ فصل واحد', desc: `الصف ${current.review.grade} / ${current.review.label} · ${current.review.subject} · ${current.review.names.length} طالبًا. سيُحفظ هذا الفصل فقط.`, confirmLabel: 'تأكيد الحفظ' });
        bind(); if (draft !== current || !approved) return;
        await store.confirmClassImport(current.review, true);
        bind(); if (draft !== current) return;
        current.complete = true; current.failed = false; current.message = '';
      } catch (error) { if (draft === current) { current.failed = true; current.message = `لم تكتمل العملية: ${error.message} راجع الفصل المحفوظ والأسماء المعلقة أدناه قبل إعادة التأكيد.`; } }
      finally { current.busy = false; repaint(); }
    },
    'class-import-reset'() { if (!draft.busy) { draft = {}; repaint(); } },
  },
};
const accessible = () => store.teachings().filter(row => { try { store.assertClassOperationsAccess(row.id); return true; } catch { return false; } });
const teachingLabel = row => `${sectionLabel(store.getSection(row.sectionId))} · ${store.getSubject(row.subjectId)?.name ?? ''}`;
const newPane = () => location.hash.split('?')[0] === '#/classes/import' || new URLSearchParams(location.hash.split('?')[1]).get('new') === '1';
export const koshoofCenter = {
  title: () => 'الكشوف', back, onMount: focus,
  render() {
    bind(); const denial = allowed(); if (denial) return unavailable(denial);
    const list = accessible(), ids = new Set(list.map(row => row.id));
    hub.selected = new Set([...hub.selected].filter(id => ids.has(id)));
    if (newPane()) return html`${draft.complete ? '' : html`<a class="btn btn--quiet" href="#/classes/koshoof">العودة للكشوف</a>`}${classImport.render()}`;
    return html`<div class="management-page class-import-page"><h2 tabindex="-1">الكشوف</h2>
      <section class="card card--pad"><h3>استيراد فصل جديد</h3><p>حدد الصف والفصل والمادة، ثم راجع أسماء الطلاب من ملف محلي قبل الحفظ.</p><a class="btn btn--primary" href="#/classes/koshoof?new=1">استيراد فصل جديد من ملف</a></section>
      <section class="card card--pad"><h3>استيراد لفصل موجود</h3>
        <label class="field"><span>الفصل والمادة</span><select class="select" data-existing-class aria-label="الفصل الموجود"><option value="">اختر الفصل</option>${list.map(row => html`<option value="${row.id}" ${hub.existing === row.id ? 'selected' : ''}>${teachingLabel(row)}</option>`)}</select></label>
        <button class="btn" data-act="koshoof-existing" ${ids.has(hub.existing) ? '' : 'disabled'}>استيراد الأسماء أو الدرجات</button>
      </section>
      <section class="card card--pad"><h3>تصدير الكشوف · Excel</h3>
        <label><input type="checkbox" data-koshoof-all ${list.length && hub.selected.size === list.length ? 'checked' : ''} ${!list.length ? 'disabled' : ''}> تحديد جميع الفصول المتاحة</label>
        <div class="koshoof-selection">${list.map(row => html`<label><input type="checkbox" data-koshoof-class value="${row.id}" ${hub.selected.has(row.id) ? 'checked' : ''}> ${teachingLabel(row)}</label>`)}</div>
        <p role="status">الفصول المحددة: ${hub.selected.size}</p>
        <label class="field"><span>محتوى الكشوف المحددة</span><select class="select" data-koshoof-content><option value="names" ${hub.namesOnly ? 'selected' : ''}>أسماء فقط</option><option value="grades" ${!hub.namesOnly ? 'selected' : ''}>أسماء ودرجات</option></select></label>
        <p>فصل واحد: ملف Excel. عدة فصول: ملف ZIP يحتوي كشف Excel مستقلًا لكل فصل ومادة.</p>
        <button class="btn btn--primary" data-act="koshoof-export" ${hub.selected.size ? '' : 'disabled'}>تنزيل الكشوف المحددة</button>
        <p role="alert">${hub.message ?? ''}</p>
      </section>${!list.length ? html`<p>لا توجد فصول نشطة متاحة في حسابك لهذا الفصل الدراسي.</p>` : ''}
    </div>`;
  },
  afterPaint(root) {
    if (newPane()) { classImport.afterPaint(root); return; }
    focus(root);
    const listen = (selector, handler) => root.querySelectorAll(selector).forEach(el => { if (el.dataset.bound) return; el.dataset.bound = 'true'; el.addEventListener('change', handler); });
    listen('[data-existing-class]', event => { hub.existing = event.target.value; repaint(); });
    listen('[data-koshoof-class]', event => { event.target.checked ? hub.selected.add(event.target.value) : hub.selected.delete(event.target.value); repaint(); });
    listen('[data-koshoof-all]', event => { hub.selected = new Set(event.target.checked ? accessible().map(row => row.id) : []); repaint(); });
    listen('[data-koshoof-content]', event => { hub.namesOnly = event.target.value !== 'grades'; });
  },
  actions: {
    ...classImport.actions,
    'koshoof-existing'() {
      bind(); if (allowed() || !accessible().some(row => row.id === hub.existing)) return;
      location.hash = `#/teaching/${hub.existing}/koshoof?import=1`;
    },
    'koshoof-export'() {
      // Synchronous snapshot + download; every teaching uses the current owner guard.
      bind(); if (allowed()) return;
      try {
        const list = accessible();
        if (!hub.selected.size || [...hub.selected].some(id => !list.some(row => row.id === id))) throw Error('تغيّر الفصل المتاح. أعد الاختيار.');
        const entries = list.filter(row => hub.selected.has(row.id)).map(row => {
          store.assertClassOperationsAccess(row.id);
          return { ...store.teachingContext(row.id), className: teachingLabel(row) };
        });
        downloadKoshoofBundle(classKoshoofBundle(entries, hub.namesOnly)); hub.message = '';
      } catch (error) { hub.message = error.message; repaint(); }
    },
  },
};
export default koshoofCenter;
