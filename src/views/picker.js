/**
 * القرعة العادلة: لا تُعيد اسمًا حتى يُنادى كل من في الدورة.
 * القرعة العشوائية الساذجة تُخرج الاسم نفسه مرتين متتاليتين فيظن
 * الطلاب أنها محاباة — هذه تحفظ من خرج ولا تعيده حتى تكتمل الجولة.
 */

import { html, icon, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { todayISO, quickLogAttendanceState } from '../models.js';
import { repaint } from '../repaint.js';
import { playPickerSpin, playPickerWinner } from '../lib/sound.js';
import { showWinnerCelebration } from '../lib/effects.js';
import { studentAvatar } from '../lib/avatar.js';

let pool = [];        // من لم يُنادَ بعد في هذه الجولة
let picked = null;    // الطالب المعروض الآن
let history = [];     // من نودي في هذه الجولة، الأحدث أولًا
let spinning = false;
let round = 1;
let currentClassId = null;
let spinTimer = null;
let pendingWinner = false;
let includeAbsent = false; // افتراضيًا: استبعاد الغائبين والمستأذنين

function getAvailableStudents(classId) {
  const roster = store.students(classId);
  if (includeAbsent) return roster;
  const today = todayISO();
  const sessions = store.sessionsOnFor(classId, today);
  const attendance = quickLogAttendanceState(roster, sessions, (sessionId) => store.attendanceIn(sessionId));
  return attendance.filter((a) => !a.unavailable).map((a) => a.student);
}

function reset(classId) {
  pool = getAvailableStudents(classId).map((s) => s.id);
  picked = null;
  history = [];
  round = 1;
  currentClassId = classId;
}

function ensure(classId) {
  if (currentClassId !== classId) {
    reset(classId);
    return;
  }
  const available = getAvailableStudents(classId);
  const known = new Set([...pool, ...history]);
  for (const s of available) {
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
    pendingWinner = false;
  },

  afterPaint(root) {
    if (!pendingWinner) return;
    const stage = root.querySelector('.picker__stage');
    if (stage) {
      showWinnerCelebration(stage);
    }
    pendingWinner = false;
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
    const available = getAvailableStudents(cls.id);
    const excludedCount = roster.length - available.length;
    const student = picked ? store.getStudent(picked) : null;

    return html`
      <div class="classroom-tool-page picker-page">
      <div class="picker">
        <div class="picker__summary" aria-label="حالة الجولة">
          <span>الجولة <strong class="tabular">${round}</strong></span>
          <span>بقي <strong class="tabular">${pool.length}</strong> من <bdi class="tabular">${available.length}</bdi></span>
          ${excludedCount > 0 ? html`<span class="picker__excluded">استُبعد ${excludedCount} غياب/استئذان</span>` : ''}
        </div>
        <div class="picker__stage ${spinning ? 'is-spinning' : ''}" aria-live="polite" aria-busy="${spinning}">
          ${student
            ? html`
                <div class="picker__winner-label">اختيار الجولة</div>
                <div class="picker__avatar">${studentAvatar(student, 'xl')}</div>
                <div class="picker__roll tabular">${student.rollNo ?? ''}</div>
                <h2 class="picker__name">${student.name}</h2>
              `
            : html`<div class="picker__idle">اضغط للقرعة</div>`}
        </div>

        <button class="btn btn--primary btn--lg btn--block picker__go" data-act="spin" ${spinning || !available.length ? 'disabled' : ''}>
          ${icon('picker')} ${picked ? 'التالي' : 'ابدأ القرعة'}
        </button>

        <div class="picker__options noprint">
          <label class="switch">
            <input type="checkbox" data-change="toggle-absent" ${includeAbsent ? 'checked' : ''}>
            <span>تضمين الغائبين والمستأذنين</span>
          </label>
        </div>

        ${picked
          ? html`
              <div class="btn-row mt-4">
                <button class="btn btn--ghost" data-act="award" data-delta="1">
                  ${icon('plus')} إضافة درجة مشاركة
                </button>
                <a class="btn btn--quiet" href="#/student/${picked}?from=picker&cls=${cls.id}">${icon('reports')} تقرير الطالب</a>
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
                    return s ? html`<span class="badge picker-hist-badge">${studentAvatar(s, 'xxs')}<span>${s.name}</span></span>` : '';
                  })}
                </div>
              </div>
          `
          : ''}
      </div>
      </div>
    `;
  },

  actions: {
    'toggle-absent'(el, ev, params) {
      includeAbsent = el.checked;
      reset(params.id);
      repaint();
    },

    spin(el, ev, params) {
      if (spinning) return;
      ensure(params.id);

      const available = getAvailableStudents(params.id);
      if (!available.length) {
        toast('لا يوجد طلاب متاحون للقرعة', 'danger');
        return;
      }

      if (!pool.length) {
        // اكتملت الجولة — ابدأ جولة جديدة
        pool = available.map((s) => s.id);
        history = [];
        round++;
        toast(`اكتملت الجولة — بدأت الجولة ${round}`);
      }

      spinning = true;
      repaint();

      // دوران أطول يمنح ترقبًا ممتعًا (زيادة ١-٢ ثانية)
      let ticks = 0;
      const totalTicks = 18;
      clearInterval(spinTimer);
      spinTimer = setInterval(() => {
        picked = pool[shuffleIndex(pool.length)];
        playPickerSpin();
        repaint();
        if (++ticks >= totalTicks) {
          clearInterval(spinTimer);
          spinTimer = null;
          const chosen = pool[shuffleIndex(pool.length)];
          pool = pool.filter((id) => id !== chosen);
          history.unshift(chosen);
          picked = chosen;
          spinning = false;
          pendingWinner = true;
          playPickerWinner();
          if (navigator.vibrate) navigator.vibrate(20);
          repaint();
        }
      }, 95);
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
      pendingWinner = false;
      toast('جولة جديدة');
      repaint();
    },
  },

  onUnmount() {
    clearInterval(spinTimer);
    spinTimer = null;
    spinning = false;
    pendingWinner = false;
  },
};
