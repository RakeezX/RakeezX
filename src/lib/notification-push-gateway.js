/** AI: same-origin private transport. Captured bearer exists only in memory. */
export const N44_PROTOCOL = 'n44-browser-v2';
// The ingress has a bounded12s deadline. Allow its committed response to reach
// this client before aborting;10s could lose a successful consent CAS ACK.
export const N44_RESPONSE_DEADLINE_MS = 15000;
// AI: original runtime-failure enum in native 5319f959 (installed 696f71d0).
// These are coarse source phases, never a claim of cause or native arrival.
export const N44_CONFIG_SERVICE_PHASES = Object.freeze([
  'configuration', 'configuration_origin', 'configuration_revision', 'configuration_policy',
  'configuration_transport', 'configuration_crypto', 'configuration_provider', 'connect',
  'identity', 'set_role', 'private_session', 'source', 'ingress', 'query', 'deadline',
  'registration_input', 'registration_auth', 'registration_protect', 'registration_repository',
]);
// Reuse web-protocol.mjs readBytes algorithm locally: no draft/startup dependency.
async function readConfigFailurePhase(stream, signal) {
  if (!stream) return;
  const reader = stream.getReader(), parts = []; let total = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      if (signal.aborted) return;
      const { done, value } = await reader.read();
      if (signal.aborted) return;
      if (done) break;
      total += value.byteLength;
      if (total > 2048) return;
      parts.push(value);
    }
    const bytes = new Uint8Array(total); let at = 0;
    for (const part of parts) { bytes.set(part, at); at += part.byteLength; }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('unavailable');
      return value;
    });
    if (body && !Array.isArray(body) && Object.getPrototypeOf(body) === Object.prototype &&
        body.error === 'unavailable' && N44_CONFIG_SERVICE_PHASES.includes(body.phase)) return body.phase;
  } catch { /* Optional evidence only; never retain the body or read/decode error. */ }
  finally { signal.removeEventListener('abort', cancel); cancel(); reader.releaseLock(); }
}
export function createPushGateway({ fetch: send = globalThis.fetch, authorization, context, preferences,
  storage = globalThis.localStorage, randomUUID = () => crypto.randomUUID(), valid = () => true, readValid = valid, contextChanged = () => {}, invalidated = () => {}, cleanupAuthorization = () => typeof authorization === 'function' ? authorization() : authorization, bindConsent = async () => false, clearConsent = async () => true }) {
  const scope = { workspaceId: context.workspaceId, deviceId: context.deviceId };
  const sourceStamp = value => value === null || typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const key = 'rakeezx-n44-registration:' + JSON.stringify([context.ownerId, ...Object.values(scope)]);
  let remote = null, expectedRevision = null, receipt = null;
  let uncertainStop = null;
  const preferenceKey = p => JSON.stringify([p?.lesson, p?.due, p?.lessonMinutes, p?.dueDays, p?.timezone, p?.quiet === null ? null : [p?.quiet?.start, p?.quiet?.end]]);
  let cleanupIdentity;
  try { cleanupIdentity = JSON.parse(storage.getItem(key) || 'null'); } catch { cleanupIdentity = 'invalid'; }
  const request = async (path, body, cleanup = false, metadata = false) => {
    // Renewal may read the existing context while ordinary actions remain
    // fenced. It cannot authorize registration, projection or a late click.
    const current = path === 'context/read' ? readValid : valid;
    if (!cleanup && !current()) throw Error('stale');
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), N44_RESPONSE_DEADLINE_MS);
    let phase = 'transport', httpStatus = null, servicePhase;
    try {
      const response = await send('/api/n44/' + path, { method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-n44-csrf': '1', authorization: cleanup ? cleanupAuthorization() : typeof authorization === 'function' ? authorization() : authorization }, body: JSON.stringify(body), signal: abort.signal });
      httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
      phase = !cleanup && !current() ? 'context' : 'http';
      // The sole non-2xx body exception: this owned POST config action, JSON503.
      if (path === 'push/config' && !cleanup && valid() && response.status === 503 &&
          response.headers?.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json') {
        servicePhase = await readConfigFailurePhase(response.body, abort.signal);
      }
      if (!response.ok || (!cleanup && !current())) { const error=Error('unavailable'); error.httpStatus=response.status; error.projectionDisposition=response.status>=400&&response.status<500?'rejected':'unknown'; throw error; }
      phase = 'response_read';
      const raw = await response.text(); phase = !cleanup && !current() ? 'context' : 'response_size';
      if (raw.length > 8192 || !cleanup && !current()) throw Error('unavailable');
      phase = 'decode';
      const value = JSON.parse(raw); return metadata ? { body: value, httpStatus } : value;
    } catch (error) {
      // AI: config-only finite receipt from this attempt; never retain error data.
      if (path === 'push/config') {
        const safe = Error('unavailable');
        safe.configOutcome = { httpStatus, phase: !valid() ? 'context' : abort.signal.aborted ? 'deadline' : phase };
        if (valid() && !abort.signal.aborted && servicePhase) safe.configOutcome.servicePhase = servicePhase;
        throw safe;
      }
      throw error;
    } finally { clearTimeout(timer); }
  };
  return Object.freeze({
    configuration: ({ metadata = false } = {}) => request('push/config', scope, false, metadata),
    async read({ accept = () => true } = {}) {
      try {
        const r = await request('context/read', scope);
        if (r.protocol !== N44_PROTOCOL || !['current', 'absent'].includes(r.status)) throw Error('unavailable');
        const next = r.context ?? null;
        if (!accept(r) || next && (!next.active || next.workspaceId !== scope.workspaceId || next.deviceId !== scope.deviceId || next.sessionExpiresAt <= Date.now())) {
          throw Object.assign(Error('stale'), { readDisposition: 'rejected' });
        }
        remote = next; expectedRevision = remote?.consentRevision ?? r.expectedRevision ?? null;
        receipt = r.registration ?? null; contextChanged(remote); return r;
      } catch (error) {
        // A lost/503 read is not proof of revocation. Return only a fixed local
        // classification; the caller must still fence all unconfirmed actions.
        const safe = Error('unavailable');
        safe.readDisposition = error.readDisposition === 'rejected' || [401, 403].includes(error.httpStatus) ? 'rejected' : 'unknown';
        throw safe;
      }
    },
    async update(pushConsent, { cleanup = false, selectedPreferences = preferences() } = {}) {
      if (cleanup && !pushConsent && uncertainStop) {
        // A lost stop ACK is UNKNOWN, not permission to replay a context write
        // against a later consent. Read back only the exact committed stop.
        const observed = await request('context/read', scope, true), ctx = observed.context;
        if (observed.protocol !== N44_PROTOCOL || observed.status !== 'current' || observed.registration ||
            !ctx?.active || ctx.workspaceId !== scope.workspaceId || ctx.deviceId !== scope.deviceId ||
            ctx.sessionRevision !== uncertainStop.sessionRevision || ctx.sessionExpiresAt <= Date.now() || !ctx.consentRevision) throw Error('unknown');
        if (ctx.consentRevision !== uncertainStop.expectedRevision) {
          if (ctx.pushConsent !== false || preferenceKey(ctx.preferences) !== preferenceKey(uncertainStop.preferences)) throw Error('unknown');
          remote = ctx; expectedRevision = ctx.consentRevision; contextChanged(remote); uncertainStop = null;
          // Later local edits need a separate explicit cleanup retry.
          if (preferenceKey(ctx.preferences) !== preferenceKey(selectedPreferences)) throw Error('stale');
          return { status: 'updated', context: ctx };
        }
        // No committed revision change: the user's explicit retry keeps the
        // original CAS. A concurrent change is still refused by the server.
        uncertainStop = null;
      }
      const attempted = { sessionRevision: remote?.sessionRevision, expectedRevision, preferences: selectedPreferences };
      try {
        const r = await request('context/update', { ...scope, expectedRevision, preferences: selectedPreferences, pushConsent }, cleanup);
        if (r.status !== 'updated' || r.context?.pushConsent !== pushConsent || !r.context?.consentRevision || r.context.sessionRevision !== remote?.sessionRevision && remote !== null) throw Error('stale');
        remote = r.context; expectedRevision = remote.consentRevision; contextChanged(remote); return r;
      } catch (error) {
        if (cleanup && !pushConsent) uncertainStop = attempted;
        throw error;
      }
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
    async authorizationReceipt(event) {
      if (!valid()) return { status: 'rejected', httpStatus: null, authorizationStatus: null, attempts: 0 };
      try {
        const { body: r, httpStatus } = await request('events/authorize', { ...scope, consentRevision: remote?.consentRevision, registrationId: receipt?.registrationId ?? null, event }, false, true);
        const authorizationStatus = ['authorized', 'rejected', 'disabled', 'expired', 'stale', 'suppressed'].includes(r.status) ? r.status : 'unknown';
        return { status: r.status === 'authorized' && valid() ? 'confirmed'
          : authorizationStatus !== 'authorized' && authorizationStatus !== 'unknown' ? 'rejected' : 'unknown', httpStatus, authorizationStatus, attempts: 1 };
      } catch (error) { return { status: error.projectionDisposition === 'rejected' ? 'rejected' : 'unknown', httpStatus: error.httpStatus ?? null, authorizationStatus: null, attempts: 1 }; }
    },
    async authorizationResult(event) { return (await this.authorizationReceipt(event)).status; },
    async authorizeEvent(_snapshot, event) {
      return await this.authorizationResult(event) === 'confirmed';
    },
    expiresAt: () => Math.min(remote?.sessionExpiresAt ?? 0, receipt?.expiresAt ?? Infinity),
    async project(kind, sourceId, expectedStamp) {
      let r = await request('events/update', { ...scope, kind, sourceId, expectedStamp });
      if (r.status === 'stale' && sourceStamp(r.sourceStamp)) r = await request('events/update', { ...scope, kind, sourceId, expectedStamp: r.sourceStamp });
      if (r.status !== 'updated' || !sourceStamp(r.sourceStamp)) { const error=Error('stale'); error.projectionDisposition=['stale','rejected','disabled'].includes(r.status)?'rejected':'unknown'; throw error; } return r.sourceStamp;
    },
  });
}
