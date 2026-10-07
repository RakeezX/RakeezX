import { todayISO, isTeachingDay } from '../models.js';

const SKEW_MS = 50;
const CANCELLED = new Set(['cancelled', 'cancelled_holiday']);

/** The next local wall-clock boundary; midnight also refreshes a day with no sessions. */
export function nextSessionBoundary(now, sessions = [], calendarDay = null) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  let next = midnight;
  if (calendarDay && !isTeachingDay(calendarDay.kind)) return next;
  for (const session of sessions) {
    if (CANCELLED.has(session.status)) continue;
    for (const value of [session.startTime, session.endTime]) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ''));
      if (!match) continue;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour > 23 || minute > 59) continue;
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).getTime();
      if (at > now.getTime() && at < next) next = at;
    }
  }
  return next;
}

/** One local timer; foreground and store changes repair timers throttled in the background. */
export function installSessionAutoTriggers({
  materialize, repaint = () => {}, getSessions = () => [], getCalendarDay = () => null,
  subscribe = () => () => {}, getToday = todayISO, now = () => new Date(),
  timers = globalThis, onError = () => {}, eventTarget = globalThis,
  documentTarget = globalThis.document,
} = {}) {
  if (typeof materialize !== 'function') throw new Error('Session materializer is required');
  let timer = null;
  let stopped = false;
  const controller = new AbortController();

  const schedule = () => {
    if (stopped) return;
    if (timer !== null) timers.clearTimeout(timer);
    const current = now();
    const today = getToday(current);
    const at = nextSessionBoundary(current, getSessions(today), getCalendarDay(today));
    timer = timers.setTimeout(() => {
      timer = null;
      void run();
    }, Math.max(1, at - current.getTime() + SKEW_MS));
  };
  const run = async () => {
    if (stopped) return;
    try { await materialize(getToday(now()), controller.signal); }
    catch (err) { if (!stopped) onError(err); }
    if (stopped) return;
    repaint();
    schedule();
  };
  const onPageShow = () => { void run(); };
  const onVisibility = () => {
    if (documentTarget?.visibilityState === 'visible') void run();
  };
  const unsubscribe = subscribe(schedule);
  eventTarget?.addEventListener?.('pageshow', onPageShow);
  documentTarget?.addEventListener?.('visibilitychange', onVisibility);
  schedule();
  return () => {
    stopped = true;
    controller.abort();
    if (timer !== null) timers.clearTimeout(timer);
    unsubscribe?.();
    eventTarget?.removeEventListener?.('pageshow', onPageShow);
    documentTarget?.removeEventListener?.('visibilitychange', onVisibility);
  };
}
