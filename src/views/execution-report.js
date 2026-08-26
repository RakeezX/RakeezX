/** تقارير التنفيذ المجمعة: بيانات الحصص المؤرخة فقط. */

import { html, icon, fmtDate, fmtTimeRange, formatTimeRange, toast, openSheet } from '../lib/dom.js';
import { downloadCSV } from '../lib/export.js';
import { reportHeader, reportIdentitySheet, reportSignatures } from '../lib/report-print.js';
import { repaint } from '../repaint.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';

let termId = null;
let status = 'all';
let teachingId = 'all';
let from = '';
let to = '';

const META = {
  future: { label: 'مجدولة', tone: '' }, pending: { label: 'لم يُرصد الحضور', tone: 'warn' },
  completed: { label: 'تم رصد الحضور', tone: 'ok' }, excluded: { label: 'غير مطلوبة', tone: 'info' },
};
const statusText = (key) => META[key]?.label ?? key;

function scoped() { return store.executionReport({ termId: termId || store.activeTerm()?.id }); }
function filters(report) { return report.rows.filter((row) => (status === 'all' || row.completeness.state === status) && (teachingId === 'all' || row.teaching?.id === teachingId) && (!from || row.session.date >= from) && (!to || row.session.date <= to)); }
function contextLabel(report) { return [from && `من ${fmtDate(from, false)}`, to && `إلى ${fmtDate(to, false)}`, status !== 'all' && statusText(status)].filter(Boolean).join(' · '); }
function profile() { return { ...store.state.profile, reportPrincipalName: store.state.device?.reportPrincipalName ?? '' }; }

export default {
  title: () => 'تقارير التنفيذ', subtitle: () => store.activeYear()?.label ?? '', back: () => '#/reports', wide: true,
  onMount() { termId = store.activeTerm()?.id ?? null; status = 'all'; teachingId = 'all'; from = ''; to = ''; },
  render() {
    const report = scoped(); const rows = filters(report); const selectedTerm = store.getTerm(termId) ?? store.activeTerm();
    if (!report.teachings.length) return html`<div class="empty"><div class="empty__icon">${icon('reports')}</div><div class="empty__title">لا بيانات تنفيذ بعد</div><div class="empty__text">أضف فصلًا ثم ولّد الحصص المؤرخة من الجدول لتظهر هنا.</div><a class="btn btn--primary" href="#/classes">الفصول</a></div>`;
    return html`
      <article class="print-report print-report--execution" dir="rtl">
        ${reportHeader({ title: 'تقرير تنفيذ الحصص', profile: profile(), year: store.activeYear()?.label ?? '', term: selectedTerm?.name ?? '', period: contextLabel(report) })}
        <div class="card card--pad mb-3 noprint">
          <div class="field-row"><label class="field"><span class="field__label">الفصل الدراسي</span><select class="select" data-change="term">${store.termsOf(store.activeYear()?.id).map((term) => html`<option value="${term.id}" ${term.id === termId ? 'selected' : ''}>${term.name}</option>`)}</select></label><label class="field"><span class="field__label">الحالة</span><select class="select" data-change="status"><option value="all">كل الحالات</option><option value="pending" ${status === 'pending' ? 'selected' : ''}>لم يُرصد الحضور</option><option value="completed" ${status === 'completed' ? 'selected' : ''}>تم رصد الحضور</option><option value="future" ${status === 'future' ? 'selected' : ''}>مجدولة</option></select></label></div>
          <div class="field-row mt-3"><label class="field"><span class="field__label">الفصل/المادة</span><select class="select" data-change="teaching"><option value="all">كل الفصول</option>${report.teachings.map((teaching) => html`<option value="${teaching.id}" ${teaching.id === teachingId ? 'selected' : ''}>${sectionLabel(store.getSection(teaching.sectionId))} · ${store.getSubject(teaching.subjectId)?.name ?? ''}</option>`)}</select></label><label class="field"><span class="field__label">من</span><input class="input tabular" data-change="from" type="date" value="${from}"></label><label class="field"><span class="field__label">إلى</span><input class="input tabular" data-change="to" type="date" value="${to}"></label></div>
        </div>
        <div class="section noprint"><div class="section__head"><div class="section__title">ملخّص التنفيذ</div></div><div class="grid grid--auto"><div class="stat"><div class="stat__val tabular">${report.sections}</div><div class="stat__label">فصول/شعب</div></div><div class="stat"><div class="stat__val tabular">${report.teachings.length}</div><div class="stat__label">إسنادات</div></div><div class="stat"><div class="stat__val tabular">${report.counts.generated}</div><div class="stat__label">حصص مؤرخة</div></div><div class="stat"><div class="stat__val tabular">${report.counts.completed}</div><div class="stat__label">تم رصدها</div></div><div class="stat"><div class="stat__val tabular">${report.counts.pending}</div><div class="stat__label">بانتظار الرصد</div></div><div class="stat"><div class="stat__val tabular">${report.percentage === null ? '—' : report.percentage + '٪'}</div><div class="stat__label">اكتمال الحضور</div></div></div></div>
        <div class="section"><div class="section__head noprint"><div class="section__title">تنفيذ الحصص</div><span class="t-3 fs-sm tabular">${rows.length}</span></div>${!rows.length ? html`<div class="empty"><div class="empty__title">لا توجد حصص مطابقة</div><div class="empty__text">غيّر عوامل التصفية أو نطاق التاريخ.</div></div>` : executionTable(rows)}</div>
        ${reportSignatures({ profile: profile() })}
        <div class="btn-row mt-6 noprint report-actions"><button class="btn btn--ghost" data-act="identity">${icon('edit')} بيانات التقرير والطباعة</button><button class="btn btn--primary" data-act="print">${icon('print')} طباعة</button><button class="btn btn--ghost" data-act="csv">${icon('download')} تصدير CSV</button></div>
      </article>`;
  },
  actions: {
    term(el) { termId = el.value; teachingId = 'all'; repaint(); }, status(el) { status = el.value; repaint(); }, teaching(el) { teachingId = el.value; repaint(); }, from(el) { from = el.value; repaint(); }, to(el) { to = el.value; repaint(); }, print() { window.print(); },
    async identity() { const value = await openSheet({ title: 'بيانات التقرير والطباعة', desc: 'بيانات المعلم والمدرسة تأتي من الإعدادات. مدير المدرسة اختياري ومحفوظ على هذا الجهاز.', body: reportIdentitySheet({ profile: store.state.profile, device: store.state.device }), foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" form="report-identity-form">حفظ</button>`, onMount: (root, done) => root.querySelector('#report-identity-form').addEventListener('submit', (event) => { event.preventDefault(); done(String(new FormData(event.currentTarget).get('principalName') ?? '').trim()); }) }); if (value === undefined) return; const saved = await store.patchDevice({ reportPrincipalName: value }); toast(saved ? 'حُفظت بيانات التقرير' : 'تعذّر حفظ بيانات التقرير', saved ? undefined : 'danger'); },
    csv() { const rows = filters(scoped()); const out = [['التاريخ', 'الفصل', 'المادة', 'الحصة', 'الوقت', 'حالة التنفيذ', 'الحضور المرصود', 'الطلاب المتوقعون']]; for (const row of rows) { const subject = store.getSubject(row.teaching?.subjectId)?.name ?? ''; out.push([fmtDate(row.session.date, false), sectionLabel(row.section), subject, row.session.period, formatTimeRange(row.session.startTime, row.session.endTime), statusText(row.completeness.state), row.completeness.recorded || '', row.completeness.expected || '']); } downloadCSV('تنفيذ-الحصص.csv', out); toast('نُزّل تقرير تنفيذ الحصص'); },
  },
};

function executionTable(rows) { return html`<div class="tablewrap scroll-x print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>التاريخ</th><th>الفصل</th><th>المادة</th><th>الحصة</th><th>الوقت</th><th>الحالة</th><th>الحضور</th></tr></thead><tbody>${rows.map((row) => { const subject = store.getSubject(row.teaching?.subjectId)?.name ?? ''; const time = row.session.startTime ? fmtTimeRange(row.session.startTime, row.session.endTime) : '—'; return html`<tr><td>${fmtDate(row.session.date, false)}</td><td>${sectionLabel(row.section)}</td><td>${subject}</td><td class="tabular">${row.session.period}</td><td class="tabular">${time}</td><td>${statusText(row.completeness.state)}</td><td class="tabular">${row.completeness.expected ? `${row.completeness.recorded}/${row.completeness.expected}` : '—'}</td></tr>`; })}</tbody></table></div>`; }
