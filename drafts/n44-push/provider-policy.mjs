/** INACTIVE. Recognized is not approved: every host still needs explicit config. */
import { ECDH } from 'node:crypto';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { validateSubscription } from './registration.mjs';

// Chromium's current Web Push endpoint and its documented previous path.
// https://chromium.googlesource.com/chromium/src/+/40644b8cf2b03be542976e7d1192c653e389c14e%5E%21/
// https://web.dev/articles/codelab-notifications-push-server
// Deliberately no generic HTTPS/wildcard/provider inferred from a subscription.
const policies = new Map([
  ['https://fcm.googleapis.com', /^\/(?:wp|fcm\/send)\/[A-Za-z0-9_:-]{1,1900}$/],
]);
const fail = () => { throw Error('n44_crypto_unavailable'); };
export function approvedProviderOrigins(origins = []) {
  if (!Array.isArray(origins) || origins.some(s => !policies.has(s)) || new Set(origins).size !== origins.length) fail();
  return Object.freeze([...origins]);
}
export function decode64(s, length) {
  if (typeof s !== 'string' || s.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(s)) fail();
  const b = Buffer.from(s, 'base64url');
  if (b.toString('base64url') !== s || (length !== undefined && b.length !== length)) fail();
  return b;
}
export function validatePoint(s) {
  const point = decode64(s, 65);
  if (point[0] !== 4) fail();
  // OpenSSL validates the actual curve point, not just its encoding/length.
  if (!ECDH.convertKey(point, 'prime256v1', undefined, undefined, 'uncompressed').equals(point)) fail();
  return point;
}
export function trustedSubscription(raw, origins) {
  const sub = validateSubscription(raw, origins);
  if (!sub) fail();
  const u = new URL(sub.endpoint);
  if (u.search || !policies.get(u.origin)?.test(u.pathname)) fail();
  validatePoint(sub.keys.p256dh); decode64(sub.keys.auth, 16);
  return sub;
}
export function publicAddress(address, family) {
  try {
    if (typeof address !== 'string' || isIP(address) !== family || ![4, 6].includes(family) || address.includes('%') ||
        address==='168.63.129.16') return false; // Azure host/platform virtual IP.
    const ip = ipaddr.parse(address);
    if (ip.range() !== 'unicast') return false;
    // Unallocated IPv6 space must not become a permissive "unicast" fallback.
    return family === 4 || ip.match(ipaddr.parseCIDR('2000::/3'));
  } catch { return false; }
}
