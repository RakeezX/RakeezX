// AI: bounded package/source qualification; no network, browser or protected state access.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='4e70f0a3550910db58cfac0436c8d06303177de9',dir='drafts/n88-student-portal/activation/',test='tests/n88-initial-continuity-1522-20261020/';
const sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const old=p=>execFileSync('git',['show',base+':'+p],{maxBuffer:8*1024*1024});
const manifest=JSON.parse(await readFile(dir+'manifest.json','utf8')),prior=JSON.parse(old(dir+'manifest.json'));
const changedOutputs=[];
for(const [name,pin] of Object.entries(manifest.outputs)){
  assert.equal(sha(await readFile(dir+'bundle/'+name)),pin,name);
  if(pin!==prior.outputs[name])changedOutputs.push(name);
}
assert.deepEqual(changedOutputs.sort(),['cloudflare/worker.mjs','private/assets/student.mjs']);
const decode=text=>JSON.parse(text.slice(text.indexOf('Object.freeze(')+14,text.lastIndexOf(');')));
const before=decode(old(dir+'private-document.mjs').toString()),after=decode(await readFile(dir+'private-document.mjs','utf8'));
assert.deepEqual(Object.keys(before),Object.keys(after));
for(const key of Object.keys(before))if(key!=='/n88-private/assets/student.mjs')assert.deepEqual(after[key],before[key],key);
const strip=text=>text.replace(/var privateAssets = Object\.freeze\([\s\S]*?\);/, 'var privateAssets = STATIC_ASSETS;');
const priorWorker=old(dir+'bundle/cloudflare/worker.mjs').toString(),worker=await readFile(dir+'bundle/cloudflare/worker.mjs','utf8');
assert.notEqual(strip(worker),worker,'carrier asset block found');
assert.equal(strip(worker),strip(priorWorker),'non-asset ingress transport unchanged');
const sources={};
for(const file of ['src/views/student-portal-login.js','src/lib/student-portal-unified-client.js','src/lib/student-portal-runtime.js'])sources[file]=sha(lf(await readFile(file,'utf8')));
for(const file of ['drafts/n88-student-portal/official-activation.mjs','drafts/n88-student-portal/activation/correction-1430-gate.mjs','src/lib/student-portal-class-client.js','src/lib/student-portal-task-guidance-client.js'])assert.equal(lf(await readFile(file,'utf8')),lf(old(file).toString()),file+' unchanged');
const ui=JSON.parse(await readFile(test+'ui.json','utf8')),student=JSON.parse(await readFile(test+'student.json','utf8'));
assert.equal(ui.status,'PASS');assert.equal(ui.teacher.find(x=>x.variant==='current').errorCount,1);
assert.equal(ui.actualTeacherCause,'NOT_PROVEN');assert.equal(student.status,'PASS');assert.equal(student.student.length,7);
assert(student.student.every(x=>x.pass&&!x.hiddenDataRendered&&!x.focusReissue));
const result={status:'PASS',scope:'Local source/package parity only; no hosted readiness or delivery claim',sources,changedOutputs,edgeUnchanged:manifest.outputs['edge/index.mjs'],priorCarrier:prior.outputs['cloudflare/worker.mjs'],carrier:manifest.outputs['cloudflare/worker.mjs'],student:manifest.outputs['private/assets/student.mjs'],otherPrivateAssetsAndTransport:'BYTE_IDENTICAL',actualTeacherCause:'NOT_PROVEN',delivery:'NOT_RUN',protectedCustodianAndConsumedGate:'UNCHANGED'};
await writeFile(test+'qualification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
