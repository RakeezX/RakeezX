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
  ATTENDANCE, ATTENDANCE_ORDER, ENROLLMENT_STATUS, STUDENT_STATUS,
} from '../models.js';
import { studentAvatar } from '../lib/avatar.js';
import { openStudentManagement } from '../lib/student-lifecycle-ui.js';
import { demoOutputMarker, markDemoSharedText, resolvedReportPrincipalName } from '../lib/report-print.js';
import { getAccountPresentation } from '../lib/account-profile.js';
import { studentAchievements, achievementCard, drawAchievementCard, achievementPng } from '../lib/student-achievements.js';
import { openAchievementCertificate } from '../lib/achievement-certificate.js';
const achievementsStyleUrl = new URL('../styles/student-achievements.css', import.meta.url).href;

/** الإسناد المعروض: المطلوب في الرابط، أو أول إسناد لشعبة الطالب الحالية. */
function resolveTeaching(student, requested) {
  const active = store.activeEnrollment(student.id);
  const requestedTeaching = requested ? store.getTeaching(requested) : null;
  if (requestedTeaching && (!active || requestedTeaching.sectionId === active.sectionId)) {
    return requestedTeaching;
  }
  const en = active ?? store.enrollmentsOf(student.id)[0];
  if (!en) return null;
  return store.teachings().find((t) => t.sectionId === en.sectionId) ??
    store.teachings(null, { includeArchived: true }).find((t) => t.sectionId === en.sectionId) ?? null;
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

export function studentManagementSuccessDestination(action, teaching, enrollmentSectionId, archived = false) {
  if (action !== 'delete' && action !== 'end') return null;
  return teaching && !archived && teaching.sectionId === enrollmentSectionId
    ? `#/teaching/${teaching.id}/students` : '#/classes';
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
    if (p.from === 'former-students') return '#/archive/former-students';
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
    const achievements = studentAchievements({ studentId: s.id, history: studentHistory, items, gradeCtx });

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
    const previousContexts = studentHistory.contexts.filter((context) => context.teaching.id !== tch?.id);
    const currentContext = !!tch && currentEnrollment?.sectionId === tch.sectionId &&
      store.activeTerm()?.id === tch.termId && !store.isTeachingArchived(tch);
    const noteTime = (note) => new Date(note.createdAt ?? note.updatedAt ?? Date.now())
      .toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit', numberingSystem: 'latn' });
    const eventContext = (event) => {
      const parts = [];
      if (event.contextLabel) parts.push(event.contextLabel);
      if (event.term?.name) parts.push(event.term.name);
      if (event.session) parts.push(`الحصة ${event.session.period}`);
      return parts;
    };
    const contextKind = (event) => !event.teaching
      ? 'سجل عام'
      : event.teaching.id === tch?.id
        ? (currentContext ? 'السجل الحالي' : 'سياق تاريخي معروض')
        : 'سياق سابق';
    const historicalScore = (event) => {
      const value = Number(event.record.value);
      return Number.isFinite(value) ? Math.min(event.item.max, Math.max(0, value)) : null;
    };
    const canEditNote = (event) => currentContext && !store.isTeachingArchived(tch) && !store.isTermClosed(tch.termId) &&
      (!event.teaching || event.teaching.id === tch.id);

    return html`
      <div class="management-page student-profile-page">
      <link rel="stylesheet" href="${achievementsStyleUrl}">
      <div class="printhead">
        ${demoOutputMarker()}
        <div class="printhead__title">${s.name}</div>
        <div class="printhead__sub">
          ${section ? sectionLabel(section) : ''}
          ${tch ? '· ' + (store.getSubject(tch.subjectId)?.name ?? '') : ''}
          ${tch ? '· ' + (store.getTerm(tch.termId)?.name ?? '') : ''}
          ${store.state.profile?.schoolName ? ` · ${store.state.profile.schoolName}` : ''}
        </div>
      </div>

      <div class="student-profile-header rakeez-accent-surface noprint mb-3">
        ${studentAvatar(s, 'lg')}
        <div class="student-profile-header__info">
          <div class="student-profile-header__name">${s.name}</div>
          <div class="student-profile-header__meta">
            ${currentSection ? html`<span class="badge badge--ok">الانتساب الحالي · ${sectionLabel(currentSection)}</span>` : ''}
            ${tch ? html`<span>${currentContext ? 'السجل الحالي' : 'سياق تاريخي معروض'} · ${store.teachingLabel(tch)}</span>` : ''}
            ${currentEnrollment?.rollNo != null ? html`<span class="student-profile-header__roll tabular">رقم الكشف: ${currentEnrollment.rollNo}</span>` : ''}
          </div>
        </div>
        <button class="btn btn--ghost student-profile-management" data-act="manage-student">${icon('settings')} إدارة الطالب</button>
      </div>

      ${s.status === 'withdrawn'
        ? html`<div class="card card--pad mb-3 banner-closed">
            ${icon('note')} هذا الطالب غادر المدرسة — سجلّه محفوظ كاملًا للعرض.
          </div>`
        : ''}

      <div class="grid grid--3 management-overview student-profile-summary mb-3" aria-label="ملخص الطالب الحالي">
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

      <section class="section student-profile-section student-achievements noprint" aria-labelledby="student-achievements-title">
        <div class="section__head wrap">
          <h2 class="section__title" id="student-achievements-title">إنجازات من السجل</h2>
          <span class="badge">للمعلم · للقراءة فقط</span>
          <button class="btn btn--quiet" data-act="share-achievement">${icon('board')} بطاقة إنجاز</button>
          <button class="btn btn--quiet" data-act="achievement-certificate">${icon('star')} شهادة تقدير</button>
        </div>
        <p class="student-achievements__intro">نحتفي بإنجازات موثّقة من السجلات المتاحة، دون نقاط إضافية أو ترتيب بين الطلاب. المشاركة والحضور يشملان كل السجل؛ الدرجات تخص الإسناد المعروض.</p>
        ${achievements.length ? html`
          <div class="student-achievements__grid">
            ${achievements.map((achievement) => html`
              <div class="card card--pad student-achievements__fact" data-achievement="${achievement.key}">
                <div class="student-achievements__emblem">${icon(achievement.key === 'scores' ? 'board' : achievement.key === 'participation' ? 'star' : 'attendance', 'hero')}</div>
                <div class="student-achievements__count tabular">${fmtNum(achievement.count)}</div>
                <strong>${achievement.title}</strong>
                <div class="student-achievements__detail">${achievement.detail}</div>
                <div class="student-achievements__source">المصدر: ${achievement.source}</div>
              </div>
            `)}
          </div>
        ` : html`<div class="card card--pad t-3">لا توجد إنجازات موثّقة لعرضها بعد. تظهر هنا عند توفر رصد مشاركة إيجابية أو حضور أو درجة كاملة.</div>`}
      </section>

      <!-- الدرجات -->
      <div class="section student-profile-section student-profile-current-grades">
        <div class="section__head">
          <div class="section__title">الدرجات${tch ? ` — ${store.getSubject(tch.subjectId)?.name ?? ''}` : ''}</div>
          <div class="t-3 fs-sm tabular">${fmtNum(total.earned)} / ${total.outOfAll}</div>
        </div>
        <div class="card">
          ${items.length === 0
            ? html`<div class="card--pad t-3 center">لا بنود تقييم في هذا الفصل.</div>`
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

      ${previousContexts.length
        ? html`
            <details class="section student-profile-section student-profile-disclosure student-previous-history">
              <summary class="student-profile-disclosure__summary">
                <div>
                  <div class="section__title">السجل السابق</div>
                  <div class="t-3 fs-xs">عرض للقراءة فقط؛ كل سجل يبقى في فصله الأصلي</div>
                </div>
                <span class="student-profile-disclosure__meta"><span class="tabular">${previousContexts.length}</span> سجل</span>
              </summary>
              <div class="student-profile-disclosure__body stack stack-3">
                ${previousContexts.map((context) => html`
                  <div class="card" data-history-teaching="${context.teaching.id}">
                    <div class="card--pad stack stack-2">
                      <div class="hstack gap-2 wrap">
                        <strong>${store.teachingLabel(context.teaching)}</strong>
                        <span class="badge">للقراءة فقط</span>
                        ${store.isTeachingArchived(context.teaching) || store.isTermClosed(context.teaching.termId)
                          ? html`<span class="badge badge--warn">مؤرشف</span>` : ''}
                      </div>
                      <div class="t-3 fs-sm hstack gap-2 wrap">
                        ${context.year?.label ? html`<span>${context.year.label}</span>` : ''}
                        ${context.term?.name ? html`<span>${context.term.name}</span>` : ''}
                        <span><span class="tabular">${context.attendance.length}</span> حضور</span>
                        <span><span class="tabular">${context.logs.length}</span> رصد</span>
                        <span><span class="tabular">${context.notes.length}</span> ملاحظة</span>
                      </div>
                    </div>
                    ${context.scores.length
                      ? html`
                          <div class="history-context-grades">
                            ${context.scores.map((event) => {
                              const value = historicalScore(event);
                              return html`
                                <div class="itemrow">
                                  <div class="itemrow__head">
                                    <span class="itemrow__name">${event.item.name}</span>
                                    <span class="itemrow__val tabular ${value === null ? 't-3' : ''}">
                                      ${value === null ? 'غير متاح' : `${fmtNum(value)} / ${event.item.max}`}
                                    </span>
                                  </div>
                                </div>
                              `;
                            })}
                          </div>
                        `
                      : ''}
                  </div>
                `)}
              </div>
            </details>
          `
        : ''}

      <!-- الحضور -->
      <details class="section student-profile-section student-profile-disclosure student-attendance-history">
        <summary class="student-profile-disclosure__summary">
          <div>
            <div class="section__title">سجل الحضور المستمر</div>
            <div class="t-3 fs-xs">جميع الفصول، مع إبقاء سياق كل حصة الأصلي</div>
          </div>
          <span class="student-profile-disclosure__meta"><span class="tabular">${sessions}</span> حصة</span>
        </summary>
        <div class="student-profile-disclosure__body">
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
                          ${event.session ? html`<span class="badge">${store.sessionStatusPresentation(event.session).label}</span>` : ''}
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
      </details>

      <!-- الملاحظات المؤرخة -->
      <details class="section student-profile-section student-profile-disclosure student-notes-history">
        <summary class="student-profile-disclosure__summary">
          <div class="section__title">الملاحظات</div>
          <span class="student-profile-disclosure__meta"><span class="tabular">${notes.length}</span> ملاحظة</span>
        </summary>
        <div class="student-profile-disclosure__body">
          <div class="student-profile-disclosure__actions noprint">
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
                    ${canEditNote(event)
                      ? html`<span class="row__end noprint">
                          <button class="iconbtn" data-act="edit-note" data-id="${note.id}" aria-label="تعديل ملاحظة">${icon('edit')}</button>
                          <button class="iconbtn" data-act="delete-note" data-id="${note.id}" aria-label="حذف ملاحظة">${icon('trash')}</button>
                        </span>`
                      : ''}
                  </div>
                `;
              })}
            </div>`
          : html`<div class="card card--pad center t-3 stack stack-2">
              <div>لا توجد ملاحظات مسجلة لهذا الطالب.</div>
              <div><button class="btn btn--quiet" data-act="add-note">${icon('plus')} إضافة ملاحظة</button></div>
            </div>`}
        </div>
      </details>

      <!-- المشاركة والسلوك -->
      <details class="section student-profile-section student-profile-disclosure student-engagement-history">
        <summary class="student-profile-disclosure__summary">
          <div class="section__title">المشاركة والسلوك</div>
          <span class="student-profile-disclosure__meta"><span class="tabular">${logEvents.length}</span> رصد</span>
        </summary>
        <div class="student-profile-disclosure__body">
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
      </details>

      <!-- سجل الانتساب: مرجع تاريخي منخفض الأولوية -->
      <details class="section student-profile-section student-profile-disclosure student-profile-enrollment">
        <summary class="student-profile-disclosure__summary">
          <div class="section__title">سجل الانتساب</div>
          <span class="student-profile-disclosure__meta"><span class="tabular">${enrollmentHistory.length}</span> سجل</span>
        </summary>
        <div class="student-profile-disclosure__body card">
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
                        ${sectionLabel(sec) || 'فصل محذوف'}
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
      </details>

      <div class="section student-profile-actions noprint">
        <div class="btn-row student-profile-actions__row">
          <button class="btn btn--primary" data-act="share">${icon('board')} مشاركة الملخص</button>
          <button class="btn btn--ghost" data-act="print">${icon('print')} اطبع التقرير</button>
        </div>
      </div>
      </div>
    `;
  },

  actions: {
    async 'achievement-certificate'(el, ev, params) {
      const s = store.getStudent(params.id);
      if (!s) return;
      const tch = resolveTeaching(s, params.teaching);
      const profile = store.state.profile ?? {};
      const presentation = getAccountPresentation(profile.teacherForm);
      await openAchievementCertificate({
        studentName: s.name, demo: markDemoSharedText([]).length > 0, metadata: {
        schoolName: profile.schoolName,
        educationDepartment: profile.educationDepartment,
        teacherName: profile.teacherName,
        principalName: resolvedReportPrincipalName(profile, store.state.device),
        teacherLabel: presentation.teacherSubjectLabel,
        principalLabel: presentation.schoolPrincipalLabel,
        className: tch ? sectionLabel(store.getSection(tch.sectionId)) : '',
        subjectName: tch ? store.getSubject(tch.subjectId)?.name : '',
      } });
    },

    async 'share-achievement'(el, ev, params) {
      const s = store.getStudent(params.id);
      if (!s) return;
      const tch = resolveTeaching(s, params.teaching);
      const input = {
        studentId: s.id,
        items: tch ? store.items(tch.id) : [],
        gradeCtx: store.studentContext(s.id, tch?.id),
        history: store.studentHistory(s.id),
      };
      const available = achievementCard(input, { selected: ['participation', 'scores'] }).evidence;
      await openSheet({
        title: 'بطاقة إنجاز',
        desc: 'اختر ما يظهر في البطاقة وراجع الصورة قبل تنزيلها. تُنشأ محليًا دون رفع أو إرسال.',
        body: html`
          <div class="achievement-card-editor" dir="rtl">
            <fieldset class="achievement-card-options">
              <legend>محتوى البطاقة — باختيارك فقط</legend>
              <label><input type="checkbox" data-card-name> إظهار اسم الطالب (اختياري)</label>
              ${available.map(fact => html`<label><input type="checkbox" data-card-field="${fact.key}">
                ${fact.title} · ${fmtNum(fact.count)}<small>${fact.scope}</small></label>`)}
              ${!available.length ? html`<p>لا توجد مشاركة إيجابية أو درجة كاملة موثّقة متاحة للبطاقة حاليًا.</p>` : ''}
            </fieldset>
            <canvas class="achievement-card-preview" aria-label="معاينة بطاقة الإنجاز المختارة" role="img"></canvas>
            <p data-card-status role="status">اختر إنجازًا واحدًا على الأقل. الاسم مخفي افتراضيًا.</p>
            <label class="achievement-card-consent"><input type="checkbox" data-card-confirm disabled>
              راجعت البطاقة وأوافق على تنزيل المحتوى المختار</label>
          </div>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>
          <button class="btn btn--primary" data-card-download disabled>${icon('download')} تنزيل PNG</button>`,
        onMount: (root) => {
          const canvas = root.querySelector('canvas');
          const confirm = root.querySelector('[data-card-confirm]');
          const download = root.querySelector('[data-card-download]');
          const status = root.querySelector('[data-card-status]');
          let card;
          let busy = false;
          const update = () => {
            confirm.checked = false;
            download.disabled = true;
            card = achievementCard(input, {
              selected: [...root.querySelectorAll('[data-card-field]:checked')].map(field => field.dataset.cardField),
              includeName: root.querySelector('[data-card-name]').checked,
              studentName: s.name,
              demo: markDemoSharedText([]).length > 0,
            });
            confirm.disabled = !card.evidence.length;
            try {
              drawAchievementCard(canvas, card);
              canvas.setAttribute('aria-label', [card.title, card.name, ...card.evidence.map(fact => `${fact.title}: ${fact.count} — ${fact.scope}`)].filter(Boolean).join('، '));
              status.textContent = card.evidence.length ? 'هذه الصورة هي محتوى التنزيل. لا تشمل تفاصيل الحضور أو السجل الخاص.' : 'اختر إنجازًا واحدًا على الأقل. الاسم مخفي افتراضيًا.';
            } catch {
              confirm.disabled = true;
              status.textContent = 'تعذرت معاينة الصورة في هذا المتصفح.';
            }
          };
          root.querySelectorAll('[data-card-field], [data-card-name]').forEach(field => field.addEventListener('change', update));
          confirm.addEventListener('change', () => { download.disabled = !confirm.checked || confirm.disabled || busy; });
          download.addEventListener('click', async () => {
            if (busy || download.disabled) return;
            busy = true;
            download.disabled = true;
            const selectedCard = card;
            let url;
            try {
              const blob = await achievementPng(canvas, selectedCard, confirm.checked);
              if (!root.isConnected || selectedCard !== card || !confirm.checked) return;
              url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'achievement-card.png';
              link.click();
              toast('تم تنزيل بطاقة الإنجاز محليًا', 'ok');
            } catch {
              toast('تعذر تنزيل الصورة — حاول مرة أخرى', 'danger');
            } finally {
              if (url) URL.revokeObjectURL(url);
              busy = false;
              confirm.checked = false;
              download.disabled = true;
            }
          });
          update();
          document.fonts?.ready.then(() => { if (root.isConnected) update(); });
        },
      });
    },

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
        section ? `🏫 الفصل: ${sectionLabel(section)}` : '',
        tch ? `📚 المادة: ${store.getSubject(tch.subjectId)?.name ?? ''}` : '',
        '━━━━━━━━━━━━━━━',
        '📈 المستوى والدرجات:',
        `• المجموع: ${fmtNum(total.earned)} من ${total.outOfAll} (${total.pct != null ? `${fmtPct(total.pct)}` : '—'})`,
        band.label ? `• التقدير: ${band.label}` : '',
        '',
        '📅 سجل الحضور والمواظبة عبر جميع الفصول:',
        `• الحصص المرصودة: ${sessions}`,
        `• نسبة الحضور: ${attendedPct != null ? `${attendedPct}%` : '—'}`,
        `• الغياب: ${tally.absent} | التأخر: ${tally.late} | الاستئذان: ${tally.excused}`,
        '',
        '⭐ التفاعل والمشاركة:',
        `• نقاط المشاركة: ${partNet > 0 ? '+' : ''}${partNet}`,
        `• نقاط السلوك: ${behavNet > 0 ? '+' : ''}${behavNet}`,
        '━━━━━━━━━━━━━━━',
        'تطبيق رَكيز المعلم',
      ];

      const summaryText = markDemoSharedText(textParts.filter(Boolean)).join('\n');

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
      toast(saved ? 'حُفظت الملاحظة' : 'اكتب ملاحظة لا تتجاوز 1200 حرفًا', saved ? 'ok' : 'danger');
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
      toast(saved ? 'عُدّلت الملاحظة' : 'اكتب ملاحظة لا تتجاوز 1200 حرفًا', saved ? 'ok' : 'danger');
    },

    async 'delete-note'(el) {
      const note = store.state.notes.find((item) => item.id === el.dataset.id && !item.deleted);
      if (!note) return;
      const ok = await confirmSheet({ title: 'حذف الملاحظة؟', desc: 'سيُحذف هذا الإدخال فقط من سجل الطالب.', confirmLabel: 'حذف الملاحظة', danger: true });
      if (!ok) return;
      await store.deleteStudentNote(note.id);
      toast('حُذفت الملاحظة');
    },

    async manageStudent(el, ev, params) {
      // Capture the originating Teaching before a successful command removes the active enrollment.
      const enrollmentSectionId = store.activeEnrollment(params.id)?.sectionId;
      const teaching = params.teaching ? store.getTeaching(params.teaching) : null;
      const archived = teaching ? store.isTeachingArchived(teaching) : false;
      const result = await openStudentManagement(params.id);
      const destination = studentManagementSuccessDestination(result?.action, teaching, enrollmentSectionId, archived);
      if (destination) location.hash = destination;
      else {
        // Restore to the current control after any runtime-triggered profile render.
        await new Promise(resolve => requestAnimationFrame(resolve));
        document.querySelector('[data-act="manage-student"]')?.focus({ preventScroll: true });
      }
    },

  },
};
