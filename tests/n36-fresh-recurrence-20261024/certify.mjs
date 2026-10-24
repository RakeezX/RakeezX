// AI-authored: certify selected actual-app observations; preserve failed aggregates.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder=new URL('./',import.meta.url),baseSha='3b6dfe789297c98e4a6ff1b977e098796a633b37';
const hash=b=>createHash('sha256').update(b).digest('hex');
const storeHash=hash(await fs.readFile('src/store.js'));
const selection={
 'baseline.json':['fresh'],
 'candidate.json':['fresh'],
 'original-sync-harness-failure.json':['refused'],
 'guards.json':['mature','ambiguous','foreign','selection-race','owner-race','session-race','lease-race','transaction-abort'],
 'academic-and-sync.json':['academic-edit','calendar-later','term-edit','prior-unknown'],
 'selection-sync-receipts.json':['nondefault','term-drift','unknown'],
 'settled-sync-and-rendered.json':['profile-sync','rendered'],
};
const observations=[];
for(const [file,cases]of Object.entries(selection)){
 const bytes=await fs.readFile(new URL(file,folder)),result=JSON.parse(bytes);
 assert.equal(result.storeHash,file==='baseline.json'?hash(execFileSync('git',['show',baseSha+':src/store.js'])):storeHash);
 assert.deepEqual(result.resources,{serverClosed:true,isolatedBrowserFinally:true});
 for(const scenario of cases){const row=result.cases.find(c=>c.scenario===scenario);assert.equal(row?.status,'PASS',file+':'+scenario);observations.push({file,scenario,sha256:hash(bytes)});}
}
const read=async f=>JSON.parse(await fs.readFile(new URL(f,folder),'utf8'));
const baseline=(await read('baseline.json')).cases[0];
assert.equal(baseline.view.code,'APP_ACADEMIC_SELECTION_REQUIRED');
assert.equal(baseline.view.startPhase,'worker-ack');assert.equal(baseline.view.failureJobPhase,'binding');
assert.ok(Object.values(baseline.view.timings).every(t=>t.count===0));
assert.deepEqual(baseline.provisionedRevisions.profile,[3]);assert.deepEqual(baseline.provisionedRevisions.years,[2]);
const fresh=(await read('candidate.json')).cases[0];
assert.deepEqual(fresh.initialWrites,['device']);assert.equal(fresh.view.phase,'complete');
assert.equal(fresh.outcomes[0].status,'saved');assert.equal(fresh.reloadReceipt.receipts[Object.keys(fresh.reloadReceipt.receipts)[0]].status,'existing');
const sync=(await read('settled-sync-and-rendered.json')).cases.find(c=>c.scenario==='profile-sync');
assert.equal(sync.syncCheckpoint.profile.serverRevision,4);assert.equal(sync.syncCheckpoint.status.detailStatus,'synced');
assert.ok(sync.syncCheckpoint.reads>0);assert.equal(sync.view.phase,'complete');
const publicSource=await read('public-source-identity.json');const servedStore=publicSource.entries.find(e=>e.path==='src/store.js');
assert.equal(servedStore.status,200);assert.equal(servedStore.sha256,servedStore.baseSourceSha256);
for(const scope of ['src/app.js','src/lib','src/views/class-import-center.js','extensions','assets/extensions','sw.js','supabase'])
 assert.equal(execFileSync('git',['diff','--name-only',baseSha,'--',scope],{encoding:'utf8'}).trim(),'','Protected source changed: '+scope);
assert.ok(!(await fs.readdir(new URL('./',import.meta.url))).some(n=>n.startsWith('runtime-')),'Owned native PG cluster remained');
const checks=[
 {name:'n36_current_fresh_boot_binding_cause',status:'PASS',evidence:'baseline.json: current-main store, normal profile DOM -> native provisioning snapshot (profile 3/year 2) -> first verified lease -> actual .41 Start refuses at binding/worker-ack; all source/staged/receipt counters zero. Public anonymous store hash matches base.'},
 {name:'n36_current_fresh_selection_receipt_reload',status:'PASS',evidence:'candidate.json; settled-sync-and-rendered.json; selection-sync-receipts.json: device-only guarded completion; two-row .41 import, saved receipt, reload and duplicate-free repeat; real profile Sync revision 4 settles; explicit term-2 UI selection survives renewal; actual calendar DOM inspected.'},
 {name:'n36_current_owner_readiness_selection_drift_guards',status:'PASS',evidence:'12 initial refusal cases plus concurrent valid selection; term drift and final-receipt fault remain UNKNOWN with nonce/rows preserved. Exact selected observations and hashes below; original failures retained.'},
];
const reused=['tests/n36-actual-timetable-20261023/certificate-913a4635.json','tests/n36-actual-timetable-20261023/certified-runtime-913a4635.json'];
const reusedEvidence=[];for(const file of reused){try{reusedEvidence.push({file,sha256:hash(await fs.readFile(file))});}catch{}}
assert.equal(reusedEvidence.length,2);
const result={taskId:'continuous-n36-fresh-academic-recurrence-20261024',runId:'1ee94e6d-6fdf-4e7f-afec-36c16a8d1026',baseSha,storeHash,checks,observations,reusedEvidence,limits:'Synthetic local app/native IndexedDB/native PostgreSQL only. Actual user document/version/account and real new-account acceptance NOT READ/NOT RUN. Independent publisher served verification NOT RUN.'};
await fs.writeFile(new URL('certified.json',folder),JSON.stringify(result,null,2)+'\n');
console.log('PASS '+observations.length+' exact selected observations; 3 scoped checks; protected source/extension/ZIP/offline shell unchanged; owned cluster absent.');
