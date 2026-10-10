/** N79: text-only, user-reviewed handoff. No request or media is sent by RAKEEZ. */
import { sanitizeSupportDiagnostics } from './support.js';

const TYPE_LABELS = Object.freeze({
  inquiry: 'مساعدة أو استفسار',
  suggestion: 'فكرة أو اقتراح',
  technical: 'مشكلة تقنية',
});

const DIAGNOSTIC_LABELS = Object.freeze({
  appVersion: 'إصدار التطبيق', buildTimestamp: 'وقت البناء',
  timestamp: 'وقت إعداد الرسالة', timezone: 'المنطقة الزمنية',
  routeCategory: 'قسم التطبيق', routeTemplate: 'قالب الصفحة',
  deviceCategory: 'نوع الجهاز', browser: 'المتصفح', browserVersion: 'إصدار المتصفح',
  mobile: 'واجهة جوال', viewport: 'حجم الشاشة التقريبي', pwaStandalone: 'تطبيق مثبت',
  online: 'متصل بالإنترنت', syncState: 'حالة المزامنة',
  pendingMutations: 'عمليات معلقة', failedMutations: 'عمليات فاشلة',
  pendingCount: 'عناصر معلقة', failedCount: 'عناصر فاشلة',
  blockedCount: 'عناصر محظورة', rejectedCount: 'عناصر مرفوضة',
  historicalConflictCount: 'تعارضات سابقة', actionableSyncIssue: 'مشكلة مزامنة تتطلب إجراء',
  lastSuccessfulSyncAt: 'آخر مزامنة ناجحة',
});

export function supportWhatsAppContact(value) {
  const contact = String(value ?? '').trim();
  // wa.me requires an international number with digits only. Reject placeholders and URLs.
  return /^[1-9][0-9]{7,14}$/.test(contact) ? contact : null;
}

export function supportWhatsAppMessage({ type, message = '', diagnostics = {} } = {}) {
  const label = TYPE_LABELS[String(type ?? '')];
  if (!label) throw new TypeError('Invalid support type');
  const written = String(message ?? '').trim();
  if (written.length > 4000) throw new TypeError('Support message is too long');
  const safe = sanitizeSupportDiagnostics(diagnostics);
  const lines = ['طلب دعم ركيز', `نوع الطلب: ${label}`];
  if (written) lines.push('', 'رسالة المستخدم:', written);
  lines.push('', 'معلومات تقنية عامة:');
  if (safe.environment) lines.push(`البيئة: ${{ production: 'الإنتاج', preview: 'المعاينة', other: 'أخرى' }[safe.environment]}`);
  if (safe.buildSha) {
    const title = safe.buildShaKind === 'content' ? 'بصمة المحتوى'
      : safe.buildShaKind === 'git' ? 'إصدار Git' : 'البناء';
    lines.push(`${title}: ${safe.buildSha.slice(0, 12)}`);
  }
  for (const [key, title] of Object.entries(DIAGNOSTIC_LABELS)) {
    if (!Object.hasOwn(safe, key)) continue;
    const value = key === 'viewport'
      ? `${safe.viewport.width} × ${safe.viewport.height}`
      : typeof safe[key] === 'boolean' ? (safe[key] ? 'نعم' : 'لا') : safe[key];
    lines.push(`${title}: ${value}`);
  }
  for (const group of safe.rejectedGroups ?? []) {
    const title = group.code === 'N58_SESSION_CONTEXT_REQUIRED' ? 'يلزم سياق الحصة' : 'رفض غير مصنّف';
    lines.push(`سبب الرفض: ${title} (${group.code}) × ${group.count}${group.area === 'sessions' ? ' — الحصص' : ''}`);
  }
  return lines.join('\n');
}

export function supportWhatsAppUrl(contact, message) {
  const number = supportWhatsAppContact(contact);
  if (!number || typeof message !== 'string' || !message) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
