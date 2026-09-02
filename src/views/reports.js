/** تقارير الفصل: كشوف الطلاب والحضور والدرجات، للطباعة أو CSV. */

import { html, icon, toast, fmtNum, fmtPct, fmtDate, fmtDateFull, openSheet } from '../lib/dom.js';
import * as store from '../store.js';
import {
  itemScore, studentTotal, masteryBand, ATTENDANCE, ATTENDANCE_ORDER,
} from '../models.js';
import { downloadCSV } from '../lib/export.js';
import { reportHeader, reportIdentitySheet, reportSignatures } from '../lib/report-print.js';
import { repaint } from '../repaint.js';

let tab = 'grades'; // roster | grades | attendance | support
let sortKey = 'default'; // default | name | roll | score_desc | score_asc | absent_desc
let attMode = 'brief'; // brief | detailed
let filterStartDate = '';
let filterEndDate = '';
let a4Preview = false;

const reportTitle = () => ({ roster: 'كشف الطلاب', attendance: 'كشف الحضور', grades: 'كشف الدرجات', support: 'تقرير من يحتاج دعمًا' }[tab] ?? 'تقرير الفصل');
const safeName = (value) => String(value ?? 'فصل').replace(/[\\/:*?"<>|]/g, '-');

function identity(cls) {
  const section = store.getSection(cls.sectionId);
  const term = store.getTerm(cls.termId);
  const year = store.getYear(term?.yearId);
  return {
    profile: { ...store.state.profile, reportPrincipalName: store.state.device?.reportPrincipalName ?? '' },
    year: year?.label ?? '', term: term?.name ?? '',
    section: store.sectionLabel(section) ?? '', subject: store.getSubject(cls.subjectId)?.name ?? '',
  };
}

function sortRoster(roster, items, ctx) {
  const arr = [...roster];
  if (sortKey === 'name') {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  } else if (sortKey === 'roll') {
    arr.sort((a, b) => (a.rollNo ?? 9999) - (b.rollNo ?? 9999));
  } else if (sortKey === 'score_desc') {
    arr.sort((a, b) => (studentTotal(items, ctx[b.id]).pct ?? -1) - (studentTotal(items, ctx[a.id]).pct ?? -1));
  } else if (sortKey === 'score_asc') {
    arr.sort((a, b) => (studentTotal(items, ctx[a.id]).pct ?? 9999) - (studentTotal(items, ctx[b.id]).pct ?? 9999));
  } else if (sortKey === 'absent_desc') {
    arr.sort((a, b) => {
      const absA = ctx[a.id].attendance.filter((rec) => rec.status === 'absent').length;
      const absB = ctx[b.id].attendance.filter((rec) => rec.status === 'absent').length;
      return absB - absA;
    });
  }
  return arr;
}

export default {
  title: () => 'التقارير',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() {
    tab = 'grades';
    sortKey = 'default';
    attMode = 'brief';
    filterStartDate = '';
    filterEndDate = '';
    a4Preview = false;
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    const { roster, items, ctx } = store.teachingContext(cls.id);
    if (!roster.length) return html`
      <div class="empty"><div class="empty__icon">${icon('reports')}</div><div class="empty__title">لا بيانات بعد</div><a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a></div>`;

    const sortedRoster = sortRoster(roster, items, ctx);
    const header = reportHeader({ title: reportTitle(), ...identity(cls) });

    const reportContent = html`
      ${header}
      ${tab === 'roster' ? rosterReport(sortedRoster) : ''}
      ${tab === 'grades' ? gradesReport(sortedRoster, items, ctx) : ''}
      ${tab === 'attendance' ? attendanceReport(cls, sortedRoster, ctx) : ''}
      ${tab === 'support' ? supportReport(sortedRoster, items, ctx) : ''}
      ${reportSignatures({ profile: identity(cls).profile })}
    `;

    return html`
      <article class="print-report print-report--${tab}" dir="rtl">
        <div class="segmented mb-3 noprint" aria-label="أنواع التقارير">
          <button class="segmented__btn ${tab === 'roster' ? 'is-on' : ''}" data-act="tab" data-tab="roster">الطلاب</button>
          <button class="segmented__btn ${tab === 'grades' ? 'is-on' : ''}" data-act="tab" data-tab="grades">الدرجات</button>
          <button class="segmented__btn ${tab === 'attendance' ? 'is-on' : ''}" data-act="tab" data-tab="attendance">الحضور</button>
          <button class="segmented__btn ${tab === 'support' ? 'is-on' : ''}" data-act="tab" data-tab="support">من يحتاج دعمًا</button>
        </div>

        <!-- شريط الترتيب العام وأدوات العرض -->
        <div class="grades-toolbar noprint mb-3">
          <label class="field" style="margin-bottom:0; flex: 1; min-width: 140px;">
            <select class="select" data-change="sort" aria-label="ترتيب التقرير">
              <option value="default" ${sortKey === 'default' ? 'selected' : ''}>الترتيب الافتراضي</option>
              <option value="name" ${sortKey === 'name' ? 'selected' : ''}>أبجديًا (اسم الطالب)</option>
              <option value="roll" ${sortKey === 'roll' ? 'selected' : ''}>حسب رقم الكشف</option>
              <option value="score_desc" ${sortKey === 'score_desc' ? 'selected' : ''}>الأعلى درجة</option>
              <option value="score_asc" ${sortKey === 'score_asc' ? 'selected' : ''}>الأقل درجة</option>
              <option value="absent_desc" ${sortKey === 'absent_desc' ? 'selected' : ''}>الأكثر غيابًا</option>
            </select>
          </label>
          ${tab === 'attendance'
            ? html`
                <div class="segmented segmented--sm">
                  <button class="segmented__btn ${attMode === 'brief' ? 'is-on' : ''}" data-act="att-mode" data-mode="brief">موجز</button>
                  <button class="segmented__btn ${attMode === 'detailed' ? 'is-on' : ''}" data-act="att-mode" data-mode="detailed">تفصيلي</button>
                </div>
              `
            : ''}
          <button class="btn btn--sm ${a4Preview ? 'btn--primary' : 'btn--ghost'}" data-act="toggle-a4" title="معاينة التقرير بصفحة A4 جاهزة للطباعة">
            ${icon('reports')} ${a4Preview ? 'إغلاق المعاينة' : 'معاينة A4'}
          </button>
        </div>

        ${a4Preview
          ? html`
              <div class="a4-preview-container noprint">
                <div class="a4-preview-banner">
                  <span>📄 وضع معاينة صفحة A4 الحقيقية</span>
                  <button class="btn btn--primary btn--sm" data-act="print">${icon('print')} طباعة المستند الآن</button>
                </div>
                <div class="a4-sheet">
                  ${reportContent}
                </div>
              </div>
            `
          : ''}

        <div class="${a4Preview ? 'print-only' : ''}">
          ${reportContent}
        </div>

        <div class="btn-row mt-6 noprint report-actions">
          <button class="btn btn--primary" data-act="share">${icon('share')} مشاركة ملخص التقرير</button>
          <button class="btn btn--ghost" data-act="toggle-a4">${icon('reports')} ${a4Preview ? 'الوضع العادي' : 'معاينة A4'}</button>
          <button class="btn btn--ghost" data-act="identity">${icon('edit')} بيانات التقرير والطباعة</button>
          <button class="btn btn--ghost" data-act="print">${icon('print')} طباعة</button>
          <button class="btn btn--ghost" data-act="csv">${icon('download')} تصدير CSV</button>
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
    print() { window.print(); },

    async share(el, ev, params) {
      const cls = store.getTeaching(params.id);
      const { roster, items, ctx } = store.teachingContext(params.id);
      const section = store.getSection(cls?.sectionId);
      const subject = store.getSubject(cls?.subjectId);
      const secLabel = store.sectionLabel(section) ?? '';

      const lines = [
        `📋 تقرير فصل: ${secLabel} — ${subject?.name ?? ''}`,
        `👥 عدد الطلاب: ${roster.length}`,
        '━━━━━━━━━━━━━━━',
      ];

      if (tab === 'grades') {
        const totalMax = items.reduce((n, i) => n + i.max, 0);
        lines.push('📊 ملخص الدرجات:');
        lines.push(`• إجمالي الدرجة العظمى: ${totalMax}`);
        const pcts = roster.map((s) => studentTotal(items, ctx[s.id]).pct).filter((p) => p !== null);
        const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
        if (avg !== null) lines.push(`• متوسط درجات الفصل: ${avg}%`);
      } else if (tab === 'attendance') {
        const dates = store.sessionDates(params.id);
        lines.push('📅 ملخص الحضور:');
        lines.push(`• إجمالي الأيام المرصودة: ${dates.length}`);
      } else if (tab === 'support') {
        const rows = supportRows(roster, items, ctx);
        lines.push(`⚠️ الطلاب المحتاجون للمتابعة: ${rows.length} طالبًا`);
      }

      lines.push('━━━━━━━━━━━━━━━');
      lines.push('تطبيق رَكيز X للمعلم');
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

    async identity() {
      const value = await openSheet({
        title: 'بيانات التقرير والطباعة',
        desc: 'بيانات المعلم والمدرسة تأتي من الإعدادات. مدير المدرسة اختياري ومحفوظ على هذا الجهاز.',
        body: reportIdentitySheet({ profile: store.state.profile, device: store.state.device }),
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" form="report-identity-form">حفظ</button>`,
        onMount: (root, done) => root.querySelector('#report-identity-form').addEventListener('submit', (event) => {
          event.preventDefault(); done(String(new FormData(event.currentTarget).get('principalName') ?? '').trim());
        }),
      });
      if (value === undefined) return;
      const saved = await store.patchDevice({ reportPrincipalName: value });
      toast(saved ? 'حُفظت بيانات التقرير' : 'تعذّر حفظ بيانات التقرير', saved ? undefined : 'danger');
    },

    csv(el, ev, params) {
      const cls = store.getTeaching(params.id);
      const { roster, items, ctx } = store.teachingContext(params.id);
      const safe = safeName(store.sectionLabel(store.getSection(cls?.sectionId)));
      if (tab === 'roster') {
        downloadCSV(`طلاب-${safe}.csv`, [['رقم الكشف', 'الطالب'], ...roster.map((s) => [s.rollNo ?? '', s.name])]);
        toast('نُزّل كشف الطلاب'); return;
      }
      if (tab === 'attendance') {
        const dates = store.sessionDates(params.id).slice().reverse();
        const rows = [['رقم الكشف', 'الطالب', ...dates.map((d) => fmtDateFull(d)), 'الغياب', 'التأخر']];
        for (const s of roster) {
          const records = ctx[s.id].attendance;
          const byDate = new Map(records.map((a) => [a.date, a.status]));
          rows.push([s.rollNo ?? '', s.name, ...dates.map((d) => byDate.has(d) ? ATTENDANCE[byDate.get(d)].label : ''), records.filter((a) => a.status === 'absent').length, records.filter((a) => a.status === 'late').length]);
        }
        downloadCSV(`حضور-${safe}.csv`, rows); toast('نُزّل كشف الحضور'); return;
      }
      if (tab === 'support') {
        const rows = [['رقم الكشف', 'الطالب', 'النسبة', 'مؤشرات الدعم']];
        for (const row of supportRows(roster, items, ctx)) {
          rows.push([row.s.rollNo ?? '', row.s.name, row.total.pct === null ? '' : Math.round(row.total.pct), row.reasons.join(' · ')]);
        }
        downloadCSV(`دعم-${safe}.csv`, rows); toast('نُزّل تقرير من يحتاج دعمًا'); return;
      }
      const rows = [['رقم الكشف', 'الطالب', ...items.map((i) => `${i.name} (${i.max})`), 'المجموع', 'النسبة']];
      for (const s of roster) {
        const total = studentTotal(items, ctx[s.id]);
        rows.push([s.rollNo ?? '', s.name, ...items.map((i) => { const value = itemScore(i, ctx[s.id]); return value === null ? '' : fmtNum(value); }), fmtNum(total.earned), total.pct === null ? '' : Math.round(total.pct)]);
      }
      downloadCSV(`درجات-${safe}.csv`, rows); toast('نُزّل كشف الدرجات');
    },
  },
};

function rosterReport(roster) {
  return html`<div class="tablewrap print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th>اسم الطالب</th></tr></thead><tbody>${roster.map((s, index) => html`<tr><td class="tabular">${s.rollNo ?? index + 1}</td><th>${s.name}</th></tr>`)}</tbody></table></div>`;
}

function gradesReport(roster, items, ctx) {
  const totalMax = items.reduce((n, i) => n + i.max, 0);
  return html`<div class="tablewrap scroll-x print-tablewrap"><table class="gtable gtable--report"><thead><tr><th>#</th><th class="gtable__sticky">الطالب</th>${items.map((i) => html`<th>${i.name}<span class="gtable__max tabular">${i.max}</span></th>`)}<th>المجموع<span class="gtable__max tabular">${totalMax}</span></th><th>النسبة</th></tr></thead><tbody>${roster.map((s) => { const total = studentTotal(items, ctx[s.id]); const band = masteryBand(total.pct); return html`<tr><td class="tabular t-3">${s.rollNo ?? ''}</td><th class="gtable__sticky"><a href="#/student/${s.id}">${s.name}</a></th>${items.map((i) => { const value = itemScore(i, ctx[s.id]); return html`<td class="tabular ${value === null ? 't-3' : ''}">${value === null ? '—' : fmtNum(value)}</td>`; })}<td class="tabular fw-7">${fmtNum(total.earned)}</td><td><span class="badge ${band.badge} tabular">${fmtPct(total.pct)}</span></td></tr>`; })}</tbody></table></div>`;
}

function attendanceReport(cls, roster, ctx) {
  const allDates = store.sessionDates(cls.id);
  if (!allDates.length) return html`<div class="empty"><div class="empty__icon">${icon('attendance')}</div><div class="empty__title">لم يُرصد حضور بعد</div><a class="btn btn--primary noprint" href="#/teaching/${cls.id}/attendance">${icon('attendance')} ابدأ الرصد</a></div>`;

  let dates = allDates;
  if (filterStartDate) dates = dates.filter((d) => d >= filterStartDate);
  if (filterEndDate) dates = dates.filter((d) => d <= filterEndDate);

  if (attMode === 'brief') {
    return html`
      <div class="hstack gap-2 mb-3 noprint fs-sm">
        <label class="field" style="margin-bottom:0">
          <span class="field__label fs-xs">من تاريخ</span>
          <input class="input" type="date" value="${filterStartDate}" data-change="filter-start">
        </label>
        <label class="field" style="margin-bottom:0">
          <span class="field__label fs-xs">إلى تاريخ</span>
          <input class="input" type="date" value="${filterEndDate}" data-change="filter-end">
        </label>
      </div>
      <div class="tablewrap print-tablewrap">
        <table class="gtable gtable--report">
          <thead>
            <tr>
              <th>#</th>
              <th>الطالب</th>
              <th>نسبة الحضور</th>
              <th>حضور</th>
              <th>تأخر</th>
              <th>استئذان</th>
              <th>غياب</th>
            </tr>
          </thead>
          <tbody>
            ${roster.map((s) => {
              const records = ctx[s.id].attendance.filter((a) => {
                if (filterStartDate && a.date < filterStartDate) return false;
                if (filterEndDate && a.date > filterEndDate) return false;
                return true;
              });
              const tally = { present: 0, late: 0, excused: 0, absent: 0 };
              for (const a of records) tally[a.status] = (tally[a.status] ?? 0) + 1;
              const total = records.length;
              const pct = total ? Math.round(((tally.present + tally.late) / total) * 100) : null;
              return html`
                <tr>
                  <td class="tabular">${s.rollNo ?? ''}</td>
                  <th><a href="#/student/${s.id}">${s.name}</a></th>
                  <td class="tabular fw-7">${pct !== null ? `${pct}%` : '—'}</td>
                  <td class="tabular t-3">${tally.present || '—'}</td>
                  <td class="tabular t-3">${tally.late || '—'}</td>
                  <td class="tabular t-3">${tally.excused || '—'}</td>
                  <td class="tabular ${tally.absent ? 'fw-7 is-danger' : 't-3'}">${tally.absent || '—'}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  // Detailed mode with clean ~12 session chunk pagination
  const CHUNK_SIZE = 12;
  const allReversed = dates.slice().reverse();
  const chunks = [];
  if (allReversed.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < allReversed.length; i += CHUNK_SIZE) {
      chunks.push(allReversed.slice(i, i + CHUNK_SIZE));
    }
  }

  return html`
    <div class="hstack gap-2 mb-3 noprint fs-sm">
      <label class="field" style="margin-bottom:0">
        <span class="field__label fs-xs">من تاريخ</span>
        <input class="input" type="date" value="${filterStartDate}" data-change="filter-start">
      </label>
      <label class="field" style="margin-bottom:0">
        <span class="field__label fs-xs">إلى تاريخ</span>
        <input class="input" type="date" value="${filterEndDate}" data-change="filter-end">
      </label>
    </div>
    <p class="t-3 fs-sm mb-3 noprint">${dates.length} يومًا مرصودًا ${chunks.length > 1 ? `(مُقسّمة إلى ${chunks.length} صفحات طباعة لملائمة مقاس A4)` : ''}.</p>

    ${chunks.map(
      (chunkDates, chunkIdx) => html`
        <div class="report-chunk ${chunkIdx < chunks.length - 1 ? 'print-page-break' : ''}">
          ${chunks.length > 1
            ? html`
                <div class="report-chunk__head noprint">
                  <span class="badge">الصفحة ${chunkIdx + 1} من ${chunks.length}</span>
                  <span class="fs-xs t-3">الحصص (${chunkIdx * CHUNK_SIZE + 1} إلى ${Math.min((chunkIdx + 1) * CHUNK_SIZE, allReversed.length)})</span>
                </div>
              `
            : ''}
          <div class="tablewrap scroll-x print-tablewrap">
            <table class="gtable gtable--report">
              <thead>
                <tr>
                  <th class="gtable__sticky">الطالب</th>
                  ${chunkDates.map((d) => html`<th class="att-col">${fmtDate(d, false)}</th>`)}
                  ${chunkIdx === chunks.length - 1
                    ? ATTENDANCE_ORDER.map((k) => html`<th>${ATTENDANCE[k].label}</th>`)
                    : ''}
                </tr>
              </thead>
              <tbody>
                ${roster.map((s) => {
                  const byDate = new Map(ctx[s.id].attendance.map((a) => [a.date, a.status]));
                  const tally = { present: 0, late: 0, excused: 0, absent: 0 };
                  for (const a of ctx[s.id].attendance) tally[a.status] = (tally[a.status] ?? 0) + 1;
                  return html`
                    <tr>
                      <th class="gtable__sticky"><span class="gtable__roll tabular">${s.rollNo ?? ''}</span>${s.name}</th>
                      ${chunkDates.map((d) => {
                        const state = byDate.get(d);
                        return html`<td class="att-cell ${state ? 'is-' + state : ''}">${state ? ATTENDANCE[state].short : ''}</td>`;
                      })}
                      ${chunkIdx === chunks.length - 1
                        ? ATTENDANCE_ORDER.map((k) => html`<td class="tabular ${k === 'absent' && tally[k] ? 'fw-7' : 't-3'}">${tally[k] || ''}</td>`)
                        : ''}
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        </div>
      `
    )}
  `;
}

function supportRows(roster, items, ctx) {
  return roster.map((s) => { const total = studentTotal(items, ctx[s.id]); const absents = ctx[s.id].attendance.filter((a) => a.status === 'absent').length; const part = ctx[s.id].logs.filter((l) => l.kind === 'participation').reduce((n, l) => n + l.delta, 0); const reasons = []; if (total.pct !== null && total.pct < 50) reasons.push('الدرجات دون ٥٠٪'); if (absents >= 3) reasons.push(`${absents} غيابات`); if (part <= 0 && total.pct !== null) reasons.push('لا مشاركة مرصودة'); if (total.missing > 0 && total.missing === items.filter((i) => !i.auto).length) reasons.push('لم يُرصد له شيء'); return { s, total, reasons }; }).filter((row) => row.reasons.length).sort((a, b) => (a.total.pct ?? 999) - (b.total.pct ?? 999));
}

function supportReport(roster, items, ctx) {
  const rows = supportRows(roster, items, ctx);
  if (!rows.length) return html`<div class="empty"><div class="empty__icon">${icon('check')}</div><div class="empty__title">لا أحد تحت المؤشرات</div><div class="empty__text">لا طالب درجته دون ٥٠٪ ولا من تجاوز ثلاث غيابات.</div></div>`;
  return html`<p class="t-3 fs-sm mb-3 noprint">${rows.length} طالبًا تستدعي حالتهم نظرة.</p><div class="list noprint">${rows.map((row) => html`<a class="row" href="#/student/${row.s.id}"><span class="rollno">${row.s.rollNo ?? '—'}</span><span class="row__main"><span class="row__title">${row.s.name}</span><span class="row__sub">${row.reasons.join(' · ')}</span></span><span class="row__end"><span class="badge ${masteryBand(row.total.pct).badge} tabular">${fmtPct(row.total.pct)}</span>${icon('chev')}</span></a>`)}</div><div class="tablewrap print-tablewrap print-only"><table class="gtable gtable--report"><thead><tr><th>#</th><th>الطالب</th><th>النسبة</th><th>مؤشرات الدعم</th></tr></thead><tbody>${rows.map((row) => html`<tr><td class="tabular">${row.s.rollNo ?? ''}</td><th>${row.s.name}</th><td class="tabular">${fmtPct(row.total.pct)}</td><td>${row.reasons.join(' · ')}</td></tr>`)}</tbody></table></div>`;
}
