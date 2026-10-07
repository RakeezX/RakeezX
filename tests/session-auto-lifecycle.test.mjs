import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as db from '../src/lib/db.js';

test('app retains trigger cleanup for deactivation, remount, and account transition', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /store\.onWorkspaceDeactivation\(cleanupSessionAutoTriggers\)/);
  assert.match(app, /async function boot\(\) \{\s*cleanupSessionAutoTriggers\(\)/);
  assert.match(app, /workspace\.authUserId !== cloud\.user\?\.id\) cleanupSessionAutoTriggers\(\)/);
  assert.match(app, /stopSessionAutoTriggers = installSessionAutoTriggers\(/);
  assert.match(app, /store\.ensureSessionsForDate\(date, \{ signal \}\)/);
});

test('aborting a pending local session batch prevents persistence', async () => {
  db.selectDatabase('rakeezx-demo');
  await db.openDB();
  const controller = new AbortController();
  const pending = db.putAcross({ sessions: [{ id: 'old-workspace-session' }] }, { signal: controller.signal });
  await Promise.resolve(); // Allow the write transaction to open before deactivation.
  controller.abort();
  await assert.rejects(pending);
  assert.deepEqual(await db.getAll('sessions'), []);
  db.closeDB();
});
