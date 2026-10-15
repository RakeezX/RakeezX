import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BETA_ACCESS_LABEL,
  PROFILE_STATUS,
  completeProfile,
  getAccountPresentation,
  isValidSaudiMobile,
  normalizeAccountContract,
  normalizeAuthEmail,
  normalizeSaudiMobile,
  provisionAccount,
  teacherAddress,
  validateAuthEmailChange,
  validateProfileCompletion,
} from '../src/lib/account-profile.js';
import { prePrintConfirmationSheet, reportHeader, reportSignatures } from '../src/lib/report-print.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const authUser = Object.freeze({ id: OWNER, email: 'teacher@example.test' });
const raw = (overrides = {}) => ({
  ownerId: OWNER,
  profileStatus: 'READY',
  profile: { teacherName: 'معلم', phone: '0500000000', schoolName: '', teacherForm: 'masculine' },
  access: { grantType: 'beta_full', status: 'active', source: 'public_beta', expiresAt: null },
  ...overrides,
});

test('legacy profile defaults teacher form to masculine without changing access', () => {
  const contract = normalizeAccountContract(raw({ profile: { teacherName: 'معلم', phone: '', schoolName: '' } }), authUser);
  assert.equal(contract.profile.teacherForm, 'masculine');
  assert.equal(contract.profile.educationDepartment, null);
  assert.equal(teacherAddress(contract.profile.teacherForm), 'أستاذ');
  assert.equal(contract.access.label, BETA_ACCESS_LABEL);
  assert.equal(contract.profileStatus, PROFILE_STATUS.READY);
});

test('account contract exposes the durable department without changing provisioning status', () => {
  const department = 'إدارة التعليم بمحافظة الطائف';
  const contract = normalizeAccountContract(raw({ profile: { ...raw().profile, educationDepartment: department } }), authUser);
  assert.equal(contract.profile.educationDepartment, department);
  assert.equal(contract.profileStatus, PROFILE_STATUS.READY);
});

test('feminine form persists in the account contract and affects addressing only', () => {
  const masculine = normalizeAccountContract(raw(), authUser);
  const feminine = normalizeAccountContract(raw({
    profile: { teacherName: 'معلمة', phone: '0500000000', schoolName: '', teacherForm: 'feminine' },
  }), authUser);
  assert.equal(feminine.profile.teacherForm, 'feminine');
  assert.equal(teacherAddress(feminine.profile.teacherForm), 'أستاذة');
  assert.deepEqual(feminine.access, masculine.access);
});

test('central account presentation covers masculine and feminine labels without changing generic branding', () => {
  assert.deepEqual(getAccountPresentation('masculine'), {
    teacherLabel: 'المعلم', teacherNameLabel: 'اسم المعلم', teacherHonorific: 'أستاذ',
    teacherSubjectLabel: 'معلم المادة', principalLabel: 'المدير', principalNameLabel: 'اسم المدير',
    schoolPrincipalLabel: 'مدير المدرسة',
  });
  assert.deepEqual(getAccountPresentation('feminine'), {
    teacherLabel: 'المعلمة', teacherNameLabel: 'اسم المعلمة', teacherHonorific: 'أستاذة',
    teacherSubjectLabel: 'معلمة المادة', principalLabel: 'المديرة', principalNameLabel: 'اسم المديرة',
    schoolPrincipalLabel: 'مديرة المدرسة',
  });

  const profile = { teacherName: 'نورة', schoolName: 'مدرسة الاختبار', teacherForm: 'feminine' };
  const printable = `${reportHeader({ title: 'اختبار', profile })}${reportSignatures({ profile })}${prePrintConfirmationSheet({ profile })}`;
  assert.match(printable, /المعلمة/);
  assert.match(printable, /اسم المعلمة/);
  assert.match(printable, /معلمة المادة/);
  assert.match(printable, /اسم المديرة/);
  assert.match(printable, /رَكيز/);
  assert.match(printable, /<h2 class="printhead__title">اختبار<\/h2>/);
  assert.match(printable, /<dt>المدرسة<\/dt><dd>مدرسة الاختبار<\/dd>/);
  assert.match(printable, /<span>معلمة المادة<\/span><strong>نورة<\/strong>/);
});

test('email is always taken from authenticated identity, never profile payload', () => {
  const contract = normalizeAccountContract({ ...raw(), email: 'forged@example.test' }, authUser);
  assert.equal(contract.email, authUser.email);
  assert.equal('email' in contract.profile, false);
});

test('Saudi mobile and teacher name are required while school remains optional', () => {
  assert.deepEqual(validateProfileCompletion({ teacherName: '', phone: '', schoolName: '' }).missing,
    ['teacherName', 'phone']);
  const valid = validateProfileCompletion({ teacherName: ' معلمة ', phone: ' ٠٥٠٠٠٠٠٠٠٠ ', teacherForm: 'feminine' });
  assert.equal(valid.valid, true);
  assert.equal(valid.profile.schoolName, '');
  assert.equal(valid.profile.teacherName, 'معلمة');
  assert.equal(valid.profile.phone, '0500000000');
});

test('Saudi mobile normalization keeps ten digits and rejects invalid values', () => {
  assert.equal(normalizeSaudiMobile('٠٥١٢٣٤٥٦٧٨'), '0512345678');
  assert.equal(normalizeSaudiMobile('۰۵۱۲۳۴۵۶۷۸'), '0512345678');
  assert.equal(normalizeSaudiMobile('05ab1234567899'), '0512345678');
  assert.equal(isValidSaudiMobile('0512345678'), true);
  assert.equal(isValidSaudiMobile('05123456789'), false);
  assert.equal(isValidSaudiMobile('0412345678'), false);
  assert.equal(isValidSaudiMobile('05letters12'), false);
  assert.deepEqual(validateProfileCompletion({ teacherName: 'معلم', phone: '0412345678' }).invalid, ['phone']);
});

test('Auth email change validation normalizes safely and rejects invalid or unchanged values', () => {
  assert.equal(normalizeAuthEmail('  NEW.Teacher@Example.TEST  '), 'new.teacher@example.test');
  assert.deepEqual(validateAuthEmailChange('not-an-email', 'teacher@example.test'), {
    valid: false, code: 'INVALID_EMAIL', email: 'not-an-email',
  });
  assert.deepEqual(validateAuthEmailChange(' TEACHER@example.test ', 'teacher@example.test'), {
    valid: false, code: 'EMAIL_UNCHANGED', email: 'teacher@example.test',
  });
  assert.deepEqual(validateAuthEmailChange('new@example.test', 'teacher@example.test'), {
    valid: true, code: null, email: 'new@example.test',
  });
});

test('provisioning is delegated to the fixed server contract and normalizes beta access', async () => {
  let calls = 0;
  const api = {
    user: authUser,
    provisionAccountProfile: async () => { calls += 1; return raw({ profileStatus: 'PENDING_PROFILE' }); },
  };
  assert.equal((await provisionAccount({ api })).profileStatus, PROFILE_STATUS.PENDING);
  assert.equal((await provisionAccount({ api })).access.label, BETA_ACCESS_LABEL);
  assert.equal(calls, 2);
});

test('completion rejects missing phone and submits normalized feminine profile', async () => {
  const api = { user: authUser, completeAccountProfile: async (profile) => raw({ profile }) };
  await assert.rejects(() => completeProfile({ teacherName: 'معلمة', phone: '' }, { api }),
    { code: 'PROFILE_REQUIRED_FIELDS_MISSING' });
  const completed = await completeProfile({
    teacherName: ' معلمة ', phone: ' 0500000000 ', teacherForm: 'feminine', schoolName: '',
  }, { api });
  assert.equal(completed.profile.teacherForm, 'feminine');
  assert.equal(completed.profile.phone, '0500000000');
});

test('cross-account contract is rejected before presentation', () => {
  assert.throws(() => normalizeAccountContract({ ...raw(), ownerId: '22222222-2222-4222-8222-222222222222' }, authUser),
    { code: 'ACCOUNT_CONTRACT_OWNER_MISMATCH' });
});
