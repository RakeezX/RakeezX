/**
 * الدرجات — وضعان:
 *   «بند واحد» يرصد بندًا لكل الطلاب (وهكذا يصحّح المعلّم فعلًا: ورقة ورقة).
 *   «الجدول»   يعرض المصفوفة كاملة، أنسب للّابتوب والمراجعة النهائية.
 */

import { html, icon, toast, fmtNum, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { canOpenRoster } from './students.js';
import { itemScore, studentTotal, masteryBand, normalizeSearchText, displayRoster, sortStudents } from '../models.js';
import { repaint } from '../repaint.js';
import * as db from '../lib/db.js';
import { playQuickLogPlus, playQuickLogMinus } from '../lib/sound.js';
import { showScoreFloatEffect } from '../lib/effects.js';
import { subitemCompletionState, subitemSelectedPoints } from '../lib/score-foundation.js';
import { runtimeSyncOwnershipGuard } from '../lib/sync-ownership.js';
let mode = 'item';        // item | table
let activeItemId = null;
let sortKey = 'default';   // default | name | roll | score_desc | score_asc
let filterMissing = false;
let bulkSelected = new Set();
let bulkScoreVal = '';
let query = '';
const scoreValidation = new Map();
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

const gradesView = {
  title: () => 'كشف الدرجات',
  subtitle: (p) => {
    const teaching = store.getTeaching(p.id);
    return store.sectionLabel(store.getSection(teaching?.sectionId)) ?? '';
  },
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  // AI N120: retain the sheet across whole-view repaints (filters and quick scores).
  beforeRender() {
    if (!document.getElementById('report-filter-style')) {
      const style = document.createElement('link');
      style.id = 'report-filter-style';
      style.rel = 'stylesheet';
      style.href = new URL('../styles/filters.css', import.meta.url).href;
      document.head.append(style);
    }
  },

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
  },


  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(cls)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">الدرجات محفوظة، ولا يمكن تعديلها من مسار العمل النشط.</div></div>`;

    const { roster: activeRoster, items, ctx } = store.teachingContext(cls.id);
    const roster = displayRoster(activeRoster);
    const panels = '';
    const distributionAction = html`<div class="grade-transfer__toolbar">${canOpenRoster(p) ? html`<a class="btn btn--sm btn--quiet" href="#/teaching/${cls.id}/koshoof">${icon('upload')} استيراد وتصدير الدرجات</a>` : ''}<a class="btn btn--sm grades-distribution-action" href="#/teaching/${cls.id}/items" aria-label="توزيع الدرجات">${icon('note')} <span>توزيع الدرجات</span></a></div>`;

    if (!roster.length) {
      return html`
        <div class="grades-page-head noprint">${distributionAction}</div>${panels}
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">الفصل بلا طلاب بعد</div><p>استيراد الأسماء والدرجات يراجع الطلاب الجدد قبل إضافتهم معًا.</p>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    if (!items.length) {
      return html`
        <div class="grades-page-head noprint">${distributionAction}</div>${panels}
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
      processedRoster = sortStudents(processedRoster);
    } else if (sortKey === 'roll') {
      processedRoster.sort((a, b) => (a.displayNo ?? 9999) - (b.displayNo ?? 9999));
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
      ${panels}
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
      <div class="grades-toolbar grades-01c__toolbar report-filter-bar noprint" role="group" aria-label="عوامل تصفية كشف الدرجات">
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


export default gradesView;
