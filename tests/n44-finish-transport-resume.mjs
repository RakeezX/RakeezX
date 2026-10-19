/** AI: reconcile corrected before-proof and retained local evidence; no network or lease mutation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='drafts/n44-push/activation/',runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
const taskId='continuous-n44-cloudflare-redirect-transport-fix-20261019',runId='65b5a648-5daf-4334-90d6-948812ca669d';
const json=async p=>JSON.parse(await readFile(p,'utf8')),write=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const source='artifacts/ops-supervisor-v4/intake-evidence/po-20261019-supabase28p01/n44-correct-forward-route-before.json';
const before=await json('C:/Users/Abody/Projects/RakeezX/'+source),local=await json('tests/n44-finish-transport.local.json');
assert.equal(before.httpStatus,503);assert.equal(before.url,'https://rakeezx.com/api/n44/context/read');assert.equal(before.method,'POST');
assert.equal(before.cacheControl,'no-store, private');assert.equal(before.credentialUsed,false);assert.equal(before.accountOrDataMutation,false);
const manifest=await json(dir+'manifest.json'),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(await readFile(dir+'bundle/cloudflare/worker.mjs')),local.bundleSha256);
assert.equal(hash((await readFile('drafts/n44-push/cloudflare-entry.mjs','utf8')).replaceAll('\r\n','\n')),local.sourceSha256);
assert.ok(local.checks.every(c=>c.status==='PASS'));
const baseline=await json(dir+'transport-baseline/manifest.json');
for(const p of ['edge/index.mjs','scheduler/worker.mjs']){assert.equal(manifest.outputs[p],baseline.outputs[p]);assert.equal(hash(await readFile(dir+'bundle/'+p)),baseline.outputs[p]);}
const archived=[];
for(const file of ['tests/n44-finish-activation-final.json','tests/n44-finish-transport.result.json']){
 const target=dir+'transport-baseline/'+file.split('/').at(-1).replace('.json','.blocked-9485ed5a.json');
 await assert.rejects(access(target));const bytes=await readFile(file);await writeFile(target,bytes,{flag:'wx'});archived.push({source:file,archive:target,sha256:hash(bytes),candidateSha:'f9a1e579a3d5344f6622849b3e638f10b4d11d71'});
}
await write('tests/n44-finish-transport.context-read.before.json',{...before,reused:true,evidenceSource:source,admittedByCardRepairAt:'2026-10-19T06:05:50.121Z'});
const lease=await json(runtime+'leases/live-mutation.json');assert.equal(lease.taskId,'continuous-n88-official-student-portal-activation-20261018');assert.notEqual(lease.owner.token,runId);
const current=await json('tests/n44-finish-activation-final.json'),recordedAt=new Date().toISOString();
const blocker='Shared live-mutation lease is owned by active N88 worker '+lease.taskId+' (run '+lease.owner.token+', PID '+lease.owner.pid+', birth '+lease.owner.createdAt+'). Both bounded acquisition attempts returned BUSY; no ingress upload or afterPOST performed.';
const checks=[
 {name:'n44_actual_cloudflare_proper_post_before_and_after',status:'NOT_RUN',evidence:'Corrected beforePOST503 reused from '+before.at+'; original /status401 retained. AfterPOST401 awaits the shared live-mutation lease and exact ingress upload; no before request repeated.'},
 {name:'n44_manual_redirect_and_explicit_redirect_rejection',status:'PASS',evidence:'Six unchanged actual source/bundle checks reused from run '+local.runId+' at '+local.recordedAt+'. Current source and bundle hashes match; no suite/build replay.'},
 {name:'n44_native_exact_ingress_source_and_binding_preservation',status:'NOT_RUN',evidence:'Fresh read-only preupload snapshot retains existing five bindings, original deployment, failclosed route, Logpush false and observability null. keep_bindings upload and corrected source readback blocked by another owner lease; no secret values accessed.'},
 {name:'n44_unchanged_restricted_tls_and_nonsending_scope',status:'PASS',evidence:'Original TLS/identity at '+current.restrictedIdentityAndFullTls.recordedAt+' and service source '+current.serviceSourceSha+' reused. Edge/scheduler bundle hashes match. No Supabase/Auth/data/send/device/cron/frontend/secret mutation.'}
];
const transportCompatibility={...current.transportCompatibility,beforeHttpStatus:503,afterHttpStatus:null,probePath:'/api/n44/context/read',beforeEvidenceSource:source,beforeRecordedAt:before.at,correctedIngressUploaded:false,nativeSourceExact:false};delete transportCompatibility.statusPathForwards;
await write('tests/n44-finish-activation-final.json',{...current,taskId,runId,recordedAt,state:'BLOCKED',scope:'Corrected existing-route before503 and saved ingress implementation ready; native upload blocked by active N88 live-mutation lease.',transportCompatibility,actualTransportUnauthorizedHttp:[before],checks,blocker,
 cleanup:{...current.cleanup,liveMutationLeaseAcquired:false,liveMutationLeaseReleased:false,priorOwnedLeaseReleaseReused:true,leaseDisposition:'NOT_ACQUIRED_OTHER_OWNER',providerMutationPerformed:false},
 priorBlockedEvidence:archived,correctedProbeAuthority:{cardRepairAt:'2026-10-19T06:05:50.121Z',path:'/api/n44/context/read',productionAllowlistChanged:false}});
await write('tests/n44-finish-transport.result.json',{aiAuthored:true,taskId,runId,baseSha:'73c681da8633c2cc1ff1e269349322a7cb0e5e05',savedCandidateSha:'f9a1e579a3d5344f6622849b3e638f10b4d11d71',recordedAt,state:'BLOCKED',checks,blocker,archived,beforeEvidence:{source,at:before.at,httpStatus:503,reused:true},lease:{snapshot:lease,acquireAttempts:2,status:'BUSY',ownerProcessConfirmedAlive:true,ownerTaskConfirmedRunning:true,mutatedOrReleased:false},providerMutationPerformed:false,localBundleSha256:local.bundleSha256});
manifest.pendingIngressTransport={...manifest.pendingIngressTransport,runId,state:'BLOCKED',reason:'shared-live-mutation-lease-owned-by-active-N88',beforeHttpStatus:503,beforeEvidence:'tests/n44-finish-transport.context-read.before.json'};await write(dir+'manifest.json',manifest);
console.log('Corrected before503 admitted, original failures archived; unchanged local proof reused. Native upload/afterPOST blocked by active N88 lease; no provider mutation.');
