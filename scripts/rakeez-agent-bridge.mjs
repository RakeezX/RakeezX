#!/usr/bin/env node
/**
 * RAKEEZ Agent Bridge — small, file-backed handoff coordinator.
 *
 * This tool packages candidates and records review/validation state. It never
 * commits, pushes, deploys, applies migrations, resets Git, or kills processes.
 */

import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const STATES = Object.freeze([
  'LOCAL_WORK',
  'PO_LOCAL_REVIEW',
  'PO_PRELIMINARY_APPROVED',
  'TRANSPORT_READY',
  'PRODUCTION_REVIEW',
  'CLOSED',
]);

export const GATES = Object.freeze([
  'CANDIDATE_IDENTIFIED',
  'PATCH_GENERATED',
  'PATCH_HASHED',
  'TRANSPORT_VALIDATED',
  'FOCUSED_TESTS_PASSED',
  'BUILD_PASSED',
  'PO_LOCAL_APPROVED',
  'INTEGRATION_COMMITTED',
  'REMOTE_VERIFIED',
  'PUSHED',
  'PRODUCTION_REVIEW',
]);

export const SOURCE_AGENTS = Object.freeze(['work', 'google', 'codex']);
export const DEFAULT_HANDOFF_ROOT = process.env.RAKEEZ_HANDOFF_ROOT
  || (process.platform === 'win32'
    ? 'D:\\Abdullah Projects\\RakeezX-Handoffs'
    : join(tmpdir(), 'RakeezX-Handoffs'));

const HERE = dirname(fileURLToPath(import.meta.url));
const TRANSPORT_TOOL = join(HERE, 'visual-patch-transport.mjs');
const PROFILE_CONFIG = resolve(HERE, '..', 'config', 'rakeez-test-profiles.json');
const FORBIDDEN_HANDOFF_PREFIXES = [
  '.git/', '.preservation/', '.aistudio/', 'ai-studio/', '.idx/',
  'backups/', 'backup/', 'exports/', 'production-data/', 'school-data/',
  'playwright-report/', 'test-results/',
];
const FORBIDDEN_HANDOFF_BASENAMES = new Set([
  '.env', 'storage-state.json', 'auth.json', 'credentials.json',
]);
const SECRET_PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]+/,
  /SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*['"]?[^\s'"$]+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /"(?:access_token|refresh_token|password)"\s*:\s*"[^"\r\n]+"/i,
];

function usage() {
  return [
    'Usage:',
    '  node scripts/rakeez-agent-bridge.mjs status [ticket] [--root <dir>]',
    '  node scripts/rakeez-agent-bridge.mjs pack <ticket> --source-agent <work|google|codex> --source-repo <dir> --base <sha> --allow <path> [--patch <file>] [--test-profile <id>]',
    '  node scripts/rakeez-agent-bridge.mjs approve-local <ticket> --candidate <candidate-sha> [--root <dir>]',
    '  node scripts/rakeez-agent-bridge.mjs inspect <ticket> [--root <dir>]',
    '  node scripts/rakeez-agent-bridge.mjs processes [--root <dir>]',
    '  node scripts/rakeez-agent-bridge.mjs resume-info <ticket> [--root <dir>]',
  ].join('\n');
}

function nowIso() { return new Date().toISOString(); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function slash(path) { return path.replaceAll('\\', '/'); }

export function normalizePatchBytes(value) {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return Buffer.from(normalized.endsWith('\n') ? normalized : `${normalized}\n`, 'utf8');
}

function safeTicket(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(value ?? ''))) {
    throw new Error('Ticket must use only letters, numbers, dots, underscores, and hyphens');
  }
  return value;
}

function parseOptions(args) {
  const options = { allow: [], testProfile: [] };
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = args[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (name === 'allow') options.allow.push(slash(value));
    else if (name === 'testProfile') options.testProfile.push(value);
    else options[name] = value;
  }
  return options;
}

function run(command, args, { cwd = process.cwd(), allowFailure = false, encoding = 'utf8' } = {}) {
  const result = spawnSync(command, args, { cwd, encoding, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr;
    const fallback = Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : result.stdout;
    throw new Error(`${basename(command)} ${args.join(' ')} failed: ${String(detail || fallback || '').trim()}`);
  }
  return result;
}

function git(args, cwd, options = {}) {
  const result = run('git', args, { cwd, ...options });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : result.stdout;
  return { ...result, text: String(stdout ?? '').trim() };
}

function gitBuffer(args, cwd, options = {}) {
  return run('git', args, { cwd, encoding: null, ...options }).stdout ?? Buffer.alloc(0);
}

function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function ticketDir(root, ticket) { return join(resolve(root), safeTicket(ticket)); }
function manifestPath(root, ticket) { return join(ticketDir(root, ticket), 'manifest.json'); }

function nulList(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean).map(slash);
}

function repositoryBase(repo, supplied) {
  if (supplied) return git(['rev-parse', '--verify', `${supplied}^{commit}`], repo).text;
  const originMain = git(['rev-parse', '--verify', 'origin/main^{commit}'], repo, { allowFailure: true });
  if (originMain.status === 0) return git(['merge-base', 'HEAD', originMain.text], repo).text;
  const parent = git(['rev-parse', '--verify', 'HEAD^'], repo, { allowFailure: true });
  if (parent.status === 0) return parent.text;
  return git(['rev-parse', 'HEAD'], repo).text;
}

function untrackedPatch(repo, path) {
  const result = gitBuffer(['diff', '--no-index', '--binary', '--', '/dev/null', path], repo, { allowFailure: true });
  if (!result.length) throw new Error(`Unable to create patch for untracked file: ${path}`);
  return result;
}

export function gitCandidate(repoPath, suppliedBase = null) {
  const repo = resolve(repoPath);
  const base = repositoryBase(repo, suppliedBase);
  const head = git(['rev-parse', 'HEAD'], repo).text;
  const status = git(['status', '--porcelain'], repo).text;
  const trackedPatch = gitBuffer(['diff', '--binary', '--full-index', base, '--'], repo);
  const untracked = nulList(gitBuffer(['ls-files', '--others', '--exclude-standard', '-z'], repo));
  const parts = [trackedPatch, ...untracked.map((path) => untrackedPatch(repo, path))];
  const patch = normalizePatchBytes(Buffer.concat(parts));
  if (!patch.toString('utf8').trim()) throw new Error('Candidate has no changes relative to its base');
  const changedFiles = [
    ...nulList(gitBuffer(['diff', '--name-only', '-z', base, '--'], repo)),
    ...untracked,
  ].filter((value, index, all) => all.indexOf(value) === index).sort();
  const patchSha = sha256(patch);
  return {
    repo, base, head, status: status ? 'dirty' : 'clean', patch,
    patchSha256: patchSha, changedFiles,
    candidateSha: status ? `working-tree:${patchSha}` : head,
  };
}

function assertAllowlist(changedFiles, allowlist) {
  if (!allowlist.length) throw new Error('An explicit --allow path is required');
  const notAllowed = changedFiles.filter((path) => !allowlist.includes(path));
  if (notAllowed.length) throw new Error(`Candidate contains non-allowlisted path(s): ${notAllowed.join(', ')}`);
}

function forbiddenHandoffPath(path) {
  const normalized = slash(path).toLowerCase();
  const name = basename(normalized);
  return FORBIDDEN_HANDOFF_BASENAMES.has(name)
    || name.startsWith('.env.')
    || /\.(?:zip|7z|rar|db|sqlite|sqlite3|har)$/.test(name)
    || FORBIDDEN_HANDOFF_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function assertNoSensitivePayload(paths, patch) {
  const forbidden = paths.filter(forbiddenHandoffPath);
  if (forbidden.length) throw new Error(`Forbidden handoff path(s): ${forbidden.join(', ')}`);
  const text = patch.toString('utf8');
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error('Candidate patch contains credential-like material and cannot be packaged');
  }
}

function validateWithTransport({ repo, base, patchPath, allowlist }) {
  const head = git(['rev-parse', 'HEAD'], repo).text;
  if (head !== base && git(['merge-base', '--is-ancestor', base, head], repo, { allowFailure: true }).status !== 0) {
    throw new Error(`Expected base ${base} is not an ancestor of source HEAD ${head}`);
  }
  const temp = mkdtempSync(join(tmpdir(), 'rakeez-agent-bridge-validate-'));
  try {
    run('git', ['clone', '--quiet', '--no-hardlinks', repo, temp]);
    git(['checkout', '--quiet', '--detach', base], temp);
    const args = [TRANSPORT_TOOL, '--patch', patchPath, '--base', base];
    for (const path of allowlist) args.push('--allow', path);
    const result = run(process.execPath, args, { cwd: temp, allowFailure: true });
    let report;
    try { report = JSON.parse(result.stdout); } catch { throw new Error(`Transport guard returned invalid output: ${result.stderr}`); }
    if (result.status !== 0 || !report.ok) throw new Error(`Transport guard rejected candidate: ${report.error ?? result.stderr}`);
    return report;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function loadProfiles() { return json(PROFILE_CONFIG); }

export function resolveTestProfiles(profileIds, config = loadProfiles()) {
  const selected = profileIds.length ? profileIds : ['default-ui'];
  const unit = new Set();
  const browser = new Set();
  const review = new Set();
  let strict = false;
  for (const id of selected) {
    const profile = config.profiles[id];
    if (!profile) throw new Error(`Unknown test profile: ${id}`);
    for (const path of profile.unit ?? []) unit.add(path);
    for (const path of profile.browser ?? []) browser.add(path);
    for (const step of profile.review ?? []) review.add(step);
    strict ||= !!profile.strict;
  }
  const commands = [];
  if (unit.size) commands.push(`node --test ${[...unit].sort().join(' ')}`);
  if (browser.size) commands.push(`npx playwright test ${[...browser].sort().join(' ')}`);
  commands.push(config.build_command);
  commands.push(config.diff_check_command);
  return { ids: selected, unit: [...unit].sort(), browser: [...browser].sort(), commands, review: [...review], strict };
}

function validationSkeleton(candidateFingerprint, profilePlan, previous = null) {
  const changed = previous && previous.candidate_fingerprint !== candidateFingerprint;
  if (previous && !changed) return previous;
  return {
    candidate_fingerprint: candidateFingerprint,
    status: changed ? 'STALE' : 'NOT_RUN',
    commands: profilePlan.commands.map((command) => ({
      command, exit_code: null, status: 'NOT_RUN', started_at: null, completed_at: null,
    })),
    test_profiles: profilePlan.ids,
    build_status: 'NOT_RUN',
    git_diff_check_status: 'NOT_RUN',
    created_at: previous?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
}

function sensitiveOverlaps(paths) {
  return paths.filter((path) => /^(?:src\/(?:app|store|models|lib\/(?:sync|sync-v2|cloud|db))\.js|sw\.js|supabase\/migrations\/)/.test(path));
}

function reviewMarkdown(manifest, plan, options) {
  const areas = plan.review.length ? plan.review.map((item) => `- ${item}`).join('\n') : '- Review the allowlisted visible change.';
  return `# ${manifest.ticket} — Product Owner Local Review

Source: ${manifest.source_agent}
Candidate: \`${manifest.candidate_sha}\`
Patch SHA256: \`${manifest.patch_sha256}\`
${options.localUrl ? `Local URL: ${options.localUrl}\n` : ''}${options.lanUrl ? `LAN URL: ${options.lanUrl}\n` : ''}
## What to review

${areas}

Review the listed states on mobile and desktop where applicable. Confirm that unrelated Product behavior remains unchanged.

## Decision

- APPROVE LOCALLY
- REQUEST CHANGES
- REJECT
`;
}

function handoffMarkdown(manifest) {
  const files = manifest.allowlist.map((path) => `- \`${path}\``).join('\n');
  const overlaps = manifest.known_sensitive_overlaps.length
    ? manifest.known_sensitive_overlaps.map((path) => `- \`${path}\``).join('\n')
    : '- None';
  return `# ${manifest.ticket} — Codex Handoff

- Source agent: ${manifest.source_agent}
- Exact base: \`${manifest.base_sha}\`
- Candidate: \`${manifest.candidate_sha}\`
- Patch SHA256: \`${manifest.patch_sha256}\`
- Validation: ${manifest.validation_status} for \`${manifest.patch_sha256}\`
- Test profiles: ${manifest.test_profiles.join(', ')}
- Last completed gate: ${manifest.last_completed_gate}
- Recommended next gate: ${manifest.recommended_next_gate}

## Allowlisted files

${files}

## Sensitive overlaps

${overlaps}

Use the existing visual patch transport guard for dry-run/application. Do not promote automatically; reconcile current Git state first.
`;
}

function packageFiles(root, ticket) {
  const dir = ticketDir(root, ticket);
  return {
    dir,
    manifest: join(dir, 'manifest.json'),
    patch: join(dir, 'candidate.patch'),
    validation: join(dir, 'validation.json'),
    review: join(dir, 'REVIEW.md'),
    handoff: join(dir, 'HANDOFF_CODEX.md'),
  };
}

function existingPackage(root, ticket) {
  const files = packageFiles(root, ticket);
  return existsSync(files.manifest) ? { files, manifest: json(files.manifest) } : null;
}

export function transitionState(manifest, next, { poProductionVerified = false } = {}) {
  if (!STATES.includes(next)) throw new Error(`Unknown bridge state: ${next}`);
  if (next === 'CLOSED' && (!poProductionVerified || !manifest.production_sha)) {
    throw new Error('CLOSED requires explicit Product Owner Production verification and an exact Production SHA');
  }
  return { ...manifest, state: next, updated_at: nowIso() };
}

function pack(ticket, options) {
  const sourceAgent = options.sourceAgent;
  if (!SOURCE_AGENTS.includes(sourceAgent)) throw new Error(`Invalid --source-agent; expected ${SOURCE_AGENTS.join(', ')}`);
  const repo = resolve(options.sourceRepo ?? process.cwd());
  const allowlist = [...new Set(options.allow.map(slash))].sort();
  let candidate;
  if (sourceAgent === 'google') {
    if (!options.patch || !options.base) throw new Error('Google intake requires --patch and --base');
    const patch = normalizePatchBytes(readFileSync(resolve(options.patch)));
    const patchSha = sha256(patch);
    candidate = {
      repo,
      base: repositoryBase(repo, options.base),
      head: git(['rev-parse', 'HEAD'], repo).text,
      status: git(['status', '--porcelain'], repo).text ? 'dirty' : 'clean',
      patch,
      patchSha256: patchSha,
      changedFiles: [],
      candidateSha: options.candidate ?? `patch:${patchSha}`,
    };
  } else {
    candidate = gitCandidate(repo, options.base);
  }
  assertNoSensitivePayload(candidate.changedFiles, candidate.patch);

  const root = resolve(options.root ?? DEFAULT_HANDOFF_ROOT);
  const files = packageFiles(root, ticket);
  const intakeTemp = mkdtempSync(join(tmpdir(), 'rakeez-agent-bridge-intake-'));
  const intakePatch = join(intakeTemp, 'candidate.patch');
  let transport;
  try {
    writeFileSync(intakePatch, candidate.patch);
    transport = validateWithTransport({ repo, base: candidate.base, patchPath: intakePatch, allowlist });
  } finally {
    rmSync(intakeTemp, { recursive: true, force: true });
  }
  if (!candidate.changedFiles.length) candidate.changedFiles = transport.touchedFiles.slice().sort();
  assertAllowlist(candidate.changedFiles, allowlist);
  assertNoSensitivePayload(candidate.changedFiles, candidate.patch);
  if (transport.patchSha256 !== candidate.patchSha256) throw new Error('Transport hash differs from packaged patch hash');

  mkdirSync(files.dir, { recursive: true });
  writeFileSync(files.patch, candidate.patch);
  const previous = existingPackage(root, ticket)?.manifest;
  const priorValidation = existsSync(files.validation) ? json(files.validation) : null;
  const sameCandidate = previous?.patch_sha256 === candidate.patchSha256;
  const plan = resolveTestProfiles(options.testProfile);
  const timestamp = nowIso();
  const manifest = {
    ticket,
    source_agent: sourceAgent,
    source_repo: repo,
    source_head: candidate.head,
    base_sha: candidate.base,
    candidate_sha: candidate.candidateSha,
    patch_sha256: candidate.patchSha256,
    changed_files: candidate.changedFiles,
    allowlist,
    test_profiles: plan.ids,
    validation_status: sameCandidate ? (previous?.validation_status ?? priorValidation?.status ?? 'NOT_RUN') : (previous ? 'STALE' : 'NOT_RUN'),
    po_status: sameCandidate ? (previous?.po_status ?? 'PENDING') : (previous?.po_status ? 'STALE' : 'PENDING'),
    approved_candidate_sha: sameCandidate ? (previous?.approved_candidate_sha ?? null) : (previous?.approved_candidate_sha ?? null),
    approved_patch_sha256: sameCandidate ? (previous?.approved_patch_sha256 ?? null) : (previous?.approved_patch_sha256 ?? null),
    approval_at: sameCandidate ? (previous?.approval_at ?? null) : null,
    production_sha: options.productionSha ?? previous?.production_sha ?? candidate.base,
    state: sameCandidate ? (previous?.state ?? 'PO_LOCAL_REVIEW') : 'PO_LOCAL_REVIEW',
    last_completed_gate: 'TRANSPORT_VALIDATED',
    recommended_next_gate: 'PO_LOCAL_APPROVED',
    known_sensitive_overlaps: sensitiveOverlaps(candidate.changedFiles),
    transport: {
      dry_run: transport.dryRun,
      diff_check: transport.diffCheck,
      verification: 'exact-base-temporary-clone',
    },
    local_url: options.localUrl ?? previous?.local_url ?? null,
    lan_url: options.lanUrl ?? previous?.lan_url ?? null,
    created_at: previous?.created_at ?? timestamp,
    updated_at: timestamp,
  };
  const validation = validationSkeleton(candidate.patchSha256, plan, priorValidation);
  manifest.validation_status = validation.status;
  writeJson(files.manifest, manifest);
  writeJson(files.validation, validation);
  writeFileSync(files.review, reviewMarkdown(manifest, plan, options), 'utf8');
  writeFileSync(files.handoff, handoffMarkdown(manifest), 'utf8');
  return { ok: true, package: files.dir, manifest, validation };
}

function candidateReality(manifest, patchPath) {
  const currentPatchSha = sha256(normalizePatchBytes(readFileSync(patchPath)));
  let sourcePatchSha = currentPatchSha;
  let sourceError = null;
  if (manifest.source_agent !== 'google') {
    try {
      sourcePatchSha = gitCandidate(manifest.source_repo, manifest.base_sha).patchSha256;
    } catch (error) { sourceError = error.message; }
  }
  return {
    current_patch_sha256: currentPatchSha,
    source_patch_sha256: sourcePatchSha,
    package_matches_manifest: currentPatchSha === manifest.patch_sha256,
    source_matches_manifest: !sourceError && sourcePatchSha === manifest.patch_sha256,
    source_error: sourceError,
  };
}

function refreshPackage(root, ticket) {
  const current = existingPackage(root, ticket);
  if (!current) throw new Error(`Unknown ticket package: ${ticket}`);
  const validationFile = current.files.validation;
  const validation = existsSync(validationFile) ? json(validationFile) : null;
  const reality = candidateReality(current.manifest, current.files.patch);
  const stale = !reality.package_matches_manifest || !reality.source_matches_manifest;
  const validationStale = !validation
    || validation.candidate_fingerprint !== current.manifest.patch_sha256;
  let manifest = current.manifest;
  if (stale && (manifest.po_status !== 'STALE' || manifest.validation_status !== 'STALE')) {
    manifest = {
      ...manifest,
      po_status: manifest.po_status === 'PENDING' ? 'PENDING' : 'STALE',
      validation_status: 'STALE',
      state: 'LOCAL_WORK',
      recommended_next_gate: 'CANDIDATE_IDENTIFIED',
      updated_at: nowIso(),
    };
    writeJson(current.files.manifest, manifest);
  }
  if ((stale || validationStale) && validation && validation.status !== 'STALE') {
    validation.status = 'STALE';
    validation.updated_at = nowIso();
    writeJson(validationFile, validation);
  }
  if (validationStale && !stale && manifest.validation_status !== 'STALE') {
    manifest = { ...manifest, validation_status: 'STALE', updated_at: nowIso() };
    writeJson(current.files.manifest, manifest);
  }
  return { files: current.files, manifest, validation, reality, stale, validation_stale: stale || validationStale };
}

function approveLocal(ticket, options) {
  if (!options.candidate) throw new Error('approve-local requires --candidate with the exact current candidate SHA');
  const root = resolve(options.root ?? DEFAULT_HANDOFF_ROOT);
  const current = refreshPackage(root, ticket);
  if (current.stale) throw new Error('Candidate differs from its package; repack before approval');
  if (options.candidate !== current.manifest.candidate_sha) {
    throw new Error(`Candidate mismatch; expected ${current.manifest.candidate_sha}`);
  }
  let manifest = transitionState(current.manifest, 'PO_PRELIMINARY_APPROVED');
  manifest = {
    ...manifest,
    po_status: 'PO_PRELIMINARY_APPROVED',
    approved_candidate_sha: manifest.candidate_sha,
    approved_patch_sha256: manifest.patch_sha256,
    approval_at: nowIso(),
    last_completed_gate: 'PO_LOCAL_APPROVED',
    recommended_next_gate: 'TRANSPORT_READY',
  };
  writeJson(current.files.manifest, manifest);
  return { ok: true, ticket, candidate: manifest.candidate_sha, patch_sha256: manifest.patch_sha256, state: manifest.state };
}

function commitReality(manifest) {
  const isCommit = /^[0-9a-f]{40}$/i.test(manifest.candidate_sha);
  const commitExists = isCommit
    && git(['cat-file', '-e', `${manifest.candidate_sha}^{commit}`], manifest.source_repo, { allowFailure: true }).status === 0;
  let containingRemotes = [];
  if (commitExists) {
    containingRemotes = git(['branch', '-r', '--contains', manifest.candidate_sha, '--format=%(refname:short)'], manifest.source_repo, { allowFailure: true })
      .text.split(/\r?\n/).filter(Boolean);
  }
  const remoteMain = git(['rev-parse', '--verify', 'origin/main^{commit}'], manifest.source_repo, { allowFailure: true });
  const remoteMainSha = remoteMain.status === 0 ? remoteMain.text : null;
  return {
    candidate_is_commit: isCommit,
    commit_exists: commitExists,
    containing_remotes: containingRemotes,
    pushed: containingRemotes.length > 0,
    remote_main_sha: remoteMainSha,
    remote_main_advanced: !!(remoteMainSha && manifest.production_sha && remoteMainSha !== manifest.production_sha),
  };
}

function resumeInfo(ticket, options) {
  const root = resolve(options.root ?? DEFAULT_HANDOFF_ROOT);
  const current = refreshPackage(root, ticket);
  const gitReality = commitReality(current.manifest);
  const stop = current.stale || gitReality.remote_main_advanced;
  return {
    ok: !stop,
    ticket,
    recorded: {
      state: current.manifest.state,
      last_completed_gate: current.manifest.last_completed_gate,
      candidate_sha: current.manifest.candidate_sha,
      po_status: current.manifest.po_status,
      validation_status: current.manifest.validation_status,
    },
    candidate: current.reality,
    git: gitReality,
    recommendation: stop
      ? 'STOP: candidate or remote reality differs from the recorded handoff'
      : `CONTINUE: ${current.manifest.recommended_next_gate}`,
  };
}

function status(ticket, options) {
  const root = resolve(options.root ?? DEFAULT_HANDOFF_ROOT);
  if (ticket) {
    const current = refreshPackage(root, ticket);
    return {
      ok: !current.stale,
      ticket,
      state: current.manifest.state,
      candidate_sha: current.manifest.candidate_sha,
      patch_sha256: current.manifest.patch_sha256,
      validation_status: current.manifest.validation_status,
      po_status: current.manifest.po_status,
      last_completed_gate: current.manifest.last_completed_gate,
      stale: current.stale,
    };
  }
  if (!existsSync(root)) return { ok: true, root, tickets: [] };
  const tickets = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name, 'manifest.json');
    if (existsSync(path)) tickets.push(json(path));
  }
  return { ok: true, root, tickets: tickets.map((item) => ({ ticket: item.ticket, state: item.state, updated_at: item.updated_at })) };
}

function processAlive(pid) {
  try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

function registryPath(root) { return join(resolve(root), '.bridge', 'processes.json'); }

export function registerBridgeProcess(root, record) {
  const path = registryPath(root);
  mkdirSync(dirname(path), { recursive: true });
  const records = existsSync(path) ? json(path) : [];
  records.push({
    ticket: safeTicket(record.ticket),
    pid: Number(record.pid),
    parentPid: record.parentPid == null ? null : Number(record.parentPid),
    command: String(record.command),
    port: record.port == null ? null : Number(record.port),
    startedAt: record.startedAt ?? nowIso(),
    owner: record.owner ?? 'rakeez-agent-bridge',
    children: (record.children ?? []).map(Number),
  });
  writeJson(path, records);
  return records.at(-1);
}

function processes(options) {
  const root = resolve(options.root ?? DEFAULT_HANDOFF_ROOT);
  const path = registryPath(root);
  const records = existsSync(path) ? json(path) : [];
  return {
    ok: true,
    registry: path,
    processes: records.map((record) => {
      const tree = [record.pid, ...(record.children ?? [])];
      return {
        ...record,
        tree: tree.map((pid) => ({ pid, active: processAlive(pid) })),
        active: tree.some(processAlive),
        suggested_powershell: `Stop-Process -Id ${tree.join(',')} -Force`,
        suggested_taskkill: `taskkill /PID ${record.pid} /T /F`,
      };
    }),
    auto_kill: false,
  };
}

function inspect(ticket, options) {
  const root = resolve(options.root ?? DEFAULT_HANDOFF_ROOT);
  const current = refreshPackage(root, ticket);
  return { ok: !current.stale, ...current, files: current.files };
}

function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

export async function main(argv = process.argv.slice(2)) {
  const [command, maybeTicket, ...tail] = argv;
  if (!command) throw new Error(usage());
  let ticket = null;
  let args = tail;
  if (command === 'status' && (maybeTicket === undefined || maybeTicket.startsWith('--'))) {
    args = [maybeTicket, ...tail].filter((value) => value !== undefined);
  } else if (command !== 'processes') {
    ticket = safeTicket(maybeTicket);
  } else {
    args = [maybeTicket, ...tail].filter((value) => value !== undefined);
  }
  const options = parseOptions(args);
  if (command === 'pack') return pack(ticket, options);
  if (command === 'approve-local') return approveLocal(ticket, options);
  if (command === 'inspect') return inspect(ticket, options);
  if (command === 'resume-info') return resumeInfo(ticket, options);
  if (command === 'status') return status(ticket, options);
  if (command === 'processes') return processes(options);
  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().then(print).catch((error) => {
    print({ ok: false, error: error.message });
    process.exitCode = 1;
  });
}
