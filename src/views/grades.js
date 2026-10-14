/**
 * الدرجات — وضعان:
 *   «بند واحد» يرصد بندًا لكل الطلاب (وهكذا يصحّح المعلّم فعلًا: ورقة ورقة).
 *   «الجدول»   يعرض المصفوفة كاملة، أنسب للّابتوب والمراجعة النهائية.
 */

import { html, icon, toast, fmtNum, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { itemScore, studentTotal, masteryBand, normalizeSearchText, displayRoster } from '../models.js';
import { repaint } from '../repaint.js';
import * as db from '../lib/db.js';
import { runtimeSyncOwnershipGuard } from '../lib/sync-ownership.js';
import { playQuickLogPlus, playQuickLogMinus } from '../lib/sound.js';
import { showScoreFloatEffect } from '../lib/effects.js';
import { subitemCompletionState, subitemSelectedPoints } from '../lib/score-foundation.js';
import { readGradeFile } from '../lib/grade-transfer-parsers.js';
import { isTransferItem, suggestGradeMappings } from '../lib/grade-transfer.js';
import { exportGradeCsv, downloadGradeCsv } from '../lib/grade-transfer-export.js';

let mode = 'item';        // item | table
let activeItemId = null;
let sortKey = 'default';   // default | name | roll | score_desc | score_asc
let filterMissing = false;
let bulkSelected = new Set();
let bulkScoreVal = '';
let query = '';
const scoreValidation = new Map();
let transfer = { rows: null, mappings: [], nameColumn: -1, idColumn: -1, review: null, recovery: [], message: '', busy: false };

function transferPanel(teachingId) {
  const { items } = store.teachingContext(teachingId);
  const review = transfer.review;
  const opts = transfer.rows?.[0] ?? [];
  const mappingSummary = html`<div data-grade-mapping-summary>
        <p>اسم الطالب: ${opts[transfer.nameColumn] ?? 'يلزم اختيار العمود'}${transfer.idColumn >= 0 ? html` · المعرف: ${opts[transfer.idColumn]}` : ''}</p>
        <ul>${transfer.mappings.map((m,c) => m.kind !== 'ignore' ? html`<li>${m.kind === 'new' ? m.name : items.find(i => i.id === m.itemId)?.name} (العظمى ${m.kind === 'new' ? m.max : items.find(i => i.id === m.itemId)?.max})</li>` : '')}</ul>
        ${transfer.reasons?.includes('metadata') ? html`<p class="grade-transfer__hint">تُتجاهل بيانات الفصل والمادة ونوع الملف.</p>` : ''}
        ${transfer.reasons?.includes('readonly') ? html`<p class="grade-transfer__hint">البنود الآلية والفرعية للقراءة فقط.</p>` : ''}
      </div>`;
  return html`<details class="grade-transfer noprint" data-grade-transfer ${transfer.rows || transfer.message || transfer.recovery.length ? 'open' : ''}>
    <summary>استيراد وتصدير الدرجات</summary>
    ${!transfer.rows ? html`<label>اختر ملف الدرجات <input class="input" type="file" accept=".csv,.xlsx" data-change="grade-file" ${transfer.busy ? 'disabled' : ''}></label>
      <p class="grade-transfer__hint">حتى 300 طالب · 1 MB</p>
      <details><summary>مساعدة الملف</summary><p>CSV أو XLSX، الورقة الأولى فقط والصف الأول عناوين. الفراغ لا يغيّر الدرجة؛ الصفر يُرصد.</p></details>` : ''}
    ${transfer.busy && !transfer.writing ? html`<button class="btn" data-act="grade-cancel">إلغاء القراءة</button>` : ''}
    ${transfer.rows ? html`<p data-grade-file-name>${transfer.fileName}</p>
      ${review ? html`<details data-grade-reviewed-mapping><summary>مطابقة الأعمدة</summary>${mappingSummary}</details>` : mappingSummary}
      ${!review ? html`<details data-grade-mapping-details ${transfer.editMapping || transfer.nameColumn < 0 || transfer.reasons?.includes('exception') ? 'open' : ''}>
      <summary>تعديل المطابقة${transfer.reasons?.includes('exception') ? ' — أعمدة تحتاج مراجعة أو تجاهل' : ''}</summary><div class="grade-transfer__mapping">
      <label>عمود اسم الطالب <select class="input" data-grade-name data-change="grade-mapping"><option value="-1">اختر العمود</option>${opts.map((v,c) => html`<option value="${c}" ${transfer.nameColumn === c ? 'selected' : ''}>${c+1}: ${v}</option>`)}</select></label>
      <label>معرف ركيز الثابت (اختياري) <select class="input" data-grade-id data-change="grade-mapping"><option value="-1">مطابقة الاسم الفريد في الفصل</option>${opts.map((v,c) => html`<option value="${c}" ${transfer.idColumn === c ? 'selected' : ''}>${c+1}: ${v}</option>`)}</select></label>
      ${opts.map((v,c) => {
        if ([transfer.nameColumn,transfer.idColumn].includes(c) || ['metadata','readonly'].includes(transfer.reasons?.[c])) return '';
        const m = transfer.mappings[c] ?? { kind: 'ignore' };
        return html`<fieldset data-grade-column="${c}"><legend>${c+1}: ${v}</legend>
          <select class="input" data-grade-kind data-change="grade-mapping">
            <option value="ignore" ${m.kind === 'ignore' ? 'selected' : ''}>تجاهل</option>
            ${items.filter(isTransferItem).map(i => html`<option value="${i.id}" ${m.itemId === i.id ? 'selected' : ''}>${i.name} — العظمى ${i.max}</option>`)}
            <option value="new" ${m.kind === 'new' ? 'selected' : ''}>إنشاء بند يدوي مسمّى صراحة</option>
          </select>
          ${m.kind === 'new' ? html`<label>اسم البند <input class="input" data-grade-new-name maxlength="50" value="${m.name ?? ''}" data-change="grade-mapping"></label>
            <label>العظمى <input class="input" data-grade-new-max inputmode="decimal" value="${m.max ?? ''}" data-change="grade-mapping"></label>
            <label><input type="checkbox" data-grade-new-confirm data-change="grade-mapping" ${m.confirmed ? 'checked' : ''}> أؤكد إنشاء هذا البند بهذه العظمى</label>` : ''}
        </fieldset>`;
      })}</div></details>` : html`<button class="btn" data-act="grade-edit-mapping" ${transfer.busy ? 'disabled' : ''}>تعديل المطابقة</button>`}
      ${!review ? html`<button class="btn btn--primary" data-act="grade-review" ${transfer.busy ? 'disabled' : ''}>مراجعة الدرجات</button>` : ''}
      <button class="btn" data-act="grade-cancel" ${transfer.writing ? 'disabled' : ''}>إلغاء</button>
    ` : ''}
    ${review ? html`<div data-grade-review><p>إضافات ${review.additions}، استبدالات ${review.overwrites}، دون تغيير ${review.unchanged}، أخطاء ${review.rejected.length}.</p>
      <div class="grade-transfer__scroll"><table><thead><tr><th>صف</th><th>الطالب</th><th>البند / العظمى</th><th>الحالي ← المقترح</th></tr></thead><tbody>
        ${review.entries.filter(e => e.value !== null && e.value !== e.old).map(e => html`<tr><td>${e.row}</td><td>${e.student}</td><td>${e.item} / ${e.max}</td><td>${e.old ?? 'فارغ'} ← ${e.value}</td></tr>`)}
      </tbody></table></div>
      ${review.rejected.map(e => html`<p role="alert">صف ${e.row} · ${e.student}${e.item ? html` · ${e.item} · القيمة ${e.value} · العظمى ${e.max}` : ''}: ${e.reason}</p>`)}
      ${review.unchanged ? html`<details data-grade-unchanged><summary>دون تغيير (${review.unchanged})</summary><ul>${review.entries.filter(e => e.value === null || e.value === e.old).map(e => html`<li>صف ${e.row} · ${e.student} · ${e.item}: ${e.old ?? 'فارغ'} ← ${e.value ?? 'فراغ؛ لا تغيير'}</li>`)}</ul></details>` : ''}
      ${review.rejected.length ? html`<p>صحّح الأخطاء قبل التأكيد؛ لم تتغير أي درجة.</p>` : !review.cells.length ? html`<p>لا توجد درجات متغيرة لتأكيدها.</p>` : html`<label><input type="checkbox" data-grade-match-confirm> راجعت هوية الطلاب والمطابقة والدرجات المعروضة</label>
      ${review.overwrites ? html`<label><input type="checkbox" data-grade-overwrite-confirm> أوافق على استبدال ${review.overwrites} درجة بالقيم المعروضة</label>` : ''}`}
      <button class="btn btn--primary" data-act="grade-confirm" ${transfer.busy || review.rejected.length || !review.cells.length ? 'disabled' : ''}>تأكيد الدرجات</button>
    </div>` : ''}
    ${transfer.message ? html`<p role="status">${transfer.message}</p>` : ''}
    ${transfer.recovery.map(r => html`<p role="alert">طلب محفوظ: ${r.mutationId} — ${r.state === 'rejected' ? 'مرفوض، يلزم تصحيح سبب الرفض قبل دفعة جديدة' : 'لم يتأكد الإيصال بعد؛ أعد الطلب نفسه فقط'}
      ${r.state !== 'rejected' ? html`<button class="btn" data-act="grade-retry" data-mutation="${r.mutationId}" ${transfer.busy ? 'disabled' : ''}>استعادة إيصال الطلب نفسه</button>`
        : html`<label><input type="checkbox" data-grade-retire-confirm> أفهم أن الدفعة رُفضت بالكامل وأريد إلغاء هذا الطلب المرفوض مع حفظ سببه</label><button class="btn" data-act="grade-retire" data-mutation="${r.mutationId}">إلغاء الطلب المرفوض وحفظ الرفض</button>`}</p>`)}
    <details data-grade-export-panel><summary>تصدير الدرجات</summary>
    <fieldset><legend>بنود التصدير</legend>${items.map(i => html`<label><input type="checkbox" data-change="grade-export-selection" data-grade-export-item value="${i.id}" ${!transfer.exportItems || transfer.exportItems.has(i.id) ? 'checked' : ''}> ${i.name} / ${i.max}</label>`)}</fieldset>
    <button class="btn" data-act="grade-export">تصدير درجات CSV</button>
    <button class="btn" data-act="grade-noor-export">ملف مساعد للرصد اليدوي في نور</button>
    <p class="grade-transfer__hint">ليس للرفع المباشر.</p></details>
  </details>`;
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
  if (!root?.isConnected || transfer.busy || !retry && (!transfer.review || transfer.review.rejected.length || !transfer.review.cells.length)) return;
  if (!retry && (!root.querySelector('[data-grade-match-confirm]')?.checked || transfer.review?.overwrites && !root.querySelector('[data-grade-overwrite-confirm]')?.checked)) {
    toast('أكد مراجعة هوية الطلاب واستبدال الدرجات أولًا', 'danger'); return;
  }
  const overwriteConfirmed = root.querySelector('[data-grade-overwrite-confirm]')?.checked ?? false;
  transfer.busy = true; transfer.writing = true; repaint();
  try {
    if (retry) await store.retryGradeImport(el.dataset.mutation);
    else await store.confirmGradeImport(transfer.review, { approved: true, overwriteConfirmed });
    current.rows = null; current.review = null; current.message = 'تم تأكيد الدفعة كاملة بإيصال الخادم.';
  } catch (error) { current.message = error.message; }
  finally { current.busy = false; current.writing = false; if (transfer === current) { current.recovery = await store.gradeImportRecovery(); repaint(); } }
}

function transferExport(el, ev, params) {
  const root = el.closest('[data-grade-transfer]'), selected = new Set([...root.querySelectorAll('[data-grade-export-item]:checked')].map(e => e.value));
  if (!selected.size) { toast('اختر بنود التصدير', 'danger'); return; }
  const context = store.teachingContext(params.id), teaching = store.getTeaching(params.id);
  const noorReview = el.dataset.act === 'grade-noor-export';
  downloadGradeCsv(exportGradeCsv({ ...context, items: context.items.filter(i => selected.has(i.id)), className: store.sectionLabel(store.getSection(teaching.sectionId)),
    subject: store.state.subjects.find(s => s.id === teaching.subjectId)?.name, term: store.state.terms.find(t => t.id === teaching.termId)?.name, noorReview }), noorReview);
}

const AUTO_NOTE = {
  participation: 'يُحسب آليًا من الرصد السريع — لا يُدخل يدويًا.',
  attendance: 'يُحسب آليًا من الغياب — لا يُدخل يدويًا.',
};

function refreshScoreProjection(studentId, itemId) {
  const item = store.state.items.find((candidate) => candidate.id === itemId && !candidate.deleted);
  if (!item) return;
  const { roster, items, ctx } = store.teachingContext(item.teachingId);
  const currentItem = items.find((candidate) => candidate.id === activeItemId);
  const countEl = document.querySelector('[data-grade-count]');
  if (countEl && currentItem) {
    const count = roster.filter((student) => itemScore(currentItem, ctx[student.id]) !== null).length;
    countEl.textContent = count;
  }
  const total = studentTotal(items, ctx[studentId]);
  const totalEl = document.querySelector(`[data-grade-total="${CSS.escape(studentId)}"]`);
  const pctEl = document.querySelector(`[data-grade-pct="${CSS.escape(studentId)}"]`);
  if (totalEl) totalEl.textContent = fmtNum(total.earned);
  if (pctEl) pctEl.textContent = fmtPct(total.pct);
}

export default {
  title: () => 'كشف الدرجات',
  subtitle: (p) => {
    const teaching = store.getTeaching(p.id);
    return store.sectionLabel(store.getSection(teaching?.sectionId)) ?? '';
  },
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() {
    if (!document.getElementById('n94-grades-style')) {
      const style = document.createElement('link');
      style.id = 'n94-grades-style';
      style.rel = 'stylesheet';
      style.href = new URL('../styles/grades.css', import.meta.url).href;
      document.head.append(style);
    }
    mode = 'item';
    activeItemId = null;
    sortKey = 'default';
    filterMissing = false;
    bulkSelected = new Set();
    bulkScoreVal = '';
    query = '';
    scoreValidation.clear();
    transfer = { rows: null, mappings: [], nameColumn: -1, idColumn: -1, review: null, recovery: [], message: '', busy: false };
    const current = transfer;
    store.gradeImportRecovery().then(rows => { if (transfer === current) { transfer.recovery = rows; repaint(); } });
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(cls)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">الدرجات محفوظة، ولا يمكن تعديلها من مسار العمل النشط.</div></div>`;

    const { roster: activeRoster, items, ctx } = store.teachingContext(cls.id);
    const roster = displayRoster(activeRoster);
    const distributionAction = html`<a class="btn btn--sm grades-distribution-action" href="#/teaching/${cls.id}/items" aria-label="توزيع الدرجات">${icon('note')} <span>توزيع الدرجات</span></a>`;

    if (!roster.length) {
      return html`
        <div class="grades-page-head noprint">${distributionAction}</div>${transferPanel(cls.id)}
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    if (!items.length) {
      return html`
        <div class="grades-page-head noprint">${distributionAction}</div>${transferPanel(cls.id)}
        <div class="empty">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">لا بنود تقييم</div>
          <div class="empty__text">حدّد بنود الرصد ودرجاتها العظمى أولًا.</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/items">${icon('plus')} توزيع الدرجات</a>
        </div>
      `;
    }

    if (!activeItemId || !items.some((i) => i.id === activeItemId)) {
      activeItemId = (items.find((i) => !i.auto) ?? items[0]).id;
    }

    const currentItem = items.find((i) => i.id === activeItemId) ?? items[0];

    // فلترة غير المرصودين
    let processedRoster = [...roster];
    if (filterMissing) {
      if (mode === 'item') {
        processedRoster = processedRoster.filter((s) => {
          const v = itemScore(currentItem, ctx[s.id]);
          return v === null;
        });
      } else {
        processedRoster = processedRoster.filter((s) => {
          const t = studentTotal(items, ctx[s.id]);
          return t.missing > 0;
        });
      }
    }

    if (query) {
      const normalized = normalizeSearchText(query);
      processedRoster = processedRoster.filter((student) =>
        normalizeSearchText(student.name).includes(normalized) ||
        normalizeSearchText(student.displayNo ?? '').includes(normalized));
    }

    // الترتيب
    if (sortKey === 'name') {
      processedRoster.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    } else if (sortKey === 'roll') {
      processedRoster.sort((a, b) => (a.rollNo ?? 9999) - (b.rollNo ?? 9999));
    } else if (sortKey === 'score_desc') {
      processedRoster.sort((a, b) => {
        const scA = mode === 'item' ? (itemScore(currentItem, ctx[a.id]) ?? -1) : (studentTotal(items, ctx[a.id]).pct ?? -1);
        const scB = mode === 'item' ? (itemScore(currentItem, ctx[b.id]) ?? -1) : (studentTotal(items, ctx[b.id]).pct ?? -1);
        return scB - scA;
      });
    } else if (sortKey === 'score_asc') {
      processedRoster.sort((a, b) => {
        const scA = mode === 'item' ? (itemScore(currentItem, ctx[a.id]) ?? 9999) : (studentTotal(items, ctx[a.id]).pct ?? 9999);
        const scB = mode === 'item' ? (itemScore(currentItem, ctx[b.id]) ?? 9999) : (studentTotal(items, ctx[b.id]).pct ?? 9999);
        return scA - scB;
      });
    }

    return html`
      <style>
/* N84 isolated Work UI. N82 selector remains frozen. */
.n84-inline { display:inline-flex; align-items:center; gap:2px; vertical-align:middle; }
.n84-step { width:44px; height:44px; padding:12px; border:1px solid var(--border); border-radius:8px; background:var(--bg-sunk); color:var(--text-2); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.n84-step--plus { color:var(--brand-text); background:var(--brand-soft); }
.n84-step svg { width:16px; height:16px; }
.n84-step:focus-visible { outline:3px solid var(--action-focus-ring); outline-offset:-2px; }
.n84-step:disabled { opacity:.5; cursor:wait; }
.graderow__auto:has(.n84-inline) { display:flex; gap:5px; align-items:center; }
.grades-01c__direct-row.is-auto:has(.n84-inline) { grid-template-columns:32px minmax(0,1fr) max-content; }
@media(max-width:540px) {
 .grades-01c__direct-row.is-auto:has(.n84-inline) { grid-template-columns:24px minmax(0,1fr) max-content; gap:6px; padding:10px 8px; }
 .graderow__auto:has(.n84-inline) { gap:2px; }
 .graderow__auto:has(.n84-inline) .badge { padding-inline:5px; font-size:12px; }
}
</style>
      <div class="grades-01c">
      <section class="grades-01c__context">
      <div class="grades-01c__mode-bar"><div class="segmented" role="group" aria-label="طريقة عرض الدرجات">
        <button class="segmented__btn ${mode === 'item' ? 'is-on' : ''}" data-act="mode" data-mode="item" aria-pressed="${mode === 'item'}">
          بند واحد
        </button>
        <button class="segmented__btn ${mode === 'table' ? 'is-on' : ''}" data-act="mode" data-mode="table" aria-pressed="${mode === 'table'}">
          الجدول
        </button>
      </div>${distributionAction}</div>
      ${transferPanel(cls.id)}
      ${mode === 'item' ? html`<div class="grades-01c__item-tabs" role="tablist" aria-label="بنود التقييم">
        ${items.map((item) => html`<button class="grades-01c__item-tab ${item.id === activeItemId ? 'is-active' : ''}"
          data-act="pick" data-id="${item.id}" role="tab" aria-selected="${item.id === activeItemId}">
          <strong>${item.name}</strong><small>${item.max} درجات${item.auto ? ' · آلي' : ''}</small>
        </button>`)}</div>` : ''}
      ${mode === 'item' ? html`<div class="grades-01c__assessment">
        <div><h2>${currentItem.name}</h2><p>${currentItem.scoreMode === 'subitems' ? 'عناصر فرعية' : currentItem.auto ? 'رصد آلي' : 'رصد يدوي'} · الدرجة العظمى ${currentItem.max}</p></div>
        <div class="grades-01c__summary">
          <div><strong data-grade-count>${roster.filter((student) => itemScore(currentItem, ctx[student.id]) !== null).length}</strong><span>مرصودة</span></div>
          <div><strong>${roster.filter((student) => itemScore(currentItem, ctx[student.id]) === null).length}</strong><span>غير مرصودة</span></div>
          <div><strong>${currentItem.max}</strong><span>الدرجة العظمى</span></div>
        </div>
      </div>` : ''}
      </section>

      <!-- شريط الإنتاجية: الفلترة والترتيب -->
      <div class="grades-toolbar grades-01c__toolbar noprint">
        <label class="grades-01c__search">${icon('search')}<input type="search" data-input="search" data-fk="grades-search"
          value="${query}" placeholder="ابحث عن طالب" aria-label="بحث في كشف الدرجات"></label>
        <div class="grades-01c__filters">
          <label class="grades-01c__sort">
          <select class="select" data-change="sort" aria-label="ترتيب الطلاب">
            <option value="default" ${sortKey === 'default' ? 'selected' : ''}>الترتيب الافتراضي</option>
            <option value="name" ${sortKey === 'name' ? 'selected' : ''}>أبجديًا (اسم الطالب)</option>
            <option value="roll" ${sortKey === 'roll' ? 'selected' : ''}>حسب رقم الكشف</option>
            <option value="score_desc" ${sortKey === 'score_desc' ? 'selected' : ''}>الأعلى درجة</option>
            <option value="score_asc" ${sortKey === 'score_asc' ? 'selected' : ''}>الأقل درجة</option>
          </select>
        </label>
        <label class="grades-01c__missing-filter">
          <input type="checkbox" data-change="toggle-missing" ${filterMissing ? 'checked' : ''}>
          <span>غير المرصود فقط</span>
        </label>
        </div>
      </div>

      ${mode === 'item' ? itemMode(processedRoster, items, ctx, currentItem, roster) : tableMode(processedRoster, items, ctx)}
      </div>
    `;
  },

  afterPaint: flushInlineQuickLogEffect,

  actions: {
    async 'grade-file'(el, ev, params) {
      const prior = transfer;
      const file = el.files?.[0];
      if (!file || prior.writing) return;
      const current = transfer = { ...prior, rows:null, mappings:[], review:null, busy:false, writing:false };
      current.busy = true; current.rows = null; current.review = null; current.message = 'جار قراءة الملف محليًا…'; repaint();
      try {
        const rows = await readGradeFile(file);
        if (transfer !== current) return;
        transfer.rows = rows; transfer.fileName = file.name; Object.assign(transfer, suggestGradeMappings(rows[0], store.teachingContext(params.id).items)); transfer.editMapping = false; transfer.review = null; transfer.message = '';
      } catch (error) { if (transfer === current) { transfer.rows = null; transfer.review = null; transfer.message = 'تعذّر قراءة الملف: ' + error.message; } }
      finally { current.busy = false; if (transfer === current) repaint(); }
    },
    'grade-mapping'(el) { readTransferMappings(el.closest('[data-grade-transfer]')); transfer.review = null; transfer.editMapping = true; repaint(); },
    'grade-edit-mapping'() { if (transfer.busy) return; transfer.review = null; transfer.editMapping = true; repaint(); },
    'grade-export-selection'(el) { transfer.exportItems = new Set([...el.closest('[data-grade-transfer]').querySelectorAll('[data-grade-export-item]:checked')].map(e => e.value)); },
    'grade-review'(el, ev, params) {
      try { readTransferMappings(el.closest('[data-grade-transfer]')); transfer.review = store.reviewGradeImport(params.id, transfer); transfer.message = ''; }
      catch (error) { transfer.review = null; transfer.message = 'راجع الأعمدة والبنود والعظمى: ' + error.message; }
      repaint();
    },
    'grade-cancel'() { if (transfer.writing) return; transfer = { ...transfer, rows:null, mappings:[], review:null, busy:false, writing:false, message:'أُلغي الاستيراد دون تغيير الدرجات.' }; repaint(); },
    'grade-confirm': el => transferConfirm(el),
    'grade-retry': el => transferConfirm(el, true),
    async 'grade-retire'(el) {
      const confirmed = el.closest('[data-grade-transfer]').querySelector('[data-grade-retire-confirm]')?.checked;
      if (!confirmed) { toast('أكد إلغاء الطلب المرفوض وحفظ سبب الرفض أولًا', 'danger'); return; }
      const current = transfer;
      try { await store.retireRejectedGradeImport(el.dataset.mutation, true); current.review = null; current.message = 'حُفظ الرفض وأُلغي الطلب المرفوض. أكمل المزامنة ثم راجع ملفك من جديد.'; }
      catch (error) { current.message = error.message; }
      if (transfer === current) { current.recovery = await store.gradeImportRecovery(); repaint(); }
    },
    'grade-export': transferExport,
    'grade-noor-export': transferExport,
    'n84-log': recordInlineQuickLog,
    mode(el) {
      mode = el.dataset.mode;
      bulkSelected.clear();
      repaint();
    },

    pick(el) {
      activeItemId = el.dataset.id;
      bulkSelected.clear();
      repaint();
    },

    sort(el) {
      sortKey = el.value;
      repaint();
    },

    search(el) {
      query = el.value.trim();
      repaint();
    },

    'toggle-missing'(el) {
      filterMissing = el.checked;
      repaint();
    },

    'toggle-all-bulk'(el, ev, params) {
      const { roster } = store.teachingContext(params.id);
      if (bulkSelected.size === roster.length) {
        bulkSelected.clear();
      } else {
        roster.forEach((s) => bulkSelected.add(s.id));
      }
      repaint();
    },

    'toggle-student-bulk'(el) {
      const id = el.dataset.id;
      if (bulkSelected.has(id)) bulkSelected.delete(id);
      else bulkSelected.add(id);
      repaint();
    },

    'bulk-score-input'(el) {
      bulkScoreVal = el.value;
    },

    async 'apply-bulk'(el, ev, params) {
      if (!bulkSelected.size) {
        toast('اختر طلابًا أولًا', 'danger');
        return;
      }
      const raw = bulkScoreVal.trim();
      const item = store.state.items.find((i) => i.id === activeItemId);
      if (!item || item.auto || item.scoreMode === 'subitems') return;

      if (raw === '') {
        for (const sId of bulkSelected) {
          await store.setScore(sId, item.id, null);
        }
        toast(`أُفرغت درجات ${bulkSelected.size} طالبًا`);
        bulkSelected.clear();
        bulkScoreVal = '';
        repaint();
        return;
      }

      let v = Number(raw.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      if (Number.isNaN(v)) {
        toast('أدخل رقمًا صحيحًا', 'danger');
        return;
      }
      if (v < 0) v = 0;
      if (v > item.max) {
        v = item.max;
        toast(`أقصى درجة لهذا البند ${item.max}`);
      }

      const count = bulkSelected.size;
      for (const sId of bulkSelected) {
        await store.setScore(sId, item.id, v);
      }
      toast(`تم رصد الدرجة (${v}) لـ ${count} طالبًا`);
      bulkSelected.clear();
      bulkScoreVal = '';
      repaint();
    },

    'clear-bulk'() {
      bulkSelected.clear();
      bulkScoreVal = '';
      repaint();
    },

    async score(el) {
      const { id: studentId, item: itemId } = el.dataset;
      const item = store.state.items.find((i) => i.id === itemId);
      if (!item) return;

      const raw = el.value.trim();
      if (raw === '') {
        const saved = store.setScore(studentId, itemId, null, { render: false });
        refreshScoreProjection(studentId, itemId);
        await saved;
        return;
      }

      let v = Number(raw.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      if (Number.isNaN(v)) {
        toast('أدخل رقمًا', 'danger');
        return;
      }
      if (v < 0) v = 0;
      if (v > item.max) {
        v = item.max;
        el.value = fmtNum(v);
        toast(`أقصى درجة لهذا البند ${item.max}`);
      }
      const saved = store.setScore(studentId, itemId, v, { render: false });
      refreshScoreProjection(studentId, itemId);
      await saved;
    },

    'select-score'(el) {
      if (el.value.trim()) el.select();
    },

    async 'subitem-completion'(el) {
      if (el.disabled || el.dataset.workspace !== store.getActiveWorkspace()?.id) return;
      el.disabled = true;
      try {
        const result = await store.cycleScoreSubitemCompletion(el.dataset.student, el.dataset.subitem);
        scoreValidation.delete(`${el.dataset.student}:${result.score.itemId}`);
      } catch (error) {
        toast(error?.message || 'تعذر حفظ حالة العنصر', 'danger');
      }
      repaint();
    },

    async 'manual-contribution'(el) {
      const studentId = el.dataset.student;
      const itemId = el.dataset.item;
      try {
        const result = await store.setScoreManualContribution(studentId, itemId, el.value.trim());
        const key = `${studentId}:${itemId}`;
        if (result.manualClamped) {
          scoreValidation.set(key, `الحد المتبقي ${fmtNum(Math.max(0, store.state.items.find((item) => item.id === itemId).max - result.derivedValue))} درجات.`);
        } else scoreValidation.delete(key);
      } catch (error) {
        toast(error?.message || 'تعذر حفظ الإضافة اليدوية', 'danger');
      }
      repaint();
    },

    keydown(el, ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const inputs = Array.from(el.closest('.list, table')?.querySelectorAll('input.gradein') ?? []);
      const next = inputs[inputs.indexOf(el) + 1];
      if (next) {
        next.focus();
        if (next.value.trim()) next.select();
      } else el.blur();
    },
  },
};

/* ---------- وضع البند الواحد ---------- */

function itemMode(roster, items, ctx, item, fullRoster) {
  if (item.scoreMode === 'subitems') return subitemMode(roster, ctx, item);
  const auto = !!item.auto;

  return html`
    <!-- شريط الرصد الجماعي المباشر أعلى جدول/قائمة الدرجات -->
    ${!auto
      ? html`
          <div class="bulk-bar grades-01c__bulk noprint">
            <label class="hstack gap-1 fs-sm fw-6 pointer">
              <input type="checkbox" data-act="toggle-all-bulk"
                     ${bulkSelected.size > 0 && bulkSelected.size === fullRoster.length ? 'checked' : ''}>
              <span>تحديد الكل</span>
            </label>
            <span class="bulk-bar__count tabular">(${bulkSelected.size} محدد)</span>
            <div class="push hstack gap-2">
              <input class="input bulk-bar__input tabular" type="text" inputmode="decimal"
                     data-input="bulk-score-input"
                     value="${bulkScoreVal}"
                     placeholder="الدرجة"
                     aria-label="الدرجة الجماعية للبند">
              <button class="btn btn--sm btn--primary" data-act="apply-bulk">رصد للمحددين</button>
              ${bulkSelected.size ? html`<button class="btn btn--sm btn--ghost" data-act="clear-bulk">إلغاء</button>` : ''}
            </div>
          </div>
        `
      : ''}

    ${roster.length === 0
      ? html`<div class="empty"><div class="empty__title">لا يوجد طلاب مطابقين للتصفية</div></div>`
      : html`
          <div class="list grades-01c__score-panel">
            ${roster.map((s) => {
              const value = itemScore(item, ctx[s.id]);
              const pct = value === null ? null : (value / item.max) * 100;
              const band = masteryBand(pct);
              const isChecked = bulkSelected.has(s.id);
              return html`
                <div class="graderow grades-01c__direct-row ${auto ? 'is-auto' : ''} ${isChecked ? 'is-selected' : ''}">
                  ${!auto
                    ? html`
                        <input type="checkbox" class="noprint" data-act="toggle-student-bulk" data-id="${s.id}"
                               ${isChecked ? 'checked' : ''} aria-label="تحديد ${s.name}">
                      `
                    : ''}
                  <span class="rollno">${s.displayNo ?? '—'}</span>
                  <span class="graderow__name"><strong>${s.name}</strong><small>${value === null ? 'لم تُرصد الدرجة' : 'تم الرصد'}</small></span>
                  ${auto
                    ? html`
                        <span class="graderow__auto">
                          ${inlineQuickLog(item, s)}
                          <span class="badge ${band.badge}" dir="ltr">
                            <span class="tabular">${fmtNum(value)}</span> / <span class="tabular">${item.max}</span>
                          </span>
                        </span>
                      `
                    : html`
                        <span class="graderow__in">
                          <input class="input gradein tabular" type="text" inputmode="decimal"
                                 data-change="score" data-focus="select-score" data-keydown="keydown"
                                 data-id="${s.id}" data-item="${item.id}"
                                 data-fk="g-${s.id}-${item.id}"
                                 value="${value === null ? '' : fmtNum(value)}"
                                 placeholder="—" aria-label="درجة ${s.name} في ${item.name}">
                          <span class="graderow__slash" aria-hidden="true">/</span>
                          <span class="graderow__max tabular" dir="ltr">${item.max}</span>
                        </span>
                      `}
                </div>
              `;
            })}
          </div>
        `}
  `;
}

function subitemMode(roster, ctx, item) {
  const definitions = store.scoreSubitemsOf(item.id);
  return html`
    <section class="grades-01c__subscore" aria-label="رصد العناصر الفرعية">
      <div class="n94-subscore-toolbar">
        <div class="grades-01c__provenance-key">العناصر الفرعية <span aria-hidden="true">+</span> الإضافة اليدوية <span aria-hidden="true">=</span> الدرجة النهائية</div>
        <div class="n94-completion-legend" aria-label="دليل حالات العناصر الفرعية">
        <span><i class="n94-completion--unrecorded" aria-hidden="true"></i>غير مرصود</span>
        <span><i class="n94-completion--late" aria-hidden="true"></i>متأخر</span>
        <span><i class="n94-completion--regular" aria-hidden="true"></i>عادي/بعذر</span>
        </div>
      </div>
      ${roster.length === 0 ? html`<div class="empty"><div class="empty__title">لا يوجد طلاب مطابقين للتصفية</div></div>` : roster.map((student) => {
        const score = ctx[student.id].scoresByItem[item.id] ?? null;
        const final = itemScore(item, ctx[student.id]);
        const completions = new Map(store.state.scoreSubitemCompletions.filter((row) =>
          row.studentId === student.id && !row.deleted).map((row) => [row.subitemId, row]));
        const derived = score?.derivedValue ?? 0;
        const manual = score?.manualValue ?? null;
        const warning = scoreValidation.get(`${student.id}:${item.id}`);
        return html`<article class="grades-01c__subscore-row">
          <div class="grades-01c__student"><span class="rollno tabular">${student.displayNo ?? '—'}</span>
            <span><strong>${student.name}</strong><small>${final === null ? 'غير مرصود' : 'تم الرصد'}</small></span></div>
          <div class="grades-01c__subitems" role="group" aria-label="عناصر ${item.name} للطالب ${student.name}">
            ${definitions.map((definition) => {
              const completion = completions.get(definition.id);
              const selected = subitemCompletionState(completion);
              const label = { unrecorded: '— غير مرصود', late: '◷ متأخر', regular: '✓ عادي / مقبول بعذر' }[selected];
              const points = subitemSelectedPoints(definition, completion);
              const description = `${definition.name} للطالب ${student.name}: ${label}${points === null ? '' : ` · ${fmtNum(points)} درجات`}`;
              return html`<button type="button" class="grades-01c__subitem n94-completion n94-completion--${selected}"
                data-act="subitem-completion" data-workspace="${store.getActiveWorkspace()?.id}"
                data-student="${student.id}" data-subitem="${definition.id}"
                aria-label="${description}" title="${description}"
                aria-pressed="${selected !== 'unrecorded'}">
                <span class="n94-cell-line" aria-hidden="true"><span class="n94-cell-name">${definition.name}</span>${points === null ? '' : html`<small class="tabular">${fmtNum(points)}</small>`}<i>${{ unrecorded: '—', late: '◷', regular: '✓' }[selected]}</i></span>
              </button>`;
            })}</div>
          <div class="grades-01c__equation" aria-label="ملخص درجة ${student.name}">
            <span class="grades-01c__metric"><small>العناصر</small><b class="tabular">${fmtNum(derived)}</b></span><i aria-hidden="true">+</i>
            <label class="grades-01c__manual-field"><small>يدوي</small><input class="grades-01c__manual tabular" type="text" inputmode="decimal"
              data-change="manual-contribution" data-student="${student.id}" data-item="${item.id}"
              data-fk="manual-${student.id}-${item.id}" value="${manual === null ? '' : fmtNum(manual)}"
              aria-label="إضافة يدوية للطالب ${student.name}"></label><i aria-hidden="true">=</i>
            <strong class="grades-01c__metric grades-01c__metric--final"><small>النهائي</small><b class="tabular">${final === null ? '—' : fmtNum(final)} / ${fmtNum(item.max)}</b></strong>
            ${warning ? html`<small class="grades-01c__capacity" role="alert">${warning}</small>` : ''}
          </div>
        </article>`;
      })}
    </section>`;
}

/* ---------- وضع الجدول ---------- */

function tableMode(roster, items, ctx) {
  const totalMax = items.reduce((n, i) => n + i.max, 0);

  if (roster.length === 0) {
    return html`<div class="empty"><div class="empty__title">لا يوجد طلاب مطابقين للتصفية</div></div>`;
  }

  return html`
    <div class="tablewrap scroll-x">
      <table class="gtable">
        <thead>
          <tr>
            <th class="gtable__sticky">الطالب</th>
            ${items.map(
              (i) => html`<th>
                <span class="gtable__item">${i.name}</span>
                <span class="gtable__max tabular">${i.max}</span>
              </th>`
            )}
            <th class="gtable__total">المجموع<span class="gtable__max tabular">${totalMax}</span></th>
          </tr>
        </thead>
        <tbody>
          ${roster.map((s) => {
            const t = studentTotal(items, ctx[s.id]);
            const band = masteryBand(t.pct);
            return html`
              <tr>
                <th class="gtable__sticky">
                  <span class="gtable__roll tabular">${s.displayNo ?? ''}</span>
                  <a href="#/student/${s.id}">${s.name}</a>
                </th>
                ${items.map((i) => {
                  const v = itemScore(i, ctx[s.id]);
                  if (i.auto || i.scoreMode === 'subitems') {
                    return html`<td class="is-auto tabular"><span>${fmtNum(v)}</span></td>`;
                  }
                  return html`
                    <td>
                      <input class="gradein gradein--cell tabular" type="text" inputmode="decimal"
                             data-change="score" data-focus="select-score" data-keydown="keydown"
                             data-id="${s.id}" data-item="${i.id}"
                             data-fk="t-${s.id}-${i.id}"
                             value="${v === null ? '' : fmtNum(v)}"
                             aria-label="درجة ${s.name} في ${i.name}">
                    </td>
                  `;
                })}
                <td class="gtable__total">
                  <span class="badge ${band.badge}">
                    <span class="tabular" data-grade-total="${s.id}">${fmtNum(t.earned)}</span>
                  </span>
                  <div class="t-3 fs-sm tabular" data-grade-pct="${s.id}">${fmtPct(t.pct)}</div>
                </td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
    <p class="t-3 fs-sm mt-3">
      الأعمدة الرمادية تُحسب آليًا من الرصد السريع والحضور. المجموع من البنود المرصودة فقط،
      فلا يظهر الطالب ضعيفًا لأن بندًا لم يُرصد بعد.
    </p>
  `;
}

// N84 stays in this precached Product view: no new offline shell dependency.
const pending = new Set();
let pulse = null;
export function inlineQuickLog(item, student) {
  if (item.auto !== 'participation') return '';
  const workspaceId = store.getActiveWorkspace()?.id;
  const busy = pending.has(`${workspaceId}:${item.teachingId}:${student.id}`);
  return html`<span class="n84-inline noprint" role="group" aria-label="رصد مشاركة ${student.name}">
    <button type="button" class="n84-step" data-act="n84-log" data-workspace="${workspaceId}" data-student="${student.id}" data-item="${item.id}" data-delta="-1" data-fk="n84-${student.id}-${item.id}-minus" aria-label="خصم نقطة مشاركة من ${student.name}" ${busy?'disabled':''}>${icon('minus')}</button>
    <button type="button" class="n84-step n84-step--plus" data-act="n84-log" data-workspace="${workspaceId}" data-student="${student.id}" data-item="${item.id}" data-delta="1" data-fk="n84-${student.id}-${item.id}-plus" aria-label="إضافة نقطة مشاركة إلى ${student.name}" ${busy?'disabled':''}>${icon('plus')}</button>
  </span>`;
}
export async function recordInlineQuickLog(el, event, params) {
  const item = store.items(params.id).find(i=>i.id===el.dataset.item);
  const studentId = el.dataset.student, delta = Number(el.dataset.delta);
  if (!item || item.auto !== 'participation' || ![-1,1].includes(delta) || store.isTeachingArchived(store.getTeaching(params.id))) return;
  if (!store.teachingContext(params.id).roster.some(s=>s.id===studentId)) return;
  const workspace = store.getActiveWorkspace();
  if (!workspace || el.dataset.workspace !== workspace.id) return;
  const access = runtimeSyncOwnershipGuard.enqueueAccess();
  if (workspace.type !== 'demo' && (!access.allowed ||
      (workspace.type === 'account' && access.workspaceOwnerId !== workspace.authUserId))) return;
  const key = `${workspace.id}:${params.id}:${studentId}`;
  if (pending.has(key)) return;
  pending.add(key);
  el.closest('.n84-inline').querySelectorAll('button').forEach(b=>b.disabled=true);
  try {
    // Existing Quick Log event command; never set an automatic score directly.
    const log = await store.addLog({teachingId:params.id,studentId,kind:'participation',delta,tag:''});
    // addLog returns its proposed record even when save rolls back a failed write.
    // Confirm durability before acknowledging the action, in the same workspace.
    if (store.getActiveWorkspace() !== workspace) return;
    const recorded = await db.get('logs', log.id);
    if (store.getActiveWorkspace() !== workspace) return;
    if (!recorded || recorded.deleted) throw new Error('تعذر حفظ الرصدة');
    pulse = {studentId,itemId:item.id,delta,workspace};
    delta > 0 ? playQuickLogPlus() : playQuickLogMinus();
    if (navigator.vibrate) navigator.vibrate(delta > 0 ? 12 : [8,40,8]);
  } catch (error) { toast(error?.message || 'تعذر حفظ الرصدة','danger'); }
  finally {pending.delete(key);repaint();}
}
export function flushInlineQuickLogEffect(root) {
  if (!pulse) return;
  if (pulse.workspace !== store.getActiveWorkspace()) { pulse = null; return; }
  const button = root.querySelector(`[data-act="n84-log"][data-student="${CSS.escape(pulse.studentId)}"][data-item="${CSS.escape(pulse.itemId)}"]`);
  if (button) showScoreFloatEffect(button.closest('.graderow__auto,td'),pulse.delta);
  pulse=null;
}
