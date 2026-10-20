import assert from 'node:assert/strict';
export const CORRECTION1430=Object.freeze({task:'continuous-n88-actual-loading-write-and-code-ux-20261020',preparedRun:'77b9930b-3bca-4a49-bc4f-7896d5a9b310',candidate:'9d191311fb7f05ef377f2d719486b1f5cb17c6a1',session:'01a14fc3-b292-7390-9952-8549a286c80f',priorEdge:'2d11d053328fdfb70a188d1c9db80b174e2ed27ccb0f5c009a1d12b1370320ea',edge:'fc55f3cc290a5eb66fde44a13e5a9d444a66f9527b220705829b5fabf398a358',priorCarrier:'ab8a39e7b579e549260f1a25647926be29b3bd86fd92eccd52400096bc2faefc',carrier:'6fc34a44346cb8b052236a23fafdf62caf5b3b1ec5c3544a22eda4bf6673e326'});
export function correction1430Gate(q,run,consumed=false){
 const c=CORRECTION1430,r=q.preparationAuthority?.reviewedOriginalCustodianCorrection1430;
 assert(q.id===c.task&&q.status==='running'&&q.sessionId===c.session&&q.attempt?.runId===run&&run==='cdf8bf21-b318-4e6a-a60f-dc533199fa47','n88_1430_current_identity');
 assert(q.liveAuthorizationRef==='PO-20261020-ACTUAL-1430-N88-COHESIVE-JOURNEY'&&r?.candidateSha===c.candidate&&r.preparedRunId===c.preparedRun&&r.originalSessionId===c.session,'n88_1430_review_identity');
 for(const k of ['priorEdge','edge','priorCarrier','carrier'])assert(r[k]===c[k],'n88_1430_review_hash');
 assert(!consumed,'n88_1430_attempt_consumed');return r;
}
