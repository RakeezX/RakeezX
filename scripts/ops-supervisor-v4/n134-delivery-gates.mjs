// Exact N134 worker/publisher phase correction; no evidence or permissions are changed.
export function verifiedN134DeliveryGateSplit(task,result,update,baseline) {
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b), card=update.card;
 const downstream='n134_original_publisher_served_production_evidence';
 const first=['n134_clean_current_main_integration_no_n44_n88_n128_overlap','n134_teacher_grades_quicklog_execution_workflow_revalidation','n134_mobile_responsive_accessibility_and_native_css_contract'];
 const expected=structuredClone(baseline);
 expected.requiredChecks=first;
 expected.postDeliveryChecks=[...baseline.postDeliveryChecks,downstream];
 expected.preflight.workerChecks=first;
 expected.preflight.publisherChecks=[...baseline.preflight.publisherChecks,downstream];
 expected.objective=card.objective;
 return task.id==='continuous-n134-ux-quality-production-20261028' && task.productId==='N134'
  && task.status==='blocked' && result.state==='BLOCKED' && !task.deliveryReceipt
  && result.runId==='0ed3e1a2-9fa9-4b55-83b4-ca5106817c7a'
  && result.candidateSha==='cacb273e2433169461f119df63ceee4adcac01ae'
  && result.baseSha==='94f1562b8de8b8294db30ba0c854867950ae0c7f'
  && task.lastFailure?.startsWith('Candidate validation requires publisher-served Production evidence')
  && !task.liveMutation && !card.liveMutation
  && same(baseline.requiredChecks,[...first,downstream]) && same(baseline.preflight.workerChecks,[...first,downstream])
  && same(baseline.postDeliveryChecks,['production_publication']) && same(baseline.preflight.publisherChecks,['production_publication'])
  && first.every(n=>result.checks?.some(c=>c.name===n&&c.status==='PASS'))
  && result.checks?.some(c=>c.name===downstream&&c.status==='NOT_RUN') && !result.checks?.some(c=>c.status==='FAIL')
  && card.objective===baseline.objective+'\n\nPHASE CONTRACT REPAIR 2026-10-28: Preserve candidate cacb273e and all successful local evidence. The original publisher must prove provider, immutable and served Production AFTER local delivery; this remains mandatory for acceptance. Resume the saved session; do not repeat unchanged checks or publish from the worker.'
  && Object.entries(card).every(([k,v])=>same(v,expected[k]))
  && ['id','productId','scopeKey','liveMutation','allowedPaths','verificationPaths','requiredChecks','postDeliveryChecks','preflight','preparationAuthority','releaseAuthority','acceptance','objective'].every(k=>same(card[k],expected[k]));
}
