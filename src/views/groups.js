/**
 * تقسيم المجموعات — عشوائي أو متوازن.
 * المتوازن يوزّع المتفوقين والمتعثرين على المجموعات بالتناوب (توزيع الأفعى)
 * فلا تجتمع القوة في مجموعة والضعف في أخرى.
 */

import { html, icon, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal, todayISO, quickLogAttendanceState } from '../models.js';
import { repaint } from '../repaint.js';

let size = 4;
let mode = 'balanced';   // balanced | random
let groups = [];
let includeAbsent = false;
let selectedStudent = null; // { id, name, fromIdx } for mobile / touch tap-to-move
let draggedData = null;     // Robust in-memory transfer for HTML5 drag-and-drop
let isDragging = false;

const GROUP_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة',
                     'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

function savedGroupsFor(classId) {
  const saved = store.groupArrangementOf(classId)?.groups ?? store.state.device?.groupArrangements?.[classId];
  if (!Array.isArray(saved) || !saved.length) return [];

  const roster = store.students(classId);
  const byId = new Map(roster.map((student) => [student.id, student]));
  const seen = new Set();
  const restored = saved.map((group) => (Array.isArray(group) ? group : [])
    .map((id) => byId.get(id))
    .filter((student) => student && !seen.has(student.id) && seen.add(student.id)));

  for (const student of roster) {
    if (seen.has(student.id)) continue;
    const target = restored.reduce(
      (smallest, group, index) => group.length < restored[smallest].length ? index : smallest,
      0,
    );
    if (restored.length) restored[target].push(student);
  }
  return restored;
}

async function persistGroups(classId, arrangement = groups) {
  if (!classId) return;
  await store.saveGroupArrangement(classId, arrangement.map((group) => group.map((student) => student.id)));
}

function displayedGroups(classId) {
  if (includeAbsent) return groups;
  const availableIds = new Set(getAvailableStudents(classId).map((student) => student.id));
  return groups.map((group) => group.filter((student) => availableIds.has(student.id)));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[j], a[i]] = [a[i], a[j]];
  }
  return a;
}

function getAvailableStudents(classId) {
  const roster = store.students(classId);
  if (includeAbsent) return roster;
  const today = todayISO();
  const sessions = store.sessionsOnFor(classId, today);
  const attendance = quickLogAttendanceState(roster, sessions, (sessionId) => store.attendanceIn(sessionId));
  return attendance.filter((a) => !a.unavailable).map((a) => a.student);
}

function build(classId, { includeUnavailable = false } = {}) {
  const { items, ctx } = store.teachingContext(classId);
  const availableRoster = includeUnavailable ? store.students(classId) : getAvailableStudents(classId);
  if (!availableRoster.length) return [];

  const count = Math.max(1, Math.ceil(availableRoster.length / size));
  const buckets = Array.from({ length: count }, () => []);

  if (mode === 'random') {
    shuffle(availableRoster).forEach((s, i) => buckets[i % count].push(s));
  } else {
    // رتّب بالأداء ثم وزّع ذهابًا وإيابًا
    const ranked = availableRoster
      .map((s) => ({ s, pct: studentTotal(items, ctx[s.id]).pct ?? -1 }))
      .sort((a, b) => b.pct - a.pct)
      .map((x) => x.s);

    let idx = 0;
    let dir = 1;
    for (const s of ranked) {
      buckets[idx].push(s);
      if (dir === 1 && idx === count - 1) dir = -1;
      else if (dir === -1 && idx === 0) dir = 1;
      else idx += dir;
    }
  }

  return buckets.filter((b) => b.length);
}

async function moveStudent(studentId, fromIdx, toIdx, classId) {
  if (isNaN(fromIdx) || isNaN(toIdx) || !groups[fromIdx] || !groups[toIdx] || fromIdx === toIdx) return;
  const sIdx = groups[fromIdx].findIndex((s) => s.id === studentId);
  if (sIdx === -1) return;

  const [student] = groups[fromIdx].splice(sIdx, 1);
  // Ensure absolute duplicate prevention across all groups
  for (let i = 0; i < groups.length; i++) {
    groups[i] = groups[i].filter((s) => s.id !== student.id);
  }
  groups[toIdx].push(student);

  await persistGroups(classId);

  selectedStudent = null;
  toast(`نُقل ${student.name} إلى المجموعة ${GROUP_NAMES[toIdx] ?? toIdx + 1}`);
  repaint();
}

export default {
  title: () => 'المجموعات',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,

  onMount(root, p) {
    groups = p?.id ? savedGroupsFor(p.id) : [];
    selectedStudent = null;
    draggedData = null;
    isDragging = false;
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    const readOnly = store.isTeachingArchived(cls);

    const roster = store.students(cls.id);
    if (roster.length < 2) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('groups')}</div>
          <div class="empty__title">تحتاج طالبين على الأقل</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const persisted = savedGroupsFor(cls.id);
    if (persisted.length) groups = persisted;

    const available = getAvailableStudents(cls.id);
    const excludedCount = roster.length - available.length;
    const count = Math.ceil(available.length / size);
    const visibleGroups = displayedGroups(cls.id);

    return html`
      <div class="card card--pad mb-3">
        <div class="field">
          <span class="field__label">عدد الطلاب في المجموعة</span>
          <div class="segmented">
            ${[2, 3, 4, 5, 6].map(
              (n) => html`
                <button class="segmented__btn ${size === n ? 'is-on' : ''}" data-act="size" data-n="${n}">
                  ${n}
                </button>
              `
            )}
          </div>
          <div class="field__hint">
            ${available.length} طالبًا متاحًا ${excludedCount > 0 ? `(استُبعد ${excludedCount} غياب/استئذان)` : ''} → <span class="tabular">${count}</span> مجموعات
          </div>
        </div>

        <div class="field">
          <span class="field__label">طريقة التقسيم</span>
          <div class="segmented">
            <button class="segmented__btn ${mode === 'balanced' ? 'is-on' : ''}" data-act="mode" data-mode="balanced">
              متوازن
            </button>
            <button class="segmented__btn ${mode === 'random' ? 'is-on' : ''}" data-act="mode" data-mode="random">
              عشوائي
            </button>
          </div>
          <div class="field__hint">
            ${mode === 'balanced'
              ? 'يوزّع المتفوقين والمتعثرين على المجموعات بالتساوي حسب الدرجات المرصودة.'
              : 'خلط كامل بلا نظر إلى المستوى.'}
          </div>
        </div>

        <div class="hstack gap-2 mt-3 fs-xs noprint">
          <label class="switch">
            <input type="checkbox" data-change="toggle-absent" ${includeAbsent ? 'checked' : ''}>
            <span>تضمين الغائبين والمستأذنين</span>
          </label>
        </div>
      </div>

      <button class="btn btn--primary btn--block mb-3" data-act="make" ${readOnly ? 'disabled' : ''}>
        ${icon('groups')} ${groups.length ? 'أعد التقسيم' : 'قسّم المجموعات'}
      </button>

      ${selectedStudent
        ? html`
            <div class="card card--pad mb-3 hstack gap-3 justify-between" style="border-color: var(--brand); background: var(--brand-soft);">
              <div class="hstack gap-2">
                ${icon('spark')}
                <div>
                  <span class="fw-7">تحديد:</span>
                  <span>${selectedStudent.name}</span>
                  <span class="t-3 fs-xs">(انقر على أي مجموعة لنقله إليها)</span>
                </div>
              </div>
              <button class="btn btn--ghost btn--sm" data-act="cancel-select">إلغاء</button>
            </div>
          `
        : ''}

      ${groups.length
        ? html`
            <div class="groups-grid" id="groups-container">
              ${visibleGroups.map(
                (g, i) => html`
                  <div class="card card--pad group"
                       data-group-idx="${i}"
                       data-teaching-id="${cls.id}">
                    <div class="group__head">
                      المجموعة ${GROUP_NAMES[i] ?? i + 1}
                      <span class="badge tabular">${g.length}</span>
                    </div>
                    <div class="stack stack-2 mt-3">
                      ${g.map((s) => html`
                        <div class="group__member ${selectedStudent?.id === s.id ? 'is-selected' : ''}"
                             draggable="${readOnly ? 'false' : 'true'}"
                             data-student-id="${s.id}"
                             data-student-name="${s.name}"
                             data-from-idx="${i}"
                             data-teaching-id="${cls.id}"
                             data-act="toggle-student"
                             aria-disabled="${readOnly ? 'true' : 'false'}"
                             title="${readOnly ? 'الفصل مؤرشف للعرض فقط' : 'اسحب أو انقر لنقل الطالب'}">
                          <span class="rollno">${s.rollNo ?? '—'}</span>
                          <span class="group__member-name">${s.name}</span>
                          <span class="group__drag-handle noprint">${icon('menu')}</span>
                        </div>
                      `)}
                    </div>
                    ${!readOnly && selectedStudent && selectedStudent.fromIdx !== i
                      ? html`
                          <button class="group__target-btn noprint"
                                  data-act="move-here"
                                  data-to-idx="${i}"
                                  data-teaching-id="${cls.id}">
                            ${icon('check')} نقل ${selectedStudent.name} إلى هنا
                          </button>
                        `
                      : ''}
                  </div>
                `
              )}
            </div>
            <button class="btn btn--ghost btn--block mt-4" data-act="print">${icon('print')} اطبع التقسيم</button>
          `
        : ''}
    `;
  },

  afterPaint(root, params) {
    this.bindDragAndDrop(root, params);
  },

  onRender(root, params) {
    this.bindDragAndDrop(root, params);
  },

  bindDragAndDrop(root, params) {
    if (store.isTeachingArchived(params?.id)) return;
    const container = root.querySelector('#groups-container');
    if (!container) return;

    // Desktop Drag and Drop Event Listeners
    const members = container.querySelectorAll('.group__member');
    members.forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        isDragging = true;
        const studentId = el.dataset.studentId;
        const fromIdx = el.dataset.fromIdx;
        const teachingId = el.dataset.teachingId || params?.id;
        draggedData = { studentId, fromIdx: Number(fromIdx), teachingId };

        try {
          e.dataTransfer.setData('text/plain', JSON.stringify(draggedData));
          e.dataTransfer.setData('application/json', JSON.stringify(draggedData));
          e.dataTransfer.effectAllowed = 'move';
        } catch {}
        el.classList.add('is-dragging');
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('is-dragging');
        setTimeout(() => {
          isDragging = false;
        }, 100);
        draggedData = null;
        container.querySelectorAll('.group').forEach((g) => g.classList.remove('is-dragover'));
      });
    });

    const groupCards = container.querySelectorAll('.group');
    groupCards.forEach((card) => {
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = 'move';
        } catch {}
        card.classList.add('is-dragover');
      });

      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('is-dragover');
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('is-dragover');
        let data = draggedData;
        if (!data) {
          try {
            const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
            if (raw) data = JSON.parse(raw);
          } catch {}
        }

        const toIdx = Number(card.dataset.groupIdx);
        const fromIdx = data ? Number(data.fromIdx) : NaN;
        const studentId = data ? data.studentId : null;
        const teachingId = data?.teachingId || params?.id;

        if (studentId && !isNaN(toIdx) && !isNaN(fromIdx) && fromIdx !== toIdx) {
          moveStudent(studentId, fromIdx, toIdx, teachingId);
        }
        draggedData = null;
      });
    });
  },

  actions: {
    'toggle-absent'(el) {
      includeAbsent = el.checked;
      selectedStudent = null;
      repaint();
    },

    size(el) {
      size = Number(el.dataset.n);
      selectedStudent = null;
      repaint();
    },

    mode(el) {
      mode = el.dataset.mode;
      selectedStudent = null;
      repaint();
    },

    async make(el, ev, params) {
      selectedStudent = null;
      // A new distribution always starts from the current roster, never a saved manual arrangement.
      const freshGroups = build(params.id, { includeUnavailable: true });
      groups = freshGroups;
      await persistGroups(params.id, freshGroups);
      toast('قُسّم الفصل إلى ' + freshGroups.length + ' مجموعات');
      repaint();
    },

    'toggle-student'(el, ev, params) {
      if (isDragging || store.isTeachingArchived(params?.id)) return;
      const studentId = el.dataset.studentId;
      const studentName = el.dataset.studentName;
      const fromIdx = Number(el.dataset.fromIdx);

      if (selectedStudent?.id === studentId) {
        selectedStudent = null;
      } else {
        selectedStudent = { id: studentId, name: studentName, fromIdx };
      }
      repaint();
    },

    'cancel-select'() {
      selectedStudent = null;
      repaint();
    },

    async 'move-here'(el, ev, params) {
      if (!selectedStudent) return;
      const toIdx = Number(el.dataset.toIdx);
      await moveStudent(selectedStudent.id, selectedStudent.fromIdx, toIdx, params?.id || el.dataset.teachingId);
    },

    print() {
      window.print();
    },
  },
};
