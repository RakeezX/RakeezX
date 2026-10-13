import { html, icon, fmtPct, fmtNum, toast } from '../lib/dom.js';
import { repaint } from '../repaint.js';
import * as store from '../store.js';
import { studentTotal, sectionLabel, gradeLabel, normalizeSearchText } from '../models.js';
import { supportRows } from './reports.js';
import { reportHeader, reportWithClosing, reportPageSetup, demoOutputMarker } from '../lib/report-print.js';
import { markDemoExportRows } from '../lib/report-print.js';
import { downloadCSV, safeReportCSVText } from '../lib/export.js';

// Read-only Work report pages; calculations and support reasons stay in Product helpers.
let termId = null, grade = 'all', teachingId = 'all', filter = 'all', query = '';
const followup = () => location.hash.split('?')[0].endsWith('/followup');
const reportTitle = () => followup() ? 'طلاب يحتاجون متابعة' : 'الدرجات';
const term = () => termId || store.activeTerm()?.id;
function teachings() {
  return store.teachings(term()).filter(t => grade === 'all' || String(store.getSection(t.sectionId)?.grade) === grade);
}
function reportRows() {
  const search = normalizeSearchText(query);
  return teachings().filter(t => teachingId === 'all' || teachingId === t.id).flatMap(t => {
    const { roster, items, ctx } = store.teachingContext(t.id);
    const rows = followup() ? supportRows(roster, items, ctx) : roster.map(s => ({ s, total: studentTotal(items, ctx[s.id]), reasons: [] }));
    return rows.map(row => ({ ...row, teaching: t, section: sectionLabel(store.getSection(t.sectionId)), subject: store.getSubject(t.subjectId)?.name || '' }));
  }).filter(row => (!search || normalizeSearchText(row.s.name).includes(search)) && (
    filter === 'all' || (followup() ? row.reasons.some(reason =>
      filter === 'grades' ? reason === 'الدرجات دون 50٪' : filter === 'absence' ? reason.includes('غيابات') :
      filter === 'participation' ? reason === 'لا مشاركة مرصودة' : reason === 'لم يُرصد له شيء') :
      filter === 'missing' ? row.total.missing > 0 : row.total.pct !== null)
  ));
}

export function crossClassCSVRows(rows, isFollowup) {
  const columns = isFollowup
    ? ['الطالب', 'الفصل', 'المادة', 'النسبة', 'الدرجة المرصودة', 'المجموع المرصود', 'سبب المتابعة']
    : ['الطالب', 'الفصل', 'المادة', 'الدرجة المرصودة', 'المجموع المرصود', 'النسبة', 'حالة الرصد'];
  return [columns, ...rows.map(row => {
    const graded = row.total.outOfGraded > 0;
    const score = graded ? [row.total.earned, row.total.outOfGraded, row.total.pct] : ['', '', ''];
    const identity = [safeReportCSVText(row.s.name), safeReportCSVText(row.section), safeReportCSVText(row.subject)];
    return isFollowup
      ? [...identity, score[2], score[0], score[1], safeReportCSVText(row.reasons.join(' · '))]
      : [...identity, ...score, safeReportCSVText(row.total.missing ? `${row.total.missing} بنود غير مرصودة` : 'الرصد مكتمل')];
  })];
}
export default {
  title: reportTitle,
  subtitle: () => 'جميع الفصول',
  back: () => '#/reports',
  wide: true,
  onMount() { termId = store.activeTerm()?.id; grade = 'all'; teachingId = 'all'; filter = 'all'; query = ''; repaint(); },
  render() {
    const rows = reportRows();
    const allTeachings = store.teachings(term());
    const grades = [...new Set(allTeachings.map(t => Number(store.getSection(t.sectionId)?.grade)))].sort((a,b) => a-b);
    const selectedTerm = store.state.terms.find(t => t.id === term());
    const context = [grade === 'all' ? 'جميع الصفوف' : gradeLabel(Number(grade)), teachingId === 'all' ? 'جميع الفصول' : sectionLabel(store.getSection(store.getTeaching(teachingId)?.sectionId)), query && `بحث: ${query}`].filter(Boolean).join(' · ');
    return html`<article class="print-report report-workspace n70-report-page" dir="rtl" data-report-kind="${followup() ? 'followup' : 'grades'}">
      ${reportPageSetup()}
      ${reportHeader({ title: reportTitle(), profile: store.state.profile, year: store.activeYear()?.label, term: selectedTerm?.name, period: context })}
      <header class="report-workspace__head noprint"><div><span class="report-workspace__eyebrow">جميع الفصول</span><h2>${reportTitle()}</h2><p>${followup() ? 'الطالب وفصله وسبب المتابعة من السجلات الحالية.' : 'راجع الدرجات المرصودة عبر الفصول دون تغيير حسابها.'}</p>${demoOutputMarker({screenOnly:true})}</div><div class="n70-head-actions"><button type="button" class="btn btn--primary" data-act="n70-print">${icon('print')} طباعة التقرير</button><button type="button" class="btn btn--ghost" data-act="n70-csv">${icon('download')} تصدير CSV</button></div></header>
      <section class="surface surface--flat n70-filters noprint" aria-label="عوامل تصفية التقرير">
        <label class="field"><span class="field__label">الفصل الدراسي</span><select class="select" data-change="n70-term">${store.termsOf(store.activeYear()?.id).map(t => html`<option value="${t.id}" ${t.id===term()?'selected':''}>${t.name}</option>`)}</select></label>
        <label class="field"><span class="field__label">الصف</span><select class="select" data-change="n70-grade"><option value="all">جميع الصفوف</option>${grades.map(g => html`<option value="${g}" ${String(g)===grade?'selected':''}>${gradeLabel(g)}</option>`)}</select></label>
        <label class="field"><span class="field__label">الفصل والمادة</span><select class="select" data-change="n70-teaching"><option value="all">جميع الفصول</option>${teachings().map(t => html`<option value="${t.id}" ${t.id===teachingId?'selected':''}>${sectionLabel(store.getSection(t.sectionId))} · ${store.getSubject(t.subjectId)?.name || ''}</option>`)}</select></label>
        <label class="field"><span class="field__label">${followup() ? 'سبب المتابعة' : 'حالة الرصد'}</span><select class="select" data-change="n70-filter"><option value="all">${followup()?'كل الأسباب':'كل الحالات'}</option>${(followup() ? [['grades','الدرجات دون 50٪'],['absence','غياب متكرر'],['participation','لا مشاركة مرصودة'],['missing','لم يُرصد له شيء']] : [['recorded','درجات مرصودة'],['missing','رصد غير مكتمل']]).map(([v,label])=>html`<option value="${v}" ${filter===v?'selected':''}>${label}</option>`)}</select></label>
        <label class="field n70-search"><span class="field__label">بحث عن طالب</span><input class="input" type="search" data-input="n70-search" data-fk="n70-search" value="${query}" placeholder="اسم الطالب" aria-label="بحث عن طالب"></label><button class="btn btn--ghost n70-reset" data-act="n70-reset">مسح التصفية</button>
      </section>
      <section class="report-results"><div class="section__head noprint"><h3 class="section__title">${followup()?'قائمة المتابعة':'كشف الدرجات'}</h3><span class="t-3 fs-sm tabular" data-n70-count>${rows.length} نتيجة</span></div>
        ${reportWithClosing(rows.length ? html`<table class="n70-report-table"><thead><tr><th>الطالب</th><th>الفصل</th><th>المادة</th><th>الدرجة المرصودة</th><th>${followup()?'سبب المتابعة':'حالة الرصد'}</th></tr></thead><tbody>${rows.map(row => html`<tr class="n70-record" data-teaching="${row.teaching.id}"><td class="n70-person"><a href="#/student/${row.s.id}">${row.s.name}</a></td><td class="n70-class"><a href="#/teaching/${row.teaching.id}/reports">${row.section}</a></td><td class="n70-subject">${row.subject}</td><td class="n70-score"><strong class="tabular">${fmtPct(row.total.pct)}</strong><small class="tabular">${fmtNum(row.total.earned)} / ${fmtNum(row.total.outOfGraded)}</small></td><td class="n70-reason">${followup()?row.reasons.join(' · '):row.total.missing ? `${row.total.missing} بنود غير مرصودة` : 'الرصد مكتمل'}</td></tr>`)}</tbody></table>` : html`<div class="empty empty--compact"><div class="empty__title">لا نتائج مطابقة</div><div class="empty__text">غيّر عوامل التصفية أو البحث لعرض نتائج أخرى.</div></div>`, {profile:store.state.profile})}
      </section>
    </article>`;
  },
  actions: {
    'n70-term'(el){termId=el.value;grade='all';teachingId='all';repaint();},
    'n70-grade'(el){grade=el.value;teachingId='all';repaint();},
    'n70-teaching'(el){teachingId=el.value;repaint();},
    'n70-filter'(el){filter=el.value;repaint();},
    'n70-search'(el){query=el.value;repaint();},
    'n70-reset'(){grade='all';teachingId='all';filter='all';query='';repaint();},
    'n70-print'(){if(!reportRows().length){toast('لا نتائج للطباعة','warn');return;}window.print();},
    'n70-csv'(){
      const rows = reportRows();
      if (!rows.length) { toast('لا نتائج للتصدير', 'warn'); return; }
      const isFollowup = followup();
      downloadCSV(isFollowup ? 'متابعة-الطلاب-جميع-الفصول.csv' : 'درجات-جميع-الفصول.csv', markDemoExportRows(crossClassCSVRows(rows, isFollowup)));
      toast('نُزّل التقرير');
    },
  },
};
