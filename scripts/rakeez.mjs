#!/usr/bin/env node
// Read-only diagnostics and scoped evidence generation. No release operation lives here.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[a-f0-9]{40}$/i;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const TICKET = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const STATUS = new Set(['PASS', 'FAIL', 'SKIP', 'NOT_RUN']);

function argsOf(values) {
  const [command, ...rest] = values;
  if (!['doctor', 'preflight', 'evidence'].includes(command)) throw new Error('Use doctor, preflight, or evidence.');
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!/^--[a-z-]+$/.test(rest[i]) || !rest[i + 1] || rest[i + 1].startsWith('--'))
      throw new Error(`Invalid option ${rest[i] ?? ''}`);
    const key = rest[i].slice(2);
    if (key in options) throw new Error(`Duplicate option --${key}`);
    options[key] = rest[i + 1];
  }
  const allowed = command === 'doctor' ? ['repo'] : command === 'preflight'
    ? ['repo', 'base', 'candidate', 'expect-main', 'remote']
    : ['repo', 'ticket', 'base', 'candidate', 'input'];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new Error(`Unknown option --${key}`);
  return { command, options };
}

function processRun(file, args, { cwd, timeout = 10_000, shell = false } = {}) {
  const result = spawnSync(file, args, { cwd, timeout, shell, encoding: 'utf8', windowsHide: true });
  return { ok: result.status === 0 && !result.error, text: (result.stdout ?? '').trim(), status: result.status };
}

function git(repo, ...args) { return processRun('git', ['-C', repo, ...args]); }
function requiredGit(repo, ...args) {
  const result = git(repo, ...args);
  if (!result.ok) throw new Error(`Git check failed: ${args[0]}`);
  return result.text;
}
function repository(path) {
  const input = realpathSync(path ?? DEFAULT_REPO);
  return requiredGit(input, 'rev-parse', '--show-toplevel');
}
function requireSha(value, label) {
  if (!SHA.test(value ?? '')) throw new Error(`${label} must be a full 40-character SHA.`);
  return value.toLowerCase();
}
function lines(text) { return text ? text.split(/\r?\n/).filter(Boolean) : []; }
function status(repo) { return lines(requiredGit(repo, 'status', '--porcelain=v1', '--untracked-files=normal')); }
function existsAt(repo, sha, path) { return git(repo, 'cat-file', '-e', `${sha}:${path}`).ok; }
function diffNames(repo, base, candidate) {
  return lines(requiredGit(repo, 'diff', '--name-only', `${base}..${candidate}`)).sort();
}
function migrationChanges(repo, base, candidate) {
  return lines(requiredGit(repo, 'diff', '--name-status', '--find-renames', `${base}..${candidate}`, '--', 'supabase/migrations'))
    .map((line) => { const [status, ...paths] = line.split('\t'); return {
      status, path: paths.at(-1), previousPath: paths.length > 1 ? paths[0] : null,
    }; });
}
function remoteMain(repo, enabled = true) {
  if (!enabled) return { available: false, reason: 'disabled' };
  const result = git(repo, 'ls-remote', 'origin', 'refs/heads/main');
  const sha = result.text.split(/\s+/)[0];
  return result.ok && SHA.test(sha) ? { available: true, sha: sha.toLowerCase() }
    : { available: false, reason: 'network-or-remote-unavailable' };
}
function diffCheck(repo, base, candidate) {
  const checks = [git(repo, 'diff', '--check', `${base}..${candidate}`),
    git(repo, 'diff', '--check'), git(repo, 'diff', '--cached', '--check')];
  return checks.every((result) => result.ok);
}
function preflight(repo, options) {
  const base = requireSha(options.base, 'base');
  const candidate = requireSha(options.candidate, 'candidate');
  const baseExists = git(repo, 'cat-file', '-e', `${base}^{commit}`).ok;
  const candidateExists = git(repo, 'cat-file', '-e', `${candidate}^{commit}`).ok;
  const ancestry = baseExists && candidateExists && git(repo, 'merge-base', '--is-ancestor', base, candidate).ok;
  const dirtyCount = status(repo).length;
  const migrations = baseExists && candidateExists ? migrationChanges(repo, base, candidate) : [];
  const changedExistingMigrations = migrations.filter((change) =>
    existsAt(repo, base, change.previousPath ?? change.path));
  const dirtyMigrations = baseExists
    ? lines(requiredGit(repo, 'status', '--porcelain=v1', '--', 'supabase/migrations'))
      .map((line) => line.slice(3)).filter((path) => existsAt(repo, base, path)) : [];
  const diffOk = baseExists && candidateExists && diffCheck(repo, base, candidate);
  const remote = remoteMain(repo, options.remote !== 'off');
  const expectedMain = options['expect-main'] ? requireSha(options['expect-main'], 'expect-main') : null;
  const remoteMatches = !expectedMain || (remote.available && remote.sha === expectedMain);
  const head = requiredGit(repo, 'rev-parse', 'HEAD').toLowerCase();
  return {
    base, candidate, branch: requiredGit(repo, 'branch', '--show-current'),
    head, headMatchesCandidate: head === candidate, baseExists, candidateExists, ancestry,
    dirty: dirtyCount > 0, dirtyCount, remoteMain: remote, expectedMain,
    remoteMatches, changedFiles: baseExists && candidateExists ? diffNames(repo, base, candidate) : [],
    migrationChanges: migrations, changedExistingMigrations, dirtyExistingMigrations: dirtyMigrations,
    diffCheck: diffOk,
    ok: baseExists && candidateExists && ancestry && head === candidate && dirtyCount === 0 && diffOk && remoteMatches &&
      changedExistingMigrations.length === 0 && dirtyMigrations.length === 0,
  };
}

function executable(name) {
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  return (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').some((directory) =>
    suffixes.some((suffix) => existsSync(join(directory, `${name}${suffix}`))));
}
function doctor(repo) {
  const npm = process.platform === 'win32'
    ? processRun('cmd.exe', ['/d', '/s', '/c', 'npm --version'], { timeout: 5_000 })
    : processRun('npm', ['--version'], { timeout: 5_000 });
  const gitVersion = processRun('git', ['--version']);
  const playwrightPackage = existsSync(join(repo, 'node_modules', '@playwright', 'test', 'cli.js'));
  let browserBinary = false;
  if (playwrightPackage) {
    try {
      const packageFile = join(repo, 'node_modules', 'playwright', 'index.js');
      // The browser path is a local availability check; no browser is launched.
      const node = processRun(process.execPath, ['-e', `const p=require(${JSON.stringify(packageFile)});process.stdout.write(p.chromium.executablePath())`]);
      browserBinary = node.ok && existsSync(node.text);
    } catch { /* optional browser check */ }
  }
  const origin = git(repo, 'remote', 'get-url', 'origin');
  let remoteIdentity = 'unavailable';
  if (origin.ok) {
    try { const url = new URL(origin.text); remoteIdentity = `${url.hostname}${url.pathname}`; }
    catch { remoteIdentity = origin.text.replace(/^[^@]+@/, ''); }
  }
  return {
    node: process.version, npm: npm.ok ? npm.text : 'unavailable', git: gitVersion.ok ? gitVersion.text : 'unavailable',
    repository: repo, remoteIdentity, branch: requiredGit(repo, 'branch', '--show-current'),
    sha: requiredGit(repo, 'rev-parse', 'HEAD'), dirtyCount: status(repo).length,
    optional: { supabaseCli: executable('supabase'), wrangler: executable('wrangler'),
      playwrightPackage, browserBinary },
  };
}

function onlyKeys(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(object)) if (!allowed.includes(key)) throw new Error(`Unapproved ${label} field: ${key}`);
}
function code(value, label) {
  if (typeof value !== 'string' || !CODE.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function enumValue(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label}.`);
  return value;
}
function safeInput(path) {
  if (!path) return { tests: [], build: 'NOT_RUN', preview: null, deployment: null,
    blockers: [], approvals: [], productionVerification: 'PENDING' };
  const data = JSON.parse(readFileSync(path, 'utf8'));
  onlyKeys(data, ['tests', 'build', 'preview', 'deployment', 'blockers', 'approvals', 'productionVerification'], 'input');
  const tests = (data.tests ?? []).map((item) => {
    onlyKeys(item, ['name', 'status', 'passed', 'failed', 'skipped'], 'test');
    return { name: code(item.name, 'test name'), status: enumValue(item.status, STATUS, 'test status'),
      passed: count(item.passed ?? 0, 'passed'), failed: count(item.failed ?? 0, 'failed'),
      skipped: count(item.skipped ?? 0, 'skipped') };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const identity = (item, label) => {
    if (item == null) return null;
    onlyKeys(item, label === 'preview' ? ['url', 'sha', 'id', 'status']
      : ['id', 'sha', 'environment', 'status'], label);
    const value = { sha: requireSha(item.sha, `${label} sha`), id: code(item.id, `${label} id`),
      status: enumValue(item.status, new Set(['PENDING', 'SUCCESS', 'FAILED']), `${label} status`) };
    if (label === 'preview') {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
          !/^(?:[a-z0-9-]+\.)?rakeezx\.pages\.dev$/i.test(url.hostname))
        throw new Error('Preview URL is not an approved RAKEEZ Pages identity.');
      value.url = url.toString();
    } else value.environment = enumValue(item.environment, new Set(['Production', 'Preview']), 'environment');
    return value;
  };
  const approvals = (data.approvals ?? []).map((item) => {
    onlyKeys(item, ['kind', 'status'], 'approval');
    return { kind: code(item.kind, 'approval kind'), status: enumValue(item.status,
      new Set(['APPROVED', 'PENDING', 'REJECTED']), 'approval status') };
  }).sort((a, b) => a.kind.localeCompare(b.kind));
  return { tests, build: enumValue(data.build ?? 'NOT_RUN', STATUS, 'build'),
    preview: identity(data.preview, 'preview'), deployment: identity(data.deployment, 'deployment'),
    blockers: (data.blockers ?? []).map((item) => code(item, 'blocker')).sort(), approvals,
    productionVerification: enumValue(data.productionVerification ?? 'PENDING',
      new Set(['PENDING', 'VERIFIED', 'NOT_APPLICABLE']), 'Production verification') };
}

function evidence(repo, options) {
  if (!TICKET.test(options.ticket ?? '')) throw new Error('ticket must be a safe ticket ID.');
  const base = requireSha(options.base, 'base');
  const candidate = requireSha(options.candidate, 'candidate');
  if (requiredGit(repo, 'rev-parse', 'HEAD').toLowerCase() !== candidate) throw new Error('Candidate is not this worktree HEAD.');
  if (!git(repo, 'cat-file', '-e', `${base}^{commit}`).ok || !git(repo, 'merge-base', '--is-ancestor', base, candidate).ok)
    throw new Error('Base/candidate ancestry is invalid.');
  const supplied = safeInput(options.input);
  const manifest = { ticket: options.ticket, baseSha: base, candidateSha: candidate,
    branch: requiredGit(repo, 'branch', '--show-current'), changedFiles: diffNames(repo, base, candidate),
    migrationChanges: migrationChanges(repo, base, candidate), ...supplied };
  const directory = join(repo, 'test-results', 'evidence', options.ticket);
  mkdirSync(directory, { recursive: true });
  const jsonPath = join(directory, 'manifest.json');
  const mdPath = join(directory, 'manifest.md');
  writeFileSync(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const table = manifest.tests.length ? manifest.tests.map((item) =>
    `| ${item.name} | ${item.status} | ${item.passed}/${item.failed}/${item.skipped} |`).join('\n')
    : '| — | NOT_RUN | 0/0/0 |';
  const md = `# ${manifest.ticket}\n\nBase: ${base}\nCandidate: ${candidate}\nBranch: ${manifest.branch}\n\n` +
    `Changed files: ${manifest.changedFiles.length} (${manifest.changedFiles.join(', ') || 'none'})\n` +
    `Migration changes: ${manifest.migrationChanges.length}\n\n` +
    `| Test | Status | Passed/failed/skipped |\n| --- | --- | --- |\n${table}\n\n` +
    `Build: ${manifest.build}\nPreview: ${manifest.preview?.id ?? 'none'}\n` +
    `Deployment: ${manifest.deployment?.id ?? 'none'}\nBlockers: ${manifest.blockers.join(', ') || 'none'}\n` +
    `Product Owner approvals: ${manifest.approvals.map((item) => `${item.kind}=${item.status}`).join(', ') || 'none'}\n` +
    `Production verification: ${manifest.productionVerification}\n`;
  writeFileSync(mdPath, md);
  return { jsonPath, mdPath, manifest };
}

try {
  const { command, options } = argsOf(process.argv.slice(2));
  const repo = repository(options.repo);
  const result = command === 'doctor' ? doctor(repo) : command === 'preflight'
    ? preflight(repo, options) : evidence(repo, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (command === 'preflight' && !result.ok) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`rakeez: ${error.message}\n`);
  process.exitCode = 2;
}
