import { html, icon, openSheet } from './dom.js';
import * as store from '../store.js';
import { normalizeSearchText } from '../models.js';
import { compactScheduleClassLabel } from './schedule-export.js';

/** Preserve the existing substring match, then allow ordered name-token prefixes. */
export function matchesStudentSearch(name, query) {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;
  if (normalizedName.includes(normalizedQuery)) return true;
  const nameTokens = normalizedName.split(' ');
  const queryTokens = normalizedQuery.split(' ');
  if (queryTokens.length < 2) return false;
  let from = 0;
  for (const token of queryTokens) {
    const index = nameTokens.findIndex((nameToken, position) => position >= from && nameToken.startsWith(token));
    if (index < 0) return false;
    from = index + 1;
  }
  return true;
}

export function currentStudentSearchResults(query, source = store) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const results = new Map();
  for (const teaching of source.teachings()) {
    for (const student of source.students(teaching.id)) {
      if (student.status !== 'active' || !matchesStudentSearch(student.name, normalized)) continue;
      const result = results.get(student.id) ?? { student, contexts: [] };
      if (!result.contexts.some(context => context.teaching.id === teaching.id)) result.contexts.push({ teaching, classLabel: source.sectionLabel(source.getSection(teaching.sectionId)), subject: source.getSubject(teaching.subjectId)?.name ?? '' });
      results.set(student.id, result);
    }
  }
  return [...results.values()];
}

export function openStudentSearch() {
  return openSheet({
    title: 'بحث عن طالب', desc: 'الطلاب النشطون في فصولك الحالية فقط.',
    body: html`<div class="student-search">
      <label class="field"><span class="field__label">اسم الطالب</span>
        <input class="input" type="search" inputmode="search" autocomplete="off" data-student-query data-autofocus placeholder="اكتب جزءًا من الاسم" aria-controls="student-search-results"></label>
      <div class="student-search__status" role="status" aria-live="polite" data-search-status></div>
      <div id="student-search-results" data-student-results></div>
    </div>`,
    onMount: (root, done) => {
      const query = root.querySelector('[data-student-query]');
      const status = root.querySelector('[data-search-status]');
      const list = root.querySelector('[data-student-results]');
      const update = () => {
        const matches = currentStudentSearchResults(query.value);
        const hasActive = store.teachings().some(teaching => store.students(teaching.id).some(student => student.status === 'active'));
        status.textContent = !hasActive ? 'لا يوجد طلاب نشطون في فصولك الحالية.' : !query.value.trim() ? 'اكتب جزءًا من اسم الطالب للبحث.' : matches.length ? `${matches.length} نتيجة` : 'لا توجد نتائج. جرّب جزءًا آخر من الاسم.';
        list.innerHTML = html`${matches.map(({student,contexts}) => {
          const profileHref = contexts.length === 1
            ? `#/student/${encodeURIComponent(student.id)}?teaching=${encodeURIComponent(contexts[0].teaching.id)}`
            : `#/student/${encodeURIComponent(student.id)}`;
          return html`
            <div class="student-search-result" data-student-id="${student.id}" role="group" aria-label="${student.name}">
              <a class="student-search-result__profile" data-student-result data-student-profile href="${profileHref}" aria-label="فتح ملف الطالب ${student.name}">
                <span class="student-search-result__identity">
                  <strong class="student-search-result__name">${student.name}</strong>
                  <small class="student-search-result__class">${compactScheduleClassLabel(store.getSection(contexts[0].teaching.sectionId))}</small>
                </span>
                <span class="student-search-result__chevron" aria-hidden="true">${icon('chev')}</span>
              </a>
              <div class="student-search-result__rail">
                <div class="student-search-result__rail-scroll" aria-label="فصول ${student.name}">
                  ${contexts.map(({teaching,classLabel,subject}) => html`
                    <a class="student-search-chip" data-student-result data-student-teaching href="#/teaching/${encodeURIComponent(teaching.id)}" aria-label="فتح الفصل ${classLabel}، ${subject}">
                      ${subject}
                    </a>`)}
                </div>
              </div>
            </div>`;
        })} `.value;
      };
      query.addEventListener('input', update);
      list.addEventListener('click', event => { if(event.target.closest('[data-student-result]')) done(); });
      update();
    },
  });
}
