import '../lib/rakeez-datetime.js';
import { html, icon, openSheet, closeSheet, toast, confirmSheet, fmtDateRange, fmtDate } from '../lib/dom.js';
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
import { renderCalendar0417 } from './calendar-0417-ui.js';
import { applyDemoCalendarPreset } from '../lib/demo-workspace.js';

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
let settingsTab = 'calendar';

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
function affectedSessionsSheet(range) {
  const affected = getAffectedSchedule(range.startDate, range.endDate);
  const byDate = new Map();
  for (const item of affected) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  }

  return openSheet({
    title: range.label || calendarLabel(range.kind, CALENDAR_KIND[range.kind]),
    body: html`
      <div class="calendar-work-impact">
        <p class="calendar-work-impact-summary">
          ${fmtDateRange(range.startDate, range.endDate)} · ${durationLabel(range.startDate, range.endDate)}<br>
          ${!isTeachingDay(range.kind)
            ? range.kind === 'suspension'
              ? 'الحصص الواقعة في تعليق الدراسة لا تُحتسب غيابًا.'
              : 'الحصص الواقعة في الإجازة لا تُحتسب غيابًا.'
            : range.kind === 'remote'
              ? 'حصص هذه الفترة تُدرج بنمط التعليم عن بُعد.'
              : 'حصص دراسية معتمدة حضورياً.'}
        </p>
        <h3>الحصص المتأثرة · ${affected.length}</h3>
        ${affected.length ? Array.from(byDate.entries()).map(([date, items]) => html`
          <section class="calendar-work-impact-day" aria-label="${fmtDate(date, true)}">
            <h4>${WEEKDAYS[weekday(date)]} ${fmtDate(date, true)}</h4>
            <ul>${items.map(item => html`<li>
              <span>الحصة ${item.period}</span>
              <div><strong>${item.sectionName}</strong><small>${item.subjectName}</small></div>
            </li>`)}</ul>
          </section>
        `) : html`<p class="calendar-work-impact-empty">لا توجد حصص متأثرة في بيانات هذا التقويم.</p>`}
      </div>
    `,
    foot: html`
      ${range.source?.startsWith('preset:') ? '' : html`
        <button class="btn btn--ghost" data-calendar-range-edit>تعديل الاستثناء</button>
        <button class="btn btn--ghost" data-calendar-range-delete>حذف الاستثناء</button>
      `}
      <button class="btn btn--quiet" data-sheet-close>إغلاق</button>
    `,
    onMount: (root, done) => {
      root.querySelector('[data-calendar-range-edit]')?.addEventListener('click', async () => {
        done();
        const data = await rangeSheet(range);
        if (!data) return;
        try {
          await store.saveCalendarRange({ id: range.id, calendarId: range.calendarId, ...data });
          repaint();
          toast('حُفظت تعديلات الفترة');
        } catch (error) { toast(error.message, 'danger'); }
      });
      root.querySelector('[data-calendar-range-delete]')?.addEventListener('click', async () => {
        done();
        const confirmed = await confirmSheet({
          title: 'حذف هذا الاستثناء؟',
          desc: html`<span class="calendar-work-delete-desc">هذا استثناء محلي؛ الإجازة المرجعية تبقى محفوظة.</span>`,
          confirmLabel: 'حذف الاستثناء',
          danger: true,
        });
        if (!confirmed) return;
        try {
          await store.removeCalendarRange(range.calendarId, range.id);
          repaint();
          toast('حُذفت الفترة');
        } catch (error) { toast(error.message, 'danger'); }
      });
    },
  });
}

/**
 * نافذة إدارة إعدادات التقويم والمنطقة التعليمية — مركزية داخل التقويم
 */
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
      <nav class="calendar-work-settings-tabs" aria-label="أقسام إعدادات التقويم">
        ${[['calendar','التقويم'],['years','السنوات'],['terms','الفصول']].map(([key,label]) => html`
          <button type="button" data-settings-tab="${key}" aria-pressed="${settingsTab === key}">${label}</button>
        `)}
      </nav>
      <div class="stack stack-4 calendar-work-settings">
        <!-- 1. اختيار التقويم المعتمد -->
        <div data-settings-panel="calendar" ${settingsTab === 'calendar' ? '' : 'hidden'}>
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
                    aria-label="${reg.shortName}، ${reg.subtitle}"
                  >
                    <span class="calendar-work-radio" aria-hidden="true"></span>
                    <span class="calendar-work-region-copy">
                      <strong>${reg.shortName}</strong><small>${reg.subtitle}</small>
                    </span>
                  </button>
                `;
              }
            )}
          </div>
        </div>

        <!-- 2. السنوات الدراسية -->
        <div data-settings-panel="years" ${settingsTab === 'years' ? '' : 'hidden'}>
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
        <div data-settings-panel="terms" ${settingsTab === 'terms' ? '' : 'hidden'}>
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
    foot: html`<button class="btn btn--quiet" data-sheet-close>تم</button>`,
    onMount: (root) => {
      root.querySelectorAll('[data-settings-tab]').forEach((button) => button.addEventListener('click', () => {
        settingsTab = button.dataset.settingsTab;
        root.querySelectorAll('[data-settings-tab]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        root.querySelectorAll('[data-settings-panel]').forEach((panel) => { panel.hidden = panel.dataset.settingsPanel !== settingsTab; });
        button.focus();
      }));
      const getScroll = () => root.querySelector('.sheet__body')?.scrollTop ?? 0;
      if (savedScrollTop > 0) requestAnimationFrame(() => {
        const body = root.querySelector('.sheet__body');
        if (body) body.scrollTop = savedScrollTop;
      });
      // اختيار التقويم المعتمد
      root.querySelectorAll('[data-act="set-region"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const regId = btn.dataset.id;
          const reg = getSaudiEducationRegion(regId);
          const presetId = reg.presetId || reg.id;
          try {
            const result = store.getActiveWorkspace()?.type === 'demo'
              ? await applyDemoCalendarPreset(presetId)
              : await store.applyCalendarPreset(presetId);
            if (!result.ok) throw new Error('لا يمكن تطبيق التقويم على سنة أو فصل محذوف.');
          } catch (err) {
            toast(err.message || 'تعذر حفظ إعدادات التقويم.', 'danger');
            return;
          }
          toast(`تم تفعيل التقويم المعتمد: ${reg.name}`);
          repaint();
          closeSheet();
        });
      });

      // إضافة سنة
      root.querySelector('[data-act="add-year"]')?.addEventListener('click', async () => {
        const scroll = getScroll();
        closeSheet();
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
          closeSheet();
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
          closeSheet();
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
          closeSheet();
          calendarSettingsSheet(scroll);
        });
      });

      // تعديل فصل
      root.querySelectorAll('[data-act="edit-term-in-settings"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scroll = getScroll();
          const term = store.getTerm(btn.dataset.id);
          if (!term) return;
          closeSheet();
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
        closeSheet();
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
            <input class="input tabular" name="startDate" type="text" data-rakeez-datetime="date" />
          </label>
          <label class="field">
            <span class="field__label">تاريخ النهاية</span>
            <input class="input tabular" name="endDate" type="text" data-rakeez-datetime="date" />
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
  const references = store.calendarRangesOf().filter((range) => range.source?.startsWith('preset:') && !isTeachingDay(range.kind));
  return openSheet({
    title: existing?.id ? 'تعديل الاستثناء' : 'إضافة استثناء للتقويم',
    body: html`
      <form id="range-form" class="calendar-work-form">
        <fieldset class="calendar-work-types">
          <legend>نوع الاستثناء</legend>
          <div class="calendar-work-type-options">
            ${[['study', 'دراسة حضورية'], ['remote', 'دراسة عن بُعد'], ['holiday', 'إجازة'], ['suspension', 'تعليق دراسة']].map(([kind, label]) => html`
              <label class="calendar-work-type-option">
                <input type="radio" name="kind" value="${kind}" ${d.kind === kind ? 'checked' : ''} />
                <span>${label}</span>
              </label>
            `)}
          </div>
        </fieldset>
        <label class="field calendar-work-reference" ${d.kind === 'holiday' ? '' : 'hidden'}>
          <span class="field__label">اختر الإجازة</span>
          <select class="select" name="holidayReference">
            <option value="">اختر الإجازة</option>
            ${references.map((range) => html`<option value="${range.id}" ${d.referenceId === range.id ? 'selected' : ''}>${range.label}</option>`)}
            <option value="other" ${existing?.id && d.kind === 'holiday' ? 'selected' : ''}>إجازة أخرى</option>
          </select>
        </label>
        <p class="calendar-work-reference-hint" aria-live="polite" hidden></p>
        <label class="field">
          <span class="field__label">الوصف أو اسم الفترة *</span>
          <input class="input" name="label" value="${d.label ?? ''}" placeholder="اكتب اسم الاستثناء" maxlength="80" required />
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">من *</span>
            <input class="input tabular" name="startDate" type="text" data-rakeez-datetime="date" value="${d.startDate}" required />
          </label>
          <label class="field">
            <span class="field__label">إلى</span>
            <input class="input tabular" name="endDate" type="text" data-rakeez-datetime="date" value="${d.endDate ?? ''}" />
          </label>
        </div>
        <p class="field__hint">ترك تاريخ النهاية فارغًا يعني يومًا واحدًا.</p>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="range-form">${existing?.id ? 'حفظ التعديل' : 'إضافة الاستثناء'}</button>
    `,
    onMount: (root, done) => {
      const form = root.querySelector('#range-form');
      const reference = form.querySelector('[name="holidayReference"]');
      const hint = form.querySelector('.calendar-work-reference-hint');
      const updateType = () => {
        const holiday = form.querySelector('[name="kind"]:checked')?.value === 'holiday';
        form.querySelector('.calendar-work-reference').hidden = !holiday;
        reference.required = holiday;
        hint.hidden = !holiday || !reference.value || reference.value === 'other';
      };
      form.querySelectorAll('[name="kind"]').forEach((radio) => radio.addEventListener('change', updateType));
      reference.addEventListener('change', () => {
        const range = references.find((item) => item.id === reference.value);
        if (range) {
          hint.innerHTML = html`الإجازة المرجعية: ${fmtDateRange(range.startDate, range.endDate)}. حدّد تواريخ استثنائك.`;
          hint.hidden = false;
          form.querySelector('[name="label"]').value = 'استثناء ' + range.label;
        } else {
          hint.replaceChildren();
          hint.hidden = true;
        }
      });
      updateType();
      if (d.referenceId && reference.value === d.referenceId) {
        const range = references.find((item) => item.id === d.referenceId);
        if (range) {
          hint.innerHTML = html`الإجازة المرجعية: ${fmtDateRange(range.startDate, range.endDate)}. حدّد تواريخ استثنائك.`;
          hint.hidden = false;
        }
      }
      root.querySelector('#range-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const f = new FormData(event.target);
        const startDate = String(f.get('startDate'));
        const endDate = String(f.get('endDate') || startDate);
        if (endDate < startDate)
          return toast('تاريخ النهاية يجب أن يكون في نفس تاريخ البداية أو بعده.', 'danger');
        done({
          startDate,
          endDate,
          kind: String(f.get('kind')),
          label: String(f.get('label')).trim(),
        });
      });
    },
  });
}

function termSheet(term) {
  return openSheet({
    title: `تعديل تواريخ ${term.name}`,
    body: html`
      <form id="term-dates">
        <div class="field-row">
          <label class="field">
            <span class="field__label">من *</span>
            <input class="input tabular" name="startDate" type="text" data-rakeez-datetime="date" value="${term.startDate ?? ''}" required />
          </label>
          <label class="field">
            <span class="field__label">إلى *</span>
            <input class="input tabular" name="endDate" type="text" data-rakeez-datetime="date" value="${term.endDate ?? ''}" required />
          </label>
        </div>
        <p class="field__hint">يجب ألا تتداخل تواريخ الفصول الدراسية.</p>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="term-dates">حفظ التواريخ</button>
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
  onUnmount() {
    // N51: each new Calendar visit opens on upcoming; in-visit filter stays local.
    activeFilter = 'upcoming';
    settingsTab = 'calendar';
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

    return renderCalendar0417({
      year, terms, preset, ranges, today, activeRegion, currentTerm,
      running: isInsideTerm1 || isInsideTerm2,
      phase: isInsideTerm1 || isInsideTerm2 ? `${currentTerm.name} (نشط)` : isMidtermBreak ? 'بين الفصلين الدراسيين' : isBeforeYear ? 'قبل بدء العام الدراسي' : 'العام الدراسي منتهٍ',
      currentWeekNum, totalWeeksCount, progressPct, elapsedDays, remainingDays,
      nextMilestone, nextMilestoneAffected, filteredRanges, activeFilter,
      getRelativeStatus, durationLabel, diffDays, getAffectedSchedule, calendarLabel,
    });
  },

  actions: {
    'open-settings'() {
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
        referenceId: range.id,
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
          title: 'حذف هذا الاستثناء؟',
          desc: html`<span class="calendar-work-delete-desc">هذا استثناء محلي؛ الإجازة المرجعية تبقى محفوظة.</span>`,
          confirmLabel: 'حذف الاستثناء',
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
