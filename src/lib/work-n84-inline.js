import { html, icon, toast } from './dom.js';
import * as store from '../store.js';
import { repaint } from '../repaint.js';
import { playQuickLogPlus, playQuickLogMinus } from './sound.js';
import { showScoreFloatEffect } from './effects.js';
const pending = new Set();
let pulse = null;
export function inlineQuickLog(item, student) {
  if (item.auto !== 'participation') return '';
  const busy = pending.has(`${item.teachingId}:${student.id}`);
  return html`<span class="n84-inline noprint" role="group" aria-label="رصد مشاركة ${student.name}">
    <button type="button" class="n84-step" data-act="n84-log" data-student="${student.id}" data-item="${item.id}" data-delta="-1" data-fk="n84-${student.id}-${item.id}-minus" aria-label="خصم نقطة مشاركة من ${student.name}" ${busy?'disabled':''}>${icon('minus')}</button>
    <button type="button" class="n84-step n84-step--plus" data-act="n84-log" data-student="${student.id}" data-item="${item.id}" data-delta="1" data-fk="n84-${student.id}-${item.id}-plus" aria-label="إضافة نقطة مشاركة إلى ${student.name}" ${busy?'disabled':''}>${icon('plus')}</button>
  </span>`;
}
export async function recordInlineQuickLog(el, event, params) {
  const item = store.items(params.id).find(i=>i.id===el.dataset.item);
  const studentId = el.dataset.student, delta = Number(el.dataset.delta);
  if (!item || item.auto !== 'participation' || ![-1,1].includes(delta) || store.isTeachingArchived(store.getTeaching(params.id))) return;
  if (!store.teachingContext(params.id).roster.some(s=>s.id===studentId)) return;
  const key = `${params.id}:${studentId}`;
  if (pending.has(key)) return;
  pending.add(key);
  el.closest('.n84-inline').querySelectorAll('button').forEach(b=>b.disabled=true);
  try {
    // Existing Quick Log event command; never set an automatic score directly.
    delta > 0 ? playQuickLogPlus() : playQuickLogMinus();
    if (navigator.vibrate) navigator.vibrate(delta > 0 ? 12 : [8,40,8]);
    await store.addLog({teachingId:params.id,studentId,kind:'participation',delta,tag:''});
    pulse = {studentId,itemId:item.id,delta};
  } catch (error) { toast(error?.message || 'تعذر حفظ الرصدة','danger'); }
  finally {pending.delete(key);repaint();}
}
export function flushInlineQuickLogEffect(root) {
  if (!pulse) return;
  const button = root.querySelector(`[data-act="n84-log"][data-student="${CSS.escape(pulse.studentId)}"][data-item="${CSS.escape(pulse.itemId)}"]`);
  if (button) showScoreFloatEffect(button.closest('.graderow__auto,td'),pulse.delta);
  pulse=null;
}
