/**
 * RAKEEZ X — غلاف التطبيق: الإقلاع، والهيكل، وتوجيه الشاشات، وإعادة الرسم.
 */

import { html, render, icon, delegate, toast, openSheet, closeSheet } from './lib/dom.js';
import { visibleLatinDigits } from './lib/visible-numerals.js';
import { displayIdentity, effectiveTheme } from './lib/display-identity.js';
import { brandLockup } from './lib/brand.js';
import { installVisibleViewport } from './lib/visible-viewport.js';
import { ensureThmanyahFont } from './lib/thmanyah-font.js';
import { syncOperationalPresentation, renderSyncOperationalSection } from './lib/sync-operational-ui.js';
import { startRecoveryCycle, wakeRecoveryCycle, presentSyncWarning } from './lib/sync-warning-policy.js';
import * as store from './store.js';
import * as db from './lib/db.js';
import * as cloud from './lib/cloud.js';
import { createMarketingAnalytics } from './lib/marketing-analytics.js';
import { LEASE_STORAGE_PREFIX } from './lib/offline-lease.js';
import { match, currentPath, onNavigate, go, backWithinApp } from './router.js';
import { captureSupportOriginBeforeNavigation, clearSupportOrigin, enterSupportVisit } from './lib/support-origin.js';
import { setRepaint } from './repaint.js';
import { installSessionAutoTriggers } from './lib/session-auto.js';
import { createWorkspaceRegistry, demoDescriptor } from './lib/workspaces.js';
import { resolveWorkspaceForBoot, WORKSPACE_NOT_READY } from './lib/workspace-routing.js';
import {
  clearDemoRequest, clearLegacyDemoRequest, isDemoPreparing, isDemoRequested,
  markDemoReady, requestDemo, seedDemoWorkspace,
} from './lib/demo-workspace.js';
import { runInitialRestore } from './lib/initial-restore.js';
import { runAccountProvisioning } from './lib/account-provisioning.js';
import { createNotificationCenter, notificationScope, updateNotificationCenter, notificationSnapshot } from './lib/notification-center.js';
import { currentNotificationContext, currentNotificationEvents, notificationDestination } from './lib/notification-events.js';
import { notificationNow, readNotificationCategories, notificationCategoryAllowed, readNotificationPreferences, writeNotificationPreferences, NOTIFICATION_CATEGORY_PREFIX, NOTIFICATION_STORAGE_PREFIX } from './lib/notification-state.js';
import { renderNotificationCenter, renderNotificationBell } from './views/notifications.js';
import { completeProfile, getAccountPresentation, normalizeSaudiMobile } from './lib/account-profile.js';
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
await ensureThmanyahFont();
installVisibleViewport();
const notificationStyles = document.createElement('link');
notificationStyles.rel = 'stylesheet';
notificationStyles.href = new URL('./styles/notifications.css', import.meta.url).href;
document.head.append(notificationStyles);

let notificationContext = null;
let notificationState = createNotificationCenter(null);
let notificationSheet = null;
let notificationSheetDone = null;
let notificationTimer = null;
function clearNotificationUI() {
  notificationContext = null;
  notificationState = createNotificationCenter(null);
  if (notificationTimer !== null) clearTimeout(notificationTimer);
  notificationTimer = null;
  // Remove private rendered content synchronously, before reload/restore/network work.
  notificationSheet?.querySelector('.sheet__body')?.replaceChildren();
  notificationSheetDone?.();
  notificationSheet = null;
  notificationSheetDone = null;
  document.querySelectorAll('.n44-bell').forEach(el => el.remove());
}
function observeNotifications() {
  const context = currentNotificationContext(store, cloud);
  const now = notificationNow(context);
  if (notificationScope(context) !== notificationState.scope) {
    clearNotificationUI();
    notificationState = createNotificationCenter(context);
    notificationState.preferences = readNotificationPreferences(context, now);
  }
  notificationContext = context;
  notificationState = updateNotificationCenter(notificationState, context,
    { type: 'receive', events: currentNotificationEvents(store, context, now).filter(event => notificationCategoryAllowed(event, readNotificationCategories(context))) }, now);
  if (notificationSheet?.isConnected) {
    const active = notificationSheet.contains(document.activeElement) ? document.activeElement : null;
    const action = active?.dataset.act, id = active?.dataset.id;
    render(notificationSheet.querySelector('.sheet__body'), renderNotificationCenter(notificationState, context, now));
    if (action && id) notificationSheet.querySelector(`[data-act="${CSS.escape(action)}"][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }
  if (notificationTimer !== null) clearTimeout(notificationTimer);
  notificationTimer = null;
  if (context) {
    const nextExpiry = Math.min(...notificationState.items.map(item => item.expiresAt), now + 60000);
    notificationTimer = setTimeout(scheduleRender, Math.max(1, nextExpiry - now));
  }
  return notificationSnapshot(notificationState, context, now);
}
function openNotifications() {
  observeNotifications();
  if (!notificationContext || notificationSheet?.isConnected) return;
  const promise = openSheet({ title: html`<span>الإشعارات</span><button type="button" class="iconbtn n44-sheet-settings" data-act="n44-settings" aria-label="إعدادات الإشعارات" title="إعدادات الإشعارات">${icon('settings')}</button>`, body: renderNotificationCenter(notificationState, notificationContext, notificationNow(notificationContext)),
    onMount: (root, done) => { notificationSheet = root; notificationSheetDone = done; } });
  const mounted = notificationSheet;
  promise.finally(() => { if (notificationSheet === mounted) { notificationSheet = null; notificationSheetDone = null; } });
}
function actOnNotification(el, type) {
  observeNotifications();
  const context = notificationContext, now = notificationNow(context);
  if (!context) return;
  const destination = type === 'open' ? notificationDestination(store, context, el.dataset.id, now) : null;
  notificationState = updateNotificationCenter(notificationState, context,
    { type: type === 'dismiss' ? 'dismiss' : 'read', id: el.dataset.id }, now);
  writeNotificationPreferences(notificationState, context, now);
  if (type === 'open' && destination && match(destination)) {
    notificationSheetDone?.();
    go(destination);
  }
  scheduleRender();
}
store.onWorkspaceDeactivation(clearNotificationUI);
cloud.subscribe(() => { if (!currentNotificationContext(store, cloud)) clearNotificationUI(); });
window.addEventListener('storage', event => {
  // Clock-only writes must not cause tabs to repaint/write clocks back at each
  // other. Ordinary preference changes still recompute the actual settings/UI.
  if (event.key?.startsWith(NOTIFICATION_CATEGORY_PREFIX)) {
    try {
      const before = JSON.parse(event.oldValue), after = JSON.parse(event.newValue);
      if (before && after && ['lesson', 'due', 'lessonMinutes', 'dueDays'].every(key =>
        JSON.stringify(before[key]) === JSON.stringify(after[key]))) return;
    } catch { /* Corruption/removal must still refresh safe defaults. */ }
  }
  if (event.key === cloud.AUTH_STORAGE_KEY || event.key === null) {
    if (!currentNotificationContext(store, cloud)) clearNotificationUI();
  }
  if (event.key === null || event.key?.startsWith(NOTIFICATION_STORAGE_PREFIX)) {
    notificationState.preferences = readNotificationPreferences(currentNotificationContext(store, cloud), notificationNow(currentNotificationContext(store, cloud)));
  }
  scheduleRender();
});
window.addEventListener('pageshow', () => scheduleRender());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleRender();
});

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
let teacherMiniHubDone = null;
let teacherMiniHubAuthPending = null;
let workspaceRouting = null;
let marketingAuthSettled = false;
const marketing = createMarketingAnalytics({ eligible: () =>
  marketingAuthSettled && cloud.authStatus().state === 'signed_out' && !cloud.session && !cloud.user &&
  localStorage.getItem(cloud.AUTH_STORAGE_KEY) === null &&
  (!store.getActiveWorkspace() || isDemoWorkspace())
});
cloud.subscribe(() => {
  if (cloud.session || cloud.user || cloud.authStatus().state !== 'signed_out') marketing.stop();
});
window.addEventListener('storage', event => {
  if (event.key === cloud.AUTH_STORAGE_KEY || event.key === null) marketing.stop();
});
window.addEventListener('pagehide', () => marketing.stop({ preserveCampaign: true }));
window.addEventListener('offline', () => marketing.stop());
let initialRestoreAbortController = null;
let recoveryCycle = startRecoveryCycle(Date.now());
let warningTimer = null;
let stopSessionAutoTriggers = null;
function cleanupSessionAutoTriggers() {
  stopSessionAutoTriggers?.();
  stopSessionAutoTriggers = null;
}
store.onWorkspaceDeactivation(cleanupSessionAutoTriggers);
const scrollMemory = new Map();
// Keep the destination icon current when AUTO follows a system palette change.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => scheduleRender());

const isDemoWorkspace = () => store.getActiveWorkspace()?.type === 'demo';
const canMaterializeTodaySessions = () => store.getOfflineLeaseStatus().editable && (isDemoWorkspace() || Boolean(cloud.session && cloud.user));
const supportAccountKey = () => `${cloud.user?.id ?? 'signed-out'}|${store.getActiveWorkspace()?.databaseName ?? 'unresolved'}`;
let lastSupportAccountKey = supportAccountKey();

// Capture before the hash changes; the Support view itself never sees the prior route.
document.addEventListener('click', (event) => {
  const link = event.target.closest?.('a[href="#/support"]');
  if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey
      && !event.shiftKey && !event.altKey && (!link.target || link.target === '_self') && !link.hasAttribute('download')) {
    captureSupportOriginBeforeNavigation(currentPath(), supportAccountKey());
  }
}, true);

/* ---------- حالة وتسميات المزامنة والتثبيت ---------- */

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return !!(window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    document.referrer?.includes('android-app://'));
}

function getSyncState() {
  return syncOperationalPresentation(syncModule?.getSyncOperationalSummarySnapshot());
}

function getSyncWarning(summary) {
  const result = presentSyncWarning(summary, recoveryCycle, Date.now());
  recoveryCycle = result.cycle;
  if (warningTimer) clearTimeout(warningTimer);
  warningTimer = result.nextCheckAt === null ? null : setTimeout(() => {
    warningTimer = null;
    paintSyncStatus();
  }, Math.max(0, result.nextCheckAt - Date.now()));
  return result;
}

function onPresentationWake() {
  recoveryCycle = wakeRecoveryCycle(recoveryCycle, Date.now(), { online: navigator.onLine !== false });
  paintSyncStatus();
}

function renderSidebarMiniHubTrigger() {
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const identity = displayIdentity(profile.teacherName, presentation.teacherLabel);
  const teacherName = identity.display;
  const syncInfo = getSyncState();

  if (isDemoWorkspace()) return html`
    <button class="teacher-mini-hub-trigger" data-act="demo-login" aria-label="الخروج من التجربة">
      <div class="teacher-mini-hub-trigger__avatar" aria-hidden="true">${icon('login')}</div>
      <div class="teacher-mini-hub-trigger__info">
        <div class="teacher-mini-hub-trigger__name">الخروج من التجربة</div>
        <div class="teacher-mini-hub-trigger__sub">بيانات تجريبية</div>
      </div>
      <div class="teacher-mini-hub-trigger__chev" aria-hidden="true">${icon('chev')}</div>
    </button>
  `;

  return html`
    <button class="teacher-mini-hub-trigger" data-act="open-teacher-mini-hub" data-sync-account-label="مركز ${presentation.teacherLabel}: ${teacherName}" aria-label="مركز ${presentation.teacherLabel}: ${teacherName}، ${syncInfo.text}">
      <div class="teacher-mini-hub-trigger__avatar" aria-hidden="true">
        ${identity.initials}
      </div>
      <div class="teacher-mini-hub-trigger__info">
        <div class="teacher-mini-hub-trigger__name">${teacherName}</div>
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
  const identity = displayIdentity(profile.teacherName, presentation.teacherLabel);
  const teacherName = identity.display;
  const syncInfo = getSyncState();
  const isInstalled = isStandaloneMode();
  const hasInstallPrompt = typeof window !== 'undefined' && !!window.deferredInstallPrompt;
  const isLoggedIn = !!(cloud.session && cloud.user);
  const demo = isDemoWorkspace();
  const authPending = teacherMiniHubAuthPending;

  return html`
      <div class="mini-hub-sheet">
        <section class="mini-hub-surface" aria-label="مركز ${presentation.teacherLabel}">
          <header class="center-identity">
            <div class="mini-hub-identity">
              <div class="mini-hub-avatar" aria-hidden="true">${demo ? icon('login') : identity.initials}</div>
              <div class="flex-1 min-w-0">
                <div class="mini-hub-name">${demo ? 'بيانات تجريبية' : teacherName}</div>
                ${!demo && isLoggedIn ? html`<div class="mini-hub-account__status center-email" dir="ltr">${cloud.user.email}</div>` : ''}
                ${!demo && (authPending || !isLoggedIn) ? html`<div class="mini-hub-account__status center-account-attention">${authPending === 'logout' ? 'جارٍ تسجيل الخروج...' : authPending === 'login' ? 'جارٍ تسجيل الدخول...' : 'غير مسجل الدخول'}</div>` : ''}
              </div>
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
          </header>

          ${demo ? html`<div class="mini-hub-sync mini-hub-section"><div class="t-3 fs-xs">بيانات تجريبية محلية فقط — لا مزامنة سحابية</div></div>` : html`
            <div class="mini-hub-sync mini-hub-section" aria-live="polite">${renderRepairableSyncSection(syncInfo.summary)}</div>
          `}

          <div class="mini-hub-pwa mini-hub-section">
            <div class="mini-hub-pwa__copy"><h3>تطبيق ركيز على هذا الجهاز</h3></div>
            ${isInstalled ? html`<div class="mini-hub-installed"><span class="mini-hub-installed__icon" aria-hidden="true">${icon('check')}</span><span class="mini-hub-installed__text">مثبّت</span></div>` : html`
              <button class="btn btn--xs btn--ghost" data-act="${hasInstallPrompt ? 'mini-hub-pwa-install' : 'mini-hub-pwa-guide'}">
                ${icon('download')} ${hasInstallPrompt ? 'تثبيت ركيز' : 'إرشادات التثبيت'}
              </button>`}
          </div>

          <div class="hub-destinations">
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
          </div>
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
    onMount: (root, done) => {
      teacherMiniHubSheet = root;
      teacherMiniHubDone = done;
      root.classList.add('mini-hub-backdrop');
      const position = () => {
        const main = document.querySelector('.main')?.getBoundingClientRect();
        root.style.setProperty('--mini-hub-main-left', `${main?.left ?? 0}px`);
        root.style.setProperty('--mini-hub-main-width', `${main?.width ?? innerWidth}px`);
      };
      position();
      window.addEventListener('resize', position);
      root._removeHubPositionListener = () => window.removeEventListener('resize', position);
    },
  });
  const mounted = teacherMiniHubSheet;
  sheet.finally(() => {
    mounted?._removeHubPositionListener?.();
    if (teacherMiniHubSheet === mounted) { teacherMiniHubSheet = null; teacherMiniHubDone = null; }
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
  { href: '#/settings',  icon: 'settings',  label: 'الإعدادات' },
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
  const warning = getSyncWarning(syncInfo.summary);
  const stripInfo = warning.status
    ? syncOperationalPresentation({ ...syncInfo.summary, state: warning.status }) : syncInfo;
  const showConnectionState = warning.strip;

  return html`
    <a class="skip-link" href="#main" data-act="skip-to-content">انتقل إلى المحتوى</a>
    <div class="layout">
      <nav class="sidebar" aria-label="التنقل الرئيسي">
        <div class="sidebar__brand">${brandLockup()}</div>
        ${NAV.map((it) => html`${it.group ? html`<div class="sidebar__section-label">${it.group}</div>` : ''}${navLink(it, path, 'sidebar')}`)}
        <div class="sidebar__spacer"></div>
        <div id="sidebar-mini-hub">${renderSidebarMiniHubTrigger()}</div>
      </nav>
      <main class="main">
        ${inTeaching ? html`<div class="class-context-nav-bar"><nav class="class-context-nav" data-nav-scope="context" aria-label="تنقل الفصل">${teachingNav(params.id).map((it) => navLink(it, path, 'class-context-nav'))}</nav></div>` : ''}
        <div class="app-status-strip ${showConnectionState ? `is-visible is-${stripInfo.status}` : ''}"
             data-app-status role="status" aria-live="polite" aria-atomic="true">
          ${icon('cloud')} <span data-app-status-text>${syncInfo.summary.reasonCategory === 'workspace_ownership_blocked' ? syncInfo.summary.reasonLabel : stripInfo.label}</span>
          <a class="app-status-strip__support" href="#/support">تحتاج مساعدة؟</a>
        </div>
        <div id="main" tabindex="-1"></div>
      </main>
      <nav class="tabbar" data-nav-scope="primary" aria-label="التنقل الرئيسي">
        ${bottom.map((it) => navLink(it, path, 'tabbar'))}
      </nav>
      ${path === '/support' ? '' : html`<a class="n34-help-launcher" href="#/support" aria-label="المساعدة والتواصل" title="المساعدة والتواصل">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.7-.8L3.5 20l1-4.3a8.5 8.5 0 1 1 16-4.2Z"/>
          <path d="M9.3 9.3a2.7 2.7 0 0 1 5.1 1.1c0 1.5-2.4 1.8-2.4 3.1M12 16.3h.01"/>
        </svg>
      </a>`}
    </div>
  `;
}

/** بقية عناصر التنقل على الجوال — حتى لا يزدحم الشريط السفلي. */
/* ---------- الشريط العلوي ---------- */

function topbar(v, params) {
  const backHref = v.back?.(params);
  const title = visibleLatinDigits(typeof v.title === 'function' ? v.title(params) : v.title ?? 'رَكيز المعلم');
  const sub = visibleLatinDigits(v.subtitle?.(params));
  const actions = v.topActions?.(params);
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const identity = displayIdentity(profile.teacherName, presentation.teacherLabel);
  const teacherName = identity.display;
  const syncInfo = getSyncState();
  const isHome = currentPath() === '/';
  const isClassHub = /^\/teaching\/[^/]+$/.test(currentPath());
  const demo = isDemoWorkspace();
  const inTeaching = currentPath().startsWith('/teaching/');
  const dark = effectiveTheme(store.state.device?.theme, matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';
  const themeAction = dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن';
  const accountLabel = `مركز ${presentation.teacherLabel}: ${teacherName}`;
  return html`
    <header class="topbar ${isHome ? 'topbar--home' : ''} ${isClassHub ? 'topbar--class-hub' : ''}">
      ${backHref ? html`<a class="iconbtn" href="${backHref}" data-act="app-back" data-back-fallback="${backHref}" aria-label="رجوع">${icon('back')}</a>` : ''}
      <h1 class="topbar__title">
        ${isHome ? html`
          <span class="mobile-brand">${brandLockup({ compact: true })}</span>
          <span class="topbar__page desktop-home-title">
            <span class="topbar__title-row"><strong>${title}</strong></span>
          </span>
        ` : title}${sub ? html`<span class="topbar__sub">${sub}</span>` : ''}
      </h1>
      <div class="topbar__actions">
        ${isHome && notificationContext ? renderNotificationBell(notificationSnapshot(notificationState, notificationContext, Date.now()).unread) : ''}
        ${actions ?? ''}
        ${!inTeaching ? html`
          <button class="quick-theme" data-act="quick-theme" aria-label="${themeAction}" title="${themeAction}">${icon(dark ? 'sun' : 'moon')}</button>
          ${demo ? html`<button class="topbar__teacher-btn explicit-demo-exit" data-act="demo-login" aria-label="الخروج من التجربة"><span class="demo-exit-copy"><strong>الخروج من التجربة</strong><small>بيانات تجريبية</small></span></button>` : html`
          <button class="topbar__teacher-btn compact-identity" data-act="open-teacher-mini-hub" data-sync-account-label="${accountLabel}" aria-label="${accountLabel}، ${syncInfo.text}">
            <span class="topbar__teacher-avatar" aria-hidden="true">${identity.initials}</span>
            <span class="sync-dot sync-dot--${syncInfo.status} topbar__teacher-sync" data-sync-status aria-hidden="true"></span>
          </button>`}
        ` : ''}
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
// Only the current account's read-only repair plan can expose this entry.
let sessionRepairEligibility = null;
let calendarRepairEligibility = null;
let calendarRepairDone = null;
let sessionRepairReviewDone = null;
let sessionRepairOpening = false;
let repairSupportFocus = false;
function sessionRepairWorkspace() {
  const workspace = store.getActiveWorkspace();
  return workspace?.type === 'account' && workspace.authUserId === cloud.user?.id ? workspace : null;
}
const retryableSessionRepair = entry => !!entry.replacementMutationId && ['pending', 'failed'].includes(entry.status);
function currentSessionRepairPlan(plan, workspace) {
  return !!workspace && sessionRepairWorkspace() === workspace && plan?.ownerId === workspace.authUserId;
}
store.onWorkspaceDeactivation(() => {
  sessionRepairEligibility = null;
  calendarRepairEligibility = null;
  calendarRepairDone?.();
  sessionRepairReviewDone?.();
});
async function refreshSessionRepairEligibility() {
  const workspace = sessionRepairWorkspace();
  sessionRepairEligibility = null;
  if (!workspace) return;
  try {
    const plan = await store.reviewRejectedSessionRepairs();
    if (currentSessionRepairPlan(plan, workspace)) {
      sessionRepairEligibility = { workspace, available: plan.entries.some(entry => entry.status === 'review' || retryableSessionRepair(entry)) };
    }
  } catch { /* Fail closed for this repair entry; preserve generic Sync diagnostics. */ }
}
function renderRepairableSyncSection(summary) {
  const available = sessionRepairEligibility?.workspace === sessionRepairWorkspace() && sessionRepairEligibility?.available;
  return html`${renderSyncOperationalSection(summary, { compact: true })}
    ${calendarRepairEligibility?.workspace === sessionRepairWorkspace() && calendarRepairEligibility.plan?.status === 'blocked' && calendarRepairEligibility.plan?.hasGroup ? html`<p class="fs-xs">إصلاح التقويم متوقف: ${calendarRepairEligibility.plan.reason}</p>` : ''}
    ${calendarRepairEligibility?.workspace === sessionRepairWorkspace() && ['review','pending'].includes(calendarRepairEligibility.plan?.status) ? html`<button class="btn btn--sm btn--quiet" data-act="review-calendar-repair">مراجعة إصلاح تهيئة التقويم</button>` : ''}
    ${available ? html`<button class="btn btn--sm btn--quiet" data-act="review-session-repair">مراجعة وإصلاح الحصص المرفوضة</button>` : ''}`;
}

async function refreshCalendarRepairEligibility() {
  const workspace = sessionRepairWorkspace();calendarRepairEligibility = null;if (!workspace) return;
  try { const plan = await store.reviewCalendarFoundationRepair();
    if (currentSessionRepairPlan(plan, workspace)) calendarRepairEligibility = {workspace,plan};
  } catch { /* Preserve the ordinary Sync warning; no empty confirmation control. */ }
}
async function openCalendarRepairReview() {
  if (calendarRepairDone) return;
  const workspace = sessionRepairWorkspace();
  let plan = await store.reviewCalendarFoundationRepair();
  if (!currentSessionRepairPlan(plan, workspace)) return;
  return openSheet({title:'مراجعة إصلاح تهيئة التقويم',
    body:html`<div data-calendar-repair-review>
      ${plan.status === 'review' ? html`<p>${plan.yearLabel} — ${plan.regionLabel}</p><p>سيُصلح إعداد السنة والفصلين ويُثبت هذا التقويم للحساب الفارغ. ستبقى الطلبات والأخطاء الأصلية محفوظة، وسيظل تبديل المنطقة معلقًا.</p><label><input type="checkbox" data-calendar-repair-ack> أؤكد السنة والمنطقة وأوافق على إصلاح التهيئة أعلاه.</label>` : html`<p>${plan.reason}</p>`}
      <p role="status" data-calendar-repair-message></p>
      <button class="btn btn--quiet" data-calendar-repair-retry ${plan.status === 'pending' ? '' : 'hidden'} style="${plan.status === 'pending' ? '' : 'display:none'}">استعادة إيصال إصلاح التقويم</button>
      <a href="#/support" data-calendar-repair-support>تحتاج مساعدة؟</a></div>`,
    foot:html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button>${plan.status === 'review' ? html`<button class="btn btn--primary" data-calendar-repair-confirm disabled>تأكيد إصلاح التقويم</button>` : ''}`,
    onMount(root,done) {
      calendarRepairDone = done;let busy = false,submitted = false;
      const button=root.querySelector('[data-calendar-repair-confirm]'),retry=root.querySelector('[data-calendar-repair-retry]'),message=root.querySelector('[data-calendar-repair-message]');
      const update=()=>{if(button)button.disabled=busy||submitted||!root.querySelector('[data-calendar-repair-ack]')?.checked||!currentSessionRepairPlan(plan,workspace);retry.disabled=busy;};
      root.addEventListener('change',update);
      root.querySelector('[data-calendar-repair-support]').addEventListener('click',e=>{e.preventDefault();done();teacherMiniHubDone?.();repairSupportFocus=true;go('/support');});
      const send=async resume=>{
        if(busy||!currentSessionRepairPlan(plan,workspace)||!resume&&!root.querySelector('[data-calendar-repair-ack]')?.checked)return;
        busy=true;update();message.textContent='جارٍ التحقق من الحساب وإصلاح التهيئة…';
        try {
          if(resume)await store.resumeCalendarFoundationRepair();else await store.confirmCalendarFoundationRepair(plan,true);
          submitted=true;if(root.isConnected&&currentSessionRepairPlan(plan,workspace)){message.textContent='تأكد إصلاح تهيئة التقويم بإيصال الخادم. تبديل المنطقة ما زال معلقًا.';retry.hidden=true;retry.style.display='none';}
        }catch(error){
          if(root.isConnected&&currentSessionRepairPlan(plan,workspace)){
            message.textContent=error.message;
            const next=await store.reviewCalendarFoundationRepair().catch(()=>null);
            if(next?.status==='pending'){submitted=true;plan=next;retry.hidden=false;retry.style.display='';message.textContent+=' الطلب محفوظ؛ استعد الإيصال نفسه دون تكرار الإصلاح.';}
          }
        }finally{busy=false;update();await refreshSyncOperationalUI();}
      };
      button?.addEventListener('click',()=>send(false));retry.addEventListener('click',()=>send(true));
    },
  }).finally(()=>{calendarRepairDone=null;});
}

async function openSessionRepairReview() {
  if (sessionRepairOpening || sessionRepairReviewDone) return;
  sessionRepairOpening = true;
  const workspace = sessionRepairWorkspace();
  let plan;
  try {
    plan = await store.reviewRejectedSessionRepairs();
    if (!currentSessionRepairPlan(plan, workspace)) return;
  } finally { sessionRepairOpening = false; }
  const reviewable = plan.entries.some(entry => entry.status === 'review');
  const reviewedPlan = plan;
  return openSheet({ title: 'مراجعة وإصلاح الحصص المرفوضة',
    desc: reviewable ? 'راجع سياق كل حصة قبل تأكيد التصحيح. السياق الأصلي غير محفوظ؛ التصحيح يعتمد على التقويم الحالي.' : undefined,
    body: html`<div data-session-repair-review>
      ${reviewable ? html`<p>حدّد الحصص التي تريد تصحيحها بعد مراجعة السنة والفصل واليوم. لن نختار أي حصة تلقائيًا.</p>` : ''}
      ${!plan.entries.length ? html`<p>لا توجد حصص مؤهلة لهذا الإصلاح في الحساب الحالي.</p>` : ''}
      ${plan.entries.map((entry, index) => html`<section class="card p-3">
        <p><bdi>${entry.date}</bdi> — الحصة <bdi>${entry.period}</bdi> — ${entry.classLabel || 'تعذّر توثيق الفصل'}</p>
        <p>وقت الطلب: <bdi>${Number.isFinite(new Date(entry.queuedAt).getTime()) ? new Date(entry.queuedAt).toISOString() : 'غير موثّق'}</bdi></p>
        ${entry.status === 'review' ? html`
          <p>${entry.yearLabel} — ${entry.termLabel} — ${entry.presetLabel}</p>
          <p>اليوم: ${entry.context.kind === 'study' ? 'دراسي' : entry.context.kind === 'remote' ? 'عن بُعد' : 'إجازة'} — ${entry.context.label}</p>
          <label><input type="checkbox" data-repair-entry="${index}"> أؤكد السنة والفصل وتقويم اليوم أعلاه كتَصحيح لهذه الحصة.</label>`
          : html`<p>${entry.reason}</p>`}
      </section>`)}
      <p data-repair-message role="status"></p>
      <button class="btn btn--sm btn--quiet" data-retry-session-repairs ${plan.entries.some(retryableSessionRepair) ? '' : 'hidden'} style="${plan.entries.some(retryableSessionRepair) ? '' : 'display:none'}">استعادة إيصال التصحيح</button>
      <a href="#/support" data-repair-support>المساعدة في طلب متوقف</a>
    </div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>${reviewable ? html`<button class="btn btn--primary" data-confirm-session-repair disabled>تأكيد تصحيح المحدد</button>` : ''}`,
    onMount(root, done) {
      sessionRepairReviewDone = done;
      let confirming = false, confirmed = false, retrying = false;
      const button = root.querySelector('[data-confirm-session-repair]');
      const retry = root.querySelector('[data-retry-session-repairs]');
      const message = root.querySelector('[data-repair-message]');
      const updateRetryVisibility = () => {
        retry.hidden = !plan.entries.some(retryableSessionRepair);
        retry.style.display = retry.hidden ? 'none' : '';
      };
      const selectedIds = () => [...root.querySelectorAll('[data-repair-entry]:checked')].map(el => reviewedPlan.entries[Number(el.dataset.repairEntry)].originalId);
      const updateConfirm = () => { if (button) button.disabled = confirming || confirmed || retrying || !currentSessionRepairPlan(plan, workspace) || !selectedIds().length; };
      root.addEventListener('change', updateConfirm);
      root.querySelector('[data-repair-support]').addEventListener('click', event => {
        event.preventDefault();
        done();
        teacherMiniHubDone?.();
        repairSupportFocus = true;
        const alreadySupport = currentPath() === '/support';
        go('/support');
        if (alreadySupport) void resolve();
      });
      retry.addEventListener('click', async () => {
        if (retrying || confirming || !currentSessionRepairPlan(plan, workspace) || !plan.entries.some(retryableSessionRepair)) return;
        retrying = true; retry.disabled = true; retry.textContent = 'جارٍ استعادة الإيصال...'; updateConfirm();
        const pendingIds = plan.entries.filter(retryableSessionRepair).map(entry => entry.originalId);
        try {
          if (!syncModule) throw Error('المزامنة غير متوفرة حاليًا.');
          const ok = await syncModule.syncAll({ full: true });
          if (!currentSessionRepairPlan(plan, workspace) || !root.isConnected) return;
          const nextPlan = await store.reviewRejectedSessionRepairs();
          if (!currentSessionRepairPlan(nextPlan, workspace) || !root.isConnected) return;
          plan = nextPlan;
          message.textContent = !ok ? 'تعذرت المزامنة. لم يتأكد اكتمال التصحيح؛ الطلب نفسه محفوظ.'
            : pendingIds.every(id => plan.entries.some(entry => entry.originalId === id && entry.status === 'verified'))
              ? 'تأكد اكتمال التصحيح بإيصال الخادم والمصالحة المحلية.'
              : 'حُدّثت حالة المزامنة؛ لم يتأكد اكتمال التصحيح بعد. أغلق المراجعة وافتحها لعرض الحالة الحالية.';
          updateRetryVisibility();
          await refreshSyncOperationalUI();
        } catch (error) { if (root.isConnected && currentSessionRepairPlan(plan, workspace)) message.textContent = error.message; }
        finally { retrying = false; retry.disabled = false; retry.textContent = 'استعادة إيصال التصحيح'; updateConfirm(); }
      });
      button?.addEventListener('click', async () => {
        const ids = selectedIds();
        if (confirming || confirmed || retrying || !ids.length || !currentSessionRepairPlan(plan, workspace)) return;
        confirming = true; updateConfirm();
        try {
          await store.confirmRejectedSessionRepairs(reviewedPlan, ids, true);
          confirmed = true;
          if (!root.isConnected || !currentSessionRepairPlan(plan, workspace)) return;
          message.textContent = 'حُفظ طلب التصحيح. لم يتأكد الإصلاح بعد؛ ينتظر إيصال الخادم والمصالحة المحلية.';
          root.querySelectorAll('[data-repair-entry]').forEach(el => { el.disabled = true; });
          const nextPlan = await store.reviewRejectedSessionRepairs();
          if (currentSessionRepairPlan(nextPlan, workspace) && root.isConnected) {
            plan = nextPlan;
            updateRetryVisibility();
          }
          await refreshSyncOperationalUI();
        } catch (error) { if (root.isConnected && currentSessionRepairPlan(plan, workspace)) message.textContent = error.message; }
        finally { confirming = false; updateConfirm(); }
      });
    },
  }).finally(() => { sessionRepairReviewDone = null; });
}

function paintSyncStatus() {
  const syncInfo = getSyncState();
  const statusStrip = document.querySelector('[data-app-status]');
  if (statusStrip) {
    const warning = getSyncWarning(syncInfo.summary);
    const stripInfo = warning.status
      ? syncOperationalPresentation({ ...syncInfo.summary, state: warning.status }) : syncInfo;
    statusStrip.className = `app-status-strip${warning.strip ? ` is-visible is-${stripInfo.status}` : ''}`;
    statusStrip.querySelector('[data-app-status-text]')?.replaceChildren(
      syncInfo.summary.reasonCategory === 'workspace_ownership_blocked' ? syncInfo.summary.reasonLabel : stripInfo.label
    );
  }
  const section = teacherMiniHubSheet?.querySelector('.mini-hub-sync');
  if (section) {
    const expanded = section.querySelector('details')?.open;
    const focused = section.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.dataset.act;
    const focusHref = focused?.getAttribute('href');
    const focusSummary = focused?.tagName === 'SUMMARY';
    render(section, renderRepairableSyncSection(syncInfo.summary));
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
      ? new Date(syncInfo.summary.lastSuccessfulSyncAt).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }) : '—';
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
      await refreshSessionRepairEligibility();
      await refreshCalendarRepairEligibility();
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
  observeNotifications();
  const snap = captureFocus();
  view.beforePaint?.(mainEl, ctx.params);
  try {
    const hubEl = document.getElementById('sidebar-mini-hub');
    if (hubEl) {
      render(hubEl, renderSidebarMiniHubTrigger());
    }
    render(
      mainEl,
      html`${topbar(view, ctx.params)}${renderOfflineLease()}
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

function renderOfflineLease() {
  const lease = store.getOfflineLeaseStatus();
  if (!['REMINDER', 'LIMITED'].includes(lease.state)) return '';
  return html`<aside class="offline-lease-notice noprint" dir="rtl" role="status" data-offline-lease="${lease.state}">
    <div><strong>${lease.state === 'LIMITED' ? 'وضع القراءة فقط' : 'تذكير بالاتصال'}</strong>
      <p>${lease.state === 'LIMITED' ? 'يمكنك العرض والتصدير وتنزيل نسخة احتياطية. لاستئناف التعديل، اتصل بالإنترنت واضغط «التحقق من الحساب».' : 'يمكنك متابعة العمل. اتصل بالإنترنت قريبًا واضغط «التحقق من الحساب» لتستمر في التعديل.'}</p></div>
    <button class="btn btn--ghost" data-act="renew-offline-lease">التحقق من الحساب</button>
  </aside>`;
}

async function renewLeaseInBackground() {
  if (store.getActiveWorkspace()?.type !== 'account') return;
  try { await store.renewOfflineLease(); scheduleRender(); }
  catch { /* Network failures leave the durable receipt and Product rows intact. */ }
}

/* ---------- تبديل الشاشة ---------- */

let resolveGeneration = 0;
async function resolve() {
  const generation = ++resolveGeneration;
  const path = currentPath();
  const isCurrent = () => generation === resolveGeneration && path === currentPath();
  const found = match(path);

  if (!found) {
    go('/', { replace: true });
    return;
  }

  if (canMaterializeTodaySessions()) await store.ensureSessionsForDate();
  if (!isCurrent()) return;

  let mod;
  try {
    mod = await found.route.load();
  } catch (err) {
    if (!isCurrent()) return;
    console.error('[rakeezx] تعذّر تحميل الشاشة', err);
    toast('تعذّر فتح هذه الشاشة', 'danger');
    return;
  }

  // A slower boot/previous route must not overwrite newer navigation.
  if (!isCurrent()) return;
  if (ctx) scrollMemory.set(ctx.path, window.scrollY);
  view?.onUnmount?.();
  view = mod.default;
  ctx = found;
  view.beforeRender?.(found.params);

  if (found.route.path === '/support') enterSupportVisit(supportAccountKey());

  render(app, shell(found.path, found.params));
  mainEl = document.getElementById('main');

  paint();
  view.onMount?.(mainEl, found.params);
  if (repairSupportFocus && found.path === '/support') {
    repairSupportFocus = false;
    mainEl.focus({ preventScroll: true });
  }

  const y = scrollMemory.get(found.path);
  window.scrollTo({ top: y ?? 0, behavior: 'instant' });
}

/* ---------- الإقلاع ---------- */

async function boot() {
  cleanupSessionAutoTriggers();
  // تبويب آخر يرقّي القاعدة: أعد التحميل بدل العمل على مخطط قديم
  db.setVersionChangeHandler(() => {
    toast('حُدِّث التطبيق في نافذة أخرى — يُعاد التحميل');
    setTimeout(() => location.reload(), 800);
  });

  try {
    // Restore the cached identity immediately, but never make the local shell
    // depend on a refresh request that Android may suspend while backgrounded.
    // Any pre-existing identity, including malformed/expired credentials, is excluded.
    if (localStorage.getItem(cloud.AUTH_STORAGE_KEY) !== null) marketing.stop();
    await cloud.init({ waitForRefresh: false });
    marketingAuthSettled = true;
    if (cloud.session || cloud.user || cloud.authStatus().state !== 'signed_out') marketing.stop();
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
        ['initial-restore-required', 'initial-restore-pending', 'account-provisioning-pending', 'initial-restore-recovery-required'].includes(workspaceRouting.reason)) {
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
    void renewLeaseInBackground();
    // Dynamic import to prevent sync syntax errors from permanently blocking the app shell
    try {
      if (isDemoWorkspace()) throw Object.assign(new Error('Demo workspace has no cloud sync'), { code: 'DEMO_SYNC_DISABLED' });
      syncModule = await import('./lib/sync.js');
      syncModule.init();
      // init() already starts the read-only status scan. Do not wait for its
      // outbox/record reads before painting this verified local workspace.
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
          return typeof fn === 'function' ? async (el, ev) => {
            try { return await fn(el, ev, ctx?.params ?? {}); }
            catch (error) {
              if (error?.code === 'OFFLINE_LEASE_LIMITED') { toast(error.message, 'warn'); scheduleRender(); return; }
              console.error('[rakeezx] Action failed', error);
              toast(error?.message || 'تعذّر تنفيذ الإجراء', 'danger');
            }
          } : undefined;
        },
      }
    );
  };

  delegate(app, handlers);
  delegate(document.getElementById('modal-root'), handlers);

  setRepaint(scheduleRender);
  store.onWriteError((error) => toast(error?.code === 'OFFLINE_LEASE_LIMITED' ? error.message : 'تعذّر الحفظ — لم يُسجَّل التعديل', 'danger'));
  store.subscribe((_state, update) => {
    if (update?.render !== false) scheduleRender();
  });
  cloud.subscribe(() => {
    const workspace = store.getActiveWorkspace();
    if (workspace?.type === 'account' && workspace.authUserId !== cloud.user?.id) cleanupSessionAutoTriggers();
    if (workspace?.type === 'account' && cloud.user?.id && workspace.authUserId !== cloud.user.id) {
      store.deactivateWorkspace('authenticated-account-workspace-mismatch');
      location.reload();
      return;
    }
    const nextSupportAccountKey = supportAccountKey();
    if (nextSupportAccountKey !== lastSupportAccountKey) clearSupportOrigin();
    lastSupportAccountKey = nextSupportAccountKey;
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
  window.addEventListener('pageshow', onPresentationWake);
  window.addEventListener('online', onPresentationWake);
  window.addEventListener('online', renewLeaseInBackground);
  window.addEventListener('storage', (event) => {
    if (event.key === cloud.AUTH_STORAGE_KEY && store.getActiveWorkspace()?.type === 'account') {
      let nextOwner = null;
      try { nextOwner = JSON.parse(event.newValue || 'null')?.user?.id; } catch {}
      if (nextOwner !== store.getActiveWorkspace().authUserId) {
        store.deactivateWorkspace('peer-account-context-changed');
        location.reload();
        return;
      }
    }
    if (event.key === cloud.AUTH_STORAGE_KEY || event.key?.startsWith(LEASE_STORAGE_PREFIX) && !event.key.includes(':clock:')) {
      store.getOfflineLeaseStatus(); scheduleRender();
    }
  });
  window.addEventListener('pagehide', () => { store.getOfflineLeaseStatus(); });
  let leasePresentation = store.getOfflineLeaseStatus().state;
  const leaseTimer = setInterval(() => {
    const next = store.getOfflineLeaseStatus().state;
    if (next !== leasePresentation) { leasePresentation = next; scheduleRender(); }
  }, 30000);
  store.onWorkspaceDeactivation(() => clearInterval(leaseTimer));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onPresentationWake();
  });
  onNavigate(resolve);
  cleanupSessionAutoTriggers();
  stopSessionAutoTriggers = installSessionAutoTriggers({
    materialize: (date, signal) => !signal.aborted && canMaterializeTodaySessions()
      ? store.ensureSessionsForDate(date, { signal }) : null,
    repaint: scheduleRender,
    getSessions: (date) => store.sessionsOn(date),
    getCalendarDay: (date) => store.calendarDayFor(date),
    subscribe: (refresh) => store.subscribe(refresh),
    onError: (err) => console.warn('[rakeezx sessions] automatic materialization failed:', err),
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', store.applyTheme);

  await resolve();
  if (isDemoWorkspace() && isDemoRequested() && store.state.ready && document.querySelector('.layout')) {
    marketing.track('demo_started');
  }
  if (syncModule) void refreshSyncOperationalUI();
  registerServiceWorker();
}

const INITIAL_RESTORE_COPY = Object.freeze({
  RESTORE_PREFLIGHT: ['جارٍ تجهيز مساحة حسابك', 'جارٍ التحقق من بيانات الحساب...'],
  RESTORING: ['جارٍ تجهيز مساحة حسابك', 'جارٍ تجهيز مساحة العمل...'],
  RESTORE_FINALIZING: ['جارٍ تجهيز مساحة حسابك', 'أوشكنا على الانتهاء...'],
  RESTORE_REQUIRES_ONLINE: ['تحتاج إلى اتصال بالإنترنت لاستعادة بيانات الحساب', 'اتصل بالإنترنت ثم أعد المحاولة.'],
  RESTORE_FAILED: ['تعذر استعادة بيانات الحساب', 'لم تُفتح مساحة عمل جزئية. يمكنك إعادة المحاولة بأمان.'],
  PROVISIONING_REQUIRED: ['لا توجد مساحة عمل قابلة للاستعادة', 'هذا الحساب لا يملك بعد مساحة عمل سحابية موجودة. لن ينشئ التطبيق سجلًا فارغًا تلقائيًا.'],
  PROVISIONING: ['جارٍ تجهيز مساحة حسابك', 'جارٍ تجهيز مساحة العمل...'],
  PROVISIONING_FAILED: ['تعذر تجهيز مساحة حسابك', 'لم تُفتح مساحة عمل جزئية. يمكنك إعادة المحاولة بأمان.'],
});

function renderInitialRestoreState(state, { error = null } = {}) {
  const [title, description] = INITIAL_RESTORE_COPY[state] ?? INITIAL_RESTORE_COPY.RESTORE_FAILED;
  const actionable = ['RESTORE_REQUIRES_ONLINE', 'RESTORE_FAILED', 'PROVISIONING_FAILED'].includes(state);
  const pending = ['RESTORE_PREFLIGHT', 'RESTORING', 'RESTORE_FINALIZING', 'PROVISIONING'].includes(state);
  const failed = ['RESTORE_FAILED', 'PROVISIONING_FAILED'].includes(state);
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

function renderFirstAccountProfile(contract) {
  const ownerId = contract.ownerId;
  const current = contract.profile ?? {};
  let teacherForm = current.teacherForm === 'feminine' ? 'feminine' : 'masculine';
  render(app, html`
    <div class="page first-run-page" data-account-profile-required>
      <div class="first-run-orb first-run-orb--green" aria-hidden="true"></div>
      <div class="first-run-orb first-run-orb--blue" aria-hidden="true"></div>
      <form class="first-run-card profile-completion" data-account-profile-form>
        <div class="first-run-status__brand">${brandLockup({ compact: true })}</div>
        <div class="first-run-status__copy">
          <div class="first-run-eyebrow">مساحة حسابك</div>
          <h1>أكمل بيانات حسابك</h1>
          <p>خطوة بسيطة لتجهيز مساحة عملك.</p>
        </div>
        <label class="field"><span class="field__label">اسم المعلم أو المعلمة <small>مطلوب</small></span>
          <input class="input" name="teacherName" required autocomplete="name" value="${current.teacherName}" /></label>
        <label class="field"><span class="field__label">رقم الجوال <small>مطلوب</small></span>
          <input class="input" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national"
                 maxlength="10" required pattern="05[0-9]{8}" value="${current.phone}" />
          <span class="field__hint">خاص ببيانات الحساب ولا يظهر للطلاب.</span></label>
        <div class="field"><span class="field__label">صفة المستخدم</span>
          <div class="segmented settings-teacher-form" role="group" aria-label="صفة المستخدم">
            <button class="segmented__btn ${teacherForm === 'masculine' ? 'is-on' : ''}" type="button" data-profile-form="masculine" aria-pressed="${String(teacherForm === 'masculine')}">معلم</button>
            <button class="segmented__btn ${teacherForm === 'feminine' ? 'is-on' : ''}" type="button" data-profile-form="feminine" aria-pressed="${String(teacherForm === 'feminine')}">معلمة</button>
          </div></div>
        <label class="field"><span class="field__label">اسم المدرسة <small>اختياري</small></span>
          <input class="input" name="schoolName" value="${current.schoolName}" /></label>
        <div class="field__error" role="alert" data-profile-error hidden></div>
        <div class="first-run-status__actions">
          <button class="btn btn--primary" type="submit">متابعة</button>
          <button class="btn btn--ghost" type="button" data-profile-logout>تسجيل الخروج</button>
        </div>
      </form>
    </div>`);
  const form = app.querySelector('[data-account-profile-form]');
  form.querySelectorAll('[data-profile-form]').forEach((button) => button.addEventListener('click', () => {
    teacherForm = button.dataset.profileForm;
    form.querySelectorAll('[data-profile-form]').forEach((choice) => {
      const selected = choice.dataset.profileForm === teacherForm;
      choice.classList.toggle('is-on', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  }));
  form.elements.phone.addEventListener('input', (event) => {
    event.target.value = normalizeSaudiMobile(event.target.value);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const error = form.querySelector('[data-profile-error]');
    button.disabled = true;
    error.hidden = true;
    try {
      if (cloud.user?.id !== ownerId) throw new Error('Profile account changed');
      await completeProfile({ teacherName: form.elements.teacherName.value,
        phone: form.elements.phone.value, teacherForm, schoolName: form.elements.schoolName.value });
      if (cloud.user?.id !== ownerId) throw new Error('Profile account changed');
      renderInitialRestoreState('PROVISIONING');
      const registry = createWorkspaceRegistry();
      try {
        const result = await runAccountProvisioning({ expectedOwnerId: ownerId, registry });
        if (result.status !== 'ready') throw new Error('Account provisioning did not reach READY');
      } finally { await registry.close(); }
      location.reload();
    } catch (failure) {
      if (app.contains(form)) {
        error.textContent = 'تعذر حفظ البيانات الآن. تحقق من الاتصال وأعد المحاولة.';
        error.hidden = false;
        button.disabled = false;
      } else renderInitialRestoreState('PROVISIONING_FAILED', { error: failure });
    }
  });
  form.querySelector('[data-profile-logout]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await cloud.signOut();
    location.reload();
  });
}

async function mountAndRunInitialRestore() {
  const registry = createWorkspaceRegistry();
  initialRestoreAbortController = new AbortController();
  const controller = initialRestoreAbortController;
  const ownerId = cloud.user.id;
  const unsubscribe = cloud.subscribe(() => {
    if (cloud.user?.id !== ownerId || !cloud.session) controller.abort();
  });
  try {
    renderInitialRestoreState(navigator.onLine === false ? 'RESTORE_REQUIRES_ONLINE' : 'RESTORE_PREFLIGHT');
    if (navigator.onLine === false) return;
    const provisioning = await runAccountProvisioning({ expectedOwnerId: ownerId, registry,
      signal: controller.signal,
      onState: (state) => { if (state === 'PROVISIONING') renderInitialRestoreState('PROVISIONING'); },
    });
    if (provisioning.status === 'profile_required') {
      renderFirstAccountProfile(provisioning.contract);
      return;
    }
    if (provisioning.status === 'ready') {
      location.reload();
      return;
    }
    const result = await runInitialRestore({
      expectedOwnerId: ownerId,
      registry,
      onState: (state) => renderInitialRestoreState(state),
      signal: controller.signal,
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
    unsubscribe();
    initialRestoreAbortController = null;
    await registry.close();
  }
}

function mountEmailOtpController(root, done, { reloadOnSuccess = false, inline = false } = {}) {
  const form = root.querySelector('#mini-hub-login-form, #first-run-inline-form');
  const emailStep = root.querySelector('[data-email-otp-email-step]');
  const codeStep = root.querySelector('[data-email-otp-code-step]');
  const emailInput = root.querySelector('input[name="email"]');
  const tokenInput = root.querySelector('input[name="token"]');
  const submitBtn = root.querySelector('button[type="submit"]');
  const resendBtn = root.querySelector('[data-email-otp-resend]');
  const sentText = root.querySelector('[data-email-otp-sent]');
  const cooldownText = root.querySelector('[data-email-otp-cooldown]');
  const landing = inline ? root.querySelector('.n37-landing') : null;
  const choices = inline ? root.querySelector('[data-n56-choices]') : null;
  const card = inline ? root.querySelector('.n56-auth') : null;
  const feedback = inline ? root.querySelector('[data-email-otp-feedback]') : null;
  const title = inline ? root.querySelector('[data-n56-title]') : null;
  const intro = inline ? root.querySelector('[data-n56-intro]') : null;
  let selectedEmail = '';
  let cooldownTimer = null;
  let requestInFlight = false;
  const cooldownByEmail = new Map();
  const showFeedback = (message = '', input = null) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.hidden = !message;
    emailInput.setAttribute('aria-invalid', String(Boolean(message && input === emailInput)));
    tokenInput.setAttribute('aria-invalid', String(Boolean(message && input === tokenInput)));
  };
  const showInlineStep = (step, focus = false) => {
    if (!inline) return;
    landing.dataset.step = step;
    choices.hidden = step !== 'default';
    card.hidden = step === 'default';
    emailStep.hidden = step !== 'email';
    codeStep.hidden = step !== 'verify';
    form.dataset.step = step === 'verify' ? 'verify' : 'email';
    root.querySelector('[data-n56-back]').hidden = step !== 'email';
    root.querySelector('[data-email-otp-change]').hidden = step !== 'verify';
    root.querySelector('[data-email-otp-resend]').hidden = step !== 'verify';
    if (step === 'email') {
      title.textContent = 'ابدأ مع ركيز المعلم';
      intro.textContent = 'أدخل بريدك الإلكتروني لإرسال رمز التحقق.';
      submitBtn.textContent = 'متابعة';
    } else if (step === 'verify') {
      title.textContent = 'تحقق من بريدك';
      intro.textContent = 'أرسلنا رمز التحقق إلى:';
      submitBtn.textContent = 'تحقق';
      emailInput.value = selectedEmail;
    }
    showFeedback();
    if (focus) {
      const target = step === 'default' ? root.querySelector('[data-workspace-login]') : step === 'verify' ? tokenInput : emailInput;
      requestAnimationFrame(() => { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest' }); });
    }
  };

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
      sentText.textContent = inline ? email : `أُرسل الرمز إلى ${email}`;
      emailStep.hidden = true;
      codeStep.hidden = false;
      form.dataset.step = 'verify';
      submitBtn.textContent = inline ? 'تحقق' : 'تحقق وتسجيل الدخول';
      tokenInput.required = true;
      if (inline) showInlineStep('verify', true);
      else tokenInput.focus({ preventScroll: true });
      startCooldown(email);
      return true;
    } finally {
      requestInFlight = false;
      updateCooldown();
      if (form.dataset.step === 'verify') submitBtn.disabled = false;
    }
  };

  emailInput?.addEventListener('input', () => { updateCooldown(); showFeedback(); });
  tokenInput?.addEventListener('input', () => { tokenInput.value = normalizeEmailOtp(tokenInput.value); showFeedback(); });
  root.querySelector('[data-email-otp-change]')?.addEventListener('click', () => {
    codeStep.hidden = true;
    emailStep.hidden = false;
    form.dataset.step = 'email';
    tokenInput.required = false;
    tokenInput.value = '';
    submitBtn.textContent = inline ? 'متابعة' : 'إرسال رمز التحقق';
    updateCooldown();
    if (inline) showInlineStep('email', true);
    else emailInput.focus({ preventScroll: true });
  });
  root.querySelector('[data-n56-back]')?.addEventListener('click', () => {
    if (!requestInFlight) showInlineStep('default', true);
  });
  resendBtn?.addEventListener('click', async () => {
    if (resendBtn.disabled || !selectedEmail) return;
    resendBtn.disabled = true;
    try {
      if (await requestCode(selectedEmail)) {
        toast('أُعيد إرسال رمز التحقق');
      }
    } catch (error) {
      if (emailOtpFailureState(error, 'send') === 'rate_limited' && error.retryAfterSeconds) {
        startCooldown(selectedEmail, error.retryAfterSeconds);
      }
      const message = emailOtpFailureMessage(emailOtpFailureState(error, 'send'));
      toast(message, 'danger');
      showFeedback(message);
      updateCooldown();
    }
  });

  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (inline && form.dataset.step === 'email' && !emailInput.checkValidity()) {
      showFeedback('أدخل بريدًا إلكترونيًا صحيحًا.', emailInput);
      emailInput.focus({ preventScroll: true });
      return;
    }
    const email = normalizeEmailAddress(emailInput.value);
    const token = normalizeEmailOtp(tokenInput.value);
    if (!email || (form.dataset.step === 'verify' && !isValidEmailOtp(token))) {
      if (form.dataset.step === 'verify') {
        const message = `أدخل رمز التحقق المكون من ${EMAIL_OTP_LENGTH} أرقام`;
        toast(message, 'danger');
        showFeedback(message, tokenInput);
      }
      return;
    }
    const prevText = submitBtn.textContent;
    submitBtn.textContent = form.dataset.step === 'verify' ? 'جارٍ التحقق...' : 'جارٍ الإرسال...';
    submitBtn.disabled = true;
    showFeedback();
    try {
      if (form.dataset.step === 'email') {
        const sent = await requestCode(email);
        if (!sent) submitBtn.textContent = prevText;
        updateCooldown();
        return;
      }
      await cloud.verifyEmailOtp(selectedEmail, token);
      toast('تم تسجيل الدخول بنجاح');
      if (!inline) teacherMiniHubAuthPending = null;
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
      const message = emailOtpFailureMessage(emailOtpFailureState(err, form.dataset.step === 'verify' ? 'verify' : 'send'));
      toast(message, 'danger');
      showFeedback(message, form.dataset.step === 'verify' ? tokenInput : emailInput);
    }
  });
  return { start: () => showInlineStep('email', true), cleanup: () => clearTimeout(cooldownTimer) };
}

function openMiniHubLoginSheet({ reloadOnSuccess = false } = {}) {
  marketing.stop();
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
      cleanupLoginSheet = mountEmailOtpController(root, done, { reloadOnSuccess }).cleanup;
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
  if (routing.authState === 'signed_out') marketing.capturePublicEntry();
  render(app, html`
    <div class="page ${signedOut ? 'n37-landing-gate' : ''}" data-workspace-gate data-workspace-code="${WORKSPACE_NOT_READY}" data-workspace-reason="${routing.reason}">
      ${signedOut ? html`
        <main class="n37-landing" aria-labelledby="first-run-title">
          <div class="n37-atmosphere" aria-hidden="true">
            <i class="n37-orb n37-orb--green"></i><i class="n37-orb n37-orb--blue"></i><i class="n37-ring"></i>
          </div>
          <header class="n37-identity">${brandLockup()}<span>ركيزة المعلم الرقمية</span></header>
          <section class="n37-message">
            <h1 id="first-run-title">لأن وقتك للتعليم، مو للتنقّل بين الأدوات.</h1>
            <p>ركيز يجمع فصولك وطلابك وحضورك ودرجاتك وتقاريرك في مكان واحد.</p>
          </section>
          <div class="n37-actions">
            <div class="n56-choices" data-n56-choices>
              <button class="n37-primary" type="button" data-workspace-login><strong>ابدأ مع ركيز المعلم</strong><span>إنشاء حساب أو تسجيل الدخول</span></button>
              <button type="button" data-workspace-demo><strong>جرّب ركيز المعلم</strong><span>استكشف ركيز بنفسك، بدون حساب</span></button>
            </div>
            <section class="n56-auth" aria-labelledby="n56-auth-title" hidden>
              <h2 id="n56-auth-title" data-n56-title></h2>
              <p class="n56-auth__intro" data-n56-intro></p>
              <form id="first-run-inline-form" data-step="email" novalidate>
                <div data-email-otp-email-step>
                  <label for="n56-email">البريد الإلكتروني</label>
                  <input id="n56-email" name="email" type="email" required autocomplete="email" dir="ltr" placeholder="teacher@example.com" aria-describedby="n56-feedback n56-cooldown">
                  <span id="n56-cooldown" data-email-otp-cooldown aria-live="polite"></span>
                </div>
                <div data-email-otp-code-step hidden>
                  <p class="n56-auth__address" data-email-otp-sent dir="ltr"></p>
                  <label for="n56-token">رمز التحقق المكوّن من 6 أرقام</label>
                  <input id="n56-token" name="token" inputmode="numeric" autocomplete="one-time-code" dir="ltr" pattern="[0-9]{6}" maxlength="6" aria-describedby="n56-feedback">
                </div>
                <p id="n56-feedback" data-email-otp-feedback role="status" aria-live="polite" hidden></p>
                <button class="n56-auth__submit" type="submit">متابعة</button>
              </form>
              <div class="n56-auth__links">
                <button type="button" data-email-otp-change hidden>تغيير البريد</button>
                <button type="button" data-email-otp-resend hidden>إعادة إرسال الرمز</button>
                <button type="button" data-n56-back>رجوع</button>
              </div>
              <a class="n56-auth__support" href="mailto:support@rakeezx.com">الدعم: <bdi dir="ltr">support@rakeezx.com</bdi></a>
            </section>
          </div>
          <section class="n37-benefits" aria-label="لماذا ركيز؟">
            ${[
              ['classes', 'كل شغلك في مكان واحد', 'فصولك وطلابك وجدولك كلها قدامك، مرتبة وواضحة.'],
              ['attendance', 'رصد أسرع وأسهل', 'حضور طلابك ودرجاتهم مرتبة مع كل فصل، وتوصل لها بسرعة وقت الرصد.'],
              ['note', 'تلقى المعلومة وقت ما تحتاجها', 'كشوف وتقارير وسجل الطالب، مرتبة وسهلة الوصول.'],
              ['calendar', 'يومك مرتب', 'حصصك ومواعيدك قدامك، مرتبة في الجدول والتقويم الدراسي.'],
            ].map(([symbol, title, copy]) => html`<article><span class="n37-icon n37-icon--lit" aria-hidden="true">${icon(symbol)}</span><h2>${title}</h2><p>${copy}</p></article>`)}
          </section>
          <div class="n37-continuity" role="group" aria-label="شغلك يكمل معك">
            <div class="n37-continuity__item"><span class="n37-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v12H4V4Zm4 16h8m-4-4v4M8 9l3 3 5-5"/></svg></span><div><strong>شغلك ما يوقف</strong><span>حتى بدون اتصال</span></div></div>
            <div class="n37-continuity__item"><span class="n37-icon" aria-hidden="true">${icon('refresh')}</span><div><strong>كل شيء يتحدّث ويتزامن</strong><span>تلقائيًا عند رجوع الإنترنت</span></div></div>
            <div class="n37-continuity__item"><span class="n37-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 4h13v10H3V4Zm3 14h7m-4-4v4m9-9h4v11h-4V9Z"/></svg></span><div><strong>مساحتك معك</strong><span>من أي جهاز بعد تسجيل الدخول</span></div></div>
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
  // Two frames allow the actual public landing to paint. Account entry can cancel first.
  if (routing.authState === 'signed_out' && location.pathname === '/' && ['', '#/'].includes(location.hash)) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const landing = app.querySelector('.n37-landing');
      if (location.pathname === '/' && ['', '#/'].includes(location.hash) &&
          landing?.isConnected && landing.getBoundingClientRect().width > 0) marketing.track('campaign_landing');
    }));
  }
  const inlineOtp = signedOut ? mountEmailOtpController(app, () => {}, { reloadOnSuccess: true, inline: true }) : null;
  app.querySelector('[data-workspace-login]')?.addEventListener('click', () => { marketing.stop(); inlineOtp.start(); });
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
  'n44-center': openNotifications,
  'n44-settings': () => {
    notificationSheetDone?.();
    go('/settings/notifications');
  },
  'n44-read': el => actOnNotification(el, 'read'),
  'n44-dismiss': el => actOnNotification(el, 'dismiss'),
  'n44-open': el => actOnNotification(el, 'open'),
  'renew-offline-lease': async (el) => {
    el.disabled = true;
    try { await store.renewOfflineLease(); toast('تم التحقق من الحساب، يمكنك متابعة التعديل'); scheduleRender(); }
    catch { toast('لم يكتمل التحقق. تبقى بياناتك محفوظة؛ أعد المحاولة عند توفر اتصال مستقر.', 'warn'); }
    finally { el.disabled = false; }
  },
  'skip-to-content': (_el, event) => {
    event.preventDefault();
    document.getElementById('main')?.focus();
  },
  'app-back': (el, event) => {
    event.preventDefault();
    backWithinApp(el.dataset.backFallback || el.getAttribute('href'));
  },
  'quick-theme': async () => {
    const current = effectiveTheme(store.state.device?.theme, matchMedia('(prefers-color-scheme: dark)').matches);
    await store.patchDevice({ theme: current === 'dark' ? 'light' : 'dark' });
    store.applyTheme();
    scheduleRender();
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
  'review-session-repair': async () => {
    try { await openSessionRepairReview(); } catch (error) { toast(error.message, 'danger'); }
  },
  'review-calendar-repair': async () => {
    try { await openCalendarRepairReview(); } catch(error) { toast(error.message,'danger'); }
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
