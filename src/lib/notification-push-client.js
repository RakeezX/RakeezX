/** INACTIVE dependency-injected lifecycle, deliberately unimported by the app.
 * getVerifiedContext must use the real ownership guard, with a changing authRevision.
 * gateway is a future independently authenticated/authorized server boundary;
 * a caller's verified:true/owner label is NEVER server authorization.
 * Only synthetic implementations are exercised today. No subscription is returned.
 */
import { notificationScope } from './notification-center.js';
import { normalizePushPayload } from './notification-push-core.js';

export function createPushClient({ browser, gateway, getVerifiedContext, clock, resolveAction, diagnostic = () => {} }) {
  let epoch = 0, busy = false, active = null;
  const pending = new Set();
  const report = status => {
    // Fixed codes only: never include exceptions, context, endpoint or key material.
    try { diagnostic(status); } catch { /* diagnostics cannot change lifecycle */ }
    return Object.freeze({ status });
  };
  function context() {
    const value = getVerifiedContext();
    const scope = notificationScope(value);
    return scope && typeof value.authRevision === 'string' && value.authRevision.length > 0 && value.authRevision.length <= 180
      ? Object.freeze({ mode: 'account', verified: true, ownerId: value.ownerId,
        workspaceId: value.workspaceId, deviceId: value.deviceId, authRevision: value.authRevision }) : null;
  }
  const same = (a, b) => a && b && notificationScope(a) === notificationScope(b) && a.authRevision === b.authRevision;
  const current = (snapshot, token) => token === epoch && same(snapshot, context());
  async function clean(record) {
    // Keep failed cleanup private and retryable; removal must be bound to the
    // original authenticated registration, never the newly selected owner.
    let ok = true;
    if (record.registerAttempted && !record.remoteRemoved) {
      try { record.remoteRemoved = await gateway.remove(record.context, record.subscription) === true;
        if (!record.remoteRemoved) ok = false; }
      catch { ok = false; }
    }
    if (!record.localRemoved) {
      try { record.localRemoved = await record.subscription.unsubscribe() === true;
        if (!record.localRemoved) ok = false; }
      catch { ok = false; }
    }
    if (ok) pending.delete(record); else pending.add(record);
    return ok;
  }
  async function revoke() {
    ++epoch; // invalidate pending consent/subscription/action work immediately
    if (active) pending.add(active);
    active = null;
    const results = await Promise.all([...pending].map(clean));
    return report(results.every(Boolean) ? 'revoked' : 'cleanup_pending');
  }
  return Object.freeze({
    // Caller MUST invoke on logout, context switch, permission revocation and
    // before replacing the ownership guard; await cleanup before later opt-in.
    revoke,
    async optIn() {
      if (busy) return report('busy');
      busy = true;
      let record;
      try {
        if (!browser.supported()) return report('unsupported');
        if (!browser.hasUserActivation()) return report('gesture_required');
        const snapshot = context(), token = epoch;
        if (!snapshot) return report('unverified');
        if (pending.size) return report('cleanup_pending');
        if (active && !same(active.context, snapshot)) {
          const result = await revoke();
          return result.status === 'revoked' ? report('stale_context') : result;
        }
        if (active) {
          if (browser.permission() === 'granted') return report('subscribed');
          return await revoke();
        }
        const permission = await browser.requestPermission();
        if (!current(snapshot, token)) return report('stale_context');
        if (permission !== 'granted') return report(permission === 'denied' ? 'denied' : 'unsubscribed');
        const subscription = await browser.subscribe();
        if (!subscription || typeof subscription.unsubscribe !== 'function') return report('unsubscribed');
        record = { subscription, context: snapshot, registerAttempted: false };
        if (!current(snapshot, token)) {
          return report(await clean(record) ? 'stale_context' : 'cleanup_pending');
        }
        if (browser.permission() !== 'granted') return report(await clean(record) ? 'revoked' : 'cleanup_pending');
        record.registerAttempted = true;
        const accepted = await gateway.register(snapshot, subscription);
        if (!current(snapshot, token) || accepted !== true || browser.permission() !== 'granted') {
          const status = !current(snapshot, token) ? 'stale_context'
            : browser.permission() !== 'granted' ? 'revoked' : 'registration_rejected';
          return report(await clean(record) ? status : 'cleanup_pending');
        }
        active = record;
        return report('subscribed');
      } catch {
        return report(record && !await clean(record) ? 'cleanup_pending' : 'unavailable');
      } finally { busy = false; }
    },
    async applyAction(raw) {
      try {
        const snapshot = context(), token = epoch;
        const event = normalizePushPayload(raw, clock());
        if (!snapshot || !event) return report('action_rejected');
        if (await gateway.authorizeEvent(snapshot, event) !== true || !current(snapshot, token)) return report('action_rejected');
        // Re-derive eligibility, ownership and deleted-parent/child safety from
        // the current store using notificationDestination at future integration.
        const destination = resolveAction(snapshot, event.id, clock());
        if (!current(snapshot, token) || !normalizePushPayload(event, clock()) || destination !== event.actionPath) return report('action_rejected');
        // Synchronous application prevents an async navigation/context race.
        browser.navigate(destination);
        return report('action_applied');
      } catch { return report('action_rejected'); }
    },
  });
}
