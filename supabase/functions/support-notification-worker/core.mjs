const TYPE_LABELS = Object.freeze({
  technical: 'مشكلة تقنية',
  suggestion: 'اقتراح',
  inquiry: 'استفسار',
});

const DIAGNOSTIC_KEYS = new Set([
  'appVersion', 'buildSha', 'buildTimestamp', 'timestamp', 'timezone',
  'deviceCategory', 'browser', 'browserVersion', 'mobile', 'viewport',
  'pwaStandalone', 'online', 'syncState', 'pendingMutations',
  'failedMutations', 'pendingCount', 'failedCount', 'blockedCount', 'rejectedCount',
  'historicalConflictCount', 'actionableSyncIssue', 'lastSuccessfulSyncAt', 'routeCategory', 'routeTemplate',
]);

const FAILURE_CATEGORIES = new Set([
  'network', 'timeout', 'rate_limited', 'provider_5xx', 'provider_rejected',
  'invalid_request', 'authentication', 'configuration', 'request_missing', 'internal',
]);

const SYNC_STATES = new Set(['idle', 'syncing', 'synced', 'pending', 'blocked', 'conflicted', 'rejected', 'offline', 'error', 'auth_required']);
const ROUTE_CATEGORIES = new Set(['home', 'classes', 'students', 'schedule', 'calendar', 'settings', 'support', 'other']);
// Keep this explicit Edge allowlist aligned with the client foundation. Never accept route instances.
export const SUPPORT_ROUTE_CATEGORIES = Object.freeze({
  '/': 'home',
  '/classes': 'classes',
  '/teaching/:id': 'classes',
  '/teaching/:id/class-rules': 'classes',
  '/teaching/:id/students': 'classes',
  '/teaching/:id/attendance': 'classes',
  '/teaching/:id/quicklog': 'classes',
  '/teaching/:id/grades': 'classes',
  '/teaching/:id/items': 'classes',
  '/teaching/:id/picker': 'classes',
  '/teaching/:id/groups': 'classes',
  '/teaching/:id/board': 'classes',
  '/teaching/:id/sessions': 'classes',
  '/teaching/:id/reports': 'classes',
  '/student/:id': 'students',
  '/schedule': 'schedule',
  '/schedule/times': 'schedule',
  '/curriculum': 'other',
  '/reports': 'other',
  '/reports/execution': 'other',
  '/archive': 'other',
  '/archive/former-students': 'other',
  '/archive/year/:yearId/term/:termId/execution': 'other',
  '/archive/year/:yearId/term/:termId': 'other',
  '/calendar': 'calendar',
  '/settings': 'settings',
  '/settings/backup': 'settings',
});
const ROUTE_CATEGORY_LABELS = Object.freeze({
  home: 'الرئيسية', classes: 'الفصول', students: 'الطلاب', schedule: 'الجدول',
  calendar: 'التقويم', settings: 'الإعدادات', support: 'الدعم', other: 'قسم آخر',
});
const DEVICE_CATEGORIES = new Set(['mobile', 'tablet', 'desktop', 'other']);
const BROWSERS = new Set(['chrome', 'edge', 'firefox', 'safari', 'other']);

export const DELIVERY_POLICY = Object.freeze({
  schedule: '* * * * *',
  leaseSeconds: 300,
  maxAttempts: 5,
  backoffSeconds: Object.freeze([60, 300, 900, 3600]),
});

const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeAuthenticatedEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && !/[\r\n]/.test(email) && CONTACT_EMAIL_PATTERN.test(email) ? email : '';
}

export function sanitizeDisplayName(value) {
  const name = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return name && name.length <= 120 ? name : '';
}

export async function resolveSupportContact(ownerId, { getAuthUser, getProfile }) {
  let email = '';
  let name = '';
  try {
    const user = await getAuthUser(ownerId);
    email = sanitizeAuthenticatedEmail(user?.email);
  } catch {}
  try {
    const profile = await getProfile(ownerId);
    name = sanitizeDisplayName(profile?.teacher_name);
  } catch {}
  return { email, name };
}

function validTimestamp(value) {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function sanitizeDiagnostics(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output = {};
  const addTimestamp = (key) => { if (DIAGNOSTIC_KEYS.has(key) && validTimestamp(input[key])) output[key] = new Date(input[key]).toISOString(); };
  if (typeof input.appVersion === 'string' && input.appVersion.length <= 40 && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(input.appVersion)) output.appVersion = input.appVersion;
  if (typeof input.buildSha === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(input.buildSha.toLowerCase())) output.buildSha = input.buildSha.toLowerCase();
  addTimestamp('buildTimestamp');
  addTimestamp('timestamp');
  addTimestamp('lastSuccessfulSyncAt');
  if (typeof input.timezone === 'string' && input.timezone.trim() && input.timezone.length <= 80) output.timezone = input.timezone.trim();
  if (DEVICE_CATEGORIES.has(input.deviceCategory)) output.deviceCategory = input.deviceCategory;
  if (BROWSERS.has(input.browser)) output.browser = input.browser;
  if (typeof input.browserVersion === 'string' && input.browserVersion.length <= 24 && /^[0-9A-Za-z._ -]+$/.test(input.browserVersion)) output.browserVersion = input.browserVersion;
  for (const key of ['mobile', 'pwaStandalone', 'online']) if (typeof input[key] === 'boolean') output[key] = input[key];
  if (Number.isFinite(input.viewport?.width) && Number.isFinite(input.viewport?.height) &&
      input.viewport.width >= 0 && input.viewport.height >= 0 && input.viewport.width <= 10000 && input.viewport.height <= 10000) {
    output.viewport = { width: input.viewport.width, height: input.viewport.height };
  }
  if (SYNC_STATES.has(input.syncState)) output.syncState = input.syncState;
  for (const key of ['pendingMutations', 'failedMutations', 'pendingCount', 'failedCount', 'blockedCount', 'rejectedCount', 'historicalConflictCount']) {
    if (Number.isInteger(input[key]) && input[key] >= 0 && input[key] <= 999999) output[key] = input[key];
  }
  if (typeof input.actionableSyncIssue === 'boolean') output.actionableSyncIssue = input.actionableSyncIssue;
  if (ROUTE_CATEGORIES.has(input.routeCategory)) output.routeCategory = input.routeCategory;
  if (typeof input.routeTemplate === 'string' &&
      Object.hasOwn(SUPPORT_ROUTE_CATEGORIES, input.routeTemplate) &&
      SUPPORT_ROUTE_CATEGORIES[input.routeTemplate] === output.routeCategory) output.routeTemplate = input.routeTemplate;
  return output;
}

export function validateSupportRequest(record) {
  const id = String(record?.id ?? '');
  const type = String(record?.type ?? '');
  const message = String(record?.message ?? '').trim();
  if (!id || id.length > 200 || !TYPE_LABELS[type] || !message || message.length > 4000 || !validTimestamp(record?.created_at)) {
    return { ok: false, category: 'invalid_request' };
  }
  return {
    ok: true,
    request: {
      id,
      type,
      message,
      createdAt: new Date(record.created_at).toISOString(),
      diagnostics: sanitizeDiagnostics(record.diagnostics),
    },
  };
}

export function safeReference(id) {
  const suffix = id.split(':').at(-1)?.replace(/[^0-9A-Za-z-]/g, '') ?? '';
  return (suffix || 'request').slice(0, 12);
}

export function formatRiyadhTime(value) {
  if (!validTimestamp(value)) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function formatDiagnosticLines(diagnostics) {
  const lines = [];
  if (diagnostics.appVersion) lines.push(`الإصدار: ${diagnostics.appVersion}`);
  if (diagnostics.buildSha) lines.push(`البناء: ${diagnostics.buildSha.slice(0, 12)}`);
  if (diagnostics.deviceCategory) {
    const viewport = diagnostics.viewport ? ` — ${diagnostics.viewport.width}×${diagnostics.viewport.height}` : '';
    lines.push(`الجهاز: ${diagnostics.deviceCategory}${viewport}`);
  }
  if (diagnostics.browser) lines.push(`المتصفح: ${diagnostics.browser}${diagnostics.browserVersion ? ` ${diagnostics.browserVersion}` : ''}`);
  if (diagnostics.syncState) lines.push(`المزامنة: ${diagnostics.syncState}`);
  if (typeof diagnostics.pendingCount === 'number') lines.push(`قيد الانتظار: ${diagnostics.pendingCount}`);
  if (typeof diagnostics.failedCount === 'number') lines.push(`تعذّر إرسالها: ${diagnostics.failedCount}`);
  if (typeof diagnostics.blockedCount === 'number') lines.push(`بانتظار بيانات مرتبطة: ${diagnostics.blockedCount}`);
  if (typeof diagnostics.rejectedCount === 'number') lines.push(`لم يقبلها الخادم: ${diagnostics.rejectedCount}`);
  if (typeof diagnostics.historicalConflictCount === 'number') lines.push(`اختلافات تاريخية متصالحة: ${diagnostics.historicalConflictCount}`);
  if (typeof diagnostics.online === 'boolean') lines.push(`الاتصال: ${diagnostics.online ? 'متصل' : 'غير متصل'}`);
  if (diagnostics.routeCategory) lines.push(`قسم التطبيق: ${ROUTE_CATEGORY_LABELS[diagnostics.routeCategory]}`);
  if (diagnostics.routeTemplate) lines.push(`المسار: ${diagnostics.routeTemplate}`);
  return lines;
}

export function buildNotificationEmail(record, { to, from = 'RAKEEZ Support <support@rakeezx.com>', contact = {} } = {}) {
  const validation = validateSupportRequest(record);
  if (!validation.ok) return validation;
  if (typeof to !== 'string' || !/^\S+@\S+\.\S+$/.test(to) || /[\r\n]/.test(to)) {
    return { ok: false, category: 'configuration' };
  }
  const request = validation.request;
  const reference = safeReference(request.id);
  const email = sanitizeAuthenticatedEmail(contact.email);
  const name = sanitizeDisplayName(contact.name);
  const diagnosticLines = formatDiagnosticLines(request.diagnostics);
  return {
    ok: true,
    reference,
    payload: {
      from,
      to: [to],
      subject: `رَكيز المعلم — ${TYPE_LABELS[request.type]} — ${reference}`,
      text: [
        `رَكيز المعلم — ${TYPE_LABELS[request.type]}`,
        '',
        ...(name ? [`الاسم: ${name}`] : []),
        ...(email ? [`البريد: ${email}`] : []),
        `المرجع: ${reference}`,
        `الوقت: ${formatRiyadhTime(request.createdAt)}`,
        '',
        'الرسالة:',
        request.message,
        ...(diagnosticLines.length ? ['', 'معلومات تقنية:', ...diagnosticLines] : []),
      ].join('\n'),
    },
  };
}

export function classifyProviderResult({ status = 0, body = null, error = null } = {}) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return { outcome: 'temporary_failure', category: 'timeout' };
  if (error) return { outcome: 'temporary_failure', category: 'network' };
  if (status >= 200 && status < 300 && body?.success === true &&
      (body?.result?.delivered?.length || body?.result?.queued?.length)) {
    return { outcome: 'delivered', category: null };
  }
  if (status >= 200 && status < 300 && body?.result?.permanent_bounces?.length) {
    return { outcome: 'permanent_failure', category: 'provider_rejected' };
  }
  if (status === 429) return { outcome: 'temporary_failure', category: 'rate_limited' };
  if (status >= 500) return { outcome: 'temporary_failure', category: 'provider_5xx' };
  if (status === 401) return { outcome: 'permanent_failure', category: 'authentication' };
  if (status === 403) return { outcome: 'permanent_failure', category: 'configuration' };
  if (status >= 400) return { outcome: 'permanent_failure', category: 'provider_rejected' };
  return { outcome: 'temporary_failure', category: 'internal' };
}

export function retryAt(attemptCount, now = new Date()) {
  const index = Math.min(Math.max(Number(attemptCount) - 1, 0), DELIVERY_POLICY.backoffSeconds.length - 1);
  return new Date(now.getTime() + DELIVERY_POLICY.backoffSeconds[index] * 1000).toISOString();
}

export function safeFailureCategory(value) {
  return FAILURE_CATEGORIES.has(value) ? value : 'internal';
}
