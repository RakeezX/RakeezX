// AI: read-only publisher pilot -> same-session acceptance continuation.
export const STAGED_ACTIVATION_MODE='resume_verified_activation_stage';
export const N88_FINAL_CHECKS=[
 'n88_official_exact_six_migration_catalog_role_and_custody_readback',
 'n88_official_exact_provider_ingress_private_document_and_no_logging',
 'n88_official_hosted_fabricated_teacher_student_ack_and_isolation',
 'n88_official_publisher_readiness_route_and_served_behavior',
 'n88_private_database_error_boundary_under_actual_provider_logging',
 'n88_exact_private_guard_membership_inherit_correction',
 'n88_actual_scram_iteration_compatibility'
];
export const N88_PILOT_CHECKS=[...N88_FINAL_CHECKS.filter(n=>!['n88_official_hosted_fabricated_teacher_student_ack_and_isolation','n88_official_publisher_readiness_route_and_served_behavior'].includes(n)),
 'n88_pilot_owner_admission_and_failclosed_rollout','n88_pilot_original_service_and_frontend_publisher_package'];
export function verifiedActivationStageContinuation(task,result,update,{verifiedDeployment,receiptSha256,same}){
 try{
  const card=update.card,e=update.expected,s=task.stagedActivation,p=card.verificationRepair,d=task.deliveryReceipt;
  return task.id==='continuous-n88-official-student-portal-activation-20261018'&&task.productId==='N88'
   &&task.scopeKey==='n88-official-hosted-private-service-activation'&&task.liveMutation===true
   &&task.status==='awaiting_po'&&e.status==='awaiting_po'&&e.resultState==='LOCAL_READY'&&result.state==='LOCAL_READY'
   &&task.sessionId===e.sessionId&&task.attempt?.runId===e.lastRunId&&result.runId===e.lastRunId&&result.taskId===task.id
   &&task.candidateSha===e.candidateSha&&result.candidateSha===task.candidateSha&&result.baseSha===task.baseSha
   &&card.completionMode===STAGED_ACTIVATION_MODE&&s?.version===1&&s.phase==='pilot'
   &&s.maxTeachers===1&&s.maxFabricatedStudents===2&&s.dataScope==='designated-fabricated-only'
   &&s.publicEnableRequiresHostedProof===true&&s.pilotStageIsNotProductCompletion===true
   &&Array.isArray(s.originalRequiredChecks)&&N88_FINAL_CHECKS.every(n=>s.originalRequiredChecks.includes(n))
   &&same(s.finalRequiredChecks,[...new Set([...s.originalRequiredChecks,...N88_PILOT_CHECKS])])
   &&Array.isArray(s.finalRequiredChecks)&&new Set(s.finalRequiredChecks).size===s.finalRequiredChecks.length
   &&N88_FINAL_CHECKS.every(n=>s.finalRequiredChecks.includes(n))&&same(card.requiredChecks,s.finalRequiredChecks)
   &&N88_PILOT_CHECKS.every(n=>task.requiredChecks?.includes(n))&&task.requiredChecks.every(n=>card.requiredChecks.includes(n))
   &&Array.isArray(s.finalAcceptance)&&s.finalAcceptance.length>0&&same(card.acceptance,s.finalAcceptance)
   &&same(card.stagedActivation,{...s,phase:'acceptance-and-public-enable'})
   &&same(card.allowedPaths,task.allowedPaths)
   &&Object.entries(card).every(([k,v])=>['objective','completionMode','verificationRepair','stagedActivation','requiredChecks','acceptance'].includes(k)||same(v,task[k]))
   &&p?.kind==='verified-pilot-stage-continuation-v1'&&p.publishedSha===d?.publishedSha&&p.priorReceiptSha256===receiptSha256(d)
   &&/^[a-f0-9]{64}$/.test(p.reviewedFixtureSha256??'')&&p.reason?.length>=50
   &&result.blockerType==='none'&&!result.blocker
   &&task.requiredChecks.every(n=>result.checks?.some(c=>c.name===n&&c.status==='PASS'))
   &&result.checks?.every(c=>c.status==='PASS'||c.status==='NOT_RUN'&&['n88_official_hosted_fabricated_teacher_student_ack_and_isolation','n88_official_publisher_readiness_route_and_served_behavior'].includes(c.name))
   &&verifiedDeployment(task,d)===true;
 }catch{return false;}
}
// Only the two gates requiring a published UI may move to the following stage.
// Every original final gate/acceptance remains mandatory and source-bound.
export function verifiedPilotStagePreparation(task,result,update,{same,valueSha256,stringSha256}){
 if(verifiedPilotUiCorrection(task,result,update,{same,valueSha256,stringSha256}))return true;
 try{
  const c=update.card,s=c.stagedActivation,p=c.verificationRepair,a=c.preparationAuthority?.stagedRollout;
  const oldAuthority=structuredClone(c.preparationAuthority);delete oldAuthority.stagedRollout;
  const deferred=['n88_official_hosted_fabricated_teacher_student_ack_and_isolation','n88_official_publisher_readiness_route_and_served_behavior'];
  const expected=[...task.requiredChecks.filter(n=>!deferred.includes(n)),'n88_pilot_owner_admission_and_failclosed_rollout','n88_pilot_original_service_and_frontend_publisher_package'];
  return task.id==='continuous-n88-official-student-portal-activation-20261018'&&task.productId==='N88'&&task.scopeKey==='n88-official-hosted-private-service-activation'
   &&task.status==='blocked'&&result.state==='BLOCKED'&&result.blockerType==='external'&&task.lastFailure===result.blocker
   &&String(result.blocker).includes('teacher portal remains gated OFF')&&String(result.blocker).includes('publisher-owned HTTPS')
   &&N88_FINAL_CHECKS.every(n=>task.requiredChecks.includes(n))
   &&['n88_actual_scram_iteration_compatibility','n88_official_exact_six_migration_catalog_role_and_custody_readback','n88_private_database_error_boundary_under_actual_provider_logging','n88_exact_private_guard_membership_inherit_correction','actual_original_edge_wrapper_and_source'].every(n=>result.checks?.some(x=>x.name===n&&x.status==='PASS'))
   &&result.checks.every(x=>x.status==='PASS'||x.status==='NOT_RUN'&&[...deferred,'n88_official_exact_provider_ingress_private_document_and_no_logging'].includes(x.name))
   &&s?.version===1&&s.phase==='pilot'&&s.maxTeachers===1&&s.maxFabricatedStudents===2&&s.dataScope==='designated-fabricated-only'
   &&s.publicEnableRequiresHostedProof===true&&s.pilotStageIsNotProductCompletion===true
   &&same(s.originalRequiredChecks,task.requiredChecks)&&same(s.finalRequiredChecks,[...new Set([...task.requiredChecks,...N88_PILOT_CHECKS])])
   &&same(s.finalAcceptance,task.acceptance)&&same(c.requiredChecks,expected)
   &&same(c.allowedPaths,[...new Set([...task.allowedPaths,'drafts/n88-student-portal/rollout-guard.mjs'])])
   &&same(oldAuthority,task.preparationAuthority)&&a?.version===1&&a.maxTeachers===1&&a.maxFabricatedStudents===2
   &&same(a.modes,['off','pilot','public'])&&a.defaultMode==='off'&&a.publicEnableRequiresHostedProof===true
   &&a.noNewAuthFixture===true&&a.noTokenExtraction===true&&a.noCredentialOrVerifierChange===true
   &&p?.kind==='owned-pilot-ordering-repair-v1'&&p.previousResultSha256===valueSha256(result)&&p.previousFailureSha256===stringSha256(task.lastFailure)&&p.reason?.length>=50
   &&Object.entries(c).every(([k,v])=>['objective','requiredChecks','acceptance','stagedActivation','verificationRepair','releaseAuthority','allowedPaths','preparationAuthority'].includes(k)||same(v,task[k]));
 }catch{return false;}
}

// One actual published-pilot UI ordering defect, not a public acceptance waiver.
export function verifiedPilotUiCorrection(task,result,update,{same,valueSha256,stringSha256}){
 try{
  const c=update.card,s=task.stagedActivation,p=c.verificationRepair,h=task.stagePublicationHistory?.[0],d=h?.receipt;
  const deferred=['n88_official_hosted_fabricated_teacher_student_ack_and_isolation','n88_official_publisher_readiness_route_and_served_behavior'];
  return task.id==='continuous-n88-official-student-portal-activation-20261018'&&task.productId==='N88'&&task.scopeKey==='n88-official-hosted-private-service-activation'
   &&task.sessionId==='01a14fc3-b292-7390-9952-8549a286c80f'&&task.status==='blocked'&&task.liveMutation===true
   &&result.state==='BLOCKED'&&result.candidateSha==='26b819f187e7222937763b29c9023e33d1fd6e66'&&task.lastFailure===result.blocker
   &&['implementation','external'].includes(result.blockerType)&&deferred.every(n=>result.checks?.some(x=>x.name===n&&x.status==='FAIL'))
   &&N88_PILOT_CHECKS.every(n=>result.checks.some(x=>x.name===n&&x.status==='PASS'))
   &&result.checks.every(x=>x.status==='PASS'||deferred.includes(x.name)&&x.status==='FAIL')
   &&task.stagePublicationHistory.length===1&&h.phase==='pilot'&&h.candidateSha==='35e2cbb6131129ee5997e818e59e0ea6fd3d76a4'
   &&d?.status==='deployed'&&d.publishedSha==='01ed8edd78a672a4b01c8d6ab8b4cf692279ced0'&&d.evidence?.immutable?.passed===true&&d.evidence?.production?.passed===true
   &&s?.version===1&&s.phase==='acceptance-and-public-enable'&&!s.repairRound&&s.maxTeachers===1&&s.maxFabricatedStudents===2&&s.dataScope==='designated-fabricated-only'
   &&s.publicEnableRequiresHostedProof===true&&s.pilotStageIsNotProductCompletion===true
   &&same(s.originalRequiredChecks,N88_FINAL_CHECKS)&&same(s.finalRequiredChecks,[...new Set([...N88_FINAL_CHECKS,...N88_PILOT_CHECKS])])
   &&same(task.requiredChecks,s.finalRequiredChecks)&&same(c.requiredChecks,N88_PILOT_CHECKS)
   &&same(c.stagedActivation,{...s,phase:'pilot',repairRound:1})&&same(c.preparationAuthority,task.preparationAuthority)&&same(c.allowedPaths,task.allowedPaths)
   &&same(c.dependsOn,[...new Set([...(task.dependsOn??[]),'continuous-n44-cloudflare-redirect-transport-fix-20261019'])])
   &&c.completionMode==='pilot_ui_correction'&&p?.kind==='verified-pilot-ui-ordering-repair-v1'
   &&p.previousResultSha256===valueSha256(result)&&p.previousFailureSha256===stringSha256(task.lastFailure)&&p.priorPilotReceiptSha256===valueSha256(d)
   &&p.failedFinalChecksSha256===valueSha256(result.checks.filter(x=>deferred.includes(x.name)))&&p.reason?.length>=50
   &&Object.entries(c).every(([k,v])=>['objective','completionMode','verificationRepair','stagedActivation','requiredChecks','acceptance','dependsOn'].includes(k)||same(v,task[k]));
 }catch{return false;}
}
