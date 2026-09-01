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
      ${mode === 'item' ? itemMode(roster, items, ctx) : tableMode(roster, items, ctx)}
    `;
  },

  actions: {
    mode(el) {
      mode = el.dataset.mode;
      repaint();
    },

    pick(el) {
      activeItemId = el.dataset.id;
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

function itemMode(roster, items, ctx) {
  const item = items.find((i) => i.id === activeItemId);
  const auto = !!item.auto;

  const gradedCount = auto
    ? roster.length
    : roster.filter((s) => {
        const sc = ctx[s.id].scoresByItem[item.id];
        return sc && sc.value !== null && sc.value !== undefined;
      }).length;

  return html`
    <div class="grades-category-nav mb-3" role="tablist" aria-label="بنود التقييم">
      ${items.map((i) => {
        const done = i.auto
          ? roster.length
          : roster.filter((s) => {
              const sc = ctx[s.id].scoresByItem[i.id];
              return sc && sc.value !== null && sc.value !== undefined;
            }).length;
        const full = done === roster.length;
        const isSelected = i.id === activeItemId;
        return html`
          <button class="grades-category-btn chip ${isSelected ? 'is-on' : ''}"
                  data-act="pick" data-id="${i.id}"
                  role="tab" aria-selected="${isSelected ? 'true' : 'false'}"
                  aria-label="${i.name} (${full ? 'مكتمل' : `${done} من ${roster.length}`})">
            <span class="grades-category-btn__name">${i.name}</span>
            <span class="grades-category-btn__meta chip__meta tabular">${full ? '✓' : `${done}/${roster.length}`}</span>
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
          <div class="stat__val tabular">${gradedCount}/${roster.length}</div>
          <div class="stat__label">مرصود</div>
        </div>
      </div>
    </div>

    <div class="list">
      ${roster.map((s) => {
        const value = itemScore(item, ctx[s.id]);
        const pct = value === null ? null : (value / item.max) * 100;
        const band = masteryBand(pct);
        return html`
          <div class="graderow">
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
                           data-change="score" data-keydown="keydown"
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
  `;
}

/* ---------- وضع الجدول ---------- */

function tableMode(roster, items, ctx) {
  const totalMax = items.reduce((n, i) => n + i.max, 0);

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
                             data-change="score" data-keydown="keydown"
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
