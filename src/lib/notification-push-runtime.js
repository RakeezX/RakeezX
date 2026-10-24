/** AI: staged browser composition. Activation requires a reviewed source change. */
import { createPushClient } from './notification-push-client.js';
import { createPushBrowser } from './notification-push-browser.js';
import { createPushGateway } from './notification-push-gateway.js';
import { currentNotificationContext, notificationDestination } from './notification-events.js';
import { readNotificationCategories, readNotificationTiming } from './notification-state.js';
import { LEASE_STORAGE_PREFIX } from './offline-lease.js';
import { normalizePushPayload, normalizePushEnvelope } from './notification-push-core.js';

// Public-key discovery is authenticated and same-origin. This enables discovery,
// never permission, subscription, a scheduler or delivery on application load.
export const PUSH_CONFIGURATION = Object.freeze({ enabled: true, publicKey: null });
export function supportedPushConfiguration(value, now = Date.now()) {
  return value && Object.keys(value).sort().join(',') === 'capability,deliveryEnabled,expiresAt,protocol,publicKey,schedulerEnabled,serviceRevision,serviceSourceSha,status' &&
    value.status === 'ready' && value.protocol === 'n44-browser-v2' && value.capability === 'n44-single-device-20261019-v1' &&
    value.serviceRevision === 'n44-browser-service-v2' && /^[a-f0-9]{40}$/.test(value.serviceSourceSha) &&
    /^B[A-Za-z0-9_-]{86}$/.test(value.publicKey) && Number.isSafeInteger(value.expiresAt) &&
    value.expiresAt > now && value.expiresAt <= now + 86400000 && value.deliveryEnabled === false && value.schedulerEnabled === false;
}
export function createPushRuntime({ store, cloud, navigate, window: win = globalThis.window,
  configuration = PUSH_CONFIGURATION, fetch, storage = win?.localStorage, changed = () => {} }) {
  let generation = 0, binding = null, client = null, gateway = null, ready = false, status = 'disabled', preparing = false;
  let stamps = new Map(), projecting = null, cleanup = Promise.resolve();
  let queuedProjection = null;
  const projectionFailures = new Map();
  // Retain only the original cleanup capability, never a usable/new consent binding.
  let pendingDisable = null, disabling = null, preferenceStop = null;
  let preparingBinding = null, preparingGeneration = 0, refreshQueued = false;
  let eligibility = { reason: 'idle', configuration: 'not_observed' };
  const mark = (reason, flags = {}) => { eligibility = { ...eligibility, ...flags, reason }; };
  const retired = new Set();
  const drain = async () => {
    for (const old of retired) { await old.settled(); if ((await old.revoke()).status === 'revoked') retired.delete(old); }
    return { status: retired.size ? 'cleanup_pending' : 'revoked' };
  };
  let browser = createPushBrowser({ window: win, publicKey: configuration.publicKey, navigate });
  const current = () => store.getOfflineLeaseStatus().editable ? currentNotificationContext(store, cloud, storage) : null;
  const leaseRevision = () => { try { return JSON.parse(storage.getItem(LEASE_STORAGE_PREFIX + store.getActiveWorkspace()?.id) || 'null')?.renewalId; } catch { return null; } };
  const revisionKey = c => 'rakeezx-n44-consent:' + JSON.stringify([c.ownerId, c.workspaceId, c.deviceId]);
  const consentRevision = c => { try { return storage.getItem(revisionKey(c)); } catch { return undefined; } };
  const currentToken = () => { try { const value=JSON.parse(storage.getItem(cloud.AUTH_STORAGE_KEY)||'null'); return value?.user?.id===cloud.user?.id&&typeof value.access_token==='string'?value.access_token:null; } catch { return null; } };
  // An UNTRUSTED hint can reject a changed credential or select a server recheck.
  // It never establishes Auth, owner, or session continuity.
  const sessionHint = (token,owner) => { try {
    const parts=token.split('.');if(parts.length!==3||parts[1].length>8192||!/^[A-Za-z0-9_-]+$/.test(parts[1]))return null;
    const value=JSON.parse(atob(parts[1].replaceAll('-','+').replaceAll('_','/')));
    return value.sub===owner&&value.role==='authenticated'&&Number.isSafeInteger(value.exp)&&value.exp*1000>Date.now()&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.session_id??'')?value.session_id:null;
  } catch { return null; } };
  let renewing = null;
  const cloudSessionContinues = b => !!b && (cloud.session?.access_token === b.acceptedToken || !!b.authSessionId && sessionHint(cloud.session?.access_token??'',b.context.ownerId) === b.authSessionId);
  const bindingChecks = b => {
    const c = current();
    return { contextMatches: !!b && !!c && c.ownerId === b.context.ownerId && c.workspaceId === b.context.workspaceId && c.deviceId === b.context.deviceId,
      sessionMatches: !!b && currentToken() === b.acceptedToken && cloudSessionContinues(b), workspaceMatches: !!b && store.getActiveWorkspace() === b.workspace,
      leaseMatches: !!b && leaseRevision() === b.leaseRevision, consentMatches: !!b && consentRevision(b.context) === b.consentRevision };
  };
  const matches = b => !!b && (b.serviceExpiresAt ?? Infinity) > Date.now() && Object.values(bindingChecks(b)).every(Boolean);
  const continuation = b => {
    const checks=bindingChecks(b);
    return !!b&&b.serviceExpiresAt>Date.now()&&checks.contextMatches&&checks.workspaceMatches&&checks.leaseMatches&&checks.consentMatches&&cloudSessionContinues(b)&&!!b.authSessionId&&sessionHint(currentToken()??'',b.context.ownerId)===b.authSessionId;
  };
  const ownsCleanup = b => {
    const checks = bindingChecks(b);
    return !disposed && checks.contextMatches && checks.sessionMatches && checks.workspaceMatches && checks.leaseMatches;
  };
  const preferences = () => {
    const c = current(), timing = readNotificationTiming(c, storage);
    return { ...readNotificationCategories(c, storage), lessonMinutes: timing.lessonMinutes, dueDays: timing.dueDays,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, quiet: readPushQuiet(c, storage) };
  };
  function invalidate() {
    const old = client, originalGateway = gateway;
    ++generation; renewing = null; queuedProjection = null; ready = false; status = 'unavailable'; eligibility = { reason: 'binding_changed', configuration: 'not_observed' }; binding = null; gateway = null; stamps = new Map(); client = null;
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
    if (disposed) return;
    if (binding && currentToken() !== binding.acceptedToken && continuation(binding)) {
      if (renewing) return renewing.promise;
      const b=binding,g=gateway,candidate=currentToken(),receipt=g.registration(),revision=b.serverSessionRevision,consent=b.consentRevision,consentState=b.serverConsent;
      const attempt={binding:b,candidate};renewing=attempt;
      attempt.promise=(async()=>{
        let replaced=false;
        try {
          await g.read({accept:r=>r.status==='current'&&r.context?.sessionId===b.authSessionId&&r.context.sessionRevision===revision&&r.context.consentRevision===consent&&r.context.pushConsent===consentState&&r.registration?.registrationId===receipt?.registrationId&&r.registration?.expiresAt===receipt?.expiresAt});
          if(binding!==b||renewing!==attempt||currentToken()!==candidate||!continuation(b))throw Error('stale');
          b.acceptedToken=candidate;b.cleanupToken=candidate;mark('ready');
        } catch {
          // Only a genuinely newer same-session credential may supersede this
          // read. Never retry the unchanged failed credential.
          replaced=binding===b&&currentToken()!==candidate&&continuation(b);
          if(binding===b&&!replaced)invalidate();
        }
        finally { if(renewing===attempt)renewing=null;changed(); }
        if(replaced&&binding===b)await refresh();
      })();
      return attempt.promise;
    }
    if (binding && (!matches(binding) || status === 'subscribed' && browser.permission() !== 'granted')) invalidate();
    if (preparing) { if (preparingBinding && (preparingGeneration !== generation || !matches(preparingBinding))) refreshQueued = true; return; }
    if (!configuration.enabled) { mark('disabled'); return; }
    if (!current()) { mark('account_unavailable'); return; }
    // An unresolved explicit stop cannot be bypassed by focus/refresh or opt-in.
    if (pendingDisable) { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
    if (binding) return;
    preparing = true; const token = generation;
    const b = { context: current(), session: cloud.session, acceptedToken: currentToken(), cleanupToken: currentToken(), workspace: store.getActiveWorkspace(), leaseRevision: leaseRevision() };
    try { b.consentRevision = consentRevision(b.context); } catch { preparing = false; mark('context_unavailable'); return; }
    preparingBinding = b; preparingGeneration = token; eligibility = { reason: 'checking_configuration', configuration: 'not_observed', ...bindingChecks(b), generationMatches: true, browserSupported: false, workerReady: false };
    const valid = () => generation === token && (matches(b)||renewing?.binding===b&&currentToken()===renewing.candidate&&continuation(b));
    const g = createPushGateway({ fetch, storage, context: b.context, authorization: () => 'Bearer ' + currentToken(), preferences, valid, invalidated: invalidate, bindConsent: r => browser.bind(r), clearConsent: id => browser.clearConsent(id),
      cleanupAuthorization() {
        const c = current();
        return c?.ownerId === b.context.ownerId && c?.workspaceId === b.context.workspaceId && c?.deviceId === b.context.deviceId && (currentToken()===b.acceptedToken||continuation(b))
          ? 'Bearer ' + currentToken() : 'Bearer ' + b.cleanupToken;
      },
      contextChanged(ctx) {
        b.authSessionId=ctx?.sessionId??null;b.serverSessionRevision=ctx?.sessionRevision??null;b.serverConsent=ctx?.pushConsent;
        const revision = ctx?.consentRevision ?? '';
        storage.setItem(revisionKey(b.context), revision); b.consentRevision = revision;
      } });
    try {
      const publicConfiguration = await g.configuration();
      const accepted = supportedPushConfiguration(publicConfiguration) === true;
      mark(!accepted ? publicConfiguration?.status === 'disabled' ? 'configuration_disabled' : 'configuration_invalid' : 'checking_context', { configuration: accepted ? 'ready' : publicConfiguration?.status === 'disabled' ? 'disabled' : 'invalid' });
      if (!accepted) throw Error('unavailable');
      if (!valid()) { mark('binding_changed'); throw Error('unavailable'); }
      b.serviceExpiresAt = publicConfiguration.expiresAt;
      browser = createPushBrowser({ window: win, publicKey: publicConfiguration.publicKey, navigate });
      const supported = browser.supported(); mark(supported ? 'checking_context' : 'browser_unsupported', { browserSupported: supported });
      if (!supported) throw Error('unavailable');
      if (!valid()) { mark('binding_changed'); throw Error('unavailable'); }
      const r = await g.read();
      // Same owner/device, new Auth session: retire the old context via its
      // observed CAS revision before acknowledging original registration cleanup.
      if (r.status === 'absent' && r.expectedRevision) await g.update(false);
      const previousCleanup = await cleanup;
      if (previousCleanup?.status === 'cleanup_pending' && !await browser.clearConsent(null)) { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      const cleaned = await drain();
      if (!valid() || cleaned?.status === 'cleanup_pending') { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      if (!valid()) return;
      mark('checking_service_worker');
      const workerReady = await browser.ready(); mark(workerReady ? 'checking_context' : 'service_worker_unavailable', { workerReady });
      if (!workerReady || !valid()) { if (!valid()) mark('binding_changed'); status = 'unavailable'; return; }
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
        if (restored.status === 'subscribed') { ready = true; status = 'subscribed'; mark('ready'); await projectConfirmed({ workspace: b.workspace, session: b.session }); return; }
        if (restored.status === 'cleanup_pending') { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      }
      // No new subscription or permission request on load. Retired identities
      // are reconciled before allowing another explicit opt-in.
      if (!await g.retire()) { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      if (!await g.remove() || !valid() || existing && !await existing.unsubscribe()) { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      ready = true; status = 'unsubscribed'; mark('ready');
    } catch { status = 'unavailable'; if (!valid()) mark('binding_changed', { configuration: 'not_observed' }); else if (eligibility.reason === 'checking_configuration') mark('request_unavailable', { configuration: 'request_failed' }); else if (eligibility.reason === 'checking_context') mark('context_unavailable'); }
    finally {
      eligibility = { ...eligibility, ...bindingChecks(b), generationMatches: generation === token }; preparing = false; preparingBinding = null;
      const queued = refreshQueued; refreshQueued = false; changed();
      // A refresh requested for a changed binding must not be lost behind the old request.
      // Unchanged failed requests never enqueue an automatic retry.
      if (queued && !valid() && !disposed) void refresh();
    }
  }
  const usable = () => gateway?.expiresAt() > Date.now() && ready && matches(binding) && browser.permission() === 'granted' && status === 'subscribed';
  // AI N44: bootstrap and adopted canonical state are distinct from a pushed ACK.
  // Only confirmed IDs are hints; no local event payload becomes server truth.
  function projectConfirmed(checkpoint) {
      if (!usable() || checkpoint.workspace !== store.getActiveWorkspace() || checkpoint.session !== cloud.session) return Promise.resolve();
      // Overlapping ACK hooks share one current-owner pass. Never queue a replay
      // of a write whose response was lost.
      if (projecting) return projecting;
      const g = gateway, b = binding;
      const pass = (async () => {
        const confirmed = await store.confirmedNotificationSources([...stamps.keys()].map(key => { const [kind,id]=JSON.parse(key); return {kind,id}; }));
        const confirmedKeys = new Set(confirmed.map(s=>JSON.stringify([s.kind,s.id])));
        const sources = activeProjectionSources(store,b.context).filter(s=>confirmedKeys.has(s.key));
        const liveKeys = new Set(sources.map(s => s.key));
        for (const key of stamps.keys()) if (!liveKeys.has(key)) stamps.delete(key);
        for (const { key, kind, id, revision } of sources) {
          if (!usable() || binding !== b) break;
          const pendingKey = 'rakeezx-n44-projection-pending:' + JSON.stringify([b.context.ownerId, b.context.workspaceId, key]);
          try {
            // Persist BEFORE the request. A crash, lost ACK or server failure
            // leaves UNKNOWN across reload; no automatic upsert recovery.
            if (storage.getItem(pendingKey) || projectionFailures.get(pendingKey) === revision) continue;
            storage.setItem(pendingKey, 'unknown');
            const next = await g.project(kind, id, stamps.get(key) ?? null);
            storage.removeItem(pendingKey);
            if (binding !== b || !usable()) break;
            const currentSource = activeProjectionSources(store, b.context).find(s => s.key === key);
            if (currentSource?.revision === revision) stamps.set(key, next);
          } catch (error) {
            if (error.projectionDisposition === 'rejected') {
              storage.removeItem(pendingKey); projectionFailures.set(pendingKey, revision);
              mark('projection_rejected');
            } else mark('projection_unknown');
            // Independent current sources may proceed; neither refusal nor
            // uncertainty is an ACK for this source.
          }
        }
      })();
      projecting = pass;
      return pass.finally(() => { if (projecting === pass) projecting = null; });
  }
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
  if (configuration.enabled) {
    win.addEventListener?.('focus', refresh);
    void win.navigator.permissions?.query({ name: 'notifications' }).then(value => {
      if (disposed) return;
      permissionState = value;
      value.onchange = () => { invalidate(); void refresh(); };
    }).catch(() => {});
  }
  return Object.freeze({
    refresh, invalidate,
    snapshot: () => ({ available: ready && matches(binding) && (gateway?.expiresAt() > Date.now() || status !== 'subscribed'), cleanupAvailable: !!pendingDisable && ownsCleanup(pendingDisable.binding), cleanupBusy: !!disabling, preferenceStopped: !!preferenceStop && ownsCleanup(preferenceStop), status, eligibility: { ...eligibility } }),
    async optIn() {
      if (!ready || !matches(binding)) return { status: 'unavailable' };
      const c = client, result = await c.optIn();
      if (client === c && matches(binding)) {
        status = result.status; if (status === 'subscribed') preferenceStop = null; changed();
        if (result.status === 'subscribed') await projectConfirmed({ workspace: binding.workspace, session: binding.session });
      }
      return result;
    },
    async disable() {
      if (pendingDisable ? !ownsCleanup(pendingDisable.binding) : !binding || !matches(binding)) return { status: 'unavailable' };
      if (!pendingDisable) {
        pendingDisable = { gateway, binding, preferences: preferences() };
        invalidate(); status = 'cleanup_pending'; mark('cleanup_pending'); changed();
      } else pendingDisable.preferences = preferences();
      if (disabling) return disabling;
      const stop = pendingDisable;
      disabling = (async () => {
        try {
          await cleanup;
          if (!ownsCleanup(stop.binding)) return { status: 'unavailable' };
          if (!await stop.gateway.retire() || (await drain()).status !== 'revoked') return { status: 'cleanup_pending' };
          if (!ownsCleanup(stop.binding)) return { status: 'unavailable' };
          const selectedPreferences = stop.preferences;
          await stop.gateway.update(false, { cleanup: true, selectedPreferences });
          if (!ownsCleanup(stop.binding)) return { status: 'unavailable' };
          if (selectedPreferences !== stop.preferences) return { status: 'cleanup_pending' };
          pendingDisable = null; cleanup = Promise.resolve({ status: 'revoked' }); status = 'revoked';
          await refresh(); return { status: 'revoked' };
        } catch { return { status: 'cleanup_pending' }; }
        finally { disabling = null; changed(); }
      })();
      return disabling;
    },
    async preferencesChanged() {
      if (pendingDisable && ownsCleanup(pendingDisable.binding)) pendingDisable.preferences = preferences();
      if (!gateway && !pendingDisable || pendingDisable && !ownsCleanup(pendingDisable.binding)) return;
      // Existing context/update revokes subscriptions. Explain this deliberate
      // stop and require a fresh gesture; never silently register or revive an ID.
      if (status === 'subscribed' || pendingDisable) preferenceStop = pendingDisable?.binding ?? binding;
      await this.disable();
    },
    // Retained API for genuine ACK hooks; canonical reads use no ACK counter.
    afterSyncAck: projectConfirmed,
    projectConfirmedSources: projectConfirmed,
    dispose() { disposed = true; invalidate(); if (permissionState) permissionState.onchange = null; win?.removeEventListener?.('focus', refresh); win?.navigator.serviceWorker?.removeEventListener('message', onMessage); return cleanup; },
  });
}
// Same canonical ancestry requirements as the server source adapter. Tombstones
// stay in the store; they are excluded only from outbound projection candidates.
export function activeProjectionSources(store, context) {
  const owned = r => r && !r.deleted && (r.ownerId == null || r.ownerId === context.ownerId);
  const chain = id => {
    const t = store.getTeaching(id), term = store.getTerm(t?.termId), year = store.getYear(term?.yearId);
    const section = store.getSection(t?.sectionId), subject = store.getSubject(t?.subjectId);
    return [t, term, year, section, subject].every(owned) && year.status === 'active' && section.status === 'active' && section.yearId === year.id && term.status !== 'closed' ? [t, term, year, section, subject] : null;
  };
  const result = [], add = (kind, row, ancestors) => result.push({kind,id:row.id,key:JSON.stringify([kind,row.id]),revision:JSON.stringify([row,...ancestors])});
  for (const row of store.state.sessions ?? []) { const parents = chain(row.teachingId); if (owned(row) && parents && !['cancelled','cancelled_holiday'].includes(row.status)) add('lesson',row,parents); }
  for (const row of store.state.scoreSubitems ?? []) { const item = store.state.items.find(i => i.id === row.itemId), parents = chain(item?.teachingId); if (owned(row) && owned(item) && item.scoreMode === 'subitems' && parents) add('due',row,[item,...parents]); }
  return result;
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
