/** N79: safe one-tap prefill. The user edits and sends inside WhatsApp. */
import { sanitizeSupportDiagnostics } from './support.js';
import { resolveSupportWhatsAppContact } from './support-public-config.js';

const TYPE_LABELS = Object.freeze({
  inquiry: 'مساعدة أو استفسار',
  suggestion: 'فكرة أو اقتراح',
  technical: 'مشكلة تقنية',
});

const DIAGNOSTIC_LABELS = Object.freeze({
  appVersion: 'إصدار التطبيق',
  routeCategory: 'قسم التطبيق', routeTemplate: 'قالب الصفحة',
  deviceCategory: 'نوع الجهاز', browser: 'المتصفح', browserVersion: 'إصدار المتصفح',
  viewport: 'حجم الشاشة التقريبي',
  online: 'متصل بالإنترنت', syncState: 'حالة المزامنة',
  pendingMutations: 'عمليات معلقة', failedMutations: 'عمليات فاشلة',
  pendingCount: 'عناصر معلقة', failedCount: 'عناصر فاشلة',
  blockedCount: 'عناصر محظورة', rejectedCount: 'عناصر مرفوضة',
  historicalConflictCount: 'تعارضات سابقة', actionableSyncIssue: 'مشكلة مزامنة تتطلب إجراء',
  lastSuccessfulSyncAt: 'آخر مزامنة ناجحة',
});

export function supportWhatsAppContact(value) {
  return resolveSupportWhatsAppContact(value);
}

export function supportWhatsAppMessage({ type, diagnostics = {} } = {}) {
  const label = type == null ? null : TYPE_LABELS[String(type)];
  if (type != null && !label) throw new TypeError('Invalid support type');
  const safe = sanitizeSupportDiagnostics(diagnostics);
  const lines = ['السلام عليكم، أحتاج مساعدتكم في ركيز.'];
  if (label) lines.push(`نوع الطلب: ${label}`);
  lines.push('', 'معلومات تقنية عامة:');
  if (safe.environment) lines.push(`البيئة: ${{ production: 'الإنتاج', preview: 'المعاينة', other: 'أخرى' }[safe.environment]}`);
  if (safe.buildSha) {
    const title = safe.buildShaKind === 'content' ? 'بصمة المحتوى'
      : safe.buildShaKind === 'git' ? 'إصدار Git' : 'البناء';
    lines.push(`${title}: ${safe.buildSha.slice(0, 12)}`);
  }
  if (safe.operatingSystem) {
    const system = { android: 'Android', ios: 'iOS', ipados: 'iPadOS', windows: 'Windows',
      macos: 'macOS', linux: 'Linux', chromeos: 'ChromeOS' }[safe.operatingSystem];
    lines.push(`النظام: ${system}${safe.operatingSystemVersion ? ` ${safe.operatingSystemVersion}` : ''}`);
  }
  if (safe.deviceModel) lines.push(`الطراز: ${safe.deviceModel}`);
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
