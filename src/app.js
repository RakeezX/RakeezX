/**
 * RAKEEZ X — غلاف التطبيق: الإقلاع، والهيكل، وتوجيه الشاشات، وإعادة الرسم.
 */

import { html, render, icon, delegate, toast, openSheet, closeSheet } from './lib/dom.js';
import * as store from './store.js';
import * as db from './lib/db.js';
import * as cloud from './lib/cloud.js';
import { match, currentPath, onNavigate, go } from './router.js';
import { setRepaint } from './repaint.js';

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

function openTeacherMiniHubSheet() {
  const profile = store.state.profile ?? {};
  const device = store.state.device ?? {};
  const teacherName = profile.teacherName || 'المعلّم';
  const schoolName = profile.schoolName || '';
  const year = store.activeYear();
  const term = store.activeTerm();
  const currentTheme = device.theme ?? 'auto';
  const syncInfo = getSyncState();
  const isInstalled = isStandaloneMode();
  const hasInstallPrompt = typeof window !== 'undefined' && !!window.deferredInstallPrompt;
  const isLoggedIn = !!(cloud.session && cloud.user);
  const lastSynced = syncModule?.state?.lastSyncedAt;
  const lastSyncText = lastSynced ? new Date(lastSynced).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : null;

  return openSheet({
    title: 'مركز تحكم المعلّم',
    body: html`
      <div class="mini-hub-sheet">
        <!-- 1. الهوية والسياق الأكاديمي -->
        <div class="mini-hub-card mini-hub-card--identity">
          <div class="hstack gap-3 align-center">
            <div class="mini-hub-avatar" aria-hidden="true">${teacherInitials(teacherName)}</div>
            <div class="flex-1 min-w-0">
              <div class="mini-hub-name">${teacherName}</div>
              <div class="mini-hub-school t-3 fs-xs">${schoolName || (isLoggedIn ? 'حساب متصل' : 'سجل معلّم محلي')}</div>
            </div>
          </div>
          <div class="mini-hub-context mt-3 pt-2">
            <div class="hstack justify-between fs-xs t-2 wrap gap-2">
              <span>السنة: <strong>${year?.label || '—'}</strong></span>
              <span>الفصل: <strong>${term?.name || '—'}</strong></span>
            </div>
          </div>
        </div>

        <!-- 2. الحساب -->
        <div class="mini-hub-card mini-hub-account">
          <div class="mini-hub-account__row">
            <div class="mini-hub-account__info">
              <div class="mini-hub-account__title">الحساب</div>
              ${isLoggedIn
                ? html`<div class="mini-hub-account__status truncate" dir="ltr">${cloud.user.email}</div>`
                : html`<div class="mini-hub-account__status">غير مسجل الدخول</div>`}
            </div>
            <div class="mini-hub-account__action">
              ${isLoggedIn
                ? html`<button type="button" class="btn btn--xs btn--quiet" data-act="mini-hub-logout">تسجيل الخروج</button>`
                : html`<button type="button" class="btn btn--xs btn--ghost" data-act="mini-hub-login">تسجيل الدخول</button>`}
            </div>
          </div>
        </div>

        <!-- 3. المزامنة -->
        <div class="mini-hub-card">
          <div class="hstack justify-between align-center mb-2">
            <div class="fw-7 fs-sm hstack gap-2 align-center">
              <span class="sync-dot sync-dot--${syncInfo.status}"></span>
              <span>المزامنة</span>
            </div>
            <span class="badge ${syncInfo.badge}">${syncInfo.text}</span>
          </div>
          <p class="t-3 fs-xs mb-2">
            ${syncInfo.label}
          </p>
          ${lastSyncText ? html`<div class="t-3 fs-xs mb-3">آخر مزامنة: <span dir="ltr">${lastSyncText}</span></div>` : ''}
          <button class="btn btn--sm btn--primary btn--block" data-act="mini-hub-sync-now">
            ${icon('refresh')} مزامنة الآن
          </button>
        </div>

        <!-- 4. المظهر -->
        <div class="mini-hub-card">
          <div class="fw-7 fs-sm mb-2">المظهر</div>
          <div class="segmented segmented--sm">
            <button class="segmented__btn ${currentTheme === 'auto' ? 'is-on' : ''}" data-act="mini-hub-theme" data-theme="auto">
              ${icon('settings')} تلقائي
            </button>
            <button class="segmented__btn ${currentTheme === 'light' ? 'is-on' : ''}" data-act="mini-hub-theme" data-theme="light">
              ${icon('sun')} فاتح
            </button>
            <button class="segmented__btn ${currentTheme === 'dark' ? 'is-on' : ''}" data-act="mini-hub-theme" data-theme="dark">
              ${icon('moon')} داكن
            </button>
          </div>
        </div>

        <!-- 5. تثبيت التطبيق PWA -->
        <div class="mini-hub-card">
          <div class="fw-7 fs-sm mb-1">تطبيق رَكيز X</div>
          ${isInstalled
            ? html`
                <div class="mini-hub-installed mt-2">
                  <span class="mini-hub-installed__icon" aria-hidden="true">${icon('check')}</span>
                  <span class="mini-hub-installed__text">مثبت على هذا الجهاز</span>
                </div>
              `
            : hasInstallPrompt
            ? html`
                <p class="t-3 fs-xs mb-2">ثبّت التطبيق لفتحه مباشرة من الشاشة الرئيسية والعمل دون إنترنت.</p>
                <button class="btn btn--sm btn--primary btn--block" data-act="mini-hub-pwa-install">
                  ${icon('download')} تثبيت تطبيق رَكيز X
                </button>
              `
            : html`
                <p class="t-3 fs-xs mb-2">يمكنك تثبيت رَكيز كتطبيق مستقل على هاتفك أو حاسبك.</p>
                <button class="btn btn--sm btn--ghost btn--block" data-act="mini-hub-pwa-guide">
                  ${icon('download')} إرشادات تثبيت التطبيق
                </button>
              `}
        </div>

        <!-- 6. رابط الإعدادات -->
        <a class="btn btn--ghost btn--block mt-1" href="#/settings" data-sheet-close>
          ${icon('settings')} الانتقال إلى كافة الإعدادات
        </a>
      </div>
    `,
  });
}

/* ---------- التنقل الرئيسي ---------- */

const NAV = [
  { href: '#/',          icon: 'home',      label: 'الرئيسية',        exact: true, primary: true },
  { href: '#/classes',   icon: 'classes',   label: 'الفصول',          primary: true },
  { href: '#/schedule',  icon: 'timetable', label: 'الجدول',          primary: true },
  { href: '#/reports',   icon: 'reports',   label: 'التقارير',        primary: true },
  { href: '#/calendar',  icon: 'calendar',  label: 'التقويم الدراسي' },
  { href: '#/settings',  icon: 'settings',  label: 'الإعدادات' },
];

/** تنقّل سياقي داخل الإسناد؛ لا يحل محل تنقّل التطبيق الرئيسي. */
const teachingNav = (id) => [
  { href: `#/teaching/${id}`,            icon: 'home',       label: 'الفصل', exact: true },
  { href: `#/teaching/${id}/attendance`, icon: 'attendance', label: 'الحضور' },
  { href: `#/teaching/${id}/sessions`,   icon: 'session',    label: 'الحصص' },
  { href: `#/teaching/${id}/grades`,     icon: 'grades',     label: 'كشف الدرجات' },
  { href: `#/teaching/${id}/students`,   icon: 'classes',    label: 'الطلاب' },
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

  return html`
    <div class="layout">
      <nav class="sidebar">
        <div class="sidebar__brand">${icon('spark')} <span>RAKEEZ&nbsp;X</span></div>
        ${NAV.map((it) => navLink(it, path, 'sidebar'))}
        <div class="sidebar__spacer"></div>
        ${inTeaching
          ? html`<a class="sidebar__item" href="#/classes">${icon('back')}<span>كل الفصول</span></a>`
          : ''}
        <div id="sidebar-mini-hub">${renderSidebarMiniHubTrigger()}</div>
      </nav>
      <main class="main">
        ${inTeaching ? html`<div class="class-context-nav-bar"><nav class="class-context-nav" data-nav-scope="context" aria-label="تنقل الفصل">${teachingNav(params.id).map((it) => navLink(it, path, 'class-context-nav'))}</nav></div>` : ''}
        <div id="main"></div>
      </main>
      <nav class="tabbar" data-nav-scope="primary" aria-label="التنقل الرئيسي">
        ${bottom.map((it) => navLink(it, path, 'tabbar'))}
        <button class="tabbar__item" data-act="more-nav">${icon('more')}<span>المزيد</span></button>
      </nav>
    </div>
  `;
}

/** بقية عناصر التنقل على الجوال — حتى لا يزدحم الشريط السفلي. */
function moreNavSheet() {
  const rest = NAV.filter((n) => !n.primary);

  return openSheet({
    title: 'المزيد',
    body: html`
      <div class="list">
        ${rest.map(
          (it) => html`
            <a class="row" href="${it.href}" data-sheet-close>
              <span class="row__icon">${icon(it.icon)}</span>
              <span class="row__main"><span class="row__title">${it.label}</span></span>
              <span class="row__end">${icon('chev')}</span>
            </a>
          `
        )}
      </div>
    `,
  });
}

/* ---------- الشريط العلوي ---------- */

function topbar(v, params) {
  const backHref = v.back?.(params);
  const title = typeof v.title === 'function' ? v.title(params) : v.title ?? 'RAKEEZ X';
  const sub = v.subtitle?.(params);
  const actions = v.topActions?.(params);
  const profile = store.state.profile ?? {};
  const teacherName = profile.teacherName || 'المعلّم';
  const syncInfo = getSyncState();

  return html`
    <header class="topbar">
      ${backHref ? html`<a class="iconbtn" href="${backHref}" aria-label="رجوع">${icon('back')}</a>` : ''}
      <h1 class="topbar__title">
        ${title}${sub ? html`<span class="topbar__sub">${sub}</span>` : ''}
      </h1>
      <div class="topbar__actions">
        ${actions ?? ''}
        <button class="topbar__teacher-btn" data-act="open-teacher-mini-hub" aria-label="مركز تحكم المعلّم: ${teacherName}">
          <span class="topbar__teacher-avatar" aria-hidden="true">${teacherInitials(teacherName)}</span>
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
        <div class="page ${view.wide ? 'page--wide' : ''} ${currentPath().startsWith('/teaching/') ? 'page--class-workspace' : ''}">${view.render(ctx.params)}</div>`
    );
  } catch (err) {
    console.error('[rakeezx] فشل رسم الشاشة', err);
    render(
      mainEl,
      html`<div class="page">
        <div class="empty">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">تعذّر عرض هذه الشاشة</div>
          <div class="empty__text">${String(err?.message ?? err)}</div>
          <a class="btn btn--ghost" href="#/">العودة للرئيسية</a>
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
  } catch (err) {
    console.error('[rakeezx] فشل فتح قاعدة البيانات', err);
    render(
      app,
      html`<div class="page">
        <div class="empty">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">تعذّر فتح سجلّك</div>
          <div class="empty__text">${String(err?.message ?? err)}</div>
          <div class="empty__text t-3">
            إن كنت في وضع التصفح الخاص فافتح التطبيق في نافذة عادية،
            وتأكد أن تخزين المواقع مسموح.
          </div>
          <button class="btn btn--ghost" onclick="location.reload()">أعد المحاولة</button>
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
          const fn = a?.[key] ?? globals[key];
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
  cloud.subscribe(scheduleRender);
  if (syncModule) {
    syncModule.subscribe(paintSyncStatus);
  }
  onNavigate(resolve);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', store.applyTheme);

  await resolve();
  registerServiceWorker();
}

function openMiniHubLoginSheet() {
  openSheet({
    title: 'تسجيل الدخول للحساب السحابي',
    desc: 'أدخل بيانات حسابك للمزامنة التلقائية مع السحابة.',
    body: html`
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
          done(true);
          scheduleRender();
          openTeacherMiniHubSheet();
        } catch (err) {
          submitBtn.textContent = prevText;
          submitBtn.disabled = false;
          toast(err.message || 'تعذر تسجيل الدخول', 'danger');
        }
      });
    }
  });
}

/** أفعال متاحة في كل الشاشات. */
const GLOBAL_ACTIONS = {
  'more-nav': () => moreNavSheet(),
  'open-teacher-mini-hub': () => openTeacherMiniHubSheet(),
  'mini-hub-login': () => {
    openMiniHubLoginSheet();
  },
  'mini-hub-logout': async () => {
    await cloud.signOut();
    toast('تم تسجيل الخروج');
    scheduleRender();
    openTeacherMiniHubSheet();
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
      toast(ok ? 'تمت المزامنة بنجاح' : 'تعذرت المزامنة', ok ? undefined : 'danger');
    } catch (err) {
      toast('تعذرت المزامنة', 'danger');
    } finally {
      el.disabled = false;
      el.innerHTML = prevText;
      scheduleRender();
      openTeacherMiniHubSheet();
    }
  },
  'mini-hub-theme': async (el) => {
    const theme = el.dataset.theme;
    if (theme) {
      await store.patchDevice({ theme });
      store.applyTheme();
      scheduleRender();
      openTeacherMiniHubSheet();
    }
  },
  'mini-hub-pwa-install': async () => {
    if (window.deferredInstallPrompt) {
      window.deferredInstallPrompt.prompt();
      try {
        const { outcome } = await window.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          toast('جارٍ تثبيت تطبيق ركيز...');
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
