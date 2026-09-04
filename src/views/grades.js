/**
 * الدرجات — وضعان:
 *   «بند واحد» يرصد بندًا لكل الطلاب (وهكذا يصحّح المعلّم فعلًا: ورقة ورقة).
 *   «الجدول»   يعرض المصفوفة كاملة، أنسب للّابتوب والمراجعة النهائية.
 */

import { html, icon, toast, fmtNum, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { itemScore, studentTotal, masteryBand } from '../models.js';
import { repaint } from '../repaint.js';

let mode = 'item';        // item | table
let activeItemId = null;
let sortKey = 'default';   // default | name | roll | score_desc | score_asc
let filterMissing = false;
let bulkSelected = new Set();
let bulkScoreVal = '';

const AUTO_NOTE = {
  participation: 'يُحسب آليًا من الرصد السريع — لا يُدخل يدويًا.',
  attendance: 'يُحسب آليًا من الغياب — لا يُدخل يدويًا.',
};

export default {
  title: () => 'كشف الدرجات',
  subtitle: (p) => {
    const teaching = store.getTeaching(p.id);
    return store.sectionLabel(store.getSection(teaching?.sectionId)) ?? '';
  },
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() {
    mode = 'item';
    activeItemId = null;
    sortKey = 'default';
    filterMissing = false;
    bulkSelected = new Set();
    bulkScoreVal = '';
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const { roster, items, ctx } = store.teachingContext(cls.id);
    const distributionAction = html`<div class="grades-page-head noprint"><a class="btn btn--sm grades-distribution-action" href="#/teaching/${cls.id}/items" aria-label="توزيع الدرجات">${icon('note')} <span>توزيع الدرجات</span></a></div>`;

    if (!roster.length) {
      return html`
        ${distributionAction}
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    if (!items.length) {
      return html`
        ${distributionAction}
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
      ${distributionAction}
      <div class="segmented mb-3">
        <button class="segmented__btn ${mode === 'item' ? 'is-on' : ''}" data-act="mode" data-mode="item">
          بند واحد
        </button>
        <button class="segmented__btn ${mode === 'table' ? 'is-on' : ''}" data-act="mode" data-mode="table">
          الجدول
        </button>
      </div>

      <!-- شريط الإنتاجية: الفلترة والترتيب -->
      <div class="grades-toolbar noprint">
        <label class="field" style="margin-bottom:0; flex: 1; min-width: 140px;">
          <select class="select" data-change="sort" aria-label="ترتيب الطلاب">
            <option value="default" ${sortKey === 'default' ? 'selected' : ''}>الترتيب الافتراضي</option>
            <option value="name" ${sortKey === 'name' ? 'selected' : ''}>أبجديًا (اسم الطالب)</option>
            <option value="roll" ${sortKey === 'roll' ? 'selected' : ''}>حسب رقم الكشف</option>
            <option value="score_desc" ${sortKey === 'score_desc' ? 'selected' : ''}>الأعلى درجة</option>
            <option value="score_asc" ${sortKey === 'score_asc' ? 'selected' : ''}>الأقل درجة</option>
          </select>
        </label>
        <label class="switch" style="margin-inline-start: auto;">
          <input type="checkbox" data-change="toggle-missing" ${filterMissing ? 'checked' : ''}>
          <span>غير المرصودة درجاتهم</span>
        </label>
      </div>

      ${mode === 'item' ? itemMode(processedRoster, items, ctx, currentItem, roster) : tableMode(processedRoster, items, ctx)}
    `;
  },

  actions: {
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
      if (!item || item.auto) return;

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
        await store.setScore(studentId, itemId, null);
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
        toast(`أقصى درجة لهذا البند ${item.max}`);
      }
      await store.setScore(studentId, itemId, v);
    },

    'select-score'(el) {
      if (el.value.trim()) el.select();
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
  const auto = !!item.auto;

  const gradedCount = auto
    ? fullRoster.length
    : fullRoster.filter((s) => {
        const sc = ctx[s.id].scoresByItem[item.id];
        return sc && sc.value !== null && sc.value !== undefined;
      }).length;

  return html`
    <div class="grades-category-nav mb-3" role="tablist" aria-label="بنود التقييم">
      ${items.map((i) => {
        const done = i.auto
          ? fullRoster.length
          : fullRoster.filter((s) => {
              const sc = ctx[s.id].scoresByItem[i.id];
              return sc && sc.value !== null && sc.value !== undefined;
            }).length;
        const full = done === fullRoster.length;
        const isSelected = i.id === activeItemId;
        return html`
          <button class="grades-category-btn chip ${isSelected ? 'is-on' : ''}"
                  data-act="pick" data-id="${i.id}"
                  role="tab" aria-selected="${isSelected ? 'true' : 'false'}"
                  aria-label="${i.name} (${full ? 'مكتمل' : `${done} من ${fullRoster.length}`})">
            <span class="grades-category-btn__name">${i.name}</span>
          </button>
        `;
      })}
    </div>

    <div class="card card--pad mb-3">
      <div class="hstack gap-3">
        <div>
          <div class="fw-7">${item.name}</div>
          <div class="t-3 fs-sm">
            من <span class="tabular">${item.max}</span> درجة
            ${auto ? html` · ${AUTO_NOTE[item.auto]}` : ''}
          </div>
        </div>
        <div class="push center">
          <div class="stat__val tabular">${gradedCount}/${fullRoster.length}</div>
          <div class="stat__label">مرصود</div>
        </div>
      </div>
    </div>

    <!-- شريط الرصد الجماعي المباشر أعلى جدول/قائمة الدرجات -->
    ${!auto
      ? html`
          <div class="bulk-bar noprint">
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
          <div class="list">
            ${roster.map((s) => {
              const value = itemScore(item, ctx[s.id]);
              const pct = value === null ? null : (value / item.max) * 100;
              const band = masteryBand(pct);
              const isChecked = bulkSelected.has(s.id);
              return html`
                <div class="graderow ${isChecked ? 'is-selected' : ''}">
                  ${!auto
                    ? html`
                        <input type="checkbox" class="noprint" data-act="toggle-student-bulk" data-id="${s.id}"
                               ${isChecked ? 'checked' : ''} aria-label="تحديد ${s.name}">
                      `
                    : ''}
                  <span class="rollno">${s.rollNo ?? '—'}</span>
                  <span class="graderow__name">${s.name}</span>
                  ${auto
                    ? html`
                        <span class="graderow__auto">
                          <span class="badge ${band.badge}">
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
                          <span class="graderow__max tabular">/${item.max}</span>
                        </span>
                      `}
                </div>
              `;
            })}
          </div>
        `}
  `;
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
                  <span class="gtable__roll tabular">${s.rollNo ?? ''}</span>
                  <a href="#/student/${s.id}">${s.name}</a>
                </th>
                ${items.map((i) => {
                  const v = itemScore(i, ctx[s.id]);
                  if (i.auto) {
                    return html`<td class="is-auto tabular">${fmtNum(v)}</td>`;
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
                    <span class="tabular">${fmtNum(t.earned)}</span>
                  </span>
                  <div class="t-3 fs-sm tabular">${fmtPct(t.pct)}</div>
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
