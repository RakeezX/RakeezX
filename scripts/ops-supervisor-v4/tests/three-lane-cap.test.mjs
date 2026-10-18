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
  const adapters = { testOnly: true, records: {}, now: () => state.time, inventory: async () => state.processes,
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


test('five independent workers use the approved cap and sixth remains pending',async t=>{
 const s=await fixture(t); const f=path.join(s.runtime,'workflow-v5.json'); const c=await readJson(f);c.maxWorkers=5;await writeJson(f,c);
 for(const id of ['n77','n71','n58','n99','n88','n90'])await s.add(card(id,{allowedPaths:['src/'+id+'.js']}));
 await s.tick();assert.equal(s.launches.length,5);assert.equal((await s.get('n99')).status,'pending');
 assert.equal((await readJson(path.join(s.runtime,'ACTIVE_TASKS.json'))).supportedMaxWorkers,5);
});
test('five-worker cap still serializes intersecting paths',async t=>{
 const s=await fixture(t);const f=path.join(s.runtime,'workflow-v5.json');const c=await readJson(f);c.maxWorkers=5;await writeJson(f,c);
 await s.add(card('n77',{priority:1,allowedPaths:['src/store.js']}));await s.add(card('n58',{priority:2,allowedPaths:['src/store.js']}));await s.add(card('n71',{priority:3,allowedPaths:['src/styles/app.css']}));
 await s.tick();assert.equal(s.launches.length,2);assert.equal((await s.get('n58')).status,'pending');
});
test('four workers are accepted within the approved cap',async t=>{const s=await fixture(t);const f=path.join(s.runtime,'workflow-v5.json');const c=await readJson(f);c.maxWorkers=4;await writeJson(f,c);await s.controller.loadConfig();assert.equal(s.controller.config.maxWorkers,4);});
test('unapproved and noninteger capacity remain rejected',async t=>{const s=await fixture(t);const f=path.join(s.runtime,'workflow-v5.json');for(const n of [0,6,8,-1,2.5,null]){const c=await readJson(f);c.maxWorkers=n;await writeJson(f,c);await assert.rejects(s.controller.loadConfig(),/maxWorkers/);}});
test('five-worker capacity retains one publisher and the oldest delivery lane',async t=>{
 const s=await fixture(t);const f=path.join(s.runtime,'workflow-v5.json');const c=await readJson(f);c.maxWorkers=5;await writeJson(f,c);
 for(const [id,offset] of [['n77',0],['n88',1]])await s.add(card(id,{status:'delivery',candidateSha:CANDIDATE,baseSha:BASE,worktreePath:s.runtime,deliveryQueuedAt:new Date(s.time+offset).toISOString(),nextDeliveryAt:new Date(s.time).toISOString()}));
 await s.tick();await new Promise(resolve=>setImmediate(resolve));await s.tick();await s.tick();
 assert.equal(s.publishes.length,1);assert.equal(s.publishes[0].taskId,'n77');assert.equal((await s.get('n88')).status,'delivery');
});
