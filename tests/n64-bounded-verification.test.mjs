import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../src/lib/cloud.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const storage = new Map();
globalThis.localStorage = {
  get length() { return storage.size; }, key: i => [...storage.keys()][i] ?? null,
  getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key),
};
const login = (id = A, token = `token-${id}`) => {
  const session = { access_token: token, refresh_token: `refresh-${id}`, expires_at: 4102444800, user: { id, email: `${id}@example.test` } };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session)); cloud.setMockAuth(session.user, session);
  return session;
};
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

test('bounded lifecycle, shared refresh independence, stale owner/token/logout, body timeout and retry', async () => {
  const originalFetch = globalThis.fetch, originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const timers = new Set();
  // Trigger the actual production deadline callback deterministically; browser
  // evidence separately waits for the real 12-second wall-clock deadline.
  globalThis.setTimeout = (fn, ms, ...args) => {
    if (ms !== 12000) return originalTimeout(fn, ms, ...args);
    timers.add(fn); return fn;
  };
  globalThis.clearTimeout = id => timers.delete(id) || originalClear(id);
  try {
    const prior = login();
    prior.expires_at = 1;
    cloud.setMockAuth(prior.user, prior); localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(prior));
    let release, refreshSignal;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/token?')) { refreshSignal = options.signal; return new Promise(resolve => { release = resolve; }); }
      return Response.json(cloud.user);
    };
    const shared = cloud.refreshSession(); // belongs to an independent consumer
    const verification = cloud.verifyCurrentAuthIdentity(A);
    await flush();
    const callbacks = [...timers];
    assert.equal(callbacks.length, 2);
    callbacks[1](); // settings deadline must not cancel shared refresh
    await assert.rejects(verification, { code: 'AUTH_TIMEOUT' });
    assert.equal(refreshSignal.aborted, false);
    release(Response.json({ ...prior, access_token: 'fresh-token', expires_at: 4102444800 }));
    await shared;
    assert.equal(cloud.session.access_token, 'fresh-token');
    await cloud.verifyCurrentAuthIdentity(A);
    assert.equal(timers.size, 0);

    for (const transition of ['owner', 'logout', 'same-owner-token']) {
      const old = login(); let resolve;
      globalThis.fetch = async url => String(url).includes('/token?')
        ? new Promise(done => { resolve = done; }) : Response.json({});
      const pending = cloud.refreshSession();
      if (transition === 'owner') login(B);
      else if (transition === 'same-owner-token') login(A, 'newer-token');
      else await cloud.signOut();
      resolve(Response.json({ ...old, access_token: 'stale-token' }));
      await assert.rejects(pending, { code: 'AUTH_CONTEXT_CHANGED' });
      assert.equal(cloud.session?.access_token ?? null, transition === 'owner' ? `token-${B}` : transition === 'logout' ? null : 'newer-token');
      assert.equal(timers.size, 0);
    }

    // A stale 401 may not sign out a newer token of the same owner.
    login(); let release401;
    globalThis.fetch = () => new Promise(resolve => { release401 = resolve; });
    const stale401 = cloud.verifyCurrentAuthIdentity(A);
    await flush(); login(A, 'newer-token');
    release401(Response.json({ message: 'expired' }, { status: 401 }));
    await assert.rejects(stale401);
    assert.equal(cloud.session.access_token, 'newer-token');

    // Response-body stall also consumes the same deadline; late body is inert.
    const bodyPrior = login(); let bodyRelease;
    globalThis.fetch = async () => ({ ok: true, status: 200, text: () => new Promise(resolve => { bodyRelease = resolve; }) });
    const body = cloud.verifyCurrentAuthIdentity(A);
    await flush(); [...timers][0]();
    await assert.rejects(body, { code: 'AUTH_TIMEOUT' });
    bodyRelease(JSON.stringify({ id: A, email: 'late@example.test' })); await flush();
    assert.deepEqual(cloud.session, bodyPrior);
    globalThis.fetch = async () => Response.json(bodyPrior.user);
    await cloud.verifyCurrentAuthIdentity(A);
    assert.equal(timers.size, 0);

    // Current-owner server rejection retains existing sign-out behavior.
    globalThis.fetch = async () => Response.json({ message: 'expired' }, { status: 401 });
    await assert.rejects(cloud.verifyCurrentAuthIdentity(A), { status: 401 });
    assert.equal(cloud.session, null);
    assert.equal(cloud.authStatus().state, 'auth_required');
    assert.equal(timers.size, 0);
  } finally {
    globalThis.fetch = originalFetch; globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear;
  }
});
