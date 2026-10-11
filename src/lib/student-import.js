import { Papa, readSheet, unzipSync, strFromU8 } from './student-import-parsers.js';

export const IMPORT_LIMITS = Object.freeze({ bytes: 1024 * 1024, rows: 300, columns: 50, expandedBytes: 8 * 1024 * 1024 });
const fail = () => { throw new Error('IMPORT_INVALID'); };

// Reject oversized ZIP contents BEFORE the Excel reader allocates/decompresses them.
// ZIP64, encrypted entries and non-standard archives are intentionally unsupported.
export function validateXlsxArchive(buffer) {
  const view = new DataView(buffer);
  let end = view.byteLength - 22;
  const floor = Math.max(0, end - 65535);
  while (end >= floor && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < floor || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail();
  const entries = view.getUint16(end + 10, true);
  if (!entries || entries > 128 || view.getUint16(end + 8, true) !== entries) fail();
  let pos = view.getUint32(end + 16, true), total = 0;
  const directoryEnd = pos + view.getUint32(end + 12, true);
  if (directoryEnd !== end) fail();
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50 || (view.getUint16(pos + 8, true) & 1)) fail();
    const size = view.getUint32(pos + 24, true);
    total += size;
    if (total > IMPORT_LIMITS.expandedBytes) fail();
    pos += 46 + view.getUint16(pos + 28, true) + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
  }
  if (pos !== directoryEnd) fail();
}

export function parseCsv(text) {
  const parsed = Papa.parse(String(text).replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy', preview: IMPORT_LIMITS.rows + 2 });
  if (parsed.errors.some((error) => error.code !== 'UndetectableDelimiter')) fail();
  return validateRows(parsed.data);
}

export function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > IMPORT_LIMITS.rows + 1) fail();
  if (rows.some((row) => !Array.isArray(row) || row.length > IMPORT_LIMITS.columns || row.some((cell) => typeof cell === 'string' && cell.length > 500))) fail();
  return rows;
}

export async function readStudentFile(file) {
  if (!file || file.size === 0 || file.size > IMPORT_LIMITS.bytes) fail();
  if (/\.csv$/i.test(file.name)) {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return parseCsv(text);
  }
  if (!/\.xlsx$/i.test(file.name)) fail();
  const buffer = await file.arrayBuffer();
  validateXlsxArchive(buffer);
  const contents = unzipSync(new Uint8Array(buffer));
  for (const [path, bytes] of Object.entries(contents)) {
    if (!/\.xml$/i.test(path)) continue;
    const xml = strFromU8(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail();
    if (!/^xl\/worksheets\/[^/]+\.xml$/i.test(path)) continue;
    let rowCount = 0, cellCount = 0;
    for (const [tag] of xml.matchAll(/<(?:\w+:)?(?:row|c)\b[^>]*>/g)) {
      const isRow = /^<(?:\w+:)?row\b/.test(tag);
      if (isRow ? ++rowCount > IMPORT_LIMITS.rows + 1 : ++cellCount > (IMPORT_LIMITS.rows + 1) * IMPORT_LIMITS.columns) fail();
      const reference = /\br\s*=\s*["']([^"']*)["']/.exec(tag)?.[1];
      if (!reference) continue;
      if (isRow) {
        if (!/^\d+$/.test(reference) || Number(reference) > IMPORT_LIMITS.rows + 1) fail();
      } else {
        const address = /^([A-Z]+)(\d+)$/.exec(reference);
        if (!address || Number(address[2]) > IMPORT_LIMITS.rows + 1) fail();
        const column = [...address[1]].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
        if (column > IMPORT_LIMITS.columns) fail();
      }
    }
  }
  // Universal is the maintained browser-compatible, worker-free entry point.
  // Small bounded inputs keep this fully bundled without worker URLs or CDN calls.
  return validateRows(await readSheet(buffer, 1));
}

const nameKey = (value) => String(value ?? '').normalize('NFC').replace(/[\s\u0640\u064B-\u065F\u0670]/g, '').toLowerCase();
const validName = (value) => typeof value === 'string' && value.replace(/\s+/g, ' ').trim().length >= 2 && value.replace(/\s+/g, ' ').trim().length <= 80 &&
  /\p{L}/u.test(value) && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD\u200B-\u200F\u202A-\u202E\u2066-\u2069]/.test(value) && !/^[=+@-]/.test(value.trim());

const headerKey = (value) => String(value ?? '').normalize('NFKC')
  .replace(/[\s\u0640\u064B-\u065F\u0670\/\\_-]/g, '').toLowerCase();
export const isStudentNameHeader = (value) => /^(?:اسم|الاسم|الأسماء|اسمالطالب|اسمالطالبة|اسمالطلاب|اسمالطالبات|اسماءالطلاب|name|studentname)$/.test(headerKey(value));

// Official school exports often put the heading on the SECOND row after a title.
// Detect it near the top rather than assuming row one is the only header.
export function detectStudentNameColumn(rows) {
  for (const row of rows.slice(0, 12)) {
    const column = row.findIndex(isStudentNameHeader);
    if (column >= 0) return column;
  }
  return 0;
}

export function previewStudentRows(rows, column, hasHeader, roster) {
  const heading = rows.findIndex((row, i) => i < 12 && isStudentNameHeader(row?.[column]));
  const firstDataRow = heading >= 0 ? heading + 1 : hasHeader ? 1 : 0;
  const data = rows.slice(firstDataRow);
  if (data.length > IMPORT_LIMITS.rows) fail();
  const existing = new Map(), seen = new Map();
  for (const student of roster) {
    const key = nameKey(student.name);
    existing.set(key, (existing.get(key) ?? 0) + 1);
  }
  // Empty cells and repeated heading rows are layout, not invalid students.
  const candidates = data.map((row, index) => {
    const value = row[column];
    const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return { row: firstDataRow + index + 1, name };
  }).filter((entry) => entry.name && !isStudentNameHeader(entry.name));
  for (const entry of candidates) {
    if (!validName(entry.name)) continue;
    const key = nameKey(entry.name);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const counts = { new: 0, existing: 0, invalid: 0, ambiguous: 0 };
  const entries = candidates.map((entry) => {
    const key = nameKey(entry.name);
    const status = !validName(entry.name) ? 'invalid'
      : (existing.get(key) > 1 || seen.get(key) > 1) ? 'ambiguous'
      : existing.has(key) ? 'existing' : 'new';
    counts[status]++;
    return { ...entry, status };
  });
  return { counts, entries, names: entries.filter((entry) => entry.status === 'new').map((entry) => entry.name) };
}

export function importContext(workspace, teaching, authenticatedUserId) {
  const allowed = workspace?.type === 'demo' ? workspace.ownershipState === 'demo' :
    workspace?.type === 'account' && workspace.ownershipState === 'claimed' && workspace.authUserId === authenticatedUserId;
  if (!allowed || !teaching || teaching.status === 'archived' || teaching.deleted) return null;
  return JSON.stringify([workspace.id, workspace.databaseName, workspace.type, workspace.authUserId, teaching.id, teaching.sectionId]);
}

// No write for cancellation, account/context drift, roster drift, or a no-op.
// The write callback receives only names explicitly seen as NEW in the preview.
export async function confirmStudentImport({ approved, preview, currentPreview, expectedContext, currentContext, write }) {
  if (!approved || !expectedContext || currentContext !== expectedContext || !preview?.names.length) return { added: 0 };
  if (JSON.stringify(preview.entries) !== JSON.stringify(currentPreview.entries)) throw new Error('IMPORT_CHANGED');
  return write([...preview.names]);
}
