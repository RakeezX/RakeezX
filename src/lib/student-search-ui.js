import { html, icon, openSheet } from './dom.js';
import * as store from '../store.js';
import { normalizeSearchText } from '../models.js';

export function currentStudentSearchResults(query, source = store) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const results = new Map();
  for (const teaching of source.teachings()) {
    for (const student of source.students(teaching.id)) {
      if (student.status !== 'active' || !normalizeSearchText(student.name).includes(normalized)) continue;
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
        list.innerHTML = html`${matches.map(({student,contexts}) => contexts.length === 1 ? html`
          <a class="student-search-result" data-student-result data-student-id="${student.id}" href="#/student/${encodeURIComponent(student.id)}?teaching=${encodeURIComponent(contexts[0].teaching.id)}">
            <span><strong>${student.name}</strong><small>${contexts[0].classLabel} · ${contexts[0].subject}</small></span>${icon('chev')}
          </a>` : html`<div class="student-search-result" data-student-id="${student.id}"><span><strong>${student.name}</strong>${contexts.map(({teaching,classLabel,subject}) => html`<a data-student-result class="student-search-context" href="#/student/${encodeURIComponent(student.id)}?teaching=${encodeURIComponent(teaching.id)}"><small>${classLabel} · ${subject}</small>${icon('chev')}</a>`)}</span></div>`)} `.value;
      };
      query.addEventListener('input', update);
      list.addEventListener('click', event => { if(event.target.closest('[data-student-result]')) done(); });
      update();
    },
  });
}
