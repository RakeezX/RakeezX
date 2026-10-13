import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Controller, readJson, writeJson, workerProcesses, identityMatches, verifiedDeployment, watchdogReason, runCommand, spawnDetachedLogged, validatePublishedEvidence } from '../controller.mjs';

const BASE = '1'.repeat(40), CANDIDATE = '2'.repeat(40), PUBLISHED = '3'.repeat(40), HASH = 'a'.repeat(64);
const SESSION = '76e0262b-7806-411a-a5df-64c155092901';
const ACTIVATION = 'po-20261012-continuous';
const card = (id = 'n92', extra = {}) => ({ id, productId: id.toUpperCase(), workflowVersion: 5, activationId: ACTIVATION,
  priority: id === 'n92' ? 1 : 2, status: 'pending', objective: 'Synthetic controller fixture only', riskClass: 'FAST',
  allowedPaths: ['src/' + id + '.js'], scopeKey: id, releaseAuthority: 'ISOLATED TEST FIXTURE — no actual publication', ...extra });
function result(task, override = {}) {
  return { taskId: task.id, runId: task.attempt.runId, state: 'LOCAL_READY', candidateSha: CANDIDATE, baseSha: BASE,
    worktreePath: task.worktreePath, changedPaths: ['src/' + task.id + '.js'], checks: [{ name: 'synthetic fixture assertion', status: 'PASS', evidence: 'Fixture only' }],
    summary: 'Fixture candidate', blockerType: 'none', blocker: null, nextAction: null, ...override };
}
function deployed(task, override = {}) {
  const assets = [{ repoPath: `src/${task.id}.js`, expectedSha256: HASH, observedSha256: HASH, verified: true }];
  return { status: 'deployed', taskId: task.id, ticketId: task.productId, candidateSha: task.candidateSha, baseSha: task.baseSha,
    publishedSha: PUBLISHED, deploymentId: 'fixture-deployment', verifiedAt: '2026-10-12T12:00:00Z',
    provider: { headSha: PUBLISHED, status: 'completed', conclusion: 'success', deploymentId: 'fixture-deployment', previewUrl: 'https://fixture.rakeezx.pages.dev' },
    binding: { candidateSha: task.candidateSha, declaredBaseSha: task.baseSha, publishedSha: PUBLISHED, candidateAncestorOfPublished: true,
      previousMainAncestorOfPublished: true, mainContainsPublished: true }, productSourceChangeObserved: true, changedAssets: ['src/' + task.id + '.js'],
    evidence: { immutable: { origin: 'https://fixture.rakeezx.pages.dev', passed: true, assets }, production: { origin: 'https://rakeezx.com', passed: true, assets } }, ...override };
}
async function fixture(t, extraAdapters = {}) {
  const runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-controller-test-'));
  t.after(() => fs.rm(runtime, { recursive: true, force: true }));
  const state = { time: Date.parse('2026-10-12T12:00:00Z'), processes: [], launches: [], publishes: [], runtime };
  const config = { version: 5, maxWorkers: 1, defaultModel: 'fixture-no-model-call', controller: { activationId: ACTIVATION, productionUrl: 'https://rakeezx.com', codexPath: 'fixture-not-an-executable' } };
  await writeJson(path.join(runtime, 'workflow-v5.json'), config);
  const adapters = { testOnly: true, now: () => state.time, inventory: async () => state.processes,
    prepare: async task => { task.baseSha ??= BASE; task.worktreePath ??= path.join(runtime, 'worktree-' + task.id); task.cwd = task.worktreePath; },
    validate: async (_task, receipt) => receipt,
    launch: async (task, spec) => { state.launches.push(structuredClone(spec)); return 4000 + state.launches.length; },
    publisher: async opts => { state.publishes.push(opts); return { status: 'pending', retryable: true, retryAfterSeconds: 20, errorCode: 'FIXTURE_PENDING' }; }, ...extraAdapters };
  async function controller() { const value = new Controller({ runtime, repo: runtime }, adapters); await value.initialize({ lock: false }); return value; }
  state.controller = await controller(); state.restart = controller;
  state.add = async task => { await writeJson(path.join(runtime, 'queue', task.id + '.json'), task); };
  state.get = id => readJson(path.join(runtime, 'queue', id + '.json'));
  state.tick = () => state.controller.tick();
  state.finish = async (id, output, checkpointExtra = {}) => {
    const task = await state.get(id);
    await writeJson(task.attempt.checkpointPath, { taskId: task.id, runId: task.attempt.runId, sessionId: SESSION, finishedAt: new Date(state.time).toISOString(), exitCode: 0, ...checkpointExtra });
    if (output) await writeJson(task.attempt.outputPath, typeof output === 'function' ? output(task) : output);
    state.processes = []; return task;
  };
  return state;
}


async function evidenceFixture(t) {
 const s=await fixture(t),reference=card('reference',{productId:'N99',status:'awaiting_po',baseSha:BASE,candidateSha:CANDIDATE});reference.deliveryReceipt=deployed(reference);
 const evidence=card('evidence',{productId:'N99',status:'pending',executionMode:'local',liveMutation:false,completionMode:'record_published_evidence',evidenceOnly:{referenceTaskId:'reference',referencePublishedSha:PUBLISHED,acceptanceAuthority:'Synthetic technical verification-only acceptance'},baseSha:BASE,candidateSha:CANDIDATE,worktreePath:path.join(s.runtime,'evidence'),sessionId:SESSION,requiredChecks:['collected'],allowedPaths:['docs/automation-evidence/20261013/CHECK.md'],attempt:{runId:'evidence-run',outputPath:path.join(s.runtime,'evidence-result.json')},lastWorkerReap:{exactAbsence:true,activationId:ACTIVATION,runId:'evidence-run',owners:[{pid:44,createdAt:'2026-10-12T11:00:00Z'}]}});
 const output=result(evidence,{changedPaths:evidence.allowedPaths,checks:[{name:'collected',status:'PASS',evidence:'fixture only'}]});
 await s.add(reference);await s.add(evidence);await writeJson(evidence.attempt.outputPath,output);return{s,evidence,reference,output};
}
test('a source-bound existing evidence record completes without worker/publisher and leaves parent unclosed',async t=>{const {s}=await evidenceFixture(t);await s.tick();const q=await s.get('evidence');assert.equal(q.status,'closed');assert.equal(q.verificationReceipt.newProductDeployment,false);assert.equal(q.verificationReceipt.productTicketClosed,false);assert.equal((await s.get('reference')).status,'awaiting_po');assert.equal(s.launches.length,0);assert.equal(s.publishes.length,0);await s.tick();assert.equal(s.launches.length,0);});
for(const [name,change] of [
 ['Product change',f=>f.output.changedPaths=['src/app.js']],['broad path',f=>f.evidence.allowedPaths=['docs/**']],
 ['failed check',f=>f.output.checks[0].status='FAIL'],['unrun check',f=>f.output.checks[0].status='NOT_RUN'],
 ['different task',f=>f.output.taskId='other'],['different candidate',f=>f.output.candidateSha='9'.repeat(40)],
 ['missing reference deployment',f=>f.reference.deliveryReceipt.evidence.production.passed=false],
 ['live mutation',f=>f.evidence.liveMutation=true],['different published reference',f=>f.evidence.evidenceOnly.referencePublishedSha='9'.repeat(40)],
 ['missing explicit completion mode',f=>delete f.evidence.completionMode]
])test('evidence recovery rejects '+name,async t=>{const f=await evidenceFixture(t);change(f);assert.throws(()=>validatePublishedEvidence(f.evidence,f.output,f.reference));});
test('an unreaped worker prevents completion',async t=>{const f=await evidenceFixture(t);f.evidence.lastWorkerReap.exactAbsence=false;await f.s.add(f.evidence);await f.s.tick();assert.notEqual((await f.s.get('evidence')).status,'closed');assert.equal(f.s.launches.length,0);});
