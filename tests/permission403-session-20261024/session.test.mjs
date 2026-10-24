// AI-authored: actual cloud module; fabricated Auth and fetch only, no network.
import 'fake-indexeddb/auto';
import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../../src/lib/cloud.js';
import * as db from '../../src/lib/db.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  key: index => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
const realFetch = globalThis.fetch;
const session = (id = A, token = 'fabricated-access') => ({ access_token: token,
  refresh_token: 'fabricated-refresh', user: { id }, expires_at: Math.floor(Date.now() / 1000) + 3600 });
function seed(value = session()) {
  cloud.setMockAuth(value.user, value);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(value));
  return value;
}
const json = (body, status = 200) => Response.json(body, { status });
const denied = () => json({ code: '42501', message: 'permission denied', details: 'synthetic details', hint: 'synthetic hint' }, 403);
const unauthorized = () => json({ message: 'expired JWT' }, 401);
function transport(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const kind = new URL(url).pathname.startsWith('/auth/') ? 'refresh' : 'data';
    calls.push(kind);
    return handler(kind, options, calls);
  };
  return calls;
}
const permission = error => error.status === 403 && error.code === '42501' && error.message === 'permission denied'
  && error.details === 'synthetic details' && error.hint === 'synthetic hint';
afterEach(() => { globalThis.fetch = realFetch; cloud.setMockAuth(null, null); storage.clear(); });
after(() => db.closeDB());

if (process.env.PERMISSION403_RED === '1') {
  test('RED: unchanged actual cloud.js refreshes/replays permission denial and clears Auth', async () => {
    seed();
    const calls = transport(kind => kind === 'refresh' ? json(session(A, 'fabricated-new')) : denied());
    await assert.rejects(cloud.request('/rpc/synthetic-denied', { method: 'POST', body: '{}' }), { code: 'AUTH_REQUIRED' });
    assert.deepEqual(calls, ['data', 'refresh', 'data']);
    assert.equal(cloud.session, null);
    assert.equal(localStorage.getItem(cloud.AUTH_STORAGE_KEY), null);
    assert.equal(cloud.authStatus().state, 'auth_required');
  });
} else {
  test('permission403_preserves_session_without_refresh_or_replay, including reopen and pending state', async () => {
    const original = seed();
    await db.clearAll();
    await db.put('outbox', { id: 'unknown-command', mutationId: 'fixed-unknown-id', state: 'UNKNOWN', envelopeLocked: true });
    await db.put('students', { id: 'synthetic-pending', pendingSync: true });
    const outbox = await db.getAll('outbox'), students = await db.getAll('students');
    const calls = transport(() => denied());
    await assert.rejects(cloud.request('/rpc/synthetic-denied', { method: 'POST', body: '{}' }), permission);
    assert.deepEqual(calls, ['data']);
    assert.equal(cloud.session, original);
    assert.equal(cloud.user, original.user);
    assert.deepEqual(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)), original);
    const reopened = await import('../../src/lib/cloud.js?permission403-reopen');
    await reopened.init();
    assert.equal(reopened.authStatus().state, 'authenticated');
    assert.deepEqual(reopened.session, original);
    assert.deepEqual(await db.getAll('outbox'), outbox);
    assert.deepEqual(await db.getAll('students'), students);
    assert.deepEqual(calls, ['data']);
  });

  for (const status of [200, 403, 401]) test(`true401 refresh then ${status}`, async () => {
    seed();
    const calls = transport((kind, options, calls) => {
      if (kind === 'refresh') return json(session(A, 'fabricated-new'));
      if (calls.length === 1) return unauthorized();
      assert.equal(options.headers.Authorization, 'Bearer fabricated-new');
      return status === 403 ? denied() : status === 401 ? unauthorized() : json({ ok: true });
    });
    const operation = cloud.request('/synthetic');
    if (status === 200) assert.deepEqual(await operation, { ok: true });
    else await assert.rejects(operation, status === 403 ? permission : { code: 'AUTH_REQUIRED' });
    assert.deepEqual(calls, ['data', 'refresh', 'data']);
    assert.equal(cloud.authStatus().state, status === 401 ? 'auth_required' : 'authenticated');
    assert.equal(cloud.session?.access_token ?? null, status === 401 ? null : 'fabricated-new');
  });

  for (const status of [400, 401, 403]) test(`invalid Auth refresh ${status} still clears session`, async () => {
    seed();
    const calls = transport(kind => kind === 'refresh' ? json({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }, status) : unauthorized());
    await assert.rejects(cloud.request('/synthetic'), { code: 'AUTH_REQUIRED' });
    assert.deepEqual(calls, ['data', 'refresh']);
    assert.equal(cloud.session, null);
    assert.equal(localStorage.getItem(cloud.AUTH_STORAGE_KEY), null);
  });

  test('concurrent true401 requests share one refresh', async () => {
    seed();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let started;
    const began = new Promise(resolve => { started = resolve; });
    const calls = transport(async (kind, options) => {
      if (kind === 'refresh') { started(); await gate; return json(session(A, 'fabricated-new')); }
      return options.headers.Authorization === 'Bearer fabricated-new' ? json({ ok: true }) : unauthorized();
    });
    const first = cloud.request('/one'), second = cloud.request('/two');
    await began; release();
    await Promise.all([first, second]);
    assert.equal(calls.filter(kind => kind === 'refresh').length, 1);
    assert.equal(calls.filter(kind => kind === 'data').length, 4);
  });

  for (const phase of ['request', 'refresh', 'retry', 'failure-body']) {
    for (const change of ['owner', 'cancel', 'cross-tab']) test(`${change} during ${phase} fences stale request`, async () => {
      seed();
      const controller = new AbortController();
      let changed = false;
      const mutate = () => {
        changed = true;
        if (change === 'owner') seed(session(B, 'fabricated-owner-b'));
        else if (change === 'cross-tab') localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session(B)));
        else controller.abort();
      };
      const calls = transport((kind, options, calls) => {
        if (kind === 'refresh') {
          if (phase === 'refresh') mutate();
          return json(session(A, 'fabricated-new'));
        }
        if (phase === 'request') mutate();
        if (phase === 'retry' && calls.length === 3) mutate();
        if (phase === 'failure-body') {
          const response = unauthorized();
          response.clone = () => ({ json: async () => { mutate(); return { message: 'expired JWT' }; } });
          // No refresh token: exercise terminal failure body before invalidation.
          return response;
        }
        return unauthorized();
      });
      if (phase === 'failure-body') seed({ ...session(), refresh_token: null });
      await assert.rejects(cloud.request('/synthetic', { signal: controller.signal }), error =>
        ['AUTH_CONTEXT_CHANGED', 'AbortError'].includes(error.code) || error.name === 'AbortError');
      assert.equal(changed, true);
      assert.equal(cloud.user.id, change === 'owner' ? B : A);
      assert.equal(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)).user.id, change === 'cancel' ? A : B);
      assert.equal(calls.length, phase === 'retry' ? 3 : phase === 'refresh' ? 2 : 1);
    });
  }

  test('new same-owner token arriving during retry cannot be cleared by stale401', async () => {
    seed();
    transport((kind, options, calls) => {
      if (kind === 'refresh') return json(session(A, 'fabricated-new'));
      if (calls.length === 3) seed(session(A, 'fabricated-newer'));
      return unauthorized();
    });
    await assert.rejects(cloud.request('/synthetic'), { code: 'AUTH_CONTEXT_CHANGED' });
    assert.equal(cloud.session.access_token, 'fabricated-newer');
  });

  test('caller assertAccess remains authoritative', async () => {
    seed(); let allowed = true;
    const calls = transport(() => { allowed = false; return unauthorized(); });
    await assert.rejects(cloud.request('/synthetic', {}, false, { assertAccess() {
      if (!allowed) throw Object.assign(Error('workspace retired'), { code: 'OWNED_MUTATION_CONTEXT_CHANGED' });
    } }), { code: 'OWNED_MUTATION_CONTEXT_CHANGED' });
    assert.deepEqual(calls, ['data']);
    assert.equal(cloud.user.id, A);
  });

  test('already refreshed same-owner token is reused after late401 without another refresh', async () => {
    seed();
    const calls = transport((kind, options, calls) => {
      assert.equal(kind, 'data');
      if (calls.length === 1) { seed(session(A, 'fabricated-newer')); return unauthorized(); }
      assert.equal(options.headers.Authorization, 'Bearer fabricated-newer');
      return json({ ok: true });
    });
    assert.deepEqual(await cloud.request('/synthetic'), { ok: true });
    assert.deepEqual(calls, ['data', 'data']);
  });

  test('transient refresh503 preserves Auth and does not replay mutation', async () => {
    const original = seed();
    const calls = transport(kind => kind === 'refresh' ? json({ code: 'synthetic_unavailable' }, 503) : unauthorized());
    await assert.rejects(cloud.request('/synthetic'), { status: 503, code: 'synthetic_unavailable' });
    assert.equal(cloud.session, original);
    assert.deepEqual(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)), original);
    assert.deepEqual(calls, ['data', 'refresh']);
  });
}
