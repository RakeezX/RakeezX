import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('N36 central roster entry keeps guarded class selection and a distinct class hub tool', async () => {
  const [classes, hub, center] = await Promise.all([
    readFile(new URL('../src/views/teachings.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/teaching-hub.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/class-import-center.js', import.meta.url), 'utf8'),
  ]);
  // AI: N36/N107 replaced card actions with one central toolbar entry. This is
  // a source regression check; actual clicks/denials remain in N104 browser evidence.
  assert.match(classes, /class="classes-toolbar"[\s\S]*?href="#\/classes\/koshoof">استيراد وتصدير الكشوف<\/a>/);
  assert.match(center, /const accessible = \(\) => store\.teachings\(\)\.filter\(row => \{ try \{ store\.assertClassOperationsAccess\(row\.id\); return true; \} catch \{ return false; \} \}\)/);
  assert.match(center, /const list = accessible\(\), ids = new Set\(list\.map\(row => row\.id\)\)/);
  assert.match(center, /if \(hub\.existing && !ids\.has\(hub\.existing\)\) \{\s*bindTransfer\(null\);\s*return classAccessFeedback\(\{ id: hub\.existing \}\);/);
  assert.match(center, /data-existing-class[\s\S]*?list\.map\(row => html`<option/);
  assert.match(center, /if \(!hub\.existing \|\| !canOpenKoshoof\(\{ id: hub\.existing \}\)\)/);
  assert.match(hub, /href: `#\/teaching\/\$\{id\}\/koshoof`, icon: 'upload', title: 'الكشوف', sub: 'استيراد وتصدير الكشوف'/);
  assert.match(hub, /title: 'التقارير', sub: 'طباعة وتقارير الفصل'/);
});
