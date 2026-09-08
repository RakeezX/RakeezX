#!/usr/bin/env node
/**
 * Validate and optionally apply an approved Google Visual unified diff.
 * This maintainer tool intentionally never commits, pushes, stashes, resets,
 * or cleans the repository.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const FORBIDDEN_BASENAMES = new Set(['metadata.json', 'package.json', 'package-lock.json', 'serve.py']);
const FORBIDDEN_PREFIXES = ['.preservation/', '.aistudio/', 'ai-studio/', '.idx/'];

function usage() {
  return 'Usage: node scripts/visual-patch-transport.mjs --patch <file> --base <commit> --allow <path> [--allow <path> ...] [--allow-newer-base] [--apply]';
}

function parseArgs(args) {
  const options = { allow: [], apply: false, allowNewerBase: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--allow-newer-base') options.allowNewerBase = true;
    else if (arg === '--patch' || arg === '--base' || arg === '--allow') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--allow') options.allow.push(value);
      else options[arg.slice(2)] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.patch || !options.base || !options.allow.length) throw new Error(usage());
  return options;
}

function git(args, { allowFailure = false, input = undefined } = {}) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', input });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return { ok: result.status === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function safePath(value) {
  return typeof value === 'string' && value.length > 0 &&
    !value.startsWith('/') && !value.startsWith('\\') && !/^[A-Za-z]:/.test(value) &&
    !value.includes('\\') && !value.split('/').some((part) => part === '..' || part === '.');
}

function forbiddenPath(path) {
  const basename = path.split('/').at(-1);
  return FORBIDDEN_BASENAMES.has(basename) || path.endsWith('.zip') ||
    FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function parsePatch(patch) {
  const paths = [];
  const lines = patch.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (!match) continue;
    const [, before, after] = match;
    if (before !== after) throw new Error(`Rename/copy patches are not accepted: ${before} -> ${after}`);
    if (!safePath(before)) throw new Error(`Unsafe patch path: ${before}`);
    paths.push(before);
  }
  if (!paths.length) throw new Error('Malformed patch: no standard diff --git headers found');
  if (new Set(paths).size !== paths.length) throw new Error('Malformed patch: duplicate diff headers');
  return paths;
}

function report(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const patchPath = resolve(options.patch);
  const result = {
    ok: false,
    patch: patchPath,
    patchSha256: null,
    expectedBase: options.base,
    currentHead: null,
    verification: options.allowNewerBase ? 'ancestor-and-dry-run' : 'exact-head',
    touchedFiles: [],
    forbiddenPaths: [],
    nonAllowlistedPaths: [],
    workingTree: null,
    dryRun: 'not-run',
    apply: options.apply ? 'not-run' : 'not-requested',
    diffCheck: 'not-run',
  };
  try {
    if (!existsSync(patchPath)) throw new Error(`Patch file does not exist: ${patchPath}`);
    const patch = readFileSync(patchPath, 'utf8');
    result.patchSha256 = createHash('sha256').update(patch).digest('hex');
    result.touchedFiles = parsePatch(patch);
    result.forbiddenPaths = result.touchedFiles.filter(forbiddenPath);
    result.nonAllowlistedPaths = result.touchedFiles.filter((path) => !options.allow.includes(path));
    if (result.forbiddenPaths.length) throw new Error(`Forbidden patch path(s): ${result.forbiddenPaths.join(', ')}`);
    if (result.nonAllowlistedPaths.length) throw new Error(`Non-allowlisted patch path(s): ${result.nonAllowlistedPaths.join(', ')}`);

    result.currentHead = git(['rev-parse', 'HEAD']).stdout;
    const expected = git(['rev-parse', '--verify', `${options.base}^{commit}`]).stdout;
    if (!options.allowNewerBase && result.currentHead !== expected) {
      throw new Error(`Expected base ${expected}, but HEAD is ${result.currentHead}`);
    }
    if (options.allowNewerBase && !git(['merge-base', '--is-ancestor', expected, result.currentHead], { allowFailure: true }).ok) {
      throw new Error(`Expected base ${expected} is not an ancestor of HEAD ${result.currentHead}`);
    }

    const status = git(['status', '--porcelain']).stdout;
    result.workingTree = status ? 'dirty' : 'clean';
    if (status) throw new Error('Working tree must be clean; refusing to validate or apply a patch');

    git(['apply', '--check', '--whitespace=error', patchPath]);
    result.dryRun = 'pass';
    if (options.apply) {
      git(['apply', '--whitespace=error', patchPath]);
      result.apply = 'pass';
    }
    git(['diff', '--check']);
    result.diffCheck = 'pass';
    result.ok = true;
  } catch (error) {
    result.error = error.message;
    if (result.workingTree === null) {
      try { result.workingTree = git(['status', '--porcelain']).stdout ? 'dirty' : 'clean'; } catch { result.workingTree = 'unknown'; }
    }
  }
  report(result);
  process.exitCode = result.ok ? 0 : 1;
}

main();
