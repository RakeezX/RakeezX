import * as cloud from './cloud.js';
import { initialDepartmentCalendarPreset } from './education-department-directory.js';

export const PROFILE_STATUS = Object.freeze({ PENDING: 'PENDING_PROFILE', READY: 'READY' });
export const TEACHER_FORM = Object.freeze({ MASCULINE: 'masculine', FEMININE: 'feminine' });
export const BETA_ACCESS_LABEL = 'الوصول التجريبي';
export const SAUDI_MOBILE_PATTERN = /^05[0-9]{8}$/;
export const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedContract = null;

export function getAccountPresentation(form) {
  const feminine = form === TEACHER_FORM.FEMININE;
  return Object.freeze({
    teacherLabel: feminine ? 'المعلمة' : 'المعلم',
    teacherNameLabel: feminine ? 'اسم المعلمة' : 'اسم المعلم',
    teacherHonorific: feminine ? 'أستاذة' : 'أستاذ',
    teacherSubjectLabel: feminine ? 'معلمة المادة' : 'معلم المادة',
    principalLabel: feminine ? 'المديرة' : 'المدير',
    principalNameLabel: feminine ? 'اسم المديرة' : 'اسم المدير',
    schoolPrincipalLabel: feminine ? 'مديرة المدرسة' : 'مدير المدرسة',
  });
}

export function teacherAddress(form) {
  return getAccountPresentation(form).teacherHonorific;
}

export function normalizeSaudiMobile(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^0-9]/g, '')
    .slice(0, 10);
}

export function normalizeAuthEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function validateAuthEmailChange(value, currentEmail) {
  const email = normalizeAuthEmail(value);
  if (!email || email.length > 254 || !AUTH_EMAIL_PATTERN.test(email)) {
    return Object.freeze({ valid: false, code: 'INVALID_EMAIL', email });
  }
  if (email === normalizeAuthEmail(currentEmail)) {
    return Object.freeze({ valid: false, code: 'EMAIL_UNCHANGED', email });
  }
  return Object.freeze({ valid: true, code: null, email });
}

export function isValidSaudiMobile(value) {
  const normalized = String(value ?? '').trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return SAUDI_MOBILE_PATTERN.test(normalized);
}

export function validateProfileCompletion(profile = {}, { requireDepartment = false } = {}) {
  const teacherName = String(profile.teacherName ?? '').trim();
  const rawPhone = String(profile.phone ?? '').trim();
  const phone = normalizeSaudiMobile(rawPhone);
  const phoneValid = isValidSaudiMobile(rawPhone);
  const teacherForm = profile.teacherForm === TEACHER_FORM.FEMININE
    ? TEACHER_FORM.FEMININE
    : TEACHER_FORM.MASCULINE;
  const schoolName = String(profile.schoolName ?? '').trim();
  const educationDepartment = profile.educationDepartment ?? null;
  const departmentValid = !!initialDepartmentCalendarPreset(educationDepartment);
  return Object.freeze({
    valid: !!teacherName && phoneValid && (!requireDepartment || departmentValid),
    missing: Object.freeze([
      ...(!teacherName ? ['teacherName'] : []),
      ...(!phone ? ['phone'] : []),
      ...(requireDepartment && !educationDepartment ? ['educationDepartment'] : []),
    ]),
    invalid: Object.freeze([
      ...(phone && !phoneValid ? ['phone'] : []),
      ...(requireDepartment && educationDepartment && !departmentValid ? ['educationDepartment'] : []),
    ]),
    profile: Object.freeze({ teacherName, phone, teacherForm, schoolName,
      ...(departmentValid ? { educationDepartment } : {}) }),
  });
}

export function normalizeAccountContract(raw, authUser = cloud.user) {
  if (!raw || !authUser?.id || raw.ownerId !== authUser.id) {
    throw Object.assign(new Error('Account contract owner mismatch'), { code: 'ACCOUNT_CONTRACT_OWNER_MISMATCH' });
  }
  const form = raw.profile?.teacherForm === TEACHER_FORM.FEMININE
    ? TEACHER_FORM.FEMININE
    : TEACHER_FORM.MASCULINE;
  const access = raw.access?.grantType === 'beta_full' && raw.access?.status === 'active'
    ? Object.freeze({ ...raw.access, label: BETA_ACCESS_LABEL })
    : null;
  return Object.freeze({
    ownerId: authUser.id,
    email: String(authUser.email ?? ''),
    profileStatus: raw.profileStatus === PROFILE_STATUS.READY ? PROFILE_STATUS.READY : PROFILE_STATUS.PENDING,
    provisioning: raw.provisioning && ['PROFILE_REQUIRED', 'PROVISIONING_REQUIRED', 'PROVISIONING', 'READY']
      .includes(raw.provisioning.state) ? Object.freeze({
        state: raw.provisioning.state,
        version: Number(raw.provisioning.version ?? 0),
        foundationHash: raw.provisioning.foundationHash ?? null,
      }) : null,
    profile: Object.freeze({
      teacherName: String(raw.profile?.teacherName ?? ''),
      phone: String(raw.profile?.phone ?? ''),
      teacherForm: form,
      schoolName: String(raw.profile?.schoolName ?? ''),
      educationDepartment: raw.profile?.educationDepartment ?? null,
    }),
    access,
  });
}

export function currentAccountContract() {
  return cachedContract;
}

export async function refreshAccountContract({ api = cloud } = {}) {
  if (!api.session || !api.user) {
    cachedContract = null;
    return null;
  }
  cachedContract = normalizeAccountContract(await api.getAccountContract(), api.user);
  return cachedContract;
}

export async function provisionAccount({ api = cloud } = {}) {
  cachedContract = normalizeAccountContract(await api.provisionAccountProfile(), api.user);
  return cachedContract;
}

export async function completeProfile(profile, { api = cloud } = {}) {
  const ownerId = api.user?.id;
  const contract = normalizeAccountContract(await api.getAccountContract(), api.user);
  if (api.user?.id !== ownerId) throw Object.assign(new Error('Profile account changed'), { code: 'ACCOUNT_CONTRACT_OWNER_MISMATCH' });
  const requireDepartment = !!contract.provisioning && contract.provisioning.state !== 'READY';
  const validation = validateProfileCompletion(profile, { requireDepartment });
  if (!validation.valid) {
    throw Object.assign(new Error('Teacher name and a valid Saudi mobile number are required'), {
      code: 'PROFILE_REQUIRED_FIELDS_MISSING', missing: validation.missing, invalid: validation.invalid,
    });
  }
  cachedContract = normalizeAccountContract(await api.completeAccountProfile(validation.profile), api.user);
  if (api.user?.id !== ownerId) throw Object.assign(new Error('Profile account changed'), { code: 'ACCOUNT_CONTRACT_OWNER_MISMATCH' });
  return cachedContract;
}

export function clearAccountContract() {
  cachedContract = null;
}
