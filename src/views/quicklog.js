/**
 * الرصد السريع: نقرة على الطالب = نقطة له.
 * صُمّم ليُستعمل والهاتف بيد واحدة أثناء الحصة — لا حقول ولا حفظ يدوي.
 */

import { html, icon, openSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { LOG_TAGS, quickLogAttendanceState, todayISO, normalizeSearchText, logPointTotals, participationPointProjection, latestQuickLog } from '../models.js';
import { repaint } from '../repaint.js';
import { playQuickLogPlus, playQuickLogMinus } from '../lib/sound.js';
import { showScoreFloatEffect } from '../lib/effects.js';

let kind = 'participation';   // participation | behavior
let withReason = false;
let searchQuery = '';
let filterStatus = 'all';     // all | logged | unlogged

const KIND_LABEL = { participation: 'المشاركة', behavior: 'سجل السلوك فقط' };
const emptyCounts = () => ({ positive: 0, negative: 0, todayCount: 0, latestNegative: null });
const pendingUndo = new Set();

function reasonSheet(kindKey, delta) {
  const tags = LOG_TAGS[kindKey][delta > 0 ? 'up' : 'down'];
  return openSheet({
    title: delta > 0 ? 'سبب النقطة' : 'سبب الخصم',
    desc: 'يظهر السبب في تقرير الطالب.',
    body: html`
      <div class="taglist">
        ${tags.map((t) => html`<button class="btn btn--ghost tag-pick" data-tag="${t}">${t}</button>`)}
      </div>
      <label class="field mt-4">
        <span class="field__label">أو اكتب سببًا</span>
        <input class="input" id="tag-other" maxlength="60" autocomplete="off" placeholder="سبب آخر">
      </label>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" id="tag-go">سجّل بلا سبب</button>
    `,
    onMount: (root, done) => {
      root.querySelectorAll('.tag-pick').forEach((b) =>
        b.addEventListener('click', () => done({ tag: b.dataset.tag }))
      );
      const other = root.querySelector('#tag-other');
      root.querySelector('#tag-go').addEventListener('click', () =>
        done({ tag: other.value.trim() })
      );
      other.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done({ tag: other.value.trim() });
      });
    },
  });
}

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

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(cls)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">الرصد السابق محفوظ ولا يمكن إضافة رصد جديد.</div></div>`;

    const { roster, items, ctx } = store.teachingContext(cls.id);
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
        const matchesRoll = s.rollNo != null && normalizeSearchText(s.rollNo).includes(q);
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
                const undo = latestQuickLog(allLogs, { studentId: s.id, teachingId: cls.id, kind, date: today });
                const undoBusy = pendingUndo.has(`${cls.id}:${s.id}`);
                const tone = unavailable ? 'is-unavail' : c.negative > 0 ? 'is-neg' : c.positive > 0 ? 'is-pos' : '';
                const incident = c.latestNegative;
                const incidentLabel = incident ? `آخر رصدة سلبية: ${incident.tag || 'بلا سبب'} · ${incident.date}` : '';
                const statusBadge = status === 'absent' ? html`<span class="qlcard__status badge badge--danger">غائب</span>` : status === 'excused' ? html`<span class="qlcard__status badge badge--warn">مستأذن</span>` : '';
                return html`
                  <div class="qlcard ${tone}" id="ql-${s.id}">
                    <button class="qlcard__hit" data-act="plus" data-id="${s.id}"
                            aria-label="نقطة لـ ${s.name}" aria-describedby="ql-counts-${s.id} ql-today-${s.id}${incident ? ` ql-incident-${s.id}` : ''}">
                      <div class="qlcard__head">
                        <div class="qlcard__meta">
                          ${s.rollNo != null ? html`<span class="qlcard__roll tabular">${s.rollNo}</span>` : ''}
                          ${statusBadge}
                        </div>
                        <span class="qlcard__name">${s.name}</span>
                      </div>
                      <span class="qlcard__plus" aria-hidden="true">${icon('plus')}</span>
                      <span class="qlcard__today tabular" id="ql-today-${s.id}">${c.todayCount ? `${c.todayCount} رصدة اليوم` : 'لم يُرصد اليوم'}</span>
                      ${incident ? html`<span class="qlcard__incident" id="ql-incident-${s.id}" title="${incidentLabel}" aria-label="${incidentLabel}"><span aria-hidden="true">⚠</span> ${incident.tag || 'بلا سبب'} · <bdi>${incident.date}</bdi></span>` : ''}
                    </button>
                      <div class="qlcard__foot">
                        <span class="qlcard__counts tabular" id="ql-counts-${s.id}">
                          <span class="qlcard__positive" aria-label="${c.positive ?? 'غير محدد'} نقاط إيجابية"><bdi>${c.positive === null ? '—' : `+${c.positive}`}</bdi></span>
                          <span class="qlcard__negative" aria-label="${c.negative ?? 'غير محدد'} نقاط سلبية"><bdi>${c.negative === null ? '—' : `−${c.negative}`}</bdi></span>
                        </span>
                        <button type="button" class="qlcard__undo" data-act="undo" data-id="${s.id}" ${!undo || undoBusy ? 'disabled' : ''}
                          aria-label="تراجع عن آخر رصدة اليوم لـ ${s.name}" title="تراجع عن آخر رصدة اليوم" aria-busy="${undoBusy}">${icon('back')}</button>
                      </div>
                      ${kind === 'participation' && participationItem ? html`<span class="qlcard__factor">${participationItem.name} · ×<bdi>${c.factor}</bdi> · الدرجة <bdi>${c.score ?? '—'}/${participationItem.max}</bdi></span>` : ''}
                    <button class="qlcard__minus" data-act="minus" data-id="${s.id}"
                            aria-label="خصم من ${s.name}">${icon('minus')}</button>
                  </div>
                `;
              })}
            </div>
          `}
      <p class="t-3 fs-sm center mt-6">
        ${kind === 'behavior' ? 'سجل السلوك للتوثيق فقط؛ لا يُخصم من الدرجات.' : 'نقرة على الطالب = نقطة. نقاط المشاركة تغذّي بند المشاركة الآلي في الدرجات.'}
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

    async plus(el, ev, params) {
      playQuickLogPlus();
      await record(params.id, el.dataset.id, +1);
    },

    async minus(el, ev, params) {
      playQuickLogMinus();
      await record(params.id, el.dataset.id, -1);
    },

    async undo(el, ev, params) {
      const studentId = el.dataset.id;
      const key = `${params.id}:${studentId}`;
      if (pendingUndo.has(key) || !store.students(params.id).some(s => s.id === studentId) ||
          store.isTeachingArchived(store.getTeaching(params.id))) return;
      const last = latestQuickLog(store.state.logs, { studentId, teachingId: params.id, kind, date: todayISO() });
      if (!last) return;
      pendingUndo.add(key);
      el.disabled = true;
      try {
        const result = await store.patch('logs', last.id, { deleted: true });
        toast(result ? 'أُلغيت آخر رصدة للطالب' : 'تعذّر التراجع. حاول مرة أخرى.');
      } catch {
        toast('تعذّر التراجع. حاول مرة أخرى.');
      } finally {
        // Keep a rapid second tap from deleting the previous record after a fast local commit.
        await new Promise(resolve => setTimeout(resolve, 350));
        pendingUndo.delete(key);
        repaint();
      }
    },
  },
};

async function record(teachingId, studentId, delta) {
  let tag = '';
  if (withReason) {
    const res = await reasonSheet(kind, delta);
    if (res === undefined) return;
    tag = res.tag ?? '';
  }
  pendingPulse = { studentId, positive: delta > 0, delta };
  if (navigator.vibrate) navigator.vibrate(delta > 0 ? 12 : [8, 40, 8]);
  await store.addLog({ teachingId, studentId, kind, delta, tag });
}
