/** تقارير التنفيذ المجمعة: بيانات الحصص المؤرخة فقط. */

import { html, icon, fmtDate } from '../lib/dom.js';
import { repaint } from '../repaint.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';

let termId = null;
let status = 'all';
let teachingId = 'all';
let from = '';
let to = '';

const META = {
  future: { label: 'مجدولة', tone: '' },
  pending: { label: 'لم يُرصد الحضور', tone: 'warn' },
  completed: { label: 'تم رصد الحضور', tone: 'ok' },
  excluded: { label: 'غير مطلوبة', tone: 'info' },
};

function scoped() {
  return store.executionReport({ termId: termId || store.activeTerm()?.id });
}

function filters(report) {
  return report.rows.filter((row) =>
    (status === 'all' || row.completeness.state === status)
    && (teachingId === 'all' || row.teaching?.id === teachingId)
    && (!from || row.session.date >= from)
    && (!to || row.session.date <= to)
  );
}

export default {
  title: () => 'تقارير التنفيذ',
  subtitle: () => store.activeYear()?.label ?? '',
  back: () => '#/reports',
  wide: true,

  onMount() {
    termId = store.activeTerm()?.id ?? null;
    status = 'all'; teachingId = 'all'; from = ''; to = '';
  },

  render() {
    const report = scoped();
    const rows = filters(report);
    if (!report.teachings.length) {
      return html`<div class="empty"><div class="empty__icon">${icon('reports')}</div><div class="empty__title">لا بيانات تنفيذ بعد</div><div class="empty__text">أضف فصلًا ثم ولّد الحصص المؤرخة من الجدول لتظهر هنا.</div><a class="btn btn--primary" href="#/classes">الفصول</a></div>`;
    }
    return html`
      <div class="card card--pad mb-3">
        <div class="field-row">
          <label class="field"><span class="field__label">الفصل الدراسي</span><select class="select" data-change="term">
            ${store.termsOf(store.activeYear()?.id).map((term) => html`<option value="${term.id}" ${term.id === termId ? 'selected' : ''}>${term.name}</option>`)}
          </select></label>
          <label class="field"><span class="field__label">الحالة</span><select class="select" data-change="status">
            <option value="all">كل الحالات</option><option value="pending" ${status === 'pending' ? 'selected' : ''}>لم يُرصد الحضور</option><option value="completed" ${status === 'completed' ? 'selected' : ''}>تم رصد الحضور</option><option value="future" ${status === 'future' ? 'selected' : ''}>مجدولة</option>
          </select></label>
        </div>
        <div class="field-row mt-3">
          <label class="field"><span class="field__label">الفصل/المادة</span><select class="select" data-change="teaching"><option value="all">كل الفصول</option>${report.teachings.map((teaching) => html`<option value="${teaching.id}" ${teaching.id === teachingId ? 'selected' : ''}>${sectionLabel(store.getSection(teaching.sectionId))} · ${store.getSubject(teaching.subjectId)?.name ?? ''}</option>`)}</select></label>
          <label class="field"><span class="field__label">من</span><input class="input tabular" data-change="from" type="date" value="${from}"></label>
          <label class="field"><span class="field__label">إلى</span><input class="input tabular" data-change="to" type="date" value="${to}"></label>
        </div>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">ملخّص التنفيذ</div></div>
        <div class="grid grid--auto">
          <div class="stat"><div class="stat__val tabular">${report.sections}</div><div class="stat__label">فصول/شعب</div></div>
          <div class="stat"><div class="stat__val tabular">${report.teachings.length}</div><div class="stat__label">إسنادات</div></div>
          <div class="stat"><div class="stat__val tabular">${report.counts.generated}</div><div class="stat__label">حصص مؤرخة</div></div>
          <div class="stat"><div class="stat__val tabular">${report.counts.completed}</div><div class="stat__label">تم رصدها</div></div>
          <div class="stat"><div class="stat__val tabular">${report.counts.pending}</div><div class="stat__label">بانتظار الرصد</div></div>
          <div class="stat"><div class="stat__val tabular">${report.percentage === null ? '—' : report.percentage + '٪'}</div><div class="stat__label">اكتمال الحضور</div></div>
        </div>
        <p class="t-3 fs-sm mt-3">${report.counts.future ? `هناك ${report.counts.future} حصة مجدولة مستقبلًا لا تدخل في نسبة الاكتمال.` : 'لا توجد حصص مستقبلية تخفّض نسبة الاكتمال.'}</p>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">تنفيذ الحصص</div><span class="t-3 fs-sm tabular">${rows.length}</span></div>
        ${!report.counts.generated
          ? html`<div class="empty"><div class="empty__title">لم تُولّد حصص بعد</div><div class="empty__text">ولّد الحصص المؤرخة من الجدول لتتابع التنفيذ والحضور.</div></div>`
          : !rows.length
            ? html`<div class="empty"><div class="empty__title">لا توجد حصص مطابقة</div><div class="empty__text">غيّر عوامل التصفية أو نطاق التاريخ.</div></div>`
            : html`<div class="list">${rows.map((row) => {
              const meta = META[row.completeness.state];
              const teaching = row.teaching;
              const label = teaching ? `${sectionLabel(row.section)} · ${store.getSubject(teaching.subjectId)?.name ?? ''}` : 'إسناد غير متاح';
              return html`<a class="row" href="#/teaching/${row.session.teachingId}/attendance?session=${row.session.id}">
                <span class="period">${row.session.period}</span><span class="row__main"><span class="row__title">${fmtDate(row.session.date, false)} · ${label}</span><span class="row__sub">${row.session.startTime ? `${row.session.startTime}–${row.session.endTime}` : 'وقت الحصة غير محفوظ'}${row.completeness.expected ? ` · ${row.completeness.recorded}/${row.completeness.expected} مرصود` : ''}</span></span><span class="row__end"><span class="badge ${meta.tone ? 'badge--' + meta.tone : ''}">${meta.label}</span>${icon('chev')}</span>
              </a>`;
            })}</div>`}
      </div>
    `;
  },
  actions: {
    term(el) { termId = el.value; teachingId = 'all'; repaint(); },
    status(el) { status = el.value; repaint(); },
    teaching(el) { teachingId = el.value; repaint(); },
    from(el) { from = el.value; repaint(); },
    to(el) { to = el.value; repaint(); },
  },
};