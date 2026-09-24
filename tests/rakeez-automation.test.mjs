import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rakeez.mjs');

function run(file, args, cwd) {
  return spawnSync(file, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 15_000 });
}

function git(repo, ...args) {
  const result = run('git', ['-C', repo, ...args]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function cli(repo, ...args) {
  return run(process.execPath, [script, ...args, '--repo', repo]);
}

function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), 'rakeez-automation-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'qa@example.invalid');
  git(repo, 'config', 'user.name', 'Synthetic QA');
  mkdirSync(join(repo, 'supabase', 'migrations'), { recursive: true });
  writeFileSync(join(repo, 'supabase', 'migrations', '0001_base.sql'), 'select 1;\n');
  git(repo, 'add', 'supabase/migrations/0001_base.sql');
  git(repo, 'commit', '-qm', 'synthetic base');
  return { repo, base: git(repo, 'rev-parse', 'HEAD') };
}

test('doctor reports repository/tool availability without secrets', () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = cli(repo, 'doctor');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.match(report.sha, /^[a-f0-9]{40}$/);
  assert.equal(typeof report.optional.supabaseCli, 'boolean');
  assert.equal(typeof report.optional.browserBinary, 'boolean');
  assert.doesNotMatch(result.stdout, /password|refresh_token|access_token/i);
});

test('repository skills have valid minimal frontmatter', () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const name of ['rakeez-ticket-router', 'rakeez-evidence-manifest', 'rakeez-beta-readiness-auditor']) {
    const content = readFileSync(join(repo, '.agents', 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(content, new RegExp(`^---\\r?\\nname: ${name}\\r?\\ndescription: [^\\r\\n]+\\r?\\n---\\r?\\n`));
    assert.doesNotMatch(content, /\[TODO:/);
  }
});

test('preflight accepts a clean exact SHA and rejects dirt or wrong HEAD', (t) => {
  const { repo, base } = fixture(t);
  const options = ['preflight', '--base', base, '--candidate', base, '--remote', 'off'];
  let result = cli(repo, ...options);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
  writeFileSync(join(repo, 'scratch.txt'), 'local evidence\n');
  result = cli(repo, ...options);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).dirty, true);
  rmSync(join(repo, 'scratch.txt'));
  writeFileSync(join(repo, 'new.txt'), 'candidate\n');
  git(repo, 'add', 'new.txt');
  git(repo, 'commit', '-qm', 'candidate');
  result = cli(repo, ...options);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).headMatchesCandidate, false);
});

test('preflight blocks changes to an existing migration but allows a new one', (t) => {
  const { repo, base } = fixture(t);
  writeFileSync(join(repo, 'supabase', 'migrations', '0002_new.sql'), 'select 2;\n');
  git(repo, 'add', 'supabase/migrations/0002_new.sql');
  git(repo, 'commit', '-qm', 'additive migration');
  const additive = git(repo, 'rev-parse', 'HEAD');
  let result = cli(repo, 'preflight', '--base', base, '--candidate', additive, '--remote', 'off');
  assert.equal(result.status, 0, result.stderr);
  writeFileSync(join(repo, 'supabase', 'migrations', '0001_base.sql'), 'select 99;\n');
  git(repo, 'add', 'supabase/migrations/0001_base.sql');
  git(repo, 'commit', '-qm', 'change old migration');
  const modified = git(repo, 'rev-parse', 'HEAD');
  result = cli(repo, 'preflight', '--base', base, '--candidate', modified, '--remote', 'off');
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).changedExistingMigrations.length, 1);
});

test('preflight treats renaming an applied migration as a change', (t) => {
  const { repo, base } = fixture(t);
  git(repo, 'mv', 'supabase/migrations/0001_base.sql', 'supabase/migrations/0002_renamed.sql');
  git(repo, 'commit', '-qm', 'rename applied migration');
  const candidate = git(repo, 'rev-parse', 'HEAD');
  const result = cli(repo, 'preflight', '--base', base, '--candidate', candidate, '--remote', 'off');
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).changedExistingMigrations.length, 1);
});

test('evidence manifests are deterministic and reject unapproved fields', (t) => {
  const { repo, base } = fixture(t);
  writeFileSync(join(repo, 'z.txt'), 'z\n');
  writeFileSync(join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', 'z.txt', 'a.txt');
  git(repo, 'commit', '-qm', 'synthetic candidate');
  const candidate = git(repo, 'rev-parse', 'HEAD');
  const input = join(repo, 'input.json');
  writeFileSync(input, JSON.stringify({ tests: [{ name: 'focused', status: 'PASS', passed: 2, failed: 0, skipped: 0 }],
    build: 'NOT_RUN', productionVerification: 'PENDING' }));
  const options = ['evidence', '--ticket', '0295-test', '--base', base, '--candidate', candidate, '--input', input];
  let result = cli(repo, ...options);
  assert.equal(result.status, 0, result.stderr);
  const paths = JSON.parse(result.stdout);
  const json = readFileSync(paths.jsonPath, 'utf8');
  const md = readFileSync(paths.mdPath, 'utf8');
  assert.deepEqual(JSON.parse(json).changedFiles, ['a.txt', 'z.txt']);
  result = cli(repo, ...options);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(paths.jsonPath, 'utf8'), json);
  assert.equal(readFileSync(paths.mdPath, 'utf8'), md);
  writeFileSync(input, JSON.stringify({ token: 'do-not-copy' }));
  result = cli(repo, ...options);
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stderr, /do-not-copy/);
});
