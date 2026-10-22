// AI: reconcile existing exact-scope evidence without repeating browser phases.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const folder='tests/n36-1255-visible-timetable-get-20261021/';
const read=async n=>JSON.parse((await fs.readFile(folder+n+'.json','utf8')).replace(/^\uFEFF/,''));
execFileSync(process.execPath,[folder+'package.mjs'],{stdio:'pipe'});
const pkg=await read('package'),download=await read('download'),cleanup=await read('resource-cleanup');
assert.equal(pkg.status,'PASS');assert.equal(pkg.candidateCases,48);assert.equal(download.status,'PASS');assert.equal(download.archiveSha256,pkg.archive.sha256);assert.equal(download.actualDownloadHashMatched,true);assert.equal(download.resources.serverClosed,true);assert.equal(download.resources.isolatedBrowserFinally,true);assert.equal(cleanup.ownedServerListeners,0);
const checks=[
 {name:'n36_0536_visible_timetable_onclick_baseline_reproduced',status:'PASS',evidence:folder+'baseline-0536.json: immutable public .36 SHA256 1a2a4d1f70e27a30f262b176c65c22e8d412e5ff8d6cede1ee7d073ced21b46f; both link orders schedule then reject inert onclick before GET; durable 300+3 receipts and unavailable timetable. Actual PO subtype remains unproven.'},
 {name:'n36_0537_route_bound_get_and_full_receipts',status:'PASS',evidence:folder+'evidence-selection.json / package.json: 48 exact full-runtime PASS cases. Both link orders preserve stored setup and durable 300+3 saved/current receipts; zero handler reads/execution/navigation; reimport existing and coverage controls. Large fixture 64094 ms with bounded pending read-proof poll.'},
 {name:'n36_0537_unsafe_link_context_and_unknown_receipt_denials',status:'PASS',evidence:folder+'evidence-selection.json: unsafe anchors, ten reader contract denials, identity and pending document/owner/session/batch drift, response school/teacher/SchoolId/redirect/type/size/timeout/base/login/role and unsafe student links. Zero unsafe GET/new transfer on denials; late stops may follow one known source-bound GET. Unknown outcome/nonce stays unknown without second transfer. Original failed harness artifacts retained; corrected documentIds adapter in document-bound-fixture.mjs.'},
 {name:'n36_0537_package_and_safe_diagnostic_parity',status:'PASS',evidence:folder+'package.json / diagnostics.json / download.json / resource-cleanup.json: exact local ZIP/source/manifest 29-file parity; SHA256 '+pkg.archive.sha256+'; 27 safe enum combinations; actual app download hash matched; protected app/receiver/timing/permissions/old archives unchanged; owned resources closed. Production and installed stable parity NOT_RUN: independent publisher.'}
];
await fs.writeFile(folder+'checks.json',JSON.stringify({taskId:'continuous-n36-1255-visible-timetable-get-20261021',runId:'755845ba-7bea-4f4d-88bf-c690996e4842',baseSha:pkg.baseSha,status:'PASS',checks,archive:pkg.archive,actual0535Batch:'Unknown; untouched, no replay',production:'NOT_RUN',installedStableParity:'NOT_RUN',actualPortalAcceptance:'PENDING'},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.map(c=>c.name),candidateCases:48,archive:pkg.archive}));
