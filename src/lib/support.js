/**
 * Private Support/Feedback foundation.
 *
 * This deliberately has no route or UI. A future Google-approved screen may
 * call submitSupportRequest(), but requests never enter the Sync V2 outbox and
 * diagnostics are reduced to this allowlist before they leave the browser.
 */
import * as cloud from './cloud.js';

const TYPES = new Set(['technical', 'suggestion', 'inquiry']);
const SYNC_STATES = new Set(['idle', 'syncing', 'synced', 'pending', 'blocked', 'conflicted', 'rejected', 'offline', 'error', 'auth_required']);
const ROUTE_CATEGORIES = new Set(['home', 'classes', 'students', 'schedule', 'settings', 'support', 'other']);
const DEVICE_CATEGORIES = new Set(['mobile', 'tablet', 'desktop', 'other']);
const BROWSERS = new Set(['chrome', 'edge', 'firefox', 'safari', 'other']);
const MAX_COUNT = 999_999;

function inputString(value, max) {
  const text = String(value ?? '').trim();
  return text && text.length <= max ? text : null;
}

function safeCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= MAX_COUNT ? number : null;
}

function safeTimestamp(value) {
  const text = inputString(value, 40);
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : null;
}

function safeViewport(value) {
  const width = Number(value?.width);
  const height = Number(value?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0 || width > 10_000 || height > 10_000) return null;
  // Coarse buckets are sufficient for support triage and avoid a fingerprint-like exact viewport.
  return { width: Math.round(width / 50) * 50, height: Math.round(height / 50) * 50 };
}

/** Returns a new JSON-safe object containing only V1-approved diagnostic fields. */
export function sanitizeSupportDiagnostics(input = {}) {
  const diagnostics = {};
  const appVersion = inputString(input.appVersion, 40);
  const buildSha = inputString(input.buildSha, 64)?.toLowerCase();
  const buildTimestamp = safeTimestamp(input.buildTimestamp);
  const timestamp = safeTimestamp(input.timestamp);
  const timezone = inputString(input.timezone, 80);
  const deviceCategory = inputString(input.deviceCategory, 16)?.toLowerCase();
  const browser = inputString(input.browser, 16)?.toLowerCase();
  const browserVersion = inputString(input.browserVersion, 24);
  const routeCategory = inputString(input.routeCategory, 16)?.toLowerCase();
  const viewport = safeViewport(input.viewport);
  const syncState = inputString(input.syncState, 24)?.toLowerCase();
  const pendingMutations = safeCount(input.pendingMutations);
  const failedMutations = safeCount(input.failedMutations);
  const lastSuccessfulSyncAt = safeTimestamp(input.lastSuccessfulSyncAt);

  if (appVersion && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(appVersion)) diagnostics.appVersion = appVersion;
  if (buildSha && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(buildSha)) diagnostics.buildSha = buildSha;
  if (buildTimestamp) diagnostics.buildTimestamp = buildTimestamp;
  if (timestamp) diagnostics.timestamp = timestamp;
  if (timezone) diagnostics.timezone = timezone;
  if (DEVICE_CATEGORIES.has(deviceCategory)) diagnostics.deviceCategory = deviceCategory;
  if (BROWSERS.has(browser)) diagnostics.browser = browser;
  if (browserVersion && /^[0-9A-Za-z._ -]+$/.test(browserVersion)) diagnostics.browserVersion = browserVersion;
  if (typeof input.mobile === 'boolean') diagnostics.mobile = input.mobile;
  if (viewport) diagnostics.viewport = viewport;
  if (typeof input.pwaStandalone === 'boolean') diagnostics.pwaStandalone = input.pwaStandalone;
  if (typeof input.online === 'boolean') diagnostics.online = input.online;
  if (SYNC_STATES.has(syncState)) diagnostics.syncState = syncState;
  if (pendingMutations !== null) diagnostics.pendingMutations = pendingMutations;
  if (failedMutations !== null) diagnostics.failedMutations = failedMutations;
  if (lastSuccessfulSyncAt) diagnostics.lastSuccessfulSyncAt = lastSuccessfulSyncAt;
  if (ROUTE_CATEGORIES.has(routeCategory)) diagnostics.routeCategory = routeCategory;
  return diagnostics;
}

function supportError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const requestId = () => `support:${crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

/**
 * Online-only, authenticated direct insert. No support request is ever added
 * to IndexedDB, Sync V2, the outbox, or a public Storage bucket.
 */
export async function submitSupportRequest({ type, message, diagnostics = {} } = {}) {
  const cleanType = String(type ?? '').trim().toLowerCase();
  const cleanMessage = String(message ?? '').trim();
  if (!cloud.user || !cloud.session) throw supportError('AUTH_REQUIRED', 'يلزم تسجيل الدخول لإرسال الطلب.');
  if (!online()) throw supportError('OFFLINE', 'يتطلب إرسال الطلب اتصالًا بالإنترنت.');
  if (!TYPES.has(cleanType)) throw supportError('INVALID_TYPE', 'نوع الطلب غير صالح.');
  if (!cleanMessage || cleanMessage.length > 4000) throw supportError('INVALID_MESSAGE', 'اكتب رسالة بين 1 و4000 حرف.');

  const payload = {
    id: requestId(),
    type: cleanType,
    message: cleanMessage,
    diagnostics: sanitizeSupportDiagnostics({ ...diagnostics, timestamp: diagnostics.timestamp ?? new Date().toISOString() }),
  };
  await cloud.request('/support_requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=minimal',
      'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify(payload),
  });
  return { id: payload.id };
}
