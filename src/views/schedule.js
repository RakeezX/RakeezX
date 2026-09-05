/**
 * الجدول الدراسي — الأسبوع المتكرر.
 *
 * `slots` تمثّل الجدول المتكرر، و`sessions` تُولَّد منه × تواريخ الفصل الدراسي.
 * وعدد الحصص الأسبوعية يُشتق من عدد الفترات لا يُخزَّن رقمًا ثابتًا —
 * فحصتان أسبوعيًا للمهارات الرقمية سطران هنا، لا رقم في الشيفرة.
 */

import { html, render, icon, openSheet, toast, confirmSheet, fmtTimeRange, formatTimeRange, timingProfileIcon } from "../lib/dom.js";
import * as store from "../store.js";
import { WEEKDAYS, SCHOOL_WEEKDAYS, todayISO, weekday, sectionLabel, isTeachingDay, safeColor, gradeLabel } from "../models.js";
import { repaint } from "../repaint.js";

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

let activeMobileDay = "all";

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
        calStatusText = `اليوم: ${calDay.label || "إجازة"}`;
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

    return html`
      <!-- ترويسة الجدول الأسبوعي: عنوان وزر تعديل أوقات الحصص فقط -->
      <div class="schedule-head">
        <div class="schedule-head__title-group">
          <div class="schedule-head__title">الجدول الأسبوعي</div>
          ${calStatusText ? html`<span class="badge badge--${calStatusType}">${calStatusText}</span>` : ""}
        </div>
        <div class="schedule-head__actions">
          <a class="btn btn--primary btn--sm schedule-head__times-btn" href="#/schedule/times">
            <span class="schedule-head__times-btn-icon" aria-hidden="true">${icon("sliders")}</span>
            <span>تعديل أوقات الحصص</span>
          </a>
        </div>
      </div>

      <!-- شريط الملخص وشريط التوقيت: محاذاة متوازنة ومتباعدة بشكل احترافي -->
      ${slots.length
        ? html`
            <div class="schedule-summary-bar">
              <div class="schedule-summary-bar__stats">
                <span class="schedule-summary-bar__item">
                  ${icon("timetable")}
                  <span>إجمالي الحصص: <strong>${slots.length} حصة</strong> أسبوعيًا</span>
                </span>
                <span class="schedule-summary-bar__sep" aria-hidden="true">·</span>
                <span class="schedule-summary-bar__item">
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
                أضف حصصك الأسبوعية — مثلًا حصتان لكل فصل في مادة المهارات الرقمية —
                فتظهر حصص اليوم في الصفحة الرئيسية تلقائيًا.
              </p>
              <button class="btn btn--primary mt-3" data-act="add">${icon("plus")} أضف أول حصة</button>
            </div>
          `}

      <!-- جدول الأعمدة اليومية -->
      ${renderColumnsLayout({ byDay, today, todayStr, baseProfile, nowMins, toMins })}

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
                <div class="schedule-class-card__sub">${sub?.name || "المهارات الرقمية"}</div>
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
    "select-day"(el) {
      activeMobileDay = el.dataset.day || "all";
      repaint();
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
function renderColumnsLayout({ byDay, today, todayStr, baseProfile, nowMins, toMins }) {
  return html`
    <!-- تبويبات الأيام لشاشات الجوال -->
    <div class="schedule-day-tabs" role="tablist" aria-label="أيام الأسبوع">
      <button class="schedule-day-tab ${activeMobileDay === "all" ? "is-active" : ""}" data-act="select-day" data-day="all">الكل</button>
      ${SCHOOL_WEEKDAYS.map((d) => html`
        <button class="schedule-day-tab ${activeMobileDay === String(d) ? "is-active" : ""}" data-act="select-day" data-day="${d}">
          ${WEEKDAYS[d]}
          ${d === today ? html`<span class="tab-dot" title="اليوم"></span>` : ""}
          <span class="tabular fs-xs">(${byDay[d]?.length || 0})</span>
        </button>
      `)}
    </div>

    <div class="week ${activeMobileDay !== "all" ? "has-day-filter" : ""}">
      ${SCHOOL_WEEKDAYS.map((d) => html`
        <div class="week__day ${d === today ? "is-today" : ""} ${activeMobileDay === String(d) ? "is-selected-day" : ""}">
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
                            <span class="slot__subject">${store.getSubject(tch?.subjectId)?.name || "المهارات الرقمية"}</span>
                          </div>
                          <div class="slot__time-row">
                            <span class="slot__time tabular">${t ? fmtTimeRange(t.start, t.end) : "—"}</span>
                          </div>
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
            : html`<div class="week__empty">لا توجد حصص مجدولة</div>`}
          <!-- زر إضافة موحّد بصياغة صريحة: + أضف حصة -->
          <button class="btn btn--sm btn--quiet btn--block mt-3" data-act="add" data-day="${d}" aria-label="أضف حصة في الجدول">
            ${icon("plus")} أضف حصة
          </button>
        </div>
      `)}
    </div>
  `;
}
