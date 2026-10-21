/** AI: affected transport guards and exact source/package custody evidence. No provider access. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
import {static1522Gate,STATIC1522} from '../../drafts/n88-student-portal/activation/static-1522-gate.mjs';
const dir='tests/n88-student-session-quiet-progress-20261021/',base='ebb8aa4daf5c71f255941c9ffb71fae91c18a155';
const good={version:'n88-student-v3',profile:{name:'synthetic'}};
const report={status:'FAIL',transport:[]};
const response=(status,data=good)=>({ok:status===200,status,headers:new Headers({'Retry-After':'2'}),json:async()=>data});
for(const [scenario,claimStatus,readStatus,expectedKind,claimState] of [
 ['claim-denied',401,200,'session','rejected'],['claim-rate',429,200,'rate','rejected'],['claim-network',0,200,'unavailable','uncertain'],
 ['accepted-read-denied',200,401,'session','accepted'],['accepted-read-network',200,0,'unavailable','accepted'],['accepted-read-rate',200,429,'rate','accepted']
]){
 const calls=[];const c=createUnifiedStudentPortalClient({fetch:async(url,init)=>{calls.push(url.split('/').at(-1));assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');const status=url.endsWith('/claim')?claimStatus:readStatus;if(!status)throw Error('PRIVATE_TRANSPORT_DETAIL');return response(status);}});
 await assert.rejects(c.claim('1'+'23456'),e=>e.kind===expectedKind&&e.claimState===claimState&&e.message==='Student access unavailable');
 assert.deepEqual(calls,claimStatus===200?['claim','read']:['claim']);c.dispose();report.transport.push({scenario,status:'PASS',noReplay:true});
}
for(const phase of ['claim','read']){
 let release;const calls=[];
 const c=createUnifiedStudentPortalClient({fetch:async url=>{const action=url.split('/').at(-1);calls.push(action);if(action===phase)await new Promise(ok=>release=ok);return response(200);}});
 const pending=c.claim('1'+'23456');for(let n=0;!release;n++){assert(n<100);await new Promise(ok=>setImmediate(ok));}c.invalidate();release();await assert.rejects(pending,e=>e.kind==='stale');assert.deepEqual(calls,phase==='claim'?['claim']:['claim','read']);c.dispose();report.transport.push({scenario:'retire-inflight-'+phase,status:'PASS'});
}
for(const filename of ['ui.json','ui-extra.json'])assert.equal(JSON.parse(await readFile(dir+filename,'utf8')).status,'PASS');
execFileSync(process.execPath,[dir+'package.mjs','--check'],{windowsHide:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const changed=['src/lib/student-portal-unified-client.js','src/views/student-portal-login.js','src/views/student-portal-class.js','src/styles/student-portal-class.css','drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'];
report.changedSourceHashes={};for(const f of changed)report.changedSourceHashes[f]=sha((await readFile(f,'utf8')).replaceAll('\r\n','\n'));
report.unchanged={};
for(const f of ['drafts/n88-student-portal/numeric-credentials.mjs','drafts/n88-student-portal/class-credentials.mjs','drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/official-activation.mjs','drafts/n88-student-portal/activation/static-1522-gate.mjs','drafts/n88-student-portal/activation/private-document.mjs','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','drafts/n88-student-portal/activation/bundle/edge/index.mjs','drafts/n88-student-portal/activation/manifest.json']){
 const actual=await readFile(f),prior=execFileSync('git',['show',base+':'+f],{maxBuffer:16*1024*1024});assert.equal(actual.toString().replaceAll('\r\n','\n'),prior.toString().replaceAll('\r\n','\n'));report.unchanged[f]=sha(actual);
}
const card=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-student-session-and-quiet-progress-20261021.json','utf8')).replace(/^\uFEFF/,''));
assert.throws(()=>static1522Gate(card,'d56d8290-b64f-493d-9dc8-69b8f84d7c36'),/n88_static1522_identity/);
report.custody={status:'BLOCKED',gateTask:STATIC1522.task,gateCandidate:STATIC1522.candidate,reason:'Existing original-custodian static1522 gate binds a different immutable task/run/candidate. Current card has no matching reviewed changed-source static correction. No secret state loaded or provider operation attempted.',missingPaths:['drafts/n88-student-portal/official-activation.mjs','drafts/n88-student-portal/activation/static-student-session-20261021-gate.mjs','drafts/n88-student-portal/activation/private-document.mjs','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','drafts/n88-student-portal/activation/manifest.json'],servedParity:'NOT_RUN',teacherFrontendPublication:'NOT_RUN'};
report.custody.preparedCarrier={path:dir+'carrier.mjs',sha256:sha(await readFile(dir+'carrier.mjs')),recordedProviderPreimage:'2f96fdc067e3658f8105f1c6de73d730fd3d62100c98490bdd0d1604c1204b15',scope:'Only the embedded student module base64 differs; all other carrier bytes/assets retain the published region/transport corrections. Provider preimage is recorded historical evidence, not a fresh readback.'};
report.actualSecondLoginCause='UNPROVEN: two same-code claims/read pairs succeed through actual numeric handler and credential adapter with memory SQL port; no live session observed.';
report.baseSha=base;report.observedOriginMain=execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim();report.status='PASS';
await writeFile(dir+'qualification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,transport:report.transport.length,custody:report.custody.status}));
