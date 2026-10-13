import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Controller, readJson, writeJson, workerProcesses, identityMatches, verifiedDeployment, watchdogReason, runCommand, spawnDetachedLogged } from '../controller.mjs';

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


const holderRun='11111111-1111-4111-8111-111111111111';
async function arrange(t) {
 const s=await fixture(t);await s.add(card('n71',{status:'blocked',sessionId:SESSION,baseSha:BASE,worktreePath:path.join(s.runtime,'worktree-n71'),lastFailure:'The browser phase lease is held by another active task, preventing the required check.',attempt:{runId:'saved-run',outputPath:path.join(s.runtime,'result.json')},lastWorkerReap:{exactAbsence:true,runId:'saved-run',owners:[{pid:42,createdAt:'2026-10-12T10:00:00Z'}]}}));
 await s.add(card('n77',{status:'running',attempt:{runId:holderRun}}));await s.controller.loadJobs();const task=s.controller.jobs.find(x=>x.id==='n71');
 const r=result(task,{state:'BLOCKED',blockerType:'external',blocker:task.lastFailure,checks:[{name:'browser',status:'NOT_RUN',evidence:'browser.json is owned by task n77 (token '+holderRun+').'}]});
 await writeJson(task.attempt.outputPath,r);const lease={version:2,taskId:'n77',activationId:ACTIVATION,owner:{type:'worker',pid:99,createdAt:'2026-10-12T11:00:00Z',token:holderRun}};await writeJson(path.join(s.runtime,'leases','browser.json'),lease);return {s,task,r,lease};
}
test('busy browser becomes durable wait and resumes saved session only after actual release',async t=>{const {s,task}=await arrange(t);await s.controller.resolveResourceWaits([]);assert.equal(task.status,'retry_wait');assert.equal(task.failureClass,'resource');assert.equal(task.candidateSha,CANDIDATE);await s.controller.resolveResourceWaits([]);assert.equal(s.launches.length,0);assert.equal(task.status,'retry_wait');await fs.unlink(path.join(s.runtime,'leases','browser.json'));await s.controller.resolveResourceWaits([]);assert.equal(task.status,'pending');assert.equal(task.sessionId,SESSION);assert.equal(task.resourceWaitHistory.length,1);await s.controller.resolveResourceWaits([]);assert.equal(task.resourceWaitHistory.length,1);});
test('real permission denial, failed Product check and wrong resource owner do not become resource waits',async t=>{for(const change of [r=>r.blocker='Permission denied by provider',r=>r.checks.push({name:'Product',status:'FAIL',evidence:'real error'}),r=>r.checks[0].evidence='unknown owner']){const {s,task,r}=await arrange(t);change(r);assert.equal(await s.controller.recognizeResourceWait(task,r,[]),false);}const {s,task,r}=await arrange(t);await writeJson(path.join(s.runtime,'leases','browser.json'),{version:2,taskId:'other'});assert.equal(await s.controller.recognizeResourceWait(task,r,[]),false);});
test('unreaped or live original worker cannot be requeued',async t=>{const {s,task,r}=await arrange(t);task.lastWorkerReap.exactAbsence=false;assert.equal(await s.controller.recognizeResourceWait(task,r,[]),false);task.lastWorkerReap.exactAbsence=true;assert.equal(await s.controller.recognizeResourceWait(task,r,[{pid:42,createdAt:'2026-10-12T10:00:00Z'}]),false);});
