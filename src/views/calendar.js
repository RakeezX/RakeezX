import { html, icon, openSheet, toast, confirmSheet, fmtDateRange, fmtDate } from '../lib/dom.js';
import * as store from '../store.js';
import {
  CALENDAR_KIND,
  isTeachingDay,
  todayISO,
  shiftDate,
  weekday,
  WEEKDAYS,
  SCHOOL_WEEKDAYS,
  makeYear,
  makeTerm,
  TERM_NAMES,
  YEAR_STATUS,
  TERM_STATUS,
} from '../models.js';
import {
  SAUDI_EDUCATION_REGIONS,
  getSaudiEducationRegion,
  getCalendarPreset,
  WESTERN_1448_1449_PRESET_ID,
} from '../lib/calendar-presets.js';
import { repaint } from '../repaint.js';

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const parseParts = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return { year, month, day };
};

const utc = (value) => {
  if (!value || typeof value !== 'string') return 0;
  const parts = value.split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return 0;
  const [year, month, day] = parts;
  return Date.UTC(year, month - 1, day);
};

const diffDays = (isoA, isoB) => {
  if (!isoA || !isoB) return 0;
  const utcA = utc(isoA);
  const utcB = utc(isoB);
  if (!utcA || !utcB) return 0;
  return Math.round((utcB - utcA) / 86400000);
};

const durationLabel = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  const days = Math.max(1, diffDays(startDate, endDate) + 1);
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days <= 10) return `${days} أيام`;
  return `${days} يومًا`;
};

const calendarTone = (kind) =>
  kind === 'remote' ? 'info' : kind === 'study' || kind === 'exam' || kind === 'event' ? 'ok' : 'warn';

const calendarLabel = (kind, meta) =>
  kind === 'study' ? 'حضوري' : kind === 'remote' ? 'عن بُعد' : meta?.label ?? 'إجازة';

const getRelativeStatus = (startDate, endDate, today) => {
  if (!startDate || !endDate) return { text: 'غير محدد', tone: 'sunk' };
  if (today >= startDate && today <= endDate) return { text: 'جارية الآن', tone: 'ok' };
  if (today < startDate) {
    const d = diffDays(today, startDate);
    if (d === 0) return { text: 'تبدأ اليوم', tone: 'warn' };
    if (d === 1) return { text: 'تبدأ غدًا', tone: 'warn' };
    if (d <= 7) return { text: `خلال ${d} أيام`, tone: 'warn' };
    if (d <= 30) return { text: `بعد ${d} يومًا`, tone: 'info' };
    const w = Math.max(1, Math.round(d / 7));
    return { text: `بعد ${w} أسابيع`, tone: 'info' };
  }
  return { text: 'منقضية', tone: 'sunk' };
};

let activeFilter = 'upcoming';

/**
 * التحقق من اكتمال إعداد الفصول والتقويم للسنة قبل تفعيلها.
 */
export function hasValidYearCalendarConfig(yearId) {
  if (!yearId) return false;
  const terms = store.termsOf(yearId);
  if (!terms || terms.length === 0) return false;
  return terms.every(
    (t) =>
      typeof t.startDate === 'string' &&
      typeof t.endDate === 'string' &&
      t.startDate.trim().length >= 10 &&
      t.endDate.trim().length >= 10 &&
      t.startDate <= t.endDate
  );
}

/**
 * تحليل ومطابقة الحصص والجلسات المتأثرة بفترة أو إجازة معينة بناءً على جدول المعلم.
 */
export function getAffectedSchedule(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) return [];
  const year = store.activeYear();
  const terms = store.termsOf(year?.id);
  const termIds = new Set(terms.map((t) => t.id));

  // أيام الدوام الأسبوعية (الأحد = 0 إلى الخميس = 4)
  const schoolDays = [];
  for (let d = startDate; d <= endDate; d = shiftDate(d, 1)) {
    const wd = weekday(d);
    if (SCHOOL_WEEKDAYS.includes(wd)) {
      schoolDays.push({ date: d, weekday: wd });
    }
  }

  if (!schoolDays.length) return [];

  const activeTeachings = (store.state.teachings ?? []).filter(
    (t) => !t.deleted && termIds.has(t.termId) && !store.isTeachingArchived(t)
  );
  const teachingMap = new Map(activeTeachings.map((t) => [t.id, t]));

  const allSlots = (store.state.slots ?? []).filter(
    (s) => !s.deleted && teachingMap.has(s.teachingId)
  );
  const allSessions = (store.state.sessions ?? []).filter(
    (s) => !s.deleted && teachingMap.has(s.teachingId) && s.date >= startDate && s.date <= endDate
  );

  const items = [];
  for (const day of schoolDays) {
    const daySessions = allSessions.filter((s) => s.date === day.date);
    const daySlots = allSlots.filter((slot) => {
      const term = terms.find((item) => item.id === teachingMap.get(slot.teachingId)?.termId);
      return slot.weekday === day.weekday && term?.startDate <= day.date && term?.endDate >= day.date &&
        !daySessions.some((session) => session.teachingId === slot.teachingId && session.period === slot.period);
    });

    if (daySessions.length > 0) {
      for (const sess of daySessions) {
        const tch = store.getTeaching(sess.teachingId);
        const sec = tch ? store.getSection(tch.sectionId) : null;
        const sub = tch ? store.getSubject(tch.subjectId) : null;
        items.push({
          date: day.date,
          weekday: day.weekday,
          weekdayName: WEEKDAYS[day.weekday],
          period: sess.period,
          sectionName: sec ? sec.name ?? `${sec.grade} / ${sec.label}` : 'فصل',
          subjectName: sub?.name ?? 'مادة',
          status: sess.status ?? 'scheduled',
          type: 'session',
          id: sess.id,
        });
      }
    }
    if (daySlots.length > 0) {
      for (const slot of daySlots) {
        const tch = store.getTeaching(slot.teachingId);
        const sec = tch ? store.getSection(tch.sectionId) : null;
        const sub = tch ? store.getSubject(tch.subjectId) : null;
        items.push({
          date: day.date,
          weekday: day.weekday,
          weekdayName: WEEKDAYS[day.weekday],
          period: slot.period,
          sectionName: sec ? sec.name ?? `${sec.grade} / ${sec.label}` : 'فصل',
          subjectName: sub?.name ?? 'مادة',
          status: 'scheduled_slot',
          type: 'slot',
          id: slot.id,
        });
      }
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
}

/**
 * نافذة استعراض الحصص والجلسات المتأثرة بالإجازة أو الفترة المحددة.
 */
async function affectedSessionsSheet(range) {
  const affected = getAffectedSchedule(range.startDate, range.endDate);
  const byDate = new Map();
  for (const item of affected) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  }

  const action = await openSheet({
    title: range.label || calendarLabel(range.kind, CALENDAR_KIND[range.kind]),
    desc: html`${fmtDateRange(range.startDate, range.endDate)} · ${durationLabel(range.startDate, range.endDate)}`,
    body: html`
      <div class="stack stack-3">
        <div class="card card--pad" style="background: var(--bg-sunk);">
          <div class="hstack gap-3 flex-wrap">
            <div>
              <div class="fs-xs t-3">إجمالي الحصص المتأثرة</div>
              <div class="fw-7 fs-lg tabular">${affected.length} حصة مجدولة</div>
            </div>
            <div class="push">
              <span class="badge ${!isTeachingDay(range.kind) ? 'badge--ok' : 'badge--info'}">
                ${!isTeachingDay(range.kind)
                  ? 'مستبعدة تلقائيًا من الغياب'
                  : range.kind === 'remote'
                  ? 'دراسة عن بُعد'
                  : 'دراسة مجدولة'}
              </span>
            </div>
          </div>
          <div class="t-3 fs-xs mt-2 pt-2" style="border-top: 1px solid var(--border);">
            ${!isTeachingDay(range.kind)
              ? range.kind === 'suspension'
                ? 'تُستبعد حصص تعليق الدراسة من سجل الغياب وحساب الدوام، دون احتسابها كغياب على الطلاب أو المعلم.'
                : 'تُستبعد حصص الإجازات الرسمية والاستثناءات المعتمدة تلقائيًا من سجل الغياب وحساب الدوام، دون احتسابها كغياب على الطلاب أو المعلم.'
              : range.kind === 'remote'
              ? 'تُدرج حصص هذه الفترة بنمط التعليم عن بُعد في السجلات المعتمدة.'
              : 'حصص دراسية معتمدة حضورياً.'}
          </div>
        </div>

        ${affected.length === 0
          ? html`
              <div class="card card--pad text-center py-5">
                <div class="t-3 fs-sm">
                  لا توجد حصص مجدولة أو جلسات مسجلة في أيام التدريس (الأحد–الخميس) المتزامنة مع هذه الفترة.
                </div>
              </div>
            `
          : html`
              <div class="stack stack-2">
                ${Array.from(byDate.entries()).map(([date, items]) => {
                  const wd = weekday(date);
                  const wdName = WEEKDAYS[wd];
                  return html`
                    <div class="cal-affected-day">
                      <div class="cal-affected-day__head">
                        <span>${wdName}</span>
                        <span class="tabular t-3 fs-xs">${fmtDate(date, true)}</span>
                      </div>
                      <div class="stack stack-1">
                        ${items.map(
                          (it) => html`
                            <div class="cal-affected-item">
                              <span class="cal-affected-item__period">الحصة ${it.period}</span>
                              <div class="cal-affected-item__main">
                                <span class="cal-affected-item__sec">${it.sectionName}</span>
                                <span class="cal-affected-item__sub">${it.subjectName}</span>
                              </div>
                              <span class="badge badge--${!isTeachingDay(range.kind) ? 'warn' : 'info'} fs-xs">
                                ${!isTeachingDay(range.kind) ? 'مستبعدة' : range.kind === 'remote' ? 'عن بُعد' : 'حضوري'}
                              </span>
                            </div>
                          `
                        )}
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
      </div>
    `,
    foot: html`
      ${!range.source?.startsWith('preset:') ? html`
        <button class="btn btn--ghost" data-range-edit>تعديل الاستثناء</button>
        <button class="btn btn--ghost" data-range-delete>حذف الاستثناء</button>
      ` : ''}
      <button class="btn btn--quiet" data-sheet-close>إغلاق</button>`,
    onMount: (root, done) => {
      root.querySelector('[data-range-edit]')?.addEventListener('click', () => done('edit'));
      root.querySelector('[data-range-delete]')?.addEventListener('click', () => done('delete'));
    },
  });
  if (action === 'edit') {
    const data = await rangeSheet(range);
    if (!data) return;
    try {
      await store.saveCalendarRange({ id: range.id, calendarId: range.calendarId, ...data });
      toast('حُفظت تعديلات الفترة');
    } catch (error) { toast(error.message, 'danger'); }
  } else if (action === 'delete' && await confirmSheet({
    title: 'حذف هذه الفترة؟',
    desc: 'سيُحذف هذا الاستثناء المحلي ولن يؤثر على التقويم الرسمي المعتمد.',
    confirmLabel: 'احذف', danger: true,
  })) {
    try { await store.removeCalendarRange(range.calendarId, range.id); toast('حُذفت الفترة'); }
    catch (error) { toast(error.message, 'danger'); }
  }
}

/**
 * نافذة إدارة إعدادات التقويم والمنطقة التعليمية — مركزية داخل التقويم
 */
let calendarSettingsTab = 'calendar';
function calendarSettingsSheet(savedScrollTop = 0) {
  const year = store.activeYear();
  const yrs = store.years();
  const terms = store.termsOf(year?.id);
  const activeT = store.activeTerm();
  const preset = store.calendarPresetForYear(year?.id) ?? getCalendarPreset(store.state.device?.preferredEducationRegion);
  const activeRegion = getSaudiEducationRegion(preset?.id ?? store.state.device?.preferredEducationRegion);

  return openSheet({
    title: 'إعدادات التقويم والمنطقة',
    body: html`
      <nav class="cal-settings-tabs" aria-label="أقسام إعدادات التقويم">
        ${[['calendar', 'التقويم'], ['years', 'السنوات'], ['terms', 'الفصول']].map(([key, label]) => html`
          <button type="button" data-settings-tab="${key}" aria-pressed="${calendarSettingsTab === key}">${label}</button>
        `)}
      </nav>
      <div class="stack stack-4 cal-settings-body">
        <!-- 1. اختيار التقويم المعتمد -->
        <div data-settings-panel="calendar" ${calendarSettingsTab !== 'calendar' ? 'hidden' : ''}>
          <div class="section__title mb-2">التقويم المعتمد</div>
          <div class="cal-regions-grid">
            ${SAUDI_EDUCATION_REGIONS.map(
              (reg) => {
                const isSelected = reg.id === activeRegion.id || reg.presetId === activeRegion.presetId;
                return html`
                  <button type="button"
                    class="cal-region-card ${isSelected ? 'is-active' : ''}"
                    data-act="set-region"
                    data-id="${reg.id}"
                    aria-pressed="${isSelected}"
                  >
                    <div class="cal-region-card__head">
                      <span class="cal-region-card__name">${reg.name}</span>
                      <span class="badge ${isSelected ? 'badge--ok' : 'badge--sunk'}">
                        ${isSelected ? 'مفعّل حالياً' : 'معتمد رسمياً'}
                      </span>
                    </div>
                    <div class="cal-region-card__subtitle fw-6 fs-xs mb-1" style="color: var(--brand);">
                      ${reg.subtitle}
                    </div>
                    <div class="cal-region-card__coverage" dir="rtl">
                      ${reg.coverage.join(' • ')}
                    </div>
                  </button>
                `;
              }
            )}
          </div>
        </div>

        <!-- 2. السنوات الدراسية -->
        <div data-settings-panel="years" ${calendarSettingsTab !== 'years' ? 'hidden' : ''}>
          <div class="hstack gap-2 mb-2">
            <span class="section__title">السنوات الدراسية</span>
            <div class="push">
              <button class="btn btn--sm btn--quiet" data-act="add-year">
                ${icon('plus')} سنة جديدة
              </button>
            </div>
          </div>
          <div class="stack stack-2">
            ${yrs.map(
              (y) => html`
                <div class="card card--pad ${y.id === year?.id ? 'is-active' : ''}">
                  <div class="hstack gap-2">
                    <div>
                      <div class="fw-7">${y.label}</div>
                      <div class="t-3 fs-xs">
                        ${YEAR_STATUS[y.status] ?? y.status} ·
                        <span class="tabular">${store.termsOf(y.id).length}</span> فصول
                      </div>
                    </div>
                    <div class="push hstack gap-1">
                      ${y.id === year?.id
                        ? html`<span class="badge badge--brand">الحالية</span>`
                        : html`
                            <button class="btn btn--sm btn--ghost" data-act="use-year" data-id="${y.id}">
                              اجعلها الحالية
                            </button>
                          `}
                      <button class="iconbtn" data-act="edit-year" data-id="${y.id}" aria-label="تعديل">
                        ${icon('edit')}
                      </button>
                    </div>
                  </div>
                </div>
              `
            )}
          </div>
        </div>

        <!-- 3. الفصول الدراسية وتواريخها -->
        <div data-settings-panel="terms" ${calendarSettingsTab !== 'terms' ? 'hidden' : ''}>
          <div class="hstack gap-2 mb-2">
            <span class="section__title">الفصول الدراسية في ${year?.label ?? ''}</span>
            <div class="push">
              <button class="btn btn--sm btn--quiet" data-act="add-term" data-year="${year?.id}">
                ${icon('plus')} فصل دراسي
              </button>
            </div>
          </div>
          <div class="list">
            ${terms.map(
              (t) => html`
                <div class="row cal-settings-term">
                  <span class="period">${t.index}</span>
                  <span class="row__main">
                    <span class="row__title">${t.name}</span>
                    <span class="row__sub">
                      ${t.startDate && t.endDate
                        ? fmtDateRange(t.startDate, t.endDate)
                        : 'التواريخ غير محددة'}
                      · <span class="tabular">${store.teachings(t.id).length}</span> فصلاً
                    </span>
                  </span>
                  <span class="row__end">
                    ${t.id === activeT?.id
                      ? html`<span class="badge badge--brand">الحالي</span>`
                      : html`
                          <button class="btn btn--sm btn--ghost" data-act="use-term" data-id="${t.id}">
                            اجعله الحالي
                          </button>
                        `}
                    <button class="iconbtn" data-act="edit-term-in-settings" data-id="${t.id}" aria-label="تعديل التواريخ">
                      ${icon('edit')}
                    </button>
                  </span>
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `,
    foot: html`<button class="btn btn--primary btn--block" data-sheet-close>تم</button>`,
    onMount: (root) => {
      root.querySelectorAll('[data-settings-tab]').forEach((button) => button.addEventListener('click', () => {
        calendarSettingsTab = button.dataset.settingsTab;
        root.querySelectorAll('[data-settings-tab]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
        root.querySelectorAll('[data-settings-panel]').forEach((panel) => { panel.hidden = panel.dataset.settingsPanel !== calendarSettingsTab; });
      }));
      const getScroll = () => root.querySelector('.sheet__body')?.scrollTop ?? 0;
      if (savedScrollTop > 0) requestAnimationFrame(() => {
        const body = root.querySelector('.sheet__body');
        if (body) body.scrollTop = savedScrollTop;
      });
      // اختيار التقويم المعتمد
      root.querySelectorAll('[data-act="set-region"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scroll = getScroll();
          const regId = btn.dataset.id;
          const reg = getSaudiEducationRegion(regId);
          const presetId = reg.presetId || reg.id;
          try {
            const result = await store.applyCalendarPreset(presetId);
            if (!result.ok) throw new Error('لا يمكن تطبيق التقويم على سنة أو فصل محذوف.');
          } catch (err) {
            toast(err.message || 'تعذر حفظ إعدادات التقويم.', 'danger');
            return;
          }
          toast(`تم تفعيل التقويم المعتمد: ${reg.name}`);
          repaint();
          calendarSettingsSheet(scroll);
        });
      });

      // إضافة سنة
      root.querySelector('[data-act="add-year"]')?.addEventListener('click', async () => {
        const scroll = getScroll();
        const data = await yearSheet();
        if (data?.hijriStart) {
          const y = makeYear({ hijriStart: data.hijriStart });
          if (store.getYear(y.id)) toast('هذه السنة موجودة مسبقًا', 'danger');
          else {
            const ok1 = await store.save({ years: [y] });
            const ok2 = await store.save({ terms: [makeTerm({ yearId: y.id, index: 1, status: 'active' })] });
            if (ok1 && ok2) { toast('تمت إضافة سنة دراسية جديدة'); repaint(); }
          }
        }
        calendarSettingsSheet(scroll);
      });

      // تعديل سنة
      root.querySelectorAll('[data-act="edit-year"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scroll = getScroll();
          const y = store.getYear(btn.dataset.id);
          if (!y) return;
          const data = await yearSheet(y);
          if (data) { await store.patch('years', y.id, { status: data.status }); toast('حُفظت تعديلات السنة'); repaint(); }
          calendarSettingsSheet(scroll);
        });
      });

      // استخدام سنة
      root.querySelectorAll('[data-act="use-year"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const targetYearId = btn.dataset.id;
          if (!hasValidYearCalendarConfig(targetYearId)) {
            toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
            return;
          }
          const scroll = getScroll();
          const yTerms = store.termsOf(targetYearId);
          await store.patchDevice({
            activeYearId: targetYearId,
            activeTermId: yTerms[0]?.id ?? null,
          });
          toast('تغيّرت السنة الحالية');
          repaint();
          calendarSettingsSheet(scroll);
        });
      });

      // استخدام فصل
      root.querySelectorAll('[data-act="use-term"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const t = store.getTerm(btn.dataset.id);
          if (!t || !t.startDate || !t.endDate) {
            toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
            return;
          }
          const targetYearId = t.yearId ?? store.activeYear()?.id;
          if (!hasValidYearCalendarConfig(targetYearId)) {
            toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
            return;
          }
          const scroll = getScroll();
          await store.patchDevice({
            activeTermId: btn.dataset.id,
            activeYearId: targetYearId,
          });
          toast('تغيّر الفصل الدراسي الحالي');
          repaint();
          calendarSettingsSheet(scroll);
        });
      });

      // تعديل فصل
      root.querySelectorAll('[data-act="edit-term-in-settings"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scroll = getScroll();
          const term = store.getTerm(btn.dataset.id);
          if (!term) return;
          const data = await termSheet(term);
          if (data) {
            try { await store.updateTermDates(term.id, data.startDate, data.endDate); toast('حُفظت تواريخ الفصل الدراسي'); repaint(); }
            catch (err) { toast(err.message, 'danger'); }
          }
          calendarSettingsSheet(scroll);
        });
      });

      // إضافة فصل
      root.querySelector('[data-act="add-term"]')?.addEventListener('click', async (e) => {
        const scroll = getScroll();
        const yId = e.currentTarget.dataset.year;
        const existing = store.termsOf(yId);
        const nextIndex = Math.max(0, ...existing.map((t) => t.index ?? 0)) + 1;
        const data = await newTermSheet(yId, nextIndex);
        if (data) {
          const t = makeTerm({ yearId: yId, ...data });
          if (store.getTerm(t.id)) toast('يوجد فصل دراسي بهذا الترتيب', 'danger');
          else { const ok = await store.save({ terms: [t] }); if (ok) { toast('تمت إضافة فصل دراسي بنجاح'); repaint(); } }
        }
        calendarSettingsSheet(scroll);
      });
    },
  });
}

function yearSheet(existing = null) {
  const y = existing ?? { hijriStart: 1448 };
  return openSheet({
    title: existing ? 'تعديل السنة' : 'سنة دراسية جديدة',
    body: html`
      <form id="year-form">
        <label class="field">
          <span class="field__label">بداية السنة الهجرية</span>
          <input
            class="input tabular"
            name="hijriStart"
            type="number"
            min="1300"
            max="1600"
            value="${y.hijriStart || 1448}"
            required
            ${existing ? 'readonly' : ''}
          />
          <span class="field__hint">تُسمّى السنة تلقائيًا، مثل ١٤٤٨-١٤٤٩ هـ.</span>
        </label>
        ${existing
          ? html`
              <div class="field">
                <span class="field__label">الحالة</span>
                <div class="segmented">
                  ${Object.entries(YEAR_STATUS).map(
                    ([k, label]) => html`
                      <label class="segmented__btn ${y.status === k ? 'is-on' : ''}">
                        <input
                          type="radio"
                          name="status"
                          value="${k}"
                          ${y.status === k ? 'checked' : ''}
                          hidden
                        />
                        ${label}
                      </label>
                    `
                  )}
                </div>
                <span class="field__hint">السنة المؤرشفة تبقى كاملة للعرض ولا تُعدَّل بالخطأ.</span>
              </div>
            `
          : ''}
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="year-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelectorAll('.segmented__btn').forEach((b) =>
        b.addEventListener('click', () => {
          root.querySelectorAll('.segmented__btn').forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
          b.querySelector('input').checked = true;
        })
      );
      root.querySelector('#year-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        done({
          hijriStart: Number(fd.get('hijriStart')),
          status: String(fd.get('status') ?? 'active'),
        });
      });
    },
  });
}

function newTermSheet(yearId, nextIndex) {
  return openSheet({
    title: `فصل دراسي جديد في السنة`,
    body: html`
      <form id="new-term-form">
        <label class="field">
          <span class="field__label">اسم الفصل</span>
          <input
            class="input"
            name="name"
            value="الفصل الدراسي ${TERM_NAMES[nextIndex] ?? nextIndex}"
            required
          />
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">تاريخ البداية</span>
            <input class="input tabular" name="startDate" type="date" />
          </label>
          <label class="field">
            <span class="field__label">تاريخ النهاية</span>
            <input class="input tabular" name="endDate" type="date" />
          </label>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="new-term-form" type="submit">إضافة</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#new-term-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        done({
          name: String(fd.get('name')).trim(),
          index: nextIndex,
          startDate: String(fd.get('startDate') || ''),
          endDate: String(fd.get('endDate') || ''),
          status: 'active',
        });
      });
    },
  });
}

function rangeSheet(existing = null) {
  const d = existing ?? { startDate: todayISO(), endDate: '', kind: 'holiday', label: '' };
  const official = store.calendarRangesOf().filter((range) => range.source?.startsWith('preset:'));
  return openSheet({
    title: existing ? 'تعديل الاستثناء' : 'إضافة استثناء للتقويم',
    body: html`
      <form id="range-form" class="cal-exception-form">
        <fieldset class="cal-exception-types">
          <legend>نوع الاستثناء</legend>
          <div class="cal-exception-options">
            ${[['study', 'دراسة حضورية'], ['remote', 'دراسة عن بُعد'], ['holiday', 'إجازة'], ['suspension', 'تعليق دراسة']].map(([kind, label]) => html`
              <label><input type="radio" name="kind" value="${kind}" ${d.kind === kind ? 'checked' : ''}><span>${label}</span></label>
            `)}
          </div>
        </fieldset>
        <label class="field cal-holiday-choice">
          <span class="field__label">اختر الإجازة</span>
          <select class="select" name="holidayContext">
            <option value="">اختر الإجازة</option>
            ${official.map((range) => html`<option value="${range.id}">${range.label}</option>`)}
            <option value="other" ${existing?.kind === 'holiday' ? 'selected' : ''}>إجازة أخرى</option>
          </select>
          <span class="field__hint cal-context-hint"></span>
        </label>
        <label class="field">
          <span class="field__label">اسم الاستثناء *</span>
          <input class="input" name="label" value="${d.label ?? ''}" placeholder="اكتب اسم الاستثناء" maxlength="80" required />
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">من *</span>
            <input class="input tabular" name="startDate" type="date" value="${d.startDate}" required />
          </label>
          <label class="field">
            <span class="field__label">إلى</span>
            <input class="input tabular" name="endDate" type="date" value="${d.endDate ?? ''}" />
          </label>
        </div>
        <p class="field__hint cal-type-hint"></p>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="range-form">${existing ? 'حفظ التعديل' : 'إضافة الاستثناء'}</button>
    `,
    onMount: (root, done) => {
      const form = root.querySelector('#range-form');
      const choice = form.elements.holidayContext;
      const updateType = () => {
        const kind = form.elements.kind.value;
        root.querySelector('.cal-holiday-choice').hidden = kind !== 'holiday';
        root.querySelector('.cal-type-hint').textContent = kind === 'remote'
          ? 'يوم تدريس عن بُعد، وفق التوقيت الحالي.' : kind === 'study'
            ? 'يوم تدريس حضوري، وفق التوقيت المعتاد.' : kind === 'suspension'
              ? 'تعليق الدراسة خلال التواريخ المحددة.' : 'ترك تاريخ النهاية فارغًا يعني يومًا واحدًا.';
      };
      form.elements.kind.forEach((input) => input.addEventListener('change', updateType));
      choice.addEventListener('change', () => {
        const selected = official.find((range) => range.id === choice.value);
        root.querySelector('.cal-context-hint').textContent = selected
          ? `الإجازة المرجعية: ${fmtDateRange(selected.startDate, selected.endDate)}. حدّد تواريخ استثنائك.` : '';
        if (selected) form.elements.label.value = `استثناء ${selected.label}`;
      });
      updateType();
      root.querySelector('#range-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const f = new FormData(event.target);
        const startDate = String(f.get('startDate'));
        const endDate = String(f.get('endDate') || startDate);
        const kind = String(f.get('kind'));
        if (kind === 'holiday' && !f.get('holidayContext'))
          return toast('اختر الإجازة أو إجازة أخرى.', 'danger');
        if (endDate < startDate)
          return toast('تاريخ النهاية يجب أن يكون في نفس تاريخ البداية أو بعده.', 'danger');
        done({
          startDate,
          endDate,
          kind,
          label: String(f.get('label')).trim(),
        });
      });
    },
  });
}

function termSheet(term) {
  return openSheet({
    title: `تعديل ${term.name}`,
    desc: 'احرص على ألا تتداخل تواريخ الفصول الدراسية وأن يبدأ الفصل الثاني بعد انتهاء الأول.',
    body: html`
      <form id="term-dates">
        <div class="field-row">
          <label class="field">
            <span class="field__label">من *</span>
            <input class="input tabular" name="startDate" type="date" value="${term.startDate ?? ''}" required />
          </label>
          <label class="field">
            <span class="field__label">إلى *</span>
            <input class="input tabular" name="endDate" type="date" value="${term.endDate ?? ''}" required />
          </label>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="term-dates">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#term-dates').addEventListener('submit', (event) => {
        event.preventDefault();
        const f = new FormData(event.target);
        done({
          startDate: String(f.get('startDate')),
          endDate: String(f.get('endDate')),
        });
      });
    },
  });
}

export default {
  title: () => 'التقويم الدراسي',
  subtitle: () => store.activeYear()?.label ?? '',
  topActions: () => null,
  onMount() {
    // A new Calendar visit starts at upcoming periods; switching filters remains local to this visit.
    activeFilter = 'upcoming';
    repaint();
  },
  onUnmount() {
    activeFilter = 'upcoming';
  },

  render() {
    const year = store.activeYear();
    const terms = store.termsOf(year?.id);
    const preset = store.calendarPresetForYear(year?.id) ?? getCalendarPreset(store.state.device?.preferredEducationRegion);
    const ranges = store.calendarRangesOf(year?.id);
    const today = todayISO();
    const totalDaysCount = ranges.reduce((n, range) => n + range.days.length, 0);

    const activeRegion = getSaudiEducationRegion(preset?.id ?? store.state.device?.preferredEducationRegion);

    // 1. حساب موضع "أين نحن الآن؟"
    const isInsideTerm1 = Boolean(terms[0]?.startDate && terms[0]?.endDate && today >= terms[0].startDate && today <= terms[0].endDate);
    const isInsideTerm2 = Boolean(terms[1]?.startDate && terms[1]?.endDate && today >= terms[1].startDate && today <= terms[1].endDate);
    const isMidtermBreak = Boolean(
      terms[0]?.endDate && terms[1]?.startDate && today > terms[0].endDate && today < terms[1].startDate
    );
    const isBeforeYear = Boolean(terms[0]?.startDate && today < terms[0].startDate);

    const currentTerm = isInsideTerm1 ? terms[0] : isInsideTerm2 ? terms[1] : terms[0] ?? null;

    let progressPct = 0;
    let elapsedDays = 0;
    let remainingDays = 0;
    let currentWeekNum = 1;
    let totalWeeksCount = 19;

    if (currentTerm?.startDate && currentTerm?.endDate) {
      const termTotalDays = Math.max(1, diffDays(currentTerm.startDate, currentTerm.endDate) + 1);
      totalWeeksCount = Math.ceil(termTotalDays / 7);

      if (today < currentTerm.startDate) {
        progressPct = 0;
        elapsedDays = 0;
        remainingDays = termTotalDays;
        currentWeekNum = 0;
      } else if (today > currentTerm.endDate) {
        progressPct = 100;
        elapsedDays = termTotalDays;
        remainingDays = 0;
        currentWeekNum = totalWeeksCount;
      } else {
        elapsedDays = Math.max(1, diffDays(currentTerm.startDate, today) + 1);
        remainingDays = Math.max(0, diffDays(today, currentTerm.endDate));
        progressPct = Math.min(100, Math.max(2, Math.round((elapsedDays / termTotalDays) * 100)));
        currentWeekNum = Math.min(Math.ceil(elapsedDays / 7), totalWeeksCount);
      }
    }

    // 2. حساب "المحطة القادمة" (الحدث / الإجازة التالية)
    const upcomingRanges = ranges
      .filter((r) => r?.endDate && r.endDate >= today && !isTeachingDay(r.kind))
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    const nextMilestone = upcomingRanges[0] ?? null;
    const nextMilestoneAffected = nextMilestone && nextMilestone.startDate && nextMilestone.endDate
      ? getAffectedSchedule(nextMilestone.startDate, nextMilestone.endDate)
      : [];

    // 3. تصفية الفترات حسب التبويب
    const officialCount = ranges.filter((r) => r.source.startsWith('preset:')).length;
    const exceptionsCount = ranges.filter((r) => !r.source.startsWith('preset:')).length;
    const upcomingCount = upcomingRanges.length;

    let filteredRanges = ranges;
    if (activeFilter === 'upcoming') filteredRanges = upcomingRanges;
    else if (activeFilter === 'official')
      filteredRanges = ranges.filter((r) => r.source.startsWith('preset:'));
    else if (activeFilter === 'exceptions')
      filteredRanges = ranges.filter((r) => !r.source.startsWith('preset:'));

    return html`
      <div class="management-page calendar-management-page calendar-work-0448">
      <!-- شريط الهوية والتقويم المعتمد وإجراءات التحكم -->
      <div class="cal-hero-strip">
        <div class="cal-hero-strip__identity">
          <div class="cal-hero-strip__meta-line">
            <span class="cal-hero-strip__badge">التقويم المعتمد</span>
            <span class="cal-year-label t-3 fs-xs"><bdi class="fw-7">${year?.label ?? '1448–1449 هـ'}</bdi> · <bdi>${preset?.gregorianLabel ?? '2026–2027 م'}</bdi></span>
          </div>

          <h1 class="cal-hero-strip__title">
            ${activeRegion.name.replace(/^تقويم\s+/u, '')}
          </h1>

          <p class="cal-hero-strip__subtitle" dir="rtl">
            ${activeRegion.subtitle}
          </p>
        </div>

        <div class="cal-hero-strip__actions">
          <button class="btn btn--quiet" data-act="open-settings" aria-label="إعدادات التقويم والمنطقة">
            ${icon('settings')}
            <span>إعدادات التقويم والمنطقة</span>
          </button>
        </div>
      </div>

      <!-- رادار الزمن الدراسي (أين نحن الآن + المحطة القادمة) -->
      <div class="cal-radar-grid">
        <!-- بطاقة: نبض الفصل الدراسي الجاري -->
        <div class="cal-card cal-card--pulse">
          <div class="cal-card__head">
            <span class="cal-card__eyebrow">
              <span class="cal-pulse-dot" aria-hidden="true"></span>
              <span>أين نحن الآن؟</span>
            </span>
            <span class="badge ${isInsideTerm1 || isInsideTerm2 ? 'badge--ok' : 'badge--info'}">
              ${isInsideTerm1
                ? 'الفصل الدراسي الأول (نشط)'
                : isInsideTerm2
                ? 'الفصل الدراسي الثاني (نشط)'
                : isMidtermBreak
                ? 'إجازة منتصف العام الدراسي'
                : isBeforeYear
                ? 'قبل بدء العام الدراسي'
                : 'العام الدراسي منتهٍ'}
            </span>
          </div>

          <h2 class="cal-card__title">
            ${isInsideTerm1 || isInsideTerm2
              ? html`الأسبوع <span class="tabular">${currentWeekNum}</span> من <span class="tabular">${totalWeeksCount}</span> أسبوعًا`
              : isMidtermBreak
              ? 'فترة التوقف بين الفصلين الدراسيين'
              : 'الجدول الزمني للعام'}
          </h2>

          <!-- مسار التقدم "أنت هنا" -->
          <div class="cal-progress-box" role="progressbar" aria-label="التقدم الزمني للفصل" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}">
            <div class="cal-progress-now">أنت هنا · ${fmtDate(today, false)}</div>
            <div class="cal-progress-track">
              <div class="cal-progress-fill" style="width: ${progressPct}%;"></div>
              <div
                class="cal-progress-pin"
                style="inset-inline-start: ${progressPct}%;"
                title="أنت هنا: ${fmtDate(today, false)}"
              ></div>
            </div>
            <div class="cal-progress-bounds">
              <span><small>بداية الفصل</small><strong>${currentTerm?.startDate ? fmtDate(currentTerm.startDate, false) : 'غير محددة'}</strong></span>
              <span><small>نهاية الفصل</small><strong>${currentTerm?.endDate ? fmtDate(currentTerm.endDate, false) : 'غير محددة'}</strong></span>
            </div>
          </div>

          <!-- مؤشرات زمنية سريعة -->
          <div class="cal-metrics-row">
            <div class="cal-metric">
              <div class="cal-metric__label">الأيام المتبقية</div>
              <div class="cal-metric__val"><bdi class="tabular">${remainingDays}</bdi> يومًا</div>
            </div>
            <div class="cal-metric">
              <div class="cal-metric__label">الأيام المنقضية</div>
              <div class="cal-metric__val"><bdi class="tabular">${elapsedDays}</bdi> يومًا</div>
            </div>
            <div class="cal-metric">
              <div class="cal-metric__label">نسبة الإنجاز الزمني</div>
              <div class="cal-metric__val"><bdi class="tabular">${progressPct}٪</bdi></div>
            </div>
          </div>
        </div>

        <!-- بطاقة: الإجازة القادمة -->
        <div class="cal-card">
          <div>
            <div class="cal-card__head">
              <span class="cal-card__eyebrow">
                ${icon('clock', 'compact')}
                <span>المحطة القادمة</span>
              </span>
              ${nextMilestone && nextMilestone.startDate && nextMilestone.endDate
                ? html`
                    <span
                      class="badge badge--${getRelativeStatus(nextMilestone.startDate, nextMilestone.endDate, today).tone}"
                    >
                      ${getRelativeStatus(nextMilestone.startDate, nextMilestone.endDate, today).text}
                    </span>
                  `
                : html`<span class="badge badge--sunk">لا يوجد</span>`}
            </div>

            ${nextMilestone && nextMilestone.startDate && nextMilestone.endDate
              ? html`
                  <div class="cal-milestone-spotlight">
                    <div class="cal-milestone-title-row">
                      <span class="cal-date-tile" aria-hidden="true"><span class="cal-date-tile__day">${parseParts(nextMilestone.startDate)?.day ?? ''}</span><span class="cal-date-tile__month">${AR_MONTHS[(parseParts(nextMilestone.startDate)?.month ?? 1) - 1]}</span></span>
                      <div class="cal-milestone-title">
                        ${nextMilestone.label || calendarLabel(nextMilestone.kind, CALENDAR_KIND[nextMilestone.kind])}
                        <small>${fmtDateRange(nextMilestone.startDate, nextMilestone.endDate)}</small>
                      </div>
                    </div>
                    <div class="cal-milestone-meta">
                      <span>${durationLabel(nextMilestone.startDate, nextMilestone.endDate)}</span>
                      <span>·</span>
                      <span>${nextMilestone.kind === 'suspension' ? 'تعليق دراسة' : nextMilestone.kind === 'remote' ? 'دراسة عن بُعد' : nextMilestone.kind === 'study' ? 'دراسة حضورية' : 'إجازة'}</span>
                      <span>·</span>
                      <span>${nextMilestone.source?.startsWith('preset:') ? 'رسمية معتمدة' : 'استثناء محلي'}</span>
                    </div>

                    <!-- تأثير الحصص على جدول المعلم -->
                    <div class="cal-milestone-affected">
                      ${nextMilestoneAffected.length > 0
                        ? html`
                            <span class="tabular">${nextMilestoneAffected.length} حصص متأثرة</span>
                            <button
                              class="btn btn--sm btn--quiet"
                              data-act="view-affected"
                              data-id="${nextMilestone.id}"
                            >
                              ${icon('clock')} عرض الحصص المتأثرة
                            </button>
                          `
                        : html`
                            <span class="t-3 fs-xs">
                              لا توجد حصص مجدولة في أيام التدريس المتزامنة مع هذه الفترة.
                            </span>
                          `}
                    </div>
                  </div>

                `
              : html`
                  <div class="empty py-3">
                    <p class="t-3 fs-sm">اكتملت جميع الفترات والإجازات المسجلة لهذا العام الدراسي.</p>
                  </div>
                `}
          </div>

        </div>
      </div>

      <!-- الفصول الدراسية للعام -->
      <div class="section mb-5 cal-terms-section">
        <div class="section__head">
          <div>
            <h3 class="section__title">الفصول الدراسية</h3>
          </div>
          <button class="btn btn--sm btn--quiet" data-act="add-term">${icon('plus')} إضافة فصل</button>
        </div>

        <div class="cal-terms-grid">
          ${terms.length === 0
            ? html`
                <div class="card card--pad t-3 fs-sm" style="grid-column: 1 / -1;">
                  لم يتم إعداد فصول دراسية لهذه السنة حتى الآن.
                </div>
              `
            : terms.map((term, index) => {
                const hasDates = Boolean(term.startDate && term.endDate);
                const isCurrent = (index === 0 && isInsideTerm1) || (index === 1 && isInsideTerm2);
                const termTotalDays = hasDates ? Math.max(1, diffDays(term.startDate, term.endDate) + 1) : 0;
                const termWeeks = hasDates ? Math.ceil(termTotalDays / 7) : 0;

                // الإجازات المتخللة للفصل
                const termHolidays = hasDates
                  ? ranges.filter(
                      (r) =>
                        r.kind === 'holiday' &&
                        r.startDate &&
                        r.endDate &&
                        r.startDate >= term.startDate &&
                        r.endDate <= term.endDate
                    )
                  : [];
                const termSuspensions = hasDates
                  ? ranges.filter((r) => r.kind === 'suspension' && r.startDate && r.endDate &&
                      r.startDate >= term.startDate && r.endDate <= term.endDate)
                  : [];
                const holidayDaysCount = termHolidays.reduce((n, r) => n + (r?.days?.length ?? 0), 0);
                const suspensionDaysCount = termSuspensions.reduce((n, r) => n + (r?.days?.length ?? 0), 0);
                const estimatedTeachingDays = Math.max(0, termWeeks * 5 - holidayDaysCount - suspensionDaysCount);

                return html`
                  <div class="cal-term-card ${isCurrent ? 'is-active' : ''}">
                    <div>
                      <div class="cal-term-card__head">
                        <span class="cal-term-card__name">${term.name}</span>
                        <span class="badge ${isCurrent ? 'badge--ok' : 'badge--sunk'}">
                          ${isCurrent
                            ? 'الجاري'
                            : hasDates && today < term.startDate
                            ? 'القادم'
                            : hasDates
                            ? 'منتهٍ'
                            : 'غير محدد'}
                        </span>
                      </div>

                      <div class="cal-term-dates mt-3">
                        <div class="cal-term-date-row">
                          <span class="cal-term-date-label">البداية</span>
                          <span class="cal-term-date-val">${hasDates ? fmtDate(term.startDate, false) : '—'}</span>
                        </div>
                        <div class="cal-term-date-row">
                          <span class="cal-term-date-label">النهاية</span>
                          <span class="cal-term-date-val">${hasDates ? fmtDate(term.endDate, false) : '—'}</span>
                        </div>
                      </div>

                      <div class="cal-term-stats mt-3">
                        <span><strong>${termWeeks}</strong><small>أسبوعًا</small></span>
                        <span><strong>نحو ${estimatedTeachingDays}</strong><small>يوم تدريس</small></span>
                        <span><strong>${termHolidays.length} فترات إجازة${termSuspensions.length ? ` · ${termSuspensions.length} تعليق دراسة` : ''}</strong><small>${holidayDaysCount + suspensionDaysCount} يومًا</small></span>
                      </div>
                    </div>

                    <div class="cal-term-edit">
                      <button
                        class="btn btn--sm btn--quiet"
                        data-act="edit-term"
                        data-id="${term.id}"
                      >
                        ${icon('edit')} تعديل
                      </button>
                    </div>
                  </div>
                `;
              })}
        </div>
      </div>

      <!-- المخطط الزمني للفترات والإجازات -->
      <div class="section cal-holidays-section">
        <div class="section__head">
          <div>
            <h3 class="section__title">الإجازات والفترات الدراسية</h3>
          </div>
          <button class="btn btn--primary btn--sm" data-act="add" aria-label="إضافة استثناء">
            ${icon('plus')} إضافة استثناء
          </button>
        </div>

        <!-- تبويبات التصفية السريعة -->
        <div class="cal-filters-row" role="group" aria-label="تصفية فترات التقويم">
          <button
            type="button"
            class="cal-filter-btn ${activeFilter === 'upcoming' ? 'is-active' : ''}"
            data-act="filter"
            data-filter="upcoming"
            aria-pressed="${activeFilter === 'upcoming' ? 'true' : 'false'}"
          >
            <span>القادمة</span>
          </button>
          <button
            type="button"
            class="cal-filter-btn ${activeFilter === 'all' ? 'is-active' : ''}"
            data-act="filter"
            data-filter="all"
            aria-pressed="${activeFilter === 'all' ? 'true' : 'false'}"
          >الكل</button>
          <button
            type="button"
            class="cal-filter-btn ${activeFilter === 'official' ? 'is-active' : ''}"
            data-act="filter"
            data-filter="official"
            aria-pressed="${activeFilter === 'official' ? 'true' : 'false'}"
          >
            <span>رسمية معتمدة</span>
          </button>
          <button
            type="button"
            class="cal-filter-btn ${activeFilter === 'exceptions' ? 'is-active' : ''}"
            data-act="filter"
            data-filter="exceptions"
            aria-pressed="${activeFilter === 'exceptions' ? 'true' : 'false'}"
          >
            <span>استثناءات محلية</span>
          </button>
        </div>
        <p class="cal-filter-count" aria-live="polite">${filteredRanges.length} ${activeFilter === 'exceptions' ? 'استثناءات محلية' : activeFilter === 'upcoming' ? 'فترات قادمة أو جارية' : 'فترات'}</p>

        <!-- قائمة الفترات -->
        ${filteredRanges.length === 0
          ? html`
              <div class="card card--pad text-center py-6">
                <div class="t-3 fs-sm mb-3">
                  ${activeFilter === 'exceptions'
                    ? 'لم تُسجَّل أي استثناءات محلية بعد. جميع الفترات الحالية مطابقة للتقويم الرسمي.'
                    : 'لا توجد فترات مطابقة لهذا الاختيار.'}
                </div>
              </div>
            `
          : html`
              <div class="cal-timeline-list">
                ${filteredRanges.map((range) => {
                  const meta = CALENDAR_KIND[range.kind] ?? CALENDAR_KIND.holiday;
                  const tone = calendarTone(range.kind);
                  const isOfficial = range.source.startsWith('preset:');
                  const relStatus = getRelativeStatus(range.startDate, range.endDate, today);
                  const isCurrentNow = relStatus.text === 'جارية الآن';

                  const startP = parseParts(range.startDate);
                  const endP = parseParts(range.endDate);
                  const monthName = startP ? AR_MONTHS[startP.month - 1] : '';
                  const crossesMonth = Boolean(startP && endP && range.startDate.slice(0, 7) !== range.endDate.slice(0, 7));
                  const dayDisplay = startP && endP && range.startDate !== range.endDate && !crossesMonth
                    ? `${startP.day}–${endP.day}` : startP ? String(startP.day) : '';

                  const affectedCount = getAffectedSchedule(
                    range.startDate,
                    range.endDate
                  ).length;

                  return html`
                    <div
                      class="cal-period-row calendar-period calendar-period--${tone} ${isCurrentNow
                        ? 'cal-period-row--active'
                        : ''}"
                    >
                      <div class="cal-period-top">
                        <!-- بلاطة التاريخ -->
                        <div class="cal-date-tile ${range.startDate !== range.endDate && !crossesMonth ? 'cal-date-tile--range' : ''}" aria-hidden="true">
                          <span class="cal-date-tile__day" dir="ltr">${dayDisplay}</span>
                          <span class="cal-date-tile__month">${monthName}</span>
                        </div>

                        <!-- تفاصيل الفترة -->
                        <div class="cal-period-info">
                          <div class="cal-period-title-wrap"><span class="cal-period-title">${range.label || calendarLabel(range.kind, meta)}</span></div>

                          <div class="cal-period-sub">
                            ${crossesMonth ? html`<span>${fmtDateRange(range.startDate, range.endDate)}</span><span>·</span>` : ''}
                            <span>${durationLabel(range.startDate, range.endDate)}</span>
                            <span>·</span>
                            <span>${range.kind === 'remote' ? 'دراسة عن بُعد' : range.kind === 'study' ? 'دراسة حضورية' : range.kind === 'suspension' ? 'تعليق دراسة' : isOfficial ? 'إجازة معتمدة' : 'إجازة محلية'}</span>
                            ${affectedCount ? html`<span>· ${affectedCount} حصص متأثرة</span>` : ''}
                            ${isCurrentNow ? html`<span>· جارية الآن</span>` : ''}
                          </div>
                          <span class="sr-only">${fmtDateRange(range.startDate, range.endDate)}</span>
                        </div>
                      </div>

                      <!-- الإجراءات -->
                      <div class="cal-period-actions">
                        <button class="iconbtn" data-act="view-affected" data-id="${range.id}" aria-label="تفاصيل ${range.label || calendarLabel(range.kind, meta)}${isOfficial ? '' : ' وتعديل الاستثناء'}">${icon('chev')}</button>
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
      </div>

      <details class="cal-accreditation-card">
        <summary>${icon('book')} <span>مصدر التقويم والمنطقة</span> ${icon('chev')}</summary>
        <div class="cal-accreditation-card__main">
          <div class="cal-accreditation-card__title">التقويم الدراسي المعتمد لوزارة التعليم</div>
          <p>${activeRegion.name} · ${activeRegion.subtitle}</p>
          <p>${activeRegion.coverage?.join(' · ') ?? ''}</p>
          <p>الفترات الرسمية المرجعية محفوظة، والاستثناءات المحلية منفصلة عنها.</p>
        </div>
      </details>
      </div>
    `;
  },

  actions: {
    async 'add-term'() {
      const year = store.activeYear();
      if (!year) return;
      const nextIndex = Math.max(0, ...store.termsOf(year.id).map((term) => term.index ?? 0)) + 1;
      const data = await newTermSheet(year.id, nextIndex);
      if (!data) return;
      const term = makeTerm({ yearId: year.id, ...data });
      if (store.getTerm(term.id)) return toast('يوجد فصل دراسي بهذا الترتيب', 'danger');
      try { await store.save({ terms: [term] }); toast('تمت إضافة فصل دراسي بنجاح'); }
      catch (error) { toast(error.message, 'danger'); }
    },
    'open-settings'() {
      calendarSettingsTab = 'calendar';
      calendarSettingsSheet();
    },

    'view-affected'(el) {
      const range = store.calendarRangesOf().find((item) => item.id === el.dataset.id);
      if (!range) return;
      affectedSessionsSheet(range);
    },

    filter(el) {
      activeFilter = el.dataset.filter || 'all';
      repaint();
    },

    async exception(el) {
      const range = store.calendarRangesOf().find((item) => item.id === el.dataset.id);
      if (!range) return;
      const data = await rangeSheet({
        startDate: shiftDate(range.endDate, 1),
        endDate: '',
        kind: range.kind,
        label: 'تمديد ' + range.label,
      });
      if (!data) return;
      const calendar = await store.ensureCalendar();
      try {
        await store.saveCalendarRange({ calendarId: calendar.id, ...data });
        toast('أُضيف الاستثناء المحلي');
      } catch (error) { toast(error.message, 'danger'); }
    },

    async add() {
      const data = await rangeSheet();
      if (!data) return;
      const cal = await store.ensureCalendar();
      try {
        await store.saveCalendarRange({ calendarId: cal.id, ...data });
        toast('أُضيفت الفترة إلى التقويم');
      } catch (error) { toast(error.message, 'danger'); }
    },

    async edit(el) {
      const range = store.calendarRangesOf().find((item) => item.id === el.dataset.id);
      if (!range) return;
      const data = await rangeSheet(range);
      if (!data) return;
      try {
        await store.saveCalendarRange({ id: range.id, calendarId: range.calendarId, ...data });
        toast('حُفظت تعديلات الفترة');
      } catch (error) { toast(error.message, 'danger'); }
    },

    async remove(el) {
      const range = store.calendarRangesOf().find((item) => item.id === el.dataset.id);
      if (!range) return;
      if (
        !(await confirmSheet({
          title: 'حذف هذه الفترة؟',
          desc: 'سيُحذف هذا الاستثناء المحلي ولن يؤثر على التقويم الرسمي المعتمد.',
          confirmLabel: 'احذف',
          danger: true,
        }))
      )
        return;
      try {
        await store.removeCalendarRange(range.calendarId, range.id);
        toast('حُذفت الفترة');
      } catch (error) { toast(error.message, 'danger'); }
    },

    async 'edit-term'(el) {
      const term = store.getTerm(el.dataset.id);
      if (!term) return;
      const data = await termSheet(term);
      if (!data) return;
      try {
        await store.updateTermDates(term.id, data.startDate, data.endDate);
        toast('حُفظت تواريخ الفصل الدراسي');
      } catch (error) {
        toast(error.message, 'danger');
      }
    },
  },
};
