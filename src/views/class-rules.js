/** هدف وميثاق الصف: هدف متزامن دائم + ميثاق محفوظ واختيار عرض متزامن. */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';
import { repaint } from '../repaint.js';

const GOAL_PRESETS = [
  'نلتزم بقوانين الصف',
  'ننجز النشاط بهدوء وتركيز',
  'نشارك باحترام ونستمع للآخرين',
  'نتعاون لإنهاء المهمة في وقتها',
];

const RULE_PRESETS = [
  { iconKey: 'check', text: 'لا تقاطع المعلّم أو زملاءك' },
  { iconKey: 'student', text: 'ارفع يدك قبل المشاركة' },
  { iconKey: 'book', text: 'استمع عندما يتحدث الآخرون' },
  { iconKey: 'users', text: 'احترم زملاءك' },
  { iconKey: 'device', text: 'استخدم الجهاز فيما يخدم الدرس' },
  { iconKey: 'shield', text: 'حافظ على أجهزة الفصل' },
  { iconKey: 'check', text: 'التزم بالتعليمات' },
  { iconKey: 'groups', text: 'تعاون مع مجموعتك' },
  { iconKey: 'clock', text: 'أنجز المهمة في الوقت المحدد' },
  { iconKey: 'spark', text: 'حافظ على هدوء الصف' },
];

const RULE_ICONS = [
  { key: 'check', label: 'التزام' },
  { key: 'student', label: 'مشاركة' },
  { key: 'book', label: 'إنصات' },
  { key: 'groups', label: 'تعاون' },
  { key: 'shield', label: 'حفاظ' },
  { key: 'device', label: 'جهاز' },
];

const uiStates = new Map();
let timerId = null;

function goalState(teachingId) {
  if (!uiStates.has(teachingId)) {
    uiStates.set(teachingId, {
      goalChoice: GOAL_PRESETS[0], customGoal: '',
      durationChoice: '10', customDuration: '', duration: 10,
      rewardChoice: '2', customReward: '', reward: 2,
      presentation: false, confirming: false, editingNew: false,
    });
  }
  const draft = uiStates.get(teachingId);
  const goal = store.classGoalOf(teachingId);
  if (draft.editingNew || !goal || !['active', 'completed'].includes(goal.state)) return { ...draft, status: 'builder' };
  return {
    ...draft, status: draft.confirming && goal.state === 'active' ? 'confirm' : goal.state === 'completed' ? 'confirmed' : 'active',
    goal: goal.text, duration: goal.durationMinutes, reward: goal.rewardPoints,
    startedAt: goal.startedAt, runId: goal.runId,
  };
}

function selectedCharterRules(teachingId) {
  return store.selectedClassRules(teachingId);
}

function remainingSeconds(state) {
  if (!['active', 'confirm'].includes(state.status)) return state.status === 'confirmed' ? 0 : Number(state.duration * 60);
  return Math.max(0, Math.ceil(((Number(state.startedAt) + Number(state.duration) * 60_000) - Date.now()) / 1000));
}

function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function ensureTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    const match = location.hash.match(/^#\/teaching\/([^/]+)/);
    const teachingId = match ? decodeURIComponent(match[1]) : '';
    const state = goalState(teachingId);
    if (!store.activeClassGoal(teachingId)) {
      clearInterval(timerId);
      timerId = null;
      return;
    }
    const remaining = remainingSeconds(state);
    const label = formatCountdown(remaining);
    document.querySelectorAll('.goal-live__timer, .classroom-presentation__timer, .class-goal-indicator__timer').forEach((element) => {
      element.textContent = label;
      element.setAttribute('aria-label', `الوقت المتبقي ${label}`);
    });
    if (remaining === 0) {
      clearInterval(timerId);
      timerId = null;
      repaint();
    }
  }, 1000);
}

export function activeGoalSummary(teachingId) {
  const goal = store.activeClassGoal(teachingId);
  if (!goal) return null;
  const state = goalState(teachingId);
  const remaining = remainingSeconds(state);
  return { goal: goal.text, reward: goal.rewardPoints, remaining, countdown: formatCountdown(remaining) };
}

export function watchActiveGoalTimer(teachingId) {
  if (activeGoalSummary(teachingId)) ensureTimer();
}

function goalBuilder(state) {
  return html`
    <form class="goal-builder" data-submit="start-goal">
      <label class="goal-builder__goal field">
        <span class="field__label">الهدف الرئيسي</span>
        <select class="select" name="goalPreset" aria-label="اختر هدف الحصة" data-change="goal-builder-choice">
          ${GOAL_PRESETS.map((preset) => html`<option ${state.goalChoice === preset ? 'selected' : ''}>${preset}</option>`) }
          <option value="custom" ${state.goalChoice === 'custom' ? 'selected' : ''}>+ هدف مخصص</option>
        </select>
        ${state.goalChoice === 'custom' ? html`
          <span class="goal-builder__reveal">
            <input class="input" name="customGoal" value="${state.customGoal}" maxlength="120" required autocomplete="off" aria-label="الهدف المخصص" placeholder="اكتب هدفًا قصيرًا وواضحًا">
          </span>
        ` : ''}
      </label>
      <div class="goal-builder__settings">
        <label class="field">
          <span class="field__label">المدة</span>
          <select class="select" name="duration" data-change="goal-builder-choice">
            ${[5, 10, 15, 20, 30].map((value) => html`<option value="${value}" ${state.durationChoice === String(value) ? 'selected' : ''}>${value} دقائق</option>`) }
            <option value="custom" ${state.durationChoice === 'custom' ? 'selected' : ''}>مخصص</option>
          </select>
          ${state.durationChoice === 'custom' ? html`
            <span class="goal-builder__reveal goal-builder__reveal--compact">
              <input class="input tabular" type="number" inputmode="numeric" name="customDuration" value="${state.customDuration}" min="1" max="180" step="1" required aria-label="مدة مخصصة بالدقائق" placeholder="مثال: 12">
            </span>
          ` : ''}
        </label>
        <label class="field">
          <span class="field__label">المكافأة</span>
          <select class="select" name="reward" data-change="goal-builder-choice">
            ${[1, 2, 3, 5].map((value) => html`<option value="${value}" ${state.rewardChoice === String(value) ? 'selected' : ''}>+${value} مشاركة</option>`) }
            <option value="custom" ${state.rewardChoice === 'custom' ? 'selected' : ''}>مخصص</option>
          </select>
          ${state.rewardChoice === 'custom' ? html`
            <span class="goal-builder__reveal goal-builder__reveal--compact">
              <input class="input tabular" type="number" inputmode="numeric" name="customReward" value="${state.customReward}" min="1" max="10" step="1" required aria-label="قيمة مكافأة مخصصة" placeholder="مثال: 4">
            </span>
          ` : ''}
        </label>
      </div>
      <button class="btn btn--primary goal-builder__start" type="submit">${icon('clock')} ابدأ الهدف</button>
    </form>
  `;
}

function activeGoal(state, rewardPreview) {
  const remaining = remainingSeconds(state);
  const expired = remaining === 0 && state.status === 'active';
  const confirming = state.status === 'confirm';
  const confirmed = state.status === 'confirmed';
  return html`
    <div class="goal-live ${expired ? 'is-expired' : ''} ${confirmed ? 'is-confirmed' : ''}">
      <div class="goal-live__main">
        <span class="goal-live__eyebrow">${confirmed ? icon('check') : icon('clock')} ${confirmed ? 'تحقق الهدف' : expired ? 'انتهى الوقت' : 'الهدف نشط الآن'}</span>
        <h2 class="goal-live__title">${state.goal}</h2>
        <div class="goal-live__timer tabular" aria-label="الوقت المتبقي ${formatCountdown(remaining)}">${formatCountdown(remaining)}</div>
        <div class="goal-live__reward"><span>المكافأة المقصودة</span><strong class="tabular">+${state.reward}</strong><span>مشاركة</span></div>
        ${expired ? html`<p class="goal-live__notice">انتهى الوقت — بانتظار قرار المعلّم. لا تُضاف نقاط تلقائيًا.</p>` : ''}
        ${confirmed ? html`<p class="goal-live__notice is-success">تم تأكيد النجاح بصريًا. لم تُرحّل أي درجات في هذه المعاينة.</p>` : ''}
      </div>
      ${confirming ? html`
        <div class="goal-confirm" role="status">
          <span class="goal-confirm__icon">${icon('check')}</span>
          <div class="goal-confirm__copy"><strong>تأكيد تحقيق الهدف</strong><span>${rewardPreview.ok ? html`سيتم منح <bdi>+${state.reward}</bdi> لـ ${rewardPreview.count} طالبًا مؤهلًا` : 'تعذر إثبات قائمة الطلاب المؤهلين لهذه الحصة'}</span><small>${rewardPreview.ok ? 'تُنفّذ المكافأة مرة واحدة بعد التأكيد.' : 'لن تُضاف أي نقاط حتى تصبح عضوية الحصة قابلة للإثبات.'}</small></div>
          <div class="goal-confirm__actions">
            <button class="btn btn--primary" data-act="confirm-goal-success" ${!rewardPreview.ok || !rewardPreview.count ? 'disabled' : ''}>تأكيد المنح</button>
            <button class="btn btn--quiet" data-act="cancel-goal-success">رجوع</button>
          </div>
        </div>
      ` : html`
        <div class="goal-live__actions">
          ${confirmed
            ? html`<button class="btn btn--primary" data-act="new-goal">هدف جديد</button>`
            : html`<button class="btn btn--primary" data-act="goal-success">${icon('check')} تم تحقيق الهدف</button>
              <button class="btn btn--quiet" data-act="stop-goal">${icon('x')} إيقاف الهدف</button>`}
        </div>
      `}
    </div>
  `;
}

function charterSection(teachingId, { readOnly = false } = {}) {
  const rules = store.classRulesOf(teachingId);
  const selectedRules = selectedCharterRules(teachingId);
  const selectedIds = new Set(selectedRules.map((rule) => rule.id));
  return html`
    <section class="class-charter" aria-labelledby="charter-title">
      <div class="class-charter__head">
        <div>
          <span class="class-charter__eyebrow">${selectedRules.length} من ${rules.length} ضمن العرض الصفي</span>
          <h2 id="charter-title">ميثاق الصف</h2>
        </div>
        <div class="class-charter__head-actions" ${readOnly ? 'hidden' : ''}>
          <button class="btn btn--quiet btn--sm" data-act="open-rule-presets">${icon('spark')} مواثيق جاهزة</button>
          <button class="btn btn--primary btn--sm" data-act="add-custom-rule">${icon('plus')} ميثاق مخصص</button>
        </div>
      </div>
      ${rules.length ? html`
        <ol class="charter-list" aria-label="اختر بنود ميثاق الصف للعرض">
          ${rules.map((rule, index) => html`
            <li class="charter-rule ${selectedIds.has(rule.id) ? 'is-selected' : ''}">
              <button class="charter-rule__choice" type="button" ${readOnly ? 'disabled' : ''} data-act="toggle-charter-rule" data-id="${rule.id}" aria-pressed="${selectedIds.has(rule.id) ? 'true' : 'false'}" aria-label="${selectedIds.has(rule.id) ? 'إزالة من العرض' : 'تضمين في العرض'}: ${rule.text}">
                <span class="charter-rule__number tabular">${selectedIds.has(rule.id) ? icon('check') : index + 1}</span>
                <span class="charter-rule__icon">${icon(rule.iconKey)}</span>
                <span class="charter-rule__copy"><span class="charter-rule__text">${rule.text}</span><small>${selectedIds.has(rule.id) ? 'ضمن الميثاق النشط' : 'غير مضمّن في العرض'}</small></span>
              </button>
              <span class="charter-rule__actions" ${readOnly ? 'hidden' : ''}>
                <button class="iconbtn" data-act="edit-rule" data-id="${rule.id}" aria-label="تعديل: ${rule.text}" title="تعديل">${icon('edit')}</button>
                <button class="iconbtn charter-rule__delete" data-act="delete-rule" data-id="${rule.id}" aria-label="حذف: ${rule.text}" title="حذف">${icon('trash')}</button>
              </span>
            </li>
          `)}
        </ol>
      ` : html`
        <div class="charter-empty">
          <span class="charter-empty__icon">${icon('book')}</span>
          <div><strong>ابدأ بميثاق واضح ومختصر</strong><p>أضف القواعد الأهم لفصلك، ثم اعرضها للطلاب عند الحاجة.</p></div>
        </div>
      `}
    </section>
  `;
}

function presentationView(state, rules) {
  const remaining = remainingSeconds(state);
  const showGoal = state.status === 'active';
  return html`
    <div class="classroom-presentation" role="dialog" aria-modal="true" aria-label="العرض الصفي">
      <header class="classroom-presentation__head">
        <div class="classroom-presentation__brand">رَكيز <bdi>X</bdi></div>
        <span class="classroom-presentation__label">عرض صفي</span>
        <button class="btn classroom-presentation__exit" data-act="close-presentation">${icon('x')} إنهاء العرض</button>
      </header>
      <main class="classroom-presentation__body ${showGoal ? 'has-goal' : 'is-charter-only'}">
        ${showGoal ? html`<section class="classroom-presentation__goal">
          <span>هدف الحصة</span>
          <h1>${state.goal}</h1>
          <div class="classroom-presentation__timer tabular">${formatCountdown(remaining)}</div>
          <div class="classroom-presentation__reward">المكافأة <strong class="tabular">+${state.reward}</strong> مشاركة</div>
          ${remaining === 0 ? html`<div class="classroom-presentation__expired">انتهى الوقت — القرار للمعلّم</div>` : ''}
        </section>` : ''}
        <section class="classroom-presentation__charter">
          <div class="classroom-presentation__charter-title">ميثاق الصف</div>
          ${rules.length ? html`<ol>${rules.map((rule, index) => html`<li><span class="tabular">${index + 1}</span><i>${icon(rule.iconKey)}</i><strong>${rule.text}</strong></li>`)}</ol>` : html`<p>اختر بنود الميثاق التي تريد عرضها للطلاب.</p>`}
        </section>
      </main>
    </div>
  `;
}

async function ruleEditor({ teachingId, rule = null }) {
  const currentIcon = rule?.iconKey || 'check';
  return openSheet({
    title: rule ? 'تعديل الميثاق' : 'ميثاق مخصص',
    desc: 'اكتبها بصيغة قصيرة وواضحة للطلاب.',
    body: html`
      <form id="class-rule-form" class="rule-editor">
        <label class="field">
          <span class="field__label">نص الميثاق</span>
          <input class="input" name="text" value="${rule?.text || ''}" maxlength="240" required autocomplete="off" placeholder="مثال: نبدأ العمل عند سماع الإشارة">
        </label>
        <fieldset class="rule-icon-picker">
          <legend>الرمز</legend>
          ${RULE_ICONS.map((item) => html`<label><input type="radio" name="iconKey" value="${item.key}" ${item.key === currentIcon ? 'checked' : ''}><span>${icon(item.key)} ${item.label}</span></label>`) }
        </fieldset>
      </form>
    `,
    foot: html`<button class="btn btn--quiet" data-sheet-close>إلغاء</button><button class="btn btn--primary" type="submit" form="class-rule-form">${rule ? 'حفظ التعديل' : 'إضافة الميثاق'}</button>`,
    onMount: (root, done) => root.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const text = String(data.get('text') || '').trim();
      if (!text) return;
      done({ teachingId, text, iconKey: String(data.get('iconKey') || 'check') });
    }),
  });
}

export default {
  title: 'هدف وميثاق الصف',
  subtitle: (p) => {
    const teaching = store.getTeaching(p.id);
    return sectionLabel(store.getSection(teaching?.sectionId));
  },
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  render(p) {
    const teaching = store.getTeaching(p.id);
    if (!teaching) return html`<div class="empty"><div class="empty__title">هذا الفصل غير موجود</div><a class="btn btn--quiet" href="#/classes">العودة للفصول</a></div>`;
    const state = goalState(p.id);
    const selectedRules = selectedCharterRules(p.id);
    const rewardPreview = store.classGoalRewardPreview(p.id);
    const readOnly = store.isTeachingArchived(teaching) || store.isTermClosed(teaching.termId);
    return html`
      <div class="class-rules-page">
        <section class="class-rules-surface">
          ${readOnly ? html`<div class="empty"><div class="empty__title">سجل هدف وميثاق محفوظ للقراءة فقط</div><p>لا يمكن بدء هدف أو تعديل الميثاق في فصل مؤرشف أو فصل دراسي مغلق.</p></div>` : html`<section class="lesson-goal" aria-labelledby="lesson-goal-title">
            <div class="lesson-goal__head">
              <h1 id="lesson-goal-title">الهدف الرئيسي</h1>
              <div class="presentation-controls">
                <button class="btn btn--quiet btn--sm presentation-controls__action" data-act="open-presentation">${icon('board')} عرض صفي</button>
              </div>
            </div>
            ${state.status === 'builder' ? goalBuilder(state) : activeGoal(state, rewardPreview)}
          </section>`}
          ${charterSection(p.id, { readOnly })}
        </section>
      </div>
      ${state.presentation ? presentationView(state, selectedRules) : ''}
    `;
  },

  onUnmount() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  },

  afterPaint(root, params) {
    if (store.activeClassGoal(params.id)) ensureTimer();
  },

  actions: {
    'goal-builder-choice'(select, event, params) {
      const form = select.closest('form');
      const state = uiStates.get(params.id) ?? goalState(params.id);
      if (!form) return;
      const data = new FormData(form);
      state.goalChoice = String(data.get('goalPreset') || GOAL_PRESETS[0]);
      state.durationChoice = String(data.get('duration') || '10');
      state.rewardChoice = String(data.get('reward') || '2');
      if (data.has('customGoal')) state.customGoal = String(data.get('customGoal') || '');
      if (data.has('customDuration')) state.customDuration = String(data.get('customDuration') || '');
      if (data.has('customReward')) state.customReward = String(data.get('customReward') || '');
      repaint();
    },
    async 'start-goal'(form, event, params) {
      const data = new FormData(form);
      const state = goalState(params.id);
      const goalChoice = String(data.get('goalPreset') || GOAL_PRESETS[0]);
      const durationChoice = String(data.get('duration') || '10');
      const rewardChoice = String(data.get('reward') || '2');
      const customGoal = String(data.get('customGoal') || '').trim();
      const customDuration = String(data.get('customDuration') || '');
      const customReward = String(data.get('customReward') || '');
      const goal = goalChoice === 'custom' ? customGoal : goalChoice;
      const duration = Number(durationChoice === 'custom' ? customDuration : durationChoice);
      const reward = Number(rewardChoice === 'custom' ? customReward : rewardChoice);
      if (!goal) {
        toast('اكتب هدف الحصة المخصص', 'warn');
        form.querySelector('[name="customGoal"]')?.focus();
        return;
      }
      if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
        toast('أدخل مدة صحيحة بين 1 و180 دقيقة', 'warn');
        form.querySelector('[name="customDuration"]')?.focus();
        return;
      }
      if (!Number.isInteger(reward) || reward < 1 || reward > 10) {
        toast('أدخل مكافأة صحيحة بين 1 و10', 'warn');
        form.querySelector('[name="customReward"]')?.focus();
        return;
      }
      Object.assign(uiStates.get(params.id), { goalChoice, customGoal, durationChoice, customDuration,
        rewardChoice, customReward, confirming: false, editingNew: false });
      try {
        await store.startClassGoal({ teachingId: params.id, text: goal,
          presetKey: goalChoice === 'custom' ? null : goalChoice, durationMinutes: duration, rewardPoints: reward });
      } catch (error) {
        toast(error.message, 'warn');
        return;
      }
      toast('بدأ الهدف وحُفظ على هذا الجهاز');
      ensureTimer();
      repaint();
    },
    async 'stop-goal'(el, event, params) {
      await store.cancelClassGoal(params.id);
      Object.assign(uiStates.get(params.id), { presentation: false, confirming: false, editingNew: false });
      repaint();
    },
    'goal-success'(el, event, params) {
      uiStates.get(params.id).confirming = true;
      repaint();
    },
    'cancel-goal-success'(el, event, params) {
      uiStates.get(params.id).confirming = false;
      ensureTimer();
      repaint();
    },
    async 'confirm-goal-success'(el, event, params) {
      el.disabled = true;
      try {
        const result = await store.rewardClassGoal(params.id);
        uiStates.get(params.id).confirming = false;
        toast(result.queued ? 'حُفظ طلب المكافأة وسيُنفّذ مرة واحدة عند المزامنة' : 'طلب المكافأة محفوظ مسبقًا');
        repaint();
      } catch (error) {
        el.disabled = false;
        toast(error.message, 'warn');
      }
    },
    'new-goal'(el, event, params) {
      Object.assign(uiStates.get(params.id), { presentation: false, confirming: false, editingNew: true });
      repaint();
    },
    async 'toggle-charter-rule'(el, event, params) {
      const selected = new Set(selectedCharterRules(params.id).map((rule) => rule.id));
      if (selected.has(el.dataset.id)) selected.delete(el.dataset.id);
      else selected.add(el.dataset.id);
      await store.setClassCharterSelection(params.id, [...selected]);
      repaint();
    },
    'open-presentation'(el, event, params) {
      uiStates.get(params.id).presentation = true;
      repaint();
    },
    'close-presentation'(el, event, params) {
      uiStates.get(params.id).presentation = false;
      repaint();
    },
    async 'open-rule-presets'(el, event, params) {
      const existing = new Set(store.classRulesOf(params.id).map((rule) => rule.text));
      const availablePresets = RULE_PRESETS.filter((preset) => !existing.has(preset.text));
      const existingPresets = RULE_PRESETS.filter((preset) => existing.has(preset.text));
      const presetButton = (preset, index, disabled = false) => html`
        <button class="rule-preset" type="button" data-preset-text="${preset.text}" data-preset-icon="${preset.iconKey}" data-preset-index="${index}" aria-pressed="false" ${disabled ? 'disabled' : ''}>
          <span>${icon(preset.iconKey)}</span><strong>${preset.text}</strong><small class="rule-preset__state">${disabled ? html`${icon('check')} مضافة مسبقًا` : 'اختر'}</small>
        </button>`;
      const chosen = await openSheet({
        title: 'مواثيق جاهزة',
        desc: 'اختر أكثر من ميثاق، ثم احفظ اختياراتك دفعة واحدة.',
        body: html`
          <div class="rule-preset-groups" aria-label="اختر المواثيق الجاهزة">
            <section class="rule-preset-group rule-preset-group--selected" data-selected-group hidden>
              <div class="rule-preset-group__title"><strong>مختارة الآن</strong><span class="tabular" data-selected-count>0</span></div>
              <div class="rule-preset-list" data-selected-presets></div>
            </section>
            <section class="rule-preset-group">
              <div class="rule-preset-group__title"><strong>مواثيق متاحة</strong><span class="tabular">${availablePresets.length}</span></div>
              <div class="rule-preset-list" data-available-presets>${availablePresets.length
                ? availablePresets.map((preset) => presetButton(preset, RULE_PRESETS.indexOf(preset)))
                : html`<div class="rule-preset-empty">جميع المواثيق الجاهزة مضافة.</div>`}</div>
            </section>
            ${existingPresets.length ? html`
              <section class="rule-preset-group rule-preset-group--existing">
                <div class="rule-preset-group__title"><strong>مضافة مسبقًا</strong><span class="tabular">${existingPresets.length}</span></div>
                <div class="rule-preset-list">${existingPresets.map((preset) => presetButton(preset, RULE_PRESETS.indexOf(preset), true))}</div>
              </section>` : ''}
          </div>`,
        foot: html`<button class="btn btn--quiet" data-sheet-close>إلغاء</button><button class="btn btn--primary" data-save-presets disabled>حفظ الاختيارات</button>`,
        onMount: (root, done) => {
          const selected = new Map();
          const save = root.querySelector('[data-save-presets]');
          const selectedGroup = root.querySelector('[data-selected-group]');
          const selectedList = root.querySelector('[data-selected-presets]');
          const availableList = root.querySelector('[data-available-presets]');
          const selectedCount = root.querySelector('[data-selected-count]');
          const sortByPresetOrder = (container) => [...container.children]
            .sort((a, b) => Number(a.dataset.presetIndex) - Number(b.dataset.presetIndex))
            .forEach((button) => container.append(button));
          root.querySelectorAll('[data-preset-text]:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
            const text = button.dataset.presetText;
            if (selected.has(text)) selected.delete(text);
            else selected.set(text, { text, iconKey: button.dataset.presetIcon });
            const active = selected.has(text);
            button.classList.toggle('is-selected', active);
            button.setAttribute('aria-pressed', String(active));
            button.querySelector('.rule-preset__state').innerHTML = active ? `${icon('check')} مختارة` : 'اختر';
            const destination = active ? selectedList : availableList;
            destination.append(button);
            sortByPresetOrder(destination);
            selectedGroup.hidden = selected.size === 0;
            selectedCount.textContent = String(selected.size);
            save.disabled = selected.size === 0;
          }));
          save?.addEventListener('click', () => done([...selected.values()]));
        },
      });
      if (!chosen?.length) return;
      const selected = new Set(selectedCharterRules(params.id).map((rule) => rule.id));
      for (const preset of chosen) {
        const added = await store.addClassRule({ teachingId: params.id, ...preset });
        if (added) selected.add(added.id);
      }
      await store.setClassCharterSelection(params.id, [...selected]);
      toast(`أُضيف ${chosen.length} من المواثيق إلى ميثاق الصف`);
      repaint();
    },
    async 'add-custom-rule'(el, event, params) {
      const data = await ruleEditor({ teachingId: params.id });
      if (!data) return;
      const selected = new Set(selectedCharterRules(params.id).map((rule) => rule.id));
      const added = await store.addClassRule(data);
      if (added) selected.add(added.id);
      await store.setClassCharterSelection(params.id, [...selected]);
      toast('أُضيفت القاعدة إلى الميثاق');
      repaint();
    },
    async 'edit-rule'(el, event, params) {
      const rule = store.classRulesOf(params.id).find((item) => item.id === el.dataset.id);
      if (!rule) return;
      const data = await ruleEditor({ teachingId: params.id, rule });
      if (!data) return;
      await store.editClassRule(rule.id, data);
      toast('حُفظ تعديل القاعدة');
      repaint();
    },
    async 'delete-rule'(el, event, params) {
      const rule = store.classRulesOf(params.id).find((item) => item.id === el.dataset.id);
      if (!rule) return;
      const ok = await confirmSheet({ title: 'حذف الميثاق؟', desc: `«${rule.text}» سيُحذف من ميثاق هذا الصف.`, confirmLabel: 'حذف الميثاق', danger: true });
      if (!ok) return;
      await store.deleteClassRule(rule.id);
      toast('حُذفت القاعدة');
      repaint();
    },
  },
};
