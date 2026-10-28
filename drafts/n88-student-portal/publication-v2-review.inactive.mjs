/** AI-authored. Explicitly mounted synthetic review ONLY; no route, store or transport. */
import { proposePublicationRows, decidePublication, samePublicationScope } from '../../src/lib/n88-item-publication-proposal.js';
import { manualTaskDraft } from '../../src/lib/n88-manual-task-link-safety.js';
import { mountDateTimeControl } from '../../src/lib/rakeez-datetime.js';

export function mountPublicationReview(root, initial) {
  const doc = root.ownerDocument;
  let input = initial, draft = proposePublicationRows(initial), manualTasks = [], counter = 0, destroyed = false;
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag);
    if (text != null) node.textContent = text;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const shell = el('section', null, { class: 'n88-publication-review', dir: 'rtl', lang: 'ar', 'aria-label': 'مراجعة نشر البنود — مسودة محلية' });
  const stylesheet = el('link', null, { rel: 'stylesheet', href: new URL('./publication-v2-review.inactive.css', import.meta.url).href });
  shell.append(stylesheet, el('h1', 'مراجعة الأعمال والدرجات'), el('p', 'مسودة محلية للتصميم فقط؛ لا تُحفظ بعد إغلاق الصفحة ولا تظهر لأي طالب. الخدمة الحالية لا تدعم النشر لكل بند.', { class: 'n88-review-notice' }));
  const rows = el('div', null, { 'data-review-rows': '' });
  const status = el('p', '', { role: 'status', 'aria-live': 'polite' });
  shell.append(rows);
  const form = el('form', null, { 'aria-label': 'إضافة مهمة يدوية للمسودة' });
  form.append(el('h2', 'مهمة يكتبها المعلم'));
  const fields = {};
  const field = (name, label, tag = 'input', attrs = {}) => {
    const box = el('label', null), node = el(tag, null, { name, ...attrs });
    box.append(el('span', label), node); form.append(box); fields[name] = node; return node;
  };
  field('title', 'عنوان المهمة', 'input', { required: '', maxlength: '200' });
  field('description', 'وصف المعلم (اختياري)', 'textarea', { maxlength: '2000' });
  const dates = ['startDate', 'dueDate'].map((name, i) => field(name, i ? 'موعد التسليم (اختياري)' : 'البداية (اختياري)', 'input', {
    type: 'text', 'data-rakeez-datetime': 'date', 'data-rakeez-date-scope': 'planning', placeholder: 'YYYY-MM-DD' }));
  field('link', 'رابط شرح أو اختبار HTTPS (اختياري؛ لا يُفتح تلقائيًا)', 'input', { type: 'text', maxlength: '2048', dir: 'ltr' });
  form.append(el('button', 'إضافة إلى المسودة المحلية', { type: 'submit' }));
  shell.append(form, status);
  root.replaceChildren(shell);
  const pickers = dates.map(mountDateTimeControl);

  function renderRows() {
    rows.replaceChildren();
    if (!draft?.rows.length) rows.append(el('p', 'لا توجد بنود توزيع محفوظة في التدريس المحدد.'));
    for (const row of draft?.rows ?? []) {
      const card = el('article', null, { 'data-row-id': row.id });
      card.append(el('h2', row.title), el('p', `${row.kind === 'manual' ? 'مهمة يدوية' : 'بند محفوظ'} · ${row.sourceId}`, { class: 'n88-review-source' }),
        el('p', `البداية: ${row.startDate ?? 'غير محفوظة'} · التسليم: ${row.dueDate ?? 'غير محفوظ'}`, { 'data-row-dates': '' }));
      if (row.description) card.append(el('p', row.description));
      if (row.link) card.append(el('a', 'رابط المعلم — فتح باختيارك', { href: row.link, target: '_blank', rel: 'noopener noreferrer', referrerpolicy: 'no-referrer' }));
      const group = el('fieldset'); group.append(el('legend', 'اختيارات محلية؛ غير منشورة'));
      for (const [flag, label] of Object.entries({ required: 'إظهار العمل المطلوب', scheduled: 'إظهار العمل المجدول', completed: 'إظهار العمل المنجز', grade: 'إظهار درجة هذا البند فقط' })) {
        if (flag === 'grade' ? row.kind === 'manual' : !row.work) continue;
        const wrapper = el('label'), checkbox = el('input', null, { type: 'checkbox', 'data-flag': flag });
        checkbox.checked = row.decisions[flag];
        checkbox.addEventListener('change', () => {
          if (destroyed || !draft) return;
          draft = decidePublication(draft, input.scope, row.id, flag, checkbox.checked);
          status.textContent = 'عُدّل الاختيار في الذاكرة المحلية فقط. لم يحدث نشر.';
        });
        wrapper.append(checkbox, el('span', label)); group.append(wrapper);
      }
      card.append(group); rows.append(card);
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (destroyed || !draft) return;
    try {
      const task = manualTaskDraft({ id: `manual-${++counter}`, ...Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value])) });
      const next = [...manualTasks, { ...task, scope: { ...input.scope } }];
      draft = proposePublicationRows({ ...input, previous: draft, manualTasks: next });
      manualTasks = next; renderRows(); form.reset(); dates.forEach(node => { node.value = ''; node.dispatchEvent(new Event('input')); });
      status.textContent = 'أُضيفت المهمة للمسودة فقط، وجميع اختياراتها مغلقة.';
    } catch (error) { status.textContent = error.message; }
  });
  renderRows();
  return {
    snapshot: () => draft ? structuredClone(draft) : null,
    refresh(next) {
      if (destroyed) throw Error('review_destroyed');
      const same = samePublicationScope(input.scope, next.scope);
      const previous = same ? draft : null;
      if (!same) { manualTasks = []; form.reset(); dates.forEach(node => { node.value = ''; }); }
      input = next; draft = null; rows.replaceChildren();
      try {
        draft = proposePublicationRows({ ...next, previous, manualTasks }); renderRows(); form.hidden = false;
        status.textContent = 'حُدّثت المصادر؛ البنود الجديدة أو المتغيرة تتطلب اختيارًا جديدًا.';
      } catch (error) { form.hidden = true; status.textContent = 'توقفت المراجعة: تغيّر النطاق أو تعذّر التحقق من المصدر.'; throw error; }
    },
    destroy() { destroyed = true; draft = null; manualTasks = []; pickers.forEach(p => p.destroy()); shell.remove(); },
  };
}
