// AI: bounded local-file interpretation; never connects to a school portal.
import { readStudentFile, previewStudentRows, validateRows, isStudentNameHeader, validStudentImportName } from './student-import.js';
import { GRADES, normalizeSectionLabel } from '../models.js';
import { normalizeSubjectName, matchBuiltinSubject } from './subject-catalog.js';

const key = value => normalizeSubjectName(value).replace(/ /g, '');
const aliases = {
  grade: ['الصف', 'الصف الدراسي', 'grade'],
  label: ['الفصل', 'الشعبة', 'رمز الفصل', 'section', 'class'],
  subject: ['المادة', 'اسم المادة', 'المقرر', 'subject'],
  name: ['اسم الطالب', 'اسم الطالبة', 'الاسم', 'student name', 'name'],
};
export const readClassFile = readStudentFile;
export function detectClassColumns(rows) {
  let header = 0, mapping = {}, best = 0;
  rows.slice(0, 12).forEach((row, index) => {
    const found = Object.fromEntries(Object.entries(aliases).map(([field, names]) => {
      const matches = row.map((cell, i) => names.some(name => key(name) === key(cell)) ? i : -1).filter(i => i >= 0);
      return [field, matches.length === 1 ? matches[0] : -1];
    }));
    const score = Object.values(found).filter(i => i >= 0).length;
    if (score > best) { best = score; header = index; mapping = found; }
  });
  return { header, mapping: { grade: -1, label: -1, subject: -1, name: -1, ...mapping } };
}
// Names alone determine file mapping; class metadata always comes from Rakeez controls.
export function detectClassNameColumn(rows) {
  for (const [header, row] of rows.slice(0, 12).entries()) {
    const columns = row.map((cell, i) => isStudentNameHeader(cell) ? i : -1).filter(i => i >= 0);
    if (columns.length) return { header, mapping: { grade: -1, label: -1, subject: -1, name: columns.length === 1 ? columns[0] : -1 } };
  }
  // A one-column names-only file has no header. Preserve its first student.
  const single = rows.every(row => row.length === 1) && rows.some(row => validStudentImportName(row[0]));
  return { header: single ? -1 : 0, mapping: { grade: -1, label: -1, subject: -1, name: single ? 0 : -1 } };
}
export function classGrade(value) {
  const text = String(value ?? '').trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return GRADES.find(g => String(g.v) === text || key(g.label) === key(text))?.v ?? null;
}
export function classGroups(rows, { header = 0, mapping, manual = {}, schoolName = '' }) {
  validateRows(rows);
  const schoolColumn = rows[header]?.findIndex(cell => ['المدرسة', 'اسم المدرسة', 'school', 'school name'].some(name => key(name) === key(cell)));
  if (schoolColumn >= 0) {
    const schools = new Set(rows.slice(header + 1).map(row => key(row[schoolColumn])).filter(Boolean));
    if (schools.size > 1 || schools.size && (!schoolName || !schools.has(key(schoolName)))) {
      throw Error('مدرسة الملف لا تطابق مدرسة حسابك أو يحتوي الملف مدارس متعددة. راجع الملف والمدرسة في الإعدادات.');
    }
  }
  const columns = Object.values(mapping).filter(i => i >= 0);
  if (new Set(columns).size !== columns.length) throw Error('اختر عمودًا مختلفًا لكل حقل.');
  const groups = new Map();
  for (const [index, row] of rows.slice(header + 1).entries()) {
    if (row.every(cell => cell == null || String(cell).trim() === '')) continue;
    const read = field => String(mapping[field] >= 0 ? row[mapping[field]] ?? '' : manual[field] ?? '').trim();
    const rawGrade = read('grade'), grade = classGrade(rawGrade), label = read('label'), subject = read('subject');
    const subjectKey = matchBuiltinSubject(subject)?.key ?? normalizeSubjectName(subject);
    const id = JSON.stringify([grade ?? rawGrade, normalizeSectionLabel(label), subjectKey]);
    if (!groups.has(id)) groups.set(id, { id, grade, rawGrade, label, subject, rows: [] });
    groups.get(id).rows.push([mapping.name >= 0 ? read('name') : '', header + index + 2]);
  }
  return [...groups.values()].map(group => {
    const preview = previewStudentRows(group.rows.map(row => [row[0]]), 0, false, []);
    const error = !group.grade ? 'اختر صفًا معتمدًا؛ لا يمكن تخمين الصف.'
      : !group.label || group.label.length > 8 || !/^[\p{L}\p{N} ._-]+$/u.test(group.label) ? 'رمز الفصل مطلوب (حتى 8 أحرف أو أرقام).'
      : !subjectSafe(group.subject) ? 'اختر اسم مادة صالحًا (حتى 60 حرفًا).' : '';
    return { ...group, preview, error, fingerprint: JSON.stringify([group.id, group.rows]) };
  });
}
export const subjectSafe = value => !!value && value.length <= 60 && /\p{L}/u.test(value) && !/[<>\u0000-\u001f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(value) && !/^[=+@-]/.test(value);
