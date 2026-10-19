import { compareAcademicClasses } from '../lib/class-order.js';
/**
 * الفصول — قائمة الإسنادات التدريسية في الفصل الدراسي الحالي.
 *
 * الشعبة (٤/أ) مجموعة طلاب تعيش السنة كاملة، والإسناد هو «أُدرّس المهارات
 * الرقمية لهذه الشعبة في هذا الفصل الدراسي». الكيانان منفصلان، وهذه الشاشة
 * تجمعهما في خطوة واحدة، أو تضيف مادة لفصل موجود بقائمة طلابه نفسها.
 */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import { createDemoPackage, deleteDemoPackage, previewDemoPackageDelete, isDemo } from '../lib/demo.js';
import * as store from '../store.js';
import {
  GRADES, SECTION_COLORS, autoAssignSectionColor, safeColor, todayISO, sectionLabel, normalizeSectionLabel
} from '../models.js';
import {
  builtinSubject, customSubjectSlug, findPersistedBuiltin, matchBuiltinSubject,
  normalizeSubjectName, validateCustomSubjectName,
} from '../lib/subject-catalog.js';
import { classSubjectDefault } from '../lib/class-subject-default.js';
import { repaint } from '../repaint.js';
import { teachingRouteId } from '../router.js';

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

function matchingSection({ yearId, grade, label }) {
  return store.sections(yearId).find(section => section.yearId === yearId &&
    Number(section.grade) === Number(grade) && normalizeSectionLabel(section.label) === normalizeSectionLabel(label));
}

// Inspect the same subject identities as resolveSubjectSelection without saving
// anything: a duplicate form submission must remain open and leave no outbox.
function existingSubjectSelection({ token, customName = '' }) {
  if (token.startsWith('subject:')) return store.getSubject(token.slice('subject:'.length));
  const definition = token.startsWith('builtin:') ? builtinSubject(token.slice('builtin:'.length))
    : token === 'custom' ? matchBuiltinSubject(customName) : null;
  if (definition) return findPersistedBuiltin(store.subjects(), definition);
  if (token !== 'custom') return null;
  const normalized = normalizeSubjectName(customName);
  return store.subjects().find(subject => normalizeSubjectName(subject.name) === normalized) ??
    store.subjects().find(subject => subject.slug === customSubjectSlug(customName));
}

const duplicateTeaching = (sectionId, subjectId, termId) => sectionId && subjectId &&
  store.teachings(termId).some(teaching => teaching.sectionId === sectionId && teaching.subjectId === subjectId);
const DUPLICATE_TEACHING_MESSAGE = 'هذه المادة موجودة مسبقًا لهذا الصف والفصل في الفصل الدراسي الحالي.';

function sheet(existing = null, selectedSectionId = '') {
  const secs = store.sections();
  const options = store.subjectOptions();
  const autoColor = autoAssignSectionColor(secs);
  const selectedOption = classSubjectDefault(options, store.state.teachings.filter(teaching => !store.isTeachingArchived(teaching)), store.teachings(), existing);
  const selectedSection = store.getSection(selectedSectionId || existing?.sectionId);
  const c = selectedSection
    ? {
        grade: selectedSection.grade,
        label: selectedSection.label,
        color: selectedSection.color,
      }
    : { grade: 4, label: '1', color: autoColor };

  return openSheet({
    title: selectedSectionId ? 'إضافة مادة للفصل' : existing ? 'تعديل الفصل' : 'فصل جديد',
    desc: 'اختر الصف والفصل والمادة. إذا كان الفصل موجودًا، تُضاف المادة بقائمة الطلاب نفسها.',
    body: html`
      <form id="tch-form" class="management-form class-form">
        <div class="field-row">
          <label class="field">
            <span class="field__label">الصف</span>
            <select class="select" name="grade" ${selectedSectionId ? 'disabled' : ''}>
              ${GRADES.map(
                (g) => html`<option value="${g.v}" ${Number(c.grade) === g.v ? 'selected' : ''}>${g.label}</option>`
              )}
            </select>
          </label>
          <label class="field">
            <span class="field__label">رمز الفصل</span>
            <input class="input" name="label" value="${c.label}" required maxlength="8" ${selectedSectionId ? 'readonly' : ''}
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
        const term = store.activeTerm();
        const year = store.activeYear();
        if (!term || !year || term.yearId !== year.id || store.isTermClosed(term.id)) {
          toast('اختر سنة وفصلًا دراسيًا مفتوحًا من الإعدادات', 'warn');
          return;
        }
        const label = String(fd.get('label') ?? '').trim();
        if (!label) return;
        const grade = selectedSectionId ? Number(selectedSection.grade) : Number(fd.get('grade'));
        if (selectedSection && Number(selectedSection.grade) === grade &&
            normalizeSectionLabel(selectedSection.label) === normalizeSectionLabel(label)) {
          try { store.validateTeachingContext(selectedSection.id, term.id); }
          catch (error) { toast(error.message, 'warn'); return; }
        }
        const section = matchingSection({ yearId: year.id, grade, label });
        if (section) {
          try { store.validateTeachingContext(section.id, term.id); }
          catch (error) { toast(error.message, 'warn'); return; }
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
        const subjectSelection = { token: subjectToken, customName: customSubjectName };
        if (duplicateTeaching(section?.id, existingSubjectSelection(subjectSelection)?.id, term.id)) {
          toast(DUPLICATE_TEACHING_MESSAGE, 'warn');
          return;
        }
        done({
          sectionId: section?.id ?? '', termId: term.id, yearId: year.id,
          grade,
          label,
          color: String(fd.get('color') ?? autoColor ?? SECTION_COLORS[0]),
          subjectSelection,
        });
      });
    },
  });
}

let demoBusy = false;
let createBusy = false;

/** The same create handler is reachable from Classes and class editing. */
export async function addSubjectToClass(sectionId = '', { verifyCurrent } = {}) {
  if (createBusy) return;
  createBusy = true;
  try {
    verifyCurrent?.();
    const workspace = store.getActiveWorkspace();
    if (sectionId) store.validateTeachingContext(sectionId);
    const data = await sheet(null, sectionId);
    if (!data) return;
    verifyCurrent?.();
    const year = store.activeYear();
    const term = store.activeTerm();
    if (store.getActiveWorkspace() !== workspace || !year || !term || year.id !== data.yearId || term.id !== data.termId ||
        term.yearId !== year.id || store.isTermClosed(term.id)) {
      throw new Error('تغيّر الفصل الدراسي. افتح النموذج مجددًا.');
    }
    if (data.sectionId) store.validateTeachingContext(data.sectionId, term.id);
    const subject = await store.resolveSubjectSelection(data.subjectSelection, { verifyCurrent });
    verifyCurrent?.();
    if (store.getActiveWorkspace() !== workspace || store.activeYear()?.id !== year.id ||
        store.activeTerm()?.id !== term.id || store.isTermClosed(term.id)) {
      throw new Error('تغيّر الفصل الدراسي. افتح النموذج مجددًا.');
    }
    // Recheck after subject resolution, including a class created while saving.
    // Keep createTeaching idempotent for Sync retries; reject duplicate UI intent here.
    let sec = data.sectionId ? store.validateTeachingContext(data.sectionId, term.id).section
      : matchingSection(data);
    if (duplicateTeaching(sec?.id, subject.id, term.id)) throw new Error(DUPLICATE_TEACHING_MESSAGE);
    if (!sec) sec = await store.createSection({ yearId: year.id, grade: data.grade, label: data.label,
        name: `${data.grade}/${data.label}`, color: safeColor(data.color, autoAssignSectionColor(store.sections())) }, { verifyCurrent });
    await store.createTeaching({ sectionId: sec.id, subjectId: subject.id, termId: term.id }, { verifyCurrent });
    repaint();
  } catch (error) { toast(error.message || 'تعذّر إنشاء الفصل', 'warn'); }
  finally { createBusy = false; }
}

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
      <a class="class-card__main" href="#/teaching/${teachingRouteId(tch.id)}">
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

function classesToolbar(empty = false) {
  return html`<nav class="classes-toolbar" aria-label="إدارة الفصول">
    ${empty ? html`<a class="btn btn--primary" href="#/classes/koshoof?new=1">${icon('upload')} استيراد الفصول من مدرستي</a>
    <button class="btn btn--quiet" data-act="add">${icon('plus')} إنشاء أول فصل</button>` : html`<button class="btn btn--primary" data-act="add">${icon('plus')} إضافة فصل</button>
    <a class="btn btn--quiet" href="#/classes/koshoof">استيراد وتصدير الكشوف</a>`}
    <div class="classes-tools-left"><button class="btn btn--ghost" data-act="add-demo">${icon('spark')} إضافة فصل تجريبي</button>
    <button class="iconbtn classes-trash" data-act="delete-class-flow" aria-label="حذف الفصل" title="حذف الفصل" ${store.teachings().length ? '' : 'disabled'}>${icon('trash')}</button></div>
  </nav>`;
}

// AI: a section persists for the year even before a subject is assigned this term.
function sectionOnlyClasses() {
  try { store.assertClassImportAccess(); } catch { return []; }
  const assigned = new Set(store.teachings().map(row => row.sectionId));
  return store.sections().filter(section => !assigned.has(section.id)).flatMap(section => {
    try { return [store.readCurrentSectionRoster(section.id)]; } catch { return []; }
  });
}
function renderSectionCard({ section, students }) {
  return html`<details class="class-card" data-section-roster="${section.id}">
    <summary class="class-card__main">
      <span class="class-card__head"><span class="class-card__title">${sectionLabel(section)}</span></span>
      <span class="class-card__body"><span class="class-card__sub">بلا مادة في الفصل الدراسي الحالي · عرض الطلاب</span><span class="class-card__count">${students.length} طالبًا</span></span>
    </summary>
    <div class="card--pad">
      ${students.length ? html`<ol aria-label="طلاب الفصل">${students.map(student => html`<li data-section-student="${student.id}">${student.name}</li>`)}</ol>` : html`<p>لا يوجد طلاب منتسبون حاليًا.</p>`}
      <p class="t-3">أضف المادة لفتح أدوات التدريس؛ تبقى أسماء الطلاب وانتساباتهم نفسها.</p>
      <button class="btn btn--quiet" data-act="add-section-subject" data-section-id="${section.id}">${icon('plus')} إضافة مادة لهذا الفصل</button>
    </div>
  </details>`;
}
const teachings = {
  title: () => 'الفصول',
  subtitle: () => store.activeTerm()?.name ?? '',

  render() {
    const list = store.teachings().slice().sort((a,b) => Number(isDemo(a))-Number(isDemo(b)) || compareAcademicClasses(store.getSection(a.sectionId),store.getSection(b.sectionId)));
    const sectionOnly = sectionOnlyClasses();
    const term = store.activeTerm();
    const closed = term ? store.isTermClosed(term.id) : false;

    if (!list.length && !sectionOnly.length) {
      return html`
        <div class="management-page classes-page">
        ${classesToolbar(true)}
        <div class="empty management-empty classes-empty">
          <div class="empty__icon">${icon('classes')}</div>
          <div class="empty__title">لا فصول في ${term?.name ?? 'هذا الفصل الدراسي'}</div>

          <div class="empty__text">
            استورد فصولك وطلابك من مدرستي، أو أنشئ فصلًا يدويًا واختر مادته.
          </div>
        </div>

        </div>
      `;
    }

    const totalStudents = new Set([...list.flatMap(t => store.students(t.id).map(student => student.id)), ...sectionOnly.flatMap(entry => entry.students.map(student => student.id))]).size;
    const cards = [...list.map(teaching => ({ section: store.getSection(teaching.sectionId), teaching })), ...sectionOnly]
      .sort((a,b) => Number(isDemo(a.teaching ?? a.section))-Number(isDemo(b.teaching ?? b.section)) || compareAcademicClasses(a.section,b.section));

    return html`
      <div class="management-page classes-page">
      ${classesToolbar()}
      ${closed
        ? html`<div class="card card--pad mb-3 banner-closed">
            ${icon('note')} هذا الفصل الدراسي مُغلق — البيانات للعرض فقط.
          </div>`
        : ''}

      <div class="management-overview classes-overview mb-3" aria-label="ملخص الفصول">
        <div class="classes-overview__metric">
          <span class="classes-overview__label">عدد الفصول</span>
          <strong class="classes-overview__value tabular">${cards.length}</strong>
        </div>
        <div class="classes-overview__metric">
          <span class="classes-overview__label">عدد الطلاب</span>
          <strong class="classes-overview__value tabular">${totalStudents}</strong>
        </div>
      </div>

      <div class="class-cards-grid" aria-label="قائمة الفصول">${cards.map(entry => entry.teaching ? renderClassCard(entry.teaching) : renderSectionCard(entry))}</div>


      </div>
    `;
  },

  actions: {
    async 'add-section-subject'(el) {
      const id = el.dataset.sectionId;
      try {
        const { section } = store.readCurrentSectionRoster(id);
        const workspace = store.getActiveWorkspace(), year = store.activeYear().id, term = store.activeTerm().id;
        const signature = JSON.stringify(section);
        const yearState = JSON.stringify(store.activeYear()), termState = JSON.stringify(store.activeTerm());
        const verifyCurrent = current => {
          if (store.getActiveWorkspace() !== workspace || store.activeYear()?.id !== year || store.activeTerm()?.id !== term ||
              JSON.stringify(store.readCurrentSectionRoster(id).section) !== signature ||
              current?.sections && JSON.stringify(current.sections.find(row => row.id === id)) !== signature ||
              current?.years && JSON.stringify(current.years.find(row => row.id === year)) !== yearState ||
              current?.terms && JSON.stringify(current.terms.find(row => row.id === term)) !== termState ||
              current?.device && current.device.some(row => row.id === 'device' && (row.activeYearId !== year || row.activeTermId !== term))) {
            throw new Error('تغيّر الفصل أو الحساب. أعد فتح الفصل الحالي.');
          }
        };
        await addSubjectToClass(id, { verifyCurrent });
      } catch (error) { toast(error.message, 'warn'); }
    },
    async 'delete-class-flow'(el, ev, params = {}) {
      const list = store.teachings();
      if (!list.length) {
        toast('لا توجد فصول لحذفها', 'warn');
        return;
      }

      let selectedId = list.some(t => t.id === params.id) ? params.id : list[0].id;

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
            if (descEl) {
              descEl.hidden = false;
              descEl.textContent = 'اختر الفصل الذي ترغب في حذفه من القائمة:';
            }

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

          async function renderStep2() {
            const requestedId = selectedId;
            const next = foot.querySelector('#class-delete-next-btn');
            if (next) next.disabled = true;
            let scope;
            let plan;
            let demoPlan;
            const workspace = store.getActiveWorkspace();
            try {
              scope = store.classDeleteScope(selectedId);
              if (isDemo(store.getTeaching(selectedId)) && workspace?.type === 'account') {
                demoPlan = await previewDemoPackageDelete(selectedId);
              } else if (!isDemo(store.getTeaching(selectedId))) {
                plan = await store.previewDeleteTeaching(selectedId);
                scope.kind = plan.scope === 'teaching' ? 'subject' : 'class';
              }
            }
            catch (error) { toast(error.message, 'warn'); done(undefined); return; }
            if (!root.isConnected) return;
            if (workspace !== store.getActiveWorkspace()) { toast('تغيّرت مساحة العمل. أعد فتح قائمة الحذف.', 'warn'); done(undefined); return; }
            if (requestedId !== selectedId) { renderStep2(); return; }
            const selectedTch = store.getTeaching(selectedId);
            const sec = selectedTch ? store.getSection(selectedTch.sectionId) : null;
            const sub = selectedTch ? store.getSubject(selectedTch.subjectId) : null;
            const demo = selectedTch ? isDemo(selectedTch) : false;

            if (titleEl) titleEl.textContent = scope.kind === 'subject' ? 'تأكيد حذف المادة من الفصل' : 'تأكيد حذف الفصل كاملًا';
            if (descEl) descEl.hidden = true;

            container.innerHTML = html`
              <div class="class-delete-confirm-box">
                <div class="class-delete-confirm-box__card">
                  <div class="hstack gap-2 align-center mb-1">
                    <span class="class-delete-row__dot" style="background:${safeColor(sec?.color)}" aria-hidden="true"></span>
                    <span class="class-delete-row__title">${sectionLabel(sec) || '—'}</span>
                    ${demo ? html`<span class="badge badge--info ms-auto">تجريبي</span>` : ''}
                  </div>
                  <div class="class-delete-row__sub">${sub?.name ?? ''}</div>
                </div>
                <p class="class-delete-confirm-box__consequence">
                  ${scope.kind === 'subject'
                    ? 'ستُحذف هذه المادة ودرجاتها وحصصها وحضورها وملاحظاتها. سيبقى الفصل وطلابه وبقية المواد.'
                    : 'هذه آخر مادة في الفصل؛ سيُحذف الفصل ودرجاته وحصصه وحضوره وملاحظاته.'}
                </p>
                <p class="class-delete-confirm-box__note">
                  ${demo && scope.kind === 'class' ? 'سيُحذف الفصل التجريبي وبياناته المحلية فقط.'
                    : 'إن وُجدت للطلاب سجلات في فصول أخرى، فلن تتأثر. يتطلب الحذف اتصالًا بالإنترنت، ولا يمكن التراجع عنه.'}
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
              // A completed touch must not depend on the browser synthesizing a
              // click after its hover/focus pass. Keep keyboard/mouse activation
              // and every deletion guard in the single click handler below.
              let confirmTouch;
              confirmBtn.addEventListener('touchstart', (event) => {
                const touch = event.touches[0];
                confirmTouch = !confirmBtn.disabled && event.touches.length === 1
                  ? { id: touch.identifier, x: touch.clientX, y: touch.clientY, at: event.timeStamp }
                  : null;
              }, { passive: true });
              confirmBtn.addEventListener('touchmove', (event) => {
                const touch = [...event.touches].find(touch => touch.identifier === confirmTouch?.id);
                if (!touch || event.touches.length !== 1 ||
                    Math.hypot(touch.clientX - confirmTouch.x, touch.clientY - confirmTouch.y) > 10) confirmTouch = null;
              }, { passive: true });
              confirmBtn.addEventListener('touchcancel', () => { confirmTouch = null; }, { passive: true });
              confirmBtn.addEventListener('touchend', (event) => {
                const started = confirmTouch;
                confirmTouch = null;
                const touch = [...event.changedTouches].find(touch => touch.identifier === started?.id);
                if (!started || !touch || !event.cancelable || event.touches.length || confirmBtn.disabled ||
                    event.timeStamp - started.at > 700 ||
                    Math.hypot(touch.clientX - started.x, touch.clientY - started.y) > 10 ||
                    !confirmBtn.contains(document.elementFromPoint(touch.clientX, touch.clientY))) return;
                // Cancel the compatibility click so a failed request cannot be
                // retried by a second event from this same deliberate tap.
                event.preventDefault();
                confirmBtn.click();
              }, { passive: false });
              confirmBtn.addEventListener('click', async () => {
                if (confirmBtn.disabled) return;
                confirmBtn.disabled = true;
                try {
                  if (workspace !== store.getActiveWorkspace() || selectedId !== requestedId) {
                    throw new Error('تغيّرت مساحة العمل أو الفصل المحدد. أعد فتح قائمة الحذف.');
                  }
                  if (store.classDeleteScope(selectedId).signature !== scope.signature) {
                    toast('تغيّرت مواد الفصل. راجع نطاق الحذف وأكّد مجددًا.', 'warn');
                    renderStep2();
                    return;
                  }
                  let result;
                  if (demoPlan) result = await deleteDemoPackage(demoPlan.packageId, demoPlan);
                  else if (demo) result = await store.deleteDemoTeachingScope(selectedId, scope.sectionId, scope.kind === 'subject' ? 'teaching' : 'section');
                  else result = await store.deleteTeaching(selectedId, plan);
                  if (result === false) throw new Error('تعذّر حذف الفصل. لم يكتمل الحفظ.');
                  done(true);
                  toast(scope.kind === 'subject' ? 'تم حذف المادة من الفصل' : 'تم حذف الفصل');
                  repaint();
                } catch (error) {
                  toast(error.message || 'تعذّر حذف الفصل. أعد المحاولة عند توفر الاتصال.', 'warn');
                  confirmBtn.disabled = false;
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
      return teachings.actions['delete-class-flow'](el, ev, { id:el.dataset.id });
    },
    async add() { await addSubjectToClass(); }
  },
};
export default teachings;
