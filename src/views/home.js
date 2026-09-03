/**
 * الصفحة الرئيسية — لوحة المعلّم.
 *
 * الموجة الأولى: الهيكل فقط. كل منطقة تعرض ما يستطيع النموذج الحالي دعمه،
 * وما لم يُبنَ بعد يظهر كمنطقة معلّمة بوضوح — **بلا بيانات وهمية إطلاقًا**.
 */

import { html, icon, fmtDate, fmtPct, fmtTimeRange, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { repaint } from '../repaint.js';
import { go } from '../router.js';
import {
  todayISO, gradeLabel, studentTotal, SESSION_STATUS, ATTENDANCE, WEEKDAYS, weekday,
} from '../models.js';

const DISMISS_STORAGE_KEY = 'rakeezx_home_pwa_dismissed_at';
const SUPPRESSION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

let sessionDismissed = false;

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
    const timingProfile = store.activeTimeProfile()?.name ?? 'التوقيت المعتمد';

    const isInstalled = isStandaloneMode();
    const isDismissed = isHomeInstallPromptDismissed();
    const showInstallPrompt = !isInstalled && !isDismissed;
    const hasInstallPrompt = typeof window !== 'undefined' && !!window.deferredInstallPrompt;

    return html`
      <!-- ترحيب وتاريخ اليوم -->
      <div class="hero">
        <div class="hero__hello">
          ${meta.teacherName ? html`أهلًا، ${meta.teacherName}` : 'أهلًا بك في RAKEEZ X'}
        </div>
        <div class="hero__date">
          ${WEEKDAYS[weekday(today)]} · ${fmtDate(today, false)}
          <span class="hub-head__timing-pill" title="ملف التوقيت المعتمد"><span class="hub-head__timing-icon">${icon('clock')}</span><span>${timingProfile}</span></span>
          ${cal ? html` · <span class="badge badge--info">${cal.label || 'يوم مميّز'}</span>` : ''}
        </div>
      </div>

      <!-- إشعار تثبيت التطبيق السياقي (مؤقت وغير مسيطر) -->
      ${showInstallPrompt
        ? html`
            <aside class="home-pwa-prompt" id="home-pwa-prompt" aria-label="تثبيت تطبيق رَكيز X">
              <div class="home-pwa-prompt__main">
                <div class="home-pwa-prompt__icon" aria-hidden="true">${icon('download')}</div>
                <div class="home-pwa-prompt__content">
                  <div class="home-pwa-prompt__title">تطبيق رَكيز X على جهازك</div>
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
                          ${s.startTime ? html`${fmtTimeRange(s.startTime, s.endTime)} · ` : ''}
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

    `;
  },

  actions: {
    async 'home-pwa-install'() {
      if (typeof window !== 'undefined' && window.deferredInstallPrompt) {
        const promptEvent = window.deferredInstallPrompt;
        promptEvent.prompt();
        try {
          const { outcome } = await promptEvent.userChoice;
          if (outcome === 'accepted') {
            toast('جارٍ تثبيت تطبيق رَكيز...');
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
