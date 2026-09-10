import { html, icon, parentLink } from '../lib/dom.js';
import * as store from '../store.js';

const archiveContext = (year, term, tone, label, description) => html`
  <section class="archive-context" aria-labelledby="archive-context-title">
    <span class="archive-context__icon">${icon('archive')}</span>
    <div><div class="hstack gap-2 wrap"><h2 id="archive-context-title">${year.label}</h2><span class="badge ${tone}">${label}</span></div><p>${term.name} · ${description}</p></div>
    <span class="archive-readonly-seal">${icon('shield')} عرض فقط</span>
  </section>`;

export default {
  title: () => 'السجل التاريخي',
  back: () => '#/archive',
  wide: true,
  render(p) {
    const year = store.getYear(p.yearId);
    const term = store.getTerm(p.termId);
    const valid = year && term && term.yearId === year.id && (year.status === 'archived' || term.status === 'closed');
    if (!valid) return html`<div class="empty"><div class="empty__icon">${icon('archive')}</div><div class="empty__title">سياق الأرشيف غير متاح</div><div class="empty__text">تحقق من العام والفصل الدراسي المطلوبين.</div>${parentLink('العودة إلى الأرشيف', '/archive')}</div>`;

    const reportState = store.closedTermReportState(term.id);
    if (reportState.state !== 'complete') {
      const unresolved = reportState.state === 'legacy-unresolved';
      const title = unresolved ? 'فصل مغلق دون نسخة تقارير ثابتة' : 'لا توجد حقيقة تقارير مغلقة';
      const description = unresolved
        ? 'أُغلق هذا الفصل قبل تفعيل حفظ التقارير التاريخية الثابتة. لن يستنتج ركيز تقاريره من البيانات الحالية.'
        : 'العام مؤرشف، لكن هذا الفصل الدراسي لا يملك حقيقة تقارير مغلقة محفوظة. لن تظهر تقارير غير موثوقة.';
      const teachings = store.teachings(term.id, { includeArchived: true });
      return html`
        <main class="management-page archive-detail-page">
          ${parentLink('العودة إلى الأرشيف', '/archive')}
          ${archiveContext(year, term, 'badge--warn', unresolved ? 'غير محسوم' : 'مؤرشف مع العام', 'سجل تاريخي للقراءة فقط')}
          <section class="archive-unresolved surface surface--flat" aria-labelledby="archive-unresolved-title"><span class="archive-unresolved__icon">${icon('note')}</span><div><h2 id="archive-unresolved-title">${title}</h2><p>${description}</p></div></section>
          ${teachings.length ? html`
            <section class="archive-destinations surface surface--flat" aria-labelledby="archived-classes-title">
              <div class="archive-destinations__head"><div><h2 id="archived-classes-title">الفصول المسجلة</h2><p>تظهر هويتها فقط لأن تقاريرها التاريخية الثابتة غير متاحة.</p></div><span class="badge badge--warn">${teachings.length} ${teachings.length === 1 ? 'فصل' : 'فصول'}</span></div>
              <div class="archive-record-list">${teachings.map((teaching) => html`
                <div class="archive-record-row is-disabled"><span class="archive-record-row__icon">${icon('classes')}</span><span class="archive-record-row__main"><strong>${store.sectionLabel(store.getSection(teaching.sectionId))}</strong><small>${store.getSubject(teaching.subjectId)?.name ?? ''}</small></span><span class="badge badge--warn">لا تقرير ثابت</span></div>`)}</div>
            </section>` : ''}
        </main>`;
    }

    const documents = reportState.report.payload?.teachingDocuments ?? [];
    const identity = reportState.report.payload?.identity;
    const versionText = reportState.versions > 1 ? `أحدث نسخة من ${reportState.versions} نسخ محفوظة` : 'نسخة تاريخية محفوظة عند الإغلاق';
    return html`
      <main class="management-page archive-detail-page">
        ${parentLink('العودة إلى الأرشيف', '/archive')}
        ${archiveContext({ ...year, label: identity?.year?.label ?? year.label }, { ...term, name: identity?.term?.name ?? term.name }, 'badge--ok', 'تقارير ثابتة', `${versionText} · الإصدار ${reportState.report.version}`)}
        <section class="archive-destinations surface surface--flat" aria-labelledby="historical-reports-title">
          <div class="archive-destinations__head"><div><h2 id="historical-reports-title">تقارير الفصول</h2><p>نسخ تاريخية ثابتة كما حُفظت عند إغلاق الفصل الدراسي.</p></div><span class="badge badge--info">${documents.length} ${documents.length === 1 ? 'تقرير' : 'تقارير'}</span></div>
          ${documents.length ? html`<div class="archive-record-list">${documents.map((document) => html`
            <a class="archive-record-row" href="#/teaching/${document.teaching.id}/reports"><span class="archive-record-row__icon">${icon('reports')}</span><span class="archive-record-row__main"><strong>${store.sectionLabel(document.section)}</strong><small>${document.subject?.name ?? ''}</small></span><span class="archive-record-row__end"><span class="badge badge--info">عرض فقط</span>${icon('chev')}</span></a>`)}</div>` : html`<div class="archive-record-empty">لا توجد تقارير فصول ضمن النسخة التاريخية المحفوظة.</div>`}
        </section>
        <section class="archive-destinations surface surface--flat" aria-labelledby="execution-report-title">
          <div class="archive-destinations__head"><div><h2 id="execution-report-title">سجل تنفيذ الحصص</h2><p>الحصص المؤرخة واكتمال الحضور المثبت عند الإغلاق.</p></div></div>
          <div class="archive-record-list"><a class="archive-record-row" href="#/archive/year/${year.id}/term/${term.id}/execution"><span class="archive-record-row__icon is-info">${icon('attendance')}</span><span class="archive-record-row__main"><strong>تقرير تنفيذ الحصص</strong><small>السجل التاريخي للفصل الدراسي</small></span><span class="archive-record-row__end"><span class="badge badge--info">عرض فقط</span>${icon('chev')}</span></a></div>
        </section>
      </main>`;
  },
};
