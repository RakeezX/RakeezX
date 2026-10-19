/** AI: retain immutable activation evidence and record the actual blocked probe. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const taskId='continuous-n44-cloudflare-redirect-transport-fix-20261019',runId='9485ed5a-6fed-4e65-a831-343a6bd11186';
const base='73c681da8633c2cc1ff1e269349322a7cb0e5e05',dir='drafts/n44-push/activation/';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const archive=dir+'transport-baseline/';await mkdir(archive,{recursive:true});
const baselineFiles=['tests/n44-finish-activation-final.json',...['cloudflare-off-readback.json','cloudflare-final-readback.json','cloudflare-final-versions.json','manifest.json'].map(p=>dir+p)];
const archived=[];
for(const file of baselineFiles){
 const bytes=execFileSync('git',['show',base+':'+file],{windowsHide:true});
 const target=archive+file.split('/').at(-1);await writeFile(target,bytes);
 archived.push({source:file,archive:target,sha256:hash(bytes),sourceCommit:base});
}
const original=await json(archive+'n44-finish-activation-final.json'),m=await json(dir+'manifest.json'),oldM=await json(archive+'manifest.json');
for(const file of ['edge/index.mjs','scheduler/worker.mjs']){
 assert.equal(m.outputs[file],oldM.outputs[file]);assert.equal(hash(await readFile(dir+'bundle/'+file)),oldM.outputs[file]);
}
for(const [file,expected]of Object.entries(oldM.sources))if(file!=='drafts/n44-push/cloudflare-entry.mjs')assert.equal(hash((await readFile(file,'utf8')).replaceAll('\r\n','\n')),expected,file);
const native=await json(dir+'transport-before-native.json'),version=await json(dir+'transport-before-version.json'),local=await json('tests/n44-finish-transport.local.json'),probe=await json('tests/n44-finish-transport.status.before.json');
const multipart=native.source.result,separator=multipart.indexOf('\r\n\r\n'),end=multipart.lastIndexOf('\r\n--');
assert.ok(separator>0&&end>separator);const nativeSource=multipart.slice(separator+4,end);
assert.equal(hash(nativeSource),'438bc5721e43c3c179e44f5a18e9a748291b913f28ecd1bc1240d2c164188a40');
assert.equal(local.localForwardAttempted,true);assert.equal(local.rejectsRedirects,true);assert.equal(local.statusPathForwards,false);
assert.equal(probe.httpStatus,401);assert.equal(probe.privateValuesReturned,false);
assert.equal(version.route.result.request_limit_fail_open,false);
const now=new Date().toISOString();
const checks=[
 {name:'n44_actual_cloudflare_proper_post_before_and_after',status:'FAIL',evidence:'Required POST /api/n44/status before repair returned401 at '+probe.recordedAt+'. Native source and actual local source/bundle handlers reject this path before forwarding. Before503 and after-upstream401 are not proved; after request/upload NOT_RUN pending exact probe correction.'},
 {name:'n44_manual_redirect_and_explicit_redirect_rejection',status:'PASS',evidence:'tests/n44-finish-transport.local.json: six affected checks across actual source and bundle; dispatch invoked once using manual mode and original HMAC/body envelope; eight3xx statuses rejected without reading/following/exposing; original guards/body limits/private mapping retained.'},
 {name:'n44_native_exact_ingress_source_and_binding_preservation',status:'NOT_RUN',evidence:'Read-only native baseline matched known-bad438bc572... source, existing five bindings (secret name only), deployed version64700bdd-201b-4bdf-9fe3-332bc7f034f0 and failclosed route. No upload or bindings change performed; corrected native exact-source/keep_bindings readback remains pending.'},
 {name:'n44_unchanged_restricted_tls_and_nonsending_scope',status:'PASS',evidence:'Reused original strictTLS/identity proof at '+original.restrictedIdentityAndFullTls.recordedAt+' with source'+original.serviceSourceSha+'; unchanged Edge/scheduler bundles and every prior manifest source except ingress verified by hashes. No database/Auth/secret/device/send/scheduler/frontend mutation; DNS10000 not retried.'}
];
const report={...original,taskId,runId,recordedAt:now,state:'BLOCKED',scope:'Ingress-only transport code locally corrected; provider mutation withheld because named pre-mutation probe cannot exercise forwarding.',
 originalActivationEvidence:{sourceCommit:base,originalRecordedAt:original.recordedAt,archive:archive+'n44-finish-activation-final.json',reused:true},
 transportCompatibility:{version:1,platform:'cloudflare-workers',redirectMode:'manual',rejectsRedirects:true,localForwardAttempted:true,beforeHttpStatus:probe.httpStatus,afterHttpStatus:null,probeMethod:'POST',probePath:'/api/n44/status',upstreamSourceUnchanged:true,originalCustodyUntouched:true,bindingsPreserved:true,nativeSourceExact:false,correctedIngressUploaded:false,statusPathForwards:false},
 actualTransportUnauthorizedHttp:[probe],checks,blocker:'The activated /api/n44/status probe is outside the immutable existing ROUTE allowlist and returns401 before forwarding. Exact supported read-path probe correction is required before the one transport before/after pair and ingress upload. No fake503 or frontend/route change.',
 cleanup:{...original.cleanup,liveMutationLeaseReleased:true,originalCustodyAccessed:false,providerMutationPerformed:false,ownedBrowserServerProcessesCreated:false},
 unchangedEvidenceReused:{restrictedTlsRecordedAt:original.restrictedIdentityAndFullTls.recordedAt,edgeRecordedAt:original.edgeFunction.recordedAt,secretConfig16:'Original historical providerSecretNamesAndDigestsMatched retained, no fresh secret read',scheduler:'Original cloudflare readbacks/versions retained unchanged; no scheduler request or upload',historicalCleanup:'tests/n44-finish-cleanup.json reused; no new temporary function deployed/disarmed/cleaned in this task',optionalDns:'Original10000 refusal retained and not retried'}};
await writeFile('tests/n44-finish-activation-final.json',JSON.stringify(report,null,2)+'\n');
await writeFile('tests/n44-finish-transport.result.json',JSON.stringify({aiAuthored:true,taskId,runId,baseSha:base,recordedAt:now,state:'BLOCKED',checks,archived,localBundleSha256:local.bundleSha256,nativeBeforeSourceSha256:hash(nativeSource),nativeBeforeExact:true,providerMutationPerformed:false,liveMutationLeaseReleased:true},null,2)+'\n');
// Existing actual-service receipt remains a historical activation claim; this local
// candidate must not suggest that its new ingress bytes are already on the provider.
m.pendingIngressTransport={taskId,runId,state:'BLOCKED',providerMutationPerformed:false,nativeSourceExact:false,receipt:'tests/n44-finish-transport.result.json',localBundleSha256:local.bundleSha256};
await writeFile(dir+'manifest.json',JSON.stringify(m,null,2)+'\n');
console.log('N44 bounded evidence saved: actual before401, transport gate BLOCKED, historical activation archived and unchanged evidence reused.');
