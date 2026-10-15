import { validateProfileCompletion } from './account-profile.js';
import { EDUCATION_DEPARTMENTS, isOfficialEducationDepartment } from './education-department-directory.js';

// Only a fresh, owner-checked Auth read may retire a request or announce completion.
// Keep this evidence in memory: a later unrelated reload must not repeat success.
export function verifiedEmailFeedback(previous, { ownerId, email, pendingEmail = '', verified = false }) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const state = previous && previous.ownerId === ownerId ? { ...previous } : { ownerId, requestedEmailChange: '', completed: false };
  if (state.completed && normalize(email) !== state.completedEmail) state.completed = false;
  const pending = normalize(pendingEmail);
  if (pending && pending !== normalize(email)) {
    state.requestedEmailChange = pending;
    state.completed = false;
  }
  if (verified && ownerId && normalize(email) && normalize(email) === state.requestedEmailChange) {
    state.requestedEmailChange = '';
    state.completed = true;
    state.completedEmail = normalize(email);
  }
  return state;
}

export function educationDepartmentComplete(profile) {
  return isOfficialEducationDepartment(EDUCATION_DEPARTMENTS, profile?.educationDepartment);
}

// Presentation only: the existing profile validator and account contract remain authoritative.
export function profileAttention({ profile, demo = false, pendingEmail = false, unavailable = false, contract = null }) {
  if (!validateProfileCompletion(profile).valid) return 'أكمل بياناتك المطلوبة';
  if (demo) return educationDepartmentComplete(profile) ? '' : 'أكمل إدارة التعليم من بياناتك';
  if (pendingEmail) return 'تغيير البريد قيد التأكيد';
  if (unavailable) return 'تعذر التحقق من حالة الوصول الآن';
  if (contract && (contract.profileStatus !== 'READY' || !contract.access ||
      (contract.provisioning?.state && contract.provisioning.state !== 'READY'))) return 'راجع حالة حسابك';
  return educationDepartmentComplete(profile) ? '' : 'أكمل إدارة التعليم من بياناتك';
}
