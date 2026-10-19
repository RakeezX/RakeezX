/** AI: bind only changed proof/source; no repeated runtime or provider checks. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const manifest=await read('drafts/n44-push/activation/device-optin/manifest.json');
for(const [p,h]of Object.entries(manifest.sources))assert.equal(hash((await readFile(p,'utf8')).replaceAll('\r\n','\n')),h,p);
for(const [p,h]of Object.entries(manifest.outputs))assert.equal(hash(await readFile('drafts/n44-push/activation/device-optin/'+p)),h,p);
const prior=await read('drafts/n44-push/activation/runtime-final-native.json');
assert.equal(prior.version,32);assert.equal(prior.sourceSha256,'705a2df980bc411a8a64f5f25b5b72e1f1f58abfdb8671d10125a48cf93a052f');
const deployedSource=(await readFile('drafts/n44-push/activation/bundle/edge/index.mjs','utf8')).replaceAll('\r\n','\n');
assert.equal(hash(deployedSource),prior.sourceSha256);
assert.equal(deployedSource.includes('n44-single-device-20261019-v1'),false);
const proofs=[];
for(const p of ['tests/n44-device-1019-guards.json','tests/n44-device-1019-browser.json','tests/n44-device-1019-service.json']){
 const proof=await read(p);assert.ok(proof.checks.length);assert.ok(proof.checks.every(c=>c.status==='PASS'));proofs.push({path:p,sha256:hash(await readFile(p)),checks:proof.checks.map(c=>c.name)});
}
const browser=await read('tests/n44-device-1019-browser.json');assert.equal(browser.cleanup.browserLease,'RELEASED browser');assert.equal(browser.cleanup.ownedBrowserClosed,true);assert.equal(browser.cleanup.ownedServerClosed,true);
for(const p of [...Object.keys(manifest.sources).filter(p=>/\.(?:m?js)$/.test(p)),'tests/n44-device-1019-guards.mjs','tests/n44-device-1019-service.mjs','tests/n44-device-1019-browser.mjs','tests/n44-device-1019-verify.mjs'])execFileSync(process.execPath,['--check',p],{stdio:'pipe',windowsHide:true});
execFileSync('git',['diff','--check'],{stdio:'pipe',windowsHide:true});
for(const [p,h]of [['supabase/migrations/20261018044448_n44_exact_activation_staged.sql','03979346de415c3aef5a97fe00a9d4de04fd58ec9cd5a8b0c58283fb5b4cb67f'],['supabase/migrations/20261018191000_n44_private_error_boundary_staged.sql','e38579bfac4987c6aee47d4ec26e6ba0aae6ef9f4f1c827b8d0faaef5a857e83']])assert.equal(hash((await readFile(p,'utf8')).replaceAll('\r\n','\n')),h);
const result={aiAuthored:true,taskId:manifest.taskId,runId:manifest.runId,state:'BLOCKED',baseSha:'71b76be39e553ffb60771300d90231042854174a',scope:'Phase1 source preparation, not hosted opt-in readiness',checks:[
 {name:'affected_local_service_budget_and_actual_ui_sw',status:'PASS',evidence:'Focused guard/service/browser proofs passed; exact prepared bundle graph, syntax, migration pins and diff checks passed.'},
 {name:'official_https_optin_binding_and_source_readback',status:'NOT_RUN',evidence:'Last verified native Edge v32 lacks the new single-device capability. Prepared Edge/ingress source is not deployed; N44_ONE_DEVICE_TEST_JSON is not bound. Current worker instruction explicitly prohibits deployment.'}
],proofs,preparedManifest:'drafts/n44-push/activation/device-optin/manifest.json',deployedSourceReused:{version:prior.version,sha256:prior.sourceSha256},historicalFailuresPreserved:['tests/n44-device-1019-browser.initial-timeout.json','tests/n44-device-1019-browser.diagnostic-timeout.json','tests/n44-device-1019-browser.activation-fixture-failure.json','tests/n44-device-1019-service.initial-dependency-failure.json'],providerWrites:0,hostedSqlOrAuthOperations:0,actualPermissionPrompts:0,actualDeviceRegistrations:0,providerSendAttemptsAcrossThisPhase:0,globalDeliveryEnabledByThisWorker:false,cronEnabledByThisWorker:false,osReception:'NOT_RUN',cleanup:browser.cleanup,blocker:'Prepared original Edge/ingress capability and private synthetic owner/device approval require authorized service publication/readback; this worker is expressly forbidden to deploy. Frontend stays failclosed against current service.',retryCondition:'Exact service-publication authority/path for the original N44 resources plus ordinary-UI identification of the designated fabricated owner/device; then source/config/public-key readback before phase2. Do not replay existing proofs, migrations or authentication diagnosis.'};
await writeFile('tests/n44-device-1019-result.json',JSON.stringify(result,null,2)+'\n');console.log('PASS: affected proof/source/cleanup bound. Hosted opt-in gate NOT_RUN; concrete publication blocker retained.');
