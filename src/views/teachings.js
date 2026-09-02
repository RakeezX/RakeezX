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
  GRADES, SECTION_COLORS, autoAssignSectionColor, gradeLabel, safeColor, todayISO, sectionId as mkSectionId, sectionLabel
} from '../models.js';
import { go } from '../router.js';
import { repaint } from '../repaint.js';

function sheet(existing = null) {
  const secs = store.sections();
  const subs = store.subjects();
  const autoColor = autoAssignSectionColor(secs);
  const c = existing
    ? {
        grade: store.getSection(existing.sectionId)?.grade ?? 4,
        label: store.getSection(existing.sectionId)?.label ?? 'أ',
        color: store.getSection(existing.sectionId)?.color ?? SECTION_COLORS[0],
        subjectId: existing.subjectId,
      }
    : { grade: 4, label: 'أ', color: autoColor, subjectId: subs[0]?.id };

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

        ${existing
          ? html`
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
            `
          : html`<input type="hidden" name="color" value="${autoColor}">`}
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
          color: String(fd.get('color') ?? autoColor ?? SECTION_COLORS[0]),
          subjectId: String(fd.get('subjectId') ?? ''),
        });
      });
    },
  });
}

let demoBusy = false;

function renderClassCard(tch) {
  const sec = store.getSection(tch.sectionId);
  const sub = store.getSubject(tch.subjectId);
  const today = todayISO();
  const roster = store.students(tch.id);
  const todaySessions = store.sessionsOnFor(tch.id, today);
  const marked = todaySessions.reduce((n, s) => n + store.attendanceIn(s.id).length, 0);
  const demo = isDemo(tch);

  return html`
    <div class="class-card ${demo ? 'is-demo' : ''}">
      <a class="class-card__main" href="#/teaching/${tch.id}">
        <div class="class-card__head">
          <div class="class-card__identity">
            <span class="class-card__dot" style="background:${safeColor(sec?.color)}" aria-hidden="true"></span>
            <span class="class-card__title">${sectionLabel(sec) || '—'}</span>
          </div>
          ${todaySessions.length
            ? marked >= roster.length && roster.length
              ? html`<span class="badge badge--ok">${icon('check')} رُصد</span>`
              : html`<span class="badge badge--warn">حصة اليوم</span>`
            : ''}
        </div>
        <div class="class-card__body">
          <span class="class-card__sub">${sub?.name ?? ''}</span>
          ${demo ? html`<span class="badge badge--info">تجريبي</span>` : ''}
        </div>
      </a>
    </div>
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
            <div class="mt-4 stack stack-2"><button class="btn btn--ghost" data-act="add">${icon('plus')} إضافة فصل واحد يدويًا</button><button class="btn btn--ghost" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button></div>
          ` : html`
            <div class="empty__text">
              أنشئ شعبتك الأولى وأسند إليها مادتك، ويأتي معها نموذج بنود تقييم جاهز.
            </div>
            <div class="stack stack-2"><button class="btn btn--primary" data-act="add">${icon('plus')} فصل جديد</button><button class="btn btn--ghost" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button></div>
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

      <div class="class-cards-grid">${list.map(renderClassCard)}</div>

      <div class="hstack gap-2 wrap mt-3 classes-actions">
        <button class="btn btn--primary" data-act="add">${icon('plus')} إضافة فصل</button>
        <button class="btn btn--ghost" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button>
        <button class="btn btn--ghost class-action-delete-btn" data-act="delete-class-flow">${icon('trash')} حذف فصل</button>
      </div>
    `;
  },

  actions: {
    async 'delete-class-flow'() {
      const list = store.teachings();
      if (!list.length) {
        toast('لا توجد فصول لحذفها', 'warn');
        return;
      }

      let selectedId = list[0].id;

      await openSheet({
        title: 'حذف فصل',
        desc: 'اختر الفصل الذي ترغب في حذفه من القائمة:',
        body: html`
          <div id="class-delete-workflow-root">
            <div class="class-delete-select-list" id="class-delete-select-list">
              ${list.map((tch, idx) => {
                const sec = store.getSection(tch.sectionId);
                const sub = store.getSubject(tch.subjectId);
                const demo = isDemo(tch);
                const isSelected = idx === 0;
                return html`
                  <label class="class-delete-row ${isSelected ? 'is-selected' : ''}" data-teaching-id="${tch.id}">
                    <input type="radio" name="delete_teaching_id" value="${tch.id}" class="class-delete-row__radio" ${isSelected ? 'checked' : ''}>
                    <span class="class-delete-row__dot" style="background:${safeColor(sec?.color)}" aria-hidden="true"></span>
                    <div class="class-delete-row__info">
                      <span class="class-delete-row__title">${sectionLabel(sec) || '—'}</span>
                      <span class="class-delete-row__sub">${sub?.name ?? ''}</span>
                    </div>
                    ${demo ? html`<span class="badge badge--info ms-auto">تجريبي</span>` : ''}
                  </label>
                `;
              })}
            </div>
          </div>
        `,
        foot: html`
          <div class="hstack gap-2 justify-end width-full" id="class-delete-workflow-foot">
            <button type="button" class="btn btn--ghost" data-sheet-close>إلغاء</button>
            <button type="button" class="btn btn--primary" id="class-delete-next-btn">متابعة</button>
          </div>
        `,
        onMount: (root, done) => {
          const container = root.querySelector('#class-delete-workflow-root');
          const foot = root.querySelector('#class-delete-workflow-foot');
          const titleEl = root.querySelector('.sheet__title');
          const descEl = root.querySelector('.sheet__desc');

          function renderStep1() {
            if (titleEl) titleEl.textContent = 'حذف فصل';
            if (descEl) descEl.textContent = 'اختر الفصل الذي ترغب في حذفه من القائمة:';

            container.innerHTML = html`
              <div class="class-delete-select-list" id="class-delete-select-list">
                ${list.map((tch) => {
                  const sec = store.getSection(tch.sectionId);
                  const sub = store.getSubject(tch.subjectId);
                  const demo = isDemo(tch);
                  const isSelected = tch.id === selectedId;
                  return html`
                    <label class="class-delete-row ${isSelected ? 'is-selected' : ''}" data-teaching-id="${tch.id}">
                      <input type="radio" name="delete_teaching_id" value="${tch.id}" class="class-delete-row__radio" ${isSelected ? 'checked' : ''}>
                      <span class="class-delete-row__dot" style="background:${safeColor(sec?.color)}" aria-hidden="true"></span>
                      <div class="class-delete-row__info">
                        <span class="class-delete-row__title">${sectionLabel(sec) || '—'}</span>
                        <span class="class-delete-row__sub">${sub?.name ?? ''}</span>
                      </div>
                      ${demo ? html`<span class="badge badge--info ms-auto">تجريبي</span>` : ''}
                    </label>
                  `;
                })}
              </div>
            `.value;

            foot.innerHTML = html`
              <button type="button" class="btn btn--ghost" data-sheet-close>إلغاء</button>
              <button type="button" class="btn btn--primary" id="class-delete-next-btn" ${!selectedId ? 'disabled' : ''}>متابعة</button>
            `.value;

            attachStep1Listeners();
          }

          function attachStep1Listeners() {
            const rows = container.querySelectorAll('.class-delete-row');
            rows.forEach((row) => {
              row.addEventListener('click', () => {
                const id = row.dataset.teachingId;
                selectedId = id;
                rows.forEach((r) => {
                  const isMatch = r.dataset.teachingId === id;
                  r.classList.toggle('is-selected', isMatch);
                  const radio = r.querySelector('input[type="radio"]');
                  if (radio) radio.checked = isMatch;
                });
                const nextBtn = foot.querySelector('#class-delete-next-btn');
                if (nextBtn) nextBtn.disabled = !selectedId;
              });
            });

            const nextBtn = foot.querySelector('#class-delete-next-btn');
            if (nextBtn) {
              nextBtn.addEventListener('click', () => {
                if (!selectedId) return;
                renderStep2();
              });
            }
          }

          function renderStep2() {
            const selectedTch = list.find((t) => t.id === selectedId);
            const sec = selectedTch ? store.getSection(selectedTch.sectionId) : null;
            const sub = selectedTch ? store.getSubject(selectedTch.subjectId) : null;
            const demo = selectedTch ? isDemo(selectedTch) : false;

            if (titleEl) titleEl.textContent = 'تأكيد حذف الفصل';
            if (descEl) descEl.textContent = 'إجراء يتطلب التأكيد قبل التنفيذ';

            container.innerHTML = html`
              <div class="class-delete-confirm-box">
                <div class="class-delete-confirm-box__badge">
                  ${icon('alert')} تنبيه تأكيد
                </div>
                <div class="t-danger fw-7 fs-sm">أنت على وشك حذف:</div>
                <div class="class-delete-confirm-box__card">
                  <div class="hstack gap-2 align-center mb-1">
                    <span class="class-delete-row__dot" style="background:${safeColor(sec?.color)}" aria-hidden="true"></span>
                    <span class="class-delete-row__title">${sectionLabel(sec) || '—'}</span>
                    ${demo ? html`<span class="badge badge--info ms-auto">تجريبي</span>` : ''}
                  </div>
                  <div class="class-delete-row__sub">${sub?.name ?? ''}</div>
                </div>
                <p class="class-delete-confirm-box__consequence">
                  سيتم حذف الفصل وبياناته المرتبطة، بما في ذلك الحصص والحضور والدرجات والرصد والملاحظات.
                </p>
                <p class="class-delete-confirm-box__note">
                  الطلاب المرتبطون بفصول أو سجلات أخرى ستبقى بياناتهم الأخرى محفوظة.
                </p>
              </div>
            `.value;

            foot.innerHTML = html`
              <button type="button" class="btn btn--ghost" id="class-delete-back-btn">رجوع</button>
              <button type="button" class="btn btn--danger" id="class-delete-confirm-btn">${icon('trash')} تأكيد الحذف</button>
            `.value;

            const backBtn = foot.querySelector('#class-delete-back-btn');
            if (backBtn) {
              backBtn.addEventListener('click', () => {
                renderStep1();
              });
            }

            const confirmBtn = foot.querySelector('#class-delete-confirm-btn');
            if (confirmBtn) {
              confirmBtn.addEventListener('click', async () => {
                done(undefined);
                if (demo) {
                  const pkg = (await demoPackages()).find((item) => item.owned.teachings.includes(selectedTch?.id));
                  if (pkg) {
                    await deleteDemoPackage(pkg.packageId);
                    toast('تم حذف الفصل التجريبي');
                    repaint();
                    return;
                  }
                }
                if (sec) {
                  await store.deleteClass(sec.id);
                  toast('تم حذف الفصل');
                  repaint();
                }
              });
            }
          }

          attachStep1Listeners();
        },
      });
    },
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

      const col = safeColor(data.color, autoAssignSectionColor(store.sections()));
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
