/** AI: staged browser composition. Activation requires a reviewed source change. */
import { createPushClient } from './notification-push-client.js';
import { createPushBrowser } from './notification-push-browser.js';
import { createPushGateway } from './notification-push-gateway.js';
import { currentNotificationContext, notificationDestination } from './notification-events.js';
import { readNotificationCategories, readNotificationTiming } from './notification-state.js';
import { LEASE_STORAGE_PREFIX } from './offline-lease.js';
import { normalizePushPayload, normalizePushEnvelope } from './notification-push-core.js';

export const PUSH_CONFIGURATION = Object.freeze({ enabled: false, publicKey: null });
export function createPushRuntime({ store, cloud, navigate, window: win = globalThis.window,
  configuration = PUSH_CONFIGURATION, fetch, storage = win?.localStorage, changed = () => {} }) {
  let generation = 0, binding = null, client = null, gateway = null, ready = false, status = 'disabled', preparing = false;
  let stamps = new Map(), projecting = false, cleanup = Promise.resolve();
  const retired = new Set();
  const drain = async () => {
    for (const old of retired) { await old.settled(); if ((await old.revoke()).status === 'revoked') retired.delete(old); }
    return { status: retired.size ? 'cleanup_pending' : 'revoked' };
  };
  const browser = createPushBrowser({ window: win, publicKey: configuration.publicKey, navigate });
  const current = () => store.getOfflineLeaseStatus().editable ? currentNotificationContext(store, cloud, storage) : null;
  const leaseRevision = () => { try { return JSON.parse(storage.getItem(LEASE_STORAGE_PREFIX + store.getActiveWorkspace()?.id) || 'null')?.renewalId; } catch { return null; } };
  const revisionKey = c => 'rakeezx-n44-consent:' + JSON.stringify([c.ownerId, c.workspaceId, c.deviceId]);
  const consentRevision = c => { try { return storage.getItem(revisionKey(c)); } catch { return undefined; } };
  const matches = b => b && current()?.ownerId === b.context.ownerId && current()?.workspaceId === b.context.workspaceId &&
    current()?.deviceId === b.context.deviceId && cloud.session === b.session && store.getActiveWorkspace() === b.workspace && leaseRevision() === b.leaseRevision && consentRevision(b.context) === b.consentRevision;
  const preferences = () => {
    const c = current(), timing = readNotificationTiming(c, storage);
    return { ...readNotificationCategories(c, storage), lessonMinutes: timing.lessonMinutes, dueDays: timing.dueDays,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, quiet: readPushQuiet(c, storage) };
  };
  function invalidate() {
    const old = client, originalGateway = gateway;
    ++generation; ready = false; status = 'unavailable'; binding = null; gateway = null; stamps = new Map(); client = null;
    let clearing;
    try { clearing = configuration.enabled ? originalGateway?.retire() ?? browser.clearConsent(null) : Promise.resolve(true); } catch { clearing = browser.clearConsent(null); }
    cleanup = Promise.all([cleanup, Promise.resolve(clearing).catch(() => false)]).then(results => results[1] === false ? {status:'cleanup_pending'} : results[0]);
    if (configuration.enabled) void browser.clearNotifications().catch(() => {});
    // revoke invalidates its own epoch synchronously before any cleanup awaits.
    if (old) {
      retired.add(old);
      const immediate = old.revoke();
      cleanup = Promise.all([cleanup, immediate]).then(drain);
    }
    changed();
  }
  async function refresh() {
    if (binding && (!matches(binding) || status === 'subscribed' && browser.permission() !== 'granted')) invalidate();
    if (!configuration.enabled || !browser.supported() || !current() || preparing || binding) return;
    preparing = true; const token = generation;
    const b = { context: current(), session: cloud.session, workspace: store.getActiveWorkspace(), leaseRevision: leaseRevision() };
    try { b.consentRevision = consentRevision(b.context); } catch { preparing = false; return; }
    const valid = () => generation === token && matches(b);
    const g = createPushGateway({ fetch, storage, context: b.context, authorization: 'Bearer ' + b.session.access_token, preferences, valid, invalidated: invalidate, bindConsent: r => browser.bind(r), clearConsent: id => browser.clearConsent(id),
      cleanupAuthorization() {
        const c = current();
        return c?.ownerId === b.context.ownerId && c?.workspaceId === b.context.workspaceId && c?.deviceId === b.context.deviceId
          ? 'Bearer ' + cloud.session.access_token : 'Bearer ' + b.session.access_token;
      },
      contextChanged(ctx) {
        const revision = ctx?.consentRevision ?? '';
        storage.setItem(revisionKey(b.context), revision); b.consentRevision = revision;
      } });
    try {
      const r = await g.read();
      // Same owner/device, new Auth session: retire the old context via its
      // observed CAS revision before acknowledging original registration cleanup.
      if (r.status === 'absent' && r.expectedRevision) await g.update(false);
      const previousCleanup = await cleanup;
      if (previousCleanup?.status === 'cleanup_pending' && !await browser.clearConsent(null)) { status = 'cleanup_pending'; return; }
      const cleaned = await drain();
      if (!valid() || cleaned?.status === 'cleanup_pending') { status = 'cleanup_pending'; return; }
      if (!valid()) return;
      if (!await browser.ready() || !valid()) { status = 'unavailable'; return; }
      binding = b; gateway = g;
      const verified = () => valid() ? { ...b.context, authRevision: String(token) } : null;
      const c = createPushClient({ browser, gateway: g, getVerifiedContext: verified, clock: Date.now,
        resolveAction: (_ctx, id, now) => notificationDestination(store, current(), id, now) });
      client = c;
      const existing = await browser.existing();
      const workerConsent = await browser.consent();
      if (r.registration && existing && workerConsent.binding === r.registration.registrationId &&
          workerConsent.expiresAt >= r.registration.expiresAt && browser.permission() === 'granted') {
        const restored = await c.restore(existing);
        if (!valid()) return;
        if (restored.status === 'subscribed') { ready = true; status = 'subscribed'; return; }
        if (restored.status === 'cleanup_pending') { status = 'cleanup_pending'; return; }
      }
      // No new subscription or permission request on load. Retired identities
      // are reconciled before allowing another explicit opt-in.
      if (!await g.retire()) { status = 'cleanup_pending'; return; }
      if (!await g.remove() || !valid() || existing && !await existing.unsubscribe()) { status = 'cleanup_pending'; return; }
      ready = true; status = 'unsubscribed';
    } catch { status = 'unavailable'; }
    finally { preparing = false; changed(); }
  }
  const usable = () => gateway?.expiresAt() > Date.now() && ready && matches(binding) && browser.permission() === 'granted' && status === 'subscribed';
  async function authorize(raw) {
    const c = client, b = binding, event = normalizePushPayload(raw, Date.now());
    if (!usable() || !event || !readNotificationCategories(current(), storage)[event.kind]) return false;
    if (notificationDestination(store, current(), event.id, Date.now()) !== event.actionPath) return false;
    try { return await gateway.authorizeEvent(b.context, event) === true && client === c && usable(); } catch { return false; }
  }
  const onMessage = event => {
    // Only the actual controlling SW can request a bounded action; no page-message API.
    if (!event.source || event.source !== win.navigator.serviceWorker?.controller) return;
    if (event.data?.type === 'n44-subscription-stale') { invalidate(); return; }
    if (!event.ports?.[0] ||
      !['n44-push-check', 'n44-push-click'].includes(event.data?.type)) return;
    const port = event.ports[0];
    void (async () => {
      const envelope = normalizePushEnvelope(event.data.event, Date.now());
      let ok = envelope && envelope.binding === gateway?.registration()?.registrationId && await authorize(envelope.event);
      if (ok && event.data.type === 'n44-push-click') ok = (await client?.applyAction(envelope.event))?.status === 'action_applied';
      port.postMessage({ ok }); port.close();
    })().catch(() => { port.postMessage({ ok: false }); port.close(); });
  };
  win?.navigator.serviceWorker?.addEventListener('message', onMessage);
  let permissionState = null, disposed = false;
  if (configuration.enabled && browser.supported()) {
    win.addEventListener?.('focus', refresh);
    void win.navigator.permissions?.query({ name: 'notifications' }).then(value => {
      if (disposed) return;
      permissionState = value;
      value.onchange = () => { invalidate(); void refresh(); };
    }).catch(() => {});
  }
  return Object.freeze({
    refresh, invalidate,
    snapshot: () => ({ available: ready && matches(binding) && (gateway?.expiresAt() > Date.now() || status !== 'subscribed'), status }),
    async optIn() {
      if (!ready || !matches(binding)) return { status: 'unavailable' };
      const c = client, result = await c.optIn();
      if (client === c && matches(binding)) { status = result.status; changed(); }
      return result;
    },
    async disable() {
      const g = gateway, selectedPreferences = preferences();
      invalidate(); status = 'cleanup_pending';
      const result = await cleanup;
      try { if (result?.status !== 'revoked') return result; await g.update(false, { cleanup: true, selectedPreferences }); status = 'revoked'; }
      catch { status = 'cleanup_pending'; }
      changed(); return { status };
    },
    async preferencesChanged() { if (!gateway) return; await this.disable(); await refresh(); },
    // Called only by the normal Sync post-ACK hook, never from store/render changes.
    async afterSyncAck(checkpoint) {
      if (!usable() || projecting || checkpoint.workspace !== store.getActiveWorkspace() || checkpoint.session !== cloud.session) return;
      projecting = true; const g = gateway, b = binding;
      try {
        const sources = new Map(stamps);
        for (const s of store.state.sessions ?? []) sources.set(JSON.stringify(['lesson', s.id]), stamps.get(JSON.stringify(['lesson', s.id])) ?? null);
        for (const s of store.state.scoreSubitems ?? []) sources.set(JSON.stringify(['due', s.id]), stamps.get(JSON.stringify(['due', s.id])) ?? null);
        for (const [key, stamp] of sources) {
          if (!usable() || binding !== b) break;
          const [kind, id] = JSON.parse(key); const next = await g.project(kind, id, stamp);
          if (binding !== b) break;
          stamps.set(key, next);
        }
      } catch { /* stale CAS needs a fresh context; never fabricate a projection ACK */ }
      finally { projecting = false; }
    },
    dispose() { disposed = true; invalidate(); if (permissionState) permissionState.onchange = null; win?.removeEventListener?.('focus', refresh); win?.navigator.serviceWorker?.removeEventListener('message', onMessage); return cleanup; },
  });
}
export function readPushQuiet(context, storage = globalThis.localStorage) {
  if (!context) return null;
  try { const q = JSON.parse(storage.getItem('rakeezx-n44-quiet:' + JSON.stringify([context.ownerId, context.workspaceId, context.deviceId])) || 'null');
    return q && Object.keys(q).sort().join(',') === 'end,start' && [q.start, q.end].every(v => Number.isInteger(v) && v >= 0 && v < 1440) ? q : null;
  } catch { return null; }
}
export function writePushQuiet(context, quiet, storage = globalThis.localStorage) {
  if (!context || quiet !== null && (!quiet || Object.keys(quiet).sort().join(',') !== 'end,start' ||
    ![quiet.start, quiet.end].every(v => Number.isInteger(v) && v >= 0 && v < 1440))) return false;
  try { storage.setItem('rakeezx-n44-quiet:' + JSON.stringify([context.ownerId, context.workspaceId, context.deviceId]), JSON.stringify(quiet)); return true; }
  catch { return false; }
}
let runtime = null;
export const setPushRuntime = value => { runtime = value; };
export const getPushRuntime = () => runtime;
