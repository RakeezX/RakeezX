/**
 * بنود التقييم: هنا يطابق المعلّم التطبيق مع نموذج الرصد في مدرسته.
 * القالب الافتراضي مجموعه ١٠٠، لكن لا شيء يفرضه — عدّله كما تشاء.
 */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { makeItem, defaultItemsFor } from '../models.js';

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
                 min="1" max="1000" step="0.5" value="${it.max}" required>
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
                 min="0.1" max="100" step="0.5" value="${it.perPoint ?? 1}">
          <span class="field__hint">مثال: ١ يعني أن ٥ نقاط مشاركة = ٥ درجات، بحدّ أقصى الدرجة العظمى.</span>
        </label>

        <label class="field" data-when="attendance">
          <span class="field__label">الخصم عن كل غياب</span>
          <input class="input tabular" name="penalty" type="number" inputmode="decimal"
                 min="0.1" max="100" step="0.5" value="${it.penalty ?? 1}">
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

export default {
  title: () => 'بنود التقييم',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="iconbtn" data-act="add" aria-label="بند جديد">${icon('plus')}</button>
  `,

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const items = store.items(cls.id);
    const total = items.reduce((n, i) => n + i.max, 0);

    if (!items.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('note')}</div>
          <div class="empty__title">لا بنود بعد</div>
          <div class="empty__text">ابدأ بالقالب الجاهز (مجموعه ١٠٠) ثم عدّله، أو أنشئ بنودك من الصفر.</div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn--primary" data-act="template">${icon('note')} القالب الجاهز</button>
            <button class="btn btn--ghost" data-act="add">${icon('plus')} بند جديد</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="card card--pad mb-3">
        <div class="hstack gap-3">
          <div>
            <div class="fw-7">مجموع الدرجات</div>
            <div class="t-3 fs-sm">
              ${total === 100
                ? 'مطابق للتوزيع المعتاد.'
                : 'المجموع ليس ١٠٠ — تأكد أنه يوافق نموذج مدرستك.'}
            </div>
          </div>
          <div class="push stat__val tabular" style="${total === 100 ? 'color:var(--ok)' : ''}">${total}</div>
        </div>
      </div>

      <div class="list">
        ${items.map(
          (i, idx) => html`
            <div class="row">
              <span class="row__main">
                <span class="row__title">${i.name}</span>
                <span class="row__sub">
                  <span class="tabular">${i.max}</span> درجة
                  ${i.auto === 'participation'
                    ? html` · آلي من الرصد (<span class="tabular">${i.perPoint}</span> لكل نقطة)`
                    : i.auto === 'attendance'
                      ? html` · آلي من الحضور (خصم <span class="tabular">${i.penalty}</span>)`
                      : ''}
                </span>
              </span>
              <span class="row__end">
                ${i.auto ? html`<span class="badge badge--brand">آلي</span>` : ''}
                <button class="iconbtn" data-act="up" data-id="${i.id}" ${idx === 0 ? 'disabled' : ''}
                        aria-label="رفع">${icon('upload')}</button>
                <button class="iconbtn" data-act="edit" data-id="${i.id}" aria-label="تعديل">${icon('edit')}</button>
              </span>
            </div>
          `
        )}
      </div>

      <button class="btn btn--ghost btn--block mt-4" data-act="add">${icon('plus')} بند جديد</button>
    `;
  },

  actions: {
    async add(el, ev, params) {
      const data = await itemSheet(params.id);
      if (!data) return;
      const order = store.items(params.id).length;
      await store.upsert('items', makeItem({ teachingId: params.id, order, ...data }));
      toast('أُضيف البند');
    },

    async template(el, ev, params) {
      await store.save({ items: defaultItemsFor(params.id) });
      toast('أُضيف القالب الجاهز');
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
                     min="1" max="1000" step="0.5" value="${it.max}" required>
            </label>
            ${it.auto === 'participation'
              ? html`<label class="field">
                  <span class="field__label">درجة لكل نقطة مشاركة</span>
                  <input class="input tabular" name="perPoint" type="number" step="0.5" min="0.1"
                         value="${it.perPoint ?? 1}">
                </label>`
              : ''}
            ${it.auto === 'attendance'
              ? html`<label class="field">
                  <span class="field__label">الخصم عن كل غياب</span>
                  <input class="input tabular" name="penalty" type="number" step="0.5" min="0.1"
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
            const patch = { name, max };
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

      if (await store.patch('items', it.id, data)) toast('حُفظ');
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
