/** AI: fixed shared-configuration reconstruction; no I/O, adoption or writes. */
import {hash} from './prepare.mjs';
import {canonicalMetadata,nonPinDigest} from './config-provenance.mjs';
export const historicalAggregate='347cc9ac19fba751af0eb461d80dba157b2a72279e2ece9722159f27f0fb9186';
export const producerTask='continuous-n44-one-approved-closed-page-push-20261019';
export const producerSession='01a14fcd-032c-7ec0-8b0c-0e0395862c61';
const allowed=['N44_ONE_DEVICE_TEST_JSON','N44_DELIVERY_ENABLED'];
const deny=code=>{throw Error('n88_typed_delta_'+code);};
// Input proof is a finite normalized view of a separately committed certificate.
// The caller must bind its actual Git blob and public receipt hashes first.
export function verifyExactDelta({current,proof,binding,expectedHistoricalAggregate=historicalAggregate}){
 if(Object.keys(proof).sort().join(',')!=='candidateSha,changes,currentAggregate,keysetDigest,reconstructedAggregate,runId,sessionId,taskId')deny('proof_shape');
 if(proof.taskId!==producerTask||proof.sessionId!==producerSession||proof.runId!==binding.runId||proof.candidateSha!==binding.candidateSha||binding.taskId!==producerTask||binding.sessionId!==producerSession||binding.committed!==true||binding.publicProofsVerified!==true||!/^[a-f0-9]{40}$/.test(binding.candidateSha)||!binding.runId)deny('binding');
 if(expectedHistoricalAggregate!==historicalAggregate)deny('historical_identity');
 const entries=canonicalMetadata(current),keysetDigest=hash(JSON.stringify(entries.map(r=>r.name)));
 if(proof.currentAggregate!==nonPinDigest(entries)||proof.keysetDigest!==keysetDigest)deny('current_identity');
 if(!Array.isArray(proof.changes)||proof.changes.length<1||proof.changes.length>2||new Set(proof.changes.map(c=>c.name)).size!==proof.changes.length)deny('changes_shape');
 if(!proof.changes.some(c=>c.name==='N44_ONE_DEVICE_TEST_JSON'))deny('required_disarm');
 const restored=entries.map(r=>({...r}));
 for(const c of proof.changes){
  if(Object.keys(c).sort().join(',')!=='currentDigest,name,priorDigest'||!allowed.includes(c.name)||!/^[a-f0-9]{64}$/.test(c.priorDigest)||!/^[a-f0-9]{64}$/.test(c.currentDigest))deny('change_identity');
  const actual=restored.find(r=>r.name===c.name);
  if(!actual||actual.digest!==c.currentDigest||c.currentDigest!==hash(c.name==='N44_ONE_DEVICE_TEST_JSON'?'null':'false'))deny('disarmed_identity');
  if(c.priorDigest===c.currentDigest)deny('unnecessary_change');
  actual.digest=c.priorDigest;
 }
 if(proof.reconstructedAggregate!==historicalAggregate||nonPinDigest(restored)!==historicalAggregate)deny('reconstruction');
 return {status:'PASS',currentNonPinAggregate:nonPinDigest(entries),reconstructedHistoricalAggregate:historicalAggregate,keysetDigest,changedKeys:proof.changes.map(c=>c.name),providerWrites:0};
}
