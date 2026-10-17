import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {eligibleRelease,chooseRelease,syncOnce} from './n36-stable-sync.mjs';
const sha='a'.repeat(40),candidate='b'.repeat(40),base='c'.repeat(40),hash='d'.repeat(64);
function task(v='0.5.9'){
 const id='continuous-n36-synthetic-release-20261017',stem='assets/extensions/rakeez-teacher-import-helper-'+v;
 const assets=['.zip','.manifest.json'].map(ext=>({repoPath:stem+ext,verified:true,statusCode:200,expectedSha256:hash,observedSha256:hash}));
 return {id,productId:'N36',status:'awaiting_po',candidateSha:candidate,baseSha:base,deliveryReceipt:{taskId:id,ticketId:'N36',candidateSha:candidate,baseSha:base,publishedSha:sha,status:'deployed',productionDeployed:true,verifiedAt:'2026-10-17T09:08:32Z',provider:{status:'completed',conclusion:'success',headSha:sha},binding:{candidateSha:candidate,publishedSha:sha},changedPaths:assets.map(a=>a.repoPath),evidence:{immutable:{passed:true,assets:structuredClone(assets)},production:{passed:true,assets:structuredClone(assets)}}}};
}
test('requires exact verified package proof, skips UI-only and blocked releases',()=>{
 const t=task();assert.equal(eligibleRelease(t).version,'0.5.9');
 for(const mutate of [t=>t.status='blocked',t=>t.deliveryReceipt.evidence.production.passed=false,t=>t.deliveryReceipt.provider.headSha=base,t=>t.deliveryReceipt.binding.candidateSha=base,t=>t.deliveryReceipt.evidence.immutable.assets[0].verified=false,t=>t.deliveryReceipt.changedPaths=[],t=>t.deliveryReceipt.evidence.production.assets[0].observedSha256='e'.repeat(64)]){
  const bad=structuredClone(t);mutate(bad);assert.equal(eligibleRelease(bad),null);
 }
 assert.equal(chooseRelease([t],{version:'0.5.9'}).status,'ALREADY_CURRENT');
 assert.equal(chooseRelease([t],{version:'0.5.10'}).status,'NO_DOWNGRADE');
 assert.equal(chooseRelease([task('0.5.10'),t],{version:'0.5.8'}).version,'0.5.10');
});
test('calls existing guarded updater once then skips, respects lock and bounded failure retry',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'n36-sync-')),folder=root+'/artifacts/private-tools/n36-current',queue=root+'/artifacts/ops-supervisor-v4/queue';
 fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(queue,{recursive:true});
 const t=task();fs.writeFileSync(queue+'/release.json',JSON.stringify(t));fs.writeFileSync(folder+'/STABLE_CURRENT.json',JSON.stringify({version:'0.5.8'}));
 let calls=0;const execute=(exe,args,options)=>{calls++;assert.deepEqual(args.slice(-5),['0.5.9','--task',t.id,'--apply'].slice(-5));};
 const success=(exe,args,options)=>{calls++;assert.equal(args.at(-1),'--apply');assert.equal(args[2],'0.5.9');assert.equal(options.windowsHide,true);fs.writeFileSync(folder+'/STABLE_CURRENT.json',JSON.stringify({version:'0.5.9',sourceTaskId:t.id,publishedSha:sha}));return '';};
 try{
  fs.writeFileSync(folder+'/update.lock.json','owned');assert.equal((await syncOnce({root,execute:success})).status,'UPDATER_BUSY');assert.equal(calls,0);fs.unlinkSync(folder+'/update.lock.json');
  assert.equal((await syncOnce({root,execute:success})).status,'UPDATED');assert.equal(calls,1);
  assert.equal((await syncOnce({root,execute:success})).status,'ALREADY_CURRENT');assert.equal(calls,1);
  fs.writeFileSync(folder+'/STABLE_CURRENT.json',JSON.stringify({version:'0.5.8'}));
  const fail=()=>{calls++;throw Error('private output must not be logged');};
  assert.equal((await syncOnce({root,now:()=>100000,execute:fail})).status,'UPDATE_FAILED_PRESERVED');
  assert.equal((await syncOnce({root,now:()=>100001,execute:fail})).status,'RETRY_LATER');
  assert.equal(calls,2);
  assert.equal(fs.readFileSync(folder+'/AUTO_SYNC_FAILURE.json','utf8').includes('private output'),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
