/** سجل حصص الإسناد: المنفّذة وغير المنفّذة وأسبابها. */

import { html, icon, toast, fmtDate, openSheet, fmtTimeRange } from '../lib/dom.js';
import { repaint } from '../repaint.js';
import * as store from '../store.js';
import { SESSION_STATUS, SESSION_STATUS_ORDER, WEEKDAYS, weekday, todayISO } from '../models.js';
let lastGeneration = null;

const ATTENDANCE_COMPLETENESS = {
  future: { label: 'مجدولة', tone: '' },
  pending: { label: 'لم يُرصد الحضور', tone: 'warn' },
  completed: { label: 'تم رصد الحضور', tone: 'ok' },
};

function attendanceMeta(session) {
  const completeness = store.attendanceCompleteness(session);
  return {
    completeness,
    meta: ATTENDANCE_COMPLETENESS[completeness.state]
      ?? SESSION_STATUS[session.status]
      ?? SESSION_STATUS.scheduled,
  };
}

function dailySummary(teaching) {
  const summary = store.attendanceCompletenessFor(teaching.id, todayISO());
  if (!summary.sessions) return '';
  return html`
    <div class="card card--pad mb-3">
      <div class="hstack gap-2 wrap">
        <span class="fw-7">ملخّص حضور اليوم</span>
        <span class="push t-3 fs-sm"><span class="tabular">${summary.sessions}</span> حصص اليوم</span>
      </div>
      <div class="hstack gap-2 wrap mt-3">
        <span class="badge badge--ok">تم رصدها <span class="tabular">${summary.completed}</span></span>
        ${summary.pending ? html`<span class="badge badge--warn">بانتظار الرصد <span class="tabular">${summary.pending}</span></span>` : html`<span class="t-3 fs-sm">لا توجد حصص مستحقة بانتظار الرصد.</span>`}
      </div>
    </div>
  `;
}

function generationCard(teaching) {
  const term = store.getTerm(teaching.termId);
  const hasBounds = term?.startDate && term?.endDate;
  const hasSlots = store.slotsOf(teaching.id).length > 0;
  const result = lastGeneration?.teachingId === teaching.id ? lastGeneration : null;

  return html`
    <div class="card card--pad mb-3">
      <div class="fw-7 mb-2">توليد الحصص من الجدول</div>
      <p class="t-3 fs-sm mb-3">سيتم إنشاء الحصص غير الموجودة فقط، ولن تتكرر الحصص التي تم إنشاؤها سابقًا.</p>
      ${!hasSlots
        ? html`<p class="t-3 fs-sm">لا توجد حصص في الجدول لهذا الفصل ضمن الإعداد الحالي. <a href="#/schedule">افتح الجدول</a></p>`
        : hasBounds
          ? html`
            <form data-submit="generate-sessions" class="stack stack-2">
              <div class="field-row">
                <label class="field"><span class="field__label">من</span><input class="input tabular" name="startDate" type="date" min="${term.startDate}" max="${term.endDate}" value="${term.startDate}" required></label>
                <label class="field"><span class="field__label">إلى</span><input class="input tabular" name="endDate" type="date" min="${term.startDate}" max="${term.endDate < todayISO() ? term.endDate : todayISO()}" value="${term.endDate < todayISO() ? term.endDate : todayISO()}" required></label>
              </div>
              <button class="btn btn--primary" type="submit">${icon('spark')} توليد الحصص</button>
            </form>
          `
        : html`<p class="t-3 fs-sm">أدخل تاريخ بداية ونهاية الفصل الدراسي أولًا من <a href="#/settings">الإعدادات</a>.</p>`}
      ${result
        ? html`<p class="t-3 fs-sm mt-3">تم إنشاء ${result.created} حصة · تم تجاوز ${result.existing} حصة موجودة · تم تجاهل ${result.holidays} يوم إجازة${result.unavailable ? ` · ${result.unavailable} خانة بلا توقيت صالح` : ''}</p>`
        : ''}
    </div>
  `;
}

export default {
  title: () => 'الحصص',
  subtitle: (p) => {
    const tch = store.getTeaching(p.id);
    return store.sectionLabel(store.getSection(tch?.sectionId)) ?? '';
  },
  back: (p) => `#/teaching/${p.id}`,

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const list = store.sessionsOf(tch.id);
    const generator = generationCard(tch);
    const todaySummary = dailySummary(tch);
    if (!list.length) {
      return html`
        ${generator}
        ${todaySummary}
        <div class="empty">
          <div class="empty__icon">${icon('session')}</div>
          <div class="empty__title">لا حصص مسجّلة</div>
          <div class="empty__text">
            تُنشأ الحصة أول ما ترصد حضورها، أو تولّدها من جدولك الأسبوعي.
          </div>
          <div class="btn-row" style="justify-content:center">
            <a class="btn btn--primary" href="#/teaching/${tch.id}/attendance">${icon('attendance')} افتح حصة</a>
            <a class="btn btn--ghost" href="#/schedule">${icon('timetable')} الجدول</a>
          </div>
        </div>
      `;
    }

    const tally = {};
    for (const s of list) tally[s.status] = (tally[s.status] ?? 0) + 1;
    const executed = list.filter((s) => s.status === 'held').length;
    const countable = list.filter((s) => SESSION_STATUS[s.status]?.counts).length;
    const rate = countable ? Math.round((executed / countable) * 100) : null;

    return html`
      ${generator}
      ${todaySummary}
      <div class="grid grid--3 mb-3">
        <div class="stat">
          <div class="stat__val tabular">${list.length}</div>
          <div class="stat__label">حصة مسجّلة</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${executed}</div>
          <div class="stat__label">نُفّذت</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${rate === null ? '—' : rate + '٪'}</div>
          <div class="stat__label">نسبة التنفيذ</div>
        </div>
      </div>

      <div class="hstack gap-2 wrap mb-3">
        ${SESSION_STATUS_ORDER.filter((k) => tally[k]).map((k) => {
          const m = SESSION_STATUS[k];
          return html`<span class="badge ${m.tone ? 'badge--' + m.tone : ''}">
            ${m.label} <span class="tabular">${tally[k]}</span>
          </span>`;
        })}
      </div>

      <p class="t-3 fs-sm mb-3">
        الإجازات الرسمية والحصص المجدولة التي لم يحن وقتها لا تدخل في نسبة التنفيذ،
        ولا تُسجَّل غيابًا على أحد.
      </p>

      <div class="list">
        ${list.map((s) => {
          const raw = SESSION_STATUS[s.status] ?? SESSION_STATUS.scheduled;
          const { completeness, meta } = attendanceMeta(s);
          const memberIds = new Set(store.sessionRoster(s).members.map((student) => student.id));
          const records = store.attendanceIn(s.id).filter((record) => memberIds.has(record.studentId));
          const marked = records.length;
          const absents = records.filter((record) => record.status === 'absent').length;
          const lesson = s.lessonId ? store.getLesson(s.lessonId) : null;
          const attendanceHref = `#/teaching/${s.teachingId}/attendance?session=${s.id}`;
          return html`
            <div class="row">
              <span class="period">${s.period}</span>
              <a class="row__main" href="${attendanceHref}">
                <span class="row__title">
                  ${WEEKDAYS[weekday(s.date)]} · ${fmtDate(s.date, false)}${s.startTime ? html` · ${fmtTimeRange(s.startTime, s.endTime)}` : ``}
                </span>
                <span class="row__sub">
                  ${meta.label}
                  ${completeness.state !== 'excluded' && raw.label !== meta.label ? html` · ${raw.label}` : ''}
                  ${s.reason ? html` · ${s.reason}` : ''}
                  ${marked ? html` · <span class="tabular">${marked}</span> مرصود` : ''}
                  ${absents ? html` · <span class="tabular">${absents}</span> غياب` : ''}
                  ${lesson ? html` · ${lesson.name}` : ''}
                </span>
              </a>
              <span class="row__end">
                <span class="badge ${meta.tone ? 'badge--' + meta.tone : ''}">${meta.label}</span>
                ${completeness.state === 'pending'
                  ? html`<a class="btn btn--sm btn--primary" href="${attendanceHref}">${icon('attendance')} رصد الحضور</a>`
                  : completeness.state === 'completed'
                    ? html`<a class="btn btn--sm btn--quiet" href="${attendanceHref}">مراجعة الحضور</a>`
                    : ''}
                <button class="iconbtn" data-act="status" data-id="${s.id}" aria-label="تغيير الحالة">
                  ${icon('edit')}
                </button>
              </span>
            </div>
          `;
        })}
      </div>
    `;
  },

  actions: {
    async 'generate-sessions'(el, ev, params) {
      ev.preventDefault();
      const fd = new FormData(el);
      try {
        const result = await store.generateSessionsForRange(
          params.id,
          String(fd.get('startDate') ?? ''),
          String(fd.get('endDate') ?? ''),
        );
        lastGeneration = { teachingId: params.id, ...result };
        repaint();
        toast(`تم إنشاء ${result.created} حصة`);
      } catch (err) {
        toast(err.message || 'تعذّر توليد الحصص', 'danger');
      }
    },

    async status(el) {
      const ses = store.getSession(el.dataset.id);
      if (!ses) return;

      const picked = await openSheet({
        title: `الحصة ${ses.period} — ${fmtDate(ses.date)}`,
        desc: 'الحصة غير المنفّذة لا تُسجَّل غيابًا على الطلاب.',
        body: html`
          <div class="stack stack-2">
            ${SESSION_STATUS_ORDER.map(
              (k) => html`
                <button class="radiocard radiocard--btn ${ses.status === k ? 'is-on' : ''}" data-pick="${k}">
                  <span class="radiocard__body">
                    <span class="radiocard__title">${SESSION_STATUS[k].label}</span>
                    <span class="radiocard__hint">
                      ${SESSION_STATUS[k].counts ? 'تُحسب في نسبة التنفيذ' : 'لا تُحسب'}
                    </span>
                  </span>
                </button>
              `
            )}
          </div>
          <label class="field mt-4">
            <span class="field__label">السبب (اختياري)</span>
            <input class="input" id="ses-reason" value="${ses.reason ?? ''}" maxlength="120">
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
      await store.setSessionStatus(ses.id, picked.status, picked.reason);
      toast(`الحصة: ${SESSION_STATUS[picked.status].label}`);
    },
  },
};
