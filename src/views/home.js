/**
 * الصفحة الرئيسية — لوحة المعلّم.
 *
 * الموجة الأولى: الهيكل فقط. كل منطقة تعرض ما يستطيع النموذج الحالي دعمه،
 * وما لم يُبنَ بعد يظهر كمنطقة معلّمة بوضوح — **بلا بيانات وهمية إطلاقًا**.
 */

import { html, icon, fmtDate, fmtPct, fmtTimeRange, toast, timingProfileIcon } from '../lib/dom.js';
import { APP_ICON_URL } from '../lib/brand.js';
import { openStudentSearch } from '../lib/student-search-ui.js';
import { getAccountPresentation } from '../lib/account-profile.js';
import * as store from '../store.js';
import { repaint } from '../repaint.js';
import { go } from '../router.js';
import {
  todayISO, shiftDate, gradeLabel, SESSION_STATUS, ATTENDANCE, WEEKDAYS, weekday, isTeachingDay, CALENDAR_KIND,
} from '../models.js';

const DISMISS_STORAGE_KEY = 'rakeezx_home_pwa_dismissed_at';
const SUPPRESSION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

let sessionDismissed = false;

export function homeGreeting(profile = {}, now = new Date()) {
  const teacherName = String(profile.teacherName ?? '').trim();
  const presentation = getAccountPresentation(profile.teacherForm);
  const morning = now.getHours() < 12;
  if (!teacherName) return morning ? 'صباح الخير' : 'أهلاً بك';
  return `${morning ? 'صباح الخير' : 'أهلاً'}، ${presentation.teacherHonorific} ${teacherName}`;
}

export function homeSummaryMetrics(list, {
  today = todayISO(),
  studentsFor = (teachingId) => store.students(teachingId),
  sessionsForDate = (date) => store.sessionsOn(date),
  attendanceFor = (sessionId) => store.attendanceIn(sessionId),
  completenessFor = (session) => store.attendanceCompleteness(session),
} = {}) {
  const teachingIds = new Set((list ?? []).map((teaching) => teaching.id));
  const studentIds = new Set();
  for (const teaching of list ?? []) {
    for (const student of studentsFor(teaching.id)) studentIds.add(student.id);
  }

  const todaySessions = sessionsForDate(today).filter((session) =>
    teachingIds.has(session.teachingId) && !CANCELLED_SESSION_STATUSES.has(session.status)
  );
  const completedToday = todaySessions.filter((session) => completenessFor(session).state === 'completed').length;

  const weekStart = shiftDate(today, -weekday(today));
  const weekSessions = Array.from({ length: weekday(today) + 1 }, (_, offset) => shiftDate(weekStart, offset))
    .flatMap((date) => sessionsForDate(date))
    .filter((session) => teachingIds.has(session.teachingId) && !CANCELLED_SESSION_STATUSES.has(session.status));
  const weekAttendance = weekSessions.flatMap((session) => attendanceFor(session.id))
    .filter((record) => Object.hasOwn(ATTENDANCE, record.status));
  const attended = weekAttendance.filter((record) => record.status === 'present' || record.status === 'late').length;

  return Object.freeze({
    classes: (list ?? []).length,
    students: studentIds.size,
    weeklyAttendance: weekAttendance.length ? Math.round((attended / weekAttendance.length) * 100) : null,
    completedToday,
    totalToday: todaySessions.length,
  });
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return !!(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    document.referrer?.includes('android-app://')
  );
}

export function isHomeInstallPromptDismissed() {
  if (sessionDismissed) return true;
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < SUPPRESSION_MS;
  } catch {
    return false;
  }
}

export function dismissHomeInstallPrompt() {
  sessionDismissed = true;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore storage write errors
    }
  }
}

export function resetHomeInstallPrompt() {
  sessionDismissed = false;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.resetHomeInstallPrompt = resetHomeInstallPrompt;
  window.dismissHomeInstallPrompt = dismissHomeInstallPrompt;
}

/** منطقة محجوزة لميزة لم تُبنَ واجهتها بعد. */
const soon = (title, text) => html`
  <div class="soon">
    <div class="soon__title">${title}</div>
    <div class="soon__text">${text}</div>
  </div>
`;

const CANCELLED_SESSION_STATUSES = new Set(['cancelled', 'cancelled_holiday']);

// Presentation only: use the configured schedule and existing calendar context.
function todayEmptyCopy(hasSchedule, date, calendarDay) {
  if (!hasSchedule) return {
    kicker: 'جدولك الأسبوعي', title: 'لم تُضف حصصك الأسبوعية بعد',
    text: 'بعد إعداد الجدول، ستظهر هنا حصص يومك.', action: 'إعداد الجدول', iconName: 'timetable',
  };
  if (calendarDay && !isTeachingDay(calendarDay.kind)) return {
    kicker: 'إجازة', title: calendarDay.label || CALENDAR_KIND[calendarDay.kind]?.label || 'إجازة رسمية',
    text: 'لا توجد لديك حصص مجدولة اليوم. يمكنك مراجعة جدول الأسبوع.', action: 'عرض الجدول', iconName: 'calendar',
  };
  if ([5, 6].includes(weekday(date))) return {
    kicker: 'عطلة نهاية الأسبوع', title: 'لا توجد لديك حصص اليوم',
    text: 'نتمنى لك يومًا هادئًا. يمكنك مراجعة جدول الأسبوع.', action: 'عرض الجدول', iconName: 'calendar',
  };
  return {
    kicker: 'حصص اليوم', title: 'لا توجد لديك حصص اليوم',
    text: 'يمكنك مراجعة جدول الأسبوع أو متابعة أعمال فصولك.', action: 'عرض الجدول', iconName: 'timetable',
  };
}

function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Display state only. Attendance truth comes from store.attendanceCompleteness.
export function todaySessionPresentation(session, completeness, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(session.startTime);
  const end = timeToMinutes(session.endTime);
  if (completeness.state === 'excluded') return { kind: 'neutral', label: (SESSION_STATUS[session.status] ?? SESSION_STATUS.scheduled).label };
  if (start !== null && end !== null && start <= minutes && minutes < end) return { kind: 'current', label: 'الحصة الحالية' };
  if (completeness.state === 'completed' && completeness.due) return { kind: 'completed', label: 'تم رصد الحضور' };
  if (completeness.state === 'pending') return { kind: 'pending', label: completeness.recorded ? 'رصد الحضور غير مكتمل' : 'بانتظار رصد الحضور' };
  if (completeness.state === 'completed') return { kind: 'upcoming', label: 'تم رصد الحضور' };
  return { kind: 'upcoming', label: start === null ? 'حصة بدون وقت محدد' : 'قادمة' };
}

/**
 * Display priority: active lesson, latest past lesson requiring attendance,
 * then nearest future lesson. The remaining list keeps Product period order.
 */
export function selectTodayFocus(sessions, {
  now = new Date(),
  attendanceState = () => 'pending',
} = {}) {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const eligible = (sessions ?? []).filter((session) =>
    !CANCELLED_SESSION_STATUSES.has(session.status)
  );
  const withTimes = eligible.map((session) => ({
    session,
    start: timeToMinutes(session.startTime),
    end: timeToMinutes(session.endTime),
  }));

  const current = withTimes
    .filter((item) => item.start !== null && item.end !== null && item.start <= minutesNow && minutesNow < item.end)
    .sort((a, b) => a.start - b.start)[0];
  if (current) return { kind: 'current', session: current.session };

  const pastPending = withTimes
    .filter((item) => item.end !== null && item.end <= minutesNow && attendanceState(item.session) === 'pending')
    .sort((a, b) => b.end - a.end)[0];
  if (pastPending) return { kind: 'past-pending', session: pastPending.session };
  const upcoming = withTimes
    .filter((item) => item.start !== null && item.start > minutesNow && attendanceState(item.session) !== 'completed')
    .sort((a, b) => a.start - b.start)[0];
  return upcoming ? { kind: 'upcoming', session: upcoming.session } : null;
}

export function homeOnboardingState(teachings, {
  studentsFor = () => [],
  slotsFor = () => [],
} = {}) {
  const activeTeachings = (teachings ?? []).filter(Boolean);
  if (!activeTeachings.length) return { state: 'A', teaching: null };
  const teachingWithStudents = activeTeachings.find((teaching) => studentsFor(teaching.id).length > 0);
  if (!teachingWithStudents) return { state: 'B', teaching: activeTeachings[0] };
  const teachingWithSchedule = activeTeachings.find((teaching) => slotsFor(teaching.id).length > 0);
  if (!teachingWithSchedule) return { state: 'C', teaching: teachingWithStudents };
  return { state: 'D', teaching: teachingWithSchedule };
}

function renderOnboarding(onboarding) {
  if (onboarding.state === 'D') return '';
  const content = {
    A: {
      kicker: 'خطوتك الأولى', title: 'أنشئ فصلك الأول',
      text: 'ابدأ بفصل واحد، ثم أضف طلابه ومواعيد حصصه عندما تكون جاهزًا.',
      action: 'إنشاء أول فصل', href: '#/classes', iconName: 'classes',
    },
    B: {
      kicker: 'الخطوة التالية', title: 'أضف طلابك',
      text: 'أضف أسماء طلاب الفصل لتصبح الحضور والمتابعة جاهزة للعمل.',
      action: 'إضافة الطلاب', href: `#/teaching/${onboarding.teaching?.id ?? ''}/students`, iconName: 'classes',
    },
    C: {
      kicker: 'الخطوة التالية', title: 'حدّد جدولك الأسبوعي',
      text: 'أضف مواعيد حصصك الأسبوعية لتظهر حصص يومك تلقائيًا وفق الجدول المعتمد.',
      action: 'إعداد الجدول', href: '#/schedule', iconName: 'timetable',
    },
  }[onboarding.state];
  return html`
    <section class="home-onboarding" aria-label="بدء إعداد سجل المعلّم">
      <span class="home-onboarding__mark" aria-hidden="true">${icon(content.iconName)}</span>
      <div class="home-onboarding__copy">
        <span class="home-onboarding__kicker">${content.kicker}</span>
        <h2>${content.title}</h2>
        <p>${content.text}</p>
      </div>
      <a class="btn btn--primary home-onboarding__action" href="${content.href}">${content.action} ${icon('back')}</a>
    </section>
  `;
}

function renderTodayFocus(focus) {
  if (!focus) return '';
  const { session, kind } = focus;
  const teaching = store.getTeaching(session.teachingId);
  const content = {
    current: { eyebrow: 'الآن', title: 'حصتك الحالية', detail: 'الحصة جارية الآن', tone: 'is-current' },
    upcoming: { eyebrow: 'بعد قليل', title: 'الحصة التالية', detail: session.startTime ? html`تبدأ ${fmtTimeRange(session.startTime, session.endTime)}` : 'موعد الحصة التالي', tone: 'is-upcoming' },
    'past-pending': { eyebrow: 'يتطلب انتباهك', title: 'رصد حضور معلّق', detail: 'انتهت الحصة ولم يُرصد الحضور بعد.', tone: 'is-pending' },
  }[kind];
  return html`
    <section class="today-focus ${content.tone}" aria-label="تركيز اليوم" data-session-id="${session.id}">
      <div class="today-focus__signal"><span>${content.eyebrow}</span><i aria-hidden="true"></i></div>
      <div class="today-focus__main">
        <div class="today-focus__title">${content.title}</div>
        <div class="today-focus__class">${store.teachingLabel(teaching)}</div>
        <div class="today-focus__detail">الحصة ${session.period}${session.startTime ? html` · <bdi dir="ltr">${fmtTimeRange(session.startTime, session.endTime)}</bdi>` : ''}</div>
        <div class="today-focus__state">${store.attendanceCompleteness(session).completed ? 'تم رصد الحضور' : content.detail}</div>
      </div>
      <a class="btn btn--primary today-focus__action" href="#/teaching/${session.teachingId}/attendance?session=${session.id}" data-session-id="${session.id}">
        ${icon('attendance')} ${store.attendanceCompleteness(session).completed ? 'مراجعة الحضور' : 'رصد الحضور'}
      </a>
    </section>
  `;
}

export default {
  title: () => 'الرئيسية',

  render() {
    const today = todayISO();
    const meta = store.state.profile ?? {};
    const list = store.teachings();
    const daySessions = store.sessionsOn(today);
    const onboarding = homeOnboardingState(list, {
      studentsFor: (teachingId) => store.students(teachingId),
      slotsFor: (teachingId) => store.slotsOf(teachingId),
    });
    const focus = onboarding.state === 'D'
      ? selectTodayFocus(daySessions, { attendanceState: (session) => store.attendanceCompleteness(session).state })
      : null;
    const remainingSessions = focus ? daySessions.filter((session) => session.id !== focus.session.id) : daySessions;
    const cal = store.calendarDayFor(today);
    const emptyCopy = todayEmptyCopy(list.some((teaching) => store.slotsOf(teaching.id).length > 0), today, cal);
    const pendingToday = remainingSessions.filter((session) =>
      !CANCELLED_SESSION_STATUSES.has(session.status) && store.attendanceCompleteness(session).state === 'pending'
    ).length;
    const baseTimingProfile = store.activeTimeProfile();
    const timingProfile = store.resolveProfile(baseTimingProfile, today)?.name ?? 'التوقيت المعتمد';

    const isInstalled = isStandaloneMode();
    const isDismissed = isHomeInstallPromptDismissed();
    const showInstallPrompt = !isInstalled && !isDismissed;
    const hasInstallPrompt = typeof window !== 'undefined' && !!window.deferredInstallPrompt;

    return html`
      <div class="home-stack">
      <!-- الهوية في غلاف التطبيق؛ يبدأ المحتوى بالترحيب والسياق اليومي فقط. -->
      <div class="hero home-hero">
        <div class="hero__main-row">
          <div class="hero__hello">${homeGreeting(meta)}</div>
          <a class="compact-timing-pill" href="#/schedule/times" title="أوقات الحصص — ${timingProfile}">
            <span class="compact-timing-pill__icon" aria-hidden="true">${icon(timingProfileIcon(timingProfile))}</span>
            <span>${timingProfile}</span>
          </a>
        </div>
        <div class="hero__date">
          ${WEEKDAYS[weekday(today)]} · ${fmtDate(today, false)}
          ${cal ? html` · <span class="badge badge--info">${cal.label || 'يوم مميّز'}</span>` : ''}
        </div>
      </div>

      <!-- إشعار تثبيت التطبيق السياقي (مؤقت وغير مسيطر) -->
      ${showInstallPrompt
        ? html`
            <aside class="home-pwa-prompt" id="home-pwa-prompt" aria-label="تثبيت تطبيق رَكيز المعلم">
              <div class="home-pwa-prompt__main">
                <span class="home-pwa-brand-mark" aria-hidden="true"><img class="home-pwa-brand-icon" src="${APP_ICON_URL}" width="52" height="52" alt=""></span>
                <div class="home-pwa-prompt__content">
                  <div class="home-pwa-prompt__title">تطبيق رَكيز المعلم على جهازك</div>
                  <div class="home-pwa-prompt__desc">ثبّت التطبيق لفتحه مباشرة والعمل دون إنترنت.</div>
                </div>
              </div>
              <div class="home-pwa-prompt__actions">
                <button
                  class="btn btn--sm btn--primary home-pwa-prompt__install"
                  id="home-pwa-install-btn"
                  data-act="home-pwa-install"
                >
                  ${icon('download')} ${hasInstallPrompt ? 'تثبيت التطبيق' : 'إرشادات التثبيت'}
                </button>
                <button
                  class="home-pwa-prompt__dismiss"
                  id="home-pwa-dismiss-btn"
                  data-act="home-pwa-dismiss"
                  title="إغلاق الإشعار"
                  aria-label="إغلاق الإشعار"
                >
                  ${icon('x')}
                </button>
              </div>
            </aside>
          `
        : ''}

      <div class="home-dashboard">
        <div class="home-dashboard__primary">

      ${renderOnboarding(onboarding)}

      ${renderTodayFocus(focus)}

      <!-- حصص اليوم -->
      <section class="section home-sessions" aria-labelledby="home-sessions-title">
        ${onboarding.state === 'A' || daySessions.length ? html`
          <div class="section__head">
            <h2 class="section__title" id="home-sessions-title">${focus ? 'بقية حصص اليوم' : 'حصص اليوم'}</h2>
            ${pendingToday ? html`<span class="badge badge--warn">بانتظار الرصد <span class="tabular">${pendingToday}</span></span>` : ''}
            ${onboarding.state !== 'A' ? html`<a class="btn btn--sm btn--quiet push" href="#/schedule">عرض الجدول ${icon('back')}</a>` : ''}
          </div>
        ` : ''}
        ${onboarding.state === 'A'
          ? html`
              <div class="home-sessions__empty empty-day">
                <span class="empty-day__icon" aria-hidden="true">${icon('classes')}</span>
                <h3>لا توجد حصص بعد</h3>
                <p>بعد إنشاء الفصل وإضافة الجدول، ستظهر هنا حصص يومك تلقائيًا.</p>
              </div>
            `
          : remainingSessions.length
          ? html`
              <div class="list home-session-list">
                ${remainingSessions.map((s) => {
                  const tch = store.getTeaching(s.teachingId);
                  const completeness = store.attendanceCompleteness(s);
                  const presentation = todaySessionPresentation(s, completeness);
                  const attendanceLabel = presentation.label;
                  const marked = completeness.recorded;
                  const roster = completeness.expected;
                  return html`
                    <a class="row home-session-row is-session-${presentation.kind}" data-session-id="${s.id}" href="#/teaching/${s.teachingId}/attendance?session=${s.id}">
                      <span class="period">${s.period}</span>
                      <span class="row__main">
                        <span class="row__title">${store.teachingLabel(tch)}</span>
                        <span class="row__sub">
                          ${s.startTime ? html`<bdi dir="ltr">${fmtTimeRange(s.startTime, s.endTime)}</bdi>` : 'بدون وقت محدد'}
                          ${marked && roster
                            ? html` · <span class="tabular">${marked}/${roster}</span> مرصود`
                            : ''}
                          ${s.reason ? html` · ${s.reason}` : ''}
                        </span>
                      </span>
                      <span class="row__end">
                        <span class="home-session-state">${attendanceLabel}</span>
                        ${icon('chev')}
                      </span>
                    </a>
                  `;
                })}
              </div>
            `
          : daySessions.length
            ? html`
                <div class="home-sessions__empty">
                  <div class="t-3 fs-md">لا حصص أخرى مجدولة اليوم.</div>
                  <p class="t-3 fs-sm mt-3">اكتملت قائمة حصص اليوم الحالية.</p>
                </div>
              `
            : html`
                <div class="home-sessions__empty today-empty-card">
                  <span class="today-empty-card__icon" aria-hidden="true">${icon(emptyCopy.iconName)}</span>
                  <div><small>${emptyCopy.kicker}</small><h2 id="home-sessions-title">${emptyCopy.title}</h2><p>${emptyCopy.text}</p></div>
                  <a class="btn btn--quiet" href="#/schedule">${emptyCopy.action}</a>
                </div>
              `}
      </section>

        </div>
        <aside class="home-dashboard__aside" aria-label="اختصارات وملخص">
      <!-- اختصارات سريعة -->
      <section class="section home-shortcuts" aria-labelledby="home-shortcuts-title">
        <div class="section__head"><h2 class="section__title" id="home-shortcuts-title">اختصارات</h2><button class="btn btn--sm btn--ghost home-student-search" data-act="student-search">${icon('search')} بحث عن طالب</button></div>
        <div class="grid grid--auto home-shortcuts__grid">
          <a class="tile" href="#/classes">
            <span class="tile__icon">${icon('classes')}</span>
            <span class="tile__copy"><span class="tile__title">فصولي</span><span class="tile__sub"><span class="tabular">${list.length}</span> فصلاً هذا الفصل</span></span>
          </a>
          <a class="tile" href="#/schedule">
            <span class="tile__icon">${icon('timetable')}</span>
            <span class="tile__copy"><span class="tile__title">الجدول</span><span class="tile__sub">حصصك الأسبوعية</span></span>
          </a>
          <a class="tile" href="#/reports">
            <span class="tile__icon">${icon('reports')}</span>
            <span class="tile__copy"><span class="tile__title">التقارير</span><span class="tile__sub">كشوف ومتابعة</span></span>
          </a>
          <a class="tile" href="#/calendar">
            <span class="tile__icon">${icon('calendar')}</span>
            <span class="tile__copy"><span class="tile__title">التقويم</span><span class="tile__sub">الإجازات والأيام المميّزة</span></span>
          </a>
        </div>
      </section>

      ${onboarding.state === 'A'
        ? html`<section class="section home-summary home-workspace-note" aria-label="إرشاد البدء"><p>ابدأ بفصلك الأول، وستتكوّن مؤشراتك اليومية تدريجيًا دون إعدادات معقدة.</p></section>`
        : summary(list)}
        </aside>
      </div>

    `;
  },

  actions: {
    'student-search': () => openStudentSearch(),
    async 'home-pwa-install'() {
      if (typeof window !== 'undefined' && window.deferredInstallPrompt) {
        const promptEvent = window.deferredInstallPrompt;
        promptEvent.prompt();
        try {
          const { outcome } = await promptEvent.userChoice;
          if (outcome === 'accepted') {
            toast('جارٍ تثبيت تطبيق رَكيز المعلم...');
            window.deferredInstallPrompt = null;
            repaint();
          }
        } catch {
          // ignore prompt cancellation
        }
      } else {
        go('/settings');
      }
    },

    'home-pwa-dismiss'() {
      dismissHomeInstallPrompt();
      repaint();
    },
  },
};

/* ---------- ملخّصات مبنية على بيانات حقيقية فقط ---------- */

function summary(list) {
  const metrics = homeSummaryMetrics(list);
  const progress = metrics.totalToday ? Math.round((metrics.completedToday / metrics.totalToday) * 100) : 0;

  return html`
    <section class="section home-summary surface surface--compact" aria-labelledby="home-summary-title">
      <div class="section__head"><h2 class="section__title" id="home-summary-title">نظرة سريعة</h2></div>
      <div class="grid grid--3 home-summary__stats">
        <div class="stat">
          <div class="stat__val tabular">${metrics.classes}</div>
          <div class="stat__label">فصول</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${metrics.students}</div>
          <div class="stat__label">طالبًا</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${metrics.weeklyAttendance === null ? '—' : fmtPct(metrics.weeklyAttendance)}</div>
          <div class="stat__label">حضور الأسبوع</div>
        </div>
      </div>
      <div class="home-day-progress">
        <div class="home-day-progress__copy"><span>تقدم اليوم</span><span class="tabular">${metrics.completedToday} من ${metrics.totalToday} حصص</span></div>
        <div class="home-day-progress__track" role="progressbar" aria-label="تقدم حصص اليوم" aria-valuemin="0" aria-valuemax="${metrics.totalToday}" aria-valuenow="${metrics.completedToday}">
          <span style="width:${progress}%"></span>
        </div>
      </div>
    </section>
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
