import { html, icon, parentLink } from '../lib/dom.js';
import * as store from '../store.js';

export default {
  title: () => 'بيانات مؤرشفة',
  back: () => '#/archive',
  render(p) {
    const year = store.getYear(p.yearId);
    const term = store.getTerm(p.termId);
    const valid = year && term && term.yearId === year.id && (year.status === 'archived' || term.status === 'closed');
    if (!valid) return html`<div class="empty"><div class="empty__icon">${icon('archive')}</div><div class="empty__title">سياق الأرشيف غير متاح</div><div class="empty__text">تحقق من العام والفصل الدراسي المطلوبين.</div>${parentLink('العودة إلى الأرشيف', '/archive')}</div>`;

    const reportState = store.closedTermReportState(term.id);
    if (reportState.state !== 'complete') return html`
      ${parentLink('العودة إلى الأرشيف', '/archive')}
      <div class="card card--pad">
        <div class="hstack gap-2"><span class="badge badge--warn">غير محسوم</span><span class="fw-7">${year.label}</span></div>
        <div class="t-3 fs-sm mt-3">${term.name} · أُغلق قبل تفعيل حقيقة التقارير الثابتة، ولا توجد له نسخة تاريخية موثوقة. لن تُستنتج تقاريره من البيانات الحالية.</div>
      </div>`;

    const documents = reportState.report.payload?.teachingDocuments ?? [];
    return html`
      ${parentLink('العودة إلى الأرشيف', '/archive')}
      <div class="card card--pad mb-3">
        <div class="hstack gap-2"><span class="badge badge--info">تقارير ثابتة</span><span class="fw-7">${reportState.report.payload?.identity?.year?.label ?? year.label}</span></div>
        <div class="t-3 fs-sm mt-3">${reportState.report.payload?.identity?.term?.name ?? term.name} · الإصدار ${reportState.report.version} · للقراءة فقط</div>
      </div>
      <div class="list">
        ${documents.map((document) => html`<a class="row" href="#/teaching/${document.teaching.id}/reports"><span class="row__main"><span class="row__title">${store.sectionLabel(document.section)}</span><span class="row__sub">${document.subject?.name ?? ''}</span></span><span class="row__end">${icon('chev')}</span></a>`)}
        <a class="row" href="#/archive/year/${year.id}/term/${term.id}/execution"><span class="row__main"><span class="row__title">تقرير تنفيذ الحصص</span><span class="row__sub">الحصص المؤرخة واكتمال الحضور المثبت عند الإغلاق</span></span><span class="row__end">${icon('chev')}</span></a>
      </div>`;
  },
};
