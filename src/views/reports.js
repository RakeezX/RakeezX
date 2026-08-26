/** تقارير الفصل: كشوف الطلاب والحضور والدرجات، للطباعة أو CSV. */

import { html, icon, toast, fmtNum, fmtPct, fmtDate, fmtDateFull, openSheet } from '../lib/dom.js';
import * as store from '../store.js';
import {
  itemScore, studentTotal, masteryBand, ATTENDANCE, ATTENDANCE_ORDER,
} from '../models.js';
import { downloadCSV } from '../lib/export.js';
import { reportHeader, reportIdentitySheet, reportSignatures } from '../lib/report-print.js';
import { repaint } from '../repaint.js';

let tab = 'grades'; // roster | grades | attendance | support

const reportTitle = () => ({ roster: 'كشف الطلاب', attendance: 'كشف الحضور', grades: 'كشف الدرجات' }[tab] ?? 'تقرير الفصل');
const safeName = (value) => String(value ?? 'فصل').replace(/[\\/:*?"<>|]/g, '-');

function identity(cls) {
  const section = store.getSection(cls.sectionId);
  const term = store.getTerm(cls.termId);
  const year = store.getYear(term?.yearId);
  return {
    profile: { ...store.state.profile, reportPrincipalName: store.state.device?.reportPrincipalName ?? '' },
    year: year?.label ?? '', term: term?.name ?? '',
    section: store.sectionLabel(section) ?? '', subject: store.getSubject(cls.subjectId)?.name ?? '',
  };
}

export default {
  title: () => 'التقارير',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() { tab = 'grades'; },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    const { roster, items, ctx } = store.teachingContext(cls.id);
    if (!roster.length) return html`
      <div class="empty"><div class="empty__icon">${icon('reports')}</div><div class="empty__title">لا بيانات بعد</div><a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a></div>`;

    const header = reportHeader({ title: reportTitle(), ...identity(cls) });
    return html`
      <article class="print-report print-report--${tab}" dir="rtl">
        ${header}
        <div class="segmented mb-3 noprint" aria-label="أنواع التقارير">
          <button class="segmented__btn ${tab === 'roster' ? 'is-on' : ''}" data-act="tab" data-tab="roster">الطلاب</button>
          <button class="segmented__btn ${tab === 'grades' ? 'is-on' : ''}" data-act="tab" data-tab="grades">الدرجات</button>
          <button class="segmented__btn ${tab === 'attendance' ? 'is-on' : ''}" data-act="tab" data-tab="attendance">الحضور</button>
          <button class="segmented__btn ${tab === 'support' ? 'is-on' : ''}" data-act="tab" data-tab="support">من يحتاج دعمًا</button>
        </div>
        ${tab === 'roster' ? rosterReport(roster) : ''}
        ${tab === 'grades' ? gradesReport(roster, items, ctx) : ''}
        ${tab === 'attendance' ? attendanceReport(cls, roster, ctx) : ''}
        ${tab === 'support' ? supportReport(roster, items, ctx) : ''}
        ${tab !== 'support' ? reportSignatures({ profile: identity(cls).profile }) : ''}
        <div class="btn-row mt-6 noprint report-actions">
          <button class="btn btn--ghost" data-act="identity">${icon('edit')} بيانات التقرير والطباعة</button>
          ${tab !== 'support' ? html`<button class="btn btn--primary" data-act="print">${icon('print')} طباعة</button><button class="btn btn--ghost" data-act="csv">${icon('download')} تصدير CSV</button>` : ''}
        </div>
      </article>
    `;
  },

  actions: {
    tab(el) { tab = el.dataset.tab; repaint(); },
    print() { window.print(); },
    async identity() {
      const value = await openSheet({
        title: 'بيانات التقرير والطباعة',
        desc: 'بيانات المعلم والمدرسة تأتي من الإعدادات. مدير المدرسة اختياري ومحفوظ على هذا الجهاز.',
        body: reportIdentitySheet({ profile: store.state.profile, device: store.state.device }),
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" form="report-identity-form">حفظ</button>`,
        onMount: (root, done) => root.querySelector('#report-identity-form').addEventListener('submit', (event) => {
          event.preventDefault(); done(String(new FormData(event.currentTarget).get('principalName') ?? '').trim());
        }),
      });
      if (value === undefined) return;
      const saved = await store.patchDevice({ reportPrincipalName: value });
      toast(saved ? 'حُفظت بيانات التقرير' : 'تعذّر حفظ بيانات التقرير', saved ? undefined : 'danger');
    },
    csv(el, ev, params) {
      const cls = store.getTeaching(params.id);
      const { roster, items, ctx } = store.teachingContext(params.id);
      const safe = safeName(store.sectionLabel(store.getSection(cls?.sectionId)));
      if (tab === 'roster') {
        downloadCSV(`طلاب-${safe}.csv`, [['رقم الكشف', 'الطالب'], ...roster.map((s) => [s.rollNo ?? '', s.name])]);
        toast('نُزّل كشف الطلاب'); return;
      }
      if (tab === 'attendance') {
        const dates = store.sessionDates(params.id).slice().reverse();
        const rows = [['رقم الكشف', 'الطالب', ...dates.map((d) => fmtDateFull(d)), 'الغياب', 'التأخر']];
        for (const s of roster) {
          const records = ctx[s.id].attendance;
          const byDate = new Map(records.map((a) => [a.date, a.status]));
          rows.push([s.rollNo ?? '', s.name, ...dates.map((d) => byDate.has(d) ? ATTENDANCE[byDate.get(d)].label : ''), records.filter((a) => a.status === 'absent').length, records.filter((a) => a.status === 'late').length]);
        }
        downloadCSV(`حضور-${safe}.csv`, rows); toast('نُزّل كشف الحضور'); return;
      }
      const rows = [['رقم الكشف', 'الطالب', ...items.map((i) => `${i.name} (${i.max})`), 'المجموع', 'النسبة']];
      for (const s of roster) {
        const total = studentTotal(items, ctx[s.id]);
        rows.push([s.rollNo ?? '', s.name, ...items.map((i) => { const value = itemScore(i, ctx[s.id]); return value === null ? '' : fmtNum(value); }), fmtNum(total.earned), total.pct === null ? '' : Math.round(total.pct)]);
      }
      downloadCSV(`درجات-${safe}.csv`, rows); toast('نُزّل كشف الدرجات');
    },
  },
};

function rosterReport(roster) {
  return html`<div class="tablewrap print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th>اسم الطالب</th></tr></thead><tbody>${roster.map((s, index) => html`<tr><td class="tabular">${s.rollNo ?? index + 1}</td><th>${s.name}</th></tr>`)}</tbody></table></div>`;
}

function gradesReport(roster, items, ctx) {
  const totalMax = items.reduce((n, i) => n + i.max, 0);
  return html`<div class="tablewrap scroll-x print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th class="gtable__sticky">الطالب</th>${items.map((i) => html`<th>${i.name}<span class="gtable__max tabular">${i.max}</span></th>`)}<th>المجموع<span class="gtable__max tabular">${totalMax}</span></th><th>النسبة</th></tr></thead><tbody>${roster.map((s) => { const total = studentTotal(items, ctx[s.id]); const band = masteryBand(total.pct); return html`<tr><td class="tabular t-3">${s.rollNo ?? ''}</td><th class="gtable__sticky"><a href="#/student/${s.id}">${s.name}</a></th>${items.map((i) => { const value = itemScore(i, ctx[s.id]); return html`<td class="tabular ${value === null ? 't-3' : ''}">${value === null ? '—' : fmtNum(value)}</td>`; })}<td class="tabular fw-7">${fmtNum(total.earned)}</td><td><span class="badge ${band.badge} tabular">${fmtPct(total.pct)}</span></td></tr>`; })}</tbody></table></div>`;
}

function attendanceReport(cls, roster, ctx) {
  const dates = store.sessionDates(cls.id);
  if (!dates.length) return html`<div class="empty"><div class="empty__icon">${icon('attendance')}</div><div class="empty__title">لم يُرصد حضور بعد</div><a class="btn btn--primary noprint" href="#/teaching/${cls.id}/attendance">${icon('attendance')} ابدأ الرصد</a></div>`;
  const shown = dates.slice(0, 20).reverse();
  return html`<p class="t-3 fs-sm mb-3 noprint">${dates.length} يومًا مرصودًا${dates.length > 20 ? ' — يُعرض آخر ٢٠ يومًا، والتصدير يشملها كلها' : ''}.</p><div class="tablewrap scroll-x print-tablewrap"><table class="gtable gtable--report"><thead><tr><th class="gtable__sticky">الطالب</th>${shown.map((d) => html`<th class="att-col">${fmtDate(d, false)}</th>`)}${ATTENDANCE_ORDER.map((k) => html`<th>${ATTENDANCE[k].label}</th>`)}</tr></thead><tbody>${roster.map((s) => { const byDate = new Map(ctx[s.id].attendance.map((a) => [a.date, a.status])); const tally = { present: 0, late: 0, excused: 0, absent: 0 }; for (const a of ctx[s.id].attendance) tally[a.status] = (tally[a.status] ?? 0) + 1; return html`<tr><th class="gtable__sticky"><span class="gtable__roll tabular">${s.rollNo ?? ''}</span>${s.name}</th>${shown.map((d) => { const state = byDate.get(d); return html`<td class="att-cell ${state ? 'is-' + state : ''}">${state ? ATTENDANCE[state].short : ''}</td>`; })}${ATTENDANCE_ORDER.map((k) => html`<td class="tabular ${k === 'absent' && tally[k] ? 'fw-7' : 't-3'}">${tally[k] || ''}</td>`)}</tr>`; })}</tbody></table></div>`;
}

function supportReport(roster, items, ctx) {
  const rows = roster.map((s) => { const total = studentTotal(items, ctx[s.id]); const absents = ctx[s.id].attendance.filter((a) => a.status === 'absent').length; const part = ctx[s.id].logs.filter((l) => l.kind === 'participation').reduce((n, l) => n + l.delta, 0); const reasons = []; if (total.pct !== null && total.pct < 50) reasons.push('الدرجات دون ٥٠٪'); if (absents >= 3) reasons.push(`${absents} غيابات`); if (part <= 0 && total.pct !== null) reasons.push('لا مشاركة مرصودة'); if (total.missing > 0 && total.missing === items.filter((i) => !i.auto).length) reasons.push('لم يُرصد له شيء'); return { s, total, reasons }; }).filter((row) => row.reasons.length).sort((a, b) => (a.total.pct ?? 999) - (b.total.pct ?? 999));
  if (!rows.length) return html`<div class="empty"><div class="empty__icon">${icon('check')}</div><div class="empty__title">لا أحد تحت المؤشرات</div><div class="empty__text">لا طالب درجته دون ٥٠٪ ولا من تجاوز ثلاث غيابات.</div></div>`;
  return html`<p class="t-3 fs-sm mb-3">${rows.length} طالبًا تستدعي حالتهم نظرة.</p><div class="list">${rows.map((row) => html`<a class="row" href="#/student/${row.s.id}"><span class="rollno">${row.s.rollNo ?? '—'}</span><span class="row__main"><span class="row__title">${row.s.name}</span><span class="row__sub">${row.reasons.join(' · ')}</span></span><span class="row__end"><span class="badge ${masteryBand(row.total.pct).badge} tabular">${fmtPct(row.total.pct)}</span>${icon('chev')}</span></a>`)}</div>`;
}
