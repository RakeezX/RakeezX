import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import grades, { recordInlineQuickLog, flushInlineQuickLogEffect } from '../src/views/grades.js';

test('N84 is wired into the Product Gradebook with no new offline asset dependency', async () => {
  const source = await readFile(new URL('../src/views/grades.js', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../src/router.js', import.meta.url), 'utf8');
  assert.equal(grades.actions['n84-log'], recordInlineQuickLog);
  assert.equal(grades.afterPaint, flushInlineQuickLogEffect);
  assert.match(router, /path: '\/teaching\/:id\/grades',\s+load: \(\) => import\('\.\/views\/grades\.js'\)/);
  assert.match(shell, /\.\/src\/views\/grades\.js/);
  for (const [, path] of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
    const relative = new URL(path, new URL('../src/views/grades.js', import.meta.url)).pathname.split('/src/')[1];
    assert.ok(shell.includes(`./src/${relative}`), `Product view dependency is precached: ${relative}`);
  }
  assert.match(source, /<style>[\s\S]*\.n84-step \{ width:44px; height:44px/);
  assert.doesNotMatch(source, /styles\/grades\.css|lib\/quicklog-inline\.js/);
  const action = recordInlineQuickLog.toString();
  assert.equal((action.match(/store\.addLog\(/g) ?? []).length, 1);
  assert.doesNotMatch(action, /setScore|save\(|patch\(/);
  assert.match(action, /kind:'participation'/);
  assert.match(action, /item\.auto !== 'participation'/);
});
