/** MADAR Z — موجّه على الـ hash، فيعمل من أي مجلد بلا إعداد خادم. */

const ROUTES = [
  { path: '/',                          load: () => import('./views/home.js') },
  { path: '/classes',                   load: () => import('./views/teachings.js') },
  { path: '/teaching/:id',              load: () => import('./views/teaching-hub.js') },
  { path: '/teaching/:id/students',     load: () => import('./views/students.js') },
  { path: '/teaching/:id/attendance',   load: () => import('./views/attendance.js') },
  { path: '/teaching/:id/quicklog',     load: () => import('./views/quicklog.js') },
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
  { path: '/calendar',                  load: () => import('./views/calendar.js') },
  { path: '/settings',                  load: () => import('./views/settings.js') },
  { path: '/settings/backup',           load: () => import('./views/backup.js') },
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

export const go = (path, { replace = false } = {}) => {
  const target = '#' + path;
  if (location.hash === target) return;
  if (replace) location.replace(target);
  else location.hash = target;
};

export const back = () => history.back();

export function onNavigate(fn) {
  addEventListener('hashchange', fn);
  return () => removeEventListener('hashchange', fn);
}
