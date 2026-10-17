/** Private server-only envelope using OpenSSL AES-256-GCM and HMAC-SHA256.
 * No env discovery, key generation, persistence, diagnostics or network access. */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { approvedProviderOrigins, decode64, trustedSubscription } from './provider-policy.mjs';
import { record } from './shared.mjs';

const fail = () => { throw Error('n44_crypto_unavailable'); };
const kid = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(s);
const fp = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const same = (a,b) => fp(a) && fp(b) && timingSafeEqual(Buffer.from(a,'hex'), Buffer.from(b,'hex'));
const canonical = (sub,vapidKeyId) => JSON.stringify([vapidKeyId,sub.endpoint,sub.keys.p256dh,sub.keys.auth]);
const aad = e => Buffer.from(JSON.stringify(['n44-subscription',e.v,e.kid,e.hkid,e.vapidKeyId,e.fingerprint,e.bindingFingerprint]));

export function createSubscriptionProtector({ providerOrigins = [], activeKeyId, sealingKeys,
  fingerprintKeyId, endpointHmacKeys, bindingHmacKeys, activeVapidKeyId } = {}) {
  const origins = approvedProviderOrigins(providerOrigins);
  // Copy key bytes: callers cannot silently rotate a running instance by mutation.
  function ring(input) {
    if (!(input instanceof Map) || input.size < 1 || input.size > 8) fail();
    const out = new Map();
    for (const [name, key] of input) {
      if (!kid(name) || !Buffer.isBuffer(key) || key.length !== 32) fail();
      out.set(name, Buffer.from(key));
    }
    return out;
  }
  const seals = ring(sealingKeys), endpoints = ring(endpointHmacKeys), bindings = ring(bindingHmacKeys);
  if (!kid(activeVapidKeyId) || !seals.has(activeKeyId) || !endpoints.has(fingerprintKeyId) || !bindings.has(fingerprintKeyId) ||
      endpoints.size!==bindings.size || [...endpoints.keys()].some(k=>!bindings.has(k))) fail();
  // All three roles use independently provisioned keys, including old read keys.
  for (const [left,right] of [[seals,endpoints],[seals,bindings],[endpoints,bindings]])
    for (const a of left.values()) for (const b of right.values()) if (timingSafeEqual(a,b)) fail();
  let closed = false;
  const check = signal => { if (closed || signal?.aborted || !origins.length) fail(); };
  const fingerprints = (sub, hkid, vapidKeyId) => ({
    fingerprint: createHmac('sha256',endpoints.get(hkid)).update('n44-endpoint\0').update(sub.endpoint).digest('hex'),
    bindingFingerprint: createHmac('sha256',bindings.get(hkid)).update('n44-binding\0').update(canonical(sub,vapidKeyId)).digest('hex'),
  });
  return Object.freeze({
    protect(raw, { signal } = {}) {
      try {
        check(signal); const sub = trustedSubscription(raw, origins);
        const e = {v:1,kid:activeKeyId,hkid:fingerprintKeyId,vapidKeyId:activeVapidKeyId,
          ...fingerprints(sub,fingerprintKeyId,activeVapidKeyId)};
        const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',seals.get(activeKeyId),iv);
        cipher.setAAD(aad(e));
        const plaintext = Buffer.from(JSON.stringify(sub));
        let ciphertext;
        try { ciphertext = Buffer.concat([cipher.update(plaintext),cipher.final()]); }
        finally { plaintext.fill(0); }
        const sealed = JSON.stringify({...e,iv:iv.toString('base64url'),
          ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')});
        check(signal);
        return Object.freeze({sealed,fingerprint:e.fingerprint,bindingFingerprint:e.bindingFingerprint});
      } catch { fail(); }
    },
    // Only the private sender calls open, after consuming a committed capability.
    open(sealed, expected, { signal } = {}) {
      let plaintext;
      try {
        check(signal);
        if (typeof sealed !== 'string' || Buffer.byteLength(sealed)>8192) fail();
        const e = JSON.parse(sealed);
        if (!record(e,['v','kid','hkid','vapidKeyId','fingerprint','bindingFingerprint','iv','ciphertext','tag']) ||
            JSON.stringify(e)!==sealed || e.v!==1 || !kid(e.kid) || !kid(e.hkid) ||
            !kid(e.vapidKeyId) ||
            !seals.has(e.kid) || !endpoints.has(e.hkid) || !bindings.has(e.hkid) || !same(e.fingerprint,expected?.fingerprint) ||
            !same(e.bindingFingerprint,expected?.bindingFingerprint)) fail();
        const decipher = createDecipheriv('aes-256-gcm',seals.get(e.kid),decode64(e.iv,12));
        decipher.setAAD(aad(e)); decipher.setAuthTag(decode64(e.tag,16));
        plaintext = Buffer.concat([decipher.update(decode64(e.ciphertext)),decipher.final()]);
        const sub = trustedSubscription(JSON.parse(plaintext.toString('utf8')),origins);
        const actual = fingerprints(sub,e.hkid,e.vapidKeyId);
        if (!same(actual.fingerprint,e.fingerprint) || !same(actual.bindingFingerprint,e.bindingFingerprint)) fail();
        check(signal); return Object.freeze({subscription:sub,vapidKeyId:e.vapidKeyId});
      } catch { fail(); }
      finally { plaintext?.fill(0); }
    },
    close() { closed=true; for(const ring of [seals,endpoints,bindings]){for(const key of ring.values())key.fill(0);ring.clear();} },
  });
}
