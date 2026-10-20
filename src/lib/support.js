/**
 * Private Support/Feedback foundation.
 *
 * The Support screen calls submitSupportRequest(), but requests never enter
 * the Sync V2 outbox and
 * diagnostics are reduced to this allowlist before they leave the browser.
 */
import * as cloud from './cloud.js';
import * as db from './db.js';
import * as store from '../store.js';
import { SUPPORT_ROUTE_CATEGORIES } from './support-origin.js';

const TYPES = new Set(['technical', 'suggestion', 'inquiry']);
const SYNC_STATES = new Set(['idle', 'syncing', 'synced', 'pending', 'blocked', 'conflicted', 'rejected', 'offline', 'error', 'auth_required']);
const ROUTE_CATEGORIES = new Set(['home', 'classes', 'students', 'schedule', 'calendar', 'settings', 'support', 'other']);
const DEVICE_CATEGORIES = new Set(['mobile', 'tablet', 'desktop', 'other']);
const OPERATING_SYSTEMS = new Set(['android', 'ios', 'ipados', 'windows', 'macos', 'linux', 'chromeos']);
const BROWSERS = new Set(['chrome', 'edge', 'firefox', 'safari', 'other']);
const MAX_COUNT = 999_999;
const REJECTED_CODES = new Set(['N58_SESSION_CONTEXT_REQUIRED', 'REJECTED_UNCLASSIFIED']);
const REJECTED_AREAS = new Set(['sessions', 'other']);

export function supportEnvironment(origin) {
  return origin === 'https://rakeezx.com' ? 'production'
    : /^https:\/\/[a-z0-9-]+\.rakeezx\.pages\.dev$/.test(origin) ? 'preview' : 'other';
}

/** Only claimed, owner-bound V2 rows may contribute to this read-only projection. */
export function groupRejectedSyncErrors(outbox, { workspace, ownerId } = {}) {
  if (workspace?.type !== 'account' || workspace.ownershipState !== 'claimed' ||
      workspace.syncEligible !== true || !ownerId || workspace.authUserId !== ownerId ||
      !Array.isArray(outbox)) return [];
  const counts = new Map();
  for (const row of outbox) {
    if (row?.protocol !== 'v2' || row.state !== 'rejected' || row.ownerId !== ownerId) continue;
    const code = row.store === 'sessions' && row.lastError?.code === '22023' &&
      /^N58_SESSION_CONTEXT_REQUIRED\b/.test(row.lastError?.message ?? '')
      ? 'N58_SESSION_CONTEXT_REQUIRED' : 'REJECTED_UNCLASSIFIED';
    const area = code === 'N58_SESSION_CONTEXT_REQUIRED' && row.store === 'sessions' ? 'sessions' : 'other';
    const key = `${code}:${area}`;
    counts.set(key, Math.min(MAX_COUNT, (counts.get(key) ?? 0) + 1));
  }
  return [...counts].slice(0, 5).map(([key, count]) => {
    const [code, area] = key.split(':');
    return { code, area, count };
  });
}

export async function currentRejectedSyncGroups() {
  const workspace = store.getActiveWorkspace();
  const ownerId = cloud.user?.id;
  if (!cloud.session || !store.state.ready || !workspace?.databaseName) return [];
  try {
    const groups = groupRejectedSyncErrors(await db.getAll('outbox'), { workspace, ownerId });
    return store.getActiveWorkspace() === workspace && cloud.user?.id === ownerId ? groups : [];
  } catch {
    return []; // Diagnostics must never prevent an otherwise valid Support request.
  }
}

function safeRejectedGroups(value) {
  if (!Array.isArray(value)) return null;
  const groups = [];
  for (const group of value.slice(0, 5)) {
    if (!REJECTED_CODES.has(group?.code) || !REJECTED_AREAS.has(group?.area) ||
        (group.code === 'N58_SESSION_CONTEXT_REQUIRED' && group.area !== 'sessions') ||
        (group.code === 'REJECTED_UNCLASSIFIED' && group.area !== 'other') ||
        !Number.isInteger(group.count) || group.count < 1 || group.count > MAX_COUNT) continue;
    groups.push({ code: group.code, area: group.area, count: group.count });
  }
  return groups;
}

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
  const p=input.n88Portal;
  if(p&&['binding','queue','dispatch','http','response','admitted','failure'].includes(p.phase)&&
     ['n88-class-entry-1837-v1','n88-class-deadline-v1'].includes(p.sourceVersion)&&Number.isInteger(p.httpStatus)&&
     (p.httpStatus===0||p.httpStatus>=100&&p.httpStatus<=599)&&Number.isInteger(p.elapsedMs)&&p.elapsedMs>=0&&p.elapsedMs<=30000)
    {
    diagnostics.n88Portal={phase:p.phase,httpStatus:p.httpStatus,elapsedMs:Math.round(p.elapsedMs/100)*100,sourceVersion:p.sourceVersion};
    if(p.sourceVersion==='n88-class-deadline-v1'){
      if(['none','timeout','rejected','invalid_ack','stale_context','unavailable','uncertain'].includes(p.code))diagnostics.n88Portal.code=p.code;
      if(['none','configuration','key-configuration','envelope','upstream','upstream-body','upstream-http-5xx','reply','reply-shape','acquire','begin','snapshot','repository','teacher','source','synchronize','projection'].includes(p.stage))diagnostics.n88Portal.stage=p.stage;
    }
  }
  const appVersion = inputString(input.appVersion, 40);
  const buildSha = inputString(input.buildSha, 64)?.toLowerCase();
  const buildTimestamp = safeTimestamp(input.buildTimestamp);
  const timestamp = safeTimestamp(input.timestamp);
  const timezone = inputString(input.timezone, 80);
  const deviceCategory = inputString(input.deviceCategory, 16)?.toLowerCase();
  const operatingSystem = inputString(input.operatingSystem, 16)?.toLowerCase();
  const operatingSystemVersion = inputString(input.operatingSystemVersion, 20);
  const deviceModel = inputString(input.deviceModel, 40);
  const browser = inputString(input.browser, 16)?.toLowerCase();
  const browserVersion = inputString(input.browserVersion, 24);
  const routeCategory = inputString(input.routeCategory, 16)?.toLowerCase();
  const routeTemplate = inputString(input.routeTemplate, 96);
  const viewport = safeViewport(input.viewport);
  const syncState = inputString(input.syncState, 24)?.toLowerCase();
  const pendingMutations = safeCount(input.pendingMutations);
  const failedMutations = safeCount(input.failedMutations);
  const pendingCount = safeCount(input.pendingCount);
  const failedCount = safeCount(input.failedCount);
  const blockedCount = safeCount(input.blockedCount);
  const rejectedCount = safeCount(input.rejectedCount);
  const historicalConflictCount = safeCount(input.historicalConflictCount);
  const lastSuccessfulSyncAt = safeTimestamp(input.lastSuccessfulSyncAt);

  if (appVersion && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(appVersion)) diagnostics.appVersion = appVersion;
  if (buildSha && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(buildSha)) diagnostics.buildSha = buildSha;
  if (diagnostics.buildSha && ['content', 'git'].includes(input.buildShaKind)) diagnostics.buildShaKind = input.buildShaKind;
  if (['production', 'preview', 'other'].includes(input.environment)) diagnostics.environment = input.environment;
  const rejectedGroups = safeRejectedGroups(input.rejectedGroups);
  if (rejectedGroups?.length) diagnostics.rejectedGroups = rejectedGroups;
  if (buildTimestamp) diagnostics.buildTimestamp = buildTimestamp;
  if (timestamp) diagnostics.timestamp = timestamp;
  if (timezone) diagnostics.timezone = timezone;
  if (DEVICE_CATEGORIES.has(deviceCategory)) diagnostics.deviceCategory = deviceCategory;
  if (OPERATING_SYSTEMS.has(operatingSystem)) diagnostics.operatingSystem = operatingSystem;
  if (diagnostics.operatingSystem && operatingSystemVersion && /^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(operatingSystemVersion)) diagnostics.operatingSystemVersion = operatingSystemVersion;
  if (diagnostics.operatingSystem === 'android' && deviceModel &&
      /^[A-Za-z][A-Za-z0-9 ._+()-]{1,39}$/.test(deviceModel) &&
      !/^(?:K|wv|Mobile|Android|Linux|unknown)$/i.test(deviceModel)) diagnostics.deviceModel = deviceModel;
  if (BROWSERS.has(browser)) diagnostics.browser = browser;
  if (browserVersion && /^[0-9A-Za-z._ -]+$/.test(browserVersion)) diagnostics.browserVersion = browserVersion;
  if (typeof input.mobile === 'boolean') diagnostics.mobile = input.mobile;
  if (viewport) diagnostics.viewport = viewport;
  if (typeof input.pwaStandalone === 'boolean') diagnostics.pwaStandalone = input.pwaStandalone;
  if (typeof input.online === 'boolean') diagnostics.online = input.online;
  if (SYNC_STATES.has(syncState)) diagnostics.syncState = syncState;
  if (pendingMutations !== null) diagnostics.pendingMutations = pendingMutations;
  if (failedMutations !== null) diagnostics.failedMutations = failedMutations;
  if (pendingCount !== null) diagnostics.pendingCount = pendingCount;
  if (failedCount !== null) diagnostics.failedCount = failedCount;
  if (blockedCount !== null) diagnostics.blockedCount = blockedCount;
  if (rejectedCount !== null) diagnostics.rejectedCount = rejectedCount;
  if (historicalConflictCount !== null) diagnostics.historicalConflictCount = historicalConflictCount;
  if (typeof input.actionableSyncIssue === 'boolean') diagnostics.actionableSyncIssue = input.actionableSyncIssue;
  if (lastSuccessfulSyncAt) diagnostics.lastSuccessfulSyncAt = lastSuccessfulSyncAt;
  if (ROUTE_CATEGORIES.has(routeCategory)) diagnostics.routeCategory = routeCategory;
  if (routeTemplate && Object.hasOwn(SUPPORT_ROUTE_CATEGORIES, routeTemplate)
      && SUPPORT_ROUTE_CATEGORIES[routeTemplate] === diagnostics.routeCategory) diagnostics.routeTemplate = routeTemplate;
  return diagnostics;
}

/** OS/model hints shared by in-app Support, WhatsApp and notification email. Never transmit raw UA. */
const safeOsVersion = (value) => typeof value === 'string' && /^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(value) ? value : null;
const safeDeviceModel = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z][A-Za-z0-9 ._+()-]{1,39}$/.test(text) &&
    !/^(?:K|wv|Mobile|Android|Linux|unknown)$/i.test(text) ? text : null;
};
let cachedDeviceHints = null;
export function detectSupportDevice({ userAgent = '', platform = '', maxTouchPoints = 0, highEntropy = {} } = {}) {
  const ua = String(userAgent).slice(0, 600);
  const plat = String(platform).slice(0, 80);
  const ipad = /\biPad\b/i.test(ua) ||
    ((/MacIntel/i.test(plat) || /\bMacintosh\b/i.test(ua)) && Number(maxTouchPoints) > 1);
  let os = null;
  if (ipad) os = 'ipados';
  else if (/\bAndroid\b/i.test(ua) || /^Android$/i.test(plat)) os = 'android';
  else if (/\biPhone\b|\biPod\b/i.test(ua) || /^iOS$/i.test(plat)) os = 'ios';
  else if (/\bCrOS\b/i.test(ua) || /^Chrome OS$/i.test(plat)) os = 'chromeos';
  else if (/\bWindows\b/i.test(ua) || /^Win/i.test(plat)) os = 'windows';
  else if (/\bMacintosh\b|\bMac OS X\b/i.test(ua) || /^macOS$|^MacIntel$/i.test(plat)) os = 'macos';
  else if (/\bLinux\b/i.test(ua) || /^Linux$/i.test(plat)) os = 'linux';
  const result = {};
  if (os) result.operatingSystem = os;
  const reducedAndroid = /Android\s+10;\s*K\)/i.test(ua);
  let version = null;
  if (os === 'android' && !reducedAndroid) version = safeOsVersion(/\bAndroid\s+(\d+(?:\.\d+){0,2})/i.exec(ua)?.[1]);
  if (os === 'ios' || os === 'ipados') {
    version = safeOsVersion(/\b(?:iPhone )?OS\s+(\d+(?:[_\.]\d+){0,2})/i.exec(ua)?.[1]?.replaceAll('_', '.'));
  }
  // Windows platformVersion is not a Windows marketing release: do not claim 10/11.
  if (['android', 'ios', 'ipados', 'macos'].includes(os)) version = safeOsVersion(highEntropy.platformVersion) ?? version;
  if (version) result.operatingSystemVersion = version;
  if (os === 'android') {
    const uaModel = reducedAndroid ? null :
      /\bAndroid\s+\d+(?:\.\d+)*;\s*([^;)]+?)(?:\s+Build\/[^)]*)?\)/i.exec(ua)?.[1];
    const model = safeDeviceModel(highEntropy.model) ?? safeDeviceModel(uaModel);
    if (model) result.deviceModel = model;
  }
  return result;
}
export function currentSupportDeviceDetails(nav = globalThis.navigator) {
  if (!nav) return {};
  return detectSupportDevice({
    userAgent: nav.userAgent, platform: nav.userAgentData?.platform || nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    highEntropy: cachedDeviceHints?.owner === nav ? cachedDeviceHints.values : {},
  });
}
/** Prime only supported optional hints asynchronously, never inside the WhatsApp click. */
export async function warmSupportDeviceDetails(nav = globalThis.navigator) {
  if (!nav?.userAgentData?.getHighEntropyValues) return;
  try {
    const hints = await nav.userAgentData.getHighEntropyValues(['platformVersion', 'model']);
    if (nav === globalThis.navigator) cachedDeviceHints = { owner: nav, values: {
      platformVersion: safeOsVersion(hints?.platformVersion), model: safeDeviceModel(hints?.model),
    } };
  } catch { /* Optional browser privacy hint not available. */ }
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

  let portal=null;
  try{portal=(await import('./student-portal-runtime.js')).studentPortalDiagnostic();}catch{}
  const payload = {
    id: requestId(),
    type: cleanType,
    message: cleanMessage,
    diagnostics: sanitizeSupportDiagnostics({ ...diagnostics, n88Portal:portal, timestamp: diagnostics.timestamp ?? new Date().toISOString() }),
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
