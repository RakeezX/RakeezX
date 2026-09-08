/** Shared, deliberately small print foundation for administration reports. */

import { html, fmtDateFull } from './dom.js';
import { todayISO } from '../models.js';

export function reportHeader({ title, profile, year, term, section, subject, period, printedOn = todayISO() }) {
  const details = [
    profile?.schoolName && ['المدرسة', profile.schoolName],
    profile?.teacherName && ['المعلم', profile.teacherName],
    subject && ['المادة', subject],
    section && ['الفصل', section],
    year && ['السنة الدراسية', year],
    term && ['الفصل الدراسي', term],
    period && ['الفترة', period],
    ['تاريخ الطباعة', fmtDateFull(printedOn)],
  ].filter(Boolean);

  return html`
    <header class="printhead print-report__header" dir="rtl">
      <div class="printhead__brand">رَكيز X</div>
      <h2 class="printhead__title">${title}</h2>
      <dl class="printhead__meta">
        ${details.map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`)}
      </dl>
    </header>
  `;
}

export function reportSignatures({ profile, teacherLabel = 'معلم المادة' }) {
  const principal = resolvedReportPrincipalName(profile);
  return html`
    <footer class="print-signatures" dir="rtl">
      <div><span>${teacherLabel}</span>${profile?.teacherName ? html`<strong>${profile.teacherName}</strong>` : ''}</div>
      ${principal ? html`<div><span>مدير المدرسة</span><strong>${principal}</strong></div>` : ''}
    </footer>
  `;
}

/**
 * The account profile is canonical when it contains a principal name. A
 * device-local value is only a fallback for older/offline profiles.
 */
export function resolvedReportPrincipalName(profile, device) {
  const synced = String(profile?.reportPrincipalName ?? '').trim()
    || String(profile?.principalName ?? '').trim();
  return synced || String(device?.reportPrincipalName ?? '').trim();
}

export function prePrintConfirmationSheet({ profile, device }) {
  const teacher = profile?.teacherName ?? '';
  const school = profile?.schoolName ?? '';
  const principal = resolvedReportPrincipalName(profile, device);

  return html`
    <form id="pre-print-form" class="stack stack-3">
      <div class="field-row">
        <label class="field" style="margin-bottom:0">
          <span class="field__label">اسم المعلم</span>
          <input class="input" name="teacherName" maxlength="60" autocomplete="name"
                 value="${teacher}" placeholder="الاسم كما يظهر في التقرير">
        </label>
        <label class="field" style="margin-bottom:0">
          <span class="field__label">اسم المدير <span class="t-3 fs-xs">(اختياري)</span></span>
          <input class="input" name="principalName" maxlength="80" autocomplete="name"
                 value="${principal}" placeholder="مدير المدرسة">
        </label>
      </div>
      <label class="field" style="margin-bottom:0">
        <span class="field__label">اسم المدرسة</span>
        <input class="input" name="schoolName" maxlength="80" autocomplete="off"
               value="${school}" placeholder="اسم المدرسة">
      </label>
    </form>
  `;
}

export function reportIdentitySheet({ profile, device }) {
  return prePrintConfirmationSheet({ profile, device });
}
