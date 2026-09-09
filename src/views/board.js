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

const MEDALS = ['🥇', '🥈', '🥉'];

export default {
  title: () => 'لوحة التميز',
  subtitle: (p) => store.getTeaching(p.id)?.name ?? '',
  back: (p) => `#/teaching/${p.id}`,
  wide: true,

  onMount() {
    scope = 'term';
    kind = 'participation';
  },

  render(p) {
    const cls = store.getTeaching(p.id);
    if (!cls) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;

    const roster = store.students(cls.id);
    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('board')}</div>
          <div class="empty__title">أضف الطلاب أولًا</div>
          <a class="btn btn--primary" href="#/teaching/${cls.id}/students">${icon('plus')} كشف الطلاب</a>
        </div>
      `;
    }

    const today = todayISO();
    const logs = store.state.logs.filter(
      (l) => !l.deleted && l.teachingId === cls.id && l.kind === kind && (scope === 'term' || l.date === today)
    );

    const points = new Map(roster.map((s) => [s.id, 0]));
    for (const l of logs) points.set(l.studentId, (points.get(l.studentId) ?? 0) + l.delta);

    const ranked = roster
      .map((s) => ({ s, pts: points.get(s.id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts || (a.s.rollNo ?? 0) - (b.s.rollNo ?? 0));

    const top = ranked[0]?.pts ?? 0;
    const anyPoints = ranked.some((r) => r.pts !== 0);

    return html`
      <div class="hstack gap-2 wrap mb-3 board-controls">
        <div class="segmented">
          <button class="segmented__btn ${kind === 'participation' ? 'is-on' : ''}"
                  data-act="kind" data-kind="participation">المشاركة</button>
          <button class="segmented__btn ${kind === 'behavior' ? 'is-on' : ''}"
                  data-act="kind" data-kind="behavior">السلوك</button>
        </div>
        <div class="segmented">
          <button class="segmented__btn ${scope === 'term' ? 'is-on' : ''}"
                  data-act="scope" data-scope="term">الفصل كله</button>
          <button class="segmented__btn ${scope === 'today' ? 'is-on' : ''}"
                  data-act="scope" data-scope="today">اليوم</button>
        </div>
        <button class="btn btn--sm btn--ghost push" data-act="fullscreen">
          ${icon('board')} ملء الشاشة
        </button>
      </div>

      ${!anyPoints
        ? html`
            <div class="empty">
              <div class="empty__icon">${icon('spark')}</div>
              <div class="empty__title">لا نقاط بعد</div>
              <div class="empty__text">ابدأ الرصد السريع في الحصة وستمتلئ اللوحة أمام طلابك.</div>
              <a class="btn btn--primary" href="#/teaching/${cls.id}/quicklog">${icon('spark')} الرصد السريع</a>
            </div>
          `
        : html`
            <ol class="board">
              ${ranked.map(
                (r, i) => html`
                  <li class="board__row ${i < 3 && r.pts > 0 ? 'is-top' : ''}">
                    <span class="board__rank">${i < 3 && r.pts > 0 ? MEDALS[i] : html`<span class="tabular">${i + 1}</span>`}</span>
                    ${studentAvatar(r.s, 'xs')}
                    <span class="board__name">${r.s.name}</span>
                    <span class="board__bar">
                      <span class="board__fill" style="width:${top > 0 ? Math.max(0, (r.pts / top) * 100) : 0}%"></span>
                    </span>
                    <span class="board__pts tabular">${r.pts > 0 ? '+' : ''}${r.pts}</span>
                  </li>
                `
              )}
            </ol>
          `}
    `;
  },

  actions: {
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
