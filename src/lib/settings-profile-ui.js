import { validateProfileCompletion } from './account-profile.js';

// Presentation only: the existing profile validator and account contract remain authoritative.
export function profileAttention({ profile, demo = false, pendingEmail = false, unavailable = false, contract = null }) {
  if (!validateProfileCompletion(profile).valid) return 'أكمل بياناتك المطلوبة';
  if (demo) return '';
  if (pendingEmail) return 'تغيير البريد قيد التأكيد';
  if (unavailable) return 'تعذر التحقق من حالة الوصول الآن';
  if (contract && (contract.profileStatus !== 'READY' || !contract.access ||
      (contract.provisioning?.state && contract.provisioning.state !== 'READY'))) return 'راجع حالة حسابك';
  return '';
}
