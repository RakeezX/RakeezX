/** N79: safe one-tap prefill. The user edits and sends inside WhatsApp. */
import { sanitizeSupportDiagnostics } from './support.js';
import { resolveSupportWhatsAppContact } from './support-public-config.js';

const TYPE_LABELS = Object.freeze({
  inquiry: 'مساعدة أو استفسار',
  suggestion: 'فكرة أو اقتراح',
  technical: 'مشكلة تقنية',
});


const OS_LABELS = { android: 'Android', ios: 'iOS', ipados: 'iPadOS', windows: 'Windows', macos: 'macOS', linux: 'Linux', chromeos: 'ChromeOS' };
const DEVICE_LABELS = { mobile: 'جوال', tablet: 'جهاز لوحي', desktop: 'كمبيوتر', other: 'جهاز آخر' };
const SYNC_LABELS = { idle: 'خاملة', syncing: 'جارية', synced: 'مكتملة', pending: 'معلقة', blocked: 'محظورة', conflicted: 'تعارض', rejected: 'مرفوضة', offline: 'دون اتصال', error: 'خطأ', auth_required: 'يحتاج دخولًا' };
function compactSupportLines(safe) {
  const rows = [];
  const add = (parts) => { const line = parts.filter(Boolean).join(' • '); if (line) rows.push(line); };
  add([
    safe.environment ? 'البيئة: ' + ({ production:'الإنتاج', preview:'المعاينة', other:'أخرى' }[safe.environment]) : '',
    safe.appVersion ? 'التطبيق: ' + safe.appVersion : '',
    safe.buildSha ? (safe.buildShaKind === 'content' ? 'البصمة: ' : safe.buildShaKind === 'git' ? 'Git: ' : 'البناء: ') + safe.buildSha.slice(0,12) : '',
  ]);
  add([
    safe.operatingSystem ? 'النظام: ' + OS_LABELS[safe.operatingSystem] + (safe.operatingSystemVersion ? ' ' + safe.operatingSystemVersion : '') : '',
    safe.deviceCategory ? 'الجهاز: ' + DEVICE_LABELS[safe.deviceCategory] : '',
    safe.deviceModel ? 'الطراز: ' + safe.deviceModel : '',
    safe.browser ? 'المتصفح: ' + safe.browser + (safe.browserVersion ? ' ' + safe.browserVersion.split('.')[0] : '') : '',
  ]);
  add([
    safe.routeTemplate ? 'الصفحة: ' + safe.routeTemplate : safe.routeCategory ? 'القسم: ' + safe.routeCategory : '',
    safe.viewport ? 'الشاشة: ' + safe.viewport.width + '×' + safe.viewport.height : '',
    typeof safe.online === 'boolean' ? 'الاتصال: ' + (safe.online ? 'متصل' : 'غير متصل') : '',
  ]);
  add([
    safe.syncState ? 'المزامنة: ' + SYNC_LABELS[safe.syncState] : '',
    Number.isInteger(safe.pendingCount) ? 'معلق: ' + safe.pendingCount : '',
    Number.isInteger(safe.failedCount) ? 'فاشل: ' + safe.failedCount : '',
    Number.isInteger(safe.blockedCount) ? 'محظور: ' + safe.blockedCount : '',
    Number.isInteger(safe.rejectedCount) ? 'مرفوض: ' + safe.rejectedCount : '',
  ]);
  add([
    Number.isInteger(safe.historicalConflictCount) ? 'تعارضات سابقة: ' + safe.historicalConflictCount : '',
    typeof safe.actionableSyncIssue === 'boolean' ? 'إجراء مطلوب: ' + (safe.actionableSyncIssue ? 'نعم' : 'لا') : '',
    safe.lastSuccessfulSyncAt && safe.actionableSyncIssue ? 'آخر مزامنة: ' + safe.lastSuccessfulSyncAt : '',
  ]);
  for (const group of safe.rejectedGroups ?? []) {
    rows.push('سبب الرفض: ' + (group.code === 'N58_SESSION_CONTEXT_REQUIRED' ? 'يلزم سياق الحصة' : 'رفض غير مصنف') + ' (' + group.code + ') × ' + group.count);
  }
  return rows;
}

export function supportWhatsAppContact(value) {
  return resolveSupportWhatsAppContact(value);
}

export function supportWhatsAppMessage({ type, diagnostics = {} } = {}) {
  const label = type == null ? null : TYPE_LABELS[String(type)];
  if (type != null && !label) throw new TypeError('Invalid support type');
  const safe = sanitizeSupportDiagnostics(diagnostics);
  return ['السلام عليكم، أحتاج مساعدتكم في ركيز.',
    ...(label ? ['نوع الطلب: ' + label] : []), '',
    'معلومات تقنية:', ...compactSupportLines(safe)].join('\n');
}

export function supportWhatsAppUrl(contact, message) {
  const number = supportWhatsAppContact(contact);
  if (!number || typeof message !== 'string' || !message) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
