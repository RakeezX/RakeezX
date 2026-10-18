/** AI: same-origin private transport. Captured bearer exists only in memory. */
export const N44_PROTOCOL = 'n44-browser-v2';
export function createPushGateway({ fetch: send = globalThis.fetch, authorization, context, preferences,
  storage = globalThis.localStorage, randomUUID = () => crypto.randomUUID(), valid = () => true, contextChanged = () => {}, invalidated = () => {}, cleanupAuthorization = () => authorization, bindConsent = async () => false, clearConsent = async () => true }) {
  const scope = { workspaceId: context.workspaceId, deviceId: context.deviceId };
  const key = 'rakeezx-n44-registration:' + JSON.stringify([context.ownerId, ...Object.values(scope)]);
  let remote = null, expectedRevision = null, receipt = null;
  let cleanupIdentity;
  try { cleanupIdentity = JSON.parse(storage.getItem(key) || 'null'); } catch { cleanupIdentity = 'invalid'; }
  const request = async (path, body, cleanup = false) => {
    if (!cleanup && !valid()) throw Error('stale');
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await send('/api/n44/' + path, { method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-n44-csrf': '1', authorization: cleanup ? cleanupAuthorization() : authorization }, body: JSON.stringify(body), signal: abort.signal });
      if (!response.ok || (!cleanup && !valid())) throw Error('unavailable');
      const raw = await response.text(); if (raw.length > 8192 || !cleanup && !valid()) throw Error('unavailable');
      return JSON.parse(raw);
    } finally { clearTimeout(timer); }
  };
  return Object.freeze({
    async read() {
      const r = await request('context/read', scope);
      if (r.protocol !== N44_PROTOCOL || !['current', 'absent'].includes(r.status)) throw Error('unavailable');
      remote = r.context ?? null; expectedRevision = remote?.consentRevision ?? r.expectedRevision ?? null;
      if (remote && (!remote.active || remote.workspaceId !== scope.workspaceId || remote.deviceId !== scope.deviceId || remote.sessionExpiresAt <= Date.now())) throw Error('stale');
      receipt = r.registration ?? null; contextChanged(remote); return r;
    },
    async update(pushConsent, { cleanup = false, selectedPreferences = preferences() } = {}) {
      const r = await request('context/update', { ...scope, expectedRevision, preferences: selectedPreferences, pushConsent }, cleanup);
      if (r.status !== 'updated' || r.context?.pushConsent !== pushConsent || !r.context?.consentRevision || r.context.sessionRevision !== remote?.sessionRevision && remote !== null) throw Error('stale');
      remote = r.context; expectedRevision = remote.consentRevision; contextChanged(remote); return r;
    },
    async register(_snapshot, subscription) {
      await this.update(true);
      const registrationId = randomUUID();
      // Persist only cleanup identity BEFORE sending: failed/lost ACK is retryable after reload.
      cleanupIdentity = { registrationId, ...scope };
      storage.setItem(key, JSON.stringify(cleanupIdentity));
      const wire = subscription.toJSON();
      const r = await request('push/register', { registrationId, ...scope, sessionRevision: remote.sessionRevision,
        consent: { revision: remote.consentRevision, push: true }, subscription: { endpoint: wire.endpoint, keys: wire.keys } });
      if (r.status !== 'registered' || r.registrationId !== registrationId || !Number.isSafeInteger(r.expiresAt) || r.expiresAt <= Date.now() || r.expiresAt > Date.now()+30*86400000) return false;
      receipt = r;
      if (!valid() || !await bindConsent(r) || !valid()) throw Error('stale');
      return true;
    },
    registration: () => receipt,
    retire() {
      if (cleanupIdentity && typeof cleanupIdentity === 'object') {
        cleanupIdentity = { ...cleanupIdentity, retired: true };
        const saved=JSON.parse(storage.getItem(key)||'null');
        if(saved?.registrationId===cleanupIdentity.registrationId)storage.setItem(key,JSON.stringify(cleanupIdentity));
      }
      return clearConsent(receipt?.registrationId ?? cleanupIdentity?.registrationId);
    },
    async restore(_snapshot, subscription) {
      if (!receipt || !cleanupIdentity || cleanupIdentity.retired || cleanupIdentity.registrationId !== receipt.registrationId || !remote?.pushConsent) return false;
      const wire=subscription.toJSON();
      const r=await request('push/register',{registrationId:receipt.registrationId,...scope,sessionRevision:remote.sessionRevision,
        consent:{revision:remote.consentRevision,push:true},subscription:{endpoint:wire.endpoint,keys:wire.keys}});
      if(r.status!=='registered'||r.registrationId!==receipt.registrationId||r.expiresAt!==receipt.expiresAt||!valid())return false;
      return await bindConsent(r) && valid();
    },
    async remove() {
      const saved = cleanupIdentity;
      if (!saved) return true;
      if (saved.workspaceId !== scope.workspaceId || saved.deviceId !== scope.deviceId || !/^[a-f0-9-]{36}$/.test(saved.registrationId)) return false;
      let cleared = false;
      try { cleared = await clearConsent(saved.registrationId); } catch { /* still attempt original server cleanup */ }
      const r = await request('push/revoke', {registrationId:saved.registrationId,...scope}, true);
      if (r.status !== 'revoked' || !cleared) return false;
      // A concurrent tab may have installed a newer identity. Never erase or
      // revoke that identity while cleaning this original registration.
      if (JSON.parse(storage.getItem(key) || 'null')?.registrationId === saved.registrationId) storage.removeItem(key);
      cleanupIdentity = null; return true;
    },
    async authorizeEvent(_snapshot, event) {
      try {
        const r = await request('events/authorize', { ...scope, consentRevision: remote?.consentRevision, registrationId: receipt?.registrationId ?? null, event });
        if (r.status !== 'authorized') invalidated();
        return r.status === 'authorized';
      } catch { invalidated(); return false; }
    },
    expiresAt: () => Math.min(remote?.sessionExpiresAt ?? 0, receipt?.expiresAt ?? Infinity),
    async project(kind, sourceId, expectedStamp) {
      let r = await request('events/update', { ...scope, kind, sourceId, expectedStamp });
      if (r.status === 'stale' && /^[a-f0-9]{64}$/.test(r.sourceStamp)) r = await request('events/update', { ...scope, kind, sourceId, expectedStamp: r.sourceStamp });
      if (r.status !== 'updated') throw Error('stale'); return r.sourceStamp;
    },
  });
}
