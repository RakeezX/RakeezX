/** AI: consume actual original N44 expected-map/admission/final-disarm phase, not lost history. */
import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {committedPublicBytes} from './committed-phase.mjs';
import {canonical,hash,n44Task,n44Session,baselineKeysetDigest} from './transition-guards.mjs';
import {n44Keys} from './runtime-configuration.mjs';
const producer='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n44-one-approved-closed-page-push-20261019';
const deny=c=>{throw Error('n88_runtime_phase_'+c);};
export function qualifyExpectedMapCertificate(c){
 const map=canonical(c?.expectedMap);
 if(c.version!==1||c.taskId!==n44Task||c.originalCustodianSession!==n44Session||c.expectedCurrentMapStatus!=='PASS'||c.exactN44KeysetAndDigestsAgree!==true||c.wholeProjectKeysetExact!==true||c.wholeProjectKeysetDigest!==baselineKeysetDigest||c.allOtherConfigurationUnchangedSinceAdmission!==true||c.expectedDigest!==hash(JSON.stringify(map))||JSON.stringify(map.map(r=>r.name))!==JSON.stringify([...n44Keys].sort((a,b)=>a.localeCompare(b)))||c.expectedProvenance!=='Acknowledged original s.envDigests captured before comparison; admitted policy and final null approval retained'||!(Date.parse(c.expectedComputedAt)<=Date.parse(c.recordedAt))||c.rawPrivateValuesReturned!==false||c.approvalNull!==true||c.deliveryOff!==true)deny('expected_map_provenance');
 if(map.find(r=>r.name==='N44_SERVICE_SOURCE_SHA').digest!==hash(c.source)||map.find(r=>r.name==='N44_ONE_DEVICE_TEST_JSON').digest!==hash('null')||map.find(r=>r.name==='N44_DELIVERY_ENABLED').digest!==hash('false')||map.find(r=>r.name==='N44_SESSION_POLICY_JSON').digest!==c.knownPolicyDelta?.currentDigest)deny('final_identity');
 return map;
}
export async function loadRuntimePhase(binding){
 const card=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+n44Task+'.json','utf8')).replace(/^\uFEFF/,''));
 if(card.id!==n44Task||card.sessionId!==n44Session||binding?.mode!=='exact-runtime-v1')deny('authority_binding');
 const read=ref=>JSON.parse(committedPublicBytes(producer,binding.revision,ref.path,ref.sha256).toString());
 const cert=read(binding.certificate),before=read(binding.previousMap),release=read(binding.release),outcome=read(binding.outcome),native=read(binding.nativeReadback),map=qualifyExpectedMapCertificate(cert);
 if(cert.runId!==binding.producerRun||before.runId!==cert.runId||before.originalCustodianSession!==n44Session||before.expectedCurrentMapStatus!=='PASS'||before.privateValuesReturned!==false||before.expectedProvenance!=='Original acknowledged s.envDigests; captured before provider comparison'||before.expectedDigest!==hash(JSON.stringify(canonical(before.expectedMap))))deny('original_expected_preimage');
 if(outcome.taskId!==n44Task||outcome.runId!==cert.runId||outcome.resumedCandidate!==binding.sourceCandidate||outcome.serviceSourceSha!==cert.source||outcome.nativeVersion!==cert.nativeVersion||native.sourcePin!==cert.source||native.version!==cert.nativeVersion||native.ezbr_sha256!=='38ec187f1545c9e0d486329bb326bf3cf3b2a68b42374b7610fbd69cae247da9'||native.status!=='ACTIVE'||native.verify_jwt!==false)deny('native_source_binding');
 execFileSync('git',['merge-base','--is-ancestor',binding.sourceCandidate,binding.revision],{cwd:producer,stdio:['ignore','pipe','pipe']});
 if(release.runId!==cert.runId||release.status!=='PASS'||release.ownedLeaseHeld?.['live-mutation']!==false||release.ownedPrivateStagePresent!==false||release.officialChildExited!==true)deny('phase_not_released');
 const receipts={};for(const [name,digest] of Object.entries(cert.receiptSha256??{})){
  if(!/^[a-z-]+$/.test(name))deny('receipt_path');const p=binding.certificate.path.slice(0,binding.certificate.path.lastIndexOf('/')+1)+name+'.json';
  const r=read({path:p,sha256:digest});if(r.taskId!==n44Task||r.runId!==cert.runId)deny('receipt_identity');receipts[name]=r;
 }
 const policy=receipts['fresh-policy-admission'],arm=receipts['hosted-rearm-config'],off=receipts['hosted-old-disarmed'];
 if(policy?.status!=='PASS'||policy.writeAcknowledged!==true||policy.writeAttempts!==1||policy.onlyPolicyChanged!==true||policy.allOtherConfigurationUnchanged!==true||policy.wholeConfigKeysetDigest!==baselineKeysetDigest||JSON.stringify(policy.changedKeys)!==JSON.stringify([cert.knownPolicyDelta]))deny('policy_delta');
 if(arm?.status!=='PASS'||arm.allOtherConfigurationUnchanged!==true||JSON.stringify(arm.changedKeys)!==JSON.stringify([{name:'N44_ONE_DEVICE_TEST_JSON',previousDigest:cert.capabilityRoundTrip.beforeDigest,currentDigest:cert.capabilityRoundTrip.armedDigest}])||off?.approvalNull!==true||off.deliveryOff!==true||cert.capabilityRoundTrip.beforeDigest!==hash('null')||cert.capabilityRoundTrip.finalDigest!==hash('null'))deny('approval_disarm_delta');
 const expected=canonical(before.expectedMap).map(r=>r.name==='N44_SESSION_POLICY_JSON'?{name:r.name,digest:cert.knownPolicyDelta.currentDigest}:r);if(JSON.stringify(expected)!==JSON.stringify(map))deny('unexplained_expected_change');
 return {expectedMap:map,phase:{status:'PASS',producerTask:n44Task,producerSession:n44Session,producerRun:cert.runId,revision:binding.revision,sourceCandidate:binding.sourceCandidate,certificateSha256:binding.certificate.sha256,expectedBeforeComparison:true,exactN44Keyset:true,actualPolicyDeltaVerified:true,finalApprovalDisarmed:true,resourceReleaseVerified:true,historicalWholeAggregate:cert.historicalChainStatus,wholeWorkerCompletionRequired:false}};
}
