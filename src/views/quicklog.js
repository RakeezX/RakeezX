/**
 * الرصد السريع: نقرة على الطالب = نقطة له.
 * صُمّم ليُستعمل والهاتف بيد واحدة أثناء الحصة — لا حقول ولا حفظ يدوي.
 */

import { html, icon, openSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { LOG_TAGS, netPoints, quickLogAttendanceState, todayISO } from '../models.js';
import { repaint } from '../repaint.js';

let kind = 'participation';   // participation | behavior
let withReason = false;

const KIND_LABEL = { participation: 'المشاركة', behavior: 'سجل السلوك فقط' };

function reasonSheet(kindKey, delta) {
  const tags = LOG_TAGS[kindKey][delta > 0 ? 'up' : 'down'];
  return openSheet({
    title: delta > 0 ? 'سبب النقطة' : 'سبب الخصم',
    desc: 'يظهر السبب في تقرير الطالب.',
    body: html`
      <div class="taglist">
        ${tags.map((t) => html`<button class="btn btn--ghost tag-pick" data-tag="${t}">${t}</button>`)}
      </div>
      <label class="field mt-4">
        <span class="field__label">أو اكتب سببًا</span>
        <input class="input" id="tag-other" maxlength="60" autocomplete="off" placeholder="سبب آخر">
      </label>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" id="tag-go">سجّل بلا سبب</button>
    `,
    onMount: (root, done) => {
      root.querySelectorAll('.tag-pick').forEach((b) =>
        b.addEventListener('click', () => done({ tag: b.dataset.tag }))
      );
      const other = root.querySelector('#tag-other');
      root.querySelector('#tag-go').addEventListener('click', () =>
        done({ tag: other.value.trim() })
      );
      other.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done({ tag: other.value.trim() });
      });
    },
  });
}

/**
 * نبضة بصرية تؤكد التسجيل.
 * تُطبَّق بعد إعادة الرسم لا قبلها، لأن الرصد يعيد بناء الشبكة فيضيع أثرها.
 */
let pendingPulse = null;

export default {
  title: () => 'الرصد السريع',
  subtitle: (p) => `${KIND_LABEL[kind]} · ${store.getTeaching(p.id)?.name ?? ''}`,
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="iconbtn" data-act="undo" aria-label="تراجع">${icon('back')}</button>
  `,

  onMount() {
    kind = 'participation';
    withReason = false;
    pendingPulse = null;
  },

  afterPaint(root) {
    if (!pendingPulse) return;
    const card = root.querySelector(`#ql-${CSS.escape(pendingPulse.studentId)}`);
    if (card) {
      card.classList.add(pendingPulse.positive ? 'is-plus' : 'is-minus');
    }
    pendingPulse = null;
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const roster = store.students(cls.id);
    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const today = todayISO();
    const allLogs = store.state.logs.filter((l) => !l.deleted && l.teachingId === cls.id && l.kind === kind);
    const byStudent = new Map();
    for (const l of allLogs) {
      const cur = byStudent.get(l.studentId) ?? { total: 0, today: 0 };
      cur.total += l.delta;
      if (l.date === today) cur.today += l.delta;
      byStudent.set(l.studentId, cur);
    }

    const todayTotal = allLogs.filter((l) => l.date === today).length;
    const attendance = quickLogAttendanceState(roster, store.sessionsOnFor(cls.id, today), (sessionId) => store.attendanceIn(sessionId));
    const displayStudents = [...attendance.filter((entry) => !entry.unavailable), ...attendance.filter((entry) => entry.unavailable)];
    const unavailableCount = attendance.filter((entry) => entry.unavailable).length;

    return html`
      <div class="segmented quicklog__modes mb-3">
        ${Object.entries(KIND_LABEL).map(
          ([k, label]) => html`
            <button class="segmented__btn ${kind === k ? 'is-on' : ''}" data-act="kind" data-kind="${k}">
              ${label}
            </button>
          `
        )}
      </div>

      <div class="hstack gap-2 mb-3 quicklog__filters">
        <label class="switch">
          <input type="checkbox" data-change="reason" ${withReason ? 'checked' : ''}>
          <span>مع سبب</span>
        </label>
        <span class="push t-3 fs-sm">
          اليوم: <span class="tabular fw-7">${todayTotal}</span> رصدة
        </span>
      </div>

      ${unavailableCount ? html`<div class="hstack gap-2 mb-2 fs-xs t-3"><span>الغياب والاستئذان: <strong class="tabular">${unavailableCount}</strong></span></div>` : ''}
      <div class="ql-grid">
        ${displayStudents.map(({ student: s, status, unavailable }) => {
          const c = byStudent.get(s.id) ?? { total: 0, today: 0 };
          const tone = unavailable ? 'is-unavail' : c.total > 0 ? 'is-pos' : c.total < 0 ? 'is-neg' : '';
          const statusBadge = status === 'absent' ? html`<span class="qlcard__status badge badge--danger">غائب</span>` : status === 'excused' ? html`<span class="qlcard__status badge badge--warn">مستأذن</span>` : '';
          return html`
            <div class="qlcard ${tone}" id="ql-${s.id}">
              <button class="qlcard__hit" data-act="plus" data-id="${s.id}"
                      aria-label="نقطة لـ ${s.name}">
                <div class="qlcard__head">
                  ${s.rollNo != null ? html`<span class="qlcard__roll tabular">${s.rollNo}</span>` : ''}
                  <span class="qlcard__name">${s.name}</span>
                  ${statusBadge}
                </div>
                <div class="qlcard__foot">
                  <span class="qlcard__score tabular">${c.total > 0 ? '+' : ''}${c.total}</span>
                  <span class="qlcard__today tabular">${c.today ? (c.today > 0 ? '+' : '') + c.today + ' اليوم' : ''}</span>
                </div>
              </button>
              <button class="qlcard__minus" data-act="minus" data-id="${s.id}"
                      aria-label="خصم من ${s.name}">${icon('minus')}</button>
            </div>
          `;
        })}
      </div>
      <p class="t-3 fs-sm center mt-6">
        نقرة على الطالب = نقطة. النقاط تغذّي بند «المشاركة والتفاعل» في الدرجات تلقائيًا.
      </p>
    `;
  },

  actions: {
    kind(el) {
      kind = el.dataset.kind;
      repaint();
    },

    reason(el) {
      withReason = el.checked;
    },

    async plus(el, ev, params) {
      await record(params.id, el.dataset.id, +1);
    },

    async minus(el, ev, params) {
      await record(params.id, el.dataset.id, -1);
    },

    async undo(el, ev, params) {
      const logs = store.state.logs
        .filter((l) => !l.deleted && l.teachingId === params.id && l.date === todayISO())
        .sort((a, b) => a.updatedAt - b.updatedAt);
      const last = logs.at(-1);
      if (!last) {
        toast('لا شيء للتراجع عنه اليوم');
        return;
      }
      const s = store.getStudent(last.studentId);
      if (await store.patch('logs', last.id, { deleted: true })) {
        toast(`أُلغيت آخر رصدة لـ ${s?.name ?? 'الطالب'}`);
      }
    },
  },
};

async function record(teachingId, studentId, delta) {
  let tag = '';
  if (withReason) {
    const res = await reasonSheet(kind, delta);
    if (res === undefined) return;
    tag = res.tag ?? '';
  }
  pendingPulse = { studentId, positive: delta > 0 };
  if (navigator.vibrate) navigator.vibrate(delta > 0 ? 12 : [8, 40, 8]);
  await store.addLog({ teachingId, studentId, kind, delta, tag });
}
