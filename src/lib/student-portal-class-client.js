import {validGuidanceList,validGuidanceAck} from './student-portal-task-guidance-client.js';
/** AI: inactive class transport. Server authorization is mandatory; context is a fence, never authority. */
export const PORTAL_FIELDS = Object.freeze(['name', 'class', 'grades', 'required', 'completed', 'scheduled']);
const bindingKeys = ['ownerId', 'sessionId', 'leaseId', 'teachingId', 'classId', 'termId', 'contextRevision'];
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const revision = v => Number.isSafeInteger(v) && v >= 0;
const rosterRevision = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const deny = code => { const e = new Error(code); e.code = code; throw e; };
export function classContextKey(context) {
  if (context?.enabled !== true || !bindingKeys.every(k => id(context[k])) || !Number.isFinite(context.validUntil) || context.validUntil <= Date.now()) return null;
  return JSON.stringify(bindingKeys.map(k => context[k]));
}
export function validPortalFields(fields) {
  return exact(fields, PORTAL_FIELDS) && PORTAL_FIELDS.every(k => typeof fields[k] === 'boolean');
}
function validStudent(s) {
  return exact(s, ['studentId','enrollmentId','revision','label','hasActiveCode','credentialVersion','recoveryStatus','credential']) && id(s.studentId) && id(s.enrollmentId) && revision(s.revision) && typeof s.label === 'string' && s.label.length <= 200 && typeof s.hasActiveCode === 'boolean' && revision(s.credentialVersion) && ['recoverable','legacy','inactive'].includes(s.recoveryStatus) && (s.recoveryStatus==='recoverable' ? s.hasActiveCode && typeof s.credential==='string' && /^1[0-9]{5}$/.test(s.credential) : s.credential===null && (s.recoveryStatus==='legacy' ? s.hasActiveCode : !s.hasActiveCode));
}
export function createClassPortalClient({ request, getContext = () => null, timeoutMs = 15000 } = {}) {
  if (request !== undefined && typeof request !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) deny('invalid_configuration');
  let roster = null, rosterKey = null, pending = null, readSequence = 0;
  const readContext = () => { try { return getContext(); } catch { return null; } };
  const consumed = new Set(); // request IDs are one-shot, including uncertain outcomes; fresh review before retry.
  function context(teachingId) {
    const c = readContext(), key = classContextKey(c);
    if (!request || !key || c.teachingId !== teachingId) deny('unavailable');
    if (rosterKey !== key) roster = null;
    return { key, binding: Object.fromEntries(bindingKeys.map(k => [k, c[k]])) };
  }
  function current(c) { if (classContextKey(readContext()) !== c.key) deny('stale_context'); }
  async function call(action, teachingId, body, validate, c = context(teachingId)) {
    let timer; const controller = new AbortController();
    try {
      const result = await Promise.race([
        Promise.resolve().then(async () => { current(c); const response = await request('/api/n88/teacher/class/' + action, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-N88-CSRF': '1' }, body: JSON.stringify({ ...body, teachingId, binding: c.binding }) }),
          ok = response?.ok === true;
          current(c); return { ok, ack: ok ? await response.json() : null }; }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('uncertain')); }, timeoutMs); }),
      ]);
      current(c);
      if (!result.ok) deny('rejected');
      const ack = result.ack;
      if (!exact(ack, ['ack','binding','requestId','data']) || ack.ack !== true || !exact(ack.binding, bindingKeys) || bindingKeys.some(k => ack.binding[k] !== c.binding[k]) || ack.requestId !== (body.requestId ?? null) || !validate(ack.data)) deny('invalid_ack');
      return structuredClone(ack.data);
    } catch (e) {
      current(c);
      // Never expose transport errors/bodies, which may contain credentials or personal data.
      deny(['rejected','invalid_ack'].includes(e?.code) ? e.code : 'uncertain');
    } finally { clearTimeout(timer); controller.abort(); }
  }
  function snapshot(teachingId) {
    const c = context(teachingId);
    if (!roster || rosterKey !== c.key) deny('review_required');
    return { c, r: roster };
  }
  function mutate(teachingId, body, action, validate) {
    const { c, r } = snapshot(teachingId);
    if (!id(body.requestId) || consumed.has(body.requestId)) deny('review_required');
    if (pending) deny('busy');
    consumed.add(body.requestId); readSequence++;
    const work = call(action, teachingId, { ...body, expectedRosterRevision: r.rosterRevision }, validate, c);
    pending = work;
    return work.finally(() => { roster = null; if (pending === work) pending = null; });
  }
  return Object.freeze({
    async listGuidance(teachingId) {
      if(pending) deny('busy');
      return call('guidance-list',teachingId,{},validGuidanceList);
    },
    async saveGuidance(teachingId,guidance) {
      if(pending) deny('busy');
      const requestId=crypto.randomUUID(), c=context(teachingId);
      const work=call('guidance-save',teachingId,{requestId,guidance},d=>validGuidanceAck(d,guidance),c);
      pending=work;
      try{return await work;}finally{if(pending===work)pending=null;}
    },
    async listClass(teachingId) {
      if (pending) deny('busy');
      const c = context(teachingId), sequence = ++readSequence;
      roster = null;
      const data = await call('list', teachingId, {}, d => exact(d, ['classId','rosterRevision','policyRevision','students','visibility']) && d.classId === c.binding.classId && rosterRevision(d.rosterRevision) && revision(d.policyRevision) && validPortalFields(d.visibility) && Array.isArray(d.students) && d.students.length <= 2000 && d.students.every(validStudent) && new Set(d.students.map(s => s.studentId)).size === d.students.length && new Set(d.students.map(s => s.enrollmentId)).size === d.students.length, c);
      if (sequence !== readSequence) deny('review_required');
      roster = {...data,students:data.students.map(({credential,...s})=>s)}; rosterKey = c.key; return data;
    },
    issueMissingClassCodes(teachingId, body) {
      const { r } = snapshot(teachingId);
      if (!exact(body, ['requestId','expectedRosterRevision']) || body.expectedRosterRevision !== r.rosterRevision) deny('review_required');
      return mutate(teachingId, body, 'issue-missing', d => {
        if (!exact(d, ['requestId','created','skipped','failed','uncertain']) || d.requestId !== body.requestId || typeof d.uncertain !== 'boolean' || !['created','skipped','failed'].every(k => Array.isArray(d[k]))) return false;
        const seen = new Set();
        for (const kind of ['created','skipped','failed']) for (const entry of d[kind]) {
          const s = r.students.find(s => s.studentId === entry.studentId);
          if (!s || seen.has(s.studentId)) return false;
          seen.add(s.studentId);
          if (kind === 'created') {
            if (!exact(entry, ['studentId','enrollmentId','credentialVersion','credential']) || s.hasActiveCode || entry.enrollmentId !== s.enrollmentId || !revision(entry.credentialVersion) || entry.credentialVersion <= s.credentialVersion || typeof entry.credential !== 'string' || !/^1[0-9]{5}$/.test(entry.credential)) return false;
          } else if (!exact(entry, ['studentId','reason']) || !['existing','revoked','conflict','unavailable','not_current'].includes(entry.reason) || kind === 'skipped' && !(entry.reason === 'existing' && s.hasActiveCode || entry.reason === 'revoked' && !s.hasActiveCode && s.credentialVersion > 0)) return false;
        }
        return (d.uncertain || seen.size === r.students.length) && new Set(d.created.map(e => e.credential)).size === d.created.length;
      });
    },
    rotate: body => selective('rotate', body),
    revoke: body => selective('revoke', body),
    saveVisibility(teachingId, body) {
      const { r } = snapshot(teachingId);
      if (!exact(body, ['policyRevision','fields']) || body.policyRevision !== r.policyRevision || !validPortalFields(body.fields)) deny('review_required');
      const fields = structuredClone(body.fields);
      return mutate(teachingId, { ...body, fields, requestId: crypto.randomUUID() }, 'visibility', d => exact(d, ['updated','policyRevision','fields']) && d.updated === true && revision(d.policyRevision) && d.policyRevision > r.policyRevision && validPortalFields(d.fields) && PORTAL_FIELDS.every(k => fields[k] === d.fields[k]));
    },
  });
  function selective(action, body) {
    const teachingId = readContext()?.teachingId, { r } = snapshot(teachingId);
    if (!exact(body, ['studentId','enrollmentId','revision','credentialVersion','requestId'])) deny('review_required');
    const s = r.students.find(s => s.studentId === body.studentId);
    if (!s || s.credentialVersion < 1 || ['enrollmentId','revision','credentialVersion'].some(k => body[k] !== s[k])) deny('review_required');
    return mutate(teachingId, body, action, d => exact(d, action === 'rotate' ? ['rotated','studentId','enrollmentId','credentialVersion','credential'] : ['revoked','studentId','enrollmentId','credentialVersion']) && d[action === 'rotate' ? 'rotated' : 'revoked'] === true && d.studentId === s.studentId && d.enrollmentId === s.enrollmentId && revision(d.credentialVersion) && d.credentialVersion === s.credentialVersion + (action === 'rotate' ? 1 : 0) && (action !== 'rotate' || typeof d.credential === 'string' && /^1[0-9]{5}$/.test(d.credential)));
  }
}
