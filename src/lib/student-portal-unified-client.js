/** AI: universal student transport; no identity lookup or storage. Finite opt-in diagnostics only. */
import { normalizeDateTimeDigits } from './rakeez-datetime-values.js';

export const normalizeStudentCode = value => typeof value === 'string' ? normalizeDateTimeDigits(value).replace(/ /g, '') : '';
export const validStudentCode = value => typeof value === 'string' && /^1[0-9]{5}$/.test(value);
const fail = (kind = 'unavailable', retryAfter = 0) => Object.assign(new Error('Student access unavailable'), { kind, retryAfter });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length <= 2000;
const number = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
function fields(source, rules) {
  if (!object(source)) throw fail();
  const result = {};
  for (const [key, valid] of Object.entries(rules)) if (Object.hasOwn(source, key)) {
    if (!valid(source[key])) throw fail();
    result[key] = source[key];
  }
  return result;
}
function list(value, rules, required = []) {
  if (!Array.isArray(value) || value.length > 500) throw fail();
  return value.map(item => {
    const result = fields(item, rules);
    if (required.some(key => !Object.hasOwn(result, key))) throw fail();
    return result;
  });
}
/** Fresh allowlisted projection: omitted sections stay omitted; null is never coerced. */
export function projectUnifiedStudentData(data) {
  if (!object(data) || data.version !== 'n88-student-v3') throw fail();
  const result = { version: data.version };
  if (Object.hasOwn(data, 'profile')) result.profile = fields(data.profile, { name: text, classLabel: text });
  if (Object.hasOwn(data, 'grades')) {
    if (!object(data.grades)) throw fail();
    result.grades = { items: list(data.grades.items, { id: text, label: text, value: number, max: number, status: text }, ['id', 'label', 'value', 'max']) };
    if (Object.hasOwn(data.grades, 'total')) {
      result.grades.total = fields(data.grades.total, { earned: number, possible: number });
      if (!Object.hasOwn(result.grades.total, 'earned') || !Object.hasOwn(result.grades.total, 'possible')) throw fail();
    }
  }
  if (Object.hasOwn(data, 'work')) {
    if (!object(data.work)) throw fail();
    result.work = {};
    for (const section of ['required', 'completed', 'scheduled']) if (Object.hasOwn(data.work, section)) {
      result.work[section] = list(data.work[section], { id: text, title: text, instruction: text, executionInstructions: v=>text(v)&&v.length<=400, deliveryInstructions: v=>text(v)&&v.length<=400, deadline: text, status: text, startDate: v => v === null || text(v), dueDate: v => v === null || text(v), completionState: v => ['unrecorded','regular','late'].includes(v) }, ['id', 'title']);
    }
  }
  return result;
}

export function createUnifiedStudentPortalClient({ fetch: send = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof send !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) throw fail();
  let generation = 0, retirement = 0, controller, disposed = false, lastDiagnostic = null, retireDiagnostic;
  const reasons = ['visible','hidden','pagehide','disposed','context','superseded','deadline'];
  const visibility = () => globalThis.document?.visibilityState === 'hidden' ? 'hidden' : 'visible';
  function cancelRequest(reason = 'superseded') {
    retireDiagnostic?.(reason); retireDiagnostic = null;
    generation++; controller?.abort(); controller = null;
  }
  function invalidate(reason = 'context') { retirement++; cancelRequest(reasons.includes(reason) ? reason : 'context'); }
  async function call(action, body, phase = 'manual') {
    if (disposed) throw fail();
    cancelRequest(); const checkpoint = generation;
    const owned = controller = new AbortController(), started = performance.now();
    let timedOut = false, statusClass = 'none', recorded = false;
    const record = (outcome, reason = 'visible') => {
      if (recorded || !['read','end'].includes(action)) return;
      recorded = true;
      lastDiagnostic = Object.freeze({action, phase: action === 'end' ? 'end' : ['initial','return','manual'].includes(phase) ? phase : 'manual', outcome,
        httpStatusClass: statusClass, elapsedMs: Math.min(15000, Math.max(0, Math.floor((performance.now() - started) / 250) * 250)),
        visibility: visibility(), retirementReason: reason});
    };
    retireDiagnostic = reason => record(reason === 'deadline' ? 'timeout' : 'stale', reason);
    const timeout = setTimeout(() => { timedOut = true; owned.abort(); }, timeoutMs);
    const withinDeadline = () => {
      if (owned.signal.aborted || performance.now() - started >= timeoutMs) {
        timedOut = true; owned.abort(); throw fail('timeout');
      }
    };
    try {
      return await Promise.race([ (async () => {
      const response = await send('/api/n88/student/' + action, {
        method: action === 'read' ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: owned.signal,
        headers: action === 'read' ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-N88-CSRF': '1' },
        ...(action === 'read' ? {} : { body: JSON.stringify(body) })
      });
      body = null;
      if (checkpoint !== generation) throw fail('stale');
      withinDeadline(); // A suspended tab may resume promise jobs before its timer.
      statusClass = response.status >= 200 && response.status < 300 ? '2xx' : response.status >= 400 && response.status < 500 ? '4xx' : response.status >= 500 && response.status < 600 ? '5xx' : 'other';
      if (!response.ok || action === 'read' && response.status !== 200) {
        const retry = Number(response.headers?.get('Retry-After'));
        throw fail(response.status === 429 ? 'rate' : [401, 403, 410].includes(response.status) ? 'session' : 'unavailable', response.status === 429 ? Math.min(300, Math.max(1, Number.isFinite(retry) ? retry : 30)) : 0);
      }
      if (action === 'end' || action === 'claim') { record('success'); return null; }
      const data = await response.json();
      if (checkpoint !== generation) throw fail('stale');
      withinDeadline();
      const projected = projectUnifiedStudentData(data); record('success'); return projected;
      })(), new Promise((_, reject) => { owned.signal.addEventListener('abort', () => reject(fail()), { once: true }); }) ]);
    } catch (error) {
      // Never forward server bodies, transport messages, credentials or payloads.
      const kind = checkpoint !== generation ? 'stale' : timedOut ? 'timeout' : ['rate', 'session'].includes(error?.kind) ? error.kind : 'unavailable';
      record(kind === 'session' ? 'denied' : kind, timedOut ? 'deadline' : 'visible');
      throw fail(kind, error?.retryAfter || 0);
    } finally { clearTimeout(timeout); body = null; if (checkpoint === generation) { controller = null; retireDiagnostic = null; } }
  }
  return Object.freeze({
    async claim(value) {
      let code = normalizeStudentCode(value);
      if (!validStudentCode(code)) throw fail('format');
      const context = retirement, pending = call('claim', { code }), checkpoint = generation;
      code = ''; value = null;
      try { await pending; }
      catch (error) {
        // A lost response may already have set the HttpOnly cookie. Only an
        // explicit denial is a rejected code; never retry this POST internally.
        if (error.kind === 'stale') throw error;
        throw Object.assign(error, { claimState: ['session', 'rate'].includes(error.kind) ? 'rejected' : 'uncertain' });
      }
      if (disposed || context !== retirement || checkpoint !== generation) throw fail('stale');
      try { return await call('read'); }
      catch (error) { throw Object.assign(error, { claimState: 'accepted' }); }
    },
    captureContext:()=>retirement,isContextCurrent:context=>!disposed&&context===retirement,
    getDiagnostic: () => lastDiagnostic ? {...lastDiagnostic} : null,
    read: ({phase = 'manual'} = {}) => call('read', undefined, phase), end: () => call('end', {}, 'end'), invalidate, dispose() { disposed = true; invalidate('disposed'); }
  });
}
