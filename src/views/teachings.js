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
  GRADES, SECTION_COLORS, autoAssignSectionColor, gradeLabel, safeColor, todayISO, sectionLabel, normalizeSectionLabel
} from '../models.js';
import { normalizeSubjectName, validateCustomSubjectName } from '../lib/subject-catalog.js';
import { classSubjectDefault } from '../lib/class-subject-default.js';
import { repaint } from '../repaint.js';

function subjectMenu(options, query = '') {
  const normalized = normalizeSubjectName(query);
  const matches = options.filter((option) => !normalized || option.searchText.includes(normalized));
  const used = matches.filter((option) => option.used);
  const rest = matches.filter((option) => !option.used);
  const rows = (items) => items.map((option) => html`
    <button type="button" class="subject-picker__option" role="option"
            data-subject-token="${option.token}" data-subject-name="${option.name}">
      <span>${option.name}</span>
      ${option.builtin ? '' : html`<span class="badge">مخصصة</span>`}
    </button>
  `);
  return html`
    ${used.length ? html`
      <div class="subject-picker__group-label">موادك</div>
      <div class="subject-picker__group">${rows(used)}</div>
    ` : ''}
    ${rest.length ? html`
      <div class="subject-picker__group-label">كل المواد</div>
      <div class="subject-picker__group">${rows(rest)}</div>
    ` : ''}
    ${!matches.length ? html`<div class="subject-picker__empty">لا توجد مادة مطابقة</div>` : ''}
    <button type="button" class="subject-picker__custom-action" data-subject-custom>
      ${icon('plus')} مادة مخصصة
    </button>
  `;
}

function sheet(existing = null) {
  const secs = store.sections();
  const options = store.subjectOptions();
  const autoColor = autoAssignSectionColor(secs);
  const selectedOption = classSubjectDefault(options, store.state.teachings.filter(teaching => !store.isTeachingArchived(teaching)), store.teachings(), existing);
  const c = existing
    ? {
        grade: store.getSection(existing.sectionId)?.grade ?? 4,
        label: store.getSection(existing.sectionId)?.label ?? '1',
        color: store.getSection(existing.sectionId)?.color ?? SECTION_COLORS[0],
      }
    : { grade: 4, label: '1', color: autoColor };

  return openSheet({
    title: existing ? 'تعديل الفصل' : 'فصل جديد',
    desc: existing ? null : 'اختر الصف ورمز الفصل والمادة.',
    body: html`
      <form id="tch-form" class="management-form class-form">
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
            <span class="field__label">رمز الفصل</span>
            <input class="input" name="label" value="${c.label}" required maxlength="8"
                   autocomplete="off" placeholder="1">
          </label>
        </div>

        <div class="field subject-picker" data-subject-picker>
          <span class="field__label">المادة</span>
          <input type="hidden" name="subjectToken" value="${selectedOption?.token ?? ''}">
          <button type="button" class="subject-picker__trigger" data-subject-trigger
                  aria-haspopup="listbox" aria-expanded="false">
            <span data-subject-selected>${selectedOption?.name ?? 'اختر المادة'}</span>
            ${icon('chev')}
          </button>
          <div class="subject-picker__menu" data-subject-menu hidden>
            <input class="input subject-picker__search" type="search" inputmode="search"
                   placeholder="ابحث عن مادة" aria-label="ابحث عن مادة"
                   role="combobox" aria-expanded="true" aria-controls="subject-picker-options"
                   autocomplete="off">
            <div id="subject-picker-options" class="subject-picker__options" role="listbox" data-subject-options>
              ${subjectMenu(options)}
            </div>
          </div>
          <div class="subject-picker__custom" data-subject-custom-fields hidden>
            <input class="input" name="customSubjectName" maxlength="60" autocomplete="off"
                   placeholder="اسم المادة بالعربية أو الإنجليزية" aria-label="اسم المادة المخصصة">
            <button type="button" class="btn btn--quiet btn--sm" data-subject-custom-back>العودة إلى المواد</button>
          </div>
          <span class="field__hint">يمكنك البحث في المواد أو إضافة مادة مخصصة.</span>
        </div>

        ${existing
          ? html`
              <div class="field">
                <span class="field__label">لون الفصل</span>
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
      const picker = root.querySelector('[data-subject-picker]');
      const trigger = picker.querySelector('[data-subject-trigger]');
      const menu = picker.querySelector('[data-subject-menu]');
      const search = picker.querySelector('.subject-picker__search');
      const optionList = picker.querySelector('[data-subject-options]');
      const selected = picker.querySelector('[data-subject-selected]');
      const tokenInput = picker.querySelector('[name="subjectToken"]');
      const customFields = picker.querySelector('[data-subject-custom-fields]');
      const customInput = picker.querySelector('[name="customSubjectName"]');

      const closeMenu = () => {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      };
      const openMenu = () => {
        customFields.hidden = true;
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        search.focus();
      };
      const renderOptions = () => { optionList.innerHTML = subjectMenu(options, search.value).value; };

      trigger.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
      search.addEventListener('input', renderOptions);
      search.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { closeMenu(); trigger.focus(); }
        if (ev.key === 'Enter') {
          const first = optionList.querySelector('[data-subject-token]');
          if (first) { ev.preventDefault(); first.click(); }
        }
      });
      optionList.addEventListener('click', (ev) => {
        const option = ev.target.closest('[data-subject-token]');
        if (option) {
          tokenInput.value = option.dataset.subjectToken;
          selected.textContent = option.dataset.subjectName;
          customInput.value = '';
          closeMenu();
          trigger.focus();
          return;
        }
        if (ev.target.closest('[data-subject-custom]')) {
          tokenInput.value = 'custom';
          selected.textContent = 'مادة مخصصة';
          closeMenu();
          customFields.hidden = false;
          customInput.focus();
        }
      });
      picker.querySelector('[data-subject-custom-back]').addEventListener('click', () => {
        customInput.value = '';
        openMenu();
      });

      root.querySelector('#tch-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const label = String(fd.get('label') ?? '').trim();
        if (!label) return;
        const grade = Number(fd.get('grade'));
        const yearId = existing ? store.getSection(existing.sectionId)?.yearId : store.activeYear()?.id;
        const duplicate = store.sections(yearId).find((s) => !s.deleted && s.id !== existing?.sectionId &&
          s.yearId === yearId && s.grade === grade && normalizeSectionLabel(s.label) === normalizeSectionLabel(label));
        if (duplicate) {
          toast(`هذا الفصل موجود مسبقًا (${gradeLabel(grade)} / ${duplicate.label})`, 'warn');
          return;
        }
        const subjectToken = String(fd.get('subjectToken') ?? '');
        const customSubjectName = String(fd.get('customSubjectName') ?? '');
        if (subjectToken === 'custom') {
          const validation = validateCustomSubjectName(customSubjectName);
          if (!validation.ok) {
            toast(validation.error, 'warn');
            customFields.hidden = false;
            customInput.focus();
            return;
          }
        } else if (!subjectToken) {
          toast('اختر مادة للفصل', 'warn');
          openMenu();
          return;
        }
        done({
          grade,
          label,
          color: String(fd.get('color') ?? autoColor ?? SECTION_COLORS[0]),
          subjectSelection: { token: subjectToken, customName: customSubjectName },
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
    <div class="class-card ${demo ? 'is-demo' : ''}" style="--class-color:${safeColor(sec?.color)}">
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
          <span class="class-card__count"><span class="tabular">${roster.length}</span> طالبًا</span>
          ${demo ? html`<span class="badge badge--info">تجريبي</span>` : ''}
        </div>
      </a>
    </div>
  `;
}

export default {
  title: () => 'الفصول',
  subtitle: () => store.activeTerm()?.name ?? '',

  render() {
    const list = store.teachings();
    const term = store.activeTerm();
    const closed = term ? store.isTermClosed(term.id) : false;

    if (!list.length) {
      return html`
        <div class="management-page classes-page">
        <div class="empty management-empty classes-empty">
          <div class="empty__icon">${icon('classes')}</div>
          <div class="empty__title">لا فصول في ${term?.name ?? 'هذا الفصل الدراسي'}</div>
          
          <div class="empty__text">
            أنشئ فصلك الأول واختر مادته، ويأتي معه نموذج بنود تقييم جاهز.
          </div>
          <div class="stack stack-2"><button class="btn btn--primary" data-act="add">${icon('plus')} فصل جديد</button><button class="btn btn--ghost" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button></div>
        </div>
        </div>
      `;
    }

    const totalStudents = list.reduce((n, t) => n + store.students(t.id).length, 0);

    return html`
      <div class="management-page classes-page">
      ${closed
        ? html`<div class="card card--pad mb-3 banner-closed">
            ${icon('note')} هذا الفصل الدراسي مُغلق — البيانات للعرض فقط.
          </div>`
        : ''}

      <div class="management-overview classes-overview mb-3" aria-label="ملخص الفصول">
        <div class="classes-overview__metric">
          <span class="classes-overview__label">عدد الفصول</span>
          <strong class="classes-overview__value tabular">${list.length}</strong>
        </div>
        <div class="classes-overview__metric">
          <span class="classes-overview__label">عدد الطلاب</span>
          <strong class="classes-overview__value tabular">${totalStudents}</strong>
        </div>
      </div>

      <div class="class-cards-grid" aria-label="قائمة الفصول">${list.map(renderClassCard)}</div>

      <div class="hstack gap-2 wrap mt-3 classes-actions">
        <button class="btn btn--primary" data-act="add">${icon('plus')} إضافة فصل</button>
        <button class="btn btn--ghost" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button>
        <button class="btn btn--ghost class-action-delete-btn" data-act="delete-class-flow">${icon('trash')} حذف فصل</button>
      </div>
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
              nextBtn.addEventListener('click', async () => {
                if (!selectedId) return;
                const selected = list.find((row) => row.id === selectedId);
                try {
                  const plan = isDemo(selected) ? null : await store.previewDeleteTeaching(selectedId);
                  renderStep2(plan);
                } catch (error) {
                  toast(error.message || 'تعذّر التحقق من نطاق الحذف. أعد المحاولة عند توفر الاتصال.', 'warn');
                }
              });
            }
          }

          function renderStep2(plan) {
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
                <p class="class-delete-confirm-box__consequence">${plan?.scope === 'teaching'
                  ? 'سيتم حذف هذه المادة وبياناتها من الفصل، بما في ذلك الحصص والحضور والدرجات والرصد والملاحظات. ستبقى المواد الأخرى والفصل وطلابه.'
                  : 'سيتم حذف الفصل كاملًا وبياناته المرتبطة، بما في ذلك الحصص والحضور والدرجات والرصد والملاحظات.'}</p>
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
                  try {
                    await store.deleteTeaching(selectedTch.id, plan);
                    toast(plan.scope === 'teaching' ? 'تم حذف المادة من الفصل' : 'تم حذف الفصل');
                    repaint();
                  } catch (error) {
                    toast(error.message || 'تعذّر حذف الفصل. أعد المحاولة عند توفر الاتصال.', 'warn');
                  }
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
      try {
        const subject = await store.resolveSubjectSelection(data.subjectSelection);
        const sec = await store.createSection({
          yearId: year.id, grade: data.grade, label: data.label,
          name: `${data.grade}/${data.label}`, color: col
        });
        await store.createTeaching({ sectionId: sec.id, subjectId: subject.id, termId: term.id });
        repaint();
      } catch (err) {
        toast(err.message || 'تعذّر إنشاء الفصل', 'warn');
      }
    }
  },
};
