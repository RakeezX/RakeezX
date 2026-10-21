/** AI: reuse exact local proof and verify actual completed private-static receipts. No network. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {STUDENT_PENDING_STATIC as c,verifyStudentStaticArtifacts,staticDigest as sha} from '../../drafts/n88-student-portal/activation/static-student-pending-20261021-gate.mjs';
const dir=c.evidence,json=async file=>JSON.parse(await readFile(dir+file,'utf8'));
const proof=await json('qualification.json'),custody=await json('custody.json'),done=await json('static-delivery.json'),reservation=await json('static-reservation.json'),pre=await json('provider-preflight.json'),receipt=await json('carrier-readback.json'),upload=await json('upload-response.json');
const report={taskId:c.task,runId:c.run,baseSha:c.base,preparedCandidate:c.candidate,status:'FAIL',checks:[],reusedEvidence:{},receiptHashes:{}};
const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
execFileSync('git',['merge-base','--is-ancestor',c.candidate,'HEAD'],{windowsHide:true});
for(const [file,hash] of Object.entries(proof.changedSourceHashes))assert.equal(sha((await readFile(file,'utf8')).replaceAll('\r\n','\n')),hash,file);
for(const [file,hash] of Object.entries(proof.evidence)){
 assert.equal(sha(await readFile(dir+file)),hash,file);report.reusedEvidence[file]=hash;
}
for(const file of ['ui.json','transport.json'])assert.equal((await json(file)).status,'PASS');
pass('n88_pending_bootstrap_return_never_exposes_code_form_or_private_data_before_verified_result','Reused exact committed test-first/current DOM evidence at390/1280px; Product source and evidence bytes unchanged.');
pass('n88_read_outcome_is_current_bounded_and_truthful_for_200_401_5xx_timeout_and_late_reply','Reused current-context GET, explicit denial, rate/malformed/unavailable/timeout, superseded/late, one-return-request proof.');
pass('n88_end_hidden_ack_uncertainty_and_late_reply_are_safe_and_finite','Reused actual UI hidden End ACK/uncertainty/rate/deadline/pagehide/dispose and no replay/late private disclosure proof.');
pass('n88_optional_diagnostic_is_allowlisted_private_and_adds_no_request','Reused finite seven-field clipboard/fallback/hidden completion and zero extra requests/storage proof.');
assert.equal(custody.status,'PASS');
assert.equal(sha((await readFile('drafts/n88-student-portal/activation/static-student-pending-20261021-gate.mjs','utf8')).replaceAll('\r\n','\n')),custody.guardSha256);
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
pass('n88_changed_private_static_custody_and_served_parity','Actual original-custodian task/run/candidate-bound reservation, one carrier upload,100% provider module parity, native v59/public pin unchanged, served JS/CSS exact with privacy headers, append-only completion PASS. Allowance consumed; no repeat upload.');
report.observedOriginMain=execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim();
const paths=[...Object.keys(proof.changedSourceHashes),'drafts/n88-student-portal/official-activation.mjs','drafts/n88-student-portal/activation/static-student-pending-20261021-gate.mjs'];
assert.equal(execFileSync('git',['diff',c.base+'..'+report.observedOriginMain,'--',...paths],{encoding:'utf8'}),'');
report.status='PASS';report.limits='Private-static prerequisite only. No Product main push, native deployment, public pin/region/service/data change, frontend Production publication or PO acceptance. Unchanged local UI evidence reused.';
await writeFile(dir+'final-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks,observedOriginMain:report.observedOriginMain}));
