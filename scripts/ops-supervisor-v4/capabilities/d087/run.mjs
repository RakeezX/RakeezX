import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { canonical, sha256, fixtureEmail, fixtureMarker, validateManifest, PROJECT_ID, PURPOSE,
  WINDOW_MS } from './handler-core.mjs';
import { securePrivateDirectory, writePrivateState, readPrivateState, withPrivateRun } from './private-state.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const projectUrl = `https://${PROJECT_ID}.supabase.co`;
const fail = code => Object.assign(new Error(code), { safeCode: code });
const uuid = () => randomUUID();
const proof = () => randomBytes(32).toString('base64url');
const contexts = Object.freeze({ A1: 'A', A2: 'A', B1: 'B' });
const functionFor = (state, mode) => mode === 'cleanup-only' ? state.cleanupFunctionName : state.functionName;
const knownErrors = new Set(['METHOD_NOT_ALLOWED','UNSUPPORTED_CALLER','CAPABILITY_EXPIRED','UNAUTHORIZED',
  'CONTENT_TYPE_REQUIRED','BODY_LIMIT','BODY_TIMEOUT','INVALID_BODY','INVALID_SCOPE','PHASE_REJECTED',
  'ADMIN_CONFIGURATION_UNAVAILABLE','AUTH_LOOKUP_UNAVAILABLE','FIXTURE_IDENTITY_CONFLICT',
  'FIXTURE_ALREADY_RETIRED','AUTH_CREATE_NOT_CONFIRMED','TOKEN_OWNER_NOT_VERIFIED',
  'TOKEN_VERIFICATION_UNAVAILABLE','SIGN_OUT_UNAVAILABLE','RETENTION_BAN_NOT_CONFIRMED','ADMIN_OPERATION_UNAVAILABLE']);
const tokenDenials = new Set(['user_banned','refresh_token_not_found','refresh_token_already_used']);
async function json(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function save(dir, state) { await writePrivateState(dir, state); }
async function git(repo, args) {
  try { return (await exec('git', ['-C', repo, ...args], { windowsHide: true, maxBuffer: 1024 * 1024 })).stdout.trim(); }
  catch { throw fail('SOURCE_BINDING_UNAVAILABLE'); }
}
export async function implementationIdentity(directory = here) {
  const names = ['handler-core.mjs','edge-entry.ts','closed-entry.ts','run.mjs','private-state.mjs','source-pins.json','fixture-contract.json'];
  const files = [];
  for (const name of names) files.push({ name, sha256: createHash('sha256').update(await fs.readFile(path.join(directory, name))).digest('hex') });
  return sha256(canonical(files));
}
function literal(source, name) {
  const match = source.match(new RegExp('(?:export\\s+)?const\\s+' + name + '\\s*=\\s*([\'\"])([^\'\"\\\\]+)\\1\\s*;'));
  if (!match) throw fail('PUBLIC_CLIENT_CONFIG_UNRECOGNIZED');
  return match[2];
}
function validatePublishable(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    if (key.split('.').length === 3 && claims.role === 'anon' && claims.ref === PROJECT_ID) return;
  } catch { /* No value is included in the error. */ }
  throw fail('PUBLIC_CLIENT_KEY_REQUIRED');
}
export async function manifestFor(state, mode) {
  if (!['provision', 'cleanup-only'].includes(mode)) throw fail('INVALID_PHASE');
  return validateManifest({ version: 1, purpose: PURPOSE, projectId: PROJECT_ID, runId: state.runId, mode,
    issuedAt: state.issuedAt, expiresAt: state.expiresAt, capabilitySha256: await sha256(state.capabilities[mode]),
    fixtureContractSha256: state.fixtureContractSha256, implementationSha256: state.implementationSha256,
    accounts: await Promise.all(state.accounts.map(async a => ({ slot: a.slot, id: a.id, email: a.email,
      passwordSha256: await sha256(a.password) }))),
  });
}

/** Bind the forthcoming gate to committed fresh Product/harness source, not the historical Preview. */
export async function validateCandidateBinding({ repo, binding, now = Date.now(), readGit = git }) {
  const hash = /^[a-f0-9]{40}$/;
  if (!binding || binding.version !== 1 || binding.purpose !== PURPOSE || binding.projectId !== PROJECT_ID ||
      !['candidateSha', 'treeSha', 'baseSha', 'harnessBlob'].every(k => hash.test(binding[k])) ||
      !/^https:\/\/[a-f0-9]{8}\.rakeezx\.pages\.dev$/.test(binding.previewUrl) ||
      !/^tests\/n58-live-d087(?:-[a-z0-9-]+)?\.e2e\.mjs$/.test(binding.harnessPath) ||
      !/^[a-f0-9]{64}$/.test(binding.preparationReceiptSha256) ||
      !Number.isFinite(Date.parse(binding.preparedAt)) || Date.parse(binding.preparedAt) > now ||
      now - Date.parse(binding.preparedAt) > 30 * 60 * 1000) throw fail('FRESH_CANDIDATE_BINDING_REQUIRED');
  if (await readGit(repo, ['rev-parse', 'refs/remotes/origin/main']) !== binding.baseSha ||
      await readGit(repo, ['merge-base', binding.baseSha, binding.candidateSha]) !== binding.baseSha)
    throw fail('FRESH_MAIN_INTEGRATION_REQUIRED');
  if (await readGit(repo, ['rev-parse', `${binding.candidateSha}^{tree}`]) !== binding.treeSha)
    throw fail('CANDIDATE_TREE_MISMATCH');
  if (await readGit(repo, ['rev-parse', `${binding.candidateSha}:${binding.harnessPath}`]) !== binding.harnessBlob)
    throw fail('LIVE_HARNESS_SOURCE_BINDING_MISMATCH');
  const candidate = await json(path.join(here, 'evidence', 'n58-candidate-sources.json'));
  const foundation = await json(path.join(here, 'evidence', 'n58-foundation-sources.json'));
  const critical = [...candidate.files.filter(f => f.path.startsWith('supabase/migrations/')),
    ...foundation.files.filter(f => ['src/lib/account-provisioning.js', 'src/lib/calendar-presets.js'].includes(f.path))];
  for (const file of critical) if (await readGit(repo, ['rev-parse', `${binding.candidateSha}:${file.path}`]) !== file.blob)
    throw fail('FIXTURE_CONTRACT_SOURCE_CHANGED');
  // Receipt hash identifies the gate author's local preparation evidence, not a live PASS.
  return { version: 1, purpose: PURPOSE, projectId: PROJECT_ID,
    ...Object.fromEntries(['candidateSha', 'treeSha', 'baseSha', 'previewUrl', 'preparedAt', 'harnessPath',
      'harnessBlob', 'preparationReceiptSha256'].map(k => [k, binding[k]])) };
}

/** Local preparation only, explicitly invoked at activation time. No random live manifest is staged now. */
export async function prepareRun({ repo, candidateBindingFile, now = Date.now() }) {
  if (!candidateBindingFile) throw fail('FRESH_CANDIDATE_BINDING_REQUIRED');
  const contract = await json(path.join(here, 'fixture-contract.json'));
  const binding = await validateCandidateBinding({ repo, binding: await json(candidateBindingFile), now });
  const candidate = binding.candidateSha;
  // Public client constants are read privately from the exact candidate; no eval/import of app code.
  const source = await git(repo, ['show', `${candidate}:src/lib/cloud.js`]);
  if (literal(source, 'SUPABASE_URL') !== projectUrl) throw fail('PROJECT_BINDING_MISMATCH');
  const publishableKey = literal(source, 'PUBLISHABLE_KEY'); validatePublishable(publishableKey);
  const runId = uuid();
  const privateDir = path.join(path.resolve(repo), 'artifacts', 'ops-supervisor-v4', 'capabilities', 'd087', runId, 'private');
  await securePrivateDirectory(repo, privateDir, { create: true });
  const accounts = ['A', 'B'].map(slot => ({ slot, id: uuid(), email: fixtureEmail(runId, slot), password: 'D087!aA1' + proof() }));
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const sectionId = 'sec:' + uuid(), termId = 'tm:y:1448-1449:1', subjectId = 'sub:digital-skills';
  const teachingId = `tch:${sectionId}|${subjectId}|${termId}`;
  const state = { version: 1, kind: 'd087-private-run', runId, projectId: PROJECT_ID,
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + WINDOW_MS).toISOString(),
    candidateSha: candidate, previewUrl: binding.previewUrl, candidatePreparation: binding,
    functionName: 'ops-d087-' + runId.replaceAll('-', '').slice(0,20),
    cleanupFunctionName: 'ops-d087-retire-' + runId.replaceAll('-', '').slice(0,20),
    implementationSha256: await implementationIdentity(), fixtureContractSha256: await sha256(canonical(contract)),
    capabilities: { provision: proof(), 'cleanup-only': proof() }, accounts, publishableKey,
    fixtureIds: { A: { sectionId, teachingId, termId, subjectId, itemIds: Array.from({ length: 5 }, uuid),
      date: localDate, successSessionId: `se:${teachingId}:${localDate}:1`,
      legacyDeniedSessionId: `se:${teachingId}:${localDate}:2`, staleDeniedSessionId: `se:${teachingId}:${localDate}:3`,
      snapshotId: `srs:se:${teachingId}:${localDate}:1`,
      mutationIds: Object.fromEntries(['section','teaching','selectGeneral','session','legacyDenied','switchWestern','staleDenied','bDenied'].map(k => [k, 'd087:' + uuid()])),
    } }, tokens: {}, operations: {}, events: [], observations: {}, phase: null,
    gate: { status: 'NOT_RUN' }, disposition: { status: 'NOT_RUN' }, disarmed: false };
  await save(privateDir, state);
  await writePublicReceipt(privateDir, state);
  return { ok: true, stage: 'manifest_prepared', runId, privateDir, receiptPath: path.join(path.dirname(privateDir), 'receipt.json'),
    liveActions: 0, next: 'Only when the committed live harness and fresh candidate/schema proof are ready, render provision bundle; hold the existing live lease for deployment and actual gate.' };
}

export async function writePublicReceipt(dir, state) {
  const receipt = { version: 1, kind: 'd087_capability_receipt', runId: state.runId, projectId: PROJECT_ID,
    candidateSha: state.candidateSha, previewUrl: state.previewUrl, functionName: state.functionName,
    cleanupFunctionName: state.cleanupFunctionName,
    candidatePreparation: state.candidatePreparation,
    implementationSha256: state.implementationSha256, fixtureContractSha256: state.fixtureContractSha256,
    issuedAt: state.issuedAt, expiresAt: state.expiresAt, fixtureAuthIds: state.accounts.map(a => ({ slot: a.slot, id: a.id })),
    fixtureIds: state.fixtureIds, events: state.events, observations: state.observations,
    gate: state.gate, disposition: state.disposition, disarmed: state.disarmed,
    privateStateReference: path.join(dir, 'state.json'),
    noProductClosure: true, noProductionPublish: true };
  const target = path.join(path.dirname(dir), 'receipt.json'), temp = target + '.tmp-' + uuid();
  await fs.writeFile(temp, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await fs.rename(temp, target);
  return receipt;
}
export async function renderBundle({ repo, privateDir, mode }) {
  return withPrivateRun(repo, privateDir, async state => {
    if (await implementationIdentity() !== state.implementationSha256) throw fail('IMPLEMENTATION_BINDING_CHANGED');
    if (!['provision','cleanup-only','closed'].includes(mode)) throw fail('INVALID_PHASE');
    if (mode === 'provision' && state.cleanupStartedAt) throw fail('PROVISIONING_ALREADY_ENDED');
    const files = mode === 'closed' ? [{ name: 'index.ts', content: await fs.readFile(path.join(here, 'closed-entry.ts'), 'utf8') }] : [
      { name: 'index.ts', content: await fs.readFile(path.join(here, 'edge-entry.ts'), 'utf8') },
      { name: 'handler-core.mjs', content: await fs.readFile(path.join(here, 'handler-core.mjs'), 'utf8') },
      { name: 'run-manifest.mjs', content: 'export default ' + JSON.stringify(await manifestFor(state, mode), null, 2) + ';\n' },
    ];
    if (mode === 'closed') {
      const bundles = [];
      for (const phase of ['provision', 'cleanup-only']) {
        const bundle = { project_id: PROJECT_ID, name: functionFor(state, phase), entrypoint_path: 'index.ts', verify_jwt: false, files };
        const bundlePath = path.join(path.dirname(privateDir), `deploy-closed-${phase}.json`);
        await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2) + '\n', { mode: 0o600 });
        bundles.push({ phase, bundlePath, sha256: await sha256(canonical(bundle)) });
      }
      return { ok: true, stage: 'bundles_prepared', mode, bundles, deployed: false };
    }
    const bundle = { project_id: PROJECT_ID, name: functionFor(state, mode), entrypoint_path: 'index.ts', verify_jwt: false, files };
    const bundlePath = path.join(path.dirname(privateDir), `deploy-${mode}.json`);
    await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2) + '\n', { mode: 0o600 });
    return { ok: true, stage: 'bundle_prepared', mode, bundlePath, sha256: await sha256(canonical(bundle)), deployed: false };
  });
}
function safeResult(data, state, mode, operation, slot, expectedHash) {
  if (!data || data.ok !== true || data.projectId !== PROJECT_ID || data.runId !== state.runId || data.mode !== mode ||
      data.manifestSha256 !== expectedHash || data.implementationSha256 !== state.implementationSha256 ||
      data.fixtureContractSha256 !== state.fixtureContractSha256 || data.operation !== operation ||
      (slot && (data.slot !== slot || data.fixtureAuthId !== state.accounts.find(a => a.slot === slot)?.id)))
    throw fail('REMOTE_BINDING_MISMATCH');
  const allowedStates = ['absent','provisioned','retained_banned','sign_out_acknowledged'];
  if (data.state !== undefined && !allowedStates.includes(data.state)) throw fail('REMOTE_RESPONSE_INVALID');
  const result = { operation, ...(slot ? { slot, fixtureAuthId: data.fixtureAuthId } : {}),
    mode, manifestSha256: expectedHash, observedAt: new Date().toISOString() };
  if (typeof data.configured === 'boolean') result.configured = data.configured;
  if (data.state) result.state = data.state;
  if (data.bannedUntil) {
    if (!Number.isFinite(Date.parse(data.bannedUntil))) throw fail('REMOTE_RESPONSE_INVALID');
    result.bannedUntil = new Date(data.bannedUntil).toISOString();
  }
  if (data.verifiedBy === 'exact_auth_admin_get') result.verifiedBy = data.verifiedBy;
  if (data.state === 'sign_out_acknowledged') result.refreshRevocation = 'not_proven_by_acknowledgment';
  return result;
}
async function callHandler(state, dir, mode, operation, slot, extra = {}, fetcher = fetch) {
  if (Date.now() >= Date.parse(state.expiresAt)) throw fail('CAPABILITY_EXPIRED');
  if (mode === 'provision' && state.cleanupStartedAt) throw fail('PROVISIONING_ALREADY_ENDED');
  const key = `${mode}:${operation}:${slot ?? '-'}`;
  const old = state.operations[key] ?? { attempts: 0 };
  const mutation = ['ensure','revoke','retire'].includes(operation);
  if (mutation && old.attempts >= 3) throw fail('BOUNDED_ATTEMPTS_EXHAUSTED');
  state.operations[key] = { attempts: old.attempts + 1, status: 'request_intent', at: new Date().toISOString() };
  if (mode === 'cleanup-only' && ['revoke','retire'].includes(operation)) state.cleanupStartedAt ??= new Date().toISOString();
  await save(dir, state); // A lost response never loses the exact IDs or intent.
  const manifest = await manifestFor(state, mode), expectedHash = await sha256(canonical(manifest));
  let response, data;
  try {
    response = await fetcher(`${projectUrl}/functions/v1/${functionFor(state, mode)}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', 'x-d087-capability': state.capabilities[mode] },
      body: JSON.stringify({ version: 1, runId: state.runId, operation, ...(slot ? { slot } : {}), ...extra }),
    });
    const text = await response.text();
    if (text.length > 32768) throw fail('REMOTE_RESPONSE_INVALID');
    data = JSON.parse(text);
  } catch {
    state.operations[key].status = 'response_uncertain'; await save(dir, state);
    throw fail('HANDLER_TRANSPORT_UNCERTAIN');
  }
  if (!response.ok || data?.ok !== true) {
    const code = knownErrors.has(data?.errorCode) ? data.errorCode : 'HANDLER_REQUEST_REJECTED';
    state.operations[key].status = 'rejected'; state.operations[key].errorCode = code;
    state.events.push({ operation, slot, errorCode: code, httpStatus: response.status, at: new Date().toISOString() });
    await save(dir, state); await writePublicReceipt(dir, state); throw fail(code);
  }
  const result = safeResult(data, state, mode, operation, slot, expectedHash);
  state.operations[key].status = 'acknowledged'; state.events.push(result);
  state.observations[`${operation}:${slot ?? '-'}`] = result;
  await save(dir, state); await writePublicReceipt(dir, state); return result;
}
function authErrorCode(data) {
  const code = data?.code ?? data?.error_code;
  return ['user_banned','refresh_token_not_found','refresh_token_already_used','invalid_credentials',
    'over_request_rate_limit','session_not_found'].includes(code) ? code : 'unclassified_auth_rejection';
}
async function authPost(state, endpoint, body, fetcher) {
  if (Date.now() >= Date.parse(state.expiresAt)) throw fail('CAPABILITY_EXPIRED');
  const response = await fetcher(projectUrl + endpoint, { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json',
      apikey: state.publishableKey, 'x-supabase-api-version': '2024-01-01' }, body: JSON.stringify(body) });
  const text = await response.text();
  if (text.length > 128 * 1024) throw fail('AUTH_RESPONSE_INVALID');
  return { response, data: JSON.parse(text) };
}
async function signInContext(state, dir, context, fetcher) {
  const slot = contexts[context], account = state.accounts.find(a => a.slot === slot);
  if (state.cleanupStartedAt) throw fail('PROVISIONING_ALREADY_ENDED');
  if (state.tokens[context]) {
    if (!state.tokens[context].ownerVerified) throw fail('SAVED_SESSION_OWNER_NOT_VERIFIED');
    return { context, slot, status: 'private_session_already_saved' };
  }
  const key = 'signin:' + context;
  if (state.operations[key]) throw fail('SIGNIN_ALREADY_ATTEMPTED_REVIEW_SAVED_OUTCOME');
  state.operations[key] = { attempts: 1, status: 'request_intent', at: new Date().toISOString() }; await save(dir, state);
  let result;
  try { result = await authPost(state, '/auth/v1/token?grant_type=password', { email: account.email, password: account.password }, fetcher); }
  catch { state.operations[key].status = 'response_uncertain'; await save(dir, state); throw fail('SIGNIN_RESPONSE_UNCERTAIN'); }
  if (!result.response.ok) {
    state.operations[key].status = 'rejected'; state.operations[key].errorCode = authErrorCode(result.data);
    await save(dir, state); throw fail('SIGNIN_REJECTED');
  }
  const { data } = result;
  // Keep any received token privately even if response validation fails, for exact disposition/recovery.
  state.tokens[context] = { accessToken: data.access_token, refreshToken: data.refresh_token,
    expiresAt: null, observedAt: new Date().toISOString(), ownerVerified: false };
  await save(dir, state);
  if (data.user?.id !== account.id || data.user?.email !== account.email || data.user?.role !== 'authenticated' ||
      canonical(data.user?.app_metadata?.d087) !== canonical(fixtureMarker({ runId: state.runId }, slot)) ||
      typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') throw fail('SIGNIN_OWNER_MISMATCH');
  let expires;
  try { expires = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url').toString('utf8')).exp; }
  catch { throw fail('TOKEN_EXPIRY_UNAVAILABLE'); }
  if (!Number.isInteger(expires) || expires <= Date.now() / 1000) throw fail('TOKEN_EXPIRY_UNAVAILABLE');
  // exp is used only for recording the residual access window, not for authenticating a caller.
  state.tokens[context].expiresAt = new Date(expires * 1000).toISOString(); state.tokens[context].ownerVerified = true;
  state.operations[key].status = 'private_session_saved'; await save(dir, state);
  const safe = { context, slot, fixtureAuthId: account.id, status: 'private_session_saved', expiresAt: state.tokens[context].expiresAt };
  state.events.push(safe); await save(dir, state); await writePublicReceipt(dir, state); return safe;
}
async function verifyDenial(state, dir, slot, fetcher) {
  const account = state.accounts.find(a => a.slot === slot), results = [];
  state.observations[`token-denial:${slot}`] = [{ slot, check: 'token_denial_pending', pass: false }];
  await save(dir, state);
  const password = await authPost(state, '/auth/v1/token?grant_type=password', { email: account.email, password: account.password }, fetcher);
  if (password.response.ok) {
    state.unexpectedSessions ??= [];
    state.unexpectedSessions.push({ slot, accessToken: password.data?.access_token, refreshToken: password.data?.refresh_token });
    await save(dir, state); throw fail('BANNED_PASSWORD_SIGNIN_UNEXPECTEDLY_SUCCEEDED');
  }
  results.push({ slot, check: 'password_signin_denied', status: password.response.status,
    authCode: authErrorCode(password.data), pass: password.response.status === 400 && authErrorCode(password.data) === 'user_banned' });
  for (const [context, token] of Object.entries(state.tokens).filter(([c]) => contexts[c] === slot)) {
    if (!token.refreshToken) continue;
    const result = await authPost(state, '/auth/v1/token?grant_type=refresh_token', { refresh_token: token.refreshToken }, fetcher);
    if (result.response.ok) {
      state.unexpectedSessions ??= [];
      state.unexpectedSessions.push({ slot, context, accessToken: result.data?.access_token, refreshToken: result.data?.refresh_token });
      await save(dir, state); throw fail('RETIRED_REFRESH_UNEXPECTEDLY_SUCCEEDED');
    }
    const code = authErrorCode(result.data);
    results.push({ slot, context, check: 'refresh_denied', status: result.response.status, authCode: code,
      pass: result.response.status === 400 && tokenDenials.has(code),
      provesSessionRevocation: result.response.status === 400 && ['refresh_token_not_found','refresh_token_already_used'].includes(code) });
  }
  state.events.push(...results); state.observations[`token-denial:${slot}`] = results;
  await save(dir, state); await writePublicReceipt(dir, state); return results;
}

/** The root operator holds the existing exclusive live-mutation lease outside this bounded runner. */
export async function runOperation({ repo, privateDir, operation, mode = 'provision', live = false, fetcher = fetch }) {
  if (!live) throw fail('EXPLICIT_LIVE_INVOCATION_REQUIRED');
  return withPrivateRun(repo, privateDir, async state => {
    if (operation === 'confirm-disarmed') {
      for (const name of [state.functionName, state.cleanupFunctionName]) {
        if (!name) throw fail('DISARM_NOT_CONFIRMED');
        const response = await fetcher(`${projectUrl}/functions/v1/${name}`, { method: 'POST',
          redirect: 'error', signal: AbortSignal.timeout(15000) });
        const data = await response.json();
        if (response.status !== 410 || data?.errorCode !== 'D087_CLOSED') throw fail('DISARM_NOT_CONFIRMED');
      }
      state.disarmed = true; state.events.push({ operation: 'disarm_endpoint_verified', at: new Date().toISOString() });
      await save(privateDir, state); await writePublicReceipt(privateDir, state); return { ok: true, disarmed: true };
    }
    if (Date.now() >= Date.parse(state.expiresAt)) throw fail('CAPABILITY_EXPIRED');
    if (await implementationIdentity() !== state.implementationSha256) throw fail('IMPLEMENTATION_BINDING_CHANGED');
    if (operation === 'probe' || (operation === 'probe-standby' && mode === 'cleanup-only')) {
      const result = await callHandler(state, privateDir, mode, 'probe', undefined, {}, fetcher);
      if (!result.configured) throw fail('ADMIN_CONFIGURATION_UNAVAILABLE');
      if (operation === 'probe-standby') state.cleanupStandbyVerifiedAt = new Date().toISOString();
      else {
        state.phase = mode;
        if (mode === 'cleanup-only') state.cleanupStartedAt ??= new Date().toISOString();
      }
      await save(privateDir, state); return result;
    }
    if (state.phase !== mode) throw fail('PROTECTED_PROBE_REQUIRED_FOR_PHASE');
    if (operation === 'inspect') {
      const results = [];
      for (const account of state.accounts) results.push(await callHandler(state, privateDir, mode, 'inspect', account.slot, {}, fetcher));
      return results;
    }
    if (operation === 'provision' && mode === 'provision') {
      if (!state.cleanupStandbyVerifiedAt) throw fail('CLEANUP_STANDBY_REQUIRED');
      const results = [];
      for (const account of state.accounts) results.push(await callHandler(state, privateDir, mode, 'ensure', account.slot,
        { password: account.password }, fetcher));
      return results;
    }
    if (operation === 'sign-in' && mode === 'provision') {
      const results = [];
      for (const context of Object.keys(contexts)) results.push(await signInContext(state, privateDir, context, fetcher));
      return results;
    }
    if (operation === 'retire' && mode === 'cleanup-only') {
      const results = [];
      // Failure for A does not suppress the bounded disposition attempt for B.
      for (const account of state.accounts) {
        const token = Object.entries(state.tokens).find(([c,t]) => contexts[c] === account.slot && t.ownerVerified)?.[1];
        if (token) {
          try { results.push(await callHandler(state, privateDir, mode, 'revoke', account.slot, { accessToken: token.accessToken }, fetcher)); }
          catch (error) { results.push({ slot: account.slot, operation: 'revoke', errorCode: error.safeCode ?? 'REVOCATION_UNCERTAIN' }); }
        } else results.push({ slot: account.slot, operation: 'revoke', status: 'NO_VERIFIED_TOKEN', revocation: 'not_proven' });
        try { results.push(await callHandler(state, privateDir, mode, 'retire', account.slot, {}, fetcher)); }
        catch (error) { results.push({ slot: account.slot, operation: 'retire', errorCode: error.safeCode ?? 'RETENTION_UNCERTAIN' }); }
      }
      const retained = state.accounts.every(a => results.some(r => r.operation === 'retire' && r.slot === a.slot && ['retained_banned','absent'].includes(r.state)));
      state.disposition = { status: retained ? 'RETAINED_BANNED_TOKEN_CHECK_PENDING' : 'PARTIAL_DISPOSITION', accounts: results,
        fixtures: 'retained_exact_contract', globalSignOut: 'see_per_account_evidence',
        residualAccessUntil: Object.values(state.tokens).map(t => t.expiresAt).filter(Boolean).sort().at(-1) ?? 'unknown_or_no_issued_token' };
      await save(privateDir, state); await writePublicReceipt(privateDir, state); return state.disposition;
    }
    if (operation === 'verify-denial' && mode === 'cleanup-only') {
      const results = [];
      for (const account of state.accounts) {
        if (state.observations[`retire:${account.slot}`]?.state !== 'retained_banned') continue;
        try { results.push(...await verifyDenial(state, privateDir, account.slot, fetcher)); }
        catch (error) { results.push({ slot: account.slot, errorCode: error.safeCode ?? 'TOKEN_DENIAL_UNCERTAIN', pass: false }); }
      }
      const all = state.accounts.every(a => state.observations[`retire:${a.slot}`]?.state === 'retained_banned' &&
        state.observations[`token-denial:${a.slot}`]?.length >= 1 && state.observations[`token-denial:${a.slot}`]?.every(r => r.pass));
      state.disposition.status = all ? 'RETAINED_BANNED' : 'PARTIAL_DISPOSITION';
      await save(privateDir, state); await writePublicReceipt(privateDir, state); return { status: state.disposition.status, checks: results };
    }
    throw fail('UNSUPPORTED_OPERATION');
  });
}

async function main(argv) {
  const [command, ...rest] = argv, args = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--live') { args.live = true; continue; }
    if (!['--repo','--private-dir','--phase','--candidate-binding'].includes(rest[i]) || !rest[i + 1]) throw fail('INVALID_ARGUMENTS');
    args[rest[i].slice(2)] = rest[++i];
  }
  if (!command || command === 'help') return { commands: ['prepare','bundle','probe','probe-standby','inspect','provision','sign-in','retire','verify-denial','confirm-disarmed'],
    note: 'No live action by default. prepare requires --candidate-binding for a committed fresh candidate/live harness; it writes a private ignored run only when explicitly invoked. The existing live-mutation lease is held for --live operations.' };
  if (!args.repo) throw fail('REPO_REQUIRED');
  if (command === 'prepare') return prepareRun({ repo: args.repo, candidateBindingFile: args['candidate-binding'] });
  if (!args['private-dir']) throw fail('PRIVATE_DIR_REQUIRED');
  if (command === 'bundle') return renderBundle({ repo: args.repo, privateDir: args['private-dir'], mode: args.phase });
  return runOperation({ repo: args.repo, privateDir: args['private-dir'], operation: command, mode: args.phase, live: args.live });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await main(process.argv.slice(2))) + '\n'); }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, errorCode: error?.safeCode ?? 'D087_OPERATION_FAILED' }) + '\n'); process.exitCode = 1; }
}
