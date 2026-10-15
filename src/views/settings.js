/** الإعدادات: بيانات المعلّم، والسنوات والفصول الدراسية، والمظهر، والبيانات. */

import { html, icon, openSheet, confirmSheet, toast, fmtDateRange } from '../lib/dom.js';
import { currentNotificationContext } from '../lib/notification-events.js';
import { notificationScope } from '../lib/notification-center.js';
import { LESSON_LEAD_MINUTES, DUE_STAGES, readNotificationTiming, writeNotificationTiming, readNotificationCategories, writeNotificationCategory } from '../lib/notification-state.js';
import { brandLockup } from '../lib/brand.js';
import { BUILD_META } from '../lib/build-meta.js';
import { educationDepartmentComplete, profileAttention } from '../lib/settings-profile-ui.js';
import { EDUCATION_DEPARTMENTS, EDUCATION_DEPARTMENT_OPTIONS, isOfficialEducationDepartment, searchEducationDepartments } from '../lib/education-department-directory.js';
import { currentInstallContext, INSTALL_COPY, openInstallGuide } from '../lib/install-guide-ui.js';
import * as store from '../store.js';
import * as cloud from '../lib/cloud.js';
import * as sync from '../lib/sync.js';
import { repaint } from '../repaint.js';
import { makeYear, makeTerm, YEAR_STATUS, TERM_STATUS, TERM_NAMES, termIndexes } from '../models.js';
import { isSoundEnabled, setSoundEnabled } from '../lib/sound.js';
import { isVisualEffectsEnabled, setVisualEffectsEnabled } from '../lib/effects.js';
import { hasValidYearCalendarConfig } from './calendar.js';
import { wireHijriYearInput } from '../lib/hijri-year-input.js';
import { resolvedReportPrincipalName } from '../lib/report-print.js';
import {
  BETA_ACCESS_LABEL, currentAccountContract, getAccountPresentation, isValidSaudiMobile, normalizeSaudiMobile,
  refreshAccountContract, validateAuthEmailChange,
} from '../lib/account-profile.js';

const THEMES = [
  { v: 'auto',  label: 'حسب النظام', icon: 'settings' },
  { v: 'light', label: 'فاتح',       icon: 'sun' },
  { v: 'dark',  label: 'داكن',       icon: 'moon' },
];

// null applies the initial attention default; later paints respect the user's choice.
let profileExpanded = null;
let emailInstructionsExpanded = false;
let removeProfileAttention = () => {};
let accountContractRequest = 0;
let accountContractUnavailable = false;
// Presentation only: never persisted, and discarded when the rendered owner changes.
let emailChangeView = { ownerId: null, sending: false, pending: '', error: '', sheetOpen: false };
function currentEmailChangeView() {
  const ownerId = cloud.user?.id ?? null;
  if (emailChangeView.ownerId !== ownerId) {
    emailChangeView = { ownerId, sending: false, pending: '', error: '', sheetOpen: false };
  }
  return emailChangeView;
}
let removePhoneInputGuards = () => {};
let removeDepartmentInteraction = () => {};
let closeTeacherSetupImport = () => {};

function applyPhoneInsertion(input, rawText, event) {
  const current = normalizeSaudiMobile(input.value);
  const inserted = normalizeSaudiMobile(rawText);
  const start = input.selectionStart ?? current.length;
  const end = input.selectionEnd ?? start;
  const next = `${current.slice(0, start)}${inserted}${current.slice(end)}`;
  if (!inserted || next.length > 10) {
    event.preventDefault();
    return;
  }
  if (event.type === 'paste' || rawText !== inserted || input.value !== current) {
    event.preventDefault();
    input.value = next;
    const caret = start + inserted.length;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: inserted }));
  }
}

function emailChangeSheet(currentEmail, submit) {
  return openSheet({
    title: 'تغيير البريد الإلكتروني',
    desc: 'سيبقى بريدك الحالي معتمدًا حتى يكتمل التأكيد من البريدين الحالي والجديد.',
    body: html`
      <form id="email-change-form" class="stack stack-3" novalidate>
        <label class="field" style="margin-bottom:0">
          <span class="field__label">البريد الإلكتروني الجديد</span>
          <input class="input" name="newEmail" type="email" maxlength="254" autocomplete="email"
                 inputmode="email" dir="ltr" required autofocus>
        </label>
        <div class="field__error" role="alert" data-email-change-error hidden></div>
        <div class="field__hint" role="status" data-email-change-sending hidden>جارٍ إرسال طلب تغيير البريد… يمكنك إغلاق النافذة ومتابعة استخدام الإعدادات.</div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" type="submit" form="email-change-form">تأكيد التغيير</button>
    `,
    onMount: (root, done) => root.querySelector('#email-change-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = root.querySelector('button[type="submit"]');
      if (button.disabled) return;
      const input = event.currentTarget.elements.newEmail;
      const result = validateAuthEmailChange(input.value, currentEmail);
      const error = root.querySelector('[data-email-change-error]');
      if (!result.valid) {
        error.textContent = result.code === 'EMAIL_UNCHANGED'
          ? 'أدخل بريدًا مختلفًا عن البريد الحالي.'
          : 'أدخل بريدًا إلكترونيًا صالحًا.';
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      error.hidden = true;
      input.removeAttribute('aria-invalid');
      button.disabled = true;
      input.disabled = true;
      button.textContent = 'جارٍ الإرسال…';
      root.querySelector('[data-email-change-sending]').hidden = false;
      const message = await submit(result.email);
      if (!message) { done(result.email); return; }
      error.textContent = message;
      error.hidden = false;
      root.querySelector('[data-email-change-sending]').hidden = true;
      button.disabled = false;
      input.disabled = false;
      button.textContent = 'إعادة المحاولة';
    }),
  });
}

function yearSheet(existing = null) {
  const y = existing ?? { hijriStart: 1448 };
  return openSheet({
    title: existing ? 'تعديل السنة' : 'سنة دراسية جديدة',
    body: html`
      <form id="year-form">
        <label class="field">
          <span class="field__label">بداية السنة الهجرية</span>
          <input class="input tabular" name="hijriStart" type="text" inputmode="numeric" pattern="[0-9]{4}" dir="ltr" min="1300" max="1600"
                 value="${y.hijriStart || 1448}" required ${existing ? 'readonly' : ''}>
          <span class="field__hint">تُسمّى السنة تلقائيًا، مثل 1448-1449.</span>
        </label>
        ${existing
          ? html`
              <div class="field">
                <span class="field__label">الحالة</span>
                <div class="segmented">
                  ${Object.entries(YEAR_STATUS).map(
                    ([k, label]) => html`
                      <label class="segmented__btn ${y.status === k ? 'is-on' : ''}">
                        <input type="radio" name="status" value="${k}" ${y.status === k ? 'checked' : ''} hidden>
                        ${label}
                      </label>
                    `
                  )}
                </div>
                <span class="field__hint">السنة المؤرشفة تبقى كاملة للعرض ولا تُعدَّل بالخطأ.</span>
              </div>
            `
          : ''}
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="year-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      const readHijriYear = wireHijriYearInput(root);
      root.querySelectorAll('.segmented__btn').forEach((b) =>
        b.addEventListener('click', () => {
          root.querySelectorAll('.segmented__btn').forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
          b.querySelector('input').checked = true;
        })
      );
      root.querySelector('#year-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const hijriStart = readHijriYear();
        if (hijriStart === null) return;
        const fd = new FormData(ev.target);
        done({
          hijriStart,
          status: String(fd.get('status') ?? 'active'),
        });
      });
    },
  });
}

function termSheet(existing = null, yearId = null) {
  const t = existing ?? { name: 'الفصل الدراسي الثاني', index: 2, startDate: '', endDate: '', status: 'active' };
  return openSheet({
    title: existing ? 'تعديل الفصل الدراسي' : 'فصل دراسي جديد',
    body: html`
      <form id="term-form">
        <div class="field-row">
          <label class="field">
            <span class="field__label">الاسم</span>
            <input class="input" name="name" value="${t.name}" required maxlength="60" autocomplete="off">
          </label>
          <label class="field">
            <span class="field__label">الترتيب</span>
            <select class="select" name="index">
              ${termIndexes().map(
                (i) => html`<option value="${i}" ${Number(t.index) === i ? 'selected' : ''}>${i}</option>`
              )}
            </select>
          </label>
        </div>
        ${t.startDate && t.endDate ? html`<div class="field"><span class="field__label">مدة الفصل</span><div class="field__hint">${fmtDateRange(t.startDate, t.endDate)} — تُعدّل التواريخ من التقويم الدراسي.</div></div>` : ''}
        <div class="field" style="margin-bottom:0">
          <span class="field__label">الحالة</span>
          <select class="select" name="status">
            ${Object.entries(TERM_STATUS).map(
              ([k, label]) => html`<option value="${k}" ${t.status === k ? 'selected' : ''}>${label}</option>`
            )}
          </select>
          <span class="field__hint">الفصل المنتهي يبقى للعرض ولا تُعدَّل بياناته بالخطأ.</span>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="term-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#term-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;
        done({
          name,
          index: Number(fd.get('index')),
          status: String(fd.get('status') ?? 'active'),
        });
      });
    },
  });
}

function renderResultPanel(title, result) {
  if (!result) return '';
  const rawData = encodeURIComponent(JSON.stringify({ title, ...result }));

  return html`
    <div class="t-3 fs-sm" style="padding: var(--sp-2); border-radius: var(--r-sm); background: var(--bg-sunk); margin-top: -var(--sp-2); position: relative;">
      <button class="btn btn--sm btn--ghost" data-act="copy-result" data-payload="${rawData}" style="position: absolute; top: 4px; left: 4px; padding: 2px 6px; font-size: 11px;">
        نسخ النتيجة
      </button>
      ${result.status === 'success' ? html`
        <div style="color: var(--brand); font-weight: bold; margin-top: 16px;">نجاح</div>
        <div>آخر مزامنة: ${new Date(result.time).toLocaleTimeString('ar-SA-u-nu-latn', { numberingSystem: 'latn' })}</div>
        ${result.stats ? html`
          <div style="margin-top: var(--sp-1); display: grid; grid-template-columns: 1fr auto; gap: 4px; font-size: 13px;">
            ${Object.entries(result.stats).map(([k, v]) => html`
              <span>${k}:</span>
              <span>${v.pushed} ↑ / ${v.pulled} ↓</span>
            `)}
          </div>
        ` : ''}
      ` : result.status === 'error' ? html`
        <div style="color: var(--danger); font-weight: bold; margin-top: 16px;">خطأ</div>
        <div>الرسالة: ${result.error}</div>
      ` : html`
        <div style="max-height: 400px; overflow-y: auto; white-space: pre-wrap; direction: ltr; text-align: left; font-family: monospace; margin-top: 24px;">
          ${result.text}
        </div>
      `}
    </div>
  `;
}

const settings = {
  title: () => 'الإعدادات',

  render() {
    const profile = store.state.profile ?? {};
    const device = store.state.device ?? {};
    const m = {
      ...profile,
      ...device,
      // A blank device fallback must never hide the synced account value.
      reportPrincipalName: resolvedReportPrincipalName(profile, device),
    };
    const yrs = store.years();
    const activeY = store.activeYear();
    const activeT = store.activeTerm();
    const accountContract = currentAccountContract();
    const accountEmail = accountContract?.email ?? cloud.user?.email ?? '';
    const emailView = currentEmailChangeView();
    const pendingEmail = String(cloud.user?.new_email || emailView.pending || '').trim().toLowerCase();
    const emailChangePending = Boolean(pendingEmail && pendingEmail !== String(accountEmail).trim().toLowerCase());
    const teacherForm = m.teacherForm === 'feminine' ? 'feminine' : 'masculine';
    const presentation = getAccountPresentation(teacherForm);
    const accessLabel = accountContract?.access?.label ?? BETA_ACCESS_LABEL;
    const demo = store.getActiveWorkspace()?.type === 'demo';
    const attention = profileAttention({ profile, demo, pendingEmail: emailChangePending, unavailable: accountContractUnavailable, contract: accountContract });
    profileExpanded ??= Boolean(attention);
    const install = currentInstallContext();
    const notificationContext = currentNotificationContext(store, cloud);
    const categories = readNotificationCategories(notificationContext);
    const timing = readNotificationTiming(notificationContext);

    return html`
      <div class="management-page settings-page settings-compact">
      ${demo ? html`
        <div class="section settings-section settings-section--demo" data-demo-settings>
          <div class="section__head"><div class="section__title">الوضع التجريبي</div></div>
          <div class="card card--pad stack stack-3">
            <div><div class="fw-7">بيانات تجريبية محلية</div><div class="t-3 fs-sm">يمكنك تجربة جميع أدوات ركيز دون حساب أو مزامنة سحابية.</div></div>
            <div class="hstack gap-2 wrap">
              <button class="btn btn--ghost" type="button" data-act="demo-reset">إعادة ضبط البيانات التجريبية</button>
              <button class="btn btn--quiet" type="button" data-act="demo-exit">الخروج من التجربة</button>
            </div>
          </div>
        </div>
      ` : ''}
      <div class="section settings-section settings-section--identity">
        <details class="settings-profile card" data-settings-profile ${profileExpanded ? 'open' : ''}>
          <summary class="settings-profile-summary">
            <span class="row__icon">${icon('student')}</span>
            <span class="row__main"><span class="row__title">بياناتك</span><span class="row__sub">${m.teacherName || 'بيانات الحساب والتقارير'}</span><span class="settings-profile-attention" data-profile-attention role="status" ${attention ? '' : 'hidden'}>${attention}</span></span>
            <span class="settings-profile-edit">عرض وتعديل ${icon('chev')}</span>
          </summary>
          <div class="card--pad">
          <form id="me-form" class="management-form settings-identity-form">
            <div class="field-row">
              <label class="field">
                <span class="field__label">${presentation.teacherNameLabel}</span>
                <input class="input" name="teacherName" value="${m.teacherName ?? ''}"
                       maxlength="60" autocomplete="name" data-fk="teacherName"
                       data-change="save" placeholder="الاسم كما يظهر في التقارير">
              </label>
              <div class="field">
                <span class="field__label">صفة المستخدم</span>
                <div class="segmented settings-teacher-form" role="group" aria-label="صفة المستخدم">
                  <button type="button" class="segmented__btn ${teacherForm === 'masculine' ? 'is-on' : ''}"
                          data-act="teacher-form" data-val="masculine" aria-pressed="${teacherForm === 'masculine' ? 'true' : 'false'}">معلم</button>
                  <button type="button" class="segmented__btn ${teacherForm === 'feminine' ? 'is-on' : ''}"
                          data-act="teacher-form" data-val="feminine" aria-pressed="${teacherForm === 'feminine' ? 'true' : 'false'}">معلمة</button>
                </div>
              </div>
            </div>
            <div class="field-row">
              <label class="field">
                <span class="field__label">اسم المدرسة <span class="t-3 fs-xs">(اختياري)</span></span>
                <input class="input" name="schoolName" value="${m.schoolName ?? ''}"
                       maxlength="80" autocomplete="organization" data-fk="schoolName"
                       data-change="save" placeholder="اسم المدرسة">
              </label>
              <div class="field settings-education-department" data-education-department>
                <label class="field__label" for="education-department-combobox">إدارة التعليم</label>
                <div class="settings-education-department__control">
                  <input class="input" id="education-department-combobox" type="text" role="combobox"
                         aria-label="إدارة التعليم" aria-autocomplete="list" aria-expanded="false"
                         aria-controls="education-department-options" autocomplete="off" readonly
                         value="${educationDepartmentComplete(profile) ? m.educationDepartment : ''}"
                         placeholder="اختر إدارة التعليم" data-fk="educationDepartment" data-education-department-combobox>
                  <span class="settings-education-department__chevron" aria-hidden="true">${icon('chev')}</span>
                </div>
                <div class="settings-education-department__popup" data-education-department-popup hidden>
                  <div class="settings-education-department__options" id="education-department-options"
                       role="listbox" aria-label="إدارات التعليم الرسمية">
                    ${EDUCATION_DEPARTMENT_OPTIONS.map(({ shortLabel, canonicalName }, index) => html`
                      <div role="option" id="education-department-option-${index}"
                           data-education-department-option data-index="${index}" tabindex="-1"
                           aria-selected="${m.educationDepartment === canonicalName}">${shortLabel}</div>`)}
                  </div>
                </div>
                ${educationDepartmentComplete(profile) ? '' : html`<span class="field__hint">مطلوبة لإكمال بياناتك.</span>`}
              </div>
            </div>
            <div class="field-row settings-contact-row">
              <label class="field">
                <span class="field__label">${presentation.principalNameLabel} <span class="t-3 fs-xs">(اختياري)</span></span>
                <input class="input" name="reportPrincipalName" value="${m.reportPrincipalName ?? m.principalName ?? ''}"
                       maxlength="80" autocomplete="name" data-fk="reportPrincipalName"
                       data-change="save" placeholder="${presentation.schoolPrincipalLabel} للتقارير">
              </label>
              <label class="field">
                <span class="field__label">رقم الجوال</span>
                <input class="input" name="phone" value="${m.phone ?? ''}" required
                       pattern="05[0-9]{8}" autocomplete="tel" inputmode="numeric" dir="ltr"
                       data-fk="phone" data-input="phone-input" data-change="save" placeholder="05xxxxxxxx"
                       aria-describedby="settings-phone-hint">
                <span class="field__hint" id="settings-phone-hint">خاص ببيانات الحساب ولا يظهر للطلاب.</span>
              </label>
            </div>
            ${demo ? '' : html`<div class="field settings-email-field">
                <span class="field__label">البريد الإلكتروني الحالي</span>
                <div class="settings-email-line">
                  <bdi class="settings-account-summary__value" dir="ltr" data-account-email>${accountEmail || 'غير مسجل الدخول'}</bdi>
                  ${accountEmail && cloud.user ? html`<button class="btn btn--quiet btn--sm settings-email-edit" type="button" data-act="change-email" ${emailView.sending ? 'disabled' : ''}>${emailView.sending ? 'جارٍ الإرسال…' : 'تعديل'}</button>` : ''}
                </div>
                ${emailView.sending ? html`<p class="field__hint" role="status" data-email-change-page-sending>جارٍ إرسال طلب تغيير البريد… يمكنك متابعة استخدام الإعدادات.</p>` : ''}
                ${emailChangePending ? html`
                  <p class="field__hint settings-email-pending" role="status" data-email-change-pending>تغيير البريد قيد التأكيد. بريدك الحالي ما زال معتمدًا.</p>
                  <details class="settings-email-instructions" data-email-change-instructions ${emailInstructionsExpanded ? 'open' : ''}>
                    <summary>كيف أكمل تأكيد البريد؟</summary>
                    <p class="field__hint">أكمل التأكيد من بريدك الحالي والجديد، وتحقق من مجلد الرسائل غير المرغوب فيها. يبقى بريدك الحالي معتمدًا حتى يكتمل التأكيد.</p>
                  </details>
                ` : ''}
                ${emailView.error ? html`<p class="field__error" role="alert" data-email-change-page-error>${emailView.error}</p>` : ''}
              </div>`}
            ${demo ? '' : html`<div class="settings-access-summary" aria-label="معلومات الوصول">
              <span class="settings-account-summary__label">الوصول</span>
              <span class="badge badge--quiet" role="status" aria-label="حالة الوصول" data-account-access>${accountContractUnavailable ? 'تعذر التحقق من حالة الوصول الآن' : accessLabel}</span>
            </div>`}
          </form>
          </div>
        </details>
      </div>


      <div class="section settings-section settings-section--experience">
        <div class="section__head"><h2 class="section__title">المظهر والتفاعل</h2></div>
        <div class="settings-preference-surface">
          ${notificationContext ? html`<section class="n44-settings" aria-label="إشعارات داخل التطبيق">
            <h3>إشعارات داخل التطبيق</h3>
            ${[['lesson', 'تذكيرات الحصص'], ['due', 'تذكيرات تسليم البنود']].map(([kind, label]) => html`
              <div class="settings-preference-row"><span>${label}</span>
                <button type="button" class="btn btn--quiet" role="switch" aria-label="${label}"
                  aria-checked="${String(categories[kind])}" data-act="notification-category" data-kind="${kind}"
                  data-scope="${notificationScope(notificationContext)}">${categories[kind] ? 'مفعّلة' : 'متوقفة'}</button>
              </div>`)}
            <fieldset class="n44-timing"><legend>التذكير قبل الحصة بالدقائق</legend>
              <div class="n44-timing-options" role="group" aria-label="التذكير قبل الحصة بالدقائق">
                ${LESSON_LEAD_MINUTES.map(minutes => html`<button type="button" class="btn btn--quiet" data-act="notification-minutes" data-minutes="${minutes}" data-scope="${notificationScope(notificationContext)}" aria-pressed="${String(timing.lessonMinutes === minutes)}" data-fk="n44-minutes-${minutes}">${minutes}</button>`)}
              </div>
            </fieldset>
            <fieldset class="n44-timing"><legend>تذكيرات موعد التسليم</legend>
              <div class="n44-timing-options">
                ${DUE_STAGES.map(day => html`<button type="button" class="btn btn--quiet" role="switch" data-act="notification-day" data-day="${day}" data-scope="${notificationScope(notificationContext)}" aria-checked="${String(timing.dueDays.includes(day))}" data-fk="n44-day-${day}">${day === 0 ? 'يوم التسليم' : 'قبل التسليم بـ ' + day + ' أيام'}</button>`)}
              </div>
            </fieldset>
            <p class="field__hint">محفوظة لحسابك على هذا الجهاز. تنبيهات حماية البيانات والوصول الضرورية تبقى مفعّلة.</p>
          </section>` : ''}
          <div class="settings-preference-row">
            <div class="settings-preference-row__copy">
              <div class="fw-7">المظهر</div>
              <div class="t-3 fs-sm">اختر المظهر الأنسب لبيئة العمل</div>
            </div>
            <div class="segmented settings-preference-row__control" role="group" aria-label="مظهر التطبيق">
              ${THEMES.map(
                (t) => html`
                  <button type="button" class="segmented__btn ${(m.theme ?? 'auto') === t.v ? 'is-on' : ''}"
                          data-act="theme" data-theme="${t.v}" aria-pressed="${(m.theme ?? 'auto') === t.v ? 'true' : 'false'}">
                    ${icon(t.icon)} ${t.label}
                  </button>
                `
              )}
            </div>
          </div>

          <div class="settings-preference-row">
            <div class="settings-preference-row__copy">
              <div class="fw-7">المؤثرات الصوتية</div>
              <div class="t-3 fs-sm">أصوات تفاعلية أثناء رصد المشاركة والقرعة</div>
            </div>
            <div class="segmented settings-preference-row__control" role="group" aria-label="المؤثرات الصوتية">
              <button type="button" class="segmented__btn ${isSoundEnabled() ? 'is-on' : ''}" data-act="sound" data-val="on" aria-pressed="${isSoundEnabled() ? 'true' : 'false'}">
                ${icon('spark')} تشغيل
              </button>
              <button type="button" class="segmented__btn ${!isSoundEnabled() ? 'is-on' : ''}" data-act="sound" data-val="off" aria-pressed="${!isSoundEnabled() ? 'true' : 'false'}">
                إيقاف
              </button>
            </div>
          </div>

          <div class="settings-preference-row">
            <div class="settings-preference-row__copy">
              <div class="fw-7">المؤثرات البصرية</div>
              <div class="t-3 fs-sm">الحركة واحتفالات الرصد والقرعة</div>
            </div>
            <div class="segmented settings-preference-row__control" role="group" aria-label="المؤثرات البصرية">
              <button type="button" class="segmented__btn ${isVisualEffectsEnabled() ? 'is-on' : ''}" data-act="visual-fx" data-val="on" aria-pressed="${isVisualEffectsEnabled() ? 'true' : 'false'}">
                ${icon('spark')} تشغيل
              </button>
              <button type="button" class="segmented__btn ${!isVisualEffectsEnabled() ? 'is-on' : ''}" data-act="visual-fx" data-val="off" aria-pressed="${!isVisualEffectsEnabled() ? 'true' : 'false'}">
                إيقاف
              </button>
            </div>
          </div>
        </div>
      </div>

      <section class="section settings-section settings-section--destinations">
        <div class="section__head"><h2 class="section__title">البيانات والمساعدة</h2></div>
        <div class="settings-link-group">
          ${!demo ? html`<button class="row settings-destination" type="button" data-act="teacher-setup-import"><span class="row__icon">${icon('upload')}</span><span class="row__main"><span class="row__title">استيراد بيانات مدرستي</span><span class="row__sub">معاينة البيانات وإعداد خطة مراجَعة — دون حفظ</span></span><span class="row__end">${icon('chev')}</span></button>` : ''}
        <a class="row settings-destination" href="#/settings/backup">
          <span class="row__icon">${icon('download')}</span>
          <span class="row__main">
            <span class="row__title">البيانات والنسخ الاحتياطي</span>
            <span class="row__sub">صدّر سجلّك كله في ملف، أو استرجع نسخة سابقة</span>
          </span>
          <span class="row__end">${icon('chev')}</span>
        </a>
        <a class="row settings-destination" href="#/archive">
          <span class="row__icon">${icon('archive')}</span>
          <span class="row__main"><span class="row__title">الأرشيف</span><span class="row__sub">استعراض السنوات والفصول الدراسية المؤرشفة وبياناتها السابقة.</span></span>
          <span class="row__end">${icon('chev')}</span>
        </a>
        <a class="row settings-destination" href="#/support">
          <span class="row__icon">${icon('note')}</span>
          <span class="row__main"><span class="row__title">الدعم</span><span class="row__sub">تواصل بالبريد أو أرسل طلب دعم خاصًا من داخل التطبيق.</span></span>
          <span class="row__end">${icon('chev')}</span>
        </a>
        </div>
      </section>
      <section class="section settings-section settings-section--device">
        <div class="section__head"><h2 class="section__title">على جهازك</h2></div>
        <div class="settings-link-group">
          ${install.state === 'standalone' ? html`<div class="row settings-destination" data-install-state="standalone"><span class="row__icon">${icon('check')}</span><span class="row__main"><span class="row__title">${INSTALL_COPY.standalone[0]}</span><span class="row__sub">${INSTALL_COPY.standalone[1]}</span></span></div>` : html`
          <button class="row settings-destination" type="button" data-act="${install.state === 'native' ? 'pwa-prompt-install' : 'install-guide'}" data-install-state="${install.state}">
            <span class="row__icon">${icon('device')}</span>
            <span class="row__main"><span class="row__title">تثبيت ركيز على جهازك</span><span class="row__sub">${INSTALL_COPY[install.state][1]}</span>${install.state === 'limited' ? html`<span class="row__sub">افتح ركيز في متصفح يدعم التثبيت</span>` : ''}</span>
            <span class="row__end">${install.state === 'native' ? 'تثبيت ركيز' : install.state === 'limited' ? 'اختر جهازك' : icon('chev')}</span>
          </button>`}
          <button class="row settings-destination" type="button" data-act="about-rakeez"><span class="row__icon">${icon('note')}</span><span class="row__main"><span class="row__title">عن ركيز المعلم</span><span class="row__sub">معلومات التطبيق والإصدار</span></span><span class="row__end">${icon('chev')}</span></button>
        </div>
      </section>
      </div>
    `;
  },

  afterPaint(root) {
    removeDepartmentInteraction();
    const department = root.querySelector('[data-education-department]');
    const combo = department.querySelector('[data-education-department-combobox]');
    const popup = department.querySelector('[data-education-department-popup]');
    const options = [...department.querySelectorAll('[data-education-department-option]')];
    let active = -1;
    const visible = () => options.filter((option) => !option.hidden);
    const setActive = (option) => {
      options.forEach((item) => item.classList.toggle('is-active', item === option));
      active = option ? Number(option.dataset.index) : -1;
      if (option) {
        combo.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      } else combo.removeAttribute('aria-activedescendant');
    };
    const filter = () => {
      const matches = new Set(searchEducationDepartments(EDUCATION_DEPARTMENT_OPTIONS, combo.value));
      options.forEach((option) => { option.hidden = !matches.has(EDUCATION_DEPARTMENT_OPTIONS[Number(option.dataset.index)]); });
      setActive(visible()[0] ?? null);
    };
    const close = () => {
      popup.hidden = true;
      combo.readOnly = true;
      combo.setAttribute('aria-expanded', 'false');
      combo.value = store.state.profile?.educationDepartment ?? '';
      setActive(null);
    };
    const open = () => {
      popup.hidden = false;
      combo.readOnly = false;
      combo.setAttribute('aria-expanded', 'true');
      combo.value = '';
      options.forEach((option) => { option.hidden = false; });
      const selected = options.find((option) => option.getAttribute('aria-selected') === 'true');
      setActive(selected ?? options[0]);
      combo.focus();
    };
    const select = async (option) => {
      const educationDepartment = EDUCATION_DEPARTMENT_OPTIONS[Number(option.dataset.index)]?.canonicalName;
      if (!isOfficialEducationDepartment(EDUCATION_DEPARTMENTS, educationDepartment)) return;
      if (await store.patchProfile({ educationDepartment })) {
        toast('حُفظ');
        close();
        repaint();
      }
    };
    const clickCombo = () => { if (popup.hidden) open(); };
    const input = () => { if (!popup.hidden) filter(); };
    const keydown = (event) => {
      if (event.key === 'Escape' && !popup.hidden) { event.preventDefault(); close(); return; }
      if (popup.hidden && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault(); open(); return;
      }
      if (popup.hidden) return;
      const shown = visible();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!shown.length) return;
        const position = shown.findIndex((option) => Number(option.dataset.index) === active);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? shown.length - 1
          : event.key === 'ArrowDown' ? (position + 1) % shown.length
          : (position + shown.length - 1) % shown.length;
        setActive(shown[next]);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const option = options[active];
        if (option && !option.hidden) void select(option);
      }
    };
    const clickOption = (event) => {
      const option = event.target.closest('[data-education-department-option]');
      if (option) void select(option);
    };
    const outside = (event) => { if (!department.contains(event.target) && !popup.hidden) close(); };
    combo.addEventListener('click', clickCombo);
    combo.addEventListener('input', input);
    combo.addEventListener('keydown', keydown);
    popup.addEventListener('click', clickOption);
    document.addEventListener('pointerdown', outside);
    removeDepartmentInteraction = () => {
      combo.removeEventListener('click', clickCombo);
      combo.removeEventListener('input', input);
      combo.removeEventListener('keydown', keydown);
      popup.removeEventListener('click', clickOption);
      document.removeEventListener('pointerdown', outside);
      removeDepartmentInteraction = () => {};
    };
    removeProfileAttention();
    const details = root.querySelector('[data-settings-profile]');
    const notice = root.querySelector('[data-profile-attention]');
    const initialNotice = notice.textContent;
    const revealError = () => {
      if (details.querySelector('[aria-invalid="true"]')) {
        details.open = true;
        notice.hidden = false;
        notice.textContent = 'راجع البيانات غير الصالحة';
      } else {
        notice.textContent = initialNotice;
        notice.hidden = !initialNotice;
      }
    };
    const toggle = () => { revealError(); profileExpanded = details.open; };
    details.addEventListener('toggle', toggle);
    const instructions = root.querySelector('[data-email-change-instructions]');
    const toggleInstructions = () => { emailInstructionsExpanded = instructions.open; };
    instructions?.addEventListener('toggle', toggleInstructions);
    const observer = new MutationObserver(revealError);
    observer.observe(details, { subtree: true, attributes: true, attributeFilter: ['aria-invalid'] });
    removeProfileAttention = () => {
      observer.disconnect();
      details.removeEventListener('toggle', toggle);
      instructions?.removeEventListener('toggle', toggleInstructions);
    };
    removePhoneInputGuards();
    const phone = root.querySelector('input[name="phone"]');
    const beforeInput = (event) => {
      if (!event.inputType?.startsWith('insert') || event.inputType === 'insertFromPaste' || event.data == null) return;
      applyPhoneInsertion(phone, event.data, event);
    };
    const paste = (event) => applyPhoneInsertion(phone, event.clipboardData?.getData('text') ?? '', event);
    phone?.addEventListener('beforeinput', beforeInput);
    phone?.addEventListener('paste', paste);
    removePhoneInputGuards = () => {
      phone?.removeEventListener('beforeinput', beforeInput);
      phone?.removeEventListener('paste', paste);
      removePhoneInputGuards = () => {};
    };
  },

  onMount() {
    const request = ++accountContractRequest;
    accountContractUnavailable = false;
    if (!cloud.session || !cloud.user) return;
    refreshAccountContract()
      .then(() => { if (request === accountContractRequest) repaint(); })
      .catch(() => {
        if (request !== accountContractRequest) return;
        accountContractUnavailable = true;
        repaint();
      });
  },

  onUnmount() {
    closeTeacherSetupImport();
    removeDepartmentInteraction();
    removeProfileAttention();
    profileExpanded = null;
    emailInstructionsExpanded = false;
    removePhoneInputGuards();
    accountContractRequest += 1;
  },

  actions: {
    async 'teacher-setup-import'() {
      const workspace = store.getActiveWorkspace();
      const { openTeacherSetupImport } = await import('./teacher-setup-import.js');
      if (store.getActiveWorkspace() !== workspace || !location.hash.startsWith('#/settings')) return;
      closeTeacherSetupImport();
      closeTeacherSetupImport = openTeacherSetupImport();
    },
    async 'teacher-form'(el) {
      const teacherForm = el.dataset.val === 'feminine' ? 'feminine' : 'masculine';
      if (await store.patchProfile({ teacherForm })) {
        toast('حُفظ');
        repaint();
      }
    },

    async 'change-email'() {
      const currentEmail = currentAccountContract()?.email ?? cloud.user?.email ?? '';
      if (!currentEmail || !cloud.user?.id) return;
      const view = currentEmailChangeView();
      if (view.sending || view.sheetOpen) return;
      const ownerId = cloud.user.id;
      view.sheetOpen = true;
      try {
        await emailChangeSheet(currentEmail, async (nextEmail) => {
          if (currentEmailChangeView() !== view || cloud.user?.id !== ownerId) return '';
          if (view.sending) return 'جارٍ إرسال الطلب السابق.';
          view.sending = true;
          view.error = '';
          repaint();
          try {
            const updated = await cloud.updateCurrentUserEmail(nextEmail);
            if (updated.id !== ownerId) {
              throw Object.assign(new Error('Auth owner changed unexpectedly'), { code: 'AUTH_OWNER_MISMATCH' });
            }
            if (currentEmailChangeView() !== view) return '';
            view.pending = updated.new_email || nextEmail;
            return '';
          } catch (error) {
            if (currentEmailChangeView() !== view) return '';
            view.error = error?.message || 'تعذر طلب تغيير البريد الإلكتروني. حاول مرة أخرى.';
            return view.error;
          } finally {
            view.sending = false;
            if (currentEmailChangeView() === view) repaint();
          }
        });
      } finally { view.sheetOpen = false; }
    },

    'phone-input'(el) {
      const normalized = normalizeSaudiMobile(el.value);
      if (el.value !== normalized) el.value = normalized;
      el.removeAttribute('aria-invalid');
    },

    'install-guide'() {
      return openInstallGuide(() => settings.actions['pwa-prompt-install']());
    },

    'about-rakeez'() {
      return openSheet({ title: 'عن ركيز المعلم', body: html`<div class="stack stack-2 settings-about-details">
        ${brandLockup({ prominent: true })}
        <div class="fw-7">مساحة العمل الرقمية للمعلم</div>
        <div class="t-2 fs-sm">أقل وقت للإدارة. أكثر وقت للتعليم.</div>
        <div class="t-3 fs-sm">بياناتك وسجلاتك محفوظة محليًا على جهازك لسرعة العمل والخصوصية، مع دعم المزامنة السحابية الآمنة واستمرارية السجلات عبر أجهزتك.</div>
        <div class="t-3 fs-xs" data-about-version>الإصدار ${BUILD_META.appVersion}</div>
      </div>` });
    },

    async 'pwa-prompt-install'() {
      if (window.deferredInstallPrompt) {
        window.deferredInstallPrompt.prompt();
        try {
          const { outcome } = await window.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            toast('جارٍ تثبيت تطبيق رَكيز المعلم...');
            window.deferredInstallPrompt = null;
            repaint();
          }
        } catch {
          // ignore prompt cancellation
        }
      } else {
        toast('اتبع الخطوات الموضحة لجهازك لتثبيت التطبيق');
      }
    },
    async 'copy-result'(el) {
      const payload = JSON.parse(decodeURIComponent(el.dataset.payload));
      let text = `--- ${payload.title} ---\n`;
      if (payload.status === 'success') {
        text += `الحالة: نجاح\n`;
        text += `آخر مزامنة: ${new Date(payload.time).toLocaleTimeString('ar-SA-u-nu-latn', { numberingSystem: 'latn' })}\n`;
        if (payload.stats) {
          for (const [k, v] of Object.entries(payload.stats)) {
            text += `${k}: ${v.pushed} ↑ / ${v.pulled} ↓\n`;
          }
        }
      } else if (payload.status === 'error') {
        text += `الحالة: خطأ\n`;
        text += `الرسالة: ${payload.error}\n`;
      } else if (payload.text) {
        text += payload.text;
      }

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        toast('تم نسخ النتيجة');
      } catch (err) {
        toast('تعذر النسخ', 'danger');
      }
    },

    async 'cloud-in'(el, ev) {
      ev.preventDefault();
      const fd = new FormData(el);
      const email = fd.get('email');
      const pwd = fd.get('password');
      if (!email || !pwd) return;
      const btn = el.querySelector('button[type="submit"]');
      const prev = btn.textContent;
      try {
        btn.textContent = 'جارٍ الاتصال...';
        btn.disabled = true;
        await cloud.signIn(email, pwd);
        toast('تم تسجيل الدخول بنجاح');
      } catch (err) {
        btn.textContent = prev;
        btn.disabled = false;
        toast(err.message, 'danger');
      }
    },

    async 'cloud-out'() {
      const protectedAccountWorkspace = store.getActiveWorkspace()?.type === 'account';
      try {
        if (protectedAccountWorkspace) await sync.suspendForWorkspaceDeactivation();
        await cloud.signOut();
        toast('تم تسجيل الخروج');
        if (protectedAccountWorkspace) {
          store.deactivateWorkspace('explicit-logout');
          globalThis.location?.reload();
        }
      } catch (error) {
        if (protectedAccountWorkspace) sync.resumeAfterWorkspaceDeactivationFailure();
        throw error;
      }
    },

    async 'sync-now'(el) {
      if (sync.state.status === 'syncing') return;
      const ok = await sync.syncAll({ full: true });
      if (!ok) toast('تعذرت المزامنة', 'danger');
    },
    async 'sync-structural'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncStructural();
      if (sync.state.results.structural?.status === 'error') {
        toast('تعذرت المزامنة الهيكلية', 'danger');
      }
    },

    async 'sync-students'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncStudents();
      if (sync.state.results.students?.status === 'error') {
        toast('تعذرت مزامنة الطلاب والانتساب', 'danger');
      }
    },

    async 'sync-notes'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncNotes();
      if (sync.state.results.notes?.status === 'error') {
        toast('تعذرت مزامنة ملاحظات الطلاب', 'danger');
      }
    },

    async 'sync-scoring'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncScoring();
      if (sync.state.results.scoring?.status === 'error') {
        toast('تعذرت مزامنة التقييم والدرجات', 'danger');
      }
    },

    async 'sync-timetable'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncTimetable();
      if (sync.state.results.timetable?.status === 'error') {
        toast('تعذرت مزامنة الجدول والجلسات', 'danger');
      }
    },

    async save(el) {
      const val = el.value.trim();
      if (el.name === 'phone') {
        const phone = normalizeSaudiMobile(val);
        el.value = phone;
        if (!isValidSaudiMobile(phone)) {
          el.setAttribute('aria-invalid', 'true');
          toast('أدخل رقم جوال يبدأ بـ 05 ويتكوّن من 10 أرقام', 'danger');
          return;
        }
        el.removeAttribute('aria-invalid');
        if (await store.patchProfile({ phone })) toast('حُفظ');
        return;
      }
      if (el.name === 'reportPrincipalName' || el.name === 'principalName') {
        await store.patchProfile({ reportPrincipalName: val, principalName: val });
        await store.patchDevice({ reportPrincipalName: val });
        toast('حُفظ');
      } else {
        if (await store.patchProfile({ [el.name]: val })) toast('حُفظ');
      }
    },

    async theme(el) {
      await store.patchDevice({ theme: el.dataset.theme });
      store.applyTheme();
    },

    'notification-minutes'(el) {
      const context = currentNotificationContext(store, cloud);
      if (!context || el.dataset.scope !== notificationScope(context)) return;
      if (!writeNotificationTiming(context, { lessonMinutes: Number(el.dataset.minutes) })) toast('تعذر حفظ توقيت الإشعارات على هذا الجهاز', 'warn');
      repaint();
    },
    'notification-day'(el) {
      const context = currentNotificationContext(store, cloud), day = Number(el.dataset.day);
      if (!context || el.dataset.scope !== notificationScope(context) || !DUE_STAGES.includes(day)) return;
      const days = readNotificationTiming(context).dueDays;
      if (!writeNotificationTiming(context, { dueDays: days.includes(day) ? days.filter(value => value !== day) : [...days, day] })) toast('تعذر حفظ توقيت الإشعارات على هذا الجهاز', 'warn');
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
      repaint();
    },

    sound(el) {
      const enabled = el.dataset.val === 'on';
      setSoundEnabled(enabled);
      toast(enabled ? 'تم تفعيل المؤثرات الصوتية' : 'تم إيقاف المؤثرات الصوتية');
      repaint();
    },

    'visual-fx'(el) {
      const enabled = el.dataset.val === 'on';
      setVisualEffectsEnabled(enabled);
      toast(enabled ? 'تم تفعيل المؤثرات البصرية' : 'تم إيقاف المؤثرات البصرية');
      repaint();
    },

    async 'use-year'(el) {
      const targetYearId = el.dataset.id;
      if (!hasValidYearCalendarConfig(targetYearId)) {
        toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
        return;
      }
      const terms = store.termsOf(targetYearId);
      await store.patchDevice({ activeYearId: targetYearId, activeTermId: terms[0]?.id ?? null });
      toast('تغيّرت السنة الحالية');
    },

    async 'use-term'(el) {
      const t = store.getTerm(el.dataset.id);
      if (!t || !t.startDate || !t.endDate) {
        toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
        return;
      }
      const targetYearId = t.yearId ?? store.activeYear()?.id;
      if (!hasValidYearCalendarConfig(targetYearId)) {
        toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
        return;
      }
      await store.patchDevice({ activeTermId: el.dataset.id, activeYearId: targetYearId });
      toast('تغيّر الفصل الدراسي الحالي');
    },

    async 'add-year'() {
      const data = await yearSheet();
      if (!data?.hijriStart) return;
      const y = makeYear({ hijriStart: data.hijriStart });
      if (store.getYear(y.id)) {
        toast('هذه السنة موجودة', 'danger');
        return;
      }
      const ok1 = await store.save({ years: [y] });
      const ok2 = await store.save({ terms: [makeTerm({ yearId: y.id, index: 1, status: 'active' })] });
      if (ok1 && ok2) toast('تم إضافة سنة دراسية بنجاح');
    },

    async 'edit-year'(el) {
      const y = store.getYear(el.dataset.id);
      if (!y) return;
      const data = await yearSheet(y);
      if (!data) return;
      await store.patch('years', y.id, { status: data.status });
      toast('حُفظت');
    },

    async 'add-term'(el) {
      const yId = el.dataset.year;
      const existing = store.termsOf(yId);
      const nextIndex = Math.max(0, ...existing.map((t) => t.index ?? 0)) + 1;
      const data = await termSheet(
        { name: `الفصل الدراسي ${TERM_NAMES[nextIndex] ?? nextIndex}`,
          index: nextIndex, startDate: '', endDate: '', status: 'active' },
        yId
      );
      if (!data) return;
      const t = makeTerm({ yearId: yId, ...data });
      if (store.getTerm(t.id)) {
        toast('يوجد فصل دراسي بهذا الترتيب', 'danger');
        return;
      }
      const ok = await store.save({ terms: [t] });
      if (ok) toast('تم إضافة فصل دراسي بنجاح');
    },

    async 'edit-term'(el) {
      const t = store.getTerm(el.dataset.id);
      if (!t) return;
      const data = await termSheet(t, t.yearId);
      if (!data) return;
      // الترتيب جزء من المعرّف، فلا يُعدَّل بعد الإنشاء
      const { index, status, ...rest } = data;
      if (t.status === 'closed') {
        toast('الفصل الدراسي المغلق محفوظ للقراءة فقط.', 'warn');
        return;
      }
      if (status === 'closed') {
        const confirmed = await confirmSheet({
          title: 'إغلاق الفصل الدراسي وتثبيت تقاريره؟',
          desc: 'يتطلب الإغلاق مزامنة مكتملة واتصالًا بالإنترنت. ستُحفظ حقيقة التقارير الحالية كنسخة ثابتة لا تتغير لاحقًا.',
          confirmLabel: 'إغلاق وتثبيت التقارير',
        });
        if (!confirmed) return;
        try {
          const changed = Object.fromEntries(Object.entries(rest).filter(([key, value]) => value !== t[key]));
          if (Object.keys(changed).length) await store.patch('terms', t.id, changed);
          await sync.finalizeClosedTermReport(t.id);
          toast('أُغلق الفصل الدراسي وثُبّتت تقاريره');
        } catch (error) {
          toast(error?.message ?? 'تعذّر تثبيت تقارير الفصل الدراسي', 'danger');
        }
        return;
      }
      await store.patch('terms', t.id, { ...rest, status });
      toast('حُفظ');
    },
  },
};

export default settings;
