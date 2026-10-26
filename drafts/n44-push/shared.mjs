/** INACTIVE draft. Trusted ports only; no environment, network or browser access. */
export const LIMITS = Object.freeze({ devices: 3, registrationWritesPerHour: 6,
  sendsPerHour: 6, sendsPerDay: 20, ownerSendsPerDay: 40, attempts: 3,
  retryBaseMs: 60_000, uncertainMs: 30_000, registrationMs: 30 * 86400_000,
  receiptMs: 86400_000, jobs: 100 }); // Draft technical defaults, pending gate.
// Config-only opt-in token; it is never sent as a hostname or accepted as a URL.
export const WNS_WEBPUSH_ORIGIN = 'https://*.notify.windows.com';
export const isWnsWebPushEndpoint = url =>
  url?.protocol === 'https:' &&
  /^wns2-[a-z0-9-]{1,70}\.notify\.windows\.com$/.test(url.hostname) &&
  url.pathname === '/' &&
  /^\?[A-Za-z0-9_.~%!$&'()*+,;=:@/?-]{1,1900}$/.test(url.search) &&
  !/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(url.search) &&
  !url.username && !url.password && !url.hash && !url.port;
export const result = status => Object.freeze({ status });
export const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value);
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export function record(value, keys) {
  return value && Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === keys.length && keys.every(key => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d?.enumerable && Object.hasOwn(d, 'value');
    });
}
export function principal(value, now) {
  return value && [value.ownerId, value.sessionId, value.sessionRevision].every(id) &&
    Number.isSafeInteger(value.expiresAt) && value.expiresAt > now;
}
export function current(context, auth, now) {
  return context?.active === true && context.sessionId === auth.sessionId &&
    context.sessionRevision === auth.sessionRevision && context.sessionExpiresAt > now;
}
export const deliveryKey = (workspaceId, deviceId, eventId) => JSON.stringify([workspaceId, deviceId, eventId]);
export function rate(tx, key, now, windowMs, ceiling) {
  const bucket = Math.floor(now / windowMs);
  const row = tx.get('budgets', key);
  const count = row?.bucket === bucket ? row.count : 0;
  if (count >= ceiling) return false;
  tx.set('budgets', key, { bucket, count: count + 1, expiresAt: (bucket + 1) * windowMs });
  return true;
}
