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
    <div class="datebar attendance-01c__date" aria-label="التنقل بين أيام الحضور">
      <button class="iconbtn attendance-01c__date-nav" data-act="prev-day" aria-label="اليوم السابق">${icon('back')}</button>
      <div class="datebar__mid">
        <div class="datebar__label">${WEEKDAYS[weekday(date)]} · ${fmtDate(date, false)}</div>
        ${cal
          ? html`<div class="datebar__note">${cal.label || 'يوم مميّز في التقويم'}</div>`
          : isWeekend(date)
            ? html`<div class="datebar__note">نهاية الأسبوع</div>`
            : ''}
      </div>
      <button class="iconbtn attendance-01c__date-nav ${isToday ? 'is-off' : ''}" data-act="next-day"
              aria-label="اليوم التالي" ${isToday ? 'disabled' : ''}>${icon('chev')}</button>
    </div>
  `;
}

function renderSessionContext(teaching, session, sessions, status) {
  const section = store.getSection(teaching.sectionId);
  const subject = store.getSubject(teaching.subjectId);
  return html`
    <section class="attendance-01c__context" aria-label="سياق الحصة">
      <div class="attendance-01c__context-top">
        <div class="attendance-01c__identity">
          <span class="attendance-01c__icon" aria-hidden="true">${icon('attendance')}</span>
          <div><h2>حضور ${store.sectionLabel(section)}</h2>
            <p>${subject?.name ?? ''}${session ? ' · قائمة هذه الحصة المحفوظة' : ''}</p></div>
        </div>
        <div class="attendance-01c__context-actions">
          ${session ? html`<button class="btn btn--sm btn--ghost" data-act="session-status">${icon('edit')} تعديل حالة الحصة</button>` : ''}
          <button class="btn btn--sm btn--quiet" data-act="add-period">${icon('plus')} إضافة حصة أخرى</button>
        </div>
      </div>
      ${renderDateNavigation()}
      ${sessions.length > 1 ? html`
        <div class="attendance-01c__session-switch" role="group" aria-label="حصص اليوم">
          ${sessions.map((entry) => html`<button class="attendance-01c__session-chip ${entry.id === session?.id ? 'is-active' : ''}"
            data-act="pick-session" data-id="${entry.id}" aria-pressed="${entry.id === session?.id}">
            الحصة ${entry.period}${entry.startTime ? html` · <bdi>${entry.startTime}</bdi>` : ''}
          </button>`)}
        </div>` : ''}
      ${session ? html`<div class="attendance-01c__session-meta">
        <span class="attendance-01c__status-pill ${status.tone ? `is-${status.tone}` : ''}">${status.label}</span>
        <span class="attendance-01c__meta">الحصة ${session.period}</span>
        ${session.startTime ? html`<span class="attendance-01c__meta"><bdi>${session.startTime}${session.endTime ? `–${session.endTime}` : ''}</bdi></span>` : ''}
        ${session.reason ? html`<span class="attendance-01c__meta">${session.reason}</span>` : ''}
      </div>` : ''}
    </section>`;
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
      <div class="attendance-01c">
      ${renderSessionContext(tch, null, daySessions, SESSION_STATUS.scheduled)}
      <div class="empty empty--compact">
        <div class="empty__icon">${icon('calendar')}</div>
        <div class="empty__title">لا توجد حصة مجدولة لهذا اليوم</div>
        <div class="empty__text">انتقل بين الأيام أو أضف حصة أخرى عندما تحتاج إلى رصد مستقل.</div>
      </div>
      </div>
    `;

    const rosterInfo = store.sessionRoster(ses);
    const roster = rosterInfo.members;
    if (!roster.length) {
      return html`
        <div class="attendance-01c">
        ${renderSessionContext(tch, ses, daySessions, SESSION_STATUS[ses.status] ?? SESSION_STATUS.scheduled)}
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${tch.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
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
      <div class="attendance-01c">
      ${renderSessionContext(tch, ses, daySessions, meta)}

      ${rosterInfo.source === 'snapshot'
        ? html`<p class="t-3 fs-sm mb-3">كشف هذه الحصة محفوظ عند أول رصد حضور.</p>`
        : ''}

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
            <div class="attendance-01c__progress" aria-label="تقدم رصد الحضور">
              <div class="attendance-01c__progress-main">
                <div class="attendance-01c__progress-copy">
                  <strong class="att-pill ${unmarked ? 'att-pill--unmarked' : 'att-pill--done'}" role="status" aria-label="حالة الرصد: ${unmarked ? 'غير مكتمل' : 'مكتمل'}">
                    <span class="tabular">${records.length} من ${roster.length}</span> · ${unmarked ? 'غير مكتمل' : 'مكتمل'}
                  </strong>
                  <span>يتبقى ${unmarked} طلاب</span>
                </div>
                <div class="attendance-01c__progress-track"><i style="width:${roster.length ? records.length / roster.length * 100 : 0}%"></i></div>
              </div>
              <div class="attendance-01c__counts">
                ${ATTENDANCE_ORDER.map((k) => html`<span class="attendance-01c__count">
                  ${ATTENDANCE[k].label} <b class="tabular" data-count="${k}">${counts[k]}</b></span>`)}
                ${!isToday ? html`<button class="btn btn--sm btn--quiet" data-act="go-today">اليوم</button>` : ''}
              </div>
            </div>

            <section class="attendance-01c__roster" aria-label="كشف الحضور">
            <div class="attendance-01c__toolbar">
            <div class="searchbar attendance-search">
              <span class="searchbar__icon" aria-hidden="true">${icon('search')}</span>
              <input class="searchbar__input" type="search" data-input="search" data-fk="attendance-search"
                     value="${query}" placeholder="ابحث بالاسم أو الرقم" aria-label="بحث في قائمة الحضور" autocomplete="off">
              ${query ? html`<button class="iconbtn" data-act="clear-search" aria-label="مسح">${icon('x')}</button>` : ''}
            </div>
            ${unmarked > 0 ? html`<button class="btn btn--primary" data-act="fill-present">
              ${icon('check')} علّم الباقي (${unmarked}) حاضرين</button>` : ''}
            </div>
            <div class="attendance-01c__roster-head" aria-hidden="true"><span>الرقم</span><span>الطالب</span><span>ملاحظة</span><span>الحالة</span></div>

            ${shownRoster.length === 0
              ? html`<div class="empty"><div class="empty__text">لا توجد نتائج مطابقة للبحث في كشف الحضور.</div></div>`
              : html`
                  <div class="list attendance-01c__list">
                    ${shownRoster.map((s) => {
                      const rec = byStudent.get(s.id);
                      const status = rec?.status ?? null;
                      const notesCount = store.notesOf(s.id).length;
                      return html`
                        <div class="att-row attendance-01c__row ${status ? '' : 'is-unmarked'}">
                          <span class="rollno">${s.rollNo ?? '—'}</span>
                          <span class="att-row__name"><strong>${s.name}</strong><small>الرقم ${s.rollNo ?? '—'}</small></span>
                          <button class="att-row__note ${notesCount > 0 ? 'has-notes' : ''}"
                                  data-act="quick-note" data-id="${s.id}"
                                  title="${notesCount > 0 ? `ملاحظات الطالب (${notesCount})` : 'إضافة ملاحظة سريعة'}"
                                  aria-label="ملاحظة لـ ${s.name}">
                            ${icon('note')}
                          </button>
                          <span class="segbtns attendance-01c__status-options" role="group" aria-label="حالة حضور ${s.name}">
                            ${ATTENDANCE_ORDER.map(
                              (k) => html`
                                <button class="segbtn attendance-01c__status ${status === k ? 'is-on' : ''}" data-color="${ATTENDANCE[k].color}"
                                        data-act="set" data-id="${s.id}" data-status="${k}"
                                        title="${ATTENDANCE[k].label}" aria-label="${s.name}: ${ATTENDANCE[k].label}"
                                        aria-pressed="${status === k ? 'true' : 'false'}">
                                  ${ATTENDANCE[k].label}
                                </button>
                              `
                            )}
                          </span>
                        </div>
                      `;
                    })}
                  </div>
                `}

            </section>
          `}
      </div>
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
