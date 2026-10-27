/** AI: uninstalled D107 host authorization / persistence contract.
 * No HTTP route, role installation, user enumeration or transport is provided.
 * Preview reservations model commit/cancel/unknown semantics, NEVER delivery.
 */
import { createHash } from 'node:crypto';
import { record, id, uuid } from './shared.mjs';
import { validatePublisherDraft, previewPublisherDelivery, PUBLISHER_AUDIENCES } from './publisher-model.mjs';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from '../../src/lib/notification-preferences.js';

const ACTIONS = ['prepare', 'edit', 'list', 'inspect', 'cancel', 'reservePreview', 'completePreview'];
const COMMANDS = {
  prepare: ['action', 'campaignId', 'idempotencyKey', 'audienceRef', 'draft'],
  edit: ['action', 'campaignId', 'idempotencyKey', 'expectedVersion', 'audienceRef', 'draft'],
  list: ['action'],
  inspect: ['action', 'campaignId'],
  cancel: ['action', 'campaignId', 'idempotencyKey'],
  reservePreview: ['action', 'campaignId', 'idempotencyKey'],
  completePreview: ['action', 'campaignId', 'idempotencyKey', 'permit', 'outcome'],
};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const subset = (values, allowed) => Array.isArray(values) && values.length > 0 &&
  new Set(values).size === values.length && values.every(value => allowed.includes(value));
const safeTime = n => Number.isSafeInteger(n) && n > 0;
function authorityValid(a, now) {
  return record(a, ['actorId', 'sessionId', 'workspaceId', 'policyId', 'sessionExpiresAt',
    'startsAt', 'expiresAt', 'actions', 'audiences', 'categories', 'channels', 'allowCritical', 'maxCampaigns']) &&
    [a.actorId, a.sessionId, a.workspaceId, a.policyId].every(id) &&
    [a.sessionExpiresAt, a.startsAt, a.expiresAt, now].every(safeTime) &&
    a.startsAt <= now && now < Math.min(a.sessionExpiresAt, a.expiresAt) &&
    subset(a.actions, ACTIONS) && subset(a.categories, NOTIFICATION_CATEGORIES) &&
    subset(a.channels, NOTIFICATION_CHANNELS) && typeof a.allowCritical === 'boolean' &&
    Number.isInteger(a.maxCampaigns) && a.maxCampaigns >= 1 && a.maxCampaigns <= 20 &&
    Array.isArray(a.audiences) && a.audiences.length > 0 && a.audiences.length <= 10 &&
    new Set(a.audiences.map(x => x.ref)).size === a.audiences.length && a.audiences.every(x =>
      record(x, ['ref', 'kind', 'maxRecipients']) && id(x.ref) && PUBLISHER_AUDIENCES.includes(x.kind) &&
      Number.isInteger(x.maxRecipients) && x.maxRecipients >= 1 && x.maxRecipients <= 100);
}
const publicCampaign = c => ({ status: c.state, campaignId: c.id, version: c.version ?? 1, startsAt: c.startsAt,
  expiresAt: c.expiresAt, recipientCount: c.recipientCount ?? 0,
  channelCounts: c.channelCounts ?? null, outcome: c.outcome ?? null, livePublished: false });
const observedCampaign = (c,now) => now >= c.expiresAt && ['prepared','scheduled','reserved_preview'].includes(c.state)
  ? {...c,state:c.state==='reserved_preview'?'uncertain_preview':'expired'} : c;

/** Required private ports:
 * hostAuthority.authorize(opaqueTransport, action) -> trusted identity/policy.
 * hostAuthority.isCurrent(snapshot, now) -> synchronous literal true, including
 * session, policy and role revocation, checked again by the COMMIT fence.
 * repository.atomic(workspaceId, work) -> serializable/durable COMMIT before ACK;
 * tx has time/get/put/receipt/remember/count/auditCount/audit/beforeCommit.
 * resolveSyntheticAudience is a synchronous preloaded fixture port, NOT command
 * recipient IDs or a real user lookup. It runs only after locked authorization.
 * No memory or permissive auth fallback. No concrete persistence contract is
 * installed by this source preparation; a real adapter needs separate acceptance.
 */
export function createPublisherAuthorityContract({ hostAuthority = null, repository = null,
  resolveSyntheticAudience = null, clock = Date.now } = {}) {
  const permits = new WeakMap();
  const current = (a, now) => authorityValid(a, now) && hostAuthority.isCurrent(a, now) === true;
  return Object.freeze({
    async execute(transport, raw) {
      // Even a privileged host cannot turn this contract Preview into fanout.
      if (raw?.action === 'publish') return { status: 'live_publish_unavailable' };
      if (!hostAuthority || typeof hostAuthority.authorize !== 'function' ||
          typeof hostAuthority.isCurrent !== 'function') return { status: 'host_authority_required' };
      if (!repository || typeof repository.atomic !== 'function') return { status: 'persistence_contract_required' };
      try {
        if (!ACTIONS.includes(raw?.action) || !record(raw, COMMANDS[raw.action]) ||
            raw.action !== 'list' && !uuid(raw.campaignId) || !['inspect','list'].includes(raw.action) && !id(raw.idempotencyKey) ||
            raw.action === 'edit' && (!Number.isSafeInteger(raw.expectedVersion) || raw.expectedVersion < 1)) return { status: 'rejected' };
        const permit = raw.permit;
        // Snapshot before async identity resolution; omit the opaque in-process
        // permit from cloning/digests. JSON copies cannot recreate its authority.
        const command = structuredClone(Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'permit')));
        const issued = command.action === 'completePreview' ? permits.get(permit) : null;
        if (command.action === 'completePreview' && (!issued ||
            !['accepted', 'not_accepted', 'unknown'].includes(command.outcome))) return { status: 'rejected' };
        const a = structuredClone(await hostAuthority.authorize(transport, command.action));
        if (!current(a, clock()) || !a.actions.includes(command.action)) return { status: 'denied' };
        if (issued && (issued.actorId !== a.actorId || issued.sessionId !== a.sessionId ||
            issued.workspaceId !== a.workspaceId || issued.policyId !== a.policyId ||
            issued.campaignId !== command.campaignId)) return { status: 'denied' };
        if (command.action === 'reservePreview') {
          if (typeof resolveSyntheticAudience !== 'function') return { status: 'audience_contract_required' };
        }
        const fingerprint = digest(command);
        const result = await repository.atomic(a.workspaceId, tx => {
          const now = tx.time(clock());
          if (!current(a, now)) return { status: 'denied' };
          // A missing fence port fails closed; checking before an async COMMIT
          // alone would allow a revoked/expired operator to retain a capability.
          tx.beforeCommit(() => { if (!current(a, clock())) throw Error('n44_admin_authority_changed'); });
          const visible = c => c.actorId === a.actorId && c.workspaceId === a.workspaceId && c.policyId === a.policyId &&
            a.categories.includes(c.draft.category) && c.expiresAt<=a.expiresAt && a.audiences.some(x => x.ref === c.audienceRef && x.kind === c.draft.audience && c.maxRecipients<=x.maxRecipients) &&
            (!c.draft.critical || a.allowCritical) && NOTIFICATION_CHANNELS.every(k => !c.draft.channels[k] || a.channels.includes(k));
          if (command.action === 'list') {
            if (typeof tx.list !== 'function') return {status:'persistence_contract_required'};
            const rows = tx.list();
            if (!Array.isArray(rows) || rows.length > 20) return {status:'capacity'};
            return {status:'local_drafts', campaigns:rows.filter(visible).map(c=>({...publicCampaign(observedCampaign(c,now)), title:c.draft.title, category:c.draft.category})), livePublished:false};
          }
          const receiptKey = JSON.stringify([a.actorId, command.idempotencyKey]);
          if (command.action !== 'inspect') {
            const old = tx.receipt(receiptKey);
            if (old) return old.fingerprint === fingerprint ? { status: 'duplicate', originalStatus: old.status } : { status: 'idempotency_conflict' };
            if (tx.auditCount() >= 200) return { status: 'capacity' };
          }
          const previous = tx.get(command.campaignId);
          if (command.action !== 'prepare' && (!previous || previous.actorId !== a.actorId ||
              previous.workspaceId !== a.workspaceId || previous.policyId !== a.policyId)) return { status: 'denied' };
          let c = previous && structuredClone(previous), status;
          const audience = a.audiences.find(x => x.ref === (command.audienceRef ?? c?.audienceRef));
          if (!audience) return { status: 'denied' };
          if (['prepare','edit'].includes(command.action)) {
            if (command.action === 'prepare' && previous) return { status: 'campaign_conflict' };
            if (command.action === 'prepare' && tx.count() >= a.maxCampaigns) return { status: 'capacity' };
            if (command.action === 'edit' && command.expectedVersion !== (previous.version ?? 1)) return {status:'version_conflict'};
            if (command.action === 'edit' && (!['prepared','scheduled'].includes(previous.state) || now >= previous.expiresAt)) return {status:'not_editable'};
            const checked = validatePublisherDraft(command.draft, now);
            if (checked.status !== 'valid') return { status: checked.status };
            if (command.draft.audience !== audience.kind || !a.categories.includes(command.draft.category) ||
                command.draft.critical && !a.allowCritical || NOTIFICATION_CHANNELS.some(k =>
                  command.draft.channels[k] && !a.channels.includes(k)) || checked.expiresAt > a.expiresAt)
              return { status: 'denied' };
            c = { id: command.campaignId, actorId: a.actorId, workspaceId: a.workspaceId, policyId: a.policyId,
              version: command.action === 'edit' ? (previous.version ?? 1) + 1 : 1,
              audienceRef: audience.ref, maxRecipients: audience.maxRecipients, draft: checked.draft,
              startsAt: checked.startsAt, expiresAt: checked.expiresAt,
              state: checked.startsAt > now ? 'scheduled' : 'prepared' };
            status = c.state;
          } else {
            // Every subsequent operation rechecks narrowed category/channel/
            // audience authority. A historical preparation is not a new grant.
            if (c.draft.audience !== audience.kind || !a.categories.includes(c.draft.category) ||
                c.draft.critical && !a.allowCritical || NOTIFICATION_CHANNELS.some(k =>
                  c.draft.channels[k] && !a.channels.includes(k)) || c.expiresAt > a.expiresAt ||
                c.maxRecipients > audience.maxRecipients) return { status: 'denied' };
            if (command.action === 'inspect') return {...publicCampaign(observedCampaign(c,now)),
              draft:structuredClone(c.draft),audienceRef:c.audienceRef,
              audit:typeof tx.auditRows === 'function' ? tx.auditRows().filter(row=>row.campaignId===c.id && row.actorId===a.actorId && row.workspaceId===a.workspaceId && row.policyId===a.policyId).slice(-50) : null};
            if (command.action === 'cancel') {
              if (!['prepared', 'scheduled'].includes(c.state)) return { status: 'too_late' };
              c.state = now >= c.expiresAt ? 'expired' : 'cancelled'; status = c.state;
            } else if (command.action === 'reservePreview') {
              if (!['prepared', 'scheduled'].includes(c.state)) return { status: 'duplicate' };
              if (now >= c.expiresAt) { c.state = 'expired'; status = c.state; }
              else {
                if (now < c.startsAt) return { status: 'scheduled' };
                const resolved = resolveSyntheticAudience({ workspaceId: a.workspaceId, campaignId: c.id,
                  audienceRef: c.audienceRef, kind: c.draft.audience });
                if (!record(resolved, ['audienceRef', 'kind', 'revision', 'recipients']) ||
                    !id(resolved.revision)) return { status: 'audience_unavailable' };
                const resolvedAudience = structuredClone(resolved), recipients = resolvedAudience.recipients;
                if (!Array.isArray(recipients) || recipients.length < 1 || recipients.length > 100 ||
                    recipients.some(r => !r || r.synthetic !== true || !id(r.key)) ||
                    new Set(recipients.map(r => r.key)).size !== recipients.length) return { status: 'audience_unavailable' };
                if (recipients.length > c.maxRecipients || resolvedAudience.audienceRef !== c.audienceRef ||
                    resolvedAudience.kind !== c.draft.audience) return { status: 'audience_unavailable' };
                const previews = recipients.map(r => previewPublisherDelivery({ ...c, state: 'previewed' }, r, now));
                if (previews.some(p => !['preview_only', 'suppressed'].includes(p.status))) return { status: 'audience_unavailable' };
                c.state = 'reserved_preview'; c.reservationKey = command.idempotencyKey;
                c.audienceRevision = resolvedAudience.revision;
                c.recipientCount = recipients.length;
                c.channelCounts = Object.fromEntries(NOTIFICATION_CHANNELS.map(k => [k, previews.filter(p => p.channels?.[k]).length]));
                status = c.state;
              }
            } else {
              if (c.state !== 'reserved_preview' || c.reservationKey !== issued.reservationKey) return { status: 'duplicate' };
              c.state = now >= c.expiresAt || command.outcome === 'unknown' ? 'uncertain_preview' : 'completed_preview';
              c.outcome = c.state === 'uncertain_preview' ? 'unknown' : command.outcome;
              status = c.state;
            }
            c.version = (c.version ?? 1) + 1;
          }
          tx.put(c.id, c);
          tx.audit({ actorId: a.actorId, sessionId: a.sessionId, workspaceId: a.workspaceId, policyId: a.policyId,
            campaignId: c.id, version:c.version, action: command.action, status, at: now, commandDigest: fingerprint });
          tx.remember(receiptKey, { fingerprint, status });
          return publicCampaign(c);
        });
        // Mint only AFTER the modeled durable reservation commit. No receipt or
        // caller-supplied object can be promoted into this capability.
        if (command.action === 'reservePreview' && result.status === 'reserved_preview') {
          const capability = Object.freeze({});
          permits.set(capability, { actorId: a.actorId, sessionId: a.sessionId, workspaceId: a.workspaceId,
            policyId: a.policyId, campaignId: command.campaignId, reservationKey: command.idempotencyKey });
          return { ...result, permit: capability };
        }
        if (issued && ['completed_preview', 'uncertain_preview', 'duplicate'].includes(result.status)) permits.delete(permit);
        return result;
      } catch { return { status: 'unavailable' }; }
    },
  });
}
