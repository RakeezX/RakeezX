/** AI: verify only the corrected card pins and unchanged saved candidate evidence. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const taskId='continuous-n88-official-student-portal-activation-20261018',runId='8698a850-ff9c-488d-8516-328eed2c356d';
const preservedCandidate='76a58af8bb139a146abc11b556009b4b17f1dd2e',baseSha='5046e82968cb0055db7a99aea41d65dcb71b2a60';
const sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','utf8'));
assert.equal(card.attempt.runId,runId);
const migrations=[];
for(const {path,sha256}of card.preparationAuthority.migrationIdentities){
 const bytes=await readFile(path);assert.equal(sha(bytes),sha256,path);
 assert.equal(lf(bytes.toString('utf8')),lf(execFileSync('git',['show',baseSha+':'+path],{encoding:'utf8'})),path);
 migrations.push({path,sha256});
}
const reused=[];
for(const p of ['drafts/n88-student-portal/activation/manifest.json','drafts/n88-student-portal/activation/deploy.staged.json','tests/n88-official-activation-private-assets.json','tests/n88-official-activation-scope.json']){
 const current=lf(await readFile(p,'utf8')),saved=lf(execFileSync('git',['show',preservedCandidate+':'+p],{encoding:'utf8'}));assert.equal(current,saved,p);reused.push({path:p,sha256:sha(current)});
}
const custody=JSON.parse(await readFile('tests/n88-official-activation-custody-probe.json','utf8'));
assert.equal(custody.failure,undefined);assert.equal(custody.runId,runId);assert.equal(custody.checks[0].status,'PASS');assert.equal(custody.providerWrites,0);
assert.equal(custody.cleanup.ownedEncryptedRecipientRemoved,true);assert.equal(custody.cleanup.ownedDirectoryRemoved,true);
await assert.rejects(access('tests/fixtures/n88-official-activation/owned-'+runId+'.tmp'));
execFileSync('git',['diff','--check'],{stdio:'pipe'});
await writeFile('tests/n88-official-activation-native-scope.json',JSON.stringify({aiAuthored:true,taskId,runId,baseSha,preservedCandidate,at:new Date().toISOString(),checks:[{name:'corrected_card_exact_six_pins',status:'PASS',evidence:'All six actual byte hashes match the corrected active card; SQL unchanged from base. Historical CRLF assertion failure retained in prior scope report.'},{name:'saved_candidate_evidence_and_cleanup',status:'PASS',evidence:'Manifest/deploy package and prior four-case actual browser report unchanged from76a58; no browser rerun. Protected throwaway handoff passes; owned encrypted recipient removed; no hosted writes.'}],migrations,reused,productionProof:false},null,2)+'\n');
console.log('N88 corrected pins, saved proof reuse and owned custody cleanup PASS');
