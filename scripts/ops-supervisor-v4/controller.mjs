#!/usr/bin/env node
/** One durable owner of the activated queue. No model planner and no PM polling. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readApprovedNotes } from './approved-notes.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHA = /^[a-f0-9]{40}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,139}$/;
const OUTAGE = new Set(['quota', 'network', 'auth']);
const normalize = value => String(value ?? '').replaceAll('\\', '/').toLowerCase();
const timestamp = value => Date.parse(value ?? '') || 0;
const clean = value => String(value ?? '').replace(/\b(?:github_pat_|gh[pousr]_|sb_secret_)[A-Za-z0-9_]+/g, '[redacted]')
  .replace(/\b(?:access_token|refresh_token|authorization)\s*[=:]\s*[^\s,;]+/gi, '[redacted]').slice(-5000);
const parse = value => JSON.parse(String(value).replace(/^\uFEFF/, ''));
export async function readJson(file, fallback = null) {
  try { return parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
export async function replaceWindowsFile(temporary, file, {platform=process.platform, execute=runCommand}={}) {
  if (platform !== 'win32' || path.dirname(temporary) !== path.dirname(file)) return false;
  const destination = await fs.lstat(file).catch(error => { if(error.code === 'ENOENT')return null;throw error; });
  if (!destination?.isFile() || destination.isSymbolicLink()) return false;
  const previous = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const expected = createHash('sha256').update(await fs.readFile(temporary)).digest('hex');
  const literal = value => "'"+String(value).replaceAll("'","''")+"'";
  const command = "$ErrorActionPreference='Stop';$target="+literal(file)+";$temp="+literal(temporary)+";if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne '"+previous+"'){throw 'Concurrent destination change'};[IO.File]::Replace($temp,$target,[NullString]::Value)";
  const result = await execute('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{timeoutMs:10000});
  if (result.code !== 0) return false;
  if (createHash('sha256').update(await fs.readFile(file)).digest('hex') !== expected) throw Error('Native replacement readback differs');
  return true;
}
export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let handle, ownsTemporary = false;
  try {
    handle = await fs.open(temporary, 'wx'); ownsTemporary = true;
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
    await handle.close(); handle = null;
    const backoff = [50, 100, 200, 400, 800];
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temporary, file); ownsTemporary = false; break; }
      catch (error) {
        // Windows readers may briefly deny replacement. Keep the same bytes
        // and atomic rename; a persistent lock remains an explicit failure.
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
        if (attempt >= backoff.length) {
          // Native atomic replace preserves the destination ACL and never deletes the target first.
          if (await replaceWindowsFile(temporary,file)) { ownsTemporary=false;break; }
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, backoff[attempt]));
      }
    }
  } catch (error) {
    try { await handle?.close(); } catch { /* Preserve the write/rename error. */ }
    if (ownsTemporary) {
      try { await fs.rm(temporary, { force: true }); } catch { /* Only our temp; never mask the original failure. */ }
    }
    throw error;
  }
}
async function exists(file) { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', size = 0, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeoutMs ?? 45000);
    const receive = target => chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) child.kill(); else if (target === 'out') stdout += chunk; else stderr += chunk; };
    child.stdout.on('data', receive('out')); child.stderr.on('data', receive('err'));
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); if (timedOut || size > 8 * 1024 * 1024) reject(new Error(timedOut ? 'Command timed out' : 'Command output limit')); else resolve({ code, stdout, stderr }); });
  });
}
export async function spawnDetachedLogged(command, args, options) {
  let stdout, stderr;
  try {
    stdout = await fs.open(options.stdoutPath, 'wx');
    stderr = await fs.open(options.stderrPath, 'wx');
    // Child-owned file handles survive controller restarts; pipes would not.
    const child = spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true, detached: true,
      stdio: ['ignore', stdout.fd, stderr.fd] });
    await new Promise((resolve, reject) => { child.once('error', reject); child.once('spawn', resolve); });
    child.unref(); return child;
  } finally { await Promise.all([stdout?.close(), stderr?.close()]); }
}
const POWERSHELL = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe';
const INVENTORY = "@(Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId;name=$_.Name;commandLine=$_.CommandLine;createdAt=$_.CreationDate.ToUniversalTime().ToString('o')} }) | ConvertTo-Json -Compress -Depth 3";
export async function windowsInventory(command = runCommand, powershell = POWERSHELL) {
  const result = await command(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(INVENTORY, 'utf16le').toString('base64')]);
  if (result.code !== 0) throw new Error('Process inventory unavailable: ' + clean(result.stderr));
  const rows = parse(result.stdout); return Array.isArray(rows) ? rows : rows ? [rows] : [];
}
export function identityMatches(processRow, expected) {
  return Boolean(processRow && expected && Number(processRow.pid) === Number(expected.pid)
    && expected.createdAt && timestamp(processRow.createdAt) === timestamp(expected.createdAt));
}
export function workerProcesses(task, checkpoint, processes) {
  const attempt = task.attempt;
  if (!attempt) return [];
  const found = new Map();
  const broker = processes.find(p => (!task.brokerPid || p.pid === task.brokerPid) && /^node\.exe$/i.test(p.name)
    && normalize(p.commandLine).includes('worker-broker.mjs')
    && normalize(p.commandLine).includes(normalize(task.__file))
    && normalize(p.commandLine).includes(normalize(attempt.specPath))
    && timestamp(p.createdAt) >= timestamp(attempt.startedAt) - 5000
    && (!task.brokerCreatedAt || identityMatches(p, { pid: task.brokerPid, createdAt: task.brokerCreatedAt })));
  if (broker) found.set(broker.pid, broker);
  const runnerId = checkpoint?.runnerPid ?? task.runnerPid;
  const runner = processes.find(p => (!runnerId || p.pid === runnerId) && /^(powershell|pwsh)\.exe$/i.test(p.name)
    && normalize(p.commandLine).includes('run-task.ps1')
    && normalize(p.commandLine).includes(normalize(task.__file))
    && normalize(p.commandLine).includes(normalize(attempt.specPath))
    && (!(checkpoint?.runnerCreatedAt ?? task.runnerCreatedAt) || identityMatches(p, { pid: runnerId, createdAt: checkpoint?.runnerCreatedAt ?? task.runnerCreatedAt })));
  if (runner) found.set(runner.pid, runner);
  // The unique output path also identifies a Codex child if its wrapper died
  // before the controller received the PID checkpoint.
  for (const row of processes) if (attempt.outputPath && /^codex\.exe$/i.test(row.name) && normalize(row.commandLine).includes(normalize(attempt.outputPath))
    && timestamp(row.createdAt) >= timestamp(attempt.startedAt) - 5000) found.set(row.pid, row);
  const known = [...(task.ownedProcesses ?? []),
    ...(checkpoint?.runnerPid ? [{ pid: checkpoint.runnerPid, createdAt: checkpoint.runnerCreatedAt, observedAt: checkpoint.finishedAt ?? checkpoint.heartbeatAt }] : []),
    ...(checkpoint?.codexPid ? [{ pid: checkpoint.codexPid, createdAt: checkpoint.codexCreatedAt, observedAt: checkpoint.codexExitedAt ?? checkpoint.finishedAt ?? checkpoint.heartbeatAt }] : [])];
  for (const owner of known) {
    const row = processes.find(p => identityMatches(p, owner)); if (row) found.set(row.pid, row);
  }
  // A child born while a known parent was alive remains attributable after that
  // parent exits. A newer process that reused the parent PID cannot own it here.
  for (const owner of known) {
    if (!owner.createdAt || !owner.observedAt) continue;
    const replacement = processes.find(p => p.pid === owner.pid && !identityMatches(p, owner));
    for (const row of processes) if (row.parentPid === owner.pid && timestamp(row.createdAt) >= timestamp(owner.createdAt)
      && timestamp(row.createdAt) <= timestamp(owner.observedAt)
      && (!replacement || timestamp(row.createdAt) < timestamp(replacement.createdAt))) found.set(row.pid, row);
  }
  // A verified parent may discover new descendants; persisted birth times keep
  // them attributable even if the intermediate parent exits during a crash.
  let added;
  do { added = false; for (const row of processes) if (found.has(row.parentPid) && !found.has(row.pid)
    && timestamp(row.createdAt) >= timestamp(found.get(row.parentPid).createdAt)) { found.set(row.pid, row); added = true; } } while (added);
  return [...found.values()];
}

export function watchdogReason(task, clock) {
  if (!['local', 'synthetic'].includes(task.executionMode) || task.liveMutation || task.liveAuthorizationRef || task.resourceClass === 'live-mutation') return null;
  const budget = Number(task.budgetMinutes ?? task.maxRuntimeMinutes), idle = Number(task.idleMinutes);
  if (Number.isFinite(budget) && budget > 0 && clock - timestamp(task.attempt?.startedAt) > budget * 60000) return `Task budget of ${budget} minutes elapsed`;
  const progressAt = Math.max(timestamp(task.attempt?.startedAt), timestamp(task.lastEventAt), timestamp(task.lastFileProgressAt));
  if (Number.isFinite(idle) && idle > 0 && clock - progressAt > idle * 60000) return `No JSON event or scoped-file progress for ${idle} minutes`;
  return null;
}
// A completed worker can report downstream Product/fixture authentication,
// not a Codex-login outage: model-runtime failures have no completed result.
export function exhaustedLiveFixture(result) {
  if (result?.state !== 'BLOCKED') return false;
  const reason = String(result.blocker ?? '');
  return /(?:pair|fixture)/i.test(reason) && /(?:phase|same-phase|maxNewPairs|sole pair|single pair)/i.test(reason)
    && /(?:consumed|exhausted)/i.test(reason) && /(?:retired|forbidden|not permitted|no .*replacement)/i.test(reason);
}

export function workerBlockerClass(result) {
  // A preserved real failure remains blocked; a new worker cannot replenish a retired one-pair phase.
  if (exhaustedLiveFixture(result)) return 'external';
  return result?.blockerType === 'auth' ? 'external' : result?.blockerType;
}
export function classifyFailure(message, explicit = null) {
  if (OUTAGE.has(explicit) || ['implementation', 'external', 'environment'].includes(explicit)) return explicit;
  const text = String(message ?? '');
  if (/usage limit|quota|rate.limit|too many requests|\b429\b/i.test(text)) return 'quota';
  if (/unauthorized|invalid.*(?:token|auth)|authentication.*fail|\b401\b|please.*(?:log|sign).?in|not logged in/i.test(text)) return 'auth';
  if (/stream disconnected|error sending request|connection (?:reset|refused)|network|temporary failure|timed? ?out|\bETIMEDOUT\b|\bECONNRESET\b|failed to connect|dns|tls handshake/i.test(text)) return 'network';
  return 'implementation';
}
function literalPrefix(glob) { return normalize(glob).split(/[?*[]/, 1)[0].replace(/\/$/, ''); }
export function scopesOverlap(a, b) {
  if (a.scopeKey && a.scopeKey === b.scopeKey) return true;
  return (a.allowedPaths ?? []).some(left => (b.allowedPaths ?? []).some(right => {
    const x = literalPrefix(left), y = literalPrefix(right);
    return !x || !y || x === y || x.startsWith(y + '/') || y.startsWith(x + '/') || x.startsWith(y) && /[*?[]/.test(right) || y.startsWith(x) && /[*?[]/.test(left);
  }));
}
function allowed(file, patterns) {
  return patterns.some(pattern => {
    const item = normalize(pattern).replace(/\/$/, '');
    const expression = item.split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + expression + '(?:/.*)?$').test(normalize(file));
  });
}
export function verifiedSourceOnlyPublication(task, receipt) {
  const authority = task?.preparationAuthority;
  const changed = receipt?.changedPaths, sourceOnly = receipt?.sourceOnlyPaths;
  const verificationPaths = task?.verificationPaths, evidence = receipt?.evidence;
  const servedExactly = (part, wanted) => Array.isArray(part?.assets) && part.assets.some(asset =>
    normalize(asset.repoPath) === normalize(wanted) && asset.verified === true && asset.deleted !== true
    && /^[a-f0-9]{64}$/.test(asset.expectedSha256 ?? '')
    && (asset.observedSha256 === asset.expectedSha256 || asset.normalizedSha256 === asset.expectedSha256));
  return ['local','synthetic'].includes(task?.executionMode) && task?.liveMutation !== true && !task?.liveAuthorizationRef
    && authority?.publication === true && /\b(?:inert|inactive)\b/i.test(String(authority.publicationScope ?? ''))
    && /source-only/i.test(String(task?.releaseAuthority ?? ''))
    && receipt?.state === 'DEPLOYED_AWAITING_PO' && receipt.productionDeployed === true && receipt.closed === false
    && receipt.productSourceChangeObserved === false && Array.isArray(receipt.changedAssets) && receipt.changedAssets.length === 0
    && Array.isArray(changed) && changed.length > 0 && changed.every(file => allowed(file, task.allowedPaths ?? []))
    && Array.isArray(sourceOnly) && sourceOnly.length > 0 && sourceOnly.every(file => changed.includes(file) && allowed(file, task.allowedPaths ?? []))
    && Array.isArray(verificationPaths) && verificationPaths.length > 0
    && verificationPaths.every(file => allowed(file, task.allowedPaths ?? [])
      && servedExactly(evidence?.immutable, file) && servedExactly(evidence?.production, file));
}

export function verifiedDeployment(task, receipt, productionUrl = 'https://rakeezx.com') {
  const binding = receipt?.binding, provider = receipt?.provider, proof = receipt?.evidence;
  return receipt?.status === 'deployed' && receipt.taskId === task.id && receipt.ticketId === task.productId
    && SHA.test(receipt.publishedSha ?? '') && receipt.candidateSha === task.candidateSha && receipt.baseSha === task.baseSha
    && binding?.candidateSha === task.candidateSha && binding.declaredBaseSha === task.baseSha && binding.publishedSha === receipt.publishedSha
    && binding.candidateAncestorOfPublished === true && binding.previousMainAncestorOfPublished === true && binding.mainContainsPublished === true
    && provider?.headSha === receipt.publishedSha && provider.status === 'completed' && provider.conclusion === 'success'
    && receipt.deploymentId === provider.deploymentId && Boolean(receipt.deploymentId)
    && (receipt.productSourceChangeObserved === true && Array.isArray(receipt.changedAssets) && receipt.changedAssets.length > 0
      || verifiedSourceOnlyPublication(task, receipt))
    && proof?.production?.origin === new URL(productionUrl).origin && proof?.immutable?.origin === provider.previewUrl
    && [proof?.immutable, proof?.production].every(part => part?.passed === true && Array.isArray(part.assets) && part.assets.length > 0
      && part.assets.every(asset => asset.verified === true && (asset.deleted || /^[a-f0-9]{64}$/.test(asset.expectedSha256 ?? '')
        && (asset.expectedSha256 === asset.observedSha256 || asset.repoPath === 'index.html' && ['index.html','/'].includes(asset.urlPath) && asset.statusCode === 200
          && (asset.normalization === 'cloudflare-jsd-v1' || asset.normalization === 'cloudflare-observed-tail-v2' && Number.isSafeInteger(asset.removedProviderBytes) && asset.removedProviderBytes > 0 && /^[a-f0-9]{64}$/.test(asset.removedSha256 ?? '') && Array.isArray(asset.providerTransforms) && ['cloudflare-analytics-20261014','cloudflare-jsd-v1,cloudflare-analytics-20261014','cloudflare-analytics-20261014,cloudflare-jsd-v1','cloudflare-analytics-20261017','cloudflare-jsd-v1,cloudflare-analytics-20261017','cloudflare-analytics-20261017,cloudflare-jsd-v1'].includes(asset.providerTransforms.join(','))) && asset.normalizedSha256 === asset.expectedSha256))));
}

export function validatePublishedEvidence(task, result, reference, productionUrl = 'https://rakeezx.com') {
  const proof = task.evidenceOnly;
  if (task.completionMode !== 'record_published_evidence' || !proof?.acceptanceAuthority || task.liveMutation || task.liveAuthorizationRef
    || !['local','synthetic'].includes(task.executionMode) || proof.referenceTaskId !== reference?.id
    || reference.id === task.id || reference.productId !== task.productId || reference.activationId !== task.activationId
    || !['awaiting_po','closed'].includes(reference.status) || !verifiedDeployment(reference, reference.deliveryReceipt, productionUrl)
    || proof.referencePublishedSha !== reference.deliveryReceipt.publishedSha) throw new Error('Verified existing Product reference and exact evidence-only authority required');
  if (!['pending','blocked'].includes(task.status) || task.runnerPid || task.brokerPid || result?.state !== 'LOCAL_READY'
    || result.taskId !== task.id || result.runId !== task.attempt?.runId || result.candidateSha !== task.candidateSha
    || result.baseSha !== task.baseSha || normalize(result.worktreePath) !== normalize(task.worktreePath)
    || !SHA.test(result.candidateSha ?? '') || !result.changedPaths?.length
    || !task.allowedPaths?.length || !task.allowedPaths.every(p => /^docs\/automation-evidence\/\d{8}\/[a-zA-Z0-9_-]+\.(md|json)$/.test(p))
    || !result.changedPaths.every(p => task.allowedPaths.includes(p))) throw new Error('Evidence-only exact identity or document scope mismatch');
  if (!task.requiredChecks?.length || !task.requiredChecks.every(name => result.checks?.some(c => c.name === name && c.status === 'PASS'))
    || result.checks.some(c => c.status !== 'PASS') || result.blockerType !== 'none' || result.blocker) throw new Error('Incomplete verification cannot be accepted');
  return true;
}

// A newer successful deployment is not generally evidence that an unrelated blocked
// attempt was fixed. This exact handoff has an explicit, reviewed relation:
const VERIFIED_HISTORICAL_HANDOFF = Object.freeze({
  previousId: 'continuous-n88-public-preview-reachability-20261016',
  succeedingId: 'continuous-n88-guest-hash-entry-20261017',
  changedAsset: 'index.html',
});
export function isHistoricalBlockedReceipt(task, openProducts = [], jobs = []) {
  if (task?.status !== 'blocked') return false;
  const reason = String(task.lastFailure ?? '');
  if (/^(?:SUPERSEDED_BY_VERIFIED_DELIVERY:|DEFERRED_BY_PO:|Existing receiver is already integrated with identical modules)/.test(reason)) return true;
  if (Array.isArray(openProducts) && openProducts.length > 0 && !openProducts.includes(task.productId)) return true;
  if (task.id !== VERIFIED_HISTORICAL_HANDOFF.previousId
      || !reason.startsWith('SOURCE_PARITY_PENDING:') || !Array.isArray(jobs)) return false;
  const successor = jobs.find(t => t.id === VERIFIED_HISTORICAL_HANDOFF.succeedingId);
  const published = successor?.deliveryReceipt, failed = task.deliveryReceipt;
  return successor?.productId === task.productId
    && ['awaiting_po', 'closed'].includes(successor.status)
    && successor.baseSha === failed?.publishedSha
    && failed?.status === 'blocked'
    && published?.status === 'deployed'
    && published.provider?.conclusion === 'success'
    && published.provider?.headSha === published.publishedSha
    && published.evidence?.immutable?.passed === true
    && published.evidence?.production?.passed === true
    && published.changedAssets?.includes(VERIFIED_HISTORICAL_HANDOFF.changedAsset)
    && Number.isFinite(Date.parse(published.verifiedAt))
    && Date.parse(published.verifiedAt) > Date.parse(task.updatedAt);
}
export function summarizeQueueHealth(jobs, openProducts = [], at = new Date().toISOString()) {
  const blocked = jobs.filter(t => t.status === 'blocked');
  const unresolved = blocked.filter(t => !isHistoricalBlockedReceipt(t, openProducts, jobs));
  const grouped = new Map();
  for (const task of unresolved) {
    const id = task.productId;
    if (!/^[A-Z][0-9]{1,4}$/.test(id ?? '')) continue;
    grouped.set(id, (grouped.get(id) ?? 0) + 1);
  }
  const delivered = jobs.filter(task => {
    const receipt = task.deliveryReceipt;
    return ['awaiting_po', 'closed'].includes(task.status)
      && receipt?.status === 'deployed'
      && receipt.provider?.headSha === receipt.publishedSha
      && receipt.provider?.conclusion === 'success'
      && receipt.evidence?.immutable?.passed === true
      && receipt.evidence?.production?.passed === true
      && Number.isFinite(Date.parse(receipt.verifiedAt));
  });
  const leadTimes = delivered.map(task => (Date.parse(task.deliveryReceipt.verifiedAt) - Date.parse(task.createdAt)) / 60000)
    .filter(minutes => Number.isFinite(minutes) && minutes >= 0 && minutes <= 60 * 24 * 90)
    .sort((a, b) => a - b);
  const medianMinutes = !leadTimes.length ? null : Math.round(leadTimes.length % 2
    ? leadTimes[(leadTimes.length - 1) / 2]
    : (leadTimes[leadTimes.length / 2 - 1] + leadTimes[leadTimes.length / 2]) / 2);
  const lastVerifiedDeliveryAt = delivered.map(t => t.deliveryReceipt.verifiedAt).sort().at(-1) ?? null;
  return {
    at,
    blockedAttempts: blocked.length,
    historicalBlockedAttempts: blocked.length - unresolved.length,
    actionableBlockedAttempts: unresolved.length,
    actionableBlockedProductCount: grouped.size,
    actionableBlockedByProduct: [...grouped].map(([productId, attempts]) => ({ productId, attempts }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    verifiedPublicationReceipts: delivered.length,
    verifiedPublishedProductCount: new Set(delivered.map(t => t.productId)).size,
    medianMinutesFromCardToVerifiedPublication: medianMinutes,
    lastVerifiedDeliveryAt,
  };
}
export function observeUnchangedParity(task, receipt, at) {
  const immutable = receipt?.evidence?.immutable, production = receipt?.evidence?.production;
  const parts = [{name:'immutable',item:immutable},{name:'production',item:production}];
  const failures = parts.flatMap(({name,item}) =>
    (Array.isArray(item?.assets) ? item.assets : []).filter(asset => asset.verified === false)
      .map(asset => ({...asset,origin:name})));
  if (receipt?.status !== 'pending' || receipt.errorCode !== 'SOURCE_PARITY_PENDING'
      || receipt.provider?.conclusion !== 'success' || receipt.provider.headSha !== receipt.publishedSha
      || parts.some(({item}) => typeof item?.passed !== 'boolean' || !Array.isArray(item?.assets) || !item.assets.length)
      || parts.every(({item}) => item.passed === true) || !failures.length
      || failures.some(asset => typeof asset.repoPath !== 'string' || asset.repoPath.length > 240
        || !Number.isSafeInteger(asset.statusCode) || asset.statusCode < 200 || asset.statusCode > 599
        || !/^[a-f0-9]{64}$/.test(asset.expectedSha256 ?? ''))) return false;
  const signature = failures.map(asset => [asset.origin,asset.repoPath,asset.statusCode,asset.expectedSha256])
    .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const key = createHash('sha256').update(JSON.stringify([task.candidateSha,receipt.publishedSha,signature])).digest('hex');
  const previous = task.parityWait, same = previous?.key === key;
  task.parityWait = {
    key, firstAt:same ? previous.firstAt : at, count:same ? previous.count + 1 : 1,lastAt:at,
    observations:[...(same ? previous.observations ?? [] : []),{
      at, failedAssets:failures.map(asset => ({
        origin:asset.origin,path:asset.repoPath,statusCode:asset.statusCode,
        expectedSha256:asset.expectedSha256,observedSha256:asset.observedSha256
      }))
    }].slice(-6)
  };
  return task.parityWait.count >= 2 && Date.parse(at) - Date.parse(task.parityWait.firstAt) >= 60000;
}
export function pendingPathCorrection(task,patch,activationId,at) {
  if(task?.scopeCorrections?.some(x=>x.id===patch?.id))return null;
  if(!task||task.status!=='pending'||task.attempt||task.sessionId||task.worktreePath||task.candidateSha||task.runnerPid||task.brokerPid)return null;
  if(task.id!==patch.taskId||task.productId!==patch.productId||task.activationId!==activationId||patch.activationId!==activationId
    ||!ID.test(patch.id??'')||typeof patch.reason!=='string'||patch.reason.length<20
    ||createHash('sha256').update(task.objective).digest('hex')!==patch.objectiveSha256
    ||createHash('sha256').update(JSON.stringify(task.allowedPaths)).digest('hex')!==patch.allowedPathsSha256
    ||!Array.isArray(patch.addPaths)||!patch.addPaths.length||patch.addPaths.some(p=>!/^src\/[a-zA-Z0-9_./-]+\.(js|css|html)$|^tests\/[a-zA-Z0-9_./-]+\.(mjs|js)$/.test(p)||p.includes('..')||p.includes('//')))
    throw Error('Pending source-path correction identity/scope invalid');
  return {...task,allowedPaths:[...new Set([...task.allowedPaths,...patch.addPaths])],scopeCorrections:[...(task.scopeCorrections??[]),{id:patch.id,at,addPaths:patch.addPaths,reason:patch.reason}]};
}

export const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['taskId', 'runId', 'state', 'candidateSha', 'baseSha', 'worktreePath', 'changedPaths', 'checks', 'summary', 'blockerType', 'blocker', 'nextAction'],
  properties: {
    taskId: { type: 'string' }, runId: { type: 'string' }, state: { type: 'string', enum: ['LOCAL_READY', 'BLOCKED', 'NO_CHANGE'] },
    candidateSha: { type: ['string', 'null'] }, baseSha: { type: ['string', 'null'] }, worktreePath: { type: 'string' },
    changedPaths: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'status', 'evidence'],
      properties: { name: { type: 'string' }, status: { type: 'string', enum: ['PASS', 'FAIL', 'NOT_RUN'] }, evidence: { type: 'string' } } } },
    summary: { type: 'string' }, blockerType: { type: 'string', enum: ['none', 'implementation', 'external', 'auth', 'quota', 'network', 'environment'] },
    blocker: { type: ['string', 'null'] }, nextAction: { type: ['string', 'null'] },
  },
};

export class Controller {
  constructor(options = {}, adapters = {}) {
    this.runtime = path.resolve(options.runtime ?? path.join(HERE, '..', '..', 'artifacts', 'ops-supervisor-v4'));
    this.repo = path.resolve(options.repo ?? path.join(HERE, '..', '..'));
    this.configPath = options.config ?? path.join(this.runtime, 'workflow-v5.json');
    this.scripts = options.scripts ?? HERE; this.instanceId = options.instanceId ?? randomUUID();
    this.clock = adapters.now ?? Date.now; this.command = adapters.command ?? runCommand;
    this.inventory = adapters.inventory ?? (() => windowsInventory(this.command, this.config?.controller?.powershellPath));
    this.launchAdapter = adapters.launch; this.prepareAdapter = adapters.prepare; this.validateAdapter = adapters.validate; this.terminateAdapter = adapters.terminate;
    this.fingerprintAdapter = adapters.fingerprint;
    this.publisher = adapters.publisher; this.records = adapters.records; this.testOnly = adapters.testOnly === true;
    this.jobs = []; this.deliveryResult = null; this.deliveryInFlight = null; this.progress = null; this.issues = [];
    this.logCursors = new Map(); this.identity = null; this.stopping = false; this.locked = false;
  }
  now() { return new Date(this.clock()).toISOString(); }
  async paused() { return this.stopping || await exists(path.join(this.runtime, 'STOP')) || await exists(path.join(this.runtime, 'STOP-REFILL')); }
  async save(task) { task.updatedAt = this.now(); const { __file, ...record } = task; await writeJson(__file, record); }
  async event(type, fields = {}) {
    await fs.appendFile(path.join(this.runtime, 'controller-events.jsonl'), JSON.stringify({ at: this.now(), instanceId: this.instanceId, type, ...fields }) + '\n');
  }
  async initialize({ lock = true } = {}) {
    for (const directory of ['', 'queue', 'attempts', 'results', 'delivery', 'leases']) await fs.mkdir(path.join(this.runtime, directory), { recursive: true });
    await this.loadConfig();
    const processes = await this.inventory();
    const own = processes.find(p => p.pid === process.pid);
    this.identity = { pid: process.pid, instanceId: this.instanceId, createdAt: own?.createdAt ?? this.now(), startedAt: this.now(), runtime: this.runtime, script: path.join(this.scripts, 'controller.mjs') };
    if (lock) {
      const file = path.join(this.runtime, 'controller.lock');
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await fs.writeFile(file, JSON.stringify(this.identity), { flag: 'wx' }); this.locked = true; break; }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const owner = await readJson(file);
          if (!owner?.instanceId || !owner?.createdAt || !Number.isSafeInteger(owner.pid)) throw new Error('Controller lock is invalid; inspect without deleting another owner');
          if (processes.some(p => identityMatches(p, owner))) throw new Error('CONTROLLER_ALREADY_RUNNING');
          await fs.rm(file); // Only a lock with an absent exact process is reclaimable.
        }
      }
      if (!this.locked) throw new Error('Could not acquire controller lock');
    }
    await writeJson(path.join(this.runtime, 'CONTROLLER_IDENTITY.json'), this.identity);
    await writeJson(path.join(this.runtime, 'worker-result.schema.json'), RESULT_SCHEMA);
    await this.event('controller_started', { activationId: this.config.controller.activationId, pid: process.pid });
  }
  async loadConfig() {
    const config = await readJson(this.configPath);
    if (!config?.controller?.activationId || !ID.test(config.controller.activationId)) throw new Error('An explicit valid controller.activationId is required');
    if (![1, 2, 3].includes(Number(config.maxWorkers))) throw new Error('maxWorkers must be 1, 2 or 3');
    if (!config.controller.codexPath && !this.testOnly) throw new Error('controller.codexPath must name the tested Codex executable');
    if (!this.testOnly && !await exists(config.controller.codexPath)) throw new Error('Configured Codex executable is unavailable; no new workers started');
    if (config.controller.repoRoot) this.repo = path.resolve(config.controller.repoRoot);
    this.config = config;
  }
  async loadJobs() {
    this.jobs = [];
    for (const name of (await fs.readdir(path.join(this.runtime, 'queue'))).filter(x => x.endsWith('.json'))) {
      const file = path.join(this.runtime, 'queue', name);
      try {
        const task = await readJson(file);
        if (task?.activationId !== this.config.controller.activationId) continue;
        if (!ID.test(task.id ?? '') || name !== task.id + '.json' || !ID.test(task.productId ?? '')) throw new Error('Task ID/path mismatch');
        this.jobs.push({ ...task, __file: file });
      } catch (error) { this.issues.push({ code: 'QUEUE_INVALID', file: name, message: clean(error.message) }); }
    }
    this.jobs.sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100) || a.id.localeCompare(b.id));
  }
  async importCatalog() {
    const catalog = await readJson(path.join(this.runtime, 'intake-catalog.json'), { tasks: [] });
    for(const patch of catalog.pendingPathCorrections??[]) {
      const task=this.jobs.find(t=>t.id===patch.taskId);
      try { const updated=pendingPathCorrection(task,patch,this.config.controller.activationId,this.now());
        if(updated){await this.save(updated);Object.assign(task,updated);await this.event('pending_source_path_corrected',{taskId:task.id,correctionId:patch.id,addPaths:patch.addPaths});}
      }catch(error){this.issues.push({code:'PENDING_PATH_CORRECTION_FAILED',taskId:patch.taskId,message:clean(error.message)});}
    }
    if (!this.noteReadAt || this.clock() - this.noteReadAt >= 60000) {
      try { this.noteCache = await readApprovedNotes(this.repo,this.config.controller.activationId); }
      catch(error) { this.noteCache={cards:[],openProducts:[],issues:[{code:'NOTES_READ_FAILED',message:clean(error.message)}]}; }
      this.noteReadAt=this.clock();
      await this.event('notes_checked',{openProducts:this.noteCache.openProducts,approvedSources:this.noteCache.cards.length});
    }
    this.issues.push(...this.noteCache.issues);
    for (const card of [...(catalog.tasks ?? []),...this.noteCache.cards]) {
      if (card.activationId !== this.config.controller.activationId || this.jobs.some(t => t.id === card.id)) continue;
      if (!ID.test(card.id ?? '') || !ID.test(card.productId ?? '') || !card.objective || !Array.isArray(card.allowedPaths) || !card.allowedPaths.length) {
        this.issues.push({ code: 'CARD_INVALID', taskId: card.id }); continue;
      }
      const eligibility = await this.eligibility(card);
      if (!eligibility.eligible) { this.issues.push({ code: 'PRODUCT_INELIGIBLE', taskId: card.id, reason: eligibility.reason }); continue; }
      const file = path.join(this.runtime, 'queue', card.id + '.json');
      // An adopted activation never overwrites a card from an earlier activation.
      if (await exists(file)) { this.issues.push({ code: 'CARD_ID_ALREADY_EXISTS', taskId: card.id }); continue; }
      const task = { ...card, workflowVersion: 5, status: 'pending', implementationFailures: 0, infrastructureRetries: 0, createdAt: this.now(), __file: file };
      await this.save(task); this.jobs.push(task); await this.event('card_admitted', { taskId: task.id });
    }
    this.unassignedNotes=this.noteCache.openProducts.filter(id=>!this.jobs.some(t=>t.productId===id&&t.status!=='closed'));
    for(const productId of this.unassignedNotes)this.issues.push({code:'OPEN_NOTE_WITHOUT_EXECUTION',productId,message:'Open note needs an approved actionable source or an explicit decision/access condition.'});
    this.jobs.sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100) || a.id.localeCompare(b.id));
  }
  async loadRecords() {
    if (this.records) return;
    const file = this.config.controller.recordsPath ?? path.join(this.scripts, 'product-records.mjs');
    if (await exists(file)) this.records = await import(pathToFileURL(path.resolve(file)).href);
    else if (!this.testOnly) throw new Error('Product record/eligibility helper is missing; install the reviewed component before execution');
  }
  async eligibility(task) {
    if (!this.records?.inspectProductEligibility) return { eligible: true };
    try { return await this.records.inspectProductEligibility(this.repo, task.productId); }
    catch (error) { this.issues.push({ code: 'PRODUCT_ELIGIBILITY_UNAVAILABLE', taskId: task.id, message: clean(error.message) }); return { eligible: false, reason: 'Product status could not be read' }; }
  }
  async syncRecords() {
    if (!this.records?.recordProductTransition) return;
    for (const task of this.jobs) {
      if (!['awaiting_po', 'blocked', 'running', 'delivery', 'retry_wait'].includes(task.status)) continue;
      const key = [task.activationId, task.status, task.candidateSha ?? '', task.deliveryReceipt?.publishedSha ?? '', task.lastFailure ?? ''].join(':');
      if (task.productRecordKey === key) continue;
      try {
        await this.records.recordProductTransition({ repoRoot: this.repo, task, receipt: task.deliveryReceipt ?? task.validationReceipt ?? null });
        task.productRecordKey = key; await this.save(task);
      } catch (error) { this.issues.push({ code: 'PRODUCT_RECORD_UPDATE_FAILED', taskId: task.id, message: clean(error.message) }); }
    }
  }
  async collectEvents(task) {
    if (!task.attempt) return;
    let cursor = this.logCursors.get(task.attempt.runId) ?? { offset: 0, tail: '' };
    let handle;
    try {
      handle = await fs.open(task.attempt.jsonlPath, 'r');
      const stat = await handle.stat(), total = stat.size;
      if (total < cursor.offset) throw new Error('Attempt event log was truncated');
      // Bounded batches; first event persists the exact session before a long turn.
      let remaining = Math.min(total - cursor.offset, 4 * 1024 * 1024);
      while (remaining > 0) {
        const data = Buffer.alloc(Math.min(65536, remaining));
        const { bytesRead } = await handle.read(data, 0, data.length, cursor.offset);
        if (!bytesRead) break;
        cursor.offset += bytesRead; remaining -= bytesRead;
        const lines = (cursor.tail + data.subarray(0, bytesRead).toString('utf8')).split(/\r?\n/); cursor.tail = lines.pop();
        for (const line of lines) {
          let event; try { event = parse(line); } catch { continue; }
          if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
            if (task.sessionId && task.sessionId !== event.thread_id) throw new Error('Exact resumed session changed unexpectedly');
            task.sessionId = event.thread_id;
          }
          if (['error', 'turn.failed'].includes(event.type)) task.lastModelError = clean(event.message ?? event.error?.message ?? JSON.stringify(event));
          if (event.type === 'turn.completed') task.lastTurnCompletedAt = this.now();
          task.lastEventAt = new Date(Math.min(stat.mtimeMs, this.clock())).toISOString();
        }
        if (cursor.tail.length > 4 * 1024 * 1024) throw new Error('Unbounded event line');
      }
      this.logCursors.set(task.attempt.runId, cursor);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    finally { await handle?.close(); }
  }
  async failure(task, message, explicit = null, options = {}) {
    const type = classifyFailure(message, explicit); task.failureClass = type; task.lastFailure = clean(message); task.lastFailureAt = this.now();
    if (OUTAGE.has(type)) {
      task.infrastructureRetries = Number(task.infrastructureRetries ?? 0) + 1;
      const seconds = type === 'network' ? Math.min(300, 15 * 2 ** Math.min(task.infrastructureRetries - 1, 5)) : Math.min(3600, 900 * 2 ** Math.min(task.infrastructureRetries - 1, 2));
      task.status = 'retry_wait'; task.retryAt = new Date(this.clock() + seconds * 1000).toISOString();
    } else if (type === 'external' || type === 'environment') {
      task.status = 'blocked'; task.retryAt = null;
    } else {
      task.implementationFailures = Number(task.implementationFailures ?? 0) + 1;
      task.status = task.implementationFailures >= 2 ? 'blocked' : 'retry_wait';
      task.retryAt = task.status === 'retry_wait' ? new Date(this.clock() + 5000).toISOString() : null;
    }
    if (options.delivery) task.deliveryRepair = options.delivery;
    task.runnerPid = null; task.runnerCreatedAt = null; task.brokerPid = null; task.brokerCreatedAt = null; task.ownedProcesses = [];
    await this.save(task); await this.event(task.status, { taskId: task.id, type, message: clean(message), retryAt: task.retryAt });
  }
  async scopedProgress(task) {
    if (this.clock() - timestamp(task.lastProgressScanAt) < 15000) return;
    task.lastProgressScanAt = this.now();
    try {
      let fingerprint;
      if (this.fingerprintAdapter) fingerprint = await this.fingerprintAdapter(task);
      else {
        const listing = await this.command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...task.allowedPaths], { cwd: task.worktreePath });
        if (listing.code !== 0) throw new Error(listing.stderr);
        const files = listing.stdout.split('\0').filter(Boolean).filter(file => allowed(file, task.allowedPaths));
        if (files.length > 1000) throw new Error('Scoped progress file limit');
        const digest = createHash('sha256');
        for (const file of files.sort()) {
          try {
            const location = path.resolve(task.worktreePath, file), stat = await fs.stat(location);
            if (!stat.isFile() || stat.size > 8 * 1024 * 1024) continue;
            digest.update(file); digest.update(await fs.readFile(location));
          } catch (error) { if (error.code !== 'ENOENT') throw error; digest.update(file + ':removed'); }
        }
        const head = await this.command('git', ['rev-parse', 'HEAD'], { cwd: task.worktreePath });
        if (head.code === 0) digest.update(head.stdout);
        fingerprint = digest.digest('hex');
      }
      if (task.progressFingerprint !== fingerprint) { task.progressFingerprint = fingerprint; task.lastFileProgressAt = this.now(); }
    } catch (error) { this.issues.push({ code: 'PROGRESS_SCAN_UNAVAILABLE', taskId: task.id, message: clean(error.message) }); }
  }
  async stopOwned(task, live) {
    const identities = live.map(p => ({ pid: p.pid, createdAt: p.createdAt, name: p.name, parentPid: p.parentPid, observedAt: this.now() }));
    task.ownedProcesses = identities;
    if (!task.watchdogIncident) task.watchdogIncident = { runId: task.attempt.runId, at: this.now(), reason: 'Owned process cleanup' };
    await this.save(task); // Persist exact identities before any termination.
    let outcome;
    if (this.terminateAdapter) outcome = await this.terminateAdapter(identities, task);
    else {
      const payload = Buffer.from(JSON.stringify(identities), 'utf8').toString('base64');
      const script = `$ErrorActionPreference='Stop'; $inputOwners=[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json; $rows=@(Get-CimInstance Win32_Process -ErrorAction Stop); $known=@{}; foreach($owner in $inputOwners){ foreach($p in $rows){ if($p.ProcessId -eq $owner.pid -and $p.CreationDate.ToUniversalTime().Ticks -eq ([DateTime]::Parse($owner.createdAt)).ToUniversalTime().Ticks){$known[[int]$p.ProcessId]=$p} } }; do{$added=$false; foreach($p in $rows){if(!$known.ContainsKey([int]$p.ProcessId) -and $known.ContainsKey([int]$p.ParentProcessId) -and $p.CreationDate -ge $known[[int]$p.ParentProcessId].CreationDate){$known[[int]$p.ProcessId]=$p;$added=$true}}}while($added); $owners=@($known.Values|ForEach-Object{[pscustomobject]@{pid=[int]$_.ProcessId;createdAt=$_.CreationDate.ToUniversalTime().ToString('o');name=$_.Name;parentPid=[int]$_.ParentProcessId;observedAt=[DateTime]::UtcNow.ToString('o')}}); $result=@(); foreach($owner in @($owners|Sort-Object @{Expression={if($_.name -eq 'codex.exe'){0}elseif($_.name -match '^(powershell|pwsh).exe$'){1}else{2}}})){ $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$owner.pid) -ErrorAction Stop; if($p -and $p.CreationDate.ToUniversalTime().Ticks -eq ([DateTime]::Parse($owner.createdAt)).ToUniversalTime().Ticks){ try { Stop-Process -Id ([int]$owner.pid) -ErrorAction Stop; $owner.observedAt=[DateTime]::UtcNow.ToString('o'); $result+=@{pid=$owner.pid;stopped=$true} } catch { $result+=@{pid=$owner.pid;stopped=$false;error=$_.Exception.Message} } } }; ConvertTo-Json -InputObject @{owners=@($owners);results=@($result)} -Compress -Depth 5`;
      const response = await this.command(this.config.controller.powershellPath ?? POWERSHELL,
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);
      if (response.code !== 0) throw new Error('Exact owned-process termination failed: ' + clean(response.stderr));
      outcome = response.stdout.trim() ? parse(response.stdout) : [];
    }
    if (Array.isArray(outcome?.owners)) task.ownedProcesses = [...new Map([...identities, ...outcome.owners].map(owner => [`${owner.pid}:${owner.createdAt}`, owner])).values()];
    task.watchdogIncident.lastTerminationAt = this.now(); task.watchdogIncident.termination = outcome;
    await this.save(task); await this.event('owned_process_stop_requested', { taskId: task.id, runId: task.attempt.runId, reason: task.watchdogIncident.reason, identities, outcome });
  }
  async saveReap(task, checkpoint) {
    const owners = [...(task.ownedProcesses ?? []),
      ...(checkpoint?.runnerPid ? [{ pid: checkpoint.runnerPid, createdAt: checkpoint.runnerCreatedAt }] : []),
      ...(checkpoint?.codexPid ? [{ pid: checkpoint.codexPid, createdAt: checkpoint.codexCreatedAt }] : []),
      ...(task.runnerPid && task.runnerCreatedAt ? [{ pid: task.runnerPid, createdAt: task.runnerCreatedAt }] : []),
      ...(task.brokerPid && task.brokerCreatedAt ? [{ pid: task.brokerPid, createdAt: task.brokerCreatedAt }] : [])]
      .filter(owner => owner.pid && owner.createdAt);
    task.lastWorkerReap = { activationId: task.activationId, runId: task.attempt.runId, verifiedAbsentAt: this.now(), exactAbsence: true,
      owners: [...new Map(owners.map(owner => [`${owner.pid}:${owner.createdAt}`, owner])).values()] };
  }
  async prepare(task) {
    if (this.prepareAdapter) return this.prepareAdapter(task, this);
    const remote = this.config.controller.remote ?? 'origin', branch = this.config.controller.branch ?? 'main';
    if (!/^[A-Za-z0-9._-]+$/.test(remote) || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..')) throw new Error('Invalid target ref');
    const git = async (args, cwd = this.repo) => { const result = await this.command('git', args, { cwd, timeoutMs: 120000 }); if (result.code !== 0) throw new Error(clean(result.stderr || result.stdout)); return result.stdout.trim(); };
    if (!task.worktreePath) {
      await git(['fetch', '--no-tags', remote, `refs/heads/${branch}`]);
      const head = (await git(['ls-remote', '--heads', remote, `refs/heads/${branch}`])).split(/\s+/)[0];
      if (!SHA.test(head ?? '')) throw new Error('Remote main head could not be verified');
      await git(['cat-file', '-e', `${head}^{commit}`]);
      task.baseSha = head; task.worktreePath = path.join(this.repo, '.worktrees', task.id); task.worktreePrepared = false;
      await this.save(task); // Recoverable intent before creating any worktree.
    }
    if (!task.baseSha || !SHA.test(task.baseSha)) throw new Error('Existing candidate needs its exact declared baseSha');
    if (!await exists(task.worktreePath)) await git(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'worktree', 'add', '--detach', task.worktreePath, task.baseSha]);
    const root = await git(['rev-parse', '--show-toplevel'], task.worktreePath);
    if (normalize(path.resolve(root)) !== normalize(path.resolve(task.worktreePath))) throw new Error('Candidate path is not its own Git worktree');
    const shared = await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], task.worktreePath);
    const canonicalShared = await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], this.repo);
    if (normalize(shared) !== normalize(canonicalShared)) throw new Error('Candidate belongs to a different repository');
    await git(['merge-base', '--is-ancestor', task.baseSha, 'HEAD'], task.worktreePath);
    task.cwd = task.worktreePath; task.worktreePrepared = true;
    // Reuse the existing dependencies without installations or canonical edits.
    if (!await exists(path.join(task.cwd, 'node_modules')) && await exists(path.join(this.repo, 'node_modules'))) {
      await fs.symlink(path.join(this.repo, 'node_modules'), path.join(task.cwd, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    }
  }
  async validate(task, result) {
    if (this.validateAdapter) return this.validateAdapter(task, result, this);
    if (result.taskId !== task.id || !task.attempt?.runId || result.runId !== task.attempt.runId || result.state !== 'LOCAL_READY'
      || !SHA.test(task.baseSha ?? '') || !SHA.test(result.baseSha ?? '') || !SHA.test(result.candidateSha ?? '')
      || normalize(result.worktreePath) !== normalize(task.worktreePath)) throw new Error('Candidate identity/base/worktree mismatch');
    if (!Array.isArray(result.checks) || !result.checks.some(c => c.status === 'PASS') || result.checks.some(c => c.status === 'FAIL')) throw new Error('An affected check must pass and no recorded check may fail');
    const missing = (task.requiredChecks ?? []).filter(name => !result.checks.some(check => check.name === name && check.status === 'PASS'));
    if (missing.length) throw new Error('Required affected checks have not passed: ' + missing.join(', '));
    const git = async args => { const r = await this.command('git', args, { cwd: task.worktreePath }); if (r.code !== 0) throw new Error(clean(r.stderr || r.stdout)); return r.stdout.trim(); };
    if (await git(['rev-parse', 'HEAD']) !== result.candidateSha) throw new Error('Receipt is not the actual candidate HEAD');
    const advancesBase = result.baseSha !== task.baseSha;
    if (advancesBase) await git(['merge-base', '--is-ancestor', task.baseSha, result.baseSha]);
    await git(['merge-base', '--is-ancestor', result.baseSha, result.candidateSha]);
    if (await git(['status', '--porcelain', advancesBase ? '--untracked-files=all' : '--untracked-files=no'])) throw new Error('Candidate has uncommitted changes; retain them and finish the commit');
    const changed = (await git(['diff', '--name-only', '-z', '--no-renames', result.baseSha, result.candidateSha, '--'])).split('\0').filter(Boolean);
    if (!changed.length) throw new Error('No code change in the candidate');
    const escaped = changed.filter(file => !allowed(file, task.allowedPaths ?? []));
    if (escaped.length) throw new Error('Changed paths outside this approved card: ' + escaped.join(', '));
    let baseAdvance = null;
    if (advancesBase) {
      if (!Array.isArray(result.changedPaths) || result.changedPaths.some(p => typeof p !== 'string')
        || JSON.stringify([...result.changedPaths].sort()) !== JSON.stringify([...changed].sort())) throw new Error('Advanced-base receipt does not match the actual changed paths');
      const remote = this.config?.controller?.remote ?? 'origin', branch = this.config?.controller?.branch ?? 'main';
      if (!/^[A-Za-z0-9._-]+$/.test(remote) || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..')) throw new Error('Invalid target ref');
      const ref = `refs/heads/${branch}`, rows = (await git(['ls-remote', '--heads', remote, ref])).split(/\r?\n/).filter(Boolean);
      const [publishedMainSha, observedRef] = (rows[0] ?? '').split(/\s+/);
      if (rows.length !== 1 || !SHA.test(publishedMainSha ?? '') || observedRef !== ref) throw new Error('Published main could not be verified for the advanced base');
      // Fetch only the full SHA just observed on the configured published branch.
      // No checkout, merge, worker launch, Product test, or service mutation occurs.
      await git(['fetch', '--no-tags', '--no-write-fetch-head', remote, publishedMainSha]);
      await git(['merge-base', '--is-ancestor', result.baseSha, publishedMainSha]);
      if (await git(['rev-parse', 'HEAD']) !== result.candidateSha || await git(['status', '--porcelain', '--untracked-files=all'])) throw new Error('Candidate changed while its published base was verified');
      baseAdvance = { kind: 'published-main-base-advance', from: task.baseSha, to: result.baseSha,
        taskId: task.id, runId: task.attempt.runId, candidateSha: result.candidateSha, publishedMainSha, remote, branch, verifiedAt: this.now() };
    }
    // Override any worker-supplied field: only the host can attest this advance.
    return { ...result, changedPaths: changed, hostValidatedAt: this.now(), baseAdvance };
  }
  async acceptCandidate(task, receipt, recovery = null) {
    const at = this.now(), next = { ...task, candidateSha: receipt.candidateSha, baseSha: receipt.baseSha,
      validationReceipt: receipt, status: 'delivery', deliveryQueuedAt: at, nextDeliveryAt: at, retryAt: null,
      runnerPid: null, runnerCreatedAt: null, brokerPid: null, brokerCreatedAt: null, ownedProcesses: [],
      failureClass: null, probingClass: null, lastFailure: null, infrastructureRetries: 0, productRecordKey: null };
    if (receipt.baseAdvance) next.baseAdvanceHistory = [...(task.baseAdvanceHistory ?? []), { ...receipt.baseAdvance,
      previousCandidateSha: task.candidateSha ?? null, previousStatus: task.status, previousFailure: task.lastFailure ?? null,
      previousFailureAt: task.lastFailureAt ?? null, previousImplementationFailures: Number(task.implementationFailures ?? 0),
      recovery, originalAttemptPreserved: true }];
    if (recovery) next.implementationFailures = Math.max(0, Number(task.implementationFailures ?? 0) - 1);
    await writeJson(path.join(this.runtime, 'results', task.id + '.json'), receipt);
    await this.save(next); Object.assign(task, next);
    await this.event('candidate_ready', { taskId: task.id, candidateSha: task.candidateSha, sessionId: task.sessionId, recoveredSavedResult: Boolean(recovery) });
  }
  async completePublishedEvidence(task, processes) {
    const reference = this.jobs.find(t => t.id === task.evidenceOnly?.referenceTaskId);
    const original = await fs.readFile(task.attempt.outputPath), result = parse(original);
    validatePublishedEvidence(task, result, reference, this.config.controller.productionUrl);
    const reap = task.lastWorkerReap;
    if (!reap?.exactAbsence || reap.activationId !== task.activationId || reap.runId !== task.attempt.runId
      || !reap.owners?.length || reap.owners.some(o => processes.some(p => identityMatches(p,o)))) throw new Error('Completed evidence worker absence must be proven');
    if (!this.testOnly) {
      const run = async args => { const r = await this.command('git', args, {cwd:task.worktreePath}); if(r.code !== 0) throw new Error('Evidence source binding failed: '+args[0]); return r.stdout.trim(); };
      if (await run(['rev-parse','HEAD']) !== result.candidateSha || await run(['status','--porcelain=v1','--untracked-files=no'])) throw new Error('Evidence candidate must remain exact and clean');
      const paths = (await run(['diff','--name-only',result.baseSha,result.candidateSha])).split(/\r?\n/).filter(Boolean);
      if (paths.length !== result.changedPaths.length || !paths.every(p => result.changedPaths.includes(p))) throw new Error('Actual evidence diff differs');
      await run(['fetch','--no-tags','origin','main']);
      const currentMain = (await run(['ls-remote','--heads','origin','refs/heads/main'])).split(/\s+/)[0];
      if (!SHA.test(currentMain)) throw new Error('Current published main unavailable');
      await run(['merge-base','--is-ancestor',result.candidateSha,currentMain]);
      await run(['merge-base','--is-ancestor',reference.deliveryReceipt.publishedSha,currentMain]);
      for (const p of paths) if (await run(['rev-parse',result.candidateSha+':'+p]) !== await run(['rev-parse',currentMain+':'+p])) throw new Error('Published evidence document changed: '+p);
    }
    if (!original.equals(await fs.readFile(task.attempt.outputPath))) throw new Error('Original verification result changed');
    const completion = {version:1,kind:'published-evidence-only',taskId:task.id,productId:task.productId,runId:result.runId,
      evidenceCandidateSha:result.candidateSha,referenceTaskId:reference.id,referencePublishedSha:reference.deliveryReceipt.publishedSha,
      acceptedAt:this.now(),acceptanceAuthority:task.evidenceOnly.acceptanceAuthority,checks:result.checks,
      originalResultSha256:createHash('sha256').update(original).digest('hex'),newProductDeployment:false,productTicketClosed:false};
    await writeJson(path.join(this.runtime,'results',task.id+'.verification.json'),completion);
    const next = {...task,status:'closed',verificationReceipt:completion,closedFromTechnicalEvidenceAt:this.now(),lastFailure:null,failureClass:null,deliveryOwner:null,retryAt:null};
    await this.save(next); Object.assign(task,next);
    // Re-render the reference Product's truthful state; do not close the parent ticket.
    reference.productRecordKey = null; await this.save(reference);
    await this.event('evidence_verified',{taskId:task.id,evidenceCandidateSha:result.candidateSha,referencePublishedSha:completion.referencePublishedSha,newProductDeployment:false});
  }
  savedBaseMismatch(task) {
    return ['retry_wait', 'blocked'].includes(task.status) && task.failureClass === 'implementation'
      && task.lastFailure === 'Candidate validation: Candidate identity/base/worktree mismatch' && Boolean(task.attempt?.runId);
  }
  async recoverSavedBaseMismatch(task, processes) {
    // Called only after ordinary scope, dependency, eligibility and authority gates.
    // Never turn this saved attempt into running or launch/stop any process.
    const reap = task.lastWorkerReap;
    if (!reap?.exactAbsence || reap.runId !== task.attempt.runId || reap.activationId !== task.activationId
      || !Array.isArray(reap.owners) || !reap.owners.length || reap.owners.some(o => !o.pid || !o.createdAt)) throw new Error('Saved worker absence identity is incomplete');
    const checkpoint = await readJson(task.attempt.checkpointPath);
    if (!checkpoint || checkpoint.taskId !== task.id || checkpoint.runId !== task.attempt.runId || !checkpoint.finishedAt
      || task.checkpointIssue || task.eventLogIssue || task.watchdogIncident
      || checkpoint.sessionId && task.sessionId && checkpoint.sessionId !== task.sessionId) throw new Error('Saved completed attempt identity is inconsistent');
    if (workerProcesses({ ...task, ownedProcesses: [...(task.ownedProcesses ?? []), ...reap.owners] }, checkpoint, processes).length) throw new Error('An exact saved attempt process is still active');
    const original = await fs.readFile(task.attempt.outputPath), result = parse(original);
    const receipt = await this.validate(task, result);
    if (!receipt.baseAdvance) throw new Error('Saved result is not a verified published-main base advance');
    if (!original.equals(await fs.readFile(task.attempt.outputPath))) throw new Error('Saved result changed during validation');
    await this.acceptCandidate(task, receipt, { kind: 'saved-base-mismatch-result', verifiedAt: this.now(), runId: task.attempt.runId,
      originalResultSha256: createHash('sha256').update(original).digest('hex'), priorWorkerAbsence: reap,
      removedMetadataFailureCount: 1, workerLaunches: 0, productTestsRun: 0, serviceMutations: 0 });
  }
  async launch(task) {
    if (await this.paused()) return;
    try { await this.prepare(task); }
    catch (error) { await this.failure(task, 'Candidate preparation: ' + error.message, classifyFailure(error.message) === 'implementation' ? 'environment' : null); return; }
    if (await this.paused()) { await this.save(task); return; }
    const runId = randomUUID(), directory = path.join(this.runtime, 'attempts', task.id, runId);
    await fs.mkdir(directory, { recursive: true });
    const lane = this.config.models?.[task.riskClass ?? 'STANDARD'] ?? {};
    const spec = { version: 1, taskId: task.id, activationId: task.activationId, runId, taskFile: task.__file,
      cwd: task.worktreePath, baseSha: task.baseSha, codexPath: this.config.controller.codexPath,
      model: task.model ?? lane.model ?? this.config.defaultModel, effort: task.effort ?? lane.effort ?? this.config.defaultEffort ?? 'medium',
      sessionId: task.sessionId ?? null, readOnly: task.readOnly === true,
      outputPath: path.join(directory, 'result.json'), jsonlPath: path.join(directory, 'events.jsonl'), stderrPath: path.join(directory, 'stderr.txt'),
      checkpointPath: path.join(directory, 'checkpoint.json'), promptPath: path.join(directory, 'prompt.txt'), schemaPath: path.join(this.runtime, 'worker-result.schema.json'),
      wrapperStdoutPath: path.join(directory, 'wrapper.stdout.txt'), wrapperStderrPath: path.join(directory, 'wrapper.stderr.txt'),
      wrapperLaunchPath: path.join(directory, 'wrapper-launch.json'), brokerStdoutPath: path.join(directory, 'broker.stdout.txt'), brokerStderrPath: path.join(directory, 'broker.stderr.txt') };
    let policy = ''; try { policy = await fs.readFile(path.join(this.scripts, 'worker-policy.txt'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let supplemental = '';
    if (task.promptPath) supplemental = await fs.readFile(path.resolve(this.runtime, task.promptPath), 'utf8');
    const instructions = { taskId: task.id, runId, productId: task.productId, objective: task.objective, acceptance: task.acceptance ?? [],
      allowedPaths: task.allowedPaths, riskClass: task.riskClass, requiredChecks: task.requiredChecks ?? [], baseSha: task.baseSha, worktreePath: task.worktreePath,
      executionMode: task.executionMode, budgetMinutes: task.budgetMinutes ?? task.maxRuntimeMinutes, idleMinutes: task.idleMinutes,
      releaseAuthority: task.releaseAuthority, preparationAuthority: task.preparationAuthority ?? null, liveAuthorizationRef: task.liveAuthorizationRef ?? null, resultPath: spec.outputPath, canonicalTaskFile: task.__file,
      resourceLeaseScript: path.join(this.scripts, 'resource-lease.ps1'), runtimeRoot: this.runtime,
      previousFailure: task.lastFailure ?? null, deliveryRepair: task.deliveryRepair ?? null };
    const publicationInstruction = task.liveAuthorizationRef && task.preparationAuthority?.kind === 'scoped_preview_and_fixture_ops'
      && task.preparationAuthority.productId === task.productId
      && task.preparationAuthority.liveAuthorizationRef === task.liveAuthorizationRef
      ? 'Perform only the exact Preview branch and service/fixture preparation or disposition actions named in this card\'s preparationAuthority, within its named project, identities, operations and bounds. Do not push main or publish Production: the independent controller owns Product publication. Prior temporary-function deployment is not evidence of the live gate; record actual cleanup/disarm results.'
      : 'Do not push or deploy: the independent controller publishes and verifies it.';
    const prompt = [policy, 'CURRENT ACTIVATED CARD (supersedes old routine pause/PM handoff text):', JSON.stringify(instructions, null, 2), supplemental,
      'Finish the scoped implementation in this isolated worktree, make an exact candidate commit (identify commits as AI), and return the required JSON. ' + publicationInstruction + ' Do not change queue/status files. Use only affected checks. FAST copy-only work needs a syntax/scoped assertion, not a full Vite build. The publisher performs deterministic metadata/build as needed. Preserve unrelated work and real data. Use phase resource leases for browser/server work, release and clean owned processes before returning. Do not recursively spawn paid workers. Do not wait for routine PM approval already granted by the activated card.',
      task.sessionId ? 'Continue the exact saved session and existing worktree. Reconcile what actually finished before repeating a command. Preserve candidate commits and partial work.' : '',
      task.lastFailure ? 'The previous attempt failed as shown above. Use a different concrete correction; do not repeat the unchanged failure. If an external dependency remains, return BLOCKED with its exact condition.' : '',
      task.deliveryRepair ? 'Delivery repair: the integrationWorktree in the error is diagnostic context only. Preserve your assigned candidate worktree and declared base. Inspect the failed integration there, apply the scoped correction to your original candidate, and return its new commit. Do not substitute another worktree identity or silently adopt unrelated main changes; the publisher will integrate the corrected candidate again.' : '',
      'Return LOCAL_READY only with full candidateSha/baseSha, actual worktreePath, changedPaths and affected-check evidence. BLOCKED must state a concrete blocker. Product acceptance is not required to free execution capacity.'
    ].filter(Boolean).join('\n\n');
    await fs.writeFile(spec.promptPath, prompt, 'utf8');
    const specPath = path.join(directory, 'attempt.json'); await writeJson(specPath, spec);
    task.attempt = { runId, specPath, outputPath: spec.outputPath, jsonlPath: spec.jsonlPath, stderrPath: spec.stderrPath, checkpointPath: spec.checkpointPath,
      wrapperStdoutPath: spec.wrapperStdoutPath, wrapperStderrPath: spec.wrapperStderrPath, wrapperLaunchPath: spec.wrapperLaunchPath,
      brokerStdoutPath: spec.brokerStdoutPath, brokerStderrPath: spec.brokerStderrPath, startedAt: this.now() };
    task.resultPath = spec.outputPath; task.status = 'running'; task.runnerPid = null; task.runnerCreatedAt = null; task.brokerPid = null; task.brokerCreatedAt = null;
    task.probingClass = OUTAGE.has(task.failureClass) ? task.failureClass : null; task.retryAt = null; task.lastModelError = null; task.ownedProcesses = [];
    task.watchdogIncident = null; task.eventLogIssue = null; task.checkpointIssue = null; task.wrapperExit = null; task.lastProgressScanAt = null;
    task.lastFileProgressAt = this.now(); task.lastEventAt = null; task.progressFingerprint = null;
    await this.save(task); // The identity and retry checkpoint exist before spawn.
    try {
      let pid, broker = false;
      if (this.launchAdapter) pid = await this.launchAdapter(task, spec, this);
      else {
        const child = await spawnDetachedLogged(process.execPath,
          [path.join(this.scripts, 'worker-broker.mjs'), '--task', task.__file, '--attempt', specPath,
            '--powershell', this.config.controller.powershellPath ?? POWERSHELL, '--wrapper', path.join(this.scripts, 'run-task.ps1'), '--cwd', this.repo],
          { cwd: this.repo, stdoutPath: spec.brokerStdoutPath, stderrPath: spec.brokerStderrPath });
        pid = child.pid; broker = true;
      }
      if (broker) task.brokerPid = pid; else task.runnerPid = pid;
      await this.save(task); await this.event('worker_launched', { taskId: task.id, runId, pid, broker, sessionId: task.sessionId ?? null });
    } catch (error) { await this.failure(task, 'Worker launch failed: ' + error.message, 'environment'); }
  }
  async isolateCompletedAuthBlocker(task, processes) {
    if (task.status !== 'retry_wait' || task.failureClass !== 'auth' || !task.attempt?.runId) return false;
    const checkpoint = await readJson(task.attempt.checkpointPath);
    const result = await readJson(task.attempt.outputPath);
    if (!checkpoint?.finishedAt || checkpoint.taskId !== task.id || checkpoint.runId !== task.attempt.runId
      || checkpoint.sessionId && task.sessionId && checkpoint.sessionId !== task.sessionId
      || result?.taskId !== task.id || result.runId !== task.attempt.runId
      || result.state !== 'BLOCKED' || result.blockerType !== 'auth') return false;
    if (workerProcesses(task, checkpoint, processes).length) return false;
    const reason = result.blocker || result.summary;
    if (!reason || clean(reason) !== task.lastFailure) return false;
    task.failureReclassificationHistory = [...(task.failureReclassificationHistory ?? []), {
      at: this.now(), runId: task.attempt.runId, from: 'auth', to: 'external',
      reason: 'Completed worker downstream authentication blocker is task-scoped, not a Codex runtime outage',
      originalFailure: task.lastFailure, originalRetryAt: task.retryAt,
      originalInfrastructureRetries: task.infrastructureRetries, resultPath: task.attempt.outputPath,
    }];
    await this.failure(task, reason, 'external');
    await this.event('task_auth_blocker_isolated', { taskId: task.id, runId: task.attempt.runId });
    return true;
  }
  async reconcile(task, processes) {
    let checkpoint = null;
    try { checkpoint = task.attempt ? await readJson(task.attempt.checkpointPath) : null; }
    catch (error) { task.checkpointIssue = 'Invalid attempt checkpoint: ' + clean(error.message); }
    if (checkpoint && (checkpoint.runId !== task.attempt.runId || checkpoint.taskId !== task.id)) { task.checkpointIssue = 'Checkpoint identity mismatch'; checkpoint = null; }
    else if (checkpoint) task.checkpointIssue = null;
    if (!task.eventLogIssue) {
      try { await this.collectEvents(task); }
      catch (error) { task.eventLogIssue = clean(error.message); }
    }
    if (checkpoint?.sessionId) {
      if (task.sessionId && task.sessionId !== checkpoint.sessionId) task.eventLogIssue = 'Checkpoint session mismatch';
      else task.sessionId = checkpoint.sessionId;
    }
    const live = workerProcesses(task, checkpoint, processes);
    if (live.length) {
      const broker = live.find(p => /^node\.exe$/i.test(p.name) && normalize(p.commandLine).includes('worker-broker.mjs') && normalize(p.commandLine).includes(normalize(task.attempt.specPath)));
      if (broker) { task.brokerPid = broker.pid; task.brokerCreatedAt = broker.createdAt; }
      const runner = live.find(p => /^(powershell|pwsh)\.exe$/i.test(p.name) && normalize(p.commandLine).includes(normalize(task.attempt.specPath)));
      task.runnerPid = checkpoint?.runnerPid ?? runner?.pid ?? task.runnerPid; task.runnerCreatedAt = checkpoint?.runnerCreatedAt ?? runner?.createdAt ?? task.runnerCreatedAt;
      task.ownedProcesses = live.map(p => ({ pid: p.pid, createdAt: p.createdAt, name: p.name, parentPid: p.parentPid, observedAt: this.now() }));
      if (['local', 'synthetic'].includes(task.executionMode) && !task.liveMutation && !task.liveAuthorizationRef && task.resourceClass !== 'live-mutation') await this.scopedProgress(task);
      const reason = task.watchdogIncident?.reason ?? watchdogReason(task, this.clock());
      if (reason) {
        task.watchdogIncident ??= { runId: task.attempt.runId, at: this.now(), reason };
        try { await this.stopOwned(task, live); } catch (error) { this.issues.push({ code: 'OWNED_PROCESS_STOP_FAILED', taskId: task.id, message: clean(error.message) }); }
      }
      task.heartbeatAt = checkpoint?.heartbeatAt ?? task.heartbeatAt; await this.save(task); return;
    }
    // Preserve a bounded launch window for the OS and wrapper checkpoint write.
    if (!checkpoint?.finishedAt && this.clock() - timestamp(task.attempt?.startedAt) < 90000) { await this.save(task); return; }
    await this.saveReap(task, checkpoint);
    if (task.checkpointIssue || task.eventLogIssue) { await this.failure(task, task.checkpointIssue || task.eventLogIssue, 'environment'); return; }
    if (task.watchdogIncident) { await this.failure(task, 'Owned worker stopped: ' + task.watchdogIncident.reason, 'implementation'); return; }
    let result = null, malformed = null;
    try { result = task.attempt ? await readJson(task.attempt.outputPath) : null; } catch (error) { malformed = error.message; }
    if (result && (result.taskId !== task.id || result.runId !== task.attempt.runId)) { await this.failure(task, 'Final response belongs to a different task/attempt', 'environment'); return; }
    if (result?.state === 'LOCAL_READY') {
      try {
        const receipt = await this.validate(task, result);
        await this.acceptCandidate(task, receipt);
      } catch (error) { await this.failure(task, 'Candidate validation: ' + error.message); }
      return;
    }
    if (result?.state === 'BLOCKED') { if (await this.recognizeResourceWait(task, result, processes)) return; await this.failure(task, result.blocker || result.summary, workerBlockerClass(result)); return; }
    if (result?.state === 'NO_CHANGE') { await this.failure(task, result.summary || 'No scoped change; requires reconciliation', 'external'); return; }
    if (!checkpoint && task.attempt?.wrapperStderrPath) {
      const captured = [];
      if (task.attempt.wrapperLaunchPath) {
        try {
          const launch = await readJson(task.attempt.wrapperLaunchPath);
          if (launch && launch.taskId === task.id && launch.runId === task.attempt.runId && launch.activationId === task.activationId) {
            task.wrapperExit = { runId: launch.runId, status: launch.status, exitCode: launch.exitCode, signal: launch.signal, error: launch.error, at: launch.finishedAt ?? null };
            captured.push(`Wrapper launch receipt: ${JSON.stringify(task.wrapperExit)}`);
          } else if (launch) captured.push('Wrapper launch receipt identity mismatch');
        } catch (error) { captured.push('Wrapper launch receipt could not be read: ' + error.message); }
      }
      for (const [label, file] of [['stderr', task.attempt.wrapperStderrPath], ['stdout', task.attempt.wrapperStdoutPath], ['broker stderr', task.attempt.brokerStderrPath]]) {
        if (!file) continue;
        try { const text = (await fs.readFile(file, 'utf8')).slice(-16000).trim(); if (text) captured.push(`${label}: ${text}`); }
        catch (error) { if (error.code !== 'ENOENT') captured.push(`${label} could not be read: ${error.message}`); }
      }
      await this.failure(task, 'PowerShell wrapper exited before its first checkpoint. ' + (captured.join('\n') || 'Captured wrapper stdout/stderr contain no startup diagnostic.'), 'environment'); return;
    }
    let stderr = ''; try { stderr = (await fs.readFile(task.attempt.stderrPath, 'utf8')).slice(-16000); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const errorText = task.lastModelError || checkpoint?.error || stderr || malformed;
    if (errorText) { await this.failure(task, errorText); return; }
    if (!checkpoint?.finishedAt) { await this.failure(task, 'Owned worker processes exited before a final response; recover the same session and worktree', 'network'); return; }
    await this.failure(task, `Worker exit ${checkpoint.exitCode} without the required final JSON`);
  }
  async recognizeResourceWait(task, result, processes) {
    // A real named phase lease is a scheduling condition, never a provider/Auth denial.
    if (result?.state !== 'BLOCKED' || result.taskId !== task.id || result.runId !== task.attempt?.runId
      || !['external', 'environment', 'implementation'].includes(result.blockerType)
      || result.checks?.some(c => c.status === 'FAIL' && !(
        !(task.requiredChecks??[]).includes(c.name) && /_browser_phase_lease$/.test(c.name??'') && /BUSY browser; the recorded owner must finish or be factually recovered/.test(c.evidence??'')))
      || !/browser (?:phase )?lease (?:is held by another active task|remained owned elsewhere)/i.test(result.blocker ?? '')) return false;
    if (!task.lastWorkerReap?.exactAbsence || task.lastWorkerReap.runId !== result.runId
      || workerProcesses(task, null, processes).length || task.lastWorkerReap.owners?.some(o => processes.some(p => identityMatches(p, o)))) return false;
    if (!SHA.test(result.candidateSha ?? '') || result.baseSha !== task.baseSha
      || normalize(result.worktreePath) !== normalize(task.worktreePath) || !Array.isArray(result.changedPaths)) return false;
    const inherited=result.changedPaths.filter(f=>!allowed(f,task.allowedPaths));
    if(inherited.length){
      if(!SHA.test(task.candidateSha??'') || !inherited.every(f=>typeof f==='string' && !f.startsWith('-') && !f.includes('..')))return false;
      const ancestor=await this.command('git',['merge-base','--is-ancestor',task.candidateSha,result.candidateSha],{cwd:task.worktreePath});
      if(ancestor.code!==0)return false;
      const delta=await this.command('git',['diff','--name-only',task.candidateSha,result.candidateSha,'--',...inherited],{cwd:task.worktreePath});
      if(delta.code!==0||delta.stdout.trim())return false;
    }
    const evidence = (result.checks ?? []).map(c => c.evidence).join(' ');
    const ownerMatch = /owned by task ([a-z0-9._-]+) \(token ([a-f0-9-]{36})\)/i.exec(evidence);
    const lease = await readJson(path.join(this.runtime, 'leases', 'browser.json'));
    const namedAcquisitionFailure=(result.checks??[]).some(c=>c.status==='FAIL' && !(task.requiredChecks??[]).includes(c.name)
      && /_browser_phase_lease$/.test(c.name??'') && /BUSY browser; the recorded owner must finish or be factually recovered/.test(c.evidence??''));
    let holder;
    if(ownerMatch) holder=this.jobs.find(t=>t.id===ownerMatch[1]&&t.activationId===task.activationId&&t.attempt?.runId===ownerMatch[2]);
    else {
      // Read actual lease identity, never infer ownership from untrusted prose or treat Product FAIL as success.
      if(!namedAcquisitionFailure || lease?.version!==2 || lease.resource!=='browser' || lease.activationId!==task.activationId || lease.owner?.type!=='worker')return false;
      holder=this.jobs.find(t=>t.id===lease.taskId&&t.activationId===task.activationId&&t.status==='running'&&t.attempt?.runId===lease.owner.token);
      const ticks=value=>{const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,7}))?(Z|[+-]\d\d:\d\d)$/.exec(value??'');if(!m||!Number.isFinite(Date.parse(m[1]+m[3])))return null;return BigInt(Date.parse(m[1]+m[3]))*10000n+BigInt((m[2]??'').padEnd(7,'0'));};
      const ownerBirth=ticks(lease.owner.createdAt);
      if(!holder || ownerBirth===null || !processes.some(p=>p.pid===lease.owner.pid&&ticks(p.createdAt)===ownerBirth))return false;
    }
    if (!holder || holder.id === task.id) return false;
    if (lease && (lease.version !== 2 || lease.taskId !== holder.id || lease.activationId !== task.activationId
      || lease.owner?.type !== 'worker' || lease.owner.token !== holder.attempt.runId)) return false;
    if (!this.testOnly) {
      const head = await this.command('git', ['rev-parse', 'HEAD'], { cwd: task.worktreePath });
      const dirty = await this.command('git', ['status', '--porcelain=v1', '--untracked-files=no'], { cwd: task.worktreePath });
      if (head.code !== 0 || head.stdout.trim() !== result.candidateSha || dirty.code !== 0 || dirty.stdout.trim()) return false;
    }
    task.candidateSha = result.candidateSha;
    task.resourceWait = { name: 'browser', runId: result.runId, holderTaskId: holder.id, holderRunId: holder.attempt.runId, observedAt: this.now() };
    task.status = 'retry_wait'; task.failureClass = 'resource'; task.retryAt = null;
    task.lastFailure = result.blocker; task.runnerPid = null; task.runnerCreatedAt = null; task.brokerPid = null; task.brokerCreatedAt = null; task.ownedProcesses = [];
    await this.save(task); await this.event('resource_wait', { taskId: task.id, ...task.resourceWait }); return true;
  }
  async resolveResourceWaits(processes) {
    for (const task of this.jobs.filter(t => t.status === 'blocked' && !t.resourceWait)) {
      if (!/browser (?:phase )?lease (?:is held by another active task|remained owned elsewhere)/i.test(task.lastFailure ?? '')) continue;
      const result = task.attempt ? await readJson(task.attempt.outputPath) : null;
      await this.recognizeResourceWait(task, result, processes);
    }
    for (const task of this.jobs.filter(t => t.status === 'retry_wait' && t.failureClass === 'resource' && t.resourceWait)) {
      if (task.resourceWait.runId !== task.attempt?.runId || task.resourceWait.name !== 'browser') continue;
      if (await exists(path.join(this.runtime, 'leases', 'browser.json'))) continue;
      const wait = task.resourceWait;
      task.resourceWaitHistory = [...(task.resourceWaitHistory ?? []), { ...wait, releasedAt: this.now() }];
      task.resourceWait = null; task.status = 'pending'; task.retryAt = null; task.failureClass = null;
      await this.save(task); await this.event('resource_available', { taskId: task.id, name: wait.name, preservedSessionId: task.sessionId });
    }
  }
  async lease(task, name, action, token = null) {
    const result = await this.command(this.config.controller.powershellPath ?? POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', path.join(this.scripts, 'resource-lease.ps1'), '-Name', name, '-Action', action,
        '-TaskFile', task.__file, '-RuntimeRoot', this.runtime, '-WaitSeconds', '0', ...(token ? ['-OwnerToken', token] : [])]);
    if (result.code === 3) return false;
    if (result.code !== 0) throw new Error('Resource lease: ' + clean(result.stderr || result.stdout));
    return action === 'acquire' ? { name, token: this.identity.instanceId, taskId: task.id } : true;
  }
  async reapFinishedLeases() {
    for (const name of ['browser', 'integration', 'live-mutation']) {
      try {
        const lease = await readJson(path.join(this.runtime, 'leases', name + '.json'));
        if (!lease || lease.version !== 2 || lease.owner?.type !== 'worker') continue;
        const task = this.jobs.find(t => t.id === lease.taskId && t.activationId === lease.activationId);
        if (!task?.lastWorkerReap?.exactAbsence || task.lastWorkerReap.runId !== lease.owner.token) continue;
        // The lease script independently rechecks all exact process identities
        // and this live controller before removing this one recorded phase lease.
        if (await this.lease(task, name, 'reap', this.identity.instanceId)) await this.event('finished_worker_lease_reaped', { taskId: task.id, resource: name, runId: lease.owner.token });
      } catch (error) { this.issues.push({ code: 'PHASE_LEASE_REAP_FAILED', resource: name, message: clean(error.message) }); }
    }
  }
  async startDelivery(task) {
    if (await this.paused()) return;
    const eligibility = await this.eligibility(task);
    if (!eligibility.eligible) {
      if (eligibility.closed === true) { task.status = 'closed'; task.closedFromCanonicalAt = this.now(); await this.save(task); }
      else await this.failure(task, eligibility.reason ?? 'Product publication is now deferred', 'external');
      return;
    }
    task.deliveryOwner = { pid: this.identity.pid, instanceId: this.identity.instanceId, createdAt: this.identity.createdAt };
    task.deliveryStartedAt ??= this.now(); await this.save(task);
    if (!this.publisher) {
      const modulePath = this.config.controller.publisherPath ?? path.join(this.scripts, 'publisher.mjs');
      this.publisher = (await import(pathToFileURL(path.resolve(modulePath)).href)).publishCandidate;
    }
    const options = { ticketId: task.productId, taskId: task.id, cwd: task.worktreePath, candidateSha: task.candidateSha, baseSha: task.baseSha,
      stateDir: path.join(this.runtime, 'delivery', task.id), productionUrl: this.config.controller.productionUrl ?? 'https://rakeezx.com',
      repository: this.config.controller.repository ?? 'RakeezX/RakeezX', remote: this.config.controller.remote ?? 'origin', branch: this.config.controller.branch ?? 'main',
      validationTier: task.validationTier === 'FAST' || !task.validationTier && task.riskClass === 'FAST' ? 'FAST' : 'STANDARD', validationReceipt: task.validationReceipt,
      dependencyDir: path.join(this.repo, 'node_modules'), verificationPaths: task.verificationPaths,
      acquireLease: name => this.lease(task, name, 'acquire'), releaseLease: token => this.lease(task, token.name, 'release', token.token),
      onProgress: progress => { this.progress = { ...progress, at: this.now(), taskId: task.id }; } };
    this.deliveryInFlight = { taskId: task.id, candidateSha: task.candidateSha };
    Promise.resolve().then(() => this.publisher(options)).then(receipt => { this.deliveryResult = { taskId: task.id, candidateSha: task.candidateSha, receipt }; },
      error => { this.deliveryResult = { taskId: task.id, candidateSha: task.candidateSha, receipt: { status: 'pending', retryable: true, retryAfterSeconds: 30, errorCode: 'ADAPTER_EXCEPTION', message: clean(error.message) } }; });
    await this.event('delivery_started', { taskId: task.id, candidateSha: task.candidateSha });
  }
  async collectDelivery() {
    if (!this.deliveryResult) return;
    const result = this.deliveryResult; this.deliveryResult = null; this.deliveryInFlight = null;
    const task = this.jobs.find(t => t.id === result.taskId);
    if (!task || task.status !== 'delivery' || task.candidateSha !== result.candidateSha) { this.issues.push({ code: 'DELIVERY_RESULT_IDENTITY_CHANGED', taskId: result.taskId }); return; }
    const receipt = result.receipt; task.deliveryReceipt = receipt;
    if (receipt.status === 'deployed') {
      if (!verifiedDeployment(task, receipt, this.config.controller.productionUrl)) { task.status = 'blocked'; task.failureClass = 'environment'; task.lastFailure = 'Publisher returned incomplete or mismatched deployment proof'; }
      else { task.status = 'awaiting_po'; task.productionVerifiedAt = receipt.verifiedAt ?? receipt.at ?? this.now(); task.deliveryOwner = null; task.lastFailure = null; task.failureClass = null; }
    } else if (receipt.status === 'pending' || receipt.retryable) {
      task.nextDeliveryAt = new Date(this.clock() + Math.max(5, Math.min(3600, Number(receipt.retryAfterSeconds) || 30)) * 1000).toISOString();
      task.lastFailure = clean(receipt.errorCode + ': ' + receipt.message);
      if(observeUnchangedParity(task,receipt,this.now())) {
        task.status='blocked';task.failureClass='external';task.deliveryOwner=null;task.nextDeliveryAt=null;
        task.lastFailure='SOURCE_PARITY_PENDING: repeated unchanged failing asset set after provider/immutable success. Preserve candidate and failed proof; diagnose exact mismatch before another delivery attempt. No Production acceptance.';
      }
    } else if (['BUILD_FAILED', 'MERGE_CONFLICT'].includes(receipt.errorCode)) {
      await this.failure(task, `${receipt.errorCode}: ${receipt.message}\n${receipt.context ?? ''}`, 'implementation', { delivery: receipt }); return;
    } else { task.status = 'blocked'; task.failureClass = 'external'; task.lastFailure = clean(`${receipt.errorCode}: ${receipt.message}`); task.deliveryOwner = null; }
    await this.save(task); await this.event(task.status === 'awaiting_po' ? 'production_verified' : 'delivery_state', { taskId: task.id, status: task.status, publishedSha: receipt.publishedSha, code: receipt.errorCode });
  }
  async persistSnapshot(summary) {
    const primary=path.join(this.runtime,'ACTIVE_TASKS.json');
    try {
      await writeJson(primary,summary);
      if(this.summaryWriteFailure) await this.event('summary_write_recovered',{previousCode:this.summaryWriteFailure.code});
      this.summaryWriteFailure=null;
    } catch(error) {
      if(!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
      // Queue records remain authoritative. A locked DISPLAY summary must not kill productive workers' coordinator.
      const diagnostic={code:'PRIMARY_SUMMARY_WRITE_FAILED',errorCode:error.code,message:'Primary snapshot could not be atomically replaced; fresh fallback snapshot is available.'};
      const fallback={...summary,primarySnapshotWritable:false,snapshotPath:'ACTIVE_TASKS.fallback.json',issues:[...summary.issues,diagnostic]};
      await writeJson(path.join(this.runtime,'ACTIVE_TASKS.fallback.json'),fallback);
      if(!this.summaryWriteFailure || this.clock()-timestamp(this.summaryWriteFailure.at)>60000) {
        this.summaryWriteFailure={code:error.code,at:this.now()};
        await this.event('primary_summary_write_failed',{errorCode:error.code,fallback:'ACTIVE_TASKS.fallback.json',authoritativeQueuePreserved:true});
      }
    }
  }
  async snapshot(paused, inventoryKnown = true) {
    const active = this.jobs.filter(t => ['running', 'delivery'].includes(t.status));
    const health = summarizeQueueHealth(this.jobs, this.noteCache?.openProducts, this.now());
    await this.persistSnapshot({ version: 6, at: this.now(), controllerPid: process.pid, instanceId: this.instanceId,
      activationId: this.config.controller.activationId, controllerAlive: true, processInventoryKnown: inventoryKnown, paused,
      maxWorkers: Number(this.config.maxWorkers), runningCount: this.jobs.filter(t => t.status === 'running').length,
      blockedCount: health.blockedAttempts, historicalBlockedCount: health.historicalBlockedAttempts, actionableBlockedCount: health.actionableBlockedAttempts, actionableBlockedProductCount: health.actionableBlockedProductCount, actionableBlockedByProduct: health.actionableBlockedByProduct, verifiedPublicationReceipts: health.verifiedPublicationReceipts, verifiedPublishedProductCount: health.verifiedPublishedProductCount, medianMinutesFromCardToVerifiedPublication: health.medianMinutesFromCardToVerifiedPublication, lastVerifiedDeliveryAt: health.lastVerifiedDeliveryAt, awaitingPOProductCount: new Set(this.jobs.filter(t => t.status === 'awaiting_po').map(t => t.productId)).size, pendingCount: this.jobs.filter(t => t.status === 'pending').length, awaitingPOCount: this.jobs.filter(t => t.status === 'awaiting_po').length,
      active: active.map(t => ({ id: t.id, productId: t.productId, status: t.status, runnerPid: t.runnerPid, sessionId: t.sessionId, candidateSha: t.candidateSha })),
      tasks: this.jobs.map(t => ({ id: t.id, productId: t.productId, status: t.status, retryAt: t.retryAt, nextDeliveryAt: t.nextDeliveryAt, lastFailure: t.lastFailure })),
      notesCheckedAt:this.noteReadAt?new Date(this.noteReadAt).toISOString():null, notesWithoutExecution:this.unassignedNotes??[],
      deliveryInFlight: this.deliveryInFlight, lastDeliveryProgress: this.progress,
      idleReason: paused ? 'PAUSED_BY_MARKER' : !inventoryKnown ? 'PROCESS_INVENTORY_UNAVAILABLE' : active.length ? null : this.jobs.some(t => t.status === 'pending') ? 'PENDING_ELIGIBILITY' : this.jobs.some(t => t.status === 'retry_wait') ? 'WAITING_SAVED_RETRY' : this.jobs.some(t => t.status === 'blocked') ? 'BLOCKED_ACTIVATED_WORK' : 'NO_ACTIVATED_PENDING_CARDS',
      issues: this.issues });
  }
  async tick() {
    this.issues = []; await this.loadConfig(); await this.loadRecords(); await this.loadJobs();
    const paused = await this.paused();
    if (!paused) await this.importCatalog();
    await this.collectDelivery();
    let processes;
    try { processes = await this.inventory(); }
    catch (error) { this.issues.push({ code: 'PROCESS_INVENTORY_UNAVAILABLE', message: clean(error.message) }); await this.snapshot(paused, false); return; }
    for (const task of this.jobs.filter(t => t.status === 'retry_wait' && t.failureClass === 'auth')) {
      try { await this.isolateCompletedAuthBlocker(task, processes); }
      catch (error) { this.issues.push({ code: 'SCOPED_AUTH_RECONCILE_FAILED', taskId: task.id, message: clean(error.message) }); }
    }
    for (const task of this.jobs.filter(t => t.status === 'running')) {
      try { await this.reconcile(task, processes); }
      catch (error) { this.issues.push({ code: 'RECONCILE_FAILED', taskId: task.id, message: clean(error.message) }); }
    }
    await this.reapFinishedLeases();
    await this.resolveResourceWaits(processes);
    for (const task of this.jobs.filter(t => t.status === 'awaiting_po')) {
      const eligibility = await this.eligibility(task);
      if (eligibility.closed === true) {
        const closed = { ...task, status: 'closed', closedFromCanonicalAt: this.now() };
        try { await this.save(closed); Object.assign(task, closed); }
        catch (error) {
          this.issues.push({ code: 'QUEUE_WRITE_FAILED', taskId: task.id, operation: 'close_from_canonical', errorCode: error.code ?? null, message: clean(error.message) });
        }
      }
    }
    if (!paused) {
      if (!this.deliveryInFlight) {
        // The oldest started delivery retains its lane even while waiting for a
        // provider; later candidates cannot overtake its production observation.
        const lane = this.jobs.filter(t => t.status === 'delivery').sort((a, b) => timestamp(a.deliveryStartedAt ?? a.deliveryQueuedAt) - timestamp(b.deliveryStartedAt ?? b.deliveryQueuedAt))[0];
        if (lane && timestamp(lane.nextDeliveryAt) <= this.clock()) {
          try { await this.startDelivery(lane); } catch (error) { lane.nextDeliveryAt = new Date(this.clock() + 30000).toISOString(); lane.lastFailure = clean(error.message); await this.save(lane); }
        }
      }
      const active = this.jobs.filter(t => t.status === 'running');
      const candidates = this.jobs.filter(t => t.status === 'pending' || t.status === 'retry_wait' && !t.resourceWait && timestamp(t.retryAt) <= this.clock() || this.savedBaseMismatch(t));
      for (const task of candidates) {
        if (active.length >= Number(this.config.maxWorkers)) break;
        const outage = this.jobs.filter(t => OUTAGE.has(t.failureClass) && t.status === 'retry_wait' || t.status === 'running' && OUTAGE.has(t.probingClass));
        const probe = outage.filter(t => t.status === 'retry_wait' && timestamp(t.retryAt) <= this.clock()).sort((a, b) => timestamp(a.retryAt) - timestamp(b.retryAt))[0];
        if (outage.length && (task !== probe || active.some(t => OUTAGE.has(t.probingClass)))) continue;
        if (this.jobs.some(other => other.id !== task.id && ['running', 'delivery'].includes(other.status) && scopesOverlap(task, other))) continue;
        if (task.dependsOn?.some(id => !this.jobs.some(t => (t.id === id || t.productId === id) && ['awaiting_po', 'closed'].includes(t.status)))) continue;
        const eligibility = await this.eligibility(task);
        if (!eligibility.eligible) {
          if (eligibility.closed === true) { task.status = 'closed'; task.closedFromCanonicalAt = this.now(); await this.save(task); }
          else await this.failure(task, eligibility.reason ?? 'Product is deferred or outside current execution scope', 'external');
          continue;
        }
        if (!task.releaseAuthority || task.liveMutation && !task.liveAuthorizationRef) { await this.failure(task, 'This card lacks its precise release/data authority', 'external'); continue; }
        if (task.completionMode === 'record_published_evidence') {
          try { await this.completePublishedEvidence(task, processes); }
          catch (error) { await this.failure(task, 'Evidence verification: '+clean(error.message), 'environment'); }
          continue;
        }
        if (this.savedBaseMismatch(task)) {
          try { await this.recoverSavedBaseMismatch(task, processes); }
          catch (error) { this.issues.push({ code: 'SAVED_BASE_RECOVERY_DEFERRED', taskId: task.id, message: clean(error.message) }); }
          continue;
        }
        await this.launch(task); if (task.status === 'running') active.push(task);
      }
    }
    await this.syncRecords();
    await this.snapshot(await this.paused());
  }
  async close() {
    this.stopping = true;
    await this.event('controller_stopping', { activeWorkerProcessesPreserved: true });
    if (this.locked) { const file = path.join(this.runtime, 'controller.lock'); const owner = await readJson(file); if (owner?.instanceId === this.instanceId) await fs.rm(file, { force: true }); }
  }
}

async function main() {
  const options = {}; let once = false;
  for (let index = 2; index < process.argv.length; index++) {
    const flag = process.argv[index];
    if (flag === '--once') { once = true; continue; }
    const keys = { '--runtime': 'runtime', '--repo': 'repo', '--config': 'config', '--instance-id': 'instanceId' };
    if (!keys[flag] || !process.argv[index + 1]) throw new Error('Usage: controller.mjs --runtime PATH --repo PATH [--config PATH] [--once]');
    options[keys[flag]] = process.argv[++index];
  }
  const controller = new Controller(options);
  await controller.initialize();
  const stop = () => { controller.stopping = true; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try {
    do {
      try { await controller.tick(); }
      catch (error) { await controller.event('tick_failed', { message: clean(error.message) }); throw error; }
      if (once) break;
      // A stopped launcher waits for its current publisher. Workers remain
      // independently recoverable; no unrelated process tree is ever killed.
      if (controller.stopping && !controller.deliveryInFlight) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    } while (true);
  } finally { await controller.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(clean(error.message)); process.exitCode = /CONTROLLER_ALREADY_RUNNING/.test(error.message) ? 0 : 1; });
