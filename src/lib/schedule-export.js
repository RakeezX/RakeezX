/**
 * Read-only Schedule export engine.
 *
 * The engine deliberately receives the store as a dependency. It never writes
 * Product state, and it reads the owner-selected base timing profile directly
 * instead of resolving dated/calendar timing overrides.
 */

import { SCHOOL_WEEKDAYS, WEEKDAYS, periodNumbers, periodTime, gradeLabel, sectionLabel } from '../models.js';
import { downloadBlob } from './export.js';
import { getAccountPresentation } from './account-profile.js';
import { ensureThmanyahFont, installThmanyahInDocument } from './thmanyah-font.js';

export const SCHEDULE_PNG_WIDTH = 1600;
export const SCHEDULE_PNG_HEIGHT = 1200;
export const SCHEDULE_EXPORT_VERSION = 1;

const text = (value) => String(value ?? '').trim();
const COMPACT_GRADES = {
  1: 'أول', 2: 'ثاني', 3: 'ثالث', 4: 'رابع', 5: 'خامس', 6: 'سادس',
  7: 'أول متوسط', 8: 'ثاني متوسط', 9: 'ثالث متوسط',
  10: 'أول ثانوي', 11: 'ثاني ثانوي', 12: 'ثالث ثانوي',
};

/** Export-only labels. Stored class and subject values remain untouched. */
export function compactScheduleClassLabel(section) {
  if (!section) return '';
  const fullGrade = gradeLabel(section.grade);
  const shortGrade = COMPACT_GRADES[Number(section.grade)] ?? fullGrade;
  let sectionName = text(section.label || section.name);
  if (fullGrade && sectionName.startsWith(fullGrade)) {
    sectionName = sectionName.slice(fullGrade.length).replace(/^[\s/—–-]+/, '').trim();
  }
  return shortGrade && sectionName ? `${shortGrade}/${sectionName}` : text(sectionLabel(section));
}

export function compactScheduleSubjectLabel(name) {
  const label = text(name);
  return label === 'المهارات الرقمية' ? 'رقمية' : label;
}
const positivePeriod = (value) => {
  const period = Number(value);
  return Number.isInteger(period) && period > 0 ? period : null;
};

function safeTime(profile, weekday, period, grade = null) {
  const timing = periodTime(profile, weekday, period, grade);
  if (!timing?.start || !timing?.end) return null;
  return { start: text(timing.start), end: text(timing.end) };
}

/**
 * Build the minimal privacy-safe weekly export model.
 *
 * `source` is normally the store module. Keeping it injected makes the
 * read-only boundary explicit and allows the final UI to choose identity/time
 * visibility without coupling rendering to Product state.
 */
export function buildScheduleExportModel(source, {
  includeTeacherName = false,
  includeSchoolName = false,
  includeTimes = true,
  weekdays = SCHOOL_WEEKDAYS,
} = {}) {
  if (!source) throw new TypeError('Schedule export requires a data source.');

  const year = source.activeYear?.() ?? null;
  const term = source.activeTerm?.() ?? null;
  // Contract: this is the BASE recurring profile. Never call resolveProfile().
  const baseProfile = source.activeTimeProfile?.() ?? null;
  const profile = source.state?.profile ?? null;
  const dayNumbers = [...new Set(weekdays.map(Number).filter((day) => SCHOOL_WEEKDAYS.includes(day)))];
  const rawSlots = [...(source.allSlots?.(term?.id) ?? [])]
    .filter((slot) => dayNumbers.includes(Number(slot.weekday)) && positivePeriod(slot.period))
    .sort((a, b) => Number(a.weekday) - Number(b.weekday)
      || Number(a.period) - Number(b.period)
      || text(a.id).localeCompare(text(b.id)));

  const periodSet = new Set(rawSlots.map((slot) => Number(slot.period)));
  for (const day of dayNumbers) {
    for (const period of periodNumbers(baseProfile, day)) {
      const value = positivePeriod(period);
      if (value) periodSet.add(value);
    }
  }
  if (!periodSet.size) periodNumbers(baseProfile).forEach((period) => periodSet.add(Number(period)));
  const periods = [...periodSet].filter(Boolean).sort((a, b) => a - b);

  const slotByPosition = new Map();
  for (const slot of rawSlots) {
    const key = `${Number(slot.weekday)}:${Number(slot.period)}`;
    if (!slotByPosition.has(key)) slotByPosition.set(key, slot);
  }

  const identity = {};
  if (includeTeacherName && text(profile?.teacherName)) {
    identity.teacherName = text(profile.teacherName);
    identity.teacherForm = profile?.teacherForm === 'feminine' ? 'feminine' : 'masculine';
  }
  if (includeSchoolName && text(profile?.schoolName)) identity.schoolName = text(profile.schoolName);

  const days = dayNumbers.map((weekday, dayIndex) => ({
    weekday,
    order: dayIndex + 1,
    label: WEEKDAYS[weekday] ?? '',
    periods: periods.map((period, periodIndex) => {
      const slot = slotByPosition.get(`${weekday}:${period}`) ?? null;
      const teaching = slot ? source.getTeaching?.(slot.teachingId) : null;
      const section = teaching ? source.getSection?.(teaching.sectionId) : null;
      const subject = teaching ? source.getSubject?.(teaching.subjectId) : null;
      return {
        period,
        order: periodIndex + 1,
        time: includeTimes ? safeTime(baseProfile, weekday, period, section?.grade ?? null) : null,
        teaching: slot ? {
          classLabel: compactScheduleClassLabel(section),
          subjectLabel: compactScheduleSubjectLabel(subject?.name),
        } : null,
      };
    }),
  }));

  return {
    version: SCHEDULE_EXPORT_VERSION,
    title: 'الجدول الأسبوعي',
    direction: 'rtl',
    identity,
    academic: {
      year: text(year?.label),
      term: text(term?.name),
    },
    timing: includeTimes && baseProfile ? {
      name: text(baseProfile.name),
      label: `التوقيت الأساسي: ${text(baseProfile.name)}`,
    } : null,
    periods: periods.map((period, index) => ({ period, order: index + 1 })),
    days,
  };
}

function clippedText(ctx, value, maxWidth) {
  const original = text(value);
  if (!original || ctx.measureText(original).width <= maxWidth) return original;
  let output = original;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
  return `${output}…`;
}

function drawScheduleCanvas(ctx, model, width, height) {
  const presentation = getAccountPresentation(model.identity.teacherForm);
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const margin = 70;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f7655';
  ctx.font = '700 24px "Thmanyah Sans", Tahoma, Arial, sans-serif';
  ctx.fillText('رَكيز', width - margin, 40);
  const brandWidth = ctx.measureText('رَكيز').width;
  ctx.font = '500 21px "Thmanyah Sans", Tahoma, Arial, sans-serif';
  ctx.fillText('المعلم', width - margin - brandWidth - 8, 40);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#12333b';
  ctx.font = '700 42px "Thmanyah Sans", Tahoma, Arial, sans-serif';
  ctx.fillText(model.title, width / 2, 78);

  const identityLines = [
    model.identity.teacherName && `${presentation.teacherLabel}: ${model.identity.teacherName}`,
    model.identity.schoolName && `المدرسة: ${model.identity.schoolName}`,
  ].filter(Boolean);
  const academicLine = [model.academic.year, model.academic.term].filter(Boolean).join(' · ');
  const metaLines = [...identityLines, academicLine, model.timing?.label].filter(Boolean);
  ctx.font = '500 21px "Thmanyah Sans", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#4a6268';
  metaLines.forEach((line, index) => ctx.fillText(line, width / 2, 126 + index * 29));

  const gridTop = 245;
  const gridLeft = margin;
  const gridWidth = width - margin * 2;
  const gridBottom = height - 70;
  const dayColumnWidth = 170;
  const periodWidth = (gridWidth - dayColumnWidth) / Math.max(1, model.periods.length);
  const rowHeight = (gridBottom - gridTop - 66) / Math.max(1, model.days.length);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#cbd8da';
  ctx.fillStyle = '#eff5f4';
  ctx.fillRect(gridLeft, gridTop, gridWidth, 66);
  ctx.strokeRect(gridLeft, gridTop, gridWidth, gridBottom - gridTop);

  const dayX = gridLeft + gridWidth - dayColumnWidth;
  const xForPeriod = (periodIndex) => dayX - (periodIndex + 1) * periodWidth;
  ctx.font = '700 24px "Thmanyah Sans", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#12333b';
  ctx.textAlign = 'center';
  ctx.strokeRect(dayX, gridTop, dayColumnWidth, 66);
  ctx.fillText('اليوم', dayX + dayColumnWidth / 2, gridTop + 33);
  model.periods.forEach(({ period }, periodIndex) => {
    const x = xForPeriod(periodIndex);
    ctx.strokeRect(x, gridTop, periodWidth, 66);
    ctx.fillText(`الحصة ${period}`, x + periodWidth / 2, gridTop + 33);
  });

  model.days.forEach((day, rowIndex) => {
    const y = gridTop + 66 + rowIndex * rowHeight;
    ctx.fillStyle = rowIndex % 2 ? '#fbfdfc' : '#ffffff';
    ctx.fillRect(gridLeft, y, gridWidth, rowHeight);
    ctx.strokeStyle = '#cbd8da';
    ctx.strokeRect(dayX, y, dayColumnWidth, rowHeight);
    ctx.fillStyle = '#12333b';
    ctx.font = '700 22px "Thmanyah Sans", Tahoma, Arial, sans-serif';
    ctx.fillText(day.label, dayX + dayColumnWidth / 2, y + rowHeight / 2);

    model.periods.forEach((unused, periodIndex) => {
      const cell = day.periods[periodIndex];
      const x = xForPeriod(periodIndex);
      ctx.strokeStyle = '#cbd8da';
      ctx.strokeRect(x, y, periodWidth, rowHeight);
      if (!cell?.teaching) return;
      ctx.fillStyle = '#12333b';
      ctx.font = '700 19px "Thmanyah Sans", Tahoma, Arial, sans-serif';
      ctx.fillText(clippedText(ctx, cell.teaching.classLabel, periodWidth - 24), x + periodWidth / 2, y + rowHeight * 0.34);
      ctx.fillStyle = '#52696f';
      ctx.font = '500 16px "Thmanyah Sans", Tahoma, Arial, sans-serif';
      const detail = [cell.teaching.subjectLabel, cell.time ? `\u2066${cell.time.start} – ${cell.time.end}\u2069` : '']
        .filter(Boolean).join(' · ');
      ctx.fillText(clippedText(ctx, detail, periodWidth - 24), x + periodWidth / 2, y + rowHeight * 0.68);
    });
  });
  ctx.restore();
}

/** Render a deterministic 1600×1200 browser-local PNG Blob. */
export async function renderSchedulePng(model, {
  width = SCHEDULE_PNG_WIDTH,
  height = SCHEDULE_PNG_HEIGHT,
  createCanvas = () => document.createElement('canvas'),
} = {}) {
  if (globalThis.document) await ensureThmanyahFont();
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('تعذّر تجهيز صورة الجدول.'));
  drawScheduleCanvas(ctx, model, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('تعذّر إنشاء صورة الجدول.'));
    }, 'image/png');
  });
}

const escapeHtml = (value) => text(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

/** Purpose-built isolated A4-landscape print document. */
export function schedulePrintDocument(model) {
  const presentation = getAccountPresentation(model.identity.teacherForm);
  const identity = [
    model.identity.teacherName && `${presentation.teacherLabel}: ${model.identity.teacherName}`,
    model.identity.schoolName && `المدرسة: ${model.identity.schoolName}`,
  ].filter(Boolean).map((line) => `<span>${escapeHtml(line)}</span>`).join('');
  const rows = model.days.map((day) => `<tr>
    <th scope="row">${escapeHtml(day.label)}</th>
    ${model.periods.map((unused, periodIndex) => {
      const cell = day.periods[periodIndex];
      if (!cell?.teaching) return '<td class="empty-cell"></td>';
      const detail = [
        cell.teaching.subjectLabel ? escapeHtml(cell.teaching.subjectLabel) : '',
        cell.time ? `<bdi dir="ltr">${escapeHtml(cell.time.start)} – ${escapeHtml(cell.time.end)}</bdi>` : '',
      ].filter(Boolean).join(' · ');
      return `<td><strong>${escapeHtml(cell.teaching.classLabel)}</strong>${detail ? `<small>${detail}</small>` : ''}</td>`;
    }).join('')}
  </tr>`).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; }
html { color-scheme: only light; background: #fff; }
body { margin: 0; color: #162f35; background: #fff; font: 12px "Thmanyah Sans", Tahoma, Arial, sans-serif; font-synthesis: none; }
header { position: relative; display: grid; gap: 4px; margin-bottom: 18px; padding: 0 4px 10px; border-bottom: 1px solid #a9c9be; text-align: center; }
.brand { display: flex; align-items: baseline; justify-content: flex-start; gap: 8px; color: #0f7655; font-family: "Thmanyah Sans", Tahoma, Arial, sans-serif; font-weight: 700; }
.brand b { font-size: 15px; } .brand em { font-size: 13px; font-style: normal; font-weight: 500; }
.brand small { color: #62757a; font-size: 9px; font-weight: 500; }
h1 { margin: 0; font-size: 24px; }
.identity, .meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; color: #52666b; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { border: 1px solid #aebfc2; padding: 7px; text-align: center; vertical-align: middle; }
thead th { background: #eaf4f0; font-size: 13px; }
thead th:first-child, tbody th { width: 11%; background: #f1f6f4; }
td strong, td small { display: block; }
td small { margin-top: 3px; color: #52666b; font-size: 10px; }
.empty-cell { background: #fbfcfc; }
</style></head><body>
<header><div class="brand"><span><b>رَكيز</b> <em>المعلم</em></span><small>الجدول الأسبوعي</small></div><h1>${escapeHtml(model.title)}</h1>${identity ? `<div class="identity">${identity}</div>` : ''}
<div class="meta"><span>${escapeHtml(model.academic.year)}</span><span>${escapeHtml(model.academic.term)}</span>${model.timing ? `<span>${escapeHtml(model.timing.label)}</span>` : ''}</div></header>
<table aria-label="${escapeHtml(model.title)}"><thead><tr><th scope="col">اليوم</th>${model.periods.map(({ period }) => `<th scope="col">الحصة ${period}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

export function openSchedulePrint(model, {
  openWindow = () => window.open('', '_blank'),
  schedulePrint = (callback) => setTimeout(callback, 0),
} = {}) {
  const printWindow = openWindow();
  if (!printWindow) throw new Error('تعذّر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
  try { printWindow.opener = null; } catch { /* Cross-origin wrappers may reject this hardening. */ }
  printWindow.document.open();
  printWindow.document.write(schedulePrintDocument(model));
  printWindow.document.close();
  printWindow.focus?.();
  schedulePrint(() => {
    if (printWindow.document?.fonts) {
      installThmanyahInDocument(printWindow.document).finally(() => printWindow.print());
    } else {
      printWindow.print();
    }
  });
  return printWindow;
}

export function canShareScheduleFile(file, navigatorObject = globalThis.navigator) {
  if (!file || typeof navigatorObject?.share !== 'function' || typeof navigatorObject?.canShare !== 'function') return false;
  try { return navigatorObject.canShare({ files: [file] }) === true; } catch { return false; }
}

export function createSchedulePngFile(blob, filename = 'rakeezx-schedule.png', FileClass = globalThis.File) {
  if (typeof FileClass !== 'function') return null;
  return new FileClass([blob], filename, { type: 'image/png', lastModified: 0 });
}

/** Share an already-rendered PNG from the current user gesture, or download it. */
export async function shareOrDownloadSchedule(blob, {
  filename = 'rakeezx-schedule.png',
  title = 'الجدول الأسبوعي',
  navigatorObject = globalThis.navigator,
  FileClass = globalThis.File,
  download = downloadBlob,
} = {}) {
  const file = createSchedulePngFile(blob, filename, FileClass);
  if (canShareScheduleFile(file, navigatorObject)) {
    try {
      await navigatorObject.share({ title, files: [file] });
      return { method: 'share', file };
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'cancelled', file };
    }
  }
  download(filename, blob);
  return { method: 'download', file };
}
