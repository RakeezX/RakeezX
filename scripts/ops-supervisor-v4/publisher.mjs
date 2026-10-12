#!/usr/bin/env node
/**
 * RAKEEZ delivery adapter. The controller owns ticket policy and the integration
 * lane; this module owns commit -> non-forced main push -> provider/source proof.
 * No shell interpolation, canonical checkout edits, secret discovery, or browser.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;
const GENERATED = 'src/generated/build-meta.generated.js';
const ROOT_ASSETS = new Set(['index.html', 'sw.js', 'manifest.webmanifest']);
const MAX_OUTPUT = 4 * 1024 * 1024;
const MAX_ASSET = 16 * 1024 * 1024;
const PROVIDER_APP = 'cloudflare-workers-and-pages';
// Exact JSD injection observed on this deployment. Only the ray and encoded
// timestamp vary. This is a byte-comparison transform, never script execution.
const CF_JSD_TEMPLATE = `<script>(function(){function c(){var b=a.contentDocument||(a.contentWindow&&a.contentWindow.document);if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'CF_RAY_VALUE',t:'CF_TIME_VALUE'};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>`;
const CF_JSD = new RegExp(CF_JSD_TEMPLATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace('CF_RAY_VALUE', '([a-f0-9]{16})').replace('CF_TIME_VALUE', '([A-Za-z0-9+/]{12,24}={0,2})'));
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const json = text => JSON.parse(String(text).replace(/^\uFEFF/, ''));
const asText = result => Buffer.from(result.stdout ?? '').toString('utf8').trim();

function cleanMessage(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/\b(?:github_pat_|gh[pousr]_|sb_secret_)[A-Za-z0-9_]+/g, '[redacted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[redacted]@')
    .replace(/\b(?:access_token|refresh_token|authorization)\s*[=:]\s*[^\s,;]+/gi, '[redacted]')
    .slice(-3000);
}

class DeliveryError extends Error {
  constructor(code, message, retryable = false, details = {}) {
    super(cleanMessage(message));
    Object.assign(this, { code, retryable, details });
  }
}

export async function runCommand(command, args, options = {}) {
  if (typeof command !== 'string' || !Array.isArray(args) || args.some(x => typeof x !== 'string')) {
    throw new DeliveryError('INVALID_COMMAND', 'Commands require a program and a string argv array');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd, env: options.env ?? process.env, shell: false,
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal: options.signal,
    });
    let stdout = [], stderr = [], length = 0, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeoutMs ?? 120000);
    const capture = destination => chunk => {
      length += chunk.length;
      if (length > (options.maxOutput ?? MAX_OUTPUT)) child.kill();
      else destination.push(chunk);
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (length > (options.maxOutput ?? MAX_OUTPUT)) return reject(new DeliveryError('OUTPUT_LIMIT', 'Command output exceeded the bounded capture limit'));
      if (timedOut) return reject(new DeliveryError('COMMAND_TIMEOUT', 'Delivery command exceeded its deadline', true));
      resolve({ code: code ?? -1, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}

async function readJson(file, fallback = null) {
  try { return json(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

async function lock(file) {
  const token = randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(file, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, at: now() }));
      await handle.close();
      return async () => {
        const owner = await readJson(file);
        if (owner?.token === token) await fs.rm(file, { force: true });
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = await readJson(file);
      if (!Number.isSafeInteger(owner?.pid) || owner.pid <= 0) throw new DeliveryError('JOURNAL_LOCK_INVALID', 'Inspect the invalid delivery lock before resuming');
      let alive = true;
      try { process.kill(owner.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') alive = false; }
      if (alive) throw new DeliveryError('DELIVERY_BUSY', 'Another process owns this delivery journal', true);
      await fs.rm(file);
    }
  }
  throw new DeliveryError('DELIVERY_BUSY', 'Delivery lock changed during recovery', true);
}

function validateOptions(options) {
  for (const field of ['ticketId', 'candidateSha', 'baseSha', 'cwd', 'stateDir']) {
    if (!options[field]) throw new DeliveryError('INVALID_INPUT', `Missing ${field}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,139}$/.test(options.ticketId)) throw new DeliveryError('INVALID_INPUT', 'Invalid ticket ID');
  if (!SHA.test(options.candidateSha) || !SHA.test(options.baseSha)) throw new DeliveryError('INVALID_INPUT', 'Candidate and base must be full 40-character Git SHAs');
  const production = new URL(options.productionUrl ?? 'https://rakeezx.com');
  if (production.protocol !== 'https:' || production.username || production.password || production.pathname !== '/' || production.search || production.hash) {
    throw new DeliveryError('INVALID_INPUT', 'Production URL must be an HTTPS origin without credentials');
  }
  const remote = options.remote ?? 'origin', branch = options.branch ?? 'main';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote) || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)
      || branch.includes('..') || branch.endsWith('/') || branch.includes('//')) throw new DeliveryError('INVALID_INPUT', 'Invalid remote or branch');
  const pagesProject = options.pagesProject ?? 'rakeezx';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pagesProject)) throw new DeliveryError('INVALID_INPUT', 'Invalid Pages project');
  const validationTier = options.validationTier ?? 'STANDARD';
  if (!['FAST', 'STANDARD'].includes(validationTier)) throw new DeliveryError('INVALID_INPUT', 'Validation tier must be FAST or STANDARD');
  if (options.verifiedBuildSha && !SHA.test(options.verifiedBuildSha)) throw new DeliveryError('INVALID_INPUT', 'Verified build SHA must be a full commit SHA');
  return { ...options, candidateSha: options.candidateSha.toLowerCase(), baseSha: options.baseSha.toLowerCase(),
    cwd: path.resolve(options.cwd), stateDir: path.resolve(options.stateDir), remote, branch, pagesProject, validationTier,
    productionUrl: production.origin, providerAppId: options.providerAppId ?? 85455 };
}

function repoPath(value) {
  const normalized = String(value).replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || /[\u0000-\u001f\u007f]/.test(normalized)
      || normalized.split('/').some(x => !x || x === '.' || x === '..')) throw new DeliveryError('INVALID_PATH', 'Unsafe repository asset path');
  return normalized;
}

function defaultAsset(file) {
  return ROOT_ASSETS.has(file) || file.startsWith('src/') || file.startsWith('assets/');
}

function assetUrl(origin, file, sha) {
  const result = new URL('/' + file.split('/').map(encodeURIComponent).join('/'), origin);
  result.searchParams.set('__rakeez_delivery', sha);
  return result;
}

export function parseProviderCheck(check, { publishedSha, pagesProject = 'rakeezx', providerAppId = 85455 }) {
  if (check?.head_sha !== publishedSha || check.name !== 'Cloudflare Pages'
      || check.app?.slug !== PROVIDER_APP || Number(check.app?.id) !== providerAppId) return null;
  const escaped = pagesProject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(`https://([a-f0-9]{8})\\.${escaped}\\.pages\\.dev\\b`, 'i');
  const previewMatch = String(check.output?.summary ?? '').match(expression);
  let deploymentId = null;
  try {
    const detail = new URL(check.details_url);
    if (detail.protocol === 'https:' && detail.hostname === 'dash.cloudflare.com') {
      const location = decodeURIComponent(detail.searchParams.get('to') ?? detail.pathname);
      deploymentId = location.match(new RegExp(`/pages/view/${escaped}/([a-f0-9-]{36})(?:/|$)`, 'i'))?.[1] ?? null;
    }
  } catch { /* A provider result without exact deployment metadata is not proof. */ }
  const validDeployment = deploymentId && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(deploymentId);
  const exactPreview = previewMatch && validDeployment && previewMatch[1].toLowerCase() === deploymentId.slice(0, 8).toLowerCase();
  return { checkRunId: String(check.id), headSha: check.head_sha, status: check.status,
    conclusion: check.conclusion, startedAt: check.started_at ?? null, completedAt: check.completed_at ?? null,
    headBranch: check.check_suite?.head_branch ?? null,
    deploymentId: validDeployment ? deploymentId.toLowerCase() : null,
    previewUrl: exactPreview ? `https://${previewMatch[1].toLowerCase()}.${pagesProject}.pages.dev` : null,
    detailsUrl: validDeployment ? check.details_url : null };
}

async function boundedBody(response) {
  if (Number(response.headers.get('content-length')) > MAX_ASSET) throw new DeliveryError('ASSET_TOO_LARGE', 'Published asset exceeds verification size limit');
  const parts = []; let bytes = 0;
  for await (const part of response.body ?? []) {
    bytes += part.length;
    if (bytes > MAX_ASSET) throw new DeliveryError('ASSET_TOO_LARGE', 'Published asset exceeds verification size limit');
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}

/** Recognize one exact provider injection; all remaining bytes stay unchanged. */
export function normalizeCloudflareIndex(bytes, metadata) {
  if (metadata.repoPath !== 'index.html' || metadata.urlPath !== 'index.html'
      || metadata.statusCode !== 200 || String(metadata.server).toLowerCase() !== 'cloudflare'
      || !/^text\/html(?:\s*;|$)/i.test(metadata.contentType ?? '')
      || metadata.mitigated === 'challenge') return null;
  const source = Buffer.from(bytes).toString('latin1');
  const marker = 'window.__CF$cv$params';
  if (source.indexOf(marker) < 0 || source.indexOf(marker) !== source.lastIndexOf(marker)) return null;
  const match = source.match(CF_JSD);
  if (!match || source.slice(match.index + match[0].length, match.index + match[0].length + 7) !== '</body>') return null;
  const timestamp = Buffer.from(match[2], 'base64');
  if (!/^[0-9]{10}$/.test(timestamp.toString('ascii')) || timestamp.toString('base64') !== match[2]) return null;
  const normalized = Buffer.concat([Buffer.from(bytes).subarray(0, match.index), Buffer.from(bytes).subarray(match.index + match[0].length)]);
  return { normalization: 'cloudflare-jsd-v1', normalizedSha256: hash(normalized), normalizedBytes: normalized.length,
    removedProviderBytes: match[0].length, removedSha256: hash(Buffer.from(match[0], 'latin1')) };
}

async function verifyOrigin(origin, assets, publishedSha, fetcher, signal) {
  const results = [];
  // At most four HTTP reads at once; bodies and log output are never persisted.
  for (let offset = 0; offset < assets.length; offset += 4) {
    const batch = await Promise.all(assets.slice(offset, offset + 4).map(async asset => {
      const timeout = AbortSignal.timeout(20000);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const response = await fetcher(assetUrl(origin, asset.urlPath, publishedSha), {
        method: 'GET', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, redirect: 'follow', signal: combined,
      });
      if (response.url && new URL(response.url).origin !== origin) throw new DeliveryError('UNEXPECTED_REDIRECT', 'Asset verification left its expected deployment origin');
      const bytes = await boundedBody(response), observedSha256 = hash(bytes);
      const normalized = observedSha256 === asset.sha256 ? null : normalizeCloudflareIndex(bytes, {
        repoPath: asset.repoPath, urlPath: asset.urlPath, statusCode: response.status,
        server: response.headers.get('server'), contentType: response.headers.get('content-type'),
        mitigated: response.headers.get('cf-mitigated'),
      });
      const gone = asset.deleted && [404, 410].includes(response.status);
      const fallback = asset.deleted && response.status === 200 && /text\/html/i.test(response.headers.get('content-type') ?? '')
        && assets.some(x => x.repoPath === 'index.html' && !x.deleted && x.sha256 === observedSha256);
      return { repoPath: asset.repoPath, urlPath: asset.urlPath, statusCode: response.status,
        expectedSha256: asset.sha256 ?? null, observedSha256, bytes: bytes.length,
        deleted: asset.deleted, verified: asset.deleted ? (gone || fallback) : response.status === 200
          && (observedSha256 === asset.sha256 || normalized?.normalizedSha256 === asset.sha256),
        ...normalized,
        ...(fallback ? { deletionResponse: 'current-index-fallback' } : {}) };
    }));
    results.push(...batch);
  }
  return { origin, checkedAt: now(), passed: results.every(x => x.verified), assets: results };
}

/** Read-only live capability check. It never fetches Git objects or writes files. */
export async function observePublishedCommit(options, dependencies = {}) {
  const execute = dependencies.run ?? runCommand, fetcher = dependencies.fetch ?? globalThis.fetch;
  const opts = validateOptions({ ...options, ticketId: options.ticketId ?? 'OBSERVE',
    candidateSha: options.publishedSha, baseSha: options.publishedSha,
    stateDir: options.stateDir ?? path.join(options.cwd, '.unused-observe-state') });
  const git = async args => {
    const result = await execute('git', args, { cwd: opts.cwd, signal: opts.signal });
    if (result.code !== 0) throw new DeliveryError('OBSERVE_GIT_FAILED', 'Local Git evidence is unavailable; observation makes no fetch or checkout changes');
    return result;
  };
  try {
    const repository = opts.repository ?? json(asText(await execute('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd: opts.cwd, signal: opts.signal }))).nameWithOwner;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new DeliveryError('INVALID_REPOSITORY', 'Expected owner/repository');
    const head = asText(await git(['ls-remote', '--heads', opts.remote, `refs/heads/${opts.branch}`])).split(/\s+/)[0];
    if (head !== opts.candidateSha) throw new DeliveryError('OBSERVE_MAIN_CHANGED', 'Requested observed SHA is not the current main head', true);
    const raw = await execute('gh', ['api', '--method', 'GET', `repos/${repository}/commits/${opts.candidateSha}/check-runs?per_page=100`,
      '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'], { cwd: opts.cwd, signal: opts.signal, timeoutMs: 30000 });
    if (raw.code !== 0) throw new DeliveryError('CHECKS_UNAVAILABLE', 'GitHub provider checks are unavailable', true);
    const payload = json(asText(raw));
    if (!Array.isArray(payload.check_runs) || payload.total_count > 100) throw new DeliveryError('CHECKS_UNVERIFIED', 'Unexpected or truncated provider check list');
    const provider = payload.check_runs.map(check => parseProviderCheck(check, {
      publishedSha: opts.candidateSha, pagesProject: opts.pagesProject, providerAppId: opts.providerAppId,
    })).filter(Boolean).filter(check => !check.headBranch || check.headBranch === opts.branch)
      .sort((a, b) => Number(b.checkRunId) - Number(a.checkRunId))[0];
    if (!provider || provider.status !== 'completed' || provider.conclusion !== 'success' || !provider.previewUrl) {
      throw new DeliveryError('PROVIDER_UNVERIFIED', 'No exact successful provider deployment with immutable URL was found', true);
    }
    const mapping = new Map(['index.html', 'sw.js', GENERATED].map(file => [file, file]));
    for (const input of opts.verificationPaths ?? []) {
      const entry = typeof input === 'string' ? { repoPath: input, urlPath: input } : input;
      mapping.set(repoPath(entry.repoPath), repoPath(entry.urlPath ?? entry.repoPath));
    }
    const assets = [];
    for (const [file, urlPath] of mapping) {
      const bytes = (await git(['show', `${opts.candidateSha}:${file}`])).stdout;
      assets.push({ repoPath: file, urlPath, sha256: hash(bytes), bytes: bytes.length, deleted: false });
    }
    const immutable = await verifyOrigin(provider.previewUrl, assets, opts.candidateSha, fetcher, opts.signal);
    const production = await verifyOrigin(opts.productionUrl, assets, opts.candidateSha, fetcher, opts.signal);
    const stableHead = asText(await git(['ls-remote', '--heads', opts.remote, `refs/heads/${opts.branch}`])).split(/\s+/)[0];
    return { version: 1, readOnly: true, status: immutable.passed && production.passed && stableHead === head ? 'verified' : 'pending',
      repository, publishedSha: head, currentMainSha: stableHead, productionUrl: opts.productionUrl,
      previewUrl: provider.previewUrl, deploymentId: provider.deploymentId, provider,
      evidence: { immutable, production }, verifiedAt: now() };
  } catch (error) {
    return { version: 1, readOnly: true, status: error.retryable ? 'pending' : 'blocked',
      publishedSha: opts.candidateSha, errorCode: error.code ?? 'OBSERVATION_ERROR', message: cleanMessage(error.message) };
  }
}

/** Controller interface; dependencies are only for deterministic local tests. */
export async function publishCandidate(options, dependencies = {}) {
  let opts, unlock, lease, journal, journalFile;
  const execute = dependencies.run ?? runCommand, fetcher = dependencies.fetch ?? globalThis.fetch;
  const notify = async progress => { try { await options.onProgress?.(progress); } catch { /* UI callback does not own publication state. */ } };
  const finish = async result => {
    const receipt = { version: 1, ticketId: opts?.ticketId ?? options.ticketId, taskId: options.taskId ?? null,
      candidateSha: opts?.candidateSha ?? options.candidateSha, baseSha: opts?.baseSha ?? options.baseSha,
      publishedSha: journal?.publishedSha ?? null, productionUrl: opts?.productionUrl ?? options.productionUrl,
      at: now(), ...result };
    if (opts && journalFile) {
      await writeJson(path.join(opts.stateDir, `${opts.candidateSha}.receipt.json`), receipt);
      await writeJson(path.join(opts.stateDir, 'receipt.json'), receipt);
    }
    return receipt;
  };
  try {
    opts = validateOptions(options);
    await fs.mkdir(opts.stateDir, { recursive: true });
    unlock = await lock(path.join(opts.stateDir, '.publisher.lock'));
    journalFile = path.join(opts.stateDir, `${opts.candidateSha}.journal.json`);
    const git = async (args, cwd = opts.cwd, allowFailure = false) => {
      // These calls materialize/read the isolated checkout. Scope the Windows
      // long-path setting to each command; never change Git or OS configuration.
      const integrationFilesystem = args.includes('worktree') || cwd === journal?.worktree;
      const commandArgs = (dependencies.platform ?? process.platform) === 'win32' && integrationFilesystem
        ? ['-c', 'core.longpaths=true', ...args] : args;
      const result = await execute('git', commandArgs, { cwd, signal: opts.signal, timeoutMs: 120000 });
      if (result.code !== 0 && !allowFailure) {
        let first = 0;
        while (args[first] === '-c') first += 2;
        const operation = args[first] === 'worktree' ? `worktree ${args[first + 1]}` : args[first];
        const stderr = cleanMessage(asText({ stdout: result.stderr }));
        // A local checkout/build-preparation error needs its actual cause
        // retained. Recreating the same checkout is not evidence of main churn.
        const localPreparationFailure = integrationFilesystem && journal?.stage === 'preparing';
        throw new DeliveryError('GIT_FAILED', stderr || `Git operation failed (${operation})`, !localPreparationFailure,
          { operation, exitCode: result.code, stderr });
      }
      return result;
    };
    const identity = ['-c', 'user.name=RAKEEZ Ops AI', '-c', 'user.email=ai-assistant@local.invalid'];
    const ancestor = async (older, newer) => {
      const result = await git(['merge-base', '--is-ancestor', older, newer], opts.cwd, true);
      if (![0, 1].includes(result.code)) throw new DeliveryError('ANCESTRY_UNVERIFIED', 'Git ancestry could not be established');
      return result.code === 0;
    };
    const remoteHead = async () => {
      const output = asText(await git(['ls-remote', '--heads', opts.remote, `refs/heads/${opts.branch}`]));
      const lines = output.split(/\r?\n/).filter(Boolean);
      const pieces = lines.length === 1 ? lines[0].split(/\s+/) : [];
      if (!SHA.test(pieces[0] ?? '') || pieces[1] !== `refs/heads/${opts.branch}`) throw new DeliveryError('REMOTE_UNVERIFIED', 'Expected remote main ref was not uniquely found', true);
      return pieces[0].toLowerCase();
    };
    const fetchMain = async () => {
      await git(['fetch', '--no-tags', opts.remote, `refs/heads/${opts.branch}`]);
      const sha = await remoteHead();
      const available = await git(['cat-file', '-e', `${sha}^{commit}`], opts.cwd, true);
      if (available.code !== 0) throw new DeliveryError('REMOTE_CHANGED', 'Remote main moved while fetching; retry without publishing', true);
      return sha;
    };
    const repository = opts.repository ?? json(asText(await execute('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd: opts.cwd, signal: opts.signal }))).nameWithOwner;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new DeliveryError('INVALID_REPOSITORY', 'Expected owner/repository');
    const checkRuns = async (sha, allowMissing = false) => {
      const result = await execute('gh', ['api', '--method', 'GET', `repos/${repository}/commits/${sha}/check-runs?per_page=100`,
        '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'], { cwd: opts.cwd, signal: opts.signal, timeoutMs: 30000 });
      if (result.code !== 0) {
        if (allowMissing) {
          const stderr = asText({ stdout: result.stderr });
          if (/\bHTTP 404\b/.test(stderr)) return [];
          // GitHub returns this specific 422 before a local commit has ever
          // reached the repository. Other 422s and another SHA are failures.
          let body;
          try { body = json(asText(result)); } catch { /* Keep the failure. */ }
          if (/\bHTTP 422\b/.test(stderr) && String(body?.status) === '422'
              && body.message === `No commit found for SHA: ${sha}`) return [];
        }
        throw new DeliveryError('CHECKS_UNAVAILABLE', 'GitHub provider checks are temporarily unavailable', true);
      }
      const response = json(asText(result));
      if (!Array.isArray(response.check_runs) || response.total_count > 100) throw new DeliveryError('CHECKS_UNVERIFIED', 'Unexpected or truncated check-run response');
      return response.check_runs;
    };
    journal = await readJson(journalFile);
    if (journal && (journal.ticketId !== opts.ticketId || journal.baseSha !== opts.baseSha || journal.repository !== repository
        || journal.remote !== opts.remote || journal.branch !== opts.branch || journal.productionUrl !== opts.productionUrl)) {
      throw new DeliveryError('JOURNAL_INPUT_MISMATCH', 'Saved publication belongs to different immutable inputs');
    }
    if (journal?.stage === 'deployed') return journal.receipt;
    if (journal?.stage === 'blocked') return finish({ status: 'blocked', retryable: false, errorCode: journal.errorCode,
      message: journal.message, integrationWorktree: journal.worktree, ...(journal.errorDetails ?? {}) });
    lease = await opts.acquireLease?.('integration');
    if (lease === false) throw new DeliveryError('INTEGRATION_BUSY', 'The controller integration lease is busy', true);
    opts.signal?.throwIfAborted();
    let current = await fetchMain();
    for (const sha of [opts.candidateSha, opts.baseSha]) await git(['cat-file', '-e', `${sha}^{commit}`]);
    if (!await ancestor(opts.baseSha, opts.candidateSha)) throw new DeliveryError('BASE_MISMATCH', 'Candidate does not descend from its declared base');
    if (!journal || journal.stage === 'reprepare') {
      if (!await ancestor(opts.baseSha, current)) throw new DeliveryError('REMOTE_BASE_DIVERGED', 'Remote main no longer contains the declared base');
      const ordinal = (journal?.prepareAttempt ?? 0) + 1;
      if (ordinal > 3) throw new DeliveryError('PREPARATION_RETRIES_EXHAUSTED', 'Integration preparation did not complete within three attempts; inspect the retained journal before retrying');
      // A deliberate legacy-journal recovery may reset the bounded attempt
      // counter; retained previous worktrees must never collide or be reused.
      const worktree = path.join(opts.stateDir, `integration-${opts.candidateSha.slice(0, 12)}-${ordinal}-${randomUUID().slice(0, 8)}`);
      const candidateContained = await ancestor(opts.candidateSha, current);
      const currentContained = await ancestor(current, opts.candidateSha);
      const startSha = candidateContained ? current : currentContained ? opts.candidateSha : current;
      journal = { version: 1, ticketId: opts.ticketId, taskId: opts.taskId ?? null, repository, remote: opts.remote, branch: opts.branch,
        productionUrl: opts.productionUrl, candidateSha: opts.candidateSha, baseSha: opts.baseSha, currentMainAtPreparation: current,
        worktree, prepareAttempt: ordinal, stage: 'preparing', createdAt: journal?.createdAt ?? now(), preparationStartedAt: now(),
        integrationKind: candidateContained ? 'already-contained' : currentContained ? 'candidate-fast-forward' : 'merge',
        candidateWasAlreadyOnMain: candidateContained };
      await writeJson(journalFile, journal);
      await git(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'worktree', 'add', '--detach', worktree, startSha]);
      if (!candidateContained && !currentContained) {
        const merged = await git([...identity, 'merge', '--no-ff', '--no-edit', '-m', `Integrate ${opts.ticketId}: ${opts.candidateSha}`, opts.candidateSha], worktree, true);
        if (merged.code !== 0) throw new DeliveryError('MERGE_CONFLICT', 'Candidate conflicts with current main; repair the retained integration worktree', false,
          { integrationWorktree: worktree, context: cleanMessage(asText({ stdout: merged.stderr }) || asText(merged)) });
      }
      journal.integrationSha = asText(await git(['rev-parse', 'HEAD'], worktree));
      await writeJson(journalFile, journal);
      await notify({ phase: 'build', ticketId: opts.ticketId, integrationSha: journal.integrationSha });
      const buildEpoch = asText(await git(['show', '-s', '--format=%ct', journal.integrationSha], worktree));
      const buildEnv = { ...process.env, SOURCE_DATE_EPOCH: buildEpoch };
      delete buildEnv.CF_PAGES_COMMIT_SHA; delete buildEnv.GITHUB_SHA; delete buildEnv.CF_PAGES_BUILD_TIME;
      let commands = opts.buildCommand ? [opts.buildCommand] : null;
      const reuseBuild = opts.verifiedBuildSha?.toLowerCase() === journal.integrationSha;
      const buildKind = opts.buildCommand ? 'configured-command' : reuseBuild ? 'verified-candidate-reuse'
        : opts.validationTier === 'FAST' ? 'metadata-only' : 'standard-build';
      if (!commands) {
        commands = [{ command: process.execPath, args: ['scripts/generate-build-meta.mjs'] }];
        if (opts.validationTier !== 'FAST' && !reuseBuild) {
          const commonGit = asText(await git(['rev-parse', '--path-format=absolute', '--git-common-dir']));
          const candidates = [opts.dependencyDir, path.join(opts.cwd, 'node_modules'), path.join(path.dirname(commonGit), 'node_modules')].filter(Boolean);
          let dependenciesPath;
          for (const candidate of candidates) {
            try { if ((await fs.stat(path.join(candidate, 'vite', 'bin', 'vite.js'))).isFile()) { dependenciesPath = path.resolve(candidate); break; } } catch { /* Try the next existing dependency cache. */ }
          }
          if (!dependenciesPath) throw new DeliveryError('DEPENDENCIES_MISSING', 'Existing Vite dependencies were not found; provide dependencyDir without modifying the canonical checkout');
          await fs.symlink(dependenciesPath, path.join(worktree, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
          commands.push({ command: process.execPath, args: ['node_modules/vite/bin/vite.js', 'build'] });
        }
      }
      const buildStartedAt = now();
      for (const command of commands) {
        const result = await execute(command.command, command.args, { cwd: worktree, env: buildEnv, signal: opts.signal, timeoutMs: 300000 });
        if (result.code !== 0) throw new DeliveryError('BUILD_FAILED', 'Integration build failed', false,
          { integrationWorktree: worktree, context: cleanMessage(asText({ stdout: result.stderr }) || asText(result)), integrationSha: journal.integrationSha });
      }
      const generatedPaths = (opts.generatedPaths ?? [GENERATED]).map(repoPath);
      const dirtyPaths = asText(await git(['diff', '--name-only', '-z', 'HEAD', '--'], worktree)).split('\0').filter(Boolean);
      if (dirtyPaths.some(file => !generatedPaths.includes(file))) throw new DeliveryError('BUILD_CHANGED_SOURCE', 'Build modified a tracked source outside the configured generated-file list', false, { changedPaths: dirtyPaths });
      if (dirtyPaths.length) {
        await git(['add', '--', ...dirtyPaths], worktree);
        await git([...identity, 'commit', '-m', `Refresh deterministic build metadata for ${opts.ticketId}`], worktree);
      }
      journal.publishedSha = asText(await git(['rev-parse', 'HEAD'], worktree));
      if (!await ancestor(opts.candidateSha, journal.publishedSha) || !await ancestor(current, journal.publishedSha)) {
        throw new DeliveryError('INTEGRATION_BINDING_FAILED', 'Prepared commit must contain both candidate and observed main');
      }
      journal.build = { status: 'passed', startedAt: buildStartedAt, completedAt: now(), integrationSha: journal.integrationSha,
        publishedSha: journal.publishedSha, kind: buildKind, validationTier: opts.validationTier,
        reusedVerifiedBuildSha: reuseBuild ? opts.verifiedBuildSha : null,
        generatedPathsChanged: dirtyPaths, commands: commands.map(c => ({ command: path.basename(c.command), args: c.args })) };
      const changed = asText(await git(['diff', '--name-only', '-z', '--no-renames', opts.baseSha, opts.candidateSha, '--'])).split('\0').filter(Boolean).map(repoPath);
      const assetMap = new Map([...changed.filter(defaultAsset), 'index.html', 'sw.js', GENERATED].map(file => [file, file]));
      for (const item of opts.verificationPaths ?? []) {
        const entry = typeof item === 'string' ? { repoPath: item, urlPath: item } : item;
        assetMap.set(repoPath(entry.repoPath), repoPath(entry.urlPath ?? entry.repoPath));
      }
      const assets = [];
      for (const [file, urlPath] of assetMap) {
        const blob = await git(['show', `${journal.publishedSha}:${file}`], opts.cwd, true);
        if (blob.code !== 0) {
          if (changed.includes(file)) assets.push({ repoPath: file, urlPath, deleted: true });
          else throw new DeliveryError('VERIFICATION_ASSET_MISSING', `Required source asset is missing: ${file}`);
        } else assets.push({ repoPath: file, urlPath, sha256: hash(blob.stdout), bytes: blob.stdout.length, deleted: false });
      }
      journal.changedPaths = changed;
      journal.sourceOnlyPaths = changed.filter(file => !assetMap.has(file));
      journal.assets = assets;
      // Persist successful build and exact assets before an external API read.
      // An outage here resumes the precheck, without rebuilding or consuming
      // another integration attempt while main has not changed.
      journal.stage = 'built'; journal.builtAt = now();
      await writeJson(journalFile, journal);
    } else if (journal.stage === 'preparing') {
      // A crash during build/merge has not pushed anything. A fresh isolated
      // worktree avoids trusting a half-written build or rerunning a merge in place.
      journal.stage = 'reprepare'; await writeJson(journalFile, journal);
      return finish({ status: 'pending', retryable: true, retryAfterSeconds: 1, errorCode: 'PREPARATION_INTERRUPTED', message: 'Resume preparation in a fresh isolated worktree' });
    }
    if (journal.stage === 'built') {
      if (!SHA.test(journal.publishedSha ?? '') || journal.build?.status !== 'passed'
          || journal.build.publishedSha !== journal.publishedSha || !Array.isArray(journal.assets)
          || journal.assets.length === 0 || !Array.isArray(journal.changedPaths)) {
        throw new DeliveryError('BUILT_JOURNAL_INVALID', 'Saved built stage lacks complete build and source evidence');
      }
      journal.preexistingCheckRunIds = (await checkRuns(journal.publishedSha, true)).map(c => String(c.id));
      journal.stage = 'prepared'; journal.preparedAt = now();
      await writeJson(journalFile, journal);
    }
    if (journal.stage === 'prepared') {
      current = await fetchMain();
      const onMain = await ancestor(journal.publishedSha, current);
      if (!onMain) {
        if (!await ancestor(current, journal.publishedSha)) {
          journal.stage = 'reprepare'; await writeJson(journalFile, journal);
          return finish({ status: 'pending', retryable: true, retryAfterSeconds: 1, errorCode: 'REMOTE_ADVANCED', message: 'Main advanced before push; merge against it and rebuild once' });
        }
        journal.pushIntentAt ??= now(); journal.remoteBeforePush = current;
        await writeJson(journalFile, journal);
        await notify({ phase: 'push', publishedSha: journal.publishedSha });
        const pushed = await git(['push', opts.remote, `${journal.publishedSha}:refs/heads/${opts.branch}`], journal.worktree, true);
        await dependencies.afterPushTransport?.(journal);
        // Never infer failure or success solely from the transport exit code.
        current = await fetchMain();
        if (!await ancestor(journal.publishedSha, current)) {
          if (current !== journal.remoteBeforePush) journal.stage = 'reprepare';
          await writeJson(journalFile, journal);
          throw new DeliveryError('PUSH_NOT_CONFIRMED', pushed.code ? 'Push did not confirm the prepared commit on main' : 'Remote main did not contain the prepared commit after push', true);
        }
      }
      journal.stage = 'pushed'; journal.pushConfirmedAt = now(); journal.remoteAfterPush = current;
      journal.pushRecovered = Boolean(onMain && journal.pushIntentAt);
      await writeJson(journalFile, journal);
      await dependencies.afterPush?.(journal); // Test crash point, never configured by the controller.
    }
    if (journal.stage !== 'pushed') throw new DeliveryError('JOURNAL_STAGE_INVALID', 'Unexpected saved delivery stage');
    const rawChecks = await checkRuns(journal.publishedSha);
    const checks = rawChecks.map(c => parseProviderCheck(c, { publishedSha: journal.publishedSha, pagesProject: opts.pagesProject, providerAppId: opts.providerAppId }))
      .filter(Boolean).filter(c => !c.headBranch || c.headBranch === opts.branch)
      .filter(c => !journal.pushIntentAt || !journal.preexistingCheckRunIds.includes(c.checkRunId))
      .sort((a, b) => Number(b.checkRunId) - Number(a.checkRunId));
    const provider = checks[0];
    if (!provider || provider.status !== 'completed') return finish({ status: 'pending', retryable: true, retryAfterSeconds: 20,
      errorCode: 'PROVIDER_PENDING', message: 'Waiting for a Cloudflare Pages check for the exact main commit', provider: provider ?? null });
    if (provider.conclusion !== 'success') throw new DeliveryError('PROVIDER_FAILED', `Cloudflare Pages finished with ${provider.conclusion ?? 'no conclusion'}`, false, { provider });
    if (!provider.previewUrl || !provider.deploymentId) throw new DeliveryError('PROVIDER_METADATA_INCOMPLETE', 'Successful check did not provide an immutable deployment URL and matching deployment ID', true);
    await notify({ phase: 'verify', publishedSha: journal.publishedSha, deploymentId: provider.deploymentId });
    const immutable = await verifyOrigin(provider.previewUrl, journal.assets, journal.publishedSha, fetcher, opts.signal);
    const production = await verifyOrigin(opts.productionUrl, journal.assets, journal.publishedSha, fetcher, opts.signal);
    const latestMain = await fetchMain();
    if (!await ancestor(journal.publishedSha, latestMain)) throw new DeliveryError('REMOTE_PUBLICATION_REMOVED', 'Main no longer contains this publication');
    if (!immutable.passed || !production.passed) {
      journal.verificationAttempts = (journal.verificationAttempts ?? 0) + 1;
      await writeJson(journalFile, journal);
      const exhausted = journal.verificationAttempts >= (opts.maxVerificationAttempts ?? 20);
      return finish({ status: exhausted ? 'blocked' : 'pending', retryable: !exhausted, retryAfterSeconds: 20,
        errorCode: 'SOURCE_PARITY_PENDING', message: 'Provider succeeded but exact served-source verification has not passed', provider,
        evidence: { immutable, production }, integrationWorktree: journal.worktree });
    }
    const receipt = await finish({ status: 'deployed', retryable: false, state: 'DEPLOYED_AWAITING_PO', productionDeployed: true,
      verifiedAt: now(), repository, targetBranch: opts.branch, deploymentId: provider.deploymentId, previewUrl: provider.previewUrl,
      providerStatus: 'SUCCESS', provider, currentMainSha: latestMain,
      binding: { candidateSha: opts.candidateSha, declaredBaseSha: opts.baseSha, mainAtPreparation: journal.currentMainAtPreparation,
        integrationSha: journal.integrationSha, publishedSha: journal.publishedSha, candidateAncestorOfPublished: true,
        previousMainAncestorOfPublished: true, mainContainsPublished: true, checkHeadShaMatches: true, kind: journal.integrationKind },
      build: journal.build, changedPaths: journal.changedPaths, sourceOnlyPaths: journal.sourceOnlyPaths,
      changedAssets: journal.changedPaths.filter(defaultAsset),
      productSourceChangeObserved: journal.changedPaths.some(file => defaultAsset(file) && file !== GENERATED),
      evidence: { immutable, production }, integrationWorktree: journal.worktree, pushRecovered: journal.pushRecovered ?? false,
      poPersonallyTested: false, closed: false });
    journal.stage = 'deployed'; journal.completedAt = now(); journal.receipt = receipt;
    await writeJson(journalFile, journal);
    return receipt;
  } catch (error) {
    const aborted = error.name === 'AbortError' || options.signal?.aborted;
    const normalized = error instanceof DeliveryError ? error : new DeliveryError(aborted ? 'INTERRUPTED' : 'DELIVERY_ERROR', error.message, true);
    if (journal && !normalized.retryable && journal.stage !== 'deployed') {
      journal.stage = 'blocked'; journal.errorCode = normalized.code; journal.message = normalized.message;
      journal.errorDetails = normalized.details;
      if (journalFile) await writeJson(journalFile, journal);
    }
    return finish({ status: normalized.retryable ? 'pending' : 'blocked', retryable: normalized.retryable,
      ...(normalized.retryable ? { retryAfterSeconds: 20 } : {}), errorCode: normalized.code, message: normalized.message,
      integrationWorktree: journal?.worktree ?? null, ...normalized.details });
  } finally {
    if (lease !== undefined && lease !== false) await options.releaseLease?.(lease);
    await unlock?.();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--request');
  if (index < 0 || !process.argv[index + 1]) {
    process.stderr.write('Usage: node publisher.mjs --request request.json\n'); process.exitCode = 2;
  } else {
    const request = json(await fs.readFile(process.argv[index + 1], 'utf8'));
    const result = process.argv.includes('--observe') ? await observePublishedCommit(request) : await publishCandidate(request);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = ['deployed', 'verified'].includes(result.status) ? 0 : result.status === 'pending' ? 10 : 20;
  }
}
