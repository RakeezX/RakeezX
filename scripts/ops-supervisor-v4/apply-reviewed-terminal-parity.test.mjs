import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256, verifyInactiveIdentity} from './apply-reviewed-maintenance.mjs';

const id='continuous-n44-live-inapp-center-20261014';
const activationId='po-20261012-continuous';
const base='a'.repeat(40), candidate='b'.repeat(40), published='c'.repeat(40);
const worktree='C:\\Users\\Abody\\Projects\\RakeezX\\.worktrees\\'+id;

function fixture(status='blocked') {
  const d={status,retryable:status==='pending',errorCode:'SOURCE_PARITY_PENDING',
    candidateSha:candidate,publishedSha:published,
    provider:{conclusion:'success',headSha:published},evidence:{immutable:{passed:true}}};
  const task={id,activationId,productId:'N44',scopeKey:'n44-tested',status:'blocked',
    sessionId:'session-1',attempt:{runId:'run-1'},runnerPid:null,brokerPid:null,
    baseSha:base,candidateSha:candidate,worktreePath:worktree,deliveryReceipt:d,
    lastFailure:'SOURCE_PARITY_PENDING: Provider succeeded but source parity did not pass',
    lastWorkerReap:{exactAbsence:true,activationId,runId:'run-1',owners:[{pid:345,createdAt:'2026-10-15T03:00:00Z'}]}};
  const result={taskId:id,runId:'run-1',state:'LOCAL_READY',
    candidateSha:candidate,baseSha:base,worktreePath:worktree,
    checks:[{name:'synthetic-affected-check',status:'PASS'}]};
  const card={id,productId:'N44',scopeKey:'n44-tested',liveMutation:false,liveAuthorizationRef:null,
    requiredChecks:['synthetic-affected-check'],completionMode:'recheck_existing_publication',
    verificationRepair:{publishedSha:published,priorReceiptSha256:sha256(Buffer.from(JSON.stringify(d,null,2)+'\n')),
      reviewedFixtureSha256:'d'.repeat(64),reason:'The exact pinned provider-tail verifier was materially repaired and tested.'}};
  const update={card,expected:{id,status:'blocked',sessionId:'session-1',lastRunId:'run-1',
    candidateSha:candidate,baseSha:base,worktreePath:worktree,resultState:'LOCAL_READY'}};
  return {task,result,update};
}
const valid=x=>verifyInactiveIdentity(x.task,x.result,x.update,activationId);

test('reviewed terminal source-parity receipt can resume after complete proof',()=>{
  assert.equal(valid(fixture('blocked')),true);
});
test('existing pending source-parity compatibility remains unchanged',()=>{
  assert.equal(valid(fixture('pending')),true);
});
for(const [name,mutate] of [
  ['different terminal error',x=>{x.task.deliveryReceipt.errorCode='AUTH_REFUSED';}],
  ['terminal retryable without matching final disposition',x=>{x.task.deliveryReceipt.retryable=true;}],
  ['provider did not succeed',x=>{x.task.deliveryReceipt.provider.conclusion='failure';}],
  ['immutable content differs',x=>{x.task.deliveryReceipt.evidence.immutable.passed=false;}],
  ['worker check was NOT_RUN',x=>{x.result.checks[0].status='NOT_RUN';}],
  ['worker still active',x=>{x.task.runnerPid=123;}],
  ['worker absence not proven',x=>{x.task.lastWorkerReap.exactAbsence=false;}],
  ['wrong candidate',x=>{x.result.candidateSha='e'.repeat(40);}],
  ['unapproved live mutation',x=>{x.update.card.liveMutation=true;}],
  ['unreviewed receipt hash',x=>{x.update.card.verificationRepair.priorReceiptSha256='0'.repeat(64);}],
]){
  test('reject '+name,()=>{
    const x=fixture('blocked');mutate(x);
    assert.throws(()=>valid(x));
  });
}
