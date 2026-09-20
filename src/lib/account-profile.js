import * as cloud from './cloud.js';

export const PROFILE_STATUS = Object.freeze({ PENDING: 'PENDING_PROFILE', READY: 'READY' });
export const TEACHER_FORM = Object.freeze({ MASCULINE: 'masculine', FEMININE: 'feminine' });
export const BETA_ACCESS_LABEL = 'الوصول التجريبي المجاني';

let cachedContract = null;

export function teacherAddress(form) {
  return form === TEACHER_FORM.FEMININE ? 'أستاذة' : 'أستاذ';
}

export function validateProfileCompletion(profile = {}) {
  const teacherName = String(profile.teacherName ?? '').trim();
  const phone = String(profile.phone ?? '').trim();
  const teacherForm = profile.teacherForm === TEACHER_FORM.FEMININE
    ? TEACHER_FORM.FEMININE
    : TEACHER_FORM.MASCULINE;
  const schoolName = String(profile.schoolName ?? '').trim();
  return Object.freeze({
    valid: !!teacherName && !!phone,
    missing: Object.freeze([
      ...(!teacherName ? ['teacherName'] : []),
      ...(!phone ? ['phone'] : []),
    ]),
    profile: Object.freeze({ teacherName, phone, teacherForm, schoolName }),
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
    profile: Object.freeze({
      teacherName: String(raw.profile?.teacherName ?? ''),
      phone: String(raw.profile?.phone ?? ''),
      teacherForm: form,
      schoolName: String(raw.profile?.schoolName ?? ''),
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
  const validation = validateProfileCompletion(profile);
  if (!validation.valid) {
    throw Object.assign(new Error('Teacher name and phone are required'), {
      code: 'PROFILE_REQUIRED_FIELDS_MISSING', missing: validation.missing,
    });
  }
  cachedContract = normalizeAccountContract(await api.completeAccountProfile(validation.profile), api.user);
  return cachedContract;
}

export function clearAccountContract() {
  cachedContract = null;
}
