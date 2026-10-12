import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHandler, fixtureEmail, fixtureMarker, PROJECT_ID, WINDOW_MS, BAN_DURATION } from './handler-core.mjs';
import { implementationIdentity, manifestFor, renderBundle, runOperation, writePublicReceipt, validateCandidateBinding } from './run.mjs';
import { assertPrivatePath, securePrivateDirectory, writePrivateState, readPrivateState, withPrivateRun } from './private-state.mjs';

const exec = promisify(execFile);
const projectUrl = `https://${PROJECT_ID}.supabase.co`;
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids = ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];

async function harness(t) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'd087-runner-test-'));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  await exec('git', ['init', '--quiet', repo]);
  await fs.writeFile(path.join(repo, '.gitignore'), '/artifacts/\n'); // This is a disposable test repository only.
  const privateDir = path.join(repo, 'artifacts', 'ops-supervisor-v4', 'capabilities', 'd087', runId, 'private');
  await securePrivateDirectory(repo, privateDir, { create: true });
  const now = Date.now();
  const state = { version: 1, kind: 'd087-private-run', runId, projectId: PROJECT_ID,
    issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + WINDOW_MS - 1000).toISOString(),
    candidateSha: '1'.repeat(40), previewUrl: 'https://fixture.rakeezx.pages.dev', functionName: 'ops-d087-test-only',
    cleanupFunctionName: 'ops-d087-retire-test-only',
    implementationSha256: await implementationIdentity(), fixtureContractSha256: 'c'.repeat(64),
    capabilities: { provision: 'P'.repeat(43), 'cleanup-only': 'C'.repeat(43) },
    accounts: ['A', 'B'].map((slot, i) => ({ slot, id: ids[i], email: fixtureEmail(runId, slot),
      password: 'D087!aA1' + (i ? 'B' : 'A').repeat(43) })),
    publishableKey: 'sb_publishable_TEST_ONLY', fixtureIds: { A: { sectionId: 'sec:test-only' } },
    tokens: {}, operations: {}, events: [], observations: {}, phase: null,
    gate: { status: 'NOT_RUN' }, disposition: { status: 'NOT_RUN' }, disarmed: false };
  await writePrivateState(privateDir, state); await writePublicReceipt(privateDir, state);
  const users = new Map(), issuedTokens = new Map(), calls = [], flags = {};
  let activeMode = 'provision'; const handlers = {};
  const admin = {
    async getUserById(id) { calls.push({ type: 'get', id }); return users.has(id)
      ? { data: { user: structuredClone(users.get(id)) } }
      : { error: { status: 404, code: 'user_not_found' }, data: { user: null } }; },
    async createUser(a) {
      calls.push({ type: 'create', id: a.id });
      assert.ok(ids.includes(a.id));
      if (users.has(a.id)) return { error: { status: 422, code: 'email_exists' } };
      const user = { id: a.id, email: a.email, role: 'authenticated', email_confirmed_at: new Date().toISOString(),
        app_metadata: structuredClone(a.app_metadata) };
      users.set(a.id, user); return { data: { user: structuredClone(user) } };
    },
    async updateUserById(id, attributes) {
      assert.deepEqual(attributes, { ban_duration: BAN_DURATION }); calls.push({ type: 'ban', id });
      users.get(id).banned_until = new Date(Date.now() + 876000 * 3600000).toISOString();
      return { data: { user: structuredClone(users.get(id)) } };
    },
    async signOut(token, scope) {
      assert.equal(scope, 'global'); calls.push({ type: 'signOut', id: issuedTokens.get(token) });
      if (flags.revokeUncertain) throw new Error('TEST_ONLY_PRIVATE_TRANSPORT_TEXT');
      return { error: null };
    },
  };
  const auth = { async getUser(token) {
    const id = issuedTokens.get(token);
    return id ? { data: { user: structuredClone(users.get(id)) } } : { error: { status: 401, code: 'bad_jwt' } };
  } };
  async function mode(next) { activeMode = next; handlers[next] = createHandler({ manifest: await manifestFor(state, next),
    createClients: () => ({ configured: true, admin, auth }) }); }
  await mode('cleanup-only'); await mode('provision');
  const fetcher = async (url, options) => {
    assert.ok(url.startsWith(projectUrl + '/')); assert.equal(options.redirect, 'error');
    if (url.includes('/functions/v1/')) {
      const body = JSON.parse(options.body); calls.push({ type: 'handler', operation: body.operation, slot: body.slot });
      const handler = handlers[url.endsWith(state.cleanupFunctionName) ? 'cleanup-only' : 'provision'];
      const response = await handler(new Request(url, options));
      if (flags.loseEnsureA && body.operation === 'ensure' && body.slot === 'A') {
        flags.loseEnsureA = false; assert.equal(response.status, 200); throw new Error('TEST_ONLY_LOST_RESPONSE');
      }
      return response;
    }
    const input = JSON.parse(options.body);
    assert.equal(options.headers.apikey, state.publishableKey);
    if (url.endsWith('grant_type=password')) {
      const account = state.accounts.find(a => a.email === input.email);
      assert.ok(account); assert.equal(input.password, account.password); calls.push({ type: 'password', id: account.id });
      if (users.get(account.id)?.banned_until) return Response.json({ code: 'user_banned' }, { status: 400 });
      if (flags.loseSignIn) { flags.loseSignIn = false; throw new Error('TEST_ONLY_LOST_SIGNIN'); }
      const token = 'e30.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600,
        sub: account.id, instance: issuedTokens.size })).toString('base64url') + '.test';
      issuedTokens.set(token, account.id);
      return Response.json({ access_token: token, refresh_token: 'refresh_TEST_ONLY_' + issuedTokens.size,
        user: structuredClone(users.get(account.id)) });
    }
    assert.ok(url.endsWith('grant_type=refresh_token'));
    assert.equal(typeof input.refresh_token, 'string'); calls.push({ type: 'refresh' });
    return Response.json({ code: 'user_banned' }, { status: 400 });
  };
  return { repo, privateDir, state, users, calls, flags, mode, fetcher,
    run: (operation, mode = activeMode) => runOperation({ repo, privateDir, operation, mode, live: true, fetcher }),
    load: () => readPrivateState(repo, privateDir),
    receipt: async () => JSON.parse(await fs.readFile(path.join(path.dirname(privateDir), 'receipt.json'), 'utf8')) };
}

test('private path must be already ignored, scoped, unlinked and locked; no live call without explicit invocation', async t => {
  const h = await harness(t);
  await assert.rejects(runOperation({ repo: h.repo, privateDir: h.privateDir, operation: 'provision',
    fetcher: () => { throw new Error('must not run'); } }), { safeCode: 'EXPLICIT_LIVE_INVOCATION_REQUIRED' });
  await assert.rejects(assertPrivatePath(h.repo, path.join(h.repo, 'private')), { safeCode: 'PRIVATE_PATH_OUTSIDE_SCOPE' });
  await fs.writeFile(path.join(h.repo, '.gitignore'), '');
  await assert.rejects(assertPrivatePath(h.repo, h.privateDir), { safeCode: 'PRIVATE_PATH_GIT_CHECK_FAILED' });
  await fs.writeFile(path.join(h.repo, '.gitignore'), '/artifacts/\n');
  const link = path.join(path.dirname(h.privateDir), 'linked');
  await fs.symlink(os.tmpdir(), link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assertPrivatePath(h.repo, path.join(link, 'private')), { safeCode: 'PRIVATE_PATH_LINK_REJECTED' });
  await withPrivateRun(h.repo, h.privateDir, async () => {
    await assert.rejects(withPrivateRun(h.repo, h.privateDir, async () => {}), { safeCode: 'D087_RUN_ALREADY_LOCKED' });
  });
  assert.equal((await fs.readdir(h.privateDir)).includes('RUNNING.lock'), false);
  assert.equal(h.calls.length, 0);
});

test('durable intent recovers lost successful provision response using the same two identities; receipt is redacted', async t => {
  const h = await harness(t); await h.run('probe');
  await assert.rejects(h.run('provision'), { safeCode: 'CLEANUP_STANDBY_REQUIRED' });
  assert.equal(h.users.size, 0);
  await h.run('probe-standby', 'cleanup-only'); h.flags.loseEnsureA = true;
  await assert.rejects(h.run('provision'), { safeCode: 'HANDLER_TRANSPORT_UNCERTAIN' });
  assert.equal((await h.load()).operations['provision:ensure:A'].status, 'response_uncertain');
  assert.equal(h.users.size, 1);
  const result = await h.run('provision'); assert.ok(result.every(r => r.state === 'provisioned'));
  assert.deepEqual([...h.users.keys()].sort(), [...ids].sort());
  assert.equal(h.calls.filter(c => c.type === 'create').length, 2);
  assert.equal((await h.load()).operations['provision:ensure:A'].attempts, 2);
  const receiptText = JSON.stringify(await h.receipt());
  for (const secret of [...Object.values(h.state.capabilities), ...h.state.accounts.map(a => a.password), h.state.publishableKey])
    assert.equal(receiptText.includes(secret), false);
  assert.equal((await h.receipt()).gate.status, 'NOT_RUN');
});

test('bundle includes only capability/password hashes and cannot reopen provisioning after cleanup probe', async t => {
  const h = await harness(t);
  const prepared = await renderBundle({ repo: h.repo, privateDir: h.privateDir, mode: 'provision' });
  const bundle = await fs.readFile(prepared.bundlePath, 'utf8');
  for (const secret of [...Object.values(h.state.capabilities), ...h.state.accounts.map(a => a.password), h.state.publishableKey])
    assert.equal(bundle.includes(secret), false);
  const data = JSON.parse(bundle);
  assert.equal(data.verify_jwt, false); assert.equal(data.project_id, PROJECT_ID); assert.equal(prepared.deployed, false);
  assert.deepEqual(data.files.map(f => f.name), ['index.ts', 'handler-core.mjs', 'run-manifest.mjs']);
  await h.mode('cleanup-only'); await h.run('probe');
  await assert.rejects(renderBundle({ repo: h.repo, privateDir: h.privateDir, mode: 'provision' }), { safeCode: 'PROVISIONING_ALREADY_ENDED' });
  await assert.rejects(h.run('sign-in', 'provision'), { safeCode: 'PROTECTED_PROBE_REQUIRED_FOR_PHASE' });
  assert.equal(h.users.size, 0);
});

test('uncertain sign-out still bans both owned fixtures and distinguishes token denial from proven revocation or N58 success', async t => {
  const h = await harness(t); await h.run('probe'); await h.run('probe-standby', 'cleanup-only'); await h.run('provision');
  const sessions = await h.run('sign-in'); assert.equal(sessions.length, 3);
  const privateState = await h.load(); assert.deepEqual(Object.keys(privateState.tokens), ['A1', 'A2', 'B1']);
  await h.mode('cleanup-only'); await h.run('probe'); h.flags.revokeUncertain = true;
  const retired = await h.run('retire'); assert.equal(retired.status, 'RETAINED_BANNED_TOKEN_CHECK_PENDING');
  assert.equal(h.calls.filter(c => c.type === 'ban').length, 2);
  assert.equal(retired.accounts.filter(a => a.operation === 'revoke' && a.errorCode === 'SIGN_OUT_UNAVAILABLE').length, 2);
  const checks = await h.run('verify-denial'); assert.equal(checks.status, 'RETAINED_BANNED');
  assert.equal(checks.checks.filter(c => c.check === 'refresh_denied').length, 3);
  assert.ok(checks.checks.filter(c => c.check === 'refresh_denied').every(c => c.provesSessionRevocation === false));
  const receipt = await h.receipt(); assert.equal(receipt.gate.status, 'NOT_RUN');
  assert.equal(receipt.noProductClosure, true); assert.equal(receipt.disarmed, false);
  const text = JSON.stringify(receipt);
  for (const token of Object.values(privateState.tokens)) {
    assert.equal(text.includes(token.accessToken), false); assert.equal(text.includes(token.refreshToken), false);
  }
  assert.equal(text.includes('TEST_ONLY_PRIVATE_TRANSPORT_TEXT'), false);
  assert.equal(receipt.disposition.residualAccessUntil, sessions[0].expiresAt);
});

test('lost sign-in response is not blindly retried; closed endpoint can be confirmed after capability expires', async t => {
  const h = await harness(t); await h.run('probe'); await h.run('probe-standby', 'cleanup-only'); await h.run('provision'); h.flags.loseSignIn = true;
  await assert.rejects(h.run('sign-in'), { safeCode: 'SIGNIN_RESPONSE_UNCERTAIN' });
  await assert.rejects(h.run('sign-in'), { safeCode: 'SIGNIN_ALREADY_ATTEMPTED_REVIEW_SAVED_OUTCOME' });
  assert.equal(h.calls.filter(c => c.type === 'password').length, 1);
  const state = await h.load(); state.expiresAt = new Date(Date.now() - 1).toISOString(); await writePrivateState(h.privateDir, state);
  const result = await runOperation({ repo: h.repo, privateDir: h.privateDir, operation: 'confirm-disarmed', live: true,
    fetcher: async (url, options) => {
      assert.ok([h.state.functionName, h.state.cleanupFunctionName].some(name => url === projectUrl + '/functions/v1/' + name));
      assert.equal(options.headers, undefined); assert.equal(options.body, undefined);
      return Response.json({ ok: false, errorCode: 'D087_CLOSED' }, { status: 410 });
    } });
  assert.equal(result.disarmed, true); assert.equal((await h.receipt()).disarmed, true);
});

test('fresh candidate binding rejects stale main, missing committed live harness and changed fixture contracts before preparation', async () => {
  const now = Date.now(), binding = { version: 1, purpose: 'N58-D087', projectId: PROJECT_ID,
    candidateSha: '1'.repeat(40), baseSha: '2'.repeat(40), treeSha: '3'.repeat(40), harnessBlob: '4'.repeat(40),
    previewUrl: 'https://abcdef01.rakeezx.pages.dev', harnessPath: 'tests/n58-live-d087.e2e.mjs',
    preparedAt: new Date(now).toISOString(), preparationReceiptSha256: '5'.repeat(64) };
  const evidence = JSON.parse(await fs.readFile(new URL('./evidence/n58-candidate-sources.json', import.meta.url)));
  const foundation = JSON.parse(await fs.readFile(new URL('./evidence/n58-foundation-sources.json', import.meta.url)));
  const files = new Map([...evidence.files, ...foundation.files].map(f => [f.path, f.blob]));
  const readGit = async (_repo, args) => {
    if (args[0] === 'merge-base' || args[1] === 'refs/remotes/origin/main') return binding.baseSha;
    if (args[1] === binding.candidateSha + '^{tree}') return binding.treeSha;
    if (args[1] === binding.candidateSha + ':' + binding.harnessPath) return binding.harnessBlob;
    return files.get(args[1].slice(41));
  };
  assert.deepEqual(await validateCandidateBinding({ repo: 'test', binding, now, readGit }), binding);
  for (const patch of [{ preparedAt: new Date(now - 31 * 60 * 1000).toISOString() },
    { harnessPath: 'tests/n58-client-controls-0457-3.e2e.mjs' }, { previewUrl: 'https://rakeezx.com' }])
    await assert.rejects(validateCandidateBinding({ repo: 'test', binding: { ...binding, ...patch }, now, readGit }),
      { safeCode: 'FRESH_CANDIDATE_BINDING_REQUIRED' });
  for (const [wrongArgument, code] of [['refs/remotes/origin/main', 'FRESH_MAIN_INTEGRATION_REQUIRED'],
    [binding.candidateSha + ':' + binding.harnessPath, 'LIVE_HARNESS_SOURCE_BINDING_MISMATCH'],
    [binding.candidateSha + ':src/lib/calendar-presets.js', 'FIXTURE_CONTRACT_SOURCE_CHANGED']])
    await assert.rejects(validateCandidateBinding({ repo: 'test', binding, now,
      readGit: (_repo, args) => args.includes(wrongArgument) ? 'f'.repeat(40) : readGit(_repo, args) }), { safeCode: code });
});
