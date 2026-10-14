/** N44 local center, adapted from the manifest-verified prototype reducer.
 * Current events are replaced on observation; only bounded preferences persist. */
export const MAX_NOTIFICATIONS = 100;
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const validEventId = value => typeof value === 'string' && /^[a-zA-Z0-9_:%.-]{1,240}$/.test(value);
export function notificationScope(context) {
  if (context?.verified !== true || context.mode !== 'account') return null;
  if (![context.ownerId, context.workspaceId, context.deviceId].every(value =>
    typeof value === 'string' && value.length > 0 && value.length <= 180)) return null;
  return [context.ownerId, context.workspaceId, context.deviceId].map(encodeURIComponent).join(':');
}
export function createNotificationCenter(context) {
  return { scope: notificationScope(context), items: [], preferences: [] };
}
export function cleanNotificationPreferences(rows, now) {
  if (!Number.isFinite(now) || !Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.slice(0, MAX_NOTIFICATIONS).filter(row => {
    if (!row || !validEventId(row.id) || seen.has(row.id)) return false;
    seen.add(row.id); return true;
  }).map(row => ({ id: row.id,
    // A bounded backward clock adjustment must not turn a read notice unread.
    readAt: Number.isFinite(row.readAt) && row.readAt <= now + MAX_EVENT_AGE_MS && row.readAt > now - MAX_EVENT_AGE_MS ? row.readAt : null,
    dismissedAt: Number.isFinite(row.dismissedAt) && row.dismissedAt <= now + MAX_EVENT_AGE_MS && row.dismissedAt > now - MAX_EVENT_AGE_MS ? row.dismissedAt : null,
  })).filter(row => row.readAt !== null || row.dismissedAt !== null);
}
export function updateNotificationCenter(previous, context, action, now) {
  const scope = notificationScope(context);
  if (!scope || !Number.isFinite(now)) return createNotificationCenter(null);
  const base = previous?.scope === scope ? previous : createNotificationCenter(context);
  const state = { ...base, preferences: cleanNotificationPreferences(base.preferences, now), items: base.items };
  if (action?.type === 'receive') {
    const seen = new Set();
    state.items = (Array.isArray(action.events) ? action.events : []).slice(0, MAX_NOTIFICATIONS).filter(event => {
      if (!event || event.scope !== scope || !validEventId(event.id) || seen.has(event.id) ||
        !['lesson', 'due'].includes(event.kind) || !Number.isFinite(event.expiresAt) || event.expiresAt <= now) return false;
      seen.add(event.id); return true;
    });
  }
  if (['read', 'dismiss'].includes(action?.type) && state.items.some(item => item.id === action.id && item.expiresAt > now)) {
    const prior = state.preferences.find(row => row.id === action.id);
    state.preferences = [{ id: action.id, readAt: prior?.readAt ?? now,
      dismissedAt: action.type === 'dismiss' ? now : prior?.dismissedAt ?? null },
    ...state.preferences.filter(row => row.id !== action.id)].slice(0, MAX_NOTIFICATIONS);
  }
  return state;
}
export function notificationSnapshot(state, context, now) {
  if (!notificationScope(context) || state?.scope !== notificationScope(context) || !Number.isFinite(now)) return { items: [], unread: 0 };
  const preferences = cleanNotificationPreferences(state.preferences, now);
  const items = state.items.filter(item => item.expiresAt > now && preferences.find(row => row.id === item.id)?.dismissedAt == null)
    .map(item => ({ ...item, read: preferences.find(row => row.id === item.id)?.readAt != null }));
  return { items, unread: items.filter(item => !item.read).length };
}
