/**
 * الفصول — قائمة الإسنادات التدريسية في الفصل الدراسي الحالي.
 *
 * الشعبة (٤/أ) مجموعة طلاب تعيش السنة كاملة، والإسناد هو «أُدرّس المهارات
 * الرقمية لهذه الشعبة في هذا الفصل الدراسي». الكيانان منفصلان، وهذه الشاشة
 * تنشئهما معًا في خطوة واحدة حتى لا يشعر المعلّم بالتعقيد.
 */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import { createDemoPackage, deleteDemoPackage, demoPackages, isDemo } from '../lib/demo.js';
import * as store from '../store.js';
import {
  GRADES, SECTION_COLORS, gradeLabel, safeColor, todayISO, sectionId as mkSectionId, sectionLabel
} from '../models.js';
import { go } from '../router.js';
import { repaint } from '../repaint.js';

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

let demoBusy = false;

function row(tch) {
  const sec = store.getSection(tch.sectionId);
  const sub = store.getSubject(tch.subjectId);
  const roster = store.students(tch.id);
  const today = todayISO();
  const todaySessions = store.sessionsOnFor(tch.id, today);
  const marked = todaySessions.reduce((n, s) => n + store.attendanceIn(s.id).length, 0);
  const weekly = store.weeklyPeriods(tch.id);
  const demo = isDemo(tch);

  return html`
    <a class="row" href="#/teaching/${tch.id}">
      <span class="class-dot" style="background:${safeColor(sec?.color)}"></span>
      <span class="row__main">
        <span class="row__title">${sectionLabel(sec) || '—'} ${demo ? html`<span class="badge badge--info">تجريبي</span>` : ''}</span>
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
        ${demo ? html`<button class="btn btn--sm btn--quiet" data-act="delete-demo" data-id="${tch.id}">حذف الفصل التجريبي</button>` : ''}${icon('chev')}
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
      const yearSecs = store.sections();
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('classes')}</div>
          <div class="empty__title">لا فصول في ${term?.name ?? 'هذا الفصل الدراسي'}</div>
          
          ${yearSecs.length === 0 ? html`
            <div class="card card--pad mt-4 center" style="background: var(--surface-1); border: 1px dashed var(--border);">
              <div class="fw-7 mb-2">إعداد الفصول</div>
              <p class="t-3 fs-sm mb-3">يمكنك إنشاء الفصول التي تدرّسها الآن دفعة واحدة، ثم تعديلها لاحقًا.</p>
              <button class="btn btn--primary" data-act="seed-sections">${icon('spark')} إعداد الفصول الآن</button>
            </div>
            <div class="mt-4 stack stack-2"><button class="btn btn--ghost" data-act="add">${icon('plus')} إضافة فصل واحد يدويًا</button><button class="btn btn--quiet" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button></div>
          ` : html`
            <div class="empty__text">
              أنشئ شعبتك الأولى وأسند إليها مادتك، ويأتي معها نموذج بنود تقييم جاهز.
            </div>
            <div class="stack stack-2"><button class="btn btn--primary" data-act="add">${icon('plus')} فصل جديد</button><button class="btn btn--quiet" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button></div>
          `}
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

      <div class="hstack gap-2 mt-3"><button class="btn btn--primary" data-act="add">${icon('plus')} إضافة فصل</button><button class="btn btn--quiet" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button></div>
    `;
  },

  actions: {
    async 'add-demo'(el) {
      if (demoBusy) return; demoBusy = true; el.disabled = true;
      try { const result = await createDemoPackage(); toast(`تمت إضافة ${result.section.label} بنجاح`); repaint(); }
      catch (err) { toast(err.message || 'تعذّر إنشاء الفصل التجريبي', 'danger'); }
      finally { demoBusy = false; el.disabled = false; }
    },
    async 'delete-demo'(el, ev) {
      ev?.preventDefault(); ev?.stopPropagation();
      const teaching = store.getTeaching(el.dataset.id);
      const pkg = (await demoPackages()).find((item) => item.owned.teachings.includes(teaching?.id));
      if (!pkg || !(await confirmSheet({ title: 'حذف الفصل التجريبي', desc: 'سيُحذف فقط الفصل التجريبي وبياناته المحلية.', confirmLabel: 'حذف الفصل التجريبي', danger: true }))) return;
      await deleteDemoPackage(pkg.packageId); toast('تم حذف الفصل التجريبي'); repaint();
    },
    async add() {
      const data = await sheet();
      if (!data) return;

      const year = store.activeYear();
      const term = store.activeTerm();
      if (!year || !term) {
        toast('أنشئ سنة وفصلًا دراسيًا أولًا من الإعدادات', 'danger');
        return;
      }

      const col = SECTION_COLORS[Math.floor(Math.random() * SECTION_COLORS.length)];
      const sec = await store.createSection({
        yearId: year.id, grade: data.grade, label: data.label,
        name: `${data.grade}/${data.label}`, color: col
      });

      await store.createTeaching({ sectionId: sec.id, subjectId: data.subjectId, termId: term.id });
      repaint();
    },

    async 'seed-sections'() {
      const year = store.activeYear();
      const term = store.activeTerm();
      if (!year || !term) return toast('أنشئ سنة وفصلًا أولًا', 'danger');
      const subs = store.subjects();

      let items = [
        { grade: 5, label: '1' }, { grade: 5, label: '2' }, { grade: 5, label: '3' }, { grade: 5, label: '4' },
        { grade: 5, label: '5' }, { grade: 5, label: '6' }, { grade: 5, label: '7' }, { grade: 5, label: '8' },
        { grade: 6, label: '6' }, { grade: 6, label: '7' }
      ];

      const selected = await new Promise(resolve => {
        const renderList = () => {
          return html`
            <div id="seed-list" class="stack stack-2">
              ${items.map((it, i) => html`
                <div class="timerow" style="align-items: center;" data-index="${i}">
                  <select class="select" style="width: auto;" data-field="grade">
                    ${GRADES.map(g => html`<option value="${g.v}" ${g.v == it.grade ? 'selected' : ''}>${g.label}</option>`)}
                  </select>
                  <span class="mx-2">/</span>
                  <input class="input tabular" type="text" data-field="label" value="${it.label}" style="width: 4rem;">
                  <button type="button" class="iconbtn ms-auto" data-action="remove-row" aria-label="حذف">${icon('x')}</button>
                </div>
              `)}
            </div>
            <button type="button" class="btn btn--sm btn--ghost mt-3" data-action="add-row">${icon('plus')} إضافة فصل</button>
          `;
        };

        openSheet({
          title: 'إعداد الفصول',
          desc: 'راجع الفصول وعدلها قبل إنشائها',
          body: html`
            <form id="seed-form">
              <label class="field mb-3">
                <span class="field__label">أسند هذه الفصول لمادة:</span>
                <select class="select" name="subjectId">
                  ${subs.map(s => html`<option value="${s.id}">${s.name}</option>`)}
                </select>
              </label>
              <div id="seed-list-container">
                ${renderList()}
              </div>
            </form>
          `,
          foot: html`
            <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
            <button class="btn btn--primary" form="seed-form" type="submit">حفظ وإنشاء</button>
          `,
          onMount: (root, done) => {
            const container = root.querySelector('#seed-list-container');
            
            const updateState = () => {
              const rows = container.querySelectorAll('.timerow');
              items = Array.from(rows).map(row => ({
                grade: Number(row.querySelector('[data-field="grade"]').value),
                label: row.querySelector('[data-field="label"]').value
              }));
            };

            container.addEventListener('click', (ev) => {
              const btn = ev.target.closest('button[data-action]');
              if (!btn) return;
              
              if (btn.dataset.action === 'remove-row') {
                const row = btn.closest('.timerow');
                row.remove();
                updateState();
              } else if (btn.dataset.action === 'add-row') {
                updateState();
                items.push({ grade: items.length ? items[items.length - 1].grade : 1, label: '1' });
                container.innerHTML = renderList().value;
              }
            });

            root.querySelector('#seed-form').addEventListener('submit', (ev) => {
              ev.preventDefault();
              updateState();
              const fd = new FormData(ev.target);
              const sub = String(fd.get('subjectId'));
              done({ items, subjectId: sub });
            });
          }
        }).then(resolve).catch(() => resolve(null));
      });

      if (!selected || !selected.items.length) return;

      let added = 0;
      for (const it of selected.items) {
        const col = SECTION_COLORS[added % SECTION_COLORS.length];
        const sec = await store.createSection({
          yearId: year.id, grade: it.grade, label: it.label,
          name: `${it.grade}/${it.label}`, color: col
        });
        await store.createTeaching({ sectionId: sec.id, subjectId: selected.subjectId, termId: term.id });
        added++;
      }
      
      toast(`تم إضافة ${added} إسناد بنجاح`);
      repaint();
    }
  },
};
