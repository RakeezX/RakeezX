/**
 * RAKEEZ X — غلاف التطبيق: الإقلاع، والهيكل، وتوجيه الشاشات، وإعادة الرسم.
 */

import { html, render, icon, delegate, toast, openSheet, closeSheet } from './lib/dom.js';
import { brandLockup } from './lib/brand.js';
import * as store from './store.js';
import * as db from './lib/db.js';
import * as cloud from './lib/cloud.js';
import { match, currentPath, onNavigate, go, backWithinApp } from './router.js';
import { setRepaint } from './repaint.js';
import { installSessionAutoTriggers } from './lib/session-auto.js';

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
const scrollMemory = new Map();

/* ---------- حالة وتسميات المزامنة والتثبيت ---------- */

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return !!(window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    document.referrer?.includes('android-app://'));
}

function teacherInitials(name) {
  const clean = String(name ?? '').trim();
  if (!clean || clean === 'المعلّم') return 'م';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]} ${parts[1][0]}`;
  return parts[0].slice(0, 2);
}

function getSyncState() {
  if (syncModule) return syncModule.displayState();
  const status = syncModule?.state?.status ?? 'idle';
  const labels = {
    synced:  { text: 'متزامن', badge: 'badge--brand', label: 'كافة البيانات متزامنة مع السحابة' },
    syncing: { text: 'جارٍ المزامنة...', badge: 'badge--brand', label: 'جارٍ نقل وتحديث البيانات سحابيًا' },
    pending: { text: 'تغييرات بانتظار المزامنة', badge: 'badge--warn', label: 'توجد تعديلات محلية بانتظار رفعها' },
    offline: { text: 'غير متصل (حفظ محلي)', badge: 'badge--neutral', label: 'التطبيق يعمل دون إنترنت ويحفظ محليًا' },
    error:   { text: 'تعذر إكمال المزامنة', badge: 'badge--danger', label: 'حدث خطأ في الاتصال، ستتم إعادة المحاولة' },
    idle:    { text: 'محلي', badge: 'badge--neutral', label: 'البيانات محفوظة محليًا على هذا الجهاز' },
  };
  return {
    status,
    ...(labels[status] || labels.idle),
  };
}

function renderSidebarMiniHubTrigger() {
  const profile = store.state.profile ?? {};
  const teacherName = profile.teacherName || 'المعلّم';
  const schoolName = profile.schoolName || '';
  const syncInfo = getSyncState();

  return html`
    <button class="teacher-mini-hub-trigger" data-act="open-teacher-mini-hub" aria-label="مركز تحكم المعلّم">
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
  const teacherName = profile.teacherName || 'المعلّم';
  const schoolName = profile.schoolName || '';
  const syncInfo = getSyncState();
  const isInstalled = isStandaloneMode();
  const hasInstallPrompt = typeof window !== 'undefined' && !!window.deferredInstallPrompt;
  const isLoggedIn = !!(cloud.session && cloud.user);
  const authPending = teacherMiniHubAuthPending;
  const lastSynced = syncModule?.state?.lastSyncedAt;
  const lastSyncText = lastSynced ? new Date(lastSynced).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : null;

  return html`
      <div class="mini-hub-sheet">
        <section class="mini-hub-surface" aria-label="مركز المعلّم">
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
              ${authPending === 'logout'
                ? html`<div class="mini-hub-account__status">جارٍ تسجيل الخروج...</div>`
                : isLoggedIn
                ? html`<div class="mini-hub-account__status truncate" dir="ltr">${cloud.user.email}</div>`
                : html`<div class="mini-hub-account__status">${authPending === 'login' ? 'جارٍ تسجيل الدخول...' : 'غير مسجل الدخول'}</div>`}
            </div>
            <div class="mini-hub-account__action">
              ${authPending
                ? html`<button type="button" class="btn btn--xs btn--quiet" disabled>${authPending === 'logout' ? 'جارٍ تسجيل الخروج...' : 'جارٍ الاتصال...'}</button>`
                : isLoggedIn
                ? html`<button type="button" class="btn btn--xs btn--quiet" data-act="mini-hub-logout">تسجيل الخروج</button>`
                : html`<button type="button" class="btn btn--xs btn--ghost" data-act="mini-hub-login">تسجيل الدخول</button>`}
            </div>
          </div>
          </div>

          <div class="mini-hub-sync mini-hub-section" aria-live="polite">
            <div class="mini-hub-section__head">
              <div class="mini-hub-sync__state">
                <span class="sync-dot sync-dot--${syncInfo.status}" data-sync-status></span>
                <span class="fw-7 fs-sm">حالة المزامنة</span>
                <span class="badge ${syncInfo.badge}" data-sync-label data-sync-badge>${syncInfo.text}</span>
              </div>
            </div>
            <div class="mini-hub-sync__meta t-3 fs-xs">
              <span data-sync-description>${syncInfo.label}</span>
              <span>آخر تحديث <b dir="ltr" data-sync-time>${lastSyncText || '—'}</b></span>
            </div>
            <button class="btn btn--sm btn--quiet mini-hub-sync__action" data-act="mini-hub-sync-now" data-sync-action ${syncInfo.status === 'syncing' ? 'disabled' : ''}>
              ${icon('refresh')} <span data-sync-action-label>مزامنة الآن</span>
            </button>
          </div>

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
  if (refreshTeacherMiniHubSheet()) return Promise.resolve();
  const sheet = openSheet({
    title: 'مركز المعلّم',
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
  const showConnectionState = syncInfo.status === 'offline' || syncInfo.status === 'error';

  return html`
    <a class="skip-link" href="#main" data-act="skip-to-content">انتقل إلى المحتوى</a>
    <div class="layout">
      <nav class="sidebar" aria-label="التنقل الرئيسي">
        <div class="sidebar__brand">${brandLockup({ signature: true, appIcon: true })}</div>
        ${NAV.map((it) => navLink(it, path, 'sidebar'))}
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
  const teacherName = profile.teacherName || 'المعلّم';
  const syncInfo = getSyncState();

  return html`
    <header class="topbar ${currentPath() === '/' ? 'topbar--home' : ''}">
      ${backHref ? html`<a class="iconbtn" href="${backHref}" data-act="app-back" data-back-fallback="${backHref}" aria-label="رجوع">${icon('back')}</a>` : ''}
      <h1 class="topbar__title">
        ${currentPath() === '/' ? html`<span class="mobile-brand">${brandLockup({ appIcon: true, signature: true })}</span><span class="desktop-home-title">${title}</span>` : title}${sub ? html`<span class="topbar__sub">${sub}</span>` : ''}
      </h1>
      <div class="topbar__actions">
        ${actions ?? ''}
        <button class="topbar__teacher-btn" data-act="open-teacher-mini-hub" aria-label="مركز تحكم المعلّم: ${teacherName}">
          <span class="topbar__teacher-avatar" aria-hidden="true">${teacherInitials(teacherName)}</span>
          ${currentPath() === '/' ? html`<span class="topbar__teacher-label" aria-hidden="true">مركز المعلم</span>` : ''}
          <span class="sync-dot sync-dot--${syncInfo.status} topbar__teacher-sync" data-sync-status aria-hidden="true" title="${syncInfo.text}"></span>
        </button>
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
    const visible = syncInfo.status === 'offline' || syncInfo.status === 'error';
    statusStrip.className = `app-status-strip${visible ? ` is-visible is-${syncInfo.status}` : ''}`;
    statusStrip.querySelector('[data-app-status-text]')?.replaceChildren(syncInfo.label);
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
    el.textContent = syncModule?.state.lastSyncedAt
      ? new Date(syncModule.state.lastSyncedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—';
  }
  for (const el of document.querySelectorAll('[data-sync-action]')) {
    el.disabled = syncInfo.status === 'syncing';
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

  if (cloud.session && cloud.user) await store.ensureSessionsForDate();

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
    await store.init();
    await cloud.init();
    // Dynamic import to prevent sync syntax errors from permanently blocking the app shell
    try {
      syncModule = await import('./lib/sync.js');
      syncModule.init();
      if (import.meta.env?.DEV) window.__syncModule = syncModule;
    } catch (err) {
      console.error('[rakeezx] Sync module failed to load:', err);
    }
    if (cloud.session && cloud.user) await store.ensureSessionsForDate();
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
    scheduleRender();
    refreshTeacherMiniHubSheet();
  });
  if (syncModule) {
    syncModule.subscribe(paintSyncStatus);
  }
  onNavigate(resolve);
  installSessionAutoTriggers({
    materialize: (date) => cloud.session && cloud.user ? store.ensureSessionsForDate(date) : null,
    onError: (err) => console.warn('[rakeezx sessions] automatic materialization failed:', err),
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', store.applyTheme);

  await resolve();
  registerServiceWorker();
}

function openMiniHubLoginSheet() {
  teacherMiniHubAuthPending = 'login';
  refreshTeacherMiniHubSheet();
  const loginSheet = openSheet({
    title: 'تسجيل الدخول للحساب السحابي',
    desc: 'أدخل بيانات حسابك للمزامنة التلقائية مع السحابة.',
    body: html`
      <div class="auth-brand">${brandLockup({ signature: true, appIcon: true })}<p>مساحة العمل الرقمية للمعلم</p></div>
      <form id="mini-hub-login-form">
        <label class="field">
          <span class="field__label">البريد الإلكتروني</span>
          <input class="input" name="email" type="email" required autocomplete="email" dir="ltr" placeholder="teacher@example.com">
        </label>
        <label class="field">
          <span class="field__label">كلمة المرور</span>
          <input class="input" name="password" type="password" required autocomplete="current-password" dir="ltr">
        </label>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="mini-hub-login-form" type="submit">تسجيل الدخول</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#mini-hub-login-form')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const email = String(fd.get('email') ?? '').trim();
        const pwd = String(fd.get('password') ?? '');
        if (!email || !pwd) return;
        const submitBtn = root.querySelector('button[type="submit"]');
        const prevText = submitBtn.textContent;
        submitBtn.textContent = 'جارٍ الاتصال...';
        submitBtn.disabled = true;
        try {
          await cloud.signIn(email, pwd);
          toast('تم تسجيل الدخول بنجاح');
          teacherMiniHubAuthPending = null;
          done(true);
          refreshTeacherMiniHubSheet({ focusAccountAction: true });
        } catch (err) {
          teacherMiniHubAuthPending = null;
          refreshTeacherMiniHubSheet();
          submitBtn.textContent = prevText;
          submitBtn.disabled = false;
          toast(err.message || 'تعذر تسجيل الدخول', 'danger');
        }
      });
    }
  });
  loginSheet.finally(() => {
    if (teacherMiniHubAuthPending === 'login') {
      teacherMiniHubAuthPending = null;
      refreshTeacherMiniHubSheet({ focusAccountAction: true });
    }
  });
  return loginSheet;
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
  'mini-hub-login': () => {
    return openMiniHubLoginSheet();
  },
  'mini-hub-logout': async () => {
    teacherMiniHubAuthPending = 'logout';
    refreshTeacherMiniHubSheet();
    try {
      await cloud.signOut();
      toast('تم تسجيل الخروج');
    } catch (err) {
      toast(err.message || 'تعذر تسجيل الخروج', 'danger');
    } finally {
      teacherMiniHubAuthPending = null;
      refreshTeacherMiniHubSheet({ focusAccountAction: true });
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
