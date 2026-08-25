/**
 * RAKEEZ X — غلاف التطبيق: الإقلاع، والهيكل، وتوجيه الشاشات، وإعادة الرسم.
 */

import { html, render, icon, delegate, toast, openSheet } from './lib/dom.js';
import * as store from './store.js';
import * as db from './lib/db.js';
import * as cloud from './lib/cloud.js';
import { match, currentPath, onNavigate, go } from './router.js';
import { setRepaint } from './repaint.js';

const app = document.getElementById('app');

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

/* ---------- التنقل الرئيسي ---------- */

const NAV = [
  { href: '#/',          icon: 'home',      label: 'الرئيسية',        exact: true, primary: true },
  { href: '#/classes',   icon: 'classes',   label: 'الفصول',          primary: true },
  { href: '#/schedule',  icon: 'timetable', label: 'الجدول',          primary: true },
  { href: '#/curriculum',icon: 'book',      label: 'المنهج' },
  { href: '#/reports',   icon: 'reports',   label: 'التقارير',        primary: true },
  { href: '#/calendar',  icon: 'calendar',  label: 'التقويم الدراسي' },
  { href: '#/settings',  icon: 'settings',  label: 'الإعدادات' },
];

/** تنقّل سياقي داخل الإسناد؛ لا يحل محل تنقّل التطبيق الرئيسي. */
const teachingNav = (id) => [
  { href: `#/teaching/${id}`,            icon: 'home',       label: 'الفصل', exact: true },
  { href: `#/teaching/${id}/students`,   icon: 'classes',    label: 'الطلاب' },
  { href: `#/teaching/${id}/attendance`, icon: 'attendance', label: 'الحضور' },
  { href: `#/teaching/${id}/quicklog`,   icon: 'spark',      label: 'الرصد' },
  { href: `#/teaching/${id}/grades`,     icon: 'grades',     label: 'الدرجات' },
  { href: `#/teaching/${id}/reports`,    icon: 'reports',    label: 'التقارير' },
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
      </nav>
      <main class="main">
        ${inTeaching ? html`<nav class="teaching-tabs" data-nav-scope="context" aria-label="تنقل الفصل">${teachingNav(params.id).map((it) => navLink(it, path, 'teaching-tabs'))}</nav>` : ''}
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

  return html`
    <header class="topbar">
      ${backHref ? html`<a class="iconbtn" href="${backHref}" aria-label="رجوع">${icon('back')}</a>` : ''}
      <h1 class="topbar__title">
        ${title}${sub ? html`<span class="topbar__sub">${sub}</span>` : ''}
      </h1>
      ${actions ? html`<div class="topbar__actions">${actions}</div>` : ''}
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
    render(
      mainEl,
      html`${topbar(view, ctx.params)}
        <div class="page ${view.wide ? 'page--wide' : ''}">${view.render(ctx.params)}</div>`
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
  store.subscribe(scheduleRender);
  cloud.subscribe(scheduleRender);
  if (syncModule) {
    syncModule.subscribe(scheduleRender);
  }
  onNavigate(resolve);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', store.applyTheme);

  await resolve();
  registerServiceWorker();
}

/** أفعال متاحة في كل الشاشات. */
const GLOBAL_ACTIONS = {
  'more-nav': () => moreNavSheet(),
};


function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!['https:', 'http:'].includes(location.protocol)) return;

  navigator.serviceWorker
    .register('sw.js')
    .then(async (reg) => {
      // مخزون مُسح خارجيًا وعامل يبقى مسجّلًا = عمل دون إنترنت مكسور صامتًا.
      // نفحص المخزون ونعيد تهيئته بدل انتظار تثبيت جديد لن يأتي.
      try {
        const keys = await caches.keys();
        const mine = keys.filter((k) => k.startsWith('rakeezx-'));
        const count = mine.length ? (await (await caches.open(mine[0])).keys()).length : 0;
        if (reg.active && count === 0) {
          console.warn('[rakeezx] مخزون العمل دون إنترنت فارغ — يُعاد بناؤه');
          await reg.unregister();
          await navigator.serviceWorker.register('sw.js');
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
