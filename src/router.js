/** RAKEEZ X — موجّه على الـ hash، فيعمل من أي مجلد بلا إعداد خادم. */

const ROUTES = [
  { path: '/',                          load: () => import('./views/home.js') },
  { path: '/classes/import', load: () => import('./views/class-import-center.js') },
  { path: '/classes/koshoof', load: () => import('./views/class-import-center.js').then(m => ({ default: m.koshoofCenter })) },
  { path: '/classes',                   load: () => import('./views/teachings.js') },
  { path: '/teaching/:id',              load: () => import('./views/teaching-hub.js') },
  { path: '/teaching/:id/class-rules',  load: () => import('./views/class-rules.js') },
  { path: '/teaching/:id/students',     load: () => import('./views/students.js') },
  { path: '/teaching/:id/attendance',   load: () => import('./views/attendance.js') },
  { path: '/teaching/:id/quicklog',     load: () => import('./views/quicklog.js') },
  { path: '/teaching/:id/koshoof', load: () => import('./views/grades.js').then(m => ({ default: m.koshoofView })) },
  { path: '/teaching/:id/grades',       load: () => import('./views/grades.js') },
  { path: '/teaching/:id/items',        load: () => import('./views/items.js') },
  { path: '/teaching/:id/picker',       load: () => import('./views/picker.js') },
  { path: '/teaching/:id/groups',       load: () => import('./views/groups.js') },
  { path: '/teaching/:id/board',        load: () => import('./views/board.js') },
  { path: '/teaching/:id/sessions',     load: () => import('./views/sessions.js') },
  { path: '/teaching/:id/reports',      load: () => import('./views/reports.js') },
  { path: '/student/:id',               load: () => import('./views/student.js') },
  { path: '/schedule',                  load: () => import('./views/schedule.js') },
  { path: '/schedule/times',            load: () => import('./views/times.js') },
  { path: '/curriculum',                load: () => import('./views/curriculum.js') },
  { path: '/reports',                   load: () => import('./views/reports-index.js') },
  { path: '/reports/grades',            load: () => import('./views/cross-class-reports.js') },
  { path: '/reports/followup',          load: () => import('./views/cross-class-reports.js') },
  { path: '/reports/execution',         load: () => import('./views/execution-report.js') },
  { path: '/archive',                  load: () => import('./views/archive.js') },
  { path: '/archive/former-students',   load: () => import('./views/former-students.js') },
  { path: '/archive/year/:yearId/term/:termId/execution', load: () => import('./views/execution-report.js') },
  { path: '/archive/year/:yearId/term/:termId', load: () => import('./views/archive-detail.js') },
  { path: '/calendar',                  load: () => import('./views/calendar.js') },
  { path: '/settings',                  load: () => import('./views/settings.js') },
  { path: '/settings/notifications',    load: () => import('./views/notification-settings.js') },
  { path: '/settings/backup',           load: () => import('./views/backup.js') },
  { path: '/support',                   load: () => import('./views/support.js') },
];

const compile = (path) => {
  const keys = [];
  const pattern = path
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { re: new RegExp(`^${pattern}$`), keys };
};

const COMPILED = ROUTES.map((r) => ({ ...r, ...compile(r.path) }));

const NAVIGATION_STATE_KEY = '__rakeezNavigation';
let activeNavigation = null;
let pendingReplacement = null;
let navigationSequence = 0;

export function currentPath() {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

export function match(path = currentPath()) {
  const [clean, queryStr] = path.split('?');
  for (const route of COMPILED) {
    const m = route.re.exec(clean);
    if (!m) continue;
    const params = {};
    route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    if (queryStr) {
      for (const [k, v] of new URLSearchParams(queryStr)) params[k] = v;
    }
    return { route, params, path: clean };
  }
  return null;
}

const navigationState = () => history.state?.[NAVIGATION_STATE_KEY] ?? null;
const validAppPath = (path) => typeof path === 'string' && path.startsWith('/') && !!match(path);

function replaceNavigationState(value) {
  const state = history.state && typeof history.state === 'object' ? history.state : {};
  history.replaceState({ ...state, [NAVIGATION_STATE_KEY]: value }, '');
}

function navigationEntry(path, previous = null) {
  navigationSequence += 1;
  return {
    id: `${Date.now().toString(36)}-${navigationSequence}`,
    path,
    previous: validAppPath(previous) && previous !== path ? previous : null,
  };
}

/**
 * Associates each same-tab RAKEEZ history entry with its actual in-app parent.
 * Browser Back/Forward keeps its native session-history behavior; this metadata
 * is used only by explicit Back controls rendered inside RAKEEZ.
 */
export function syncNavigationContext() {
  const path = currentPath();
  const stored = navigationState();

  if (stored?.path === path && validAppPath(path)) {
    activeNavigation = stored;
    pendingReplacement = null;
    return stored;
  }

  const previous = pendingReplacement
    ? pendingReplacement.previous
    : activeNavigation?.path;
  const entry = navigationEntry(path, previous);
  replaceNavigationState(entry);
  activeNavigation = entry;
  pendingReplacement = null;
  return entry;
}

export const go = (path, { replace = false } = {}) => {
  const target = '#' + path;
  if (location.hash === target) return;
  if (replace) {
    const current = navigationState();
    pendingReplacement = { previous: current?.previous ?? activeNavigation?.previous ?? null };
    location.replace(target);
  }
  else location.hash = target;
};

export const back = () => history.back();

/** Prefer a verified same-tab RAKEEZ predecessor; otherwise replace with the logical parent. */
export function backWithinApp(fallback) {
  syncNavigationContext();
  const previous = activeNavigation?.previous;
  if (validAppPath(previous) && previous !== currentPath()) {
    history.back();
    return 'history';
  }

  const fallbackPath = String(fallback ?? '').replace(/^#/, '');
  if (validAppPath(fallbackPath) && fallbackPath !== currentPath()) {
    go(fallbackPath, { replace: true });
    return 'fallback';
  }
  return 'none';
}

export function onNavigate(fn) {
  syncNavigationContext();
  const handler = (...args) => {
    syncNavigationContext();
    fn(...args);
  };
  addEventListener('hashchange', handler);
  return () => removeEventListener('hashchange', handler);
}
