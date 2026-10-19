// One exact never-started N123 card: release false dependency on human push observation.
export const N123_DEPENDENCY_NOTE='\n\nOPS DEPENDENCY CORRECTION: N123 does not depend on actual N44 notification receipt/human observation. Keep N107 verified publication dependency; the controller still serializes every overlapping active write scope. No additional Product/permission/test scope.';
export function verifyPristineN123DependencyCorrection(task,update,actualSha256){
 const {card,expected:e,pendingDependencyCorrection:p}=update;
 const insist=(x,m)=>{if(!x)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 insist(p?.version===1&&task.id==='continuous-n123-sync-latency-measured-20261019'&&card.id===task.id&&task.productId==='N123'&&card.productId===task.productId&&task.activationId===card.activationId,'Wrong pending dependency identity');
 insist(task.status==='pending'&&!task.attempt&&!task.worktreePath&&!task.runnerPid&&!task.brokerPid&&!task.sessionId&&!task.candidateSha,'Pending card has started');
 insist(e.status==='pending'&&e.sessionId===null&&e.lastRunId===null&&e.candidateSha===null&&e.queueSha256===actualSha256,'Pending preimage changed');
 const removed='continuous-n44-one-approved-closed-page-push-20261019',keep='continuous-n107-single-confirm-auto-completion-20261019';
 insist(same(task.dependsOn,[keep,removed])&&same(e.dependsOn,task.dependsOn)&&same(card.dependsOn,[keep]),'Only the false N44 dependency can change');
 insist(card.objective===task.objective+N123_DEPENDENCY_NOTE,'Unexpected objective change');
 insist(Object.entries(card).every(([k,v])=>['objective','dependsOn'].includes(k)||same(v,task[k])),'Other source field changed');
 return true;
}
