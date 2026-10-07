import { html, openSheet, render, fmtNum } from './dom.js';
import * as store from '../store.js';
import { scoreDefinitionSignature } from './score-foundation.js';

const collator = new Intl.Collator('ar', { numeric: true });
const className = target => store.sectionLabel(store.getSection(target.sectionId));
const sortedTargets = id => store.previewScoreDistributionCopy(id).sort((a, b) => {
  const sa = store.getSection(a.sectionId), sb = store.getSection(b.sectionId);
  return Number(sa?.grade || 0) - Number(sb?.grade || 0)
    || collator.compare(sa?.label || sa?.name || '', sb?.label || sb?.name || '');
});
const total = items => items.reduce((sum, item) => sum + Number(item.max || 0), 0);

// Read-only Work presentation estimate. Not a Product plan/apply or scoring engine.
function impactPreview(sourceId, target) {
  const source = store.items(sourceId), items = store.items(target.teachingId);
  const used = new Set(), changes = []; let repeated = '';
  for (const item of source) {
    const origins = items.filter(t => t.distributionOriginId === item.id);
    const candidates = origins.length ? origins : items.filter(t => t.name.trim() === item.name.trim());
    if (candidates.length > 1 || (candidates[0] && used.has(candidates[0].id))) {
      repeated = item.name; break;
    }
    const match = candidates[0];
    if (!match) { changes.push({ text: `إضافة «${item.name}» دون نسخ درجات الطلاب.` }); continue; }
    used.add(match.id);
    if (scoreDefinitionSignature(item, store.scoreSubitemsOf(item.id)) === scoreDefinitionSignature(match, store.scoreSubitemsOf(match.id))) continue;
    const notes = [];
    if (item.max !== match.max) {
      notes.push(`الدرجة العظمى: ${fmtNum(match.max)} ← ${fmtNum(item.max)}.`);
      if (!item.auto && !match.auto && item.scoreMode !== 'subitems' && match.scoreMode !== 'subitems' && item.max < match.max) {
        const scores = store.state.scores.filter(s => !s.deleted && s.itemId === match.id && Number(s.value) > item.max);
        if (scores.length) notes.push(`ستنخفض الدرجات لدى ${fmtNum(new Set(scores.map(s => s.studentId)).size)} من الطلاب إلى الحد الجديد؛ مثال: ${fmtNum(scores[0].value)}/${fmtNum(match.max)} ← ${fmtNum(item.max)}/${fmtNum(item.max)}.`);
      }
    }
    if (!match.auto && item.auto) notes.push('سيصبح الرصد آليًا من سجل هذا الفصل؛ الدرجات اليدوية السابقة لن تحدد الدرجة المعروضة.');
    else if (match.auto && !item.auto) notes.push('سيصبح الرصد يدويًا؛ ستظهر الدرجات غير مرصودة حتى تسجلها.');
    else if (match.auto !== item.auto || item.perPoint !== match.perPoint || item.penalty !== match.penalty) notes.push('ستتغير طريقة احتساب الدرجة من سجل هذا الفصل.');
    const a = store.scoreSubitemsOf(item.id), b = store.scoreSubitemsOf(match.id);
    if (item.scoreMode !== match.scoreMode || JSON.stringify(a.map(s => [s.name,s.value,s.order])) !== JSON.stringify(b.map(s => [s.name,s.value,s.order]))) notes.push('ستتغير البنود الفرعية؛ تُراجع درجاتها المسجلة قبل التطبيق.');
    changes.push({ text: `«${item.name}»: ${notes.join(' ') || 'سيُحدّث ترتيب البند وإعداداته.'}` });
  }
  return { ...target, repeated, changes, extras: repeated ? [] : items.filter(t => !used.has(t.id)), oldMax: total(items), sourceMax: total(source) };
}

export function distributionPreview(el, event, params) {
  const id = params.id, source = store.getTeaching(id);
  const sourceLabel = store.sectionLabel(store.getSection(source.sectionId));
  const targets = sortedTargets(id), chosen = new Set(), removals = new Set();
  let reviewing = false;
  return openSheet({ title: 'نسخ توزيع الدرجات إلى فصول أخرى', desc: `توزيع ${sourceLabel} · ${fmtNum(store.items(id).length)} بنود`, body: '', foot: '',
    onMount(root) {
      root.classList.add('n73-copy-review');
      const body = root.querySelector('.sheet__body');
      let footer = root.querySelector('.sheet__foot');
      if (!footer) { footer = document.createElement('div'); footer.className = 'sheet__foot'; root.querySelector('.sheet').append(footer); }
      const draw = (expanded = false) => {
        const reviews = targets.filter(t => chosen.has(t.teachingId)).map(t => impactPreview(id, t));
        render(body, reviewing ? html`
          <div class="n73-brief">${reviews.map(t => html`<section data-n73-summary>
            <strong>سيُطبّق توزيع ${sourceLabel} على ${className(t)}</strong>
            ${t.repeated ? html`<p>يوجد أكثر من بند باسم «${t.repeated}» في ${className(t)}. غيّر اسم البند المكرر أو احذفه ثم أعد المحاولة.</p><a class="btn btn--ghost" data-sheet-close href="#/teaching/${t.teachingId}/items">فتح بنود ${className(t)}</a>` : html`
              <p>المجموع: ${fmtNum(t.oldMax)} ← ${fmtNum(t.sourceMax + total(t.extras.filter(i => !removals.has(i.id))))} درجة</p>
              ${t.extras.length ? html`<small>${fmtNum(t.extras.filter(i => !removals.has(i.id)).length)} ${t.extras.filter(i => !removals.has(i.id)).length === 1 ? 'بند إضافي واحد يبقى' : 'بنود إضافية تبقى'} مع درجاتها؛ راجعها في «عرض الأثر».</small>` : ''}`}
          </section>`)}</div>
          ${reviews.some(t => !t.repeated && (t.changes.length || t.extras.length)) ? html`<details class="n73-impact-details" ${expanded ? 'open' : ''}><summary>عرض الأثر</summary>
            ${reviews.filter(t => !t.repeated && (t.changes.length || t.extras.length)).map(t => html`<section class="n73-impact-class"><h3>${className(t)}</h3>
              ${t.changes.map(c => html`<p>${c.text}</p>`)}
              ${t.extras.map(item => html`<div class="n73-extra"><strong>${item.name} — غير موجود في ${sourceLabel}</strong>
                <p>${removals.has(item.id) ? 'سيُزال هذا البند ودرجاته المسجلة بعد التأكيد.' : 'سيبقى هذا البند ودرجاته كما هي؛ لذلك لن يكون التوزيع مطابقًا تمامًا.'}</p>
                <label><input type="checkbox" data-n73-remove value="${item.id}" ${removals.has(item.id) ? 'checked' : ''}> إزالة هذا البند</label>
              </div>`)}
            </section>`)}
          </details>` : ''}
          <p class="n73-preview-note">هذه معاينة فقط؛ التطبيق غير متاح حاليًا.</p>
        ` : html`<p class="n73-selection-intro">اختر الفصول التي تريد نسخ التوزيع إليها.</p>
          <div class="n73-choices">${targets.map(t => html`<label class="n73-choice"><input type="checkbox" data-n73-target value="${t.teachingId}" ${chosen.has(t.teachingId) ? 'checked' : ''}><span><strong>${className(t)}</strong><small>${store.getSubject(store.getTeaching(t.teachingId)?.subjectId)?.name || ''}</small></span></label>`)}</div>
        `);
        render(footer, html`<button type="button" class="btn btn--ghost" ${reviewing ? 'data-n73-back' : 'data-sheet-close'}>${reviewing ? 'رجوع' : 'إلغاء'}</button>
          ${reviewing ? html`<button type="button" class="btn btn--primary" data-n73-apply disabled>تطبيق التوزيع</button>` : html`<button type="button" class="btn btn--primary" data-n73-next ${chosen.size ? '' : 'disabled'}>مراجعة التطبيق</button>`}`);
      };
      root.addEventListener('change', event => {
        const input = event.target;
        if (input.hasAttribute('data-n73-target')) {
          input.checked ? chosen.add(input.value) : chosen.delete(input.value);
          footer.querySelector('[data-n73-next]').disabled = !chosen.size;
        } else if (input.hasAttribute('data-n73-remove')) {
          input.checked ? removals.add(input.value) : removals.delete(input.value);
          draw(true);
        }
      });
      root.addEventListener('click', event => {
        const button = event.target.closest('button'); if (!button) return;
        if (button.hasAttribute('data-n73-next') && !button.disabled) { reviewing = true; draw(); }
        if (button.hasAttribute('data-n73-back')) { reviewing = false; draw(); }
      });
      draw();
    },
  });
}
