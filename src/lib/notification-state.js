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
