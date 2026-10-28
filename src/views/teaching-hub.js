/** لوحة الإسناد: مدخل لكل أدواته، وملخّص حاله اليوم. */

import { html, icon, openSheet, toast, fmtPct, fmtTimeRange } from '../lib/dom.js';
import * as store from '../store.js';
import { compactSubjectLabel } from '../lib/subject-catalog.js';
import { compactSectionLabel } from '../lib/class-order.js';
import { gradeLabel, todayISO, studentTotal, sectionLabel, ATTENDANCE, GRADES, SECTION_COLORS, safeColor, normalizeSectionLabel } from '../models.js';
import { go, teachingRouteId } from '../router.js';
import { repaint } from '../repaint.js';
import { activeGoalSummary, watchActiveGoalTimer } from './class-rules.js';
import studentsView, { canOpenRoster, classAccessFeedback } from './students.js';
import teachingsView, { addSubjectToClass } from './teachings.js';

// Loaded only after an explicit support action; not an offline startup dependency.
function sourceReadinessSupport() {
  return html`<details class="card card--pad mt-3" data-source-readiness style="min-width:0">
    <summary>تشخيص مصادر التذكيرات للدعم</summary>
    <p class="t-3 fs-sm">للدعم فقط: اختر ملف الطلب الموثوق من مسؤول التجربة. يُحفظ تقرير مشفّر محليًا دون أسماء الطلاب أو درجاتهم، ولا يُرسل تلقائيًا أو يفعّل التذكيرات.</p>
    <label class="fs-sm">ملف طلب الدعم <input type="file" accept=".json,application/json" style="display:block;width:100%;min-width:0;max-width:100%" data-source-challenge></label>
    <button type="button" class="btn btn--quiet mt-3" data-act="source-readiness-capture">حفظ تقرير مشفّر</button>
    <p class="t-3 fs-sm" role="status" data-source-status></p>
  </details>`;
}

const TOOLS = (id) => [
  { href: `#/teaching/${teachingRouteId(id)}/student-portal`, icon: 'students', title: 'مساحة الطلاب', sub: 'رموز الدخول والحقول المنشورة' },
  { href: `#/teaching/${teachingRouteId(id)}/class-rules`, icon: 'book', title: 'هدف وميثاق الصف', sub: 'الهدف الرئيسي والميثاق' },
  { href: `#/teaching/${teachingRouteId(id)}/quicklog`, icon: 'spark', title: 'الرصد السريع', sub: 'مشاركة وسلوك أثناء الحصة' },
  { href: `#/teaching/${teachingRouteId(id)}/picker`, icon: 'picker', title: 'القرعة', sub: 'اختيار عادل لا يكرّر أحدًا' },
  { href: `#/teaching/${teachingRouteId(id)}/groups`, icon: 'groups', title: 'المجموعات', sub: 'تقسيم عشوائي أو متوازن' },
  { href: `#/teaching/${teachingRouteId(id)}/board`, icon: 'board', title: 'لوحة التميز', sub: 'لعرض التميز على البروجكتر' },
  { href: `#/teaching/${teachingRouteId(id)}/sessions`, icon: 'session', title: 'الحصص', sub: 'السجل والحصص السابقة' },
  { href: `#/teaching/${teachingRouteId(id)}/koshoof`, icon: 'upload', title: 'الكشوف', sub: 'استيراد وتصدير الكشوف' },
  { href: `#/teaching/${teachingRouteId(id)}/reports`, icon: 'reports', title: 'التقارير', sub: 'طباعة وتقارير الفصل' },
  { href: `#/teaching/${teachingRouteId(id)}/items`, icon: 'note', title: 'توزيع الدرجات', sub: 'البنود والدرجات العظمى' },
];
function classHubHeader({ tch, sec, sub, targetSession, completeness, markedCount, rosterCount }) {
  return html`
    <div class="class-hub-header mb-3">
      <div class="class-hub-header__top">
        <div class="class-hub-header__identity-block">
          <span class="class-hub-header__color-bar" style="background:${sec?.color || 'var(--brand)'}" aria-hidden="true"></span>
          <div class="class-hub-header__name-group">
            <button type="button" class="class-name-switcher-btn" data-act="switch-class" aria-label="تبديل الفصل: ${sectionLabel(sec) || 'الفصل'}" title="${sectionLabel(sec) || 'تبديل الفصل'}">
              <span class="class-name-switcher-btn__title">
                <span class="class-identity-full">${sectionLabel(sec) || 'الفصل'}</span>
                <span class="class-identity-short" aria-hidden="true">${compactSectionLabel(sec) || 'الفصل'}</span>
              </span>
              <span class="class-name-switcher-btn__chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
            </button>
            ${sub?.name ? html`<span class="class-hub-header__sep" aria-hidden="true">—</span><span class="class-hub-header__sub" role="text" aria-label="${sub.name}" title="${sub.name}"><span class="class-identity-full">${sub.name}</span><span class="class-identity-short" aria-hidden="true">${compactSubjectLabel(sub, store.subjects())}</span></span>` : ''}
          </div>
        </div>
        <div class="class-hub-header__end">
          ${sec && store.activeTerm()?.id === tch.termId && !store.isTermClosed(tch.termId) ? html`
            <button type="button" class="iconbtn" data-act="add-subject"
                    aria-label="إضافة مادة أخرى لهذا الفصل" title="إضافة مادة أخرى لهذا الفصل">
              ${icon('plus')}
            </button>
          ` : ''}
          <button class="iconbtn" data-act="edit-sec" aria-label="تعديل الفصل" title="تعديل الفصل">${icon('settings')}</button>
        </div>
      </div>
      ${targetSession ? html`
        <div class="class-hub-lesson-bar">
          <span class="class-hub-lesson-bar__meta"><strong>الحصة ${targetSession.period}</strong>${targetSession.startTime ? html`${fmtTimeRange(targetSession.startTime, targetSession.endTime)}` : ''}</span>
          <span class="class-hub-lesson-bar__status ${completeness?.state === 'completed' ? 'is-done' : 'is-pending'}">${completeness?.state === 'completed' ? `الحضور ${markedCount}/${rosterCount}` : 'بانتظار الرصد'}</span>
          <a class="btn btn--sm ${completeness?.state === 'pending' ? 'btn--primary' : 'btn--quiet'}" href="#/teaching/${teachingRouteId(tch.id)}/attendance?session=${targetSession.id}">${completeness?.state === 'completed' ? 'تعديل الحضور' : 'رصد الحضور'}</a>
        </div>` : ''}
    </div>
  `;
}

function activeGoalIndicator(teachingId, activeGoal) {
  if (!activeGoal) return '';
  return html`
    <a class="class-goal-indicator" href="#/teaching/${teachingRouteId(teachingId)}/class-rules" aria-label="الهدف النشط: ${activeGoal.goal}">
      <span class="class-goal-indicator__status">${icon('clock')} هدف نشط</span>
      <strong class="class-goal-indicator__title">${activeGoal.goal}</strong>
      <span class="class-goal-indicator__timer tabular" aria-label="الوقت المتبقي ${activeGoal.countdown}">${activeGoal.countdown}</span>
      <span class="class-goal-indicator__reward tabular">+${activeGoal.reward} مشاركة</span>
      <span class="class-goal-indicator__chevron">${icon('chev')}</span>
    </a>
  `;
}

export default {
  title: (p) => {
    const tch = store.getTeaching(p.id);
    return sectionLabel(store.getSection(tch?.sectionId)) || 'فصل';
  },
  subtitle: (p) => {
    const teaching = store.getTeaching(p.id);
    const subject = store.getSubject(teaching?.subjectId);
    return subject?.name ?? '';
  },

  back: () => '#/classes',

  render(p) {
    const feedback = classAccessFeedback(p);
    if (feedback) return feedback;
    const tch = store.getTeaching(p.id);
    if (!tch) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('classes')}</div>
          <div class="empty__title">هذا الفصل غير موجود</div>
          <a class="btn btn--ghost" href="#/classes">العودة للفصول</a>
        </div>
      `;
    }
    if (store.isTeachingArchived(tch)) {
      return html`<div class="empty"><div class="empty__icon">${icon('archive')}</div><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">بيانات الفصل محفوظة للعرض التاريخي، ولا تتوفر إجراءات تشغيلية قبل إعادة فتحه.</div><a class="btn btn--ghost" href="#/classes">العودة للفصول</a></div>`;
    }

    const { roster, items, ctx } = store.teachingContext(tch.id);
    const today = todayISO();
    const todaySessions = store.sessionsOnFor(tch.id, today);
    const sec = store.getSection(tch.sectionId);
    const sub = store.getSubject(tch.subjectId);
    const targetSession = todaySessions.find((s) => store.attendanceCompleteness(s).state === 'pending') || todaySessions[0];
    const completeness = targetSession ? store.attendanceCompleteness(targetSession) : null;
    const markedCount = targetSession ? store.attendanceIn(targetSession.id).length : 0;
    const activeGoal = activeGoalSummary(tch.id);

    if (!roster.length) {
      return html`
        <div class="class-hub">
          ${classHubHeader({ tch, sec, sub, targetSession, completeness, markedCount, rosterCount: roster.length })}
          ${activeGoalIndicator(tch.id, activeGoal)}
          ${sourceReadinessSupport()}
          <div class="class-hub__empty empty">
            <div class="empty__icon">${icon('student')}</div>
            <div class="empty__title">لا يوجد طلاب في الفصل</div>
            <div class="empty__text">
              الصق الأسماء، أو استورد الطلاب من ملف أو إضافة ركيز، أو أضف طالبًا يدويًا.
            </div>
            ${canOpenRoster(p) ? html`<div class="roster-entry-empty">
              <div class="roster-entry-actions" role="group" aria-label="إضافة أسماء الطلاب">
                <button class="btn" data-act="paste-names" aria-label="لصق الأسماء">${icon('upload')} لصق الأسماء</button>
                <button class="btn" data-act="add-student" aria-label="إضافة طالب">${icon('plus')} إضافة طالب</button>
                <a class="btn btn--primary" data-act="file-import" href="#/teaching/${teachingRouteId(p.id)}/koshoof">${icon('upload')} استيراد الطلاب</a>
              </div>
            </div>` : ''}
          </div>
        </div>
      `;
    }

    const totals = roster.map((s) => studentTotal(items, ctx[s.id]));
    const graded = totals.filter((t) => t.pct !== null);
    const avg = graded.length ? graded.reduce((n, t) => n + t.pct, 0) / graded.length : null;
    const needSupport = totals.filter((t) => t.pct !== null && t.pct < 50).length;
    const weekly = store.weeklyPeriods(tch.id);
    const held = store.sessionsOf(tch.id).filter((s) => s.status === 'held').length;

    return html`
      <div class="class-hub">
      ${classHubHeader({ tch, sec, sub, targetSession, completeness, markedCount, rosterCount: roster.length })}
      ${activeGoalIndicator(tch.id, activeGoal)}
          ${sourceReadinessSupport()}
      <div class="section">
        <div class="section__head">
          <div class="section__title">حصص اليوم</div>
          <a class="btn btn--sm btn--quiet" href="#/teaching/${teachingRouteId(tch.id)}/attendance">
            ${todaySessions.length ? 'افتح' : 'ابدأ'} ${icon('back')}
          </a>
        </div>
        ${todaySessions.length
          ? html`
              <div class="list">
                ${todaySessions.map((s) => {
                  const m = store.sessionStatusPresentation(s);
                  const marked = store.attendanceIn(s.id).length;
                  return html`
                    <a class="row" href="#/teaching/${teachingRouteId(tch.id)}/attendance?session=${s.id}">
                      <span class="period">${s.period}</span>
                      <span class="row__main">
                        <span class="row__title">الحصة ${s.period}</span>
                        <span class="row__sub">
                          ${s.startTime ? html`${fmtTimeRange(s.startTime, s.endTime)} · ` : ''}
                          ${m.label}
                          ${s.status === 'held' ? html` · <span class="tabular">${marked}/${roster.length}</span> مرصود` : ''}
                        </span>
                      </span>
                      <span class="row__end">
                        <span class="badge ${m.tone ? 'badge--' + m.tone : ''}">${m.label}</span>
                        ${icon('chev')}
                      </span>
                    </a>
                  `;
                })}
              </div>
            `
          : html`
              <div class="card card--pad center">
                <div class="t-3 fs-md">لا حصة مسجّلة اليوم.</div>
                <p class="t-3 fs-sm mt-3">
                  ${weekly
                    ? html`جدولك يقول <span class="tabular">${weekly}</span> حصص أسبوعيًا لهذا الفصل.`
                    : 'أضف حصص هذا الفصل الأسبوعية من «الجدول».'}
                </p>
                <a class="btn btn--sm btn--primary mt-3" href="#/teaching/${teachingRouteId(tch.id)}/attendance">
                  ${icon('attendance')} افتح حصة اليوم
                </a>
              </div>
            `}
      </div>

      <div class="section class-tools-section">
        <div class="section__head">
          <div class="section__title">أدوات الفصل</div>
          <span class="t-3 fs-sm"><span class="tabular">${held}</span> حصة منفّذة</span>
        </div>
        <div class="grid quick-tools-grid" aria-label="أدوات الفصل">
          ${TOOLS(tch.id).map(
            (t) => html`
              <a class="tile class-tool-card" href="${t.href}" aria-label="${t.title} — ${t.sub}">
                <span class="tile__icon">${icon(t.icon)}</span>
                <span class="class-tool-card__copy">
                  <span class="tile__title">${t.title}</span>
                  <span class="tile__sub">${t.sub}</span>
                </span>
              </a>
            `
          )}
        </div>
      </div>
      <div class="section class-stats-section" aria-label="ملخص الفصل">
        <div class="grid grid--3 class-hub-stats">
          <div class="stat">
            <div class="stat__val tabular">${roster.length}</div>
            <div class="stat__label">${roster.length === 1 ? "طالب" : "طالبًا"}</div>
          </div>
          <div class="stat">
            <div class="stat__val tabular">${avg === null ? '—' : fmtPct(avg)}</div>
            <div class="stat__label">متوسط المرصود</div>
          </div>
          <div class="stat">
            <div class="stat__val tabular" style="${needSupport ? 'color:var(--danger)' : ''}">${needSupport}</div>
            <div class="stat__label">يحتاج دعمًا</div>
          </div>
        </div>
      </div>
      </div>
    `;
  },

  afterPaint(root, params) {
    watchActiveGoalTimer(params.id);
  },

  actions: {
    async 'source-readiness-capture'(el, ev, params) {
      const panel = el.closest('[data-source-readiness]'), status = panel?.querySelector('[data-source-status]');
      if (!panel || el.dataset.sourceBusy === 'true') return;
      const file = panel.querySelector('[data-source-challenge]').files?.[0];
      if (!file || file.size > 8192) { status.textContent = 'اختر ملف طلب دعم صالحًا ومحدود الحجم.'; return; }
      el.dataset.sourceBusy = 'true'; el.setAttribute('aria-busy','true'); delete status.dataset.sourceError; delete status.dataset.sourceStage; delete status.dataset.sourceCategory; status.textContent = 'جارٍ التحقق وحفظ التقرير محليًا…';
      let url, stage = 'file_read';
      try {
        const raw = await file.text();
        stage = 'module_load';
        const { captureNotificationSourceReadiness } = await import('../lib/notification-source-readiness.js');
        stage = 'capture';
        const receipt = await captureNotificationSourceReadiness(raw, params.id, panel);
        if (!panel.isConnected) return;
        stage = 'download';
        url = URL.createObjectURL(new Blob([JSON.stringify(receipt)], {type:'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = 'rakeez-source-readiness.encrypted.json';
        link.click(); status.textContent = 'تم حفظ التقرير المشفّر. لا يعني ذلك تفعيل التذكيرات أو اجتياز التجربة.';
      } catch (error) {
        const codes = ['challenge_shape','challenge_size','challenge_authority','challenge_identity','challenge_expired','challenge_scope','challenge_time','challenge_key','context_unavailable','context_replaced','owner_changed','not_writable','draft_open','ancestry_unconfirmed','ancestry_inactive','source_bound','scope_mismatch','key_size','sync_pending','snapshot_changed','timezone','calendar','lesson_time','challenge_used','receipt_size'];
        status.dataset.sourceError = codes.includes(error?.message) ? error.message : 'unavailable';
        const stages = ['challenge','context','ancestry','scope','key_import','sync','calendar','reservation','encryption','final_checkpoint'];
        const categories = ['Error','TypeError','SyntaxError','RangeError','ReferenceError','DataError','OperationError','NotSupportedError','SecurityError','NotReadableError','AbortError','InvalidAccessError','InvalidStateError','QuotaExceededError'];
        status.dataset.sourceStage = stage === 'capture' && stages.includes(error?.sourceReadinessStage) ? error.sourceReadinessStage : stage;
        status.dataset.sourceCategory = categories.includes(error?.name) ? error.name : 'UnknownError';
        if (panel.isConnected) status.textContent = `تعذّر إنشاء التقرير. رمز الدعم: ${status.dataset.sourceStage} / ${status.dataset.sourceError} / ${status.dataset.sourceCategory}. احتفظ بهذا الرمز للدعم.`;
      } finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); delete el.dataset.sourceBusy; el.removeAttribute('aria-busy'); }
    },
    'file-import': (el, ev, params) => studentsView.actions['file-import'](el, ev, params),
    'file-export': (el, ev, params) => studentsView.actions['file-export'](el, ev, params),
    'paste-names': (el, ev, params) => studentsView.actions.import(el, ev, params),
    'add-student': (el, ev, params) => studentsView.actions.add(el, ev, params),
    'add-subject'(el, ev, params) {
      const teaching = store.getTeaching(params.id);
      if (!teaching || store.isTeachingArchived(teaching)) return;
      return addSubjectToClass(teaching.sectionId);
    },
    'switch-class'(el, ev, params) {
      const suffix = location.hash.replace(/^#\/teaching\/[^/]+/, '').replace(/^\?/, '?');
      openSheet({
        title: 'تبديل الفصل',
        body: html`<div class="class-switcher-list">${store.teachings().map((candidate) => {
          const candidateSection = store.getSection(candidate.sectionId);
          const candidateSubject = store.getSubject(candidate.subjectId);
          const current = candidate.id === params.id;
          return html`<a class="class-switcher-option ${current ? 'is-current' : ''}" href="#/teaching/${teachingRouteId(candidate.id)}${suffix}" data-sheet-close ${current ? 'aria-current="page"' : ''}><span class="class-switcher-option__dot" style="background:${candidateSection?.color || 'var(--brand)'}"></span><span class="class-switcher-option__main"><span class="class-switcher-option__title">${sectionLabel(candidateSection) || 'الفصل'}</span><span class="class-switcher-option__sub">${candidateSubject?.name || ''}</span></span>${current ? html`<span class="class-switcher-option__current">${icon('check')} الفصل الحالي</span>` : html`<span class="class-switcher-option__chevron">${icon('chev')}</span>`}</a>`;
        })}</div>`,
        foot: html`<a class="btn btn--quiet" href="#/classes" data-sheet-close>كل الفصول</a>`,
      });
    },
    async delete(el, ev, params) {
      await teachingsView.actions['delete-class-flow'](el, ev, params);
      if (!store.getTeaching(params.id)) go('/classes');
    },
    async 'edit-sec'(el, ev, params) {
      const tch = store.getTeaching(params.id);
      if (!tch) return;
      const sec = store.getSection(tch.sectionId);
      if (!sec) return;
      const data = await new Promise(resolve => {
        openSheet({
          title: 'تعديل الفصل',
          body: html`
            <p class="field__hint">تعديل اسم الفصل ولونه يظهر في جميع مواده. الدرجات والحصص مستقلة لكل مادة.</p>
            <button type="button" class="btn btn--quiet mb-3" data-add-subject>${icon('plus')} إضافة مادة أخرى لهذا الفصل</button>
            <form id="edit-sec-form">
              <div class="field-row">
                <label class="field">
                  <span class="field__label">الصف</span>
                  <select class="select" name="grade">
                    ${GRADES.map(g => html`<option value="${g.v}" ${Number(sec.grade) === g.v ? 'selected' : ''}>${g.label}</option>`)}
                  </select>
                </label>
                <label class="field">
                  <span class="field__label">رمز الفصل</span>
                  <input class="input" name="label" value="${sec.label}" required maxlength="8" autocomplete="off">
                </label>
              </div>
              <div class="field">
                <span class="field__label">لون الفصل</span>
                <div class="hstack gap-3 align-center">
                  <span id="sec-color-preview" class="color-preview-dot" style="background:${safeColor(sec.color)};" aria-hidden="true"></span>
                  <button type="button" class="btn btn--sm btn--ghost" id="btn-toggle-color-picker">
                    ${icon('palette')} تغيير اللون
                  </button>
                </div>
                <input type="hidden" name="color" id="sec-color-input" value="${safeColor(sec.color)}">
                <div id="sec-color-popover" class="color-picker-popover mt-2" style="display: none;">
                  <div class="color-picker-popover__title fs-xs t-3 mb-2">اختر لونًا لتمييز الفصل:</div>
                  <div class="color-picker-grid">
                    ${SECTION_COLORS.map(
                      (col) => html`
                        <button type="button" class="color-picker-cell ${safeColor(sec.color) === col ? 'is-selected' : ''}" data-color="${col}" aria-label="لون ${col}">
                          <span style="background:${col}"></span>
                        </button>
                      `
                    )}
                  </div>
                </div>
              </div>
            </form>
          `,
          foot: html`
            <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
            <button class="btn btn--primary" form="edit-sec-form" type="submit">حفظ التغييرات</button>
          `,
          onMount: (root, done) => {
            root.querySelector('[data-add-subject]').addEventListener('click', () => done({ addSubject: true }));
            const form = root.querySelector('#edit-sec-form');
            const preview = root.querySelector('#sec-color-preview');
            const toggleBtn = root.querySelector('#btn-toggle-color-picker');
            const popover = root.querySelector('#sec-color-popover');
            const input = root.querySelector('#sec-color-input');

            toggleBtn?.addEventListener('click', () => {
              const isHidden = popover.style.display === 'none';
              popover.style.display = isHidden ? 'block' : 'none';
            });

            popover?.querySelectorAll('.color-picker-cell').forEach((btn) => {
              btn.addEventListener('click', () => {
                const col = btn.dataset.color;
                input.value = col;
                preview.style.background = col;
                popover.querySelectorAll('.color-picker-cell').forEach((b) => {
                  b.classList.toggle('is-selected', b.dataset.color === col);
                });
                popover.style.display = 'none';
              });
            });

            form?.addEventListener('submit', (ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.target);
              const label = String(fd.get('label')).trim();
              const grade = Number(fd.get('grade'));
              const duplicate = store.sections(sec.yearId).find((s) => !s.deleted && s.id !== sec.id &&
                s.yearId === sec.yearId && s.grade === grade && normalizeSectionLabel(s.label) === normalizeSectionLabel(label));
              if (duplicate) {
                toast(`هذا الفصل موجود مسبقًا (${gradeLabel(grade)} / ${duplicate.label})`, 'warn');
                return;
              }
              done({
                grade,
                label,
                color: String(input?.value || fd.get('color') || sec.color || SECTION_COLORS[0]),
              });
            });
          }
        }).then(resolve).catch(() => resolve(null));
      });
      if (!data) return;
      if (data.addSubject) { await addSubjectToClass(sec.id); return; }
      try {
        await store.editSection(sec.id, data);
        toast('تم تعديل بيانات الفصل بنجاح');
        // trigger re-render
        repaint();
      } catch (err) {
        toast(err.message || 'تعذّر تعديل بيانات الفصل', 'warn');
      }
    }
  },
};
