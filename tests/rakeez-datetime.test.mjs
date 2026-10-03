import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDateTimeDigits, validDateTimeValue } from '../src/lib/rakeez-datetime-values.js';

test('Arabic-Indic and Persian typing/paste become ASCII without changing separators', () => {
  assert.equal(normalizeDateTimeDigits('٢٠٢٦-۰۹-٣٠'), '2026-09-30');
  assert.equal(normalizeDateTimeDigits('۰۷:٤٥'), '07:45');
  assert.equal(normalizeDateTimeDigits('2026-10-03'), '2026-10-03');
});

test('strict date/time strings and original min/max boundaries', () => {
  assert.equal(validDateTimeValue('2026-10-03', 'date', '2026-10-03', '2026-10-31'), true);
  assert.equal(validDateTimeValue('2026-10-31', 'date', '2026-10-03', '2026-10-31'), true);
  assert.equal(validDateTimeValue('2026-10-02', 'date', '2026-10-03'), false);
  assert.equal(validDateTimeValue('2026-11-01', 'date', '', '2026-10-31'), false);
  assert.equal(validDateTimeValue('2026-02-29', 'date'), false);
  assert.equal(validDateTimeValue('2024-02-29', 'date'), true);
  assert.equal(validDateTimeValue('2026-1-3', 'date'), false);
  assert.equal(validDateTimeValue('', 'date'), true); // required remains on the input
  assert.equal(validDateTimeValue('23:59', 'time'), true);
  assert.equal(validDateTimeValue('24:00', 'time'), false);
  assert.equal(validDateTimeValue('7:00', 'time'), false);
  assert.equal(validDateTimeValue('07:30', 'time', '07:30', '08:00'), true);
  assert.equal(validDateTimeValue('07:29', 'time', '07:30', '08:00'), false);
});

const viewDir = fileURLToPath(new URL('../src/views/', import.meta.url));
const expected = new Map([
  ['calendar.js', { date: 6, time: 0 }],
  ['sessions.js', { date: 2, time: 0 }],
  ['reports.js', { date: 2, time: 0 }],
  ['execution-report.js', { date: 2, time: 0 }],
  ['times.js', { date: 2, time: 4 }],
]);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(js|html)$/.test(entry.name) ? [path] : [];
  });
}

test('Product date/time controls use the central adapter and source guard', () => {
  for (const path of sourceFiles(fileURLToPath(new URL('../src/', import.meta.url)))) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\btype\s*=\s*["'](?:date|time|datetime-local)["']/i, `${path} bypasses RAKEEZ adapter`);
    assert.doesNotMatch(source, /\.type\s*=\s*["'](?:date|time|datetime-local)["']/i, `${path} assigns a native picker`);
  }
  for (const name of readdirSync(viewDir).filter((file) => file.endsWith('.js'))) {
    const source = readFileSync(join(viewDir, name), 'utf8');
    const controls = [...source.matchAll(/<input\b[^>]*data-rakeez-datetime="(date|time)"[^>]*>/gs)];
    const want = expected.get(name) ?? { date: 0, time: 0 };
    assert.equal(controls.filter((match) => match[1] === 'date').length, want.date, `${name} date coverage`);
    assert.equal(controls.filter((match) => match[1] === 'time').length, want.time, `${name} time coverage`);
    if (want.date || want.time) assert.match(source, /import '\.\.\/lib\/rakeez-datetime\.js'/, `${name} loads adapter`);
  }
});
