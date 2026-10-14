// AI: bind saved evidence/operator readback; no service/provider calls or reruns.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const runId='ef502f1b-29ef-496e-8611-21d74fda045e';
const saved='9603682900001d29ad8ccdb95d7ce26c5357a2f9',base='a256a1cce6f0368a1a4dbe3dc24ead677cfaf0d5';
const normalize=s=>s.replaceAll('\r\n','\n'),sha=s=>createHash('sha256').update(s).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const receipt=JSON.parse(await fs.readFile('tests/n58-fresh-account-candidate.json','utf8'));
assert.equal(receipt.completed,true);assert.equal(receipt.checks.length,3);
const savedHashes={};for(const [file,hash]of Object.entries(receipt.sourceHashes)){
 const code=execFileSync('git',['show',saved+':'+file],{encoding:'utf8',windowsHide:true});assert.equal(sha(normalize(code)),hash);savedHashes[file]=hash;
 if(file!=='src/store.js')assert.equal(sha(normalize(await fs.readFile(file,'utf8'))),hash);
}
const operatorFile='C:/Users/Abody/Projects/RakeezX/docs/automation-evidence/20261014/N58_CURRENT_SERVICE_AND_RELEASE_SCOPE_1925.md';
const operator=await fs.readFile(operatorFile,'utf8');
const identities=receipt.identities.protocolFunctions;
const service={};for(const [signature,digest]of [
 ['apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)','a6284ed21c86f1cafcac2d4d84a5fadc'],
 ['n58_guard_calendar_contract()','6fc9fcdf35f78d0ae295fe61a833f70d'],
 ['provision_account_workspace(jsonb)','a641c556c736f72b63d1e0cb203e1e1e']]){
 assert.ok(operator.includes(signature+': '+digest));assert.equal(identities.find(x=>x.signature==='rakeezx.'+signature)?.body_md5,digest);service[signature]=digest;
}
const current=normalize(await fs.readFile('src/store.js','utf8')),old=normalize(execFileSync('git',['show',saved+':src/store.js'],{encoding:'utf8',windowsHide:true}));
const sections={};for(const [name,start,end]of [
 ['foundation','async function ensureFoundation()','/** ينقل ترتيب'],
 ['selection','export async function applyCalendarPreset(','/* ---------- المنهج'],
 ['dependencies','function syncV2Dependencies(','function syncV2CommandEntry('],
 ['creationParentGuard','function newSessionCalendarContext(','/** Resolve a dated session'],
 ['recordedHistory','export function sessionStatusPresentation(','/** المصدر الواحد']]){
 const extract=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start))).trim();
 assert.ok(extract(old));assert.equal(extract(current),extract(old),name+' changed');sections[name]=sha(extract(current));
}
const originMain=git('rev-parse','origin/main');
const affected=['src/store.js','src/models.js','src/lib/calendar-runtime.js','src/lib/calendar-presets.js','src/lib/session-provenance.js','src/lib/cloud.js','src/lib/sync-v2.js','src/lib/initial-restore.js','src/lib/app-update.js','src/app.js','sw.js'];
assert.equal(git('diff','--name-only',base,originMain,'--',...affected),'');
assert.match(current,/CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = true/);
const upgrade=JSON.parse(await fs.readFile('tests/n58-fresh-account-upgrade.json','utf8'));assert.equal(upgrade.status,'PASS');assert.equal(upgrade.cases.length,3);assert.ok(upgrade.cases.every(x=>x.checkpointUnchanged));
assert.equal(upgrade.cases.find(x=>x.kind==='rejected-missing-term').retainedOutbox,65);
const finalHashes={};for(const file of affected.filter(f=>f==='src/store.js'||Object.hasOwn(savedHashes,f)))finalHashes[file]=sha(normalize(await fs.readFile(file,'utf8')));
const output={runId,baseSha:base,savedCandidateSha:saved,observedOriginMain:originMain,savedHashes,finalHashes,reusedSections:sections,
 operatorRecord:{path:operatorFile,normalizedSha256:sha(normalize(operator)),serviceBodyMd5:service,normalization:'Operator SELECT compared md5(prosrc after CRLF to LF); hosted raw CRLF body differences are not semantic drift. Metadata identity only, no hosted write certification.'},
 reuse:'Existing three first-use protocol cases, lost-ack/selectionRevision and unaffected owner/history/grade/sorting/offline/update evidence retained. New store read/strict-creation paths covered by upgrade DOM and three native guard tests. No nine-protocol/60-contract rerun.',
 upgradeReceiptSha256:sha(await fs.readFile('tests/n58-fresh-account-upgrade.json')),
 originalFailures:['Prior BLOCKED/local-only result and hosted FAIL/NOT_RUN preserved.','Original saved projection exceptions are recorded in upgrade cases.','Fixture preparation rejected ordinary outbox writes with a LIMITED lease; corrected preparation uses the existing empty-database atomic Initial Restore import, with owner assertion. No guard disabled.','Early native test used a nonexistent deleteRecord helper; changed to existing applyBatch only for owned fixture setup.'],
 release:'LOCAL_READY for limited first-use compatibility correction with hold=true; publisher owns integration/Production proof',
 outstanding:['Full hosted calendar/device acceptance and retired-pair limits','Existing rejected65 recovery','Prior five session report/six retired events','Removal of region-switch hold and N58 closure'],hostedCalls:0,serviceMutations:0,publication:'NONE'};
await fs.writeFile('tests/n58-fresh-account-release-binding.json',JSON.stringify(output,null,2)+'\n');
console.log('PASS saved source/unchanged first-use sections, current affected main, three existing service digests, held UI upgrade and limited release binding');
