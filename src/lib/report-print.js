/** Shared, deliberately small print foundation for administration reports. */

import { html, raw, fmtDateFull, toast } from './dom.js';
import { todayISO } from '../models.js';
import { getAccountPresentation } from './account-profile.js';
import * as store from '../store.js';
import { visibleLatinDigits } from './visible-numerals.js';
import { MINISTRY_LOGO_URL } from './ministry-brand.js';

/** The supplied Ministry artwork, kept at its original aspect ratio. */
export function reportMinistryLogo() {
  return html`<img class="printhead__ministry" data-report-ministry src="${MINISTRY_LOGO_URL}" alt="وزارة التعليم" width="866" height="659" loading="eager" decoding="async" style="display:block;width:92px;max-width:100%;height:auto;object-fit:contain;grid-column:1;grid-row:1;justify-self:start">`;
}

export const isDemoOutput = () => store.getActiveWorkspace()?.type === 'demo';

export function demoOutputMarker({ screenOnly = false } = {}) {
  return isDemoOutput()
    ? html`<span class="demo-output-marker ${screenOnly ? 'noprint' : ''}" data-demo-output-marker>بيانات تجريبية</span>`
    : '';
}

export function markDemoExportRows(rows) {
  return isDemoOutput() ? [['بيانات تجريبية'], ...rows] : rows;
}

export function markDemoSharedText(lines) {
  const visibleLines = lines.map(visibleLatinDigits);
  return isDemoOutput() ? ['بيانات تجريبية', ...visibleLines] : visibleLines;
}

export function reportHeader({ title, profile, year, term, section, subject, period, printedOn = todayISO() }) {
  const identity = [
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
      ${items.map(([label, value]) => html`<div><dt>${label}</dt><dd>${visibleLatinDigits(value)}</dd></div>`)}
    </dl>
  ` : '';

  return html`
    <header class="printhead print-report__header" dir="rtl">
      <div class="printhead__top">
        ${reportMinistryLogo()}
        <h2 class="printhead__title">${visibleLatinDigits(title)}</h2>
        <div class="printhead__brand"><a href="https://rakeezx.com/" target="_blank" rel="noopener noreferrer"><strong>رَكيز <em class="brand-wordmark-secondary">المعلم</em></strong></a></div>
        ${demoOutputMarker()}
      </div>
      <div class="printhead__details">
        ${metadata([...identity, ...academic], 'printhead__meta--identity')}
        ${metadata(context, 'printhead__meta--context')}
        <div class="printhead__timestamp">تاريخ الطباعة: ${visibleLatinDigits(fmtDateFull(printedOn))}</div>
      </div>
    </header>
  `;
}

/** Keeps the browser's native print/save-PDF output aligned with the report width. */
export function reportPageSetup({ wide = false } = {}) {
  return raw(`<style data-report-page-size>
    .printhead__top { position: relative; text-align: center; }
    .printhead__title { text-align: center; }
    .printhead__timestamp { margin-top: 3px; color: #718287; font-size: 9px; text-align: left; }
    .print-report .printhead__brand a { color: inherit; text-decoration: none; }
    .print-report .printhead__title { min-width: 0; overflow-wrap: anywhere; }
    .print-report .printhead__top { grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr); }
    .print-report .printhead__meta {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
      gap: 6px clamp(8px, 2vw, 24px); width: 100%;
    }
    .print-report .printhead__meta > div { display: flex; justify-content: center; align-items: baseline; gap: 4px 8px; }
    .print-report .printhead__meta dt { flex: 0 0 auto; }
    .print-report .printhead__meta dd { min-width: 0; overflow-wrap: anywhere; }
    @media print {
      @page { size: A4 ${wide ? 'landscape' : 'portrait'}; margin: ${wide ? '10mm' : '12mm'}; }
      /* The browser's own decorations have no margin area to occupy. Clone
         INNER spacing on every fragment, including continuation table pages.
         Engines without fragment cloning retain the working page margins. */
      @supports (box-decoration-break: clone) {
        @page { margin: 0; }
        @page :first { margin: 0; }
        body .print-report {
          box-sizing: border-box;
          padding: ${wide ? '10mm' : '12mm'} !important;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
      }
      .print-report .printhead__meta { gap: 2mm 5mm; }
      .printhead__timestamp { font-size: 8pt; }
      .print-signatures > div { text-align: center; justify-items: center; }
    }
  </style>`);
}

/** The print dialog uses the document title for its suggested PDF filename.
 * Use the local creation day, never a student's identity or report date range.
 */
export function reportFilename(title, date = todayISO()) {
  const safe = String(title || 'تقرير').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  return `${safe || 'تقرير'} - ركيز المعلم - ${date}`;
}

/** Await the actual header images so an early print cannot omit the logo. */
export async function prepareReportAssets(root = document) {
  const images = [...root.querySelectorAll('img[data-report-ministry]')];
  await Promise.all([document.fonts?.ready, ...images.map(async image => {
    if (image.complete && image.naturalWidth > 0) return;
    if (typeof image.decode === 'function') await image.decode();
    else {
      if (image.complete) throw new Error('Ministry logo is unavailable');
      await new Promise((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Ministry logo is unavailable')); };
        const cleanup = () => {
          image.removeEventListener('load', loaded);
          image.removeEventListener('error', failed);
        };
        image.addEventListener('load', loaded, { once: true });
        image.addEventListener('error', failed, { once: true });
      });
    }
    if (!image.naturalWidth) throw new Error('Ministry logo is unavailable');
  })]);
}

let pendingReportPrint = null;
export function printReport(title) {
  if (pendingReportPrint) return pendingReportPrint;
  pendingReportPrint = printPreparedReport(title).finally(() => { pendingReportPrint = null; });
  return pendingReportPrint;
}

async function printPreparedReport(title) {
  const root = document.querySelector('.print-report') ?? document.querySelector('.page') ?? document.body;
  const route = location.hash;
  const images = [...root.querySelectorAll('img[data-report-ministry]')];
  try { await prepareReportAssets(root); }
  catch {
    if (!root.isConnected || location.hash !== route) return false;
    toast('تعذّر تحميل شعار الوزارة. أعد المحاولة قبل الطباعة.', 'danger');
    return false;
  }
  if (!root.isConnected || location.hash !== route || images.some(image => !image.isConnected)) return false;
  const originalTitle = document.title;
  const printTitle = reportFilename(title);
  const restore = () => {
    window.removeEventListener('afterprint', restore);
    // An asynchronous print dialog may outlive a route/title change.
    if (document.title === printTitle) document.title = originalTitle;
  };
  document.title = printTitle;
  window.addEventListener('afterprint', restore, { once: true });
  try { window.print(); return true; }
  catch { restore(); toast('تعذّر فتح الطباعة. أعد المحاولة.', 'danger'); return false; }
}

export function reportFooter() {
  return html`
    <div class="print-report__footer" dir="rtl">
      <a href="https://rakeezx.com/" target="_blank" rel="noopener noreferrer">رَكيز المعلم</a>
    </div>
  `;
}

export function reportSignatures({ profile, teacherLabel = null }) {
  const presentation = getAccountPresentation(profile?.teacherForm);
  const principal = resolvedReportPrincipalName(profile);
  return html`
    <footer class="print-signatures" dir="rtl">
      <div><span>${teacherLabel ?? presentation.teacherSubjectLabel}</span>${profile?.teacherName ? html`<strong>${visibleLatinDigits(profile.teacherName)}</strong>` : ''}</div>
      ${principal ? html`<div><span>${presentation.schoolPrincipalLabel}</span><strong>${visibleLatinDigits(principal)}</strong></div>` : ''}
    </footer>
  `;
}

/** Presentation-only: keep the final data row with its signatures on paper.
 * Accept only an already escaped application template, never unescaped values.
 * No rows, cells, order or data values are regenerated by this helper.
 */
export function reportWithClosing(content, options) {
  const closing = html`<div class="report-closing">${reportSignatures(options)}${reportFooter()}</div>`;
  const source = String(content);
  const end = source.lastIndexOf('</tbody>');
  const start = source.lastIndexOf('<tr', end);
  if (end < 0 || start < source.lastIndexOf('<tbody', end)) return html`${content}${closing}`;
  const rowEnd = source.indexOf('</tr>', start) + 5;
  const row = source.slice(start, rowEnd);
  const columns = (row.match(/<(?:td|th)\b/g) ?? []).length;
  if (!columns) return html`${content}${closing}`;
  const bodyStart = source.lastIndexOf('<tbody', start);
  const rowIndex = (source.slice(bodyStart, start).match(/<tr\b/g) ?? []).length + 1;
  const endingClass = rowIndex % 2 === 0 ? ' report-table-ending--even' : '';
  return raw(source.slice(0, start) + '</tbody><tbody class="report-table-ending' + endingClass + '">' + row
    + String(html`<tr class="report-ending-row print-only"><td colspan="${columns}">${closing}</td></tr>`)
    + source.slice(rowEnd));
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
  const presentation = getAccountPresentation(profile?.teacherForm);
  const teacher = profile?.teacherName ?? '';
  const school = profile?.schoolName ?? '';
  const principal = resolvedReportPrincipalName(profile, device);

  return html`
    <form id="pre-print-form" class="stack stack-3">
      <div class="field-row">
        <label class="field" style="margin-bottom:0">
          <span class="field__label">${presentation.teacherNameLabel}</span>
          <input class="input" name="teacherName" maxlength="60" autocomplete="name"
                 value="${teacher}" placeholder="الاسم كما يظهر في التقرير">
        </label>
        <label class="field" style="margin-bottom:0">
          <span class="field__label">${presentation.principalNameLabel} <span class="t-3 fs-xs">(اختياري)</span></span>
          <input class="input" name="principalName" maxlength="80" autocomplete="name"
                 value="${principal}" placeholder="${presentation.schoolPrincipalLabel}">
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
