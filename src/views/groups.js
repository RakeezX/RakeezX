/**
 * تقسيم المجموعات — عشوائي أو متوازن.
 * المتوازن يوزّع المتفوقين والمتعثرين على المجموعات بالتناوب (توزيع الأفعى)
 * فلا تجتمع القوة في مجموعة والضعف في أخرى.
 */

import { html, icon, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal, todayISO, quickLogAttendanceState } from '../models.js';
import { repaint } from '../repaint.js';
import { demoOutputMarker } from '../lib/report-print.js';
import { validTargetCount, targetGroupSizes, smartGroupCounts } from '../lib/group-count-ui.js';

let size = 4;
let inputMethod = 'size';
let targetCount = 3;
let targetSelection = 'ready';
let targetRosterKey = '';
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

  const count = inputMethod === 'count' ? Number(targetCount) : Math.max(1, Math.ceil(availableRoster.length / size));
  if (!validTargetCount(count, availableRoster.length)) return [];
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
    const suggestions = smartGroupCounts(available.length);
    const rosterKey = `${cls.id}:${available.length}`;
    if (inputMethod === 'count' && targetRosterKey !== rosterKey) {
      if (targetSelection === 'ready') targetCount = suggestions.recommended ?? 0;
      targetRosterKey = rosterKey;
    }
    const count = inputMethod === 'count' ? Number(targetCount) : Math.ceil(available.length / size);
    const validCount = inputMethod !== 'count' || validTargetCount(targetCount, available.length);
    const visibleGroups = displayedGroups(cls.id);

    return html`
      <div class="classroom-tool-page groups-page">
      ${demoOutputMarker()}
      <section class="surface groups-setup mb-3" aria-label="إعداد المجموعات">
        <div class="group-input-method field">
          <span class="field__label">التقسيم حسب</span>
          <div class="segmented" role="group" aria-label="التقسيم حسب">
            <button type="button" class="segmented__btn ${inputMethod === 'size' ? 'is-on' : ''}" data-act="group-input-method" data-method="size" aria-pressed="${inputMethod === 'size'}">طلاب في المجموعة</button>
            <button type="button" class="segmented__btn ${inputMethod === 'count' ? 'is-on' : ''}" data-act="group-input-method" data-method="count" aria-pressed="${inputMethod === 'count'}">عدد المجموعات</button>
          </div>
        </div>
        <div class="groups-setup__grid">
        <div class="field">
          ${inputMethod === 'count' ? html`<span class="field__label">عدد المجموعات</span>
            <div class="segmented group-count-choices" role="group" aria-label="عدد المجموعات">
              ${suggestions.choices.map(n => html`<button type="button" class="segmented__btn ${targetSelection === 'ready' && count === n ? 'is-on' : ''}" data-act="target-ready" data-n="${n}" aria-pressed="${targetSelection === 'ready' && count === n ? 'true' : 'false'}"><span class="tabular">${n}</span>${n === suggestions.recommended ? html`<small class="group-count-recommended">مقترح</small>` : ''}</button>`)}
              <input id="target-group-count" class="group-count-inline ${targetSelection === 'custom' ? 'is-on' : ''}" type="number" inputmode="numeric" min="1" max="${available.length}" step="1" value="${targetSelection === 'custom' ? targetCount : ''}" placeholder="اكتب العدد" aria-label="اكتب عدد المجموعات" data-input="target-count" data-fk="target-count" aria-describedby="target-group-hint" aria-invalid="${targetSelection === 'custom' && !validCount ? 'true' : 'false'}" ${!available.length ? 'disabled' : ''}>
            </div>
            <div id="target-group-hint" class="${validCount ? 'group-count-preview' : 'field__error'}" role="status" aria-live="polite">${validCount ? html`<span>${available.length} طالبًا متاحًا ← ${count} مجموعات</span><bdi dir="ltr">${targetGroupSizes(available.length, count).join(' + ')}</bdi>` : available.length ? html`اختر عددًا صحيحًا من 1 إلى ${available.length} حسب الطلاب المتاحين.` : html`لا يوجد طلاب متاحون للتقسيم. راجع خيار تضمين الغائبين والمستأذنين.`}</div>
          ` : html`<span class="field__label">عدد الطلاب في المجموعة</span>
          <div class="segmented" role="group" aria-label="عدد الطلاب في المجموعة">
            ${[2, 3, 4, 5, 6].map(
              (n) => html`
                <button type="button" class="segmented__btn ${size === n ? 'is-on' : ''}" data-act="size" data-n="${n}" aria-pressed="${size === n ? 'true' : 'false'}">
                  ${n}
                </button>
              `
            )}
          </div>
          <div class="field__hint">
            ${available.length} طالبًا متاحًا ${excludedCount > 0 ? `(استُبعد ${excludedCount} غياب/استئذان)` : ''} → <span class="tabular">${count}</span> مجموعات
          </div>
          `}
        </div>

        <div class="field">
          <span class="field__label">طريقة التقسيم</span>
          <div class="segmented" role="group" aria-label="طريقة التقسيم">
            <button type="button" class="segmented__btn ${mode === 'balanced' ? 'is-on' : ''}" data-act="mode" data-mode="balanced" aria-pressed="${mode === 'balanced' ? 'true' : 'false'}">
              متوازن
            </button>
            <button type="button" class="segmented__btn ${mode === 'random' ? 'is-on' : ''}" data-act="mode" data-mode="random" aria-pressed="${mode === 'random' ? 'true' : 'false'}">
              عشوائي
            </button>
          </div>
          <div class="field__hint">
            ${mode === 'balanced'
              ? 'يوزّع المتفوقين والمتعثرين على المجموعات بالتساوي حسب الدرجات المرصودة.'
              : 'خلط كامل بلا نظر إلى المستوى.'}
          </div>
        </div>

        </div>
        <div class="groups-setup__presence fs-xs noprint">
          <label class="switch">
            <input type="checkbox" data-change="toggle-absent" ${includeAbsent ? 'checked' : ''}>
            <span>تضمين الغائبين والمستأذنين</span>
          </label>
        </div>
      </section>

      <button class="btn btn--primary btn--block groups-generate mb-3" data-act="make" ${readOnly || !validCount ? 'disabled' : ''}>
        ${icon('groups')} ${groups.length ? 'أعد التقسيم' : 'قسّم المجموعات'}
      </button>
      ${inputMethod === 'count' && visibleGroups.length ? html`<p class="group-count-summary" role="status">أحجام المجموعات الحالية: <bdi dir="ltr">${visibleGroups.map(group => group.length).join(' + ')}</bdi></p>` : ''}

      ${selectedStudent
        ? html`
            <div class="surface group-move-notice mb-3 hstack gap-3 justify-between" role="status">
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
            <div class="groups-touch-hint noprint" role="note">
              ${icon('grip')}
              <span>اسحب الطالب من مقبض النقل، أو اضغط عليه ثم اختر المجموعة.</span>
            </div>
            <div class="groups-grid" id="groups-container">
              ${visibleGroups.map(
                (g, i) => html`
                  <div class="surface group"
                       data-group-idx="${i}"
                       data-teaching-id="${cls.id}">
                    <div class="group__head">
                      المجموعة ${GROUP_NAMES[i] ?? i + 1}
                      <span class="badge tabular">${g.length}</span>
                    </div>
                    <div class="stack stack-2 mt-3">
                      ${g.map((s) => html`
                        <button type="button" class="group__member ${selectedStudent?.id === s.id ? 'is-selected' : ''}"
                             draggable="${readOnly ? 'false' : 'true'}"
                             data-student-id="${s.id}"
                             data-student-name="${s.name}"
                             data-from-idx="${i}"
                             data-teaching-id="${cls.id}"
                             data-act="toggle-student"
                             aria-pressed="${selectedStudent?.id === s.id ? 'true' : 'false'}"
                             aria-label="${s.name}، اسحب من المقبض أو اضغط لاختيار مجموعة"
                             ${readOnly ? 'disabled' : ''}
                             title="${readOnly ? 'الفصل مؤرشف للعرض فقط' : 'اسحب أو انقر لنقل الطالب'}">
                          <span class="rollno">${s.rollNo ?? '—'}</span>
                          <span class="group__member-name">${s.name}</span>
                          <span class="group__drag-handle noprint" aria-hidden="true">${icon('grip')}</span>
                        </button>
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
            <div class="sr-only" data-groups-drag-status aria-live="polite"></div>
            <button class="btn btn--ghost btn--block mt-4" data-act="print">${icon('print')} اطبع التقسيم</button>
          `
        : ''}
      </div>
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
    if (!container || container.dataset.groupsDndBound === 'true') return;
    container.dataset.groupsDndBound = 'true';

    const page = container.closest('.groups-page');
    const dragStatus = root.querySelector('[data-groups-drag-status]');

    const clearDropStates = () => {
      container.querySelectorAll('.group').forEach((group) => {
        group.classList.remove('is-dragover', 'is-drop-invalid');
        group.removeAttribute('data-drop-state');
      });
    };

    // Desktop Drag and Drop Event Listeners
    const members = container.querySelectorAll('.group__member');
    members.forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        // A native long-press drag must not compete with the Pointer Events path.
        if (touchDrag) {
          e.preventDefault();
          return;
        }
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
        clearDropStates();
      });
    });

    const groupCards = container.querySelectorAll('.group');
    groupCards.forEach((card) => {
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const isSameGroup = Number(card.dataset.groupIdx) === Number(draggedData?.fromIdx);
        try {
          e.dataTransfer.dropEffect = isSameGroup ? 'none' : 'move';
        } catch {}
        clearDropStates();
        card.classList.add(isSameGroup ? 'is-drop-invalid' : 'is-dragover');
        card.dataset.dropState = isSameGroup ? 'invalid' : 'valid';
      });

      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('is-dragover', 'is-drop-invalid');
          card.removeAttribute('data-drop-state');
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        clearDropStates();
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

    // Touch/pen direct manipulation uses the dedicated handle so normal page
    // scrolling remains available from the rest of each student row.
    let touchDrag = null;
    let autoScrollFrame = null;

    const groupAtPoint = (x, y) => document.elementFromPoint(x, y)?.closest?.('.group');

    const updateTouchTarget = (x, y) => {
      if (!touchDrag) return;
      touchDrag.lastX = x;
      touchDrag.lastY = y;
      clearDropStates();
      const target = groupAtPoint(x, y);
      touchDrag.toIdx = null;
      if (!target || !container.contains(target)) {
        if (dragStatus) dragStatus.textContent = 'حرّك الطالب فوق مجموعة لنقله.';
        return;
      }
      const toIdx = Number(target.dataset.groupIdx);
      if (toIdx === touchDrag.fromIdx) {
        target.classList.add('is-drop-invalid');
        target.dataset.dropState = 'invalid';
        if (dragStatus) dragStatus.textContent = 'الطالب موجود في هذه المجموعة.';
        return;
      }
      target.classList.add('is-dragover');
      target.dataset.dropState = 'valid';
      touchDrag.toIdx = toIdx;
      if (dragStatus) dragStatus.textContent = `جاهز للنقل إلى المجموعة ${GROUP_NAMES[toIdx] ?? toIdx + 1}.`;
    };

    const stopAutoScroll = () => {
      if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    };

    const runAutoScroll = () => {
      if (!touchDrag || !touchDrag.scrollSpeed) {
        autoScrollFrame = null;
        return;
      }
      window.scrollBy(0, touchDrag.scrollSpeed);
      updateTouchTarget(touchDrag.lastX, touchDrag.lastY);
      autoScrollFrame = requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScroll = (y) => {
      if (!touchDrag) return;
      const edge = Math.min(84, window.innerHeight * 0.14);
      let speed = 0;
      if (y < edge) speed = -Math.max(3, Math.round((edge - y) / 7));
      else if (y > window.innerHeight - edge) speed = Math.max(3, Math.round((y - (window.innerHeight - edge)) / 7));
      touchDrag.scrollSpeed = speed;
      if (speed && !autoScrollFrame) autoScrollFrame = requestAnimationFrame(runAutoScroll);
      if (!speed) stopAutoScroll();
    };

    const finishTouchDrag = (event, shouldMove) => {
      const activeDrag = touchDrag;
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
      event.preventDefault?.();
      // Clear the shared state before releasing capture. releasePointerCapture()
      // can synchronously fire lostpointercapture, so cleanup must be idempotent.
      touchDrag = null;
      const { handle, member, studentId, fromIdx, teachingId, toIdx } = activeDrag;
      stopAutoScroll();
      try {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      } catch {}
      member.classList.remove('is-touch-dragging');
      member.setAttribute('aria-grabbed', 'false');
      page?.classList.remove('is-touch-drag-active');
      clearDropStates();
      draggedData = null;
      if (dragStatus) dragStatus.textContent = '';

      if (shouldMove && Number.isInteger(toIdx) && toIdx !== fromIdx) {
        void moveStudent(studentId, fromIdx, toIdx, teachingId);
      }
      setTimeout(() => { isDragging = false; }, 120);
    };

    members.forEach((member) => {
      const handle = member.querySelector('.group__drag-handle');
      if (!handle) return;

      handle.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' || event.isPrimary === false) return;
        event.preventDefault();
        if (touchDrag) {
          finishTouchDrag({ pointerId: touchDrag.pointerId, preventDefault() {} }, false);
        }
        selectedStudent = null;
        isDragging = true;
        const fromIdx = Number(member.dataset.fromIdx);
        touchDrag = {
          handle,
          member,
          pointerId: event.pointerId,
          studentId: member.dataset.studentId,
          fromIdx,
          teachingId: member.dataset.teachingId || params?.id,
          toIdx: null,
          lastX: event.clientX,
          lastY: event.clientY,
          scrollSpeed: 0,
        };
        draggedData = {
          studentId: touchDrag.studentId,
          fromIdx,
          teachingId: touchDrag.teachingId,
        };
        try { handle.setPointerCapture(event.pointerId); } catch {}
        member.classList.add('is-touch-dragging');
        member.setAttribute('aria-grabbed', 'true');
        page?.classList.add('is-touch-drag-active');
        if (dragStatus) dragStatus.textContent = `تم رفع ${member.dataset.studentName}. حرّكه إلى مجموعة أخرى.`;
        updateTouchTarget(event.clientX, event.clientY);
      });

      handle.addEventListener('pointermove', (event) => {
        if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
        event.preventDefault();
        updateTouchTarget(event.clientX, event.clientY);
        updateAutoScroll(event.clientY);
      });

      handle.addEventListener('pointerup', (event) => finishTouchDrag(event, true));
      handle.addEventListener('pointercancel', (event) => finishTouchDrag(event, false));
      handle.addEventListener('lostpointercapture', (event) => finishTouchDrag(event, false));
      handle.addEventListener('contextmenu', (event) => event.preventDefault());
    });
  },

  actions: {
    'group-input-method'(el, ev, params) {
      inputMethod = el.dataset.method;
      repaint();
    },
    'target-ready'(el) { targetSelection = 'ready'; targetCount = Number(el.dataset.n); repaint(); },
    'target-count'(el) { targetSelection = 'custom'; targetCount = el.value; repaint(); },
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
      if (inputMethod === 'count' && !validTargetCount(targetCount, getAvailableStudents(params.id).length)) return;
      const freshGroups = build(params.id, { includeUnavailable: inputMethod === 'size' });
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
