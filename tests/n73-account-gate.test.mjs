import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

test('claimed synthetic account cannot write unsupported D119 mutations', async () => {
  await activateSyntheticAccountWorkspace();
  try {
    const before = await db.getAll('items');
    assert.equal(store.supportsDistributionCopy(), false);
    await assert.rejects(store.applyScoreDistributionCopy('t1', ['t2'], { expectedToken: 'any', confirmed: true }), /التجربة/);
    assert.deepEqual(await db.getAll('items'), before);
    assert.deepEqual(await db.getAll('outbox'), []);
  } finally { store.closeChannel(); await db.closeDB(); }
});
