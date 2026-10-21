// AI: aggregate actual HTTP/receiver evidence, retaining immutable failures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='tests/n36-0636-missing-myinfo-setup-order-20261021/';
const runId=process.argv.find(arg=>arg.startsWith('--run-id='))?.slice('--run-id='.length);
if(runId)assert.match(runId,/^[a-f0-9-]{36}$/);
const read=async name=>JSON.parse(await fs.readFile(folder+name+'.json','utf8'));
const [immutable,candidate,download,pkg]=await Promise.all(['immutable','candidate','download','package'].map(read));
assert.equal(immutable.status,'FAIL');assert.equal(immutable.cases.length,8);
assert.equal(immutable.archiveIdentity.sha256,'600532ddac600a66f9b0bc8b6be50b4ea4a4f72352f71c95376296a7719f35b6');
for(const c of immutable.cases){
 if(c.mode.includes('empty-info')){assert.equal(c.view.code,'SCHOOL_CONTEXT_CHANGED');assert.equal(c.deliveries,0);assert.equal(c.status,'FAIL');}
 else {assert.equal(c.status,'PASS');assert.deepEqual(c.receipts.map(r=>r.total),[300,3]);}
}
assert.equal(candidate.status,'PASS');assert.equal(candidate.cases.length,17);
assert.equal(download.status,'PASS');assert.equal(pkg.status,'PASS');assert.equal(pkg.runtimeFiles,29);
const positives=candidate.cases.filter(c=>c.view.phase==='complete'),negatives=candidate.cases.filter(c=>c.view.phase==='stopped');
assert.equal(positives.length,8);assert.equal(negatives.length,9);
for(const c of candidate.cases){
 assert.equal(c.status,'PASS');assert.deepEqual(c.unexpected,[]);
 assert.equal(c.view.entryKind,'teacher-dashboard');assert.equal(c.view.roleProofKind,'semantic-dashboard');
 assert.equal(c.view.proofNavMarkers,2);assert.equal(c.view.proofActionMarkers,3);assert.equal(c.view.proofReadLinks,2);
 assert.equal(c.navigation.length,c.mode.startsWith('card-')?1:0);
 if(c.view.phase==='complete'){
  assert.equal(c.view.added,303);assert.equal(c.view.observed,303);assert.equal(c.view.coverage,'complete');
  assert.deepEqual(c.receipts.map(r=>r.total),[300,3]);assert.equal(c.boundDeliveries.length,2);
  assert.deepEqual(c.setupAssertions,[]);
  for(const path of Object.keys(c.setupReadCounts)){
   assert.equal(c.setupReadCounts[path],1);assert.equal(c.requests.filter(p=>p===path).length,1,'Actual server received setup GET exactly once');
   const f=c.fetchTrace.find(f=>f.path===path);assert.equal(f.schoolBinding,'bound');assert.equal(f.readProof,true);assert.equal(f.schoolName,'مدرسة اصطناعية');
   const firstReport=c.fetchTrace.findIndex(f=>f.kind==='students'&&f.path.startsWith('/SchoolManagmentReports/'));
   assert.ok(firstReport>=0&&c.fetchTrace.indexOf(f)>firstReport,'School report precedes setup GET');
  }
  const infoReads=c.fetchTrace.filter(f=>f.kind==='metadata');assert.equal(infoReads.length,c.mode.includes('empty-info')?1:0);
  for(const r of c.receipts)for(const field of ['teacher','principal','school','classes','timetable'])assert.ok(r.setup.details.some(d=>d.field===field&&['saved','current'].includes(d.reason)));
 }else {assert.equal(c.deliveries,0);assert.deepEqual(c.receipts,[]);}
}
for(const result of [immutable,candidate,download]){assert.equal(result.resources.serverClosed,true);assert.equal(result.resources.isolatedBrowserFinally,true);}
const manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.33.manifest.json','utf8'));
const fingerprint=createHash('sha256');for(const f of [...manifest.files].sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0)){fingerprint.update(f.file);fingerprint.update(await fs.readFile('extensions/rakeez-teacher-import-helper/'+f.file));}
assert.equal(candidate.runtimeFingerprint,fingerprint.digest('hex'));assert.equal(download.archiveSha256,manifest.archive.sha256);
const checks=[
 {name:'n36_0532_immutable_full_runtime_no_myinfo_opposite_dom_order_setup_receipts',status:'PASS',evidence:'Reproduction assertions passed: immutable.json retains status FAIL and four empty-school SCHOOL_CONTEXT_CHANGED failures with zero delivery; four no-MyInfo dashboard/card cases retain PASS and 300+3 saved receipts. This check validates the captured reproduction, not .32 acceptance; NO_CHANGE remains invalid.'},
 {name:'n36_0533_if_needed_safe_deferred_route_and_zero_transfer_negatives',status:'PASS',evidence:'candidate.json: 8 setup/order/card cases PASS; 9 missing/conflicting school and owner/document/session negatives stop with zero receiver delivery. Both 300+3 saved receipts retain teacher/principal/school/classes/timetable. Exact setup GETs occur once, after report binding; source URL/resource allowlist and ownership/grades/year preservation pass.'},
 {name:'n36_0533_if_needed_300_plus_3_package_link_and_29_file_parity',status:'PASS',evidence:'package.json/download.json: all 29 packaged files byte/hash-match source, permissions/CSP and historical packages unchanged; actual app download DOM/handler returns exact .33 ZIP with no navigation. Stable installed folder/Production are publisher-owned, NOT_RUN here.'},
 {name:'n36_if_changed_verified_package_stable_folder_parity',status:'NOT_RUN',evidence:'Independent controller/sole publisher owns integration, Production verification and stable 29-file installation. No push/deploy or real source/account access by worker.'}
];
await fs.writeFile(folder+'checks.json',JSON.stringify({taskId:candidate.taskId,runId:runId??candidate.runId,baseSha:candidate.baseSha,reusedEvidenceRunId:candidate.runId,reusedProductCandidateSha:'6bcd95d8806eddecb13935398508473e58e8565c',immutableAcceptanceStatus:immutable.status,archive:manifest.archive,runtimeFingerprint:candidate.runtimeFingerprint,checks},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',immutableFailurePreserved:true,positives:positives.length,zeroDeliveryNegatives:negatives.length,checks}));
