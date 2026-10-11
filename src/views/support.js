/** الدعم — تواصل مباشر وطلب خاص اختياري عبر عقد Production القائم. */

import { html, icon, toast } from '../lib/dom.js';
import { BUILD_META } from '../lib/build-meta.js';
import { currentRejectedSyncGroups, sanitizeSupportDiagnostics, submitSupportRequest, supportEnvironment, currentSupportDeviceDetails, warmSupportDeviceDetails } from '../lib/support.js';
import { supportWhatsAppContact, supportWhatsAppMessage, supportWhatsAppUrl } from '../lib/support-whatsapp.js';
import { SUPPORT_WHATSAPP_CONTACT } from '../lib/support-public-config.js';
import * as cloud from '../lib/cloud.js';
import * as sync from '../lib/sync.js';
import { clearSupportOrigin, supportVisitOrigin } from '../lib/support-origin.js';
import * as store from '../store.js';
import { repaint } from '../repaint.js';

export const SUPPORT_EMAIL = 'support@rakeezx.com';
const whatsappContact = supportWhatsAppContact(SUPPORT_WHATSAPP_CONTACT);

const REQUEST_TYPES = [
  { value: 'inquiry', label: 'أحتاج مساعدة', detail: 'سؤال أو استفسار' },
  { value: 'suggestion', label: 'لدي فكرة أو اقتراح', detail: 'شارك ما يمكن تحسينه' },
  { value: 'technical', label: 'وجدت مشكلة', detail: 'اشرح ما واجهته' },
];

const initialDraft = () => ({
  type: 'technical', message: '',
  submitting: false, success: false, error: '',
});
let draft = initialDraft();
let draftAccountKey = null;
let connectionHandler = null;
let whatsappDiagnostics = null;
let whatsappRefresh = 0;

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

const supportAccountKey = () => `${cloud.user?.id ?? 'signed-out'}|${store.getActiveWorkspace()?.databaseName ?? 'unresolved'}`;

function canUseOwnerDiagnostics(workspace = store.getActiveWorkspace()) {
  return authenticated() && store.state.ready && workspace?.type === 'account' &&
    workspace.ownershipState === 'claimed' && workspace.syncEligible === true &&
    workspace.authUserId === cloud.user.id;
}

async function refreshWhatsAppDiagnostics() {
  const refresh = ++whatsappRefresh;
  whatsappDiagnostics = null;
  const workspace = store.getActiveWorkspace();
  const accountKey = supportAccountKey();
  if (!canUseOwnerDiagnostics(workspace)) return;
  try {
    const summary = await sync.getSyncOperationalSummary();
    if (refresh !== whatsappRefresh || supportAccountKey() !== accountKey ||
        store.getActiveWorkspace() !== workspace || !canUseOwnerDiagnostics(workspace)) return;
    const rejectedGroups = await currentRejectedSyncGroups();
    if (refresh !== whatsappRefresh || supportAccountKey() !== accountKey ||
        store.getActiveWorkspace() !== workspace || !canUseOwnerDiagnostics(workspace)) return;
    whatsappDiagnostics = { accountKey, workspace, summary, rejectedGroups };
  } catch {
    // Optional diagnostics cannot block the external support channel.
  }
}

function currentWhatsAppDiagnostics() {
  const cached = whatsappDiagnostics;
  const ownerSafe = canUseOwnerDiagnostics() && cached?.accountKey === supportAccountKey() &&
    cached.workspace === store.getActiveWorkspace();
  // Never consume the global last-known Sync snapshot across owner/workspace switches.
  const safe = currentSafeSupportDiagnostics(ownerSafe ? cached.summary : {}, ownerSafe ? cached.rejectedGroups : []);
  if (!ownerSafe) {
    for (const key of ['syncState', 'pendingCount', 'failedCount', 'blockedCount', 'rejectedCount',
      'historicalConflictCount', 'actionableSyncIssue', 'lastSuccessfulSyncAt', 'rejectedGroups']) delete safe[key];
  }
  return safe;
}

function pwaStandalone() {
  return !!(window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true || document.referrer?.includes('android-app://'));
}

export function currentSafeSupportDiagnostics(syncSummary = sync.getSyncOperationalSummarySnapshot?.() ?? {}, rejectedGroups = []) {
  const width = window.innerWidth;
  const deviceCategory = width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const browser = browserDetails();
  return sanitizeSupportDiagnostics({
    appVersion: BUILD_META.appVersion,
    buildSha: BUILD_META.buildSha,
    buildShaKind: BUILD_META.buildShaKind,
    buildTimestamp: BUILD_META.buildTimestamp,
    environment: supportEnvironment(window.location?.origin),
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceCategory,
    ...currentSupportDeviceDetails(),
    ...browser,
    mobile: width < 600,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    pwaStandalone: pwaStandalone(),
    online: online(),
    syncState: syncSummary.state ?? sync.displayState().detailStatus,
    pendingCount: syncSummary.pendingCount,
    failedCount: syncSummary.failedCount,
    blockedCount: syncSummary.blockedCount,
    rejectedCount: syncSummary.rejectedCount,
    rejectedGroups,
    historicalConflictCount: syncSummary.historicalConflictCount,
    actionableSyncIssue: syncSummary.actionableSyncIssue,
    lastSuccessfulSyncAt: syncSummary.lastSuccessfulSyncAt ?? sync.state.lastSyncedAt,
    ...supportVisitOrigin(supportAccountKey()),
  });
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
    draftAccountKey = supportAccountKey();
    connectionHandler = () => { void refreshWhatsAppDiagnostics(); repaint(); };
    void refreshWhatsAppDiagnostics();
    void warmSupportDeviceDetails();
    addEventListener('online', connectionHandler);
    addEventListener('offline', connectionHandler);
  },

  onUnmount() {
    if (connectionHandler) {
      removeEventListener('online', connectionHandler);
      removeEventListener('offline', connectionHandler);
    }
    connectionHandler = null;
    clearSupportOrigin();
    draft = initialDraft();
    draftAccountKey = null;
    whatsappDiagnostics = null;
    whatsappRefresh += 1;
  },

  render() {
    if (draftAccountKey !== null && draftAccountKey !== supportAccountKey()) {
      draft = initialDraft();
      draftAccountKey = supportAccountKey();
      clearSupportOrigin();
      void refreshWhatsAppDiagnostics();
    }
    const canSubmit = authenticated() && online();
    return html`<div class="management-page support-page">
      <header class="support-intro">
        <span class="support-intro__icon" aria-hidden="true">${icon('note')}</span>
        <div><h2>كيف يمكننا مساعدتك؟</h2><p>أرسل طلبك من داخل ركيز، أو تواصل عبر البريد أو واتساب.</p></div>
      </header>

      <div class="support-layout">
        <div class="support-contact-rail">
        <section class="surface support-contact" aria-labelledby="support-contact-title">
          <div class="support-section-heading">
            <span class="support-section-heading__icon" aria-hidden="true">${icon('note')}</span>
            <div><h3 id="support-contact-title">تفضّل البريد؟</h3><p>يمكنك التواصل عبر بريد الدعم.</p></div>
          </div>
          <a class="support-email" href="mailto:${SUPPORT_EMAIL}" dir="ltr">${SUPPORT_EMAIL}</a>
          <div class="support-contact__actions">
            <a class="btn btn--quiet" href="mailto:${SUPPORT_EMAIL}">${icon('note')} إرسال بريد</a>
            <button class="btn btn--quiet" type="button" data-act="copy-support-email">${icon('note')} نسخ البريد</button>
          </div>
        </section>

        <section class="surface support-contact support-whatsapp" aria-labelledby="support-whatsapp-title">
          <div class="support-section-heading">
            <span class="support-section-heading__icon" aria-hidden="true">${icon('note')}</span>
            <div><h3 id="support-whatsapp-title">تواصل عبر واتساب</h3><p>مساعدة مباشرة من فريق ركيز.</p></div>
          </div>
          <button class="btn btn--quiet" type="button" data-act="support-whatsapp-open"
            ${whatsappContact ? '' : 'disabled'}>${icon('whatsapp', 'inline')}<span>تواصل عبر الواتساب</span></button>
          ${!whatsappContact ? html`<p class="support-whatsapp__note" role="status">التواصل عبر واتساب غير متاح حاليًا؛ إعداد الرقم الرسمي غير صالح. يمكنك استخدام البريد.</p>` :
            !online() ? html`<p class="support-whatsapp__note" role="status">فتح واتساب يحتاج اتصالًا بالإنترنت. رسالتك في النموذج محفوظة هنا.</p>` : ''}
        </section>
        </div>

        <section class="surface support-request" aria-labelledby="support-request-title">
          <div class="support-section-heading">
            <span class="support-section-heading__icon" aria-hidden="true">${icon('shield')}</span>
            <div><h3 id="support-request-title">أرسل طلب دعم</h3><p>اختر نوع الرسالة، ثم اكتبها.</p></div>
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
              <div class="n34-support-choices" role="group" aria-label="نوع رسالة الدعم">
                ${REQUEST_TYPES.map((type) => html`<button type="button" class="n34-support-choice" data-act="support-type" data-type="${type.value}" aria-pressed="${draft.type === type.value ? 'true' : 'false'}">
                  <strong>${type.label}</strong><small>${type.detail}</small>
                </button>`)}
              </div>
              <input type="hidden" name="type" value="${draft.type}">
              <label class="field">
                <span class="field__label">رسالتك</span>
                <textarea class="textarea" name="message" rows="6" minlength="1" maxlength="4000" required
                  data-input="support-message" placeholder="اكتب ما حدث أو ما الذي تحتاج إليه…">${draft.message}</textarea>
                <span class="support-character-count" data-support-character-count aria-live="polite"><bdi>${draft.message.length}</bdi> / 4000</span>
              </label>

              ${authenticated() ? html`
                <div class="support-diagnostics">
                  <p class="support-diagnostics__disclosure">${icon('shield')}<span>سيُرفق اسم حسابك وبريده الإلكتروني لتمكين فريق الدعم من التواصل معك، إضافةً إلى معلومات تقنية عامة وآمنة، دون بيانات الطلاب أو كلمات المرور.</span></p>
                </div>
              ` : ''}
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
      draft.type = el.dataset.type;
      el.closest('.n34-support-choices')?.querySelectorAll('[data-type]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button === el));
      });
      const input = el.form?.querySelector('input[name="type"]');
      if (input) input.value = draft.type;
    },

    'support-message'(el) {
      draft.message = el.value;
      const counter = el.form?.querySelector('[data-support-character-count]');
      if (counter) counter.innerHTML = `<bdi>${draft.message.length}</bdi> / 4000`;
      const submit = el.form?.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !authenticated() || !online() || !draft.message.trim() || draft.submitting;
    },

    async 'support-submit'(form) {
      if (draft.submitting) return;
      const accountKey = supportAccountKey();
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
        const syncSummary = await sync.getSyncOperationalSummary();
        if (supportAccountKey() !== accountKey) return;
        const rejectedGroups = await currentRejectedSyncGroups();
        if (supportAccountKey() !== accountKey) return;
        await submitSupportRequest({
          type: draft.type,
          message: draft.message,
          diagnostics: currentSafeSupportDiagnostics(syncSummary, rejectedGroups),
        });
        if (supportAccountKey() !== accountKey) return;
        draft = { ...initialDraft(), success: true };
        toast('تم إرسال طلبك بنجاح.');
      } catch (error) {
        if (supportAccountKey() !== accountKey) return;
        draft.error = friendlyError(error);
        draft.submitting = false;
      }
      if (supportAccountKey() !== accountKey) return;
      repaint();
    },

    'support-whatsapp-open'() {
      if (!whatsappContact) return;
      if (!online()) {
        toast('فتح واتساب يحتاج اتصالًا بالإنترنت. رسالتك في النموذج محفوظة هنا.', 'danger');
        return;
      }
      try {
        const text = supportWhatsAppMessage({ type: draft.type, diagnostics: currentWhatsAppDiagnostics() });
        const url = supportWhatsAppUrl(whatsappContact, text);
        // Keep the real user activation: no await or second confirmation before opening.
        if (url && !window.open(url, '_blank', 'noopener,noreferrer')) {
          // noopener can return null even on success; do not claim the popup was blocked.
          toast('إذا لم يفتح واتساب، اسمح بفتح نافذة جديدة ثم حاول مرة أخرى.');
        }
      } catch {
        toast('تعذّر فتح واتساب الآن. يمكنك استخدام بريد الدعم.', 'danger');
      }
      void refreshWhatsAppDiagnostics();
    },
  },
};
