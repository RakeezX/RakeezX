/** لوحة الإسناد: مدخل لكل أدواته، وملخّص حاله اليوم. */

import { html, icon, openSheet, toast, fmtPct, fmtTimeRange } from '../lib/dom.js';
import * as store from '../store.js';
import { gradeLabel, todayISO, studentTotal, sectionLabel, ATTENDANCE, SESSION_STATUS, GRADES } from '../models.js';
import { go } from '../router.js';
import { repaint } from '../repaint.js';

const TOOLS = (id) => [
  { href: `#/teaching/${id}/attendance`, icon: 'attendance', title: 'الحضور',       sub: 'رصد حصة بعينها' },
  { href: `#/teaching/${id}/quicklog`,   icon: 'spark',      title: 'الرصد السريع', sub: 'مشاركة وسلوك أثناء الحصة' },
  { href: `#/teaching/${id}/grades`,     icon: 'grades',     title: 'الدرجات',      sub: 'إدخال درجات البنود' },
  { href: `#/teaching/${id}/sessions`,   icon: 'session',    title: 'الحصص',        sub: 'المنفّذة وغير المنفّذة' },
  { href: `#/teaching/${id}/picker`,     icon: 'picker',     title: 'القرعة',       sub: 'اختيار عادل لا يكرّر أحدًا' },
  { href: `#/teaching/${id}/groups`,     icon: 'groups',     title: 'المجموعات',    sub: 'تقسيم عشوائي أو متوازن' },
  { href: `#/teaching/${id}/board`,      icon: 'board',      title: 'لوحة النتائج',  sub: 'للعرض على البروجكتر' },
  { href: `#/teaching/${id}/reports`,    icon: 'reports',    title: 'التقارير',     sub: 'كشوف وتصدير وطباعة' },
  { href: `#/teaching/${id}/students`,   icon: 'classes',    title: 'الطلاب',       sub: 'الكشف والانتساب' },
  { href: `#/teaching/${id}/items`,      icon: 'note',       title: 'بنود التقييم',  sub: 'الدرجات العظمى والتوزيع' },
];

export default {
  title: (p) => {
    const tch = store.getTeaching(p.id);
    return sectionLabel(store.getSection(tch?.sectionId)) || 'فصل';
  },
  topActions: (p) => html`
    <button class="iconbtn" data-act="edit-sec" aria-label="إعدادات الشعبة">${icon('settings')}</button>
  `,
  subtitle: (p) => {
    const tch = store.getTeaching(p.id);
    if (!tch) return '';
    const sec = store.getSection(tch.sectionId);
    const sub = store.getSubject(tch.subjectId);
    return [sub?.name].filter(Boolean).join(' · ');
  },
  back: () => '#/classes',

  render(p) {
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

    const { roster, items, ctx } = store.teachingContext(tch.id);
    const today = todayISO();
    const todaySessions = store.sessionsOnFor(tch.id, today);

    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">الشعبة بلا طلاب بعد</div>
          <div class="empty__text">
            الصق كشف الأسماء دفعة واحدة — سطر لكل طالب — ويرقّمهم RAKEEZ X تلقائيًا.
          </div>
          <a class="btn btn--primary" href="#/teaching/${tch.id}/students">${icon('plus')} أضف الطلاب</a>
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
      <div class="section">
        <div class="grid grid--3">
          <div class="stat">
            <div class="stat__val tabular">${roster.length}</div>
            <div class="stat__label">طالبًا</div>
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

      <div class="section">
        <div class="section__head">
          <div class="section__title">حصص اليوم</div>
          <a class="btn btn--sm btn--quiet" href="#/teaching/${tch.id}/attendance">
            ${todaySessions.length ? 'افتح' : 'ابدأ'} ${icon('back')}
          </a>
        </div>
        ${todaySessions.length
          ? html`
              <div class="list">
                ${todaySessions.map((s) => {
                  const m = SESSION_STATUS[s.status] ?? SESSION_STATUS.scheduled;
                  const marked = store.attendanceIn(s.id).length;
                  return html`
                    <a class="row" href="#/teaching/${tch.id}/attendance?session=${s.id}">
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
                <a class="btn btn--sm btn--primary mt-3" href="#/teaching/${tch.id}/attendance">
                  ${icon('attendance')} افتح حصة اليوم
                </a>
              </div>
            `}
      </div>

      <div class="section">
        <div class="section__head">
          <div class="section__title">الأدوات</div>
          <span class="t-3 fs-sm"><span class="tabular">${held}</span> حصة منفّذة</span>
        </div>
        <div class="grid grid--auto">
          ${TOOLS(tch.id).map(
            (t) => html`
              <a class="tile" href="${t.href}">
                <span class="tile__icon">${icon(t.icon)}</span>
                <span class="tile__title">${t.title}</span>
                <span class="tile__sub">${t.sub}</span>
              </a>
            `
          )}
        </div>
      </div>

      <div class="class-hub__settings">
        <div>
          <div class="class-hub__settings-title">إعدادات الإسناد والشعبة</div>
          <p class="class-hub__settings-desc">تعديل بيانات الشعبة أو إنهاء هذا الإسناد عند الحاجة.</p>
        </div>
        <div class="class-hub__settings-actions">
          <button class="btn btn--sm btn--quiet" data-act="edit-sec">${icon('edit')} تعديل البيانات</button>
          <button class="btn btn--sm btn--danger class-hub__delete" data-act="delete" aria-label="حذف الإسناد">${icon('trash')} <span>حذف الإسناد</span></button>
        </div>
      </div>
      </div>
    `;
  },

  actions: {
    async delete(el, ev, params) {
      const tch = store.getTeaching(params.id);
      if (!tch) return;
      const sec = store.getSection(tch.sectionId);
      const sub = store.getSubject(tch.subjectId);
      const target = [sectionLabel(sec), sub?.name].filter(Boolean).join(' · ');
      const ok = await openSheet({
        title: 'حذف الإسناد',
        desc: target ? `إلغاء إسناد ${target}` : undefined,
        body: html`
          <div class="delete-teaching-dialog">
            <div class="delete-teaching-dialog__badge">${icon('trash')} إجراء نهائي غير قابل للتراجع</div>
            <div class="delete-teaching-dialog__block delete-teaching-dialog__block--danger"><strong>ما سيتم حذفه</strong><p>سيتم حذف بيانات هذا الإسناد مثل بنود التقييم والدرجات والحصص والحضور والسجل.</p></div>
            <div class="delete-teaching-dialog__block delete-teaching-dialog__block--safe"><strong>بيانات الطلاب والشعبة</strong><p>الطلاب وانتسابهم للشعبة سيبقون كما هم دون أي تعديل أو حذف.</p></div>
          </div>
        `,
        foot: html`<button class="btn btn--quiet" data-sheet-close>إلغاء</button><button class="btn btn--danger" data-confirm>${icon('trash')} حذف الإسناد</button>`,
        onMount: (root, done) => root.querySelector('[data-confirm]')?.addEventListener('click', () => done(true)),
      }).then((value) => value === true);
      if (!ok) return;
      await store.deleteTeaching(params.id);
      toast('حُذف الإسناد');
      go('/classes');
    },
    async 'edit-sec'(el, ev, params) {
      const tch = store.getTeaching(params.id);
      if (!tch) return;
      const sec = store.getSection(tch.sectionId);
      
      const data = await new Promise(resolve => {
        openSheet({
          title: 'تعديل بيانات الشعبة',
          body: html`
            <form id="edit-sec-form">
              <div class="field-row">
                <label class="field">
                  <span class="field__label">الصف</span>
                  <select class="select" name="grade">
                    ${GRADES.map(g => html`<option value="${g.v}" ${Number(sec.grade) === g.v ? 'selected' : ''}>${g.label}</option>`)}
                  </select>
                </label>
                <label class="field">
                  <span class="field__label">رمز الشعبة</span>
                  <input class="input" name="label" value="${sec.label}" required maxlength="8" autocomplete="off">
                </label>
              </div>
            </form>
          `,
          foot: html`
            <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
            <button class="btn btn--primary" form="edit-sec-form" type="submit">حفظ التغييرات</button>
          `,
          onMount: (root, done) => {
            root.querySelector('#edit-sec-form').addEventListener('submit', (ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.target);
              done({
                grade: Number(fd.get('grade')),
                label: String(fd.get('label')).trim()
              });
            });
          }
        }).then(resolve).catch(() => resolve(null));
      });
      
      if (!data) return;
      try {
        await store.editSection(sec.id, data);
        toast('تم تعديل الشعبة بنجاح');
        // trigger re-render
        repaint();
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
  },
};
