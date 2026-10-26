/** AI: epoch-fenced browser lifecycle; concrete same-origin gateway supplies committed ACKs. */
import { notificationScope } from './notification-center.js';
import { normalizePushPayload } from './notification-push-core.js';

export function createPushClient({ browser, gateway, getVerifiedContext, clock, resolveAction, diagnostic = () => {} }) {
  let epoch = 0, busy = false, active = null;
  const pending = new Set();
  let drained = Promise.resolve(), finishDrain;
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
  async function revoke({ wait = false } = {}) {
    ++epoch; // invalidate pending consent/subscription/action work immediately
    if (active) pending.add(active);
    active = null;
    if (wait) await drained;
    const results = await Promise.all([...pending].map(clean));
    return report(results.every(Boolean) ? 'revoked' : 'cleanup_pending');
  }
  return Object.freeze({
    // Caller MUST invoke on logout, context switch, permission revocation and
    // before replacing the ownership guard; await cleanup before later opt-in.
    revoke,
    settled: () => drained,
    async restore(subscription) {
      if (busy || !subscription || browser.permission() !== 'granted') return report('unsubscribed');
      busy = true; drained = new Promise(resolve => { finishDrain = resolve; });
      const snapshot = context(), token = epoch;
      const record = { subscription, context: snapshot, registerAttempted: true };
      try {
        if (!snapshot || await gateway.restore(snapshot, subscription) !== true || !current(snapshot, token) || browser.permission() !== 'granted') {
          return report(await clean(record) ? 'unsubscribed' : 'cleanup_pending');
        }
        active = record; return report('subscribed');
      } catch { return report(await clean(record) ? 'unsubscribed' : 'cleanup_pending'); }
      finally { busy = false; finishDrain(); }
    },
    async optIn() {
      if (busy) return report('busy');
      busy = true;
      drained = new Promise(resolve => { finishDrain = resolve; });
      let record;
      try {
        if (!browser.supported()) return report('unsupported');
        if (!browser.hasUserActivation()) return report('gesture_required');
        const snapshot = context(), token = epoch;
        if (!snapshot) return report('unverified');
        if (pending.size) return report('cleanup_pending');
        if (active && !same(active.context, snapshot)) {
          const result = await revoke({ wait: false });
          return result.status === 'revoked' ? report('stale_context') : result;
        }
        if (active) {
          if (browser.permission() === 'granted') return report('subscribed');
          return await revoke({ wait: false });
        }
        let subscription;
        if (typeof browser.subscribeOnGesture === 'function') {
          // Safari/Firefox can require PushManager.subscribe directly inside
          // the click activation. Native subscribe requests permission itself;
          // don't await Notification.requestPermission before invoking it.
          if (browser.permission() === 'denied') return report('denied');
          subscription = await browser.subscribeOnGesture();
        } else {
          // Legacy synthetic ports: retain their explicit permission path.
          const permission = await browser.requestPermission();
          if (!current(snapshot, token)) return report('stale_context');
          if (permission !== 'granted') return report(permission === 'denied' ? 'denied' : 'unsubscribed');
          subscription = await browser.subscribe();
        }
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
      } finally { busy = false; finishDrain(); }
    },
    async applyAction(raw) {
      try {
        const snapshot = context(), token = epoch;
        const event = normalizePushPayload(raw, clock());
        if (!snapshot || !event) return report('action_rejected');
        if (await gateway.authorizeEvent(snapshot, event) !== true || !current(snapshot, token)) return report('action_rejected');
        // Re-derive eligibility, ownership and deleted-parent/child safety from
        // the current store using the mounted notificationDestination resolver.
        const destination = resolveAction(snapshot, event.id, clock());
        if (!current(snapshot, token) || !normalizePushPayload(event, clock()) || destination !== event.actionPath) return report('action_rejected');
        // Synchronous application prevents an async navigation/context race.
        browser.navigate(destination);
        return report('action_applied');
      } catch { return report('action_rejected'); }
    },
  });
}
