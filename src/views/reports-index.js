/** التقارير — مدخل يختار الإسناد ثم يفتح تقاريره. */

import { html, icon, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal, gradeLabel } from '../models.js';

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
                <span class="row__title">${sec?.name ?? ''} · ${store.getSubject(tch.subjectId)?.name ?? ''}</span>
                <span class="row__sub">
                  ${gradeLabel(sec?.grade)} · <span class="tabular">${roster.length}</span> طالبًا
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
        <div class="section__head"><div class="section__title">قيد البناء</div></div>
        <div class="grid grid--2">
          <div class="soon">
            <div class="soon__title">تقرير السنة الدراسية</div>
            <div class="soon__text">يجمع فصلَي السنة في كشف واحد.</div>
          </div>
          <div class="soon">
            <div class="soon__title">تقرير الحصص المنفّذة</div>
            <div class="soon__text">متاح داخل كل فصل الآن، وسيُجمَّع هنا لاحقًا.</div>
          </div>
        </div>
      </div>
    `;
  },
};
