/** التقارير — مدخل يختار الإسناد ثم يفتح تقاريره. */

import { html, icon, fmtPct } from '../lib/dom.js';
import { visibleLatinDigits } from '../lib/visible-numerals.js';
import * as store from '../store.js';
import { studentTotal, sectionLabel, gradeLabel } from '../models.js';


const classCount = (count) => count === 1 ? 'فصل واحد' : count === 2 ? 'فصلان' : `${count} فصول`;

function portfolioDestination() {
  return html`
    <section class="surface surface--flat report-hub" aria-labelledby="portfolio-preview-title">
      <a class="report-destination" href="#/reports/portfolio-preview">
        <span class="report-destination__icon" aria-hidden="true">${icon('reports')}</span>
        <span class="row__main">
          <span class="row__title" id="portfolio-preview-title">ملف الإنجاز (معاينة)</span>
          <span class="row__sub">ملف سنوي من 11 معيارًا للشواهد والصور وتصدير PDF. المسودة في هذا المتصفح فقط، مع أرشيف محلي يدوي قابل للنقل. المزامنة السحابية والربط بنسخ N71 غير مكتملين؛ لا تُزامن المسودة أو تُنسخ احتياطيًا إلى N71 أو جهاز آخر.</span>
        </span>
        <span class="row__chev">${icon('chev')}</span>
      </a>
    </section>
  `;
}

function classReportRow(tch) {
  const { roster, items, ctx } = store.teachingContext(tch.id);
  const totals = roster.map((student) => studentTotal(items, ctx[student.id])).filter((total) => total.pct !== null);
  const avg = totals.length ? totals.reduce((sum, total) => sum + total.pct, 0) / totals.length : null;
  const need = totals.filter((total) => total.pct < 50).length;
  const section = store.getSection(tch.sectionId);

  return html`
    <a class="report-class-row" href="#/teaching/${tch.id}/reports">
      <span class="report-class-row__icon" aria-hidden="true">${icon('reports')}</span>
      <span class="row__main">
        <span class="row__title">${visibleLatinDigits(`${sectionLabel(section) || ''} · ${store.getSubject(tch.subjectId)?.name ?? ''}`)}</span>
        <span class="row__sub">
          <span class="tabular">${roster.length}</span> طالبًا
          ${avg !== null ? html` · متوسط <span class="tabular">${fmtPct(avg)}</span>` : ''}
        </span>
      </span>
      <span class="row__end">
        ${need ? html`<span class="badge badge--danger tabular">${need} يحتاج دعمًا</span>` : ''}
        <span class="row__chev">${icon('chev')}</span>
      </span>
    </a>
  `;
}

export default {
  title: () => 'التقارير',
  subtitle: () => store.activeTerm()?.name ?? '',
  wide: true,

  render() {
    const list = store.teachings();
    const groups = [...list.reduce((result, teaching) => {
      const grade = Number(store.getSection(teaching.sectionId)?.grade) || 0;
      if (!result.has(grade)) result.set(grade, []);
      result.get(grade).push(teaching);
      return result;
    }, new Map()).entries()].sort(([gradeA], [gradeB]) => gradeA - gradeB);

    if (!list.length) {
      return html`
        <div class="stack stack-4">
          <div class="stack stack-4" data-report-destinations>${portfolioDestination()}</div>
          <div class="empty">
            <div class="empty__icon">${icon('reports')}</div>
            <div class="empty__title">لا بيانات بعد</div>
            <div class="empty__text">أنشئ فصلًا وأضف طلابه لتظهر التقارير.</div>
            <a class="btn btn--primary" href="#/classes">${icon('plus')} الفصول</a>
          </div>
        </div>
      `;
    }

    return html`
      <div class="reports-index-page">
        <div class="stack stack-4" data-report-destinations>
          ${portfolioDestination()}
          <section class="surface surface--flat report-hub" aria-labelledby="certificate-center-title">
            <a class="report-destination" data-act="certificate-center" href="#/reports/certificates">
              <span class="report-destination__icon" aria-hidden="true">${icon('star')}</span>
              <span class="row__main"><span class="row__title" id="certificate-center-title">شهادات التقدير</span><span class="row__sub">تصاميم ركيز، اختيار عدة طلاب، وشهادة مستقلة لكل طالب في ملف PDF.</span></span>
              <span class="row__chev">${icon('chev')}</span>
            </a>
          </section>
          <section class="surface surface--flat report-hub" aria-labelledby="aggregate-reports-title">
            <div class="report-hub__head">
              <div>
                <h2 class="report-hub__title" id="aggregate-reports-title">تقارير جميع الفصول</h2>
                <p class="report-hub__desc">ثلاثة ملخصات للمتابعة، وتبقى تفاصيل كل فصل في تقاريره.</p>
              </div>
            </div>
            <a class="report-destination" href="#/reports/execution">
              <span class="report-destination__icon" aria-hidden="true">${icon('timetable')}</span>
              <span class="row__main">
                <span class="row__title" data-n70-destination>الحصص والحضور</span>
                <span class="row__sub">تنفيذ الحصص، اكتمال الحضور، وتصفية النتائج بحسب التاريخ والفصل والحالة.</span>
              </span>
              <span class="row__chev">${icon('chev')}</span>
            </a>
            <a class="report-destination n70-destination" href="#/reports/grades">
              <span class="report-destination__icon" aria-hidden="true">${icon('grades')}</span>
              <span class="row__main"><span class="row__title" data-n70-destination>الدرجات</span><span class="row__sub">ملخص الدرجات عبر الفصول، مع الوصول إلى الكشوف التفصيلية.</span></span><span class="row__chev">${icon('chev')}</span>
            </a>
            <a class="report-destination n70-destination" href="#/reports/followup">
              <span class="report-destination__icon" aria-hidden="true">${icon('student')}</span>
              <span class="row__main"><span class="row__title" data-n70-destination>طلاب يحتاجون متابعة</span><span class="row__sub">الطالب وفصله وسبب المتابعة من سجلات ركيز الحالية.</span></span><span class="row__chev">${icon('chev')}</span>
            </a>
          </section>
        </div>
        <section class="surface surface--flat report-hub" aria-labelledby="class-reports-title">
          <div class="report-hub__head">
            <div>
              <h2 class="report-hub__title" id="class-reports-title">تقارير الفصول</h2>
              <p class="report-hub__desc">اختر فصلًا لعرض كشوف الطلاب والدرجات والحضور.</p>
            </div>
            <span class="badge tabular">${list.length === 1 ? 'فصل واحد' : `${list.length} فصول`}</span>
          </div>
          <div class="report-grade-groups">
            ${groups.map(([grade, teachings]) => html`
              <details class="report-grade-group">
                <summary class="report-grade-group__summary">
                  <span class="report-grade-group__title">${gradeLabel(grade) || 'صف غير محدد'}</span>
                  <span class="report-grade-group__count tabular">${classCount(teachings.length)}</span>
                  <span class="report-grade-group__chev" aria-hidden="true">${icon('chev')}</span>
                </summary>
                <div class="report-hub__list">${teachings.map(classReportRow)}</div>
              </details>
            `)}
          </div>
        </section>
      </div>
    `;
  },
};
