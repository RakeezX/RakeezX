/**
 * لوحة التميز — للعرض على البروجكتر أمام الفصل.
 * تعرض نقاط الرصد السريع لا الدرجات، لأن الدرجات لا تُعرض على الملأ.
 */

import { html, icon } from '../lib/dom.js';
import * as store from '../store.js';
import { todayISO, gradeLabel } from '../models.js';
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
        sections: new Set(), events: [],
      });
      rows.get(student.id).sections.add(api.getSection(teaching.sectionId)?.name ?? '');
    }
  }
  for (const log of api.state.logs) {
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(log.date ?? '') ? Date.parse(`${log.date}T00:00:00Z`) : NaN;
    if (log.deleted || log.kind !== selectedKind || Number.isNaN(parsedDate) ||
        new Date(parsedDate).toISOString().slice(0, 10) !== log.date || (timeScope !== 'term' && log.date !== today) ||
        !members.get(log.teachingId)?.has(log.studentId) || !Number.isFinite(log.delta)) continue;
    const row = rows.get(log.studentId);
    row.pts += log.delta;
    if (log.delta > 0) row.events.push({ date: log.date, delta: log.delta });
  }
  return [...rows.values()].map((row) => ({ ...row, sectionName: [...row.sections].filter(Boolean).join('، ') }))
    .sort((a, b) => b.pts - a.pts || (a.s.rollNo ?? 0) - (b.s.rollNo ?? 0));
}

/** Milestones use only dated positive QuickLog evidence; thin histories get no claim. */
export function boardMilestones(row) {
  const byDate = new Map();
  for (const event of row.events ?? []) byDate.set(event.date, (byDate.get(event.date) ?? 0) + event.delta);
  const dates = [...byDate.keys()].sort();
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (i < dates.length - 1) {
      const gap = (Date.parse(`${dates[i + 1]}T00:00:00Z`) - Date.parse(`${dates[i]}T00:00:00Z`)) / 86400000;
      if (gap !== 1) break;
    }
    streak++;
  }
  let improved = false;
  if (dates.length >= 4) {
    const split = Math.floor(dates.length / 2);
    const before = dates.slice(0, split).reduce((sum, date) => sum + byDate.get(date), 0);
    const after = dates.slice(split).reduce((sum, date) => sum + byDate.get(date), 0);
    improved = after > before;
  }
  return { streak: streak >= 3 ? streak : 0, improved };
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
    const ranked = allRanked.filter((row) => row.pts > 0);
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
          <button type="button" class="segmented__btn ${!useGrade ? 'is-on' : ''}" data-act="audience" data-audience="class" aria-pressed="${!useGrade}">الفصل الحالي</button>
          <button type="button" class="segmented__btn ${useGrade ? 'is-on' : ''}" data-act="audience" data-audience="grade" aria-pressed="${useGrade}" ${!comparable.length ? html`disabled` : ''}>كل فصول الصف</button>
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
        ? html`${gradeLabel(store.getSection(cls.sectionId)?.grade)} · ${store.getSubject(cls.subjectId)?.name} · ${comparable.length} فصول`
        : 'نقاط الرصد السريع للفصل الحالي.'}</p>
      ${useGrade ? html`<small class="board-context-note">من الرصد السريع · تختلف فرص المشاركة بين الفصول</small>` : ''}

      ${!anyPoints
        ? html`
            <div class="empty">
              <div class="empty__icon">${icon('spark')}</div>
            <div class="empty__title">${useGrade ? 'لا نقاط إيجابية بعد' : 'لا نقاط بعد'}</div>
              <div class="empty__text">${useGrade ? 'تظهر هنا المساهمات الإيجابية المسجلة في الصف للمادة نفسها.' : 'ابدأ الرصد السريع في الحصة وستمتلئ اللوحة أمام طلابك.'}</div>
              <a class="btn btn--primary" href="#/teaching/${cls.id}/quicklog">${icon('spark')} الرصد السريع</a>
            </div>
          `
        : html`
            <section class="board__podium" aria-label="\u0627\u0644\u0645\u0631\u0627\u062a\u0628 \u0627\u0644\u0623\u0648\u0644\u0649">
              ${ranked.slice(0, 3).map((r, i) => {
                const milestones = boardMilestones(r);
                return html`<article class="board__podium-card board__podium-card--${i + 1}">
                  <span class="board__podium-place">${i + 1}</span>
                  ${studentAvatar(r.s, 'sm')}
                  <strong class="board__podium-name">${r.s.name}${useGrade ? html`<small class="board__section">${r.sectionName}</small>` : ''}</strong>
                  <span class="board__podium-points tabular">+${r.pts}</span>
                  <span class="board__badges">${milestones.streak ? html`<small title="\u0633\u0644\u0633\u0644\u0629 \u0625\u064a\u062c\u0627\u0628\u064a\u0629 \u0645\u0633\u062c\u0644\u0629">✦ ${milestones.streak}</small>` : ''}${milestones.improved ? html`<small title="\u062a\u062d\u0633\u0646 \u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 \u0641\u062a\u0631\u062a\u064a\u0646 \u0645\u0633\u062c\u0644\u062a\u064a\u0646">↑</small>` : ''}</span>
                </article>`;
              })}
            </section>
            <ol class="board" aria-label="ترتيب التميز">
              ${ranked.slice(3).map(
                (r, i) => html`
                  <li class="board__row">
                    <span class="board__rank"><span class="board__rank-mark tabular">${i + 4}</span></span>
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
