/** Ephemeral, tab-local Support origin. No URL or route parameter is retained. */
import { match } from '../router.js';

export const SUPPORT_ROUTE_CATEGORIES = Object.freeze({
  '/': 'home',
  '/classes': 'classes',
  '/teaching/:id': 'classes',
  '/teaching/:id/class-rules': 'classes',
  '/teaching/:id/students': 'classes',
  '/teaching/:id/attendance': 'classes',
  '/teaching/:id/quicklog': 'classes',
  '/teaching/:id/grades': 'classes',
  '/teaching/:id/items': 'classes',
  '/teaching/:id/picker': 'classes',
  '/teaching/:id/groups': 'classes',
  '/teaching/:id/board': 'classes',
  '/teaching/:id/sessions': 'classes',
  '/teaching/:id/reports': 'classes',
  '/student/:id': 'students',
  '/schedule': 'schedule',
  '/schedule/times': 'schedule',
  '/curriculum': 'other',
  '/reports': 'other',
  '/reports/execution': 'other',
  '/archive': 'other',
  '/archive/former-students': 'other',
  '/archive/year/:yearId/term/:termId/execution': 'other',
  '/archive/year/:yearId/term/:termId': 'other',
  '/calendar': 'calendar',
  '/settings': 'settings',
  '/settings/backup': 'settings',
});

export function safeSupportOrigin(path) {
  if (typeof path !== 'string' || path.length > 2048 || !path.startsWith('/') || /[\x00-\x1f\\#]/.test(path)) return null;
  try {
    const matched = match(path.split('?')[0]);
    const routeTemplate = matched?.route.path;
    if (!Object.hasOwn(SUPPORT_ROUTE_CATEGORIES, routeTemplate)) return null;
    if (Object.values(matched.params).some((value) => typeof value !== 'string' || !value || value.length > 256 || /[\x00-\x1f\\/?#]/.test(value))) return null;
    return { routeCategory: SUPPORT_ROUTE_CATEGORIES[routeTemplate], routeTemplate };
  } catch {
    return null;
  }
}

let pending = null;
let visit = null;

/** Call immediately before navigating to Support (including from the future Work launcher). */
export function captureSupportOriginBeforeNavigation(path, accountKey) {
  pending = null;
  if (typeof accountKey !== 'string' || !accountKey || typeof path !== 'string' || path.split('?')[0] === '/support') return;
  const origin = safeSupportOrigin(path);
  if (origin) pending = { accountKey, origin };
}

export function enterSupportVisit(accountKey) {
  visit = pending?.accountKey === accountKey ? pending : { accountKey, origin: { routeCategory: 'support' } };
  pending = null;
}

export function supportVisitOrigin(accountKey) {
  if (visit?.accountKey !== accountKey) {
    clearSupportOrigin();
    return { routeCategory: 'support' };
  }
  return { ...visit.origin };
}

export function clearSupportOrigin() {
  pending = null;
  visit = null;
}
