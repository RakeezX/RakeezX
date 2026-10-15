#!/usr/bin/env node
// Reviewed ops/card maintenance only. This is not a worker, scheduler or publisher.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SELF = 'scripts/ops-supervisor-v4/apply-reviewed-maintenance.mjs';
const WIN_PS = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const WIN_GIT = 'C:/Program Files/Git/cmd/git.exe';
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const RUNTIME_KEYS = new Set(('status sessionId attempt attempts runId lastRunId candidateSha baseSha worktreePath cwd resultPath runnerPid runnerCreatedAt brokerPid brokerCreatedAt ownedProcesses lastWorkerReap deliveryReceipt deliveryOwner implementationFailures infrastructureRetries failureClass lastFailure retryAt nextDeliveryAt lastModelError probingClass productRecordKey createdAt updatedAt workflowVersion __file recoveryHistory maintenanceHistory').split(' '));
const read = file => { try { return fs.readFileSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
export const sha256 = bytes => bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const json = file => parse(fs.readFileSync(file));
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
const fail = message => { throw Error(message); };
const insist = (condition, message) => { if (!condition) fail(message); };
const win = value => path.win32.normalize(value).toLowerCase();
const equalPath = (a, b) => typeof a === 'string' && typeof b === 'string' && win(a) === win(b);
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function safeObject(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    insist(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe object key');
    safeObject(value[key]);
  }
}
export function permittedRepoPath(relative, date = new Date().toISOString().slice(0, 10)) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.startsWith('/') || /[\x00-\x1f:<>"|?*]/.test(relative)) return false;
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) return false;
  if (['AGENTS.md', '.gitignore', 'docs/RAKEEZ_OPS_CONTRACT.md', 'docs/PROJECT_INSTRUCTIONS.md', 'docs/HOURLY_REPORT_MAINTENANCE_PROMPT.txt'].includes(relative)) return true;
  if (relative.startsWith('docs/automation-evidence/' + date.replaceAll('-', '') + '/')) return !parts.some(p => /^(private|secrets?|credentials?|tokens?)$/i.test(p));
  return relative.startsWith('scripts/ops-supervisor-v4/') && !parts.some(p => /^(private|runtime|artifacts|queue|attempts|sessions?|leases|node_modules|\.git|\.env(?:\..*)?)$/i.test(p)) && !/\.(?:sql|pem|key|pfx|p12)$/i.test(relative);
}
export function validatePayload(payload, date = new Date().toISOString().slice(0, 10)) {
  safeObject(payload);
  insist(payload?.version === 1, 'Expected payload version 1');
  for (const field of ['taskId', 'activationId']) insist(ID.test(payload[field] ?? ''), 'Invalid ' + field);
  for (const field of ['repoRoot', 'opsWorktree', 'runtimeRoot']) insist(typeof payload[field] === 'string' && /^[A-Za-z]:[\\/]/.test(payload[field]) && !/[\x00-\x1f]/.test(payload[field]), 'Expected absolute Windows ' + field);
  insist(equalPath(payload.runtimeRoot, path.win32.join(payload.repoRoot, 'artifacts', 'ops-supervisor-v4')), 'Runtime must be the canonical ops runtime');
  insist(!equalPath(payload.repoRoot, payload.opsWorktree), 'An isolated ops worktree is required');
  insist(typeof payload.commitMessage === 'string' && payload.commitMessage.length <= 300 && /\[AI\]/.test(payload.commitMessage) && !/[\r\n\x00]/.test(payload.commitMessage), 'Expected one AI-identified commit subject');
  insist(Array.isArray(payload.files) && payload.files.length > 0, 'No reviewed files');
  const paths = new Set();
  for (const file of payload.files) {
    insist(permittedRepoPath(file.repoPath, date), 'Outside permitted ops/instruction paths: ' + file.repoPath);
    insist(!paths.has(file.repoPath.toLowerCase()), 'Duplicate file path'); paths.add(file.repoPath.toLowerCase());
    insist(typeof file.content === 'string' && SHA256.test(file.sha256 ?? '') && sha256(Buffer.from(file.content, 'utf8')) === file.sha256, 'Content hash mismatch: ' + file.repoPath);
    insist(file.expectedCanonicalSha256 === null || SHA256.test(file.expectedCanonicalSha256 ?? ''), 'Expected canonical hash or explicit null: ' + file.repoPath);
  }
  const allowed = payload.allowActiveTaskIds ?? [];
  insist(Array.isArray(allowed) && allowed.every(id => ID.test(id)) && new Set(allowed).size === allowed.length, 'Invalid active-task exceptions');
  const requireNoActiveWorkers = payload.requireNoActiveWorkers ?? allowed.length === 0;
  insist(typeof requireNoActiveWorkers === 'boolean' && !(requireNoActiveWorkers && allowed.length), 'Conflicting worker guards');
  insist(Array.isArray(payload.cardUpdates), 'cardUpdates must be an array');
  const taskIds = new Set();
  for (const update of payload.cardUpdates) {
    const { card, expected, materialReason } = update;
    insist(card && expected && ID.test(card.id ?? '') && card.activationId === payload.activationId, 'Invalid activated source card');
    insist(!taskIds.has(card.id) && !allowed.includes(card.id), 'Duplicate or active card update'); taskIds.add(card.id);
    insist(Object.keys(card).every(key => !RUNTIME_KEYS.has(key)), 'Source card contains runtime state: ' + card.id);
    insist(expected.id === card.id && (expected.status === 'blocked' || expected.status === 'delivery' && card.completionMode === 'deferred_by_po' && card.deferralAuthority === 'PO-20261014-ABANDON-DUMMY-ACCOUNTS') && typeof expected.sessionId === 'string' && ID.test(expected.lastRunId ?? '') && GIT_SHA.test(expected.candidateSha ?? ''), 'Expected exact blocked session/run/candidate: ' + card.id);
    insist(typeof card.productId === 'string' && typeof card.scopeKey === 'string' && Array.isArray(card.allowedPaths) && Array.isArray(card.requiredChecks) && card.requiredChecks.every(x => typeof x === 'string' && x.length), 'Incomplete source card: ' + card.id);
    insist(typeof materialReason === 'string' && materialReason.trim().length >= 15, 'A concrete material repair is required');
  }
  if (payload.cardUpdates.length) {
    const file = payload.files.find(x => x.repoPath === payload.sourceCardFile);
    insist(file && file.repoPath.startsWith('scripts/ops-supervisor-v4/') && file.repoPath.endsWith('.json'), 'Reviewed source card wrapper is missing');
    const wrapper = JSON.parse(file.content);
    insist(wrapper.activationId === payload.activationId && Array.isArray(wrapper.tasks) && wrapper.tasks.length === taskIds.size, 'Source wrapper activation or task count mismatch');
    for (const update of payload.cardUpdates) insist(wrapper.tasks.filter(c => c.id === update.card.id).length === 1 && same(wrapper.tasks.find(c => c.id === update.card.id), update.card), 'Source wrapper differs from card payload: ' + update.card.id);
  }
  return { taskId: payload.taskId, files: payload.files.map(f => f.repoPath), taskIds: [...taskIds], allowActiveTaskIds: allowed, requireNoActiveWorkers };
}

// Keep all 100 ns digits; Date.parse alone incorrectly equates nearby births.
export function utcTicks(value) {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,7}))?(Z|[+-]\d\d:\d\d)$/.exec(value ?? '');
  insist(m && Number.isFinite(Date.parse(m[1] + m[3])), 'Invalid process creation time');
  return BigInt(Date.parse(m[1] + m[3])) * 10000n + BigInt((m[2] ?? '').padEnd(7, '0'));
}
export function reviewedPreimageMatches(actual, reviewed) {
  if (actual === null || reviewed === null) return actual === reviewed;
  const normalized = value => value.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return normalized(actual) === normalized(reviewed);
}
export function verifyInactiveIdentity(task, result, update, activationId) {
  const e = update.expected;
  insist(task.id === e.id && task.activationId === activationId && task.productId === update.card.productId && task.scopeKey === update.card.scopeKey, 'Task identity/scope changed: ' + e.id);
  insist(task.status === e.status && (task.status === 'blocked' || task.status === 'delivery' && update.card.completionMode === 'deferred_by_po') && task.sessionId === e.sessionId && task.attempt?.runId === e.lastRunId && !task.runnerPid && !task.brokerPid, 'Task is no longer the exact inactive attempt: ' + e.id);
  insist(task.lastWorkerReap?.exactAbsence === true && task.lastWorkerReap.activationId === activationId && task.lastWorkerReap.runId === e.lastRunId && Array.isArray(task.lastWorkerReap.owners) && task.lastWorkerReap.owners.length > 0, 'No exact owned-process absence proof: ' + e.id);
  const evidenceOnly = update.card.completionMode === 'record_published_evidence' && e.resultState === 'LOCAL_READY' && result.state === 'LOCAL_READY' && !update.card.liveMutation && !update.card.liveAuthorizationRef && update.card.evidenceOnly?.acceptanceAuthority && result.changedPaths?.length && result.changedPaths.every(p => /^docs\/automation-evidence\/\d{8}\/[a-zA-Z0-9_-]+\.(md|json)$/.test(p) && update.card.allowedPaths.includes(p)) && update.card.requiredChecks?.length && update.card.requiredChecks.every(name => result.checks?.some(c => c.name === name && c.status === 'PASS')) && result.checks.every(c => c.status === 'PASS') && result.blockerType === 'none' && !result.blocker;
  const poDeferred = update.card.completionMode === 'deferred_by_po' && update.card.deferralAuthority === 'PO-20261014-ABANDON-DUMMY-ACCOUNTS' && update.card.productId === 'N58' && update.card.id === 'continuous-n58-empty-account-reviewed-recovery-20261014' && update.card.deferralReason?.length >= 20 && ['LOCAL_READY','BLOCKED'].includes(result.state);
  const d = task.deliveryReceipt, proof = update.card.verificationRepair;
  const deliveryRecheck = update.card.completionMode === 'recheck_existing_publication' && result.state === 'LOCAL_READY'
    && e.resultState === 'LOCAL_READY' && !update.card.liveMutation && !update.card.liveAuthorizationRef
    && d?.errorCode === 'SOURCE_PARITY_PENDING'
    // A terminal source-parity receipt may be rechecked ONLY after a separately reviewed
    // material verifier repair; all existing provider, immutable, identity and PASS guards remain.
    && (d.status === 'pending' || (d.status === 'blocked' && d.retryable === false
      && typeof task.lastFailure === 'string' && task.lastFailure.startsWith('SOURCE_PARITY_PENDING:')))
    && d.candidateSha === e.candidateSha
    && d.publishedSha === proof?.publishedSha && sha256(bytes(d)) === proof?.priorReceiptSha256
    && SHA256.test(proof?.reviewedFixtureSha256 ?? '') && proof?.reason?.length >= 20
    && d.provider?.conclusion === 'success' && d.provider?.headSha === d.publishedSha && d.evidence?.immutable?.passed === true
    && result.checks?.every(x => x.status === 'PASS') && update.card.requiredChecks?.every(name => result.checks.some(x => x.name === name && x.status === 'PASS'));
  insist(result.taskId === e.id && result.runId === e.lastRunId && (result.state === 'BLOCKED' || evidenceOnly || deliveryRecheck || poDeferred) && result.candidateSha === e.candidateSha, 'Worker result identity changed: ' + e.id);
  insist(equalPath(result.worktreePath, task.worktreePath), 'Result worktree mismatch: ' + e.id);
  const savedBinding = e.queuedBaseSha !== undefined || e.queuedCandidateSha !== undefined;
  if (savedBinding) {
    // A blocked worker may have reconciled a newer main base without any queued candidate yet.
    // Require the explicit null marker AND actual nullish queue state; every other identity guard stays exact.
    const noQueuedCandidate = e.queuedCandidateSha === null && task.candidateSha == null;
    insist(GIT_SHA.test(e.queuedBaseSha ?? '') && (noQueuedCandidate || GIT_SHA.test(e.queuedCandidateSha ?? '')) && GIT_SHA.test(e.baseSha ?? ''), 'Incomplete reviewed queued/result binding: ' + e.id);
    insist(task.baseSha === e.queuedBaseSha && (noQueuedCandidate || task.candidateSha === e.queuedCandidateSha) && result.baseSha === e.baseSha, 'Reviewed queued/result preimage changed: ' + e.id);
  } else {
    insist(result.baseSha === task.baseSha, 'Result base mismatch: ' + e.id);
    insist(task.candidateSha == null || task.candidateSha === e.candidateSha, 'Queue candidate differs from result: ' + e.id);
  }
  if (e.worktreePath) insist(equalPath(task.worktreePath, e.worktreePath), 'Expected worktree changed');
  if (e.baseSha && !savedBinding) insist(task.baseSha === e.baseSha, 'Expected base changed');
  return true;
}
export function catalogSourceBinding(catalogTasks, task, update, sourceCardFile, expectedSourceSha256) {
  const previous = catalogTasks.filter(t => t.id === update.card.id);
  if (previous.length === 1) {
    insist(previous[0].activationId === update.card.activationId && previous[0].productId === update.card.productId && previous[0].scopeKey === update.card.scopeKey, 'Catalog source identity changed');
    return { kind: 'catalog', index: catalogTasks.indexOf(previous[0]), baseline: previous[0] };
  }
  insist(previous.length === 0, 'Catalog source identity changed');
  const sourceName = path.win32.basename(sourceCardFile ?? '');
  insist(task?.approvedNote?.source === sourceName && task.approvedNote.sha256 === expectedSourceSha256, 'Approved-note source identity changed');
  return { kind: 'approved-note', index: -1, baseline: task, approvedNoteSha256: task.approvedNote.sha256 };
}

export function reviewedSourcePreimageMatches(remoteBytes, opsBytes, canonicalBytes, file, approvedNoteSha256 = null) {
  if (reviewedPreimageMatches(remoteBytes, canonicalBytes) && reviewedPreimageMatches(opsBytes, canonicalBytes)) return true;
  return remoteBytes === null && opsBytes === null && canonicalBytes !== null
    && approvedNoteSha256 === file.expectedCanonicalSha256
    && sha256(canonicalBytes) === file.expectedCanonicalSha256;
}

export function revisedTask(task, update, commit, at) {
  const saved = structuredClone(task);
  const event = { at, commit, kind: 'reviewed-material-maintenance', reason: update.materialReason, previousRunId: task.attempt.runId, sessionId: task.sessionId, preservedCandidateSha: update.expected.candidateSha, previousQueuedCandidateSha: task.candidateSha, previousQueuedBaseSha: task.baseSha, preservedResultBaseSha: update.expected.baseSha ?? task.baseSha, previousFailure: task.lastFailure ?? null, previousImplementationFailures: task.implementationFailures ?? 0, previousInfrastructureRetries: task.infrastructureRetries ?? 0 };
  Object.assign(saved, structuredClone(update.card), { status: 'pending', candidateSha: update.expected.candidateSha, baseSha: update.expected.baseSha ?? task.baseSha, implementationFailures: 0, infrastructureRetries: 0, failureClass: null, lastFailure: null, retryAt: null, nextDeliveryAt: null, probingClass: null, lastModelError: null, productRecordKey: null, updatedAt: at, recoveryHistory: [...(task.recoveryHistory ?? []), event] });
  if (update.card.completionMode === 'recheck_existing_publication') {
    saved.status = 'delivery'; saved.nextDeliveryAt = at; saved.lastFailure = null;
    saved.sourceParityHistory = [...(task.sourceParityHistory ?? []), { at, reason: update.materialReason, receipt: structuredClone(task.deliveryReceipt) }];
    saved.sourceParityState = null;
  }
  if (update.card.completionMode === 'deferred_by_po') {
    insist(typeof update.card.deferralReason === 'string' && update.card.deferralReason.length >= 20, 'Explicit PO deferral reason required');
    saved.status = 'blocked'; saved.lastFailure = 'DEFERRED_BY_PO: ' + update.card.deferralReason; saved.failureClass = 'external';
  }
  return saved;
}

const ps = script => execFileSync(WIN_PS, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop'\n" + script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 }).trim();
function inventory(pids) {
  const ids = [...new Set(pids)];
  insist(ids.length && ids.every(n => Number.isSafeInteger(n) && n > 0), 'Invalid process identity');
  const filter = ids.map(n => 'ProcessId=' + n).join(' OR ');
  const output = ps('@(Get-CimInstance Win32_Process -Filter ' + literal(filter) + ' | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;createdAt=$_.CreationDate.ToUniversalTime().ToString("o");name=[string]$_.Name} }) | ConvertTo-Json -Depth 3 -Compress');
  const rows = output ? JSON.parse(output) : [];
  return Array.isArray(rows) ? rows : [rows];
}
function noLinks(file) {
  let item = path.resolve(file);
  while (true) { const stat = fs.existsSync(item) ? fs.lstatSync(item) : null; insist(!stat?.isSymbolicLink(), 'Symlink/junction is outside maintenance scope: ' + item); const parent = path.dirname(item); if (parent === item) break; item = parent; }
}
function replaceGuarded(file, content, expectedHash) {
  noLinks(file); insist(sha256(read(file)) === expectedHash, 'File changed before write: ' + file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.maintenance-' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, content, { flag: 'wx' });
  try {
    insist(sha256(read(file)) === expectedHash, 'File changed before replace: ' + file);
    try { fs.renameSync(temp, file); }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || expectedHash === null || !fs.existsSync(file)) throw error;
      ps('$target=' + literal(file) + '\nif ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne ' + literal(expectedHash) + ') { throw "Concurrent file change" }\n[IO.File]::Replace(' + literal(temp) + ',$target,[NullString]::Value)');
    }
    insist(sha256(read(file)) === sha256(content), 'Installed bytes differ: ' + file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function safeError(error) {
  const redact = value => String(value ?? '').replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@').replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, '[REDACTED]').replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]');
  const stderr = redact(error.stderr).slice(-2500), stdout = redact(error.stdout).slice(-2500);
  return { message: redact(error.message).split('\n')[0].slice(0, 700), ...(stderr ? { stderr } : {}), ...(stdout ? { stdout } : {}), ...(Number.isInteger(error.status) ? { exitCode: error.status } : {}) };
}

export async function applyReviewedMaintenance(payload, payloadHash) {
  const plan = validatePayload(payload);
  insist(process.platform === 'win32', '--apply is a Windows-native operation; --check is portable');
  const { repoRoot: root, opsWorktree: ops, runtimeRoot: rt } = payload;
  for (const dir of [root, ops, rt]) { noLinks(dir); insist(fs.statSync(dir).isDirectory(), 'Missing directory: ' + dir); }
  const startedAt = new Date().toISOString(), token = randomUUID();
  const me = inventory([process.pid]).find(p => p.pid === process.pid); insist(me, 'Cannot establish maintenance process birth');
  const lockPath = path.join(rt, 'maintenance.lock.json'), stopPath = path.join(rt, 'STOP');
  const owner = { version: 1, owner: 'apply-reviewed-maintenance', taskId: payload.taskId, token, nodePID: process.pid, processCreationTime: me.createdAt, activationId: payload.activationId, startedAt, payloadSha256: payloadHash };
  // Atomic wx is the lock. Existing locks, including stale/unknown ones, are never removed.
  const ownerBytes = bytes(owner);
  fs.writeFileSync(lockPath, ownerBytes, { flag: 'wx' });
  const evidenceRoot = path.join(rt, 'maintenance', payload.taskId, token);
  const receipt = { version: 1, ...owner, status: 'LOCKED', evidenceRoot, steps: [], committed: false, pushed: false, opsWrittenPaths: [], installedPaths: [], catalogUpdated: false, activatedTasks: [], touchedWorkerProcesses: [] };
  let ownStop = false, stopBytes, pausedAt = 0, controller, beforeCatalog;
  const queueBefore = new Map(), sourceBindings = new Map(), opsPreimageHashes = new Map();
  const record = (stage, detail = {}) => { receipt.stage = stage; receipt.steps.push({ at: new Date().toISOString(), stage, ...detail }); replaceGuarded(path.join(evidenceRoot, 'progress.json'), bytes(receipt), sha256(read(path.join(evidenceRoot, 'progress.json')))); };
  const ownsLock = () => read(lockPath)?.equals(ownerBytes) === true;
  const git = (args, cwd = ops, timeout = 45000) => execFileSync(WIN_GIT, ['-c', 'core.longpaths=true', ...args], { cwd, encoding: 'utf8', timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }).trim();
  const gitRaw = args => execFileSync(WIN_GIT, ['-c', 'core.longpaths=true', ...args], { cwd: ops, encoding: 'utf8', timeout: 20000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const dirtyPaths = () => gitRaw(['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0').filter(Boolean).map(line => { insist(!/[RC]/.test(line.slice(0, 2)), 'Renames/copies are outside this maintenance operation'); return line.slice(3); });
  function inspectController() {
    insist(ownsLock(), 'Maintenance lock identity changed');
    const active = json(path.join(rt, 'ACTIVE_TASKS.json')), id = json(path.join(rt, 'CONTROLLER_IDENTITY.json'));
    insist(active.activationId === payload.activationId && id.pid === controller.pid && id.instanceId === controller.instanceId && utcTicks(id.createdAt) === utcTicks(controller.createdAt), 'Controller identity changed during maintenance');
    const observed = inventory([id.pid]).find(p => p.pid === id.pid);
    insist(observed && utcTicks(observed.createdAt) === utcTicks(id.createdAt), 'Controller process is absent or PID was reused');
    insist(active.controllerPid === id.pid && active.instanceId === id.instanceId && active.controllerAlive === true && active.processInventoryKnown === true, 'Unverified controller snapshot');
    insist((active.active ?? []).every(t => plan.allowActiveTaskIds.includes(t.id)), 'An unapproved active task is present');
    if (plan.requireNoActiveWorkers) insist((active.active ?? []).length === 0 && active.runningCount === 0, 'Maintenance requires no active workers');
    return active;
  }
  function pausedIdle() {
    insist(ownStop && read(stopPath)?.equals(stopBytes) && !fs.existsSync(path.join(rt, 'STOP-REFILL')), 'Maintenance pause ownership changed');
    const active = inspectController();
    return active.paused === true && Date.parse(active.at) >= pausedAt && Date.now() - Date.parse(active.at) < 25000 && !active.deliveryInFlight && !fs.existsSync(path.join(rt, 'leases', 'integration.json')) ? active : null;
  }
  function exactInactive(update) {
    const file = path.join(rt, 'queue', update.card.id + '.json'); noLinks(file);
    const raw = fs.readFileSync(file), task = parse(raw), run = update.expected.lastRunId;
    const resultPath = path.join(rt, 'attempts', update.card.id, run, 'result.json'); noLinks(resultPath);
    insist(equalPath(task.resultPath ?? task.attempt?.outputPath, resultPath), 'Unexpected result path: ' + task.id);
    const resultBytes = fs.readFileSync(resultPath), result = parse(resultBytes);
    verifyInactiveIdentity(task, result, update, payload.activationId);
    insist(equalPath(task.worktreePath, path.join(root, '.worktrees', task.id)), 'Task worktree is outside its owned path');
    noLinks(task.worktreePath);
    insist(git(['rev-parse', 'HEAD'], task.worktreePath) === update.expected.candidateSha, 'Worktree HEAD differs from preserved candidate: ' + task.id);
    insist(!git(['status', '--porcelain=v1', '--untracked-files=no'], task.worktreePath), 'Candidate has tracked uncommitted changes: ' + task.id);
    if (update.expected.queuedBaseSha !== undefined) {
      const remoteMain = git(['ls-remote', '--heads', 'origin', 'refs/heads/main']).split(/\s+/)[0];
      insist(GIT_SHA.test(remoteMain), 'Published main binding missing');
      git(['merge-base', '--is-ancestor', update.expected.queuedBaseSha, result.baseSha], task.worktreePath);
      git(['merge-base', '--is-ancestor', result.baseSha, remoteMain], task.worktreePath);
      git(['merge-base', '--is-ancestor', result.baseSha, result.candidateSha], task.worktreePath);
    }
    const owners = task.lastWorkerReap.owners, alive = inventory(owners.map(p => p.pid));
    for (const saved of owners) insist(!alive.some(p => p.pid === saved.pid && utcTicks(p.createdAt) === utcTicks(saved.createdAt)), 'An owned worker process remains alive: ' + task.id);
    return { file, raw, task, resultSha256: sha256(resultBytes), candidateSha: result.candidateSha };
  }
  try {
    noLinks(evidenceRoot); fs.mkdirSync(evidenceRoot, { recursive: true });
    record('LOCKED');
    const config = json(path.join(rt, 'workflow-v5.json'));
    insist(config.controller?.activationId === payload.activationId, 'Activation changed');
    insist(!fs.existsSync(stopPath) && !fs.existsSync(path.join(rt, 'STOP-REFILL')), 'An existing stop marker requires its owner; it will not be removed');
    controller = json(path.join(rt, 'CONTROLLER_IDENTITY.json')); receipt.controllerBefore = controller;
    const prePause = inspectController();
    insist(Date.now() - Date.parse(prePause.at) < 25000 && Date.parse(prePause.at) <= Date.now() + 1000 && !prePause.deliveryInFlight && !fs.existsSync(path.join(rt, 'leases', 'integration.json')), 'Before STOP: a fresh publisher-idle snapshot is required');
    receipt.activeBefore = prePause.active; record('PRE_PAUSE_VERIFIED', { activeTaskIds: prePause.active.map(t => t.id) });
    stopBytes = bytes({ ...owner, purpose: 'Pause only new admission/delivery; existing allowed workers continue' });
    pausedAt = Date.now(); fs.writeFileSync(stopPath, stopBytes, { flag: 'wx' }); ownStop = true;
    let active;
    for (let i = 0; i < 20; i++) { active = pausedIdle(); if (active) break; await new Promise(resolve => setTimeout(resolve, 1000)); }
    insist(active, 'No fresh paused publisher-idle acknowledgement');
    receipt.activeBefore = active.active; record('PAUSED_PUBLISHER_IDLE', { activeTaskIds: active.active.map(t => t.id) });
    const catalogPath = path.join(rt, 'intake-catalog.json'); noLinks(catalogPath);
    beforeCatalog = fs.readFileSync(catalogPath); const catalog = parse(beforeCatalog);
    insist(catalog.currentActivationId === payload.activationId && Array.isArray(catalog.tasks), 'Catalog activation changed');
    for (const update of payload.cardUpdates) {
      const state = exactInactive(update); queueBefore.set(update.card.id, state);
      const sourceSpec = payload.files.find(file => file.repoPath === payload.sourceCardFile);
      const binding = catalogSourceBinding(catalog.tasks, state.task, update, payload.sourceCardFile, sourceSpec.expectedCanonicalSha256);
      sourceBindings.set(update.card.id, binding);
      insist((binding.baseline.requiredChecks ?? []).every(check => update.card.requiredChecks.includes(check)), 'This helper cannot remove required checks');
    }
    insist(!dirtyPaths().length, 'Ops checkout must be clean before maintenance');
    const common = cwd => path.resolve(cwd, git(['rev-parse', '--git-common-dir'], cwd));
    insist(equalPath(common(root), common(ops)), 'Ops checkout belongs to another repository');
    git(['fetch', '--no-write-fetch-head', '--no-tags', 'origin', 'main']);
    const remoteHead = git(['ls-remote', '--heads', 'origin', 'refs/heads/main']).split(/\s+/)[0]; insist(GIT_SHA.test(remoteHead), 'Cannot observe remote main');
    git(['cat-file', '-e', remoteHead + '^{commit}']); git(['merge', '--ff-only', remoteHead]);
    receipt.baseSha = git(['rev-parse', 'HEAD']); insist(receipt.baseSha === remoteHead, 'Ops checkout has unpublished commits; this helper will not include them');
    insist(!dirtyPaths().length, 'Ops checkout changed while preparing');
    for (const file of payload.files) {
      const canonicalFile = path.join(root, file.repoPath), opFile = path.join(ops, file.repoPath); noLinks(canonicalFile); noLinks(opFile);
      const original = read(canonicalFile); insist(sha256(original) === file.expectedCanonicalSha256, 'Canonical hash differs from review: ' + file.repoPath);
      const remoteEntry = gitRaw(['ls-tree', '-z', remoteHead, '--', file.repoPath]);
      const remoteBytes = remoteEntry ? Buffer.from(gitRaw(['show', remoteHead + ':' + file.repoPath]), 'utf8') : null;
      const approvedBinding = file.repoPath === payload.sourceCardFile ? [...sourceBindings.values()].find(binding => binding.kind === 'approved-note') : null;
      insist(reviewedSourcePreimageMatches(remoteBytes, read(opFile), original, file, approvedBinding?.approvedNoteSha256 ?? null), 'Remote main preimage differs from canonical review: ' + file.repoPath);
      opsPreimageHashes.set(file.repoPath, sha256(read(opFile)));
      if (original !== null) { const backup = path.join(evidenceRoot, 'before-files', file.repoPath); fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.writeFileSync(backup, original, { flag: 'wx' }); }
    }
    fs.writeFileSync(path.join(evidenceRoot, 'catalog-before.json'), beforeCatalog, { flag: 'wx' });
    for (const [id, state] of queueBefore) fs.writeFileSync(path.join(evidenceRoot, id + '.before.json'), state.raw, { flag: 'wx' });
    record('PREFLIGHT_VERIFIED', { candidates: [...queueBefore].map(([id, s]) => ({ id, candidateSha: s.candidateSha, resultSha256: s.resultSha256, sessionId: s.task.sessionId, runId: s.task.attempt.runId })) });
    for (const file of payload.files) { replaceGuarded(path.join(ops, file.repoPath), Buffer.from(file.content, 'utf8'), opsPreimageHashes.get(file.repoPath)); receipt.opsWrittenPaths.push(file.repoPath); }
    record('OPS_FILES_WRITTEN');
    const permitted = new Set(plan.files), dirty = dirtyPaths(); insist(dirty.every(p => permitted.has(p)), 'Unlisted ops change before staging');
    git(['-c', 'core.whitespace=-blank-at-eof,-blank-at-eol,-space-before-tab', 'diff', '--check']);
    if (dirty.length) {
      git(['add', '--', ...plan.files]);
      const staged = gitRaw(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean); insist(staged.length && staged.every(p => permitted.has(p)), 'Unlisted staged path');
      git(['-c', 'core.whitespace=-blank-at-eof,-blank-at-eol,-space-before-tab', 'diff', '--cached', '--check']); git(['commit', '-m', payload.commitMessage]); receipt.committed = true;
    }
    const commit = git(['rev-parse', 'HEAD']); receipt.commit = commit;
    if (receipt.committed) insist(gitRaw(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', commit]).split('\0').filter(Boolean).every(p => permitted.has(p)), 'Unlisted committed path');
    insist(!dirtyPaths().length, 'Unexpected remaining ops modifications');
    record('COMMITTED');
    insist(pausedIdle(), 'Pause lost before push'); git(['push', 'origin', 'HEAD:main']); receipt.pushed = true;
    insist(git(['ls-remote', '--heads', 'origin', 'refs/heads/main']).split(/\s+/)[0] === commit, 'Remote main changed after maintenance push'); record('PUSH_VERIFIED');
    for (const file of payload.files) {
      replaceGuarded(path.join(root, file.repoPath), Buffer.from(file.content, 'utf8'), file.expectedCanonicalSha256); receipt.installedPaths.push(file.repoPath); record('INSTALLING');
    }
    insist(pausedIdle(), 'Pause lost before card activation');
    insist(sha256(read(catalogPath)) === sha256(beforeCatalog), 'Catalog changed before activation');
    for (const update of payload.cardUpdates) { const fresh = exactInactive(update); insist(sha256(fresh.raw) === sha256(queueBefore.get(update.card.id).raw), 'Queue changed before activation: ' + update.card.id); }
    const at = new Date().toISOString();
    for (const update of payload.cardUpdates) {
      const binding = sourceBindings.get(update.card.id), index = catalog.tasks.findIndex(t => t.id === update.card.id);
      if (binding.kind === 'catalog') { insist(index === binding.index && index >= 0, 'Catalog source changed before activation'); catalog.tasks[index] = structuredClone(update.card); }
      else insist(index === -1, 'Approved-note task unexpectedly appeared in catalog');
    }
    if (payload.cardUpdates.length) {
      catalog.updatedAt = at;
      catalog.followupSources = [...(catalog.followupSources ?? []), { commit, sourceFile: path.join(root, payload.sourceCardFile), sourceSha256: payload.files.find(f => f.repoPath === payload.sourceCardFile).sha256, updatedTaskIds: plan.taskIds, at, maintenanceToken: token }];
      replaceGuarded(catalogPath, bytes(catalog), sha256(beforeCatalog)); receipt.catalogUpdated = true; record('CATALOG_UPDATED');
      for (const update of payload.cardUpdates) {
        insist(pausedIdle(), 'Pause lost during activation');
        const state = queueBefore.get(update.card.id), revised = revisedTask(state.task, update, commit, at);
        replaceGuarded(state.file, bytes(revised), sha256(state.raw));
        receipt.activatedTasks.push({ id: revised.id, status: revised.status, sessionId: revised.sessionId, runId: revised.attempt.runId, candidateSha: revised.candidateSha, reason: update.materialReason }); record('CARD_ACTIVATED');
      }
    }
    receipt.activeAfter = json(path.join(rt, 'ACTIVE_TASKS.json')).active;
    receipt.status = 'INSTALLED_AND_ACTIVATED'; record('COMPLETE');
  } catch (error) {
    receipt.status = receipt.committed || receipt.opsWrittenPaths.length || receipt.pushed || receipt.installedPaths.length || receipt.activatedTasks.length ? 'PARTIAL_FAILURE' : 'FAILED'; receipt.error = safeError(error);
    try { record('FAILED'); } catch (loggingError) { receipt.evidenceError = safeError(loggingError); }
  } finally {
    receipt.cleanupErrors = [];
    receipt.pauseCreated = ownStop;
    try { if (ownStop && read(stopPath)?.equals(stopBytes)) fs.unlinkSync(stopPath); receipt.ownedPauseRemoved = ownStop ? !read(stopPath)?.equals(stopBytes) : true; } catch (error) { receipt.cleanupErrors.push(safeError(error)); }
    try { if (ownsLock()) fs.unlinkSync(lockPath); receipt.ownedLockRemoved = !ownsLock(); } catch (error) { receipt.cleanupErrors.push(safeError(error)); }
    receipt.finishedAt = new Date().toISOString();
    if (receipt.cleanupErrors.length) receipt.status = 'PARTIAL_FAILURE';
    try { noLinks(evidenceRoot); fs.mkdirSync(evidenceRoot, { recursive: true }); replaceGuarded(path.join(evidenceRoot, 'receipt.json'), bytes(receipt), sha256(read(path.join(evidenceRoot, 'receipt.json')))); } catch (error) { receipt.finalEvidenceError = safeError(error); receipt.status = 'PARTIAL_FAILURE'; }
  }
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), mode = args[0]; insist(['--check', '--apply'].includes(mode) && args.length === 2, 'Usage: node apply-reviewed-maintenance.mjs --check|--apply payload.json');
    const raw = fs.readFileSync(path.resolve(args[1])), payload = parse(raw);
    if (mode === '--check') console.log(JSON.stringify({ status: 'LOCAL_PAYLOAD_CHECK_PASS', payloadSha256: sha256(raw), ...validatePayload(payload), liveStateChecked: false, mutationPerformed: false }));
    else { const result = await applyReviewedMaintenance(payload, sha256(raw)); console.log(JSON.stringify(result)); if (result.status !== 'INSTALLED_AND_ACTIVATED') process.exitCode = 1; }
  } catch (error) { console.error(JSON.stringify({ status: 'FAILED_BEFORE_APPLY_OR_LOCK', error: safeError(error) })); process.exitCode = 1; }
}
