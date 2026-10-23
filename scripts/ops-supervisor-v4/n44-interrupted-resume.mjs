// AI: exact checkpoint-only recovery for the PO-stopped N44 custodian.
// No fabricated worker result, acceptance conversion, queue writer or executor.
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const insist=(ok,message)=>{if(!ok)throw Error(message);};
const parse=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
export function verifyN44InterruptedResume(task,update,checkpointBytes,priorResultBytes,queueBytes,now=Date.now()) {
 const p=update.interruptedAttemptRecovery,e=update.expected,c=update.card;
 const id='continuous-n44-one-approved-closed-page-push-20261019';
 const run='f48bd23c-b0e1-4ed9-93d7-233b2d2ccdc5',session='01a14fcd-032c-7ec0-8b0c-0e0395862c61';
 insist(p?.version===1&&task.id===id&&c.id===id&&e.id===id,'Wrong interrupted N44 identity');
 insist(task.status==='blocked'&&e.status==='blocked'&&task.lastFailure==='DEFERRED - PO TEMPORARY HOLD','N44 is not the exact PO-held attempt');
 insist(task.activationId===c.activationId&&task.productId==='N44'&&c.productId==='N44'&&task.scopeKey===c.scopeKey,'Interrupted scope changed');
 insist(task.sessionId===session&&e.sessionId===session&&task.attempt?.runId===run&&e.lastRunId===run,'Interrupted session/run changed');
 insist(hash(queueBytes)===p.queueSha256&&hash(checkpointBytes)===p.checkpointSha256&&hash(priorResultBytes)===p.priorResultSha256,'Interrupted evidence preimage changed');
 const cp=parse(checkpointBytes),prior=parse(priorResultBytes);
 insist(cp.taskId===id&&cp.activationId===task.activationId&&cp.sessionId===session&&cp.runId===run&&cp.status==='exited'&&cp.exitCode===-1&&cp.finishedAt,'Checkpoint is not the stopped exact attempt');
 insist(task.lastWorkerReap?.exactAbsence===true&&task.lastWorkerReap.runId===run&&task.lastWorkerReap.owners?.length>0,'Missing original owned-process reap evidence');
 insist(!task.runnerPid&&!task.brokerPid&&!(task.ownedProcesses??[]).length,'Interrupted task still has owned processes');
 insist(prior.taskId===id&&prior.runId==='75a32838-5a23-441f-99d1-5ae9f9af8502'&&prior.state==='BLOCKED'&&prior.candidateSha==='bcf40dcff94285ab3c7f5559fd112eac339205d8','Wrong previous real result');
 insist(task.candidateSha===prior.candidateSha&&p.previousQueuedCandidateSha===task.candidateSha&&task.baseSha===prior.baseSha&&e.baseSha===task.baseSha,'Saved prior candidate/base changed');
 insist(e.candidateSha==='f17b1672d64c2372eef0b0cc4e372f73d3d3f29a'&&e.worktreePath===task.worktreePath&&prior.worktreePath===task.worktreePath,'Saved checkpoint head/worktree changed');
 insist((task.requiredChecks??[]).every(x=>c.requiredChecks?.includes(x)),'Original actual acceptance checks must remain');
 insist(c.liveAuthorizationRef==='PO-20261023-RENEWED-ONE-DEVICE-TWO-HOURS'&&c.preparationAuthority?.originalPrivateCustodianOnly===session,'Missing renewed original-custodian authority');
 const a=c.preparationAuthority;
 insist(a.authorityStartsAt==='2026-10-23T06:29:00.000Z'&&a.authorityExpiresAt==='2026-10-23T08:29:00.000Z'&&now>=Date.parse(a.authorityStartsAt)&&now<Date.parse(a.authorityExpiresAt),'Renewed authority window expired or changed');
 insist(a.maxProviderSendAttemptsTotalAcrossBothCards===1&&a.maxUniquePhysicalDevices===1&&a.maxRegistrationRecoveryAttemptsOnQualifiedChangedSource===1&&!a.periodicCron&&!a.globalAutonomousDelivery&&a.newMigrations===0&&a.newAuthUsers===0&&!a.RlsChange&&!a.managedAuthChange,'Renewed scope exceeds one-device authority');
 return {candidateSha:e.candidateSha,previousCandidateSha:prior.candidateSha,priorResultSha256:p.priorResultSha256,checkpointSha256:p.checkpointSha256,runId:run,sessionId:session};
}
