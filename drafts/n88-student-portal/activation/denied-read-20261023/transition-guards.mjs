/** AI: pure qualification only. No provider, custody, SQL or configuration writes. */
import {createHash} from 'node:crypto';
export const taskId='continuous-n88-denied-read-original-service-20261023';
export const custodianSession='01a14fc3-b292-7390-9952-8549a286c80f';
export const projectId='xlrubcwjqktzzunrvuns';
export const priorSource='f14daf224dc27b1163d43ce39ada2fdf596acd3abb4af30579404ad4f5de6390';
export const successorSource='d2a0c7c0930ecf71545c59150bae5b36fdd7ab3eb61c148317faf19ea4006c9c';
export const baselineDigest='d1d4f974cc19ca49187f253766d90545a5002020c560ca1da64429e8e49a41af';
export const baselineKeysetDigest='6087c1195ab1e6ffeed00ff8e975cdd7f3d1b59e3b437b1c32ac006261cac28e';
export const n44Task='continuous-n44-one-approved-closed-page-push-20261019';
export const n44Session='01a14fcd-032c-7ec0-8b0c-0e0395862c61';
export const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=c=>{throw Error('n88_denied_transition_'+c);};
const hex=(v,n)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const exact=(o,keys)=>o&&Object.keys(o).sort().join(',')===keys.sort().join(',');
export function canonical(rows){
 if(!Array.isArray(rows)||!rows.length||rows.some(r=>!exact(r,['name','digest'])||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(r.name)||!hex(r.digest,64))||new Set(rows.map(r=>r.name)).size!==rows.length)fail('metadata_shape');
 return rows.map(r=>({...r})).sort((a,b)=>a.name.localeCompare(b.name));
}
export const nonPinDigest=rows=>hash(JSON.stringify(canonical(rows).filter(r=>r.name!=='N88_SERVICE_SOURCE_SHA')));
// Each normalized certificate must first be bound to actual committed public bytes,
// original producer/result/source and acknowledged operation receipts by its caller.
// This function cannot confer those attestations or manufacture historical metadata.
export function reconstructExactChanges(current,certificates,expectedKeyset){
 const actual=canonical(current),keyset=hash(JSON.stringify(actual.map(r=>r.name)));
 if(keyset!==expectedKeyset)fail('keyset_drift');
 if(!Array.isArray(certificates)||certificates.length>12)fail('certificate_chain');
 const restored=actual.map(r=>({...r}));
 for(const c of [...certificates].reverse()){
  if(!exact(c,['taskId','sessionId','runId','candidateSha','certificateSha256','committed','configurationPhaseCompleted','publicOperationProofsVerified','beforeAggregate','afterAggregate','keysetDigest','changes'])||c.taskId!==n44Task||c.sessionId!==n44Session||!c.runId||!hex(c.candidateSha,40)||!hex(c.certificateSha256,64)||c.committed!==true||c.configurationPhaseCompleted!==true||c.publicOperationProofsVerified!==true||c.keysetDigest!==keyset||c.afterAggregate!==nonPinDigest(restored)||!hex(c.beforeAggregate,64)||!Array.isArray(c.changes)||!c.changes.length||c.changes.length>4||new Set(c.changes.map(r=>r.name)).size!==c.changes.length)fail('certificate_binding');
  for(const change of c.changes){
   if(!exact(change,['name','previousDigest','currentDigest'])||!['N44_SERVICE_SOURCE_SHA','N44_SESSION_POLICY_JSON','N44_ONE_DEVICE_TEST_JSON','N44_DELIVERY_ENABLED'].includes(change.name)||!hex(change.previousDigest,64)||!hex(change.currentDigest,64)||change.previousDigest===change.currentDigest)fail('certificate_change');
   const entry=restored.find(r=>r.name===change.name);if(!entry||entry.digest!==change.currentDigest)fail('current_change_mismatch');entry.digest=change.previousDigest;
  }
  if(nonPinDigest(restored)!==c.beforeAggregate)fail('certificate_reconstruction');
 }
 return restored;
}
export function qualifyConfigurationDelta({current,certificates,expectedBaseline=baselineDigest,expectedKeyset=baselineKeysetDigest,expectedPin=priorSource}){
 if(expectedBaseline!==baselineDigest||expectedKeyset!==baselineKeysetDigest)fail('baseline_adoption');
 if(![priorSource,successorSource].includes(expectedPin)||canonical(current).find(r=>r.name==='N88_SERVICE_SOURCE_SHA')?.digest!==hash(expectedPin))fail('source_pin');
 const restored=reconstructExactChanges(current,certificates,baselineKeysetDigest);
 if(nonPinDigest(restored)!==baselineDigest)fail('unexplained_configuration');
 return {status:'PASS',baselineDigest,pinDigest:hash(expectedPin),currentNonPinDigest:nonPinDigest(current),keysetDigest:baselineKeysetDigest,certificateCount:certificates.length,changedKeys:[...new Set(certificates.flatMap(c=>c.changes.map(r=>r.name)))],unknownChangesAccepted:false};
}
export function qualifyAuthority(card,{runId,candidateSha,sessionId}){
 const a=card?.preparationAuthority;
 const phase=a?.committedSharedConfigurationPhase;
 if(phase?.wholeWorkerCompletionRequired!==false||phase.originalProducerIdentityRequired!==true||phase.actualOperationAndReadbackProofRequired!==true||phase.committedImmutableBytesRequired!==true||phase.exclusiveSharedMutationLeaseRequired!==true||phase.unknownDriftAccepted!==false)fail('phase_authority');
 const runtime=a?.exactRuntimeConfiguration;if(runtime?.originalRuntimeExpectedDigestsRequired!==true||runtime.completeIndirectDependencyProofRequired!==true||runtime.exactDynamicRecoveryKeysRequired!==true||runtime.committedN44ExpectedMapAndDeltasRequired!==true||runtime.wholeKeysetDigest!==baselineKeysetDigest||runtime.allNonPinEntriesUnchangedAcrossOperation!==true||runtime.historicalWholeAggregateClaimed!==false||runtime.unknownRuntimeDriftAccepted!==false||runtime.extraProviderWrites!==0||runtime.extraSqlOperations!==0)fail('runtime_authority');
 if(card?.id!==taskId||card.status!=='running'||card.productId!=='N88'||card.sessionId!==custodianSession||sessionId!==custodianSession||card.attempt?.runId!==runId||!runId||!hex(candidateSha,40)||card.liveAuthorizationRef!=='PO-20261023-QUALIFIED-N88-READ-SESSION-PRESERVATION'||a?.projectId!==projectId||a.productId!=='N88'||a.liveAuthorizationRef!==card.liveAuthorizationRef||a.originalPrivateCustodianOnly!==custodianSession||a.qualifiedCandidate!=='d27da1b34cb667be04d49efe354ee6ea811174ed'||a.successorSha256!==successorSource||a.maxChangedNativeFunctionUploads!==1||a.maxPublicSourcePinUpdates!==1||a.maxChangedPrivateStaticUploads!==0||a.newMigrations!==0||a.sqlAuthSchemaChanges!==0||a.realAccountReads!==0||a.realStudentTeacherWrites!==0||a.appendOnlyAttemptHistory!==true||a.resetConsumedMarkers!==false)fail('authority');
 return true;
}
export function qualifyReservation({state,history,markerExists,source=successorSource}){
 if(source!==successorSource||markerExists!==false||!Array.isArray(history)||history.some(r=>r.taskId===taskId)||!Array.isArray(state?.deniedReadTransitions??[])||(state.deniedReadTransitions??[]).some(r=>r.taskId===taskId)||state?.directSource!==priorSource||state.directVerified!==true||state.loginDisarmed||state.directAuthRefused||state.typedReadActivation?.migrationVerified!==true||state.typedReadActivation.migrationVersion!=='20261023070851')fail('consumed_or_custody');
 return true;
}
export function qualifyNativePreflight({native,configuration,now=Date.now()}){
 if(native?.status!=='ACTIVE'||native.version!==66||native.verifyJwt!==false||native.source!==priorSource||native.downloadedBytesExact!==true||native.importMapExact!==true||native.importMapDigest!=='24ba16ed2214c582f8386253a2714917a669f74fd19b2d2e5ac339f6498b43c8'||configuration?.status!=='PASS'||configuration.pinDigest!==hash(priorSource)||!Number.isFinite(Date.parse(native.observedAt))||now<Date.parse(native.observedAt)||now-Date.parse(native.observedAt)>20*60*1000)fail('preflight');
 return true;
}
