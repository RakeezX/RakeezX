/**
 * الرصد السريع: نقرة على شريحة النقاط = نقطة واحدة.
 * صُمّم ليُستعمل والهاتف بيد واحدة أثناء الحصة — لا حقول ولا حفظ يدوي.
 */

import { html, icon } from '../lib/dom.js';
import * as store from '../store.js';
import { displayRoster, quickLogAttendanceState, todayISO, normalizeSearchText, logPointTotals, participationPointProjection } from '../models.js';
import { repaint } from '../repaint.js';
import { pointControls, runPointAction, stablePointSurface } from '../lib/quicklog-reason-sheet.js';
import { showScoreFloatEffect } from '../lib/effects.js';

let kind = 'participation';   // participation | behavior
let withReason = false;
let searchQuery = '';
let filterStatus = 'all';     // all | logged | unlogged

const KIND_LABEL = { participation: 'المشاركة', behavior: 'سجل السلوك فقط' };
const emptyCounts = () => ({ positive: 0, negative: 0, todayCount: 0, latestNegative: null });
/**
 * نبضة بصرية تؤكد التسجيل.
 * تُطبَّق بعد إعادة الرسم لا قبلها، لأن الرصد يعيد بناء الشبكة فيضيع أثرها.
 */
let pendingPulse = null;

export default {
  title: () => 'الرصد السريع',
  subtitle: (p) => `${KIND_LABEL[kind]} · ${store.getTeaching(p.id)?.name ?? ''}`,
  back: (p) => `#/teaching/${p.id}`,

  onMount() {
    kind = 'participation';
    withReason = false;
    searchQuery = '';
    filterStatus = 'all';
    pendingPulse = null;
    repaint(); // Reflect reset controls when returning from another classroom tool.
  },

  afterPaint(root) {
    if (!pendingPulse) return;
    const card = root.querySelector(`#ql-${CSS.escape(pendingPulse.studentId)}`);
    if (card) {
      card.classList.add(pendingPulse.positive ? 'is-plus' : 'is-minus');
      showScoreFloatEffect(card, pendingPulse.delta);
    }
    pendingPulse = null;
  },

  render(p) { return stablePointSurface(() => this.renderContent(p)); },
  renderContent(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(cls)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">الرصد السابق محفوظ ولا يمكن إضافة رصد جديد.</div></div>`;

    const { roster: activeRoster, items, ctx } = store.teachingContext(cls.id);
    const roster = displayRoster(activeRoster);
    const participationItem = items.find(item => item.auto === 'participation');
    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const today = todayISO();
    const allLogs = [...new Map(store.state.logs.map(log => [log.id, log])).values()]
      .filter((l) => !l.deleted && l.teachingId === cls.id && l.kind === kind);
    const byStudent = new Map();
    for (const l of allLogs) {
      const cur = byStudent.get(l.studentId) ?? emptyCounts();
      if (l.delta < 0) {
        if (!cur.latestNegative || l.date > cur.latestNegative.date ||
            (l.date === cur.latestNegative.date && l.updatedAt > cur.latestNegative.updatedAt)) cur.latestNegative = l;
      }
      if (l.date === today) cur.todayCount++;
      byStudent.set(l.studentId, cur);
    }

    for (const student of roster) {
      const current = byStudent.get(student.id) ?? emptyCounts();
      const points = kind === 'participation' && participationItem
        ? participationPointProjection(participationItem, ctx[student.id])
        : logPointTotals(allLogs.filter(log => log.studentId === student.id), kind);
      byStudent.set(student.id, { ...current, ...points });
    }

    const todayTotal = allLogs.filter((l) => l.date === today).length;
    const attendance = quickLogAttendanceState(roster, store.sessionsOnFor(cls.id, today), (sessionId) => store.attendanceIn(sessionId));

    // تصفية وبحث الطلاب
    const q = normalizeSearchText(searchQuery);
    let displayEntries = attendance.filter((entry) => {
      const s = entry.student;
      if (q) {
        const matchesName = normalizeSearchText(s.name).includes(q);
        const matchesRoll = s.displayNo != null && normalizeSearchText(s.displayNo).includes(q);
        if (!matchesName && !matchesRoll) return false;
      }
      const c = byStudent.get(s.id) ?? emptyCounts();
      if (filterStatus === 'logged') {
        if (c.todayCount === 0) return false;
      } else if (filterStatus === 'unlogged') {
        if (c.todayCount !== 0) return false;
      }
      return true;
    });

    const displayStudents = [...displayEntries.filter((entry) => !entry.unavailable), ...displayEntries.filter((entry) => entry.unavailable)];
    const unavailableCount = attendance.filter((entry) => entry.unavailable).length;

    return html`
      <div class="classroom-tool-page quicklog-page">
      <div class="classroom-toolbar quicklog-toolbar">
      <div class="segmented quicklog__modes" role="group" aria-label="نوع الرصد">
        ${Object.entries(KIND_LABEL).map(
          ([k, label]) => html`
            <button type="button" class="segmented__btn ${kind === k ? 'is-on' : ''}" data-act="kind" data-kind="${k}" aria-pressed="${kind === k ? 'true' : 'false'}">
              ${label}
            </button>
          `
        )}
      </div>

      <!-- شريط البحث والتصفية -->
      <div class="quicklog-filter-bar noprint">
        <div class="quicklog-search">
          <span class="quicklog-search__icon" aria-hidden="true">${icon('search')}</span>
          <input class="input" type="search" placeholder="ابحث بالاسم أو رقم الكشف..."
                 data-input="search" data-fk="quicklog-search"
                 value="${searchQuery}" aria-label="بحث الطلاب">
          ${searchQuery ? html`<button type="button" class="quicklog-search__clear" data-act="clear-search" aria-label="مسح البحث">${icon('close')}</button>` : ''}
        </div>
        <div class="segmented segmented--sm" role="group" aria-label="حالة الرصد">
          <button type="button" class="segmented__btn ${filterStatus === 'all' ? 'is-on' : ''}" data-act="filter-status" data-status="all" aria-pressed="${filterStatus === 'all' ? 'true' : 'false'}">الكل</button>
          <button type="button" class="segmented__btn ${filterStatus === 'logged' ? 'is-on' : ''}" data-act="filter-status" data-status="logged" aria-pressed="${filterStatus === 'logged' ? 'true' : 'false'}">تم رصدهم</button>
          <button type="button" class="segmented__btn ${filterStatus === 'unlogged' ? 'is-on' : ''}" data-act="filter-status" data-status="unlogged" aria-pressed="${filterStatus === 'unlogged' ? 'true' : 'false'}">لم يُرصدوا</button>
        </div>
      </div>

      <div class="hstack gap-2 quicklog__filters classroom-meta-bar">
        <label class="switch">
          <input type="checkbox" data-change="reason" ${withReason ? 'checked' : ''}>
          <span>مع سبب</span>
        </label>
        <span class="push t-3 fs-sm">
          اليوم: <span class="tabular fw-7">${todayTotal}</span> رصدة
        </span>
      </div>
      </div>

      ${unavailableCount ? html`<div class="hstack gap-2 mb-2 fs-xs t-3"><span>الغياب والاستئذان: <strong class="tabular">${unavailableCount}</strong></span></div>` : ''}

      ${displayStudents.length === 0
        ? html`<div class="empty"><div class="empty__title">لا يوجد طلاب مطابقين للبحث أو التصفية</div></div>`
        : html`
            <div class="ql-grid" aria-label="طلاب الفصل">
              ${displayStudents.map(({ student: s, status, unavailable }) => {
                const c = byStudent.get(s.id) ?? emptyCounts();
                const tone = unavailable ? 'is-unavail' : c.negative > 0 ? 'is-neg' : c.positive > 0 ? 'is-pos' : '';
                const incident = c.latestNegative;
                const incidentLabel = incident ? `آخر رصدة سلبية: ${incident.tag || 'بلا سبب'} · ${incident.date}` : '';
                const statusBadge = status === 'absent' ? html`<span class="qlcard__status badge badge--danger">غائب</span>` : status === 'excused' ? html`<span class="qlcard__status badge badge--warn">مستأذن</span>` : '';
                return html`
                  <div class="qlcard ${tone}" id="ql-${s.id}">
                    <div class="qlcard__head">
                      <span class="qlcard__roll tabular">${s.displayNo}</span>${statusBadge}
                      <span class="qlcard__name">${s.name}</span>
                    </div>
                    <span class="qlcard__note" title="${incidentLabel}">${incident ? html`<span class="qlcard__incident">⚠ ${incident.tag || 'رصد سلبي'} · <bdi>${incident.date}</bdi></span>` : c.todayCount ? `${c.todayCount} رصدة اليوم` : 'لم يُرصد اليوم'}</span>
                    ${pointControls({ teachingId: cls.id, student: s, kind, points: c, action: 'point-log', undoAction: 'undo' })}
                    ${kind === 'participation' && participationItem && c.factor !== 1 ? html`<span class="qlcard__factor">كل نقطة = <bdi>${c.factor}</bdi> درجة</span>` : ''}
                  </div>
                `;
              })}
            </div>
          `}
      <p class="t-3 fs-sm center mt-6">
        ${kind === 'behavior' ? 'سجل السلوك للتوثيق فقط؛ لا يُخصم من الدرجات.' : 'نقرة على الرقم الموجب أو السالب = نقطة واحدة. نقاط المشاركة تغذّي بند المشاركة الآلي في الدرجات.'}
        المؤشران لمجموع النقاط الإيجابية والسلبية. ${kind === 'participation' ? 'درجة البند حسب معامل النقطة وحدّه؛ يشمل النطاق الرصد المنقول المتوافق، والتراجع لرصد اليوم في هذا الفصل فقط.' : ''}
      </p>
      </div>
    `;
  },

  actions: {
    kind(el) {
      kind = el.dataset.kind;
      repaint();
    },

    search(el) {
      searchQuery = el.value;
      repaint();
    },

    'clear-search'() {
      searchQuery = '';
      repaint();
    },

    'filter-status'(el) {
      filterStatus = el.dataset.status;
      repaint();
    },

    reason(el) {
      withReason = el.checked;
    },

    async 'point-log'(el, ev, params) {
      const currentKind = kind;
      if (el.dataset.kind !== currentKind) return;
      if (await runPointAction(el, params, { withReason, valid: () => kind === currentKind })) {
        pendingPulse = { studentId: el.dataset.student, positive: Number(el.dataset.delta) > 0, delta: Number(el.dataset.delta) };
        repaint();
      }
    },

    async undo(el, ev, params) {
      const currentKind = kind;
      if (el.dataset.kind !== currentKind) return;
      await runPointAction(el, params, { undo: true, valid: () => kind === currentKind });
    },
  },
};
