// AI-authored targeted tests. No live queue, browser, provider or Product data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCardReadiness } from './card-readiness.mjs';
import { summarizeProblems, readProblemSummary } from './problem-summary.mjs';
import { Controller } from './controller.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const commit = '1552d1cc40473bf99b44e98d2fe779ea034a8f62';
function card() { return { id: 'test-n36-preflight', productId: 'N36', activationId: 'test',
  objective: 'Fabricated admission test', releaseAuthority: 'Synthetic only', scopeKey: 'test-n36',
  allowedPaths: ['src/views/class-import-center.js', 'tests/new-check/**'], requiredChecks: ['local'], postDeliveryChecks: ['served'],
  preflight: { version: 1, sourceCommit: commit, requiredSourcePaths: ['src/views/class-import-center.js'],
    editPaths: ['src/views/class-import-center.js', 'tests/new-check/test.mjs'], newPaths: ['tests/new-check/test.mjs'],
    workerChecks: ['local'], publisherChecks: ['served'] } }; }
const fake = { listPaths: async () => ['src/views/class-import-center.js'] };
async function rejectsCard(change, code) { const c=card(); change(c); const r=await inspectCardReadiness(c,root,fake); assert.equal(r.passed,false); assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r)); }
test('declared existing and new paths pass',async()=>assert.equal((await inspectCardReadiness(card(),root,fake)).passed,true));
test('missing metadata rejected before worker',()=>rejectsCard(c=>delete c.preflight,'READINESS_MISSING'));
test('missing canonical boundary in write scope detected',()=>rejectsCard(c=>c.preflight.editPaths.push('drafts/n88-student-portal/cloudflare-entry.mjs'),'EDIT_OUTSIDE_SCOPE'));
test('misspelled source detected',()=>rejectsCard(c=>c.preflight.requiredSourcePaths.push('src/missing.js'),'SOURCE_MISSING'));
test('nonexistent edit needs explicit new-path declaration',()=>rejectsCard(c=>c.preflight.newPaths=[],'EDIT_PATH_MISSING'));
test('existing path cannot be relabeled new',()=>rejectsCard(c=>c.preflight.newPaths.push('src/views/class-import-center.js'),'NEW_PATH_ALREADY_EXISTS'));
test('publisher-only check cannot gate LOCAL_READY',()=>rejectsCard(c=>{c.requiredChecks=['served'];c.preflight.workerChecks=['served']},'PHASE_COLLISION'));
test('worker checks must match exact obligation',()=>rejectsCard(c=>c.requiredChecks.push('owner'),'WORKER_CHECKS_DIFFER'));
test('publisher checks must match exact obligation',()=>rejectsCard(c=>c.postDeliveryChecks.push('provider'),'PUBLISHER_CHECKS_DIFFER'));
test('path traversal rejected',()=>rejectsCard(c=>c.preflight.requiredSourcePaths.push('../secrets'),'UNSAFE_PATH'));
test('git option or pathspec injection rejected',()=>rejectsCard(c=>c.preflight.requiredSourcePaths.push(':(glob)**'),'UNSAFE_PATH'));
test('source read failure is not PASS',async()=>{const r=await inspectCardReadiness(card(),root,{listPaths:async()=>{throw Error('unavailable')}});assert.equal(r.passed,false);assert.equal(r.errors[0].code,'SOURCE_READ_UNAVAILABLE')});
test('pinned actual repository source read works',async()=>assert.equal((await inspectCardReadiness(card(),root)).passed,true));
const map={version:1,authority:'po-test',updatedAt:'2026-10-22T19:00:00Z',problems:[{key:'latency',productId:'N88',issueNumber:3,title:'Latency',gate:'waiting_evidence',taskIds:['diagnostic','fix'],currentTaskIds:['fix'],nextAction:'Read safe timing'}]};
test('diagnostic published does not claim problem solved',()=>{const r=summarizeProblems([{id:'diagnostic',status:'awaiting_po',productionVerifiedAt:'2026-10-21T12:00:00Z'}],map,'now');assert.equal(r.problems[0].state,'waiting_evidence');assert.match(r.problems[0].acceptance,/NOT_INFERRED/)});
test('active current repair overrides waiting display only',()=>{const jobs=[{id:'fix',status:'running'}];const before=JSON.stringify(jobs);assert.equal(summarizeProblems(jobs,map,'now').problems[0].state,'working');assert.equal(JSON.stringify(jobs),before)});
test('current blocked repair remains explicit',()=>assert.equal(summarizeProblems([{id:'fix',status:'blocked'}],map,'now').problems[0].state,'blocked'));
test('missing summary map leaves queue unaffected',async()=>{const r=await readProblemSummary(path.join(os.tmpdir(),'rakeez-missing-map-opaque'),[],'now');assert.equal(r.available,false);assert.equal(r.queueUnaffected,true)});
test('real controller admits valid card and rejects invalid card without launching',async()=>{
  const rt=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-admission-test-'));
  try {
    await fs.mkdir(path.join(rt,'queue'));
    const c=new Controller({repo:root,runtime:rt},{testOnly:true,records:{inspectProductEligibility:async()=>({eligible:true})}});
    c.config={controller:{activationId:'test'}}; c.noteReadAt=Date.now();
    const good=card(),bad=card();bad.id='test-bad';bad.preflight.editPaths.push('drafts/n88-student-portal/cloudflare-entry.mjs');
    c.noteCache={cards:[bad,good],issues:[],openProducts:['N36']};
    await c.importCatalog();
    assert.equal(c.jobs.length,1);assert.equal(c.jobs[0].id,good.id);assert.equal(c.jobs[0].status,'pending');
    assert.ok(c.issues.some(i=>i.code==='CARD_READINESS_FAILED'&&i.taskId==='test-bad'));
    assert.deepEqual((await fs.readdir(path.join(rt,'queue'))),[good.id+'.json']);
    // Existing saved sessions are never requalified, restarted or modified by this gate.
    c.jobs[0].sessionId='preserved';delete good.preflight;c.noteCache.cards=[good];
    await c.importCatalog();assert.equal(c.jobs.length,1);assert.equal(c.jobs[0].sessionId,'preserved');
  } finally { await fs.rm(rt,{recursive:true,force:true}); }
});
