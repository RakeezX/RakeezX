/** AI: affected final package identity and unchanged evidence reuse only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const saved='a4af0e926b5120dabc762ec94881247d130c09bd',dir='drafts/n88-student-portal/activation/';
const json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const m=await json(dir+'manifest.json'),prior=JSON.parse(execFileSync('git',['show',saved+':'+dir+'manifest.json'],{encoding:'utf8'}));
for(const [p,h]of Object.entries(m.sources))assert.equal(sha(lf(await readFile(p,'utf8'))),h,p);
for(const [p,h]of Object.entries(m.binarySources))assert.equal(sha(await readFile(p)),h,p);
for(const [p,h]of Object.entries(m.outputs))assert.equal(sha(await readFile(dir+'bundle/'+p)),h,p);
assert.deepEqual(m.graphs,prior.graphs);assert.deepEqual(m.gates,prior.gates);assert.equal(m.enabled,false);
assert.deepEqual(Object.keys(m.sources).filter(p=>m.sources[p]!==prior.sources[p]),['drafts/n88-student-portal/existing-host.mjs']);
assert.deepEqual(Object.keys(m.outputs).filter(p=>m.outputs[p]!==prior.outputs[p]),['edge/index.mjs']);
const card=await json('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json');assert.equal(card.attempt.runId,'4c5a66bc-5348-4e74-86a2-2ce6b2b5eec9');
for(const p of card.preparationAuthority.migrationIdentities)assert.equal(sha(await readFile(p.path)),p.sha256,p.path);
const reused=[];
for(const p of ['tests/n88-official-activation-custody-probe.json','tests/n88-official-activation-custody-initial-failure.json','tests/n88-official-activation-private-assets.json','tests/n88-official-activation-catalog.json',dir+'logpush-corrected-readback.json']){
 const content=lf(await readFile(p,'utf8'));assert.equal(content,lf(execFileSync('git',['show',saved+':'+p],{encoding:'utf8'})),p);reused.push({path:p,sha256:sha(content)});
}
const proof=await json('tests/n88-official-activation-db-privacy.json');assert.equal(proof.checks.length,2);assert.ok(proof.checks.every(c=>c.status==='PASS'));
execFileSync('git',['diff','--check'],{stdio:'pipe'});
await writeFile('tests/n88-official-activation-privacy-scope.json',JSON.stringify({aiAuthored:true,taskId:card.id,runId:card.attempt.runId,preservedCandidate:saved,at:new Date().toISOString(),checks:[{name:'affected_package_and_saved_proofs',status:'PASS',evidence:'All source/output/binary hashes match; only existing-host and Edge bundle changed. Client/Cloudflare/teacher/startup/SW graphs unchanged, all gates OFF, six immutable SQL pins match. Existing UI/custody/catalog/Logpush evidence preserved without rerun.'}],reused,serviceReadiness:false},null,2)+'\n');
console.log('N88 changed Edge graph and unchanged evidence scope PASS');
