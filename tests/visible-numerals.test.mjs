import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { visibleLatinDigits } from '../src/lib/visible-numerals.js';
import { sanitizeExportText, toCSV } from '../src/lib/export.js';
import { formatRiyadhTime } from '../supabase/functions/support-notification-worker/core.mjs';
import { reportHeader } from '../src/lib/report-print.js';
import { schedulePrintDocument } from '../src/lib/schedule-export.js';

test('presentation digits normalize both Arabic numeral blocks without changing the source', () => {
  const source = 'الصف ٤/ب، ۳ طلاب، ٠٩:۴۵';
  assert.equal(visibleLatinDigits(source), 'الصف 4/ب، 3 طلاب، 09:45');
  assert.equal(source, 'الصف ٤/ب، ۳ طلاب، ٠٩:۴۵');
  assert.equal(visibleLatinDigits(null), '');
});

test('CSV presentation normalizes cells while retaining Arabic text and escaping', () => {
  assert.equal(sanitizeExportText('الصف ٤\u200f'), 'الصف 4');
  assert.equal(toCSV([['اسم', '٤/أ'], ['"٣"', '۴،ب']]), 'اسم,4/أ\r\n"""3""",4،ب');
});

test('support notification Riyadh timestamp uses Latin numerals', () => {
  const output = formatRiyadhTime('2026-10-04T12:30:00.000Z');
  assert.match(output, /2026/);
  assert.doesNotMatch(output, /[\u0660-\u0669\u06f0-\u06f9]/);
});

test('report and schedule print boundaries normalize supplied display labels', () => {
  const header = String(reportHeader({ title: 'صف ٤', profile: { teacherName: 'معلم ۳' }, year: '١٤٤٨' }));
  assert.match(header, /صف 4/);
  assert.match(header, /معلم 3/);
  assert.match(header, /1448/);
  const document = schedulePrintDocument({
    title: 'جدول ٤', identity: { teacherForm: 'masculine' }, academic: { year: '١٤٤٨', term: 'فصل ۲' },
    timing: null, periods: [{ period: 1 }], days: [{ label: 'يوم ۳', periods: [{ teaching: { classLabel: '٤/أ', subjectLabel: 'فن ۵' }, time: null }] }],
  });
  assert.match(document, /جدول 4/);
  assert.match(document, /1448/);
  assert.match(document, /4\/أ/);
  assert.doesNotMatch(document, /[\u0660-\u0669\u06f0-\u06f9]/);
});

test('visible source has no native numeral literals or Arabic locale formatter without latn', async () => {
  const root = new URL('../src/', import.meta.url);
  const paths = [];
  async function visit(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await visit(new URL(`${entry.name}/`, folder), `${path}/`);
      else if (entry.name.endsWith('.js')) paths.push(path);
    }
  }
  await visit(root);
  const inputDigitLines = {
    'models.js': /\.replace\(/,
    'lib/dom.js': /\.replace\(/,
    'lib/account-profile.js': /\.replace\(/,
    'lib/avatar.js': /const clean =/,
    'lib/email-otp.js': /\.replace\(/,
    'lib/migrate.js': /\.replace\(/,
    'lib/subject-catalog.js': /(?:const (?:ARABIC|PERSIAN)_DIGITS|\.replace\()/,
    'views/grades.js': /raw\.replace\(/,
    'views/students.js': /(?:const isNumeric|name = name\.replace)/,
    'views/times.js': /(?:val|cur)\.replace\(/,
  };
  for (const path of paths) {
    const source = await readFile(new URL(path, root), 'utf8');
    const formatter = /(?:toLocale(?:String|DateString|TimeString)|new Intl\.(?:DateTimeFormat|NumberFormat))\(\s*['"`]ar(?:-[^'"`]+)?['"`]/g;
    for (const match of source.matchAll(formatter)) {
      const line = source.slice(0, match.index).split('\n').length;
      const context = source.split('\n').slice(line - 1, line + 3).join('\n');
      assert.match(context, /numberingSystem:\s*['"]latn['"]|-u-nu-latn/, `${path}:${line} lacks latn`);
    }
    {
      for (const [index, line] of source.split('\n').entries()) {
        if (/^(?:\*|\/\/|\/\*|\*\/)/.test(line.trimStart())) continue;
        const code = line.split('//')[0];
        if (inputDigitLines[path]?.test(code)) continue;
        assert.doesNotMatch(code, /[\u0660-\u0669\u06f0-\u06f9]/, `${path}:${index + 1}`);
      }
    }
  }
  const edge = await readFile(new URL('../supabase/functions/support-notification-worker/core.mjs', import.meta.url), 'utf8');
  assert.match(edge, /new Intl\.DateTimeFormat\('ar-SA-u-ca-gregory',\s*\{[^}]*numberingSystem:\s*'latn'/);
});
