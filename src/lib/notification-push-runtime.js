/** AI: staged browser composition. Activation requires a reviewed source change. */
import { createPushClient } from './notification-push-client.js';
import { createPushBrowser } from './notification-push-browser.js';
import { createPushGateway, N44_CONFIG_SERVICE_PHASES } from './notification-push-gateway.js';
import { currentNotificationContext, currentNotificationEvents, notificationDestination } from './notification-events.js';
import { readNotificationCategories, readNotificationTiming } from './notification-state.js';
import { LEASE_STORAGE_PREFIX } from './offline-lease.js';
import { normalizePushPayload, normalizePushEnvelope } from './notification-push-core.js';
import { toast } from './dom.js';

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
  let choiceSerial = 0, choices = new Map(), verification = null, sourceStatus = null, verifying = false;
  const choiceSignature = (type, value) => JSON.stringify([generation, current(), type, value]);
  function normalChoices() {
    if (!current()) { choices.clear(); return { reminders: [], sources: [] }; }
    const previous = choices, next = new Map();
    const issue = (type, value) => {
      const signature = choiceSignature(type, value);
      const token = [...previous].find(([, r]) => r.signature === signature)?.[0] ?? 'choice-' + (++choiceSerial);
      next.set(token, { type, value, signature }); return token;
    };
    const sources = store.notificationSourceGroups().map(value => ({ ...value, token: issue('source', value) }));
    const reminders = currentNotificationEvents(store, current()).filter(e => readNotificationCategories(current(), storage)[e.kind])
      .map(value => ({ ...value, token: issue('reminder', { event: value, source: activeProjectionSources(store, current()).find(s => s.kind === value.kind && s.id === value.targetId)?.revision }) }));
    choices = next; return { reminders, sources };
  }
  const selectedChoice = (token, type) => { normalChoices(); const c = choices.get(token); return c?.type === type ? c : null; };
  const currentResult = value => value && choices.get(value.token)?.signature === value.signature ? value : null;
  const projectionFailures = new Map();
  // Retain only the original cleanup capability, never a usable/new consent binding.
  let pendingDisable = null, disabling = null, preferenceStop = null;
  let preparingBinding = null, preparingGeneration = 0, refreshQueued = false;
  let eligibility = { reason: 'idle', configuration: 'not_observed' };
  let configObservation = null;
  // AI: a settled attempt is not permission to poll again on store/focus events.
  // Keep credentials only in the existing in-memory fenced binding.
  let configAttempt = null;
  const sameConfigAttempt = a => !!a && a.generation === generation && matches(a.binding) && a.permission === browser.permission();
  const configOutcome = () => {
    if (disposed || configObservation?.generation !== generation || !matches(configObservation?.binding)) { configObservation = null; return null; }
    return { ...configObservation.outcome };
  };
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
      sessionMatches: !!b && currentToken() === b.acceptedToken && cloudSessionContinues(b), workspaceMatches: !!b && !!c && store.getActiveWorkspace()?.id === b.workspace.id && store.getActiveWorkspace()?.databaseName === b.workspace.databaseName,
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
    configObservation = null;
    configAttempt = null;
    const old = client, originalGateway = gateway;
    ++generation; choices.clear(); verification = null; sourceStatus = null; verifying = false; renewing = null; queuedProjection = null; ready = false; status = 'unavailable'; eligibility = { reason: 'binding_changed', configuration: 'not_observed' }; binding = null; gateway = null; stamps = new Map(); client = null;
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
  async function refresh(options) {
    const readinessOnly = options?.readinessOnly === true;
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
    if (preparing) { if (preparingBinding && (preparingGeneration !== generation || !matches(preparingBinding) || configAttempt?.permission !== browser.permission())) refreshQueued = true; return; }
    if (!configuration.enabled) { mark('disabled'); return; }
    if (!current()) { mark('account_unavailable'); return; }
    // An unresolved explicit stop cannot be bypassed by focus/refresh or opt-in.
    if (pendingDisable) { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
    if (binding) return;
    if (sameConfigAttempt(configAttempt)) return;
    preparing = true; configObservation = null; const token = generation;
    const b = { context: current(), session: cloud.session, acceptedToken: currentToken(), cleanupToken: currentToken(), workspace: store.getActiveWorkspace(), leaseRevision: leaseRevision() };
    try { b.consentRevision = consentRevision(b.context); } catch { preparing = false; mark('context_unavailable'); return; }
    preparingBinding = b; preparingGeneration = token; eligibility = { reason: 'checking_configuration', configuration: 'not_observed', ...bindingChecks(b), generationMatches: true, browserSupported: false, workerReady: false };
    const attempt = configAttempt = { binding: b, generation: token, permission: browser.permission(), retryAt: 0 };
    const valid = () => generation === token && (binding === b || attempt.permission === browser.permission()) && (matches(b)||renewing?.binding===b&&currentToken()===renewing.candidate&&continuation(b));
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
      const { body: publicConfiguration, httpStatus } = await g.configuration({ metadata: true });
      if (!valid()) { mark('binding_changed'); throw Error('unavailable'); }
      const accepted = supportedPushConfiguration(publicConfiguration) === true;
      configObservation = { binding: b, generation: token, outcome: { httpStatus, phase: accepted || publicConfiguration?.status === 'disabled' ? 'complete' : 'shape' } };
      mark(!accepted ? publicConfiguration?.status === 'disabled' ? 'configuration_disabled' : 'configuration_invalid' : 'checking_context', { configuration: accepted ? 'ready' : publicConfiguration?.status === 'disabled' ? 'disabled' : 'invalid' });
      if (!accepted) {
        // A consumed/target-bound approval cannot grant another registration.
        // Existing owner cleanup uses its normal server context/CAS, not preview.
        const cleanupHint = consentRevision(b.context) || storage.getItem('rakeezx-n44-registration:' + JSON.stringify([b.context.ownerId, b.context.workspaceId, b.context.deviceId]));
        if (publicConfiguration?.status === 'disabled' && typeof cleanupHint === 'string' && cleanupHint.length > 0 && cleanupHint.length <= 8192) {
          const observed = await g.read();
          if (valid() && observed.status === 'current' && observed.context?.pushConsent === true) {
            pendingDisable = { gateway: g, binding: b, preferences: preferences(), cleanupOnly: true };
            status = 'cleanup_pending'; mark('cleanup_pending'); return;
          }
        }
        throw Error('unavailable');
      }
      if (!valid()) { mark('binding_changed'); throw Error('unavailable'); }
      b.serviceExpiresAt = publicConfiguration.expiresAt;
      browser = createPushBrowser({ window: win, publicKey: publicConfiguration.publicKey, navigate });
      const supported = browser.supported(); mark(supported ? 'checking_context' : 'browser_unsupported', { browserSupported: supported });
      if (!supported) throw Error('unavailable');
      if (!valid()) { mark('binding_changed'); throw Error('unavailable'); }
      const r = await g.read();
      // Same owner/device, new Auth session: retire the old context via its
      // observed CAS revision before acknowledging original registration cleanup.
      if (r.status === 'absent' && r.expectedRevision) {
        if (readinessOnly) { status = 'unavailable'; mark('context_unavailable'); return; }
        await g.update(false);
      }
      const previousCleanup = await cleanup;
      if (previousCleanup?.status === 'cleanup_pending' && (readinessOnly || !await browser.clearConsent(null))) { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      const cleaned = readinessOnly ? { status: retired.size ? 'cleanup_pending' : 'revoked' } : await drain();
      if (!valid() || cleaned?.status === 'cleanup_pending') { status = 'cleanup_pending'; mark('cleanup_pending'); return; }
      if (!valid()) return;
      mark('checking_service_worker');
      const workerReady = await browser.ready(); mark(workerReady ? 'checking_context' : 'service_worker_unavailable', { workerReady });
      if (!workerReady || !valid()) { if (!valid()) mark('binding_changed'); status = 'unavailable'; return; }
      const existing = await browser.existing();
      const workerConsent = await browser.consent();
      if (!valid()) return;
      // A manual readiness gesture must not restore/register or retire a saved
      // subscription. Its normal lifecycle remains separate from this read.
      if (readinessOnly && (r.registration || existing || workerConsent.binding || storage.getItem('rakeezx-n44-registration:' + JSON.stringify([b.context.ownerId, b.context.workspaceId, b.context.deviceId])))) { status = 'unavailable'; mark('context_unavailable'); return; }
      binding = b; gateway = g;
      const verified = () => valid() ? { ...b.context, authRevision: String(token) } : null;
      const c = createPushClient({ browser, gateway: g, getVerifiedContext: verified, clock: Date.now,
        resolveAction: (_ctx, id, now) => notificationDestination(store, current(), id, now) });
      client = c;
      if (readinessOnly) { ready = true; status = 'unsubscribed'; mark('ready'); return; }
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
    } catch (error) { status = 'unavailable'; if (!valid()) { configObservation = null; mark('binding_changed', { configuration: 'not_observed' }); } else if (eligibility.reason === 'checking_configuration') {
      const observed = error.configOutcome;
      const outcome = { httpStatus: observed?.httpStatus ?? null, phase: observed?.phase ?? 'request' };
      if (outcome.httpStatus === 503 && outcome.phase === 'http' && N44_CONFIG_SERVICE_PHASES.includes(observed?.servicePhase)) outcome.servicePhase = observed.servicePhase;
      configObservation = { binding: b, generation: token, outcome };
      if (outcome.httpStatus === 429) attempt.retryAt = Date.now() + 60000;
      mark('request_unavailable', { configuration: 'request_failed' });
    } else if (eligibility.reason === 'checking_context') mark('context_unavailable'); }
    finally {
      eligibility = { ...eligibility, ...bindingChecks(b), generationMatches: generation === token }; preparing = false; preparingBinding = null;
      const queued = refreshQueued; refreshQueued = false; changed();
      // A refresh requested for a changed binding must not be lost behind the old request.
      // Unchanged failed requests never enqueue an automatic retry.
      if (queued && !valid() && !disposed) void refresh();
    }
  }
  async function recheckConfiguration() {
    // A manual readiness check never retires a valid registration or Stop work.
    if (disposed || preparing || binding || pendingDisable || disabling || !configuration.enabled || !current()) return { status: 'unavailable' };
    if (sameConfigAttempt(configAttempt) && Date.now() < configAttempt.retryAt) return { status: 'cooldown' };
    configAttempt = null;
    await refresh({ readinessOnly: true });
    return { status: 'checked' };
  }
  const usable = () => gateway?.expiresAt() > Date.now() && ready && matches(binding) && browser.permission() === 'granted' && status === 'subscribed';
  const outcomeBinding = () => {
    if(disposed||disabling)return null;
    if(usable())return {binding,gateway,registration:gateway.registration(),pending:null};
    const p=pendingDisable,b=p?.binding,g=p?.gateway,r=g?.registration();
    if(!p?.cleanupOnly||status!=='cleanup_pending'||!ownsCleanup(b)||!bindingChecks(b).consentMatches||b.serverConsent!==true||!r||!(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/).test(r.registrationId??'')||!Number.isSafeInteger(r.expiresAt)||r.expiresAt<=Date.now())return null;
    try{
      const saved=JSON.parse(storage.getItem('rakeezx-n44-registration:'+JSON.stringify([b.context.ownerId,b.context.workspaceId,b.context.deviceId]))||'null');
      if(saved?.retired||saved?.registrationId!==r.registrationId||saved?.workspaceId!==b.context.workspaceId||saved?.deviceId!==b.context.deviceId)return null;
    }catch{return null;}
    return {binding:b,gateway:g,registration:r,pending:p};
  };

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
        const sources = activeProjectionSources(store,b.context).filter(s=>confirmedKeys.has(s.key) && (!checkpoint.sourceKey || checkpoint.sourceKey === s.key));
        const liveKeys = new Set(sources.map(s => s.key));
        if (!checkpoint.sourceKey) for (const key of stamps.keys()) if (!liveKeys.has(key)) stamps.delete(key);
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
  async function authorizationResult(raw) {
    const c = client, b = binding, g = gateway, event = normalizePushPayload(raw, Date.now());
    if (!usable() || !event || !readNotificationCategories(current(), storage)[event.kind]) return { status: 'rejected' };
    if (notificationDestination(store, current(), event.id, Date.now()) !== event.actionPath) return { status: 'rejected' };
    const result = await g.authorizationReceipt(event);
    return client === c && binding === b && gateway === g && usable() &&
      notificationDestination(store, current(), event.id, Date.now()) === event.actionPath ? result : { status: 'rejected' };
  }
  async function authorize(raw) { return (await authorizationResult(raw)).status === 'confirmed'; }
  // Only a current normal-store choice is accepted. No caller-supplied payload,
  // owner, workspace, source ID, event ID or action path enters this boundary.
  async function verifyReminder(token) {
    const choice = selectedChoice(token, 'reminder'), b = binding, epoch = generation;
    if (!choice || !usable() || verifying) return { status: 'rejected' };
    if (currentResult(verification)?.token === token && verification.status === 'unknown') return { status: 'unknown' };
    const event = choice.value.event;
    const valid = () => epoch === generation && binding === b && usable() && selectedChoice(token, 'reminder')?.signature === choice.signature;
    const finish = (status, receipt = {}) => {
      if (!valid()) return { status: 'rejected' };
      verification = { ...receipt, token, signature: choice.signature, status, eventId: event.id, sourceId: event.targetId,
        parentId: event.itemId ?? null, expiresAt: event.expiresAt, observedAt: Date.now() };
      return { ...verification };
    };
    verifying = true; changed();
    try {
      const confirmed = await store.confirmedNotificationSources();
      if (!valid()) return { status: 'rejected' };
      if (!confirmed.some(s => s.kind === event.kind && s.id === event.targetId)) return finish('pending');
      const key = JSON.stringify([event.kind, event.targetId]);
      await projectConfirmed({ workspace: b.workspace, session: b.session, sourceKey: key });
      if (!valid()) return { status: 'rejected' };
      const pendingKey = 'rakeezx-n44-projection-pending:' + JSON.stringify([b.context.ownerId, b.context.workspaceId, key]);
      if (storage.getItem(pendingKey)) return finish('unknown');
      if (projectionFailures.get(pendingKey) === choice.value.source) return finish('rejected');
      if (!stamps.has(key)) return finish('unknown');
      const registration = gateway.registration();
      const [subscription, consent] = await Promise.all([browser.existing(), browser.consent()]);
      if (!valid()) return { status: 'rejected' };
      const facts = { canonicalAck: true, sourceStamp: stamps.get(key), registrationId: registration?.registrationId,
        subscriptionPresent: !!subscription, workerBindingMatches: consent?.binding === registration?.registrationId && consent?.expiresAt >= registration?.expiresAt,
        consentTrue: b.serverConsent === true };
      if (!facts.subscriptionPresent || !facts.workerBindingMatches || !facts.consentTrue) return finish('rejected');
      const authorization = await authorizationResult({ id: event.id, kind: event.kind, expiresAt: event.expiresAt,
        actionPath: notificationDestination(store, current(), event.id, Date.now()) });
      const stillConfirmed = await store.confirmedNotificationSources();
      if (!stillConfirmed.some(s => s.kind === event.kind && s.id === event.targetId)) return finish('pending');
      return finish(authorization.status, { ...facts, authorization });
    } catch { return finish('unknown'); }
    finally { if (epoch === generation) { verifying = false; changed(); } }
  }
  async function readSourceStatus(token) {
    const choice = selectedChoice(token, 'source'), epoch = generation;
    if (!choice) return { status: 'rejected' };
    let result, timer;
    try {
      result = await Promise.race([store.readNotificationSourceStatus(choice.value.parentId), new Promise(resolve => {
        timer = setTimeout(() => resolve({ status: 'unknown' }), 15000);
      })]);
    } catch { result = { status: 'unknown' }; }
    finally { clearTimeout(timer); }
    if (epoch !== generation || selectedChoice(token, 'source')?.signature !== choice.signature) return { status: 'rejected' };
    sourceStatus = { ...result, token, signature: choice.signature }; changed(); return { ...sourceStatus };
  }
  const clicked = new Map();
  const onMessage = event => {
    // Only the actual controlling SW can request a bounded action; no page-message API.
    if (!event.source || event.source !== win.navigator.serviceWorker?.controller) return;
    if (event.data?.type === 'n44-subscription-stale') { invalidate(); return; }
    if (!event.ports?.[0] ||
      !['n44-push-ready', 'n44-push-check', 'n44-push-click'].includes(event.data?.type)) return;
    const port = event.ports[0];
    if (event.data.type === 'n44-push-ready') {
      // Terminal unavailability also answers ready: the action can explain a
      // denial visibly without another configuration/authorization request.
      port.postMessage({ ok: !disposed && !preparing && store.state?.ready === true }); port.close(); return;
    }
    void (async () => {
      const envelope = normalizePushEnvelope(event.data.event, Date.now());
      let ok = false;
      if (event.data.type === 'n44-push-check') ok = !!envelope && envelope.binding === gateway?.registration()?.registrationId && await authorize(envelope.event);
      else {
        for (const [id, value] of clicked) if (value.expiresAt <= Date.now()) clicked.delete(id);
        const key = envelope && envelope.binding + ':' + envelope.event.id;
        const eligible = () => !!envelope && usable() && envelope.binding === gateway?.registration()?.registrationId &&
          readNotificationCategories(current(), storage)[envelope.event.kind] &&
          notificationDestination(store, current(), envelope.event.id, Date.now()) === envelope.event.actionPath;
        if (eligible() && !clicked.has(key) && clicked.size < 100) {
          const action = (async () => {
            // applyAction performs the fresh server check and re-derives the
            // current destination/owner AFTER it resolves. Do not authorize twice.
            return (await client.applyAction(envelope.event)).status === 'action_applied';
          })();
          clicked.set(key, { expiresAt: Math.min(envelope.expiresAt, envelope.event.expiresAt), action });
        }
        ok = eligible() && await clicked.get(key)?.action === true && eligible();
        if (!ok && !disposed) toast('تعذّر فتح التذكير. تحقق من الحساب وصلاحية التذكير داخل التطبيق.', 'warn');
      }
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
    refresh, invalidate, verifyReminder, readSourceStatus, recheckConfiguration,
    normalUiSnapshot() {
      const options = normalChoices();
      return { ...options, verification: usable() ? currentResult(verification) : null, sourceStatus: currentResult(sourceStatus), verifying,
        canVerify: usable() };
    },
    async deviceOutcome() {
      const before=outcomeBinding();if(!before?.registration)return null;
      const epoch=generation,id=before.registration.registrationId;
      const outcome=await browser.deviceOutcome(id),after=outcomeBinding();
      return epoch===generation&&after?.binding===before.binding&&after.gateway===before.gateway&&after.pending===before.pending&&after.registration?.registrationId===id&&after.registration?.expiresAt===before.registration.expiresAt?outcome:null;
    },
    snapshot: () => ({ configRecheckAvailable: !disposed && configuration.enabled && !!current() && !binding && !pendingDisable && !disabling, configRecheckBusy: preparing, configRecheckCoolingDown: sameConfigAttempt(configAttempt) && Date.now() < configAttempt.retryAt,
      deviceOutcomeAvailable: !!outcomeBinding(), available: ready && matches(binding) && (gateway?.expiresAt() > Date.now() || status !== 'subscribed'), cleanupAvailable: !!pendingDisable && ownsCleanup(pendingDisable.binding), cleanupBusy: !!disabling, preferenceStopped: !!preferenceStop && ownsCleanup(preferenceStop), status, eligibility: { ...eligibility }, configOutcome: configOutcome() }),
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
          if (stop.cleanupOnly) {
            if (!await stop.gateway.remove()) return { status: 'cleanup_pending' };
            const existing = await browser.existing();
            if (!ownsCleanup(stop.binding) || existing && !await existing.unsubscribe()) return { status: 'cleanup_pending' };
          }
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
