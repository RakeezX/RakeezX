// AI-authored: independently loaded actual clients, one synthetic shared store.
// All fetches are fabricated; no browser, credentials or live service is used.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
const owner = '11111111-1111-4111-8111-111111111111';
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null,
  setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k),
  key: i => [...storage.keys()][i] ?? null, get length() { return storage.size; } };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; storage.clear(); });
let serial = 0;
const value = (n, id = owner) => ({ access_token: `synthetic-access-${n}`,
  refresh_token: `synthetic-refresh-${n}`, user: { id }, expires_at: 4102444800 });
const json = (v, status = 200) => Response.json(v, { status });
async function pair() {
  const a = await import(`../../src/lib/cloud.js?n44-a-${++serial}`);
  const b = await import(`../../src/lib/cloud.js?n44-b-${serial}`);
  localStorage.setItem(a.AUTH_STORAGE_KEY, JSON.stringify(value(0)));
  await a.init(); await b.init();
  assert.notEqual(a, b); assert.notEqual(a.session, b.session);
  return { a, b, stored: () => JSON.parse(localStorage.getItem(a.AUTH_STORAGE_KEY)) };
}
function gate() {
  let resolve; const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
async function rotate(b, n = 1) {
  globalThis.fetch = async () => json(value(n));
  await b.refreshSession();
}

test('preflight: stale independent client must not POST a consumed refresh token', async () => {
  const { a,b,stored } = await pair();
  await rotate(b);
  let calls = 0;
  // The earlier zero-HTTP STOP is preserved in historical green.txt. Recovery
  // may verify the winner via Auth GET, never POST stale RT or call Product REST.
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, `${a.SUPABASE_URL}/auth/v1/user`);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${value(1).access_token}`);
    return json({ message: 'candidate verification unavailable' }, 503);
  };
  await assert.rejects(a.refreshSession(), { status: 503 });
  assert.equal(calls, 1); assert.deepEqual(stored(), value(1));
  assert.equal(a.session.access_token, value(0).access_token);
});

for (const status of [200,400,401,403]) test(`late refresh ${status} cannot replace/remove peer winner`, async () => {
  const { a,b,stored } = await pair(), entered = gate(), reply = gate();
  globalThis.fetch = async () => { entered.resolve(); return reply.promise; };
  const old = a.refreshSession();
  const rejected = assert.rejects(old, { code: 'AUTH_CONTEXT_CHANGED' });
  await entered.promise; await rotate(b, 2);
  reply.resolve(json(status === 200 ? value('old-response') : {message:'denied'}, status));
  await rejected; assert.deepEqual(stored(), value(2));
  assert.equal(a.session.access_token, value(0).access_token);
});

for (const operation of ['verify401','verify403','verify200','data401','data200']) test(`late ${operation} respects shared credential replacement`, async () => {
  const { a,b,stored } = await pair(), entered = gate(), reply = gate();
  // No refresh token forces the Data API terminal-401 path directly.
  if (operation.startsWith('data')) {
    const initial = {...value(0), refresh_token:null};
    a.setMockAuth(initial.user, initial); b.setMockAuth(initial.user,initial);
    localStorage.setItem(a.AUTH_STORAGE_KEY,JSON.stringify(initial));
  }
  globalThis.fetch = async () => { entered.resolve(); return reply.promise; };
  const old = operation.startsWith('verify') ? a.verifyCurrentAuthIdentity(owner) : a.request('/synthetic');
  const rejected = assert.rejects(old, { code: 'AUTH_CONTEXT_CHANGED' });
  await entered.promise;
  // Persist through the actual second client Auth flow, not a fake refresh implementation.
  globalThis.fetch = async () => json(value(1));
  await b.signIn('synthetic@example.invalid','synthetic');
  const status = Number(operation.slice(-3));
  reply.resolve(json(status === 200 ? { id:owner } : {message:'denied'},status));
  await rejected; assert.deepEqual(stored(), value(1));
});

for (const change of ['logout','owner','same-owner-session','memory']) test(`${change} during refresh retires old reply`, async () => {
  const { a,b,stored } = await pair(), entered = gate(), reply = gate();
  globalThis.fetch = async () => { entered.resolve(); return reply.promise; };
  const rejected = assert.rejects(a.refreshSession(), {code:'AUTH_CONTEXT_CHANGED'});
  await entered.promise;
  globalThis.fetch = async () => json(value('replacement', change === 'owner' ? '22222222-2222-4222-8222-222222222222' : owner));
  if (change === 'logout') await b.signOut();
  else if (change === 'memory') a.setMockAuth(value('memory').user,value('memory'));
  else await b.signIn('synthetic@example.invalid','synthetic');
  const winner = stored();
  reply.resolve(json(value('late'))); await rejected;
  assert.deepEqual(stored(), winner);
});

for (const status of [200,400]) test(`peer rotation while refresh ${status} body waits cannot commit`, async () => {
  const {a,b,stored} = await pair(), entered = gate(), body = gate();
  const response = json({},status);
  if (status === 200) response.json = async () => { entered.resolve(); return body.promise; };
  else response.clone = () => ({json:async () => { entered.resolve(); return body.promise; }});
  globalThis.fetch = async () => response;
  const rejected = assert.rejects(a.refreshSession(),{code:'AUTH_CONTEXT_CHANGED'});
  await entered.promise; await rotate(b);
  body.resolve(status === 200 ? value('late-body') : {message:'denied'});
  await rejected; assert.deepEqual(stored(),value(1));
});

for (const status of [401,403]) test(`current unchanged verified identity denial ${status} still clears`, async () => {
  const {a,stored} = await pair();
  globalThis.fetch = async () => json({message:'authoritative denial'},status);
  await assert.rejects(a.verifyCurrentAuthIdentity(owner),{status});
  assert.equal(a.session,null); assert.equal(stored(),null);
  assert.equal(a.authStatus().state,'auth_required');
});

for (const status of [429,500,503,'network']) test(`transient refresh ${status} preserves current credentials`, async () => {
  const {a,stored} = await pair();
  globalThis.fetch = async () => {
    if (status === 'network') throw new TypeError('synthetic offline');
    return json({message:'synthetic transient'},status);
  };
  await assert.rejects(a.refreshSession(), status === 'network' ? {code:'AUTH_NETWORK'} : {status});
  assert.deepEqual(stored(),value(0)); assert.deepEqual(a.session,value(0));
});

test('singleflight deadline aborts once and a late ignored-abort body cannot persist', async () => {
  const {a,stored} = await pair(), entered = gate(), body = gate();
  const nativeTimeout = globalThis.setTimeout;
  let expire, signal, calls = 0;
  globalThis.setTimeout = (fn,ms,...args) => {
    if (ms === 12000) expire = fn;
    return nativeTimeout(fn,ms,...args);
  };
  try {
    globalThis.fetch = async (_url,options) => {
      calls++; signal = options.signal;
      return {ok:true,json:async () => { entered.resolve(); return body.promise; }};
    };
    const first = assert.rejects(a.refreshSession(),{code:'AUTH_TIMEOUT'});
    const second = assert.rejects(a.refreshSession(),{code:'AUTH_TIMEOUT'});
    await entered.promise; expire(); await Promise.all([first,second]);
    assert.equal(calls,1); assert.equal(signal.aborted,true);
    body.resolve(value('late-timeout'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(stored(),value(0)); assert.deepEqual(a.session,value(0));
  } finally { globalThis.setTimeout = nativeTimeout; }
});

test('same-owner explicit new login retires old data request even with identical credential tuple', async () => {
  const {a} = await pair(), entered = gate(), reply = gate();
  globalThis.fetch = async () => { entered.resolve(); return reply.promise; };
  const rejected = assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});
  await entered.promise;
  globalThis.fetch = async () => json(value(0));
  await a.signIn('synthetic@example.invalid','synthetic');
  reply.resolve(json({ok:true})); await rejected;
});

test('preflight owner change or peer logout sends no data against a retired context', async () => {
  for (const change of ['owner','logout']) {
    const {a,b} = await pair();
    globalThis.fetch = async () => json(value(1,'22222222-2222-4222-8222-222222222222'));
    if (change === 'owner') await b.signIn('synthetic@example.invalid','synthetic');
    else await b.signOut();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error('must not send'); };
    await assert.rejects(a.request('/synthetic',{method:'POST',body:'{}'}),{code:'AUTH_CONTEXT_CHANGED'});
    assert.equal(calls,0);
  }
});
