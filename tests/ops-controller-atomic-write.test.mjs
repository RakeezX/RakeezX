import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Controller, readJson, writeJson } from '../scripts/ops-supervisor-v4/controller.mjs';

const real = { rename: fs.rename, rm: fs.rm, open: fs.open, writeFile: fs.writeFile };
const fault = (code, source, target) => Object.assign(new Error(`${code}: injected rename contention`), { code, syscall: 'rename', path: source, dest: target });
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-owned-atomic-write-'));
  t.after(async () => { t.mock.restoreAll(); await real.rm(root, { recursive: true, force: true }); });
  const file = path.join(root, 'queue.json');
  const old = { id: 'existing', status: 'awaiting_po', sessionId: 'preserve-this-session' };
  await real.writeFile(file, JSON.stringify(old));
  return { root, file, old };
}

for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
  test(`${code} contention retries the same complete JSON atomically and succeeds`, async t => {
    const { root, file, old } = await fixture(t);
    const value = { ...old, status: 'closed', note: 'تجربة حفظ ذرّي' };
    const attempts = [];
    t.mock.method(fs, 'rename', async (source, target) => {
      assert.equal(target, file);
      assert.deepEqual(await readJson(file), old, 'Old destination must survive until rename succeeds');
      assert.equal(await fs.readFile(source, 'utf8'), JSON.stringify(value, null, 2) + '\n');
      attempts.push([source, target]);
      if (attempts.length < 3) throw fault(code, source, target);
      return real.rename(source, target);
    });
    await writeJson(file, value);
    assert.equal(attempts.length, 3);
    assert(attempts.every(([source, target]) => source === attempts[0][0] && target === file));
    assert.deepEqual(await readJson(file), value);
    assert.deepEqual(await fs.readdir(root), ['queue.json'], 'No temporary file remains after success');
  });
}

test('persistent contention stops at the retry bound, preserves destination and cleans only its temp', async t => {
  const { root, file, old } = await fixture(t);
  const attempts = [], removed = [];
  let last;
  t.mock.method(fs, 'rename', async (source, target) => {
    attempts.push([source, target]);
    last = fault('EPERM', source, target);
    throw last;
  });
  t.mock.method(fs, 'rm', async (target, options) => { removed.push(target); return real.rm(target, options); });
  await assert.rejects(writeJson(file, { ...old, status: 'closed' }), error => error === last);
  assert.equal(attempts.length, 6, 'Initial attempt plus five bounded retries');
  assert(attempts.every(([source, target]) => source === attempts[0][0] && target === file));
  assert.deepEqual(removed, [attempts[0][0]], 'Existing destination is never removed');
  assert.deepEqual(await readJson(file), old);
  assert.deepEqual(await fs.readdir(root), ['queue.json']);
});

test('a non-retryable rename failure propagates immediately without scheduling backoff', async t => {
  const { root, file, old } = await fixture(t);
  let calls = 0;
  const error = fault('EIO', 'owned-temp', file);
  const timer = t.mock.method(globalThis, 'setTimeout');
  t.mock.method(fs, 'rename', async () => { calls++; throw error; });
  await assert.rejects(writeJson(file, { status: 'closed' }), observed => observed === error);
  assert.equal(calls, 1);
  assert.equal(timer.mock.callCount(), 0);
  assert.deepEqual(await readJson(file), old);
  assert.deepEqual(await fs.readdir(root), ['queue.json']);
});

test('failed own-temp cleanup cannot replace the original rename failure', async t => {
  const { root, file, old } = await fixture(t);
  const error = fault('EIO', 'owned-temp', file), removed = [];
  let ownTemp;
  t.mock.method(fs, 'rename', async source => { ownTemp = source; throw error; });
  t.mock.method(fs, 'rm', async target => { removed.push(target); throw Object.assign(new Error('cleanup denied'), { code: 'EACCES' }); });
  await assert.rejects(writeJson(file, { status: 'closed' }), observed => observed === error);
  assert.deepEqual(removed, [ownTemp]);
  assert.notEqual(ownTemp, file);
  assert.deepEqual(await readJson(file), old);
  assert((await fs.readdir(root)).includes(path.basename(ownTemp)), 'Cleanup failure leaves only the owned temp for diagnosis');
});

test('exclusive temp creation failure does not remove a file this writer never owned', async t => {
  const { file, old } = await fixture(t);
  let collision;
  t.mock.method(fs, 'open', async (target, flags, ...args) => {
    collision = target;
    await real.writeFile(target, 'another owner');
    return real.open(target, flags, ...args);
  });
  const remove = t.mock.method(fs, 'rm');
  await assert.rejects(writeJson(file, { status: 'closed' }), { code: 'EEXIST' });
  assert.equal(remove.mock.callCount(), 0);
  assert.equal(await fs.readFile(collision, 'utf8'), 'another owner');
  assert.deepEqual(await readJson(file), old);
});

test('a persistently blocked canonical closure stays awaiting_po while other closure, workers, delivery and snapshot continue', async t => {
  const { root } = await fixture(t);
  const activationId = 'test-atomic-closure';
  await real.writeFile(path.join(root, 'workflow-v5.json'), JSON.stringify({ maxWorkers: 2, controller: { activationId } }));
  const controller = new Controller({ runtime: root, repo: root }, {
    testOnly: true, now: () => Date.parse('2026-10-13T01:00:00Z'), inventory: async () => [],
    records: { inspectProductEligibility: async (_repo, id) => ['N13', 'N54'].includes(id) ? { eligible: false, closed: true } : { eligible: true } },
  });
  await controller.initialize({ lock: false });
  const tasks = [
    { id: 'locked-n13', productId: 'N13', status: 'awaiting_po', updatedAt: '2026-10-12T23:00:00Z', sessionId: 'n13-saved-session', candidateSha: 'a'.repeat(40) },
    { id: 'other-closed', productId: 'N54', status: 'awaiting_po' },
    { id: 'live-worker', productId: 'N77', status: 'running', sessionId: 'n77-preserved', runnerPid: 12345 },
    { id: 'ready-delivery', productId: 'N94', status: 'delivery' },
    { id: 'pending-work', productId: 'N95', status: 'pending', releaseAuthority: 'test-fixture-only', allowedPaths: ['separate-fixture.js'] },
  ].map(task => ({ ...task, activationId }));
  for (const task of tasks) await writeJson(path.join(root, 'queue', task.id + '.json'), task);
  const target = path.join(root, 'queue', 'locked-n13.json');
  let locked = true, denied = 0;
  t.mock.method(fs, 'rename', async (source, destination) => {
    if (locked && destination === target) { denied++; throw fault('EPERM', source, destination); }
    return real.rename(source, destination);
  });
  const reconciled = [], deliveries = [], launched = [];
  // These are the existing tick's process/publisher boundaries; no external
  // worker or Product publication is started by the filesystem fault test.
  controller.reconcile = async task => { reconciled.push(task.id); };
  controller.startDelivery = async task => { deliveries.push(task.id); };
  controller.launch = async task => { launched.push(task.id); task.status = 'running'; await controller.save(task); };
  await controller.tick();
  assert.equal(denied, 6);
  assert.deepEqual(await readJson(target), tasks[0], 'Failed closure must preserve exact durable record');
  const inMemory = controller.jobs.find(task => task.id === 'locked-n13');
  const { __file, ...record } = inMemory;
  assert.deepEqual(record, tasks[0], 'No false in-memory closed state or updated timestamp');
  assert.equal((await readJson(path.join(root, 'queue', 'other-closed.json'))).status, 'closed');
  assert.deepEqual(reconciled, ['live-worker']);
  assert.deepEqual(deliveries, ['ready-delivery']);
  assert.deepEqual(launched, ['pending-work']);
  let snapshot = await readJson(path.join(root, 'ACTIVE_TASKS.json'));
  assert.equal(snapshot.controllerAlive, true);
  assert.equal(snapshot.tasks.find(task => task.id === 'locked-n13').status, 'awaiting_po');
  assert.equal(snapshot.active.find(task => task.id === 'live-worker').sessionId, 'n77-preserved');
  assert.equal(snapshot.active.find(task => task.id === 'live-worker').runnerPid, 12345);
  assert(snapshot.issues.some(issue => issue.code === 'QUEUE_WRITE_FAILED' && issue.taskId === 'locked-n13' && issue.errorCode === 'EPERM'));
  locked = false;
  await controller.tick();
  const recovered = await readJson(target);
  assert.equal(recovered.status, 'closed');
  assert.equal(recovered.sessionId, tasks[0].sessionId);
  assert.equal(recovered.candidateSha, tasks[0].candidateSha);
  assert.equal(recovered.closedFromCanonicalAt, '2026-10-13T01:00:00.000Z');
  snapshot = await readJson(path.join(root, 'ACTIVE_TASKS.json'));
  assert.equal(snapshot.tasks.find(task => task.id === 'locked-n13').status, 'closed');
  assert(!snapshot.issues.some(issue => issue.code === 'QUEUE_WRITE_FAILED'));
  assert.deepEqual(launched, ['pending-work'], 'Recovery must not dispatch the existing worker again');
});
