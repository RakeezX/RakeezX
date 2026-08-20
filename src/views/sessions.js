/** سجل حصص الإسناد: المنفّذة وغير المنفّذة وأسبابها. */

import { html, icon, toast, fmtDate, openSheet } from '../lib/dom.js';
import * as store from '../store.js';
import { SESSION_STATUS, SESSION_STATUS_ORDER, WEEKDAYS, weekday } from '../models.js';

export default {
  title: () => 'الحصص',
  subtitle: (p) => {
    const tch = store.getTeaching(p.id);
    return store.getSection(tch?.sectionId)?.name ?? '';
  },
  back: (p) => `#/teaching/${p.id}`,

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const list = store.sessionsOf(tch.id);
    if (!list.length) {
      return html`
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
          const m = SESSION_STATUS[s.status] ?? SESSION_STATUS.scheduled;
          const marked = store.attendanceIn(s.id).length;
          const absents = store.attendanceIn(s.id).filter((a) => a.status === 'absent').length;
          const lesson = s.lessonId ? store.getLesson(s.lessonId) : null;
          return html`
            <div class="row">
              <span class="period">${s.period}</span>
              <a class="row__main" href="#/teaching/${s.teachingId}/attendance?session=${s.id}">
                <span class="row__title">
                  ${WEEKDAYS[weekday(s.date)]} · ${fmtDate(s.date, false)}${s.startTime ? ` · ${s.startTime}–${s.endTime}` : ``}
                </span>
                <span class="row__sub">
                  ${m.label}
                  ${s.reason ? html` · ${s.reason}` : ''}
                  ${marked ? html` · <span class="tabular">${marked}</span> مرصود` : ''}
                  ${absents ? html` · <span class="tabular">${absents}</span> غياب` : ''}
                  ${lesson ? html` · ${lesson.name}` : ''}
                </span>
              </a>
              <span class="row__end">
                <span class="badge ${m.tone ? 'badge--' + m.tone : ''}">${m.label}</span>
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
