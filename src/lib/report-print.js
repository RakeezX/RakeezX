/** Shared, deliberately small print foundation for administration reports. */

import { html, raw, fmtDateFull } from './dom.js';
import { todayISO } from '../models.js';

export function reportHeader({ title, profile, year, term, section, subject, period, printedOn = todayISO() }) {
  const identity = [
    profile?.teacherName && ['المعلم', profile.teacherName],
    profile?.schoolName && ['المدرسة', profile.schoolName],
  ].filter(Boolean);
  const context = [
    section && ['الفصل', section],
    subject && ['المادة', subject],
    period && ['الفترة', period],
  ].filter(Boolean);
  const academic = [
    year && ['السنة الدراسية', year],
    term && ['الفصل الدراسي', term],
  ].filter(Boolean);
  const metadata = (items, className) => items.length ? html`
    <dl class="printhead__meta ${className}">
      ${items.map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`)}
    </dl>
  ` : '';

  return html`
    <header class="printhead print-report__header" dir="rtl">
      <div class="printhead__brand"><strong>رَكيز <em class="brand-wordmark-secondary">المعلم</em></strong><span>تقارير المعلم</span></div>
      <h2 class="printhead__title">${title}</h2>
      <div class="printhead__details">
        ${metadata(identity, 'printhead__meta--identity')}
        ${metadata(context, 'printhead__meta--context')}
        ${metadata(academic, 'printhead__meta--academic')}
      </div>
      <div class="printhead__date">تاريخ الطباعة <strong>${fmtDateFull(printedOn)}</strong></div>
    </header>
  `;
}

/** Keeps the browser's native print/save-PDF output aligned with the report width. */
export function reportPageSetup({ wide = false } = {}) {
  return raw(`<style data-report-page-size>@media print { @page { size: A4 ${wide ? 'landscape' : 'portrait'}; margin: ${wide ? '10mm' : '12mm'}; } }</style>`);
}

export function reportFooter({ printedOn = todayISO() } = {}) {
  return html`
    <div class="print-report__footer" dir="rtl">
      <span>رَكيز المعلم</span>
      <span>أُنشئ في ${fmtDateFull(printedOn)}</span>
    </div>
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
