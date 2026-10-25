import '../lib/rakeez-datetime.js';
import '../styles/attendance-evidence.css';

import { html, icon, fmtDate, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';
import { repaint } from '../repaint.js';
import {
  reportPageSetup, reportHeader, reportSignatures, reportFooter,
  resolvedReportPrincipalName, printReport,
} from '../lib/report-print.js';
import { attendanceEvidenceProjection } from '../lib/attendance-evidence.js';
import { visibleLatinDigits } from '../lib/visible-numerals.js';

let teachingId = '';
let from = '';
let to = '';
const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });
function sortedTeachings() {
  return [...store.teachings()].sort((a, b) => {
    const sa = store.getSection(a.sectionId), sb = store.getSection(b.sectionId);
    return (Number(sa?.grade) || 0) - (Number(sb?.grade) || 0)
      || collator.compare(sectionLabel(sa) ?? '', sectionLabel(sb) ?? '')
      || collator.compare(store.getSubject(a.subjectId)?.name ?? '', store.getSubject(b.subjectId)?.name ?? '');
  });
}
function context() {
  const offerings = sortedTeachings();
  const chosen = offerings.find(row => row.id === teachingId) || offerings[0] || null;
  if (chosen && chosen.id !== teachingId) teachingId = chosen.id;
  const year = store.activeYear(), term = store.activeTerm();
  const report = store.executionReport({ yearId: year?.id, termId: term?.id });
  const projection = attendanceEvidenceProjection(report, { teachingId, from, to });
  const profile = {
    ...store.state.profile,
    reportPrincipalName: resolvedReportPrincipalName(store.state.profile, store.state.device),
  };
  return { offerings, chosen, year, term, projection, profile };
}
const countLabel = (n, one, many) => n === 1 ? one : `${n} ${many}`;
const dateLabel = value => fmtDate(value, false) || value;
function periodLabel() {
  if (from && to) return `من ${dateLabel(from)} إلى ${dateLabel(to)}`;
  if (from) return `من ${dateLabel(from)}`;
  if (to) return `حتى ${dateLabel(to)}`;
  return 'جميع الحصص المسجلة في الفصل الدراسي الحالي';
}

export default {
  title: () => 'شاهد متابعة الحضور',
  subtitle: () => store.activeTerm()?.name ?? '',
  back: () => '#/reports',
  wide: true,
  beforeRender() { teachingId = ''; from = ''; to = ''; },
  render() {
    const { offerings, chosen, year, term, projection, profile } = context();
    if (!offerings.length) return html`
      <div class="empty"><div class="empty__icon">${icon('attendance')}</div>
        <div class="empty__title">لا توجد فصول لإعداد الشاهد</div>
        <div class="empty__text">أضف فصلًا ومادة، ثم سجّل حضورًا فعليًا لإعداد الشاهد.</div>
        <a href="#/classes" class="btn btn--primary">الفصول</a>
      </div>`;
    const selectedSection = store.getSection(chosen?.sectionId);
    const subject = store.getSubject(chosen?.subjectId)?.name ?? '';
    const valid = !projection.error;
    const ready = valid && projection.recordedSessions > 0;
    const range = periodLabel();
    return html`
      <div class="attendance-evidence-page" dir="rtl">
        <header class="attendance-evidence-page__intro noprint">
          <div><span class="attendance-evidence-page__eyebrow">ملف الإنجاز · شواهد من سجلات ركيز</span>
            <h2>شاهد متابعة الحضور</h2>
            <p>وثيقة تستند إلى سجلات الحضور الموجودة بالفعل، ولا تنشئ درجات أو حضورًا جديدًا.</p>
          </div>
          <span class="attendance-evidence-page__tag">${icon('shield-check')} مشتق من السجلات</span>
        </header>

        <section class="attendance-evidence-controls surface surface--flat noprint" aria-label="إعداد الشاهد">
          <label class="field attendance-evidence-controls__teaching">
            <span class="field__label">الفصل والمادة</span>
            <select class="select" data-change="teaching" aria-label="الفصل والمادة">
              ${offerings.map(row => html`<option value="${row.id}" ${row.id === teachingId ? 'selected' : ''}>
                ${visibleLatinDigits(sectionLabel(store.getSection(row.sectionId)))} · ${store.getSubject(row.subjectId)?.name ?? ''}
              </option>`)}
            </select>
          </label>
          <label class="field"><span class="field__label">من تاريخ</span>
            <input class="input" data-change="from" type="text" data-rakeez-datetime="date" data-rakeez-date-scope="historical" value="${from}" aria-label="من تاريخ" />
          </label>
          <label class="field"><span class="field__label">إلى تاريخ</span>
            <input class="input" data-change="to" type="text" data-rakeez-datetime="date" data-rakeez-date-scope="historical" value="${to}" aria-label="إلى تاريخ" />
          </label>
          <button class="btn btn--ghost" data-act="reset">مسح التواريخ</button>
          <button class="btn btn--primary" data-act="print" ${ready ? '' : 'disabled'}>${icon('print')} طباعة / PDF</button>
          <p class="attendance-evidence-controls__hint" role="status">
            ${!valid ? 'تحقق من التواريخ: يجب أن يكون تاريخ البداية قبل النهاية.'
              : ready ? `جاهز للتصدير · ${countLabel(projection.recordedSessions, 'حصة برصد محفوظ', 'حصص برصد محفوظ')}`
              : 'لا توجد سجلات حضور محفوظة في الفترة المختارة؛ التصدير غير متاح.'}
          </p>
        </section>

        <div class="attendance-evidence-page__stage">
          <article class="print-report attendance-evidence-document" data-attendance-evidence dir="rtl">
            ${reportPageSetup()}
            ${reportHeader({
              title: 'شاهد متابعة رصد الحضور', profile,
              year: year?.label ?? '', term: term?.name ?? '',
              section: sectionLabel(selectedSection), subject, period: range,
            })}
            <div class="attendance-evidence-document__body">
              <div class="attendance-evidence-document__heading">
                <span>توثيق عمل مسجل</span><h3>متابعة رصد حضور الطلاب</h3>
                <p>ملخص آلي من سجلات الحصص المؤرخة في ركيز، للفصل والمادة والفترة الموضحة أعلاه.</p>
              </div>
              ${!valid ? html`<div class="attendance-evidence-document__empty">نطاق التاريخ غير صالح. صحح التاريخين لعرض الشاهد.</div>`
                : !projection.rows.length ? html`<div class="attendance-evidence-document__empty">
                    لا توجد حصص تحتوي على رصد حضور محفوظ ضمن هذا النطاق. لا يصدر شاهد بلا بيانات فعلية.
                  </div>` : html`
                <div class="attendance-evidence-document__metrics">
                  <div><strong class="tabular">${projection.recordedSessions}</strong><span>حصص لها رصد محفوظ</span></div>
                  <div><strong class="tabular">${projection.fullSessions}</strong><span>حصص اكتمل رصدها</span></div>
                  <div><strong class="tabular">${projection.partialSessions}</strong><span>حصص رصدها جزئي</span></div>
                  <div><strong class="tabular">${projection.recordingPercent === null ? '—' : projection.recordingPercent + '٪'}</strong><span>تغطية الرصد في الحصص المعروضة</span></div>
                </div>
                <div class="attendance-evidence-document__section-heading">
                  <h4>سجل الحصص ذات الرصد الفعلي</h4>
                  <span class="tabular">${projection.rows.length} حصة</span>
                </div>
                <div class="attendance-evidence-document__table-wrap">
                  <table class="attendance-evidence-document__table">
                    <thead><tr><th>تاريخ الحصة</th><th>رقم الحصة</th><th>الحضور المرصود</th><th>الحالة</th></tr></thead>
                    <tbody>${projection.rows.map(row => html`
                      <tr><td>${dateLabel(row.date)}</td><td class="tabular">${row.period || '—'}</td>
                        <td class="tabular"><bdi dir="ltr">${row.recorded}/${row.expected}</bdi></td>
                        <td><span class="attendance-evidence-document__state ${row.completed ? 'is-complete' : 'is-partial'}">
                          ${row.completed ? 'رصد مكتمل' : 'رصد جزئي'}</span></td>
                      </tr>`)}</tbody>
                  </table>
                </div>
                <div class="attendance-evidence-document__source">
                  <strong>مصدر الشاهد:</strong> سجلات الحضور المحفوظة في ركيز عند إعداد الوثيقة.
                  عدد علامات الرصد: <bdi dir="ltr">${projection.recordedMarks}/${projection.expectedMarks}</bdi> للطلاب ضمن الحصص المعروضة.
                  ${projection.pendingUnrecorded ? html`<span>توجد ${projection.pendingUnrecorded} حصص مستحقة دون رصد، ولم تُحسب كشواهد.</span>` : ''}
                  ${projection.anomalies ? html`<strong>تنبيه:</strong> ${projection.anomalies} سجلات غير متسقة أو مكررة استُبعدت من الحساب.</strong>` : ''}
                </div>
              `}
              <p class="attendance-evidence-document__disclaimer">
                هذا شاهد توثيقي لمتابعة الرصد المسجل، وليس شهادة بحضور جميع الطلاب، ولا إثباتًا لتطبيق استراتيجية تدريس أو اعتمادًا إداريًا مستقلًا.
              </p>
              ${ready ? reportSignatures({ profile }) : ''}
              ${reportFooter()}
            </div>
          </article>
        </div>
      </div>`;
  },
  actions: {
    teaching(el) { teachingId = el.value; repaint(); },
    from(el) { from = el.value; repaint(); },
    to(el) { to = el.value; repaint(); },
    reset() { from = ''; to = ''; repaint(); },
    async print() {
      const evidence = context().projection;
      if (evidence.error || !evidence.recordedSessions) { toast('لا يمكن تصدير شاهد بلا سجلات حضور محفوظة', 'danger'); return; }
      return printReport('شاهد متابعة الحضور');
    },
  },
};