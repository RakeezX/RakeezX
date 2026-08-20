/**
 * تقسيم المجموعات — عشوائي أو متوازن.
 * المتوازن يوزّع المتفوقين والمتعثرين على المجموعات بالتناوب (توزيع الأفعى)
 * فلا تجتمع القوة في مجموعة والضعف في أخرى.
 */

import { html, icon, toast, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal } from '../models.js';
import { repaint } from '../repaint.js';

let size = 4;
let mode = 'balanced';   // balanced | random
let groups = [];

const GROUP_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة',
                     'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function build(classId) {
  const { roster, items, ctx } = store.teachingContext(classId);
  if (!roster.length) return [];

  const count = Math.max(1, Math.ceil(roster.length / size));
  const buckets = Array.from({ length: count }, () => []);

  if (mode === 'random') {
    shuffle(roster).forEach((s, i) => buckets[i % count].push(s));
  } else {
    // رتّب بالأداء ثم وزّع ذهابًا وإيابًا
    const ranked = roster
      .map((s) => ({ s, pct: studentTotal(items, ctx[s.id]).pct ?? -1 }))
      .sort((a, b) => b.pct - a.pct)
      .map((x) => x.s);

    let idx = 0;
    let dir = 1;
    for (const s of ranked) {
      buckets[idx].push(s);
      if (dir === 1 && idx === count - 1) dir = -1;
      else if (dir === -1 && idx === 0) dir = 1;
      else idx += dir;
    }
  }

  return buckets.filter((b) => b.length);
}

export default {
  title: () => 'المجموعات',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,

  onMount() {
    groups = [];
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const roster = store.students(cls.id);
    if (roster.length < 2) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('groups')}</div>
          <div class="empty__title">تحتاج طالبين على الأقل</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const count = Math.ceil(roster.length / size);
    const { items, ctx } = store.teachingContext(cls.id);

    return html`
      <div class="card card--pad mb-3">
        <div class="field">
          <span class="field__label">عدد الطلاب في المجموعة</span>
          <div class="segmented">
            ${[2, 3, 4, 5, 6].map(
              (n) => html`
                <button class="segmented__btn ${size === n ? 'is-on' : ''}" data-act="size" data-n="${n}">
                  ${n}
                </button>
              `
            )}
          </div>
          <div class="field__hint">
            ${roster.length} طالبًا → <span class="tabular">${count}</span> مجموعات
          </div>
        </div>

        <div class="field" style="margin-bottom:0">
          <span class="field__label">طريقة التقسيم</span>
          <div class="segmented">
            <button class="segmented__btn ${mode === 'balanced' ? 'is-on' : ''}" data-act="mode" data-mode="balanced">
              متوازن
            </button>
            <button class="segmented__btn ${mode === 'random' ? 'is-on' : ''}" data-act="mode" data-mode="random">
              عشوائي
            </button>
          </div>
          <div class="field__hint">
            ${mode === 'balanced'
              ? 'يوزّع المتفوقين والمتعثرين على المجموعات بالتساوي حسب الدرجات المرصودة.'
              : 'خلط كامل بلا نظر إلى المستوى.'}
          </div>
        </div>
      </div>

      <button class="btn btn--primary btn--block mb-3" data-act="make">
        ${icon('groups')} ${groups.length ? 'أعد التقسيم' : 'قسّم المجموعات'}
      </button>

      ${groups.length
        ? html`
            <div class="grid grid--auto">
              ${groups.map(
                (g, i) => html`
                  <div class="card card--pad group">
                    <div class="group__head">
                      المجموعة ${GROUP_NAMES[i] ?? i + 1}
                      <span class="badge tabular">${g.length}</span>
                    </div>
                    <div class="stack stack-2 mt-3">
                      ${g.map((s) => {
                        const pct = studentTotal(items, ctx[s.id]).pct;
                        return html`
                          <div class="group__member">
                            <span class="rollno">${s.rollNo ?? '—'}</span>
                            <span class="truncate">${s.name}</span>
                            ${pct !== null
                              ? html`<span class="push t-3 fs-sm tabular">${fmtPct(pct)}</span>`
                              : ''}
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                `
              )}
            </div>
            <button class="btn btn--ghost btn--block mt-4" data-act="print">${icon('print')} اطبع التقسيم</button>
          `
        : ''}
    `;
  },

  actions: {
    size(el) {
      size = Number(el.dataset.n);
      groups = [];
      repaint();
    },

    mode(el) {
      mode = el.dataset.mode;
      groups = [];
      repaint();
    },

    make(el, ev, params) {
      groups = build(params.id);
      toast(`قُسّم الفصل إلى ${groups.length} مجموعات`);
      repaint();
    },

    print() {
      window.print();
    },
  },
};
