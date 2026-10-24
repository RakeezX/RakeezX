import {validGuidanceList,validGuidanceAck} from './student-portal-task-guidance-client.js';
/** AI: inactive class transport. Server authorization is mandatory; context is a fence, never authority. */
export const PORTAL_FIELDS = Object.freeze(['name', 'class', 'grades', 'required', 'completed', 'scheduled']);
const bindingKeys = ['ownerId', 'sessionId', 'leaseId', 'teachingId', 'classId', 'termId', 'contextRevision'];
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const revision = v => Number.isSafeInteger(v) && v >= 0;
const rosterRevision = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const deny = code => { const e = new Error(code); e.code = code; throw e; };
// AI: local receipt hints are never authorization or mutation payloads. Expiry
// retires automatic receipt lookup, never resolves an uncertain command.
const HINT_PREFIX='rakeezx-n88-uncertain-v1:', HINT_LIMIT=8, HINT_BYTES=8192, HINT_AGE=30*86400000;
const hintActions=['issue-missing','rotate','revoke','visibility','guidance-save'];
const unknownReceipt=()=>({state:'unknown',created:0,skipped:0,failed:0});
const commandId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(v);
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
// Finite same-origin carrier attestation only; never preserve arbitrary header text.
export const classListRegion = value => ['ap-northeast-1','ap-northeast-2','ap-south-1','ap-southeast-1','ap-southeast-2','ca-central-1','us-east-1','us-west-1','us-west-2','eu-central-1','eu-central-2','eu-west-1','eu-west-2','eu-west-3','sa-east-1'].includes(value) ? value : 'unknown';
// AI: only finite 503 response headers from this same fenced request; no body/error retention.
const mutationStages=['none','configuration','key-configuration','envelope','upstream','upstream-body','upstream-http-5xx','reply','reply-shape','acquire','begin','snapshot','repository','teacher','source','synchronize','synchronize-lock','synchronize-memberships','synchronize-sessions','synchronize-sources','synchronize-publications','synchronize-validate','projection','projection-finalize','projection-membership-flush','projection-commitguards','projection-commit','issuance-synchronize','issuance-roster','issuance-receipt','issuance-members','issuance-savepoint','issuance-recovery','issuance-member-result','issuance-member-release','issuance-member-rollback','issuance-flush'];
export function classResponseStage(status,headers){
  if(status!==503)return 'none';
  const service=headers?.get('x-n88-service-stage'),transport=headers?.get('x-n88-transport-stage');
  return [service,transport].find(value=>value!=='none'&&mutationStages.includes(value))||'none';
}
export function createClassPortalClient({ request, getContext = () => null, getReceiptScope = () => '', storage, timeoutMs = 15000, readTimeoutMs = Math.min(timeoutMs,10000), onListDiagnostic = () => {}, onMutationDiagnostic = () => {} } = {}) {
  if (request !== undefined && typeof request !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !Number.isInteger(readTimeoutMs) || readTimeoutMs < 1 || readTimeoutMs > 30000) deny('invalid_configuration');
  let roster = null, rosterKey = null, pending = null, readSequence = 0, terminalCapabilityKey=null,lastConfirmedRoster=null,lastConfirmedKey=null;
  const readContext = () => { try { return getContext(); } catch { return null; } };
  const consumed = new Set();
  const localStorage=()=>storage??globalThis.localStorage;
  function hints(c) {
    try {
      const raw=localStorage().getItem(c.hintKey);
      if(raw===null)return {rows:[],blocked:false};
      if(typeof raw!=='string'||raw.length>HINT_BYTES)return {rows:[],blocked:true};
      const record=JSON.parse(raw);
      if(!exact(record,['version','scope','rows'])||record.version!==1||record.scope!==c.hintScope||!Array.isArray(record.rows)||record.rows.length>HINT_LIMIT||new Set(record.rows.map(x=>x?.requestId)).size!==record.rows.length)return {rows:[],blocked:true};
      const valid=record.rows.every(x=>exact(x,['version','action','requestId','expectedRosterRevision','expectedCredentialRevision','sourceStamp','expectedRevision','createdAt'])&&x.version===1&&hintActions.includes(x.action)&&commandId(x.requestId)&&Number.isSafeInteger(x.createdAt)&&x.createdAt>0&&x.createdAt<=Date.now()+120000&&(x.action==='guidance-save'?x.expectedRosterRevision===null&&rosterRevision(x.sourceStamp)&&revision(x.expectedRevision):rosterRevision(x.expectedRosterRevision)&&x.sourceStamp===null&&x.expectedRevision===null)&&(x.action==='issue-missing'?rosterRevision(x.expectedCredentialRevision):x.expectedCredentialRevision===null));
      return {rows:valid?record.rows:[],blocked:!valid};
    }catch{return {rows:[],blocked:true};}
  }
  function writeHints(c,rows) {
    const raw=JSON.stringify({version:1,scope:c.hintScope,rows});
    if(raw.length>HINT_BYTES)deny('review_required');
    localStorage().setItem(c.hintKey,raw);
    if(localStorage().getItem(c.hintKey)!==raw)deny('review_required');
  }
  function reserve(c,action,command) {
    current(c);
    const saved=hints(c);
    // A read/list success cannot authorize a replacement for an UNKNOWN command.
    // Other command types lack a typed receipt read; remain conservatively fenced.
    if(saved.blocked||saved.rows.length||!commandId(command.requestId))deny('review_required');
    if(action==='guidance-save'&&(!rosterRevision(command.guidance?.sourceStamp)||!revision(command.guidance?.revision)))deny('review_required');
    const hint={version:1,action,requestId:command.requestId,expectedRosterRevision:command.expectedRosterRevision??null,expectedCredentialRevision:action==='issue-missing'?command.expectedCredentialRevision:null,sourceStamp:action==='guidance-save'?command.guidance.sourceStamp:null,expectedRevision:action==='guidance-save'?command.guidance.revision:null,createdAt:Date.now()};
    try{writeHints(c,[hint]);}catch{deny('review_required');}
    current(c);return hint;
  }
  function settle(c,confirmed) {
    current(c);
    const saved=hints(c);if(saved.blocked)return false;
    const rows=saved.rows.filter(x=>!confirmed.some(y=>JSON.stringify(x)===JSON.stringify(y)));
    try{writeHints(c,rows);return true;}catch{return false;}
  }
  function context(teachingId) {
    const c = readContext(), key = classContextKey(c);
    if (!request || !key || c.teachingId !== teachingId) deny('unavailable');
    if (rosterKey !== key) roster = null;
    let workspace;try{workspace=getReceiptScope();}catch{deny('unavailable');}
    if(typeof workspace!=='string'||workspace.length>1200)deny('unavailable');
    const hintScope=JSON.stringify([c.ownerId,c.leaseId,workspace,c.teachingId,c.classId,c.termId]);
    return { key, hintScope, hintKey:HINT_PREFIX+encodeURIComponent(hintScope), binding: Object.fromEntries(bindingKeys.map(k => [k, c[k]])) };
  }
  function current(c) {
    if (classContextKey(readContext()) !== c.key) deny('stale_context');
    let workspace;try{workspace=getReceiptScope();}catch{deny('stale_context');}
    const b=c.binding;
    if(JSON.stringify([b.ownerId,b.leaseId,workspace,b.teachingId,b.classId,b.termId])!==c.hintScope)deny('stale_context');
  }
  async function call(action, teachingId, body, validate, c = context(teachingId)) {
    let timer, timedOut=false,region='unknown',outcome='failure',httpStatus=0,code='none',stage='none'; const controller = new AbortController(),started=performance.now(),sequence=readSequence;
    const mutation=['issue-missing','rotate','revoke','visibility','guidance-save'].includes(action);
    const mutationDiagnostic=value=>{try{onMutationDiagnostic(value);}catch{/* Observer cannot change command disposition. */}};
    if(mutation)mutationDiagnostic(null);
    const diagnostic=value=>{try{onListDiagnostic(value);}catch{/* Diagnostic observers never change a request result. */}};
    if(action==='list')diagnostic(null);
    try {
      const result = await Promise.race([
        Promise.resolve().then(async () => { current(c); const response = await request('/api/n88/teacher/class/' + action, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-N88-CSRF': '1' }, body: JSON.stringify({ ...body, teachingId, binding: c.binding }) }),
          ok = response?.ok === true;
          current(c);if(!controller.signal.aborted){httpStatus=Number.isInteger(response?.status)&&response.status>=100&&response.status<=599?response.status:0;stage=classResponseStage(httpStatus,response?.headers);if(action==='list')region=classListRegion(response?.headers?.get('x-n88-service-region'));}
          return { ok, ack: ok ? await response.json() : null }; }),
        new Promise((_, reject) => { timer = setTimeout(() => { timedOut=true; controller.abort(); reject(new Error('timeout')); }, ['list','guidance-list'].includes(action)?readTimeoutMs:timeoutMs); }),
      ]);
      current(c);
      if (!result.ok) deny('rejected');
      const ack = result.ack;
      if (!exact(ack, ['ack','binding','requestId','data']) || ack.ack !== true || !exact(ack.binding, bindingKeys) || bindingKeys.some(k => ack.binding[k] !== c.binding[k]) || ack.requestId !== (body.requestId ?? null) || !validate(ack.data)) deny('invalid_ack');
      const data=structuredClone(ack.data);outcome='success';return data;
    } catch (e) {
      current(c);
      // Never expose transport errors/bodies, which may contain credentials or personal data.
      code=timedOut?'timeout':['rejected','invalid_ack'].includes(e?.code) ? e.code : 'uncertain';deny(code);
    } finally {
      clearTimeout(timer); controller.abort();
      if(mutation&&sequence===readSequence&&classContextKey(readContext())===c.key)mutationDiagnostic(Object.freeze({schema:'n88-mutation-response-v1',action,outcome:outcome==='success'?'acknowledged':'unconfirmed',httpStatus,code,stage,elapsedMs:Math.min(30000,Math.max(0,Math.round(performance.now()-started)))}));
      if(action==='list'&&sequence===readSequence&&classContextKey(readContext())===c.key){
        const elapsed=performance.now()-started;
        diagnostic(Object.freeze({region,elapsedMs:Number.isFinite(elapsed)?Math.min(30000,Math.max(0,Math.round(elapsed))):null,outcome}));
      }
    }
  }
  function snapshot(teachingId) {
    const c = context(teachingId);
    if (!roster || rosterKey !== c.key) deny('review_required');
    return { c, r: roster };
  }
  function mutate(teachingId, body, action, validate) {
    const { c, r } = snapshot(teachingId);
    if (!id(body.requestId)) deny('review_required');
    if (pending) deny('busy');
    if(action==='issue-missing'&&!rosterRevision(r.credentialRevision))deny('review_required');
    const command={ ...body, expectedRosterRevision: r.rosterRevision,...(action==='issue-missing'?{expectedCredentialRevision:r.credentialRevision}:{}) };
    if(consumed.has(command.requestId))deny('review_required');
    const hint=reserve(c,action,command);
    consumed.add(command.requestId); readSequence++;
    const work = call(action, teachingId, command, data=>validate(data,command), c).then(result=>{if(result.uncertain!==true)settle(c,[hint]);return result;});
    pending = work;
    return work.finally(() => { roster = null; if (pending === work) pending = null; });
  }
  // AI: separate bounded closure journal; original UNKNOWN hints remain unchanged until matching ACK.
  function resolutionJournal(c){
    const raw=localStorage().getItem(c.hintKey+':terminal-v1');if(raw===null)return [];
    if(typeof raw!=='string'||raw.length>HINT_BYTES)deny('review_required');
    const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>HINT_LIMIT||rows.some(x=>!exact(x,['hint','attempted','readAttempted','state'])||!commandId(x.hint?.requestId)||typeof x.attempted!=='boolean'||typeof x.readAttempted!=='boolean'||!['unknown','closed','committed'].includes(x.state)))deny('review_required');return rows;
  }
  function saveResolution(c,rows){current(c);const raw=JSON.stringify(rows);if(raw.length>HINT_BYTES||rows.length>HINT_LIMIT)deny('review_required');localStorage().setItem(c.hintKey+':terminal-v1',raw);if(localStorage().getItem(c.hintKey+':terminal-v1')!==raw)deny('review_required');}
  function resolutionInput(teachingId){
    const c=context(teachingId);if(terminalCapabilityKey!==c.key)deny('review_required');const saved=hints(c);if(saved.blocked||saved.rows.length!==1)deny('review_required');
    const hint=saved.rows[0];if(hint.action!=='issue-missing'||Date.now()-hint.createdAt>HINT_AGE)deny('review_required');
    const rows=resolutionJournal(c),record=rows.find(x=>x.hint.requestId===hint.requestId);
    if(record&&JSON.stringify(record.hint)!==JSON.stringify(hint))deny('review_required');
    return {c,hint,rows,record};
  }
  function resolutionState(teachingId){try{const {record}=resolutionInput(teachingId);return {eligible:!record,canRecover:!!record&&record.state==='unknown'&&!record.readAttempted,state:record?.state??'unknown'};}catch{return {eligible:false,canRecover:false,state:'not-run'};}}
  async function resolveUnknown(teachingId,readOnly=false){
    if(pending)deny('busy');const {c,hint,rows,record}=resolutionInput(teachingId);
    if(readOnly?(!record||record.state!=='unknown'||record.readAttempted):!!record)deny('review_required');
    const entry=record??{hint:structuredClone(hint),attempted:true,readAttempted:false,state:'unknown'};
    if(readOnly)entry.readAttempted=true;else rows.push(entry);
    saveResolution(c,rows);readSequence++;
    const body={requestId:hint.requestId,expectedRosterRevision:hint.expectedRosterRevision,expectedCredentialRevision:hint.expectedCredentialRevision,resolutionVersion:1,resolution:readOnly?'status':'close'};
    const work=call('revoke',teachingId,body,d=>exact(d,['resolutionVersion','state','created','skipped','failed'])&&d.resolutionVersion===1&&['closed','committed','unknown'].includes(d.state)&&['created','skipped','failed'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0&&d[k]<=2000)&&(d.state==='committed'||d.created+d.skipped+d.failed===0),c);pending=work;
    try{const result=await work;current(c);entry.state=result.state;saveResolution(c,rows);if(result.state!=='unknown'&&!settle(c,[hint]))deny('review_required');if(result.state==='closed'&&lastConfirmedKey===c.key&&lastConfirmedRoster?.rosterRevision===hint.expectedRosterRevision&&lastConfirmedRoster?.credentialRevision===hint.expectedCredentialRevision){roster=structuredClone(lastConfirmedRoster);rosterKey=c.key;}return result;}finally{if(pending===work)pending=null;}
  }
  return Object.freeze({
    resolutionState,
    closeUnknown:teachingId=>resolveUnknown(teachingId,false),
    recoverClosure:teachingId=>resolveUnknown(teachingId,true),
    async listGuidance(teachingId) {
      if(pending) deny('busy');
      return call('guidance-list',teachingId,{},validGuidanceList);
    },
    async saveGuidance(teachingId,guidance) {
      if(pending) deny('busy');
      const c=context(teachingId),requestId=crypto.randomUUID(),hint=reserve(c,'guidance-save',{requestId,guidance});
      readSequence++;
      const work=call('guidance-save',teachingId,{requestId,guidance},d=>validGuidanceAck(d,guidance),c);
      pending=work;
      try{const result=await work;settle(c,[hint]);return result;}finally{if(pending===work)pending=null;}
    },
    async listClass(teachingId) {
      if (pending) deny('busy');
      const c = context(teachingId), sequence = ++readSequence;
      roster = null;
      const saved=hints(c),wanted=saved.rows.filter(x=>x.action==='issue-missing'&&Date.now()-x.createdAt<=HINT_AGE);
      const requests=wanted.map(x=>({requestId:x.requestId,expectedRosterRevision:x.expectedRosterRevision,expectedCredentialRevision:x.expectedCredentialRevision}));
      const metadataBase=d=>!requests.length&&exact(d,['classId','rosterRevision','policyRevision','students','visibility']) || exact(d,['classId','rosterRevision','policyRevision','students','visibility','credentialRevision','reconciliation'])&&rosterRevision(d.credentialRevision)&&Array.isArray(d.reconciliation)&&d.reconciliation.length===requests.length&&d.reconciliation.every(x=>exact(x,['state','created','skipped','failed'])&&['committed','unknown'].includes(x.state)&&['created','skipped','failed'].every(k=>Number.isSafeInteger(x[k])&&x[k]>=0&&x[k]<=2000)&&(x.state==='committed'||x.created+x.skipped+x.failed===0));
      const metadata=d=>{const {terminalResolution,...base}=d??{};return (terminalResolution===undefined||terminalResolution==='n88-terminal-no-issuance-v1')&&metadataBase(base);};
      const data = await call('list', teachingId, {terminalResolutionVersion:1,reconciliationVersion:1,reconcile:requests}, d => metadata(d) && d.classId === c.binding.classId && rosterRevision(d.rosterRevision) && revision(d.policyRevision) && validPortalFields(d.visibility) && Array.isArray(d.students) && d.students.length <= 2000 && d.students.every(validStudent) && new Set(d.students.map(s => s.studentId)).size === d.students.length && new Set(d.students.map(s => s.enrollmentId)).size === d.students.length, c);
      if (sequence !== readSequence) deny('review_required');
      terminalCapabilityKey=data.terminalResolution==='n88-terminal-no-issuance-v1'?c.key:null;
      const confirmed=wanted.filter((x,i)=>data.reconciliation?.[i].state==='committed');
      if(confirmed.length)settle(c,confirmed);
      // Preserve the existing UI's UNKNOWN warning for unqueryable, expired,
      // malformed or storage-blocked hints. This local warning is no server ACK.
      const remaining=hints(c);
      if(remaining.blocked||remaining.rows.some(x=>!wanted.some(y=>y.requestId===x.requestId))||remaining.rows.some(x=>confirmed.some(y=>y.requestId===x.requestId)))data.reconciliation=[...(data.reconciliation??[]),unknownReceipt()];
      roster = {...data,students:data.students.map(({credential,...s})=>s)}; rosterKey = c.key;lastConfirmedRoster=structuredClone(roster);lastConfirmedKey=c.key;return data;
    },
    issueMissingClassCodes(teachingId, body) {
      const { r } = snapshot(teachingId);
      if (!exact(body, ['requestId','expectedRosterRevision']) || body.expectedRosterRevision !== r.rosterRevision) deny('review_required');
      return mutate(teachingId, body, 'issue-missing', (d,command) => {
        if (!exact(d, ['requestId','created','skipped','failed','uncertain']) || d.requestId !== command.requestId || typeof d.uncertain !== 'boolean' || !['created','skipped','failed'].every(k => Array.isArray(d[k]))) return false;
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
