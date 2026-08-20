/**
 * التقويم الدراسي.
 *
 * النموذج جاهز لاستيراد تقويم وزارة التعليم لاحقًا؛ والإدخال اليوم يدوي.
 * القاعدة المطبَّقة فعلًا: إذا وافق يومٌ غيرُ دراسي حصةً، تُنشأ الحصة بحالة
 * «إجازة رسمية» فلا تُحسب حصة فائتة ولا تُسجَّل غيابًا على الطلاب.
 */

import { html, icon, openSheet, toast, confirmSheet, fmtDate } from '../lib/dom.js';
import * as store from '../store.js';
import { CALENDAR_KIND, CALENDAR_KIND_ORDER, todayISO, WEEKDAYS, weekday } from '../models.js';

function daySheet(existing = null) {
  const d = existing ?? { date: todayISO(), kind: 'holiday', label: '' };
  return openSheet({
    title: existing ? 'تعديل اليوم' : 'يوم في التقويم',
    body: html`
      <form id="cal-form">
        <label class="field">
          <span class="field__label">التاريخ</span>
          <input class="input tabular" name="date" type="date" value="${d.date}" required
                 ${existing ? 'readonly' : ''}>
        </label>
        <div class="field">
          <span class="field__label">النوع</span>
          <div class="stack stack-2">
            ${CALENDAR_KIND_ORDER.map(
              (k) => html`
                <label class="radiocard">
                  <input type="radio" name="kind" value="${k}" ${d.kind === k ? 'checked' : ''}>
                  <span class="radiocard__body">
                    <span class="radiocard__title">${CALENDAR_KIND[k].label}</span>
                    <span class="radiocard__hint">
                      ${CALENDAR_KIND[k].teaching ? 'يوم تُدرَّس فيه الحصص' : 'لا حصص — ولا يُحسب غيابًا'}
                    </span>
                  </span>
                </label>
              `
            )}
          </div>
        </div>
        <label class="field">
          <span class="field__label">الوصف</span>
          <input class="input" name="label" value="${d.label ?? ''}" maxlength="80"
                 placeholder="مثال: إجازة اليوم الوطني">
        </label>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="cal-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#cal-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const date = String(fd.get('date') ?? '');
        if (!date) return;
        done({ date, kind: String(fd.get('kind') ?? 'holiday'), label: String(fd.get('label') ?? '').trim() });
      });
    },
  });
}

export default {
  title: () => 'التقويم الدراسي',
  subtitle: () => store.activeYear()?.label ?? '',

  topActions: () => html`
    <button class="iconbtn" data-act="add" aria-label="يوم جديد">${icon('plus')}</button>
  `,

  render() {
    const year = store.activeYear();
    const cal = store.activeCalendar();
    const days = cal ? store.calendarDaysOf(cal.id) : [];
    const terms = store.termsOf(year?.id);

    return html`
      <div class="card card--pad mb-3">
        <div class="fw-7">${year?.label ?? 'السنة الدراسية'}</div>
        <p class="t-3 fs-sm mt-3">
          حدود الفصول الدراسية تُدخَل من الإعدادات، وهذه الصفحة للإجازات والأيام المميّزة.
          استيراد تقويم وزارة التعليم آليًا يأتي لاحقًا — النموذج مهيّأ له.
        </p>
        ${terms.length
          ? html`
              <div class="list mt-3">
                ${terms.map(
                  (t) => html`
                    <div class="row">
                      <span class="row__main">
                        <span class="row__title">${t.name}</span>
                        <span class="row__sub">
                          ${t.startDate && t.endDate
                            ? html`<span class="tabular">${t.startDate}</span> ← <span class="tabular">${t.endDate}</span>`
                            : 'التواريخ غير مُدخلة'}
                        </span>
                      </span>
                      <span class="row__end">
                        <a class="btn btn--sm btn--quiet" href="#/settings">تحديد</a>
                      </span>
                    </div>
                  `
                )}
              </div>
            `
          : ''}
      </div>

      ${days.length
        ? html`
            <div class="section">
              <div class="section__head">
                <div class="section__title">الأيام المسجّلة</div>
                <span class="t-3 fs-sm"><span class="tabular">${days.length}</span> يومًا</span>
              </div>
              <div class="list">
                ${days.map((d) => {
                  const k = CALENDAR_KIND[d.kind] ?? CALENDAR_KIND.holiday;
                  return html`
                    <div class="row">
                      <span class="row__icon ${k.teaching ? '' : 'is-off'}">${icon('calendar')}</span>
                      <span class="row__main">
                        <span class="row__title">${d.label || k.label}</span>
                        <span class="row__sub">
                          ${WEEKDAYS[weekday(d.date)]} · <span class="tabular">${d.date}</span> · ${k.label}
                        </span>
                      </span>
                      <span class="row__end">
                        ${k.teaching
                          ? html`<span class="badge">تُدرَّس</span>`
                          : html`<span class="badge badge--info">لا حصص</span>`}
                        <button class="iconbtn" data-act="remove" data-id="${d.id}" aria-label="حذف">${icon('trash')}</button>
                      </span>
                    </div>
                  `;
                })}
              </div>
            </div>
          `
        : html`
            <div class="empty">
              <div class="empty__icon">${icon('calendar')}</div>
              <div class="empty__title">التقويم فارغ</div>
              <div class="empty__text">
                أضف الإجازات الرسمية واليوم الوطني ويوم التأسيس وأيام الاختبارات.
                أي حصة تقع في يوم إجازة تُعلَّم «إجازة رسمية» تلقائيًا.
              </div>
              <button class="btn btn--primary" data-act="add">${icon('plus')} أضف يومًا</button>
            </div>
          `}
    `;
  },

  actions: {
    async add() {
      const data = await daySheet();
      if (!data) return;
      const cal = await store.ensureCalendar();
      if (!cal) {
        toast('أنشئ سنة دراسية أولًا', 'danger');
        return;
      }
      await store.setCalendarDay(cal.id, data.date, data.kind, data.label);
      toast('أُضيف إلى التقويم');
    },

    async remove(el) {
      const ok = await confirmSheet({
        title: 'حذف هذا اليوم من التقويم؟',
        desc: 'الحصص المسجّلة سابقًا لا تتغيّر حالتها تلقائيًا.',
        confirmLabel: 'احذف',
        danger: true,
      });
      if (!ok) return;
      await store.removeCalendarDay(el.dataset.id);
      toast('حُذف');
    },
  },
};
