/**
 * ملف الطالب — الهوية، والانتسابات، والدرجات، والحضور.
 *
 * الطالب هوية مستقلة عن الشعبة. تبقى الدرجات منضبطة بالإسناد المعروض،
 * بينما يتبع سجل الحضور والرصد والملاحظات الطالب مع سياقه التاريخي الأصلي.
 */

import { html, icon, toast, fmtNum, fmtPct, fmtDate, fmtDateRange, openSheet, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import {
  itemScore, studentTotal, masteryBand, gradeLabel, sectionLabel,
  ATTENDANCE, ATTENDANCE_ORDER, ENROLLMENT_STATUS, STUDENT_STATUS, SESSION_STATUS,
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
    <button class="iconbtn noprint" data-act="share" aria-label="مشاركة الملخص">${icon('share')}</button>
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
    const currentEnrollment = store.activeEnrollment(s.id);
    const currentSection = currentEnrollment ? store.getSection(currentEnrollment.sectionId) : null;
    const items = tch ? store.items(tch.id) : [];
    const gradeCtx = store.studentContext(s.id, tch?.id);
    const studentHistory = store.studentHistory(s.id);
    const attendanceEvents = studentHistory.attendance;
    const logEvents = studentHistory.logs;
    const total = studentTotal(items, gradeCtx);
    const band = masteryBand(total.pct);

    const tally = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const event of attendanceEvents) {
      const status = event.record.status;
      tally[status] = (tally[status] ?? 0) + 1;
    }
    const sessions = attendanceEvents.length;
    const attendedPct = sessions ? ((tally.present + tally.late) / sessions) * 100 : null;

    const part = logEvents.filter((event) => event.record.kind === 'participation');
    const behav = logEvents.filter((event) => event.record.kind === 'behavior');
    const partNet = part.reduce((n, event) => n + event.record.delta, 0);
    const behavNet = behav.reduce((n, event) => n + event.record.delta, 0);

    const enrollmentHistory = store
      .enrollmentsOf(s.id)
      .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
    const notes = studentHistory.notes;
    const noteTime = (note) => new Date(note.createdAt ?? note.updatedAt ?? Date.now())
      .toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' });
    const eventContext = (event) => {
      const parts = [];
      if (event.contextLabel) parts.push(event.contextLabel);
      if (event.term?.name) parts.push(event.term.name);
      if (event.session) parts.push(`الحصة ${event.session.period}`);
      return parts;
    };
    const contextKind = (event) => !event.teaching
      ? 'سجل عام'
      : event.teaching.id === tch?.id ? 'السياق المعروض' : 'سياق سابق';

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
            ${currentSection ? html`<span class="badge badge--ok">الانتساب الحالي · ${sectionLabel(currentSection)}</span>` : ''}
            ${tch ? html`<span>السياق المعروض · ${store.teachingLabel(tch)}</span>` : ''}
            ${currentEnrollment?.rollNo != null ? html`<span class="student-profile-header__roll tabular">رقم الكشف: ${currentEnrollment.rollNo}</span>` : ''}
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
          <div class="stat__label">نسبة الحضور · كل السجل</div>
        </div>
        <div class="stat">
          <div class="stat__val tabular" style="color:var(--${partNet > 0 ? 'ok' : partNet < 0 ? 'danger' : 'text-2'})">
            ${partNet > 0 ? '+' : ''}${partNet}
          </div>
          <div class="stat__label">نقاط المشاركة · كل السجل</div>
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
          ${enrollmentHistory.length
            ? enrollmentHistory.map((en) => {
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
                        ${en.startDate ? fmtDateRange(en.startDate, en.endDate ?? en.startDate) : '—'}
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
                const v = itemScore(i, gradeCtx);
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
          <div>
            <div class="section__title">سجل الحضور المستمر</div>
            <div class="t-3 fs-xs">جميع الإسنادات، مع إبقاء سياق كل حصة الأصلي</div>
          </div>
          <div class="t-3 fs-sm"><span class="tabular">${sessions}</span> حصة مرصودة</div>
        </div>
        ${sessions === 0
          ? html`<div class="card card--pad t-3 center">لم يُرصد حضور بعد.</div>`
          : html`
              <div class="card">
                <div class="card--pad hstack gap-2 wrap">
                  ${ATTENDANCE_ORDER.map((k) =>
                    tally[k]
                      ? html`<span class="badge" style="background:var(--${ATTENDANCE[k].color}-soft);color:var(--${ATTENDANCE[k].color})">
                          ${ATTENDANCE[k].label} <span class="tabular">${tally[k]}</span>
                        </span>`
                      : ''
                  )}
                </div>
                ${attendanceEvents.map((event) => {
                  const attendance = event.record;
                  const meta = ATTENDANCE[attendance.status];
                  return html`
                    <div class="logrow student-history-row">
                      <span class="logrow__delta" style="color:var(--${meta?.color ?? 'text-2'})">
                        ${meta?.short ?? '—'}
                      </span>
                      <span class="logrow__main">
                        <span>${meta?.label ?? attendance.status}</span>
                        <span class="logrow__date">
                          ${fmtDate(event.date, false)}
                          <span class="badge">${contextKind(event)}</span>
                          ${eventContext(event).map((label) => html`<span class="badge">${label}</span> `)}
                          ${event.session ? html`<span class="badge">${SESSION_STATUS[event.session.status]?.label ?? event.session.status}</span>` : ''}
                        </span>
                      </span>
                    </div>
                  `;
                })}
                ${tally.absent >= 3
                  ? html`<p class="fs-sm card--pad" style="color:var(--danger)">
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
              ${notes.map((event) => {
                const note = event.record;
                return html`
                  <div class="logrow student-history-row">
                    <span class="logrow__main">
                      <span>${note.text}</span>
                      <span class="logrow__date">
                        ${fmtDate(event.date, false)} · <bdi class="tabular">${noteTime(note)}</bdi>
                        <span class="badge">${contextKind(event)}</span>
                        ${eventContext(event).map((label) => html`<span class="badge">${label}</span> `)}
                      </span>
                    </span>
                    <span class="row__end noprint">
                      <button class="iconbtn" data-act="edit-note" data-id="${note.id}" aria-label="تعديل ملاحظة">${icon('edit')}</button>
                      <button class="iconbtn" data-act="delete-note" data-id="${note.id}" aria-label="حذف ملاحظة">${icon('trash')}</button>
                    </span>
                  </div>
                `;
              })}
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

        ${logEvents.length
          ? html`
              <div class="card">
                ${logEvents.map(
                  (event) => {
                    const l = event.record;
                    return html`
                    <div class="logrow student-history-row">
                      <span class="logrow__delta ${l.delta > 0 ? 'is-pos' : 'is-neg'}">
                        ${l.delta > 0 ? '+' : '−'}${Math.abs(l.delta)}
                      </span>
                      <span class="logrow__main">
                        <span>${l.tag || (l.kind === 'participation' ? 'مشاركة' : 'سلوك')}</span>
                        <span class="logrow__date">
                          ${fmtDate(event.date)}
                          <span class="badge">${contextKind(event)}</span>
                          ${eventContext(event).map((label) => html`<span class="badge">${label}</span> `)}
                        </span>
                      </span>
                    </div>
                  `;
                  }
                )}
              </div>
            `
          : html`<div class="card card--pad t-3 center">لا رصد سريع بعد.</div>`}
      </div>

      <div class="section noprint">
        <div class="btn-row">
          <button class="btn btn--primary" data-act="share">${icon('share')} مشاركة الملخص</button>
          <button class="btn btn--ghost" data-act="print">${icon('print')} اطبع التقرير</button>
          ${s.status === 'active'
            ? html`<button class="btn btn--danger" data-act="withdraw">${icon('back')} غادر المدرسة</button>`
            : html`<button class="btn btn--ghost" data-act="reinstate">${icon('check')} أعده للدراسة</button>`}
        </div>
      </div>
    `;
  },

  actions: {
    async share(el, ev, params) {
      const s = store.getStudent(params.id);
      if (!s) return;
      const tch = resolveTeaching(s, params.teaching);
      const section = tch ? store.getSection(tch.sectionId) : null;
      const items = tch ? store.items(tch.id) : [];
      const gradeCtx = store.studentContext(s.id, tch?.id);
      const studentHistory = store.studentHistory(s.id);
      const total = studentTotal(items, gradeCtx);
      const band = masteryBand(total.pct);

      const tally = { present: 0, late: 0, excused: 0, absent: 0 };
      for (const event of studentHistory.attendance) {
        const status = event.record.status;
        tally[status] = (tally[status] ?? 0) + 1;
      }
      const sessions = studentHistory.attendance.length;
      const attendedPct = sessions ? Math.round(((tally.present + tally.late) / sessions) * 100) : null;

      const part = studentHistory.logs.filter((event) => event.record.kind === 'participation');
      const behav = studentHistory.logs.filter((event) => event.record.kind === 'behavior');
      const partNet = part.reduce((n, event) => n + event.record.delta, 0);
      const behavNet = behav.reduce((n, event) => n + event.record.delta, 0);

      const textParts = [
        `📊 ملخص أداء الطالب: ${s.name}`,
        section ? `🏫 الشعبة: ${sectionLabel(section)}` : '',
        tch ? `📚 المادة: ${store.getSubject(tch.subjectId)?.name ?? ''}` : '',
        '━━━━━━━━━━━━━━━',
        '📈 المستوى والدرجات:',
        `• المجموع: ${fmtNum(total.earned)} من ${total.outOfAll} (${total.pct != null ? `${fmtPct(total.pct)}` : '—'})`,
        band.label ? `• التقدير: ${band.label}` : '',
        '',
        '📅 سجل الحضور والمواظبة عبر جميع الإسنادات:',
        `• الحصص المرصودة: ${sessions}`,
        `• نسبة الحضور: ${attendedPct != null ? `${attendedPct}%` : '—'}`,
        `• الغياب: ${tally.absent} | التأخر: ${tally.late} | الاستئذان: ${tally.excused}`,
        '',
        '⭐ التفاعل والمشاركة:',
        `• نقاط المشاركة: ${partNet > 0 ? '+' : ''}${partNet}`,
        `• نقاط السلوك: ${behavNet > 0 ? '+' : ''}${behavNet}`,
        '━━━━━━━━━━━━━━━',
        'تطبيق رَكيز X للمعلم',
      ];

      const summaryText = textParts.filter(Boolean).join('\n');

      await openSheet({
        title: 'مشاركة ملخص الطالب',
        desc: 'ملخص شامل ومباشر لتقديمه لولي الأمر أو الإدارة.',
        body: html`
          <div class="share-preview-box">${summaryText}</div>
          <div class="stack stack-2 mt-3">
            <button class="btn btn--primary btn--block" id="btn-copy-summary">
              ${icon('copy')} نسخ الملخص
            </button>
            <a class="btn btn--ghost btn--block" href="https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}" target="_blank" rel="noopener">
              ${icon('share')} إرسال عبر واتساب
            </a>
            ${navigator.share
              ? html`
                  <button class="btn btn--quiet btn--block" id="btn-native-share">
                    ${icon('share')} مشاركة عبر النظام...
                  </button>
                `
              : ''}
          </div>
        `,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>`,
        onMount: (root, done) => {
          root.querySelector('#btn-copy-summary')?.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(summaryText);
              toast('تم نسخ الملخص للحافظة', 'ok');
            } catch {
              toast('تعذر النسخ التلقائي — حدد النص وانسخه يدويًا', 'danger');
            }
          });

          root.querySelector('#btn-native-share')?.addEventListener('click', async () => {
            try {
              await navigator.share({
                title: `ملخص أداء الطالب ${s.name}`,
                text: summaryText,
              });
            } catch {}
          });
        },
      });
    },

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
