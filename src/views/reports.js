import '../lib/rakeez-datetime.js';
/** تقارير الفصل: كشوف الطلاب والحضور والدرجات، للطباعة أو CSV. */

import { html, icon, toast, fmtNum, fmtPct, fmtDate, fmtDateFull, openSheet } from '../lib/dom.js';
import * as store from '../store.js';
import {
  itemScore, studentTotal, masteryBand, ATTENDANCE, ATTENDANCE_ORDER, displayRoster, sortStudents,
} from '../models.js';
import { downloadCSV } from '../lib/export.js';
import { demoOutputMarker, markDemoExportRows, markDemoSharedText, reportWithClosing, reportHeader, reportIdentitySheet, reportPageSetup, printReport, prePrintConfirmationSheet, resolvedReportPrincipalName } from '../lib/report-print.js';
import { repaint } from '../repaint.js';
import { getAccountPresentation } from '../lib/account-profile.js';
import { visibleLatinDigits } from '../lib/visible-numerals.js';

let tab = 'grades'; // roster | grades | attendance | support
let sortKey = 'default'; // default | name | roll | score_desc | score_asc | absent_desc
let attMode = 'brief'; // brief | detailed
let filterStartDate = '';
let filterEndDate = '';
let a4Preview = false;

const reportTitle = () => ({ roster: 'كشف الطلاب', attendance: 'كشف الحضور', grades: 'كشف الدرجات', support: 'تقرير من يحتاج دعمًا' }[tab] ?? 'تقرير الفصل');
const safeName = (value) => visibleLatinDigits(value ?? 'فصل').replace(/[\\/:*?"<>|]/g, '-');

export function attendanceSessionsInRange(report, start = '', end = '') {
  return report.sessions.filter((session) => (!start || session.date >= start) && (!end || session.date <= end));
}

export function attendanceHasRecords(report, sessions) {
  return sessions.some((session) => (report.attendanceBySession.get(session.id)?.size ?? 0) > 0);
}

export function gradesHaveValues(roster, items, ctx) {
  return items.some((item) => roster.some((student) => itemScore(item, ctx[student.id]) !== null));
}

export function supportHasIndicators(roster, items, ctx) {
  return gradesHaveValues(roster, items, ctx) || roster.some((student) =>
    ctx[student.id].attendance.some((record) => !record.deleted)
    || ctx[student.id].logs.some((record) => !record.deleted && record.kind === 'participation'));
}

function emptyReportNotice(title, desc) {
  return openSheet({ title, desc, foot: html`<button class="btn btn--primary" data-sheet-close>حسنًا</button>` });
}

export function supportEmptyMessage(hasIndicators) {
  return hasIndicators
    ? { title: 'لا يوجد طلاب تنطبق عليهم مؤشرات الدعم حاليًا', desc: 'راجع المؤشرات أو اختر فصلًا آخر.' }
    : { title: 'لا توجد بيانات كافية لتحديد الطلاب الذين يحتاجون دعمًا', desc: 'ارصد الدرجات أو الحضور أو المشاركة أولًا.' };
}

function supportEmptyNotice(hasIndicators, allowBlankPrint = false) {
  const { title, desc } = supportEmptyMessage(hasIndicators);
  if (!allowBlankPrint) return emptyReportNotice(title, desc);
  return openSheet({
    title,
    desc: `${desc} يمكنك طباعة التقرير فارغًا إذا أردت الاحتفاظ بنسخة ورقية.`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>العودة</button><button class="btn btn--primary" id="empty-support-print">طباعة التقرير فارغًا</button>`,
    onMount: (root, done) => root.querySelector('#empty-support-print')?.addEventListener('click', () => done(true)),
  });
}

function reportAttendance(teachingId) {
  const report = store.attendanceReportContext(teachingId);
  if (store.closedTeachingReport(teachingId)) return report;
  return { ...report, students: displayRoster(report.students, store.students(teachingId)) };
}

function identity(cls) {
  const snapshot = store.latestClosedTermReport(cls.termId);
  const document = snapshot?.payload?.teachingDocuments?.find((entry) => entry.teaching?.id === cls.id);
  if (snapshot && document) {
    const saved = snapshot.payload.identity ?? {};
    return {
      profile: saved.profile ?? {}, year: saved.year?.label ?? '', term: saved.term?.name ?? '',
      section: store.sectionLabel(document.section) ?? '', subject: document.subject?.name ?? '',
    };
  }
  const section = store.getSection(cls.sectionId);
  const term = store.getTerm(cls.termId);
  const year = store.getYear(term?.yearId);
  const principal = resolvedReportPrincipalName(store.state.profile, store.state.device);
  return {
    profile: { ...store.state.profile, reportPrincipalName: principal },
    year: year?.label ?? '', term: term?.name ?? '',
    section: store.sectionLabel(section) ?? '', subject: store.getSubject(cls.subjectId)?.name ?? '',
  };
}

function sortRoster(roster, items, ctx) {
  const arr = [...roster];
  if (sortKey === 'name') {
    return sortStudents(arr);
  } else if (sortKey === 'roll') {
    arr.sort((a, b) => (a.displayNo ?? a.rollNo ?? 9999) - (b.displayNo ?? b.rollNo ?? 9999));
  } else if (sortKey === 'score_desc') {
    arr.sort((a, b) => (studentTotal(items, ctx[b.id]).pct ?? -1) - (studentTotal(items, ctx[a.id]).pct ?? -1));
  } else if (sortKey === 'score_asc') {
    arr.sort((a, b) => (studentTotal(items, ctx[a.id]).pct ?? 9999) - (studentTotal(items, ctx[b.id]).pct ?? 9999));
  } else if (sortKey === 'absent_desc') {
    arr.sort((a, b) => {
      const absA = ctx[a.id].attendance.filter((rec) => !rec.deleted && rec.status === 'absent').length;
      const absB = ctx[b.id].attendance.filter((rec) => !rec.deleted && rec.status === 'absent').length;
      return absB - absA;
    });
  }
  return arr;
}

export default {
  title: () => 'التقارير',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? store.closedTeachingReport(p.id)?.teaching?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  // AI N120: retain the sheet across whole-view repaints (filters and quick scores).
  beforeRender() {
    if (!document.getElementById('report-filter-style')) {
      const style = document.createElement('link');
      style.id = 'report-filter-style';
      style.rel = 'stylesheet';
      style.href = new URL('../styles/filters.css', import.meta.url).href;
      document.head.append(style);
    }
  },

  onMount() {
    tab = 'grades';
    sortKey = 'default';
    attMode = 'brief';
    filterStartDate = '';
    filterEndDate = '';
    a4Preview = false;
  },

  render(p) {
    const historical = store.closedTeachingReport(p.id);
    const cls = historical?.teaching ?? store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(cls) && !historical) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">لا توجد له حقيقة تقارير مغلقة مكتملة.</div></div>`;
    const { roster: savedRoster, items, ctx } = store.teachingContext(cls.id);
    const roster = historical ? savedRoster : displayRoster(savedRoster);
    const attendance = tab === 'attendance' ? reportAttendance(cls.id) : null;
    if (!roster.length && tab !== 'attendance') return html`
      <div class="empty"><div class="empty__icon">${icon('reports')}</div><div class="empty__title">لا بيانات بعد</div><a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a></div>`;

    const sortedRoster = sortRoster(roster, items, ctx).map((student) => ({
      ...student, name: visibleLatinDigits(student.name), rollNo: student.rollNo == null ? student.rollNo : visibleLatinDigits(student.rollNo),
    }));
    const datePeriod = tab === 'attendance'
      ? [filterStartDate && `من ${fmtDateFull(filterStartDate)}`, filterEndDate && `إلى ${fmtDateFull(filterEndDate)}`].filter(Boolean).join(' · ')
      : '';
    const header = reportHeader({ title: reportTitle(), ...identity(cls), period: datePeriod });
    const widePrint = tab === 'grades' || (tab === 'attendance' && attMode === 'detailed');

    const reportBody = html`
      ${tab === 'roster' ? rosterReport(sortedRoster) : ''}
      ${tab === 'grades' ? gradesReport(sortedRoster, items, ctx) : ''}
      ${tab === 'attendance' ? attendanceReport(cls, attendance) : ''}
      ${tab === 'support' ? supportReport(sortedRoster, items, ctx) : ''}
    `;
    const reportContent = html`${header}${reportWithClosing(reportBody, { profile: identity(cls).profile })}`;

    return html`
      <article class="print-report print-report--${tab} ${widePrint ? 'print-report--wide' : ''} report-workspace" dir="rtl">
        ${reportPageSetup({ wide: widePrint })}
        <header class="report-workspace__head noprint">
          <div>
            <span class="report-workspace__eyebrow">تقرير الفصل</span>
            <h2>${reportTitle()}</h2>
            <p>${[identity(cls).section, identity(cls).subject].filter(Boolean).join(' · ')}</p>
            ${demoOutputMarker({ screenOnly: true })}
          </div>
          <span class="badge tabular">${roster.length} طالبًا</span>
        </header>

        <div class="segmented report-tabs noprint" aria-label="أنواع التقارير">
          <button class="segmented__btn ${tab === 'roster' ? 'is-on' : ''}" data-act="tab" data-tab="roster">الطلاب</button>
          <button class="segmented__btn ${tab === 'grades' ? 'is-on' : ''}" data-act="tab" data-tab="grades">الدرجات</button>
          <button class="segmented__btn ${tab === 'attendance' ? 'is-on' : ''}" data-act="tab" data-tab="attendance">الحضور</button>
          <button class="segmented__btn ${tab === 'support' ? 'is-on' : ''}" data-act="tab" data-tab="support">من يحتاج دعمًا</button>
        </div>

        <div class="grades-toolbar report-toolbar report-filter-bar noprint" role="group" aria-label="عوامل تصفية تقرير الفصل">
          <label class="field report-toolbar__field">
            <span class="field__label fs-xs">
              ${icon('filter', 'compact')} ترتيب الكشف
            </span>
            <select class="select" data-change="sort" aria-label="ترتيب التقرير">
              <option value="default" ${sortKey === 'default' ? 'selected' : ''}>الترتيب الافتراضي ${tab === 'support' ? '(الأكثر حاجة للدعم)' : '(السجل)'}</option>
              <option value="name" ${sortKey === 'name' ? 'selected' : ''}>أبجديًا (اسم الطالب)</option>
              <option value="roll" ${sortKey === 'roll' ? 'selected' : ''}>حسب رقم الكشف</option>
              <option value="score_desc" ${sortKey === 'score_desc' ? 'selected' : ''}>الأعلى درجة</option>
              <option value="score_asc" ${sortKey === 'score_asc' ? 'selected' : ''}>الأقل درجة</option>
              <option value="absent_desc" ${sortKey === 'absent_desc' ? 'selected' : ''}>الأكثر غيابًا</option>
            </select>
          </label>
          ${tab === 'attendance'
            ? html`
                <label class="field report-toolbar__date">
                  <span class="field__label">من:</span>
                  <input class="input date-field tabular" type="text" data-rakeez-datetime="date" data-rakeez-date-scope="historical" lang="en" dir="ltr" inputmode="numeric" value="${filterStartDate}" data-change="filter-start">
                </label>
                <label class="field report-toolbar__date">
                  <span class="field__label">إلى:</span>
                  <input class="input date-field tabular" type="text" data-rakeez-datetime="date" data-rakeez-date-scope="historical" lang="en" dir="ltr" inputmode="numeric" value="${filterEndDate}" data-change="filter-end">
                </label>
                <div class="segmented segmented--sm report-toolbar__mode" aria-label="تفصيل كشف الحضور">
                  <button class="segmented__btn ${attMode === 'brief' ? 'is-on' : ''}" data-act="att-mode" data-mode="brief">موجز</button>
                  <button class="segmented__btn ${attMode === 'detailed' ? 'is-on' : ''}" data-act="att-mode" data-mode="detailed">تفصيلي</button>
                </div>
              `
            : ''}
          <button class="btn btn--sm ${a4Preview ? 'btn--primary' : 'btn--ghost'} report-preview-toggle" data-act="toggle-a4" title="معاينة التقرير بصفحة A4 جاهزة للطباعة" aria-pressed="${a4Preview}">
            ${icon('reports')} ${a4Preview ? 'إغلاق المعاينة' : 'معاينة A4'}
          </button>
        </div>

        ${a4Preview
          ? html`
              <div class="a4-preview-container noprint">
                <div class="a4-preview-banner">
                  <span>${icon('reports')} معاينة مستند A4 ${widePrint ? 'أفقي' : 'رأسي'}</span>
                  <button class="btn btn--primary btn--sm" data-act="print">${icon('print')} طباعة المستند الآن</button>
                </div>
                <div class="a4-sheet ${widePrint ? 'a4-sheet--landscape' : ''}">
                  ${reportContent}
                </div>
              </div>
            `
          : ''}

        <div class="report-document ${a4Preview ? 'print-only' : ''}">
          ${reportContent}
        </div>

        <div class="btn-row mt-6 noprint report-actions">
          <button class="btn btn--primary" data-act="print">${icon('print')} طباعة</button>
          <button class="btn btn--ghost" data-act="csv">${icon('download')} تصدير CSV</button>
          <button class="btn btn--quiet" data-act="share">${icon('share')} مشاركة الملخص</button>
        </div>
      </article>
    `;
  },

  actions: {
    tab(el) { tab = el.dataset.tab; repaint(); },
    sort(el) { sortKey = el.value; repaint(); },
    'att-mode'(el) { attMode = el.dataset.mode; repaint(); },
    'toggle-a4'() { a4Preview = !a4Preview; repaint(); },
    'filter-start'(el) { filterStartDate = el.value; repaint(); },
    'filter-end'(el) { filterEndDate = el.value; repaint(); },

    async print(el, ev, params) {
      if (tab === 'attendance') {
        const report = reportAttendance(params.id);
        const sessions = attendanceSessionsInRange(report, filterStartDate, filterEndDate);
        if (!sessions.length || !attendanceHasRecords(report, sessions)) {
          await emptyReportNotice('لا يوجد حضور مرصود في الفترة المحددة', 'غيّر نطاق التاريخ أو ارصد الحضور أولًا.');
          return;
        }
      } else {
        const { roster, items, ctx } = store.teachingContext(params.id);
        if (!roster.length) {
          await emptyReportNotice('لا يوجد طلاب في هذا الفصل', 'أضف الطلاب أو اختر فصلًا آخر قبل إخراج الكشف.');
          return;
        }
        if (tab === 'grades' && !gradesHaveValues(roster, items, ctx)) {
          const proceed = await openSheet({
            title: 'لا توجد درجات مرصودة لهذا الكشف',
            desc: 'يمكنك طباعة كشف فارغ لتعبئته، أو العودة لرصد الدرجات.',
            foot: html`<button class="btn btn--ghost" data-sheet-close>العودة</button><button class="btn btn--primary" id="blank-grade-print">طباعة كشف فارغ</button>`,
            onMount: (root, done) => root.querySelector('#blank-grade-print')?.addEventListener('click', () => done(true)),
          });
          if (!proceed) return;
        }
        if (tab === 'support' && !supportRows(roster, items, ctx).length) {
          const hasIndicators = supportHasIndicators(roster, items, ctx);
          if (!await supportEmptyNotice(hasIndicators, hasIndicators)) return;
        }
      }
      const presentation = getAccountPresentation(store.state.profile?.teacherForm);
      const confirmed = await openSheet({
        title: 'تأكيد بيانات التقرير والطباعة',
        desc: `راجع بيانات ${presentation.teacherLabel} والمدرسة و${presentation.principalLabel} للظهور في ترويسة وتوقيع التقرير.`,
        body: prePrintConfirmationSheet({ profile: store.state.profile, device: store.state.device }),
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" form="pre-print-form">متابعة للطباعة</button>`,
        onMount: (root, done) => {
          const form = root.querySelector('#pre-print-form') || root.querySelector('#report-identity-form');
          form?.addEventListener('submit', (event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            done({
              teacherName: String(fd.get('teacherName') ?? '').trim(),
              schoolName: String(fd.get('schoolName') ?? '').trim(),
              principalName: String(fd.get('principalName') ?? '').trim(),
            });
          });
        },
      });
      if (!confirmed) return;

      const profilePatch = {};
      if (confirmed.teacherName !== undefined) profilePatch.teacherName = confirmed.teacherName;
      if (confirmed.schoolName !== undefined) profilePatch.schoolName = confirmed.schoolName;
      if (confirmed.principalName !== undefined) {
        profilePatch.reportPrincipalName = confirmed.principalName;
        profilePatch.principalName = confirmed.principalName;
      }
      if (Object.keys(profilePatch).length) {
        await store.patchProfile(profilePatch);
      }
      if (confirmed.principalName !== undefined) {
        await store.patchDevice({ reportPrincipalName: confirmed.principalName });
      }

      repaint();

      setTimeout(() => {
        printReport(reportTitle());
      }, 50);
    },

    async identity(el, ev, params) {
      return this.print(el, ev, params);
    },

    async share(el, ev, params) {
      const historical = store.closedTeachingReport(params.id);
      const cls = historical?.teaching ?? store.getTeaching(params.id);
      const { roster, items, ctx } = store.teachingContext(params.id);
      const section = historical?.section ?? store.getSection(cls?.sectionId);
      const subject = historical?.subject ?? store.getSubject(cls?.subjectId);
      const secLabel = store.sectionLabel(section) ?? '';

      const lines = markDemoSharedText([
        `📋 تقرير فصل: ${secLabel} — ${subject?.name ?? ''}`,
        `👥 عدد الطلاب: ${roster.length}`,
        '━━━━━━━━━━━━━━━',
      ]);

      if (tab === 'grades') {
        const totalMax = items.reduce((n, i) => n + i.max, 0);
        lines.push('📊 ملخص الدرجات:');
        lines.push(`• إجمالي الدرجة العظمى: ${totalMax}`);
        const pcts = roster.map((s) => studentTotal(items, ctx[s.id]).pct).filter((p) => p !== null);
        const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
        if (avg !== null) lines.push(`• متوسط درجات الفصل: ${avg}%`);
      } else if (tab === 'attendance') {
        const sessions = store.attendanceReportContext(params.id).sessions;
        lines.push('📅 ملخص الحضور:');
        lines.push(`• إجمالي الحصص: ${sessions.length}`);
      } else if (tab === 'support') {
        const rows = supportRows(roster, items, ctx);
        lines.push(`⚠️ الطلاب المحتاجون للمتابعة: ${rows.length} طالبًا`);
      }

      lines.push('━━━━━━━━━━━━━━━');
      lines.push('تطبيق رَكيز المعلم');
      const text = lines.join('\n');

      await openSheet({
        title: 'مشاركة ملخص التقرير',
        desc: 'نص مختصر وسريع للإرسال عبر واتساب أو الحافظة.',
        body: html`
          <div class="share-preview-box">${text}</div>
          <div class="stack stack-2 mt-3">
            <button class="btn btn--primary btn--block" id="btn-copy-rep">
              ${icon('copy')} نسخ النص
            </button>
            <a class="btn btn--ghost btn--block" href="https://api.whatsapp.com/send?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">
              ${icon('share')} إرسال عبر واتساب
            </a>
          </div>
        `,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>`,
        onMount: (root) => {
          root.querySelector('#btn-copy-rep')?.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast('تم نسخ التقرير للحافظة', 'ok');
            } catch {
              toast('حدد النص وانسخه يدويًا', 'danger');
            }
          });
        },
      });
    },

    csv(el, ev, params) {
      const historical = store.closedTeachingReport(params.id);
      const cls = historical?.teaching ?? store.getTeaching(params.id);
      const { roster: savedRoster, items, ctx } = store.teachingContext(params.id);
      const roster = sortRoster(historical ? savedRoster : displayRoster(savedRoster), items, ctx);
      const safe = safeName(store.sectionLabel(historical?.section ?? store.getSection(cls?.sectionId)));
      if (tab === 'roster') {
        if (!roster.length) { emptyReportNotice('لا يوجد طلاب في هذا الفصل', 'أضف الطلاب أو اختر فصلًا آخر قبل إخراج الكشف.'); return; }
        downloadCSV(`طلاب-${safe}.csv`, markDemoExportRows([['رقم الكشف', 'الطالب'], ...roster.map((s) => [(s.displayNo ?? s.rollNo) ?? '', s.name])]));
        toast('نُزّل كشف الطلاب'); return;
      }
      if (tab === 'attendance') {
        const report = reportAttendance(params.id);
        const sessions = attendanceSessionsInRange(report, filterStartDate, filterEndDate);
        if (!sessions.length || !attendanceHasRecords(report, sessions)) { emptyReportNotice('لا يوجد حضور مرصود في الفترة المحددة', 'غيّر نطاق التاريخ أو ارصد الحضور أولًا.'); return; }
        const rows = [['رقم الكشف', 'الطالب', ...sessions.map((session) => `${fmtDateFull(session.date)} · الحصة ${session.period}`), 'الغياب', 'التأخر']];
        for (const student of report.students) {
          const records = sessions.map((session) => report.attendanceBySession.get(session.id)?.get(student.id) ?? null).filter(Boolean);
          rows.push([(student.displayNo ?? student.rollNo) ?? '', student.name, ...sessions.map((session) => {
            const member = report.rosterBySession.get(session.id)?.members.some((candidate) => candidate.id === student.id);
            const record = report.attendanceBySession.get(session.id)?.get(student.id);
            return member && record ? ATTENDANCE[record.status].label : '';
          }), records.filter((record) => record.status === 'absent').length, records.filter((record) => record.status === 'late').length]);
        }
        downloadCSV(`حضور-${safe}.csv`, markDemoExportRows(rows)); toast('نُزّل كشف الحضور'); return;
      }
      if (tab === 'support') {
        const rows = [['رقم الكشف', 'الطالب', 'النسبة', 'مؤشرات الدعم']];
        for (const row of supportRows(roster, items, ctx)) {
          rows.push([(row.s.displayNo ?? row.s.rollNo) ?? '', row.s.name, row.total.pct === null ? '' : Math.round(row.total.pct), row.reasons.join(' · ')]);
        }
        if (rows.length === 1) { supportEmptyNotice(supportHasIndicators(roster, items, ctx)); return; }
        downloadCSV(`دعم-${safe}.csv`, markDemoExportRows(rows)); toast('نُزّل تقرير من يحتاج دعمًا'); return;
      }
      const rows = [['رقم الكشف', 'الطالب', ...items.map((i) => `${i.name} (${i.max})`), 'المجموع', 'النسبة']];
      for (const s of roster) {
        const total = studentTotal(items, ctx[s.id]);
        rows.push([(s.displayNo ?? s.rollNo) ?? '', s.name, ...items.map((i) => { const value = itemScore(i, ctx[s.id]); return value === null ? '' : fmtNum(value); }), fmtNum(total.earned), total.pct === null ? '' : Math.round(total.pct)]);
      }
      if (!gradesHaveValues(roster, items, ctx)) { emptyReportNotice('لا توجد درجات مرصودة لهذا الكشف', 'ارصد الدرجات أولًا، أو اطبع كشفًا فارغًا لتعبئته.'); return; }
      downloadCSV(`درجات-${safe}.csv`, markDemoExportRows(rows)); toast('نُزّل كشف الدرجات');
    },
  },
};

function rosterReport(roster) {
  return html`<div class="tablewrap print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th>اسم الطالب</th></tr></thead><tbody>${roster.map((s, index) => html`<tr><td class="tabular">${(s.displayNo ?? s.rollNo) ?? index + 1}</td><th>${s.name}</th></tr>`)}</tbody></table></div>`;
}

function gradesReport(roster, items, ctx) {
  const table = gradesTable(roster, items, ctx);
  // Keep the screen/CSV's full scope; paper can split columns without shrinking
  // Arabic headings or losing selected items. Totals always use all items.
  const columnsPerPage = 5;
  if (items.length <= columnsPerPage) return table;
  const chunks = Array.from({ length: Math.ceil(items.length / columnsPerPage) },
    (_, index) => items.slice(index * columnsPerPage, (index + 1) * columnsPerPage));
  return html`<div class="grades-report-screen noprint">${table}</div>
    <div class="grades-report-print print-only">${chunks.map((chunk, index) => html`
      <div class="report-chunk ${index < chunks.length - 1 ? 'print-page-break' : ''}">
        ${gradesTable(roster, chunk, ctx, items)}
      </div>`)}
    </div>`;
}

function gradesTable(roster, items, ctx, allItems = items) {
  const totalMax = allItems.reduce((n, i) => n + i.max, 0);
  return html`<div class="tablewrap scroll-x print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th class="gtable__sticky">الطالب</th>${items.map((i) => html`<th>${i.name}<span class="gtable__max tabular">${i.max}</span></th>`)}<th>المجموع<span class="gtable__max tabular">${totalMax}</span></th><th>النسبة</th></tr></thead><tbody>${roster.map((s) => { const total = studentTotal(allItems, ctx[s.id]); const band = masteryBand(total.pct); return html`<tr><td class="tabular t-3">${(s.displayNo ?? s.rollNo) ?? ''}</td><th class="gtable__sticky"><a href="#/student/${s.id}">${s.name}</a></th>${items.map((i) => { const value = itemScore(i, ctx[s.id]); return html`<td class="tabular ${value === null ? 't-3' : ''}">${value === null ? '—' : fmtNum(value)}</td>`; })}<td class="tabular fw-7">${fmtNum(total.earned)}</td><td><span class="badge ${band.badge} tabular">${fmtPct(total.pct)}</span></td></tr>`; })}</tbody></table></div>`;
}

function attendanceReport(cls, report) {
  const sessions = attendanceSessionsInRange(report, filterStartDate, filterEndDate);
  if (!sessions.length) return html`<div class="empty"><div class="empty__icon">${icon('attendance')}</div><div class="empty__title">لم يُرصد حضور بعد</div><a class="btn btn--primary noprint" href="#/teaching/${cls.id}/attendance">${icon('attendance')} ابدأ الرصد</a></div>`;

  const visibleStudents = report.students.map((student) => ({
    ...student, name: visibleLatinDigits(student.name), rollNo: student.rollNo == null ? student.rollNo : visibleLatinDigits(student.rollNo),
  }));
  const rosterFor = (session, studentId) => report.rosterBySession.get(session.id)?.members.find((student) => student.id === studentId) ?? null;
  const recordFor = (session, studentId) => report.attendanceBySession.get(session.id)?.get(studentId) ?? null;
  const tallyFor = (studentId) => {
    const tally = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const session of sessions) {
      const record = recordFor(session, studentId);
      if (record) tally[record.status] = (tally[record.status] ?? 0) + 1;
    }
    return tally;
  };
  if (attMode === 'brief') return html`
    <div class="tablewrap print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th>الطالب</th><th>نسبة الحضور</th><th>حضور</th><th>تأخر</th><th>استئذان</th><th>غياب</th></tr></thead><tbody>
      ${visibleStudents.map((student) => {
        const tally = tallyFor(student.id); const total = Object.values(tally).reduce((sum, value) => sum + value, 0);
        const pct = total ? Math.round(((tally.present + tally.late) / total) * 100) : null;
        return html`<tr><td class="tabular">${(student.displayNo ?? student.rollNo) ?? ''}</td><th><a href="#/student/${student.id}">${student.name}</a></th><td class="tabular fw-7">${pct === null ? '—' : `${pct}%`}</td><td class="tabular t-3">${tally.present || '—'}</td><td class="tabular t-3">${tally.late || '—'}</td><td class="tabular t-3">${tally.excused || '—'}</td><td class="tabular ${tally.absent ? 'fw-7 is-danger' : 't-3'}">${tally.absent || '—'}</td></tr>`;
      })}
    </tbody></table></div>`;

  const CHUNK_SIZE = 12;
  const chunks = Array.from({ length: Math.ceil(sessions.length / CHUNK_SIZE) }, (_, index) => sessions.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
  return html`<p class="t-3 fs-sm mb-3 noprint">${sessions.length} حصة مرصودة.</p>${chunks.map((chunk, chunkIndex) => html`
    <div class="report-chunk ${chunkIndex < chunks.length - 1 ? 'print-page-break' : ''}"><div class="tablewrap scroll-x print-tablewrap"><table class="gtable gtable--report"><thead><tr><th class="gtable__sticky">الطالب</th>${chunk.map((session) => html`<th class="att-col">${fmtDate(session.date, false)} · ${session.period}</th>`)}${chunkIndex === chunks.length - 1 ? ATTENDANCE_ORDER.map((key) => html`<th>${ATTENDANCE[key].label}</th>`) : ''}</tr></thead><tbody>
      ${visibleStudents.map((student) => {
        const tally = tallyFor(student.id);
        return html`<tr><th class="gtable__sticky"><span class="gtable__roll tabular">${(student.displayNo ?? student.rollNo) ?? ''}</span>${student.name}</th>${chunk.map((session) => {
          const member = rosterFor(session, student.id); const record = recordFor(session, student.id);
          return html`<td class="att-cell ${record ? 'is-' + record.status : ''}">${member && record ? ATTENDANCE[record.status].short : member ? '—' : ''}</td>`;
        })}${chunkIndex === chunks.length - 1 ? ATTENDANCE_ORDER.map((key) => html`<td class="tabular ${key === 'absent' && tally[key] ? 'fw-7' : 't-3'}">${tally[key] || ''}</td>`) : ''}</tr>`;
      })}
    </tbody></table></div></div>`)} `;
}

export function supportRows(roster, items, ctx) {
  const validItems = items.filter((i) => !i.auto && !i.deleted);
  const rows = roster.map((s) => {
    const total = studentTotal(items, ctx[s.id]);
    const absents = ctx[s.id].attendance.filter((a) => !a.deleted && a.status === 'absent').length;
    const part = ctx[s.id].logs.filter((l) => !l.deleted && l.kind === 'participation').reduce((n, l) => n + l.delta, 0);
    const reasons = [];
    if (total.pct !== null && total.pct < 50) reasons.push('الدرجات دون 50٪');
    if (absents >= 3) reasons.push(`${absents} غيابات`);
    if (part <= 0 && total.pct !== null && validItems.length > 0) reasons.push('لا مشاركة مرصودة');
    if (total.missing > 0 && validItems.length > 0 && total.missing === validItems.length) reasons.push('لم يُرصد له شيء');
    return { s, total, reasons, absents };
  }).filter((row) => row.reasons.length);

  if (sortKey === 'default') {
    rows.sort((a, b) => {
      const pctA = a.total.pct === null ? 0 : a.total.pct;
      const pctB = b.total.pct === null ? 0 : b.total.pct;
      if (pctA !== pctB) return pctA - pctB;
      if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
      return (b.absents ?? 0) - (a.absents ?? 0);
    });
  }
  return rows;
}

function supportReport(roster, items, ctx) {
  const rows = supportRows(roster, items, ctx);
  if (!rows.length) return supportHasIndicators(roster, items, ctx)
    ? html`<div class="empty"><div class="empty__icon">${icon('check')}</div><div class="empty__title">لا يوجد طلاب تنطبق عليهم مؤشرات الدعم حاليًا</div></div>`
    : html`<div class="empty"><div class="empty__icon">${icon('check')}</div><div class="empty__title">لا توجد بيانات كافية لتحديد الطلاب الذين يحتاجون دعمًا</div><div class="empty__text">ارصد الدرجات أو الحضور أو المشاركة أولًا.</div></div>`;
  return html`<div class="support-report-screen noprint"><p class="t-3 fs-sm mb-3">${rows.length} طالبًا تستدعي حالتهم نظرة.</p><div class="list">${rows.map((row) => html`<a class="row" href="#/student/${row.s.id}"><span class="rollno">${(row.s.displayNo ?? row.s.rollNo) ?? '—'}</span><span class="row__main"><span class="row__title">${row.s.name}</span><span class="row__sub">${row.reasons.join(' · ')}</span></span><span class="row__end"><span class="badge ${masteryBand(row.total.pct).badge} tabular">${fmtPct(row.total.pct)}</span><span class="row__chev">${icon('chev', 'compact')}</span></span></a>`)}</div></div><div class="tablewrap print-tablewrap print-only support-report-print"><table class="gtable gtable--report"><thead><tr><th>#</th><th>الطالب</th><th>مؤشرات الدعم</th><th>النسبة</th></tr></thead><tbody>${rows.map((row) => html`<tr><td class="tabular">${(row.s.displayNo ?? row.s.rollNo) ?? ''}</td><th>${row.s.name}</th><td>${row.reasons.join(' · ')}</td><td class="tabular">${fmtPct(row.total.pct)}</td></tr>`)}</tbody></table></div>`;
}
