/** AI: INACTIVE server proposal. Explicit adapters; never imported by Production. */
import { randomBytes, randomUUID, randomInt, createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const POLICY = Object.freeze({ sessionMs: 8 * 60 * 60_000, rateWindowMs: 15 * 60_000,
  sourceAttempts: 6, contextAttempts: 30, globalAttempts: 100,
  failureWindowMs: 86_400_000, contextFailures: 60, globalFailures: 500, maxRateKeys: 10_000 });
export const hash = value => createHash('sha256').update(value).digest('hex'); // high entropy sessions ONLY
export const generateCode = () => String(randomInt(10_000)).padStart(4, '0');
const secret = () => randomBytes(32).toString('base64url');
const denied = () => ({ status: 401, body: { error: 'unavailable' } });
export const PRIVATE_HEADERS = Object.freeze({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' });
const active = m => m && m.status === 'active' && !m.endDate && m.studentActive && m.classActive;
const bound = (a, b) => a.ownerId === b.ownerId && a.classId === b.classId && a.studentId === b.studentId && a.enrollmentId === b.enrollmentId;
const revoke = (db, c, time) => { c.revokedAt = time; for (const s of db.sessions) if (s.credentialId === c.id) s.revokedAt = time; };
function bucket(db, key, time, window) {
  let b = db.rates.find(r => r.key === key);
  if (!b) { if (db.rates.length >= POLICY.maxRateKeys) return null;
    db.rates.push(b = { key, count: 0, until: time + window }); }
  return b;
}
function projection(db, session) {
  const tasks = db.publications.filter(p => bound(p, session) && p.published === true)
    .map(p => ({ id: p.id, title: String(p.title).slice(0, 160), instruction: String(p.instruction || '').slice(0, 500),
      status: ['done', 'working', 'todo'].includes(p.status) ? p.status : 'todo',
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(p.deadline || '') ? p.deadline : null }))
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.id.localeCompare(b.id));
  return { tasks, progress: { completed: tasks.filter(t => t.status === 'done').length, total: tasks.length } };
}
/** transaction: durable shared serializable commit/rollback of rates + canonical membership,
 * credential/version/session/publication. Memory fake is NOT a hosting implementation.
 * verifyIngress: server socket or authenticated ingress with client headers stripped;
 * never supplied body/sourceKey/X-Forwarded-For. verifyTeacher: CURRENT independent auth.
 * secretKey: injected server-only >=256-bit key; key rotation needs a revocation plan.
 */
export function createPortalService({ repository, verifyTeacher, verifyIngress, secretKey, origin, now = Date.now, newCode = generateCode }) {
  if (!repository?.transaction || typeof verifyTeacher !== 'function' || typeof verifyIngress !== 'function' ||
      !Buffer.isBuffer(secretKey) || secretKey.length < 32 || new URL(origin).origin !== origin) throw Error('Explicit secure server adapters required');
  const digest = (domain, ...parts) => createHmac('sha256', secretKey).update(JSON.stringify(['n88-v2', domain, ...parts])).digest('hex');
  const cookie = (namespace, token, age) => `__Secure-n88=${token}; Path=/api/n88/s/${namespace}; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  return async request => {
    let result;
    try {
      const ingress = await verifyIngress(request);
      if (!ingress?.clientKey) return { ...denied(), headers: PRIVATE_HEADERS };
      result = await repository.transaction(async db => {
        const time = now(); db.rates = db.rates.filter(r => r.until > time);
        db.sessions = db.sessions.filter(s => s.expiresAt > time && s.revokedAt == null);
        const { path, method, headers = {}, body = {} } = request;
        if (headers['sec-fetch-site'] && headers['sec-fetch-site'] !== 'same-origin') return denied();
        if (method === 'POST' && (headers.origin !== origin || headers['x-n88-csrf'] !== '1' || headers['content-type'] !== 'application/json')) return denied();
        if (path.startsWith('/teacher/')) {
          const auth = await verifyTeacher(request);
          if (!auth?.ownerId || !auth.sessionId || auth.current !== true) return denied();
          const context = db.contexts.find(c => c.ownerId === auth.ownerId && c.active);
          if (!context) return denied();
          const members = db.memberships.filter(m => m.ownerId === auth.ownerId && active(m));
          if (method === 'GET' && path === '/teacher/students') return { status: 200, body: { namespace: context.namespace,
            students: members.map(m => ({ enrollmentId: m.enrollmentId, revision: m.revision, label: m.label,
              publications: db.publications.filter(p => bound(p, m)).map(p => ({ id: p.id, title: p.title, status: p.status, published: p.published })) })) } };
          const member = members.find(m => m.enrollmentId === body.enrollmentId && m.revision === body.revision);
          if (!member) return denied();
          if (method === 'POST' && path === '/teacher/issue') {
            // Serializable repository reservation BEFORE revocation. Tombstones reserve old
            // values too: at most 10,000 lifetime issuances/owner, possibly earlier refusal
            // after 128 random collisions. Never scan/fallback or overwrite a student.
            let code, verifier;
            for (let attempt = 0; attempt < 128; attempt++) {
              code = newCode(); if (typeof code !== 'string' || !/^[0-9]{4}$/.test(code)) throw Error('Invalid generator');
              verifier = digest('code', context.namespace, code);
              if (!db.credentials.some(c => c.namespace === context.namespace && c.verifier === verifier)) break;
              code = null;
            }
            if (!code) throw Error('Collision budget');
            for (const c of db.credentials) if (bound(c, member) && c.revokedAt == null) revoke(db, c, time);
            const version = Math.max(0, ...db.credentials.filter(c => bound(c, member)).map(c => c.version)) + 1;
            const entrySecret = secret(), entryVerifier = digest('entry', entrySecret);
            if (db.credentials.some(c => c.entryVerifier === entryVerifier)) throw Error('Entry collision');
            db.credentials.push({ id: randomUUID(), ownerId: member.ownerId, classId: member.classId, studentId: member.studentId,
              enrollmentId: member.enrollmentId, membershipRevision: member.revision, namespace: context.namespace,
              verifier, entryVerifier, version, revokedAt: null });
            return { status: 200, body: { code, entrySecret, namespace: context.namespace } }; // once, never retrievable
          }
          if (method === 'POST' && path === '/teacher/revoke') {
            for (const c of db.credentials) if (bound(c, member)) revoke(db, c, time);
            return { status: 200, body: { revoked: true } };
          }
          if (method === 'POST' && path === '/teacher/publish') {
            const p = db.publications.find(p => p.id === body.publicationId && bound(p, member));
            if (!p || typeof body.published !== 'boolean' || !['todo', 'working', 'done'].includes(body.status) ||
                typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160) return denied();
            p.title = body.title.trim(); p.status = body.status; p.published = body.published;
            return { status: 200, body: { updated: true } };
          }
          return denied();
        }
        const route = /^\/s\/([A-Za-z0-9_-]{43})\/(claim|read|logout)$/.exec(path);
        if (!route) return denied();
        const [, entrySecret, action] = route;
        // Private bookmarkable route is a 256-bit credential, NOT teacher/public ID.
        // Only its server-keyed verifier is retained in repository/session/rate state.
        const entryVerifier = digest('entry', entrySecret);
        const token = /(?:^|;\s*)__Secure-n88=([A-Za-z0-9_-]{43})(?:;|$)/.exec(headers.cookie || '')?.[1];
        const clearDenied = () => ({ ...denied(), cookie: cookie(entrySecret, '', 0) });
        if (method === 'POST' && action === 'claim') {
          // ALL guesses: budgets BEFORE context/credential lookup. No supplied-code buckets.
          const attempts = [[digest('source', ingress.clientKey), POLICY.sourceAttempts],
            [digest('context', entryVerifier), POLICY.contextAttempts], ['global', POLICY.globalAttempts]]
            .map(([key, max]) => ({ b: bucket(db, key, time, POLICY.rateWindowMs), max }));
          const failures = [[digest('context-failure', entryVerifier), POLICY.contextFailures], ['global-failure', POLICY.globalFailures]]
            .map(([key, max]) => ({ b: bucket(db, key, time, POLICY.failureWindowMs), max }));
          const blocked = [...attempts, ...failures].some(({ b, max }) => !b || b.count >= max);
          if (token) for (const s of db.sessions) if (s.entryVerifier === entryVerifier && s.tokenHash === hash(token)) s.revokedAt = time;
          if (blocked) return clearDenied();
          attempts.forEach(({ b }) => b.count++);
          const fail = () => { failures.forEach(({ b }) => b.count++); return clearDenied(); };
          if (typeof body.code !== 'string' || !/^[0-9]{4}$/.test(body.code)) return fail();
          const credential = db.credentials.find(c => c.entryVerifier === entryVerifier && c.revokedAt == null);
          const context = credential && db.contexts.find(c => c.namespace === credential.namespace && c.active);
          const verifier = digest('code', credential?.namespace || '', body.code);
          const member = credential && db.memberships.find(m => bound(m, credential));
          const matches = timingSafeEqual(Buffer.from(credential?.verifier || '0'.repeat(64), 'hex'), Buffer.from(verifier, 'hex'));
          if (!context || !credential || !matches || context.ownerId !== credential.ownerId || !active(member) || member.revision !== credential.membershipRevision) return fail();
          const sessionToken = secret();
          db.sessions.push({ ...Object.fromEntries(['ownerId','classId','studentId','enrollmentId'].map(k => [k, member[k]])),
            id: randomUUID(), credentialId: credential.id, version: credential.version, membershipRevision: member.revision,
            namespace: credential.namespace, entryVerifier, tokenHash: hash(sessionToken), expiresAt: time + POLICY.sessionMs, revokedAt: null });
          return { status: 200, body: { claimed: true }, cookie: cookie(entrySecret, sessionToken, POLICY.sessionMs / 1000) };
        }
        const s = token && db.sessions.find(s => s.entryVerifier === entryVerifier && s.tokenHash === hash(token));
        if (method === 'POST' && action === 'logout') {
          if (s) s.revokedAt = time;
          return { status: 200, body: { loggedOut: true }, cookie: cookie(entrySecret, '', 0) };
        }
        const c = s && db.credentials.find(c => c.id === s.credentialId && bound(c, s) && c.entryVerifier === entryVerifier && c.namespace === s.namespace);
        const member = s && db.memberships.find(m => bound(m, s));
        const context = s && db.contexts.find(c => c.namespace === s.namespace && c.active);
        if (!s || s.revokedAt != null || s.expiresAt <= time || !c || c.revokedAt != null || c.version !== s.version ||
            !context || context.ownerId !== s.ownerId || !active(member) || member.revision !== s.membershipRevision) return clearDenied();
        if (method === 'GET' && action === 'read') return { status: 200, body: projection(db, s) };
        return denied();
      });
    } catch { result = { status: 503, body: { error: 'unavailable' } }; }
    return { ...result, headers: { ...PRIVATE_HEADERS, ...(result.cookie ? { 'Set-Cookie': result.cookie } : {}) } };
  };
}
