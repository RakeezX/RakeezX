// WA-CALENDAR-0417 presentation for the real Product Calendar data and actions.
// Values, dates, range identity and persistence remain owned by calendar.js / store.
import { html, icon, fmtDate, fmtDateRange } from '../lib/dom.js';
import { CALENDAR_KIND, isTeachingDay } from '../models.js';

const dateTile = (start, end) => {
  if (!start) return { day: '—', month: '' };
  const [,, first] = start.split('-').map(Number);
  const [,, last] = (end || start).split('-').map(Number);
  const month = new Date(start + 'T12:00:00').toLocaleDateString('ar-SA-u-nu-latn', { month: 'long', calendar: 'gregory', numberingSystem: 'latn' });
  const endMonth = new Date((end || start) + 'T12:00:00').toLocaleDateString('ar-SA-u-nu-latn', { month: 'long', calendar: 'gregory', numberingSystem: 'latn' });
  return { day: start === end ? String(first) : first + '–' + last, month: month === endMonth ? month : month + ' / ' + endMonth };
};
const number = (value) => html`<bdi dir="ltr">${value}</bdi>`;

export function renderCalendar0417(data) {
  const {
    year, terms, preset, ranges, today, activeRegion, currentTerm,
    running, phase, currentWeekNum, totalWeeksCount, progressPct,
    elapsedDays, remainingDays, nextMilestone, nextMilestoneAffected,
    filteredRanges, activeFilter, getRelativeStatus, durationLabel,
    diffDays, getAffectedSchedule, calendarLabel,
  } = data;
  const nextDate = nextMilestone && dateTile(nextMilestone.startDate, nextMilestone.endDate);
  const rawYear = String(year?.label ?? '').replace(/(\d)-(\d)/g, '$1–$2');
  const displayYear = rawYear && !rawYear.includes('هـ') ? rawYear + ' هـ' : rawYear;
  return html`
    <div class="management-page calendar-management-page calendar-work-0417">
      <header class="calendar-identity">
        <div class="calendar-identity__text">
          <div class="calendar-identity__meta">
            <p class="calendar-eyebrow">التقويم المعتمد</p>
            <p class="calendar-year"><bdi dir="ltr">${displayYear}</bdi><span>·</span><bdi dir="ltr">${preset?.gregorianLabel ?? ''}</bdi></p>
          </div>
          <h1>${activeRegion.shortName ?? activeRegion.name}</h1>
        </div>
        <button type="button" class="calendar-settings-action" data-act="open-settings">
          ${icon('settings')}<span>إعدادات التقويم والمنطقة</span>
        </button>
      </header>

      <section class="calendar-top-0415" aria-label="الموضع الدراسي والمحطة القادمة">
        <article class="calendar-now-0415">
          <header class="top-heading-0415"><h2>أين نحن الآن؟</h2><span class="top-state-0415 ${running ? 'is-active' : ''}">${phase}</span></header>
          <p class="week-title-0415 ${running ? '' : 'is-outside'}">
            ${running ? html`الأسبوع ${number(currentWeekNum)} من ${number(totalWeeksCount)} أسبوعًا` : phase}
          </p>
          <div class="term-timeline timeline-0415" style="--position:${progressPct}%">
            <div class="timeline-now"><span class="timeline-current"><strong>أنت هنا</strong><span> · ${fmtDate(today, false)}</span></span></div>
            <div class="timeline-track" role="progressbar" aria-label="التقدم الزمني للفصل" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}">
              <span class="timeline-fill"></span><span class="timeline-point" aria-hidden="true"></span>
            </div>
            <div class="timeline-bounds">
              <div><span>بداية الفصل</span><strong>${currentTerm?.startDate ? fmtDate(currentTerm.startDate, false) : 'غير محددة'}</strong></div>
              <div><span>نهاية الفصل</span><strong>${currentTerm?.endDate ? fmtDate(currentTerm.endDate, false) : 'غير محددة'}</strong></div>
            </div>
          </div>
          <dl class="progress-strip-0415">
            <div><dt>الأيام المتبقية</dt><dd>${number(remainingDays)}</dd></div>
            <div><dt>الأيام المنقضية</dt><dd>${number(elapsedDays)}</dd></div>
            <div><dt>نسبة الإنجاز الزمني</dt><dd>${number(progressPct + '%')}</dd></div>
          </dl>
        </article>
        <article class="calendar-next-0415">
          <header class="top-heading-0415"><h2>المحطة القادمة</h2>
            ${nextMilestone ? html`<span class="top-state-0415">${getRelativeStatus(nextMilestone.startDate, nextMilestone.endDate, today).text}</span>` : ''}
          </header>
          ${nextMilestone ? html`
            <div class="milestone-focus-0415">
              <div class="milestone-title-0415">
                <div class="next-date" aria-hidden="true"><strong>${nextDate.day}</strong><small>${nextDate.month}</small></div>
                <div><h3>${nextMilestone.label || calendarLabel(nextMilestone.kind, CALENDAR_KIND[nextMilestone.kind])}</h3>
                  <p>${fmtDateRange(nextMilestone.startDate, nextMilestone.endDate)}</p></div>
              </div>
              <p class="milestone-meta-0415"><span>${durationLabel(nextMilestone.startDate, nextMilestone.endDate)}</span>
                <span>${nextMilestone.source?.startsWith('preset:') ? 'رسمية معتمدة' : 'استثناء محلي'}</span></p>
            </div>
            ${nextMilestoneAffected.length ? html`<div class="milestone-impact-0415"><span>${nextMilestoneAffected.length} حصص متأثرة</span>
              <button type="button" class="calendar-text-action" data-act="view-affected" data-id="${nextMilestone.id}">
                عرض الحصص المتأثرة ${icon('chev')}
              </button></div>` : ''}
          ` : html`<div class="milestone-focus-0415 milestone-empty-0415"><h3>لا توجد إجازات قادمة</h3></div>`}
        </article>
      </section>

      <section class="calendar-terms-section" aria-labelledby="calendar-terms-title">
        <header class="calendar-section-heading"><h2 id="calendar-terms-title">الفصول الدراسية</h2></header>
        <div class="calendar-terms">
          ${terms.map((term, index) => {
            const hasDates = Boolean(term.startDate && term.endDate);
            const current = running && currentTerm?.id === term.id;
            const totalDays = hasDates ? Math.max(1, diffDays(term.startDate, term.endDate) + 1) : 0;
            const weeks = hasDates ? Math.ceil(totalDays / 7) : 0;
            const holidays = hasDates ? ranges.filter(r => r.kind === 'holiday' && r.startDate >= term.startDate && r.endDate <= term.endDate) : [];
            const suspensions = hasDates ? ranges.filter(r => r.kind === 'suspension' && r.startDate >= term.startDate && r.endDate <= term.endDate) : [];
            const holidayDays = holidays.reduce((n, r) => n + (r.days?.length ?? 0), 0);
            const suspensionDays = suspensions.reduce((n, r) => n + (r.days?.length ?? 0), 0);
            const teaching = Math.max(0, weeks * 5 - holidayDays - suspensionDays);
            const status = current ? 'الجاري' : hasDates && today < term.startDate ? 'القادم' : hasDates ? 'منتهٍ' : 'التواريخ غير محددة';
            return html`<article class="calendar-term term-card-0415 ${current ? 'is-current' : ''}">
              <div class="term-head"><h3>${term.name}</h3><span class="term-state">${status}</span></div>
              <dl class="term-boundaries">
                <div><dt>البداية</dt><dd>${hasDates ? fmtDate(term.startDate, false) : 'غير محددة'}</dd></div>
                <div><dt>النهاية</dt><dd>${hasDates ? fmtDate(term.endDate, false) : 'غير محددة'}</dd></div>
              </dl>
              <ul class="term-stats-0415">
                <li><strong>${number(weeks)}</strong><span>أسبوعًا</span></li>
                <li><strong>نحو ${number(teaching)}</strong><span>يوم تدريس</span></li>
                <li><strong>${number(holidays.length)} فترات إجازة</strong><span>${number(holidayDays)} يوم</span></li>
              </ul>
              ${suspensions.length ? html`<p class="term-suspension-note">${suspensions.length} فترات تعليق دراسة · ${suspensionDays} يوم</p>` : ''}
              <footer class="term-actions term-actions-0415">
                <button type="button" class="calendar-text-action" data-act="edit-term" data-id="${term.id}" aria-label="تعديل تواريخ ${term.name}">${icon('edit')} تعديل</button>
              </footer>
            </article>`;
          })}
        </div>
      </section>

      <section class="calendar-holidays" aria-labelledby="calendar-holidays-title">
        <header class="holidays-heading">
          <h2 id="calendar-holidays-title">الإجازات والفترات الدراسية</h2>
          <button type="button" class="btn btn--primary" data-act="add">${icon('plus')} إضافة استثناء</button>
        </header>
        <div class="holiday-filters" role="group" aria-label="تصفية الإجازات">
          ${[['upcoming','القادمة'],['all','الكل'],['official','رسمية معتمدة'],['exceptions','استثناءات محلية']].map(([key,label]) => html`
            <button type="button" data-act="filter" data-filter="${key}" aria-pressed="${activeFilter === key}">${label}</button>`)}
        </div>
        <p class="holiday-count" aria-live="polite">${filteredRanges.length} ${activeFilter === 'upcoming' ? 'إجازات قادمة أو جارية' : 'فترات'}</p>
        <div class="holiday-list">
          ${filteredRanges.length ? filteredRanges.map(range => {
            const tile = dateTile(range.startDate, range.endDate);
            const official = range.source?.startsWith('preset:');
            const affected = getAffectedSchedule(range.startDate, range.endDate).length;
            const status = getRelativeStatus(range.startDate, range.endDate, today);
            return html`<article class="holiday-row">
              <div class="holiday-date" aria-hidden="true"><strong>${tile.day}</strong><small>${tile.month}</small></div>
              <div class="holiday-info"><h3>${range.label || calendarLabel(range.kind, CALENDAR_KIND[range.kind])}</h3>
                <p>${durationLabel(range.startDate, range.endDate)} · ${official ? 'إجازة معتمدة' : 'استثناء محلي'} ·
                  ${isTeachingDay(range.kind) ? range.kind === 'remote' ? 'دراسة عن بُعد' : 'دراسة حضورية' : affected ? affected + ' حصص متأثرة' : 'لا حصص متأثرة'}
                </p><span class="sr-only">${fmtDateRange(range.startDate, range.endDate)}</span>
              </div>
              <span class="holiday-state">${status.text}</span>
              <button type="button" class="holiday-detail" data-act="view-affected" data-id="${range.id}" aria-label="تفاصيل ${range.label}">${icon('chev')}</button>
            </article>`;
          }) : html`<div class="empty-holidays"><h3>${activeFilter === 'upcoming' ? 'لا توجد إجازات قادمة' : 'لا توجد فترات بهذا الاختيار'}</h3><p>يمكنك مراجعة الكل أو إضافة استثناء.</p></div>`}
        </div>
      </section>
      <details class="calendar-authority"><summary>${icon('book')}<span>مصدر التقويم والمنطقة</span>${icon('chev')}</summary>
        <div><h2>التقويم الدراسي المعتمد لوزارة التعليم</h2><p>${activeRegion.name} · ${activeRegion.subtitle}</p>
          <p>${activeRegion.coverage?.join(' · ') ?? ''}</p>
          <p>الفترات الرسمية المرجعية محفوظة، والاستثناءات المحلية منفصلة عنها.</p></div>
      </details>
    </div>
  `;
}
