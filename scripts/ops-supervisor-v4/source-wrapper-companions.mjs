// Reviewed partial source-wrapper repair: unchanged, already-admitted pending companions only.
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const insist=(p,m)=>{if(!p)throw Error(m);};
export function sourceWrapperCompanions(payload){
 if(!payload.cardUpdates?.length)return[];
 const file=payload.files.find(f=>f.repoPath===payload.sourceCardFile),next=JSON.parse(file.content),ids=new Set(payload.cardUpdates.map(u=>u.card.id));
 const extra=next.tasks.filter(t=>!ids.has(t.id));if(!extra.length)return[];
 const proof=payload.unchangedSourceWrapper;
 insist(payload.requireNoActiveWorkers===true&&!(payload.allowActiveTaskIds??[]).length&&extra.length<=4,'Companion preservation requires an idle exact wrapper');
 insist(proof?.version===1&&typeof proof.content==='string'&&hash(Buffer.from(proof.content))===file.expectedCanonicalSha256,'Companion source preimage hash differs');
 const before=JSON.parse(proof.content);
 insist(before.activationId===payload.activationId&&next.activationId===payload.activationId&&before.tasks.length===next.tasks.length,'Companion wrapper identity differs');
 const oldIds=before.tasks.map(t=>t.id),newIds=next.tasks.map(t=>t.id);
 insist(new Set(oldIds).size===oldIds.length&&new Set(newIds).size===newIds.length&&oldIds.every(id=>newIds.includes(id)),'Companion IDs added, removed or duplicated');
 insist(extra.every(t=>same(t,before.tasks.find(o=>o.id===t.id))),'Unchanged companion source was modified');
 return extra;
}
export function verifyPendingCompanion(card,task){
 insist(task?.id===card.id&&task.activationId===card.activationId&&task.productId===card.productId&&task.scopeKey===card.scopeKey,'Pending companion identity differs');
 insist(task.status==='pending'&&!task.attempt&&!task.runnerPid&&!task.brokerPid&&!task.worktreePath&&!task.candidateSha,'Companion already started or owns runtime work');
 insist(Object.entries(card).every(([k,v])=>same(v,task[k])),'Pending companion card or seeded session changed');
 return true;
}
