import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Execute the current runner functions with synthetic module boundaries. This
// checks delayed Sync ordering; it is deliberately not a rendered/live PASS.
const source = await fs.readFile(new URL('./runner.mjs', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const functionSource = (name, next) => source.slice(source.indexOf(`async function ${name}(`), source.indexOf(`async function ${next}(`)).replace(/^export /gm,'');
const readySource = functionSource('ready', 'login');
const loginSource = functionSource('login', 'payload');
const execute = (fn, modules, argument, document = { readyState: 'complete', querySelector: () => null }) => new AsyncFunction('load', 'argument', 'document',
  `return (${fn.toString().replaceAll('import(', 'load(')})(argument)`)(async name => modules[name], argument, document);

function synthetic({ owner = 'A', protocol = 'CORE_V2' } = {}) {
  const sync = { state: { lastSyncedAt: 0 }, displayState: () => ({ detailStatus: 'synced' }) };
  const workspace = { authUserId: 'A', type: 'account', ownershipState: 'claimed', databaseName: 'synthetic-A' };
  const store = { state: { ready: true, device: { lastSyncAt: 0 } }, getActiveWorkspace: () => workspace };
  const cloud = { user: { id: 'A' }, session: { user: { id: 'A' } }, signIn: async () => {} };
  let polls = 0, reads = 0;
  const modules = { '/src/lib/sync.js': sync, '/src/store.js': store, '/src/lib/cloud.js': cloud,
    '/src/lib/db.js': { getActiveDatabaseName: () => 'synthetic-A', STORES: ['students'],
      get: async () => ({id:'canonical-student'}),
      readInitialRestoreReceipt: async () => { reads++; assert.equal(sync.state.lastSyncedAt, 123); assert.equal(store.state.device.lastSyncAt, 123); return { ownerId: owner, protocol }; },
      getAll: async name => name==='outbox'?[]:[{ id: 'canonical-student' }] } };
  const page = { goto: async () => {}, reload: async () => {},
    evaluate: (fn, arg) => execute(fn, modules, arg),
    waitForFunction: async (fn, argument) => {
      for (let i = 0; i < 8; i++) {
        const value = await execute(fn, modules, argument);
        if (value) return { jsonValue: async () => value, dispose: async () => {} };
        polls++;
        if (argument == null) assert.equal(reads, 0, 'Canonical receipt read before completed Sync');
        // An early presentation-only synced status, then an incomplete device
        // timestamp, must both keep the actual runner predicate pending.
        if (polls === 2) sync.state.lastSyncedAt = 123;
        if (polls === 4) store.state.device.lastSyncAt = 123;
        await new Promise(resolve => setImmediate(resolve));
      }
      throw Error('Synthetic readiness timeout');
    } };
  const browser = { newContext: async () => ({ newPage: async () => page }) };
  const poll = async (page,fn,arg) => (await page.waitForFunction(fn,arg)).jsonValue();
  const login = new AsyncFunction('assert', 'storeSession', 'save','pollDocument',
    `${readySource}\n${loginSource}\nreturn login;`)(assert, async () => {}, async () => {},poll);
  return { browser, login, polls: () => polls, reads: () => reads };
}

test('A2 waits through presentation-only Sync and incomplete device checkpoint', async () => {
  const h = synthetic();
  const state = { productIds:{student:'canonical-student'}, preview: 'https://synthetic.invalid', accounts: [{ slot: 'A', id: 'A', email: 'synthetic', password: 'synthetic' }] };
  await (await h.login)(state, h.browser, 'A', 'A2');
  assert.equal(h.polls(), 4);
  assert.equal(h.reads(), 1);
  assert.equal(state.a2Checkpoint.counts.students, 1);
});

test('A2 rejects another owner or incompatible Initial Restore receipt', async () => {
  for (const options of [{ owner: 'B' }, { protocol: 'CORE_V1' }]) {
    const h = synthetic(options);
    await assert.rejects((await h.login)({ productIds:{student:'canonical-student'}, preview: 'https://synthetic.invalid', accounts: [{ slot: 'A', id: 'A' }] }, h.browser, 'A', 'A2'), /Synthetic readiness timeout/);
  }
});

test('A2 checkpoint survives automatic reload and rejects state changed during reads', async () => {
  let workspace = null, gate = true, reads = 0;
  const document = { readyState: 'complete', querySelector: () => gate ? {} : null };
  const sync = { state: { lastSyncedAt: 123 }, displayState: () => ({ detailStatus: 'synced' }) };
  const store = { state: { ready: true, device: { lastSyncAt: 123 } }, getActiveWorkspace: () => workspace };
  const modules = { '/src/lib/sync.js': sync, '/src/store.js': store,
    '/src/lib/db.js': { getActiveDatabaseName: () => workspace?.databaseName ?? 'rakeezx', STORES: ['students'],
      readInitialRestoreReceipt: async () => ({ ownerId: 'A', protocol: 'CORE_V2' }),
      getAll: async name => { if(name==='outbox')return [];reads++; if (reads === 1) workspace = { ...workspace }; return [{ id: 'canonical-student' }]; } } };
  const checkpoint = await new AsyncFunction('pollDocument',`${functionSource('ownerCheckpoint', 'login')}\nreturn ownerCheckpoint;`)(async(page,fn,arg)=>(await page.waitForFunction(fn,arg)).jsonValue());
  const page = { waitForFunction: async (fn, owner) => {
    assert.equal(await execute(fn, modules, owner, document), false, 'Reload document has no authority');
    assert.equal(reads, 0);
    workspace = { authUserId: 'A', type: 'account', ownershipState: 'claimed', databaseName: 'synthetic-A' };
    gate = false;
    assert.equal(await execute(fn, modules, owner, document), false, 'Workspace changed while snapshot was read');
    const value = await execute(fn, modules, owner, document);
    return { jsonValue: async () => value, dispose: async () => {} };
  } };
  assert.equal((await checkpoint(page, 'A')).counts.students, 1);
  assert.equal(reads, 2);
});

test('receipt retry passes the exact expectedStageHash to the real runner call', async () => {
  const start = source.indexOf('async({envelope,stage})=>');
  assert.ok(start > 0);
  const end = source.indexOf(',{envelope:stageEnvelope,stage:stageReceipt}', start);
  // Compile the callback with its sole cloud module dependency supplied.
  const result = await new AsyncFunction('load', `return (${source.slice(start, end).replaceAll('import(', 'load(')})`)(async () => ({
    finalizeUnifiedRestore: async input => {
      assert.deepEqual(input, { restoreId: 'same-restore', backupHash: 'same-backup', expectedStageHash: 'same-stage' });
      return { receipt: { restoreId: input.restoreId, status: 'finalized' } };
    },
  }));
  assert.equal((await result({ envelope: { p_restore_id: 'same-restore', p_backup_hash: 'same-backup' }, stage: { stageHash: 'same-stage' } })).receipt.status, 'finalized');
});
