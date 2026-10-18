import { normalizePushPayload } from '../../src/lib/notification-push-core.js';
import { notificationCategoryAllowed, LESSON_LEAD_MINUTES, DUE_STAGES } from '../../src/lib/notification-state.js';
import { LIMITS, result, id, deliveryKey, current, rate } from './shared.mjs';
import { issueCommittedPermit } from './committed-permit.mjs';

// Server must use the teacher's authoritative IANA zone; never server-local time.
// Existing app has no persisted quiet-window schema. This is an explicit draft
// adapter contract, not an assertion that localStorage preferences are synced.
export function quietNow(preferences, now) {
  try {
    if (!preferences || typeof preferences.timezone !== 'string') return null;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: preferences.timezone,
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const minute = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
    const q = preferences.quiet;
    if (q === null) return false; // Explicit no quiet window.
    if (!q || ![q.start, q.end].every(v => Number.isInteger(v) && v >= 0 && v < 1440)) return null;
    return q.start === q.end || (q.start < q.end ? minute >= q.start && minute < q.end : minute >= q.start || minute < q.end);
  } catch { return null; }
}
function eligible(tx, r, payload, now, recompute) {
  const ctx = tx.context(r.workspaceId, r.deviceId);
  if (r.state !== 'active' || r.expiresAt <= now || !current(ctx, r, now) ||
      ctx.pushConsent !== true || ctx.consentRevision !== r.consentRevision) return false;
  // Trusted synchronous resolver reads authoritative parent/child/ownership,
  // cancellation, current timing/stage and preferences inside this transaction.
  const p = ctx.preferences;
  if (!p || !LESSON_LEAD_MINUTES.includes(p.lessonMinutes) || !Array.isArray(p.dueDays) ||
      p.dueDays.some(day => !DUE_STAGES.includes(day)) ||
      typeof p.lesson !== 'boolean' || typeof p.due !== 'boolean' ||
      !notificationCategoryAllowed(payload, p) || quietNow(p, now) !== false) return false;
  const fresh = normalizePushPayload(recompute(tx, r, payload.id, now, p), now);
  return fresh && ['id', 'kind', 'expiresAt', 'actionPath'].every(k => fresh[k] === payload[k]);
}

/** Private scheduler capability only, NOT a public HTTP/admin/campaign handler.
 * No default sender; absent sender is disabled even if ports are misconfigured.
 * atomic is durable/serializable, with fencing + immutable-key constraints. */
export function createDeliveryBoundary({ repository, clock, recompute, sender = null, envelope = false }) {
  return Object.freeze({
    async deliver(ownerId, registrationId, raw) {
      try {
        if (!sender) return result('disabled');
        const input = normalizePushPayload(raw, clock());
        if (!id(ownerId) || !id(registrationId) || !input) return result('rejected');
        // One transaction reserves AND re-derives eligibility immediately before
        // the send permit. Persist `sending` before invoking any network port.
        const permit = await repository.atomic(ownerId, tx => {
          const now = tx.time(clock());
          const payload = normalizePushPayload(input, now);
          if (!payload) return result('expired');
          const r = tx.get('registrations', registrationId);
          if (!r) return result('suppressed');
          const key = deliveryKey(r.workspaceId, r.deviceId, payload.id);
          let job = tx.get('deliveries', key);
          if (job && (job.expiresAt !== payload.expiresAt || job.registrationId !== registrationId ||
              job.payload.kind !== payload.kind || job.payload.actionPath !== payload.actionPath)) return result('conflict');
          if (job?.state === 'sending') {
            if (now >= job.startedAt + LIMITS.uncertainMs) tx.set('deliveries', key, { ...job, state: 'uncertain' });
            return result('duplicate'); // Crash/timeout is never a safe retry.
          }
          if (job && job.state !== 'retry') return result('duplicate');
          if (!job && tx.rows('deliveries').length >= LIMITS.jobs) return result('limited');
          const suppress = () => tx.set('deliveries', key, job ? { ...job, state: 'suppressed' } :
            { key, registrationId, workspaceId: r.workspaceId, deviceId: r.deviceId,
              payload, expiresAt: payload.expiresAt, attempts: 0, state: 'suppressed', startedAt: now, nextAt: now });
          if (!eligible(tx, r, payload, now, recompute)) {
            suppress(); // Persist dropped stages too: no later noisy catch-up.
            return result('suppressed');
          }
          if (job && now < job.nextAt) return result('backoff');
          if ((job?.attempts ?? 0) >= LIMITS.attempts) return result('exhausted');
          // Atomic budgets include retries; rejected subsequent budgets may
          // conservatively consume earlier ones. No successful debit is undone.
          if (!rate(tx, `hour:${r.deviceId}`, now, 3600_000, LIMITS.sendsPerHour) ||
              !rate(tx, `day:${r.deviceId}`, now, 86400_000, LIMITS.sendsPerDay) ||
              !rate(tx, 'owner-day', now, 86400_000, LIMITS.ownerSendsPerDay)) {
            suppress(); return result('limited');
          }
          job = { key, registrationId, workspaceId: r.workspaceId, deviceId: r.deviceId,
            payload, expiresAt: payload.expiresAt, attempts: (job?.attempts ?? 0) + 1,
            state: 'sending', startedAt: now, nextAt: now };
          tx.set('deliveries', key, job);
          return { key, attempt: job.attempts, sealed: r.sealed, payload,
            fingerprint: r.fingerprint, bindingFingerprint: r.bindingFingerprint,
            ...(envelope ? {binding:{id:r.registrationId,expiresAt:Math.min(r.expiresAt,tx.context(r.workspaceId,r.deviceId).sessionExpiresAt)}} : {}) };
        });
        if (permit.status) return permit;
        let outcome;
        try { outcome = await sender.send(issueCommittedPermit({ sealed: permit.sealed, payload: permit.payload,
          fingerprint: permit.fingerprint, bindingFingerprint: permit.bindingFingerprint, ...(permit.binding ? {binding:permit.binding} : {}) })); }
        catch { outcome = 'uncertain'; }
        return await repository.atomic(ownerId, tx => {
          const now = tx.time(clock()), job = tx.get('deliveries', permit.key);
          if (!job || job.attempts !== permit.attempt || job.state !== 'sending') return result('uncertain');
          // Only an adapter-certified definitive non-acceptance may retry.
          let state = outcome === 'accepted' ? 'sent' : outcome === 'not_accepted_retryable' ? 'retry' :
            outcome === 404 || outcome === 410 ? 'dead' : 'uncertain';
          const r = tx.get('registrations', registrationId);
          if (state === 'dead' && r) {
            tx.releaseEndpoint(r.fingerprint, registrationId);
            tx.set('registrations', registrationId, { ...r, state: 'dead', sealed: null, fingerprint: null, bindingFingerprint: null });
          }
          if (state === 'retry' && (!r || !eligible(tx, r, job.payload, now, recompute) ||
              job.attempts >= LIMITS.attempts || now >= job.expiresAt)) state = 'suppressed';
          const nextAt = now + LIMITS.retryBaseMs * 2 ** (job.attempts - 1);
          if (state === 'retry' && nextAt >= job.expiresAt) state = 'suppressed';
          tx.set('deliveries', permit.key, { ...job, state, nextAt });
          return result(state);
        });
      } catch { return result('unavailable'); }
    },
    async cleanup(ownerId) {
      try {
        if (!id(ownerId)) return result('rejected');
        return await repository.atomic(ownerId, tx => {
          const now = tx.time(clock());
          for (const r of tx.rows('registrations')) {
            const ctx = tx.context(r.workspaceId, r.deviceId);
            if (r.state === 'active' && (r.expiresAt <= now || !current(ctx, r, now) ||
                ctx.pushConsent !== true || ctx.consentRevision !== r.consentRevision)) {
              tx.releaseEndpoint(r.fingerprint, r.registrationId);
              tx.set('registrations', r.registrationId, { ...r, state: 'revoked', sealed: null, fingerprint: null, bindingFingerprint: null });
            }
            if (r.expiresAt + LIMITS.receiptMs <= now) tx.delete('registrations', r.registrationId);
          }
          for (const job of tx.rows('deliveries')) {
            if (job.expiresAt + LIMITS.receiptMs <= now) tx.delete('deliveries', job.key);
            else if (job.state === 'sending' && now >= job.startedAt + LIMITS.uncertainMs)
              tx.set('deliveries', job.key, { ...job, state: 'uncertain' });
          }
          for (const [key, budget] of tx.entries('budgets')) if (budget.expiresAt <= now) tx.delete('budgets', key);
          return result('cleaned');
        });
      } catch { return result('unavailable'); }
    },
  });
}
