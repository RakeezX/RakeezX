/** AI: universal student transport; no identity lookup or private projection storage. Finite opt-in diagnostics only. */
import { normalizeDateTimeDigits } from './rakeez-datetime-values.js';

export const normalizeStudentCode = value => typeof value === 'string' ? normalizeDateTimeDigits(value).replace(/ /g, '') : '';
export const validStudentCode = value => typeof value === 'string' && /^1[0-9]{5}$/.test(value);
const fail = (kind = 'unavailable', retryAfter = 0) => Object.assign(new Error('Student access unavailable'), { kind, retryAfter });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length <= 2000;
const number = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
// AI: duplicate finite wire allowlist at the untrusted browser boundary. No new
// startup module; never copy arbitrary headers or retain a previous GET's phases.
export function parseStudentReadPhases(value) {
  try {
    if(typeof value!=='string'||value.length>512)return null;
    const p=JSON.parse(value),names=['pool','boundary','snapshot','sync','canonical','visibility','guidance','projection','commit','total'];
    if(!object(p)||Object.keys(p).length!==names.length||!names.every(k=>Object.hasOwn(p,k)&&Number.isInteger(p[k])&&p[k]>=0&&p[k]<=20000&&p[k]%250===0))return null;
    return Object.freeze(Object.fromEntries(names.map(k=>[k,p[k]])));
  }catch{return null;}
}
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

// Rejection-only same-origin retirement epoch. No identity or projection is stored.
// p=pending mutation, s=neutral/acknowledged generation, u=uncertain. Never a commit receipt or access grant.
const RETIREMENT_KEY = 'rakeez.n88.student-retirement.v1';
const validEpoch = value => typeof value === 'string' && /^[psu]:[a-f0-9]{32}$/.test(value);
function createRetirementObserver(onPeerChange) {
  const win=globalThis.window;let storage,known=null,usable=false,closed=false,owned=null;
  const epoch=phase=>phase+':'+globalThis.crypto.randomUUID().replaceAll('-','');
  try { if(win){storage=win.localStorage;const initial=storage.getItem(RETIREMENT_KEY);if(initial===null){known=epoch('s');storage.setItem(RETIREMENT_KEY,known);}else known=validEpoch(initial)?initial:null;usable=validEpoch(known);} } catch {}
  const sync=()=>{
    if(closed||!storage)return false;
    try{const raw=storage.getItem(RETIREMENT_KEY),current=validEpoch(raw)?raw:null,nextUsable=validEpoch(raw);if(current===known&&nextUsable===usable)return false;known=current;usable=nextUsable;onPeerChange();return true;}
    catch{const changed=usable;usable=false;if(changed)onPeerChange();return changed;}
  };
  const event=e=>{if(e.key===RETIREMENT_KEY||e.key===null){const changed=sync();if(!changed)onPeerChange();}}; // Forged/malformed events can only purge.
  win?.addEventListener('storage',event);
  const publish=phase=>{try{const next=epoch(phase);storage.setItem(RETIREMENT_KEY,next);known=next;usable=true;return next;}catch{usable=false;return null;}};
  return {
    sync,
    canRetain(){sync();return usable&&known?.startsWith('s:');},
    begin(){sync();owned=storage?publish('p'):null;return owned;},
    finish(token,acknowledged){if(!storage||token!==owned)return;try{if(token&&storage.getItem(RETIREMENT_KEY)===token)publish(acknowledged?'s':'u');else if(token)publish('u');}finally{owned=null;}},
    abandon(){if(owned)publish('u');owned=null;},
    dispose(){if(owned)publish('u');closed=true;win?.removeEventListener('storage',event);owned=null;storage=null;known=null;usable=false;}
  };
}

export function createUnifiedStudentPortalClient({ fetch: send = globalThis.fetch, timeoutMs = 15000, bindingProof=null } = {}) {
  if (typeof send !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) throw fail();
  let generation = 0, retirement = 0, controller, disposed = false, lastDiagnostic = null, retireDiagnostic;
  const contextListeners = new Set();
  const peer=createRetirementObserver(()=>invalidate('context'));
  const reasons = ['visible','hidden','pagehide','disposed','context','superseded','deadline'];
  const visibility = () => globalThis.document?.visibilityState === 'hidden' ? 'hidden' : 'visible';
  function cancelRequest(reason = 'superseded') {
    retireDiagnostic?.(reason); retireDiagnostic = null;
    generation++; controller?.abort(); controller = null;
  }
  function invalidate(reason = 'context') { if(reason==='pagehide'||reason==='disposed')peer.abandon();retirement++; bindingProof?.retire?.(); cancelRequest(reasons.includes(reason) ? reason : 'context'); if(lastDiagnostic?.readPhases)lastDiagnostic=null; for(const listener of contextListeners)listener(); }
  async function call(action, body, phase = 'manual') {
    if (disposed) throw fail();
    peer.sync();
    let mutation=null,acknowledged=false;if(action==='claim'||action==='end')mutation=peer.begin();
    cancelRequest(); lastDiagnostic=null; const checkpoint = generation;
    const owned = controller = new AbortController(), started = performance.now();
    let timedOut = false, statusClass = 'none', recorded = false, readPhases=null;
    let clientStage='call',responseKind='none',http5xx,transportStage,serviceStage;
    const record = (outcome, reason = 'visible') => {
      if (recorded || checkpoint!==generation || !['read','end'].includes(action)) return;
      recorded = true;
      lastDiagnostic = Object.freeze({action, phase: action === 'end' ? 'end' : ['initial','return','manual'].includes(phase) ? phase : 'manual', outcome,
        httpStatusClass: statusClass, elapsedMs: Math.min(15000, Math.max(0, Math.floor((performance.now() - started) / 250) * 250)),
        visibility: visibility(), retirementReason: reason,clientStage,responseKind,...(http5xx?{http5xx}:{}),...(transportStage?{transportStage}:{}),...(serviceStage?{serviceStage}:{}),
        ...(action==='read'&&outcome==='success'&&readPhases?{readPhases}:{})});
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
      const proof=action==='read'?bindingProof?.reserve():null;
      clientStage='request';
      const responsePending = send('/api/n88/student/' + action, {
        method: action === 'read' ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: owned.signal,
        headers: action === 'read' ? { Accept: 'application/json',...proof?.headers } : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-N88-CSRF': '1' },
        ...(action === 'read' ? {} : { body: JSON.stringify(body) })
      });
      clientStage='transport';
      const response=await responsePending;
      clientStage='response';body = null;
      peer.sync();if (checkpoint !== generation) throw fail('stale');
      withinDeadline(); // A suspended tab may resume promise jobs before its timer.
      statusClass = response.status >= 200 && response.status < 300 ? '2xx' : response.status >= 400 && response.status < 500 ? '4xx' : response.status >= 500 && response.status < 600 ? '5xx' : 'other';
      http5xx=statusClass==='5xx'?response.status:undefined;
      if(action==='read'&&statusClass==='5xx'){
        const transport=response.headers?.get('x-n88-transport-stage'),service=response.headers?.get('x-n88-service-stage');
        if(['configuration','upstream','upstream-body','upstream-http-5xx','reply','reply-shape'].includes(transport))transportStage=transport;
        if(['acquire','begin','snapshot','repository','teacher','source','synchronize','synchronize-lock','synchronize-memberships','synchronize-sessions','synchronize-sources','synchronize-publications','synchronize-validate','projection','projection-finalize','projection-membership-flush','projection-commitguards','projection-commit'].includes(service))serviceStage=service;
      }
      const contentType=response.headers?.get('content-type')||'';
      responseKind=/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(contentType)?'json':/^text\/html(?:;|$)/i.test(contentType)?'html':'other';
      await proof?.acceptFailure?.(response,()=>checkpoint===generation&&!owned.signal.aborted&&!disposed);
      if(checkpoint!==generation)throw fail('stale');withinDeadline();
      if (!response.ok || action === 'read' && response.status !== 200) {
        const retry = Number(response.headers?.get('Retry-After'));
        throw fail(response.status === 429 ? 'rate' : [401, 403, 410].includes(response.status) ? 'session' : 'unavailable', response.status === 429 ? Math.min(300, Math.max(1, Number.isFinite(retry) ? retry : 30)) : 0);
      }
      if (action === 'end' || action === 'claim') { acknowledged=true;record('success'); return null; }
      clientStage='decode';const data = await response.json();
      peer.sync();if (checkpoint !== generation) throw fail('stale');
      withinDeadline();
      clientStage='projection';const projected = projectUnifiedStudentData(data);
      await proof?.accept(response,()=>checkpoint===generation&&!owned.signal.aborted&&!disposed);
      if(checkpoint!==generation)throw fail('stale');withinDeadline();
      readPhases=parseStudentReadPhases(response.headers?.get('x-n88-student-read-phases'));
      record('success'); return projected;
      })(), new Promise((_, reject) => { owned.signal.addEventListener('abort', () => reject(fail()), { once: true }); }) ]);
    } catch (error) {
      // Never forward server bodies, transport messages, credentials or payloads.
      const kind = checkpoint !== generation ? 'stale' : timedOut ? 'timeout' : ['rate', 'session'].includes(error?.kind) ? error.kind : 'unavailable';
      record(kind === 'session' ? 'denied' : kind, timedOut ? 'deadline' : 'visible');
      throw fail(kind, error?.retryAfter || 0);
    } finally { if(action==='claim'||action==='end')peer.finish(mutation,acknowledged);clearTimeout(timeout); body = null; if (checkpoint === generation) { controller = null; retireDiagnostic = null; } }
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
    synchronizeContext:()=>peer.sync(),canRetainView:()=>peer.canRetain(),
    captureContext:()=>{peer.sync();return retirement;},isContextCurrent:context=>{peer.sync();return !disposed&&context===retirement;},
    subscribeContext(listener) { if(typeof listener!=='function')throw fail();contextListeners.add(listener);return ()=>contextListeners.delete(listener); },
    getDiagnostic: () => lastDiagnostic ? {...lastDiagnostic} : null,
    read: ({phase = 'manual'} = {}) => call('read', undefined, phase), end: () => call('end', {}, 'end'), invalidate, dispose() { disposed = true; invalidate('disposed');peer.dispose();contextListeners.clear(); }
  });
}
