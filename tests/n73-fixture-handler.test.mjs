import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, sha256, canonical, fixtureEmail, fixtureMarker, validateManifest,
  PROJECT_ID, PURPOSE, BAN_DURATION, WINDOW_MS } from '../supabase/functions/ops-n73-fixture/handler-core.mjs';

export async function fixture(mode = 'provision') {
  const now = Date.now(), runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const capability = 'Q'.repeat(43), password = 'N73!aA1' + 'R'.repeat(43);
  const manifest = { version: 1, purpose: PURPOSE, projectId: PROJECT_ID, runId, mode,
    issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + WINDOW_MS - 1000).toISOString(),
    capabilitySha256: await sha256(capability), fixtureContractSha256: 'c'.repeat(64), implementationSha256: 'd'.repeat(64),
    accounts: await Promise.all(['A','B'].map(async (slot, i) => ({ slot,
      id: i ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      email: fixtureEmail(runId, slot), passwordSha256: await sha256(password) }))) };
  const users = new Map(), calls = [], state = { initializations: 0, now, getFailure: null, createLost: false,
    tokenOwner: 'A', tokenError: null, signOutThrows: false, updateLost: false };
  function user(slot) {
    const account = manifest.accounts.find(a => a.slot === slot);
    return { id: account.id, email: account.email, role: 'authenticated', email_confirmed_at: new Date(now).toISOString(),
      app_metadata: { provider: 'email', n73: fixtureMarker(manifest, slot) }, user_metadata: { ignored: 'no authority' } };
  }
  const admin = {
    async getUserById(id) {
      calls.push(['get', id]); if (state.getFailure) return { error: state.getFailure };
      return users.has(id) ? { data: { user: structuredClone(users.get(id)) } }
        : { data: { user: null }, error: { status: 404, code: 'user_not_found' } };
    },
    async createUser(attributes) {
      calls.push(['create', structuredClone(attributes)]);
      if (users.has(attributes.id)) return { error: { status: 422, code: 'email_exists' } };
      const slot = manifest.accounts.find(a => a.id === attributes.id).slot;
      users.set(attributes.id, user(slot));
      if (state.createLost) { state.createLost = false; throw new Error('PRIVATE-ERROR: ' + password); }
      return { data: { user: user(slot) } };
    },
    async updateUserById(id, attributes) {
      calls.push(['update', id, attributes]);
      assert.deepEqual(attributes, { ban_duration: BAN_DURATION });
      users.get(id).banned_until = new Date(state.now + 876000 * 3600000).toISOString();
      if (state.updateLost) { state.updateLost = false; throw new Error('PRIVATE-ERROR'); }
      return { data: { user: structuredClone(users.get(id)) } };
    },
    async signOut(token, scope) {
      calls.push(['signOut', token, scope]);
      if (state.signOutThrows) throw new Error('PRIVATE-JWT-ERROR: ' + token);
      return { error: null };
    },
  };
  const auth = { async getUser(token) {
    calls.push(['verifyToken', token]);
    return state.tokenError ? { error: state.tokenError } : { data: { user: user(state.tokenOwner) } };
  } };
  const options = { manifest, createClients: () => { state.initializations++; return { configured: true, admin, auth }; }, clock: () => state.now };
  let handler = createHandler(options);
  function request(operation, body = {}, overrides = {}) {
    return new Request('https://fixture.invalid/functions/v1/n73', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-n73-capability': capability, ...overrides.headers },
      body: JSON.stringify({ version: 1, runId, operation, ...body }), ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'headers')) });
  }
  return { manifest, capability, password, users, calls, state, admin, auth, options, request, user,
    handle: req => handler(req), resetHandler: () => { handler = createHandler(options); } };
}
async function body(response) { return { status: response.status, data: await response.json() }; }

test('rejects method, missing/wrong proof, Origin and expired capability before admin initialization', async () => {
  const f = await fixture();
  const requests = [new Request('https://fixture.invalid', { method: 'GET' }),
    f.request('probe', {}, { headers: { 'x-n73-capability': '' } }),
    f.request('probe', {}, { headers: { 'x-n73-capability': 'X'.repeat(43) } }),
    f.request('probe', {}, { headers: { origin: 'https://untrusted.invalid' } })];
  for (const request of requests) assert.equal((await body(await f.handle(request))).data.ok, false);
  f.state.now = Date.parse(f.manifest.expiresAt);
  assert.equal((await f.handle(f.request('probe'))).status, 410);
  assert.equal(f.state.initializations, 0); assert.equal(f.calls.length, 0);
});
test('fixed manifest rejects third account, duplicate identity, another project and long capability window', async () => {
  const f = await fixture();
  for (const transform of [m => m.accounts.push(m.accounts[0]), m => m.accounts[1].id = m.accounts[0].id,
    m => m.projectId = 'other', m => m.expiresAt = new Date(Date.parse(m.issuedAt) + WINDOW_MS + 1).toISOString()]) {
    const m = structuredClone(f.manifest); transform(m); assert.throws(() => validateManifest(m), /INVALID_MANIFEST/);
  }
});
test('body must match exact operation/run/slot/password and cannot inject target, attributes, URL or SQL', async () => {
  const f = await fixture();
  for (const extra of [{ id: 'other' }, { email: 'other@example.invalid' }, { role: 'service_role' },
    { sql: 'select 1' }, { url: 'https://elsewhere.invalid' }, { slot: 'C' }, { runId: 'other' },
    { password: 'not-the-fixed-password' }]) {
    const r = await body(await f.handle(f.request('ensure', { slot: 'A', password: f.password, ...extra })));
    assert.equal(r.status, 400); assert.equal(r.data.errorCode, 'INVALID_SCOPE');
  }
  assert.equal(f.state.initializations, 0); assert.equal(f.calls.length, 0);
});
test('protected probe reports configuration/binding only; no Auth lookup or secret in response', async () => {
  const f = await fixture(), r = await body(await f.handle(f.request('probe')));
  assert.equal(r.data.configured, true); assert.equal(r.data.manifestSha256, await sha256(canonical(f.manifest)));
  assert.equal(f.calls.length, 0);
  for (const secret of [f.capability, f.password, 'service_role']) assert.equal(JSON.stringify(r.data).includes(secret), false);
});
test('real 404 user_not_found permits fixed create and independent same-UUID verification', async () => {
  const f = await fixture(), r = await body(await f.handle(f.request('ensure', { slot: 'A', password: f.password })));
  assert.equal(r.data.state, 'provisioned');
  assert.deepEqual(f.calls.map(c => c[0]), ['get','create','get']);
  const created = f.calls.find(c => c[0] === 'create')[1];
  assert.deepEqual(Object.keys(created).sort(), ['app_metadata','email','email_confirm','id','password']);
  assert.equal(created.id, f.manifest.accounts[0].id); assert.equal(created.email_confirm, true);
});
test('lost successful create response recovers by exact UUID; retry never creates another pair', async () => {
  const f = await fixture(); f.state.createLost = true;
  const first = await body(await f.handle(f.request('ensure', { slot: 'A', password: f.password })));
  assert.equal(first.data.state, 'provisioned'); assert.equal(first.data.recovered, true);
  const second = await body(await f.handle(f.request('ensure', { slot: 'A', password: f.password })));
  assert.equal(second.data.state, 'provisioned'); assert.equal(f.calls.filter(c => c[0] === 'create').length, 1);
  assert.equal(f.users.size, 1); assert.equal(JSON.stringify([first,second]).includes(f.password), false);
});
test('concurrent same-slot retry is bounded to the one preallocated identity', async () => {
  const f = await fixture();
  const results = await Promise.all([f.handle(f.request('ensure', { slot: 'A', password: f.password })),
    f.handle(f.request('ensure', { slot: 'A', password: f.password }))]);
  assert.ok(results.every(r => r.status === 200)); assert.equal(f.users.size, 1);
  assert.ok(f.calls.filter(c => c[0] === 'create').every(c => c[1].id === f.manifest.accounts[0].id));
});
test('404 validation_failed and transport failures are never treated as missing user', async () => {
  const f = await fixture();
  for (const error of [{ status: 404, code: 'validation_failed' }, { status: 503, code: 'unexpected_failure' }]) {
    f.state.getFailure = error;
    const r = await body(await f.handle(f.request('ensure', { slot: 'A', password: f.password })));
    assert.equal(r.data.ok, false); assert.equal(r.data.errorCode, 'AUTH_LOOKUP_UNAVAILABLE');
    assert.equal(r.data.retryable, error.status === 503);
  }
  assert.equal(f.calls.some(c => c[0] === 'create'), false);
});
test('existing wrong marker/email/role/soft-deleted identity is untouched', async () => {
  for (const alter of [u => u.app_metadata.n73.runId = 'other', u => u.email = 'other@example.invalid',
    u => u.role = 'service_role', u => u.deleted_at = new Date().toISOString()]) {
    const f = await fixture(), u = f.user('A'); alter(u); f.users.set(u.id, u);
    const r = await body(await f.handle(f.request('ensure', { slot: 'A', password: f.password })));
    assert.equal(r.data.errorCode, 'FIXTURE_IDENTITY_CONFLICT'); assert.equal(f.calls.filter(c => c[0] !== 'get').length, 0);
  }
});
test('expiry advancing during lookup prevents each privileged operation from starting', async () => {
  for (const operation of ['ensure','retire','revoke']) {
    const f = await fixture(operation === 'ensure' ? 'provision' : 'cleanup-only');
    if (operation !== 'ensure') f.users.set(f.manifest.accounts[0].id, f.user('A'));
    const get = f.admin.getUserById;
    f.admin.getUserById = async id => { const result = await get(id); f.state.now = Date.parse(f.manifest.expiresAt); return result; };
    const extra = operation === 'ensure' ? { password: f.password } : operation === 'revoke' ? { accessToken: 'YWJj.ZGVm.Z2hp' } : {};
    const r = await body(await f.handle(f.request(operation, { slot: 'A', ...extra })));
    assert.equal(r.status, 410); assert.equal(r.data.errorCode, 'CAPABILITY_EXPIRED');
    assert.equal(f.calls.some(c => ['create','update','signOut'].includes(c[0])), false);
  }
});
test('streaming body has both size and time bounds before admin initialization', async () => {
  const f = await fixture();
  const large = f.request('probe', {}, { body: JSON.stringify({ text: 'x'.repeat(13000) }) });
  assert.equal((await body(await f.handle(large))).data.errorCode, 'BODY_LIMIT');
  f.state.now = Date.parse(f.manifest.expiresAt) - 25;
  let canceled = false;
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  const slow = new Request('https://fixture.invalid', { method: 'POST', duplex: 'half', body: stream,
    headers: { 'content-type': 'application/json', 'x-n73-capability': f.capability } });
  assert.equal((await body(await f.handle(slow))).data.errorCode, 'BODY_TIMEOUT');
  assert.equal(canceled, true); assert.equal(f.state.initializations, 0);
});
test('cleanup-only cannot create, and provisioning cannot retire/revoke', async () => {
  const cleanup = await fixture('cleanup-only');
  assert.equal((await body(await cleanup.handle(cleanup.request('ensure', { slot: 'A', password: cleanup.password })))).data.errorCode, 'PHASE_REJECTED');
  const provision = await fixture();
  assert.equal((await body(await provision.handle(provision.request('retire', { slot: 'A' })))).data.errorCode, 'PHASE_REJECTED');
  assert.equal(cleanup.calls.length + provision.calls.length, 0);
});
test('revocation verifies actual JWT owner and rejects a B token for A without signOut', async () => {
  const f = await fixture('cleanup-only'); f.users.set(f.manifest.accounts[0].id, f.user('A')); f.state.tokenOwner = 'B';
  const r = await body(await f.handle(f.request('revoke', { slot: 'A', accessToken: 'YWJj.ZGVm.Z2hp' })));
  assert.equal(r.data.errorCode, 'TOKEN_OWNER_NOT_VERIFIED');
  assert.ok(f.calls.some(c => c[0] === 'verifyToken')); assert.equal(f.calls.some(c => c[0] === 'signOut'), false);
});
test('Auth token-verification timeout is retryable, not an owner conflict', async () => {
  const f = await fixture('cleanup-only'); f.users.set(f.manifest.accounts[0].id, f.user('A'));
  for (const status of [0,429,503]) {
    f.state.tokenError = { status };
    const r = await body(await f.handle(f.request('revoke', { slot: 'A', accessToken: 'YWJj.ZGVm.Z2hp' })));
    assert.equal(r.status, 503); assert.equal(r.data.errorCode, 'TOKEN_VERIFICATION_UNAVAILABLE'); assert.equal(r.data.retryable, true);
  }
  assert.equal(f.calls.some(c => c[0] === 'signOut'), false);
});
test('lost signOut acknowledgment is uncertain and never falsely proves refresh revocation', async () => {
  const f = await fixture('cleanup-only'); f.users.set(f.manifest.accounts[0].id, f.user('A')); f.state.signOutThrows = true;
  const first = await body(await f.handle(f.request('revoke', { slot: 'A', accessToken: 'YWJj.ZGVm.Z2hp' })));
  assert.equal(first.data.errorCode, 'SIGN_OUT_UNAVAILABLE'); assert.equal(first.data.retryable, true);
  f.state.signOutThrows = false;
  const second = await body(await f.handle(f.request('revoke', { slot: 'A', accessToken: 'YWJj.ZGVm.Z2hp' })));
  assert.equal(second.data.state, 'sign_out_acknowledged'); assert.match(second.data.refreshRevocation, /must_verify/);
  assert.equal(JSON.stringify([first,second]).includes('YWJj.ZGVm.Z2hp'), false);
});
test('retention uses the single fixed ban, rereads exact marker, and retry does not extend it', async () => {
  const f = await fixture('cleanup-only'); f.users.set(f.manifest.accounts[0].id, f.user('A')); f.state.updateLost = true;
  const first = await body(await f.handle(f.request('retire', { slot: 'A' })));
  assert.equal(first.data.state, 'retained_banned'); assert.equal(first.data.sessionsRevokedByBan, false);
  const second = await body(await f.handle(f.request('retire', { slot: 'A' })));
  assert.equal(second.data.bannedUntil, first.data.bannedUntil); assert.equal(f.calls.filter(c => c[0] === 'update').length, 1);
  assert.equal(f.users.get(f.manifest.accounts[0].id).app_metadata.n73.runId, f.manifest.runId);
});
test('ban_duration/unban injection is rejected, and a failed ban cannot claim retained', async () => {
  const f = await fixture('cleanup-only'); f.users.set(f.manifest.accounts[0].id, f.user('A'));
  const extra = await body(await f.handle(f.request('retire', { slot: 'A', ban_duration: 'none' })));
  assert.equal(extra.data.errorCode, 'INVALID_SCOPE');
  f.admin.updateUserById = async () => ({ error: { status: 503, message: 'PRIVATE-ERROR' } });
  const r = await body(await f.handle(f.request('retire', { slot: 'A' })));
  assert.equal(r.data.errorCode, 'RETENTION_BAN_NOT_CONFIRMED'); assert.equal(r.data.retryable, true);
  assert.equal(JSON.stringify(r.data).includes('PRIVATE-ERROR'), false);
});
