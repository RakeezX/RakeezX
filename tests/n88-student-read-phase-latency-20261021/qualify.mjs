/** AI: narrow checkpoint qualification and unchanged-evidence reuse; no provider calls. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const dir='tests/n88-student-read-phase-latency-20261021/',base='e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3';
const sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const card=await json('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-student-read-phase-latency-20261021.json');
assert.equal(card.id,'continuous-n88-student-read-phase-latency-20261021');assert.equal(card.attempt.runId,'5f1e5bac-172f-4c84-a95e-81370ee532dd');assert.equal(card.baseSha,base);
assert(!card.allowedPaths.includes('drafts/n88-student-portal/cloudflare-entry.mjs'));
const measurement=await json(dir+'measurement.json'),bridge=await json(dir+'bridge-red-first.json');
assert.equal(measurement.runs.length,11);assert.equal(measurement.cleanup.ownedPgClosed,true);assert.equal(measurement.cleanup.integrationLease,'RELEASED integration');
assert.equal(bridge.diagnosticAcceptance,'FAIL');assert.equal(bridge.finiteExtendedEnvelope.status,503);assert.equal(bridge.serviceOnlyHeader,'DROPPED');
const unchanged=['drafts/n88-student-portal/existing-host.mjs','drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/canonical-adapter.mjs','drafts/n88-student-portal/numeric-credentials.mjs','drafts/n88-student-portal/integrated-service.mjs','drafts/n88-student-portal/task-guidance.mjs','drafts/n88-student-portal/web-entry.mjs','drafts/n88-student-portal/web-protocol.mjs','drafts/n88-student-portal/cloudflare-entry.mjs','drafts/n88-student-portal/activation/bundle/edge/index.mjs','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','drafts/n88-student-portal/activation/manifest.json','src/lib/student-portal-unified-client.js','src/views/student-portal-login.js','src/styles/student-portal-login.css','sw.js'];
for(const p of unchanged)assert.equal(lf(await readFile(p,'utf8')),lf(execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:2097152})),p);
const pending=await json('tests/n88-student-pending-return-finite-diagnostic-20261021/qualification.json'),quiet=await json('tests/n88-student-quiet-fast-return-20261021/qualification.json');
assert.equal(sha(lf(await readFile('src/lib/student-portal-unified-client.js','utf8'))),pending.changedSourceHashes['src/lib/student-portal-unified-client.js']);
for(const p of ['src/views/student-portal-login.js','src/styles/student-portal-login.css'])assert.equal(sha(lf(await readFile(p,'utf8'))),quiet.changedSourceHashes[p]);
const uiFile='tests/n88-student-quiet-fast-return-20261021/ui.json',transportFile='tests/n88-student-pending-return-finite-diagnostic-20261021/transport.json';
assert.equal(sha(await readFile(uiFile)),quiet.evidence['ui.json']);assert.equal(sha(await readFile(transportFile)),pending.evidence['transport.json']);
for(const file of await readdir(dir))if(file.endsWith('.mjs'))execFileSync(process.execPath,['--check',dir+file],{encoding:'utf8'});
execFileSync('git',['diff','--check'],{encoding:'utf8'});
const changed=execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
for(const p of [...changed,...untracked])assert(p.startsWith(dir)||p==='docs/automation-evidence/20261021/N88_STUDENT_READ_PHASE_LATENCY.md',p);
const checks=[
 {name:'n88_student_get_phase_red_first_and_causal_measurement',status:'PASS',evidence:dir+'measurement.json: receipt-bound native host, actual signed Web entry and PG17; 11 measured runs, 39 queries/GET, synthetic transport attestation; no real-account bottleneck established.'},
 {name:'n88_student_get_auth_revoke_visibility_owner_boundaries',status:measurement.status==='PASS'?'PASS':'FAIL',evidence:dir+'measurement.json; actual fabricated native handler guards; original harness failures retained. Unchanged frontend DOM/retirement proof hash-verified and reused.'},
 {name:'n88_student_get_guidance_projection_commit_parity',status:measurement.status==='PASS'?'PASS':'FAIL',evidence:dir+'measurement.json; all successful delayed bodies equal baseline; full 13-family projection and guidance query retained; failed/unknown COMMIT deny. No Product source changed.'},
 {name:'n88_student_get_measured_improvement_or_private_finite_diagnostic',status:'FAIL',evidence:dir+'bridge-red-first.json: published carrier drops service-only header and rejects finite extended envelope with503/reply-shape; no causal optimization established; diagnostic not implemented.'},
 {name:'n88_student_get_native_custody_pin_and_served_parity',status:'NOT_RUN',evidence:'Native/static upload gate not reached; no attempt reserved, upload, source-pin update, provider/served readback or real-account request. Existing receipts are immutable baseline evidence only.'}
];
const evidence={};for(const p of [dir+'measurement.json',dir+'measurement-before-owner-fixture-failure.json',dir+'bridge-red-first.json',uiFile,transportFile])evidence[p]=sha(await readFile(p));
const result={taskId:card.id,runId:card.attempt.runId,sessionId:card.sessionId,baseSha:base,state:'BLOCKED',checks,blockerType:'implementation',blocker:'Diagnostic branch requires drafts/n88-student-portal/cloudflare-entry.mjs, absent from activated allowedPaths. Generated worker-only edits would leave canonical source inconsistent. No causal optimization proven.',nextAction:'Approved inactive-card maintenance adds that exact canonical source path; controller resumes saved session 01a15e63-ff70-7d02-b264-2631fc585456/candidate. Reuse measurements; implement and prove finite successful-GET bridge/client/copy gates before original-custodian native/static phases.',unchanged,evidence,syntax:'PASS',scopedDiff:'PASS',ui:'REUSED unchanged actual-app HTTP DOM/handlers/CSS proof; no new rendered-UI PASS',providerOperations:0,realAccountRequests:0,uploadAllowanceConsumed:0,cleanup:measurement.cleanup};
await writeFile(dir+'qualification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({state:result.state,checks,syntax:result.syntax,scopedDiff:result.scopedDiff}));
