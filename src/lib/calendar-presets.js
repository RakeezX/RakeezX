/** Built-in academic-calendar templates. They populate the existing model only. */
import { calendarId, makeCalendar, makeCalendarDay, makeTerm, makeYear, shiftDate } from '../models.js';

export const GENERAL_1448_1449_PRESET_ID = 'sa-general-1448-1449';
export const WESTERN_1448_1449_PRESET_ID = 'sa-western-1448-1449';

export const CALENDAR_PRESETS = Object.freeze([
  // التقويم أ: جميع مناطق المملكة
  Object.freeze({
    id: GENERAL_1448_1449_PRESET_ID,
    name: 'تقويم جميع مناطق المملكة',
    country: 'Saudi Arabia',
    region: 'general',
    regionLabel: 'جميع مناطق المملكة',
    subtitle: 'جميع المناطق ما عدا إدارات التعليم المستثناة',
    coverage: ['جميع إدارات التعليم بالمملكة ما عدا إدارات التعليم المستثناة'],
    hijriStart: 1448,
    hijriEnd: 1449,
    label: '1448–1449 هـ',
    gregorianLabel: '2026–2027 م',
    academicYearStart: '2026-08-23',
    endOfYearVacationStart: '2027-06-24',
    nextAcademicYearStart: '2027-08-22',
    terms: [
      { index: 1, name: 'الفصل الدراسي الأول', startDate: '2026-08-23', endDate: '2027-01-07', status: 'active' },
      { index: 2, name: 'الفصل الدراسي الثاني', startDate: '2027-01-17', endDate: '2027-06-24', status: 'upcoming' },
    ],
    holidays: [
      { startDate: '2026-09-23', endDate: '2026-09-26', label: 'إجازة اليوم الوطني', kind: 'national' },
      { startDate: '2026-10-25', endDate: '2026-10-25', label: 'إجازة نهاية أسبوع مطولة', kind: 'holiday' },
      { startDate: '2026-11-20', endDate: '2026-11-28', label: 'إجازة الخريف', kind: 'holiday' },
      { startDate: '2026-11-29', endDate: '2026-11-29', label: 'إجازة نهاية أسبوع مطولة', kind: 'holiday' },
      { startDate: '2027-01-08', endDate: '2027-01-16', label: 'إجازة منتصف العام', kind: 'holiday' },
      { startDate: '2027-02-19', endDate: '2027-02-22', label: 'إجازة يوم التأسيس', kind: 'founding' },
      { startDate: '2027-02-26', endDate: '2027-03-13', label: 'إجازة عيد الفطر', kind: 'holiday' },
      { startDate: '2027-04-11', endDate: '2027-04-11', label: 'إجازة نهاية أسبوع مطولة', kind: 'holiday' },
      { startDate: '2027-05-07', endDate: '2027-05-22', label: 'إجازة عيد الأضحى', kind: 'holiday' },
    ],
  }),

  // التقويم ب: مكة المكرمة • المدينة المنورة • جدة • الطائف
  Object.freeze({
    id: WESTERN_1448_1449_PRESET_ID,
    name: 'تقويم مكة المكرمة • المدينة المنورة • جدة • الطائف',
    country: 'Saudi Arabia',
    region: 'western',
    regionLabel: 'مكة المكرمة • المدينة المنورة • جدة • الطائف',
    subtitle: 'التقويم الخاص بإدارات التعليم المستثناة',
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
      { index: 2, name: 'الفصل الدراسي الثاني', startDate: '2027-01-17', endDate: '2027-07-01', status: 'upcoming' },
    ],
    holidays: [
      { startDate: '2026-09-23', endDate: '2026-09-26', label: 'إجازة اليوم الوطني', kind: 'national' },
      { startDate: '2026-10-25', endDate: '2026-10-25', label: 'إجازة نهاية أسبوع مطولة', kind: 'holiday' },
      { startDate: '2026-11-20', endDate: '2026-11-28', label: 'إجازة الخريف', kind: 'holiday' },
      { startDate: '2027-01-08', endDate: '2027-01-16', label: 'إجازة منتصف العام', kind: 'holiday' },
      { startDate: '2027-02-19', endDate: '2027-02-22', label: 'إجازة يوم التأسيس', kind: 'founding' },
      { startDate: '2027-02-26', endDate: '2027-03-13', label: 'إجازة عيد الفطر', kind: 'holiday' },
      { startDate: '2027-04-30', endDate: '2027-05-22', label: 'إجازة عيد الأضحى', kind: 'holiday' },
    ],
  }),
]);

export const getCalendarPreset = (id = WESTERN_1448_1449_PRESET_ID) => {
  if (!id) return CALENDAR_PRESETS[1];
  if (id === 'western' || id === WESTERN_1448_1449_PRESET_ID) return CALENDAR_PRESETS[1];
  if (id === 'general' || id === GENERAL_1448_1449_PRESET_ID) return CALENDAR_PRESETS[0];
  return CALENDAR_PRESETS.find((preset) => preset.id === id) ?? null;
};

/**
 * الخياران الوزاريان المعتمدان رسمياً لتقويم 1448–1449 هـ:
 * 1. تقويم جميع مناطق المملكة (ما عدا إدارات التعليم المستثناة)
 * 2. تقويم مكة المكرمة • المدينة المنورة • جدة • الطائف (إدارات التعليم المستثناة)
 */
export const OFFICIAL_CALENDAR_OPTIONS = Object.freeze([
  Object.freeze({
    id: GENERAL_1448_1449_PRESET_ID,
    presetId: GENERAL_1448_1449_PRESET_ID,
    name: 'تقويم جميع مناطق المملكة',
    shortName: 'جميع مناطق المملكة',
    subtitle: 'جميع المناطق ما عدا إدارات التعليم المستثناة',
    status: 'active',
    statusLabel: 'معتمد رسمياً',
    coverage: ['جميع إدارات التعليم بالمملكة ما عدا إدارات التعليم المستثناة'],
    description: 'التقويم الدراسي الوزاري المعتمد لعام 1448–1449 هـ لكافة مناطق ومحافظات المملكة (يبدأ 23 أغسطس 2026 م ويشمل 4 إجازات مطولة وإضافية).',
  }),
  Object.freeze({
    id: WESTERN_1448_1449_PRESET_ID,
    presetId: WESTERN_1448_1449_PRESET_ID,
    name: 'تقويم مكة المكرمة • المدينة المنورة • جدة • الطائف',
    shortName: 'مكة المكرمة • المدينة المنورة • جدة • الطائف',
    subtitle: 'التقويم الخاص بإدارات التعليم المستثناة',
    status: 'active',
    statusLabel: 'معتمد رسمياً',
    coverage: ['مكة المكرمة', 'المدينة المنورة', 'جدة', 'الطائف'],
    description: 'التقويم الوزاري المعتمد لإدارات التعليم المستثناة مراعاةً لخصوصية موسمي الحج والعمرة (يبدأ 30 أغسطس 2026 م مع إجازة حج موسعة 23 يوماً).',
  }),
]);

export const SAUDI_EDUCATION_REGIONS = OFFICIAL_CALENDAR_OPTIONS;

export const getSaudiEducationRegion = (id) => {
  if (id === 'general' || id === GENERAL_1448_1449_PRESET_ID) return OFFICIAL_CALENDAR_OPTIONS[0];
  if (id === 'western' || id === WESTERN_1448_1449_PRESET_ID) return OFFICIAL_CALENDAR_OPTIONS[1];
  return (
    OFFICIAL_CALENDAR_OPTIONS.find((r) => r.id === id || r.presetId === id) ??
    OFFICIAL_CALENDAR_OPTIONS[1]
  );
};


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
