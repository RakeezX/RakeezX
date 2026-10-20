import assert from 'node:assert/strict';
export const STATIC1522=Object.freeze({task:'continuous-n88-deliver-qualified-pending-login-static-20261020',run:'a006560f-9483-45af-8241-119defddbf2c',candidate:'7c4f8dbd15d1decc2045e322a4f0b2e9930fe687',session:'01a14fc3-b292-7390-9952-8549a286c80f',root:'C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',unchangedNative:'fc55f3cc290a5eb66fde44a13e5a9d444a66f9527b220705829b5fabf398a358',priorCarrier:'6fc34a44346cb8b052236a23fafdf62caf5b3b1ec5c3544a22eda4bf6673e326',carrier:'ac0f35fc1ab050555131670a9b8dd8cf1acbdf9a4240188c327111267568420c',student:'c32c3fc5187a5bba3991b311bb931b3215cc479e562ef1aaa4efac74e7f88470'});
export function static1522Gate(q,run,consumed=false){
 const c=STATIC1522,r=q.preparationAuthority?.reviewedStatic1522;
 assert(q.id===c.task&&q.status==='running'&&q.sessionId===c.session&&q.attempt?.runId===run&&run===c.run,'n88_static1522_identity');
 assert(q.liveAuthorizationRef==='PO-20261020-ACTUAL-1522-PARTIAL-STATIC-REVIEW'&&r?.preparedCandidateSha===c.candidate&&r.originalSessionId===c.session&&r.originalCustodianRoot===c.root,'n88_static1522_review');
 for(const k of ['unchangedNative','priorCarrier','carrier','student'])assert(r[k]===c[k],'n88_static1522_hash');
 assert(r.maxChangedStaticUploads===1&&r.nativeDeploys===0&&r.publicPinChanges===0&&r.newReadinessRequests===0&&r.appendOnlyAttemptHistory===true&&r.resetConsumedMarkers===false&&r.oldTeacherCauseGate?.status==='FAIL'&&r.oldTeacherCauseGate.preserved===true,'n88_static1522_boundary');
 assert(!consumed,'n88_static1522_attempt_consumed');return r;
}
