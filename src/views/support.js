/** الدعم — تواصل مباشر وطلب خاص اختياري عبر عقد Production القائم. */

import { html, icon, toast } from '../lib/dom.js';
import { BUILD_META } from '../lib/build-meta.js';
import { sanitizeSupportDiagnostics, submitSupportRequest } from '../lib/support.js';
import * as cloud from '../lib/cloud.js';
import * as sync from '../lib/sync.js';
import { currentPath } from '../router.js';
import { repaint } from '../repaint.js';

export const SUPPORT_EMAIL = 'support@rakeezx.com';

const REQUEST_TYPES = [
  { value: 'technical', label: 'مشكلة تقنية' },
  { value: 'suggestion', label: 'اقتراح' },
  { value: 'inquiry', label: 'استفسار' },
];

const DIAGNOSTIC_LABELS = Object.freeze({
  appVersion: 'إصدار التطبيق',
  buildSha: 'معرّف البناء',
  buildTimestamp: 'وقت البناء',
  timestamp: 'وقت الإرسال',
  timezone: 'المنطقة الزمنية',
  deviceCategory: 'فئة الجهاز',
  browser: 'المتصفح',
  browserVersion: 'إصدار المتصفح',
  mobile: 'واجهة جوال',
  viewport: 'حجم العرض التقريبي',
  pwaStandalone: 'وضع التطبيق المثبّت',
  online: 'حالة الاتصال',
  syncState: 'حالة المزامنة العامة',
  pendingMutations: 'تغييرات قيد الانتظار',
  failedMutations: 'تغييرات تعذّر إرسالها',
  lastSuccessfulSyncAt: 'آخر مزامنة ناجحة',
  routeCategory: 'قسم التطبيق',
});

const initialDraft = () => ({
  type: 'technical', message: '', includeDiagnostics: false, previewDiagnostics: false,
  submitting: false, success: false, error: '',
});
let draft = initialDraft();
let connectionHandler = null;

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const authenticated = () => !!(cloud.user && cloud.session);

function browserDetails(userAgent = navigator.userAgent ?? '') {
  const candidates = [
    ['edge', /Edg\/([0-9.]+)/],
    ['chrome', /(?:Chrome|CriOS)\/([0-9.]+)/],
    ['firefox', /(?:Firefox|FxiOS)\/([0-9.]+)/],
    ['safari', /Version\/([0-9.]+).*Safari/],
  ];
  for (const [browser, pattern] of candidates) {
    const match = pattern.exec(userAgent);
    if (match) return { browser, browserVersion: match[1] };
  }
  return { browser: 'other' };
}

function routeCategory(path = currentPath()) {
  if (path === '/') return 'home';
  if (path.startsWith('/classes') || path.startsWith('/teaching/')) return 'classes';
  if (path.startsWith('/student')) return 'students';
  if (path.startsWith('/schedule')) return 'schedule';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/support')) return 'support';
  return 'other';
}

function pwaStandalone() {
  return !!(window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true || document.referrer?.includes('android-app://'));
}

export function currentSafeSupportDiagnostics() {
  const width = window.innerWidth;
  const deviceCategory = width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const browser = browserDetails();
  return sanitizeSupportDiagnostics({
    appVersion: BUILD_META.appVersion,
    buildSha: BUILD_META.buildSha,
    buildTimestamp: BUILD_META.buildTimestamp,
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceCategory,
    ...browser,
    mobile: width < 600,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    pwaStandalone: pwaStandalone(),
    online: online(),
    syncState: sync.displayState().detailStatus,
    lastSuccessfulSyncAt: sync.state.lastSyncedAt,
    routeCategory: routeCategory(),
  });
}

function diagnosticValue(key, value) {
  if (key === 'viewport') return `${value.width} × ${value.height}`;
  if (key === 'online') return value ? 'متصل' : 'غير متصل';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (key.endsWith('Timestamp') || key === 'timestamp' || key === 'lastSuccessfulSyncAt') {
    return new Date(value).toLocaleString('ar-SA');
  }
  if (key === 'buildSha') return value.slice(0, 8);
  return String(value);
}

function diagnosticsPreview(diagnostics) {
  return html`<div class="support-diagnostics-preview" id="support-diagnostics-preview" aria-label="المعلومات التقنية المرفقة">
    <dl>
      ${Object.entries(diagnostics).map(([key, value]) => html`
        <div data-diagnostic-key="${key}">
          <dt>${DIAGNOSTIC_LABELS[key] ?? key}</dt>
          <dd><bdi>${diagnosticValue(key, value)}</bdi></dd>
        </div>
      `)}
    </dl>
  </div>`;
}

function friendlyError(error) {
  if (error?.code === 'AUTH_REQUIRED') return 'يلزم تسجيل الدخول لإرسال طلب دعم من داخل التطبيق.';
  if (error?.code === 'OFFLINE') return 'إرسال الطلب من داخل التطبيق يحتاج اتصالًا بالإنترنت.';
  if (error?.code === 'INVALID_MESSAGE') return 'اكتب رسالة بين 1 و4000 حرف.';
  if (error?.code === 'INVALID_TYPE') return 'اختر نوعًا صالحًا للطلب.';
  return 'تعذّر إرسال الطلب الآن. تحقق من الاتصال وحاول مرة أخرى.';
}

async function copySupportEmail() {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    return;
  }
  const field = document.createElement('textarea');
  field.value = SUPPORT_EMAIL;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

function versionText() {
  const build = BUILD_META.buildSha === 'development' ? 'معاينة محلية' : BUILD_META.buildSha.slice(0, 8);
  return html`الإصدار <bdi>${BUILD_META.appVersion}</bdi><span aria-hidden="true"> · </span>البناء <bdi>${build}</bdi>`;
}

export default {
  title: () => 'الدعم',
  back: () => '#/settings',

  onMount() {
    connectionHandler = () => repaint();
    addEventListener('online', connectionHandler);
    addEventListener('offline', connectionHandler);
  },

  onUnmount() {
    if (connectionHandler) {
      removeEventListener('online', connectionHandler);
      removeEventListener('offline', connectionHandler);
    }
    connectionHandler = null;
    draft = initialDraft();
  },

  render() {
    const canSubmit = authenticated() && online();
    const diagnostics = draft.includeDiagnostics ? currentSafeSupportDiagnostics() : {};
    return html`<div class="management-page support-page">
      <header class="support-intro">
        <span class="support-intro__icon" aria-hidden="true">${icon('note')}</span>
        <div><h2>كيف يمكننا مساعدتك؟</h2><p>اختر البريد المباشر أو أرسل طلبًا خاصًا من داخل التطبيق.</p></div>
      </header>

      <div class="support-layout">
        <section class="surface support-contact" aria-labelledby="support-contact-title">
          <div class="support-section-heading">
            <span class="support-section-heading__icon" aria-hidden="true">${icon('note')}</span>
            <div><h3 id="support-contact-title">تواصل مباشر</h3><p>يمكنك التواصل معنا عبر بريد الدعم في أي وقت.</p></div>
          </div>
          <a class="support-email" href="mailto:${SUPPORT_EMAIL}" dir="ltr">${SUPPORT_EMAIL}</a>
          <div class="support-contact__actions">
            <a class="btn btn--primary" href="mailto:${SUPPORT_EMAIL}">${icon('note')} إرسال بريد</a>
            <button class="btn btn--ghost" type="button" data-act="copy-support-email">${icon('note')} نسخ البريد</button>
          </div>
        </section>

        <section class="surface support-request" aria-labelledby="support-request-title">
          <div class="support-section-heading">
            <span class="support-section-heading__icon" aria-hidden="true">${icon('shield')}</span>
            <div><h3 id="support-request-title">طلب دعم من داخل التطبيق</h3><p>يُرسل الطلب مباشرة وبشكل خاص إلى فريق الدعم.</p></div>
          </div>

          ${!authenticated()
            ? html`<div class="support-availability" role="status">${icon('shield')}<span>يلزم تسجيل الدخول لإرسال طلب دعم من داخل التطبيق.</span></div>`
            : !online()
              ? html`<div class="support-availability" role="status">${icon('cloud')}<span>إرسال الطلب من داخل التطبيق يحتاج اتصالًا بالإنترنت.</span></div>`
              : ''}
          ${draft.success ? html`<div class="support-result is-success" role="status">${icon('check')}<strong>تم إرسال طلبك بنجاح.</strong></div>` : ''}
          ${draft.error ? html`<div class="support-result is-error" role="alert">${icon('note')}<span>${draft.error}</span></div>` : ''}

          <form class="support-form" data-submit="support-submit">
            <fieldset ${canSubmit ? '' : 'disabled'}>
              <label class="field">
                <span class="field__label">نوع الطلب</span>
                <select class="select" name="type" data-change="support-type">
                  ${REQUEST_TYPES.map((type) => html`<option value="${type.value}" ${draft.type === type.value ? 'selected' : ''}>${type.label}</option>`)}
                </select>
              </label>
              <label class="field">
                <span class="field__label">رسالتك</span>
                <textarea class="textarea" name="message" rows="6" minlength="1" maxlength="4000" required
                  data-input="support-message" placeholder="اكتب ما حدث أو ما الذي تحتاج إليه…">${draft.message}</textarea>
                <span class="support-character-count" data-support-character-count aria-live="polite"><bdi>${draft.message.length}</bdi> / 4000</span>
              </label>

              <div class="support-diagnostics">
                <label class="support-diagnostics__toggle">
                  <input type="checkbox" data-change="support-diagnostics" ${draft.includeDiagnostics ? 'checked' : ''}>
                  <span><strong>إرفاق معلومات تقنية آمنة للمساعدة في التشخيص</strong><small>تتضمن معلومات عامة عن التطبيق والجهاز والمزامنة، دون بيانات الطلاب أو كلمات المرور.</small></span>
                </label>
                ${draft.includeDiagnostics ? html`
                  <button class="btn btn--sm btn--quiet support-diagnostics__preview-action" type="button"
                    data-act="support-diagnostics-preview" aria-expanded="${draft.previewDiagnostics}" aria-controls="support-diagnostics-preview">
                    ${draft.previewDiagnostics ? 'إخفاء المعلومات المرفقة' : 'عرض المعلومات المرفقة'}
                  </button>
                  ${draft.previewDiagnostics ? diagnosticsPreview(diagnostics) : ''}
                ` : ''}
              </div>
            </fieldset>
            <button class="btn btn--primary support-submit" type="submit" ${canSubmit && draft.message.trim() && !draft.submitting ? '' : 'disabled'}>
              ${draft.submitting ? 'جارٍ الإرسال…' : 'إرسال'}
            </button>
          </form>
        </section>
      </div>

      <div class="support-version-row">
        <span>${icon('device')} معلومات الإصدار</span>
        <span>${versionText()}</span>
      </div>
    </div>`;
  },

  actions: {
    async 'copy-support-email'() {
      try {
        await copySupportEmail();
        toast('تم نسخ بريد الدعم');
      } catch {
        toast('تعذّر نسخ البريد. يمكنك تحديده ونسخه يدويًا.', 'danger');
      }
    },

    'support-type'(el) {
      draft.type = el.value;
    },

    'support-message'(el) {
      draft.message = el.value;
      const counter = el.form?.querySelector('[data-support-character-count]');
      if (counter) counter.innerHTML = `<bdi>${draft.message.length}</bdi> / 4000`;
      const submit = el.form?.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !authenticated() || !online() || !draft.message.trim() || draft.submitting;
    },

    'support-diagnostics'(el) {
      draft.includeDiagnostics = el.checked;
      draft.previewDiagnostics = false;
      repaint();
    },

    'support-diagnostics-preview'() {
      draft.previewDiagnostics = !draft.previewDiagnostics;
      repaint();
    },

    async 'support-submit'(form) {
      if (draft.submitting) return;
      const data = new FormData(form);
      draft.type = String(data.get('type') ?? draft.type);
      draft.message = String(data.get('message') ?? '');
      draft.error = '';
      draft.success = false;
      draft.submitting = true;
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.textContent = 'جارٍ الإرسال…';
      }
      try {
        await submitSupportRequest({
          type: draft.type,
          message: draft.message,
          diagnostics: draft.includeDiagnostics ? currentSafeSupportDiagnostics() : {},
        });
        draft = { ...initialDraft(), success: true };
        toast('تم إرسال طلبك بنجاح.');
      } catch (error) {
        draft.error = friendlyError(error);
        draft.submitting = false;
      }
      repaint();
    },
  },
};
