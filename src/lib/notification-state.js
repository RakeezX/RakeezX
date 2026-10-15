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
    if (!raw || raw.length > 1000) return defaults;
    const value = JSON.parse(raw);
    return { lesson: value?.lesson !== false, due: value?.due !== false };
  } catch { return defaults; }
}
export function writeNotificationCategory(context, category, enabled, storage) {
  const scope = notificationScope(context);
  if (!scope || !['lesson', 'due'].includes(category) || typeof enabled !== 'boolean') return false;
  try {
    storage ??= globalThis.localStorage;
    const value = { ...readNotificationCategories(context, storage), ...readNotificationTiming(context, storage) };
    value[category] = enabled;
    storage.setItem(NOTIFICATION_CATEGORY_PREFIX + scope, JSON.stringify(value));
    return true;
  } catch { return false; }
}
export function notificationCategoryAllowed(event, preferences) {
  // Fail open for mandatory protection and all future non-optional categories.
  return event.critical === true || !['lesson', 'due'].includes(event.kind) || preferences?.[event.kind] !== false;
}

// Same private local preference record; no new startup dependency or cloud state.
export const LESSON_LEAD_MINUTES = [5, 10, 15, 20, 30, 45, 60];
export const DUE_STAGES = [3, 2, 1, 0];
export function readNotificationTiming(context, storage) {
  const defaults = { lessonMinutes: 15, dueDays: [...DUE_STAGES], observedAt: 0, observedDate: '' };
  const scope = notificationScope(context);
  if (!scope) return defaults;
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(NOTIFICATION_CATEGORY_PREFIX + scope);
    if (!raw || raw.length > 1000) return defaults;
    const value = JSON.parse(raw);
    return { lessonMinutes: LESSON_LEAD_MINUTES.includes(value?.lessonMinutes) ? value.lessonMinutes : 15,
      dueDays: Array.isArray(value?.dueDays) ? DUE_STAGES.filter(day => value.dueDays.includes(day)) : [...DUE_STAGES],
      observedDate: /^\d{4}-\d{2}-\d{2}$/.test(value?.observedDate) ? value.observedDate : '',
      observedAt: Number.isFinite(value?.observedAt) && value.observedAt >= 0 ? value.observedAt : 0 };
  } catch { return defaults; }
}
export function writeNotificationTiming(context, patch, storage) {
  const scope = notificationScope(context);
  if (!scope || !patch || Object.keys(patch).some(key => !['lessonMinutes', 'dueDays', 'observedAt', 'observedDate'].includes(key)) ||
    ('lessonMinutes' in patch && !LESSON_LEAD_MINUTES.includes(patch.lessonMinutes)) ||
    ('dueDays' in patch && (!Array.isArray(patch.dueDays) || patch.dueDays.some(day => !DUE_STAGES.includes(day)))) ||
    ('observedDate' in patch && !/^\d{4}-\d{2}-\d{2}$/.test(patch.observedDate)) ||
    ('observedAt' in patch && (!Number.isFinite(patch.observedAt) || patch.observedAt < 0))) return false;
  try {
    storage ??= globalThis.localStorage;
    const previous = readNotificationTiming(context, storage);
    const value = { ...readNotificationCategories(context, storage), ...previous, ...patch,
      observedDate: [previous.observedDate, patch.observedDate ?? ''].sort().at(-1),
      observedAt: Math.max(previous.observedAt, patch.observedAt ?? 0) };
    storage.setItem(NOTIFICATION_CATEGORY_PREFIX + scope, JSON.stringify(value));
    return true;
  } catch { return false; }
}
// A persisted high-water clock fails quietly closed after clock rollback, including
// reloads/timezone changes. Preference edits never reset it or read/dismiss IDs.
export function notificationNow(context, now = Date.now(), storage) {
  const previous = readNotificationTiming(context, storage).observedAt;
  const effective = Math.max(previous, now);
  const date = new Date(effective);
  const observedDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  if (notificationScope(context)) writeNotificationTiming(context, { observedAt: effective, observedDate }, storage);
  return effective;
}
