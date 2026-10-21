// AI: certify only actual affected runtime evidence; retain original failed runs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir=new URL('./',import.meta.url),read=async name=>JSON.parse(await fs.readFile(new URL(name,dir),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const app='src/views/class-import-center.js',base='e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3',predecessor='6f9cd28eab5e44f63bafd5eb3aab99dcbbe3506e';
execFileSync('git',['merge-base','--is-ancestor',predecessor,'HEAD']);
const appHash=hash(await fs.readFile(app)),baselineHash=hash(execFileSync('git',['show',base+':'+app]));
const selected={
 'baseline.json':['ownerless-active','ownerless-upcoming','owned-upcoming'],
 'baseline-persisted-ownerless.json':['ownerless-disk'],
 'candidate-positive.json':['ownerless-active','ownerless-upcoming','owned-upcoming'],
 'candidate-initial-pending-assertion.json':['foreign-year','foreign-term','closed-term','archived-year','after-term-owner','start-owner','start-session','start-database','start-lease'],
 'ownerless-receipt-selection-regressions.json':['existing','missing-year','optimistic','cross-tab','after-chunk'],
 'ownerless-transaction-unknown-regressions.json':['transaction-drift','after-document','saved-before-receipt','readback-unknown','missing-term']
};
let runtimeFingerprint;const evidence=[];
for(const [file,cases] of Object.entries(selected)){
 const data=await read(file);assert.equal(data.applicationFiles[app],data.baselineApp?baselineHash:appHash);
 assert.equal(data.resources.serverClosed,true);assert.equal(data.resources.isolatedBrowserFinally,true);
 runtimeFingerprint??=data.runtimeFingerprint;assert.equal(data.runtimeFingerprint,runtimeFingerprint);
 for(const name of cases){const row=data.cases.find(c=>c.scenario===name);assert.equal(row?.status,'PASS',file+':'+name);evidence.push({file,scenario:name,status:row.status,saved:row.saved,code:row.view?.code??null,sha256:hash(await fs.readFile(new URL(file,dir)))});}
}
for(const scope of ['extensions','assets/extensions','src/store.js','src/models.js','src/lib','sw.js'])assert.equal(execFileSync('git',['diff','--name-only',base,'--',scope],{encoding:'utf8'}).trim(),'','Protected scope changed: '+scope);
const output={taskId:'continuous-n36-1150-ownerless-year-term-selection-20261021',runId:'a721f179-0912-45cf-9d37-3cdf4aaffc8c',baseSha:base,predecessor,appHash,baselineHash,runtimeFingerprint,status:'PASS',certifiedCases:evidence.length,evidence,originalFailuresPreserved:['harness-missing-vm-flag.json','baseline-disk-fixture-first.json','candidate-initial-pending-assertion.json'],scope:'App-only year/term owner and writable qualification; extension/ZIP/store/models/shared libraries/offline shell unchanged',production:'NOT_RUN; independent publisher',actual0535Receipt:'Unresolved; no replay or expired nonce acknowledgement'};
await fs.writeFile(new URL('certified.json',dir),JSON.stringify(output,null,2)+'\n');console.log('PASS '+evidence.length+' exact affected runtime cases; protected scope unchanged');
