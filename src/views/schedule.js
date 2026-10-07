/**
 * الجدول الدراسي — الأسبوع المتكرر.
 *
 * `slots` تمثّل الجدول المتكرر، و`sessions` تُولَّد منه × تواريخ الفصل الدراسي.
 * وعدد الحصص الأسبوعية يُشتق من عدد الفترات لا يُخزَّن رقمًا ثابتًا —
 * فحصتان أسبوعيًا للمهارات الرقمية سطران هنا، لا رقم في الشيفرة.
 */

import { html, render, icon, openSheet, toast, confirmSheet, fmtTimeRange, formatTimeRange, timingProfileIcon } from "../lib/dom.js";
import { downloadBlob } from "../lib/export.js";
import {
  buildScheduleExportModel,
  canShareScheduleFile,
  createSchedulePngFile,
  openSchedulePrint,
  renderSchedulePng,
  scheduleExportEligibility,
  shareOrDownloadSchedule,
} from "../lib/schedule-export.js";
import * as store from "../store.js";
import { WEEKDAYS, SCHOOL_WEEKDAYS, todayISO, weekday, sectionLabel, isTeachingDay, CALENDAR_KIND, safeColor, gradeLabel } from "../models.js";
import { repaint } from "../repaint.js";
import { getAccountPresentation } from "../lib/account-profile.js";

const SHORT_GRADES = {
  1: "أول",
  2: "ثاني",
  3: "ثالث",
  4: "رابع",
  5: "خامس",
  6: "سادس",
  7: "أول متوسط",
  8: "ثاني متوسط",
  9: "ثالث متوسط",
  10: "أول ثانوي",
  11: "ثاني ثانوي",
  12: "ثالث ثانوي",
};

/**
 * تطبيع اسم أو رمز الشعبة للعرض دون تكرار الصف الدراسي
 * مثال: "الخامس الابتدائي / تجريبي 5" -> "تجريبي 5"
 * أو "خامس / أ" مع الصف 5 -> "أ"
 */
export function formatSectionDisplay(secOrGrade, maybeName) {
  let grade = null;
  let raw = "";

  if (typeof secOrGrade === "object" && secOrGrade !== null) {
    grade = secOrGrade.grade;
    raw = String(secOrGrade.label || secOrGrade.name || secOrGrade.section || "").trim();
  } else {
    grade = secOrGrade;
    raw = String(maybeName !== undefined ? maybeName : (typeof secOrGrade === "string" ? secOrGrade : "")).trim();
  }

  if (!raw) return "1";

  const gLabel = gradeLabel(grade);
  if (gLabel && raw.startsWith(gLabel)) {
    raw = raw.slice(gLabel.length).replace(/^[\s/—–-]+/, "").trim();
  }

  // Check if raw starts with short grade names like 'خامس' or 'الخامس'
  if (grade && SHORT_GRADES[Number(grade)]) {
    const sGrade = SHORT_GRADES[Number(grade)];
    const fullGrade = `ال${sGrade}`;
    if (raw.startsWith(fullGrade)) {
      raw = raw.slice(fullGrade.length).replace(/^[\s/—–-]+/, "").trim();
    } else if (raw.startsWith(sGrade)) {
      raw = raw.slice(sGrade.length).replace(/^[\s/—–-]+/, "").trim();
    }
  }

  return raw || "1";
}

/**
 * اسم الصف والشعبة المختصر لبطاقة الحصة في الجدول الأسبوعي
 * مثال: خامس/أ أو أول متوسط/2
 */
export function shortClassLabel(sec) {
  if (!sec) return "";
  const shortGrade = SHORT_GRADES[Number(sec.grade)] || gradeLabel(sec.grade) || "";
  const secName = formatSectionDisplay(sec);
  return shortGrade ? `${shortGrade}/${secName}` : secName;
}

/** صياغة عربية موجزة لعدد الحصص الأسبوعية دون تغيير القيمة المشتقة من الجدول. */
export function weeklySessionsLabel(value) {
  const count = Number(value) || 0;
  if (count === 1) return "حصة واحدة أسبوعيًا";
  if (count === 2) return "حصتان أسبوعيًا";
  if (count >= 3 && count <= 10) return `${count} حصص أسبوعيًا`;
  return `${count} حصة أسبوعيًا`;
}

// A selection is kept only for the current visit. The first mobile view follows
// the actual school day: today when it is teachable, otherwise the weekly view.
let activeMobileDay = null;
let equalizeFrame = 0;

// N22 Option A: measure the natural height of every visible weekly slot,
// then give those slots one shared height. This changes presentation only.
function equalizeVisibleScheduleSlots() {
  cancelAnimationFrame(equalizeFrame);
  equalizeFrame = requestAnimationFrame(() => {
    const week = document.querySelector('.page--schedule .week');
    if (!week) return;
    const slots = [...week.querySelectorAll('.slot')];
    slots.forEach(slot => { slot.style.height = '';
    });
    const visible = slots.filter(slot => slot.getBoundingClientRect().width > 0);
    if (!visible.length) return;
    const height = Math.ceil(Math.max(...visible.map(slot => slot.getBoundingClientRect().height)));
    visible.forEach(slot => { slot.style.height = `${height}px`; });
  });
}

function scheduleExportPreview(model) {
  const presentation = getAccountPresentation(model.identity.teacherForm);
  const identity = [
    model.identity.teacherName && `${presentation.teacherLabel}: ${model.identity.teacherName}`,
    model.identity.schoolName && `المدرسة: ${model.identity.schoolName}`,
  ].filter(Boolean);
  return html`
    <article class="schedule-export-preview" dir="rtl" aria-label="معاينة الجدول الأسبوعي">
      <header class="schedule-export-preview__head">
        <span class="schedule-export-preview__brand">رَكيز المعلم</span>
        <h3>${model.title}</h3>
        ${identity.length ? html`<p>${identity.join(' · ')}</p>` : ''}
        <p>${[model.academic.year, model.academic.term, model.timing?.label].filter(Boolean).join(' · ')}</p>
      </header>
      <div class="schedule-export-preview__tablewrap" tabindex="0" aria-label="جدول المعاينة قابل للتمرير أفقيًا">
        <table class="schedule-export-preview__table">
          <thead><tr><th scope="col">اليوم</th>${model.periods.map(({ period }) => html`<th scope="col">الحصة ${period}</th>`)}</tr></thead>
          <tbody>${model.days.map((day) => html`
            <tr>
              <th scope="row">${day.label}</th>
              ${model.periods.map((unused, periodIndex) => {
                const cell = day.periods[periodIndex];
                if (!cell?.teaching) return html`<td class="is-empty"><span class="sr-only">لا توجد حصة</span></td>`;
                return html`<td><strong>${cell.teaching.classLabel}</strong><span>${cell.teaching.subjectLabel}${cell.time ? html` · <bdi dir="ltr">${formatTimeRange(cell.time.start, cell.time.end)}</bdi>` : ''}</span></td>`;
              })}
            </tr>
          `)}</tbody>
        </table>
      </div>
    </article>
  `;
}

function openScheduleExportSheet() {
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const initial = {
    includeTeacherName: Boolean(String(profile.teacherName ?? '').trim()),
    includeSchoolName: Boolean(String(profile.schoolName ?? '').trim()),
    includeTimes: true,
  };

  return openSheet({
    title: 'تصدير الجدول',
    desc: 'راجع الجدول ثم نزّله صورة أو اطبعه واحفظه PDF بحجم A4 أفقي.',
    body: html`
      <form id="schedule-export-form" class="schedule-export-options">
        <label class="schedule-export-option">
          <input type="checkbox" name="includeTeacherName" ${initial.includeTeacherName ? 'checked' : 'disabled'}>
          <span><strong>${presentation.teacherNameLabel}</strong><small>${initial.includeTeacherName ? profile.teacherName : 'غير متاح في الملف الشخصي'}</small></span>
        </label>
        <label class="schedule-export-option">
          <input type="checkbox" name="includeSchoolName" ${initial.includeSchoolName ? 'checked' : 'disabled'}>
          <span><strong>اسم المدرسة</strong><small>${initial.includeSchoolName ? profile.schoolName : 'غير متاح في الملف الشخصي'}</small></span>
        </label>
        <label class="schedule-export-option">
          <input type="checkbox" name="includeTimes" checked>
          <span><strong>أوقات الحصص</strong><small>من ملف التوقيت الأساسي المتكرر</small></span>
        </label>
      </form>
      <div id="schedule-export-preview"></div>
      <div class="schedule-export-actions" aria-label="خيارات تصدير الجدول">
        <button class="btn btn--primary" type="button" id="schedule-export-png">${icon('download')} تنزيل PNG</button>
        <button class="btn btn--ghost" type="button" id="schedule-export-print">${icon('print')} طباعة / PDF</button>
        <button class="btn btn--ghost" type="button" id="schedule-export-share" hidden>${icon('share')} مشاركة</button>
      </div>
    `,
    foot: html`<button class="btn btn--quiet" data-sheet-close>إغلاق</button>`,
    onMount: (root) => {
      const form = root.querySelector('#schedule-export-form');
      const preview = root.querySelector('#schedule-export-preview');
      const pngButton = root.querySelector('#schedule-export-png');
      const printButton = root.querySelector('#schedule-export-print');
      const shareButton = root.querySelector('#schedule-export-share');
      const controls = [pngButton, printButton, shareButton].filter(Boolean);
      const model = () => {
        const data = new FormData(form);
        return buildScheduleExportModel(store, {
          includeTeacherName: data.has('includeTeacherName'),
          includeSchoolName: data.has('includeSchoolName'),
          includeTimes: data.has('includeTimes'),
        });
      };
      const refresh = () => {
        const current = model();
        const eligibility = scheduleExportEligibility(current);
        render(preview, html`
          ${eligibility === 'blank-template' ? html`<p class="t-3 fs-sm" role="status">الجدول بلا حصص مجدولة. يمكنك إخراج نموذج فارغ، أو إضافة الحصص ثم إعادة التصدير.</p>` : ''}
          ${eligibility === 'no-periods' ? html`<p class="t-3 fs-sm" role="alert">لا توجد أعمدة حصص للجدول. أضف فترات في ملف التوقيت الأساسي ثم أعد التصدير.</p>` : ''}
          ${scheduleExportPreview(current)}
        `);
      };
      const checkedModel = () => {
        const current = model();
        if (scheduleExportEligibility(current) === 'no-periods') {
          toast('لا توجد أعمدة حصص للجدول. أضف فترات في ملف التوقيت الأساسي ثم أعد التصدير.', 'danger');
          return null;
        }
        return current;
      };
      const busy = (active) => controls.forEach((button) => { button.disabled = active; });
      const probe = createSchedulePngFile(new Blob(['rakeezx'], { type: 'image/png' }));
      shareButton.hidden = !canShareScheduleFile(probe);

      form.addEventListener('change', refresh);
      pngButton.addEventListener('click', async () => {
        const current = checkedModel();
        if (!current) return;
        busy(true);
        try {
          const blob = await renderSchedulePng(current);
          downloadBlob('rakeezx-schedule.png', blob);
          toast('نُزّلت صورة الجدول');
        } catch (error) {
          toast(error?.message ?? 'تعذّر تصدير الجدول.', 'danger');
        } finally {
          busy(false);
        }
      });
      printButton.addEventListener('click', () => {
        const current = checkedModel();
        if (!current) return;
        try {
          openSchedulePrint(current);
        } catch (error) {
          toast(error?.message ?? 'تعذّرت طباعة الجدول.', 'danger');
        }
      });
      shareButton.addEventListener('click', async () => {
        const current = checkedModel();
        if (!current) return;
        busy(true);
        try {
          const blob = await renderSchedulePng(current);
          const result = await shareOrDownloadSchedule(blob);
          if (result.method === 'share') toast('فُتحت مشاركة الجدول');
          if (result.method === 'download') toast('المشاركة غير متاحة؛ نُزّلت صورة الجدول');
        } catch (error) {
          toast(error?.message ?? 'تعذّرت مشاركة الجدول.', 'danger');
        } finally {
          busy(false);
        }
      });
      refresh();
    },
  });
}

export function defaultMobileScheduleDay({ today, calendarKind = null } = {}) {
  const isScheduledSchoolDay = SCHOOL_WEEKDAYS.includes(Number(today));
  const isCalendarTeachingDay = !calendarKind || isTeachingDay(calendarKind);
  return isScheduledSchoolDay && isCalendarTeachingDay ? String(today) : "all";
}

/**
 * لوحة إضافة أو تعديل حصة — ثلاثة حقول فقط: اليوم ورقم الحصة والفصل.
 * الوقت يأتي من ملف التوقيت النشط ويُعرض للتأكيد، ولا يُدخَل يدويًا.
 */
function slotSheet(defaults = {}) {
  const isEdit = Boolean(defaults.teachingId && defaults.id);
  const list = store.teachings();
  const profile = store.activeTimeProfile();

  const timeHint = (wd, period, tchId) => {
    const tch = store.getTeaching(tchId);
    const sec = store.getSection(tch?.sectionId);
    const t = store.timeFor(Number(wd), Number(period), profile, sec?.grade);
    return t ? fmtTimeRange(t.start, t.end) : "لا وقت لهذه الحصة في الملف النشط";
  };

  return openSheet({
    title: isEdit ? "تعديل الحصة" : "حصة في الجدول",
    desc: profile ? `الأوقات من «${profile.name}»` : "لا ملف توقيت نشط",
    body: html`
      <form id="slot-form">
        <label class="field">
          <span class="field__label">الفصل</span>
          <select class="select" name="teachingId">
            ${list.map(
              (t) => html`<option value="${t.id}" ${defaults.teachingId === t.id ? "selected" : ""}>
                ${store.teachingLabel(t)}
              </option>`
            )}
          </select>
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">اليوم</span>
            <select class="select" name="weekday" id="slot-day">
              ${SCHOOL_WEEKDAYS.map(
                (d) => html`<option value="${d}" ${Number(defaults.weekday) === d ? "selected" : ""}>${WEEKDAYS[d]}</option>`
              )}
            </select>
          </label>
          <label class="field">
            <span class="field__label">رقم الحصة</span>
            <select class="select" name="period" id="slot-period">
              ${store.availablePeriods(null, profile).map(
                (p) => html`<option value="${p}" ${Number(defaults.period) === p ? "selected" : ""}>الحصة ${p}</option>`
              )}
            </select>
          </label>
        </div>
        <div class="timepreview" id="slot-time">
          ${icon("clock")} <span>وقت الحصة</span><span id="slot-time-text" aria-live="polite"></span>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="slot-form" type="submit">${isEdit ? "حفظ" : "أضف"}</button>
    `,
    onMount: (root, done) => {
      const form = root.querySelector("#slot-form");
      const day = root.querySelector("#slot-day");
      const period = root.querySelector("#slot-period");
      const text = root.querySelector("#slot-time-text");
      const submit = root.querySelector('[form="slot-form"][type="submit"]');

      const occupiedSlot = (weekday, period) => store.allSlots().find((slot) => (
        slot.id !== defaults.id
        && Number(slot.weekday) === Number(weekday)
        && Number(slot.period) === Number(period)
      ));

      const occupiedLabel = (slot) => {
        const teaching = store.getTeaching(slot?.teachingId);
        const section = store.getSection(teaching?.sectionId);
        return section ? shortClassLabel(section) : 'فصل آخر';
      };

      const sync = () => {
        const tchId = form.querySelector('[name="teachingId"]')?.value;
        const nums = store.availablePeriods(Number(day.value), profile);
        const wanted = Number(period.value);
        period.innerHTML = nums
          .map((p) => {
            const occupied = occupiedSlot(day.value, p);
            return `<option value="${p}"${p === wanted ? " selected" : ""}${occupied ? " disabled" : ""}>الحصة ${p}${occupied ? ` — مشغولة (${occupiedLabel(occupied)})` : ""}</option>`;
          })
          .join("");
        const available = nums.filter((p) => !occupiedSlot(day.value, p));
        if (!available.includes(wanted)) period.value = available.length ? String(available[0]) : "";
        period.disabled = !available.length;
        if (submit) submit.disabled = !available.length;
        render(text, timeHint(day.value, period.value, tchId));
      };
      day.addEventListener("change", sync);
      period.addEventListener("change", sync);
      form.querySelector('[name="teachingId"]')?.addEventListener("change", sync);
      sync();

      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const teachingId = String(fd.get("teachingId") ?? "");
        if (!teachingId) return;
        const weekday = Number(fd.get("weekday"));
        const selectedPeriod = Number(fd.get("period"));
        if (!Number.isInteger(selectedPeriod) || occupiedSlot(weekday, selectedPeriod)) {
          toast("لديك حصة مسجلة بالفعل في هذا الوقت.", "danger");
          return;
        }
        done({
          teachingId,
          weekday,
          period: selectedPeriod,
        });
      });
    },
  });
}

export default {
  title: () => "الجدول",
  subtitle: () => store.activeTerm()?.name ?? "",
  wide: true,

  afterPaint: equalizeVisibleScheduleSlots,
  onMount() {
    window.addEventListener('resize', equalizeVisibleScheduleSlots);
    document.fonts?.ready?.then(() => {
      if (document.querySelector('.page--schedule')) equalizeVisibleScheduleSlots();
    });
  },
  onUnmount() {
    window.removeEventListener('resize', equalizeVisibleScheduleSlots);
    cancelAnimationFrame(equalizeFrame);
  },

  render() {
    const list = store.teachings();
    if (!list.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon("timetable")}</div>
          <div class="empty__title">أنشئ فصلًا أولًا</div>
          <div class="empty__text">الجدول يوزّع فصولك على أيام الأسبوع وحصصه.</div>
          <a class="btn btn--primary" href="#/classes">${icon("plus")} الفصول</a>
        </div>
      `;
    }

    const slots = store.allSlots();
    const byDay = Object.fromEntries(SCHOOL_WEEKDAYS.map((d) => [d, []]));
    for (const s of slots) (byDay[s.weekday] ??= []).push(s);
    for (const d of SCHOOL_WEEKDAYS) {
      byDay[d].sort((a, b) => Number(a.period) - Number(b.period));
    }

    const todayStr = todayISO();
    const today = weekday(todayStr);
    const baseProfile = store.activeTimeProfile();
    const profile = store.resolveProfile(baseProfile, todayStr);
    const calDay = store.calendarDayFor(todayStr);
    const selectedMobileDay = activeMobileDay ?? defaultMobileScheduleDay({
      today,
      calendarKind: calDay?.kind,
    });
    const todayIsTeachingDay = selectedMobileDay === String(today)
      && SCHOOL_WEEKDAYS.includes(today)
      && (!calDay || isTeachingDay(calDay.kind));

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const toMins = (str) => {
      if (!str) return null;
      const [h, m] = str.split(":").map(Number);
      return h * 60 + m;
    };

    let calStatusText = "";
    let calStatusType = "info";
    if (calDay) {
      if (!isTeachingDay(calDay.kind)) {
        calStatusText = `اليوم: ${calDay.label || CALENDAR_KIND[calDay.kind]?.label || "إجازة"}`;
        calStatusType = "warn";
      } else if (calDay.kind === "remote") {
        calStatusText = `اليوم: دراسة عن بُعد (${calDay.label || "توقيت مدمج"})`;
        calStatusType = "brand";
      } else if (calDay.label) {
        calStatusText = `اليوم: ${calDay.label}`;
      }
    }

    // الأرقام المتاحة للحصص في ملف التوقيت النشط
    const periodsList = store.availablePeriods(null, profile);
    const maxPeriod = periodsList.length ? Math.max(...periodsList) : 7;
    const allPeriods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

    const weeklySessionsText = weeklySessionsLabel(slots.length);

    return html`
      <!-- ترويسة الجدول الأسبوعي: عنوان وزر تعديل أوقات الحصص فقط -->
      <div class="schedule-head">
        <div class="schedule-head__title-group">
          <div class="schedule-head__title">الجدول الأسبوعي</div>
          ${calStatusText ? html`<span class="badge badge--${calStatusType}">${calStatusText}</span>` : ""}
        </div>
        <div class="schedule-head__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-act="export">
            ${icon("download")} <span>تصدير الجدول</span>
          </button>
          <a class="btn btn--primary btn--sm schedule-head__times-btn" href="#/schedule/times">
            <span class="schedule-head__times-btn-icon" aria-hidden="true">${icon("sliders")}</span>
            <span>تعديل ملفات أوقات الحصص</span>
          </a>
        </div>
      </div>

      <!-- شريط الملخص وشريط التوقيت: محاذاة متوازنة ومتباعدة بشكل احترافي -->
      ${slots.length
        ? html`
            <div class="schedule-summary-bar surface surface--flat">
              <div class="schedule-summary-bar__stats">
                <span class="schedule-summary-bar__item">
                  ${icon("timetable")}
                  <span>إجمالي الحصص: <strong>${weeklySessionsText}</strong></span>
                </span>
                <span class="schedule-summary-bar__sep" aria-hidden="true">·</span>
                <span class="schedule-summary-bar__item schedule-summary-bar__classes">
                  ${icon("classes")}
                  <span>الفصول المجدولة: <strong>${list.length} فصول</strong></span>
                </span>
              </div>
              ${profile ? html`
                <a class="compact-timing-pill" href="#/schedule/times" title="أوقات الحصص — ${profile.name}">
                  <span class="compact-timing-pill__icon" aria-hidden="true">${icon(timingProfileIcon(profile.name))}</span>
                  <span>${profile.name}</span>
                </a>
              ` : ""}
            </div>
          `
        : html`
            <div class="card card--pad mb-3 center">
              <div class="fw-7">جدولك فارغ</div>
              <p class="t-3 fs-sm mt-3">
                أضف حصصك الأسبوعية — مثلًا حصتان لكل فصل في المادة التي تدرّسها —
                فتظهر حصص اليوم في الصفحة الرئيسية تلقائيًا.
              </p>
              <button class="btn btn--primary mt-3" data-act="add">${icon("plus")} أضف أول حصة</button>
            </div>
          `}

      <!-- جدول الأعمدة اليومية -->
      ${renderColumnsLayout({ byDay, today, todayStr, baseProfile, nowMins, toMins, selectedMobileDay, todayIsTeachingDay })}

      <!-- الحصص الأسبوعية لكل فصل: تصميم بطاقات مدمجة أنيقة بدل سطر ممتد -->
      <div class="section">
        <div class="section__head">
          <div class="section__title">الحصص الأسبوعية لكل فصل</div>
        </div>
        <div class="schedule-classes-grid">
          ${list.map((t) => {
            const sec = store.getSection(t.sectionId);
            const n = store.weeklyPeriods(t.id);
            const sub = store.getSubject(t.subjectId);
            return html`
              <a class="schedule-class-card" href="#/teaching/${t.id}/sessions" style="--sec-color: ${safeColor(sec?.color)}">
                <div class="schedule-class-card__head">
                  <span class="sec-dot" aria-hidden="true"></span>
                  <span class="schedule-class-card__title">${gradeLabel(sec?.grade)} — ${formatSectionDisplay(sec)}</span>
                </div>
                <div class="schedule-class-card__sub">${sub?.name || "مادة"}</div>
                <div class="schedule-class-card__foot">
                  <span class="schedule-class-card__count tabular">
                    <strong>${n || 0}</strong> حصص أسبوعيًا
                  </span>
                  <span class="schedule-class-card__arrow" aria-hidden="true">${icon("chev")}</span>
                </div>
              </a>
            `;
          })}
        </div>
      </div>

      <p class="t-3 fs-sm mt-6 center">
        يوزّع الجدول حصصك الأسبوعية تلقائيًا، وتُنشأ حصص الحضور والتقييم المؤرخة منها في سجل كل فصل.
      </p>
    `;
  },

  actions: {
    export() {
      openScheduleExportSheet();
    },

    "select-day"(el) {
      activeMobileDay = el.dataset.day || "all";
      repaint();
    },

    "schedule-day-keydown"(el, ev) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
      const tablist = el.closest('[role="tablist"]');
      const tabs = [...(tablist?.querySelectorAll('[role="tab"]') ?? [])];
      if (!tabs.length) return;
      ev.preventDefault();
      const current = tabs.indexOf(el);
      const nextIndex = ev.key === 'Home'
        ? 0
        : ev.key === 'End'
          ? tabs.length - 1
          : (current + (ev.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    },

    selectDay(el) {
      activeMobileDay = el.dataset.day || "all";
      repaint();
    },

    async add(el) {
      const data = await slotSheet({
        weekday: el?.dataset?.day,
        period: el?.dataset?.period
      });
      if (!data) return;
      try {
        const slot = await store.addSlot(data.teachingId, data.weekday, data.period);
        if (!slot) {
          toast("هذه الحصة موجودة في الجدول", "danger");
          return;
        }
        const tch = store.getTeaching(data.teachingId);
        const sec = store.getSection(tch?.sectionId);
        const t = store.timeFor(data.weekday, data.period, store.activeTimeProfile(), sec?.grade);
        toast(t ? `أُضيفت — ${formatTimeRange(t.start, t.end)}` : "أُضيفت للجدول");
      } catch (err) {
        toast(err.message, "danger");
      }
    },

    async edit(el) {
      const slot = store.getSlot(el.dataset.id);
      if (!slot) return;
      const data = await slotSheet({ 
        id: slot.id,
        weekday: slot.weekday, 
        period: slot.period,
        teachingId: slot.teachingId 
      });
      if (!data) return;
      try {
        await store.editSlot(slot.id, data);
        toast("تم تعديل الحصة بنجاح");
      } catch (err) {
        toast(err.message, "danger");
      }
    },

    async remove(el) {
      const ok = await confirmSheet({
        title: "حذف هذه الحصة من الجدول؟",
        desc: "الحصص المسجّلة سابقًا وحضورها لا تتأثر.",
        confirmLabel: "احذف",
        danger: true,
      });
      if (!ok) return;
      await store.removeSlot(el.dataset.id);
      toast("حُذفت من الجدول");
    },
  },
};

/**
 * الخيار 1: الأعمدة اليومية (Refined Day Columns)
 */
function renderColumnsLayout({ byDay, today, todayStr, baseProfile, nowMins, toMins, selectedMobileDay, todayIsTeachingDay }) {
  return html`
    <!-- تبويبات الأيام لشاشات الجوال -->
    <div class="schedule-day-tabs" role="tablist" aria-label="أيام الأسبوع">
      <button class="schedule-day-tab ${selectedMobileDay === "all" ? "is-active" : ""}"
              role="tab" aria-selected="${selectedMobileDay === "all"}" aria-controls="schedule-week"
              tabindex="${selectedMobileDay === "all" ? "0" : "-1"}" data-fk="schedule-day-all"
              data-act="select-day" data-keydown="schedule-day-keydown" data-day="all">الكل</button>
      ${SCHOOL_WEEKDAYS.map((d) => html`
        <button class="schedule-day-tab ${selectedMobileDay === String(d) ? "is-active" : ""}"
                role="tab" aria-selected="${selectedMobileDay === String(d)}" aria-controls="schedule-week"
                tabindex="${selectedMobileDay === String(d) ? "0" : "-1"}" data-fk="schedule-day-${d}"
                data-act="select-day" data-keydown="schedule-day-keydown" data-day="${d}">
          ${WEEKDAYS[d]}
          ${d === today ? html`<span class="tab-dot" title="اليوم"></span>` : ""}
          <span class="tabular fs-xs">(${byDay[d]?.length || 0})</span>
        </button>
      `)}
    </div>

    <div class="week ${selectedMobileDay !== "all" ? "has-day-filter" : ""}" id="schedule-week" role="tabpanel" aria-label="حصص الأسبوع">
      ${SCHOOL_WEEKDAYS.map((d) => html`
        <div class="week__day ${d === today ? "is-today" : ""} ${selectedMobileDay === String(d) ? "is-selected-day" : ""}">
          <div class="week__head">
            <div class="flex items-center gap-2">
              <span>${WEEKDAYS[d]}</span>
              ${d === today ? html`<span class="badge badge--brand fs-xs">اليوم</span>` : ""}
            </div>
            ${byDay[d]?.length ? html`<span class="badge tabular">${byDay[d].length}</span>` : ""}
          </div>
          ${byDay[d]?.length
            ? html`
                <div class="stack stack-2">
                  ${byDay[d].map((s) => {
                    const tch = store.getTeaching(s.teachingId);
                    const sec = store.getSection(tch?.sectionId);
                    const t = store.timeFor(d, s.period, baseProfile, sec?.grade, todayStr);

                    let isCurrentSlot = false;
                    if (d === today && t?.start && t?.end) {
                      const startM = toMins(t.start);
                      const endM = toMins(t.end);
                      if (startM !== null && endM !== null && nowMins >= startM && nowMins <= endM) {
                        isCurrentSlot = true;
                      }
                    }

                    return html`
                      <div class="slot ${isCurrentSlot ? "is-current-slot" : ""}">
                        <div class="slot__side-col" aria-hidden="true">
                          <span class="slot__period-num tabular">${s.period}</span>
                        </div>
                        <div class="slot__main-col">
                          <div class="slot__top-row">
                            <span class="slot__grade-sec" style="--sec-color: ${safeColor(sec?.color)}">
                              <span class="sec-dot" aria-hidden="true"></span>
                              <strong>${shortClassLabel(sec)}</strong>
                            </span>
                            <div class="slot__actions">
                              <button class="iconbtn iconbtn--xs" data-act="edit" data-id="${s.id}" aria-label="تعديل الحصة">
                                ${icon("edit")}
                              </button>
                              <button class="iconbtn iconbtn--xs" data-act="remove" data-id="${s.id}" aria-label="حذف الحصة">
                                ${icon("x")}
                              </button>
                            </div>
                          </div>
                          <div class="slot__subject-row">
                            <span class="slot__subject">${store.getSubject(tch?.subjectId)?.name || "مادة"}</span>
                          </div>
                          <div class="slot__time-row">
                            <span class="slot__time tabular">${t ? fmtTimeRange(t.start, t.end) : "—"}</span>
                            ${isCurrentSlot ? html`<span class="slot__live" aria-label="الحصة جارية الآن">جارية الآن</span>` : ""}
                          </div>
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
            : html`<div class="week__empty">${d === today && todayIsTeachingDay ? "لا توجد لديك حصص مجدولة اليوم." : "لا توجد حصص مجدولة"}</div>`}
          <!-- زر إضافة موحّد بصياغة صريحة: + أضف حصة -->
          <button class="btn btn--sm btn--quiet btn--block mt-3" data-act="add" data-day="${d}" aria-label="أضف حصة في الجدول">
            ${icon("plus")} أضف حصة
          </button>
        </div>
      `)}
    </div>
  `;
}
