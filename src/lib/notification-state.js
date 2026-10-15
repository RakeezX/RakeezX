import { notificationScope, cleanNotificationPreferences, MAX_NOTIFICATIONS } from './notification-center.js';
export const NOTIFICATION_STORAGE_PREFIX = 'rakeezx-notification-preferences-v1:';
export function notificationStorageKey(context) {
  const scope = notificationScope(context);
  return scope ? NOTIFICATION_STORAGE_PREFIX + scope : null;
}
export function readNotificationPreferences(context, now, storage) {
  const key = notificationStorageKey(context);
  if (!key) return [];
  try {
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(key);
    if (!raw || raw.length > MAX_NOTIFICATIONS * 400) return [];
    return cleanNotificationPreferences(JSON.parse(raw), now);
  } catch { return []; }
}
export function writeNotificationPreferences(state, context, now, storage) {
  const key = notificationStorageKey(context);
  if (!key || state?.scope !== notificationScope(context)) return false;
  try { (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(cleanNotificationPreferences(state.preferences, now))); return true; }
  catch { return false; }
}

// Separate allowlisted category flags: no names, dates, event bodies or cloud writes.
export const NOTIFICATION_CATEGORY_PREFIX = 'rakeezx-notification-categories-v1:';
export function readNotificationCategories(context, storage) {
  const scope = notificationScope(context);
  const defaults = { lesson: true, due: true };
  if (!scope) return defaults;
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(NOTIFICATION_CATEGORY_PREFIX + scope);
    if (!raw || raw.length > 100) return defaults;
    const value = JSON.parse(raw);
    return { lesson: value?.lesson !== false, due: value?.due !== false };
  } catch { return defaults; }
}
export function writeNotificationCategory(context, category, enabled, storage) {
  const scope = notificationScope(context);
  if (!scope || !['lesson', 'due'].includes(category) || typeof enabled !== 'boolean') return false;
  try {
    storage ??= globalThis.localStorage;
    const value = readNotificationCategories(context, storage);
    value[category] = enabled;
    storage.setItem(NOTIFICATION_CATEGORY_PREFIX + scope, JSON.stringify(value));
    return true;
  } catch { return false; }
}
export function notificationCategoryAllowed(event, preferences) {
  // Fail open for mandatory protection and all future non-optional categories.
  return event.critical === true || !['lesson', 'due'].includes(event.kind) || preferences?.[event.kind] !== false;
}
