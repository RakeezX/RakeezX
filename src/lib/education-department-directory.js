import directory from '../data/education-departments-2026-09-30.json' with { type: 'json' };

// Dated Work snapshot with the approved Mahd spelling correction. A future refresh requires a separate Product decision.
export const EDUCATION_DEPARTMENTS = Object.freeze(directory);
export function normalizeDepartmentSearch(value) {
  return String(value ?? '').normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase('ar');
}

export function searchEducationDepartments(directory, query) {
  const needle = normalizeDepartmentSearch(query).trim();
  return directory.filter((name) => normalizeDepartmentSearch(name).includes(needle));
}

export function isOfficialEducationDepartment(directory, value) {
  return typeof value === 'string' && directory.includes(value);
}
