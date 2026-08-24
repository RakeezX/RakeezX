/**
 * الصفحة الرئيسية — لوحة المعلّم.
 *
 * الموجة الأولى: الهيكل فقط. كل منطقة تعرض ما يستطيع النموذج الحالي دعمه،
 * وما لم يُبنَ بعد يظهر كمنطقة معلّمة بوضوح — **بلا بيانات وهمية إطلاقًا**.
 */

import { html, icon, fmtDate, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import {
  todayISO, gradeLabel, studentTotal, SESSION_STATUS, ATTENDANCE, WEEKDAYS, weekday,
} from '../models.js';

/** منطقة محجوزة لميزة لم تُبنَ واجهتها بعد. */
const soon = (title, text) => html`
  <div class="soon">
    <div class="soon__title">${title}</div>
    <div class="soon__text">${text}</div>
  </div>
`;

export default {
  title: () => 'الرئيسية',
  subtitle: () => {
    const y = store.activeYear();
    const t = store.activeTerm();
    return [t?.name, y?.label].filter(Boolean).join(' · ');
  },

  render() {
    const today = todayISO();
    const meta = store.state.profile ?? {};
    const list = store.teachings();
    const daySessions = store.sessionsOn(today);
    const cal = store.calendarDayFor(today);
    const pendingToday = daySessions.filter((session) => store.attendanceCompleteness(session).state === 'pending').length;

    return html`
      <!-- ترحيب وتاريخ اليوم -->
      <div class="hero">
        <div class="hero__hello">
          ${meta.teacherName ? html`أهلًا، ${meta.teacherName}` : 'أهلًا بك في RAKEEZ X'}
        </div>
        <div class="hero__date">
          ${WEEKDAYS[weekday(today)]} · ${fmtDate(today, false)}
          ${cal ? html` · <span class="badge badge--info">${cal.label || 'يوم مميّز'}</span>` : ''}
        </div>
      </div>

      ${!meta.teacherName
        ? html`
            <a class="card card--pad welcome" href="#/settings">
              <div class="welcome__title">اكتب اسمك واسم مدرستك</div>
              <p class="welcome__text">يظهران على التقارير والكشوف التي تطبعها.</p>
            </a>
          `
        : ''}

      <!-- حصص اليوم -->
      <div class="section">
        <div class="section__head">
          <div class="section__title">حصص اليوم</div>
          ${pendingToday ? html`<span class="badge badge--warn">بانتظار الرصد <span class="tabular">${pendingToday}</span></span>` : ''}
          <a class="btn btn--sm btn--quiet push" href="#/schedule">الجدول ${icon('back')}</a>
        </div>
        ${daySessions.length
          ? html`
              <div class="list">
                ${daySessions.map((s) => {
                  const tch = store.getTeaching(s.teachingId);
                  const meta = SESSION_STATUS[s.status] ?? SESSION_STATUS.scheduled;
                  const completeness = store.attendanceCompleteness(s);
                  const attendanceLabel = completeness.state === 'pending'
                    ? 'لم يُرصد الحضور'
                    : completeness.state === 'completed'
                      ? 'تم رصد الحضور'
                      : meta.label;
                  const attendanceTone = completeness.state === 'pending'
                    ? 'warn'
                    : completeness.state === 'completed'
                      ? 'ok'
                      : meta.tone;
                  const marked = store.attendanceIn(s.id).length;
                  const roster = store.students(s.teachingId).length;
                  return html`
                    <a class="row" href="#/teaching/${s.teachingId}/attendance?session=${s.id}">
                      <span class="period">${s.period}</span>
                      <span class="row__main">
                        <span class="row__title">${store.teachingLabel(tch)}</span>
                        <span class="row__sub">
                          ${s.startTime ? html`<span class="tabular t-3">${s.startTime} – ${s.endTime}</span> · ` : ''}
                          ${attendanceLabel}
                          ${completeness.state === 'completed' && roster
                            ? html` · <span class="tabular">${marked}/${roster}</span> مرصود`
                            : ''}
                          ${s.reason ? html` · ${s.reason}` : ''}
                        </span>
                      </span>
                      <span class="row__end">
                        <span class="badge ${attendanceTone ? 'badge--' + attendanceTone : ''}">${attendanceLabel}</span>
                        ${icon('chev')}
                      </span>
                    </a>
                  `;
                })}
              </div>
            `
          : html`
              <div class="card card--pad center">
                <div class="t-3 fs-md">لا حصص مجدولة اليوم.</div>
                <p class="t-3 fs-sm mt-3">
                  أضف حصصك الأسبوعية في «الجدول» لتظهر هنا تلقائيًا كل يوم.
                </p>
                <a class="btn btn--sm btn--primary mt-3" href="#/schedule">
                  ${icon('timetable')} إعداد الجدول
                </a>
              </div>
            `}
      </div>

      <!-- اختصارات سريعة -->
      <div class="section">
        <div class="section__head"><div class="section__title">اختصارات</div></div>
        <div class="grid grid--auto">
          <a class="tile" href="#/classes">
            <span class="tile__icon">${icon('classes')}</span>
            <span class="tile__title">فصولي</span>
            <span class="tile__sub"><span class="tabular">${list.length}</span> إسنادًا هذا الفصل</span>
          </a>
          <a class="tile" href="#/schedule">
            <span class="tile__icon">${icon('timetable')}</span>
            <span class="tile__title">الجدول</span>
            <span class="tile__sub">حصصك الأسبوعية</span>
          </a>
          <a class="tile" href="#/reports">
            <span class="tile__icon">${icon('reports')}</span>
            <span class="tile__title">التقارير</span>
            <span class="tile__sub">كشوف ومتابعة</span>
          </a>
          <a class="tile" href="#/calendar">
            <span class="tile__icon">${icon('calendar')}</span>
            <span class="tile__title">التقويم</span>
            <span class="tile__sub">الإجازات والأيام المميّزة</span>
          </a>
        </div>
      </div>

      ${list.length ? summary(list) : emptyState()}

      <!-- مناطق محجوزة للموجات القادمة -->
      <div class="section">
        <div class="section__head"><div class="section__title">قيد البناء</div></div>
        <div class="grid grid--2">
          ${soon('نسبة إنجاز المنهج', 'تظهر بعد إدخال وحدات المنهج وربط الدروس بالحصص.')}
          ${soon('تنبيهات مهمة', 'تعثّر متكرر، غياب متتابع، وحصص لم تُرصد.')}
        </div>
      </div>
    `;
  },
};

/* ---------- ملخّصات مبنية على بيانات حقيقية فقط ---------- */

function summary(list) {
  const today = todayISO();
  let students = 0;
  let needSupport = 0;
  let graded = 0;
  let pctSum = 0;
  let markedToday = 0;
  let expectedToday = 0;

  for (const tch of list) {
    const { roster, items, ctx } = store.teachingContext(tch.id);
    students += roster.length;
    for (const s of roster) {
      const t = studentTotal(items, ctx[s.id]);
      if (t.pct === null) continue;
      graded++;
      pctSum += t.pct;
      if (t.pct < 50) needSupport++;
    }
    for (const ses of store.sessionsOnFor(tch.id, today)) {
      if (ses.status === 'cancelled_holiday') continue;
      expectedToday += roster.length;
      markedToday += store.attendanceIn(ses.id).length;
    }
  }

  const avg = graded ? pctSum / graded : null;

  return html`
    <div class="section">
      <div class="section__head"><div class="section__title">نظرة سريعة</div></div>
      <div class="grid grid--3">
        <div class="stat">
          <div class="stat__val tabular">${students}</div>
          <div class="stat__label">طالبًا</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${avg === null ? '—' : fmtPct(avg)}</div>
          <div class="stat__label">متوسط المرصود</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular" style="${needSupport ? 'color:var(--danger)' : ''}">${needSupport}</div>
          <div class="stat__label">يحتاج متابعة</div>
        </div>
      </div>
      ${expectedToday
        ? html`
            <div class="card card--pad mt-3">
              <div class="hstack gap-2">
                <span class="t-2 fs-md">حضور اليوم</span>
                <span class="push tabular fw-7">${markedToday}/${expectedToday}</span>
              </div>
              <div class="meter mt-3">
                <div class="meter__fill" style="width:${Math.round((markedToday / expectedToday) * 100)}%;
                     background:var(--${markedToday >= expectedToday ? 'ok' : 'warn'})"></div>
              </div>
            </div>
          `
        : ''}
    </div>
  `;
}

function emptyState() {
  return html`
    <div class="empty">
      <div class="empty__icon">${icon('classes')}</div>
      <div class="empty__title">لنبدأ</div>
      <div class="empty__text">
        أنشئ شعبة وأسند إليها مادتك، ثم الصق كشف الأسماء دفعة واحدة.
      </div>
      <a class="btn btn--primary" href="#/classes">${icon('plus')} إنشاء أول فصل</a>
    </div>
  `;
}
