import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateControlBounds, normalizeDateTimeDigits, validDateTimeValue } from '../src/lib/rakeez-datetime-values.js';

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

test('each date scope intersects the Product floor with its existing bounds', () => {
  const today = new Date(2026, 9, 4);
  assert.deepEqual(dateControlBounds('planning', '', '', today),
    { min: '2026-08-01', max: '2027-12-31', years: [2026, 2027] });
  assert.deepEqual(dateControlBounds('historical', '', '', today),
    { min: '2026-08-01', max: '2026-10-04', years: [2026] });
  assert.deepEqual(dateControlBounds('historical', '2026-09-01', '2026-09-30', today),
    { min: '2026-09-01', max: '2026-09-30', years: [2026] });
  assert.deepEqual(dateControlBounds('session', '2026-09-01', '2026-10-03', today),
    { min: '2026-09-01', max: '2026-10-03', years: [2026] });
  assert.deepEqual(dateControlBounds('planning', '', '', new Date(2027, 0, 1)),
    { min: '2026-08-01', max: '2028-12-31', years: [2026, 2027, 2028] });
  assert.deepEqual(dateControlBounds('session', '2027-02-01', '2027-02-28', today),
    { min: '2027-02-01', max: '2027-02-28', years: [2027] });
  assert.deepEqual(dateControlBounds('session', '2025-09-01', '2025-12-31', today),
    { min: '2026-08-01', max: '2025-12-31', years: [] });
  assert.throws(() => dateControlBounds('unknown', '', '', today));
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
    for (const [markup, kind] of controls) if (kind === 'date') {
      const scope = name === 'sessions.js' ? 'session' : name === 'reports.js' ? 'historical' : 'planning';
      assert.match(markup, new RegExp(`data-rakeez-date-scope="${scope}"`), `${name} date scope`);
    }
    if (want.date || want.time) assert.match(source, /import '\.\.\/lib\/rakeez-datetime\.js'/, `${name} loads adapter`);
  }
});

test('N38 runtime uses repository-local browser assets and preloads them offline', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const adapter = readFileSync(join(root, 'src/lib/rakeez-datetime.js'), 'utf8');
  const style = readFileSync(join(root, 'src/styles/rakeez-datetime.css'), 'utf8');
  const worker = readFileSync(join(root, 'sw.js'), 'utf8');
  assert.doesNotMatch(adapter, /\b(?:import|from)\s*['"]flatpickr(?:\/|['"])/);
  assert.doesNotMatch(style, /@import\s*['"]flatpickr(?:\/|['"])/);
  for (const asset of ['flatpickr.min.js', 'ar.js', 'flatpickr.min.css']) {
    assert.ok(readFileSync(join(root, 'src/vendor/flatpickr', asset)).length > 0, `${asset} is present`);
    assert.match(worker, new RegExp(`\\./src/vendor/flatpickr/${asset.replace('.', '\\.')}['"]`));
  }
  assert.match(adapter, /import '\.\.\/vendor\/flatpickr\/flatpickr\.min\.js';\s*import '\.\.\/vendor\/flatpickr\/ar\.js';/);
  assert.match(style, /@import '(?:\.\.\/vendor|\/src\/vendor)\/flatpickr\/flatpickr\.min\.css';/);
  assert.match(readFileSync(join(root, 'src/vendor/flatpickr/LICENSE.md'), 'utf8'), /MIT License/);
});

test('picker shows Arabic 12-hour periods and ASCII numeric subcontrols while keeping canonical 24-hour values', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const adapter = readFileSync(join(root, 'src/lib/rakeez-datetime.js'), 'utf8');
  const style = readFileSync(join(root, 'src/styles/rakeez-datetime.css'), 'utf8');
  assert.match(adapter, /amPM: \['صباحًا', 'مساءً'\]/);
  assert.match(adapter, /dateFormat: kind === 'date' \? 'Y-m-d' : 'H:i'/);
  assert.match(adapter, /time_24hr: false/);
  assert.match(adapter, /\.calendarContainer\.querySelectorAll\('\.numInput, \.flatpickr-day'\)/);
  assert.match(adapter, /onDayCreate:.*useAsciiPickerNumerals\(day\)/);
  assert.match(adapter, /element\.lang = 'en'/);
  assert.match(adapter, /element\.dir = 'ltr'/);
  assert.match(adapter, /event\.target\.value = normalizeDateTimeDigits\(event\.target\.value\)/);
  assert.match(style, /\.flatpickr-calendar \.flatpickr-day\s*\{[^}]*font-family: Arial, sans-serif/s);
  assert.match(adapter, /syncVisibleYears\(instance, bounds\)/);
  assert.match(adapter, /select\.replaceChildren\(\.\.\.visible\.map/);
  assert.match(style, /\.rakeez-year-input-hidden\s*\{\s*display: none;/);
});

test('clock CSS places minute right of hour and the separate period at the left without changing bindings', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const style = readFileSync(join(root, 'src/styles/rakeez-datetime.css'), 'utf8');
  const adapter = readFileSync(join(root, 'src/lib/rakeez-datetime.js'), 'utf8');
  assert.match(style, /\.flatpickr-calendar \.flatpickr-time\s*\{\s*direction: rtl;\s*\}/);
  assert.match(style, /\.flatpickr-calendar \.flatpickr-time > \.numInputWrapper:nth-child\(3\)\s*\{\s*order: 0;\s*\}/);
  assert.match(style, /\.flatpickr-calendar \.flatpickr-time \.flatpickr-time-separator\s*\{\s*order: 1;\s*\}/);
  assert.match(style, /\.flatpickr-calendar \.flatpickr-time > \.numInputWrapper:first-child\s*\{\s*order: 2;\s*\}/);
  assert.match(style, /\.flatpickr-calendar \.flatpickr-time \.flatpickr-am-pm\s*\{\s*order: 3;\s*\}/);
  assert.match(adapter, /dateFormat: kind === 'date' \? 'Y-m-d' : 'H:i'/);
  assert.match(adapter, /time_24hr: false/);
  assert.doesNotMatch(adapter, /\.hourElement\s*=|\.minuteElement\s*=/);
  assert.equal(validDateTimeValue('10:45', 'time'), true);
  assert.equal(validDateTimeValue('22:45', 'time'), true);
});
