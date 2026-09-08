import { todayISO } from '../models.js';

/** Foreground-only trigger wiring; intentionally no timer or polling loop. */
export function installSessionAutoTriggers({ materialize, getToday = todayISO, onError = () => {}, eventTarget = globalThis, documentTarget = globalThis.document } = {}) {
  if (typeof materialize !== 'function') throw new Error('Session materializer is required');
  const run = () => Promise.resolve(materialize(getToday())).catch(onError);
  const onPageShow = () => { run(); };
  const onVisibility = () => {
    if (documentTarget?.visibilityState === 'visible') run();
  };
  eventTarget?.addEventListener?.('pageshow', onPageShow);
  documentTarget?.addEventListener?.('visibilitychange', onVisibility);
  return () => {
    eventTarget?.removeEventListener?.('pageshow', onPageShow);
    documentTarget?.removeEventListener?.('visibilitychange', onVisibility);
  };
}
