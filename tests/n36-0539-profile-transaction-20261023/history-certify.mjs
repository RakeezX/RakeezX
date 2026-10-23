// AI: certify only the local-history delta; reuse the immutable 19-case certificate.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder='tests/n36-0539-profile-transaction-20261023/';
const parentSha='cb62390f15ec9ea6fda3c79254d9803bd428713d';
const json=async name=>JSON.parse((await fs.readFile(folder+name+'.json','utf8')).replace(/^\uFEFF/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
const prior=await json('certified');
assert.equal(prior.status,'PASS');assert.equal(prior.cases,19);
assert.equal(hash(await fs.readFile('src/store.js')),prior.source.find(f=>f.file==='src/store.js').sha256);
const baseline=await json('history-baseline');
assert.equal(baseline.cases[0].status,'OBSERVED');
assert.ok(baseline.cases[0].preparationWithoutPreservation.startsWith('APP_BATCH_UNRESOLVED'));
const final=await json('history-final'),guards=await json('history-guards');
assert.equal(final.runId,'57bd17af-553d-49da-a031-dd2cfab52854');
const selected=[...final.cases.map(c=>({file:'history-final.json',...c})),...guards.cases.filter(c=>['session','term','rollback','full','bytes'].includes(c.mode)).map(c=>({file:'history-guards.json',...c}))];
assert.equal(selected.length,8);
for(const row of selected)assert.equal(row.status,'PASS',row.mode);
for(const evidence of [baseline,final,guards]){assert.equal(evidence.resources.serverClosed,true);assert.equal(evidence.resources.isolatedBrowserFinally,true);}
assert.equal(selected.find(c=>c.mode==='direct').withoutRepeatedRead,true);
const fresh=selected.find(c=>c.mode==='fresh');assert.equal(fresh.localOnlyAtomicPreservation,true);assert.equal(fresh.readonlyAndReopen,true);
assert.equal(fresh.firstFresh.confirmedRows,302);assert.equal(fresh.firstFresh.confirmedReceipts,10);
assert.equal(fresh.secondFresh.added,0);assert.equal(fresh.secondFresh.existing,302);
assert.equal(fresh.firstFresh.coverage,'partial');assert.equal(fresh.firstFresh.setupRejectReason,'response-school-absent');
const protectedPaths=['src/store.js','src/lib/teacher-setup-import.js','src/lib/n36-extension-protocol.js','src/lib/db.js','src/lib/sync-v2.js','extensions/rakeez-teacher-import-helper','assets/extensions','sw.js'];
execFileSync('git',['diff','--exit-code',parentSha,'--',...protectedPaths]);
assert.equal(hash(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.39.zip')),prior.extension.archive.sha256);
const files=['src/views/class-import-center.js',folder+'history.mjs',folder+'history-certify.mjs'];
for(const file of files)execFileSync(process.execPath,['--check',file]);
execFileSync('git',['diff','--check']);
const certificate={status:'PASS',taskId:final.taskId,runId:final.runId,baseSha:prior.baseSha,parentSha,
 reused:{file:'certified.json',sha256:hash(await fs.readFile(folder+'certified.json')),cases:19,scope:'Unchanged store transaction and strict original-request recovery evidence; new history path separately exercised'},
 baseline:'Existing supported Start denied APP_BATCH_UNRESOLVED without discarding trace; new explicit preservation qualifies a separate fresh run',
 selected:selected.map(({file,mode,status})=>({file,mode,status})),
 source:await Promise.all(files.map(async file=>({file,sha256:hash(await fs.readFile(file))}))),
 history:{storage:'device only; no outbox writes',maxEntries:4,maxUtf8Bytes:2000000,unresolvedTrace:'exact JSON retained; never replayed or relabelled saved',fresh:'302/10; repeat added0/existing302; prior56/2+pending29 retained across reload'},
 package:{version:'0.5.39',unchanged:true,sha256:prior.extension.archive.sha256},
 actualAccountRecovery:{status:'NOT_RUN',reason:'No live account/source authority or proof of current original unexpired nonce; actual pending29 is not claimed repaired'},
 production:'NOT_RUN; independent publisher',poAcceptance:'NOT_RUN; N36 OPEN'};
await fs.writeFile(folder+'history-certified.json',JSON.stringify(certificate,null,2)+'\n');
console.log(JSON.stringify(certificate));
