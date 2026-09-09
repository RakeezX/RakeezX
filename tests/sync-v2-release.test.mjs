import 'fake-indexeddb/auto';
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import * as store from '../src/store.js';

const OLD_AUTH_STORAGE_KEY = 'rakeezx-auth';
const CANDIDATE_REF = 'xlrubcwjqktzzunrvuns';
const originalFetch = global.fetch;

const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const user = { id: 'owner-a', email: 'owner@example.test' };
const future = () => Math.floor(Date.now() / 1000) + 3600;
const expired = () => Math.floor(Date.now() / 1000) - 60;
const response = (body, status = 200) => new Response(
  body == null ? null : JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } },
);

beforeEach(async () => {
  storage.clear();
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
  global.fetch = originalFetch;
  await db.clearStore('outbox');
});

afterEach(() => {
  global.fetch = originalFetch;
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
});

after(() => {
  store.closeChannel();
  db.closeDB();
});

test('candidate target uses an isolated Auth namespace and ignores the V1 session', async () => {
  localStorage.setItem(OLD_AUTH_STORAGE_KEY, JSON.stringify({
    access_token: 'v1-access', refresh_token: 'v1-refresh', expires_at: future(), user,
  }));

  await cloud.init();

  assert.equal(cloud.SUPABASE_URL, `https://${CANDIDATE_REF}.supabase.co`);
  assert.notEqual(cloud.AUTH_STORAGE_KEY, OLD_AUTH_STORAGE_KEY);
  assert.equal(cloud.session, null);
  assert.equal(cloud.user, null);
  assert.equal(cloud.authStatus().state, 'signed_out');
  assert.ok(localStorage.getItem(OLD_AUTH_STORAGE_KEY));
});

test('fresh sign-in targets the candidate and persists only the V2 session', async () => {
  let requestedUrl = '';
  global.fetch = async (url, options) => {
    requestedUrl = String(url);
    assert.equal(options.method, 'POST');
    return response({ access_token: 'candidate-access', refresh_token: 'candidate-refresh', expires_in: 3600, user });
  };

  await cloud.signIn(user.email, 'test-password');

  assert.equal(requestedUrl, `https://${CANDIDATE_REF}.supabase.co/auth/v1/token?grant_type=password`);
  assert.equal(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)).access_token, 'candidate-access');
  assert.equal(localStorage.getItem(OLD_AUTH_STORAGE_KEY), null);
  assert.equal(cloud.authStatus().state, 'authenticated');
});

test('logout removes only the candidate session and remains a voluntary signed-out state', async () => {
  const value = { access_token: 'candidate-access', refresh_token: 'candidate-refresh', expires_at: future(), user };
  cloud.setMockAuth(user, value);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(value));
  localStorage.setItem(OLD_AUTH_STORAGE_KEY, 'untouched-v1-session');
  global.fetch = async (url) => {
    assert.equal(String(url), `https://${CANDIDATE_REF}.supabase.co/auth/v1/logout`);
    return response(null, 204);
  };

  await cloud.signOut();

  assert.equal(localStorage.getItem(cloud.AUTH_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(OLD_AUTH_STORAGE_KEY), 'untouched-v1-session');
  assert.equal(cloud.authStatus().state, 'signed_out');
});

test('expired stored session refreshes and is atomically replaced', async () => {
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify({
    access_token: 'expired-access', refresh_token: 'refresh-one', expires_at: expired(), user,
  }));
  let refreshes = 0;
  global.fetch = async (url) => {
    assert.match(String(url), /grant_type=refresh_token$/);
    refreshes += 1;
    return response({ access_token: 'fresh-access', refresh_token: 'refresh-two', expires_in: 3600, user });
  };

  await cloud.init();

  assert.equal(refreshes, 1);
  assert.equal(cloud.session.access_token, 'fresh-access');
  assert.equal(cloud.session.refresh_token, 'refresh-two');
  assert.equal(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)).access_token, 'fresh-access');
});

test('concurrent expired-session requests share one refresh', async () => {
  cloud.setMockAuth(user, {
    access_token: 'expired-access', refresh_token: 'refresh-one', expires_at: expired(), user,
  });
  let refreshes = 0;
  global.fetch = async (url) => {
    if (String(url).includes('grant_type=refresh_token')) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response({ access_token: 'fresh-access', refresh_token: 'refresh-two', expires_in: 3600, user });
    }
    return response([]);
  };

  await Promise.all([cloud.request('/students?select=*'), cloud.request('/subjects?select=*')]);

  assert.equal(refreshes, 1);
});

test('one 401 refresh retry preserves the exact mutation identity', async () => {
  cloud.setMockAuth(user, {
    access_token: 'first-access', refresh_token: 'refresh-one', expires_at: future(), user,
  });
  const rpcBodies = [];
  const authHeaders = [];
  let refreshes = 0;
  global.fetch = async (url, options) => {
    if (String(url).includes('grant_type=refresh_token')) {
      refreshes += 1;
      return response({ access_token: 'second-access', refresh_token: 'refresh-two', expires_in: 3600, user });
    }
    rpcBodies.push(JSON.parse(options.body));
    authHeaders.push(options.headers.Authorization);
    return rpcBodies.length === 1
      ? response({ message: 'expired JWT' }, 401)
      : response({ status: 'applied', mutation_id: 'mutation-stable' });
  };

  await cloud.applySyncV2Mutation({
    entity: 'subjects', recordId: 'subject-a', mutationId: 'mutation-stable', deviceId: 'device-a',
    baseRevision: 0, patch: { name: 'رياضيات' }, operation: 'create', clientUpdatedAt: '2026-09-07T00:00:00.000Z',
  });

  assert.equal(refreshes, 1);
  assert.equal(rpcBodies.length, 2);
  assert.deepEqual(rpcBodies[1], rpcBodies[0]);
  assert.equal(rpcBodies[0].p_mutation_id, 'mutation-stable');
  assert.equal(authHeaders[0], 'Bearer first-access');
  assert.equal(authHeaders[1], 'Bearer second-access');
});

test('invalid refresh requires authentication and clears only the candidate session', async () => {
  const value = { access_token: 'expired-access', refresh_token: 'invalid-refresh', expires_at: expired(), user };
  cloud.setMockAuth(user, value);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(value));
  localStorage.setItem(OLD_AUTH_STORAGE_KEY, 'untouched-v1-session');
  global.fetch = async () => response({ error_description: 'Invalid Refresh Token' }, 400);

  await assert.rejects(cloud.request('/students?select=*'), (error) => error.code === 'AUTH_REQUIRED');
  assert.equal(cloud.session, null);
  assert.equal(cloud.user, null);
  assert.equal(cloud.authStatus().state, 'auth_required');
  assert.equal(localStorage.getItem(cloud.AUTH_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(OLD_AUTH_STORAGE_KEY), 'untouched-v1-session');
  sync.init();
  assert.equal(sync.displayState().detailStatus, 'auth_required');
});

test('network failure during refresh retains the local session for later retry', async () => {
  const value = { access_token: 'expired-access', refresh_token: 'valid-refresh', expires_at: expired(), user };
  const pending = { id: 'pending-auth-retry', protocol: 'v2', mutationId: 'pending-auth-retry' };
  cloud.setMockAuth(user, value);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(value));
  await db.put('outbox', pending);
  global.fetch = async () => { throw new TypeError('network unavailable'); };

  await assert.rejects(cloud.request('/students?select=*'), (error) => error.code === 'AUTH_NETWORK');
  assert.equal(cloud.session.access_token, 'expired-access');
  assert.equal(cloud.user.id, user.id);
  assert.equal(JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY)).refresh_token, 'valid-refresh');
  assert.equal(cloud.authStatus().state, 'authenticated');
  assert.deepEqual(await db.get('outbox', pending.id), pending);
});

test('PWA release v9 precaches Sync V2 and preserves the update lifecycle', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const cloudSource = await readFile(new URL('../src/lib/cloud.js', import.meta.url), 'utf8');

  assert.match(sw, /const VERSION = 'rakeezx-v9'/);
  assert.match(sw, /\.\/src\/lib\/sync-v2\.js/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.match(sw, /key\.startsWith\('rakeezx-'\)/);
  assert.match(cloudSource, new RegExp(CANDIDATE_REF));
  assert.doesNotMatch(cloudSource, /bmekljhmepgkhywjzkdx/);
  assert.doesNotMatch(cloudSource, /service_role/i);
});
