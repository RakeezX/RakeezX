/**
 * المنهج — الوحدات والدروس.
 *
 * المنهج يتبع (مادة + صف + رقم الفصل الدراسي) **لا الشعبة**. فدرس الوحدة
 * الأولى لرابع ابتدائي واحدٌ يُستعمل مع ٤/أ و٤/ب و٤/ج بلا نسخ.
 * ولاحظ: رقم الفصل الدراسي لا معرّفه — فالمنهج نفسه يُعاد استعماله كل عام.
 */

import { html, icon, openSheet, toast, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import { GRADES, gradeLabel, makeUnit, makeLesson, TERM_ORDINALS } from '../models.js';
import { repaint } from '../repaint.js';

let subjectId = null;
let grade = 4;
let termIndex = 1;

function unitSheet(existing = null) {
  const u = existing ?? { name: '', plannedSessions: 4 };
  return openSheet({
    title: existing ? 'تعديل الوحدة' : 'وحدة جديدة',
    body: html`
      <form id="unit-form">
        <label class="field">
          <span class="field__label">اسم الوحدة</span>
          <input class="input" name="name" value="${u.name}" required maxlength="80"
                 autocomplete="off" placeholder="الوحدة الأولى: مقدمة في الحاسب">
        </label>
        <label class="field">
          <span class="field__label">عدد الحصص المخططة</span>
          <input class="input tabular" name="plannedSessions" type="number" min="0" max="200"
                 value="${u.plannedSessions ?? 0}">
          <span class="field__hint">تُقارَن لاحقًا بالحصص المنفّذة لقياس إنجاز المنهج.</span>
        </label>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="unit-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#unit-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;
        done({ name, plannedSessions: Number(fd.get('plannedSessions')) || 0 });
      });
    },
  });
}

function lessonSheet(existing = null) {
  const l = existing ?? { name: '', plannedSessions: 1 };
  return openSheet({
    title: existing ? 'تعديل الدرس' : 'درس جديد',
    body: html`
      <form id="lesson-form">
        <label class="field">
          <span class="field__label">اسم الدرس</span>
          <input class="input" name="name" value="${l.name}" required maxlength="80"
                 autocomplete="off" placeholder="الدرس الأول: أجزاء الحاسب">
        </label>
        <label class="field">
          <span class="field__label">عدد الحصص</span>
          <input class="input tabular" name="plannedSessions" type="number" min="1" max="20"
                 value="${l.plannedSessions ?? 1}">
        </label>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="lesson-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#lesson-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;
        done({ name, plannedSessions: Number(fd.get('plannedSessions')) || 1 });
      });
    },
  });
}

export default {
  title: () => 'المنهج',
  subtitle: () => {
    const s = store.getSubject(subjectId);
    return s ? `${s.name} · ${gradeLabel(grade)}` : '';
  },

  topActions: () => html`
    <button class="iconbtn" data-act="add-unit" aria-label="وحدة جديدة">${icon('plus')}</button>
  `,

  onMount() {
    const subs = store.subjects();
    if (!subjectId || !subs.some((s) => s.id === subjectId)) subjectId = subs[0]?.id ?? null;
    const t = store.activeTerm();
    if (t?.index) termIndex = t.index;
    repaint();
  },

  render() {
    const subs = store.subjects();
    if (!subs.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('book')}</div>
          <div class="empty__title">لا مواد بعد</div>
          <div class="empty__text">تُنشأ المادة مع أول فصل.</div>
          <a class="btn btn--primary" href="#/classes">${icon('plus')} الفصول</a>
        </div>
      `;
    }

    const units = store.unitsFor(subjectId, grade, termIndex);
    const totalPlanned = units.reduce((n, u) => n + (u.plannedSessions ?? 0), 0);

    return html`
      <div class="card card--pad mb-3">
        <div class="field-row">
          <label class="field" style="margin-bottom:0">
            <span class="field__label">المادة</span>
            <select class="select" data-change="pick-subject">
              ${subs.map(
                (s) => html`<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${s.name}</option>`
              )}
            </select>
          </label>
          <label class="field" style="margin-bottom:0">
            <span class="field__label">الصف</span>
            <select class="select" data-change="pick-grade">
              ${GRADES.map(
                (g) => html`<option value="${g.v}" ${g.v === grade ? 'selected' : ''}>${g.label}</option>`
              )}
            </select>
          </label>
        </div>
        <div class="field mt-4" style="margin-bottom:0">
          <span class="field__label">الفصل الدراسي</span>
          <div class="segmented">
            ${store.activeTermIndexes().map(
              (i) => html`
                <button class="segmented__btn ${termIndex === i ? 'is-on' : ''}"
                        data-act="pick-term" data-i="${i}">
                  ${TERM_ORDINALS[i]}
                </button>
              `
            )}
          </div>
          <span class="field__hint">
            المنهج يتبع رقم الفصل لا سنة بعينها — فما تُدخله هنا يُعاد استعماله كل عام.
          </span>
        </div>
      </div>

      ${units.length
        ? html`
            <div class="hstack gap-2 mb-3 t-3 fs-sm">
              <span><span class="tabular fw-7">${units.length}</span> وحدة</span>
              <span class="push"><span class="tabular fw-7">${totalPlanned}</span> حصة مخططة</span>
            </div>
            <div class="stack stack-3">
              ${units.map((u) => {
                const lessons = store.lessonsOf(u.id);
                return html`
                  <div class="card card--pad">
                    <div class="hstack gap-2">
                      <div>
                        <div class="fw-7">${u.name}</div>
                        <div class="t-3 fs-sm">
                          <span class="tabular">${lessons.length}</span> درسًا ·
                          <span class="tabular">${u.plannedSessions ?? 0}</span> حصة مخططة
                        </div>
                      </div>
                      <div class="push hstack gap-1">
                        <button class="iconbtn" data-act="add-lesson" data-id="${u.id}" aria-label="درس جديد">${icon('plus')}</button>
                        <button class="iconbtn" data-act="edit-unit" data-id="${u.id}" aria-label="تعديل">${icon('edit')}</button>
                      </div>
                    </div>
                    ${lessons.length
                      ? html`
                          <div class="stack stack-2 mt-3">
                            ${lessons.map(
                              (l) => html`
                                <div class="lesson">
                                  <span class="lesson__dot"></span>
                                  <span class="lesson__name">${l.name}</span>
                                  <span class="push t-3 fs-sm tabular">${l.plannedSessions} حصة</span>
                                  <button class="iconbtn" data-act="del-lesson" data-id="${l.id}" aria-label="حذف">${icon('x')}</button>
                                </div>
                              `
                            )}
                          </div>
                        `
                      : html`<div class="t-3 fs-sm mt-3">لا دروس بعد.</div>`}
                  </div>
                `;
              })}
            </div>
          `
        : html`
            <div class="empty">
              <div class="empty__icon">${icon('book')}</div>
              <div class="empty__title">لا وحدات في هذا المنهج</div>
              <div class="empty__text">
                أضف وحدات ${gradeLabel(grade)} للفصل ${TERM_ORDINALS[termIndex]}،
                وستكون متاحة لكل شعبك في هذا الصف.
              </div>
              <button class="btn btn--primary" data-act="add-unit">${icon('plus')} وحدة جديدة</button>
            </div>
          `}

      <p class="t-3 fs-sm mt-6 center">
        ربط الدرس بالحصة وتحضيرها يأتي في الموجة القادمة — الحصة تحمل حقل الدرس أصلًا.
      </p>
    `;
  },

  actions: {
    'pick-subject'(el) {
      subjectId = el.value;
      repaint();
    },
    'pick-grade'(el) {
      grade = Number(el.value);
      repaint();
    },
    'pick-term'(el) {
      termIndex = Number(el.dataset.i);
      repaint();
    },

    async 'add-unit'() {
      if (!subjectId) return;
      const data = await unitSheet();
      if (!data) return;
      const order = store.unitsFor(subjectId, grade, termIndex).length;
      await store.save({ units: [makeUnit({ subjectId, grade, termIndex, order, ...data })] });
      toast('أُضيفت الوحدة');
    },

    async 'edit-unit'(el) {
      const u = store.state.units.find((x) => x.id === el.dataset.id);
      if (!u) return;
      const data = await unitSheet(u);
      if (!data) return;
      await store.patch('units', u.id, data);
      toast('حُفظت');
    },

    async 'add-lesson'(el) {
      const data = await lessonSheet();
      if (!data) return;
      const order = store.lessonsOf(el.dataset.id).length;
      await store.save({ lessons: [makeLesson({ unitId: el.dataset.id, order, ...data })] });
      toast('أُضيف الدرس');
    },

    async 'del-lesson'(el) {
      const ok = await confirmSheet({
        title: 'حذف الدرس؟',
        desc: 'الحصص المرتبطة به تبقى، ويُزال ربطها بالدرس.',
        confirmLabel: 'احذف',
        danger: true,
      });
      if (!ok) return;
      await store.softDelete('lessons', el.dataset.id);
      toast('حُذف الدرس');
    },
  },
};
