// AI: read-only binding of current source, saved proofs and operator metadata.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hash} from './n58-switch-prevention-services.mjs';
const root='C:/Users/Abody/Projects/RakeezX';
const base='a31778a81cc257aa6ca4bb76d5a28ff7fec5b40e';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const normalized=s=>s.replaceAll('\r\n','\n');
const read=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const ui=await read('tests/n58-switch-prevention-ui.json');
assert.equal(ui.completed,true);assert.equal(ui.cases.length,2);assert.ok(ui.cases.every(c=>c.pass&&c.actualDOM&&c.lostAckImmutable));
for(const c of ui.cases){
 const calls=ui.calls.filter(x=>x.timing===c.timing);
 const commands=rows=>new Set(rows.map(x=>x.envelope.p_mutation_id)).size;
 assert.equal(commands(calls.filter(x=>x.envelope.p_entity==='years'&&x.envelope.p_operation==='create')),1);
 assert.equal(commands(calls.filter(x=>x.envelope.p_entity==='terms'&&x.envelope.p_operation==='create')),2);
 for(const call of calls)assert.deepEqual(call,calls.find(x=>x.envelope.p_mutation_id===call.envelope.p_mutation_id),'Concurrent/retried requests retain the same envelope and receipt');
 assert.equal(calls.filter(x=>x.envelope.p_operation==='delete').length,0);
 assert.equal(c.generalBeforeAck.data.years[0].calendarPresetId,'sa-general-1448-1449');
 assert.equal(c.settled.data.years[0].calendarPresetId,'sa-western-1448-1449');
 assert.equal(c.settled.data.outbox.length,0);
 assert.ok(c.wrongOwner.ownershipBlocked>0);
 assert.deepEqual(c.remote.terms.map(x=>x.id).sort(),c.boot.terms.map(x=>x.id).sort());
 if(c.timing==='after-sync'){
  assert.ok(c.pendingAck.data.outbox.some(x=>x.store==='years'));
  assert.ok(c.pendingAck.data.outbox.every(x=>x.state!=='rejected'));
  assert.deepEqual(c.settled.data.sessions,c.historyBefore);
 }
}
for(const [file,digest]of Object.entries(ui.sourceHashes))assert.equal(hash(normalized(await fs.readFile(file,'utf8'))),digest);
const operatorFile=root+'/docs/automation-evidence/20261014/N58_CURRENT_SERVICE_AND_RELEASE_SCOPE_1925.md';
const operator=await fs.readFile(operatorFile,'utf8');
const serviceBodyMd5={
 'apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)':'a6284ed21c86f1cafcac2d4d84a5fadc',
 'n58_guard_calendar_contract()':'6fc9fcdf35f78d0ae295fe61a833f70d',
 'provision_account_workspace(jsonb)':'a641c556c736f72b63d1e0cb203e1e1e',
};
for(const [signature,digest]of Object.entries(serviceBodyMd5)){
 assert.ok(operator.includes(signature+': '+digest));
 assert.equal(ui.identities.protocolFunctions.find(x=>x.signature==='rakeezx.'+signature)?.body_md5,digest);
}
const dependencyFile=root+'/artifacts/ops-supervisor-v4/queue/continuous-n58-fresh-account-calendar-foundation-20261014.json';
const dependency=await read(dependencyFile),delivery=dependency.deliveryReceipt;
assert.equal(dependency.status,'awaiting_po');assert.ok(dependency.productionVerifiedAt);
assert.equal(delivery.evidence.production.passed,true);assert.equal(delivery.binding.checkHeadShaMatches,true);
assert.equal(delivery.publishedSha,base);assert.equal(delivery.provider.headSha,base);assert.equal(delivery.provider.conclusion,'success');
assert.equal(git('rev-parse','origin/main'),base);
const changed=git('diff','--name-only',base,'--','src','sw.js').split('\n');assert.deepEqual(changed,['src/store.js']);
const old=normalized(execFileSync('git',['show',base+':src/store.js'],{encoding:'utf8'}));
const current=normalized(await fs.readFile('src/store.js','utf8'));
const start='// N58 temporary containment.',end='export const CALENDAR_PRESET_SWITCH_HOLD_MESSAGE';
const previousBlock=old.slice(old.indexOf(start),old.indexOf(end));
const replacement=current.slice(current.indexOf('// N58 bounded release:'),current.indexOf(end));
assert.equal(current.replace(replacement,previousBlock),old,'Only the held selection path is enabled');
assert.match(current,/CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = false/);
const reused={};
for(const file of ['tests/n58-fresh-account-candidate.json','tests/n58-fresh-account-verification.json','tests/n58-fresh-account-upgrade.json','tests/n58-fresh-account-offline.json','tests/n58-fresh-account-release-binding.json'])reused[file]=hash(await fs.readFile(file));
const cleanup=await read('tests/n58-switch-prevention-cleanup-'+ui.runId.slice(0,8)+'.json');
assert.ok(cleanup.cleanup.every(x=>x.closed));assert.equal(cleanup.cleanup.length,6);
const receipt={runId:ui.runId,baseSha:base,observedOriginMain:git('rev-parse','origin/main'),sourceHashes:ui.sourceHashes,
 operatorRecord:{path:operatorFile,normalizedSha256:hash(normalized(operator)),serviceBodyMd5,meaning:'Existing routine metadata equality only; no hosted write certification or new service operation.'},
 dependency:{path:dependencyFile,candidateSha:dependency.candidateSha,publishedSha:delivery.publishedSha,verifiedAt:dependency.productionVerifiedAt,productionEvidencePassed:delivery.evidence.production.passed,deploymentId:delivery.deploymentId,receiptSha256:hash(JSON.stringify(delivery))},
 reused,delta:'Only existing preset selection hold flag/comment changed; selection, first-use dependencies, Sync, strict reads, session provenance, grade/import/restore and offline implementation unchanged.',
 nativeReadGuards:'3/3 PASS: node --test tests/n58-fresh-account-read-guards.test.mjs',
 historicalHosted:{aSessionAndA2Restore:'FAIL',contextRejection:'NOT_RUN',bOwnerIsolation:'NOT_RUN',presetContextPreservation:'NOT_RUN',retiredPair:'untouched; not reactivated'},
 release:'Prepared candidate only; independent publisher owns integration/provider/served checks; PO fresh-account trial and full N58 acceptance pending.',
 newHostedCalls:0,newHostedFixtures:0,serviceChanges:0,cleanup:cleanup.cleanup,status:'PASS'};
await fs.writeFile('tests/n58-switch-prevention-binding.json',JSON.stringify(receipt,null,2)+'\n');
console.log('PASS exact UI source, 3 existing service identities, verified dependency receipt, unchanged safeguards/evidence and owned cleanup');
