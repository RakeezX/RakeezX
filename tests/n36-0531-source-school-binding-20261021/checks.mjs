// AI: aggregate the affected real HTTP runtime evidence; never certify publication.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='tests/n36-0531-source-school-binding-20261021/';
const read=async name=>JSON.parse(await fs.readFile(folder+name+'.json','utf8'));
const [browser,receiver,proof,pkg]=await Promise.all(['browser','receiver','proof-cases','package'].map(read));
for(const value of [browser,receiver,proof,pkg])assert.equal(value.status,'PASS');
const manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.32.manifest.json','utf8'));
const hash=createHash('sha256');
for(const file of manifest.files){const bytes=await fs.readFile('extensions/rakeez-teacher-import-helper/'+file.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);hash.update(file.file);hash.update(bytes);}
const runtimeFingerprint=hash.digest('hex');
assert.equal(browser.runtimeFingerprint,runtimeFingerprint);assert.equal(receiver.runtimeFingerprint,runtimeFingerprint);
assert.equal(browser.scenarios.length,70);assert.equal(receiver.checks.length,25);assert.equal(proof.cases.length,27);assert.equal(proof.diagnosticAllowlist,'PASS');
const baseline=browser.scenarios.find(s=>s.baseline&&s.scenario==='complete');
assert.equal(baseline.actual,'UNCONFIRMED_TEACHER_ROLE');
assert.deepEqual(baseline.sourceHome,{schoolBadgePresent:false,schoolIdPresent:true,readProofPresent:false,schoolBindingState:'none'});
for(const key of ['staged','observed','added','deliveries','navigationCount'])assert.equal(baseline[key],0);
for(const entry of ['dashboard','role']){
 const positive=browser.scenarios.find(s=>!s.baseline&&s.entry===entry&&s.scenario==='complete');
 assert.equal(positive.actual,'complete');assert.deepEqual(positive.batches.map(b=>b.rows),[300,3]);
 const absent=browser.scenarios.find(s=>!s.baseline&&s.entry===entry&&s.scenario==='no-school-field');
 assert.equal(absent.actual,'SCHOOL_CONTEXT_UNCONFIRMED');assert.equal(absent.deliveries,0);
}
for(const name of ['late-school-conflict','late-empty-school-column']){
 const scenario=browser.scenarios.find(s=>!s.baseline&&s.scenario===name);
 assert.equal(scenario.staged,300);assert.equal(scenario.deliveries,0);
}
for(const scenario of browser.scenarios.filter(s=>s.actual!=='complete'&&s.scenario!=='receipt-mismatch'))assert.equal(scenario.deliveries,0,scenario.scenario);
for(const scenario of receiver.checks){
 if(scenario.phase==='complete'){assert.equal(scenario.added,303);assert.deepEqual(scenario.receipts.map(r=>r.total),[300,3]);}
 else assert.deepEqual(scenario.receipts,[]);
}
for(const result of [browser,receiver,proof]){assert.equal(result.resources.serverClosed,true);assert.equal(result.resources.isolatedBrowserFinally,true);}
const checks=[
 {name:'n36_actual_0531_full_runtime_semantic_dashboard_unbound_school_reproduction',status:'PASS',evidence:'browser.json: immutable .31 ZIP/runtime accepts Start with semantic dashboard 2/3/2, SchoolId present and no badge; source-pre-read UNCONFIRMED_TEACHER_ROLE, no proof/rows/receipts/navigation. Badge-without-SchoolId and both-absent also reproduced independently.'},
 {name:'n36_0532_source_school_binding_and_zero_transfer_negatives',status:'PASS',evidence:'70 actual popup/source HTTP scenarios, 27 reader/diagnostic cases, 25 actual app/store receiver journeys. Explicit field/table/DL/menu/report-column binding; selected-card cross-check; absent/conflicting school, role, link/response, pending GET owner/session/batch/document and 300-staged-row refusals.'},
 {name:'n36_0532_supported_setup_300_plus_3_receipts_package_link_diagnostics',status:'PASS',evidence:'receiver.json/package.json: actual UI + IndexedDB saved receipts 300+3, supported setup/timetable, complete/partial coverage review, unchanged grades/year and owner-bound Outbox. Actual app download hashes to immutable .32 ZIP; all 29 runtime source/ZIP files match; permissions/CSP/date/receiver assets unchanged. Fixed enum and boolean diagnostic privacy checked.'},
 {name:'n36_0532_production_and_stable_29_file_parity',status:'NOT_RUN',evidence:'Independent controller/sole publisher owns integration, Production proof and the existing stable updater after verified publication. No push, deploy, stable-directory mutation or real portal/account access by this worker.'}
];
const resolvedVerificationIssues=[{check:'final package/source aggregation',originalFailure:'README.md source hash 64d86777e832c3e3e69c65ca4357a6ae177bbd0d5c129e37046646dc8d77639b differed from packaged 3c4115d8b4b7ff6a3813768eb5000bb812bec234d8d3fc43913faa835f5dfb28',resolution:'Removed only this worker\'s post-package documentation addition and restored its exact baseline bytes. No executable/runtime or archive changes; existing final HTTP evidence and fingerprint remain valid.'}];
const result={taskId:browser.taskId,runId:browser.runId,baseSha:browser.baseSha,runtimeFingerprint,archive:manifest.archive,resolvedVerificationIssues,checks};
await fs.writeFile(folder+'checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
