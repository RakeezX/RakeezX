/** AI: reconcile unchanged app proof and completed static prerequisite; no network. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {STUDENT_QUIET_STATIC as c,verifyStudentStaticArtifacts,staticDigest as sha} from '../../drafts/n88-student-portal/activation/static-student-quiet-return-20261021-gate.mjs';
const dir=c.evidence,json=async file=>JSON.parse(await readFile(dir+file,'utf8'));
const proof=await json('qualification.json'),custody=await json('custody.json'),done=await json('static-delivery.json'),reservation=await json('static-reservation.json'),pre=await json('provider-preflight.json'),receipt=await json('carrier-readback.json'),upload=await json('upload-response.json');
const report={taskId:c.task,runId:c.run,baseSha:c.base,preparedCandidate:c.candidate,status:'FAIL',checks:[],reusedEvidence:{},receiptHashes:{}};
const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
execFileSync('git',['merge-base','--is-ancestor',c.candidate,'HEAD'],{windowsHide:true});
for(const [file,hash] of Object.entries(proof.changedSourceHashes))assert.equal(sha((await readFile(file,'utf8')).replaceAll('\r\n','\n')),hash,file);
for(const [file,hash] of Object.entries(proof.evidence)){
 const location=file.startsWith('tests/')?file:dir+file;
 assert.equal(sha(await readFile(location)),hash,file);report.reusedEvidence[location]=hash;
}
assert.equal((await json('baseline.json')).status,'PASS');assert.equal((await json('ui.json')).status,'PASS');
pass('n88_open_return_single_current_authoritative_get_and_finite_latency_accounting','Exact original baseline/current DOM proof reused; one GET per initial/return phase, return dispatch 1–2ms, controlled network delay accounted separately. No live speed claim.');
pass('n88_no_private_or_code_form_flash_before_current_result','Exact actual source and private application DOM/handlers/CSS proof at 390/1280px reused, including hidden initial GET, duplicates and late replies.');
pass('n88_quiet_accessible_pending_and_truthful_denied_unavailable_outcomes','Unchanged inspected pending/recovery screenshots, live status, indeterminate progressbar, reduced-motion CSS, denial entry and finite 503/timeout recovery proof reused.');
pass('n88_end_and_late_reply_security_fences_unchanged','Unchanged transport and view control flow; current DOM End acknowledgement/uncertainty/pagehide and unchanged extended deadline/rate/claim/Support proof reused.');
assert.equal(custody.status,'PASS');
assert.equal(sha((await readFile('drafts/n88-student-portal/activation/static-student-quiet-return-20261021-gate.mjs','utf8')).replaceAll('\r\n','\n')),custody.guardSha256);
assert.equal(sha((await readFile('drafts/n88-student-portal/official-activation.mjs','utf8')).replaceAll('\r\n','\n')),custody.officialEntrySha256);
for(const r of [done,reservation,pre,receipt,upload]){assert.equal(r.taskId,c.task);assert.equal(r.runId,c.run);assert.equal(r.preparedCandidate,c.candidate);}
assert.equal(done.status,'PASS');assert.equal(done.sourceExact,true);assert.equal(done.servedAssetExact,true);assert.equal(done.historyAppended,true);assert.equal(done.nativePinUnchanged,true);
assert.equal(reservation.maxUploads,1);assert.equal(reservation.attemptReserved,true);assert.equal(reservation.source,c.carrier);assert.equal(upload.success,true);assert.equal(upload.uploads,1);assert.equal(receipt.uploads,1);
assert.equal(pre.officialServer,'rakeez_cloudflare');assert.equal(pre.savedSession,c.session);assert.equal(pre.sameSavedSessionReadOnlyCapabilityVerified,true);
for(const when of ['before','after']){
 const n=await json('read-native-'+when+'.json');assert.equal(n.status,'PASS');assert.equal(n.nativeVersion,pre.nativeVersion);assert.equal(n.nativeSource,pre.nativeSource);assert.equal(n.sourceExact,true);
 assert.equal(sha(await readFile(dir+'provider-native'+(when==='after'?'-after':'')+'.mjs')),pre.nativeSource);
}
for(const key of ['settings','routes','subdomain'])assert.deepEqual(receipt[key],pre[key]);
assert.equal(receipt.carrierPercentage,100);assert.notEqual(receipt.version,pre.carrierVersion);assert.equal(sha(await readFile(dir+'provider-carrier.mjs')),c.carrier);
verifyStudentStaticArtifacts(await readFile(dir+'provider-preimage.mjs'),await readFile(dir+'provider-carrier.mjs'),await readFile('drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'),await readFile('drafts/n88-student-portal/activation/bundle/private/styles/student-portal-login.css'));
for(const [file,hash,fields] of [['served-student.mjs',c.student,['servedStatus','servedType','servedHeaders','text/javascript']],['served-style.css',c.style,['servedStyleStatus','servedStyleType','servedStyleHeaders','text/css']]]){
 assert.equal(sha(await readFile(dir+file)),hash);assert.equal(receipt[fields[0]],200);assert.equal(receipt[fields[1]],fields[3]);assert.deepEqual(receipt[fields[2]],{noStore:true,noReferrer:true,nosniff:true});
}
for(const file of ['custody.json','cloudflare-before.json','cloudflare-after.json','owned-preflight.json','read-native-before.json','read-native-after.json','provider-preflight.json','preflight.json','static-reservation.json','upload-response.json','carrier-readback.json','static-delivery.json'])report.receiptHashes[file]=sha(await readFile(dir+file));
pass('n88_changed_private_static_provider_native_and_served_parity_if_changed','Fresh original-custodian task/run/prepared-candidate reservation; one official carrier upload; exact provider and served JS/CSS with privacy headers; native v61/source/public pin and settings/routes/subdomain unchanged; append-only completion PASS. Allowance consumed; no repeat upload.');
report.native={version:pre.nativeVersion,source:pre.nativeSource,unchanged:true};
report.staticVersion=receipt.version;
report.resources={integration:'released',liveMutation:'released',browser:'not reacquired; unchanged UI proof reused'};
report.status='PASS';report.limits='Private-static prerequisite only. No Product main push, native deployment, SQL/Auth/cookie/public pin/region/data change, frontend Production publication or PO acceptance. Actual service GET latency remains unresolved.';
await writeFile(dir+'final-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks,native:report.native,staticVersion:report.staticVersion}));
