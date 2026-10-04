import directory from '../data/education-departments-2026-09-30.json' with { type: 'json' };
import options from '../data/education-department-options-2026-09-30.json' with { type: 'json' };

// Dated Work snapshot with the approved Mahd spelling correction. A future refresh requires a separate Product decision.
export const EDUCATION_DEPARTMENTS = Object.freeze(directory);
// Explicit 47-row UX mapping. The official directory remains the persistence authority.
export const EDUCATION_DEPARTMENT_OPTIONS = Object.freeze(options.map((entry) => Object.freeze(entry)));
export function normalizeDepartmentSearch(value) {
  return String(value ?? '').normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase('ar');
}

export function searchEducationDepartments(directory, query) {
  const needle = normalizeDepartmentSearch(query).trim();
  return directory.filter((entry) => {
    const names = typeof entry === 'string' ? [entry] : [entry.shortLabel, entry.canonicalName];
    return names.some((name) => normalizeDepartmentSearch(name).includes(needle));
  });
}

export function isOfficialEducationDepartment(directory, value) {
  return typeof value === 'string' && directory.includes(value);
}
