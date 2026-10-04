import { validateProfileCompletion } from './account-profile.js';
import { EDUCATION_DEPARTMENTS, isOfficialEducationDepartment } from './education-department-directory.js';

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
