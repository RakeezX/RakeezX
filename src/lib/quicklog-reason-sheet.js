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
  behavior: { up: ['⭐','🤝','💻','🧹','✋','💛','🕊️','📋'], down: ['🔊','💻','⏳','💬','✋','🧰','🧹','🛡️','🗣️'] },
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
export function pointControls({ teachingId, student, kind, points, itemId = '', action = 'point-log', undoAction = 'point-undo' }) {
  const workspace = store.getActiveWorkspace(), date = todayISO();
  const busy = pending.has(`${workspace?.id}:${teachingId}:${student.id}`);
  const undo = latestQuickLog(store.state.logs, { teachingId, studentId: student.id, kind, date });
  const attrs = html`data-workspace="${workspace?.id}" data-day="${date}" data-kind="${kind}" data-teaching="${teachingId}" data-id="${student.id}" data-student="${student.id}" data-item="${itemId}"`;
  const label = kind === 'behavior' ? 'سلوك' : 'مشاركة';
  return html`<span class="ql-controls noprint" role="group" aria-label="رصد ${label} ${student.name}">
    <button type="button" class="ql-point qlcard__positive tabular" data-act="${action}" ${attrs} data-delta="1" data-fk="ql-${student.id}-${kind}-plus" aria-label="إضافة نقطة ${label} إلى ${student.name}" ${busy ? 'disabled' : ''}><bdi>${points.positive === null ? '—' : `+${points.positive}`}</bdi></button>
    <button type="button" class="ql-point qlcard__negative tabular" data-act="${action}" ${attrs} data-delta="-1" data-fk="ql-${student.id}-${kind}-minus" aria-label="${kind === 'behavior' ? 'تسجيل نقطة سلوك سلبية لـ' : 'خصم نقطة مشاركة من'} ${student.name}" ${busy ? 'disabled' : ''}><bdi>${points.negative === null ? '—' : `−${points.negative}`}</bdi></button>
    <button type="button" class="qlcard__undo" data-act="${undoAction}" ${attrs} data-fk="ql-${student.id}-${kind}-undo" aria-label="تراجع عن آخر رصدة اليوم لـ ${student.name}" title="تراجع عن آخر رصدة اليوم" ${!undo || busy ? 'disabled' : ''}><span aria-hidden="true">↶</span></button>
  </span>`;
}

export async function runPointAction(el, params, { undo = false, withReason = false, valid = () => true } = {}) {
  const workspace = store.getActiveWorkspace(), date = todayISO(), route = location.hash;
  const { student: studentId, kind, item: itemId } = el.dataset;
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
  if ((!undo && ![-1, 1].includes(delta)) || pending.has(key) || !allowed()) return false;
  const focusKey = document.activeElement === el ? el.dataset.fk : null;
  pending.add(key);
  el.closest('.ql-controls')?.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    let tag = '';
    if (!undo && withReason) {
      const result = await reasonSheet(kind, delta);
      if (!result || !allowed()) return false;
      tag = result.tag;
    }
    if (!allowed()) return false;
    if (undo) {
      const last = latestQuickLog(store.state.logs, { teachingId: params.id, studentId, kind, date });
      if (!last) return false;
      if (!await store.patch('logs', last.id, { deleted: true })) throw Error('تعذّر التراجع. حاول مرة أخرى.');
      toast('أُلغيت آخر رصدة للطالب');
    } else {
      const log = await store.addLog({ teachingId: params.id, studentId, kind, delta, tag, date });
      if (!allowed()) return false;
      const recorded = await db.get('logs', log.id);
      if (!allowed()) return false;
      if (!recorded || recorded.deleted) throw Error('تعذر حفظ الرصدة');
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
    pending.delete(key);
    repaint();
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
