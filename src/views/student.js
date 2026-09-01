/**
 * ملف الطالب — الهوية، والانتسابات، والدرجات، والحضور.
 *
 * الطالب هوية مستقلة عن الشعبة، فالتقرير يُنطَّق بإسناد محدد ولا يخلط
 * بيانات شعبة سابقة بأخرى حالية.
 */

import { html, icon, toast, fmtNum, fmtPct, fmtDate, openSheet, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import {
  itemScore, studentTotal, masteryBand, gradeLabel, sectionLabel,
  ATTENDANCE, ATTENDANCE_ORDER, ENROLLMENT_STATUS, STUDENT_STATUS,
} from '../models.js';
import { studentAvatar } from '../lib/avatar.js';

/** الإسناد المعروض: المطلوب في الرابط، أو أول إسناد لشعبة الطالب الحالية. */
function resolveTeaching(student, requested) {
  if (requested && store.getTeaching(requested)) return store.getTeaching(requested);
  const en = store.activeEnrollment(student.id) ?? store.enrollmentsOf(student.id)[0];
  if (!en) return null;
  return store.teachings().find((t) => t.sectionId === en.sectionId) ?? null;
}

/** يلتقط سياق الإسناد تلقائيًا فقط حين يكون سياق الطالب الحالي واضحًا. */
function noteTeachingContext(student, requested) {
  const enrollment = store.activeEnrollment(student.id);
  if (!enrollment) return null;
  const requestedTeaching = requested ? store.getTeaching(requested) : null;
  if (requestedTeaching) {
    return requestedTeaching.sectionId === enrollment.sectionId ? requestedTeaching : null;
  }
  const candidates = store.teachings().filter((teaching) => teaching.sectionId === enrollment.sectionId);
  return candidates.length === 1 ? candidates[0] : null;
}

export default {
  title: (p) => store.getStudent(p.id)?.name ?? 'الطالب',
  subtitle: (p) => {
    const s = store.getStudent(p.id);
    if (!s) return '';
    const en = store.activeEnrollment(s.id);
    const sec = en ? store.getSection(en.sectionId) : null;
    return sec ? sectionLabel(sec) : STUDENT_STATUS[s.status] ?? '';
  },
  back: (p) => {
    const teachingId = p.teaching || p.cls;
    if (p.from === 'picker' && teachingId) {
      return `#/teaching/${teachingId}/picker`;
    }
    return teachingId ? `#/teaching/${teachingId}/students` : '#/classes';
  },

  topActions: () => html`
    <button class="iconbtn noprint" data-act="print" aria-label="طباعة">${icon('print')}</button>
  `,

  render(p) {
    const s = store.getStudent(p.id);
    if (!s) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">هذا الطالب غير موجود</div>
          <a class="btn btn--ghost" href="#/classes">العودة للفصول</a>
        </div>
      `;
    }

    const tch = resolveTeaching(s, p.teaching);
    const section = tch ? store.getSection(tch.sectionId) : null;
    const items = tch ? store.items(tch.id) : [];
    const ctx = store.studentContext(s.id, tch?.id);
    const total = studentTotal(items, ctx);
    const band = masteryBand(total.pct);

    const tally = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const a of ctx.attendance) tally[a.status] = (tally[a.status] ?? 0) + 1;
    const sessions = ctx.attendance.length;
    const attendedPct = sessions ? ((tally.present + tally.late) / sessions) * 100 : null;

    const part = ctx.logs.filter((l) => l.kind === 'participation');
    const behav = ctx.logs.filter((l) => l.kind === 'behavior');
    const partNet = part.reduce((n, l) => n + l.delta, 0);
    const behavNet = behav.reduce((n, l) => n + l.delta, 0);
    const recent = [...ctx.logs].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);

    const history = store
      .enrollmentsOf(s.id)
      .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
    const notes = store.notesOf(s.id);
    const noteTime = (note) => new Date(note.createdAt ?? note.updatedAt ?? Date.now())
      .toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' });
    const noteContext = (note) => {
      const parts = [];
      const noteTeaching = note.teachingId ? store.getTeaching(note.teachingId) : null;
      const noteSession = note.sessionId ? store.getSession(note.sessionId) : null;
      if (noteTeaching) parts.push(store.teachingLabel(noteTeaching));
      if (noteSession) parts.push(`حصة ${noteSession.period} · ${fmtDate(noteSession.date, false)}`);
      return parts;
    };

    return html`
      <div class="printhead">
        <div class="printhead__title">${s.name}</div>
        <div class="printhead__sub">
          ${section ? sectionLabel(section) : ''}
          ${tch ? '· ' + (store.getSubject(tch.subjectId)?.name ?? '') : ''}
          ${tch ? '· ' + (store.getTerm(tch.termId)?.name ?? '') : ''}
          ${store.state.profile?.schoolName ? ` · ${store.state.profile.schoolName}` : ''}
        </div>
      </div>

      <div class="student-profile-header noprint mb-3">
        ${studentAvatar(s, 'lg')}
        <div class="student-profile-header__info">
          <div class="student-profile-header__name">${s.name}</div>
          <div class="student-profile-header__meta">
            ${section ? html`<span>${sectionLabel(section)}</span>` : ''}
            ${tch ? html`<span>· ${store.getSubject(tch.subjectId)?.name ?? ''}</span>` : ''}
            ${s.rollNo != null ? html`<span class="student-profile-header__roll tabular">رقم الكشف: ${s.rollNo}</span>` : ''}
          </div>
        </div>
      </div>

      ${s.status === 'withdrawn'
        ? html`<div class="card card--pad mb-3 banner-closed">
            ${icon('note')} هذا الطالب غادر المدرسة — سجلّه محفوظ كاملًا للعرض.
          </div>`
        : ''}

      <div class="grid grid--3 mb-3">
        <div class="stat">
          <div class="stat__val tabular">${fmtPct(total.pct)}</div>
          <div class="stat__label">من المرصود</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular">${attendedPct === null ? '—' : fmtPct(attendedPct)}</div>
          <div class="stat__label">نسبة الحضور</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular" style="color:var(--${partNet > 0 ? 'ok' : partNet < 0 ? 'danger' : 'text-2'})">
            ${partNet > 0 ? '+' : ''}${partNet}
          </div>
          <div class="stat__label">نقاط المشاركة</div>
        </div>
      </div>

      ${band.badge
        ? html`<div class="mb-3">
            <span class="badge ${band.badge}">${band.label}</span>
          </div>`
        : ''}

      <!-- سجل الانتساب -->
      <div class="section">
        <div class="section__head"><div class="section__title">سجل الانتساب</div></div>
        <div class="card">
          ${history.length
            ? history.map((en) => {
                const sec = store.getSection(en.sectionId);
                const year = sec ? store.getYear(sec.yearId) : null;
                return html`
                  <div class="logrow">
                    <span class="logrow__delta ${en.status === 'active' ? 'is-pos' : ''}">
                      ${en.rollNo ?? '—'}
                    </span>
                    <span class="logrow__main">
                      <span>
                        ${sectionLabel(sec) || 'شعبة محذوفة'}
                        ${year ? html` · ${year.label}` : ''}
                        <span class="badge ${en.status === 'active' ? 'badge--ok' : ''}">
                          ${ENROLLMENT_STATUS[en.status] ?? en.status}
                        </span>
                      </span>
                      <span class="logrow__date">
                        ${en.startDate ?? '—'}${en.endDate ? ` ← ${en.endDate}` : ''}
                      </span>
                    </span>
                  </div>
                `;
              })
            : html`<div class="card--pad t-3 center">لا انتساب مسجّل.</div>`}
        </div>
      </div>

      <!-- الدرجات -->
      <div class="section">
        <div class="section__head">
          <div class="section__title">الدرجات${tch ? ` — ${store.getSubject(tch.subjectId)?.name ?? ''}` : ''}</div>
          <div class="t-3 fs-sm tabular">${fmtNum(total.earned)} / ${total.outOfAll}</div>
        </div>
        <div class="card">
          ${items.length === 0
            ? html`<div class="card--pad t-3 center">لا بنود تقييم في هذا الإسناد.</div>`
            : items.map((i) => {
                const v = itemScore(i, ctx);
                const pct = v === null ? null : (v / i.max) * 100;
                return html`
                  <div class="itemrow">
                    <div class="itemrow__head">
                      <span class="itemrow__name">
                        ${i.name}
                        ${i.auto ? html`<span class="badge badge--brand">آلي</span>` : ''}
                      </span>
                      <span class="itemrow__val tabular ${v === null ? 't-3' : ''}">
                        ${v === null ? 'لم يُرصد' : `${fmtNum(v)} / ${i.max}`}
                      </span>
                    </div>
                    <div class="meter">
                      <div class="meter__fill" style="width:${pct ?? 0}%;
                           background:var(--${pct === null ? 'border' : pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'danger'})"></div>
                    </div>
                  </div>
                `;
              })}
        </div>
      </div>

      <!-- الحضور -->
      <div class="section">
        <div class="section__head">
          <div class="section__title">الحضور</div>
          <div class="t-3 fs-sm"><span class="tabular">${sessions}</span> حصة مرصودة</div>
        </div>
        ${sessions === 0
          ? html`<div class="card card--pad t-3 center">لم يُرصد حضور بعد.</div>`
          : html`
              <div class="card card--pad">
                <div class="hstack gap-2 wrap">
                  ${ATTENDANCE_ORDER.map((k) =>
                    tally[k]
                      ? html`<span class="badge" style="background:var(--${ATTENDANCE[k].color}-soft);color:var(--${ATTENDANCE[k].color})">
                          ${ATTENDANCE[k].label} <span class="tabular">${tally[k]}</span>
                        </span>`
                      : ''
                  )}
                </div>
                ${tally.absent >= 3
                  ? html`<p class="fs-sm mt-3" style="color:var(--danger)">
                      تجاوز الغياب ثلاث حصص — يستحق تواصلًا مع ولي الأمر.
                    </p>`
                  : ''}
              </div>
            `}
      </div>

      <!-- الملاحظات المؤرخة -->
      <div class="section">
        <div class="section__head">
          <div class="section__title">الملاحظات</div>
          <button class="btn btn--sm btn--quiet noprint" data-act="add-note">${icon('plus')} ملاحظة جديدة</button>
        </div>
        ${notes.length
          ? html`<div class="card">
              ${notes.map((note) => html`
                <div class="logrow">
                  <span class="logrow__main">
                    <span>${note.text}</span>
                    <span class="logrow__date">
                      ${fmtDate(note.date, false)} · <bdi class="tabular">${noteTime(note)}</bdi>
                      ${noteContext(note).map((label) => html`<span class="badge">${label}</span> `)}
                    </span>
                  </span>
                  <span class="row__end noprint">
                    <button class="iconbtn" data-act="edit-note" data-id="${note.id}" aria-label="تعديل ملاحظة">${icon('edit')}</button>
                    <button class="iconbtn" data-act="delete-note" data-id="${note.id}" aria-label="حذف ملاحظة">${icon('trash')}</button>
                  </span>
                </div>
              `)}
            </div>`
          : html`<div class="card card--pad center t-3 stack stack-2">
              <div>لا توجد ملاحظات مسجلة لهذا الطالب.</div>
              <div><button class="btn btn--quiet" data-act="add-note">${icon('plus')} إضافة ملاحظة</button></div>
            </div>`}
      </div>

      <!-- المشاركة والسلوك -->
      <div class="section">
        <div class="section__head"><div class="section__title">المشاركة والسلوك</div></div>
        <div class="grid grid--2 mb-3">
          <div class="stat">
            <div class="stat__val tabular">${partNet > 0 ? '+' : ''}${partNet}</div>
            <div class="stat__label">مشاركة (<span class="tabular">${part.length}</span> رصدة)</div>
          </div>
          <div class="stat">
            <div class="stat__val tabular">${behavNet > 0 ? '+' : ''}${behavNet}</div>
            <div class="stat__label">سلوك (<span class="tabular">${behav.length}</span> رصدة)</div>
          </div>
        </div>

        ${recent.length
          ? html`
              <div class="card">
                ${recent.map(
                  (l) => html`
                    <div class="logrow">
                      <span class="logrow__delta ${l.delta > 0 ? 'is-pos' : 'is-neg'}">
                        ${l.delta > 0 ? '+' : '−'}${Math.abs(l.delta)}
                      </span>
                      <span class="logrow__main">
                        <span>${l.tag || (l.kind === 'participation' ? 'مشاركة' : 'سلوك')}</span>
                        <span class="logrow__date">${fmtDate(l.date)}</span>
                      </span>
                    </div>
                  `
                )}
              </div>
            `
          : html`<div class="card card--pad t-3 center">لا رصد سريع بعد.</div>`}
      </div>

      <div class="section noprint">
        <div class="btn-row">
          <button class="btn btn--ghost" data-act="print">${icon('print')} اطبع التقرير</button>
          ${s.status === 'active'
            ? html`<button class="btn btn--danger" data-act="withdraw">${icon('back')} غادر المدرسة</button>`
            : html`<button class="btn btn--ghost" data-act="reinstate">${icon('check')} أعده للدراسة</button>`}
        </div>
      </div>
    `;
  },

  actions: {
    print() {
      window.print();
    },

    async 'add-note'(el, ev, params) {
      const student = store.getStudent(params.id);
      const teaching = student ? noteTeachingContext(student, params.teaching) : null;
      if (!student) return;
      const data = await openSheet({
        title: 'ملاحظة جديدة',
        body: html`<form id="student-note-form">
          <label class="field"><span class="field__label">الملاحظة</span>
            <textarea class="textarea" id="student-note-text" name="text" rows="5" maxlength="1200" required></textarea>
          </label>

        </form>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" form="student-note-form" type="submit">حفظ</button>`,
        onMount: (root, done) => {
          root.querySelector('#student-note-text')?.focus();
          root.querySelector('#student-note-form').addEventListener('submit', (event) => {
            event.preventDefault();
            done({ text: String(new FormData(event.target).get('text') ?? '').trim() });
          });
        },
      });
      if (!data) return;
      const saved = await store.addStudentNote({ studentId: student.id, text: data.text, teachingId: teaching?.id ?? null });
      toast(saved ? 'حُفظت الملاحظة' : 'اكتب ملاحظة لا تتجاوز ١٢٠٠ حرفًا', saved ? 'ok' : 'danger');
    },

    async 'edit-note'(el) {
      const note = store.state.notes.find((item) => item.id === el.dataset.id && !item.deleted);
      if (!note) return;
      const data = await openSheet({
        title: 'تعديل ملاحظة',
        body: html`<form id="student-note-edit-form"><label class="field"><span class="field__label">الملاحظة</span>
          <textarea class="textarea" id="student-note-text" name="text" rows="5" maxlength="1200" required>${note.text}</textarea>
        </label></form>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" form="student-note-edit-form" type="submit">حفظ</button>`,
        onMount: (root, done) => root.querySelector('#student-note-edit-form').addEventListener('submit', (event) => {
          event.preventDefault(); done(String(new FormData(event.target).get('text') ?? '').trim());
        }),
      });
      if (data === undefined || data === null) return;
      const saved = await store.editStudentNote(note.id, data);
      toast(saved ? 'عُدّلت الملاحظة' : 'اكتب ملاحظة لا تتجاوز ١٢٠٠ حرفًا', saved ? 'ok' : 'danger');
    },

    async 'delete-note'(el) {
      const note = store.state.notes.find((item) => item.id === el.dataset.id && !item.deleted);
      if (!note) return;
      const ok = await confirmSheet({ title: 'حذف الملاحظة؟', desc: 'سيُحذف هذا الإدخال فقط من سجل الطالب.', confirmLabel: 'حذف الملاحظة', danger: true });
      if (!ok) return;
      await store.deleteStudentNote(note.id);
      toast('حُذفت الملاحظة');
    },

    async withdraw(el, ev, params) {
      const s = store.getStudent(params.id);
      if (!s) return;

      const ok = await confirmSheet({
        title: `${s.name} غادر المدرسة؟`,
        desc: 'يُنهى انتسابه ولا يُحذف — درجاته وحضوره وسجله تبقى كاملة ويمكن الرجوع إليها.',
        confirmLabel: 'سجّل مغادرته',
        danger: true,
      });
      if (!ok) return;
      await store.withdrawStudent(params.id);
      toast('سُجّلت مغادرته — سجلّه محفوظ');
    },

    async reinstate(el, ev, params) {
      const s = store.getStudent(params.id);
      const en = store.enrollmentsOf(params.id)[0];
      if (!s || !en) return;
      await store.reinstateStudent(params.id, en.sectionId);
      toast('أُعيد للدراسة');
    },
  },
};
