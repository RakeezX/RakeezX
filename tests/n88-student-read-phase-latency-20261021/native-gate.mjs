/** AI: one task-bound native prerequisite; original custodian supplies all ports.
 * No provider call, secret, upload or configuration operation at import. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const LATENCY=Object.freeze({
  "task": "continuous-n88-student-read-phase-latency-20261021",
  "run": "2c1fb6b8-d4ce-428a-8539-65e83d5a6a86",
  "session": "01a15e63-ff70-7d02-b264-2631fc585456",
  "base": "e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3",
  "sourceCandidate": "c072fac17ca761751be88982b7ba75e4f0f3aa3f",
  "prior": "ec0efc049b20f7119b3b5eea8b55a93a52bdfd6981647bf97298383a9f37f507",
  "source": "6ebb7e07e838a14662e03b9a8908ade05d8768ed00f306b54f2d8f98d0931d09",
  "originalRoot": "C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018",
  "taskRoot": "C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-student-read-phase-latency-20261021",
  "authorization": "PO-20261021-N88-STUDENT-GET-MEASURED-LATENCY",
  "evidence": "tests/n88-student-read-phase-latency-20261021/"
});
export const digest=b=>createHash('sha256').update(b).digest('hex');
const must=(b,c)=>assert(b,'n88_latency_'+c);
export function latencyAuthority({card,run,candidate,activationId,leases}){
 const c=LATENCY,a=card.preparationAuthority;
 must(card.id===c.task&&card.productId==='N88'&&card.status==='running'&&card.sessionId===c.session&&card.attempt?.runId===run&&run===c.run,'identity');
 must(card.activationId===activationId&&activationId==='po-20261012-continuous','activation');
 must(card.baseSha===c.base&&card.worktreePath?.replaceAll('\\','/').toLowerCase()===c.taskRoot.toLowerCase(),'base_worktree');
 must(/^[a-f0-9]{40}$/.test(candidate)&&card.liveAuthorizationRef===c.authorization&&a?.kind==='PO-20261021-N88-student-GET-measured-latency'&&a.publication===true,'authority');
 for(const k of ['realAccountReads','realStudentTeacherWrites','newReadinessRequests','sqlAuthSchemaChanges','regionChanges'])must(a[k]===0,'boundary_'+k);
 must(a.maxChangedNativeFunctionUploads===1&&a.maxPublicSourcePinUpdates===1&&a.originalCustodianRoot===c.originalRoot&&a.appendOnlyAttemptHistory===true&&a.resetConsumedMarkers===false,'once_only');
 for(const name of ['integration','live-mutation']){const l=leases[name];must(l?.version===2&&l.resource===name&&l.taskId===c.task&&l.activationId===activationId&&l.owner?.type==='worker'&&l.owner.token===run,'lease_'+name);}
 return {taskId:c.task,runId:run,candidateSha:candidate,sourceCandidate:c.sourceCandidate,prior:c.prior,source:c.source};
}
export async function runLatencyNativePhase(action,p){
 const c=LATENCY,stamp=latencyAuthority(p),{readOwned,writeOwned,readReceipt,writeReceipt,load,save,readProvider,upload,pin,readTransport,verifyCandidate}=p;
 must(['preflight','upload','pin','complete'].includes(action),'action');await verifyCandidate(stamp.candidateSha);
 must(auditDiagnosticAuthority(p.card),'diagnostic_authority');
 const state=await load();must(state.directVerified===true&&!state.loginDisarmed&&!state.directAuthRefused,'owned_state');
 const history=state.sourceCorrections??[];must(Array.isArray(history),'history');
 const attempt='latency-native-attempt.json',pinAttempt='latency-pin-attempt.json',complete='latency-native-complete.json';
 const absent=async name=>{try{await readOwned(name);must(false,'attempt_consumed');}catch(e){if(e.code!=='ENOENT')throw e;}};
 const same=r=>{for(const [k,v]of Object.entries(stamp))must(r[k]===v,'receipt_binding');};
 const fresh=r=>{const age=Date.now()-Date.parse(r.observedAt);must(Number.isFinite(age)&&age>=-30000&&age<=15*60*1000,'freshness');};
 if(action==='preflight'){
  must(state.directSource===c.prior&&!history.some(h=>h.taskId===c.task),'source_preimage');await absent(attempt);await absent(pinAttempt);await absent(complete);
  const provider=await readProvider('before',c.prior);must(provider.sourceExact===true&&provider.version===61&&provider.verifyJwt===false&&provider.pinDigest===digest(c.prior),'provider_preimage');
  const transport=await readTransport('before');must(transport.safeAnonymousDenial===true&&transport.region==='ap-south-1','transport_preimage');
  const r={...stamp,status:'PASS',observedAt:new Date().toISOString(),provider,transport,historyDigest:digest(JSON.stringify(history)),originalCustodian:true,attemptAvailable:true,providerWrites:0};await writeReceipt('native-preflight',r);return r;
 }
 const pre=await readReceipt('native-preflight');same(pre);
 if(action==='upload'){
  fresh(pre);must(state.directSource===c.prior&&digest(JSON.stringify(history))===pre.historyDigest,'preimage_history');await absent(attempt);await absent(pinAttempt);await absent(complete);
  assert.deepEqual(await readProvider('pre-upload',c.prior),pre.provider,'n88_latency_fresh_upload_preimage');
  const reservation={...stamp,reservedAt:new Date().toISOString(),preflightDigest:digest(JSON.stringify(pre)),maxUploads:1};
  // Exclusive append-only reservation precedes the sole provider mutation. Never
  // delete/reuse this file when an upload fails or acknowledgement is uncertain.
  await writeOwned(attempt,reservation);await upload();
  const provider=await readProvider('uploaded',c.source);must(provider.sourceExact&&provider.version===pre.provider.version+1&&provider.verifyJwt===false&&provider.pinDigest===digest(c.prior)&&provider.otherConfigDigest===pre.provider.otherConfigDigest&&provider.importMapDigest===pre.provider.importMapDigest,'uploaded_readback');
  const r={...stamp,status:'PASS',observedAt:new Date().toISOString(),provider,uploads:1};await writeReceipt('native-upload',r);return r;
 }
 const reserved=await readOwned(attempt);same(reserved);must(reserved.maxUploads===1&&reserved.preflightDigest===digest(JSON.stringify(pre)),'reservation');
 const uploaded=await readReceipt('native-upload');same(uploaded);
 if(action==='pin'){
  fresh(uploaded);must(state.directSource===c.prior&&digest(JSON.stringify(history))===pre.historyDigest,'pin_owned_preimage');await absent(pinAttempt);await absent(complete);
  assert.deepEqual(await readProvider('pre-pin',c.source),uploaded.provider,'n88_latency_fresh_pin_preimage');
  await writeOwned(pinAttempt,{...stamp,reservedAt:new Date().toISOString(),maxUpdates:1});await pin();
  const provider=await readProvider('pinned',c.source);must(provider.sourceExact&&provider.version>=uploaded.provider.version&&provider.verifyJwt===false&&provider.pinDigest===digest(c.source)&&provider.otherConfigDigest===pre.provider.otherConfigDigest&&provider.importMapDigest===pre.provider.importMapDigest,'pin_readback');
  const r={...stamp,status:'PASS',observedAt:new Date().toISOString(),provider,pinUpdates:1};await writeReceipt('native-pin',r);return r;
 }
 const pinned=await readReceipt('native-pin');same(pinned);fresh(pinned);same(await readOwned(pinAttempt));await absent(complete);
 must(state.directSource===c.prior&&digest(JSON.stringify(history))===pre.historyDigest,'completion_preimage');
 const transport=await readTransport('after');must(transport.safeAnonymousDenial===true&&transport.region==='ap-south-1','served_transport');
 const entry={...stamp,nativeVersion:pinned.provider.version,uploadedVersion:uploaded.provider.version,uploads:1,pinUpdates:1};
 const done={...entry,status:'PASS',observedAt:new Date().toISOString(),sourceExact:true,publicPinMatches:true,otherConfigurationUnchanged:true,importMapUnchanged:true,transport,accountRequests:0,readinessRequests:0,carrierUploads:0};
 await writeOwned(complete,done);state.sourceCorrections=[...history,entry];state.directSource=c.source;await save(state);await writeReceipt('native-complete',done);return done;
}

function auditDiagnosticAuthority(card){const a=card.preparationAuthority;return a.diagnosticOnlyOnSuccessfulGet===true&&a.diagnosticOnlyFixedRoundedPhaseDurations===true&&a.maxChangedPrivateStaticUploads===1&&a.maxChangedStudentCarrierUploads===1;}
