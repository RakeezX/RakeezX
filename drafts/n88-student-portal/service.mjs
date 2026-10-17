/** AI-authored inert server proposal. No hosted adapter, credentials or deployment entry. */
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';

export const POLICY = Object.freeze({ inviteMs: 15 * 60_000, sessionMs: 8 * 60 * 60_000,
  rateWindowMs: 60_000, rateLimit: 30, maxRateKeys: 10_000, retentionMs: 86_400_000 });
export const hash = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url'); // 256 bits, server only.
const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const denied = () => ({ status: 401, body: { error: 'unavailable' } });
const sameHash = (a, b) => typeof a === 'string' && a.length === 64 &&
  timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const cookie = (value, age) => `__Host-n88=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export const PRIVATE_HEADERS = Object.freeze({ 'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' });

const active = m => m && m.status === 'active' && !m.endDate && m.studentActive && m.classActive;
const bound = (a, b) => a.ownerId === b.ownerId && a.classId === b.classId &&
  a.studentId === b.studentId && a.enrollmentId === b.enrollmentId;
const revoke = (db, invite, now) => {
  invite.revokedAt = now;
  for (const s of db.sessions) if (s.inviteId === invite.id) s.revokedAt = now;
};
function prune(db, now) {
  db.sessions = db.sessions.filter(s => s.expiresAt > now && s.revokedAt == null);
  db.invites = db.invites.filter(i => i.expiresAt + POLICY.retentionMs > now || db.sessions.some(s => s.inviteId === i.id));
  db.rates = db.rates.filter(r => r.until > now);
}
function limited(db, key, now) {
  let rate = db.rates.find(r => r.key === key);
  if (!rate) {
    if (db.rates.length >= POLICY.maxRateKeys) return true;
    db.rates.push(rate = { key, count: 0, until: now + POLICY.rateWindowMs });
  }
  return ++rate.count > POLICY.rateLimit;
}
function projection(db, session) {
  const tasks = db.publications.filter(p => bound(p, session) && p.published === true)
    .map(p => ({ id: p.id, title: String(p.title).slice(0, 160), instruction: String(p.instruction || '').slice(0, 500),
      status: ['done', 'working', 'todo'].includes(p.status) ? p.status : 'todo',
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(p.deadline || '') ? p.deadline : null,
      ...(p.resultPublished === true && Number.isFinite(p.result?.value) && Number.isFinite(p.result?.max) &&
        p.result.max > 0 && p.result.value >= 0 && p.result.value <= p.result.max
        ? { result: { value: p.result.value, max: p.result.max } } : {}) }))
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.id.localeCompare(b.id));
  return { tasks, progress: { completed: tasks.filter(t => t.status === 'done').length, total: tasks.length } };
}

/** repository.transaction MUST serialize/lock membership, invite and session together,
 * recheck canonical membership/publication on reads, roll back exceptions and persist atomically.
 * verifyTeacher MUST independently validate current auth/session, never metadata/body owner.
 * sourceKey MUST come from a trusted ingress (not arbitrary forwarded/browser headers).
 * This service has no default auth/repository: production cannot accidentally use the fixture.
 */
export function createPortalService({ repository, verifyTeacher, origin, now = Date.now }) {
  if (!repository?.transaction || typeof verifyTeacher !== 'function' || new URL(origin).origin !== origin) throw Error('Explicit server adapters required');
  return async request => {
    let result;
    try { result = await repository.transaction(async db => {
      const time = now(); prune(db, time);
      if (!request.sourceKey || limited(db, 'source:' + hash(request.sourceKey), time)) return denied();
      const { path, method, headers = {}, body = {} } = request;
      if (headers['sec-fetch-site'] && headers['sec-fetch-site'] !== 'same-origin') return denied();
      // JSON + a non-simple custom header + exact Origin, no CORS. Applies to claim too.
      if (method === 'POST' && (headers.origin !== origin || headers['x-n88-csrf'] !== '1' ||
          headers['content-type'] !== 'application/json')) return denied();
      if (path.startsWith('/teacher/')) {
        const auth = await verifyTeacher(request); // inside transaction, current, fail closed
        if (!auth?.ownerId || !auth.sessionId || auth.current !== true ||
            limited(db, 'owner:' + hash(auth.ownerId), time)) return denied();
        const memberships = db.memberships.filter(m => m.ownerId === auth.ownerId && active(m));
        if (method === 'GET' && path === '/teacher/students') return { status: 200, body: { students: memberships.map(m => ({
          enrollmentId: m.enrollmentId, revision: m.revision, label: m.label })) } };
        const member = memberships.find(m => m.enrollmentId === body.enrollmentId && m.revision === body.revision);
        if (!member) return denied();
        if (method === 'POST' && path === '/teacher/issue') {
          for (const i of db.invites) if (bound(i, member) && i.revokedAt == null) revoke(db, i, time);
          const token = secret();
          const invite = { id: randomUUID(), ownerId: member.ownerId, classId: member.classId,
            studentId: member.studentId, enrollmentId: member.enrollmentId, membershipRevision: member.revision,
            tokenHash: hash(token), expiresAt: time + POLICY.inviteMs, consumedAt: null, revokedAt: null };
          db.invites.push(invite);
          return { status: 200, body: { inviteId: invite.id, token, expiresAt: invite.expiresAt } };
        }
        if (method === 'POST' && path === '/teacher/revoke') {
          // Enrollment scope deliberately revokes both pending invite and claimed sessions.
          for (const i of db.invites) if (bound(i, member)) revoke(db, i, time);
          return { status: 200, body: { revoked: true } };
        }
        return denied();
      }
      const sessionToken = /(?:^|;\s*)__Host-n88=([A-Za-z0-9_-]{43})(?:;|$)/.exec(headers.cookie || '')?.[1];
      if (method === 'POST' && path === '/claim') {
        // A new claim is an explicit student-context switch, even if it fails.
        // Never let a failed new invite silently restore the prior student's view.
        if (sessionToken) for (const s of db.sessions) if (sameHash(s.tokenHash, hash(sessionToken))) s.revokedAt = time;
        const claimDenied = () => ({ ...denied(), cookie: cookie('', 0) });
        if (!validSecret(body.token)) return claimDenied();
        const tokenHash = hash(body.token);
        if (limited(db, 'invite:' + tokenHash, time)) return claimDenied();
        const invite = db.invites.find(i => sameHash(i.tokenHash, tokenHash));
        const member = invite && db.memberships.find(m => bound(m, invite));
        if (!invite || invite.consumedAt != null || invite.revokedAt != null || invite.expiresAt <= time ||
            !active(member) || member.revision !== invite.membershipRevision) return claimDenied();
        invite.consumedAt = time;
        const token = secret();
        db.sessions.push({ id: randomUUID(), inviteId: invite.id, ownerId: invite.ownerId, classId: invite.classId,
          studentId: invite.studentId, enrollmentId: invite.enrollmentId, membershipRevision: member.revision,
          tokenHash: hash(token), expiresAt: time + POLICY.sessionMs, revokedAt: null });
        return { status: 200, body: { claimed: true }, cookie: cookie(token, POLICY.sessionMs / 1000) };
      }
      const session = sessionToken && db.sessions.find(s => sameHash(s.tokenHash, hash(sessionToken)));
      const member = session && db.memberships.find(m => bound(m, session));
      const invite = session && db.invites.find(i => i.id === session.inviteId && bound(i, session));
      if (!session || session.revokedAt != null || session.expiresAt <= time || !invite || invite.revokedAt != null ||
          !active(member) || member.revision !== session.membershipRevision) return denied();
      if (method === 'POST' && path === '/logout') {
        session.revokedAt = time;
        return { status: 200, body: { loggedOut: true }, cookie: cookie('', 0) };
      }
      if (method === 'GET' && path === '/read') return { status: 200, body: projection(db, session) };
      return denied();
    }); } catch { result = { status: 503, body: { error: 'unavailable' } }; }
    return { ...result, headers: { ...PRIVATE_HEADERS, ...(result.cookie ? { 'Set-Cookie': result.cookie } : {}) } };
  };
}
