import { readStudentFile, validateXlsxArchive, IMPORT_LIMITS } from './student-import.js';
import { unzipSync, strFromU8 } from './student-import-parsers.js';

// N12's audited reader and limits remain unchanged. Grades add strict cell checks.
export async function readGradeFile(file) {
  if (!file || !file.size || file.size > IMPORT_LIMITS.bytes) throw new Error('GRADE_FILE_INVALID');
  if (/\.xlsx$/i.test(file?.name ?? '')) {
    const buffer = await file.arrayBuffer();
    validateXlsxArchive(buffer);
    const files = unzipSync(new Uint8Array(buffer));
    const xml = path => strFromU8(files[path] ?? new Uint8Array());
    const workbook = new DOMParser().parseFromString(xml('xl/workbook.xml'), 'application/xml');
    const relation = workbook.getElementsByTagNameNS('*', 'sheet')[0]?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rels = new DOMParser().parseFromString(xml('xl/_rels/workbook.xml.rels'), 'application/xml');
    const target = [...rels.getElementsByTagNameNS('*', 'Relationship')].find(r => r.getAttribute('Id') === relation)?.getAttribute('Target');
    const path = target?.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const sheet = new DOMParser().parseFromString(xml(path), 'application/xml');
    if (!target || sheet.getElementsByTagName('parsererror').length) throw new Error('GRADE_FILE_INVALID');
    const seen = new Set(), seenRows = new Set();
    for (const row of sheet.getElementsByTagNameNS('*', 'row')) {
      const address = row.getAttribute('r');
      if (!address || seenRows.has(address)) throw new Error('GRADE_DUPLICATE_ROW');
      seenRows.add(address);
    }
    for (const cell of sheet.getElementsByTagNameNS('*', 'c')) {
      const address = cell.getAttribute('r');
      if (!address || seen.has(address) || cell.getElementsByTagNameNS('*', 'f').length) throw new Error('GRADE_FORMULA_OR_DUPLICATE_CELL');
      seen.add(address);
    }
  }
  return readStudentFile(file);
}

export function gradeNumber(value) {
  if (value == null || typeof value === 'string' && !value.trim()) return null;
  if (value instanceof Date || !['string', 'number'].includes(typeof value)) throw new Error('GRADE_NUMBER_INVALID');
  const text = String(value).trim().replace(/[٠-٩۰-۹]/g, d => d >= '۰' ? d.charCodeAt(0) - 1776 : d.charCodeAt(0) - 1632).replace('٫', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('GRADE_NUMBER_INVALID');
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error('GRADE_NUMBER_INVALID');
  return number;
}
