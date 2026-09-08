import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const tool = resolve('scripts/visual-patch-transport.mjs');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'rakeezx-visual-patch-'));
  mkdirSync(join(root, 'src', 'views'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'src', 'views', 'home.js'), 'export const home = "old";\n');
  writeFileSync(join(root, 'tests', 'home-focus.test.mjs'), 'export const focus = "old";\n');
  run('git', ['init', '--quiet'], root);
  run('git', ['config', 'user.email', 'test@rakeezx.local'], root);
  run('git', ['config', 'user.name', 'RakeezX Test'], root);
  run('git', ['add', '.'], root);
  run('git', ['commit', '--quiet', '-m', 'base'], root);
  return root;
}

function patch(lines) { return `${lines.join('\n')}\n`; }

function replacePatch(path, before, after) {
  return patch([
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1 +1 @@',
    `-${before}`,
    `+${after}`,
  ]);
}

function invoke(root, patchText, options = {}) {
  const patchDir = mkdtempSync(join(tmpdir(), 'rakeezx-visual-patch-file-'));
  const file = join(patchDir, 'approved.patch');
  writeFileSync(file, patchText);
  const base = run('git', ['rev-parse', 'HEAD'], root);
  const args = [tool, '--patch', file, '--base', options.base ?? base, '--allow', 'src/views/home.js'];
  for (const item of options.allow ?? []) args.push('--allow', item);
  if (options.allowNewerBase) args.push('--allow-newer-base');
  if (options.apply) args.push('--apply');
  try {
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
  } finally {
    rmSync(patchDir, { recursive: true, force: true });
  }
}

async function withRepo(fn) {
  const root = makeRepo();
  try { await fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('valid two-file Product patch dry-runs and applies only allowlisted files', () => withRepo((root) => {
  const source = replacePatch('src/views/home.js', 'export const home = "old";', 'export const home = "new";');
  const testPatch = replacePatch('tests/home-focus.test.mjs', 'export const focus = "old";', 'export const focus = "new";');
  const approved = `${source}${testPatch}`;
  const dryRun = invoke(root, approved, { allow: ['tests/home-focus.test.mjs'] });
  assert.equal(dryRun.status, 0);
  assert.equal(dryRun.output.dryRun, 'pass');
  assert.equal(dryRun.output.apply, 'not-requested');
  assert.match(readFileSync(join(root, 'src/views/home.js'), 'utf8'), /old/);
  const applied = invoke(root, approved, { allow: ['tests/home-focus.test.mjs'], apply: true });
  assert.equal(applied.status, 0);
  assert.equal(applied.output.apply, 'pass');
  assert.match(readFileSync(join(root, 'src/views/home.js'), 'utf8'), /new/);
  assert.match(readFileSync(join(root, 'tests/home-focus.test.mjs'), 'utf8'), /new/);
}));

for (const forbidden of ['package.json', 'package-lock.json', '.preservation/state.json']) {
  test(`rejects forbidden path ${forbidden}`, () => withRepo((root) => {
    const result = invoke(root, replacePatch(forbidden, 'old', 'new'));
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.output.forbiddenPaths, [forbidden]);
  }));
}

test('rejects a non-allowlisted Product file', () => withRepo((root) => {
  const result = invoke(root, replacePatch('tests/home-focus.test.mjs', 'export const focus = "old";', 'export const focus = "new";'));
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.output.nonAllowlistedPaths, ['tests/home-focus.test.mjs']);
}));

test('rejects path traversal and malformed patches', () => withRepo((root) => {
  const traversal = invoke(root, replacePatch('../escape.js', 'old', 'new'));
  assert.notEqual(traversal.status, 0);
  assert.match(traversal.output.error, /Unsafe patch path/);
  const malformed = invoke(root, 'this is not a unified diff');
  assert.notEqual(malformed.status, 0);
  assert.match(malformed.output.error, /Malformed patch/);
}));

test('rejects a wrong base and a dirty working tree', () => withRepo((root) => {
  const approved = replacePatch('src/views/home.js', 'export const home = "old";', 'export const home = "new";');
  const wrongBase = invoke(root, approved, { base: '0000000000000000000000000000000000000000' });
  assert.notEqual(wrongBase.status, 0);
  assert.match(wrongBase.output.error, /rev-parse/);
  writeFileSync(join(root, 'local.txt'), 'keep me');
  const dirty = invoke(root, approved);
  assert.notEqual(dirty.status, 0);
  assert.equal(dirty.output.workingTree, 'dirty');
}));

test('allows an explicitly compatible newer base only after ancestry and dry-run checks', () => withRepo((root) => {
  const base = run('git', ['rev-parse', 'HEAD'], root);
  writeFileSync(join(root, 'unrelated.txt'), 'newer baseline');
  run('git', ['add', 'unrelated.txt'], root);
  run('git', ['commit', '--quiet', '-m', 'newer baseline'], root);
  const approved = replacePatch('src/views/home.js', 'export const home = "old";', 'export const home = "new";');
  const strict = invoke(root, approved, { base });
  assert.notEqual(strict.status, 0);
  const compatible = invoke(root, approved, { base, allowNewerBase: true });
  assert.equal(compatible.status, 0);
  assert.equal(compatible.output.verification, 'ancestor-and-dry-run');
}));
