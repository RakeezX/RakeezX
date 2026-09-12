/**
 * الحضور — مرتبط بالحصة لا باليوم.
 *
 * هذا أهم تغيير في الموجة الأولى: حصتان لنفس الفصل في يوم واحد صارتا سجلَّي
 * حضور مستقلَّين، لأن مفتاح الحضور صار at:{studentId}:{sessionId}.
 * وحصة لم تُنفَّذ لا تولّد سجلات حضور إطلاقًا، فلا تُحسب غيابًا على أحد.
 */

import { html, icon, toast, fmtDate, openSheet } from '../lib/dom.js';
import * as store from '../store.js';
import { openSessionEditor } from '../lib/session-editor-ui.js';
import {
  ATTENDANCE, ATTENDANCE_ORDER, SESSION_STATUS,
  todayISO, shiftDate, isWeekend, WEEKDAYS, weekday, normalizeSearchText,
} from '../models.js';
import { repaint } from '../repaint.js';

let date = todayISO();
let activeSessionId = null;
let query = '';

/** يختار حصة اليوم المناسبة: المطلوبة في الرابط، أو الأولى، أو ينشئ واحدة. */
async function ensureActive(tchId) {
  await store.ensureSessionsForDate(date);
  const list = store.sessionsOnFor(tchId, date);
  if (activeSessionId && list.some((s) => s.id === activeSessionId)) return;
  if (list.length) {
    activeSessionId = list[0].id;
    return;
  }
  activeSessionId = null;
}

function renderDateNavigation() {
  const cal = store.calendarDayFor(date);
  const isToday = date === todayISO();
  return html`
    <div class="datebar" aria-label="التنقل بين أيام الحضور">
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
  `;
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
    query = '';
    activeSessionId = p.session ?? null;
    if (p.session) {
      const ses = store.getSession(p.session);
      if (ses) date = ses.date;
    }
    if (!store.isTeachingArchived(p.id)) await ensureActive(p.id);
    repaint();
  },

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(tch)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">سجل الحضور محفوظ للعرض التاريخي، ولا يمكن إضافة رصد جديد.</div></div>`;

    const daySessions = store.sessionsOnFor(tch.id, date);
    const ses = activeSessionId ? store.getSession(activeSessionId) : daySessions[0] ?? null;
    if (!ses) return html`
      ${renderDateNavigation()}
      <div class="empty empty--compact">
        <div class="empty__icon">${icon('calendar')}</div>
        <div class="empty__title">لا توجد حصة مجدولة لهذا اليوم</div>
        <div class="empty__text">انتقل بين الأيام أو أضف حصة أخرى عندما تحتاج إلى رصد مستقل.</div>
      </div>
    `;

    const rosterInfo = store.sessionRoster(ses);
    const roster = rosterInfo.members;
    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${tch.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const meta = SESSION_STATUS[ses.status] ?? SESSION_STATUS.scheduled;
    const isToday = date === todayISO();
    const rosterIds = new Set(roster.map((student) => student.id));
    const records = store.attendanceIn(ses.id).filter((record) => rosterIds.has(record.studentId));
    const byStudent = new Map(records.map((a) => [a.studentId, a]));

    const counts = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const a of records) counts[a.status] = (counts[a.status] ?? 0) + 1;
    const unmarked = roster.length - records.length;

    const blocked = ses.status === 'cancelled_holiday' || ses.status === 'cancelled';

    const q = normalizeSearchText(query);
    const shownRoster = q
      ? roster.filter((s) => normalizeSearchText(s.name).includes(q) || (s.rollNo != null && normalizeSearchText(s.rollNo).includes(q)))
      : roster;

    return html`
      ${renderDateNavigation()}

      ${rosterInfo.source === 'snapshot'
        ? html`<p class="t-3 fs-sm mb-3">كشف هذه الحصة محفوظ عند أول رصد حضور.</p>`
        : ''}

      ${daySessions.length > 1
        ? html`
            <div class="segmented attendance-session-tabs mb-3" role="group" aria-label="اختر حصة اليوم">
              ${daySessions.map(
                (s) => html`
                  <button class="segmented__btn ${s.id === ses.id ? 'is-on' : ''}"
                          data-act="pick-session" data-id="${s.id}" aria-pressed="${s.id === ses.id}">
                    الحصة ${s.period}
                  </button>
                `
              )}
            </div>
          `
        : ''}

      <div class="surface surface--compact surface--flat attendance-session-summary mb-3">
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

            <div class="searchbar attendance-search">
              <span class="searchbar__icon" aria-hidden="true">${icon('search')}</span>
              <input class="searchbar__input" type="search" data-input="search" data-fk="attendance-search"
                     value="${query}" placeholder="ابحث باسم الطالب أو رقمه" autocomplete="off">
              ${query ? html`<button class="iconbtn" data-act="clear-search" aria-label="مسح">${icon('x')}</button>` : ''}
            </div>

            ${shownRoster.length === 0
              ? html`<div class="empty"><div class="empty__text">لا توجد نتائج مطابقة للبحث في كشف الحضور.</div></div>`
              : html`
                  <div class="list">
                    ${shownRoster.map((s) => {
                      const rec = byStudent.get(s.id);
                      const status = rec?.status ?? null;
                      const notesCount = store.notesOf(s.id).length;
                      return html`
                        <div class="att-row ${status ? '' : 'is-unmarked'}">
                          <span class="rollno">${s.rollNo ?? '—'}</span>
                          <span class="att-row__name">${s.name}</span>
                          <button class="att-row__note ${notesCount > 0 ? 'has-notes' : ''}"
                                  data-act="quick-note" data-id="${s.id}"
                                  title="${notesCount > 0 ? `ملاحظات الطالب (${notesCount})` : 'إضافة ملاحظة سريعة'}"
                                  aria-label="ملاحظة لـ ${s.name}">
                            ${icon('note')}
                          </button>
                          <span class="segbtns" role="group" aria-label="حالة حضور ${s.name}">
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
                `}

            <p class="t-3 fs-sm center mt-6">ح حاضر · ت متأخر · ذ مستأذن · غ غائب</p>
          `}
    `;
  },

  actions: {
    search(el) {
      query = el.value.trim();
      repaint();
    },

    'clear-search'() {
      query = '';
      repaint();
    },

    async 'quick-note'(el, ev, params) {
      const student = store.getStudent(el.dataset.id);
      if (!student) return;
      const data = await openSheet({
        title: `ملاحظة: ${student.name}`,
        desc: `إضافة ملاحظة سريعة لسجل الطالب في ${fmtDate(date)}.`,
        body: html`
          <form id="att-quick-note-form">
            <label class="field">
              <span class="field__label">نص الملاحظة</span>
              <textarea class="textarea" id="att-quick-note-text" name="text" rows="4" maxlength="1200"
                        placeholder="اكتب ملاحظة سلوكية أو تعليمية..." required></textarea>
            </label>
          </form>
        `,
        foot: html`
          <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
          <button class="btn btn--primary" form="att-quick-note-form" type="submit">حفظ الملاحظة</button>
        `,
        onMount: (root, done) => {
          root.querySelector('#att-quick-note-text')?.focus();
          root.querySelector('#att-quick-note-form').addEventListener('submit', (event) => {
            event.preventDefault();
            done({ text: String(new FormData(event.target).get('text') ?? '').trim() });
          });
        },
      });

      if (!data || !data.text) return;
      const saved = await store.addStudentNote({
        studentId: student.id,
        text: data.text,
        teachingId: params.id,
        sessionId: activeSessionId ?? undefined,
        date: date ?? todayISO(),
      });
      toast(saved ? 'حُفظت الملاحظة في سجل الطالب' : 'اكتب ملاحظة لا تتجاوز ١٢٠٠ حرفًا', saved ? 'ok' : 'danger');
      repaint();
    },
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

      const result = await openSessionEditor(ses, {
        title: `حالة الحصة ${ses.period}`,
        notCountedHint: 'لا تُحسب حصة فائتة',
        reasonPlaceholder: 'مثال: اجتماع طارئ',
      });
      if (result?.type === 'deleted') {
        activeSessionId = store.sessionsOnFor(ses.teachingId, date)[0]?.id ?? null;
        repaint();
      }
    },
  },
};
