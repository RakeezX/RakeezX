/** Built-in academic-calendar templates. They populate the existing model only. */
import { calendarId, makeCalendar, makeCalendarDay, makeTerm, makeYear, shiftDate } from '../models.js';

export const WESTERN_1448_1449_PRESET_ID = 'sa-western-1448-1449';

export const CALENDAR_PRESETS = Object.freeze([
  Object.freeze({
    id: WESTERN_1448_1449_PRESET_ID,
    country: 'Saudi Arabia',
    region: 'western',
    regionLabel: 'المنطقة الغربية',
    coverage: ['مكة المكرمة', 'المدينة المنورة', 'جدة', 'الطائف'],
    hijriStart: 1448,
    hijriEnd: 1449,
    label: '1448–1449 هـ',
    gregorianLabel: '2026–2027 م',
    academicYearStart: '2026-08-30',
    endOfYearVacationStart: '2027-07-01',
    nextAcademicYearStart: '2027-08-29',
    terms: [
      { index: 1, name: 'الفصل الدراسي الأول', startDate: '2026-08-30', endDate: '2027-01-07', status: 'active' },
      { index: 2, name: 'الفصل الدراسي الثاني', startDate: '2027-01-17', endDate: '2027-06-30', status: 'upcoming' },
    ],
    holidays: [
      { startDate: '2026-09-23', endDate: '2026-09-26', label: 'إجازة اليوم الوطني', kind: 'national' },
      { startDate: '2026-11-20', endDate: '2026-11-28', label: 'إجازة الخريف', kind: 'holiday' },
      { startDate: '2027-01-08', endDate: '2027-01-16', label: 'إجازة منتصف العام', kind: 'holiday' },
      { startDate: '2027-02-19', endDate: '2027-02-22', label: 'إجازة يوم التأسيس', kind: 'founding' },
      { startDate: '2027-02-26', endDate: '2027-03-13', label: 'إجازة عيد الفطر', kind: 'holiday' },
      { startDate: '2027-04-30', endDate: '2027-05-22', label: 'إجازة عيد الأضحى', kind: 'holiday' },
    ],
  }),
]);

export const getCalendarPreset = (id = WESTERN_1448_1449_PRESET_ID) =>
  CALENDAR_PRESETS.find((preset) => preset.id === id) ?? null;

export function calendarPresetRecords(preset) {
  if (!preset) return null;
  const year = makeYear({
    hijriStart: preset.hijriStart,
    hijriEnd: preset.hijriEnd,
    label: preset.label,
    calendarPresetId: preset.id,
    calendarRegion: preset.regionLabel,
    gregorianLabel: preset.gregorianLabel,
    startDate: preset.academicYearStart,
    endOfYearVacationStart: preset.endOfYearVacationStart,
    nextAcademicYearStart: preset.nextAcademicYearStart,
  });
  const source = `preset:${preset.id}`;
  const calendar = makeCalendar({
    id: calendarId(year.id, source), yearId: year.id, source,
    label: `التقويم المعتمد · ${preset.label} · ${preset.regionLabel}`,
    presetId: preset.id,
  });
  const terms = preset.terms.map((term) => makeTerm({ ...term, yearId: year.id, calendarId: calendar.id }));
  const calendarDays = [];
  for (const holiday of preset.holidays) {
    for (let date = holiday.startDate; date <= holiday.endDate; date = shiftDate(date, 1)) {
      calendarDays.push(makeCalendarDay({ calendarId: calendar.id, date, kind: holiday.kind, label: holiday.label, presetId: preset.id, rangeId: preset.id + ':' + holiday.startDate, rangeStart: holiday.startDate, rangeEnd: holiday.endDate }));
    }
  }
  return { year, calendar, terms, calendarDays };
}