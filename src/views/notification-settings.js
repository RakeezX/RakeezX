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
const view = {
  title: () => 'الإشعارات',
  render() {
    const context = currentNotificationContext(store, cloud);
    const scope = notificationScope(context);
    const categories = readNotificationCategories(context);
    const timing = readNotificationTiming(context);
    const push = getPushRuntime()?.snapshot();
    const quiet = readPushQuiet(context);
    const eligibilityFlag = key => typeof push?.eligibility?.[key] === 'boolean' ? String(push.eligibility[key]) : 'not_observed';
    return html`<div class="n44-settings-page">
      <a class="btn btn--quiet n44-settings-back" href="#/settings">${icon('back')} الإعدادات</a>
      <div class="n44-settings" data-notification-scope="${scope ?? ''}">
      ${context ? html`
        ${push?.available ? html`<section class="n44-preference card card--pad" aria-label="تذكيرات الجهاز">
          <h2>تذكيرات الجهاز</h2>
          <button type="button" class="btn btn--quiet" data-act="notification-push" data-scope="${scope}">${push.status === 'subscribed' ? 'إيقاف تذكيرات الجهاز' : push.status === 'cleanup_pending' ? 'إعادة محاولة الإيقاف' : 'تفعيل تذكيرات الجهاز'}</button>
          <p role="status">${push.status === 'subscribed' ? 'مفعّلة على هذا الجهاز' : push.status === 'unsubscribed' ? 'غير مفعّلة' : 'لم يكتمل التفعيل'}</p>
          <button type="button" class="btn btn--quiet" role="switch" aria-checked="${String(!!quiet)}" data-act="notification-push-quiet" data-scope="${scope}">هدوء من 10 مساءً إلى 7 صباحًا</button>
        </section>` : push?.eligibility ? html`<section class="n44-preference card card--pad" aria-label="تذكيرات الجهاز">
          <h2>تذكيرات الجهاز</h2>
          <p role="status" data-n44-runtime-ready="${String(push.available === true)}" data-n44-push-eligibility="${Object.hasOwn(eligibilityText, push.eligibility.reason) ? push.eligibility.reason : 'idle'}" data-n44-context-match="${eligibilityFlag('contextMatches')}" data-n44-session-match="${eligibilityFlag('sessionMatches')}" data-n44-workspace-match="${eligibilityFlag('workspaceMatches')}" data-n44-lease-match="${eligibilityFlag('leaseMatches')}" data-n44-consent-match="${eligibilityFlag('consentMatches')}" data-n44-generation-match="${eligibilityFlag('generationMatches')}" data-n44-browser-supported="${eligibilityFlag('browserSupported')}" data-n44-worker-ready="${eligibilityFlag('workerReady')}" data-n44-config-category="${['ready', 'disabled', 'invalid', 'request_failed', 'not_observed'].includes(push.eligibility.configuration) ? push.eligibility.configuration : 'not_observed'}">${eligibilityText[push.eligibility.reason] ?? eligibilityText.idle}</p>
        </section>` : ''}
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
        </section>` : html`<p class="t-3" role="status">تتوفر إعدادات الإشعارات عند فتح مساحة حسابك.</p>`}
      </div>
    </div>`;
  },
  onMount(root) {
    cleanup();
    const previousTitle = document.title;
    document.title = 'الإشعارات — رَكيز المعلم';
    // Discard private DOM synchronously before a workspace/identity can change.
    const clear = () => root.querySelector('.n44-settings')?.replaceChildren();
    const validate = () => {
      const mounted = root.querySelector('[data-notification-scope]');
      if (mounted && mounted.dataset.notificationScope !== notificationScope(currentNotificationContext(store, cloud))) clear();
    };
    const removeWorkspace = store.onWorkspaceDeactivation(clear);
    const removeAuth = cloud.subscribe(validate);
    const removeStore = store.subscribe(validate);
    addEventListener('storage', validate);
    cleanup = () => { document.title = previousTitle; removeWorkspace(); removeAuth(); removeStore(); removeEventListener('storage', validate); };
  },
  onUnmount() { cleanup(); cleanup = () => {}; },
  actions: {
    async 'notification-push'(el) {
      if (el.dataset.scope !== notificationScope(currentNotificationContext(store, cloud))) return;
      const runtime = getPushRuntime();
      if (!runtime?.snapshot().available) return;
      const result = await (['subscribed', 'cleanup_pending'].includes(runtime.snapshot().status) ? runtime.disable() : runtime.optIn());
      if (!['subscribed', 'revoked'].includes(result?.status)) toast('تعذر تفعيل تذكيرات الجهاز', 'warn');
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
