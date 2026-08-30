/**
 * الحضور — مرتبط بالحصة لا باليوم.
 *
 * هذا أهم تغيير في الموجة الأولى: حصتان لنفس الفصل في يوم واحد صارتا سجلَّي
 * حضور مستقلَّين، لأن مفتاح الحضور صار at:{studentId}:{sessionId}.
 * وحصة لم تُنفَّذ لا تولّد سجلات حضور إطلاقًا، فلا تُحسب غيابًا على أحد.
 */

import { html, icon, toast, fmtDate, openSheet, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import {
  ATTENDANCE, ATTENDANCE_ORDER, SESSION_STATUS, SESSION_STATUS_ORDER,
  todayISO, shiftDate, isWeekend, WEEKDAYS, weekday,
} from '../models.js';
import { repaint } from '../repaint.js';

let date = todayISO();
let activeSessionId = null;

/** يختار حصة اليوم المناسبة: المطلوبة في الرابط، أو الأولى، أو ينشئ واحدة. */
async function ensureActive(tchId) {
  const list = store.sessionsOnFor(tchId, date);
  if (activeSessionId && list.some((s) => s.id === activeSessionId)) return;
  if (list.length) {
    activeSessionId = list[0].id;
    return;
  }
  const ses = await store.ensureSession(tchId, date, 1);
  activeSessionId = ses.id;
}

export default {
  title: () => 'الحضور',
  subtitle: (p) => {
    const ses = activeSessionId ? store.getSession(activeSessionId) : null;
    const d = date === todayISO() ? 'اليوم' : fmtDate(date);
    return ses ? `${d} · الحصة ${ses.period}` : d;
  },
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="iconbtn" data-act="session-status" aria-label="حالة الحصة">${icon('session')}</button>
    <button class="iconbtn" data-act="add-period" aria-label="حصة أخرى اليوم">${icon('plus')}</button>
  `,

  async onMount(root, p) {
    date = todayISO();
    activeSessionId = p.session ?? null;
    if (p.session) {
      const ses = store.getSession(p.session);
      if (ses) date = ses.date;
    }
    await ensureActive(p.id);
    repaint();
  },

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const roster = store.students(tch.id);
    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${tch.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const daySessions = store.sessionsOnFor(tch.id, date);
    const ses = activeSessionId ? store.getSession(activeSessionId) : daySessions[0] ?? null;
    if (!ses) return html`<div class="card card--pad center t-3">جارٍ تجهيز الحصة…</div>`;

    const meta = SESSION_STATUS[ses.status] ?? SESSION_STATUS.scheduled;
    const cal = store.calendarDayFor(date);
    const isToday = date === todayISO();
    const records = store.attendanceIn(ses.id);
    const byStudent = new Map(records.map((a) => [a.studentId, a]));

    const counts = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const a of records) counts[a.status] = (counts[a.status] ?? 0) + 1;
    const unmarked = roster.length - records.length;

    const blocked = ses.status === 'cancelled_holiday' || ses.status === 'cancelled';

    return html`
      <div class="datebar">
        <button class="iconbtn" data-act="prev-day" aria-label="اليوم السابق">${icon('back')}</button>
        <div class="datebar__mid">
          <div class="datebar__label">${WEEKDAYS[weekday(date)]} · ${fmtDate(date, false)}</div>
          ${cal
            ? html`<div class="datebar__note">${cal.label || 'يوم مميّز في التقويم'}</div>`
            : isWeekend(date)
              ? html`<div class="datebar__note">نهاية الأسبوع</div>`
              : ''}
        </div>
        <button class="iconbtn ${isToday ? 'is-off' : ''}" data-act="next-day"
                aria-label="اليوم التالي" ${isToday ? 'disabled' : ''}>${icon('chev')}</button>
      </div>

      ${daySessions.length > 1
        ? html`
            <div class="segmented mb-3">
              ${daySessions.map(
                (s) => html`
                  <button class="segmented__btn ${s.id === ses.id ? 'is-on' : ''}"
                          data-act="pick-session" data-id="${s.id}">
                    الحصة ${s.period}
                  </button>
                `
              )}
            </div>
          `
        : ''}

      <div class="card card--pad mb-3">
        <div class="hstack gap-2 wrap">
          <span class="badge ${meta.tone ? 'badge--' + meta.tone : ''}">${meta.label}</span>
          ${ses.reason ? html`<span class="t-3 fs-sm">${ses.reason}</span>` : ''}
          <button class="btn btn--sm btn--quiet push" data-act="session-status">
            ${icon('edit')} حالة الحصة
          </button>
        </div>
      </div>

      ${blocked
        ? html`
            <div class="empty">
              <div class="empty__icon">${icon('calendar')}</div>
              <div class="empty__title">${meta.label}</div>
              <div class="empty__text">
                ${ses.reason || 'هذه الحصة لم تُنفَّذ'} — لا يُسجَّل حضور ولا غياب،
                ولا تُحسب حصة فائتة.
              </div>
              <button class="btn btn--ghost" data-act="session-status">تغيير حالة الحصة</button>
            </div>
          `
        : html`
            <div class="hstack gap-2 wrap mb-3">
              ${ATTENDANCE_ORDER.map((k) =>
                counts[k]
                  ? html`<span class="badge" style="background:var(--${ATTENDANCE[k].color}-soft);color:var(--${ATTENDANCE[k].color})">
                      ${ATTENDANCE[k].label} <span class="tabular">${counts[k]}</span>
                    </span>`
                  : ''
              )}
              <span class="att-pill ${unmarked ? 'att-pill--unmarked' : 'att-pill--done'}" role="status" aria-label="حالة الرصد: ${unmarked ? 'غير مكتمل' : 'مكتمل'}">
                ${unmarked ? html`<span class="att-pill__dot"></span>` : icon('check')}
                <span>${unmarked ? 'غير مكتمل' : 'مكتمل'}</span>
                <span class="tabular">${records.length}/${roster.length}</span>
              </span>
              ${!isToday ? html`<button class="btn btn--sm btn--quiet push" data-act="go-today">اليوم</button>` : ''}
            </div>

            ${unmarked > 0
              ? html`
                  <button class="btn btn--primary btn--block mb-3" data-act="fill-present">
                    ${icon('check')} علّم الباقي (${unmarked}) حاضرين
                  </button>
                `
              : ''}

            <div class="list">
              ${roster.map((s) => {
                const rec = byStudent.get(s.id);
                const status = rec?.status ?? null;
                return html`
                  <div class="att-row ${status ? '' : 'is-unmarked'}">
                    <span class="rollno">${s.rollNo ?? '—'}</span>
                    <span class="att-row__name">${s.name}</span>
                    <span class="segbtns">
                      ${ATTENDANCE_ORDER.map(
                        (k) => html`
                          <button class="segbtn ${status === k ? 'is-on' : ''}" data-color="${ATTENDANCE[k].color}"
                                  data-act="set" data-id="${s.id}" data-status="${k}"
                                  title="${ATTENDANCE[k].label}" aria-label="${s.name}: ${ATTENDANCE[k].label}"
                                  aria-pressed="${status === k ? 'true' : 'false'}">
                            ${ATTENDANCE[k].short}
                          </button>
                        `
                      )}
                    </span>
                  </div>
                `;
              })}
            </div>

            <p class="t-3 fs-sm center mt-6">ح حاضر · ت متأخر · ذ مستأذن · غ غائب</p>
          `}
    `;
  },

  actions: {
    async set(el) {
      if (!activeSessionId) return;
      await store.setAttendance(activeSessionId, el.dataset.id, el.dataset.status);
    },

    async 'fill-present'() {
      if (!activeSessionId) return;
      const n = await store.fillAttendance(activeSessionId, 'present');
      toast(`رُصد ${n} طالبًا حاضرين`);
    },

    async 'prev-day'(el, ev, params) {
      date = shiftDate(date, -1);
      activeSessionId = null;
      await ensureActive(params.id);
      repaint();
    },

    async 'next-day'(el, ev, params) {
      if (date === todayISO()) return;
      date = shiftDate(date, 1);
      activeSessionId = null;
      await ensureActive(params.id);
      repaint();
    },

    async 'go-today'(el, ev, params) {
      date = todayISO();
      activeSessionId = null;
      await ensureActive(params.id);
      repaint();
    },

    'pick-session'(el) {
      activeSessionId = el.dataset.id;
      repaint();
    },

    /** حصة إضافية في نفس اليوم — الحالة التي كان النموذج القديم يفقدها. */
    async 'add-period'(el, ev, params) {
      const existing = store.sessionsOnFor(params.id, date);
      const nextPeriod = Math.max(0, ...existing.map((s) => s.period)) + 1;
      const ses = await store.ensureSession(params.id, date, nextPeriod);
      activeSessionId = ses.id;
      toast(`أُضيفت الحصة ${nextPeriod} في هذا اليوم`);
      repaint();
    },

    async 'session-status'() {
      if (!activeSessionId) return;
      const ses = store.getSession(activeSessionId);
      if (!ses) return;

      const picked = await openSheet({
        title: `حالة الحصة ${ses.period}`,
        desc: 'الحصة غير المنفّذة لا تُسجَّل غيابًا على الطلاب.',
        body: html`
          <div class="stack stack-2">
            ${SESSION_STATUS_ORDER.map(
              (k) => html`
                <button class="radiocard radiocard--btn ${ses.status === k ? 'is-on' : ''}" data-pick="${k}">
                  <span class="radiocard__body">
                    <span class="radiocard__title">${SESSION_STATUS[k].label}</span>
                    <span class="radiocard__hint">
                      ${SESSION_STATUS[k].counts ? 'تُحسب في سجل الحصص' : 'لا تُحسب حصة فائتة'}
                    </span>
                  </span>
                </button>
              `
            )}
          </div>
          <label class="field mt-4">
            <span class="field__label">السبب (اختياري)</span>
            <input class="input" id="ses-reason" value="${ses.reason ?? ''}" maxlength="120"
                   placeholder="مثال: اجتماع طارئ">
          </label>
        `,
        onMount: (root, done) => {
          const reason = root.querySelector('#ses-reason');
          root.querySelectorAll('[data-pick]').forEach((b) =>
            b.addEventListener('click', () => done({ status: b.dataset.pick, reason: reason.value.trim() }))
          );
        },
      });

      if (!picked) return;
      await store.setSessionStatus(activeSessionId, picked.status, picked.reason);
      toast(`الحصة: ${SESSION_STATUS[picked.status].label}`);
    },
  },
};
