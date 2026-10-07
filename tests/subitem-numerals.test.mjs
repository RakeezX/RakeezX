import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { html, render } from '../src/lib/dom.js';
import { visibleLatinDigits } from '../src/lib/visible-numerals.js';
import { distributeAutomatically, scoreCents } from '../src/lib/score-foundation.js';

function numericInput(value) {
  const listeners = new Map();
  return {
    type: 'number', value, inputMode: '', dir: '', selectionStart: 0,
    hasAttribute: (name) => name === 'min',
    min: '0', max: '',
    getAttribute: (name) => name === 'step' ? '0.01' : null,
    addEventListener: (name, callback) => listeners.set(name, callback),
    setSelectionRange(start) { this.selectionStart = start; },
    setCustomValidity(message) { this.validationMessage = message; },
    checkValidity() { return !this.validationMessage; },
    input(value) { this.value = value; listeners.get('input')(); },
  };
}

test('auto distribution, added rows, and totals retain numeric scoring and ASCII display', () => {
  const rows = distributeAutomatically(10, 3);
  assert.deepEqual(rows, [3.33, 3.33, 3.34]);
  assert.equal(rows.reduce((sum, value) => sum + scoreCents(value), 0), 1000);
  assert.equal(visibleLatinDigits(`${rows.reduce((sum, value) => sum + value, 0).toFixed(2)} / \u0661\u0660`), '10.00 / 10');
  const added = [...rows, 0];
  assert.deepEqual(distributeAutomatically(10, added.length), [2.5, 2.5, 2.5, 2.5]);
});

test('redrawn manual decimal inputs use the shared numeral adapter and numeric values', () => {
  const first = numericInput('\u0661.\u0662\u0665');
  const added = numericInput('\u06f2.\u06f7\u06f5');
  const list = {
    querySelectorAll: () => [first, added],
    set innerHTML(markup) { this.markup = markup; },
  };
  render(list, html`<input type="number"><input type="number">`);
  assert.equal(first.type, 'text');
  assert.equal(added.type, 'text');
  assert.equal(first.inputMode, 'decimal');
  assert.equal(first.dir, 'ltr');
  assert.equal(first.value, '1.25');
  assert.equal(added.value, '2.75');
  assert.equal((Number(first.value) + Number(added.value)).toFixed(2), '4.00');
  assert.equal(scoreCents(first.value) + scoreCents(added.value), 400);
  added.input('\u0663.\u0665\u0660');
  assert.equal(added.value, '3.50');
  assert.equal(added.checkValidity(), true);
  added.input('3.501');
  assert.equal(added.checkValidity(), false);
});

test('subitem redraw and both total updates pass through numeral-safe paths', async () => {
  const source = await readFile(new URL('../src/views/items.js', import.meta.url), 'utf8');
  assert.match(source, /render\(list, html`\$\{rows\.map\(rowMarkup\)\}`\)/);
  assert.match(source, /value="\$\{visibleLatinDigits\(row\.value\)\}"/);
  assert.equal((source.match(/\[data-subitem-total\]'\)\.textContent = visibleLatinDigits\(/g) ?? []).length, 2);
  assert.match(source, /\[data-subitem-value\]'\)\]\.some\(\(input\) => !input\.checkValidity\(\)\)/);
});
