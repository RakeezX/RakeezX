/** Read-only projection of existing ended memberships, never tombstones. */
import { html, icon, parentLink, fmtDate } from '../lib/dom.js';
import { sectionLabel } from '../models.js';
import * as store from '../store.js';

function formerStudents() {
  return store.state.students.filter(student => !student.deleted && student.status === 'withdrawn' && !store.activeEnrollment(student.id))
    .map(student => {
      const ended = store.enrollmentsOf(student.id).filter(en => ['withdrawn', 'completed'].includes(en.status))
        .sort((a, b) => String(b.endDate ?? b.startDate ?? '').localeCompare(String(a.endDate ?? a.startDate ?? '')));
      const enrollment = ended[0];
      if (!enrollment) return null;
      const section = store.getSection(enrollment.sectionId);
      const teaching = store.teachings(null, { includeArchived: true }).find(t => t.sectionId === enrollment.sectionId);
      return { student, enrollment, section, teaching };
    }).filter(Boolean).sort((a, b) => a.student.name.localeCompare(b.student.name, 'ar'));
}

export default {
  title: () => 'الطلاب السابقون', back: () => '#/archive', wide: true,
  render() {
    const rows = formerStudents();
    return html`<div class="management-page archive-page former-students-page">
      ${parentLink('العودة إلى الأرشيف', '/archive')}
      <section class="archive-intro" aria-labelledby="former-students-title">
        <span class="archive-intro__icon">${icon('users')}</span>
        <div><h2 id="former-students-title">الطلاب السابقون</h2><p>طلاب انتهى انتسابهم الحالي، مع الاحتفاظ بسجلهم السابق.</p></div>
        <span class="badge badge--info">للقراءة فقط</span>
      </section>
      <div class="archive-summary"><span>عدد الطلاب: <bdi class="tabular">${rows.length}</bdi></span></div>
      ${rows.length ? html`<ul class="former-students-list surface surface--flat" aria-label="الطلاب السابقون">
        ${rows.map(({ student, enrollment, section, teaching }) => html`<li class="former-student-row">
          <div class="former-student-row__identity"><strong>${student.name}</strong><span class="t-3 fs-sm">${section ? sectionLabel(section) : 'الفصل السابق غير متاح'}</span></div>
          <div class="former-student-row__context"><span class="badge">انتساب منتهٍ</span>${enrollment.endDate ? html`<span class="t-3 fs-sm">انتهى في <bdi>${fmtDate(enrollment.endDate)}</bdi></span>` : ''}</div>
          <a class="btn btn--info" href="#/student/${encodeURIComponent(student.id)}?from=former-students${teaching ? '&teaching=' + encodeURIComponent(teaching.id) : ''}" aria-label="عرض سجل ${student.name}">عرض السجل ${icon('chev')}</a>
        </li>`)}
      </ul>` : html`<div class="empty"><div class="empty__icon">${icon('users')}</div><div class="empty__title">لا يوجد طلاب سابقون</div><p class="empty__text">يظهر هنا الطالب الذي أُزيل من الفصل مع الاحتفاظ بسجله. الطلاب الحاليون والطلاب المحذوفون لا يظهرون هنا.</p></div>`}
    </div>`;
  },
};
