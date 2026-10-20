// Exact repair of a downstream installation check incorrectly required before publication.
// Never rewrites evidence or approves Product publication/install by itself.
export function verifiedN36SetupDeliveryGateSplit(task,result,update,baseline) {
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),card=update.card;
 const first=['n36_real_profile_transaction_failure_and_saved_batch_retry','n36_one_start_current_account_app_shell_without_import_navigation'];
 const downstream='n36_changed_package_and_stable_folder_same_verified_version';
 return task.id==='continuous-n36-setup-profile-save-direct-bridge-20261020'
  && task.productId==='N36' && card.id===task.id && card.productId===task.productId
  && task.status==='blocked' && result.state==='BLOCKED' && !task.deliveryReceipt
  && task.lastFailure?.startsWith('Pre-delivery validation requires '+downstream)
  && result.candidateSha==='9a9352a7bc688061589e4f85af2e4820a798bdec'
  && result.baseSha==='7a68241d47c4501b224ac237a36e9d44c4a377ea'
  && !task.liveMutation && !card.liveMutation && card.preparationAuthority?.publication===true
  && same(baseline.requiredChecks,[...first,downstream])
  && same(card.requiredChecks,[...first,'n36_local_package_0517'])
  && same(card.postDeliveryChecks,[downstream])
  && [...first,'n36_local_package_0517'].every(n=>result.checks?.some(c=>c.name===n&&c.status==='PASS'))
  && result.checks?.some(c=>c.name===downstream&&c.status==='NOT_RUN')
  && !result.checks?.some(c=>c.status==='FAIL')
  && card.objective?.includes('PHASE CONTRACT REPAIR — 2026-10-20')
  && card.acceptance?.some(s=>s.includes('Provider/immutable/served package and stable-folder 0.5.17 hash proof remain mandatory AFTER publication'))
  && Object.entries(card).every(([k,v])=>['objective','requiredChecks','postDeliveryChecks','acceptance'].includes(k)||same(v,baseline[k]));
}
