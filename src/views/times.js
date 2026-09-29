/**
 * إعداد أوقات الحصص — ملفات توقيت.
 *
 * يضبطها المعلّم مرة واحدة، ثم يضيف الحصص برقمها فقط.
 */

import { html, render, icon, openSheet, confirmSheet, toast, fmtDateFull, fmtTimeRange, timingProfileIcon, normalizeTimeDigits } from '../lib/dom.js';
import * as store from '../store.js';
import { WEEKDAYS, SCHOOL_WEEKDAYS, generateAdvancedPeriods, isValidRecessPosition, makeTimeProfile, recessPositions, todayISO, GRADE_CATALOG, uid } from '../models.js';
import { repaint } from '../repaint.js';

/** توليد نص عربي منسق للصفوف لضمان عدم ظهور [object Object] */
function formatGradesLabel(grades) {
  if (!Array.isArray(grades) || grades.length === 0) return 'جميع الصفوف';
  const cleanGrades = grades.map(g => {
    if (typeof g === 'object' && g !== null) return Number(g.v ?? g.id ?? g.grade ?? 0);
    return Number(g);
  }).filter(v => v > 0);
  if (!cleanGrades.length) return 'جميع الصفوف';
  cleanGrades.sort((a, b) => a - b);

  if (cleanGrades.length === 6 && cleanGrades.every((v, i) => v === i + 1)) {
    return 'المرحلة الابتدائية';
  }
  if (cleanGrades.length === 3 && cleanGrades.every((v, i) => v === i + 7)) {
    return 'المرحلة المتوسطة';
  }
  if (cleanGrades.length === 3 && cleanGrades.every((v, i) => v === i + 10)) {
    return 'المرحلة الثانوية';
  }

  const names = cleanGrades.map(v => {
    const item = GRADE_CATALOG.find(c => c.v === v);
    return item ? item.label.replace(' الابتدائي', '').replace(' المتوسط', '').replace(' الثانوي', '') : `الصف ${v}`;
  });
  return `الصفوف ${names.join('، ')}`;
}

function extractFromProfilePeriods(p, grades) {
  const all = p.periods ?? [];
  const maxP = Math.max(0, ...all.map(x => x.period));
  const list = [];
  if (grades && grades.length > 0) {
    for (let i = 1; i <= maxP; i++) {
      const item = all.find(x => x.period === i && Array.isArray(x.grades) && x.grades.some(g => grades.includes(g)))
                || all.find(x => x.period === i && (!x.grades || !x.grades.length))
                || all.find(x => x.period === i);
      if (item) list.push({ period: item.period, start: item.start, end: item.end });
    }
  }
  return list.length ? list : (p.periods ?? []).map(x => ({ period: x.period, start: x.start, end: x.end }));
}

// A separation in the clock is not evidence of a recess. Only explicit
// model/day configuration gives that separation a named-break meaning.
function explicitRecess(model, periods = model.periods) {
  const afterPeriod = Number(model.afterPeriod);
  const duration = Number(model.recessDuration);
  if (!isValidRecessPosition(afterPeriod, periods?.length) || !(duration > 0)) return null;
  const index = periods.findIndex((period) => Number(period.period) === afterPeriod);
  if (index < 0 || !periods[index + 1]) return null;
  const minutes = (time) => String(time || '00:00').split(':').reduce((hours, value) => hours * 60 + Number(value), 0);
  if (minutes(periods[index + 1].start) <= minutes(periods[index].end)) return null;
  return { afterPeriod, duration, transition: Number(model.recessTransition || 0) };
}

function reflowPeriodsWithRecess(basePeriods, { afterPeriod = 0, recessDuration = 20, transition = 0,
  previousAfterPeriod, gap = 0 } = {}) {
  if (!basePeriods || !basePeriods.length) return [];

  const parseMins = (str) => {
    const [h, m] = (str || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const fmtMins = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const durations = basePeriods.map(p => Math.max(15, parseMins(p.end) - parseMins(p.start)));
  const firstStart = basePeriods[0]?.start || '07:00';
  let cursor = parseMins(firstStart);

  const count = basePeriods.length;
  const targetAfter = isValidRecessPosition(afterPeriod, count) ? Number(afterPeriod) : 0;
  const totalRecess = (targetAfter && Number(recessDuration) > 0)
    ? Number(recessDuration) + Number(transition || 0)
    : 0;

  const result = [];
  for (let i = 0; i < count; i++) {
    const pNum = basePeriods[i].period || (i + 1);
    const dur = durations[i] || 45;
    const startStr = fmtMins(cursor);
    cursor += dur;
    const endStr = fmtMins(cursor);

    result.push({
      period: pNum,
      start: startStr,
      end: endStr
    });

    if (targetAfter > 0 && pNum === targetAfter && totalRecess > 0) {
      cursor += totalRecess;
    } else if (i < count - 1) {
      // Preserve generic/manual separations when changing an explicit recess.
      // The old recess boundary returns to the configured generic gap.
      cursor += previousAfterPeriod === undefined || pNum === Number(previousAfterPeriod)
        ? Number(gap || 0)
        : Math.max(0, parseMins(basePeriods[i + 1].start) - parseMins(basePeriods[i].end));
    }
  }
  return result;
}

function getProfileModels(p) {
  if (Array.isArray(p.overrides?.models) && p.overrides.models.length > 0) {
    return p.overrides.models.map((m, idx) => {
      let name = typeof m.name === 'string' && m.name.trim()
        ? m.name.trim()
        : (m.name?.label || m.name?.name || `نموذج ${idx + 1}`);
      if (name === 'نموذج الصف الرابع') name = 'نموذج 1';
      else if (name === 'نموذج الصفين الخامس والسادس') name = 'نموذج 2';
      const grades = Array.isArray(m.grades) ? [...m.grades] : [];
      const gradesLabel = typeof m.gradesLabel === 'string' && m.gradesLabel.trim()
        ? m.gradesLabel.trim()
        : formatGradesLabel(grades);
      const recessDuration = Number(m.recessDuration || 20);
      const recessTransition = Number(m.recessTransition || 0);
      const periods = Array.isArray(m.periods) && m.periods.length > 0
        ? m.periods.map(x => ({ ...x }))
        : extractFromProfilePeriods(p, grades);
      return {
        ...m,
        id: String(m.id || `m-${idx}`),
        name: String(name),
        grades,
        gradesLabel: String(gradesLabel),
        afterPeriod: isValidRecessPosition(m.afterPeriod, periods.length) ? Number(m.afterPeriod) : 0,
        recessDuration,
        recessTransition,
        gap: Number(m.gap ?? p.overrides?.config?.gap ?? 0),
        periods
      };
    });
  }
  const recess = p.overrides?.config?.recess;
  const rules = recess?.enabled !== false ? recess?.rules : null;
  if (Array.isArray(rules) && rules.length > 1) {
    return [
      {
        id: 'm1',
        name: 'نموذج 1',
        grades: [4],
        gradesLabel: 'الرابع الابتدائي',
        afterPeriod: 2,
        recessDuration: 20,
        recessTransition: 5,
        gap: Number(p.overrides?.config?.gap || 0),
        periods: extractFromProfilePeriods(p, [4])
      },
      {
        id: 'm2',
        name: 'نموذج 2',
        grades: [5, 6],
        gradesLabel: 'الخامس والسادس الابتدائي',
        afterPeriod: 3,
        recessDuration: 20,
        recessTransition: 0,
        gap: Number(p.overrides?.config?.gap || 0),
        periods: extractFromProfilePeriods(p, [5, 6])
      }
    ];
  }
  return [
    {
      id: 'default',
      name: 'النموذج الأساسي',
      grades: [],
      gradesLabel: 'جميع الصفوف',
      gap: Number(p.overrides?.config?.gap || 0),
      afterPeriod: recess?.enabled !== false && isValidRecessPosition(recess?.afterPeriod, (p.periods ?? []).length)
        ? Number(p.overrides.config.recess.afterPeriod)
        : 0,
      recessDuration: Number(p.overrides?.config?.recess?.duration || 20),
      recessTransition: Number(p.overrides?.config?.recess?.transition || 0),
      periods: (p.periods ?? []).map(x => ({ ...x }))
    }
  ];
}

const ORDINAL_ARABIC = {
  1: 'الأولى',
  2: 'الثانية',
  3: 'الثالثة',
  4: 'الرابعة',
  5: 'الخامسة',
  6: 'السادسة',
  7: 'السابعة',
  8: 'الثامنة',
  9: 'التاسعة',
  10: 'العاشرة',
  11: 'الحادية عشرة',
  12: 'الثانية عشرة',
};

/**
 * لوحة التوليد السريع المبسّطة جذرياً
 * مدخلات مدرسية مباشرة — والفسحة اختيارية صريحة غير مفروضة
 */
function generateSheet(current = {}) {
  const initialCount = Number(current.count) || 7;
  const initialPositions = recessPositions(initialCount);
  let hasRecess = Boolean(current.recessDuration && current.recessDuration > 0 && initialPositions.length);
  const initialAfter = isValidRecessPosition(current.recessAfter, initialCount)
    ? Number(current.recessAfter)
    : initialPositions[Math.min(2, initialPositions.length - 1)];

  return openSheet({
    title: 'توليد أوقات الحصص تلقائيًا',
    desc: 'أدخل معايير التوقيت لمدرستك وسيقوم النظام بحساب الحصص وتطبيقها فورًا.',
    body: html`
      <form id="gen-form">
        <div class="field-row">
          <label class="field">
            <span class="field__label">بداية الطابور الصباحي (إن وجد)</span>
            <input class="input tabular timerow__in" name="assemblyStart" type="text" inputmode="numeric" maxlength="5" placeholder="06:45" value="${current.assemblyStart || '06:45'}" dir="ltr">
          </label>
          <label class="field">
            <span class="field__label">بداية الحصة الأولى *</span>
            <input class="input tabular timerow__in" name="firstPeriodStart" type="text" inputmode="numeric" maxlength="5" placeholder="07:00" value="${current.firstPeriodStart || '07:00'}" required dir="ltr">
          </label>
        </div>

        <div class="field-row mt-2">
          <label class="field">
            <span class="field__label">مدة الحصة (بالدقائق) *</span>
            <input class="input tabular input--center" name="periodDuration" type="text" inputmode="numeric" maxlength="3" value="${current.periodDuration || 45}" required dir="ltr">
          </label>
          <label class="field">
            <span class="field__label">عدد الحصص *</span>
            <input class="input tabular input--center" name="count" type="text" inputmode="numeric" maxlength="2" value="${(current.count && current.count <= 10) ? current.count : 7}" required dir="ltr">
          </label>
          <label class="field">
            <span class="field__label">الفاصل بين الحصص (دقائق)</span>
            <input class="input tabular input--center" name="gap" type="text" inputmode="numeric" maxlength="2" value="${current.gap ?? 0}" dir="ltr">
          </label>
        </div>

        <!-- قسم الفسحة المدرسية الاختيارية -->
        <div class="mt-3 p-2 bg-sunk rounded border">
          <div class="hstack justify-between items-center mb-1">
            <span class="fs-sm fw-6">الفسحة المدرسية (اختياري)</span>
            <button type="button" class="btn btn--xs ${hasRecess ? 'btn--ghost text-danger' : 'btn--quiet'}" id="gen-toggle-recess">
              ${hasRecess ? html`${icon('trash')} إزالة الفسحة` : html`${icon('plus')} إضافة فسحة`}
            </button>
          </div>
          <div id="gen-recess-fields" style="${hasRecess ? '' : 'display: none;'}">
            <div class="field-row mt-2">
              <label class="field">
                <span class="field__label">موضع الفسحة (بعد الحصة رقم)</span>
                <select class="select select--rtl" name="recessAfter" dir="rtl"></select>
              </label>
              <label class="field">
                <span class="field__label">مدة الفسحة (بالدقائق)</span>
                <input class="input tabular input--center" name="recessDuration" type="text" inputmode="numeric" maxlength="3" value="${current.recessDuration || 20}" dir="ltr">
              </label>
            </div>
            <div class="field-row mt-2">
              <label class="field">
                <span class="field__label">مدة التفويج بعد الفسحة (دقائق)</span>
                <input class="input tabular input--center" name="recessTransition" type="text" inputmode="numeric" maxlength="2" value="${current.recessTransition ?? 5}" dir="ltr">
              </label>
            </div>
          </div>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="gen-form" type="submit">توليد وتطبيق الأوقات</button>
    `,
    onMount: (root, done) => {
      const toggleBtn = root.querySelector('#gen-toggle-recess');
      const recessFields = root.querySelector('#gen-recess-fields');
      const countInput = root.querySelector('[name="count"]');
      const recessAfter = root.querySelector('[name="recessAfter"]');

      const syncRecessPositions = () => {
        const positions = recessPositions(Number(countInput?.value));
        const selected = Number(recessAfter?.value) || initialAfter;
        recessAfter.innerHTML = positions.map((position) => {
          const ordinal = ORDINAL_ARABIC[position] || position;
          return `<option value="${position}"${position === selected ? ' selected' : ''}>بعد الحصة ${ordinal}</option>`;
        }).join('');
        const available = positions.length > 0;
        toggleBtn.disabled = !available;
        if (!available && hasRecess) {
          hasRecess = false;
          recessFields.style.display = 'none';
          toggleBtn.className = 'btn btn--xs btn--quiet';
          toggleBtn.innerHTML = `${icon('plus')} إضافة فسحة`;
        }
      };
      
      toggleBtn?.addEventListener('click', () => {
        if (!recessPositions(Number(countInput?.value)).length) return;
        hasRecess = !hasRecess;
        if (hasRecess) {
          recessFields.style.display = '';
          toggleBtn.className = 'btn btn--xs btn--ghost text-danger';
          toggleBtn.innerHTML = `${icon('trash')} إزالة الفسحة`;
        } else {
          recessFields.style.display = 'none';
          toggleBtn.className = 'btn btn--xs btn--quiet';
          toggleBtn.innerHTML = `${icon('plus')} إضافة فسحة`;
        }
      });

      countInput?.addEventListener('input', syncRecessPositions);
      syncRecessPositions();

      // توحيد الأرقام 0-9 والتوقيت HH:MM على كافة المدخلات
      root.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', (ev) => {
          const val = ev.target.value;
          const norm = val.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
          if (val !== norm) ev.target.value = norm;
        });
        if (inp.name === 'assemblyStart' || inp.name === 'firstPeriodStart') {
          inp.addEventListener('blur', (ev) => {
            const norm = normalizeTimeDigits(ev.target.value);
            if (norm) ev.target.value = norm;
          });
        }
      });

      root.querySelector('#gen-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const assemblyStart = normalizeTimeDigits(String(fd.get('assemblyStart') || '')).trim();
        const firstPeriodStart = normalizeTimeDigits(String(fd.get('firstPeriodStart') || '07:00')).trim() || '07:00';
        const periodDuration = parseInt(String(fd.get('periodDuration') || '45').replace(/[^0-9]/g, ''), 10) || 45;
        const count = parseInt(String(fd.get('count') || '7').replace(/[^0-9]/g, ''), 10) || 7;
        const recessAfter = Number(fd.get('recessAfter'));
        const recessDuration = hasRecess ? (parseInt(String(fd.get('recessDuration') || '20').replace(/[^0-9]/g, ''), 10) || 20) : 0;
        const recessTransition = hasRecess ? (parseInt(String(fd.get('recessTransition') || '0').replace(/[^0-9]/g, ''), 10) || 0) : 0;
        const gap = parseInt(String(fd.get('gap') || '0').replace(/[^0-9]/g, ''), 10) || 0;

        if (hasRecess && !isValidRecessPosition(recessAfter, count)) {
          toast('اختر موضع فسحة بين حصتين موجودتين', 'danger');
          return;
        }

        const config = {
          firstPeriodStart,
          periodDuration,
          count,
          gap,
          assembly: {
            enabled: Boolean(assemblyStart),
            start: assemblyStart || '06:45',
            duration: 15
          },
          recess: {
            enabled: hasRecess && recessDuration > 0,
            afterPeriod: recessAfter,
            duration: recessDuration,
            transition: recessTransition
          }
        };
        done(config);
      });
    },
  });
}

/**
 * نافذة تعديل الاسم وفترة السريان
 */
function nameSheet(existing = null) {
  return openSheet({
    title: existing ? 'تعديل الاسم وفترة سريان التوقيت' : 'ملف توقيت جديد',
    desc: 'حدد اسم ملف التوقيت والتواريخ التي يسري خلالها تلقائيًا.',
    body: html`
      <form id="name-form">
        <label class="field mb-3">
          <span class="field__label">اسم ملف التوقيت *</span>
          <input class="input" name="name" value="${existing?.name ?? ''}" required maxlength="60"
                 autocomplete="off" placeholder="مثال: التوقيت الصيفي، توقيت رمضان، توقيت الاختبارات">
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">يسري من تاريخ (اختياري)</span>
            <div class="field-date-wrap">
              <input class="input tabular" name="activeFrom" type="date" value="${existing?.activeFrom ?? ''}" lang="en" dir="ltr">
              <button type="button" class="field-date-trigger" tabindex="-1" title="اختيار من التقويم" aria-label="اختيار من التقويم"
                      onclick="const inp = this.previousElementSibling; inp.showPicker ? inp.showPicker() : inp.focus();">
                ${icon('calendar')}
              </button>
            </div>
          </label>
          <label class="field">
            <span class="field__label">إلى تاريخ (اختياري)</span>
            <div class="field-date-wrap">
              <input class="input tabular" name="activeTo" type="date" value="${existing?.activeTo ?? ''}" lang="en" dir="ltr">
              <button type="button" class="field-date-trigger" tabindex="-1" title="اختيار من التقويم" aria-label="اختيار من التقويم"
                      onclick="const inp = this.previousElementSibling; inp.showPicker ? inp.showPicker() : inp.focus();">
                ${icon('calendar')}
              </button>
            </div>
          </label>
        </div>
        <p class="t-3 fs-xs mt-3">
          إذا حُددت التواريخ يتم تفعيل هذا التوقيت تلقائياً حسب تقويم الأيام الدراسية. إذا تُرِكت فارغة يظل التفعيل يدوياً.
        </p>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="name-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#name-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;

        // التحقق من عدم تكرار اسم ملف التوقيت
        const existingProfiles = store.timeProfiles();
        const isDuplicate = existingProfiles.some(prof => prof.id !== existing?.id && prof.name.trim().toLowerCase() === name.toLowerCase());
        if (isDuplicate) {
          toast('يوجد توقيت آخر بنفس هذا الاسم', 'danger');
          return;
        }

        const activeFrom = String(fd.get('activeFrom') ?? '') || null;
        const activeTo = String(fd.get('activeTo') ?? '') || null;

        if (activeTo && !activeFrom) {
          toast('يجب تحديد تاريخ البداية عند تحديد تاريخ النهاية', 'danger');
          return;
        }

        if (activeFrom) {
          const profiles = store.timeProfiles().filter(p => p.id !== existing?.id && p.activeFrom);
          for (const p of profiles) {
            const overlap = (
              (activeFrom === p.activeFrom) ||
              (p.activeTo && activeFrom >= p.activeFrom && activeFrom <= p.activeTo) ||
              (activeTo && p.activeFrom >= activeFrom && p.activeFrom <= activeTo)
            );
            if (overlap) {
              const rangeStr = p.activeTo ? `من ${fmtDateFull(p.activeFrom)} إلى ${fmtDateFull(p.activeTo)}` : `من ${fmtDateFull(p.activeFrom)} فصاعدًا`;
              toast(`هذه الفترة تتداخل مع «${p.name}» (${rangeStr})`, 'danger');
              return;
            }
          }
        }

        done({
          name,
          activeFrom,
          activeTo,
        });
      });
    },
  });
}

/**
 * نافذة ضبط الفسحة المدرسية — إضافة أو تعديل
 */
function openRecessConfigSheet({ isEdit = false, currentAfter = 3, currentDur = 20, currentTrans = 0, maxPeriods = 7, onSave }) {
  const positions = recessPositions(maxPeriods);
  if (!positions.length) {
    toast('يلزم وجود حصتين على الأقل لإضافة فسحة بينهما', 'danger');
    return;
  }
  const options = [];
  for (const i of positions) {
    const ord = ORDINAL_ARABIC[i] || i;
    options.push(html`<option value="${i}" ${i === currentAfter ? 'selected' : ''}>بعد الحصة ${ord}</option>`);
  }

  openSheet({
    title: isEdit ? 'تعديل الفسحة المدرسية' : 'إضافة فسحة مدرسية',
    desc: 'حدد موضع الفسحة ومدتها ليتم إعادة ضبط مواعيد الحصص تلقائيًا.',
    body: html`
      <form id="recess-config-form">
        <label class="field mb-3">
          <span class="field__label">موضع الفسحة *</span>
          <select class="select select--rtl" name="afterPeriod" dir="rtl" required>
            ${options}
          </select>
        </label>

        <div class="field-row mb-3">
          <label class="field">
            <span class="field__label">مدة الفسحة (بالدقائق) *</span>
            <input class="input tabular input--center" name="duration" type="text" inputmode="numeric" maxlength="3" value="${currentDur || 20}" required dir="ltr">
          </label>
          <label class="field">
            <span class="field__label">مدة التفويج بعد الفسحة (بالدقائق)</span>
            <input class="input tabular input--center" name="transition" type="text" inputmode="numeric" maxlength="3" value="${currentTrans || 0}" dir="ltr" placeholder="0">
          </label>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="recess-config-form" type="submit">
        ${isEdit ? 'حفظ تعديل الفسحة' : 'إضافة الفسحة'}
      </button>
    `,
    onMount: (rRoot, rDone) => {
      rRoot.querySelector('#recess-config-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const afterPeriod = Number(fd.get('afterPeriod'));
        const duration = parseInt(String(fd.get('duration') || '20').replace(/[^0-9]/g, ''), 10) || 20;
        const transition = parseInt(String(fd.get('transition') || '0').replace(/[^0-9]/g, ''), 10) || 0;

        if (!isValidRecessPosition(afterPeriod, maxPeriods)) {
          toast('اختر موضع فسحة بين حصتين موجودتين', 'danger');
          return;
        }

        onSave({ afterPeriod, duration, transition });
        rDone();
      });
    }
  });
}

/**
 * نافذة تعديل النموذج الحالي — اسم النموذج، الصفوف، وإعداد الفسحة
 */
function openEditModelSheet(model, { models, onSave, onDelete }) {
  const primaryGrades = GRADE_CATALOG.filter(g => g.stage === 'ابتدائي');
  const middleGrades = GRADE_CATALOG.filter(g => g.stage === 'متوسط');
  const secondaryGrades = GRADE_CATALOG.filter(g => g.stage === 'ثانوي');

  const pList = model.periods || [];
  const recess = explicitRecess(model, pList);
  const curRecessAfter = recess?.afterPeriod || 0;
  const curRecessDur = recess?.duration || 20;

  const positions = recessPositions(pList.length);
  const options = [];
  for (const i of positions) {
    const ord = ORDINAL_ARABIC[i] || i;
    options.push(html`<option value="${i}" ${i === curRecessAfter ? 'selected' : ''}>بعد الحصة ${ord}</option>`);
  }

  openSheet({
    title: `تعديل النموذج — ${model.name}`,
    desc: 'تعديل اسم النموذج والصفوف المشمولة وموضع الفسحة.',
    body: html`
      <form id="edit-model-form">
        <label class="field mb-3">
          <span class="field__label">اسم النموذج *</span>
          <input class="input" name="modelName" id="edit-model-name-input" value="${model.name}" required>
        </label>

        <div class="field mb-3">
          <span class="field__label mb-2">الصفوف المشمولة بهذا النموذج:</span>

          <div class="grades-stage-group">
            <div class="grades-stage-title">المرحلة الابتدائية</div>
            <div class="grades-chips-grid">
              ${primaryGrades.map(g => html`
                <label class="grade-chip-label">
                  <input type="checkbox" name="grades" value="${g.v}" ${model.grades?.includes(g.v) ? 'checked' : ''}>
                  <span>${g.label.replace(' الابتدائي', '')}</span>
                </label>
              `)}
            </div>
          </div>

          <div class="grades-stage-group">
            <div class="grades-stage-title">المرحلة المتوسطة</div>
            <div class="grades-chips-grid">
              ${middleGrades.map(g => html`
                <label class="grade-chip-label">
                  <input type="checkbox" name="grades" value="${g.v}" ${model.grades?.includes(g.v) ? 'checked' : ''}>
                  <span>${g.label.replace(' المتوسط', '')}</span>
                </label>
              `)}
            </div>
          </div>

          <div class="grades-stage-group">
            <div class="grades-stage-title">المرحلة الثانوية</div>
            <div class="grades-chips-grid">
              ${secondaryGrades.map(g => html`
                <label class="grade-chip-label">
                  <input type="checkbox" name="grades" value="${g.v}" ${model.grades?.includes(g.v) ? 'checked' : ''}>
                  <span>${g.label.replace(' الثانوي', '')}</span>
                </label>
              `)}
            </div>
          </div>
        </div>

        <!-- إعداد الفسحة لهذا النموذج -->
        <div class="p-3 bg-sunk rounded border mb-3">
          <div class="hstack justify-between items-center mb-2">
            <span class="fs-sm fw-7">الفسحة المدرسية</span>
            ${curRecessAfter > 0 ? html`
              <span class="badge badge--brand">بعد الحصة ${curRecessAfter} (${curRecessDur} دقيقة)</span>
            ` : html`
              <span class="badge badge--quiet">بدون فسحة</span>
            `}
          </div>

          ${curRecessAfter > 0 ? html`
            <div class="field-row">
              <label class="field">
                <span class="field__label">موضع الفسحة</span>
                <select class="select select--rtl" name="recessAfter" dir="rtl">
                  ${options}
                </select>
              </label>
              <label class="field">
                <span class="field__label">مدة الفسحة (دقائق)</span>
                <input class="input tabular input--center" name="recessDuration" type="text" inputmode="numeric" maxlength="3" value="${curRecessDur}" dir="ltr">
              </label>
            </div>
            <label class="fs-xs pointer hstack gap-1 text-danger mt-2">
              <input type="checkbox" name="deleteRecess" value="1">
              <span>إزالة الفسحة من هذا النموذج (بدون فسحة)</span>
            </label>
          ` : positions.length ? html`
            <label class="fs-xs pointer hstack gap-1">
              <input type="checkbox" name="addRecess" value="1" id="edit-model-add-recess-chk">
              <span>إضافة فسحة مدرسية لهذا النموذج</span>
            </label>
            <div id="edit-model-new-recess-box" style="display: none;" class="field-row mt-2">
              <label class="field">
                <span class="field__label">موضع الفسحة</span>
                <select class="select select--rtl" name="newRecessAfter" dir="rtl">
                  ${options}
                </select>
              </label>
              <label class="field">
                <span class="field__label">مدة الفسحة (دقائق)</span>
                <input class="input tabular input--center" name="newRecessDuration" type="text" inputmode="numeric" maxlength="3" value="20" dir="ltr">
              </label>
            </div>
          ` : html`<p class="fs-sm t-3 mb-0">يلزم وجود حصتين على الأقل لإضافة فسحة.</p>`}
        </div>

        ${models.length > 1 ? html`
          <div class="border-t pt-3 mt-3 text-start">
            <button type="button" class="btn btn--sm btn--danger" id="btn-del-model-action">
              ${icon('trash')} حذف النموذج
            </button>
          </div>
        ` : ''}
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="edit-model-form" type="submit">حفظ تعديل النموذج</button>
    `,
    onMount: (eRoot, eDone) => {
      const toggleChk = eRoot.querySelector('#edit-model-add-recess-chk');
      const newRecessBox = eRoot.querySelector('#edit-model-new-recess-box');
      if (toggleChk && newRecessBox) {
        toggleChk.addEventListener('change', () => {
          newRecessBox.style.display = toggleChk.checked ? 'flex' : 'none';
        });
      }

      const btnDel = eRoot.querySelector('#btn-del-model-action');
      if (btnDel) {
        btnDel.addEventListener('click', async () => {
          const ok = await confirmSheet({
            title: 'حذف النموذج؟',
            desc: `هل أنت متأكد من حذف «${model.name}»؟`,
            confirmLabel: 'حذف النموذج',
            danger: true,
          });
          if (ok) {
            onDelete();
            eDone();
          }
        });
      }

      eRoot.querySelector('#edit-model-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('modelName') || '').trim() || model.name;
        const checkedGrades = Array.from(eRoot.querySelectorAll('input[name="grades"]:checked')).map(el => Number(el.value));
        const gradesLabel = formatGradesLabel(checkedGrades);

        let recessChange = null;
        if (curRecessAfter > 0) {
          if (fd.get('deleteRecess')) {
            recessChange = { afterPeriod: 0, duration: 0 };
          } else {
            const after = Number(fd.get('recessAfter'));
            const dur = parseInt(String(fd.get('recessDuration') || curRecessDur).replace(/[^0-9]/g, ''), 10) || curRecessDur;
            if (!isValidRecessPosition(after, pList.length)) {
              toast('اختر موضع فسحة بين حصتين موجودتين', 'danger');
              return;
            }
            recessChange = { afterPeriod: after, duration: dur };
          }
        } else if (fd.get('addRecess')) {
          const after = Number(fd.get('newRecessAfter'));
          const dur = parseInt(String(fd.get('newRecessDuration') || '20').replace(/[^0-9]/g, ''), 10) || 20;
          if (!isValidRecessPosition(after, pList.length)) {
            toast('اختر موضع فسحة بين حصتين موجودتين', 'danger');
            return;
          }
          recessChange = { afterPeriod: after, duration: dur };
        }

        onSave({ name, checkedGrades, gradesLabel, recessChange });
        eDone();
      });
    }
  });
}

/**
 * نافذة عرض وتعديل أوقات الحصص — Modal / Sheet
 */
function editPeriodsSheet(profile) {
  // The editor is intentionally a private draft.  `store.getTimeProfile()`
  // returns the live in-memory record, so retaining it here let nested sheet
  // edits mutate one profile's UI state before Save.  A repaint/active-profile
  // switch could then compose that transient state with another profile card.
  // Save is still the sole point that writes this draft back to the store.
  const sourceProfile = store.getTimeProfile(profile.id) || profile;
  let p = structuredClone(sourceProfile);
  let selectedDay = null; // null = all days
  let models = getProfileModels(p);
  let selectedModelId = models[0]?.id || 'default';
  let dayOverrides = { ...(p.overrides ?? {}) };

  const parseTime = (str) => {
    const [h, m] = (str || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const fmtTime = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getActiveModel = () => {
    return models.find(m => m.id === selectedModelId) || models[0];
  };

  const renderSheetContent = () => {
    const currentModel = getActiveModel();
    selectedModelId = currentModel.id;

    const activePeriods = (selectedDay !== null && Array.isArray(dayOverrides[String(selectedDay)]))
      ? dayOverrides[String(selectedDay)]
      : currentModel.periods;

    const cfg = p.overrides?.config;
    const activeRecessModel = selectedDay !== null && dayOverrides.recessByDay?.[String(selectedDay)]
      ? dayOverrides.recessByDay[String(selectedDay)] : currentModel;
    const recess = explicitRecess(activeRecessModel, activePeriods);

    return html`
      <div id="periods-sheet-inner">
        <!-- شريط النماذج المدمج والموحّد مع أزرار الإجراءات المستقلة الثابتة في اليسار -->
        <div class="models-bar mb-3">
          <div class="models-tabs">
            ${models.map((m) => html`
              <button type="button" class="models-tab ${selectedModelId === m.id ? 'is-active' : ''}" data-mid="${m.id}">
                <span>${m.name}</span>
              </button>
            `)}
          </div>
          <div class="models-bar__actions">
            <button type="button" class="models-bar__action-btn" id="sheet-btn-edit-model" title="تعديل النموذج" aria-label="تعديل النموذج">
              ${icon('edit')}
            </button>
            <button type="button" class="models-bar__action-btn" id="sheet-btn-add-model" title="إضافة نموذج" aria-label="إضافة نموذج">
              ${icon('plus')}
            </button>
          </div>
        </div>

        <!-- إجراء التوليد التلقائي في الأعلى بوضوح كزر عملي بارز -->
        <div class="generator-action-banner mb-3">
          <div class="generator-action-banner__info">
            <span class="generator-action-banner__title">توليد الأوقات آليًا</span>
            <span class="generator-action-banner__desc">توزيع الحصص والفسحة المدرسية بدقة حسب معايير مدرستك</span>
          </div>
          <button type="button" class="btn btn--sm btn--primary generator-action-banner__btn" id="sheet-btn-gen">
            ${icon('spark')} توليد وتطبيق الأوقات
          </button>
        </div>

        <!-- شريط استثناءات الأيام -->
        <div class="field mb-3">
          <div class="chips scroll-x">
            <button type="button" class="chip ${selectedDay === null ? 'is-on' : ''}" data-day="">
              كل الأيام (الافتراضي)
            </button>
            ${SCHOOL_WEEKDAYS.map(d => html`
              <button type="button" class="chip ${selectedDay === d ? 'is-on' : ''}" data-day="${d}">
                ${WEEKDAYS[d]}
              </button>
            `)}
          </div>
        </div>

        <!-- الطابور الصباحي إن وجد -->
        ${cfg?.assembly?.enabled ? html`
          <div class="timerow timerow--assembly mb-3">
            <div class="assembly-pill">
              ${icon('bell')}
              <span>الطابور الصباحي</span>
            </div>
            <div class="timerow__assembly-time tabular">
              <span dir="ltr">${cfg.assembly.start}</span>
              <span class="t-3 fs-xs">(${cfg.assembly.duration} دقيقة)</span>
            </div>
          </div>
        ` : ''}

        <!-- قائمة فترات الحصص والفسحة المدرسية -->
        <div class="stack stack-2" id="sheet-period-rows">
          ${activePeriods.length ? activePeriods.map((t, idx) => {
            const items = [];
            if (idx > 0) {
              const prev = activePeriods[idx - 1];
              const gapMins = parseTime(t.start) - parseTime(prev.end);
              if (gapMins > 0 && recess?.afterPeriod === Number(prev.period)) {
                items.push(html`
                  <div class="timerow timerow--recess row-recess">
                    <div class="recess-pill">
                      <span class="recess-dot" aria-hidden="true"></span>
              <span>الفسحة</span>
                    </div>
                    <div class="recess-info tabular">
                <span class="recess-duration">${recess.duration} دقيقة</span>
                      <span class="recess-sep" aria-hidden="true">·</span>
                      <span class="time-range"><span class="time-range__token" dir="ltr">${prev.end}</span> – <span class="time-range__token" dir="ltr">${t.start}</span></span>
                    </div>
                    <div class="recess-actions">
                      <button type="button" class="recess-edit-btn" data-act="edit-recess" data-after="${prev.period}" data-gap="${gapMins}" title="تعديل الفسحة" aria-label="تعديل الفسحة">
                        ${icon('edit')}
                      </button>
                      <button type="button" class="recess-del-btn" data-act="del-recess" title="إزالة الفسحة" aria-label="إزالة الفسحة">
                        ${icon('trash')}
                      </button>
                    </div>
                  </div>
                `);
              }
            }
            items.push(html`
              <div class="timerow" data-row-period="${t.period}">
                <span class="period tabular" title="الحصة ${t.period}">${t.period}</span>
                <div class="timerow__range">
                  <div class="timerow__input-group">
                    <span class="timerow__label">البداية</span>
                    <input class="input tabular timerow__in" type="text" inputmode="numeric" maxlength="5"
                           dir="ltr" placeholder="00:00"
                           value="${t.start}" data-p="${t.period}" data-key="start"
                           aria-label="بداية الحصة ${t.period}">
                  </div>
                  <span class="timerow__arrow" aria-hidden="true">←</span>
                  <div class="timerow__input-group">
                    <span class="timerow__label">النهاية</span>
                    <input class="input tabular timerow__in" type="text" inputmode="numeric" maxlength="5"
                           dir="ltr" placeholder="00:00"
                           value="${t.end}" data-p="${t.period}" data-key="end"
                           aria-label="نهاية الحصة ${t.period}">
                  </div>
                </div>
                <button type="button" class="iconbtn text-danger" data-del-p="${t.period}" aria-label="حذف الحصة ${t.period}" title="حذف">
                  ${icon('trash')}
                </button>
              </div>
            `);
            return items;
          }) : html`
            <div class="card--pad center t-3 fs-md">
              <p class="mb-3">لا توجد أوقات محددة بعد.</p>
            </div>
          `}
        </div>

        ${(() => {
          const hasRecess = Boolean(recess);
          return html`
            <div class="hstack justify-between gap-2 mt-3 pt-2 border-t">
              <button type="button" class="btn btn--sm btn--ghost" id="sheet-btn-add-p">
                ${icon('plus')} إضافة حصة
              </button>
              ${hasRecess ? html`
                <span class="fs-xs text-3">تم ضبط الفسحة لهذا النموذج</span>
              ` : html`
                <button type="button" class="btn btn--sm btn--ghost" id="sheet-btn-add-recess">
                  ${icon('plus')} إضافة فسحة
                </button>
              `}
            </div>
          `;
        })()}
      </div>
    `;
  };

  return openSheet({
    title: `أوقات الحصص — ${p.name}`,
    desc: 'عرض وتعديل فترات الحصص والفسحة المدرسية لهذا الملف.',
    body: renderSheetContent(),
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" id="sheet-btn-save-all">حفظ التغييرات</button>
    `,
    onMount: (root, done) => {
      const attachListeners = () => {
        const currentModel = getActiveModel();
        const activePeriods = (selectedDay !== null && Array.isArray(dayOverrides[String(selectedDay)]))
          ? dayOverrides[String(selectedDay)]
          : currentModel.periods;
        const activeRecessModel = selectedDay !== null && dayOverrides.recessByDay?.[String(selectedDay)]
          ? dayOverrides.recessByDay[String(selectedDay)] : currentModel;
        const reflowOptions = {
          previousAfterPeriod: explicitRecess(activeRecessModel, activePeriods)?.afterPeriod || 0,
          gap: Number(activeRecessModel.gap ?? currentModel.gap ?? 0),
        };
        const setDayRecess = (afterPeriod, duration = 0, transition = 0, gap = reflowOptions.gap) => {
          dayOverrides.recessByDay = { ...(dayOverrides.recessByDay || {}),
            [String(selectedDay)]: { afterPeriod, recessDuration: duration, recessTransition: transition, gap } };
        };

        // Model tabs click
        root.querySelectorAll('.models-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            const mid = tab.dataset.mid;
            if (mid && mid !== selectedModelId) {
              selectedModelId = mid;
              refreshDOM();
            }
          });
        });

        // Edit model action
        const btnEditModel = root.querySelector('#sheet-btn-edit-model');
        if (btnEditModel) {
          btnEditModel.addEventListener('click', () => {
            openEditModelSheet(currentModel, {
              models,
              onSave: ({ name, checkedGrades, gradesLabel, recessChange }) => {
                currentModel.name = name;
                currentModel.grades = checkedGrades;
                currentModel.gradesLabel = gradesLabel;

                if (recessChange) {
                  currentModel.periods = reflowPeriodsWithRecess(currentModel.periods, {
                    previousAfterPeriod: explicitRecess(currentModel)?.afterPeriod || 0,
                    gap: currentModel.gap,
                    afterPeriod: recessChange.afterPeriod,
                    recessDuration: recessChange.duration,
                    transition: 0
                  });
                  currentModel.afterPeriod = recessChange.afterPeriod;
                  currentModel.recessDuration = recessChange.duration;
                }
                selectedModelId = currentModel.id;
                refreshDOM();
                toast(`تم تحديث «${currentModel.name}» بنجاح`);
              },
              onDelete: () => {
                models = models.filter(m => m.id !== currentModel.id);
                selectedModelId = models[0].id;
                refreshDOM();
                toast('تم حذف النموذج بنجاح');
              }
            });
          });
        }

        // Add model with canonical Grade Catalog multi-select and explicit recess configuration
        const btnAddModel = root.querySelector('#sheet-btn-add-model');
        if (btnAddModel) {
          btnAddModel.addEventListener('click', () => {
            const nextModelNum = models.length + 1;
            const defaultModelName = `نموذج ${nextModelNum}`;
            const primaryGrades = GRADE_CATALOG.filter(g => g.stage === 'ابتدائي');
            const middleGrades = GRADE_CATALOG.filter(g => g.stage === 'متوسط');
            const secondaryGrades = GRADE_CATALOG.filter(g => g.stage === 'ثانوي');

            const positions = recessPositions(currentModel.periods.length);
            const options = [];
            for (const i of positions) {
              const ord = ORDINAL_ARABIC[i] || i;
              options.push(html`<option value="${i}">بعد الحصة ${ord}</option>`);
            }

            openSheet({
              title: 'إضافة نموذج أوقات لصفوف محددة',
              desc: 'يتيح لك تخصيص مواعيد وفسحة مستقلة لصفوف معينة بالمدرسة.',
              body: html`
                <form id="add-model-form">
                  <label class="field mb-3">
                    <span class="field__label">اسم النموذج</span>
                    <input class="input" name="modelName" id="add-model-name-input" value="${defaultModelName}" placeholder="${defaultModelName}">
                  </label>

                  <div class="field mb-3">
                    <span class="field__label mb-2">اختر الصفوف المشمولة بهذا النموذج:</span>

                    <div class="grades-stage-group">
                      <div class="grades-stage-title">المرحلة الابتدائية</div>
                      <div class="grades-chips-grid">
                        ${primaryGrades.map(g => html`
                          <label class="grade-chip-label">
                            <input type="checkbox" name="grades" value="${g.v}">
                            <span>${g.label.replace(' الابتدائي', '')}</span>
                          </label>
                        `)}
                      </div>
                    </div>

                    <div class="grades-stage-group">
                      <div class="grades-stage-title">المرحلة المتوسطة</div>
                      <div class="grades-chips-grid">
                        ${middleGrades.map(g => html`
                          <label class="grade-chip-label">
                            <input type="checkbox" name="grades" value="${g.v}">
                            <span>${g.label.replace(' المتوسط', '')}</span>
                          </label>
                        `)}
                      </div>
                    </div>

                    <div class="grades-stage-group">
                      <div class="grades-stage-title">المرحلة الثانوية</div>
                      <div class="grades-chips-grid">
                        ${secondaryGrades.map(g => html`
                          <label class="grade-chip-label">
                            <input type="checkbox" name="grades" value="${g.v}">
                            <span>${g.label.replace(' الثانوي', '')}</span>
                          </label>
                        `)}
                      </div>
                    </div>
                  </div>

                  <div class="field-row">
                    <label class="field">
                      <span class="field__label">موضع الفسحة لهذا النموذج</span>
                      <select class="select select--rtl" name="afterPeriod" dir="rtl">
                        <option value="">بدون فسحة</option>
                        ${options}
                      </select>
                    </label>
                    <label class="field">
                      <span class="field__label">مدة الفسحة (دقائق)</span>
                      <input class="input tabular input--center" name="recessDuration" type="text" inputmode="numeric" maxlength="3" value="20" dir="ltr">
                    </label>
                  </div>
                </form>
              `,
              foot: html`
                <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
                <button class="btn btn--primary" form="add-model-form" type="submit">إضافة النموذج</button>
              `,
              onMount: (mRoot, mDone) => {
                mRoot.querySelector('#add-model-form').addEventListener('submit', (ev) => {
                  ev.preventDefault();
                  const fd = new FormData(ev.target);
                  const checkedGrades = Array.from(mRoot.querySelectorAll('input[name="grades"]:checked')).map(el => Number(el.value));
                  const gradesLabel = formatGradesLabel(checkedGrades);
                  const name = String(fd.get('modelName') || '').trim() || defaultModelName;
                  const selectedAfter = String(fd.get('afterPeriod') || '');
                  const afterPeriod = selectedAfter === '' ? 0 : Number(selectedAfter);
                  const recessDuration = parseInt(String(fd.get('recessDuration') || '20').replace(/[^0-9]/g, ''), 10) || 20;

                  if (afterPeriod && !isValidRecessPosition(afterPeriod, currentModel.periods.length)) {
                    toast('اختر موضع فسحة بين حصتين موجودتين', 'danger');
                    return;
                  }

                  const newPeriods = reflowPeriodsWithRecess(currentModel.periods, {
                    previousAfterPeriod: explicitRecess(currentModel)?.afterPeriod || 0,
                    gap: currentModel.gap,
                    afterPeriod,
                    recessDuration: afterPeriod > 0 ? recessDuration : 0,
                    transition: 0
                  });

                  const newModel = {
                    id: `m-${Date.now()}`,
                    name,
                    grades: checkedGrades,
                    gradesLabel,
                    afterPeriod,
                    recessDuration: afterPeriod > 0 ? recessDuration : 0,
                    recessTransition: 0,
                    gap: currentModel.gap,
                    periods: newPeriods
                  };

                  models.push(newModel);
                  selectedModelId = newModel.id;
                  mDone();
                  refreshDOM();
                  toast(`أُضيف «${name}» بنجاح`);
                });
              }
            });
          });
        }

        // Days chips
        root.querySelectorAll('.chips .chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const dStr = chip.dataset.day;
            selectedDay = dStr === '' ? null : Number(dStr);
            if (selectedDay !== null && !dayOverrides[String(selectedDay)]) {
              dayOverrides[String(selectedDay)] = currentModel.periods.map(x => ({ ...x }));
            }
            refreshDOM();
          });
        });

        // Time inputs — ضمان تحويل الأرقام 0-9 مع التحقق
        root.querySelectorAll('.timerow__in').forEach(input => {
          input.addEventListener('input', (ev) => {
            const cur = ev.target.value;
            const norm = cur.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            if (cur !== norm) ev.target.value = norm;
          });

          input.addEventListener('change', () => {
            const norm = normalizeTimeDigits(input.value);
            if (norm) input.value = norm;
            const pNum = Number(input.dataset.p);
            const key = input.dataset.key;
            const item = activePeriods.find(x => x.period === pNum);
            if (item) {
              item[key] = input.value;
            }
          });

          input.addEventListener('blur', () => {
            const norm = normalizeTimeDigits(input.value);
            if (norm) {
              input.value = norm;
              const pNum = Number(input.dataset.p);
              const key = input.dataset.key;
              const item = activePeriods.find(x => x.period === pNum);
              if (item) item[key] = norm;
            }
          });
        });

        // Delete period
        root.querySelectorAll('button[data-del-p]').forEach(btn => {
          btn.addEventListener('click', () => {
            const pNum = Number(btn.dataset.delP);
            const updated = activePeriods.filter(x => x.period !== pNum);
            if (selectedDay !== null) {
              dayOverrides[String(selectedDay)] = updated;
            } else {
              currentModel.periods = updated;
            }
            refreshDOM();
          });
        });

        // Delete recess action
        root.querySelectorAll('button[data-act="del-recess"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const updated = reflowPeriodsWithRecess(activePeriods, { ...reflowOptions, afterPeriod: 0 });
            if (selectedDay !== null) {
              dayOverrides[String(selectedDay)] = updated;
              setDayRecess(0);
            } else {
              currentModel.periods = updated;
              currentModel.afterPeriod = 0;
            }
            refreshDOM();
            toast('تمت إزالة الفسحة المدرسية وتعديل أوقات الحصص');
          });
        });

        // Edit recess action
        root.querySelectorAll('button[data-act="edit-recess"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const afterPeriod = Number(btn.dataset.after);
            if (!isValidRecessPosition(afterPeriod, activePeriods.length)) {
              toast('موضع الفسحة الحالي غير صالح؛ أضف فسحة جديدة بين حصتين', 'danger');
              return;
            }
            const gapMins = Number(btn.dataset.gap) || 20;
            openRecessConfigSheet({
              isEdit: true,
              currentAfter: afterPeriod,
              currentDur: Number(activeRecessModel.recessDuration || gapMins),
              currentTrans: activeRecessModel.recessTransition || 0,
              maxPeriods: activePeriods.length,
              onSave: ({ afterPeriod: newAfter, duration, transition }) => {
                const updated = reflowPeriodsWithRecess(activePeriods, {
                  ...reflowOptions,
                  afterPeriod: newAfter,
                  recessDuration: duration,
                  transition
                });
                if (selectedDay !== null) {
                  dayOverrides[String(selectedDay)] = updated;
                  setDayRecess(newAfter, duration, transition);
                } else {
                  currentModel.periods = updated;
                  currentModel.afterPeriod = newAfter;
                  currentModel.recessDuration = duration;
                  currentModel.recessTransition = transition;
                }
                refreshDOM();
                toast('تم تعديل الفسحة المدرسية بنجاح');
              }
            });
          });
        });

        // Add recess button — opens explicit configuration dialog without inserting arbitrarily
        const btnAddRecess = root.querySelector('#sheet-btn-add-recess');
        if (btnAddRecess) {
          btnAddRecess.addEventListener('click', () => {
            if (activePeriods.length < 2) {
              toast('يلزم وجود حصتين على الأقل لإضافة فسحة بينهما', 'danger');
              return;
            }
            const defaultAfter = Math.min(3, Math.max(1, activePeriods.length - 1));
            openRecessConfigSheet({
              isEdit: false,
              currentAfter: defaultAfter,
              currentDur: 20,
              currentTrans: 0,
              maxPeriods: activePeriods.length,
              onSave: ({ afterPeriod, duration, transition }) => {
                const updated = reflowPeriodsWithRecess(activePeriods, {
                  ...reflowOptions,
                  afterPeriod,
                  recessDuration: duration,
                  transition
                });
                if (selectedDay !== null) {
                  dayOverrides[String(selectedDay)] = updated;
                  setDayRecess(afterPeriod, duration, transition);
                } else {
                  currentModel.periods = updated;
                  currentModel.afterPeriod = afterPeriod;
                  currentModel.recessDuration = duration;
                  currentModel.recessTransition = transition;
                }
                refreshDOM();
                toast('أُضيفت الفسحة المدرسية بنجاح');
              }
            });
          });
        }

        // Add period button
        const btnAddP = root.querySelector('#sheet-btn-add-p');
        if (btnAddP) {
          btnAddP.addEventListener('click', () => {
            const last = activePeriods.at(-1);
            let nextStart = '07:00';
            let nextEnd = '07:45';
            if (last) {
              const startMins = parseTime(last.end);
              const endMins = startMins + 45;
              nextStart = fmtTime(startMins);
              nextEnd = fmtTime(endMins);
            }
            const nextP = (last?.period ?? 0) + 1;
            const newPeriod = { period: nextP, start: nextStart, end: nextEnd };
            if (selectedDay !== null) {
              dayOverrides[String(selectedDay)] = [...activePeriods, newPeriod];
            } else {
              currentModel.periods.push(newPeriod);
            }
            refreshDOM();
          });
        }

        // Generate button (opens generator, applies to current active model without affecting others)
        const btnGen = root.querySelector('#sheet-btn-gen');
        if (btnGen) {
          btnGen.addEventListener('click', async () => {
            const cfg = await generateSheet({
              count: activePeriods.length || 7,
              firstPeriodStart: activePeriods[0]?.start || '07:00',
              gap: reflowOptions.gap,
            });
            if (!cfg) return;
            const newPeriods = generateAdvancedPeriods(cfg);
            if (selectedDay !== null) {
              dayOverrides[String(selectedDay)] = newPeriods.map(x => ({ ...x }));
              setDayRecess(cfg.recess?.enabled ? cfg.recess.afterPeriod : 0,
                cfg.recess?.duration || 0, cfg.recess?.transition || 0, cfg.gap);
            } else {
              currentModel.periods = newPeriods.map(x => ({ ...x }));
              currentModel.afterPeriod = cfg.recess?.enabled ? (cfg.recess.afterPeriod || 3) : 0;
              currentModel.recessDuration = cfg.recess?.duration || 20;
              currentModel.recessTransition = cfg.recess?.transition || 0;
              currentModel.gap = cfg.gap;
              p.overrides = p.overrides || {};
              p.overrides.config = cfg;
            }
            refreshDOM();
            toast('وُلّدت الأوقات الجديدة بنجاح لهذا النموذج');
          });
        }
      };

      const refreshDOM = () => {
        const body = root.querySelector('.sheet__body');
        if (body) {
          render(body, renderSheetContent());
          attachListeners();
        }
      };

      attachListeners();

      // Save all changes
      root.querySelector('#sheet-btn-save-all').addEventListener('click', async () => {
        if (selectedDay === null) {
          const allFlatPeriods = [];
          if (models.length === 1 && (!models[0].grades || models[0].grades.length === 0)) {
            allFlatPeriods.push(...models[0].periods.map(x => {
              const { grades, ...rest } = x;
              return rest;
            }));
          } else {
            for (const m of models) {
              for (const pItem of m.periods) {
                allFlatPeriods.push({
                  ...pItem,
                  grades: (m.grades && m.grades.length > 0) ? m.grades : undefined
                });
              }
            }
          }

          p.overrides = p.overrides || {};
          p.overrides.models = models.map(m => ({
            id: m.id,
            name: m.name,
            grades: m.grades,
            gradesLabel: m.gradesLabel,
            afterPeriod: m.afterPeriod,
            recessDuration: m.recessDuration,
            recessTransition: m.recessTransition,
            gap: m.gap,
            periods: m.periods.map(x => ({ ...x }))
          }));

          await store.patch('timeProfiles', p.id, {
            periods: allFlatPeriods.length ? allFlatPeriods : models[0].periods,
            overrides: p.overrides
          });
        } else {
          const overrides = { ...(p.overrides ?? {}) };
          const dayPeriods = dayOverrides[String(selectedDay)];
          if (Array.isArray(dayPeriods) && dayPeriods.length) {
            overrides[String(selectedDay)] = dayPeriods;
            if (dayOverrides.recessByDay?.[String(selectedDay)]) {
              overrides.recessByDay = { ...(overrides.recessByDay || {}),
                [String(selectedDay)]: dayOverrides.recessByDay[String(selectedDay)] };
            }
          } else {
            delete overrides[String(selectedDay)];
          }
          await store.patch('timeProfiles', p.id, { overrides });
        }
        toast('تم حفظ أوقات الحصص بنجاح');
        done();
        repaint();
      });
    }
  });
}

export default {
  title: () => 'أوقات الحصص',
  subtitle: () => store.resolveProfile(store.activeTimeProfile(), todayISO())?.name ?? '',
  back: () => '#/schedule',

  topActions: () => html`
    <button class="btn btn--sm btn--primary timing-new-profile-action--header" data-act="add-profile">
      ${icon('plus')} ملف توقيت جديد
    </button>
  `,

  render() {
    const profiles = store.timeProfiles();
    const active = store.activeTimeProfile();

    if (!profiles.length) {
      return html`
        <div class="timing-mobile-actions">
          <button class="btn btn--primary" data-act="add-profile">${icon('plus')} ملف توقيت جديد</button>
        </div>
        <div class="empty">
          <div class="empty__icon">${icon('clock')}</div>
          <div class="empty__title">لا ملفات توقيت</div>
          <div class="empty__text">أنشئ ملفًا وحدّد فيه أوقات الحصص مرة واحدة.</div>
          <button class="btn btn--primary" data-act="add-profile">${icon('plus')} ملف جديد</button>
        </div>
      `;
    }

    const todayStr = todayISO();
    const currentResolved = store.resolveProfile(active, todayStr);
    const profilesWithFrom = profiles.filter(p => p.activeFrom).sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
    const nextSwitch = profilesWithFrom.find(p => p.activeFrom > todayStr);

    return html`
      <div class="management-page timing-profiles-page">
      <div class="timing-mobile-actions">
        <button class="btn btn--primary" data-act="add-profile">${icon('plus')} ملف توقيت جديد</button>
      </div>
      <!-- يعرض التوقيت المطبق، والتبديل القادم عند وجوده، والأساسي عند اختلافه. -->
      ${nextSwitch || currentResolved?.id !== active?.id ? html`
        <div class="seasonal-activation-bar" role="status">
          <div class="seasonal-activation-bar__main">
            <div class="seasonal-activation-bar__item">
              <span class="seasonal-activation-bar__label">التوقيت المطبق اليوم</span>
              <strong class="seasonal-activation-bar__val">
                <span aria-hidden="true">${icon(timingProfileIcon(currentResolved?.name))}</span>
                <span>${currentResolved?.name || '—'}</span>
              </strong>
            </div>
            ${nextSwitch ? html`
              <div class="seasonal-activation-bar__sep" aria-hidden="true"></div>
              <div class="seasonal-activation-bar__item">
                <span class="seasonal-activation-bar__label">التبديل الموسمي القادم</span>
                <strong class="seasonal-activation-bar__val tabular">
                  ${nextSwitch.name} (${fmtDateFull(nextSwitch.activeFrom)})
                </strong>
              </div>
            ` : ''}
            ${currentResolved?.id !== active?.id ? html`
              <div class="seasonal-activation-bar__sep" aria-hidden="true"></div>
              <div class="seasonal-activation-bar__item">
                <span class="seasonal-activation-bar__label">التوقيت الأساسي</span>
                <strong class="seasonal-activation-bar__val">${active?.name || '—'}</strong>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- شبكة بطاقات ملفات التوقيت بنظام الإجرائين الصريحين -->
      <div class="timing-profiles-grid" aria-label="ملفات التوقيت">
        ${profiles.map((p) => {
          const isActive = p.id === active?.id;
          const isEffective = p.id === currentResolved?.id;
          const periodCount = (p.periods ?? []).length;
          const iconName = timingProfileIcon(p.name);
          let dataType = 'custom';
          if (iconName === 'sun') dataType = 'summer';
          else if (iconName === 'snowflake') dataType = 'winter';
          else if (iconName === 'crescent') dataType = 'ramadan';
          else if (iconName === 'device') dataType = 'hybrid';

          const startTime = p.periods?.[0]?.start;
          const endTime = p.periods?.[periodCount - 1]?.end;
          const models = getProfileModels(p);

          return html`
            <div class="timing-profile-card ${isEffective ? 'is-effective-profile rakeez-accent-surface' : ''} ${isActive ? 'is-active-profile is-base-profile' : ''}">
              <div class="timing-profile-card__head">
                <div class="timing-profile-card__title-wrap">
                  <span class="timing-profile-card__icon" data-type="${dataType}" aria-hidden="true">
                    ${icon(iconName)}
                  </span>
                  <div class="timing-profile-card__title-col">
                    <span class="timing-profile-card__name">${p.name}</span>
                    <span class="timing-profile-card__sub-status">
                      ${isEffective && isActive ? 'مطبق الآن · التوقيت الأساسي' : isEffective ? 'مطبق الآن' : isActive ? 'التوقيت الأساسي · احتياطي' : 'توقيت مخصص'}
                    </span>
                  </div>
                </div>
                ${isEffective
                  ? html`<span class="badge badge--brand">${icon('check')} مطبق الآن</span>`
                  : isActive
                    ? html`<span class="badge badge--info">${icon('check')} التوقيت الأساسي</span>`
                    : ''}
              </div>

              <div class="timing-profile-card__range">
                ${icon('calendar')}
                <span>${p.activeFrom ? html`يسري من <strong>${fmtDateFull(p.activeFrom)}</strong>${p.activeTo ? html` إلى <strong>${fmtDateFull(p.activeTo)}</strong>` : ' فصاعدًا'}` : 'تفعيل يدوي (بدون تاريخ مجدول)'}</span>
              </div>

              <div class="timing-profile-card__specs">
                <div class="timing-profile-card__spec-item">
                  <span>عدد الحصص</span>
                  <strong class="tabular">${periodCount} حصص</strong>
                </div>
                <div class="timing-profile-card__spec-item">
                  <span>أوقات الحصص</span>
                  <strong class="tabular">${startTime && endTime ? html`<span class="time-range"><span class="time-range__token" dir="ltr">${startTime}</span> – <span class="time-range__token" dir="ltr">${endTime}</span></span>` : '—'}</strong>
                </div>
              </div>

              ${models.length > 1 ? html`
                <div class="hstack justify-between px-2 py-1 bg-sunk rounded fs-xs text-2">
                  <span>نماذج الحصص:</span>
                  <strong class="tabular">${models.length} نماذج للصفوف</strong>
                </div>
              ` : ''}

              <!-- الإجرائين الصريحين المعتمدين -->
              <div class="timing-profile-card__actions">
                ${!isEffective && !isActive ? html`
                  <button class="btn btn--sm btn--ghost timing-profile-card__set-base" data-act="activate" data-id="${p.id}" aria-label="تعيين ${p.name} كتوقيت أساسي">
                    ${icon('check')} تعيين كأساسي
                  </button>
                ` : ''}
                <button class="btn btn--sm btn--primary" data-act="edit-times" data-id="${p.id}">
                  ${icon('clock')} عرض وتعديل أوقات الحصص
                </button>
                <div class="timing-profile-card__actions-row">
                  <button class="btn btn--sm btn--ghost timing-profile-card__rename" data-act="rename" data-id="${p.id}">
                    ${icon('calendar')} تعديل الاسم وفترة سريان التوقيت
                  </button>
                  ${!isActive ? html`
                    <button class="iconbtn timing-profile-card__delete" data-act="del-profile" data-id="${p.id}" aria-label="حذف ملف التوقيت" title="حذف ملف التوقيت">${icon('trash')}</button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        })}
      </div>
      </div>
    `;
  },

  actions: {
    async activate(el) {
      await store.setActiveTimeProfile(el.dataset.id);
      toast('تم تعيين التوقيت الأساسي — والحصص السابقة تبقى بوقتها');
      repaint();
    },

    'edit-times'(el) {
      const p = store.getTimeProfile(el.dataset.id);
      if (!p) return;
      editPeriodsSheet(p);
    },

    async rename(el) {
      const p = store.getTimeProfile(el.dataset.id);
      if (!p) return;
      const data = await nameSheet(p);
      if (!data) return;
      await store.patch('timeProfiles', p.id, data);
      toast('تم حفظ بيانات ملف التوقيت');
      repaint();
    },

    async 'add-profile'() {
      // تدفق إنشاء ملف جديد يبدأ بتحديد الاسم والتواريخ أولاً
      const meta = await nameSheet(null);
      if (!meta) return;

      // New profiles start from one canonical, contiguous model.  Copying the
      // active profile can copy its expanded/legacy model paths and make them
      // appear as duplicated sequences in the new editor.
      const defaultPeriods = generateAdvancedPeriods({
        firstPeriodStart: '07:00',
        periodDuration: 45,
        count: 7,
        gap: 0,
        recess: { enabled: false },
      });

      // الحصص الافتراضية متصلة ولا تفرض فسحة قسرية
      const newP = await store.createTimeProfile({
        name: meta.name,
        activeFrom: meta.activeFrom,
        activeTo: meta.activeTo,
        periods: defaultPeriods,
        overrides: {
          config: {
            type: 'custom',
            gap: 0,
            assembly: { enabled: false },
            firstPeriodStart: '07:00',
            periodDuration: 45,
            count: 7,
            recess: { enabled: false }
          },
          models: [{
            id: 'default',
            name: 'نموذج 1',
            grades: [],
            gradesLabel: 'جميع الصفوف',
            afterPeriod: 0,
            recessDuration: 0,
            recessTransition: 0,
            periods: defaultPeriods.map((period) => ({ ...period })),
          }],
        }
      });

      toast(`أُنشئ ملف التوقيت «${newP.name}»`);
      repaint();
      // فتح نافذة تعديل أوقات الحصص فوراً للملف الجديد مع خيار التوليد أو التعديل
      editPeriodsSheet(newP);
    },

    async 'del-profile'(el) {
      if (store.timeProfiles().length <= 1) {
        toast('لا يمكن حذف آخر ملف توقيت', 'danger');
        return;
      }
      const p = store.getTimeProfile(el.dataset.id);
      const ok = await confirmSheet({
        title: `حذف «${p?.name}»؟`,
        desc: 'الحصص السابقة تحتفظ بأوقاتها المطبوعة فيها ولا تتأثر.',
        confirmLabel: 'احذف',
        danger: true,
      });
      if (!ok) return;
      await store.deleteTimeProfile(el.dataset.id);
      toast('حُذف ملف التوقيت');
      repaint();
    },
  },
};

export {
  explicitRecess,
  reflowPeriodsWithRecess,
  extractFromProfilePeriods,
  getProfileModels,
};
