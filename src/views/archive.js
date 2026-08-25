import { html, icon, parentLink } from '../lib/dom.js';
import * as store from '../store.js';

const historical = (year, term) => year?.status === 'archived' || term?.status === 'closed';
export default { title: () => 'الأرشيف', render() {
  const contexts = store.years().flatMap((year) => store.termsOf(year.id).filter((term) => historical(year, term)).map((term) => ({ year, term })));
  if (!contexts.length) return html`<div class="empty"><div class="empty__icon">${icon('archive')}</div><div class="empty__title">لا توجد بيانات مؤرشفة حتى الآن</div><div class="empty__text">ستظهر الأعوام والفصول الدراسية السابقة هنا عند أرشفتها.</div>${parentLink('العودة إلى الإعدادات', '/settings')}</div>`;
  return html`${parentLink('العودة إلى الإعدادات', '/settings')}<p class="t-3 fs-md mb-3">تصفح البيانات التاريخية دون تغيير سنة العمل الحالية.</p><div class="list">${contexts.map(({year,term}) => html`<a class="row" href="#/archive/year/${year.id}/term/${term.id}"><span class="row__main"><span class="row__title">${year.label}</span><span class="row__sub">${term.name} · بيانات مؤرشفة</span></span><span class="row__end"><span class="badge badge--info">مؤرشف</span>${icon('chev')}</span></a>`)}</div>`;
}};