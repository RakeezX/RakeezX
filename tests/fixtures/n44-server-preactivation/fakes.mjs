/** SYNTHETIC serializable-port model, NOT Postgres/hosted RLS certification. */
import { createRegistrationBoundary } from '../../../drafts/n44-push/registration.mjs';
import { createDeliveryBoundary } from '../../../drafts/n44-push/delivery.mjs';
export const RID = '11111111-1111-4111-8111-111111111111';
export const RID2 = '22222222-2222-4222-8222-222222222222';
export const NOW = Date.parse('2026-10-17T09:00:00Z');
export const payload = () => ({ id: 'lesson:session-1:2026-10-17:12:00:13:00', kind: 'lesson',
  expiresAt: NOW + 3600_000, actionPath: '/teaching/teaching-1/attendance?session=session-1' });
export const subscription = () => ({ endpoint: 'https://push.example.test/device-1',
  keys: { p256dh: `BA${'A'.repeat(85)}`, auth: 'A'.repeat(22) } }); // Fake curve, fake protector only.
export function fixture() {
  const f = { now: NOW, sends: [], protects: [], outcome: 'accepted',
    auth: { ownerId: 'owner-A', sessionId: 'session-A', sessionRevision: 'revision-1', expiresAt: NOW + 86400_000 },
    context: { active: true, sessionId: 'session-A', sessionRevision: 'revision-1', sessionExpiresAt: NOW + 86400_000,
      consentRevision: 'consent-1', pushConsent: true, preferences: { lesson: true, due: true,
        lessonMinutes: 15, dueDays: [3, 2, 1, 0], timezone: 'Asia/Riyadh', quiet: null } },
    owners: new Map(), endpoints: new Map(), extraContexts: new Map(), queue: Promise.resolve() };
  f.repository = {
    async atomic(ownerId, work) {
      const previous = f.queue;
      let unlock;
      f.queue = new Promise(resolve => { unlock = resolve; });
      await previous;
      try {
        const state = structuredClone(f.owners.get(ownerId) ?? { highWater: 0, registrations: new Map(),
          deliveries: new Map(), budgets: new Map() });
        const endpoints = structuredClone(f.endpoints);
        const tx = {
          time(now) { if (!Number.isSafeInteger(now)) throw Error('invalid clock'); return state.highWater = Math.max(state.highWater, now); },
          context(workspace, device) { return structuredClone(ownerId === 'owner-A' && workspace === 'workspace-A' && device === 'device-A'
            ? f.context : f.extraContexts.get(JSON.stringify([ownerId, workspace, device])) ?? null); },
          get(table, key) { return structuredClone(state[table].get(key)); },
          set(table, key, row) { state[table].set(key, structuredClone(row)); },
          rows(table) { return structuredClone([...state[table].values()]); },
          entries(table) { return structuredClone([...state[table].entries()]); },
          delete(table, key) { state[table].delete(key); },
          claimEndpoint(fp, rid) {
            const claim = endpoints.get(fp);
            if (claim && (claim.ownerId !== ownerId || claim.rid !== rid)) return false;
            endpoints.set(fp, { ownerId, rid }); return true;
          },
          releaseEndpoint(fp, rid) {
            const claim = endpoints.get(fp);
            if (claim?.ownerId === ownerId && claim.rid === rid) endpoints.delete(fp);
          },
        };
        const value = work(tx);
        if (value?.then) throw Error('async callback forbidden');
        if (f.failCommit) { f.failCommit = false; throw Error('PRIVATE synthetic repository failure'); }
        f.owners.set(ownerId, state); f.endpoints = endpoints;
        if (f.afterCommit) { const hook = f.afterCommit; f.afterCommit = null; hook(); }
        return value;
      } finally { unlock(); }
    },
  };
  f.body = () => ({ registrationId: RID, workspaceId: 'workspace-A', deviceId: 'device-A',
    sessionRevision: 'revision-1', consent: { revision: 'consent-1', push: true }, subscription: subscription() });
  f.verifySession = async transport => transport === 'valid-test-transport' ? structuredClone(f.auth) : null;
  f.protect = async sub => { f.protects.push(sub); if (f.protectHook) await f.protectHook();
    return { sealed: 'PRIVATE-SYNTHETIC-CIPHERTEXT', fingerprint: 'a'.repeat(64),
      bindingFingerprint: sub.keys.auth === 'A'.repeat(22) ? 'b'.repeat(64) : 'c'.repeat(64) }; };
  f.registration = createRegistrationBoundary({ repository: f.repository, verifySession: f.verifySession,
    protect: f.protect, clock: () => f.now, approvedOrigins: ['https://push.example.test'] });
  f.recompute = (_tx, _registration, eventId) => f.eventDeleted || eventId !== payload().id ? null : payload();
  f.sender = { async send(value) { f.sends.push(value); if (f.sendHook) await f.sendHook();
    if (f.throwSend) throw Error('PRIVATE endpoint and payload exception'); return f.outcome; } };
  f.deliveryOptions = { repository: f.repository, clock: () => f.now,
    recompute: (...args) => f.recompute(...args), sender: f.sender };
  f.delivery = createDeliveryBoundary(f.deliveryOptions);
  f.register = () => f.registration.register('valid-test-transport', f.body());
  f.deliver = event => f.delivery.deliver('owner-A', RID, event ?? payload());
  f.revoke = () => f.registration.revoke('valid-test-transport', { registrationId: RID, workspaceId: 'workspace-A', deviceId: 'device-A' });
  f.state = () => f.owners.get('owner-A');
  return f;
}
