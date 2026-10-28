/** AI: prospective, UNINSTALLED two-device contract. No authority is shipped.
 * Host-only inputs; never obtain these pins from an HTTP request or browser store.
 * Reuses the existing registration/delivery transactions and committed permits.
 */
import { createHash } from 'node:crypto';
import { id, uuid, record, principal, current } from './shared.mjs';
import { normalizePushPayload } from '../../src/lib/notification-push-core.js';
import { createRegistrationBoundary } from './registration.mjs';
import { createDeliveryBoundary } from './delivery.mjs';
import { consumeCommittedPermit } from './committed-permit.mjs';
import { DEVICE_CAPABILITY } from './one-device-test.mjs';

const DAY = 86400000;
const PLATFORMS = ['android', 'ios-homescreen'];
const sha = (value, size) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
const equalTarget = (a, b) => ['id', 'kind', 'expiresAt', 'actionPath'].every(k => a?.[k] === b?.[k]);
const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && Object.getPrototypeOf(item) === Object.prototype
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
export const mobileGrantDigest = value => createHash('sha256').update(canonical(value)).digest('hex');

// PROPOSED ceilings, not an approval, selected window, identity or allocation.
export function inactiveMobileTemplate() {
  return { v: 1, kind: 'n44-mobile-pilot-v1', enabled: false,
    grantId: null, reviewSha256: null, ownerId: null, workspaceId: null,
    serviceSourceSha: null, policyApprovalId: null, startsAt: null, expiresAt: null,
    maxRegistrations: 2, maxProviderAttempts: 2,
    devices: PLATFORMS.map(platform => ({ platform, deviceId: null,
      registrationId: null, target: null, maxRegistrations: 1, maxProviderAttempts: 1 })) };
}

function shape(g) {
  return record(g, Object.keys(inactiveMobileTemplate())) && g.v === 1 &&
    g.kind === 'n44-mobile-pilot-v1' && g.enabled === true && uuid(g.grantId) &&
    sha(g.reviewSha256, 64) && [g.ownerId, g.workspaceId].every(id) &&
    sha(g.serviceSourceSha, 40) && sha(g.policyApprovalId, 64) &&
    Number.isSafeInteger(g.startsAt) && g.startsAt > 0 && Number.isSafeInteger(g.expiresAt) &&
    g.expiresAt > g.startsAt && g.expiresAt - g.startsAt <= 2 * 3600000 &&
    g.maxRegistrations === 2 && g.maxProviderAttempts === 2 &&
    Array.isArray(g.devices) && g.devices.length === 2 && g.devices.every((d, i) =>
      record(d, ['platform', 'deviceId', 'registrationId', 'target', 'maxRegistrations', 'maxProviderAttempts']) &&
      d.platform === PLATFORMS[i] && id(d.deviceId) && d.registrationId === null &&
      d.maxRegistrations === 1 && d.maxProviderAttempts === 1 &&
      record(d.target, ['id', 'kind', 'expiresAt', 'actionPath']) &&
      equalTarget(normalizePushPayload(d.target, g.startsAt), d.target)) &&
    g.devices[0].deviceId !== g.devices[1].deviceId;
}

/** All arguments are private host configuration. Default is disabled. The
 * digest pins the COMPLETE operative descriptor, not just the proposed caps.
 * The host also fences its outer Auth transaction and source transaction.
 */
export function createMobileTrialPreparation({ trustedGrant = null, expectedGrantSha256 = null,
  serviceSourceSha = null, policyApprovalId = null } = {}) {
  let grant = null;
  try {
    if (shape(trustedGrant) && sha(expectedGrantSha256, 64) &&
        mobileGrantDigest(trustedGrant) === expectedGrantSha256 &&
        trustedGrant.serviceSourceSha === serviceSourceSha && trustedGrant.policyApprovalId === policyApprovalId)
      grant = structuredClone(trustedGrant);
  } catch { /* Missing or malformed trusted configuration fails closed. */ }
  const active = now => !!grant && Number.isSafeInteger(now) && now >= grant.startsAt && now < grant.expiresAt;
  // Stable grant identity, never a run ID, date bucket, event or mutable digest.
  // A later digest for the SAME grant cannot replenish an existing slot.
  const key = (slot, operation) => `day:n44-mobile-v1:${grant.grantId}:${slot}:${operation}`;
  const spent = (tx, slot, operation) => !!tx.get('budgets', key(slot, operation));
  const boundRegistration = (tx, slot) => {
    const matches = tx.rows('registrations').filter(r => r.workspaceId === grant.workspaceId &&
      r.deviceId === grant.devices[slot].deviceId && spent(tx, slot, `binding:${r.registrationId}`));
    return matches.length === 1 ? matches[0] : null;
  };
  const consume = (tx, slot, operation) => {
    if (spent(tx, slot, operation)) return false;
    // Existing SQL codec requires a UTC bucket end. Use HARD-END's bucket,
    // preserving presence across an intervening midnight; active() ends first.
    const bucket = Math.floor((grant.expiresAt - 1) / DAY);
    tx.set('budgets', key(slot, operation), { bucket, count: 1, expiresAt: (bucket + 1) * DAY });
    return true;
  };
  const sequential = (tx, slot, now) => {
    if (slot === 0) return true;
    const first = grant.devices[0], previous = boundRegistration(tx, 0);
    const ctx = tx.context(grant.workspaceId, first.deviceId);
    // Serial ATTEMPTS do not require serial subscriptions. Preserve the first
    // phone's exact active binding while admitting the second named phone.
    const retained = previous?.state === 'active' && previous.expiresAt > now &&
      current(ctx, previous, now) && ctx.pushConsent === true &&
      ctx.consentRevision === previous.consentRevision &&
      previous.sessionRevision.endsWith(`:${grant.policyApprovalId}`) &&
      typeof previous.sealed === 'string' && previous.sealed.length > 0 &&
      sha(previous.fingerprint, 64) && sha(previous.bindingFingerprint, 64);
    const retired = ['revoked', 'dead'].includes(previous?.state) && previous.sealed === null &&
      previous.fingerprint === null && previous.bindingFingerprint === null;
    return spent(tx, 0, 'registration') && spent(tx, 0, 'provider') &&
      previous?.workspaceId === grant.workspaceId && previous.deviceId === first.deviceId &&
      (retained || retired) &&
      !tx.rows('deliveries').some(job => job.registrationId === previous.registrationId &&
        !['sent', 'uncertain', 'dead', 'suppressed'].includes(job.state));
  };
  const slotFor = (owner, scope) => !grant || owner !== grant.ownerId || scope?.workspaceId !== grant.workspaceId
    ? -1 : grant.devices.findIndex(d => d.deviceId === scope.deviceId);
  const boundSession = (auth, now) => principal(auth, now) && auth.sessionRevision.endsWith(`:${grant.policyApprovalId}`);
  const admit = (tx, auth, body, now) => {
    if (!active(now)) return false;
    const slot = slotFor(auth.ownerId, body), ctx = tx.context(body.workspaceId, body.deviceId);
    if (slot < 0 || !uuid(body.registrationId) ||
        !boundSession(auth, now) || !current(ctx, auth, now) || ctx.pushConsent !== true ||
        ctx.consentRevision !== body.consent?.revision || !sequential(tx, slot, now)) return false;
    const existing = tx.get('registrations', body.registrationId);
    // Actual gateway creates its UUID AFTER consent, and uses the SAME UUID on
    // cold restore. Adopt it once in this transaction; never invent one in the
    // grant. An exact idempotent restore remains subject to the original module's
    // session/consent/endpoint/key/expiry checks and creates no new registration.
    if (existing) return spent(tx, slot, 'registration') &&
      spent(tx, slot, `binding:${body.registrationId}`) && existing.state === 'active' &&
      existing.workspaceId === grant.workspaceId && existing.deviceId === body.deviceId;
    if (spent(tx, slot, 'registration') ||
        tx.rows('registrations').some(r => r.workspaceId === grant.workspaceId &&
          r.deviceId === body.deviceId && r.state === 'active')) return false;
    if (!consume(tx, slot, 'registration')) return false;
    return consume(tx, slot, `binding:${body.registrationId}`);
  };
  const beforePermit = (tx, owner, registration, payload, now) => {
    if (!active(now)) return false;
    const slot = slotFor(owner, registration);
    if (slot < 0 || !spent(tx, slot, `binding:${registration.registrationId}`) ||
        !registration.sessionRevision.endsWith(`:${grant.policyApprovalId}`) ||
        !equalTarget(payload, grant.devices[slot].target) ||
        !spent(tx, slot, 'registration') || !sequential(tx, slot, now)) return false;
    return consume(tx, slot, 'provider');
  };
  return Object.freeze({
    configured: grant !== null, // Preparation only; NEVER an installed/physical result.
    ownerId: grant?.ownerId ?? null,
    allowsScope(owner, scope, now) { return active(now) && slotFor(owner, scope) >= 0; },
    assertBeforeCommit(now) { if (!active(now)) throw Error('n44_mobile_authority_unavailable'); },
    // Pure selector inside the existing signed one-device-test schedule branch.
    // It is NOT a signer, dispatcher or HTTP route; caller must retain the
    // existing scheduler authentication/nonce/typed-query/COMMIT protocol.
    targetForOperation(tx, request, now) {
      if (!active(now) || !record(request, ['operation', 'cursor', 'limit']) ||
          request.operation !== 'one-device-test' || request.limit !== 1) return null;
      const slot = PLATFORMS.findIndex(platform => request.cursor === `${grant.grantId}:${platform}`);
      if (slot < 0 || !sequential(tx, slot, now) || spent(tx, slot, 'provider')) return null;
      const r = boundRegistration(tx, slot);
      return r?.state === 'active' && r.expiresAt > now ? { ownerId: grant.ownerId,
        workspaceId: grant.workspaceId, deviceId: r.deviceId, registrationId: r.registrationId,
        eventId: grant.devices[slot].target.id } : null;
    },
    publicConfiguration(tx, auth, scope, publicKey, now) {
      if (!active(now)) return { status: 'disabled' };
      const slot = slotFor(auth?.ownerId, scope);
      // Discovery precedes context/consent setup. It exposes no registration
      // permit; actual admit() still requires the current consent-bound context.
      if (slot < 0 || !boundSession(auth, now) || !sequential(tx, slot, now) ||
          spent(tx, slot, 'registration') && boundRegistration(tx, slot)?.state !== 'active' ||
          !/^B[A-Za-z0-9_-]{86}$/.test(publicKey ?? '')) return { status: 'disabled' };
      return { status: 'ready', protocol: 'n44-browser-v2', capability: DEVICE_CAPABILITY,
        serviceRevision: 'n44-browser-service-v2', serviceSourceSha, publicKey,
        expiresAt: grant.expiresAt, deliveryEnabled: false, schedulerEnabled: false };
    },
    compose({ registrationPorts, deliveryPorts }) {
      // Preserve original session, consent, source, crypto and repository ports;
      // callers cannot override the finite hooks with option ordering.
      const registration = registrationPorts ? createRegistrationBoundary({ ...registrationPorts,
        admitRegistration: (tx, auth, body) => admit(tx, auth, body, tx.time(registrationPorts.clock())) }) : null;
      const sender = deliveryPorts?.sender;
      const delivery = deliveryPorts ? createDeliveryBoundary({ ...deliveryPorts, maxAttempts: 1, envelope: true,
        bindingExpiresAt: grant?.expiresAt ?? 1, beforePermit,
        sender: sender ? { send(permit) {
          // COMMIT might resolve after expiry. Keep the committed debit spent,
          // never start an expired request, never retry its unknown outcome.
          if (!active(deliveryPorts.clock())) { consumeCommittedPermit(permit); return 'uncertain'; }
          return sender.send(permit);
        } } : null }) : null;
      return Object.freeze({ registration, delivery });
    },
  });
}
