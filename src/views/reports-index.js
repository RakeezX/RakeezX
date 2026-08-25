/** التقارير — مدخل يختار الإسناد ثم يفتح تقاريره. */

import { html, icon, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal, sectionLabel } from '../models.js';

export default {
  title: () => 'التقارير',
  subtitle: () => store.activeTerm()?.name ?? '',

  render() {
    const list = store.teachings();

    if (!list.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('reports')}</div>
          <div class="empty__title">لا بيانات بعد</div>
          <div class="empty__text">أنشئ فصلًا وأضف طلابه لتظهر التقارير.</div>
          <a class="btn btn--primary" href="#/classes">${icon('plus')} الفصول</a>
        </div>
      `;
    }

    return html`
      <p class="t-3 fs-md mb-3">اختر فصلًا لعرض كشوفه وتقاريره.</p>

      <div class="list">
        ${list.map((tch) => {
          const { roster, items, ctx } = store.teachingContext(tch.id);
          const totals = roster.map((s) => studentTotal(items, ctx[s.id])).filter((t) => t.pct !== null);
          const avg = totals.length ? totals.reduce((n, t) => n + t.pct, 0) / totals.length : null;
          const need = totals.filter((t) => t.pct < 50).length;
          const sec = store.getSection(tch.sectionId);

          return html`
            <a class="row" href="#/teaching/${tch.id}/reports">
              <span class="row__main">
                <span class="row__title">${sectionLabel(sec) || ''} · ${store.getSubject(tch.subjectId)?.name ?? ''}</span>
                <span class="row__sub">
                  <span class="tabular">${roster.length}</span> طالبًا
                  ${avg !== null ? html` · متوسط <span class="tabular">${fmtPct(avg)}</span>` : ''}
                </span>
              </span>
              <span class="row__end">
                ${need ? html`<span class="badge badge--danger tabular">${need} يحتاج دعمًا</span>` : ''}
                ${icon('chev')}
              </span>
            </a>
          `;
        })}
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">تقارير مجمّعة</div></div>
        <div class="grid grid--2">
          <a class="card card--pad" href="#/reports/execution">
            <div class="fw-7">ملخّص التنفيذ</div>
            <div class="t-3 fs-sm mt-2">حصص مؤرخة، اكتمال الحضور، والحصص المستحقة.</div>
          </a>
          <a class="card card--pad" href="#/reports/execution">
            <div class="fw-7">تنفيذ الحصص</div>
            <div class="t-3 fs-sm mt-2">قائمة قابلة للتصفية بحسب التاريخ والفصل والحالة.</div>
          </a>
        </div>
      </div>
    `;
  },
};
