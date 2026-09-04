import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { LOCAL_RESET_COPY } from '../src/views/backup.js';

test('local reset copy accurately describes the device-only operation', async () => {
  assert.equal(LOCAL_RESET_COPY.button, 'إعادة ضبط سجل ركيز المحلي على هذا الجهاز');
  assert.match(LOCAL_RESET_COPY.description, /من هذا الجهاز فقط/);
  assert.match(LOCAL_RESET_COPY.description, /لن تُحذف بياناتك السحابية/);
  assert.match(LOCAL_RESET_COPY.description, /التغييرات غير المرفوعة/);
  assert.match(LOCAL_RESET_COPY.pendingWarning, /ستُفقد/);
});

test('local reset clears IndexedDB only and has no cloud/auth/cache side effect', async () => {
  const source = await readFile(new URL('../src/views/backup.js', import.meta.url), 'utf8');

  assert.match(source, /await db\.clearAll\(\);/);
  assert.match(source, /location\.reload\(\);/);
  assert.match(source, /await db\.getAll\('outbox'\)/, 'pending outbox warning is calculated locally');
  assert.doesNotMatch(source, /cloud\./);
  assert.doesNotMatch(source, /sync\./);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /caches\./);
  assert.doesNotMatch(source, /signOut/);
});
