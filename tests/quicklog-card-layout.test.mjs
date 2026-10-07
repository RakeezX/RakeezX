import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
const view = readFileSync(new URL('../src/views/quicklog.js', import.meta.url), 'utf8');

test('Quick Log reserves the minus corner only in the metadata row and gives the name two full-width lines', () => {
  assert.match(view, /class="qlcard__meta">[\s\S]*?qlcard__roll[\s\S]*?\$\{statusBadge\}[\s\S]*?<\/div>\s*<span class="qlcard__name">/);
  assert.match(css, /\.qlcard__meta\s*\{[^}]*padding-inline-end:\s*44px/);
  assert.match(css, /\.qlcard__name\s*\{[^}]*-webkit-line-clamp:\s*2/);
  assert.match(css, /\.qlcard__hit\s*\{\s*min-height:\s*100%;\s*padding:\s*10px 12px;\s*\}/);
  assert.match(css, /\.qlcard__minus\s*\{\s*width:\s*44px;\s*height:\s*44px/);
});

test('Quick Log uses wider adaptive desktop cards and two compact columns on phones', () => {
  assert.match(css, /\.ql-grid\s*\{\s*grid-template-columns:\s*repeat\(auto-fill, minmax\(208px, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.ql-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});
