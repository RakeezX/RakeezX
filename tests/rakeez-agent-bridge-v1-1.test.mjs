import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

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

function initRepo(root) {
  const repo = join(root, 'repo');
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'bridge-v1-1@rakeezx.local');
  git(repo, 'config', 'user.name', 'Bridge V1.1 Test');
  write(repo, 'src/ui.css', '.button { color: blue; }\n');
  git(repo, 'add', 'src/ui.css');
  git(repo, 'commit', '-q', '-m', 'base');
  return { repo, base: git(repo, 'rev-parse', 'HEAD') };
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

function pack(repo, base, handoffs, ticket, extra = []) {
  return invoke([
    'pack', ticket, '--root', handoffs, '--source-agent', 'work',
    '--source-repo', repo, '--base', base, '--allow', 'src/ui.css', ...extra,
  ]);
}

test('known Work ticket and design brief files are excluded and reported', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-v11-defaults-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  write(repo, 'src/ui.css', '.button { color: green; }\n');
  write(repo, 'WORK_TICKET.md', 'local ticket only\n');
  write(repo, 'WORK_DESIGN_BRIEF.md', 'local design brief only\n');
  const root = join(temp, 'handoffs');
  const output = pack(repo, base, root, 'LOCAL-DEFAULTS');
  assert.deepEqual(output.manifest.changed_files, ['src/ui.css']);
  assert.deepEqual(output.manifest.local_artifacts, ['WORK_DESIGN_BRIEF.md', 'WORK_TICKET.md']);
  const patch = readFileSync(join(root, 'LOCAL-DEFAULTS', 'candidate.patch'), 'utf8');
  assert.doesNotMatch(patch, /WORK_(?:TICKET|DESIGN_BRIEF)/);
  assert.match(readFileSync(join(root, 'LOCAL-DEFAULTS', 'manifest.json'), 'utf8'), /local_artifacts/);
});

test('a normal Product markdown file is not silently excluded', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-v11-product-md-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  write(repo, 'PRODUCT_GUIDE.md', 'Product documentation\n');
  const root = join(temp, 'handoffs');
  const output = invoke([
    'pack', 'PRODUCT-MD', '--root', root, '--source-agent', 'codex',
    '--source-repo', repo, '--base', base, '--allow', 'PRODUCT_GUIDE.md',
  ]);
  assert.deepEqual(output.manifest.changed_files, ['PRODUCT_GUIDE.md']);
  assert.deepEqual(output.manifest.local_artifacts, []);
});

test('custom local-artifact patterns are conservative and reported', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-v11-custom-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  write(repo, 'src/ui.css', '.button { color: green; }\n');
  write(repo, 'LOCAL_REVIEW_MOBILE.md', 'local review only\n');
  const root = join(temp, 'handoffs');
  const output = pack(repo, base, root, 'LOCAL-CUSTOM', ['--local-artifact', 'LOCAL_REVIEW_*.md']);
  assert.deepEqual(output.manifest.changed_files, ['src/ui.css']);
  assert.deepEqual(output.manifest.local_artifacts, ['LOCAL_REVIEW_MOBILE.md']);
  assert.ok(output.manifest.local_artifact_patterns.includes('LOCAL_REVIEW_*.md'));
});

test('custom broad pattern rejection is explicit', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-v11-broad-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  write(repo, 'src/ui.css', '.button { color: green; }\n');
  const rejected = invoke([
    'pack', 'LOCAL-BROAD', '--root', join(temp, 'handoffs'), '--source-agent', 'work',
    '--source-repo', repo, '--base', base, '--allow', 'src/ui.css', '--local-artifact', '*.md',
  ], { expectFailure: true });
  assert.match(rejected.error, /overly broad/);
});

test('validation is candidate-bound, complete, deduplicated, and build-once', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-v11-validation-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  write(repo, 'src/ui.css', '.button { color: green; }\n');
  const root = join(temp, 'handoffs');
  const packed = pack(repo, base, root, 'VALID-FRESH', [
    '--test-profile', 'home', '--test-profile', 'home',
  ]);
  const candidate = packed.manifest.candidate_sha;
  invoke(['approve-local', 'VALID-FRESH', '--root', root, '--candidate', candidate]);
  const wrongCandidate = invoke([
    'record-validation', 'VALID-FRESH', '--root', root, '--candidate', base,
    '--profile', 'home', '--exit-code', '0', '--build-pass', '--diff-check-pass',
  ], { expectFailure: true });
  assert.match(wrongCandidate.error, /Candidate mismatch/);
  const recorded = invoke([
    'record-validation', 'VALID-FRESH', '--root', root, '--candidate', candidate,
    '--profile', 'home', '--profile', 'home',
    '--command', 'node --test tests/focused-home.test.mjs',
    '--command', 'node --test tests/focused-home.test.mjs',
    '--exit-code', '0', '--build-pass', '--diff-check-pass', '--note', 'focused gate',
  ]);
  assert.equal(recorded.validation.freshness, 'FRESH');
  assert.equal(recorded.validation.status, 'PASS');
  assert.deepEqual(recorded.profiles_recorded, ['home']);
  assert.deepEqual(recorded.custom_commands, ['node --test tests/focused-home.test.mjs']);
  const validation = JSON.parse(readFileSync(join(root, 'VALID-FRESH', 'validation.json'), 'utf8'));
  assert.equal(validation.candidate_sha, candidate);
  assert.equal(validation.candidate_fingerprint, packed.manifest.patch_sha256);
  assert.equal(validation.patch_sha256, packed.manifest.patch_sha256);
  assert.equal(validation.records.length, 1);
  assert.equal(validation.records[0].recorded_at.length > 10, true);
  assert.equal(validation.commands.filter((entry) => entry.command === 'node --test tests/focused-home.test.mjs').length, 1);
  assert.equal(validation.build_status, 'PASS');
  assert.equal(validation.build_exit_code, 0);
  assert.equal(validation.git_diff_check_status, 'PASS');
  assert.equal(validation.git_diff_check_exit_code, 0);
  const status = invoke(['status', 'VALID-FRESH', '--root', root]);
  assert.equal(status.validation_state, 'FRESH');
  assert.equal(status.validation_status, 'PASS');
  assert.match(readFileSync(join(root, 'VALID-FRESH', 'REVIEW.md'), 'utf8'), /Validation: FRESH/);
  assert.match(readFileSync(join(root, 'VALID-FRESH', 'HANDOFF_CODEX.md'), 'utf8'), /Profiles recorded: home/);
  const duplicateBuild = invoke([
    'record-validation', 'VALID-FRESH', '--root', root, '--candidate', candidate, '--build-pass',
  ], { expectFailure: true });
  assert.match(duplicateBuild.error, /build-once/);

  write(repo, 'src/ui.css', '.button { color: purple; }\n');
  const manifestPath = join(root, 'VALID-FRESH', 'manifest.json');
  const beforeReadOnly = readFileSync(manifestPath, 'utf8');
  const readOnly = invoke(['inspect', 'VALID-FRESH', '--root', root, '--read-only']);
  assert.equal(readOnly.stale, true);
  assert.equal(readFileSync(manifestPath, 'utf8'), beforeReadOnly);
  const stale = invoke(['status', 'VALID-FRESH', '--root', root]);
  assert.equal(stale.validation_state, 'STALE');
  assert.equal(stale.validation_status, 'STALE');
  assert.equal(stale.po_status, 'STALE');
});

test('missing required profile remains MISSING even with current custom evidence', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'bridge-v11-missing-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const { repo, base } = initRepo(temp);
  write(repo, 'src/ui.css', '.button { color: green; }\n');
  const root = join(temp, 'handoffs');
  const packed = pack(repo, base, root, 'VALID-MISSING', ['--test-profile', 'home']);
  const recorded = invoke([
    'record-validation', 'VALID-MISSING', '--root', root,
    '--candidate', packed.manifest.candidate_sha,
    '--command', 'node --test tests/custom-only.test.mjs', '--exit-code', '0',
    '--build-pass', '--diff-check-pass',
  ]);
  assert.equal(recorded.validation.freshness, 'MISSING');
  assert.equal(recorded.validation.status, 'INCOMPLETE');
  assert.match(recorded.validation.reason, /home/);
  const resume = invoke(['resume-info', 'VALID-MISSING', '--root', root]);
  assert.equal(resume.recorded.validation_state, 'MISSING');
  assert.match(resume.recorded.validation_reason, /home/);
  assert.equal(resume.recommendation, 'CONTINUE: RECORD_VALIDATION');
});
