/** Inactive N44 preparation. No sender, persistence, timers or browser globals. */
import { validEventId, MAX_EVENT_AGE_MS, MAX_NOTIFICATIONS } from './notification-center.js';

// Exactly the existing notificationDestination route shapes, without URL decoding
// ambiguities, redirects, fragments, credentials or arbitrary query parameters.
export function safePushAction(value) {
  if (typeof value !== 'string' || value.length > 800) return null;
  const match = /^\/teaching\/([^/?#]+)\/(items|attendance\?session=([^/?#]+))$/.exec(value);
  if (!match) return null;
  for (const segment of [match[1], match[3]].filter(Boolean)) {
    try {
      const decoded = decodeURIComponent(segment);
      if (!decoded || decoded.length > 180 || /[\s/\\?#%\u0000-\u001f\u007f]/u.test(decoded) ||
        ['.', '..'].includes(decoded) || encodeURIComponent(decoded) !== segment) return null;
    } catch { return null; }
  }
  return value;
}

export function normalizePushPayload(value, now) {
  if (!Number.isFinite(now) || !value || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const keys = ['id', 'kind', 'expiresAt', 'actionPath'];
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(key =>
    !Object.getOwnPropertyDescriptor(value, key)?.enumerable ||
    !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) return null;
  const { id, kind, expiresAt, actionPath } = value;
  if (!validEventId(id) || !['lesson', 'due'].includes(kind) ||
    !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + MAX_EVENT_AGE_MS ||
    !safePushAction(actionPath) || (kind === 'lesson') !== actionPath.includes('/attendance?session=')) return null;
  return Object.freeze({ id, kind, expiresAt, actionPath });
}

/** Memory-only reservation ledger. Saturation fails closed, never evicts live IDs.
 * Claim before attempting delivery; retries of an uncertain result stay suppressed.
 * Server durable idempotency is still required across restarts/devices. */
export function createPushDedupe() {
  const seen = new Map();
  let highWater = -Infinity;
  return Object.freeze({
    claim(scope, payload, now) {
      if (typeof scope !== 'string' || !scope || scope.length > 1800 || !Number.isFinite(now)) return 'invalid';
      highWater = Math.max(highWater, now);
      const event = normalizePushPayload(payload, highWater);
      if (!event) return 'invalid';
      for (const [key, expiry] of seen) if (expiry <= highWater) seen.delete(key);
      const key = JSON.stringify([scope, event.id]);
      if (seen.has(key)) return 'duplicate';
      if (seen.size >= MAX_NOTIFICATIONS) return 'capacity';
      seen.set(key, event.expiresAt);
      return 'claimed';
    },
  });
}

// Public, noncredential device binding. Inner event allowlist stays unchanged.
export function normalizePushEnvelope(value, now) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).sort().join(',') !== 'binding,event,expiresAt,v' || value.v !== 1 ||
    typeof value.binding !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.binding) ||
    !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + 30 * 86400000) return null;
  const event = normalizePushPayload(value.event, now);
  return event ? Object.freeze({ v: 1, binding: value.binding, expiresAt: value.expiresAt, event }) : null;
}
