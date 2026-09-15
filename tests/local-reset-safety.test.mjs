import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { LOCAL_RESET_COPY } from '../src/views/backup.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

after(() => {
  store.closeChannel();
  db.closeDB();
});

test('local reset copy accurately describes the device-only operation', async () => {
  assert.equal(LOCAL_RESET_COPY.button, 'إعادة ضبط سجل ركيز المحلي على هذا الجهاز');
  assert.match(LOCAL_RESET_COPY.description, /من هذا الجهاز فقط/);
  assert.match(LOCAL_RESET_COPY.description, /لن تُحذف بياناتك السحابية/);
  assert.match(LOCAL_RESET_COPY.description, /التغييرات غير المرفوعة/);
  assert.match(LOCAL_RESET_COPY.pendingWarning, /ستُفقد/);
});

test('local reset clears IndexedDB only and has no cloud/auth/cache side effect', async () => {
  const source = await readFile(new URL('../src/views/backup.js', import.meta.url), 'utf8');
  const wipe = source.match(/async wipe\(\) \{(?<body>[\s\S]*?)\n    \},/)?.groups?.body;

  assert.ok(wipe, 'local reset handler must remain present');
  assert.match(wipe, /await db\.clearAll\(\);/);
  assert.match(wipe, /location\.reload\(\);/);
  assert.match(wipe, /await db\.getAll\('outbox'\)/, 'pending outbox warning is calculated locally');
  assert.doesNotMatch(wipe, /cloud\./);
  assert.doesNotMatch(wipe, /sync\./);
  assert.doesNotMatch(wipe, /localStorage/);
  assert.doesNotMatch(wipe, /sessionStorage/);
  assert.doesNotMatch(wipe, /caches\./);
  assert.doesNotMatch(wipe, /signOut/);
});
