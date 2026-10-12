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

test('detached wrapper retains actual bootstrap stdout/stderr after parent file handles close', { timeout: 5000 }, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-bootstrap-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stdoutPath = path.join(directory, 'wrapper.stdout.txt'), stderrPath = path.join(directory, 'wrapper.stderr.txt');
  const child = await spawnDetachedLogged(process.execPath, ['-e', "process.stdout.write('fixture startup stdout\\n');process.stderr.write('fixture bootstrap error\\n');process.exitCode=19"],
    { cwd: directory, stdoutPath, stderrPath });
  child.ref();
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  const code = child.exitCode ?? await new Promise(resolve => child.once('close', resolve));
  assert.equal(code, 19);
  assert.equal(await fs.readFile(stdoutPath, 'utf8'), 'fixture startup stdout\n');
  assert.equal(await fs.readFile(stderrPath, 'utf8'), 'fixture bootstrap error\n');
});

test('captured pre-checkpoint bootstrap error becomes factual environment failure after owned process absence', async t => {
  const s = await fixture(t); await s.add(card()); await s.tick();
  let task = await s.get('n92');
  assert(task.attempt.wrapperStdoutPath.endsWith('wrapper.stdout.txt'));
  await fs.writeFile(task.attempt.wrapperStderrPath, "Resolve-Path : Cannot find path 'fixture-missing-path' because it does not exist.\n");
  await s.tick(); assert.equal((await s.get('n92')).status, 'running', 'startup grace remains unchanged');
  await s.add(card('n91')); s.time += 91000; await s.tick(); task = await s.get('n92');
  assert.equal(task.status, 'blocked'); assert.equal(task.failureClass, 'environment');
  assert.match(task.lastFailure, /before its first checkpoint/); assert.match(task.lastFailure, /stderr: Resolve-Path/);
  assert.equal(task.infrastructureRetries ?? 0, 0); assert.equal(task.implementationFailures ?? 0, 0);
  assert.equal((await s.get('n91')).status, 'running');
  assert.deepEqual(s.launches.map(value => value.taskId), ['n92', 'n91']);
});

test('pause marker keeps a fresh heartbeat and resumes without restarting the daemon', async t => {
  const s = await fixture(t); await s.add(card());
  await fs.writeFile(path.join(s.runtime, 'STOP-REFILL'), 'fixture pause'); await s.tick();
  assert.equal(s.launches.length, 0); const first = await readJson(path.join(s.runtime, 'ACTIVE_TASKS.json'));
  s.time += 30000; await s.tick(); const second = await readJson(path.join(s.runtime, 'ACTIVE_TASKS.json'));
  assert.equal(second.paused, true); assert.notEqual(first.at, second.at);
  await fs.rm(path.join(s.runtime, 'STOP-REFILL')); await s.tick();
  assert.equal(s.launches.length, 1); assert.equal((await s.get('n92')).status, 'running');
});

test('historic catalog/queue cards are never replayed; activated catalog grows without PM or restart', async t => {
  const s = await fixture(t); await s.add(card('legacy', { activationId: 'old', status: 'done' }));
  await writeJson(path.join(s.runtime, 'intake-catalog.json'), { tasks: [card('old-catalog', { activationId: 'old' }), card()] });
  await s.tick(); assert.deepEqual(s.launches.map(x => x.taskId), ['n92']);
  await writeJson(path.join(s.runtime, 'intake-catalog.json'), { tasks: [card(), card('n91')] });
  await s.tick(); assert.equal((await s.get('n91')).status, 'pending'); assert.equal(await s.get('old-catalog'), null);
});

test('a restarted controller adopts the exact running wrapper/session, without a duplicate worker', async t => {
  const s = await fixture(t); await s.add(card()); await s.tick(); let task = await s.get('n92');
  const born = new Date(s.time).toISOString();
  await writeJson(task.attempt.checkpointPath, { taskId: task.id, runId: task.attempt.runId, runnerPid: task.runnerPid, runnerCreatedAt: born, heartbeatAt: born });
  await fs.writeFile(task.attempt.jsonlPath, JSON.stringify({ type: 'thread.started', thread_id: SESSION }) + '\n');
  s.processes = [{ pid: task.runnerPid, parentPid: 1, name: 'powershell.exe', createdAt: born,
    commandLine: `powershell.exe -File run-task.ps1 -TaskFile "${path.join(s.runtime, 'queue', task.id + '.json')}" -AttemptFile "${task.attempt.specPath}"` }];
  s.controller = await s.restart(); await s.tick(); task = await s.get('n92');
  assert.equal(task.sessionId, SESSION); assert.equal(task.status, 'running'); assert.equal(s.launches.length, 1);
});

test('PID reuse is not worker ownership; a living exact Codex child is still retained after its wrapper dies', async t => {
  const s = await fixture(t); await s.add(card()); await s.tick(); let task = await s.get('n92');
  const born = new Date(s.time).toISOString(), later = new Date(s.time + 1000).toISOString();
  const checkpoint = { taskId: task.id, runId: task.attempt.runId, runnerPid: task.runnerPid, runnerCreatedAt: born, codexPid: 999, codexCreatedAt: born, sessionId: SESSION };
  await writeJson(task.attempt.checkpointPath, checkpoint);
  const unrelated = { pid: task.runnerPid, name: 'powershell.exe', createdAt: later, parentPid: 1, commandLine: 'unrelated command' };
  assert.equal(identityMatches(unrelated, { pid: task.runnerPid, createdAt: born }), false);
  s.processes = [unrelated, { pid: 999, name: 'codex.exe', createdAt: born, parentPid: task.runnerPid, commandLine: 'codex exec' }];
  s.time += 100000; await s.tick(); assert.equal((await s.get('n92')).status, 'running'); assert.equal(s.launches.length, 1);
  s.processes = [unrelated]; await s.tick(); task = await s.get('n92'); assert.equal(task.status, 'retry_wait'); assert.equal(task.sessionId, SESSION);
  s.time += 20000; await s.tick(); assert.equal(s.launches.length, 2); assert.equal(s.launches[1].sessionId, SESSION);
});

test('quota backoff survives a restart and permits only the saved-session recovery probe', async t => {
  const s = await fixture(t); await s.add(card()); await s.add(card('n91')); await s.tick();
  await s.finish('n92', null, { exitCode: 1, error: 'You have hit your usage limit. Try again later.' }); await s.tick();
  let task = await s.get('n92'); assert.equal(task.failureClass, 'quota'); assert.equal(task.status, 'retry_wait');
  assert.equal(s.launches.length, 1); assert.equal((await s.get('n91')).status, 'pending');
  s.controller = await s.restart(); s.time = Date.parse(task.retryAt) - 1; await s.tick(); assert.equal(s.launches.length, 1);
  s.time += 2; await s.tick(); assert.equal(s.launches.length, 2); assert.equal(s.launches[1].sessionId, SESSION); assert.equal(s.launches[1].taskId, 'n92');
  assert.equal((await s.get('n92')).implementationFailures ?? 0, 0);
});

test('two actual implementation failures park one ticket and allow an unrelated card', async t => {
  const s = await fixture(t); await s.add(card()); await s.tick();
  const blocked = task => result(task, { state: 'BLOCKED', candidateSha: null, blockerType: 'implementation', blocker: 'Fixture compiler error' });
  await s.finish('n92', blocked); await s.tick(); let task = await s.get('n92'); assert.equal(task.implementationFailures, 1);
  s.time = Date.parse(task.retryAt) + 1; await s.tick(); assert.equal(s.launches.length, 2);
  await s.add(card('n91')); await s.finish('n92', blocked); await s.tick();
  task = await s.get('n92'); assert.equal(task.status, 'blocked'); assert.equal(task.implementationFailures, 2);
  assert.equal((await s.get('n91')).status, 'running'); assert.equal(s.launches.length, 3);
});

test('an attempt result from another run never becomes a candidate', async t => {
  const s = await fixture(t); await s.add(card()); await s.tick();
  await s.finish('n92', task => result(task, { runId: 'stale-run' })); await s.tick();
  assert.equal((await s.get('n92')).status, 'blocked'); assert.equal(s.publishes.length, 0);
});

test('pending publication retains its lane; observed production frees capacity without Product closure', async t => {
  let mode = 'pending';
  const s = await fixture(t, { publisher: async options => {
    s.publishes.push(options); return mode === 'pending' ? { status: 'pending', retryable: true, retryAfterSeconds: 20, errorCode: 'PROVIDER_PENDING' }
      : deployed({ id: options.taskId, productId: options.ticketId, candidateSha: options.candidateSha, baseSha: options.baseSha });
  } });
  await s.add(card()); await s.add(card('n91', { dependsOn: ['n92'] })); await s.tick();
  await s.finish('n92', result); await s.tick(); await new Promise(resolve => setImmediate(resolve)); await s.tick();
  assert.equal((await s.get('n92')).status, 'delivery'); assert.equal(s.launches.length, 1);
  await s.add(card('later-delivery', { status: 'delivery', candidateSha: CANDIDATE, baseSha: BASE, worktreePath: s.runtime, deliveryQueuedAt: new Date(s.time + 1).toISOString(), nextDeliveryAt: new Date(s.time).toISOString() }));
  await s.tick(); assert.equal(s.publishes.length, 1, 'later delivery must not overtake the waiting provider');
  mode = 'deployed'; s.time += 21000; await s.tick(); await new Promise(resolve => setImmediate(resolve)); await s.tick();
  const done = await s.get('n92'); assert.equal(done.status, 'awaiting_po'); assert.notEqual(done.status, 'closed');
  assert.equal((await s.get('n91')).status, 'running'); assert.equal(s.launches.length, 2);
});

test('a crash between publication and queue update recovers delivery only, never reruns Codex', async t => {
  const s = await fixture(t, { publisher: async opts => { s.publishes.push(opts); return deployed({ id: opts.taskId, productId: opts.ticketId, candidateSha: opts.candidateSha, baseSha: opts.baseSha }); } });
  await s.add(card('n92', { status: 'delivery', candidateSha: CANDIDATE, baseSha: BASE, worktreePath: s.runtime, nextDeliveryAt: new Date(s.time).toISOString() }));
  await s.tick(); await new Promise(resolve => setImmediate(resolve));
  s.controller = await s.restart(); await s.tick(); await new Promise(resolve => setImmediate(resolve)); await s.tick();
  assert.equal((await s.get('n92')).status, 'awaiting_po'); assert.equal(s.launches.length, 0);
  assert.equal(s.publishes.length, 2, 'journal-aware adapter is re-observed; its own tests prove push idempotence');
});

test('production proof is bound to the candidate and changed Product assets', () => {
  const task = card('n92', { candidateSha: CANDIDATE, baseSha: BASE }); const good = deployed(task);
  assert.equal(verifiedDeployment(task, good), true);
  assert.equal(verifiedDeployment(task, { ...good, candidateSha: BASE }), false);
  assert.equal(verifiedDeployment(task, { ...good, productSourceChangeObserved: false }), false);
  assert.equal(verifiedDeployment(task, { ...good, binding: { ...good.binding, candidateAncestorOfPublished: false } }), false);
  assert.equal(verifiedDeployment(task, { ...good, evidence: { ...good.evidence, production: { ...good.evidence.production, origin: 'https://other.example' } } }), false);
  const asset = { repoPath: 'index.html', urlPath: 'index.html', statusCode: 200, verified: true, expectedSha256: HASH, observedSha256: 'b'.repeat(64), normalization: 'cloudflare-jsd-v1', normalizedSha256: HASH };
  assert.equal(verifiedDeployment(task, { ...good, evidence: { ...good.evidence, production: { ...good.evidence.production, assets: [asset] } } }), true);
  assert.equal(verifiedDeployment(task, { ...good, evidence: { ...good.evidence, production: { ...good.evidence.production, assets: [{ ...asset, normalization: 'arbitrary-strip' }] } } }), false);
});

test('record-writing failure cannot turn a deployed ticket into another model run', async t => {
  let fail = true, records = 0;
  const s = await fixture(t, { records: { inspectProductEligibility: async () => ({ eligible: true }), recordProductTransition: async () => { records++; if (fail) throw new Error('Fixture temporary ledger lock'); } } });
  await s.add(card('n92', { status: 'awaiting_po', candidateSha: CANDIDATE, baseSha: BASE }));
  await s.tick(); assert.equal(s.launches.length, 0); assert.equal((await s.get('n92')).status, 'awaiting_po');
  const first = await readJson(path.join(s.runtime, 'ACTIVE_TASKS.json')); assert(first.issues.some(i => i.code === 'PRODUCT_RECORD_UPDATE_FAILED'));
  fail = false; await s.tick(); await s.tick(); assert.equal(records, 2); assert.equal(s.launches.length, 0);
});

test('new CLOSED/DEFERRED product status prevents new execution; canonical closure updates awaiting_po only', async t => {
  const s = await fixture(t, { records: { inspectProductEligibility: async (_repo, id) => id === 'N92' ? { eligible: false, closed: true, reason: 'Canonical Closed ledger' } : { eligible: false, reason: 'Deferred' } } });
  await s.add(card('n92', { status: 'awaiting_po' })); await s.add(card('n91')); await s.tick();
  assert.equal((await s.get('n92')).status, 'closed'); assert.equal((await s.get('n91')).status, 'blocked'); assert.equal(s.launches.length, 0);
});

test('unavailable process inventory never launches a duplicate and still writes a live issue', async t => {
  let available = true;
  const s = await fixture(t, { inventory: async () => { if (!available) throw new Error('Fixture CIM failure'); return []; } });
  await s.add(card()); available = false; await s.tick(); assert.equal(s.launches.length, 0);
  const snapshot = await readJson(path.join(s.runtime, 'ACTIVE_TASKS.json')); assert.equal(snapshot.processInventoryKnown, false);
  available = true; await s.tick(); assert.equal(s.launches.length, 1);
});

test('malformed checkpoint parks only its ended attempt instead of an infinite running state', async t => {
  const s = await fixture(t); await s.add(card()); await s.tick(); const task = await s.get('n92');
  await fs.writeFile(task.attempt.checkpointPath, '{fixture broken JSON'); s.time += 91000;
  await s.add(card('n91')); await s.tick();
  const broken = await s.get('n92'); assert.equal(broken.status, 'blocked'); assert.equal(broken.failureClass, 'environment');
  assert.match(broken.lastFailure, /Invalid attempt checkpoint/); assert.equal((await s.get('n91')).status, 'running');
});

test('a descendant remains owned after Codex exits; a child of a reused PID is excluded', () => {
  const began = '2026-10-12T12:00:00Z', exited = '2026-10-12T12:02:00Z';
  const task = { __file: '/fixture/queue/task.json', attempt: { runId: 'run', specPath: '/fixture/attempt.json', outputPath: '/fixture/result.json', startedAt: began } };
  const checkpoint = { codexPid: 55, codexCreatedAt: began, codexExitedAt: exited };
  const browser = { pid: 66, parentPid: 55, createdAt: '2026-10-12T12:01:00Z', name: 'chrome.exe', commandLine: 'owned synthetic browser' };
  assert.deepEqual(workerProcesses(task, checkpoint, [browser]).map(x => x.pid), [66]);
  const replacement = { pid: 55, parentPid: 1, createdAt: '2026-10-12T12:01:30Z', name: 'other.exe', commandLine: 'unrelated' };
  const unrelated = { ...browser, pid: 77, createdAt: '2026-10-12T12:01:40Z' };
  assert.deepEqual(workerProcesses(task, checkpoint, [replacement, unrelated]), []);
});

test('local watchdog stops only proven owned identities, saves absence, resumes once and then parks', async t => {
  const stops = [];
  const s = await fixture(t, { fingerprint: async () => 'same-scoped-files', terminate: async identities => { stops.push(identities); s.processes = []; return { owners: identities, results: identities.map(x => ({ pid: x.pid, stopped: true })) }; } });
  await s.add(card('n92', { executionMode: 'local', budgetMinutes: 1, idleMinutes: 0.5 })); await s.tick();
  const makeLive = async () => {
    const task = await s.get('n92'), born = new Date(s.time).toISOString();
    await writeJson(task.attempt.checkpointPath, { taskId: task.id, runId: task.attempt.runId, runnerPid: task.runnerPid, runnerCreatedAt: born, sessionId: SESSION, heartbeatAt: born });
    s.processes = [{ pid: task.runnerPid, parentPid: 1, createdAt: born, name: 'powershell.exe', commandLine: `run-task.ps1 ${path.join(s.runtime, 'queue', task.id + '.json')} ${task.attempt.specPath}` }];
    await s.tick(); return task;
  };
  await makeLive(); s.time += 61000; await s.tick();
  assert.equal(stops.length, 1); assert.equal(stops[0].length, 1); assert.equal((await s.get('n92')).status, 'running', 'wait for the next actual inventory before freeing capacity');
  s.time += 30000; await s.tick(); let task = await s.get('n92'); assert.equal(task.status, 'retry_wait'); assert.equal(task.implementationFailures, 1);
  assert.equal(task.lastWorkerReap.exactAbsence, true); assert(task.lastWorkerReap.owners.some(x => x.pid === stops[0][0].pid));
  s.time = Date.parse(task.retryAt) + 1; await s.tick(); assert.equal(s.launches[1].sessionId, SESSION);
  await makeLive(); s.time += 91000; await s.tick(); await s.tick(); task = await s.get('n92');
  assert.equal(task.status, 'blocked'); assert.equal(task.implementationFailures, 2); assert.equal(stops.length, 2);
});

test('a heartbeat is not useful progress; the watchdog is disabled for live data work', () => {
  const start = '2026-10-12T12:00:00Z', clock = Date.parse(start) + 600000;
  const task = { executionMode: 'synthetic', budgetMinutes: 45, idleMinutes: 8, attempt: { startedAt: start }, lastEventAt: start, lastFileProgressAt: start, heartbeatAt: new Date(clock).toISOString() };
  assert.match(watchdogReason(task, clock), /No JSON event/);
  assert.equal(watchdogReason({ ...task, lastFileProgressAt: new Date(clock - 1000).toISOString() }, clock), null);
  assert.equal(watchdogReason({ ...task, liveAuthorizationRef: 'exact authorized data operation' }, clock), null);
  assert.equal(watchdogReason({ ...task, executionMode: 'live' }, clock), null);
});

test('real isolated Git verification rejects out-of-scope files and a stale declared HEAD', async t => {
  const s = await fixture(t); const repo = path.join(s.runtime, 'fixture-git'); await fs.mkdir(path.join(repo, 'src'), { recursive: true });
  const git = async args => { const r = await runCommand('git', args, { cwd: repo }); assert.equal(r.code, 0, r.stderr); return r.stdout.trim(); };
  await git(['init', '--quiet']); await fs.writeFile(path.join(repo, 'src', 'n92.js'), 'export const value = 1;\n'); await git(['add', '.']);
  const identity = ['-c', 'user.name=Isolated test', '-c', 'user.email=test@example.invalid']; await git([...identity, 'commit', '--quiet', '-m', 'fixture base']); const base = await git(['rev-parse', 'HEAD']);
  await fs.writeFile(path.join(repo, 'src', 'n92.js'), 'export const value = 2;\n'); await git(['add', '.']); await git([...identity, 'commit', '--quiet', '-m', 'fixture change']); const candidate = await git(['rev-parse', 'HEAD']);
  const task = card('n92', { worktreePath: repo, baseSha: base, attempt: { runId: 'fixture' } });
  const receipt = result(task, { baseSha: base, candidateSha: candidate, worktreePath: repo });
  s.controller.validateAdapter = null;
  assert.equal((await s.controller.validate(task, receipt)).candidateSha, candidate);
  await assert.rejects(s.controller.validate({ ...task, requiredChecks: ['scope', 'syntax'] }, receipt), /Required affected checks/);
  const checked = { ...receipt, checks: [{ name: 'scope', status: 'PASS', evidence: 'Exact fixture diff' }, { name: 'syntax', status: 'PASS', evidence: 'Fixture JS parsed' }] };
  assert.equal((await s.controller.validate({ ...task, requiredChecks: ['scope', 'syntax'] }, checked)).candidateSha, candidate);
  await assert.rejects(s.controller.validate(task, { ...receipt, candidateSha: base }), /actual candidate HEAD/);
  await assert.rejects(s.controller.validate({ ...task, allowedPaths: ['src/unrelated.js'] }, receipt), /outside this approved card/);
});

test('Windows wrappers retain exact-session mode and do not alter queue files (static contract only)', async () => {
  const wrapper = await fs.readFile(new URL('../run-task.ps1', import.meta.url), 'utf8');
  assert(wrapper.includes("$arguments.Add('resume')")); assert(wrapper.includes('sandbox_mode=danger-full-access'));
  assert(wrapper.includes("$arguments.Add('--sandbox')")); assert(wrapper.includes('approval_policy=never'));
  assert(!wrapper.includes('--approve-for-me')); assert(!wrapper.includes('--last')); assert(wrapper.includes('FileShare]::ReadWrite'));
  assert(wrapper.includes('$start.WorkingDirectory')); assert(!wrapper.includes('Save-Task'));
  const launcher = await fs.readFile(new URL('../start-ops.ps1', import.meta.url), 'utf8');
  assert(launcher.includes('& $NodePath $script')); assert(launcher.includes('exit $LASTEXITCODE')); assert(!launcher.includes('Start-Process'));
});
