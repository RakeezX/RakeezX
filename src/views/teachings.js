/**
 * الفصول — قائمة الإسنادات التدريسية في الفصل الدراسي الحالي.
 *
 * الشعبة (٤/أ) مجموعة طلاب تعيش السنة كاملة، والإسناد هو «أُدرّس المهارات
 * الرقمية لهذه الشعبة في هذا الفصل الدراسي». الكيانان منفصلان، وهذه الشاشة
 * تنشئهما معًا في خطوة واحدة حتى لا يشعر المعلّم بالتعقيد.
 */

import { html, icon, openSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import {
  GRADES, SECTION_COLORS, gradeLabel, safeColor, todayISO, sectionId as mkSectionId, sectionLabel
} from '../models.js';
import { go } from '../router.js';

function sheet(existing = null) {
  const secs = store.sections();
  const subs = store.subjects();
  const c = existing
    ? {
        grade: store.getSection(existing.sectionId)?.grade ?? 4,
        label: store.getSection(existing.sectionId)?.label ?? 'أ',
        color: store.getSection(existing.sectionId)?.color ?? SECTION_COLORS[0],
        subjectId: existing.subjectId,
      }
    : { grade: 4, label: 'أ', color: SECTION_COLORS[0], subjectId: subs[0]?.id };

  return openSheet({
    title: existing ? 'تعديل الفصل' : 'فصل جديد',
    desc: existing ? null : 'الشعبة مجموعة الطلاب، والمادة تُسنَد إليها في هذا الفصل الدراسي.',
    body: html`
      <form id="tch-form">
        <div class="field-row">
          <label class="field">
            <span class="field__label">الصف</span>
            <select class="select" name="grade">
              ${GRADES.map(
                (g) => html`<option value="${g.v}" ${Number(c.grade) === g.v ? 'selected' : ''}>${g.label}</option>`
              )}
            </select>
          </label>
          <label class="field">
            <span class="field__label">رمز الشعبة</span>
            <input class="input" name="label" value="${c.label}" required maxlength="8"
                   autocomplete="off" placeholder="أ">
          </label>
        </div>

        <label class="field">
          <span class="field__label">المادة</span>
          <select class="select" name="subjectId">
            ${subs.map(
              (s) => html`<option value="${s.id}" ${c.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`
            )}
          </select>
          <span class="field__hint">المنهج يتبع المادة والصف — فدرس الوحدة الأولى واحد لكل شعبك.</span>
        </label>

        <div class="field">
          <span class="field__label">لون الشعبة</span>
          <div class="hstack gap-2 wrap">
            ${SECTION_COLORS.map(
              (col) => html`
                <label class="swatch">
                  <input type="radio" name="color" value="${col}" ${safeColor(c.color) === col ? 'checked' : ''}>
                  <span style="background:${col}"></span>
                </label>
              `
            )}
          </div>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="tch-form" type="submit">${existing ? 'حفظ' : 'إنشاء'}</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#tch-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const label = String(fd.get('label') ?? '').trim();
        if (!label) return;
        done({
          grade: Number(fd.get('grade')),
          label,
          color: String(fd.get('color') ?? SECTION_COLORS[0]),
          subjectId: String(fd.get('subjectId') ?? ''),
        });
      });
    },
  });
}

function row(tch) {
  const sec = store.getSection(tch.sectionId);
  const sub = store.getSubject(tch.subjectId);
  const roster = store.students(tch.id);
  const today = todayISO();
  const todaySessions = store.sessionsOnFor(tch.id, today);
  const marked = todaySessions.reduce((n, s) => n + store.attendanceIn(s.id).length, 0);
  const weekly = store.weeklyPeriods(tch.id);

  return html`
    <a class="row" href="#/teaching/${tch.id}">
      <span class="class-dot" style="background:${safeColor(sec?.color)}"></span>
      <span class="row__main">
        <span class="row__title">${sectionLabel(sec) || '—'}</span>
        <span class="row__sub">
          ${sub?.name ?? ''} ·
          <span class="tabular">${roster.length}</span> طالبًا
          ${weekly ? html` · <span class="tabular">${weekly}</span> حصص أسبوعيًا` : ''}
        </span>
      </span>
      <span class="row__end">
        ${todaySessions.length
          ? marked >= roster.length && roster.length
            ? html`<span class="badge badge--ok">${icon('check')} رُصد اليوم</span>`
            : html`<span class="badge badge--warn">حصة اليوم</span>`
          : ''}
        ${icon('chev')}
      </span>
    </a>
  `;
}

export default {
  title: () => 'الفصول',
  subtitle: () => store.activeTerm()?.name ?? '',

  topActions: () => html`
    <button class="iconbtn" data-act="add" aria-label="فصل جديد">${icon('plus')}</button>
  `,

  render() {
    const list = store.teachings();
    const term = store.activeTerm();
    const closed = term ? store.isTermClosed(term.id) : false;

    if (!list.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('classes')}</div>
          <div class="empty__title">لا فصول في ${term?.name ?? 'هذا الفصل الدراسي'}</div>
          <div class="empty__text">
            أنشئ شعبتك الأولى وأسند إليها مادتك، ويأتي معها نموذج بنود تقييم جاهز.
          </div>
          <button class="btn btn--primary" data-act="add">${icon('plus')} فصل جديد</button>
        </div>
      `;
    }

    const totalStudents = list.reduce((n, t) => n + store.students(t.id).length, 0);

    return html`
      ${closed
        ? html`<div class="card card--pad mb-3 banner-closed">
            ${icon('note')} هذا الفصل الدراسي مُغلق — البيانات للعرض فقط.
          </div>`
        : ''}

      <div class="grid grid--2 mb-3">
        <div class="stat">
          <div class="stat__val tabular">${list.length}</div>
          <div class="stat__label">إسنادًا</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${totalStudents}</div>
          <div class="stat__label">طالبًا</div>
        </div>
      </div>

      <div class="list">${list.map(row)}</div>

      <button class="fab" data-act="add">${icon('plus')} فصل جديد</button>
    `;
  },

  actions: {
    async add() {
      const data = await sheet();
      if (!data) return;

      const year = store.activeYear();
      const term = store.activeTerm();
      if (!year || !term) {
        toast('أنشئ سنة وفصلًا دراسيًا أولًا من الإعدادات', 'danger');
        return;
      }

      const secId = mkSectionId(year.id, data.grade, data.label);
      let section = store.getSection(secId);
      if (!section) {
        section = await store.createSection({
          yearId: year.id, grade: data.grade, label: data.label,
          name: sectionLabel({ grade: data.grade, label: data.label }), color: data.color,
        });
      }

      const tch = await store.createTeaching({
        sectionId: section.id, subjectId: data.subjectId, termId: term.id,
      });
      toast(`أُنشئ ${sectionLabel(section)}`);
      go(`/teaching/${tch.id}/students`);
    },
  },
};
