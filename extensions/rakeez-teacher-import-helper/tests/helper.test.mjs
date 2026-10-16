import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { isOfficialUrl, parsePastedTable, reviewNames, namesCsv } from '../core.js';
import { readSelectedNameColumn } from '../selection.js';
import { parseCsv, previewStudentRows } from '../../../src/lib/student-import.js';

const mixed = 'رقم الهوية\tاسم الطالب\tالهاتف\tالدرجة\tالحضور\n1234567890\tأحمد محمد سالم\t0551234567\t99\tغائب\n2222222222\tعبد الرحمن عبدالله علي\t0552222222\t87\tحاضر';
test('mixed Arabic TSV produces exactly one N12 names column and no sensitive values', () => {
  const result = reviewNames(parsePastedTable(mixed));
  const csv = namesCsv(result.names);
  assert.equal(csv, '\uFEFFاسم الطالب\r\n"أحمد محمد سالم"\r\n"عبد الرحمن عبدالله علي"\r\n');
  assert.doesNotMatch(csv, /123|055|99|87|غائب|حاضر/);
  const preview = previewStudentRows(parseCsv(csv), 0, true, []);
  assert.deepEqual(preview.names, result.names);
  assert.deepEqual(preview.counts, { new: 2, existing: 0, invalid: 0, ambiguous: 0 });
});
test('ambiguous, empty, duplicate, numbered, formula, phone/ID and oversized inputs fail closed', () => {
  for (const text of ['', 'الهاتف\n0551234567', 'اسم الطالب\tاسم الطالبة\nأحمد علي\tمحمد علي', 'اسم الطالب\tالدرجة\nأحمد علي']) assert.throws(() => parsePastedTable(text));
  for (const values of [[], [''], ['أحمد علي', 'أحمد  علي'], ['احمد علي', 'احـمد علي'], ['1. أحمد علي'], ['١ أحمد علي'], ['0551234567'], ['أحمد 99'], ['=محمد علي'], ['أحمد\u202Eعلي'], ['ع'.repeat(81)]]) assert.throws(() => reviewNames(values));
  assert.equal(reviewNames(['', 'عبد الرحمن محمد عبدالله عبدالرحمن أحمد علي سالم الحربي']).counts.empty, 1);
});
test('official origin allowlist rejects HTTP, lookalikes, Noor and nonstandard ports', () => {
  assert.equal(isOfficialUrl('https://madrasati.moe.gov.sa/teacher'), true);
  for (const url of ['http://madrasati.moe.gov.sa', 'https://madrasati.moe.gov.sa.evil.test', 'https://noor.moe.gov.sa', 'https://madrasati.moe.gov.sa:8443', 'https://user@madrasati.moe.gov.sa']) assert.equal(isOfficialUrl(url), false);
});

// Small synthetic semantic-table DOM, with traps on every non-name data cell.
function fixture({ merged = false, nested = false, hidden = false, children = false, cancelled = false } = {}) {
  const table = { parentElement: null, closest: () => table, querySelector: () => nested ? {} : null };
  function cell(text, index) {
    return { nodeType: 1, textContent: text, cellIndex: index, colSpan: 1, rowSpan: 1, children: [], parentElement: null, closest: selector => selector === 'table' ? table : null, getAttribute: () => null, getClientRects: () => [{}] };
  }
  function row(name, heading = false) {
    const cells = [cell(name, 0), cell('الدرجة', 1), cell('الهاتف', 2)];
    if (!heading) for (const c of cells.slice(1)) Object.defineProperty(c, 'textContent', { get() { throw new Error('SENSITIVE_CELL_READ'); } });
    const r = { cells, parentElement: table, getAttribute: () => null, getClientRects: () => [{}] };
    for (const c of cells) c.parentElement = r;
    return r;
  }
  table.rows = [row('اسم الطالب', true), row('أحمد محمد'), row('سالم عبدالله')];
  table.getAttribute = () => null;
  if (merged) table.rows[1].cells[1].colSpan = 2;
  if (hidden) table.rows[2].hidden = true;
  if (children) table.rows[1].cells[0].children = [{}];
  const header = table.rows[0].cells[0];
  const textNode = { parentElement: { closest: () => header } };
  return {
    location: { protocol: 'https:', port: '', hostname: 'madrasati.moe.gov.sa' },
    window: { getSelection: () => ({ isCollapsed: cancelled, rangeCount: 1, anchorNode: textNode, focusNode: textNode }) },
    getComputedStyle: () => ({ display: 'table-cell', visibility: 'visible', opacity: '1' })
  };
}
const extract = options => vm.runInNewContext(`(${readSelectedNameColumn.toString()})()`, fixture(options));
test('selection reads only chosen column; hidden rows never export', () => {
  assert.deepEqual(Array.from(extract().values), ['أحمد محمد', 'سالم عبدالله']);
  const hidden = extract({ hidden: true });
  assert.deepEqual(Array.from(hidden.values), ['أحمد محمد']); assert.equal(hidden.hiddenRows, 1);
});
test('selection cancellation, nested/merged cells and decorated name cells fail closed', () => {
  for (const option of ['merged', 'nested', 'children', 'cancelled']) assert.equal(extract({ [option]: true }).ok, false);
});

function popupHarness() {
  const elements = new Map(), outputs = [], calls = [], pendingTimers = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, disabled: false, listeners: {}, children: [], addEventListener(event, cb) { this.listeners[event] = cb; }, replaceChildren(...items) { this.children = items; }, append() {}, remove() {}, click() { outputs.push(this); } });
    return elements.get(id);
  };
  const create = tag => ({tag,children:[],listeners:{},setAttribute(){},addEventListener(event,fn){this.listeners[event]=fn;},append(...children){this.children.push(...children);},querySelector(selector){return this.children.find(c=>selector==='.include-name'?c.className==='include-name':c.type==='text');},click(){outputs.push(this);},remove(){}});
  const document = { getElementById: element, createElement:create, body: { append() {} } };
  const chrome = { tabs: { query: async () => { calls.push('query'); return [{ id: 7, url: 'https://madrasati.moe.gov.sa/' }]; } }, scripting: { executeScript: async options => { calls.push(options); return [{ result: { ok: true, values: ['أحمد محمد'], hiddenRows: 0 } }]; } } };
  const URLMock = { createObjectURL: blob => { calls.push(blob); return 'blob:local'; }, revokeObjectURL: url => calls.push(url) };
  const source = readFileSync(new URL('../popup.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(source, { document, chrome, URL: URLMock, Blob, setTimeout: fn => pendingTimers.push(fn), isOfficialUrl, parsePastedTable, reviewNames, namesCsv, readSelectedNameColumn });
  return { element, calls, outputs, pendingTimers };
}
test('no startup page read; click-only injection, manual review, one local download, cancellation', async () => {
  const h = popupHarness(); assert.equal(h.calls.length, 0);
  await h.element('selection').listeners.click();
  assert.equal(h.calls[0], 'query'); assert.equal(h.calls[1].world, 'ISOLATED');
  assert.deepEqual(Array.from(h.calls[1].target.frameIds), [0]);
  h.element('download').listeners.click(); assert.equal(h.outputs.length, 0);
  h.element('review').checked = true; h.element('review').listeners.change();
  h.element('download').listeners.click(); h.element('download').listeners.click();
  assert.equal(h.outputs.length, 1); assert.equal(h.outputs[0].href, 'blob:local');
  assert.deepEqual(new Uint8Array(await h.calls[2].arrayBuffer()), new TextEncoder().encode(namesCsv(['أحمد محمد'])));
  h.pendingTimers[0](); assert.equal(h.calls[3], 'blob:local');
  h.element('table').value = mixed; h.element('paste').listeners.click();
  assert.equal(h.element('table').value, '');
  h.element('cancel').listeners.click(); h.element('review').checked = true; h.element('download').listeners.click();
  assert.equal(h.outputs.length, 1); assert.equal(h.element('names').children.length, 0);
});
test('cancel or pasted input during asynchronous page read discards stale result', async () => {
  const h = popupHarness(); const reading = h.element('selection').listeners.click();
  h.element('cancel').listeners.click(); await reading;
  assert.equal(h.element('names').children.length, 0);
  const reading2 = h.element('selection').listeners.click();
  h.element('table').listeners.input(); await reading2;
  assert.equal(h.element('names').children.length, 0);
});
test('MV3 source policy: explicit action, narrow receiver, session-only private handoff', () => {
  const dir = new URL('../', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage', 'alarms']);
  for (const key of ['content_scripts', 'host_permissions']) assert.equal(manifest[key], undefined);
  assert.deepEqual(manifest.externally_connectable,{matches:['https://rakeezx.com/*']});
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  for (const file of readdirSync(dir).filter(name => /\.js$/.test(name))) {
    const source = readFileSync(new URL(file, dir), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|chrome\.cookies|storage\.(local|sync)|localStorage|indexedDB/);
  }
});
