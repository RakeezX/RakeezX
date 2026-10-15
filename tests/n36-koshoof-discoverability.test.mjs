import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('N36 class roster entry remains guarded and class hub tool is distinct from reports', async () => {
  const [classes, hub, css] = await Promise.all([
    readFile(new URL('../src/views/teachings.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/teaching-hub.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  ]);
  assert.match(classes, /canOpenRoster\(\{ id: tch\.id \}\)[\s\S]*?class-card__koshoof[\s\S]*?#\/teaching\/\$\{tch\.id\}\/koshoof/);
  assert.match(classes, /class-card__koshoof[\s\S]*?icon\('upload'\)[\s\S]*?الكشوف/);
  assert.match(hub, /href: `#\/teaching\/\$\{id\}\/koshoof`, icon: 'upload', title: 'الكشوف', sub: 'استيراد وتصدير الكشوف'/);
  assert.match(hub, /title: 'التقارير', sub: 'طباعة وتقارير الفصل'/);
  assert.match(css, /\.class-card__koshoof[^}]*min-block-size:44px[^}]*min-inline-size:44px/);
  assert.match(css, /\.class-card__koshoof:focus-visible/);
});
