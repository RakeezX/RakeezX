/**
 * لوحة التميز — للعرض على البروجكتر أمام الفصل.
 * تعرض نقاط الرصد السريع لا الدرجات، لأن الدرجات لا تُعرض على الملأ.
 */

import { html, icon } from '../lib/dom.js';
import * as store from '../store.js';
import { todayISO } from '../models.js';
import { studentAvatar } from '../lib/avatar.js';
import { repaint } from '../repaint.js';

let scope = 'term';   // term | today
let kind = 'participation';
let audience = 'class';

/** Read only the mounted teacher workspace; never query other teachers or gradebooks. */
export function gradeTeachings(cls, api = store) {
  const workspace = api.getActiveWorkspace();
  const year = api.activeYear();
  const term = api.activeTerm();
  const section = api.getSection(cls.sectionId);
  const resolved = (workspace?.type === 'account' && workspace.ownershipState === 'claimed' && workspace.authUserId) ||
    (workspace?.type === 'demo' && workspace.ownershipState === 'demo') ||
    (workspace?.type === 'legacy' && workspace.ownershipState === 'unclaimed');
  if (!api.state.ready || !resolved || !year || year.deleted || year.status !== 'active' ||
      !term || term.deleted || term.status !== 'active' || term.yearId !== year.id ||
      cls.termId !== term.id || !section || section.status !== 'active' || section.yearId !== year.id ||
      !Number.isFinite(section.grade) || !api.getSubject(cls.subjectId)) return [];
  return api.teachings(term.id).filter((teaching) => {
    const sec = api.getSection(teaching.sectionId);
    return !teaching.deleted && teaching.subjectId === cls.subjectId && teaching.termId === term.id &&
      sec && !sec.deleted && sec.status === 'active' && sec.yearId === year.id && sec.grade === section.grade;
  });
}

export function boardRanking(teachings, selectedKind, timeScope, today, api = store, grade = false) {
  const rows = new Map();
  const members = new Map();
  for (const teaching of teachings) {
    const roster = api.students(teaching.id);
    members.set(teaching.id, new Set());
    for (const student of roster) {
      if (grade && (student.deleted || student.status !== 'active')) continue;
      members.get(teaching.id).add(student.id);
      if (!rows.has(student.id)) rows.set(student.id, {
        // Keep the projector projection names/avatars/points only, without private student fields.
        s: { id: student.id, name: student.name, rollNo: student.rollNo }, pts: 0,
        sections: new Set(),
      });
      rows.get(student.id).sections.add(api.getSection(teaching.sectionId)?.name ?? '');
    }
  }
  for (const log of api.state.logs) {
    if (log.deleted || log.kind !== selectedKind || (timeScope !== 'term' && log.date !== today) ||
        !members.get(log.teachingId)?.has(log.studentId) || !Number.isFinite(log.delta)) continue;
    rows.get(log.studentId).pts += log.delta;
  }
  return [...rows.values()].map((row) => ({ ...row, sectionName: [...row.sections].filter(Boolean).join('، ') }))
    .sort((a, b) => b.pts - a.pts || (a.s.rollNo ?? 0) - (b.s.rollNo ?? 0));
}

export default {
  title: () => 'لوحة التميز',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() {
    scope = 'term';
    kind = 'participation';
    audience = 'class';
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const comparable = gradeTeachings(cls);
    const useGrade = audience === 'grade' && comparable.length > 0;
    const allRanked = boardRanking(useGrade ? comparable : [cls], kind, scope, todayISO(), store, useGrade);
    // A wider projector audience celebrates positive contributions without displaying negative standings.
    const ranked = useGrade ? allRanked.filter((row) => row.pts > 0) : allRanked;
    if (!ranked.length && !useGrade && !comparable.some((teaching) => store.students(teaching.id).length)) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('board')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const top = ranked[0]?.pts ?? 0;
    const anyPoints = ranked.some((r) => r.pts !== 0);

    return html`
      <div class="classroom-tool-page excellence-board-page">
      <div class="classroom-toolbar board-controls">
        <div class="segmented" role="group" aria-label="نطاق الطلاب">
          <button type="button" class="segmented__btn ${!useGrade ? 'is-on' : ''}" data-act="audience" data-audience="class" aria-pressed="${!useGrade}">الفصل</button>
          <button type="button" class="segmented__btn ${useGrade ? 'is-on' : ''}" data-act="audience" data-audience="grade" aria-pressed="${useGrade}" ${!comparable.length ? html`disabled` : ''}>المستوى الدراسي</button>
        </div>
        <div class="segmented" role="group" aria-label="نوع التميز">
          <button type="button" class="segmented__btn ${kind === 'participation' ? 'is-on' : ''}"
                  data-act="kind" data-kind="participation" aria-pressed="${kind === 'participation' ? 'true' : 'false'}">المشاركة</button>
          <button type="button" class="segmented__btn ${kind === 'behavior' ? 'is-on' : ''}"
                  data-act="kind" data-kind="behavior" aria-pressed="${kind === 'behavior' ? 'true' : 'false'}">السلوك</button>
        </div>
        <div class="segmented" role="group" aria-label="الفترة الزمنية">
          <button type="button" class="segmented__btn ${scope === 'term' ? 'is-on' : ''}"
                  data-act="scope" data-scope="term" aria-pressed="${scope === 'term' ? 'true' : 'false'}">الفصل الدراسي</button>
          <button type="button" class="segmented__btn ${scope === 'today' ? 'is-on' : ''}"
                  data-act="scope" data-scope="today" aria-pressed="${scope === 'today' ? 'true' : 'false'}">اليوم</button>
        </div>
        <button class="btn btn--sm btn--ghost push" data-act="fullscreen">
          ${icon('board')} ملء الشاشة
        </button>
      </div>
      <p class="board-context" role="status">${useGrade
        ? html`المستوى ${store.getSection(cls.sectionId)?.grade} · ${store.getSubject(cls.subjectId)?.name} · ${store.activeTerm()?.name} · ${comparable.length} شعب<br>نقاط الرصد السريع المسجلة فقط؛ تختلف فرص المشاركة بين الشعب، فلا تعني النقاط مقارنة متكافئة. ليست درجات دراسية.`
        : html`نقاط الرصد السريع لهذا الفصل فقط.${!comparable.length ? ' نطاق المستوى متاح للإسنادات النشطة في السنة والفصل الدراسي الحاليين.' : ''}`}</p>

      ${!anyPoints
        ? html`
            <div class="empty">
              <div class="empty__icon">${icon('spark')}</div>
            <div class="empty__title">${useGrade ? 'لا نقاط إيجابية بعد' : 'لا نقاط بعد'}</div>
              <div class="empty__text">${useGrade ? 'تظهر هنا المساهمات الإيجابية المسجلة في شعب المستوى للمادة نفسها.' : 'ابدأ الرصد السريع في الحصة وستمتلئ اللوحة أمام طلابك.'}</div>
              <a class="btn btn--primary" href="#/teaching/${cls.id}/quicklog">${icon('spark')} الرصد السريع</a>
            </div>
          `
        : html`
            <ol class="board" aria-label="ترتيب التميز">
              ${ranked.map(
                (r, i) => html`
                  <li class="board__row ${i < 3 && r.pts > 0 ? 'is-top' : ''}">
                    <span class="board__rank"><span class="board__rank-mark tabular">${i + 1}</span></span>
                    ${studentAvatar(r.s, 'xs')}
                    <span class="board__name">${r.s.name}${useGrade ? html`<small class="board__section">${r.sectionName}</small>` : ''}</span>
                    <span class="board__bar">
                      <span class="board__fill" style="width:${top > 0 ? Math.max(0, (r.pts / top) * 100) : 0}%"></span>
                    </span>
                    <span class="board__pts tabular">${r.pts > 0 ? '+' : ''}${r.pts}</span>
                  </li>
                `
              )}
            </ol>
          `}
      </div>
    `;
  },

  actions: {
    audience(el) {
      audience = el.dataset.audience === 'grade' ? 'grade' : 'class';
      repaint();
    },
    kind(el) {
      kind = el.dataset.kind;
      repaint();
    },

    scope(el) {
      scope = el.dataset.scope;
      repaint();
    },

    fullscreen() {
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else el.requestFullscreen?.();
    },
  },
};
