/** AI-reviewed, one exact historical N88 inert-source receipt. Never an access activation. */
import {createHash} from 'node:crypto';
import {verifiedSourceOnlyPublication,verifiedDeployment} from './controller.mjs';
const ID='n88-term-negative-1028',RUN='3b7b773c-82bc-4cd5-aade-9b265aa7c2d8';
const BASE='edaefa3dcd34232433cc4c6b2a25f88ac3b9dbb3', CAND='3cb7e416c6ddfb86dd306160dddbd587aa709597', PUB='0c33b120b0baba74af8dd64c7425d7fb83de0411';
const SOURCE='b5de2677919fb9f681fe55d26a149c39adc80951b0769f5c75f67134e4d591b2';
const SCOPE='inert inactive source-only N88 original issuance terminal cancellation';
const PATHS=['drafts/n88-student-portal/integrated-service.mjs','drafts/n88-student-portal/receipt-terminal-review.inactive.mjs'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=o=>createHash('sha256').update(JSON.stringify(o,null,2)+'\n').digest('hex');
export function verifiedN88NegativeInertReconciliation(t,r,u){
 try{
  const c=u?.card,e=u?.expected,p=c?.verificationRepair,d=t?.deliveryReceipt;
  if(t?.id!==ID||t.productId!=='N88'||t.activationId!=='po-20261012-continuous'||t.status!=='blocked'||
     t.lastFailure!=='Publisher returned incomplete or mismatched deployment proof'||
     t.attempt?.runId!==RUN||t.baseSha!==BASE||t.candidateSha!==CAND||
     t.approvedNote?.source!=='n88-terminal-negative-source-20261028.json'||t.approvedNote.sha256!==SOURCE||
     t.executionMode!=='local'||t.liveMutation!==false||t.liveAuthorizationRef||
     t.preparationAuthority?.kind!=='po_20261028_correct_n88_source_terminal_self_imposed_lease_requirement'||
     t.preparationAuthority.providerOps!==0||t.preparationAuthority.sensitiveLiveMutations!==0||
     t.preparationAuthority.authRlsSchemaMigrations!==0||t.preparationAuthority.requireDefaultOff!==true) return false;
  if(e?.id!==ID||e.status!=='blocked'||e.lastRunId!==RUN||e.sessionId!==t.sessionId||
     e.candidateSha!==CAND||e.baseSha!==BASE||e.resultState!=='LOCAL_READY'||
     r?.taskId!==ID||r.runId!==RUN||r.state!=='LOCAL_READY'||r.baseSha!==BASE||
     r.candidateSha!==CAND||r.blockerType!=='none'||r.blocker) return false;
  if(c?.id!==ID||c.productId!=='N88'||c.activationId!==t.activationId||c.scopeKey!==t.scopeKey||
     c.completionMode!=='reconcile_n88_negative_inert_source'||
     !same(c.verificationPaths,PATHS)||!same(c.allowedPaths,t.allowedPaths)||
     !same(c.requiredChecks,t.requiredChecks)||c.liveMutation!==false||c.liveAuthorizationRef) return false;
  if(!Array.isArray(r.checks)||r.checks.length<5||r.checks.some(x=>x.status!=='PASS')||
     !t.requiredChecks.every(name=>r.checks.some(x=>x.name===name&&x.status==='PASS'))) return false;
  if(c.preparationAuthority?.publication!==true||c.preparationAuthority.publicationScope!==SCOPE||
     Object.keys(c.preparationAuthority).length!==Object.keys(t.preparationAuthority).length+2) return false;
  const {publication,publicationScope,...old}=c.preparationAuthority;
  if(!same(old,t.preparationAuthority))return false;
  if(!Object.entries(c).every(([k,v])=>['preparationAuthority','verificationPaths','completionMode','verificationRepair'].includes(k)||same(v,t[k])))return false;
  if(p?.version!==1||p.kind!=='n88-exact-inactive-source-declaration-v1'||p.sourceSha256!==SOURCE||
     p.previousReceiptSha256!==digest(d)||p.publishedSha!==PUB||typeof p.reason!=='string'||p.reason.length<75)return false;
  if(d?.status!=='deployed'||d.state!=='DEPLOYED_AWAITING_PO'||d.productionDeployed!==true||
     d.candidateSha!==CAND||d.baseSha!==BASE||d.publishedSha!==PUB||
     d.provider?.conclusion!=='success'||d.provider.headSha!==PUB||
     d.productSourceChangeObserved!==false||d.changedAssets?.length!==0||
     d.evidence?.immutable?.passed!==true||d.evidence?.production?.passed!==true)return false;
  const declared={...t,...c};
  return verifiedSourceOnlyPublication(declared,d)&&verifiedDeployment(declared,d);
 }catch{return false;}
}
