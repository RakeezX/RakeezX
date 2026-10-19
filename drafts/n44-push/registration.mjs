import { LIMITS, result, id, uuid, record, principal, current, rate } from './shared.mjs';
import { runtimeFailure } from './runtime-failure.mjs';

// No provider origins are supplied by this package. Configuration is a later gate.
export function validateSubscription(raw, approvedOrigins = []) {
  if (!record(raw, ['endpoint', 'keys']) || !record(raw.keys, ['p256dh', 'auth']) ||
      typeof raw.endpoint !== 'string' || raw.endpoint.length > 2048 ||
      typeof raw.keys.p256dh !== 'string' || typeof raw.keys.auth !== 'string' ||
      !/^B[A-P][A-Za-z0-9_-]{85}$/.test(raw.keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(raw.keys.auth)) return null;
  // Canonical unpadded base64url: a 65-byte uncompressed P-256 public point and
  // a 16-byte auth secret. Curve validation belongs to the audited crypto port.
  if (!raw.keys.p256dh.startsWith('B') || !/[AEIMQUYcgkosw048]$/.test(raw.keys.p256dh) ||
      !/[AQgw]$/.test(raw.keys.auth)) return null;
  try {
    const url = new URL(raw.endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        url.port || url.href !== raw.endpoint || !url.pathname.startsWith('/') ||
        !/^[a-z][a-z0-9.-]*\.[a-z]{2,}$/.test(url.hostname) ||
        !approvedOrigins.includes(url.origin)) return null;
    return Object.freeze({ endpoint: url.href, keys: Object.freeze({ ...raw.keys }) });
  } catch { return null; }
}

/** verifySession authenticates the opaque transport; body labels never authenticate.
 * protect validates curve material, seals secrets and HMACs endpoint server-side.
 * repository.atomic commits before resolving; no memory fallback is supplied. */
export function createRegistrationBoundary({ verifySession, repository, protect, clock,
  approvedOrigins = [], receipt = false, failureProjection = false,
  admitRegistration = () => true }) {
  const origins = Object.freeze([...approvedOrigins]);
  return Object.freeze({
    async register(transport, body) {
      let phase = 'registration_input';
      try {
        if (!record(body, ['registrationId', 'workspaceId', 'deviceId', 'sessionRevision', 'consent', 'subscription']) ||
            !uuid(body.registrationId) || ![body.workspaceId, body.deviceId, body.sessionRevision].every(id) ||
            !record(body.consent, ['revision', 'push']) || body.consent.push !== true || !id(body.consent.revision)) return result('rejected');
        const sub = validateSubscription(body.subscription, origins);
        if (!sub) return result('rejected');
        // Snapshot before asynchronous work: a caller cannot swap validated fields.
        body = structuredClone(body);
        phase = 'registration_auth';
        const auth = await verifySession(transport);
        if (!principal(auth, clock()) || auth.sessionRevision !== body.sessionRevision) return result('rejected');
        phase = 'registration_protect';
        const secret = await protect(sub);
        if (!secret || typeof secret.sealed !== 'string' || secret.sealed.length < 1 || secret.sealed.length > 8192 ||
            !/^[a-f0-9]{64}$/.test(secret.fingerprint) || !/^[a-f0-9]{64}$/.test(secret.bindingFingerprint)) return result('rejected');
        phase = 'registration_repository';
        return await repository.atomic(auth.ownerId, tx => {
          const now = tx.time(clock());
          const ctx = tx.context(body.workspaceId, body.deviceId);
          if (!principal(auth, now) || !current(ctx, auth, now) || ctx.consentRevision !== body.consent.revision ||
              ctx.pushConsent !== true) return result('rejected');
          // Trusted host scope check shares THIS locked owner snapshot. Only a
          // synchronous true admits; no second read or pre-commit ACK is needed.
          if (admitRegistration(tx, auth, body) !== true) return result('disabled');
          const previous = tx.get('registrations', body.registrationId);
          const acknowledged = r => receipt ? Object.freeze({status:'registered',registrationId:r.registrationId,expiresAt:r.expiresAt}) : result('registered');
          if (previous) return previous.state === 'active' && previous.expiresAt > now &&
            previous.workspaceId === body.workspaceId && previous.deviceId === body.deviceId &&
            previous.sessionId === auth.sessionId && previous.sessionRevision === auth.sessionRevision &&
            previous.consentRevision === ctx.consentRevision && previous.fingerprint === secret.fingerprint &&
            previous.bindingFingerprint === secret.bindingFingerprint ? acknowledged(previous) : result('rejected');
          const live = tx.rows('registrations').filter(r => r.state === 'active' && r.expiresAt > now);
          if (live.length >= LIMITS.devices || live.some(r => r.deviceId === body.deviceId && r.workspaceId === body.workspaceId) ||
              !rate(tx, 'register', now, 3600_000, LIMITS.registrationWritesPerHour)) return result('limited');
          // Must also enforce a GLOBAL unique endpoint fingerprint across owners.
          if (!tx.claimEndpoint(secret.fingerprint, body.registrationId)) return result('rejected');
          tx.set('registrations', body.registrationId, { registrationId: body.registrationId,
            workspaceId: body.workspaceId, deviceId: body.deviceId, sessionId: auth.sessionId,
            sessionRevision: auth.sessionRevision, consentRevision: ctx.consentRevision,
            state: 'active', expiresAt: Math.min(now + LIMITS.registrationMs, ctx.sessionExpiresAt, auth.backgroundExpiresAt ?? auth.expiresAt),
            fingerprint: secret.fingerprint, bindingFingerprint: secret.bindingFingerprint, sealed: secret.sealed });
          return acknowledged(tx.get('registrations', body.registrationId));
        });
      } catch (error) {
        // Only the trusted HTTP composition opts in. Fixed phases traverse its
        // existing private response envelope; never copy/log the caught error.
        if (failureProjection === true) throw runtimeFailure(phase, error);
        return result('unavailable');
      }
    },
    async revoke(transport, body) {
      try {
        if (!record(body, ['registrationId', 'workspaceId', 'deviceId']) ||
            !uuid(body.registrationId) || ![body.workspaceId, body.deviceId].every(id)) return result('rejected');
        body = structuredClone(body);
        const auth = await verifySession(transport);
        if (!principal(auth, clock())) return result('rejected');
        return await repository.atomic(auth.ownerId, tx => {
          const now = tx.time(clock());
          if (!principal(auth, now)) return result('rejected');
          const r = tx.get('registrations', body.registrationId);
          // Idempotent generic absence; no foreign existence oracle. New sessions
          // cannot remove a different original registration after A -> B -> A.
          if (!r) return result('revoked');
          if (r.workspaceId !== body.workspaceId || r.deviceId !== body.deviceId ||
              r.sessionId !== auth.sessionId || r.sessionRevision !== auth.sessionRevision) return result('rejected');
          if (r.state !== 'active') return result('revoked');
          tx.releaseEndpoint(r.fingerprint, r.registrationId);
          tx.set('registrations', r.registrationId, { ...r, state: 'revoked', sealed: null, fingerprint: null, bindingFingerprint: null });
          for (const job of tx.rows('deliveries')) if (job.registrationId === r.registrationId &&
              !['sent', 'uncertain', 'dead'].includes(job.state)) tx.set('deliveries', job.key,
                { ...job, state: job.state === 'sending' ? 'uncertain' : 'suppressed' });
          return result('revoked');
        });
      } catch { return result('unavailable'); }
    },
  });
}
