/**
 * الحضور — مرتبط بالحصة لا باليوم.
 *
 * هذا أهم تغيير في الموجة الأولى: حصتان لنفس الفصل في يوم واحد صارتا سجلَّي
 * حضور مستقلَّين، لأن مفتاح الحضور صار at:{studentId}:{sessionId}.
 * وحصة لم تُنفَّذ لا تولّد سجلات حضور إطلاقًا، فلا تُحسب غيابًا على أحد.
 */

import { html, icon, toast, fmtDate, fmtSessionTime, fmtTimeRange, openSheet } from '../lib/dom.js';
import { visibleLatinDigits } from '../lib/visible-numerals.js';
import * as store from '../store.js';
import { compactSectionLabel } from '../lib/class-order.js';
import { compactSubjectLabel } from '../lib/subject-catalog.js';
import { openSessionEditor } from '../lib/session-editor-ui.js';
import { isBeforeScheduledStart } from '../lib/session-start-ui.js';
import {
  ATTENDANCE, ATTENDANCE_ORDER, SESSION_STATUS,
  todayISO, shiftDate, isWeekend, WEEKDAYS, weekday, normalizeSearchText, displayRoster,
} from '../models.js';
import { repaint } from '../repaint.js';
import { parseTeamsAttendance, matchTeamsAttendance } from '../lib/teams-attendance-csv.js';

let date = todayISO();
let activeSessionId = null;
let query = '';
let importOpen = false;

// AI N143: session membership AND current active enrollment are required.
function teamsRoster(teachingId, session) {
  const active = new Set(store.students(teachingId).map(s => s.id));
  return store.sessionRoster(session).members.filter(s => active.has(s.id));
}

async function openTeamsImport(teachingId) {
  if (importOpen || !activeSessionId) return;
  const sessionId = activeSessionId, selectedDate = date, workspace = store.getActiveWorkspace();
  const mount = opening, timing = store.getSession(sessionId);
  const startTime = timing?.startTime, endTime = timing?.endTime;
  const current = () => {
    const session = store.getSession(sessionId);
    if (mount?.signal.aborted || opening !== mount || activeSessionId !== sessionId || date !== selectedDate ||
        store.getActiveWorkspace() !== workspace || !session || session.teachingId !== teachingId ||
        session.date !== selectedDate || session.startTime !== startTime || session.endTime !== endTime ||
        ['cancelled', 'cancelled_holiday'].includes(session.status)) throw Error('TEAMS_CONTEXT_CHANGED');
    store.assertClassOperationsAccess(teachingId);
    return session;
  };
  try { current(); } catch { toast('تحقق من الحساب والحصة النشطة قبل الاستيراد.', 'danger'); return; }
  const owner = importOpen = {};
  let disposed = false;
  const dispose = () => { disposed = true; if (importOpen === owner) importOpen = false; };
  mount?.signal.addEventListener('abort', dispose, {once: true});
  try {
    await openSheet({
      title: 'استيراد حضور Teams',
      desc: `الحصة ${timing.period} · ${selectedDate}. اختيار التقرير يرصد النتائج مباشرة حسب توقيت الحصة المحفوظ، ويحفظ الرصد السابق.`,
      body: html`<label class="field"><span class="field__label">تقرير حضور Teams (.csv، حتى 1MB و300 صف)</span>
        <input class="input" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" data-teams-file></label>
        <div data-teams-result role="status" aria-live="polite"></div>`,
      foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>`,
      onMount(root) {
        let busy = false, completed = false;
        const input = root.querySelector('[data-teams-file]'), result = root.querySelector('[data-teams-result]');
        const verify = () => {
          if (disposed || !root.isConnected) throw Error('TEAMS_CLOSED');
          return current();
        };
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (!file || busy || completed || disposed) return;
          busy = true; input.disabled = true;
          result.textContent = 'جارٍ قراءة التقرير ورصد النتائج…';
          let rows = [], saved = 0, skipped = 0, failed = false;
          const counts = {present: 0, late: 0, absent: 0};
          try {
            if (file.size > 1024 * 1024) throw Error('TEAMS_FILE_INVALID');
            const buffer = await file.arrayBuffer();
            const session = verify();
            // Only IDs/statuses survive classification; release report identities before writes.
            rows = matchTeamsAttendance(parseTeamsAttendance(buffer), teamsRoster(teachingId, session), session);
          } catch (error) {
            if (root.isConnected) result.textContent = error.message === 'TEAMS_CLASS_WINDOW_INVALID'
              ? 'لم يُرصد شيء. تحقق من توقيت الحصة المحفوظ وتاريخ التقرير وصيغة أوقاته.'
              : 'لم يُرصد شيء. تعذّر قراءة التقرير أو تغيّر الحساب أو الحصة؛ اختر تقرير Teams الأصلي حتى 1MB و300 صف.';
            return;
          } finally {
            input.value = '';
            if (!rows.length) { busy = false; input.disabled = disposed; }
          }
          const invalidTiming = rows.filter(row => row.state === 'invalid').length;
          completed = true; input.disabled = true;
          skipped = rows.filter(row => !row.studentId).length;
          const selected = rows.filter(row => row.studentId);
          try {
            for (const row of selected) {
              verify();
              if (!teamsRoster(teachingId, current()).some(student => student.id === row.studentId)) throw Error('TEAMS_ROSTER_CHANGED');
              const outcome = await store.fillSelectedAttendance(sessionId, [row.studentId], {
                status: row.status, verifyCurrent: verify,
              });
              saved += outcome.saved; counts[row.status] += outcome.saved; skipped += outcome.skipped;
            }
          } catch { failed = true; }
          const remaining = rows.length - saved - skipped;
          result.textContent = `حاضر ${counts.present} · متأخر ${counts.late} · غائب ${counts.absent} · متجاوز ${skipped} · غير محفوظ ${remaining}. ${failed ? 'توقف الرصد بسبب تغير السياق أو تعذّر الحفظ؛ راجع سجل الحصة قبل أي محاولة جديدة.' : 'اكتمل الرصد. بقية الطلاب دون تغيير.'}${invalidTiming ? ' توقيت ناقص لبعض المشاركين؛ تحقق من توقيت الحصة وصيغة أوقات التقرير.' : ''}`;
          rows = []; busy = false;
          repaint();
        });
      },
    });
  } finally { mount?.signal.removeEventListener('abort', dispose); dispose(); }
}

// AI N144: page-owned intent survives a changed-markup repaint, never a changed
// workspace/visit/session. Only setAttendance owns persistence and write guards.
let interactionScope = 0;
let interactionListeners = null;
const attendanceWrites = new Map();
const attendanceFeedback = new Map();
const writeKey = (workspace, sessionId, studentId) => JSON.stringify([workspace?.databaseName, sessionId, studentId]);
function invalidateAttendanceIntent() {
  if ([...attendanceWrites.values()].some(entry => entry.scope === interactionScope && entry.desired !== entry.submitted)) {
    toast('تغيّر سياق الحضور؛ لم يُرسل الاختيار المنتظر', 'info');
  }
  interactionScope++;
  attendanceFeedback.clear();
}
function attendanceIntent(el, params) {
  const workspace = store.getActiveWorkspace();
  const session = store.getSession(el.dataset.session);
  if (!el.isConnected || !workspace || !ATTENDANCE_ORDER.includes(el.dataset.status) ||
      el.dataset.scope !== String(interactionScope) || el.dataset.teaching !== params.id ||
      el.dataset.session !== activeSessionId || el.dataset.date !== date ||
      session?.date !== date || session?.teachingId !== params.id || store.isTeachingArchived(params.id)) return null;
  return { workspace, scope: interactionScope, sessionId: session.id, teachingId: params.id,
    date, studentId: el.dataset.id, status: el.dataset.status };
}
function currentAttendanceIntent(intent) {
  const session = store.getSession(intent.sessionId);
  return store.getActiveWorkspace() === intent.workspace && interactionScope === intent.scope &&
    activeSessionId === intent.sessionId && date === intent.date && session?.date === intent.date &&
    session?.teachingId === intent.teachingId && !store.isTeachingArchived(intent.teachingId);
}
async function acceptAttendanceIntent(intent) {
  if (!currentAttendanceIntent(intent)) return;
  const key = writeKey(intent.workspace, intent.sessionId, intent.studentId);
  const pending = attendanceWrites.get(key);
  if (pending) {
    if (pending.scope !== intent.scope || pending.workspace !== intent.workspace) {
      toast('جارٍ إنهاء الرصد السابق؛ انتظر ثم اختر الحالة', 'info');
      return;
    }
    pending.desired = intent.status;
    repaint();
    return;
  }
  const entry = { ...intent, desired: intent.status, phase: 'pending' };
  attendanceWrites.set(key, entry);
  attendanceFeedback.set(key, entry);
  repaint();
  try {
    while (currentAttendanceIntent(entry)) {
      const status = entry.desired;
      entry.submitted = status;
      const saved = await store.setAttendance(entry.sessionId, entry.studentId, status);
      // A null/failed/uncertain outcome is terminal for this gesture chain.
      // Never replay an intermediate request or imply a cloud acknowledgement.
      const persisted = store.attendanceIn(entry.sessionId).find(record => record.studentId === entry.studentId);
      if (!saved || saved.status !== status || persisted?.status !== status) throw new Error('ATTENDANCE_NOT_CONFIRMED');
      if (!currentAttendanceIntent(entry)) return;
      if (entry.desired !== status) continue;
      entry.phase = 'saved';
      entry.status = status;
      return;
    }
  } catch {
    if (currentAttendanceIntent(entry)) {
      entry.phase = 'failed';
      toast('تعذّر تأكيد حفظ الحضور؛ تحقق من الحالة ثم أعد الاختيار', 'danger');
    }
  } finally {
    attendanceWrites.delete(key);
    if (currentAttendanceIntent(entry)) repaint();
  }
}
function mountAttendancePointers(root, params) {
  interactionListeners?.abort();
  const controller = interactionListeners = new AbortController();
  const options = { capture: true, signal: controller.signal };
  let press = null, suppressClick = null;
  const buttonAt = target => target?.closest?.('.attendance-01c [data-act="set"]');
  root.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) { press = null; return; }
    const button = buttonAt(event.target);
    const intent = button && attendanceIntent(button, params);
    press = intent ? { intent, pointerId: event.pointerId, x: event.clientX, y: event.clientY } : null;
  }, options);
  // The main root survives region replacement. On release require the same
  // visible choice under the pointer; a drag, scroll or context change cancels.
  document.addEventListener('pointermove', event => {
    if (press?.pointerId === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) press.cancelled = true;
  }, options);
  document.addEventListener('pointercancel', () => { press = null; }, options);
  document.addEventListener('pointerup', event => {
    if (press?.pointerId !== event.pointerId) return;
    const prior = press; press = null;
    suppressClick = { pointerId: event.pointerId, until: performance.now() + 500 };
    const button = buttonAt(document.elementFromPoint(event.clientX, event.clientY));
    const next = button && attendanceIntent(button, params);
    if (next && !prior.cancelled && Math.hypot(event.clientX - prior.x, event.clientY - prior.y) <= 12 &&
        currentAttendanceIntent(prior.intent) && next.studentId === prior.intent.studentId && next.status === prior.intent.status) {
      void acceptAttendanceIntent(prior.intent);
    }
  }, options);
  document.addEventListener('click', event => {
    if (suppressClick && performance.now() <= suppressClick.until && event.detail > 0 && event.pointerId === suppressClick.pointerId) {
      suppressClick = null;
      event.preventDefault();
      event.stopPropagation();
    }
  }, options);
}

// Abort stale mounts/date selections before they can adopt another occurrence.
let opening = null;
const dayOptions = (tchId, day) => store.operationalSessionsOn(day).filter(s => s.teachingId === tchId);
async function ensureActive(tchId) {
  invalidateAttendanceIntent();
  opening?.abort();
  const controller = opening = new AbortController();
  const selectedDate = date;
  const options = dayOptions(tchId, selectedDate);
  const selected = activeSessionId ? options.find(s => s.id === activeSessionId) : options[0];
  activeSessionId = null;
  if (!selected) return;
  try {
    if (selected.projected) await store.ensureSessionsForDate(selectedDate, {
      teachingId: tchId, period: selected.period, signal: controller.signal,
    });
    if (!controller.signal.aborted && date === selectedDate) {
      const saved = store.getSession(selected.id);
      if (saved?.teachingId === tchId && saved.date === selectedDate) activeSessionId = saved.id;
    }
  } catch (error) {
    if (!controller.signal.aborted) toast(error.message || 'تعذّر فتح الحصة', 'danger');
  }
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
          <div class="attendance-01c__names"><h2 title="حضور ${visibleLatinDigits(store.sectionLabel(section))}" aria-label="حضور ${visibleLatinDigits(store.sectionLabel(section))}">حضور <span class="n133-full-name" aria-hidden="true">${visibleLatinDigits(store.sectionLabel(section))}</span><span class="n133-short-name" aria-hidden="true">${visibleLatinDigits(compactSectionLabel(section))}</span></h2>
            <p title="${visibleLatinDigits(subject?.name ?? '')}" ><span class="sr-only">${visibleLatinDigits(subject?.name ?? '')}</span><span class="n133-full-name" aria-hidden="true">${visibleLatinDigits(subject?.name ?? '')}</span><span class="n133-short-name" aria-hidden="true">${visibleLatinDigits(compactSubjectLabel(subject, store.subjects()))}</span>${session ? ' · قائمة هذه الحصة المحفوظة' : ''}</p></div>
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
            الحصة ${visibleLatinDigits(entry.period)}${entry.startTime ? html` · <bdi dir="ltr">${fmtSessionTime(entry.startTime)}</bdi>` : ''}
          </button>`)}
        </div>` : ''}
      ${session ? html`<div class="attendance-01c__session-meta">
        <span class="attendance-01c__status-pill ${status.tone ? `is-${status.tone}` : ''}">${status.label}</span>
        <span class="attendance-01c__meta">الحصة ${visibleLatinDigits(session.period)}</span>
        ${session.startTime ? html`<span class="attendance-01c__meta"><bdi dir="ltr">${fmtTimeRange(session.startTime, session.endTime)}</bdi></span>` : ''}
        ${status.reason ? html`<span class="attendance-01c__meta">${status.reason}</span>` : ''}
      </div>` : ''}
    </section>`;
}

export default {
  title: () => 'الحضور',
  subtitle: (p) => {
    const ses = activeSessionId ? store.getSession(activeSessionId) : null;
    const d = date === todayISO() ? 'اليوم' : fmtDate(date);
    return ses ? `${d} · الحصة ${visibleLatinDigits(ses.period)}` : d;
  },
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="iconbtn" data-act="session-status" aria-label="حالة الحصة">${icon('session')}</button>
    <button class="iconbtn" data-act="add-period" aria-label="حصة أخرى اليوم">${icon('plus')}</button>
  `,

  async onMount(root, p) {
    invalidateAttendanceIntent();
    mountAttendancePointers(root, p);
    date = todayISO();
    query = '';
    activeSessionId = p.session ?? null;
    if (p.session) {
      const ses = store.getSession(p.session);
      if (ses?.teachingId === p.id) date = ses.date;
    }
    if (!store.isTeachingArchived(p.id)) await ensureActive(p.id);
    repaint();
  },

  onUnmount() {
    opening?.abort(); interactionListeners?.abort();
    invalidateAttendanceIntent(); activeSessionId = null;
  },

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(tch)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">سجل الحضور محفوظ للعرض التاريخي، ولا يمكن إضافة رصد جديد.</div></div>`;

    const daySessions = dayOptions(tch.id, date);
    const ses = activeSessionId ? store.getSession(activeSessionId) : null;
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
    const roster = displayRoster(rosterInfo.members, store.students(tch.id));
    if (!roster.length) {
      return html`
        <div class="attendance-01c">
        ${renderSessionContext(tch, ses, daySessions, store.sessionStatusPresentation(ses))}
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${tch.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
        </div>
      `;
    }

    const meta = store.sessionStatusPresentation(ses);
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
      ? roster.filter((s) => normalizeSearchText(s.name).includes(q) || (s.displayNo != null && normalizeSearchText(s.displayNo).includes(q)))
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
                ${meta.reason || 'هذه الحصة لم تُنفَّذ'} — لا يُسجَّل حضور ولا غياب،
                ولا تُحسب حصة فائتة.
              </div>
              <button class="btn btn--ghost" data-act="session-status">تغيير حالة الحصة</button>
            </div>
          `
        : html`
            ${isBeforeScheduledStart(ses) ? html`<aside class="attendance-prestart" aria-label="موعد الحصة">
              <span aria-hidden="true">${icon('clock')}</span>
              <div><strong>لم يبدأ وقت الحصة بعد</strong><p>يمكنك رصد الحضور الآن إذا كنت تقصد ذلك.</p></div>
            </aside>` : ''}
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
            <button class="btn btn--sm btn--ghost" data-act="import-teams">استيراد Teams</button>
            ${unmarked > 0 ? html`<button class="btn btn--primary attendance-fill-trigger" data-act="fill-remaining"
              popovertarget="attendance-fill-choices" aria-controls="attendance-fill-choices">
              رصد الباقين (${unmarked}) <span aria-hidden="true">▾</span></button>
              <div id="attendance-fill-choices" class="attendance-fill-choices" popover="auto"
                role="group" aria-label="رصد الباقين" data-session="${ses.id}">
                <button class="btn btn--quiet" data-act="fill-choice" data-attendance-choice="present" autofocus>حاضرين</button>
                <button class="btn btn--quiet" data-act="fill-choice" data-attendance-choice="absent">غائبين</button>
              </div>` : ''}
            </div>
            <div class="attendance-01c__roster-head" aria-hidden="true"><span>الرقم</span><span>الطالب</span><span>ملاحظة</span><span>الحالة</span></div>

            ${shownRoster.length === 0
              ? html`<div class="empty"><div class="empty__text">لا توجد نتائج مطابقة للبحث في كشف الحضور.</div></div>`
              : html`
                  <div class="list attendance-01c__list">
                    ${shownRoster.map((s) => {
                      const rec = byStudent.get(s.id);
                      const status = rec?.status ?? null;
                      const feedback = attendanceFeedback.get(writeKey(store.getActiveWorkspace(), ses.id, s.id));
                      const feedbackText = feedback?.scope !== interactionScope ? '' : feedback.phase === 'pending'
                        ? `جارٍ الحفظ: ${ATTENDANCE[feedback.desired].label}…`
                        : feedback.phase === 'failed' ? 'تعذّر تأكيد الحفظ؛ أعد الاختيار'
                        : feedback.status === status ? `حُفظ ${ATTENDANCE[status].label}` : '';
                      const notesCount = store.notesOf(s.id).length;
                      return html`
                        <div class="att-row attendance-01c__row ${status ? '' : 'is-unmarked'}">
                          <span class="rollno">${s.displayNo ?? '—'}</span>
                          <span class="att-row__name"><strong>${s.name}</strong><small>الرقم ${s.displayNo ?? '—'}</small><small data-feedback="${s.id}" role="status" aria-live="polite">${feedbackText}</small></span>
                          <button class="att-row__note ${notesCount > 0 ? 'has-notes' : ''}"
                                  data-act="quick-note" data-id="${s.id}"
                                  title="${notesCount > 0 ? `ملاحظات الطالب (${notesCount})` : 'إضافة ملاحظة سريعة'}"
                                  aria-label="ملاحظة لـ ${s.name}">
                            ${icon('note')}
                          </button>
                          <span class="segbtns attendance-01c__status-options" role="group" aria-label="حالة حضور ${s.name}" aria-busy="${feedback?.scope === interactionScope && feedback.phase === 'pending'}">
                            ${ATTENDANCE_ORDER.map(
                              (k) => html`
                                <button class="segbtn attendance-01c__status ${status === k ? 'is-on' : ''}" data-color="${ATTENDANCE[k].color}"
                                        data-act="set" data-id="${s.id}" data-status="${k}"
                                        data-fk="attendance:${ses.id}:${s.id}:${k}"
                                        data-session="${ses.id}" data-teaching="${tch.id}" data-date="${date}" data-scope="${interactionScope}"
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
    'import-teams'(el, ev, params) { return openTeamsImport(params.id); },
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
      toast(saved ? 'حُفظت الملاحظة في سجل الطالب' : 'اكتب ملاحظة لا تتجاوز 1200 حرفًا', saved ? 'ok' : 'danger');
      repaint();
    },
    async set(el, ev, params) {
      const intent = attendanceIntent(el, params);
      if (intent) await acceptAttendanceIntent(intent);
    },

    'fill-remaining'(el) {
      // Native auto-popover owns light dismissal, Escape and focus restoration.
      // CSS anchors follow scrolling; these coordinates support older engines.
      const choices = document.getElementById('attendance-fill-choices');
      if (!choices) return;
      const rect = el.getBoundingClientRect();
      choices.style.setProperty('--fill-top', `${rect.bottom + 6}px`);
      choices.style.setProperty('--fill-right', `${Math.max(8, innerWidth - rect.right)}px`);
    },

    async 'fill-choice'(el, ev, params) {
      const choices = el.closest('[popover]');
      const sessionId = choices?.dataset.session;
      const choice = el.dataset.attendanceChoice;
      if (!choices?.matches(':popover-open')) return;
      choices.hidePopover();
      if (!activeSessionId) return;
      const session = store.getSession(sessionId);
      const isCurrent = () => activeSessionId === sessionId && store.getSession(sessionId)?.teachingId === params.id;
      if (!session || !isCurrent() || !['present', 'absent'].includes(choice)) return;
      const roster = store.sessionRoster(session).members;
      const recorded = new Set(store.attendanceIn(sessionId).map(record => record.studentId));
      const remaining = roster.filter(member => !recorded.has(member.id)).length;
      if (!remaining) return;
      const label = choice === 'present' ? 'حاضرين' : 'غائبين';
      if (isBeforeScheduledStart(store.getSession(sessionId))) {
        const confirmed = await openSheet({
          title: 'رصد الحضور قبل بدء الحصة؟',
          desc: `لم يبدأ وقت الحصة بعد. هل تريد رصد جميع الطلاب غير المرصودين في الحصة ${label} الآن؟`,
          foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button>
            <button class="btn btn--primary" data-confirm-attendance>نعم، رصدهم ${label}</button>`,
          onMount: (root, done) => root.querySelector('[data-confirm-attendance]').addEventListener('click', () => done(true)),
        });
        if (!confirmed) return;
      }
      if (!isCurrent()) return;
      const n = await store.fillAttendance(sessionId, choice);
      toast(`رُصد ${n} طالبًا ${label}`);
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

    async 'pick-session'(el, ev, params) {
      activeSessionId = el.dataset.id;
      await ensureActive(params.id);
      repaint();
    },

    /** حصة إضافية في نفس اليوم — الحالة التي كان النموذج القديم يفقدها. */
    async 'add-period'(el, ev, params) {
      const existing = dayOptions(params.id, date);
      const nextPeriod = Math.max(0, ...existing.map((s) => s.period)) + 1;
      const ses = await store.ensureSession(params.id, date, nextPeriod);
      if (!ses) return;
      invalidateAttendanceIntent();
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
