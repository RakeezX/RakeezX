import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Controller, runCommand, readJson, writeJson } from '../scripts/ops-supervisor-v4/controller.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const now = Date.parse('2026-10-13T01:00:00Z');
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ops-base-recovery-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'candidate'), remote = path.join(dir, 'published.git'), runtime = path.join(dir, 'runtime');
  await fs.mkdir(repo); await fs.mkdir(runtime); git(dir, 'init', '--bare', remote); git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'ops-test@example.invalid'); git(repo, 'config', 'user.name', 'Ops fixture');
  git(repo, 'config', 'core.autocrlf', 'false'); git(repo, 'remote', 'add', 'origin', remote);
  await fs.mkdir(path.join(repo, 'src')); await fs.mkdir(path.join(repo, 'docs'));
  await fs.writeFile(path.join(repo, 'src/product.mjs'), 'export const value = 0;\n');
  await fs.writeFile(path.join(repo, 'docs/main.txt'), 'original main\n');
  git(repo, 'add', '.'); git(repo, 'commit', '-m', 'original baseline'); const oldBase = git(repo, 'rev-parse', 'HEAD');
  await fs.writeFile(path.join(repo, 'docs/main.txt'), 'already published unrelated work\n');
  git(repo, 'commit', '-am', 'published intervening main'); const newBase = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'push', 'origin', 'main');
  await fs.writeFile(path.join(repo, 'src/product.mjs'), 'export const value = 1;\n');
  git(repo, 'commit', '-am', 'scoped candidate'); const candidate = git(repo, 'rev-parse', 'HEAD');
  const attemptDir = path.join(runtime, 'attempt'); await fs.mkdir(attemptDir); await fs.mkdir(path.join(runtime, 'queue'));
  const task = { id: 'saved-card', productId: 'N94', activationId: 'active', status: 'retry_wait', baseSha: oldBase,
    candidateSha: oldBase, worktreePath: repo, allowedPaths: ['src/product.mjs'], requiredChecks: ['affected'],
    sessionId: 'same-session', releaseAuthority: 'existing-authorization', implementationFailures: 1,
    failureClass: 'implementation', lastFailure: 'Candidate validation: Candidate identity/base/worktree mismatch',
    retryAt: new Date(now - 1000).toISOString(), runnerPid: null, brokerPid: null, ownedProcesses: [],
    __file: path.join(runtime, 'queue', 'saved-card.json'),
    attempt: { runId: 'same-run', startedAt: '2026-10-13T00:00:00Z', outputPath: path.join(attemptDir, 'result.json'),
      checkpointPath: path.join(attemptDir, 'checkpoint.json'), jsonlPath: path.join(attemptDir, 'events.jsonl') },
    lastWorkerReap: { activationId: 'active', runId: 'same-run', exactAbsence: true,
      owners: Array.from({ length: 8 }, (_, n) => ({ pid: 7000 + n, createdAt: '2026-10-13T00:00:01.000Z', observedAt: '2026-10-13T00:10:00.000Z' })) } };
  const result = { taskId: task.id, runId: task.attempt.runId, state: 'LOCAL_READY', candidateSha: candidate,
    baseSha: newBase, worktreePath: repo, changedPaths: ['src/product.mjs'],
    checks: [{ name: 'affected', status: 'PASS', evidence: 'original completed Product evidence' }],
    summary: 'original unchanged result', blockerType: 'none', blocker: null, nextAction: null };
  const resultBytes = Buffer.from(JSON.stringify(result, null, 2) + '\n'); await fs.writeFile(task.attempt.outputPath, resultBytes);
  await writeJson(task.attempt.checkpointPath, { taskId: task.id, runId: task.attempt.runId, sessionId: task.sessionId,
    runnerPid: 7000, runnerCreatedAt: task.lastWorkerReap.owners[0].createdAt, finishedAt: '2026-10-13T00:10:00Z', exitCode: 0 });
  const controller = new Controller({ repo, runtime }, { now: () => now, inventory: async () => [], testOnly: true });
  controller.config = { maxWorkers: 2, controller: { remote: 'origin', branch: 'main', activationId: 'active' } };
  controller.identity = { pid: process.pid, instanceId: 'test-controller', createdAt: new Date(now).toISOString() };
  await controller.save(task);
  return { dir, repo, remote, runtime, task, result, resultBytes, oldBase, newBase, candidate, controller };
}
function tickHarness(f) {
  const c = f.controller, observations = { launches: 0, publications: 0 };
  c.jobs = [f.task]; c.loadConfig = async () => {}; c.loadRecords = async () => {}; c.loadJobs = async () => {};
  c.importCatalog = async () => {}; c.syncRecords = async () => {}; c.reapFinishedLeases = async () => {};
  c.snapshot = async () => {}; c.launch = async () => { observations.launches++; throw Error('Unexpected worker launch'); };
  c.startDelivery = async task => { observations.publications++; c.deliveryInFlight = { taskId: task.id }; };
  return observations;
}

test('accepts only the scoped delta above actual published main and leaves task untouched until acceptance', async t => {
  const f = await fixture(t), before = structuredClone(f.task);
  const receipt = await f.controller.validate(f.task, f.result);
  assert.deepEqual(f.task, before); assert.equal(receipt.baseAdvance.from, f.oldBase);
  assert.equal(receipt.baseAdvance.to, f.newBase); assert.equal(receipt.baseAdvance.publishedMainSha, f.newBase);
  assert.deepEqual(receipt.changedPaths, ['src/product.mjs']);
  await f.controller.acceptCandidate(f.task, receipt);
  assert.equal(f.task.status, 'delivery'); assert.equal(f.task.baseSha, f.newBase);
  assert.equal(f.task.baseAdvanceHistory[0].from, f.oldBase); assert.equal(f.task.sessionId, before.sessionId);
  assert.deepEqual(f.task.attempt, before.attempt); assert.deepEqual(await fs.readFile(f.task.attempt.outputPath), f.resultBytes);
});

test('unchanged base retains the existing path with no remote query; untrusted host metadata is overwritten', async t => {
  const f = await fixture(t); f.task.baseSha = f.newBase; const commands = [];
  f.controller.command = async (cmd, args, options) => { commands.push(args[0]); return runCommand(cmd, args, options); };
  const receipt = await f.controller.validate(f.task, { ...f.result, baseAdvance: { from: 'forged' } });
  assert.equal(receipt.baseAdvance, null); assert(!commands.includes('fetch')); assert(!commands.includes('ls-remote'));
});

test('rejects wrong task/run/state, malformed hashes, failed or missing required checks, and false path evidence', async t => {
  const f = await fixture(t);
  for (const patch of [{ taskId: 'other' }, { runId: 'other' }, { state: 'BLOCKED' }, { baseSha: 'main' },
    { candidateSha: 'bad' }, { checks: [] }, { checks: [{ name: 'affected', status: 'FAIL' }] },
    { changedPaths: ['docs/main.txt'] }]) await assert.rejects(f.controller.validate(f.task, { ...f.result, ...patch }));
  assert.equal(f.task.baseSha, f.oldBase); assert.equal(f.task.status, 'retry_wait');
});

test('rejects a private base even when old→base→candidate ancestry and scoped delta are valid', async t => {
  const f = await fixture(t); git(f.repo, 'checkout', '-b', 'private', f.oldBase);
  await fs.writeFile(path.join(f.repo, 'docs/main.txt'), 'unpublished main-like change\n'); git(f.repo, 'commit', '-am', 'private base');
  const privateBase = git(f.repo, 'rev-parse', 'HEAD');
  await fs.writeFile(path.join(f.repo, 'src/product.mjs'), 'export const value = 2;\n'); git(f.repo, 'commit', '-am', 'private candidate');
  await assert.rejects(f.controller.validate(f.task, { ...f.result, baseSha: privateBase, candidateSha: git(f.repo, 'rev-parse', 'HEAD') }));
  assert.equal(f.task.baseSha, f.oldBase);
});

test('rejects scope escape, dirty worktree, and a candidate not based on the declared published main', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.repo, 'docs/main.txt'), 'escaped candidate edit\n'); git(f.repo, 'commit', '-am', 'scope escape');
  await assert.rejects(f.controller.validate(f.task, { ...f.result, candidateSha: git(f.repo, 'rev-parse', 'HEAD'), changedPaths: ['docs/main.txt', 'src/product.mjs'] }), /outside this approved card/);
  git(f.repo, 'reset', '--hard', f.candidate); await fs.writeFile(path.join(f.repo, 'untracked.txt'), 'not committed');
  await assert.rejects(f.controller.validate(f.task, f.result), /uncommitted/); await fs.rm(path.join(f.repo, 'untracked.txt'));
  git(f.repo, 'checkout', '-b', 'old-candidate', f.oldBase); await fs.writeFile(path.join(f.repo, 'src/product.mjs'), 'export const value = 3;\n'); git(f.repo, 'commit', '-am', 'old base candidate');
  await assert.rejects(f.controller.validate(f.task, { ...f.result, candidateSha: git(f.repo, 'rev-parse', 'HEAD') }));
});

test('full tick recovers exact saved result once, preserving all eight owners and bytes with no worker or Product test replay', async t => {
  const f = await fixture(t), observed = tickHarness(f), attempt = structuredClone(f.task.attempt), reap = structuredClone(f.task.lastWorkerReap);
  await f.controller.tick(); assert.equal(f.task.status, 'delivery'); assert.equal(observed.launches, 0);
  const saved = await readJson(f.task.__file); assert.equal(saved.baseSha, f.newBase); assert.equal(saved.implementationFailures, 0);
  assert.deepEqual(saved.attempt, attempt); assert.deepEqual(saved.lastWorkerReap, reap);
  assert.deepEqual(saved.baseAdvanceHistory[0].recovery.priorWorkerAbsence.owners, reap.owners);
  assert.equal(saved.baseAdvanceHistory[0].previousImplementationFailures, 1);
  assert.deepEqual(await fs.readFile(f.task.attempt.outputPath), f.resultBytes);
  await f.controller.tick(); assert.equal(observed.publications, 1); assert.equal(observed.launches, 0); assert.equal(f.task.baseAdvanceHistory.length, 1);
});

test('saved recovery waits behind normal active scope and exact old process identity, then resumes without launching', async t => {
  const f = await fixture(t), observed = tickHarness(f);
  const other = { id: 'overlapping-active', status: 'running', allowedPaths: ['src/product.mjs'] };
  f.controller.jobs.push(other); f.controller.reconcile = async () => {};
  await f.controller.tick(); assert.equal(f.task.status, 'retry_wait'); assert.equal(observed.launches, 0);
  f.controller.jobs = [f.task]; const owner = f.task.lastWorkerReap.owners[6];
  f.controller.inventory = async () => [{ ...owner, name: 'node.exe', commandLine: '', parentPid: 1 }];
  await f.controller.tick(); assert.equal(f.task.status, 'retry_wait'); assert(f.controller.issues.some(i => /still active/.test(i.message)));
  f.controller.inventory = async () => []; await f.controller.tick(); assert.equal(f.task.status, 'delivery'); assert.equal(observed.launches, 0);
});

test('blocked exact mismatch recovers, while another blocked failure and paused queues remain unchanged', async t => {
  const f = await fixture(t), observed = tickHarness(f); f.task.status = 'blocked'; f.task.retryAt = null;
  await fs.writeFile(path.join(f.runtime, 'STOP'), 'existing pause'); await f.controller.tick(); assert.equal(f.task.status, 'blocked');
  await fs.rm(path.join(f.runtime, 'STOP')); f.task.lastFailure = 'Candidate validation: Required affected checks have not passed: affected';
  await f.controller.tick(); assert.equal(f.task.status, 'blocked'); assert.equal(observed.launches, 0);
  f.task.lastFailure = 'Candidate validation: Candidate identity/base/worktree mismatch';
  await f.controller.tick(); assert.equal(f.task.status, 'delivery'); assert.equal(observed.launches, 0);
});
