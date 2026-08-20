/** تقارير الفصل: كشف الدرجات، كشف الحضور، والتصدير للطباعة أو لإكسل. */

import { html, icon, toast, fmtNum, fmtPct, fmtDate, fmtDateFull } from '../lib/dom.js';
import * as store from '../store.js';
import {
  itemScore, studentTotal, masteryBand, ATTENDANCE, ATTENDANCE_ORDER, gradeLabel,
} from '../models.js';
import { downloadCSV } from '../lib/export.js';
import { repaint } from '../repaint.js';

let tab = 'grades';   // grades | attendance | support

export default {
  title: () => 'التقارير',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() {
    tab = 'grades';
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const { roster, items, ctx } = store.teachingContext(cls.id);
    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('reports')}</div>
          <div class="empty__title">لا بيانات بعد</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    return html`
      <div class="printhead">
        <div class="printhead__title">
          ${store.getSection(cls.sectionId)?.name ?? ''} — ${gradeLabel(store.getSection(cls.sectionId)?.grade)}
        </div>
        <div class="printhead__sub">
          ${store.getSubject(cls.subjectId)?.name ?? ''}
          ${store.getTerm(cls.termId)?.name ? ` · ${store.getTerm(cls.termId).name}` : ''}
          ${store.state.profile?.teacherName ? ` · ${store.state.profile.teacherName}` : ''}
          ${store.state.profile?.schoolName ? ` · ${store.state.profile.schoolName}` : ''}
        </div>
      </div>

      <div class="segmented mb-3 noprint">
        <button class="segmented__btn ${tab === 'grades' ? 'is-on' : ''}" data-act="tab" data-tab="grades">الدرجات</button>
        <button class="segmented__btn ${tab === 'attendance' ? 'is-on' : ''}" data-act="tab" data-tab="attendance">الحضور</button>
        <button class="segmented__btn ${tab === 'support' ? 'is-on' : ''}" data-act="tab" data-tab="support">من يحتاج دعمًا</button>
      </div>

      ${tab === 'grades' ? gradesReport(roster, items, ctx) : ''}
      ${tab === 'attendance' ? attendanceReport(cls, roster, ctx) : ''}
      ${tab === 'support' ? supportReport(roster, items, ctx) : ''}

      <div class="btn-row mt-6 noprint">
        <button class="btn btn--ghost" data-act="print">${icon('print')} طباعة</button>
        <button class="btn btn--ghost" data-act="csv">${icon('download')} تصدير CSV</button>
      </div>
    `;
  },

  actions: {
    tab(el) {
      tab = el.dataset.tab;
      repaint();
    },

    print() {
      window.print();
    },

    csv(el, ev, params) {
      const cls = store.getTeaching(params.id);
      const { roster, items, ctx } = store.teachingContext(params.id);
      const safe = (store.getSection(cls?.sectionId)?.name ?? 'فصل').replace(/[\\/:*?"<>|]/g, '-');

      if (tab === 'attendance') {
        const dates = store.sessionDates(params.id).slice().reverse();
        const rows = [['رقم الكشف', 'الطالب', ...dates.map((d) => fmtDateFull(d)), 'الغياب', 'التأخر']];
        for (const s of roster) {
          const byDate = new Map(ctx[s.id].attendance.map((a) => [a.date, a.status]));
          const cells = dates.map((d) => (byDate.has(d) ? ATTENDANCE[byDate.get(d)].label : ''));
          rows.push([
            s.rollNo ?? '',
            s.name,
            ...cells,
            ctx[s.id].attendance.filter((a) => a.status === 'absent').length,
            ctx[s.id].attendance.filter((a) => a.status === 'late').length,
          ]);
        }
        downloadCSV(`حضور-${safe}.csv`, rows);
        toast('نُزّل كشف الحضور');
        return;
      }

      const rows = [['رقم الكشف', 'الطالب', ...items.map((i) => `${i.name} (${i.max})`), 'المجموع', 'النسبة']];
      for (const s of roster) {
        const t = studentTotal(items, ctx[s.id]);
        rows.push([
          s.rollNo ?? '',
          s.name,
          ...items.map((i) => {
            const v = itemScore(i, ctx[s.id]);
            return v === null ? '' : fmtNum(v);
          }),
          fmtNum(t.earned),
          t.pct === null ? '' : Math.round(t.pct),
        ]);
      }
      downloadCSV(`درجات-${safe}.csv`, rows);
      toast('نُزّل كشف الدرجات');
    },
  },
};

/* ---------- كشف الدرجات ---------- */

function gradesReport(roster, items, ctx) {
  const totalMax = items.reduce((n, i) => n + i.max, 0);

  return html`
    <div class="tablewrap scroll-x">
      <table class="gtable gtable--report">
        <thead>
          <tr>
            <th>#</th>
            <th class="gtable__sticky">الطالب</th>
            ${items.map((i) => html`<th>${i.name}<span class="gtable__max tabular">${i.max}</span></th>`)}
            <th>المجموع<span class="gtable__max tabular">${totalMax}</span></th>
            <th>النسبة</th>
          </tr>
        </thead>
        <tbody>
          ${roster.map((s) => {
            const t = studentTotal(items, ctx[s.id]);
            const band = masteryBand(t.pct);
            return html`
              <tr>
                <td class="tabular t-3">${s.rollNo ?? ''}</td>
                <th class="gtable__sticky"><a href="#/student/${s.id}">${s.name}</a></th>
                ${items.map((i) => {
                  const v = itemScore(i, ctx[s.id]);
                  return html`<td class="tabular ${v === null ? 't-3' : ''}">${v === null ? '—' : fmtNum(v)}</td>`;
                })}
                <td class="tabular fw-7">${fmtNum(t.earned)}</td>
                <td><span class="badge ${band.badge} tabular">${fmtPct(t.pct)}</span></td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- كشف الحضور ---------- */

function attendanceReport(cls, roster, ctx) {
  const dates = store.sessionDates(cls.id);

  if (!dates.length) {
    return html`
      <div class="empty">
        <div class="empty__icon">${icon('attendance')}</div>
        <div class="empty__title">لم يُرصد حضور بعد</div>
        <a class="btn btn--primary noprint" href="#/teaching/${cls.id}/attendance">${icon('attendance')} ابدأ الرصد</a>
      </div>
    `;
  }

  const shown = dates.slice(0, 20).reverse();

  return html`
    <p class="t-3 fs-sm mb-3">
      ${dates.length} يومًا مرصودًا${dates.length > 20 ? ' — يُعرض آخر ٢٠ يومًا، والتصدير يشملها كلها' : ''}.
    </p>
    <div class="tablewrap scroll-x">
      <table class="gtable gtable--report">
        <thead>
          <tr>
            <th class="gtable__sticky">الطالب</th>
            ${shown.map((d) => html`<th class="att-col">${fmtDate(d, false)}</th>`)}
            ${ATTENDANCE_ORDER.map((k) => html`<th>${ATTENDANCE[k].label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${roster.map((s) => {
            const byDate = new Map(ctx[s.id].attendance.map((a) => [a.date, a.status]));
            const tally = { present: 0, late: 0, excused: 0, absent: 0 };
            for (const a of ctx[s.id].attendance) tally[a.status] = (tally[a.status] ?? 0) + 1;
            return html`
              <tr>
                <th class="gtable__sticky">
                  <span class="gtable__roll tabular">${s.rollNo ?? ''}</span>
                  <a href="#/student/${s.id}">${s.name}</a>
                </th>
                ${shown.map((d) => {
                  const st = byDate.get(d);
                  return html`<td class="att-cell ${st ? 'is-' + st : ''}">${st ? ATTENDANCE[st].short : ''}</td>`;
                })}
                ${ATTENDANCE_ORDER.map(
                  (k) => html`<td class="tabular ${k === 'absent' && tally[k] ? 'fw-7' : 't-3'}">${tally[k] || ''}</td>`
                )}
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- من يحتاج دعمًا ---------- */

function supportReport(roster, items, ctx) {
  const rows = roster
    .map((s) => {
      const t = studentTotal(items, ctx[s.id]);
      const absents = ctx[s.id].attendance.filter((a) => a.status === 'absent').length;
      const part = ctx[s.id].logs.filter((l) => l.kind === 'participation').reduce((n, l) => n + l.delta, 0);

      const reasons = [];
      if (t.pct !== null && t.pct < 50) reasons.push('الدرجات دون ٥٠٪');
      if (absents >= 3) reasons.push(`${absents} غيابات`);
      if (part <= 0 && t.pct !== null) reasons.push('لا مشاركة مرصودة');
      if (t.missing > 0 && t.missing === items.filter((i) => !i.auto).length) reasons.push('لم يُرصد له شيء');

      return { s, t, reasons, absents, part };
    })
    .filter((r) => r.reasons.length)
    .sort((a, b) => (a.t.pct ?? 999) - (b.t.pct ?? 999));

  if (!rows.length) {
    return html`
      <div class="empty">
        <div class="empty__icon">${icon('check')}</div>
        <div class="empty__title">لا أحد تحت المؤشرات</div>
        <div class="empty__text">لا طالب درجته دون ٥٠٪ ولا من تجاوز ثلاث غيابات.</div>
      </div>
    `;
  }

  return html`
    <p class="t-3 fs-sm mb-3">
      ${rows.length} طالبًا تستدعي حالتهم نظرة: درجات منخفضة، أو غياب متكرر، أو غياب عن المشاركة.
    </p>
    <div class="list">
      ${rows.map(
        (r) => html`
          <a class="row" href="#/student/${r.s.id}">
            <span class="rollno">${r.s.rollNo ?? '—'}</span>
            <span class="row__main">
              <span class="row__title">${r.s.name}</span>
              <span class="row__sub">${r.reasons.join(' · ')}</span>
            </span>
            <span class="row__end">
              <span class="badge ${masteryBand(r.t.pct).badge} tabular">${fmtPct(r.t.pct)}</span>
              ${icon('chev')}
            </span>
          </a>
        `
      )}
    </div>
  `;
}
