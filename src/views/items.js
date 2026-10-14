/**
 * توزيع الدرجات: هنا يطابق المعلّم التطبيق مع نموذج الرصد في مدرسته.
 * القالب الافتراضي مجموعه ١٠٠، لكن لا شيء يفرضه — عدّله كما تشاء.
 */

import { html, icon, openSheet, confirmSheet, toast, render } from '../lib/dom.js';
import { visibleLatinDigits } from '../lib/visible-numerals.js';
import * as store from '../store.js';
import { makeItem, defaultItemsFor } from '../models.js';
import { getScoreFoundationCapability, getScoreDistributionCapability } from '../lib/cloud.js';
import { distributeAutomatically, scoreCents, normalizeSubitemDatesAndPoints } from '../lib/score-foundation.js';
import { repaint } from '../repaint.js';
import { defaultSubitemName } from '../lib/subitem-default-name.js';
import '../lib/rakeez-datetime.js';

let foundationAvailable = false;
let foundationChecking = false;
let distributionAvailable = false;
let preservationAvailable = false;
const isDemo = () => store.getActiveWorkspace()?.type === 'demo';
const supportsFoundation = () => isDemo() || foundationAvailable;

async function requireFoundation() {
  if (supportsFoundation()) return true;
  toast('العناصر الفرعية ونسخ التوزيع غير متاحين حتى يكتمل تحديث الخادم. الرصد المباشر متاح.', 'warn');
  return false;
}

function subitemEditor(item) {
  const original = store.scoreSubitemsOf(item.id);
  const rows = original.length ? original.map((row) => ({ ...row })) : [{ name: defaultSubitemName(item.name), value: item.max }];
  let distributionMode = item.distributionMode ?? 'auto';
  const rowMarkup = (row, index) => html`<div class="subitem-editor-row" data-subitem-row data-id="${row.id ?? ''}">
    <button class="drag-handle" type="button" data-move-up aria-label="رفع ${row.name}" ${index === 0 ? 'disabled' : ''}>⋮⋮</button>
    <label class="field"><span>اسم العنصر</span><input data-subitem-name maxlength="50" value="${row.name}" required></label>
    <label class="field subitem-points"><span>الدرجة</span><input data-subitem-value type="number" inputmode="decimal" min="0" step="0.01" value="${visibleLatinDigits(row.value)}" ${distributionMode === 'auto' ? 'readonly' : ''}></label>
    <div class="n94-definition-details">
      <label class="field"><span>البداية (اختياري)</span><input data-subitem-start type="text" data-rakeez-datetime="date" data-rakeez-date-scope="planning" value="${row.startDate ?? ''}" aria-label="بداية ${row.name}"></label>
      <label class="field"><span>التسليم (اختياري)</span><input data-subitem-due type="text" data-rakeez-datetime="date" data-rakeez-date-scope="planning" value="${row.dueDate ?? ''}" aria-label="تسليم ${row.name}"></label>
      <label class="field"><span>درجة التأخر (اختياري)</span><input data-subitem-late type="number" inputmode="decimal" min="0" max="${row.value}" step="0.01" value="${row.latePoints == null ? '' : visibleLatinDigits(row.latePoints)}" placeholder="${visibleLatinDigits(row.value)}" aria-label="درجة تأخر ${row.name}"></label>
      <small>بداية فارغة: يبدأ مباشرة · درجة تأخر فارغة: الدرجة العادية${Number.isFinite(row.createdAt) ? ` · أنشئ ${new Date(row.createdAt).toLocaleDateString('ar-SA')}` : ''}</small>
    </div>
    <button class="iconbtn" type="button" data-subitem-remove aria-label="حذف ${row.name}" ${rows.length === 1 ? 'disabled' : ''}>${icon('x')}</button>
  </div>`;
  return openSheet({
    title: 'العناصر الفرعية',
    desc: `${item.name} · ${visibleLatinDigits(item.max)} درجات`,
    body: html`<div class="score-01c-editor">
      <div class="segmented subitem-mode" role="group" aria-label="طريقة توزيع درجات العناصر">
        <button type="button" class="segmented__btn" data-distribution="auto">توزيع تلقائي</button>
        <button type="button" class="segmented__btn" data-distribution="manual">توزيع يدوي</button>
      </div>
      <p class="mode-explainer" data-mode-explainer></p>
      <div class="subitem-editor-list" data-subitem-list></div>
      <div class="subitem-editor-actions"><button class="btn btn--ghost" type="button" data-subitem-add>${icon('plus')} إضافة عنصر فرعي</button>
        <button class="btn btn--ghost" type="button" data-direct-mode>استخدام درجة مباشرة</button></div>
      <div class="subitem-total" role="status"><span>مجموع العناصر</span><strong data-subitem-total></strong><small data-subitem-warning></small></div>
    </div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" type="button" data-save-subitems>حفظ العناصر</button>`,
    onMount(root, done) {
      const list = root.querySelector('[data-subitem-list]');
      const read = () => {
        list.querySelectorAll('[data-subitem-row]').forEach((element, index) => {
          rows[index].name = element.querySelector('[data-subitem-name]').value.trim();
          rows[index].value = Number(element.querySelector('[data-subitem-value]').value);
          rows[index].startDate = element.querySelector('[data-subitem-start]').value || null;
          rows[index].dueDate = element.querySelector('[data-subitem-due]').value || null;
          const lateInput = element.querySelector('[data-subitem-late]').value;
          rows[index].latePoints = lateInput === '' ? null : Number(lateInput);
        });
      };
      const draw = () => {
        if (distributionMode === 'auto') {
          const values = distributeAutomatically(item.max, rows.length);
          rows.forEach((row, index) => { row.value = values[index]; });
        }
        render(list, html`${rows.map(rowMarkup)}`);
        root.querySelectorAll('[data-distribution]').forEach((button) => {
          const active = button.dataset.distribution === distributionMode;
          button.classList.toggle('is-on', active);
          button.setAttribute('aria-pressed', String(active));
        });
        root.querySelector('[data-mode-explainer]').textContent = distributionMode === 'auto'
          ? 'يوزّع ركيز الدرجة العظمى بالتساوي، ويضع فرق التقريب في العنصر الأخير.'
          : 'حدّد درجة كل عنصر، وسيظهر أي فرق عن الدرجة العظمى.';
        const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
        root.querySelector('[data-subitem-total]').textContent = visibleLatinDigits(`${total.toFixed(2)} / ${item.max}`);
        root.querySelector('.subitem-total').classList.toggle('is-warning', distributionMode === 'manual' && Math.abs(total - item.max) > 0.001);
        root.querySelector('[data-subitem-warning]').textContent = distributionMode === 'manual' && Math.abs(total - item.max) > 0.001
          ? 'مجموع العناصر لا يطابق الدرجة العظمى.' : '';
      };
      root.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.distribution) { read(); distributionMode = button.dataset.distribution; draw(); }
        else if (button.hasAttribute('data-subitem-add')) { read(); rows.push({ name: defaultSubitemName(item.name, rows), value: 0 }); draw(); }
        else if (button.hasAttribute('data-subitem-remove')) {
          read(); if (rows.length > 1) rows.splice([...list.children].indexOf(button.closest('[data-subitem-row]')), 1); draw();
        } else if (button.hasAttribute('data-move-up')) {
          read(); const index = [...list.children].indexOf(button.closest('[data-subitem-row]'));
          if (index > 0) [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
          draw();
        } else if (button.hasAttribute('data-direct-mode')) done({ scoreMode: 'direct', subitems: [] });
        else if (button.hasAttribute('data-save-subitems')) {
          if ([...list.querySelectorAll('input')].some((input) => !input.checkValidity())) {
            toast('استخدم درجة موجبة بدقة منزلتين', 'danger'); return;
          }
          read();
          if (rows.some((row) => !row.name || !Number.isFinite(row.value))) { toast('أكمل أسماء العناصر ودرجاتها', 'danger'); return; }
          try { rows.forEach((row) => scoreCents(row.value)); } catch { toast('استخدم درجة موجبة بدقة منزلتين', 'danger'); return; }
          try { rows.forEach((row) => normalizeSubitemDatesAndPoints(row)); }
          catch (error) { toast(error.message, 'danger'); return; }
          done({ scoreMode: 'subitems', distributionMode, subitems: rows });
        }
      });
      list.addEventListener('input', () => { if (distributionMode === 'manual') { read();
        const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
        root.querySelector('[data-subitem-total]').textContent = visibleLatinDigits(`${total.toFixed(2)} / ${item.max}`);
        root.querySelector('.subitem-total').classList.toggle('is-warning', Math.abs(total - item.max) > 0.001);
      } });
      draw();
    },
  });
}

const AUTO_OPTIONS = [
  { v: '',              label: 'إدخال يدوي',  hint: 'تكتب الدرجة بنفسك لكل طالب.' },
  { v: 'participation', label: 'من الرصد السريع', hint: 'كل نقطة مشاركة تساوي عددًا من الدرجات.' },
  { v: 'attendance',    label: 'من الحضور',   hint: 'تبدأ الدرجة كاملة ويُخصم عن كل غياب.' },
];

function itemSheet(classId, existing = null) {
  const it = existing ?? { name: '', max: 10, auto: null, perPoint: 1, penalty: 1 };

  return openSheet({
    title: existing ? 'تعديل البند' : 'بند جديد',
    body: html`
      <form id="item-form">
        <label class="field">
          <span class="field__label">اسم البند</span>
          <input class="input" name="name" value="${it.name}" required maxlength="50"
                 autocomplete="off" placeholder="مثال: الاختبارات القصيرة">
        </label>

        <label class="field">
          <span class="field__label">الدرجة العظمى</span>
          <input class="input tabular" name="max" type="number" inputmode="decimal"
                 min="1" max="1000" step="0.5" value="${it.max}" ${it.scoreMode === 'subitems' ? 'readonly' : ''} required>
        </label>

        <div class="field">
          <span class="field__label">طريقة الرصد</span>
          <div class="stack stack-2">
            ${AUTO_OPTIONS.map(
              (o) => html`
                <label class="radiocard">
                  <input type="radio" name="auto" value="${o.v}" ${(it.auto ?? '') === o.v ? 'checked' : ''}>
                  <span class="radiocard__body">
                    <span class="radiocard__title">${o.label}</span>
                    <span class="radiocard__hint">${o.hint}</span>
                  </span>
                </label>
              `
            )}
          </div>
        </div>

        <label class="field" data-when="participation">
          <span class="field__label">درجة لكل نقطة مشاركة</span>
          <input class="input tabular" name="perPoint" type="number" inputmode="decimal"
                 min="0.1" max="100" step="0.1" value="${it.perPoint ?? 1}">
          <span class="field__hint">مثال: 1 يعني أن 5 نقاط مشاركة = 5 درجات، بحدّ أقصى الدرجة العظمى.</span>
        </label>

        <label class="field" data-when="attendance">
          <span class="field__label">الخصم عن كل غياب</span>
          <input class="input tabular" name="penalty" type="number" inputmode="decimal"
                 min="0.1" max="100" step="0.1" value="${it.penalty ?? 1}">
          <span class="field__hint">الغياب المستأذن لا يُخصم عنه.</span>
        </label>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="item-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      const form = root.querySelector('#item-form');

      const sync = () => {
        const val = form.querySelector('input[name="auto"]:checked')?.value ?? '';
        form.querySelectorAll('[data-when]').forEach((el) => {
          el.classList.toggle('hidden', el.dataset.when !== val);
        });
      };
      form.addEventListener('change', sync);
      sync();

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        const max = Number(fd.get('max'));
        if (!name || !(max > 0)) return;
        const auto = String(fd.get('auto') ?? '') || null;
        done({
          name,
          max,
          auto,
          perPoint: Number(fd.get('perPoint')) || 1,
          penalty: Number(fd.get('penalty')) || 1,
        });
      });
    },
  });
}

async function legacyCopy(el, ev, params) {
      if (!await requireFoundation()) return;
      const preview = store.previewLegacyScoreDistributionCopy(params.id);
      if (!preview.length) { toast('لا توجد فصول مطابقة', 'warn'); return; }
      const source = store.getTeaching(params.id);
      const sourceSection = store.getSection(source.sectionId);
      const selected = await openSheet({
        title: 'تطبيق التوزيع على فصول المادة',
        desc: 'عملية نسخ واحدة؛ تبقى الفصول مستقلة بعد التطبيق.',
        body: html`<div class="copy-summary"><div><span>المصدر</span><strong>${store.sectionLabel(sourceSection)}</strong>
          <small>${source.name}</small></div><div><span>التوزيع</span><strong>${store.items(params.id).length} بنود</strong>
          <small>تُنسخ البنود والعناصر الفرعية فقط، دون درجات الطلاب.</small></div></div>
          <fieldset class="target-list"><legend>الفصول المطابقة والمتاحة</legend>${preview.map((target) => html`
            <label class="target-class"><input type="checkbox" data-copy-target value="${target.teachingId}" checked>
              <span><strong>${store.sectionLabel(store.getSection(target.sectionId))}</strong><small>${source.name}</small></span></label>`)}</fieldset>
          <aside class="review-callout"><strong>لن يتم تغيير درجات الطلاب الموجودة.</strong>
            <p>لا تُنسخ درجات الطلاب أو اختيارات العناصر أو الإضافات اليدوية أو سجل أي طالب.</p></aside>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button>
          <button class="btn btn--primary" type="button" data-copy-next>مراجعة التطبيق</button>`,
        onMount(root, done) {
          const next = root.querySelector('[data-copy-next]');
          const update = () => { next.disabled = !root.querySelector('[data-copy-target]:checked'); };
          root.addEventListener('change', update);
          next.addEventListener('click', () => done([...root.querySelectorAll('[data-copy-target]:checked')]
            .map((input) => input.value)));
          update();
        },
      });
      if (!selected?.length) return;
      const selectedSet = new Set(selected);
      const review = preview.filter((target) => selectedSet.has(target.teachingId));
      const choices = await openSheet({
        title: 'مراجعة بنود الفصول المحددة',
        desc: 'لا حذف ولا استبدال للدرجات أو البنود الحالية.',
        body: html`<div class="conflict-list">${review.map((target) => html`<section class="target-review">
          <h3>${store.sectionLabel(store.getSection(target.sectionId))}</h3>
          ${target.items.map((item) => html`<div class="target-review__item">
            <p><span class="review-status review-status--${item.kind === 'MISSING' ? 'add' : item.kind === 'EQUIVALENT' ? 'keep' : 'conflict'}">
              ${item.kind === 'MISSING' ? 'سيتم إضافته' : item.kind === 'EQUIVALENT' ? 'موجود مسبقًا' : 'يوجد بند مختلف'}</span>
              ${store.state.items.find((row) => row.id === item.sourceItemId)?.name ?? ''}</p>
            ${item.kind === 'CONFLICTING' ? html`<fieldset class="safe-choices"><legend>معالجة هذا البند</legend>
              <label><input type="radio" name="choice-${target.teachingId}-${item.sourceItemId}" value="keep" checked> الاحتفاظ بالبند الحالي</label>
              <label><input type="radio" name="choice-${target.teachingId}-${item.sourceItemId}" value="add"> إضافة البند الجديد بشكل مستقل</label>
            </fieldset>` : ''}</div>`)}</section>`)}</div>
          <aside class="review-callout"><strong>كل فصل يبقى مستقلًا بعد النسخ.</strong>
            <p>أي تعديل لاحق على المصدر لن ينتقل تلقائيًا إلى هذه الفصول.</p></aside>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button>
          <button class="btn btn--primary" type="button" data-copy-apply>تطبيق التوزيع</button>`,
        onMount(root, done) {
          root.querySelector('[data-copy-apply]').addEventListener('click', () => {
            const result = {};
            for (const target of review) for (const item of target.items) {
              if (item.kind !== 'CONFLICTING') continue;
              const choice = root.querySelector(`input[name="choice-${CSS.escape(target.teachingId)}-${CSS.escape(item.sourceItemId)}"]:checked`);
              if (!choice) return;
              result[`${target.teachingId}:${item.sourceItemId}`] = choice.value;
            }
            done(result);
          });
        },
      });
      if (!choices) return;
      try {
        const result = await store.applyScoreDistributionCopy(params.id, selected, choices);
        toast(isDemo() ? `طُبّق التوزيع على ${selected.length} فصول محددة` :
          `أُعدّ النسخ إلى ${selected.length} فصول محددة للمزامنة (${result.itemIds.length} بنود)`);
        repaint();
      } catch (error) { toast(error.message || 'تعذر نسخ التوزيع؛ لم تُطبّق تغييرات', 'danger'); }
    }

export default {
  title: () => 'توزيع الدرجات',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="iconbtn" data-act="add" aria-label="بند جديد">${icon('plus')}</button>
  `,

  onMount() {
    foundationAvailable = false;
    distributionAvailable = false;
    preservationAvailable = false;
    foundationChecking = !isDemo();
    if (isDemo()) return;
    Promise.all([getScoreFoundationCapability(), getScoreDistributionCapability().catch(() => null)]).then(([capability, distribution]) => {
      distributionAvailable = distribution?.distributionApplyVersion === 2 && distribution?.protocol === 'N73_D119_V2';
      preservationAvailable = distributionAvailable && distribution?.automaticSafeCopyVersion === 1;
      foundationAvailable = capability?.scoreDomainVersion === 1 &&
        capability?.restoreProtocol === 'CORE_V2' && capability?.backupVersion === 5 &&
        capability?.copyDomainVersion === 1;
    }).catch(() => { foundationAvailable = false; }).finally(() => {
      foundationChecking = false;
      repaint();
    });
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(cls)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">بنود الدرجات محفوظة ولا يمكن تعديلها.</div></div>`;

    const items = store.items(cls.id);
    const total = items.reduce((n, i) => n + i.max, 0);

    if (!items.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">لا بنود بعد</div>
          <div class="empty__text">ابدأ بالقالب الجاهز (مجموعه 100) ثم عدّله، أو أنشئ بنودك من الصفر.</div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn--primary" data-act="template">${icon('note')} القالب الجاهز</button>
            <button class="btn btn--ghost" data-act="add">${icon('plus')} بند جديد</button>
          </div>
        </div>
      `;
    }

    const section = store.getSection(cls.sectionId);
    const targets = store.previewScoreDistributionCopy(cls.id);
    return html`<div class="classroom-tool-page grade-distribution-page distribution-01c">
      <section class="distribution-hero"><div><span class="eyebrow">${store.sectionLabel(section)} · ${cls.name}</span>
        <h1>توزيع الدرجات</h1><p>${items.length} بنود · المجموع ${total} درجة</p></div>
        <button class="btn btn--ghost" data-act="copy" ${!targets.length || !supportsFoundation() ? 'disabled' : ''}>
          ${icon('classes')} نسخ توزيع الدرجات إلى فصول أخرى</button></section>
      ${foundationChecking ? html`<p class="score-01c-capability" role="status">جارٍ التحقق من توفر مزامنة التوزيع…</p>` :
        !supportsFoundation() ? html`<p class="score-01c-capability" role="status">الدرجة المباشرة متاحة. العناصر الفرعية ونسخ التوزيع ينتظران تحديث الخادم.</p>` : ''}
      <section class="distribution-panel"><header class="distribution-head"><div><h2>بنود التقييم</h2>
        <p>الدرجة المباشرة تبقى بسيطة، ويمكن تفعيل العناصر الفرعية لأي بند.</p></div>
        <button class="btn btn--primary" data-act="add">${icon('plus')} إضافة بند</button></header>
        <div class="distribution-list">${items.map((i, idx) => html`<article class="distribution-item">
          <span class="distribution-order">${idx + 1}</span>
          <span class="distribution-name"><strong>${i.name}</strong><small>${i.max} درجات</small></span>
          <span class="mode-badge ${i.scoreMode === 'subitems' ? 'mode-badge--sub' : i.auto ? 'mode-badge--auto' : 'mode-badge--direct'}">
            ${i.scoreMode === 'subitems' ? 'عناصر فرعية' : i.auto ? 'رصد آلي' : 'درجة مباشرة'}</span>
          <span class="distribution-actions"><button class="btn btn--ghost" data-act="edit" data-id="${i.id}">
            ${icon('edit')} تحرير</button>
            ${supportsFoundation() ? html`<button class="btn btn--ghost" data-act="configure" data-id="${i.id}">البنود الفرعية</button>` : ''}
            <button class="iconbtn" data-act="up" data-id="${i.id}" ${idx === 0 ? 'disabled' : ''} aria-label="رفع ${i.name}">${icon('upload')}</button>
          </span></article>`)}</div></section>
      <aside class="copy-note">${icon('check')}<p><strong>النسخ إلى الفصول الأخرى عملية واحدة مستقلة.</strong>
        <span>ينسخ بنية البنود وإعداداتها فقط، ولا ينسخ درجات الطلاب أو حالاتهم.</span></p></aside>
    </div>`;
  },

  actions: {
    async configure(el) {
      if (!await requireFoundation()) return;
      const item = store.state.items.find((row) => row.id === el.dataset.id && !row.deleted);
      if (!item) return;
      const proposed = await subitemEditor(item);
      if (!proposed) return;
      proposed.max = item.max;
      let preview;
      try { preview = store.previewScoreConfiguration(item.id, proposed); }
      catch (error) { toast(error.message, 'danger'); return; }
      const conversion = item.scoreMode === 'direct' && proposed.scoreMode === 'subitems' &&
        store.state.scores.some((row) => row.itemId === item.id && row.value !== null && !row.deleted);
      const approved = await confirmSheet({
        title: 'مراجعة تغيير توزيع الدرجات',
        desc: `قد تتغير درجات ${preview.affectedStudentCount} طالبًا. ${preview.usedDeletedSubitems.length ? `ستُحذف ${preview.usedDeletedSubitems.length} عناصر مستخدمة. ` : ''}${conversion ? 'الدرجات المباشرة الحالية ستبقى كإضافة يدوية، ولن تضيع. ' : ''}راجِع النتيجة قبل التأكيد.`,
        confirmLabel: 'تأكيد التغيير',
      });
      if (!approved) return;
      try {
        await store.applyConfirmedScoreConfiguration(item.id, proposed, {
          expectedVersion: preview.expectedVersion, confirmed: true,
          ...(conversion ? { conversionStrategy: 'retain-as-manual' } : {}),
        });
        toast('حُفظ توزيع العناصر');
        repaint();
      } catch (error) { toast(error.message || 'تعذر حفظ التوزيع', 'danger'); }
    },

    async copy(el, ev, params) {
      if (!isDemo() && !preservationAvailable) { toast('النسخ الآمن التلقائي يحتاج إلى تحديث الخادم.', 'warn'); return; }
      if (!supportsFoundation()) { toast('متاح في التجربة حتى اكتمال المزامنة الآمنة.', 'warn'); return; }
      const targets = store.previewScoreDistributionCopy(params.id);
      const source = store.getTeaching(params.id);
      if (!targets.length) { toast('لا توجد فصول مطابقة', 'warn'); return; }
      const selection = await openSheet({
        title: 'نسخ توزيع الدرجات إلى فصول أخرى',
        desc: 'سجلات الفصول المستهدفة محفوظة، ولا تُنسخ درجات طلاب الفصل المصدر.',
        body: html`<fieldset class="target-list"><legend>الفصول المستهدفة</legend>${targets.map(target => html`
          <label class="target-class"><input type="checkbox" data-copy-target value="${target.teachingId}">
            <span>${store.sectionLabel(store.getSection(target.sectionId))}</span></label>`)}</fieldset>
          <div data-copy-review aria-live="polite"></div>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button>
          <button class="btn btn--primary" data-copy-apply disabled>تطبيق التوزيع</button>`,
        onMount(root, done) {
          let plan = null;
          let selected = [];
          const mode = 'automatic-safe';
          let requestVersion = 0;
          const apply = root.querySelector('[data-copy-apply]');
          const review = root.querySelector('[data-copy-review]');
          const refresh = async () => {
            const version = ++requestVersion;
            selected = [...root.querySelectorAll('[data-copy-target]:checked')].map(input => input.value);
            const requested = [...selected];
            const requestedMode = mode;
            plan = null; apply.disabled = true;
            if (!selected.length) { render(review, ''); return; }
            try {
              const incoming = await store.reviewScoreDistributionCopy(params.id, requested, { mode: requestedMode });
              if (version !== requestVersion || !root.isConnected) return;
              plan = incoming;
              const unchangedCount = plan.targets.reduce((count, target) => count + target.impact.filter(item => item.unchanged).length, 0);
              const protectedCount = plan.targets.reduce((count, target) => count + target.impact.filter(item => item.retained).length, 0);
              render(review, html`<p>مراجعة النسخ من ${store.sectionLabel(store.getSection(source.sectionId))}
                إلى ${selected.length} فصول مستهدفة. ${plan.changedCount} تغييرات آمنة؛ تبقى الفصول مستقلة ولا تُنسخ درجات المصدر.</p>
                ${unchangedCount ? html`<p>${unchangedCount} بنود مطابقة مخفية من التفاصيل.</p>` : ''}
                ${protectedCount ? html`<p role="status">${protectedCount} بنود محمية أو متعارضة ستبقى كما هي؛ تفاصيلها متاحة لكل فصل.</p>` : ''}
                ${(plan.excludedTargets ?? []).map(target => html`<p role="alert">${target.reason}
                  <a href="#/teaching/${target.teachingId}/items">فتح توزيع الفصل المستهدف</a> · لن يُطبّق عليه التوزيع.</p>`)}
                ${plan.targets.some(target => target.extras.length) ? html`<p>تبقى البنود الإضافية ودرجاتها كما هي.</p>` : ''}
                <div class="copy-impact">
                  ${plan.targets.map(target => {
                    const label = store.sectionLabel(store.getSection(store.getTeaching(target.teachingId).sectionId));
                    const changed = target.impact.filter(item => !item.unchanged);
                    const warnings = changed.filter(item => item.retained || (item.beforeMax != null && Number(item.beforeMax) !== Number(item.max)) ||
                      (item.subitems ?? []).some(sub => {
                        const prior = sub.targetId && store.state.scoreSubitems.find(row => row.id === sub.targetId && !row.deleted);
                        return sub.clearsStartDate || sub.clearsDueDate || (!!prior?.startDate && !sub.startDate) || (!!prior?.dueDate && !sub.dueDate);
                      }));
                    return html`<details class="target-review"><summary>${label} · ${changed.length} تغييرات${warnings.length ? ` · ${warnings.length} تنبيهات` : ''}</summary>
                      ${changed.map(item => html`<p>${item.name}: ${item.retained ? html`بقي كما هو — ${item.reason}` : item.created ? 'إضافة بند دون درجات الطلاب' : 'تحديث التعريف والأسماء والتواريخ؛ تبقى سجلاته محفوظة'}.
                        ${item.beforeMax != null && Number(item.beforeMax) !== Number(item.max) ? html`<strong>الحد الأعلى ${item.beforeMax} ← ${item.max}.</strong>` : ''}
                        ${(item.subitems ?? []).map(sub => {
                          const prior = sub.targetId && store.state.scoreSubitems.find(row => row.id === sub.targetId && !row.deleted);
                          const clearsStartDate = !!prior?.startDate && !sub.startDate;
                          const clearsDueDate = !!prior?.dueDate && !sub.dueDate;
                          return html`<span class="target-review__subitem">${sub.name}${sub.startDate || sub.dueDate ? html` · البداية <bdi dir="ltr">${sub.startDate ?? 'غير محددة'}</bdi> · الاستحقاق <bdi dir="ltr">${sub.dueDate ?? 'غير محدد'}</bdi>` : ''}${clearsStartDate || clearsDueDate ? html` · <strong>سيُمسح تاريخ ${clearsStartDate && clearsDueDate ? 'البداية والاستحقاق' : clearsStartDate ? 'البداية' : 'الاستحقاق'}.</strong>` : ''}</span>`;
                        })}</p>`)}
                    </details>`;
                  })}
                </div>`);
              apply.disabled = !plan.targets.length || !plan.changedCount;
            } catch (error) {
              if (version !== requestVersion || !root.isConnected) return;
              render(review, html`<p role="alert">${error.message}</p>
                ${selected.map(id => html`<a href="#/teaching/${id}/items">فتح توزيع ${store.sectionLabel(store.getSection(store.getTeaching(id).sectionId))}</a>`)}`);
            }
          };
          root.addEventListener('change', event => { if (event.target.matches('[data-copy-target]')) refresh(); });
          apply.addEventListener('click', () => {
            if (!plan) return;
            done({ selected, token: plan.token, mode,
              removeItemIds: [...root.querySelectorAll('[data-copy-remove]:checked')].map(input => input.value) });
          });
        },
      });
      if (!selection) return;
      try {
        const review = await store.reviewScoreDistributionCopy(params.id, selection.selected, { removeItemIds: selection.removeItemIds, mode: selection.mode });
        if (review.token !== selection.token) throw new Error('تغيّر التوزيع منذ المراجعة. افتح المراجعة من جديد.');
        if (!await confirmSheet({
          title: 'تأكيد أثر التوزيع',
          desc: 'تُطبّق التحديثات والإضافات المعروضة فقط. تبقى البنود المحمية وسجلاتها كما هي، ولا تُنسخ درجات المصدر.',
          confirmLabel: 'تأكيد التطبيق',
        })) return;
        const result = await store.applyReviewedScoreDistribution(params.id, selection.selected, {
          expectedToken: selection.token, removeItemIds: selection.removeItemIds, confirmed: true, mode: selection.mode,
        });
        toast(result.changedCount ? `طُبّقت التحديثات والإضافات (${result.changedCount} بنود)` : 'لا توجد تحديثات آمنة؛ بقي التوزيع كما هو');
        repaint();
      } catch (error) { toast(error.message || 'تعذر تطبيق التوزيع؛ لم تُحفظ تغييرات', 'danger'); }
    },

    async add(el, ev, params) {
      const data = await itemSheet(params.id);
      if (!data) return;
      const order = store.items(params.id).length;
      await store.upsert('items', makeItem({ teachingId: params.id, order, ...data }));
      toast('أُضيف البند');
    },

    async template(el, ev, params) {
      const ok = await store.save({ items: defaultItemsFor(params.id) });
      if (ok) toast('تم تطبيق القالب');
    },

    async edit(el, ev, params) {
      const it = store.state.items.find((i) => i.id === el.dataset.id);
      if (!it) return;

      const data = await openSheet({
        title: 'تعديل البند',
        desc: `أي درجات مرصودة في «${it.name}» تبقى كما هي.`,
        body: html`
          <form id="edit-item">
            <label class="field">
              <span class="field__label">اسم البند</span>
              <input class="input" name="name" value="${it.name}" required maxlength="50" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">الدرجة العظمى</span>
              <input class="input tabular" name="max" type="number" inputmode="decimal"
                     min="1" max="1000" step="0.5" value="${it.max}" ${it.scoreMode === 'subitems' ? 'readonly' : ''} required>
            </label>
            ${it.auto === 'participation'
              ? html`<label class="field">
                  <span class="field__label">درجة لكل نقطة مشاركة</span>
                  <input class="input tabular" name="perPoint" type="number" step="0.1" min="0.1"
                         value="${it.perPoint ?? 1}">
                </label>`
              : ''}
            ${it.auto === 'attendance'
              ? html`<label class="field">
                  <span class="field__label">الخصم عن كل غياب</span>
                  <input class="input tabular" name="penalty" type="number" step="0.1" min="0.1"
                         value="${it.penalty ?? 1}">
                </label>`
              : ''}
          </form>
        `,
        foot: html`
          <button class="btn btn--danger" id="del-item">${icon('trash')} حذف</button>
          <button class="btn btn--primary" form="edit-item" type="submit">حفظ</button>
        `,
        onMount: (root, done) => {
          root.querySelector('#edit-item').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const name = String(fd.get('name') ?? '').trim();
            const max = Number(fd.get('max'));
            if (!name || !(max > 0)) return;
            const patch = it.scoreMode === 'subitems' || max === it.max ? { name } : { name, max };
            if (fd.has('perPoint')) patch.perPoint = Number(fd.get('perPoint')) || 1;
            if (fd.has('penalty')) patch.penalty = Number(fd.get('penalty')) || 1;
            done(patch);
          });
          root.querySelector('#del-item').addEventListener('click', () => done({ __delete: true }));
        },
      });

      if (!data) return;

      if (data.__delete) {
        const ok = await confirmSheet({
          title: `حذف بند «${it.name}»؟`,
          desc: 'تُحذف معه كل الدرجات المرصودة فيه.',
          confirmLabel: 'احذف',
          danger: true,
        });
        if (!ok) return;

        await store.deleteItem(it.id);
        toast('حُذف البند');
        return;
      }

      if (Object.keys(data).length === 1 && data.name && (isDemo() || distributionAvailable)) {
        if (await store.renameScoreParent(it.id, data.name)) toast('حُفظ');
      } else if (await store.patch('items', it.id, data)) toast('حُفظ');
    },

    async up(el, ev, params) {
      const items = store.items(params.id);
      const idx = items.findIndex((i) => i.id === el.dataset.id);
      if (idx <= 0) return;
      await store.reorderItems([
        { id: items[idx].id, order: idx - 1 },
        { id: items[idx - 1].id, order: idx },
      ]);
    },
  },
};
