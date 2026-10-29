// AI-authored N140: shared presentation and guarded existing log commands.
import { html, openSheet, toast } from './dom.js';
import * as store from '../store.js';
import * as db from './db.js';
import { LOG_TAGS, todayISO, latestQuickLog } from '../models.js';
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { repaint } from '../repaint.js';
import { playQuickLogPlus, playQuickLogMinus } from './sound.js';

const icons = {
  participation: { up: ['✅','🙋','💡','🤝','✍️','💬','⭐','🌱'], down: ['🙋','🎒','📝','⏳','✋','🎯','📋','🔔'] },
  behavior: { up: ['⭐','🤝','💻','🧹','✋','💛','🕊️','📋'], down: ['🔊','💻','⏳','💬','✋','🧰','🧹','🛡️','🗣️','😴','🚪','📱'] },
};
export function reasonSheet(kind, delta) {
  const direction = delta > 0 ? 'up' : 'down';
  const general = kind === 'participation' ? (delta > 0 ? 'رصد عام' : 'خصم عام')
    : (delta > 0 ? 'سجل سلوك إيجابي عام' : 'سجل سلوك سلبي عام');
  return openSheet({
    title: kind === 'behavior' ? (delta > 0 ? 'سبب السلوك الإيجابي' : 'سبب السلوك السلبي')
      : (delta > 0 ? 'سبب نقطة المشاركة' : 'سبب خصم نقطة المشاركة'),
    desc: kind === 'behavior' ? 'توثيق للسلوك فقط؛ لا يؤثر في الدرجات.' : 'يظهر السبب في تقرير الطالب.',
    body: html`<div class="taglist ql-reasons">${LOG_TAGS[kind][direction].map((tag, index) => html`
      <button type="button" class="btn btn--ghost tag-pick" data-tag="${tag}"><span aria-hidden="true">${icons[kind][direction][index]}</span><span>${tag}</span></button>`)}</div>
      <label class="field mt-4"><span class="field__label">أو اكتب سببًا</span>
        <input class="input" id="tag-other" maxlength="60" autocomplete="off" placeholder="سبب آخر"></label>`,
    foot: html`<button type="button" class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button type="button" class="btn btn--primary" id="tag-go">${general}</button>`,
    onMount(root, done) {
      root.querySelectorAll('[data-tag]').forEach(button => button.addEventListener('click', () => done({ tag: button.dataset.tag })));
      const input = root.querySelector('#tag-other'), submit = root.querySelector('#tag-go');
      input.addEventListener('input', () => { submit.textContent = input.value.trim() ? 'تسجيل السبب' : general; });
      submit.addEventListener('click', () => done({ tag: input.value.trim() }));
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); done({ tag: input.value.trim() }); } });
    },
  });
}

const pending = new Set();
const operations = new Map();
let heldPointer = null, surface = null, pointerListenersInstalled = false;
// Keep only these two views' page template stable between pointerdown and click.
// The shared renderer and store notifications remain untouched. Context guards
// still run at click/commit, including when an incoming update invalidates a row.
export function stablePointSurface(render) {
  if (!pointerListenersInstalled) {
    pointerListenersInstalled = true;
    document.addEventListener('pointerdown', event => {
      const button = event.target.closest?.('.ql-controls button:not(:disabled)');
      if (button && event.isPrimary && event.button === 0) {
        heldPointer = { id: event.pointerId, route: location.hash, workspace: store.getActiveWorkspace() };
      }
    }, true);
    const release = event => {
      if (!heldPointer || (event.pointerId != null && event.pointerId !== heldPointer.id)) return;
      // Run after the delegated click, not between pointerup and click.
      const released = heldPointer;
      setTimeout(() => { if (heldPointer === released) { heldPointer = null; repaint(); } }, 0);
    };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
  }
  const workspace = store.getActiveWorkspace(), route = location.hash;
  if (heldPointer?.workspace === workspace && heldPointer.route === route && surface?.workspace === workspace && surface.route === route) return surface.markup;
  const markup = render();
  surface = { workspace, route, markup };
  return markup;
}

function refreshControls(key, message = '') {
  document.querySelectorAll('.ql-controls').forEach(group => {
    const button = group.querySelector('.ql-point');
    if (!button || `${button.dataset.workspace}:${button.dataset.teaching}:${button.dataset.student}` !== key) return;
    const locked = pending.has(key), saving = operations.has(key);
    group.querySelectorAll('.ql-point').forEach(el => { el.disabled = locked; });
    const { teaching: teachingId, student: studentId, kind, day: date } = button.dataset;
    group.querySelector('.qlcard__undo').disabled = locked || saving || !latestQuickLog(store.state.logs, {teachingId,studentId,kind,date});
    group.setAttribute('aria-busy', String(saving));
    group.querySelector('.ql-save-status').textContent = saving ? 'جارٍ الحفظ…' : message;
  });
}
export function pointControls({ teachingId, student, kind, points, itemId = '', action = 'point-log', undoAction = 'point-undo' }) {
  const workspace = store.getActiveWorkspace(), date = todayISO();
  const key = `${workspace?.id}:${teachingId}:${student.id}`;
  const busy = pending.has(key), saving = operations.has(key);
  const undo = latestQuickLog(store.state.logs, { teachingId, studentId: student.id, kind, date });
  const attrs = html`data-workspace="${workspace?.id}" data-day="${date}" data-kind="${kind}" data-teaching="${teachingId}" data-id="${student.id}" data-student="${student.id}" data-item="${itemId}"`;
  const label = kind === 'behavior' ? 'سلوك' : 'مشاركة';
  return html`<span class="ql-controls noprint" role="group" aria-busy="${saving}" aria-label="رصد ${label} ${student.name}">
    <button type="button" class="ql-point qlcard__positive tabular" data-act="${action}" ${attrs} data-delta="1" data-fk="ql-${student.id}-${kind}-plus" aria-label="إضافة نقطة ${label} إلى ${student.name}" ${busy ? 'disabled' : ''}><bdi>${points.positive === null ? '—' : `+${points.positive}`}</bdi></button>
    <button type="button" class="ql-point qlcard__negative tabular" data-act="${action}" ${attrs} data-delta="-1" data-fk="ql-${student.id}-${kind}-minus" aria-label="${kind === 'behavior' ? 'تسجيل نقطة سلوك سلبية لـ' : 'خصم نقطة مشاركة من'} ${student.name}" ${busy ? 'disabled' : ''}><bdi>${points.negative === null ? '—' : `−${points.negative}`}</bdi></button>
    <button type="button" class="qlcard__undo" data-act="${undoAction}" ${attrs} data-fk="ql-${student.id}-${kind}-undo" aria-label="تراجع عن آخر رصدة اليوم لـ ${student.name}" title="تراجع عن آخر رصدة اليوم" ${!undo || busy || saving ? 'disabled' : ''}><span aria-hidden="true">↶</span></button>
    <span class="ql-save-status" role="status">${saving ? 'جارٍ الحفظ…' : ''}</span>
  </span>`;
}

export async function runPointAction(el, params, { undo = false, withReason = false, valid = () => true } = {}) {
  const workspace = store.getActiveWorkspace(), date = todayISO(), route = location.hash;
  // Capture the command, never read another student's replacement DOM later.
  const captured = { ...el.dataset };
  const { student: studentId, kind, item: itemId } = captured;
  const delta = Number(el.dataset.delta);
  const allowed = () => {
    const access = runtimeSyncOwnershipGuard.enqueueAccess();
    return workspace && store.getActiveWorkspace() === workspace && location.hash === route && valid() &&
      el.dataset.workspace === workspace.id && el.dataset.day === date && todayISO() === date &&
      el.dataset.teaching === params.id && ['participation', 'behavior'].includes(kind) &&
      !store.isTeachingArchived(store.getTeaching(params.id)) && store.students(params.id).some(s => s.id === studentId) &&
      (!itemId || store.items(params.id).some(i => i.id === itemId && i.auto === 'participation' && kind === 'participation')) &&
      (workspace.type === 'demo' || (access.allowed && (workspace.type !== 'account' || access.workspaceOwnerId === workspace.authUserId)));
  };
  const key = `${workspace?.id}:${params.id}:${studentId}`;
  if ((!undo && ![-1, 1].includes(delta)) || pending.has(key) || (undo && operations.has(key)) || !allowed()) return false;
  const focusKey = document.activeElement === el ? el.dataset.fk : null;
  const exclusive = undo || withReason;
  if (exclusive) pending.add(key);
  const previous = operations.get(key);
  let finish;
  const current = new Promise(resolve => { finish = resolve; });
  operations.set(key, current);
  refreshControls(key);
  let changed = false;
  try {
    let tag = '';
    if (!undo && withReason) {
      const result = await reasonSheet(kind, delta);
      if (!result) return false;
      if (!allowed()) { toast('لم تُسجَّل الرصدة لتغيّر سياق الفصل', 'warn'); return false; }
      tag = result.tag;
    }
    if (previous) await previous;
    if (!allowed()) { toast('لم تُسجَّل الرصدة لتغيّر سياق الفصل', 'warn'); return false; }
    if (undo) {
      const last = latestQuickLog(store.state.logs, { teachingId: params.id, studentId, kind, date });
      if (!last) return false;
      if (!await store.patch('logs', last.id, { deleted: true })) throw Error('تعذّر التراجع. حاول مرة أخرى.');
      changed = true;
      toast('أُلغيت آخر رصدة للطالب');
    } else {
      const log = await store.addLog({ teachingId: params.id, studentId, kind, delta, tag, date });
      if (!allowed()) return false;
      const recorded = await db.get('logs', log.id);
      if (!allowed()) return false;
      if (!recorded || recorded.deleted) throw Error('تعذر حفظ الرصدة');
      changed = true;
      delta > 0 ? playQuickLogPlus() : playQuickLogMinus();
      navigator.vibrate?.(delta > 0 ? 12 : [8, 40, 8]);
    }
    return true;
  } catch (error) {
    toast(undo ? 'تعذّر التراجع. حاول مرة أخرى.' : error?.message || 'تعذر حفظ الرصدة', 'danger');
    return false;
  } finally {
    // A rapid double Undo must not remove two different rows.
    if (undo) await new Promise(resolve => setTimeout(resolve, 350));
    if (exclusive) {
      pending.delete(key);
      refreshControls(key);
    }
    // A cancelled picker may sit behind an earlier save. Unlock it immediately,
    // but keep its queue link until that save drains so the next tap stays ordered.
    if (previous) await previous;
    if (operations.get(key) === current) operations.delete(key);
    finish();
    // Cancellation must restore the live buttons even if cached markup is equal.
    // No whole-page repaint is needed when the sheet made no change.
    refreshControls(key, changed ? 'حُفظ' : '');
    if (changed) repaint();
    // Disabling a focused button during persistence moves focus to the body.
    // Restore only that lost focus; never pull focus away from another control.
    if (focusKey && store.getActiveWorkspace() === workspace && location.hash === route) {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body || document.activeElement === el || !document.activeElement?.isConnected) {
          document.querySelector(`[data-fk="${CSS.escape(focusKey)}"]:not(:disabled)`)?.focus({ preventScroll: true });
        }
      });
    }
  }
}
