/** AI: reconcile finished receipts with preserved local proof; no live operation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {MOBILE503 as c,digest} from './native-gate.mjs';
const dir=c.evidence,read=async p=>(await readFile(p,'utf8')).replaceAll('\r\n','\n'),json=async p=>JSON.parse(await read(p));
const original=await json(dir+'qualification.json'),pre=await json(dir+'native-preflight.json'),uploaded=await json(dir+'native-upload.json'),pinned=await json(dir+'native-pin.json'),done=await json(dir+'native-complete.json'),before=await json(dir+'transport-before.json'),after=await json(dir+'transport-after.json');
assert.equal(original.localStatus,'PASS');assert.equal(original.candidateNativeSha256,c.source);
for(const r of [pre,uploaded,pinned,done,before,after]){assert.equal(r.taskId,c.task);assert.equal(r.runId,c.run);assert.equal(r.candidateSha,'ee399f57cebd144ea0dfb9a6ccddee435124533b');}
for(const r of [pre,uploaded,pinned,done])assert.equal(r.status,'PASS');
assert.equal(pre.originalCustodian,true);assert.equal(pre.attemptAvailable,true);assert.equal(pre.provider.version,59);assert.equal(uploaded.provider.version,60);assert.equal(pinned.provider.version,61);assert.equal(done.nativeVersion,61);
assert.equal(pre.provider.source,c.prior);assert.equal(uploaded.provider.source,c.source);assert.equal(pinned.provider.source,c.source);
assert.equal(pre.provider.pinDigest,digest(c.prior));assert.equal(uploaded.provider.pinDigest,digest(c.prior));assert.equal(pinned.provider.pinDigest,digest(c.source));
for(const r of [pre,uploaded,pinned]){assert.equal(r.provider.sourceExact,true);assert.equal(r.provider.verifyJwt,false);assert.equal(r.provider.otherConfigDigest,pre.provider.otherConfigDigest);assert.equal(r.provider.importMapDigest,pre.provider.importMapDigest);}
assert.equal(done.uploads,1);assert.equal(done.pinUpdates,1);assert.equal(done.sourceExact,true);assert.equal(done.publicPinMatches,true);assert.equal(done.otherConfigurationUnchanged,true);assert.equal(done.importMapUnchanged,true);assert.equal(done.accountRequests,0);assert.equal(done.readinessRequests,0);assert.equal(done.carrierUploads,0);
assert.deepEqual(before.provider,after.provider);assert.equal(before.provider.sourceSha256,done.transport.carrierSource);assert.equal(before.provider.version[0].percentage,100);
for(const r of [pre,done]){assert.equal(r.transport.safeAnonymousDenial,true);assert.equal(r.transport.httpStatus,401);assert.equal(r.transport.region,'ap-south-1');assert.equal(r.transport.noCookie,true);assert.equal(r.transport.noStore,true);assert.equal(r.transport.noReferrer,true);assert.equal(r.transport.nosniff,true);}
const native='drafts/n88-student-portal/activation/bundle/edge/index.mjs';assert.equal(digest(await readFile(native)),c.source);
for(const file of ['drafts/n88-student-portal/integrated-service.mjs',native,dir+'qualification.json',dir+'native-source-branch.json',dir+'red-first.json',dir+'native-red-first.json'])assert.equal(await read(file),execFileSync('git',['show',c.sourceCandidate+':'+file],{encoding:'utf8',maxBuffer:2097152}).replaceAll('\r\n','\n'));
for(const file of ['drafts/n88-student-portal/official-activation.mjs',dir+'native-gate.mjs'])assert.equal(await read(file),execFileSync('git',['show',done.candidateSha+':'+file],{encoding:'utf8',maxBuffer:2097152}).replaceAll('\r\n','\n'));
assert(!(await readdir(dir)).some(n=>n.endsWith('.tmp')));
const originalPhase=c.originalRoot+'/drafts/n88-student-portal/activation/owned-custody-4ddd5df2-933f-4754-8d04-0d27be47bcff.tmp/';
const ownedDone=await json(originalPhase+'mobile503-native-complete.json');assert.deepEqual(ownedDone,done);
const attempt=await json(originalPhase+'mobile503-native-attempt.json'),pinAttempt=await json(originalPhase+'mobile503-pin-attempt.json');
assert.equal(attempt.maxUploads,1);assert.equal(pinAttempt.maxUpdates,1);for(const r of [attempt,pinAttempt]){assert.equal(r.taskId,c.task);assert.equal(r.runId,c.run);assert.equal(r.candidateSha,done.candidateSha);}
assert(!(await readdir(originalPhase)).includes('mobile503-public-source-pin.env'));
for(const file of ['drafts/n88-student-portal/official-activation.mjs',native,dir+'native-gate.mjs',dir+'native-gate.test.mjs',dir+'qualify-native-delivery.mjs'])execFileSync(process.execPath,['--check',file],{encoding:'utf8'});
execFileSync('git',['diff','--check'],{encoding:'utf8'});
const gates=await json(dir+'native-gate-tests.json');assert.equal(gates.status,'PASS');assert.equal(gates.checks.length,6);
const manifestFile='drafts/n88-student-portal/activation/manifest.json',manifest=await json(manifestFile);assert.equal(manifest.outputs['edge/index.mjs'],c.source);
manifest.mobileSource503NativePrerequisite={taskId:c.task,runId:c.run,sourceCandidate:c.sourceCandidate,operationCandidate:done.candidateSha,sourceSha256:c.source,uploadedVersion:60,currentVersion:61,functionUploads:1,publicSourcePinUpdates:1,otherConfigurationUnchanged:true,importMapUnchanged:true,originalCustodianHistoryAppended:true,providerReadback:dir+'native-pin.json',servedTransportReadback:dir+'native-complete.json',carrierUploads:0,realAccountRequests:0,newReadinessRequests:0,actualTeacherRead:'NOT_RUN',frontendPublication:'SOLE_PUBLISHER_OWNED',verifiedAt:done.observedAt};
await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
const evidence={};for(const name of ['native-preflight','native-upload','native-pin','native-complete','transport-before','transport-after','native-gate-tests'])evidence[name]={path:dir+name+'.json',sha256:digest(await readFile(dir+name+'.json'))};
const result={taskId:c.task,runId:c.run,state:'LOCAL_READY',baseSha:c.base,sourceCandidate:c.sourceCandidate,operationCandidate:done.candidateSha,checks:original.checks.map(r=>r.name==='n88_changed_native_source_provider_pin_and_served_parity_if_needed'?{name:r.name,status:'PASS',evidence:'Original custodian fresh task/run/candidate-bound preflight; one native upload60 and one pin update61; exact official source/import-map/configuration/pin and unchanged carrier source/settings/routes parity; two anonymous missing-binding401 probes, no account or readiness request.'}:{...r,evidence:'Reused unchanged source-candidate proof: '+r.evidence}),evidence,sourceSha256:c.source,nativeVersion:61,originalCustodianHistoryAppended:true,consumedMarkersPreserved:true,wholeProductAcceptance:false,actualTeacherRead:'NOT_RUN',frontendProduction:'NOT_PUBLISHED_BY_WORKER',cleanup:{integrationLease:'RELEASED',liveMutationLease:'RELEASED',ownedTemporaryDirectoriesAbsent:true,publicPinEnvFileRemoved:true,browserOrLocalServerStarted:false}};
await writeFile(dir+'native-delivery-qualification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({state:result.state,nativeVersion:result.nativeVersion,checks:result.checks.map(r=>({name:r.name,status:r.status}))}));
