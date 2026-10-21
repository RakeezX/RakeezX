// AI: exact-scope evidence integrity and packaging bridge; no browser replay.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const folder='tests/n36-0746-bounded-source-guard-cost-20261021/';
const read=async name=>JSON.parse(await fs.readFile(folder+name+'.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const certified=await read('certified-runtime');
const positiveNames=['candidate-no-info-before','candidate-no-info-after','candidate-empty-info-before','candidate-empty-info-after','candidate-small-slow-get'];
const negativeNames=['title','role','admin','teacher','school','schoolid','document','owner','session'].flatMap(k=>['during','late'].map(w=>'pending-'+k+'-'+w)).concat(['timeout','abort']);
const results=await Promise.all([...positiveNames,...negativeNames].map(read));
for(const r of results){
 assert.equal(r.status,'PASS');assert.equal(r.runtimeFingerprint,certified.runtimeFingerprint);
 assert.equal(r.model.styleCostMs,0);assert.equal(r.model.scriptDelayMs,100);assert.equal(r.model.inlineCounters,true);
 assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);
 const c=r.cases[0];assert.equal(c.status,'PASS');assert.equal(c.navigation,0);
 if(positiveNames.some(n=>n==='candidate-'+c.mode)||r.model.tiles===0){
  assert.equal(c.view.phase,'complete');assert.equal(c.view.added,303);assert.equal(c.view.staged,303);assert.equal(c.view.observed,303);
  assert.equal(c.deliveries,2);assert.ok(c.metrics.wallMs<90000);assert.deepEqual(c.setupAssertions,[]);assert.deepEqual(c.setupReadCounts,[1,1]);
  assert.deepEqual(c.receipts.map(r=>r.total),[300,3]);
  for(const receipt of c.receipts){assert.equal(receipt.status,'saved');for(const field of ['teacher','principal','school','classes','timetable'])assert.ok(receipt.fields.some(d=>d.field===field&&['saved','current'].includes(d.reason)));}
  const setup=c.fetches.filter(f=>['classes','timetable'].includes(f.kind));assert.equal(setup.length,2);assert.ok(setup.every(f=>f.schoolBinding==='bound'&&f.readProof));
  assert.equal(c.fetches.filter(f=>f.kind==='metadata').length,c.mode.includes('empty-info')?1:0);
  assert.deepEqual(c.fetches.filter(f=>f.kind==='students').map(f=>f.rowOffset),[0,0,300]);
 }else{
  assert.equal(c.view.phase,'stopped');assert.equal(c.deliveries,0);assert.deepEqual(c.receipts,[]);assert.equal(c.drifted,true);assert.ok(c.metrics.wallMs<25000);
  if(c.mode.endsWith('-late')){assert.equal(c.lateMutation,true);assert.equal(c.metrics.pendingReadProofs,1,'Mutation follows the sole completed periodic check; post-GET guards must catch it');}
 }
 if(c.view.timings){assert.deepEqual(Object.keys(c.view.timings),['home','sourceGuard','descriptor','appGuard','fetchPending']);for(const v of Object.values(c.view.timings)){assert.ok(Number.isInteger(v.count)&&v.count>=0&&v.count<=10000);assert.ok(Number.isInteger(v.ms)&&v.ms>=0&&v.ms<=3600000);}}
}
const slow=results[4].cases[0];assert.ok(slow.networkPending[0].wallMs>=6000);assert.ok(slow.metrics.pendingReadProofs>=1&&slow.metrics.pendingReadProofs<=5);
const timeout=(await read('timeout')).cases[0],abort=(await read('abort')).cases[0];
for(const c of [timeout,abort])assert.equal(c.view.code,'FETCH_CANCELLED_OR_TIMEOUT');
assert.ok(timeout.networkPending[0].wallMs>=7900&&timeout.networkPending[0].wallMs<10000);assert.ok(abort.networkPending[0].wallMs<1000);
const small=await read('baseline-small'),large=await read('baseline-large');
for(const r of [small,large]){assert.equal(r.archiveIdentity.sha256,'48bf7ce0af84bac3739b39ad143c91456eada39a00b5fbe801f1b3d5fbc5b5d0');assert.equal(r.model.inlineCounters,true);assert.equal(r.model.styleCostMs,0);assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);}
assert.equal(small.cases[0].status,'PASS');assert.equal(large.cases[0].status,'OBSERVED_STOP');assert.equal(large.cases[0].view.code,'REVIEW_EXPIRED');assert.equal(large.cases[0].view.failureStep,'source-pre-read');assert.equal(large.cases[0].deliveries,0);
const currentLarge=results.slice(0,4).map(r=>r.cases[0]);assert.ok(currentLarge.every(c=>c.metrics.styleCalls<large.cases[0].metrics.styleCalls/20));
const priorDir='tests/n36-0715-pre-row-expiry-20261021/';
const prior=[['86a5168bc5a8932b8ff25b51f31049ebaccd5480','larger-real-clock'],['eb28dc334867a0b098c575d4b96c1c940754d761','native-storage-reproduction'],['eb28dc334867a0b098c575d4b96c1c940754d761','native-storage-control']].map(([commit,name])=>{
 const bytes=execFileSync('git',['show',commit+':'+priorDir+name+'.json']),r=JSON.parse(bytes),c=r.cases[0];
 return {commit,file:priorDir+name+'.json',sha256:hash(bytes),status:c.status,view:c.view,styleCalls:c.metrics.styleCalls,wallMs:c.metrics.wallMs,pendingReadProofs:c.metrics.pendingReadProofs,storageHarness:name==='larger-real-clock'?'Source DOM evaluation inside storage.get; diagnostic only':r.harnessCorrection};
});
assert.equal(prior[0].view.failureStep,'source-pre-read');assert.equal(prior[1].view.staged,300);assert.equal(prior[1].status,'FAIL');
await fs.writeFile(folder+'prior-boundary.json',JSON.stringify({actualPO:{source:'Activated PO card, not independently replayed',version:'0.5.33',rows:0,failureStep:'source-post-read'},exactPortalCause:'UNRESOLVED',prior},null,2)+'\n');
// Runtime evidence predates packaging metadata only. All 27 executable/style/HTML
// bytes must remain identical, and package.mjs separately validates metadata.
for(const f of certified.files)if(!['manifest.json','README.md'].includes(f.file))assert.equal(hash(await fs.readFile('extensions/rakeez-teacher-import-helper/'+f.file)),f.sha256,f.file);
const proof=await read('proof-cases');assert.equal(proof.status,'PASS');assert.equal(proof.cases.length,27);assert.equal(proof.diagnosticAllowlist,'PASS');
const pkg=await read('package'),download=await read('download');assert.equal(pkg.status,'PASS');assert.equal(pkg.runtimeFiles,29);assert.equal(download.status,'PASS');assert.equal(download.archiveSha256,pkg.archive.sha256);assert.equal(download.actualDownloadHashMatched,true);assert.equal(download.resources.serverClosed,true);assert.equal(download.resources.isolatedBrowserFinally,true);
execFileSync('git',['diff','--check']);
const checks=[
 {name:'n36_0533_immutable_heavy_guard_cost_and_actual_failure_bound',status:'PASS',evidence:'baseline-small/large.json: immutable public ZIP hash verified, native-like storage and unchanged 640-tile workload. Large .33 observation stops at source-pre-read after 92.929s / 24,509,952 style calls; PO source-post-read failure and prior storage-limited / 300-staged harness results remain distinct in prior-boundary.json. No exact portal-cause claim.'},
 {name:'n36_0534_bounded_guard_cost_and_pending_context_denials',status:'PASS',evidence:'Four large cases: 60.219–66.559s, 520,925–619,829 style calls; 18 during/after-last-periodic-check context drift cases plus timeout and abort stop with zero transfer. 6s GET has three periodic checks; native timeout is 8.003s. 27 source/diagnostic checks PASS. Actual ownership/store/score/year and owner-bound Outbox assertions execute in runtime.mjs.'},
 {name:'n36_0534_full_runtime_300_plus_3_setup_package_link_parity',status:'PASS',evidence:'Both link orders × absent/empty MyInfo: 303 actual-app saved rows, 300+3 saved receipts with teacher/principal/school/classes/timetable, exactly one classes/timetable GET and no duplicate setup. package.json proves 29 ZIP/source paths and hashes; download.json proves actual HTTP app DOM/handler download hash. Production and installed stable parity NOT_RUN; independent publisher owns them.'},
];
await fs.writeFile(folder+'checks.json',JSON.stringify({status:'PASS',checks,resources:'All recorded owned servers/contexts closed; no live/shared phase lease required',production:'NOT_RUN',stableInstalledParity:'NOT_RUN',actualPortalAcceptance:'PENDING'},null,2)+'\n');
console.log(JSON.stringify(checks));
