import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import hub from '../src/views/reports-index.js';
import execution from '../src/views/execution-report.js';
import { reportContext } from './n09-report-harness-20261023/fixture.mjs';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), getElementById: () => null,
};
global.matchMedia = () => ({ matches: false });

test('N70 accepted V2.2 normal and archive routes keep their distinct labels and print/CSV actions', async () => {
  try {
    const { year, term, save } = await reportContext();
    await save({
      sections: [{ id: 'n70-v21-section', yearId: year.id, grade: 4, section: 'أ' }],
      subjects: [{ id: 'n70-v21-subject', name: 'رياضيات' }],
      teachings: [{ id: 'n70-v21-teaching', sectionId: 'n70-v21-section', subjectId: 'n70-v21-subject', termId: term.id }],
      sessions: [{ id: 'n70-v21-session', teachingId: 'n70-v21-teaching', date: '2026-09-08', period: 1, startTime: '08:00', endTime: '08:45' }],
    });

    const hubMarkup = String(hub.render());
    assert.match(hubMarkup, /id="aggregate-reports-title">تقارير جميع الفصول<\/h2>/);
    assert.ok(hubMarkup.indexOf('تقارير الفصول') < hubMarkup.indexOf('تقارير جميع الفصول'));

    execution.beforeRender({});
    const normal = String(execution.render());
    assert.equal(execution.title(), 'الحصص والحضور');
    assert.equal(execution.subtitle(), '1470–1471 هـ');
    assert.match(normal, /report-workspace__eyebrow">تقارير جميع الفصول/);
    assert.match(normal, /<h2>الحصص والحضور<\/h2>/);
    assert.match(normal, /استعرض الحصص وحالة رصد الحضور عبر الفصول، مع إمكانية التصفية والطباعة\./);
    assert.match(normal, /تقرير الحصص والحضور/);
    assert.match(normal, /execution-report-head-actions[\s\S]*data-act="print"[\s\S]*طباعة التقرير/);
    assert.equal((normal.match(/data-act="print"/g) || []).length, 1);
    // D-100 V2.2: normal CSV moved beside top print; archive stays below.
    assert.match(normal, /execution-report-head-actions[\s\S]*data-act="print"[\s\S]*data-act="csv"/);
    assert.equal((normal.match(/data-act="csv"/g) || []).length, 1);
    assert.doesNotMatch(normal, /class="btn-row mt-6 noprint report-actions"/);

    execution.beforeRender({ yearId: year.id, termId: term.id });
    const archived = String(execution.render());
    assert.equal(execution.title(), 'تقارير التنفيذ');
    assert.equal(execution.subtitle(), '1470–1471 هـ');
    assert.match(archived, /تقرير تنفيذ الحصص/);
    assert.match(archived, /report-workspace__eyebrow">تقرير مجمّع/);
    assert.match(archived, /<h2>تنفيذ الحصص<\/h2>/);
    assert.match(archived, /report-actions[\s\S]*data-act="print"[\s\S]*طباعة/);
    assert.equal((archived.match(/data-act="print"/g) || []).length, 1);
    assert.match(archived, /report-actions[\s\S]*data-act="print"[\s\S]*data-act="csv"/);
    assert.equal((archived.match(/data-act="csv"/g) || []).length, 1);
    assert.doesNotMatch(archived, /execution-report-head-actions/);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('N70 retains reviewed filters, empty guard and confirmation with the documented named print helper', () => {
  const path = 'src/views/execution-report.js';
  const source = readFileSync(new URL('../src/views/execution-report.js', import.meta.url), 'utf8');
  const baseline = execFileSync('git', ['show', `56998eff75a14120065d9802e575847dcc270b8f:${path}`], { encoding: 'utf8' });
  const between = (text, start, end) => {
    assert.ok(text.includes(start) && text.indexOf(end) > text.indexOf(start), `${start} / ${end}`);
    return text.slice(text.indexOf(start), text.indexOf(end)).replace(/\r\n/g, '\n');
  };
  assert.equal(between(source, 'function scoped()', 'function emptyExecutionNotice()'), between(baseline, 'function scoped()', 'function emptyExecutionNotice()'));
  assert.equal(between(source, 'function emptyExecutionNotice()', 'function contextLabel('), between(baseline, 'function emptyExecutionNotice()', 'function contextLabel('));
  // N24's named print helper changed only the final print call (35b4ccc).
  // Keep every filter, confirmation, cancellation and profile/device assertion.
  const currentPrint = between(source, '    async print() {', '    async identity() {');
  const namedPrint = "printReport(archiveRoute ? 'تقرير تنفيذ الحصص' : 'تقرير الحصص والحضور');";
  assert.equal(currentPrint.split(namedPrint).length, 2);
  assert.equal(currentPrint.replace(namedPrint, 'window.print();'),
    between(baseline, '    async print() {', '    async identity() {'));
  assert.match(source, /if \(!filters\(scoped\(\)\)\.length\) \{ await emptyExecutionNotice\(\); return; \}/);
  assert.match(source, /prePrintConfirmationSheet\(\{ profile: store\.state\.profile, device: store\.state\.device \}\)/);
});
