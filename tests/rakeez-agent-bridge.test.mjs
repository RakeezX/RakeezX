import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import {
  normalizePatchBytes,
  registerBridgeProcess,
  resolveTestProfiles,
  transitionState,
} from '../scripts/rakeez-agent-bridge.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BRIDGE = join(ROOT, 'scripts', 'rakeez-agent-bridge.mjs');

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
}

function write(repo, path, value) {
  const target = join(repo, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

function initRepo(root, { remote = false } = {}) {
  const repo = join(root, 'repo');
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'bridge-test@rakeezx.local');
  git(repo, 'config', 'user.name', 'Bridge Test');
  write(repo, 'README.md', 'base\n');
  git(repo, 'add', 'README.md');
  git(repo, 'commit', '-q', '-m', 'base');
  let bare = null;
  if (remote) {
    bare = join(root, 'remote.git');
    execFileSync('git', ['init', '-q', '--bare', bare], { windowsHide: true });
    git(repo, 'remote', 'add', 'origin', bare);
    git(repo, 'push', '-q', '-u', 'origin', 'main');
  }
  return { repo, bare, base: git(repo, 'rev-parse', 'HEAD') };
}

function candidateCommit(repo, path = 'src/views/example.js', value = 'export const value = 1;\n') {
  write(repo, path, value);
  git(repo, 'add', '--', path);
  git(repo, 'commit', '-q', '-m', `candidate ${path}`);
  return git(repo, 'rev-parse', 'HEAD');
}

function invoke(args, { expectFailure = false } = {}) {
  const result = spawnSync(process.execPath, [BRIDGE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  const output = JSON.parse(result.stdout || '{}');
  if (expectFailure) assert.notEqual(result.status, 0, result.stderr);
  else assert.equal(result.status, 0, output.error || result.stderr);
  return output;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('Work candidate creates an exact manifest and review package', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-work-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  const candidate = candidateCommit(repo);
  const handoffs = join(temp, 'handoffs');
  const output = invoke([
    'pack', 'WORK-01', '--root', handoffs, '--source-agent', 'work',
    '--source-repo', repo, '--base', base, '--allow', 'src/views/example.js',
    '--test-profile', 'teacher-center',
  ]);
  const dir = join(handoffs, 'WORK-01');
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.candidate_sha, candidate);
  assert.equal(manifest.base_sha, base);
  assert.deepEqual(manifest.changed_files, ['src/views/example.js']);
  assert.equal(manifest.patch_sha256, sha256(readFileSync(join(dir, 'candidate.patch'))));
  assert.equal(output.manifest.last_completed_gate, 'TRANSPORT_VALIDATED');
  for (const file of ['validation.json', 'REVIEW.md', 'HANDOFF_CODEX.md']) {
    assert.ok(readFileSync(join(dir, file), 'utf8').length > 20);
  }
});

test('Google intake reuses the transport guard and normalizes CRLF patch bytes', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-google-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  candidateCommit(repo, 'src/views/google.js', 'export const google = true;\n');
  const lfPatch = execFileSync('git', ['diff', '--binary', '--full-index', base, 'HEAD', '--'], { cwd: repo });
  git(repo, 'reset', '--hard', '-q', base);
  const sourcePatch = join(temp, 'google.patch');
  writeFileSync(sourcePatch, Buffer.from(lfPatch.toString('utf8').replace(/\n/g, '\r\n'), 'utf8'));
  const handoffs = join(temp, 'handoffs');
  const output = invoke([
    'pack', 'GOOGLE-01', '--root', handoffs, '--source-agent', 'google',
    '--source-repo', repo, '--base', base, '--patch', sourcePatch,
    '--allow', 'src/views/google.js', '--test-profile', 'default-ui',
  ]);
  const bytes = readFileSync(join(handoffs, 'GOOGLE-01', 'candidate.patch'));
  assert.equal(bytes.includes(Buffer.from('\r')), false);
  assert.match(bytes.toString('utf8'), /diff --git[\s\S]+export const google = true/);
  assert.equal(output.manifest.transport.dry_run, 'pass');
  assert.equal(output.manifest.transport.diff_check, 'pass');
});

test('approval is exact-candidate-bound and becomes stale after candidate change', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-approval-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  const candidate = candidateCommit(repo);
  const root = join(temp, 'handoffs');
  invoke(['pack', 'APPROVAL-01', '--root', root, '--source-agent', 'codex', '--source-repo', repo, '--base', base, '--allow', 'src/views/example.js']);
  const bad = invoke(['approve-local', 'APPROVAL-01', '--root', root, '--candidate', base], { expectFailure: true });
  assert.match(bad.error, /Candidate mismatch/);
  const approved = invoke(['approve-local', 'APPROVAL-01', '--root', root, '--candidate', candidate]);
  assert.equal(approved.state, 'PO_PRELIMINARY_APPROVED');
  write(repo, 'src/views/example.js', 'export const value = 2;\n');
  const status = invoke(['status', 'APPROVAL-01', '--root', root]);
  assert.equal(status.stale, true);
  assert.equal(status.po_status, 'STALE');
  assert.equal(status.validation_status, 'STALE');
});

test('forbidden paths, secrets, and allowlist escapes are rejected', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-security-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const first = initRepo(join(temp, 'forbidden'));
  candidateCommit(first.repo, '.env', 'TOKEN=not-a-real-secret\n');
  const forbidden = invoke(['pack', 'BAD-ENV', '--root', join(temp, 'h1'), '--source-agent', 'work', '--source-repo', first.repo, '--base', first.base, '--allow', '.env'], { expectFailure: true });
  assert.match(forbidden.error, /Forbidden handoff path/);
  assert.equal(existsSync(join(temp, 'h1', 'BAD-ENV', 'candidate.patch')), false);

  const second = initRepo(join(temp, 'allowlist'));
  candidateCommit(second.repo, 'src/a.js', 'export const a = 1;\n');
  candidateCommit(second.repo, 'src/b.js', 'export const b = 1;\n');
  const escaped = invoke(['pack', 'BAD-ALLOW', '--root', join(temp, 'h2'), '--source-agent', 'work', '--source-repo', second.repo, '--base', second.base, '--allow', 'src/a.js'], { expectFailure: true });
  assert.match(escaped.error, /non-allowlisted/i);

  const third = initRepo(join(temp, 'secret'));
  candidateCommit(third.repo, 'scripts/admin.txt', 'key=sb_secret_example_never_real\n');
  const secret = invoke(['pack', 'BAD-SECRET', '--root', join(temp, 'h3'), '--source-agent', 'codex', '--source-repo', third.repo, '--base', third.base, '--allow', 'scripts/admin.txt'], { expectFailure: true });
  assert.match(secret.error, /credential-like/);
});

test('validation and packaged bytes become stale independently', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-validation-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  candidateCommit(repo);
  const root = join(temp, 'handoffs');
  invoke(['pack', 'VALIDATION-01', '--root', root, '--source-agent', 'work', '--source-repo', repo, '--base', base, '--allow', 'src/views/example.js']);
  const validationPath = join(root, 'VALIDATION-01', 'validation.json');
  const validation = JSON.parse(readFileSync(validationPath, 'utf8'));
  validation.status = 'PASS';
  validation.candidate_fingerprint = 'wrong-candidate';
  writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`);
  const wrongEvidence = invoke(['status', 'VALIDATION-01', '--root', root]);
  assert.equal(wrongEvidence.stale, false);
  assert.equal(wrongEvidence.validation_status, 'STALE');
  validation.candidate_fingerprint = JSON.parse(readFileSync(join(root, 'VALIDATION-01', 'manifest.json'), 'utf8')).patch_sha256;
  validation.status = 'PASS';
  writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`);
  writeFileSync(join(root, 'VALIDATION-01', 'candidate.patch'), 'changed bytes\n');
  const status = invoke(['status', 'VALIDATION-01', '--root', root]);
  assert.equal(status.validation_status, 'STALE');
  assert.equal(JSON.parse(readFileSync(validationPath, 'utf8')).status, 'STALE');
});

test('resume reconciles commit, pushed state, and unexpected remote-main advance', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-resume-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp, { remote: true });
  const candidate = candidateCommit(repo);
  git(repo, 'push', '-q', 'origin', 'HEAD:refs/heads/candidate');
  const root = join(temp, 'handoffs');
  invoke(['pack', 'RESUME-01', '--root', root, '--source-agent', 'codex', '--source-repo', repo, '--base', base, '--allow', 'src/views/example.js', '--production-sha', base]);
  const first = invoke(['resume-info', 'RESUME-01', '--root', root]);
  assert.equal(first.git.commit_exists, true);
  assert.equal(first.git.pushed, true);
  assert.ok(first.git.containing_remotes.includes('origin/candidate'));
  assert.equal(first.recorded.candidate_sha, candidate);
  git(repo, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  const advanced = invoke(['resume-info', 'RESUME-01', '--root', root]);
  assert.equal(advanced.git.remote_main_advanced, true);
  assert.match(advanced.recommendation, /^STOP:/);
});

test('test profiles deduplicate suites and build exactly once', () => {
  const config = {
    build_command: 'build-once',
    diff_check_command: 'diff-once',
    profiles: {
      a: { unit: ['one', 'shared'], browser: ['browser'], review: ['mobile'] },
      b: { unit: ['shared', 'two'], browser: ['browser'], review: ['desktop'], strict: true },
    },
  };
  const plan = resolveTestProfiles(['a', 'b'], config);
  assert.deepEqual(plan.unit, ['one', 'shared', 'two']);
  assert.deepEqual(plan.browser, ['browser']);
  assert.equal(plan.commands.filter((value) => value === 'build-once').length, 1);
  assert.equal(plan.commands.filter((value) => value === 'diff-once').length, 1);
  assert.equal(plan.strict, true);
});

test('process registry reports bridge-owned trees without killing them', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'bridge-process-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  registerBridgeProcess(root, {
    ticket: 'PROCESS-01', pid: process.pid, parentPid: process.ppid,
    command: 'node focused-test.mjs', port: 5173, owner: 'rakeez-agent-bridge-test',
  });
  const report = invoke(['processes', '--root', root]);
  assert.equal(report.auto_kill, false);
  assert.equal(report.processes.length, 1);
  assert.equal(report.processes[0].active, true);
  assert.match(report.processes[0].suggested_powershell, /Stop-Process -Id/);
  assert.match(report.processes[0].suggested_taskkill, /taskkill \/PID/);
});

test('CLOSED is never automated and requires exact Production verification', () => {
  assert.throws(() => transitionState({ state: 'PRODUCTION_REVIEW', production_sha: null }, 'CLOSED'), /explicit Product Owner/);
  assert.throws(() => transitionState({ state: 'PRODUCTION_REVIEW', production_sha: 'abc' }, 'CLOSED'), /explicit Product Owner/);
  const closed = transitionState({ state: 'PRODUCTION_REVIEW', production_sha: 'abc' }, 'CLOSED', { poProductionVerified: true });
  assert.equal(closed.state, 'CLOSED');
});

test('patch normalization preserves line boundaries on Windows-style input', () => {
  const input = Buffer.from('diff --git a/a b/a\r\n--- a/a\r\n+++ b/a\r\n@@ -1 +1 @@\r\n-old\r\n+new\r\n');
  const output = normalizePatchBytes(input);
  assert.equal(output.includes(Buffer.from('\r')), false);
  assert.equal(output.toString('utf8').split('\n').length, 7);
  assert.match(output.toString('utf8'), /\n-old\n\+new\n$/);
});

test('CRLF source checkout produces an LF-safe, non-collapsed Git patch', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-crlf-checkout-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  git(repo, 'config', 'core.autocrlf', 'true');
  candidateCommit(repo, 'src/windows.js', 'export const first = 1;\r\nexport const second = 2;\r\n');
  const root = join(temp, 'handoffs');
  invoke(['pack', 'CRLF-01', '--root', root, '--source-agent', 'work', '--source-repo', repo, '--base', base, '--allow', 'src/windows.js']);
  const patch = readFileSync(join(root, 'CRLF-01', 'candidate.patch'));
  assert.equal(patch.includes(Buffer.from('\r')), false);
  assert.match(patch.toString('utf8'), /\+export const first = 1;\n\+export const second = 2;/);
});

test('synthetic dogfood flow: pack, status, approve, stale, resume', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-dogfood-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  const candidate = candidateCommit(repo, 'docs/demo.md', 'synthetic candidate\n');
  const root = join(temp, 'handoffs');
  invoke(['pack', 'DOGFOOD-01', '--root', root, '--source-agent', 'work', '--source-repo', repo, '--base', base, '--allow', 'docs/demo.md']);
  assert.equal(invoke(['status', 'DOGFOOD-01', '--root', root]).stale, false);
  assert.equal(invoke(['approve-local', 'DOGFOOD-01', '--root', root, '--candidate', candidate]).state, 'PO_PRELIMINARY_APPROVED');
  write(repo, 'docs/demo.md', 'changed after approval\n');
  assert.equal(invoke(['status', 'DOGFOOD-01', '--root', root]).po_status, 'STALE');
  assert.match(invoke(['resume-info', 'DOGFOOD-01', '--root', root]).recommendation, /^STOP:/);
});
