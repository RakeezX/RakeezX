import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishCandidate } from './publisher.mjs';

// Deterministic adapter test only: no real repository, Git command, network,
// Product test, or Windows process is run. Root owns the native checkout proof.
test('Windows checkout argv and original Git failure survive without false main churn', async t => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'n54-publisher-preparation-'));
  t.after(() => fs.rm(scratch, { recursive: true, force: true }));
  const base = 'a'.repeat(40), candidate = 'b'.repeat(40);
  const calls = [];
  let releases = 0;
  const stderr = 'error: unable to create file docs/long-fixture-name.json: Filename too long\n';
  const success = value => ({ code: 0, stdout: Buffer.from(value ?? ''), stderr: Buffer.alloc(0) });
  const run = async (program, args, commandOptions) => {
    assert.equal(program, 'git', 'A failed checkout must not build, publish, or call the provider');
    calls.push({ args: [...args], cwd: commandOptions.cwd });
    let first = 0;
    while (args[first] === '-c') first += 2;
    const operation = args[first];
    if (operation === 'fetch' || operation === 'cat-file') return success();
    if (operation === 'ls-remote') return success(`${base}\trefs/heads/main\n`);
    if (operation === 'merge-base') return args[first + 2] === candidate && args[first + 3] === base
      ? { ...success(), code: 1 } : success();
    if (operation === 'worktree') {
      assert.deepEqual(args.slice(0, 2), ['-c', 'core.longpaths=true']);
      assert.equal(args[first + 1], 'add');
      return { code: 128, stdout: Buffer.alloc(0), stderr: Buffer.from(stderr) };
    }
    assert.fail(`Unexpected Git operation: ${operation}`);
  };
  const options = { ticketId: 'N54', taskId: 'synthetic-n54-preparation-failure',
    candidateSha: candidate, baseSha: base, cwd: scratch, stateDir: path.join(scratch, 'state'),
    repository: 'Fixture/Only', productionUrl: 'https://fixture.invalid', validationTier: 'FAST',
    acquireLease: async () => ({ owned: true }), releaseLease: async () => { releases++; } };
  const result = await publishCandidate(options, { run, platform: 'win32' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.errorCode, 'GIT_FAILED');
  assert.equal(result.retryable, false);
  assert.equal(result.operation, 'worktree add');
  assert.equal(result.exitCode, 128);
  assert.equal(result.stderr, stderr.trim());
  assert.match(result.message, /Filename too long/);
  assert.equal(result.publishedSha, null);
  const journalFile = path.join(options.stateDir, `${candidate}.journal.json`);
  const saved = JSON.parse(await fs.readFile(journalFile, 'utf8'));
  assert.equal(saved.stage, 'blocked');
  assert.equal(saved.prepareAttempt, 1);
  assert.equal(saved.errorCode, 'GIT_FAILED');
  assert.deepEqual(saved.errorDetails, { operation: 'worktree add', exitCode: 128, stderr: stderr.trim() });
  const callsBefore = calls.length;
  const repeated = await publishCandidate(options, { run, platform: 'win32' });
  assert.equal(repeated.errorCode, 'GIT_FAILED');
  assert.equal(repeated.stderr, stderr.trim());
  assert.equal(calls.length, callsBefore, 'Blocked journal must not create another checkout or spend attempts');
  assert.equal(JSON.parse(await fs.readFile(journalFile, 'utf8')).prepareAttempt, 1);
  assert.equal(calls.filter(call => call.args.includes('worktree')).length, 1);
  assert.equal(releases, 1);
});
