export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;

export function normalizeEmailAddress(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeEmailOtp(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^0-9]/g, '')
    .slice(0, EMAIL_OTP_LENGTH);
}

export function isValidEmailOtp(value) {
  return new RegExp(`^[0-9]{${EMAIL_OTP_LENGTH}}$`).test(normalizeEmailOtp(value));
}

export function emailOtpFailureState(error, phase = 'verify') {
  if (error?.code === 'AUTH_NETWORK' || error instanceof TypeError) return 'offline';
  if (phase === 'send') return 'send_failed';
  const code = String(error?.code ?? '').toLowerCase();
  const message = String(error?.message ?? '').toLowerCase();
  if (code.includes('expired') || message.includes('expired')) return 'expired';
  return 'invalid';
}

export function emailOtpFailureMessage(state) {
  if (state === 'offline') return 'يلزم الاتصال بالإنترنت لإرسال رمز التحقق.';
  if (state === 'expired') return 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.';
  if (state === 'invalid') return 'رمز التحقق غير صحيح. تحقق من الرمز وحاول مرة أخرى.';
  return 'تعذر إرسال رمز التحقق. تحقق من البريد وحاول مرة أخرى.';
}
