/** AI: inactive universal student transport; no identity lookup, storage or diagnostics. */
import { normalizeDateTimeDigits } from './rakeez-datetime-values.js';

export const normalizeStudentCode = value => normalizeDateTimeDigits(value).replace(/ /g, '');
export const validStudentCode = value => typeof value === 'string' && /^1[0-9]{11}$/.test(value);
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
      result.work[section] = list(data.work[section], { id: text, title: text, instruction: text, deadline: text, status: text, startDate: v => v === null || text(v), dueDate: v => v === null || text(v), completionState: v => ['unrecorded','regular','late'].includes(v) }, ['id', 'title']);
    }
  }
  return result;
}

export function createUnifiedStudentPortalClient({ fetch: send = globalThis.fetch } = {}) {
  if (typeof send !== 'function') throw fail();
  let generation = 0, controller, disposed = false;
  function invalidate() { generation++; controller?.abort(); controller = null; }
  async function call(action, body) {
    if (disposed) throw fail();
    invalidate(); const checkpoint = generation;
    const owned = controller = new AbortController();
    const timeout = setTimeout(() => owned.abort(), 15000);
    try {
      const response = await send('/api/n88/student/' + action, {
        method: action === 'read' ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: owned.signal,
        headers: action === 'read' ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-N88-CSRF': '1' },
        ...(action === 'read' ? {} : { body: JSON.stringify(body) })
      });
      body = null;
      if (checkpoint !== generation) throw fail('stale');
      if (!response.ok) {
        const retry = Number(response.headers?.get('Retry-After'));
        throw fail(response.status === 429 ? 'rate' : [401, 403, 410].includes(response.status) ? 'session' : 'unavailable', response.status === 429 ? Math.min(300, Math.max(1, Number.isFinite(retry) ? retry : 30)) : 0);
      }
      if (action === 'end' || action === 'claim') return null;
      const data = await response.json();
      if (checkpoint !== generation) throw fail('stale');
      return projectUnifiedStudentData(data);
    } catch (error) {
      // Never forward server bodies, transport messages, credentials or payloads.
      throw fail(checkpoint !== generation ? 'stale' : ['rate', 'session'].includes(error?.kind) ? error.kind : 'unavailable', error?.retryAfter || 0);
    } finally { clearTimeout(timeout); body = null; if (checkpoint === generation) controller = null; }
  }
  return Object.freeze({
    claim(value) { let code = normalizeStudentCode(value); if (!validStudentCode(code)) return Promise.reject(fail('format')); const pending = call('claim', { code }).then(() => call('read')); code = ''; return pending; },
    read: () => call('read'), end: () => call('end', {}), invalidate, dispose() { disposed = true; invalidate(); }
  });
}
