/** AI: bounded browser codec for the existing V2 service. No rollout from browser state. */
import { manualTaskDraft, safeTeacherLink } from './n88-manual-task-link-safety.js';
import { validDateTimeValue } from './rakeez-datetime-values.js';
import { reconcilePublication } from './n88-item-publication-proposal.js';

export const PUBLICATION_V2_READINESS = Object.freeze({ enabled: false, serviceRevision: 'n88-item-publication-v2' });
export const publicationV2Ready = value => value?.enabled === true && value.serviceRevision === PUBLICATION_V2_READINESS.serviceRevision;
export const PUBLICATION_FLAGS = Object.freeze(['required', 'scheduled', 'completed', 'grade']);
const scopeKeys = ['ownerId','teachingId','sectionId','termId','subjectId'], bindingKeys = ['sessionId','leaseId','contextRevision'];
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o,k));
const text = (v, max = 2000) => typeof v === 'string' && v.length <= max && !v.includes('\0');
const id = v => text(v,200) && v.length > 0;
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const revision = v => Number.isSafeInteger(v) && v >= 0;
const date = v => v === null || typeof v === 'string' && !!v && validDateTimeValue(v,'date');
const flags = v => exact(v,PUBLICATION_FLAGS) && PUBLICATION_FLAGS.every(k => typeof v[k] === 'boolean');
const equal = (a,b,keys) => exact(a,keys) && exact(b,keys) && keys.every(k=>a[k]===b[k]);
const failures = new WeakMap();
const failure = kind => {const error = new Error('publication_unavailable');failures.set(error,kind);return error;};
export const publicationFailure = error => failures.get(error) ?? 'unavailable';
const deny = () => {throw failure('validation');};
const safeLink = v => {try{return (v === null || typeof v === 'string') && safeTeacherLink(v) === v;}catch{return false;}};
function validRow(r) {
  return exact(r,['id','kind','sourceId','itemId','title','startDate','dueDate','sourceRevision','work','description','link','decisions','publicationRevision','tombstone'])
    && ['item','subitem','manual'].includes(r.kind) && text(r.id,1000) && id(r.sourceId) && id(r.itemId)
    && r.id === JSON.stringify([r.kind,r.kind === 'manual' ? null : r.itemId,r.sourceId])
    && text(r.title) && r.title.length > 0 && date(r.startDate) && date(r.dueDate) && (!r.startDate || !r.dueDate || r.startDate <= r.dueDate)
    && hex(r.sourceRevision) && typeof r.work === 'boolean' && r.work === (r.kind !== 'item') && text(r.description) && safeLink(r.link)
    && flags(r.decisions) && (r.kind !== 'manual' || !r.decisions.grade) && (r.work || PUBLICATION_FLAGS.filter(k=>k!=='grade').every(k=>!r.decisions[k]))
    && revision(r.publicationRevision) && typeof r.tombstone === 'boolean';
}
export function parsePublicationStudentData(value) {
  if (!exact(value,['work','grades']) || !Array.isArray(value.work) || !Array.isArray(value.grades) || value.work.length > 2000 || value.grades.length > 2000) deny();
  const work = value.work.map(r => {
    if (!exact(r,['id','title','startDate','dueDate','categories','description','link']) || !text(r.id,1000) || !text(r.title)
        || !date(r.startDate) || !date(r.dueDate) || r.startDate && r.dueDate && r.startDate > r.dueDate || !text(r.description) || !safeLink(r.link)
        || !Array.isArray(r.categories) || r.categories.length !== 1 || !['required','scheduled','completed'].includes(r.categories[0])) deny();
    return { ...r, categories: [...r.categories] };
  });
  const grades = value.grades.map(r => {
    if (!exact(r,['id','title','value']) || !text(r.id,1000) || !text(r.title) || r.value !== null && (typeof r.value !== 'number' || !Number.isFinite(r.value))) deny();
    return { ...r };
  });
  if (new Set(work.map(r=>r.id)).size !== work.length || new Set(grades.map(r=>r.id)).size !== grades.length) deny();
  return { version: 'n88-publication-v2', work, grades };
}
export function projectPublicationStudentData(data) {
  if (!exact(data,['version','work','grades']) || data.version !== 'n88-publication-v2') deny();
  return parsePublicationStudentData({ work:data.work, grades:data.grades });
}
/** Exact discriminated V2 read: a chooser can never smuggle a projection. */
export function parseStudentScopeData(value,normalized=false){
  if(!value||value.version!=='n88-student-scope-v2'||!['choice','empty','selected'].includes(value.state)
      ||!exact(value,value.state==='selected'?['version','state','teachingId','choices','projection']:['version','state','choices'])
      ||!Array.isArray(value.choices)||value.choices.length>2000)deny();
  const choices=value.choices.map(c=>{if(!exact(c,['teachingId','label'])||!id(c.teachingId)||!text(c.label,4003)||!c.label.trim())deny();return {...c};});
  if(new Set(choices.map(c=>c.teachingId)).size!==choices.length||value.state==='choice'&&choices.length<2||value.state==='empty'&&choices.length!==0)deny();
  const out={version:value.version,state:value.state,choices};
  if(value.state==='selected'){
    if(!id(value.teachingId)||!choices.some(c=>c.teachingId===value.teachingId))deny();
    out.teachingId=value.teachingId;out.projection=normalized?projectPublicationStudentData(value.projection):parsePublicationStudentData(value.projection);
  }
  return out;
}

/** getIdentity and dispatch are trusted composition ports; neither is supplied by URLs/globals/storage. */
export function createPublicationClient({ getIdentity, dispatch, timeoutMs = 10000, storage = () => globalThis.sessionStorage,
  requestId = () => globalThis.crypto.randomUUID() } = {}) {
  if (typeof getIdentity !== 'function' || typeof dispatch !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) deny();
  let disposed=false, busy=false, generation=0, controller=null, listed=null;
  const identity = () => {
    if (disposed) throw failure('stale');
    const v=getIdentity();
    if (!v || !exact(v.scope,scopeKeys) || !Object.values(v.scope).every(id) || !exact(v.binding,bindingKeys) || !Object.values(v.binding).every(id) || !text(v.key,2000000) || !v.key.length) deny();
    return { scope:{...v.scope}, binding:{...v.binding}, key:v.key };
  };
  const initial=identity(), key='rakeez.n88.publication-pending.v2:'+encodeURIComponent(JSON.stringify([initial.scope,initial.binding]));
  const current = () => {const c=identity();if(c.key!==initial.key || !equal(c.scope,initial.scope,scopeKeys) || !equal(c.binding,initial.binding,bindingKeys)) throw failure('stale');return c;};
  const commandKeys=['version','action','requestId','scope','binding','expectedMembershipRevision','sourceId','rowId','expectedSourceRevision','expectedPublicationRevision','decisions','manualTask'];
  const validCommand = c => exact(c,commandKeys) && c.version===2 && c.action==='item-publication-set' && /^[A-Za-z0-9_-]{16,100}$/.test(c.requestId)
    && equal(c.scope,initial.scope,scopeKeys) && equal(c.binding,initial.binding,bindingKeys) && hex(c.expectedMembershipRevision) && hex(c.expectedSourceRevision)
    && id(c.sourceId) && text(c.rowId,1000) && revision(c.expectedPublicationRevision) && flags(c.decisions)
    && (c.manualTask===null || exact(c.manualTask,['id','title','description','startDate','dueDate','link']) && c.manualTask.id===c.sourceId
      && text(c.manualTask.title,200) && text(c.manualTask.description) && date(c.manualTask.startDate) && date(c.manualTask.dueDate) && safeLink(c.manualTask.link));
  const pending = () => {
    current();let raw;
    try{raw=storage().getItem(key);}catch{throw failure('storage');}
    if(raw===null)return null;
    if(typeof raw!=='string'||raw.length>16384)throw failure('unknown');
    let command;try{command=JSON.parse(raw);}catch{throw failure('unknown');}
    if(!validCommand(command))throw failure('unknown');
    return command;
  };
  const remember = c => {const raw=JSON.stringify(c);if(raw.length>16384)deny();try{storage().setItem(key,raw);if(storage().getItem(key)!==raw)throw Error();}catch{throw failure('storage');}};
  const forget = c => {try{if(storage().getItem(key)!==JSON.stringify(c))throw Error();storage().removeItem(key);}catch{throw failure('unknown');}};
  async function call(body, { command=null, reserve=false } = {}) {
    if(busy)throw failure('not_started');
    current();busy=true;const g=++generation;let sent=false,reserved=false,timer;
    const owned=controller=new AbortController();
    const valid=()=>{current();if(g!==generation||owned.signal.aborted)throw failure('stale');};
    try {
      if(reserve){if(pending())throw failure('unknown');remember(command);reserved=true;}
      const result = await Promise.race([(async()=>{
        valid();
        const response=await dispatch('/api/n88/teacher/class/publication-v2',{
          method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:owned.signal,
          headers:{'Content-Type':'application/json','Accept':'application/json','X-N88-CSRF':'1'},body:JSON.stringify(body)
        },()=>{valid();sent=true;});
        valid();if(response.status!==200||!response.ok)throw Error();
        const raw=await response.text();valid();if(raw.length>2*1024*1024)throw Error();
        return JSON.parse(raw);
      })(),new Promise((_,reject)=>{timer=setTimeout(()=>{owned.abort();reject(failure('timeout'));},timeoutMs);owned.signal.addEventListener('abort',()=>reject(failure('stale')),{once:true});})]);
      valid();return result;
    } catch(error) {
      if(reserve && reserved && !sent){try{forget(command);}catch{}}
      if(command && (sent || !reserve))throw failure('unknown');
      if(g!==generation||disposed)throw failure('stale');
      throw failure(reserve?'not_started':publicationFailure(error)==='storage'?'storage':'unavailable');
    } finally {clearTimeout(timer);owned.abort();if(g===generation){controller=null;busy=false;}}
  }
  function settle(command, result) {
    if(!exact(result,['receipt','fresh']))throw failure('unknown');
    const state=reconcilePublication(command,current().scope,result.receipt,result.fresh,current().binding);
    if(!['confirmed','rejected'].includes(state.state))throw failure('unknown');
    forget(command);listed=null;return state;
  }
  return Object.freeze({
    pendingState(){try{return pending()?'unknown':'clear';}catch{return 'unknown';}},
    async list(){
      listed=null;const c=current(),result=await call({action:'list',scope:c.scope,binding:c.binding});
      if(!exact(result,['version','inactive','scope','binding','membershipRevision','rows']) || result.version!==2 || result.inactive!==true
          || !equal(result.scope,c.scope,scopeKeys)||!equal(result.binding,c.binding,bindingKeys)||!hex(result.membershipRevision)
          || !Array.isArray(result.rows)||result.rows.length>2000||!result.rows.every(validRow)||new Set(result.rows.map(r=>r.id)).size!==result.rows.length)deny();
      listed=structuredClone(result);return structuredClone(result);
    },
    async preview(input){
      const c=current();if(pending())throw failure('unknown');
      const manual=manualTaskDraft(input),result=await call({action:'manual-preview',scope:c.scope,binding:c.binding,manualTask:manual});
      if(!exact(result,['version','inactive','membershipRevision','row'])||result.version!==2||result.inactive!==true||!hex(result.membershipRevision)||!validRow(result.row)
          ||result.row.kind!=='manual'||result.row.sourceId!==manual.id||['title','description','startDate','dueDate','link'].some(k=>result.row[k]!==manual[k]))deny();
      if(!listed||listed.membershipRevision!==result.membershipRevision)throw failure('validation');
      listed.rows=listed.rows.filter(r=>r.id!==result.row.id).concat(structuredClone(result.row));return structuredClone(result.row);
    },
    async save(rowId, decisions){
      // Entire preparation is before the dispatch marker. No transport failure can forge this provenance.
      let command;
      try {
        const c=current(),row=listed?.rows.find(r=>r.id===rowId);
        if(pending())throw failure('unknown');
        if(!row||row.tombstone||!flags(decisions)||!row.work&&PUBLICATION_FLAGS.filter(k=>k!=='grade').some(k=>decisions[k])||row.kind==='manual'&&decisions.grade)deny();
        command={version:2,action:'item-publication-set',requestId:requestId(),scope:c.scope,binding:c.binding,
          expectedMembershipRevision:listed.membershipRevision,sourceId:row.sourceId,rowId:row.id,expectedSourceRevision:row.sourceRevision,
          expectedPublicationRevision:row.publicationRevision,decisions:{...decisions},
          manualTask:row.kind==='manual'?{id:row.sourceId,title:row.title,description:row.description,startDate:row.startDate,dueDate:row.dueDate,link:row.link}:null};
        if(!validCommand(command))deny();
      }catch(error){throw failure(publicationFailure(error)==='unknown'?'unknown':'not_started');}
      return settle(command,await call(command,{command,reserve:true}));
    },
    async status(){const c=current(),command=pending();if(!command)return {state:'clear',retry:false};return settle(command,await call({action:'status',scope:c.scope,binding:c.binding,command},{command}));},
    dispose(){disposed=true;generation++;busy=false;controller?.abort();listed=null;}
  });
}
