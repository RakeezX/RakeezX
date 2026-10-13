import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyInactiveIdentity, revisedTask } from '../apply-reviewed-maintenance.mjs';
const oldBase='1'.repeat(40), oldCandidate='2'.repeat(40), base='3'.repeat(40), candidate='4'.repeat(40);
function fixture(stale=true){
 const task={id:'n58',productId:'N58',scopeKey:'existing-scope',activationId:'active',status:'blocked',sessionId:'saved-session',attempt:{runId:'saved-run'},runnerPid:null,brokerPid:null,candidateSha:stale?oldCandidate:candidate,baseSha:stale?oldBase:base,worktreePath:'C:/repo/.worktrees/n58',lastWorkerReap:{exactAbsence:true,activationId:'active',runId:'saved-run',owners:[{pid:42,createdAt:'2026-10-13T00:00:00Z'}]},lastFailure:'original preserved failure'};
 const result={taskId:'n58',runId:'saved-run',state:'BLOCKED',candidateSha:candidate,baseSha:base,worktreePath:task.worktreePath};
 const update={card:{id:'n58',productId:'N58',scopeKey:'existing-scope',activationId:'active'},expected:{id:'n58',status:'blocked',sessionId:'saved-session',lastRunId:'saved-run',candidateSha:candidate,baseSha:base,...(stale?{queuedBaseSha:oldBase,queuedCandidateSha:oldCandidate}:{})},materialReason:'Scoped material continuation with the completed result retained'};
 return {task,result,update};
}
test('unchanged-binding path remains strict',()=>{const f=fixture(false);assert.equal(verifyInactiveIdentity(f.task,f.result,f.update,'active'),true);});
test('reviewed exact queued/result binding preserves original and resumes latest work',()=>{const f=fixture(),before=structuredClone(f.task);assert.equal(verifyInactiveIdentity(f.task,f.result,f.update,'active'),true);const q=revisedTask(f.task,f.update,'5'.repeat(40),'2026-10-13T03:40:00Z');assert.deepEqual(f.task,before);assert.equal(q.status,'pending');assert.equal(q.candidateSha,candidate);assert.equal(q.baseSha,base);assert.equal(q.sessionId,before.sessionId);assert.deepEqual(q.attempt,before.attempt);assert.equal(q.recoveryHistory.at(-1).previousQueuedBaseSha,oldBase);assert.equal(q.recoveryHistory.at(-1).previousQueuedCandidateSha,oldCandidate);});
for(const [name,change] of [
 ['changed queued base',f=>f.task.baseSha='6'.repeat(40)],
 ['changed queued candidate',f=>f.task.candidateSha='6'.repeat(40)],
 ['changed result base',f=>f.result.baseSha='6'.repeat(40)],
 ['changed result candidate',f=>f.result.candidateSha='6'.repeat(40)],
 ['different session',f=>f.task.sessionId='other'],
 ['different run',f=>f.result.runId='other'],
 ['missing old-owner absence',f=>f.task.lastWorkerReap.exactAbsence=false],
 ['running task',f=>f.task.status='running'],
 ['partial optional binding',f=>delete f.update.expected.queuedBaseSha],
 ['implicit relaxation absent',f=>{delete f.update.expected.queuedBaseSha;delete f.update.expected.queuedCandidateSha;}],
 ['foreign worktree',f=>f.result.worktreePath='C:/other']
]) test('rejects '+name,()=>{const f=fixture();change(f);assert.throws(()=>verifyInactiveIdentity(f.task,f.result,f.update,'active'));});
