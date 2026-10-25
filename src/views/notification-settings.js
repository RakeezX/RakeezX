/** Owner-scoped notification preferences; delivery stays in the existing engine. */
import { html, icon, toast } from '../lib/dom.js';
import * as store from '../store.js';
import * as cloud from '../lib/cloud.js';
import { repaint } from '../repaint.js';
import { currentNotificationContext } from '../lib/notification-events.js';
import { notificationScope } from '../lib/notification-center.js';
import { getPushRuntime, readPushQuiet, writePushQuiet } from '../lib/notification-push-runtime.js';
import { LESSON_LEAD_MINUTES, DUE_STAGES, readNotificationTiming, writeNotificationTiming, readNotificationCategories, writeNotificationCategory } from '../lib/notification-state.js';

let cleanup = () => {};
let mountedRoot = null;
let supportScope = null;
let outcomeView = null, outcomeEpoch = 0;
const dayLabels = { 3: 'قبل 3 أيام', 2: 'قبل يومين', 1: 'قبل يوم', 0: 'يوم التسليم' };
const eligibilityText = {
  "idle": "تذكيرات الجهاز غير جاهزة حاليًا.",
  "disabled": "تذكيرات الجهاز غير متاحة حاليًا.",
  "account_unavailable": "يتطلب تفعيل التذكيرات اتصالًا صالحًا بمساحة الحساب.",
  "checking_configuration": "جارٍ التحقق من جاهزية تذكيرات الجهاز.",
  "checking_context": "جارٍ التحقق من جاهزية تذكيرات الجهاز.",
  "checking_service_worker": "جارٍ التحقق من جاهزية تذكيرات الجهاز.",
  "configuration_disabled": "تذكيرات الجهاز غير متاحة لهذه المساحة حاليًا.",
  "configuration_invalid": "تعذر التحقق من إعداد تذكيرات الجهاز.",
  "request_unavailable": "تعذر تحميل إعداد تذكيرات الجهاز.",
  "binding_changed": "تغير اتصال الحساب أثناء التحقق من الجاهزية.",
  "browser_unsupported": "المتصفح لا يدعم تذكيرات الجهاز.",
  "context_unavailable": "تعذر التحقق من سياق تذكيرات الجهاز.",
  "service_worker_unavailable": "خدمة تذكيرات الجهاز في المتصفح غير جاهزة.",
  "cleanup_pending": "تعذر إكمال إيقاف سابق لتذكيرات الجهاز.",
  "ready": "تذكيرات الجهاز غير جاهزة حاليًا."
};
const verificationText = {
  confirmed: 'تأكد تفويض التذكير الحالي. هذا لا يثبت الإرسال أو الوصول.',
  rejected: 'رُفض التحقق من التذكير الحالي.',
  unknown: 'UNKNOWN — نتيجة التحقق غير معروفة. لن تُعاد المحاولة تلقائيًا.',
  pending: 'حفظ المصدر لم يُؤكد بعد. لم يُطلب تفويض التذكير.',
  cleanup_confirmed: 'تأكد إيصال حذف المصدر والعناصر التابعة.',
};
const configResultText = {
  ready: 'تأكد إعداد تذكيرات الجهاز. هذا لا يثبت الاشتراك أو الإرسال أو الوصول.',
  disabled: eligibilityText.configuration_disabled,
  invalid: eligibilityText.configuration_invalid,
  request_failed: eligibilityText.request_unavailable,
};
const deviceOutcomeText = {
  received: 'استُقبلت رسالة التذكير في المتصفح.',
  'display-requested': 'طُلب عرض إشعار على الجهاز.',
  'display-accepted': 'قبل المتصفح طلب عرض الإشعار.',
  'display-failed': 'رفض المتصفح طلب عرض الإشعار.',
  unknown: 'نتيجة العرض غير معروفة.',
};
const viewContext = () => ({scope:notificationScope(currentNotificationContext(store,cloud)),workspace:store.getActiveWorkspace(),session:cloud.session,runtime:getPushRuntime()});
const sameOutcomeContext = value => {
  const current=viewContext();
  return current.scope!=null&&value?.scope===current.scope&&value.workspace===current.workspace&&value.session===current.session&&value.runtime===current.runtime;
};
const finiteOutcome = value => value&&Object.hasOwn(deviceOutcomeText,value.stage)&&
  (value.minute===null||Number.isSafeInteger(value.minute)&&value.minute>=0&&value.minute*60000<=Date.now()+60000)&&[true,false,null].includes(value.present)
  ? {stage:value.stage,minute:value.minute,present:value.present}:null;
function deviceOutcomeSection(push,scope) {
  const value=outcomeView?.value;
  return html`<section class="n44-preference card card--pad" aria-label="نتيجة استقبال الجهاز">
    <h2>نتيجة استقبال الجهاز</h2>
    <p>هذه نتيجة من المتصفح؛ لا تثبت ظهور إشعار مرئي على شاشة Windows.</p>
    ${push?.deviceOutcomeAvailable ? html`<button type="button" class="btn btn--quiet" data-act="notification-device-outcome" data-scope="${scope}" ${outcomeView?.pending?'disabled':''}>قراءة نتيجة استقبال الجهاز</button>`:html`<p>لا تتوفر نتيجة استقبال مرتبطة بهذا الحساب والجهاز.</p>`}
    ${outcomeView ? html`<div role="status" data-n44-device-outcome>
      <p>${outcomeView.pending?'جارٍ قراءة النتيجة من المتصفح…':value?deviceOutcomeText[value.stage]:'نتيجة استقبال الجهاز غير متاحة أو غير معروفة.'}</p>
      ${value?html`<p>${value.minute===null?'وقت الاستقبال غير معروف.':html`وقت النتيجة التقريبي: ${new Date(value.minute*60000).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}`}</p>
        <p>${value.present===true?'يوجد إشعار مسجّل في المتصفح.':value.present===false?'لا يظهر إشعار مسجّل في المتصفح الآن.':'تعذر تحديد وجود إشعار مسجّل في المتصفح.'}</p>`:''}
    </div>`:''}
  </section>`;
}
function normalEvidence(ui, scope) {
  if (!ui) return '';
  return html`<section class="n44-preference card card--pad" aria-label="التحقق من التذكيرات">
    <h2>التحقق من التذكيرات الحالية</h2>
    <p>تفعيل الجهاز يعني الاشتراك فقط. التحقق لا يرسل إشعارًا ولا يثبت وصوله.</p>
    <p role="status" data-n44-verification-ready="${String(ui.canVerify)}">${ui.canVerify ? 'جاهز للتحقق من تذكير حالي محفوظ.' : 'التحقق يتطلب اشتراكًا صالحًا وسياق الحساب الحالي.'}</p>
    ${ui.reminders.length ? ui.reminders.map(r => html`<article style="overflow-wrap:anywhere">
      <h3>${r.title}</h3><p>${r.body}</p>
      <details><summary>هوية التذكير</summary><dl><dt>معرّف الحدث</dt><dd dir="ltr">${r.id}</dd>
        <dt>معرّف المصدر</dt><dd dir="ltr">${r.targetId}</dd><dt>البند</dt><dd dir="ltr">${r.itemId ?? '—'}</dd>
        <dt>التدريس</dt><dd dir="ltr">${r.teachingId}</dd></dl></details>
      <button type="button" class="btn btn--quiet" data-act="notification-verify" data-choice="${r.token}" data-scope="${scope}"
        ${!ui.canVerify || ui.verifying || ui.verification?.token === r.token && ui.verification.status === 'unknown' ? 'disabled' : ''}>التحقق من هذا التذكير</button>
      ${ui.verification?.token === r.token ? html`<p role="status" data-n44-verification="${ui.verification.status}">${verificationText[ui.verification.status]}</p>
        ${ui.verification.authorization ? html`<details open><summary>إيصال التحقق</summary><dl data-n44-authorization-receipt>
          <dt>HTTP / التفويض / عدد الطلبات</dt><dd dir="ltr">${ui.verification.authorization.httpStatus ?? 'UNKNOWN'} / ${ui.verification.authorization.authorizationStatus ?? 'UNKNOWN'} / ${ui.verification.authorization.attempts ?? 0}</dd>
          <dt>إقرار المصدر</dt><dd dir="ltr">${ui.verification.sourceStamp}</dd>
          <dt>اشتراك الجهاز</dt><dd dir="ltr">${ui.verification.registrationId}</dd>
          <dt>حفظ المصدر / ربط الخدمة / وجود الاشتراك / الموافقة</dt><dd dir="ltr">${String(ui.verification.canonicalAck)} / ${String(ui.verification.workerBindingMatches)} / ${String(ui.verification.subscriptionPresent)} / ${String(ui.verification.consentTrue)}</dd>
        </dl></details>` : ''}` : ''}
    </article>`) : html`<p>لا يوجد تذكير حالي ضمن المواعيد والتفضيلات المعتمدة.</p>`}
    <h3>حالة مصادر تذكيرات التسليم</h3>
    ${sourceRows(ui.sources.filter(r => !r.deleted), ui, scope)}
    ${ui.sources.some(r => r.deleted) ? html`<details class="n44-deleted-sources" data-n44-deleted-sources>
      <summary>مصادر سابقة محذوفة (${ui.sources.filter(r => r.deleted).length})</summary>
      ${sourceRows(ui.sources.filter(r => r.deleted), ui, scope)}
    </details>` : ''}
  </section>`;
}
function sourceRows(rows, ui, scope) {
  return html`${rows.map(r => html`<article style="overflow-wrap:anywhere" data-n44-source="${r.parentId}">
      <h4>${r.name}${r.deleted ? ' — محذوف' : ''}</h4>
      <details ${ui.sourceStatus?.token === r.token ? 'open' : ''}><summary>هوية المصدر وإقرار الحفظ</summary><dl>
        <dt>الحساب</dt><dd dir="ltr">${r.ownerId}</dd><dt>المساحة</dt><dd dir="ltr">${r.workspaceId}</dd>
        <dt>الجهاز</dt><dd dir="ltr">${r.deviceId}</dd><dt>البند</dt><dd dir="ltr">${r.parentId}</dd>
        <dt>العناصر التابعة</dt><dd dir="ltr">${r.childIds.join(' / ')}</dd>
        <dt>التدريس / الفصل الدراسي / العام / الشعبة / المادة</dt><dd dir="ltr">${[r.teachingId, r.termId, r.yearId, r.sectionId, r.subjectId].join(' / ')}</dd>
      </dl>
      <button type="button" class="btn btn--quiet" data-act="notification-source-status" data-choice="${r.token}" data-scope="${scope}">قراءة حالة المصدر</button>
      ${ui.sourceStatus?.token === r.token ? html`<p role="status" data-n44-source-status="${ui.sourceStatus.status}">${ui.sourceStatus.status === 'confirmed' ? 'تأكد حفظ هوية المصدر وإصداراته في الحساب. هذا لا يعني تفويض التذكير.' : verificationText[ui.sourceStatus.status]}</p>
        ${ui.sourceStatus.canonical ? html`<p>إصدارات الحفظ المؤكدة: <span dir="ltr">${[ui.sourceStatus.canonical.parent, ...ui.sourceStatus.canonical.children].map(v => `${v.id}: ${v.revision}`).join(' / ')}</span></p>` : ''}
        ${ui.sourceStatus.cleanupReceipt ? html`<dl data-n44-cleanup-receipt><dt>عملية الحذف / النتيجة</dt><dd>${ui.sourceStatus.cleanupReceipt.command} / ${ui.sourceStatus.cleanupReceipt.outcome}</dd>
          <dt>معرّف الإيصال</dt><dd dir="ltr">${ui.sourceStatus.cleanupReceipt.mutationId}</dd>
          <dt>الهدف / الجهاز / ختم الحذف</dt><dd dir="ltr">${ui.sourceStatus.cleanupReceipt.targetId} / ${ui.sourceStatus.cleanupReceipt.deviceId} / ${ui.sourceStatus.cleanupReceipt.clientUpdatedAt}</dd></dl>` : ''}` : ''}
      </details>
    </article>`)}`;
}
const view = {
  title: () => 'الإشعارات',
  render() {
    const context = currentNotificationContext(store, cloud);
    const scope = notificationScope(context);
    if(outcomeView&&(!sameOutcomeContext(outcomeView.context)||!getPushRuntime()?.snapshot().deviceOutcomeAvailable)){outcomeView=null;++outcomeEpoch;}
    // Preserve an explicit disclosure choice only while the mounted context matches.
    const supportOpen = scope != null && supportScope === scope &&
      mountedRoot?.querySelector('[data-n44-support]')?.open === true;
    supportScope = scope;
    const categories = readNotificationCategories(context);
    const timing = readNotificationTiming(context);
    const push = getPushRuntime()?.snapshot();
    const quiet = readPushQuiet(context);
    const permission = globalThis.Notification?.permission;
    const permissionLabel = permission === 'granted' ? 'مسموح بها' : permission === 'denied' ? 'محظورة' : permission === 'default' ? 'لم تُمنح بعد' : 'غير مدعومة';
    const ui = context ? getPushRuntime()?.normalUiSnapshot() : null;
    const eligibilityFlag = key => typeof push?.eligibility?.[key] === 'boolean' ? String(push.eligibility[key]) : 'not_observed';
    return html`<div class="n44-settings-page">
      <a class="btn btn--quiet n44-settings-back" href="#/settings">${icon('back')} الإعدادات</a>
      <div class="n44-settings" data-notification-scope="${scope ?? ''}">
      ${context ? html`
        <header class="n44-settings-intro">
          <h1>الإشعارات</h1>
          <p>الجرس يعرض إشعاراتك داخل رَكيز، وتذكيرات الجهاز تنبّهك حتى عند إغلاقه إذا كانت مفعّلة.</p>
        </header>
        ${push?.preferenceStopped && push.status !== 'cleanup_pending' ? html`<p role="status">أُوقفت تذكيرات الجهاز بعد تعديل التفضيلات. تُطبّق التفضيلات الجديدة عند توفر التفعيل مجددًا.</p>` : ''}
        ${push?.available || push?.cleanupAvailable ? html`<section class="n44-preference card card--pad" aria-label="تذكيرات الجهاز">
          <h2>تذكيرات الجهاز</h2>
          <button type="button" class="btn btn--quiet" data-act="notification-push" data-scope="${scope}" ${push.cleanupBusy ? 'disabled' : ''}>${push.status === 'subscribed' ? 'إيقاف تذكيرات الجهاز' : push.status === 'cleanup_pending' ? 'إعادة محاولة الإيقاف' : 'تفعيل تذكيرات الجهاز'}</button>
          <p role="status">${push.status === 'subscribed' ? 'مفعّلة على هذا الجهاز' : push.status === 'cleanup_pending' ? 'لم يكتمل الإيقاف. أعد المحاولة.' : push.status === 'unsubscribed' ? 'غير مفعّلة' : 'لم يكتمل التفعيل'}</p>
        </section>` : push?.eligibility ? html`<section class="n44-preference card card--pad" aria-label="تذكيرات الجهاز">
          <h2>تذكيرات الجهاز</h2>
          <p role="status" data-n44-runtime-ready="${String(push.available === true)}" data-n44-push-eligibility="${Object.hasOwn(eligibilityText, push.eligibility.reason) ? push.eligibility.reason : 'idle'}" data-n44-context-match="${eligibilityFlag('contextMatches')}" data-n44-session-match="${eligibilityFlag('sessionMatches')}" data-n44-workspace-match="${eligibilityFlag('workspaceMatches')}" data-n44-lease-match="${eligibilityFlag('leaseMatches')}" data-n44-consent-match="${eligibilityFlag('consentMatches')}" data-n44-generation-match="${eligibilityFlag('generationMatches')}" data-n44-browser-supported="${eligibilityFlag('browserSupported')}" data-n44-worker-ready="${eligibilityFlag('workerReady')}" data-n44-config-category="${['ready', 'disabled', 'invalid', 'request_failed', 'not_observed'].includes(push.eligibility.configuration) ? push.eligibility.configuration : 'not_observed'}">${eligibilityText[push.eligibility.reason] ?? eligibilityText.idle}</p>
        </section>` : ''}
        <p class="n44-device-permission">إذن إشعارات المتصفح: ${permissionLabel}.</p>
        <section class="n44-preference card card--pad" aria-labelledby="n44-lesson-heading">
          <div class="n44-preference-heading">
            <h2 id="n44-lesson-heading">تذكيرات الحصص</h2>
            <button type="button" class="n44-switch" role="switch" aria-label="تذكيرات الحصص"
              aria-checked="${String(categories.lesson)}" data-act="notification-category" data-kind="lesson"
              data-scope="${scope}" data-fk="n44-category-lesson"><span aria-hidden="true"></span></button>
          </div>
          ${categories.lesson ? html`<div class="n44-timing">
            <h3 id="n44-minutes-heading">التذكير قبل الحصة بالدقائق</h3>
            <div class="n44-timing-options n44-minute-grid" role="group" aria-labelledby="n44-minutes-heading">
              ${LESSON_LEAD_MINUTES.map(minutes => html`<button type="button" class="btn btn--quiet"
                data-act="notification-minutes" data-minutes="${minutes}" data-scope="${scope}"
                aria-pressed="${String(timing.lessonMinutes === minutes)}" data-fk="n44-minutes-${minutes}">${minutes}</button>`)}
            </div>
          </div>` : ''}
        </section>
        <section class="n44-preference card card--pad" aria-labelledby="n44-due-heading">
          <div class="n44-preference-heading">
            <h2 id="n44-due-heading">تذكيرات تسليم البنود</h2>
            <button type="button" class="n44-switch" role="switch" aria-label="تذكيرات تسليم البنود"
              aria-checked="${String(categories.due)}" data-act="notification-category" data-kind="due"
              data-scope="${scope}" data-fk="n44-category-due"><span aria-hidden="true"></span></button>
          </div>
          ${categories.due ? html`<div class="n44-timing">
            <h3 id="n44-days-heading">التذكير بموعد التسليم</h3>
            <div class="n44-timing-options n44-day-grid" role="group" aria-labelledby="n44-days-heading">
              ${[0, 1, 2, 3].map(day => html`<button type="button" class="btn btn--quiet" role="switch"
                data-act="notification-day" data-day="${day}" data-scope="${scope}"
                aria-checked="${String(timing.dueDays.includes(day))}" data-fk="n44-day-${day}">${dayLabels[day]}</button>`)}
            </div>
          </div>` : ''}
        </section>
        <section class="n44-preference card card--pad" aria-labelledby="n44-quiet-heading">
          <h2 id="n44-quiet-heading">وقت الهدوء</h2>
          <button type="button" class="btn btn--quiet" role="switch" aria-checked="${String(!!quiet)}" data-act="notification-push-quiet" data-scope="${scope}" ${!push?.available ? 'disabled' : ''}>من 10 مساءً إلى 7 صباحًا</button>
          ${!push?.available ? html`<p>يمكن تعديل وقت الهدوء عند توفر تذكيرات الجهاز.</p>` : ''}
        </section>
        <p class="n44-settings-saved" role="status">تُحفظ تفضيلاتك على هذا الجهاز تلقائيًا.</p>
        ${ui?.verification && ['unknown', 'rejected', 'pending'].includes(ui.verification.status) ? html`<p role="status">${verificationText[ui.verification.status]}</p>` : ''}
        ${ui?.sourceStatus && ['unknown', 'rejected', 'pending'].includes(ui.sourceStatus.status) ? html`<p role="status">${verificationText[ui.sourceStatus.status]}</p>` : ''}
        <details class="n44-support card card--pad" data-n44-support ${supportOpen ? 'open' : ''}>
          <summary data-fk="n44-support">الدعم الفني</summary>
          <div class="n44-support-content">
            ${deviceOutcomeSection(push,scope)}
        <details class="n44-preference card card--pad" data-n44-current-identity style="overflow-wrap:anywhere">
          <summary>هوية الحساب والجهاز الحالي</summary>
          <p>سياق الحساب المحلي الحالي. لا يثبت موافقة الخدمة أو تفعيل التذكيرات أو وصولها.</p>
          <dl><dt>الحساب</dt><dd dir="ltr">${context.ownerId}</dd><dt>المساحة</dt><dd dir="ltr">${context.workspaceId}</dd><dt>الجهاز</dt><dd dir="ltr">${context.deviceId}</dd></dl>
        </details>
        ${push?.configOutcome ? html`<details class="n44-preference card card--pad" data-n44-config-outcome style="overflow-wrap:anywhere">
          <summary>نتيجة التحقق من إعداد تذكيرات الجهاز</summary>
          <dl><dt>HTTP</dt><dd dir="ltr">${Number.isInteger(push.configOutcome.httpStatus) && push.configOutcome.httpStatus >= 100 && push.configOutcome.httpStatus <= 599 ? push.configOutcome.httpStatus : 'UNKNOWN'}</dd>
          <dt>المرحلة</dt><dd dir="ltr">${['request', 'transport', 'http', 'response_read', 'response_size', 'decode', 'shape', 'context', 'deadline', 'complete'].includes(push.configOutcome.phase) ? push.configOutcome.phase : 'request'}</dd>
          ${push.configOutcome.servicePhase ? html`<dt>مرحلة الخدمة (وصف عام)</dt><dd dir="ltr" data-n44-config-service-phase>${push.configOutcome.servicePhase}</dd>` : ''}
          <dt>النتيجة</dt><dd>${configResultText[push.eligibility?.configuration] ?? eligibilityText.idle}</dd></dl>
        </details>` : ''}
            ${normalEvidence(ui, scope)}
          </div>
        </details>` : html`<p class="t-3" role="status">تتوفر إعدادات الإشعارات عند فتح مساحة حسابك.</p>`}
      </div>
    </div>`;
  },
  onMount(root) {
    cleanup();
    mountedRoot = root;
    const previousTitle = document.title;
    document.title = 'الإشعارات — رَكيز المعلم';
    // Discard private DOM synchronously before a workspace/identity can change.
    const clearOutcome = () => {outcomeView=null;++outcomeEpoch;root.querySelector('[data-n44-device-outcome]')?.remove();};
    const clear = () => { clearOutcome(); supportScope = null; root.querySelector('.n44-settings')?.replaceChildren(); };
    const validate = () => {
      clearOutcome();
      const mounted = root.querySelector('[data-notification-scope]');
      if (mounted && (mounted.dataset.notificationScope !== notificationScope(currentNotificationContext(store, cloud)) ||
          mounted.querySelector('[data-n44-config-outcome]') && !getPushRuntime()?.snapshot().configOutcome)) clear();
    };
    const removeWorkspace = store.onWorkspaceDeactivation(clear);
    const removeAuth = cloud.subscribe(validate);
    const removeStore = store.subscribe(validate);
    addEventListener('storage', validate);
    cleanup = () => { document.title = previousTitle; removeWorkspace(); removeAuth(); removeStore(); removeEventListener('storage', validate); };
  },
  onUnmount() { cleanup(); cleanup = () => {}; mountedRoot = null; supportScope = null; outcomeView=null;++outcomeEpoch; },
  actions: {
    async 'notification-device-outcome'(el) {
      const context=viewContext(),runtime=context.runtime;
      if(el.dataset.scope!==context.scope||!el.closest('[data-n44-support]')?.open||!runtime?.snapshot().deviceOutcomeAvailable)return;
      const epoch=++outcomeEpoch;outcomeView={context,pending:true};repaint();
      let value=null;try{value=await runtime.deviceOutcome();}catch{}
      if(epoch!==outcomeEpoch||!sameOutcomeContext(context)||!runtime.snapshot().deviceOutcomeAvailable)return;
      outcomeView={context,pending:false,value:finiteOutcome(value)};repaint();
    },
    async 'notification-verify'(el) {
      if (el.dataset.scope !== notificationScope(currentNotificationContext(store, cloud))) return;
      await getPushRuntime()?.verifyReminder(el.dataset.choice); repaint();
    },
    async 'notification-source-status'(el) {
      if (el.dataset.scope !== notificationScope(currentNotificationContext(store, cloud))) return;
      el.disabled = true;
      try { await getPushRuntime()?.readSourceStatus(el.dataset.choice); repaint(); }
      finally { if (el.isConnected) el.disabled = false; }
    },
    async 'notification-push'(el) {
      if (el.dataset.scope !== notificationScope(currentNotificationContext(store, cloud))) return;
      const runtime = getPushRuntime();
      if (!runtime?.snapshot().available && !runtime?.snapshot().cleanupAvailable) return;
      outcomeView=null;++outcomeEpoch;mountedRoot?.querySelector('[data-n44-device-outcome]')?.remove();
      const result = await (['subscribed', 'cleanup_pending'].includes(runtime.snapshot().status) ? runtime.disable() : runtime.optIn());
      if (!['subscribed', 'revoked'].includes(result?.status)) toast(result?.status === 'cleanup_pending' ? 'لم يكتمل إيقاف تذكيرات الجهاز. أعد المحاولة.' : 'تعذر تفعيل تذكيرات الجهاز', 'warn');
      repaint();
    },
    async 'notification-push-quiet'(el) {
      const context = currentNotificationContext(store, cloud);
      if (!context || el.dataset.scope !== notificationScope(context) || !getPushRuntime()?.snapshot().available) return;
      if (writePushQuiet(context, readPushQuiet(context) ? null : { start: 1320, end: 420 })) await getPushRuntime().preferencesChanged();
      repaint();
    },
    'notification-minutes'(el) {
      const context = currentNotificationContext(store, cloud);
      if (!context || el.dataset.scope !== notificationScope(context)) return;
      if (!writeNotificationTiming(context, { lessonMinutes: Number(el.dataset.minutes) })) toast('تعذر حفظ توقيت الإشعارات على هذا الجهاز', 'warn');
      void getPushRuntime()?.preferencesChanged();
      repaint();
    },
    'notification-day'(el) {
      const context = currentNotificationContext(store, cloud), day = Number(el.dataset.day);
      if (!context || el.dataset.scope !== notificationScope(context) || !DUE_STAGES.includes(day)) return;
      const days = readNotificationTiming(context).dueDays;
      if (!writeNotificationTiming(context, { dueDays: days.includes(day) ? days.filter(value => value !== day) : [...days, day] })) toast('تعذر حفظ توقيت الإشعارات على هذا الجهاز', 'warn');
      void getPushRuntime()?.preferencesChanged();
      repaint();
    },
    'notification-category'(el) {
      const context = currentNotificationContext(store, cloud);
      if (!context || el.dataset.scope !== notificationScope(context)) return;
      const kind = el.dataset.kind;
      if (!['lesson', 'due'].includes(kind)) return;
      if (!writeNotificationCategory(context, kind, !readNotificationCategories(context)[kind])) {
        toast('تعذر حفظ تفضيل الإشعارات على هذا الجهاز', 'warn');
      }
      void getPushRuntime()?.preferencesChanged();
      repaint();
    },

  },
};
export default view;
