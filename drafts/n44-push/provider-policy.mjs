/** INACTIVE. Recognized is not approved: every host still needs explicit config. */
import { p256 } from '@noble/curves/nist.js';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { validateSubscription } from './registration.mjs';
import { WNS_WEBPUSH_ORIGIN, isWnsWebPushEndpoint } from './shared.mjs';

// Reviewed standard Web Push services, not generic user-controlled endpoints.
// Config must explicitly opt in to each origin, in addition to this fixed policy.
// FCM (Chromium), Mozilla Autopush (Firefox), Apple web.push (Safari/iOS PWA).
// https://mozilla-services.github.io/autopush-rs/
// https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
// Keep HTTPS, path and DNS/TLS pinning guards; never accept arbitrary origins.
const policies = new Map([
  ['https://fcm.googleapis.com', /^\/(?:wp|fcm\/send)\/[A-Za-z0-9_:-]{1,1900}$/],
  ['https://updates.push.services.mozilla.com', /^\/wpush\/v[12]\/[A-Za-z0-9_-]{1,1900}$/],
  ['https://web.push.apple.com', /^\/[A-Za-z0-9_-]{1,1900}$/],
]);
const fail = () => { throw Error('n44_crypto_unavailable'); };
export function approvedProviderOrigins(origins = []) {
  if (!Array.isArray(origins) || origins.some(s => s !== WNS_WEBPUSH_ORIGIN && !policies.has(s)) || new Set(origins).size !== origins.length) fail();
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
  // Deno 2.2 has no ECDH.convertKey and native invalid-point ECDH panics.
  // Pinned audited noble validator checks field bounds, curve equation and
  // subgroup/infinity before any native sender ECDH. No custom curve parser.
  const parsed=p256.Point.fromHex(point);parsed.assertValidity();
  if(!Buffer.from(parsed.toBytes(false)).equals(point))fail();
  return point;
}
export function trustedSubscription(raw, origins) {
  const sub = validateSubscription(raw, origins);
  if (!sub) fail();
  const u = new URL(sub.endpoint);
  if (isWnsWebPushEndpoint(u)) {
    if (!origins.includes(WNS_WEBPUSH_ORIGIN)) fail();
  } else if (u.search || !policies.get(u.origin)?.test(u.pathname)) fail();
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
