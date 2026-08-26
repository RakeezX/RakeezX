/** Shared, deliberately small print foundation for administration reports. */

import { html, fmtDateFull } from './dom.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

export function reportHeader({ title, profile, year, term, section, subject, period }) {
  const details = [
    profile?.schoolName && ['المدرسة', profile.schoolName],
    profile?.teacherName && ['المعلم', profile.teacherName],
    subject && ['المادة', subject],
    section && ['الفصل', section],
    year && ['السنة الدراسية', year],
    term && ['الفصل الدراسي', term],
    period && ['الفترة', period],
    ['تاريخ الطباعة', fmtDateFull(todayISO())],
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
  const principal = String(profile?.reportPrincipalName ?? '').trim();
  return html`
    <footer class="print-signatures" dir="rtl">
      <div><span>${teacherLabel}</span>${profile?.teacherName ? html`<strong>${profile.teacherName}</strong>` : ''}</div>
      ${principal ? html`<div><span>مدير المدرسة</span><strong>${principal}</strong></div>` : ''}
    </footer>
  `;
}

export function reportIdentitySheet({ profile, device }) {
  return html`
    <form id="report-identity-form" class="stack stack-3">
      <div class="report-identity__known">
        ${profile?.teacherName ? html`<span>المعلم: <b>${profile.teacherName}</b></span>` : ''}
        ${profile?.schoolName ? html`<span>المدرسة: <b>${profile.schoolName}</b></span>` : ''}
        ${!profile?.teacherName || !profile?.schoolName ? html`<span class="t-3">أكمل بيانات المعلم والمدرسة من الإعدادات عند الحاجة.</span>` : ''}
      </div>
      <label class="field"><span class="field__label">مدير المدرسة <span class="t-3">(اختياري)</span></span>
        <input class="input" name="principalName" maxlength="80" autocomplete="name" value="${device?.reportPrincipalName ?? ''}" placeholder="يظهر في توقيع التقارير عند إدخاله">
      </label>
    </form>
  `;
}
