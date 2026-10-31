// AI: original trusted host only. Source-only, no network/credential defaults.
import {consumeManualIngestion} from '../manual-file-admission-1031/ingestion.mjs';
import {createManualAuthority,hash,GRANT,TASK} from './attestation.mjs';
const need=v=>{if(!v)throw Error('n44_manual_host_rejected');};
export function createManualHost({ingressKey,serviceSourceSha,uiSourceSha,producer,claimOnce,manualIntake,clock=Date.now}){
 const authority=createManualAuthority(ingressKey),admitted=new WeakMap(),batches=new WeakMap();
 need(/^[a-f0-9]{40}$/.test(serviceSourceSha)&&/^[a-f0-9]{40}$/.test(uiSourceSha));
 need(typeof producer.admitPhoneReadinessExport==='function'&&typeof producer.phoneBrowserOutcome==='function'&&typeof claimOnce==='function');
 function evidence(report,challenge){
  const v=report.value,m=v.manualContext;need(m&&Object.keys(m).sort().join(',')==='after,before');
  const args={checkpoint:v.documentCheckpoint,sourceSha:serviceSourceSha,now:clock()};
  const before=authority.verify(m.before,challenge,{...args,phase:'before'}),after=authority.verify(m.after,challenge,{...args,phase:'after'});
  need(after.previousHash===hash(m.before)&&before.pairHash===after.pairHash&&before.observedAt<=after.observedAt&&after.observedAt<=v.observedAt);
  return after;
 }
 return Object.freeze({
  issue:authority.issue,
  async admit({bytes,challenge,observedSha256,scope,privateKey,observation}){
   need(observation?.sourceSha===uiSourceSha&&observation.origin==='https://rakeezx.com'&&observation.reader==='mcp__cua_repl');
   need(observation.receiptSha256===observedSha256&&observation.runId===challenge.runId&&observation.nonce===challenge.nonce);
   // Existing helper retains its exact v2 encryption, byte and durable nonce fences.
   const r=await producer.admitPhoneReadinessExport({bytes,challenge,observedSha256,scope,privateKey,claimOnce,now:clock()});
   need(observation.documentCheckpoint===r.value.documentCheckpoint&&observation.observedAt===r.value.observedAt);
   evidence(r,challenge);await producer.phoneBrowserOutcome(r.value,clock());
   const report={report:r,challenge,scope};admitted.set(report,hash(report));return report;
  },
  async admitManualTransfer(input){
   need(Object.keys(input).sort().join(',')==='capability,challenge,privateKey,scope,slot');
   const {capability,challenge,scope,slot,privateKey}=input;
   const intake=await consumeManualIngestion(manualIntake,capability,{challenge,scope,slot});
   try{
    const r=await producer.admitPhoneReadinessExport({bytes:intake.bytes,challenge,observedSha256:intake.digest,scope,privateKey,claimOnce,now:clock()});
    const stamp=evidence(r,challenge);need(stamp.slot===slot);need(await producer.phoneBrowserOutcome(r.value,clock()));
    const admissionProvenance={...intake.provenance,expectedVerifiedUiSourceSha:uiSourceSha};
    const report={report:r,challenge,scope,admissionProvenance};admitted.set(report,hash(report));return report;
   }finally{intake.bytes.fill(0);}
  },
  async assemble(entries,scope,runId){
   need(entries.length===2&&scope.devices.length===2&&new Set(scope.devices).size===2&&entries.every(e=>admitted.has(e)&&admitted.get(e)===hash(e)));
   const ordered=scope.devices.map(d=>{const found=entries.filter(e=>e.scope.deviceId===d);need(found.length===1);return found[0];});
   const stamps=ordered.map((e,i)=>{need(e.challenge.runId===runId&&e.challenge.taskId===TASK&&e.challenge.grantId===GRANT);need(e.scope.ownerId===scope.ownerId&&e.scope.workspaceId===scope.workspaceId);const p=evidence(e.report,e.challenge);need(p.slot===i&&p.pair.every((x,j)=>x.deviceHash===hash(scope.devices[j])));return p;});
   need(stamps[0].pairHash===stamps[1].pairHash);
   const final=stamps.reduce((a,b)=>a.observedAt>b.observedAt?a:b);need(clock()-final.observedAt<=60000);
   // Equivalent to the earlier paired read: final server transaction locks both
   // live sessions and the owner context clock and revalidates the exact pair.
   // Comparing canonical full pair digests rejects consent/session/metadata ABA.
   const result=await producer.assemblePhoneReadiness({reports:ordered.map(e=>e.report),scope,runId,grantId:GRANT,now:clock(),verifyHostReadback:async()=>{
    need(final.pair.every(x=>x.registration===null));
    return {runId,grantId:GRANT,ownerId:scope.ownerId,workspaceId:scope.workspaceId,observedAt:final.observedAt,authenticated:true,peerReadbackAuthenticated:true,
     peerBeforeSha256:stamps[0].pairHash,peerAfterSha256:stamps[1].pairHash,documentCheckpoint:ordered[stamps.indexOf(final)].report.value.documentCheckpoint,
     devices:scope.devices.map(deviceId=>({deviceId,authenticated:true,registrationSource:'authenticated-context-read',registrationEnabled:false}))};
   }});
   need(clock()-final.observedAt<=60000);if(result.status)return result;
   const batch={result,finalAttestation:ordered[stamps.indexOf(final)].report.value.manualContext.after};
   if(ordered.some(e=>e.admissionProvenance)){
    need(ordered.every(e=>e.admissionProvenance?.kind==='manual-file-ingestion'));
    batch.manualProvenance=ordered.map(e=>structuredClone(e.admissionProvenance));
    batch.manualFreshUntil=Math.min(...ordered.flatMap(e=>[e.challenge.expiresAt,e.report.value.observedAt+60001,e.report.value.phone.runtime.deviceOutcome.observedAt+60001,
     ...['before','after'].flatMap(p=>[e.report.value.manualContext[p].payload.expiresAt,e.report.value.manualContext[p].payload.observedAt+60001])]));
    need(clock()<batch.manualFreshUntil);
   }
   batches.set(batch,hash(batch));return batch;
  },
  manualTransferProvenance(batch){need(batches.has(batch)&&batches.get(batch)===hash(batch)&&batch.manualProvenance&&clock()<batch.manualFreshUntil);return structuredClone(batch.manualProvenance);},
  prepared(batch){need(batches.has(batch)&&batches.get(batch)===hash(batch));need(clock()-batch.finalAttestation.payload.observedAt<=60000);if(batch.manualFreshUntil!==undefined)need(clock()<batch.manualFreshUntil);return structuredClone(batch.result);},
 });
}
