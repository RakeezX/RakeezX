/**
 * RAKEEZ X — غلاف التطبيق: الإقلاع، والهيكل، وتوجيه الشاشات، وإعادة الرسم.
 */

import { html, render, icon, delegate, toast, openSheet, closeSheet } from './lib/dom.js';
import { brandLockup } from './lib/brand.js';
import { syncOperationalPresentation, renderSyncOperationalSection } from './lib/sync-operational-ui.js';
import * as store from './store.js';
import * as db from './lib/db.js';
import * as cloud from './lib/cloud.js';
import { match, currentPath, onNavigate, go, backWithinApp } from './router.js';
import { setRepaint } from './repaint.js';
import { installSessionAutoTriggers } from './lib/session-auto.js';
import { createWorkspaceRegistry, demoDescriptor } from './lib/workspaces.js';
import { resolveWorkspaceForBoot, WORKSPACE_NOT_READY } from './lib/workspace-routing.js';
import {
  clearDemoRequest, clearLegacyDemoRequest, isDemoPreparing, isDemoRequested,
  markDemoReady, requestDemo, seedDemoWorkspace,
} from './lib/demo-workspace.js';
import { runInitialRestore } from './lib/initial-restore.js';
import { getAccountPresentation } from './lib/account-profile.js';
import {
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  emailOtpFailureMessage,
  emailOtpFailureState,
  isValidEmailOtp,
  normalizeEmailAddress,
  normalizeEmailOtp,
} from './lib/email-otp.js';

const app = document.getElementById('app');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
});

// Expose for E2E tests ONLY in Vite development. Static hosting does not
// provide import.meta.env, so this must remain safe in the raw ESM build.
if (import.meta.env?.DEV) {
  window.store = { ...store, repaint: () => { if (typeof scheduleRender !== 'undefined') scheduleRender(); } };
}

let view = null;
let ctx = null;
let mainEl = null;
let syncModule = null;
let teacherMiniHubSheet = null;
let teacherMiniHubAuthPending = null;
let workspaceRouting = null;
let initialRestoreAbortController = null;
const scrollMemory = new Map();

const isDemoWorkspace = () => store.getActiveWorkspace()?.type === 'demo';
const canMaterializeTodaySessions = () => isDemoWorkspace() || Boolean(cloud.session && cloud.user);

/* ---------- حالة وتسميات المزامنة والتثبيت ---------- */

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return !!(window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    document.referrer?.includes('android-app://'));
}

function teacherInitials(name) {
  const clean = String(name ?? '').trim();
  if (!clean || clean === 'المعلم' || clean === 'المعلمة' || clean === 'المعلّم' || clean === 'المعلّمة') return 'م';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]} ${parts[1][0]}`;
  return parts[0].slice(0, 2);
}

function getSyncState() {
  return syncOperationalPresentation(syncModule?.getSyncOperationalSummarySnapshot());
}

function renderSidebarMiniHubTrigger() {
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const teacherName = profile.teacherName || presentation.teacherLabel;
  const schoolName = profile.schoolName || '';
  const syncInfo = getSyncState();

  if (isDemoWorkspace()) return html`
    <button class="teacher-mini-hub-trigger" data-act="demo-login" aria-label="الخروج من الوضع التجريبي وتسجيل الدخول">
      <div class="teacher-mini-hub-trigger__avatar" aria-hidden="true">ع</div>
      <div class="teacher-mini-hub-trigger__info">
        <div class="teacher-mini-hub-trigger__name">مساحة تجريبية</div>
        <div class="teacher-mini-hub-trigger__sub">بيانات خيالية</div>
      </div>
      <div class="teacher-mini-hub-trigger__chev" aria-hidden="true">${icon('chev')}</div>
    </button>
  `;

  return html`
    <button class="teacher-mini-hub-trigger" data-act="open-teacher-mini-hub" aria-label="مركز تحكم ${presentation.teacherLabel}">
      <div class="teacher-mini-hub-trigger__avatar" aria-hidden="true">
        ${teacherInitials(teacherName)}
      </div>
      <div class="teacher-mini-hub-trigger__info">
        <div class="teacher-mini-hub-trigger__name">${teacherName}</div>
        ${schoolName ? html`<div class="teacher-mini-hub-trigger__sub">${schoolName}</div>` : ''}
      </div>
      <div class="teacher-mini-hub-trigger__sync" title="${syncInfo.text}">
        <span class="sync-dot sync-dot--${syncInfo.status}" data-sync-status aria-hidden="true"></span>
      </div>
      <div class="teacher-mini-hub-trigger__chev" aria-hidden="true">
        ${icon('chev')}
      </div>
    </button>
  `;
}

function renderTeacherMiniHubBody() {
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const teacherName = profile.teacherName || presentation.teacherLabel;
  const schoolName = profile.schoolName || '';
  const syncInfo = getSyncState();
  const isInstalled = isStandaloneMode();
  const hasInstallPrompt = typeof window !== 'undefined' && !!window.deferredInstallPrompt;
  const isLoggedIn = !!(cloud.session && cloud.user);
  const demo = isDemoWorkspace();
  const authPending = teacherMiniHubAuthPending;

  return html`
      <div class="mini-hub-sheet">
        <section class="mini-hub-surface" aria-label="مركز ${presentation.teacherLabel}">
          <div class="mini-hub-identity">
            <div class="mini-hub-avatar" aria-hidden="true">${teacherInitials(teacherName)}</div>
            <div class="flex-1 min-w-0">
              <div class="mini-hub-name">${teacherName}</div>
              <div class="mini-hub-school t-3 fs-xs">${schoolName || (isLoggedIn ? 'حساب متصل' : 'سجل معلّم محلي')}</div>
            </div>
          </div>

          <div class="mini-hub-account mini-hub-section">
          <div class="mini-hub-account__row">
            <div class="mini-hub-account__info">
              <div class="mini-hub-account__title">الحساب</div>
              ${demo
                ? html`<div class="mini-hub-account__status">الوضع التجريبي</div>`
                : authPending === 'logout'
                ? html`<div class="mini-hub-account__status">جارٍ تسجيل الخروج...</div>`
                : isLoggedIn
                ? html`<div class="mini-hub-account__status truncate" dir="ltr">${cloud.user.email}</div>`
                : html`<div class="mini-hub-account__status">${authPending === 'login' ? 'جارٍ تسجيل الدخول...' : 'غير مسجل الدخول'}</div>`}
            </div>
            <div class="mini-hub-account__action">
              ${demo
                ? html`<button type="button" class="btn btn--xs btn--quiet" data-act="demo-exit">الخروج من التجربة</button>`
                : authPending
                ? html`<button type="button" class="btn btn--xs btn--quiet" disabled>${authPending === 'logout' ? 'جارٍ تسجيل الخروج...' : 'جارٍ الاتصال...'}</button>`
                : isLoggedIn
                ? html`<button type="button" class="btn btn--xs btn--quiet" data-act="mini-hub-logout">تسجيل الخروج</button>`
                : html`<div class="hstack gap-1 wrap"><button type="button" class="btn btn--xs btn--ghost" data-act="mini-hub-login">تسجيل الدخول</button><button type="button" class="btn btn--xs btn--quiet" data-act="demo-enter">جرّب ركيز</button></div>`}
            </div>
          </div>
          </div>

          ${demo ? html`<div class="mini-hub-sync mini-hub-section"><div class="t-3 fs-xs">بيانات تجريبية محلية فقط — لا مزامنة سحابية</div></div>` : html`
            <div class="mini-hub-sync mini-hub-section" aria-live="polite">${renderSyncOperationalSection(syncInfo.summary)}</div>
          `}

          <div class="mini-hub-pwa mini-hub-section">
            <div class="mini-hub-pwa__copy">
              <div class="fw-7 fs-sm">تطبيق رَكيز المعلم</div>
          ${isInstalled
            ? html`
                <div class="mini-hub-installed">
                  <span class="mini-hub-installed__icon" aria-hidden="true">${icon('check')}</span>
                  <span class="mini-hub-installed__text">مثبت على هذا الجهاز</span>
                </div>
              `
            : hasInstallPrompt
            ? html`
                <span class="t-3 fs-xs">متاح للتثبيت</span>
              `
            : html`
                <span class="t-3 fs-xs">ثبّته للوصول السريع</span>
              `}
            </div>
            ${!isInstalled ? html`
              <button class="btn btn--xs btn--ghost" data-act="${hasInstallPrompt ? 'mini-hub-pwa-install' : 'mini-hub-pwa-guide'}">
                ${icon('download')} ${hasInstallPrompt ? 'تثبيت' : 'إرشادات'}
              </button>
            ` : ''}
          </div>

          <a class="mini-hub-settings-link" href="#/settings" data-sheet-close>
            <span class="mini-hub-settings-link__icon" aria-hidden="true">${icon('settings')}</span>
            <span class="mini-hub-settings-link__copy"><b>الإعدادات</b><small>تخصيص التطبيق وإدارة البيانات</small></span>
            <span class="mini-hub-settings-link__chev" aria-hidden="true">${icon('chev')}</span>
          </a>
          <a class="mini-hub-settings-link" href="#/support" data-sheet-close>
            <span class="mini-hub-settings-link__icon" aria-hidden="true">${icon('note')}</span>
            <span class="mini-hub-settings-link__copy"><b>الدعم</b><small>تواصل مع فريق رَكيز المعلم</small></span>
            <span class="mini-hub-settings-link__chev" aria-hidden="true">${icon('chev')}</span>
          </a>
        </section>
      </div>
    `;
}

function refreshTeacherMiniHubSheet({ focusAccountAction = false } = {}) {
  if (!teacherMiniHubSheet?.isConnected) return false;
  const body = teacherMiniHubSheet.querySelector('.sheet__body');
  if (!body) return false;
  render(body, renderTeacherMiniHubBody());
  if (focusAccountAction) {
    teacherMiniHubSheet.querySelector('.mini-hub-account__action button')?.focus({ preventScroll: true });
  }
  return true;
}

function openTeacherMiniHubSheet() {
  void refreshSyncOperationalUI();
  if (refreshTeacherMiniHubSheet()) return Promise.resolve();
  const presentation = getAccountPresentation(store.state.profile?.teacherForm);
  const sheet = openSheet({
    title: `مركز ${presentation.teacherLabel}`,
    body: renderTeacherMiniHubBody(),
    onMount: (root) => { teacherMiniHubSheet = root; },
  });
  sheet.finally(() => {
    if (teacherMiniHubSheet?.isConnected === false) teacherMiniHubSheet = null;
  });
  return sheet;
}

/* ---------- التنقل الرئيسي ---------- */

const NAV = [
  { href: '#/',          icon: 'home',      label: 'الرئيسية',        exact: true, primary: true },
  { href: '#/classes',   icon: 'classes',   label: 'الفصول',          primary: true },
  { href: '#/schedule',  icon: 'timetable', label: 'الجدول',          primary: true },
  { href: '#/reports',   icon: 'reports',   label: 'التقارير',        primary: true },
  { href: '#/calendar',  icon: 'calendar',  label: 'التقويم',          primary: true },
  { href: '#/settings',  icon: 'settings',  label: 'الإعدادات', group: 'النظام' },
];

/** تنقّل سياقي داخل الإسناد؛ لا يحل محل تنقّل التطبيق الرئيسي. */
const teachingNav = (id) => [
  { href: `#/teaching/${id}`,            icon: 'home',       label: 'الفصل', exact: true, activeFor: [`/teaching/${id}/class-rules`, `/teaching/${id}/sessions`] },
  { href: `#/teaching/${id}/students`,   icon: 'classes',    label: 'الطلاب' },
  { href: `#/teaching/${id}/attendance`, icon: 'attendance', label: 'الحضور' },
  { href: `#/teaching/${id}/grades`,     icon: 'grades',     label: 'كشف الدرجات' },
];

const primaryParent = (path) => {
  if (path.startsWith('/teaching/')) return path.endsWith('/reports') ? '/reports' : '/classes';
  if (path.startsWith('/student/')) return '/classes';
  if (path.startsWith('/reports/')) return '/reports';
  if (path.startsWith('/schedule/')) return '/schedule';
  if (path.startsWith('/settings/')) return '/settings';
  return path;
};

const isCurrent = (item, path) => {
  const target = item.href.slice(1);
  if (item.primary && target === primaryParent(path)) return true;
  if (item.activeFor?.some((candidate) => path === candidate || path.startsWith(`${candidate}?`))) return true;
  return item.exact ? path === target : path.startsWith(target);
};

const navLink = (it, path, kind) => html`
  <a class="${kind}__item" href="${it.href}" ${isCurrent(it, path) ? html`aria-current="page"` : ''}>
    ${icon(it.icon)}<span>${it.label}</span>
  </a>
`;

function shell(path, params) {
  const inTeaching = path.startsWith('/teaching/') && params?.id;
  const bottom = NAV.filter((n) => n.primary);
  const syncInfo = getSyncState();
  const showConnectionState = syncInfo.status === 'offline' || syncInfo.help;

  return html`
    <a class="skip-link" href="#main" data-act="skip-to-content">انتقل إلى المحتوى</a>
    <div class="layout">
      <nav class="sidebar" aria-label="التنقل الرئيسي">
        <div class="sidebar__brand">${brandLockup()}</div>
        ${NAV.map((it) => html`${it.group ? html`<div class="sidebar__section-label">${it.group}</div>` : ''}${navLink(it, path, 'sidebar')}`)}
        <div class="sidebar__spacer"></div>
        ${inTeaching
          ? html`<a class="sidebar__item" href="#/classes">${icon('back')}<span>كل الفصول</span></a>`
          : ''}
        <div id="sidebar-mini-hub">${renderSidebarMiniHubTrigger()}</div>
      </nav>
      <main class="main">
        ${inTeaching ? html`<div class="class-context-nav-bar"><nav class="class-context-nav" data-nav-scope="context" aria-label="تنقل الفصل">${teachingNav(params.id).map((it) => navLink(it, path, 'class-context-nav'))}</nav></div>` : ''}
        <div class="app-status-strip ${showConnectionState ? `is-visible is-${syncInfo.status}` : ''}"
             data-app-status role="status" aria-live="polite" aria-atomic="true">
          ${icon('cloud')} <span data-app-status-text>${syncInfo.label}</span>
          <a class="app-status-strip__support" href="#/support">تحتاج مساعدة؟</a>
        </div>
        <div id="main" tabindex="-1"></div>
      </main>
      <nav class="tabbar" data-nav-scope="primary" aria-label="التنقل الرئيسي">
        ${bottom.map((it) => navLink(it, path, 'tabbar'))}
      </nav>
    </div>
  `;
}

/** بقية عناصر التنقل على الجوال — حتى لا يزدحم الشريط السفلي. */
/* ---------- الشريط العلوي ---------- */

function topbar(v, params) {
  const backHref = v.back?.(params);
  const title = typeof v.title === 'function' ? v.title(params) : v.title ?? 'رَكيز المعلم';
  const sub = v.subtitle?.(params);
  const actions = v.topActions?.(params);
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const teacherName = profile.teacherName || presentation.teacherLabel;
  const syncInfo = getSyncState();
  const isHome = currentPath() === '/';
  const isClassHub = /^\/teaching\/[^/]+$/.test(currentPath());
  const isLoggedIn = !!(cloud.session && cloud.user);
  const demo = isDemoWorkspace();
  const accountName = String(profile.teacherName ?? '').trim();
  const homeAccountLabel = demo ? 'تجريبي' : isLoggedIn ? (accountName || 'إكمال الحساب') : 'تسجيل الدخول';
  const homeAccountA11y = demo ? 'الوضع التجريبي، بيانات محلية' : isLoggedIn ? `${homeAccountLabel}، ${syncInfo.text}` : homeAccountLabel;

  return html`
    <header class="topbar ${isHome ? 'topbar--home' : ''} ${isClassHub ? 'topbar--class-hub' : ''}">
      ${backHref ? html`<a class="iconbtn" href="${backHref}" data-act="app-back" data-back-fallback="${backHref}" aria-label="رجوع">${icon('back')}</a>` : ''}
      <h1 class="topbar__title">
        ${isHome ? html`
          <span class="mobile-brand">${brandLockup({ compact: true })}</span>
          <span class="topbar__page desktop-home-title">
            <span class="topbar__title-row"><strong>${title}</strong>${demo ? html`<span class="demo-pill demo-pill--desktop" data-demo-indicator>الوضع التجريبي <small>· بيانات محلية</small></span>` : ''}</span>
          </span>
        ` : title}${sub ? html`<span class="topbar__sub">${sub}</span>` : ''}
      </h1>
      <div class="topbar__actions">
        ${actions ?? ''}
        ${isHome && demo ? html`<span class="demo-pill demo-pill--mobile" data-demo-indicator>تجريبي</span>` : ''}
        ${!isHome && demo ? html`<span class="demo-pill" data-demo-indicator>الوضع التجريبي</span>` : ''}
        ${isHome ? html`
          <button class="topbar__teacher-btn topbar__teacher-btn--home-account"
                  data-act="${demo ? 'demo-login' : 'open-teacher-mini-hub'}"
                  ${isLoggedIn ? html`data-sync-account-label="${homeAccountLabel}"` : ''}
                  aria-label="${homeAccountA11y}"
                  title="${isLoggedIn ? `${homeAccountLabel} — ${syncInfo.text}` : homeAccountLabel}">
            <span class="topbar__account-icon" aria-hidden="true">${icon(isLoggedIn ? 'student' : 'login')}</span>
            <span class="topbar__account-name">${homeAccountLabel}</span>
            ${isLoggedIn ? html`<span class="sync-dot sync-dot--${syncInfo.status} topbar__teacher-sync" data-sync-status aria-hidden="true" title="${syncInfo.text}"></span>` : ''}
          </button>
        ` : demo ? html`
          <button class="btn btn--xs btn--quiet topbar__demo-login" data-act="demo-login" aria-label="الخروج من الوضع التجريبي وتسجيل الدخول">
            ${icon('login')} تسجيل الدخول
          </button>
        ` : html`
          <button class="topbar__teacher-btn" data-act="open-teacher-mini-hub" aria-label="مركز تحكم ${presentation.teacherLabel}: ${teacherName}">
            <span class="topbar__teacher-avatar" aria-hidden="true">${teacherInitials(teacherName)}</span>
            <span class="sync-dot sync-dot--${syncInfo.status} topbar__teacher-sync" data-sync-status aria-hidden="true" title="${syncInfo.text}"></span>
          </button>
        `}
      </div>
    </header>
  `;
}

/* ---------- حفظ التركيز بين عمليات الرسم ---------- */

function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.dataset?.fk) return null;
  const snap = { fk: el.dataset.fk };
  if (typeof el.selectionStart === 'number') {
    snap.start = el.selectionStart;
    snap.end = el.selectionEnd;
  }
  return snap;
}

function restoreFocus(snap) {
  if (!snap) return;
  const el = mainEl?.querySelector(`[data-fk="${CSS.escape(snap.fk)}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (snap.start !== undefined && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(snap.start, snap.end); } catch { /* حقول لا تدعم التحديد */ }
  }
}

/** مزامنة الحالة تغيّر مؤشرات صغيرة فقط؛ لا تستبدل الشاشة النشطة أو تركيزها. */
function paintSyncStatus() {
  const syncInfo = getSyncState();
  const statusStrip = document.querySelector('[data-app-status]');
  if (statusStrip) {
    const visible = syncInfo.status === 'offline' || syncInfo.help;
    statusStrip.className = `app-status-strip${visible ? ` is-visible is-${syncInfo.status}` : ''}`;
    statusStrip.querySelector('[data-app-status-text]')?.replaceChildren(syncInfo.label);
  }
  const section = teacherMiniHubSheet?.querySelector('.mini-hub-sync');
  if (section) {
    const expanded = section.querySelector('details')?.open;
    const focused = section.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.dataset.act;
    const focusHref = focused?.getAttribute('href');
    const focusSummary = focused?.tagName === 'SUMMARY';
    render(section, renderSyncOperationalSection(syncInfo.summary));
    section.querySelector('details').open = !!expanded;
    if (focusKey) section.querySelector(`[data-act="${focusKey}"]`)?.focus({ preventScroll: true });
    else if (focusHref === '#/support') section.querySelector('a[href="#/support"]')?.focus({ preventScroll: true });
    else if (focusSummary) section.querySelector('summary')?.focus({ preventScroll: true });
  }
  for (const el of document.querySelectorAll('[data-sync-label]')) el.textContent = syncInfo.text;
  for (const el of document.querySelectorAll('[data-sync-badge]')) {
    for (const className of [...el.classList]) {
      if (className.startsWith('badge--')) el.classList.remove(className);
    }
    el.classList.add(syncInfo.badge);
  }
  for (const el of document.querySelectorAll('[data-sync-description]')) el.textContent = syncInfo.label;
  for (const el of document.querySelectorAll('[data-sync-time]')) {
    el.textContent = syncInfo.summary.lastSuccessfulSyncAt
      ? new Date(syncInfo.summary.lastSuccessfulSyncAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—';
  }
  for (const el of document.querySelectorAll('[data-sync-action]')) {
    el.disabled = !syncInfo.canSync;
  }
  for (const el of document.querySelectorAll('[data-sync-action-label]')) {
    el.textContent = syncInfo.status === 'syncing' ? 'جارٍ المزامنة...' : 'مزامنة الآن';
  }
  for (const el of document.querySelectorAll('[data-sync-status]')) {
    for (const name of [...el.classList]) {
      if (name.startsWith('sync-dot--')) el.classList.remove(name);
    }
    el.classList.add(`sync-dot--${syncInfo.status}`);
    el.title = syncInfo.text;
    el.parentElement?.setAttribute('title', syncInfo.text);
  }
  for (const el of document.querySelectorAll('[data-sync-account-label]')) {
    const label = el.dataset.syncAccountLabel;
    el.setAttribute('aria-label', `${label}، ${syncInfo.text}`);
    el.title = `${label} — ${syncInfo.text}`;
  }
}

// Refresh the existing read-only contract before painting; never infer outbox truth here.
let syncSummaryRefresh = null;
let syncSummaryRefreshAgain = false;
async function refreshSyncOperationalUI() {
  if (!syncModule) return;
  if (syncSummaryRefresh) { syncSummaryRefreshAgain = true; return syncSummaryRefresh; }
  syncSummaryRefresh = (async () => {
    do {
      syncSummaryRefreshAgain = false;
      await syncModule.getSyncOperationalSummary();
      paintSyncStatus();
    } while (syncSummaryRefreshAgain);
  })();
  try { await syncSummaryRefresh; }
  catch { /* Keep the last safe runtime snapshot; do not invent a new Sync state. */ }
  finally { syncSummaryRefresh = null; }
}

/* ---------- الرسم ---------- */

let renderQueued = false;

/**
 * يجمع عدة تغييرات في رسمة واحدة.
 * لا نعتمد على requestAnimationFrame: المتصفح يوقفه حين تكون الصفحة مخفية،
 * فتُحفظ البيانات ولا تتحدث الواجهة عند العودة.
 */
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => {
    renderQueued = false;
    paint();
  }, 0);
}

function paint() {
  if (!view || !ctx || !mainEl) return;
  const snap = captureFocus();
  try {
    const hubEl = document.getElementById('sidebar-mini-hub');
    if (hubEl) {
      render(hubEl, renderSidebarMiniHubTrigger());
    }
    render(
      mainEl,
      html`${topbar(view, ctx.params)}
        <div class="page ${view.wide ? 'page--wide' : ''} ${currentPath() === '/' ? 'page--home' : currentPath() === '/schedule' ? 'page--schedule' : ''} ${currentPath().startsWith('/teaching/') ? 'page--class-workspace' : ''}">${view.render(ctx.params)}</div>`
    );
  } catch (err) {
    console.error('[rakeezx] فشل رسم الشاشة', err);
    render(
      mainEl,
      html`<div class="page">
        <div class="empty empty--error" role="alert">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">تعذّر عرض هذه الشاشة</div>
          <div class="empty__text">${String(err?.message ?? err)}</div>
          <a class="btn btn--primary" href="#/">العودة للرئيسية</a>
        </div>
      </div>`
    );
    return;
  }
  restoreFocus(snap);
  view.afterPaint?.(mainEl, ctx.params);
}

/* ---------- تبديل الشاشة ---------- */

async function resolve() {
  const path = currentPath();
  const found = match(path);

  if (!found) {
    go('/', { replace: true });
    return;
  }

  if (canMaterializeTodaySessions()) await store.ensureSessionsForDate();

  if (ctx) scrollMemory.set(ctx.path, window.scrollY);
  view?.onUnmount?.();

  let mod;
  try {
    mod = await found.route.load();
  } catch (err) {
    console.error('[rakeezx] تعذّر تحميل الشاشة', err);
    toast('تعذّر فتح هذه الشاشة', 'danger');
    return;
  }

  view = mod.default;
  ctx = found;

  render(app, shell(found.path, found.params));
  mainEl = document.getElementById('main');

  paint();
  view.onMount?.(mainEl, found.params);

  const y = scrollMemory.get(found.path);
  window.scrollTo({ top: y ?? 0, behavior: 'instant' });
}

/* ---------- الإقلاع ---------- */

async function boot() {
  // تبويب آخر يرقّي القاعدة: أعد التحميل بدل العمل على مخطط قديم
  db.setVersionChangeHandler(() => {
    toast('حُدِّث التطبيق في نافذة أخرى — يُعاد التحميل');
    setTimeout(() => location.reload(), 800);
  });

  try {
    // Restore the cached identity immediately, but never make the local shell
    // depend on a refresh request that Android may suspend while backgrounded.
    await cloud.init({ waitForRefresh: false });
    clearLegacyDemoRequest();
    if (cloud.session && cloud.user) clearDemoRequest();
    const registry = createWorkspaceRegistry();
    const demoPreparing = !cloud.session && !cloud.user && isDemoPreparing();
    try {
      await registry.unregisterDemo();
      if (!cloud.session && !cloud.user && isDemoRequested()) {
        workspaceRouting = { status: 'ready', authState: 'signed_out', workspace: demoDescriptor() };
      } else workspaceRouting = await resolveWorkspaceForBoot({
        authUser: cloud.user,
        authState: cloud.session && cloud.user ? 'authenticated' : 'signed_out',
        registry,
        allowDevelopmentLegacyBootstrap: import.meta.env?.DEV === true,
      });
    } finally {
      await registry.close();
    }
    if (import.meta.env?.DEV) window.__workspaceRouting = workspaceRouting;
    if (workspaceRouting.status !== 'ready' && cloud.session && cloud.user &&
        ['initial-restore-required', 'initial-restore-pending'].includes(workspaceRouting.reason)) {
      await mountAndRunInitialRestore();
      registerServiceWorker();
      return;
    }
    if (workspaceRouting.status !== 'ready') {
      store.deactivateWorkspace(workspaceRouting.reason);
      mountWorkspaceGate(workspaceRouting);
      registerServiceWorker();
      return;
    }
    store.activateWorkspace(workspaceRouting.workspace);
    if (workspaceRouting.workspace.type === 'demo') await seedDemoWorkspace({ force: demoPreparing });
    await store.init();
    // Dynamic import to prevent sync syntax errors from permanently blocking the app shell
    try {
      if (isDemoWorkspace()) throw Object.assign(new Error('Demo workspace has no cloud sync'), { code: 'DEMO_SYNC_DISABLED' });
      syncModule = await import('./lib/sync.js');
      syncModule.init();
      await syncModule.getSyncOperationalSummary();
      if (import.meta.env?.DEV) window.__syncModule = syncModule;
    } catch (err) {
      if (err?.code === 'DEMO_SYNC_DISABLED') syncModule = null;
      else
      console.error('[rakeezx] Sync module failed to load:', err);
    }
    if (canMaterializeTodaySessions()) await store.ensureSessionsForDate();
    if (isDemoWorkspace()) markDemoReady();
  } catch (err) {
    console.error('[rakeezx] فشل فتح قاعدة البيانات', err);
    render(
      app,
      html`<div class="page">
        <div class="empty empty--error" role="alert">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">تعذّر فتح سجلّك</div>
          <div class="empty__text">${String(err?.message ?? err)}</div>
          <div class="empty__text t-3">
            إن كنت في وضع التصفح الخاص فافتح التطبيق في نافذة عادية،
            وتأكد أن تخزين المواقع مسموح.
          </div>
          <button class="btn btn--primary" onclick="location.reload()">أعد المحاولة</button>
        </div>
      </div>`
    );
    return;
  }

  const handlers = () => {
    const a = view?.actions;
    const globals = GLOBAL_ACTIONS;
    return new Proxy(
      {},
      {
        get: (_t, key) => {
          const camelKey = typeof key === 'string' ? key.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase()) : key;
          const fn = a?.[key] ?? a?.[camelKey] ?? globals[key] ?? globals[camelKey];
          return typeof fn === 'function' ? (el, ev) => fn(el, ev, ctx?.params ?? {}) : undefined;
        },
      }
    );
  };

  delegate(app, handlers);
  delegate(document.getElementById('modal-root'), handlers);

  setRepaint(scheduleRender);
  store.onWriteError(() => toast('تعذّر الحفظ — لم يُسجَّل التعديل', 'danger'));
  store.subscribe((_state, update) => {
    if (update?.render !== false) scheduleRender();
  });
  cloud.subscribe(() => {
    if (cloud.session && cloud.user && isDemoWorkspace()) {
      clearDemoRequest();
      store.deactivateWorkspace('authenticated-session-replaces-demo');
      location.reload();
      return;
    }
    scheduleRender();
    refreshTeacherMiniHubSheet();
  });
  if (syncModule) {
    syncModule.subscribe(() => { void refreshSyncOperationalUI(); });
  }
  onNavigate(resolve);
  installSessionAutoTriggers({
    materialize: (date) => canMaterializeTodaySessions() ? store.ensureSessionsForDate(date) : null,
    onError: (err) => console.warn('[rakeezx sessions] automatic materialization failed:', err),
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', store.applyTheme);

  await resolve();
  registerServiceWorker();
}

const INITIAL_RESTORE_COPY = Object.freeze({
  RESTORE_PREFLIGHT: ['جارٍ تجهيز مساحة حسابك', 'جارٍ التحقق من بيانات الحساب...'],
  RESTORING: ['جارٍ تجهيز مساحة حسابك', 'جارٍ تجهيز مساحة العمل...'],
  RESTORE_FINALIZING: ['جارٍ تجهيز مساحة حسابك', 'أوشكنا على الانتهاء...'],
  RESTORE_REQUIRES_ONLINE: ['تحتاج إلى اتصال بالإنترنت لاستعادة بيانات الحساب', 'اتصل بالإنترنت ثم أعد المحاولة.'],
  RESTORE_FAILED: ['تعذر استعادة بيانات الحساب', 'لم تُفتح مساحة عمل جزئية. يمكنك إعادة المحاولة بأمان.'],
  PROVISIONING_REQUIRED: ['لا توجد مساحة عمل قابلة للاستعادة', 'هذا الحساب لا يملك بعد مساحة عمل سحابية موجودة. لن ينشئ التطبيق سجلًا فارغًا تلقائيًا.'],
});

function renderInitialRestoreState(state, { error = null } = {}) {
  const [title, description] = INITIAL_RESTORE_COPY[state] ?? INITIAL_RESTORE_COPY.RESTORE_FAILED;
  const actionable = ['RESTORE_REQUIRES_ONLINE', 'RESTORE_FAILED'].includes(state);
  const pending = ['RESTORE_PREFLIGHT', 'RESTORING', 'RESTORE_FINALIZING'].includes(state);
  const failed = state === 'RESTORE_FAILED';
  const current = app.querySelector('[data-initial-restore-state][data-restore-pending="true"]');
  if (pending && current) {
    current.dataset.initialRestoreState = state;
    current.querySelector('[data-restore-progress]').textContent = description;
    return;
  }
  render(app, html`
    <div class="page first-run-page" data-initial-restore-state="${state}" data-restore-pending="${pending}">
      <div class="first-run-orb first-run-orb--green" aria-hidden="true"></div>
      <div class="first-run-orb first-run-orb--blue" aria-hidden="true"></div>
      <div class="first-run-card first-run-status ${failed ? 'first-run-status--error' : ''}"
           role="${failed ? 'alert' : 'status'}" aria-live="polite">
        <div class="first-run-status__brand">${brandLockup({ compact: true })}</div>
        ${pending
          ? html`<div class="first-run-status__spinner" aria-hidden="true"></div>`
          : html`<div class="first-run-status__icon">${icon(failed ? 'note' : 'cloud')}</div>`}
        <div class="first-run-status__copy">
          <div class="first-run-eyebrow">مساحة حسابك</div>
          <h1>${title}</h1>
          <p data-restore-progress>${description}</p>
        </div>
        ${error && import.meta.env?.DEV ? html`<div class="first-run-status__detail">${error.code ?? error.message}</div>` : ''}
        <div class="first-run-status__actions">
          ${actionable ? html`<button class="btn btn--primary" type="button" data-restore-retry>إعادة المحاولة</button>` : ''}
          <button class="btn btn--ghost" type="button" data-restore-logout>تسجيل الخروج</button>
          <a class="btn btn--quiet" href="mailto:support@rakeezx.com">الدعم</a>
        </div>
      </div>
    </div>
  `);
  app.querySelector('[data-restore-retry]')?.addEventListener('click', () => location.reload());
  app.querySelector('[data-restore-logout]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    initialRestoreAbortController?.abort();
    store.deactivateWorkspace('initial-restore-logout');
    await cloud.signOut();
    location.reload();
  });
}

async function mountAndRunInitialRestore() {
  const registry = createWorkspaceRegistry();
  initialRestoreAbortController = new AbortController();
  try {
    renderInitialRestoreState(navigator.onLine === false ? 'RESTORE_REQUIRES_ONLINE' : 'RESTORE_PREFLIGHT');
    if (navigator.onLine === false) return;
    const result = await runInitialRestore({
      expectedOwnerId: cloud.user.id,
      registry,
      onState: (state) => renderInitialRestoreState(state),
      signal: initialRestoreAbortController.signal,
    });
    if (result.status === 'provisioning_required') {
      renderInitialRestoreState('PROVISIONING_REQUIRED');
      return;
    }
    if (result.status === 'ready') {
      location.reload();
      return;
    }
    renderInitialRestoreState('RESTORE_FAILED');
  } catch (error) {
    console.error('[rakeezx] Initial Restore failed', error);
    renderInitialRestoreState(error?.code === 'RESTORE_REQUIRES_ONLINE' ? 'RESTORE_REQUIRES_ONLINE' : 'RESTORE_FAILED', { error });
  } finally {
    initialRestoreAbortController = null;
    await registry.close();
  }
}

function openMiniHubLoginSheet({ reloadOnSuccess = false } = {}) {
  teacherMiniHubAuthPending = 'login';
  refreshTeacherMiniHubSheet();
  let cleanupLoginSheet = () => {};
  const loginSheet = openSheet({
    title: 'ابدأ مع ركيز',
    desc: 'أدخل بريدك الإلكتروني لإرسال رمز التحقق.',
    body: html`
      <div class="first-run-auth">
      <div class="auth-brand">${brandLockup()}<p>رَكيزة المعلم الرقمية</p></div>
      <form id="mini-hub-login-form" data-step="email" aria-live="polite">
        <div data-email-otp-email-step>
        <label class="field">
          <span class="field__label">البريد الإلكتروني</span>
          <input class="input" name="email" type="email" required autocomplete="email" dir="ltr" placeholder="teacher@example.com">
          <span class="t-3 fs-xs" data-email-otp-cooldown aria-live="polite"></span>
        </label>
        </div>
        <div data-email-otp-code-step hidden>
          <div class="field">
            <h2 class="first-run-auth__step-title">أدخل رمز التحقق</h2>
            <span class="field__label">رمز التحقق المكوّن من 6 أرقام</span>
            <div class="t-3 fs-xs" data-email-otp-sent aria-live="polite"></div>
            <input class="input first-run-auth__otp" name="token" inputmode="numeric" autocomplete="one-time-code" dir="ltr"
              pattern="[0-9]{6}" maxlength="6" aria-label="رمز التحقق المكون من 6 أرقام">
          </div>
          <div class="first-run-auth__otp-actions mt-2">
            <button type="button" class="btn btn--xs btn--quiet" data-email-otp-resend>إعادة إرسال الرمز</button>
            <button type="button" class="btn btn--xs btn--ghost" data-email-otp-change>تغيير الإيميل</button>
          </div>
        </div>
        <a class="first-run-auth__support" href="mailto:support@rakeezx.com">الدعم: support@rakeezx.com</a>
      </form>
      </div>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="mini-hub-login-form" type="submit">إرسال رمز التحقق</button>
    `,
    onMount: (root, done) => {
      const form = root.querySelector('#mini-hub-login-form');
      const emailStep = root.querySelector('[data-email-otp-email-step]');
      const codeStep = root.querySelector('[data-email-otp-code-step]');
      const emailInput = root.querySelector('input[name="email"]');
      const tokenInput = root.querySelector('input[name="token"]');
      const submitBtn = root.querySelector('button[type="submit"]');
      const resendBtn = root.querySelector('[data-email-otp-resend]');
      const sentText = root.querySelector('[data-email-otp-sent]');
      const cooldownText = root.querySelector('[data-email-otp-cooldown]');
      let selectedEmail = '';
      let cooldownTimer = null;
      let requestInFlight = false;
      const cooldownByEmail = new Map();
      cleanupLoginSheet = () => clearTimeout(cooldownTimer);

      const cooldownRemaining = (email) => {
        const until = cooldownByEmail.get(normalizeEmailAddress(email)) ?? 0;
        return Math.max(0, Math.ceil((until - Date.now()) / 1000));
      };
      const updateCooldown = () => {
        const emailRemaining = cooldownRemaining(emailInput.value);
        const resendRemaining = cooldownRemaining(selectedEmail);
        cooldownText.textContent = emailRemaining > 0 ? `يمكنك طلب رمز جديد بعد ${emailRemaining} ثانية` : '';
        resendBtn.disabled = requestInFlight || resendRemaining > 0;
        resendBtn.textContent = resendRemaining > 0 ? `إعادة الإرسال بعد ${resendRemaining} ث` : 'إعادة إرسال الرمز';
        if (form.dataset.step === 'email') submitBtn.disabled = requestInFlight || emailRemaining > 0;
        clearTimeout(cooldownTimer);
        if (Math.max(emailRemaining, resendRemaining) > 0) cooldownTimer = setTimeout(updateCooldown, 1000);
      };
      const startCooldown = (email, seconds = EMAIL_OTP_RESEND_COOLDOWN_SECONDS) => {
        cooldownByEmail.set(normalizeEmailAddress(email), Date.now() + (seconds * 1000));
        updateCooldown();
      };
      const requestCode = async (email) => {
        email = normalizeEmailAddress(email);
        if (requestInFlight || cooldownRemaining(email) > 0) {
          updateCooldown();
          return false;
        }
        if (navigator.onLine === false) throw Object.assign(new Error('Offline'), { code: 'AUTH_NETWORK' });
        requestInFlight = true;
        updateCooldown();
        try {
          await cloud.requestEmailOtp(email);
          selectedEmail = email;
          sentText.textContent = `أُرسل الرمز إلى ${email}`;
          emailStep.hidden = true;
          codeStep.hidden = false;
          form.dataset.step = 'verify';
          submitBtn.textContent = 'تحقق وتسجيل الدخول';
          tokenInput.required = true;
          tokenInput.focus({ preventScroll: true });
          startCooldown(email);
          return true;
        } finally {
          requestInFlight = false;
          updateCooldown();
          if (form.dataset.step === 'verify') submitBtn.disabled = false;
        }
      };

      emailInput?.addEventListener('input', updateCooldown);
      tokenInput?.addEventListener('input', () => { tokenInput.value = normalizeEmailOtp(tokenInput.value); });
      root.querySelector('[data-email-otp-change]')?.addEventListener('click', () => {
        codeStep.hidden = true;
        emailStep.hidden = false;
        form.dataset.step = 'email';
        tokenInput.required = false;
        tokenInput.value = '';
        submitBtn.textContent = 'إرسال رمز التحقق';
        updateCooldown();
        emailInput.focus({ preventScroll: true });
      });
      resendBtn?.addEventListener('click', async () => {
        if (resendBtn.disabled || !selectedEmail) return;
        resendBtn.disabled = true;
        try {
          if (await requestCode(selectedEmail)) toast('أُعيد إرسال رمز التحقق');
        } catch (error) {
          if (emailOtpFailureState(error, 'send') === 'rate_limited' && error.retryAfterSeconds) {
            startCooldown(selectedEmail, error.retryAfterSeconds);
          }
          toast(emailOtpFailureMessage(emailOtpFailureState(error, 'send')), 'danger');
          updateCooldown();
        }
      });

      form?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const email = normalizeEmailAddress(emailInput.value);
        const token = normalizeEmailOtp(tokenInput.value);
        if (!email || (form.dataset.step === 'verify' && !isValidEmailOtp(token))) {
          if (form.dataset.step === 'verify') toast(`أدخل رمز التحقق المكون من ${EMAIL_OTP_LENGTH} أرقام`, 'danger');
          return;
        }
        const prevText = submitBtn.textContent;
        submitBtn.textContent = form.dataset.step === 'verify' ? 'جارٍ التحقق...' : 'جارٍ الإرسال...';
        submitBtn.disabled = true;
        try {
          if (form.dataset.step === 'email') {
            const sent = await requestCode(email);
            if (!sent) submitBtn.textContent = prevText;
            updateCooldown();
            return;
          }
          await cloud.verifyEmailOtp(selectedEmail, token);
          toast('تم تسجيل الدخول بنجاح');
          teacherMiniHubAuthPending = null;
          clearTimeout(cooldownTimer);
          done(true);
          if (reloadOnSuccess) {
            location.reload();
            return;
          }
          refreshTeacherMiniHubSheet({ focusAccountAction: true });
        } catch (err) {
          submitBtn.textContent = prevText;
          if (emailOtpFailureState(err, form.dataset.step === 'verify' ? 'verify' : 'send') === 'rate_limited' && err.retryAfterSeconds) {
            startCooldown(email, err.retryAfterSeconds);
          }
          updateCooldown();
          if (form.dataset.step === 'verify') submitBtn.disabled = false;
          toast(emailOtpFailureMessage(emailOtpFailureState(err, form.dataset.step === 'verify' ? 'verify' : 'send')), 'danger');
        }
      });
    }
  });
  loginSheet.finally(() => {
    cleanupLoginSheet();
    if (teacherMiniHubAuthPending === 'login') {
      teacherMiniHubAuthPending = null;
      refreshTeacherMiniHubSheet({ focusAccountAction: true });
    }
  });
  return loginSheet;
}

function mountWorkspaceGate(routing) {
  const signedOut = routing.authState === 'signed_out' || !cloud.session || !cloud.user;
  render(app, html`
    <div class="page ${signedOut ? 'first-run-page' : ''}" data-workspace-gate data-workspace-code="${WORKSPACE_NOT_READY}" data-workspace-reason="${routing.reason}">
      ${signedOut ? html`
        <div class="first-run-orb first-run-orb--green" aria-hidden="true"></div>
        <div class="first-run-orb first-run-orb--blue" aria-hidden="true"></div>
        <main class="first-run-card first-run-welcome" aria-labelledby="first-run-title">
          <div class="first-run-welcome__brand">${brandLockup()}</div>
          <div class="first-run-welcome__copy">
            <h1 id="first-run-title">رَكيزة المعلم الرقمية</h1>
            <p>كل ما يحتاجه المعلم، في مكان واحد.</p>
          </div>
          <div class="first-run-welcome__actions">
            <button class="btn btn--primary" type="button" data-workspace-login>ابدأ مع ركيز</button>
            <button class="btn btn--ghost" type="button" data-workspace-demo>جرّب ركيز</button>
          </div>
        </main>
      ` : html`
        <div class="empty" role="status">
          <div class="empty__icon">${icon('shield')}</div>
          <div class="empty__title">مساحة العمل غير جاهزة على هذا الجهاز</div>
          <div class="empty__text">لم يتم العثور على مساحة عمل محلية مرتبطة بهذا الحساب. لم تُفتح أو تُنشأ أي قاعدة بيانات.</div>
          <button class="btn btn--ghost" type="button" data-workspace-logout>تسجيل الخروج</button>
        </div>
      `}
    </div>
  `);
  app.querySelector('[data-workspace-login]')?.addEventListener('click', () => {
    void openMiniHubLoginSheet({ reloadOnSuccess: true });
  });
  app.querySelector('[data-workspace-demo]')?.addEventListener('click', () => {
    requestDemo();
    location.reload();
  });
  app.querySelector('[data-workspace-logout]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await cloud.signOut();
    location.reload();
  });
}

/** أفعال متاحة في كل الشاشات. */
const GLOBAL_ACTIONS = {
  'skip-to-content': (_el, event) => {
    event.preventDefault();
    document.getElementById('main')?.focus();
  },
  'app-back': (el, event) => {
    event.preventDefault();
    backWithinApp(el.dataset.backFallback || el.getAttribute('href'));
  },
  'open-teacher-mini-hub': () => openTeacherMiniHubSheet(),
  'demo-enter': () => {
    if (cloud.session || cloud.user) return;
    requestDemo();
    location.reload();
  },
  'demo-exit': async () => {
    clearDemoRequest();
    store.deactivateWorkspace('demo-exit');
    location.reload();
  },
  'demo-login': async () => {
    clearDemoRequest();
    store.deactivateWorkspace('demo-login');
    location.reload();
  },
  'demo-reset': async () => {
    if (!isDemoWorkspace()) return;
    const accepted = await openSheet({
      title: 'إعادة ضبط البيانات التجريبية',
      body: html`<p>ستعود البيانات التجريبية إلى حالتها الأصلية. لن تتأثر أي بيانات حساب.</p>`,
      foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--danger" data-demo-reset-confirm>إعادة الضبط</button>`,
      onMount: (root, done) => root.querySelector('[data-demo-reset-confirm]')?.addEventListener('click', () => done(true)),
    });
    if (!accepted) return;
    await seedDemoWorkspace({ force: true });
    location.reload();
  },
  'mini-hub-login': () => {
    return openMiniHubLoginSheet();
  },
  'mini-hub-logout': async () => {
    teacherMiniHubAuthPending = 'logout';
    refreshTeacherMiniHubSheet();
    try {
      const protectedAccountWorkspace = store.getActiveWorkspace()?.type === 'account';
      if (protectedAccountWorkspace) await syncModule?.suspendForWorkspaceDeactivation?.();
      await cloud.signOut();
      toast('تم تسجيل الخروج');
      if (protectedAccountWorkspace) {
        store.deactivateWorkspace('explicit-logout');
        location.reload();
        return;
      }
    } catch (err) {
      syncModule?.resumeAfterWorkspaceDeactivationFailure?.();
      toast(err.message || 'تعذر تسجيل الخروج', 'danger');
    } finally {
      teacherMiniHubAuthPending = null;
      if (store.state.ready) refreshTeacherMiniHubSheet({ focusAccountAction: true });
    }
  },
  'mini-hub-sync-now': async (el) => {
    if (!syncModule) {
      toast('المزامنة السحابية غير متوفرة حاليًا', 'danger');
      return;
    }
    const prevText = el.innerHTML;
    el.disabled = true;
    el.textContent = 'جارٍ المزامنة...';
    try {
      const ok = await syncModule.syncAll({ full: true });
      if (!ok) toast('تعذرت المزامنة', 'danger');
    } catch (err) {
      toast('تعذرت المزامنة', 'danger');
    } finally {
      el.disabled = false;
      el.innerHTML = prevText;
      // Sync indicators update in place. Reopening here would stack a duplicate
      // Mini Hub sheet now that timing flows correctly preserve parent sheets.
    }
  },
  'mini-hub-pwa-install': async () => {
    if (window.deferredInstallPrompt) {
      window.deferredInstallPrompt.prompt();
      try {
        const { outcome } = await window.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          toast('جارٍ تثبيت تطبيق رَكيز المعلم...');
          window.deferredInstallPrompt = null;
          closeSheet();
          scheduleRender();
        }
      } catch {
        // ignore
      }
    } else {
      closeSheet();
      go('/settings');
    }
  },
  'mini-hub-pwa-guide': () => {
    closeSheet();
    go('/settings');
  },
};


function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!['https:', 'http:'].includes(location.protocol)) return;

  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then(async (reg) => {
      // تحقّق صريح من عامل أحدث؛ لا نفرض إعادة تحميل الصفحة الحالية.
      try {
        await reg.update();
      } catch (err) {
        console.warn('[rakeezx] تعذّر فحص تحديث عامل الخدمة', err);
      }

      // مخزون مُسح خارجيًا وعامل يبقى مسجّلًا = عمل دون إنترنت مكسور صامتًا.
      // نفحص المخزون ونعيد تهيئته بدل انتظار تثبيت جديد لن يأتي.
      try {
        const keys = await caches.keys();
        const mine = keys.filter((k) => k.startsWith('rakeezx-'));
        const count = mine.length ? (await (await caches.open(mine[0])).keys()).length : 0;
        if (reg.active && count === 0) {
          console.warn('[rakeezx] مخزون العمل دون إنترنت فارغ — يُعاد بناؤه');
          await reg.unregister();
          await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
        }
      } catch (err) {
        console.warn('[rakeezx] تعذّر فحص المخزون', err);
      }
    })
    .catch((err) => console.warn('[rakeezx] لم يُسجَّل عامل الخدمة', err));
}

addEventListener('error', (e) => console.error('[rakeezx]', e.error ?? e.message));
addEventListener('unhandledrejection', (e) => console.error('[rakeezx] وعد مرفوض', e.reason));

boot();

export { scheduleRender as repaint };
