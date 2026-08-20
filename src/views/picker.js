/**
 * القرعة العادلة: لا تُعيد اسمًا حتى يُنادى كل من في الدورة.
 * القرعة العشوائية الساذجة تُخرج الاسم نفسه مرتين متتاليتين فيظن
 * الطلاب أنها محاباة — هذه تحفظ من خرج ولا تعيده حتى تكتمل الجولة.
 */

import { html, icon, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { todayISO } from '../models.js';
import { repaint } from '../repaint.js';

let pool = [];        // من لم يُنادَ بعد في هذه الجولة
let picked = null;    // الطالب المعروض الآن
let history = [];     // من نودي في هذه الجولة، الأحدث أولًا
let spinning = false;
let round = 1;
let currentClassId = null;
let spinTimer = null;

function reset(classId) {
  pool = store.students(classId).map((s) => s.id);
  picked = null;
  history = [];
  round = 1;
  currentClassId = classId;
}

function ensure(classId) {
  if (currentClassId !== classId) reset(classId);
  // طلاب أُضيفوا بعد بدء الجولة
  const known = new Set([...pool, ...history]);
  for (const s of store.students(classId)) {
    if (!known.has(s.id)) pool.push(s.id);
  }
}

const shuffleIndex = (n) => Math.floor(Math.random() * n);

export default {
  title: () => 'القرعة',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="iconbtn" data-act="reset" aria-label="جولة جديدة">${icon('picker')}</button>
  `,

  onMount(root, p) {
    reset(p.id);
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const roster = store.students(cls.id);
    if (roster.length < 2) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">تحتاج طالبين على الأقل</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    ensure(cls.id);
    const student = picked ? store.getStudent(picked) : null;

    return html`
      <div class="picker">
        <div class="picker__stage ${spinning ? 'is-spinning' : ''}">
          ${student
            ? html`
                <div class="picker__roll tabular">${student.rollNo ?? ''}</div>
                <div class="picker__name">${student.name}</div>
              `
            : html`<div class="picker__idle">اضغط للقرعة</div>`}
        </div>

        <button class="btn btn--primary btn--lg btn--block picker__go" data-act="spin" ${spinning ? 'disabled' : ''}>
          ${icon('picker')} ${picked ? 'التالي' : 'ابدأ القرعة'}
        </button>

        <div class="hstack gap-2 mt-4 fs-sm t-3">
          <span>الجولة <span class="tabular fw-7">${round}</span></span>
          <span class="push">
            بقي <span class="tabular fw-7">${pool.length}</span> من <span class="tabular">${roster.length}</span>
          </span>
        </div>

        ${picked
          ? html`
              <div class="btn-row mt-4">
                <button class="btn btn--ghost" data-act="award" data-delta="1">
                  ${icon('plus')} نقطة مشاركة
                </button>
                <a class="btn btn--quiet" href="#/student/${picked}">${icon('reports')} تقريره</a>
              </div>
            `
          : ''}

        ${history.length
          ? html`
              <div class="section">
                <div class="section__head"><div class="section__title">نودوا في هذه الجولة</div></div>
                <div class="hstack gap-2 wrap">
                  ${history.map((id) => {
                    const s = store.getStudent(id);
                    return s ? html`<span class="badge">${s.name}</span>` : '';
                  })}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  },

  actions: {
    spin(el, ev, params) {
      if (spinning) return;
      ensure(params.id);

      if (!pool.length) {
        // اكتملت الجولة — ابدأ جولة جديدة
        pool = store.students(params.id).map((s) => s.id);
        history = [];
        round++;
        toast(`اكتملت الجولة — بدأت الجولة ${round}`);
      }

      spinning = true;
      repaint();

      // دوران قصير يعطي الطلاب لحظة ترقّب
      let ticks = 0;
      clearInterval(spinTimer);
      spinTimer = setInterval(() => {
        picked = pool[shuffleIndex(pool.length)];
        repaint();
        if (++ticks >= 8) {
          clearInterval(spinTimer);
          spinTimer = null;
          const chosen = pool[shuffleIndex(pool.length)];
          pool = pool.filter((id) => id !== chosen);
          history.unshift(chosen);
          picked = chosen;
          spinning = false;
          if (navigator.vibrate) navigator.vibrate(20);
          repaint();
        }
      }, 70);
    },

    async award(el, ev, params) {
      if (!picked) return;
      await store.addLog({
        teachingId: params.id,
        studentId: picked,
        kind: 'participation',
        delta: 1,
        tag: 'قرعة',
        date: todayISO(),
      });
      const s = store.getStudent(picked);
      toast(`نقطة لـ ${s?.name ?? 'الطالب'}`);
    },

    reset(el, ev, params) {
      reset(params.id);
      toast('جولة جديدة');
      repaint();
    },
  },

  onUnmount() {
    clearInterval(spinTimer);
    spinTimer = null;
    spinning = false;
  },
};
