/** AI: exact affected-source/evidence qualification, without a provider operation. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='tests/n88-student-pending-return-finite-diagnostic-20261021/',sha=b=>createHash('sha256').update(b).digest('hex');
const report={status:'PASS',taskId:'continuous-n88-student-pending-return-finite-diagnostic-20261021',runId:'42e76d1c-cba3-404f-b7a3-0fad1b6e919d',baseSha:'baa8fe5eb4577362d81ab9643aef219331fa2f06',changedSourceHashes:{},evidence:{},unchanged:{}};
for(const file of ['src/views/student-portal-login.js','src/lib/student-portal-unified-client.js','src/styles/student-portal-login.css','drafts/n88-student-portal/activation/bundle/private/assets/student.mjs','drafts/n88-student-portal/activation/bundle/private/styles/student-portal-login.css']){
 report.changedSourceHashes[file]=sha((await readFile(file,'utf8')).replaceAll('\r\n','\n'));
}
for(const file of ['ui.json','transport.json','bundle-preparation.json']){
 const bytes=await readFile(dir+file);assert.equal(JSON.parse(bytes).status,'PASS');report.evidence[file]=sha(bytes);
}
assert.equal(JSON.parse(await readFile(dir+'test-first-failure.json')).status,'FAIL');
assert.match(JSON.parse(await readFile(dir+'test-first-failure.json')).failure,/Unconfirmed GET must not paint code form/);
report.evidence['test-first-failure.json']=sha(await readFile(dir+'test-first-failure.json'));
for(const file of ['src/views/student-portal-login.js','src/lib/student-portal-unified-client.js'])execFileSync(process.execPath,['--check',file],{windowsHide:true});
execFileSync(process.execPath,[dir+'package.mjs','--check'],{windowsHide:true});
for(const file of ['drafts/n88-student-portal/numeric-credentials.mjs','drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/activation/bundle/edge/index.mjs','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','drafts/n88-student-portal/activation/manifest.json','src/lib/student-portal-class-client.js','tests/n88-student-reopen-end-guidance-20261021/carrier.mjs','drafts/n88-student-portal/activation/static-student-reopen-20261021-gate.mjs']){
 const current=(await readFile(file,'utf8')).replaceAll('\r\n','\n'),base=execFileSync('git',['show',report.baseSha+':'+file],{encoding:'utf8',maxBuffer:2097152}).replaceAll('\r\n','\n');
 assert.equal(current,base);report.unchanged[file]=sha(current);
}
for(const width of [390,1280])for(const state of ['pending','retry','end-ack','end-uncertain','diagnostic']){
 const file=state+'-'+width+'.png';report.evidence[file]=sha(await readFile(dir+file));
}
report.prepared=JSON.parse(await readFile(dir+'bundle-preparation.json'));
report.privateStaticGate='NOT_RUN: explicit final user instruction says do not push or deploy; fresh original-custodian task/run/candidate-bound gate, native/carrier/pin preflight, single upload, provider and served JS/CSS parity remain required before LOCAL_READY. No attempt reserved or historical marker changed.';
report.limits='Synthetic actual app DOM/handlers/client/CSS, no real account/student request; no provider operation, service change, native/public pin change, deployment or Product acceptance.';
await writeFile(dir+'qualification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,sourceFiles:Object.keys(report.changedSourceHashes).length,privateStaticGate:'NOT_RUN'}));
