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


import {createHash} from 'node:crypto';
async function note(s,id,status='OPEN',badHash=false){
 const c=card(id,{requiredChecks:['one'],executionMode:'local',liveMutation:false});
 const content=JSON.stringify({version:1,activationId:ACTIVATION,tasks:[c]});const file=id+'-note.json';
 await fs.mkdir(path.join(s.runtime,'docs'),{recursive:true});await fs.mkdir(path.join(s.runtime,'scripts/ops-supervisor-v4'),{recursive:true});
 await fs.writeFile(path.join(s.runtime,'scripts/ops-supervisor-v4',file),content);
 const digest=badHash?'0'.repeat(64):createHash('sha256').update(content).digest('hex');
 const row='| '+c.productId+' | 2026-10-14 | 2026-10-14 | area | fix | note | '+status+' | high | low | PO | [[OPS_TASK:'+file+':'+digest+']] |';
 await fs.appendFile(path.join(s.runtime,'docs/PRODUCT_LEDGER.md'),row+'\n');return c;
}
test('a new approved open note is admitted and starts without a catalog edit or chat',async t=>{const s=await fixture(t);await note(s,'n90');await s.tick();assert.equal(s.launches.length,1);assert.equal((await s.get('n90')).status,'running');assert.equal((await readJson(path.join(s.runtime,'ACTIVE_TASKS.json'))).notesCheckedAt,new Date(s.time).toISOString());});
test('periodic reread finds next note and awaitingPO does not block it',async t=>{const s=await fixture(t);await note(s,'n90');await s.tick();const first=await s.get('n90');first.status='awaiting_po';first.runnerPid=null;first.brokerPid=null;first.candidateSha=CANDIDATE;first.deliveryReceipt=deployed(first);await s.add(first);await note(s,'n44');s.time+=61000;await s.tick();assert.equal((await s.get('n44')).status,'running');assert.equal((await s.get('n90')).status,'awaiting_po');assert.equal(s.launches.length,2);});
test('closed/deferred/frozen notes never become executable',async t=>{const s=await fixture(t);for(const [id,status]of [['n23','CLOSED'],['n78','FROZEN'],['n93','DEFERRED']])await note(s,id,status);await s.tick();assert.equal(s.launches.length,0);assert.equal(s.controller.jobs.length,0);});
test('changed unapproved source and bare missing spec are reported, not silently executed',async t=>{const s=await fixture(t);await note(s,'n90','OPEN',true);await fs.appendFile(path.join(s.runtime,'docs/PRODUCT_LEDGER.md'),'| N88 | 2026-10-14 | 2026-10-14 | area | feature | open note | OPEN | high | high | PO | no prepared source |\n');await s.tick();assert.equal(s.launches.length,0);assert(s.controller.issues.some(x=>x.code==='APPROVED_NOTE_UNAVAILABLE'));assert(s.controller.unassignedNotes.includes('N88'));});
test('same blocked note preserves its session/candidate, never paid-retries without material change',async t=>{const s=await fixture(t);const c=await note(s,'n58');await s.add({...c,status:'blocked',sessionId:SESSION,candidateSha:CANDIDATE,lastFailure:'Actual external condition'});await note(s,'n44');await s.tick();assert.equal((await s.get('n58')).status,'blocked');assert.equal((await s.get('n58')).sessionId,SESSION);assert.equal((await s.get('n44')).status,'running');assert.equal(s.launches.length,1);});
test('STOP prevents new note dispatch',async t=>{const s=await fixture(t);await note(s,'n90');await fs.writeFile(path.join(s.runtime,'STOP'),'PO stop');await s.tick();assert.equal(s.launches.length,0);assert.equal(s.controller.jobs.length,0);});
