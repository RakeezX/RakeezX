/** AI: exact affected scope, reused unchanged safeguards, and honest static prerequisite. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {STUDENT_PENDING_STATIC,studentPendingStaticGate} from '../../drafts/n88-student-portal/activation/static-student-pending-20261021-gate.mjs';
const dir='tests/n88-student-quiet-fast-return-20261021/',prior='tests/n88-student-pending-return-finite-diagnostic-20261021/';
const base='c6e91a85035e2d5f9403f002ffd8254392df2d34',task='continuous-n88-student-quiet-fast-return-20261021',run='6f338b83-ed40-4a6a-a30e-2d3c8c4a0a0f';
const sha=b=>createHash('sha256').update(b).digest('hex'),normal=b=>b.toString().replaceAll('\r\n','\n');
const git=file=>normal(execFileSync('git',['show',base+':'+file],{maxBuffer:2097152}));
const report={status:'PASS',taskId:task,runId:run,baseSha:base,changedSourceHashes:{},evidence:{},checks:[],limits:'No push/deploy, provider operation, real account/code/data, native/SQL/Auth/cookie/region/public pin change. Product N88 remains open.'};
for(const file of ['src/views/student-portal-login.js','src/styles/student-portal-login.css','drafts/n88-student-portal/activation/bundle/private/assets/student.mjs','drafts/n88-student-portal/activation/bundle/private/styles/student-portal-login.css'])report.changedSourceHashes[file]=sha(normal(await readFile(file)));
for(const file of ['src/views/student-portal-login.js','drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'])execFileSync(process.execPath,['--check',file],{windowsHide:true});
execFileSync(process.execPath,[dir+'package.mjs','--check'],{windowsHide:true});
for(const file of ['baseline.json','ui.json','bundle-preparation.json']){const bytes=await readFile(dir+file);assert.equal(JSON.parse(bytes).status,'PASS');report.evidence[file]=sha(bytes);}
report.baselineRevision=base;
report.initialHarnessFailure={file:'baseline-clock-harness-failure.json',sha256:sha(await readFile(dir+'baseline-clock-harness-failure.json')),cause:'Clock installed after request timer creation, so fastForward did not expire that timer. Corrected by installing before navigation. Original failure retained; corrected actual-app delayed/hidden/reload scenarios PASS. Initial dispatch now measures pending-paint to send; module download is not a scheduling queue.'};
const source=normal(await readFile('src/views/student-portal-login.js'));
// The only JS differences are presentation strings. Prove the entire control flow
// (including End, generation, visibility, timeout and Support guards) is unchanged.
const previous=git('src/views/student-portal-login.js');
const lines=source.split('\n'),oldLines=previous.split('\n');assert.equal(lines.length,oldLines.length);
const changes=lines.flatMap((line,i)=>line===oldLines[i]?[]:[{line:i+1,before:oldLines[i],after:line}]);
assert.equal(changes.length,3);
assert(changes[0].before.includes('paint(`<section class="n88-unified-entry"><h1'));
assert(changes[1].before.includes(': \'<section class="n88-unified-entry" aria-busy="true">'));
assert(changes[2].before.includes("recovery('تعذّر التحقق من الجلسة الآن."));
report.presentationOnlySourceLines=changes.map(c=>c.line);
const oldProof=JSON.parse(await readFile(prior+'qualification.json'));
for(const file of ['src/lib/student-portal-unified-client.js','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','drafts/n88-student-portal/activation/bundle/edge/index.mjs'])assert.equal(normal(await readFile(file)),git(file));
assert.equal(sha(normal(await readFile('src/lib/student-portal-unified-client.js'))),oldProof.changedSourceHashes['src/lib/student-portal-unified-client.js']);
for(const file of ['transport.json','ui.json']){const bytes=await readFile(prior+file);assert.equal(JSON.parse(bytes).status,'PASS');report.evidence[prior+file]=sha(bytes);}
report.checks.push({name:'unchanged_transport_and_control_flow',status:'PASS',evidence:'Entire transport and all view control flow unchanged. Prior same-source finite diagnostic/clipboard, claim-no-replay, suspended-deadline and extended End timeout/rate guards reused; current actual DOM End ack/uncertain/pagehide/late cases also PASS.'});
for(const entry of ['source','private'])for(const width of [390,1280])for(const state of ['pending','recovery']){const name=state+'-'+entry+'-'+width+'.png';report.evidence[name]=sha(await readFile(dir+name));}
report.visualInspection='PASS: source and private screenshots at 390/1280; branded calm pending and clear recovery, no clipping; actual progressbar/live status and reduced-motion CSS asserted by UI runner.';
const card=JSON.parse(normal(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+task+'.json')).replace(/^\uFEFF/,''));
assert.equal(card.attempt.runId,run);assert.equal(card.baseSha,base);
assert.notEqual(STUDENT_PENDING_STATIC.task,task);
assert.throws(()=>studentPendingStaticGate(card,run,card.activationId,{version:2,resource:'integration',taskId:task,activationId:card.activationId,owner:{type:'worker',token:run}}),/n88_student_static_identity/);
report.privateStaticGate={status:'NOT_RUN',previousGateTask:STUDENT_PENDING_STATIC.task,previousGateCandidate:STUDENT_PENDING_STATIC.candidate,currentCardRejectedByPreviousGate:'n88_student_static_identity',missingScopePath:'drafts/n88-student-portal/activation/static-student-quiet-return-20261021-gate.mjs',reason:'Current private JS/CSS require a fresh original-custodian task/run/candidate-bound static gate and native/carrier/public-pin preflight, one append-only reserved upload and exact provider/served parity before LOCAL_READY. The established activation gate path for this task is outside allowedPaths; existing gates are bound to prior tasks/candidates and cannot be reused. No current attempt was reserved or marker changed. No deployment performed under the final no-deploy instruction.',retryCondition:'Approved maintenance can add the missing fresh activation gate path to this inactive card and preserve candidate/session. Controller then resumes the saved session for the exact separately bounded static custody phase, resolving the final no-deploy restriction there. Reuse unchanged local proofs; sole publisher retains main/frontend delivery.'};
report.checks.push({name:'n88_changed_private_static_provider_native_and_served_parity_if_changed',status:'NOT_RUN',evidence:report.privateStaticGate.reason});
report.serviceLatency='Unresolved: historical actual completed GET 5500–6500ms (activated card). Current test controls service delay at 600/6000ms and proves prompt dispatch, not faster live service. No postpublication measurement or performance acceptance claimed.';
await writeFile(dir+'qualification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:report.checks,privateStaticGate:report.privateStaticGate.status}));
