import { html, icon, parentLink } from '../lib/dom.js';
import * as store from '../store.js';

const historical = (year, term) => year?.status === 'archived' || term?.status === 'closed';
const termState = (year, term) => {
  const reports = store.closedTermReportState(term.id);
  if (reports.state === 'complete') {
    const count = reports.report.payload?.teachingDocuments?.length ?? 0;
    return { label: 'تقارير محفوظة', badge: 'badge--ok', description: `${count} من تقارير الفصول · حقيقة ثابتة عند الإغلاق` };
  }
  if (reports.state === 'legacy-unresolved') return { label: 'مغلق', badge: 'badge--warn', description: 'لا توجد له نسخة تقارير تاريخية موثوقة' };
  return { label: year.status === 'archived' ? 'مؤرشف مع العام' : 'للقراءة فقط', badge: 'badge--info', description: 'لا يملك حقيقة تقارير مغلقة محفوظة' };
};

export default {
  title: () => 'الأرشيف',
  wide: true,
  render() {
    const years = store.years().map((year) => ({ year, terms: store.termsOf(year.id).filter((term) => historical(year, term)) })).filter(({ terms }) => terms.length);
    const termCount = years.reduce((sum, group) => sum + group.terms.length, 0);
    if (!years.length) return html`
      <main class="management-page archive-page archive-page--empty"><div class="empty">
        <div class="empty__icon">${icon('archive')}</div><div class="empty__title">لا توجد سجلات تاريخية في الأرشيف</div>
        <div class="empty__text">تظهر هنا الأعوام المؤرشفة والفصول المغلقة للعرض فقط. النسخة الاحتياطية تبقى مسارًا منفصلًا للاسترداد.</div>
        <div class="btn-row archive-empty__actions"><a class="btn btn--info" href="#/settings/backup">${icon('shield')} النسخ الاحتياطي</a><a class="btn btn--ghost" href="#/settings">العودة إلى الإعدادات</a></div>
      </div></main>`;
    return html`
      <main class="management-page archive-page">
        ${parentLink('العودة إلى الإعدادات', '/settings')}
        <section class="archive-intro" aria-labelledby="archive-intro-title">
          <span class="archive-intro__icon">${icon('archive')}</span><div><h2 id="archive-intro-title">السجل التاريخي للمدرسة</h2><p>استعرض الأعوام والفصول المغلقة دون تغييرها. الأرشيف للعرض التاريخي، وليس لاستعادة بيانات التطبيق.</p></div>
          <a class="btn btn--info" href="#/settings/backup">${icon('shield')} النسخ الاحتياطي</a>
        </section>
        <div class="archive-summary" aria-label="ملخص الأرشيف"><span><bdi class="tabular">${years.length}</bdi> ${years.length === 1 ? 'عام دراسي' : 'أعوام دراسية'}</span><i aria-hidden="true"></i><span><bdi class="tabular">${termCount}</bdi> ${termCount === 1 ? 'فصل دراسي' : 'فصول دراسية'}</span><span class="badge badge--info">للقراءة فقط</span></div>
        <div class="archive-years">
          ${years.map(({ year, terms }, index) => html`
            <details class="archive-year surface surface--flat" ${index === 0 ? 'open' : ''}>
              <summary class="archive-year__summary"><span class="archive-year__identity"><span class="archive-year__mark">${icon('calendar')}</span><span><strong>${year.label}</strong><small>${terms.length} ${terms.length === 1 ? 'فصل تاريخي' : 'فصول تاريخية'}</small></span></span><span class="archive-year__status">${year.status === 'archived' ? html`<span class="badge badge--brand">عام مؤرشف</span>` : ''}<span class="archive-year__chev">${icon('chev')}</span></span></summary>
              <div class="archive-term-list">${terms.map((term) => { const state = termState(year, term); return html`
                <a class="archive-term-row" href="#/archive/year/${year.id}/term/${term.id}"><span class="archive-term-row__main"><span class="archive-term-row__title">${term.name}</span><span class="archive-term-row__sub">${state.description}</span></span><span class="archive-term-row__end"><span class="badge ${state.badge}">${state.label}</span>${icon('chev')}</span></a>`; })}</div>
            </details>`)}
        </div>
      </main>`;
  },
};
