import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EDUCATION_DEPARTMENTS, isOfficialEducationDepartment, searchEducationDepartments } from '../src/lib/education-department-directory.js';
import { decodeSyncV2Canonical, encodeSyncV2Patch } from '../src/lib/sync-v2.js';

const directory = JSON.parse(await readFile(new URL('../review/n03/official-departments-2026-09-30.json', import.meta.url)));
const sourceTypo = 'إدرة التعليم بمحافظة مهد الذهب';
const correctedName = 'إدارة التعليم بمحافظة مهد الذهب';
const correctedDirectory = directory.map((name) => name === sourceTypo ? correctedName : name);

test('the packaged directory corrects only the Mahd source typo among 47 unique names', () => {
  assert.equal(directory.length, 47);
  assert.equal(new Set(directory).size, 47);
  assert.ok(directory.every((name) => typeof name === 'string' && name.trim() === name && name.length));
  assert.equal(directory.filter((name) => name === sourceTypo).length, 1);
  assert.equal(new Set(correctedDirectory).size, 47);
  assert.deepEqual(EDUCATION_DEPARTMENTS, correctedDirectory);
});

test('migration catalog matches the packaged exact-name directory', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261003000000_n03_education_department.sql', import.meta.url), 'utf8');
  const rows = [...sql.matchAll(/^  \('([^']+)'\)[,\n]/gm)].map((match) => match[1]);
  assert.deepEqual(rows, correctedDirectory);
});

test('search folds Arabic spelling while preserving exact display names', () => {
  const results = searchEducationDepartments(directory, 'ادارة التعليم بمحافظة الطائف');
  assert.equal(results.length, 1);
  assert.equal(results[0], 'إدارة التعليم بمحافظة الطائف');
  assert.ok(isOfficialEducationDepartment(directory, results[0]));
  assert.ok(isOfficialEducationDepartment(EDUCATION_DEPARTMENTS, correctedName));
  assert.equal(isOfficialEducationDepartment(EDUCATION_DEPARTMENTS, sourceTypo), false);
});

test('empty query exposes the whole directory and unmatched query is empty', () => {
  assert.deepEqual(searchEducationDepartments(directory, ''), directory);
  assert.deepEqual(searchEducationDepartments(directory, 'لا توجد إدارة بهذا الاسم'), []);
});

test('Sync V2 profile patch and canonical record round-trip a selection and clearing', () => {
  const chosen = directory[3];
  assert.deepEqual(encodeSyncV2Patch('profile', { educationDepartment: chosen }), { education_department: chosen });
  assert.equal(decodeSyncV2Canonical('profile', { education_department: chosen }).educationDepartment, chosen);
  assert.deepEqual(encodeSyncV2Patch('profile', { educationDepartment: null }), { education_department: null });
  assert.equal(decodeSyncV2Canonical('profile', { education_department: null }).educationDepartment, null);
  assert.equal('profile_status' in encodeSyncV2Patch('profile', { profileStatus: 'READY' }), false);
});
