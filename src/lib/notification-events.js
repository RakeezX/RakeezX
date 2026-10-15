/** Read-only adapter. No record generation, cloud calls, scores or student reads. */
import { readNotificationTiming } from './notification-state.js';
import { todayISO, shiftDate } from '../models.js';
import { normalizeSubitemDatesAndPoints } from './score-foundation.js';
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { notificationScope, validEventId, MAX_NOTIFICATIONS } from './notification-center.js';

export function currentNotificationContext(store, cloud, storage) {
  const workspace = store.getActiveWorkspace();
  if (!store.state.ready || workspace?.type !== 'account' || workspace.ownershipState !== 'claimed' ||
    !cloud.session || !cloud.user || workspace.authUserId !== cloud.user.id || cloud.authStatus().state !== 'authenticated') return null;
  try {
    storage ??= globalThis.localStorage;
    const auth = JSON.parse(storage.getItem(cloud.AUTH_STORAGE_KEY) || 'null');
    if (!auth?.access_token || auth.user?.id !== workspace.authUserId) return null;
  } catch { return null; }
  const guardWorkspace = runtimeSyncOwnershipGuard.getWorkspace();
  if (guardWorkspace.databaseName !== workspace.databaseName ||
    !runtimeSyncOwnershipGuard.cloudAccess({ operation: 'read', authenticatedUserId: cloud.user.id }).allowed) return null;
  const context = { mode: 'account', verified: true, ownerId: workspace.authUserId,
    workspaceId: workspace.databaseName, deviceId: store.state.device?.deviceId };
  return notificationScope(context) ? context : null;
}
// Legacy/local rows may omit owner metadata only inside the verified mounted owner DB.
const owned = (row, context) => row && !row.deleted && (row.ownerId == null || row.ownerId === context.ownerId);
const eventId = (kind, id, date) => `${kind}:${encodeURIComponent(id)}:${date}`;
const wallTime = (date, time) => {
  if (!/^\d{2}:\d{2}$/.test(String(time)) || Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59) return NaN;
  return new Date(`${date}T${time}:00`).getTime();
};
function currentTeaching(store, context, id, today) {
  const teaching = store.getTeaching(id), term = store.getTerm(teaching?.termId), year = store.getYear(term?.yearId);
  const section = store.getSection(teaching?.sectionId), subject = store.getSubject(teaching?.subjectId);
  if (![teaching, term, year, section, subject].every(row => owned(row, context)) ||
    store.isTeachingArchived(teaching) || store.isTermClosed(term.id) || section.yearId !== year.id ||
    !term.startDate || !term.endDate || today < term.startDate || today > term.endDate) return null;
  return { teaching, term, year };
}
export function currentNotificationEvents(store, context, now = Date.now()) {
  const scope = notificationScope(context);
  if (!scope || !store.state.ready || store.getActiveWorkspace()?.databaseName !== context.workspaceId ||
    store.getActiveWorkspace()?.authUserId !== context.ownerId || !Number.isFinite(now)) return [];
  const timing = readNotificationTiming(context);
  const today = todayISO(new Date(now)), events = [], contexts = new Map();
  if (today < timing.observedDate) return [];
  for (const teaching of store.state.teachings) {
    const value = currentTeaching(store, context, teaching.id, today);
    if (value) contexts.set(teaching.id, value);
  }
  for (const lessonDate of [today, shiftDate(today, 1)]) {
    for (const session of store.sessionsOn(lessonDate)) {
      const value = currentTeaching(store, context, session.teachingId, lessonDate);
      if (!value || !owned(session, context) || !store.isSessionEligibleDate(lessonDate, value) ||
        ['cancelled', 'cancelled_holiday'].includes(session.status)) continue;
      const start = wallTime(lessonDate, session.startTime), end = wallTime(lessonDate, session.endTime);
      if (!(end > start && start - now <= timing.lessonMinutes * 60000 && now < end)) continue;
      events.push({ id: eventId('lesson', session.id, `${lessonDate}:${session.startTime}:${session.endTime}`), scope,
        kind: 'lesson', expiresAt: end, at: start, teachingId: session.teachingId, targetId: session.id,
        title: now >= start ? 'حصتك الحالية' : 'حصة تبدأ قريبًا',
        body: `${store.teachingLabel(value.teaching)} · ${session.startTime}–${session.endTime}`, action: 'عرض الحصة' });
    }
  }
  for (const item of store.state.items) {
    const value = contexts.get(item.teachingId);
    if (!value || !owned(item, context) || item.scoreMode !== 'subitems') continue;
    for (const subitem of store.scoreSubitemsOf(item.id)) {
      if (!owned(subitem, context)) continue;
      let dates;
      try { dates = normalizeSubitemDatesAndPoints(subitem); } catch { continue; }
      const due = dates.dueDate;
      if (!timing.dueDays.some(day => due === shiftDate(today, day)) || !due || due < today || due > shiftDate(today, 3) || due < value.term.startDate || due > value.term.endDate ||
        dates.startDate && dates.startDate > today) continue;
      const expiresAt = new Date(`${shiftDate(today, 1)}T00:00:00`).getTime();
      events.push({ id: eventId('due', subitem.id, `${due}:${today}`), scope, kind: 'due', at: expiresAt, expiresAt,
        teachingId: item.teachingId, targetId: subitem.id, itemId: item.id,
        title: due === today ? 'تسليم اليوم' : 'تسليم قريب',
        body: `${subitem.name || item.name} · ${store.teachingLabel(value.teaching)} · ${due}`, action: 'عرض البنود' });
    }
  }
  return events.filter(event => validEventId(event.id)).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).slice(0, MAX_NOTIFICATIONS);
}
/** Re-derive at click time: stale DOM cannot navigate to deleted/foreign targets. */
export function notificationDestination(store, context, id, now) {
  const event = currentNotificationEvents(store, context, now).find(event => event.id === id);
  if (!event) return null;
  const teaching = encodeURIComponent(event.teachingId);
  return event.kind === 'lesson' ? `/teaching/${teaching}/attendance?session=${encodeURIComponent(event.targetId)}` : `/teaching/${teaching}/items`;
}
