/**
 * Pure N58 projections. No factories, clock, storage, Sync or session writes.
 * Callers supply existing identities and an explicit full catalog preset ID.
 * Customizations are already scoped data; this module never attributes legacy
 * records. Dates are local calendar dates (YYYY-MM-DD), not instants.
 */
import { CALENDAR_PRESETS } from './calendar-presets.js';
import { CALENDAR_KIND, isTeachingDay, isWeekend, SESSION_STATUS, sessionCalendarPresentation } from '../models.js';

const invalid = (reason) => ({ ok: false, reason });
const validId = (id) => typeof id === 'string' && id.trim().length > 0;
const copy = (value) => structuredClone(value);
const live = (records) => records.filter((record) => !record.deleted);
const hasKind = (kind) => Object.hasOwn(CALENDAR_KIND, kind);
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date;
}

const validBounds = (start, end) => validDate(start) && validDate(end) && start <= end;
const validCalendar = (calendar) => calendar?.ok === true && validId(calendar.year?.id) &&
  Array.isArray(calendar.terms) && Array.isArray(calendar.exceptions) &&
  Array.isArray(calendar.preset?.holidays);

/**
 * @param {object} input
 * @param {object} input.year Existing non-deleted year, including Hijri bounds.
 * @param {object[]} input.terms Existing terms of that year, including tombstones.
 * @param {string} input.presetId Full ID from the existing built-in catalog.
 * @param {object[]} [input.customizations] One record per year/preset:
 *   {yearId, presetId, termDateOverrides:[{termId,startDate,endDate,deleted?}],
 *    exceptions:[{id,date,kind,label?,deleted?}], deleted?}.
 * @returns {object} {ok:true, year, terms, preset, exceptions} or {ok:false,reason}.
 * Output is a detached projection, never a batch intended for persistence.
 */
export function resolveCalendarRuntime(input = {}) {
  if (!isObject(input)) return invalid('invalid-input');
  const { year, terms, presetId, customizations = [] } = input;
  const preset = CALENDAR_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return invalid('unsupported-preset');
  if (!year || !validId(year.id) || year.deleted) return invalid('invalid-year');
  if (year.hijriStart !== preset.hijriStart || year.hijriEnd !== preset.hijriEnd) {
    return invalid('preset-year-mismatch');
  }
  if (!Array.isArray(terms) || terms.some((term) => !term || !validId(term.id) ||
      term.yearId !== year.id || !Number.isInteger(term.index) || term.index < 1 || term.index > 6 ||
      !['active', 'upcoming', 'closed'].includes(term.status))) return invalid('invalid-terms');
  if (new Set(terms.map((term) => term.id)).size !== terms.length) return invalid('duplicate-term-id');
  const existing = live(terms);
  for (const index of [1, 2]) {
    const matches = existing.filter((term) => term.index === index);
    if (!matches.length) return invalid('missing-official-term');
    if (matches.length !== 1) return invalid('ambiguous-official-term');
  }
  if (new Set(existing.map((term) => term.index)).size !== existing.length) {
    return invalid('ambiguous-term-index');
  }
  if (!Array.isArray(customizations)) return invalid('invalid-customizations');
  const scopes = new Set();
  for (const scope of customizations) {
    if (!scope || scope.yearId !== year.id || !validId(scope.presetId)) return invalid('unscoped-customization');
    if (!CALENDAR_PRESETS.some((entry) => entry.id === scope.presetId && entry.hijriStart === year.hijriStart &&
        entry.hijriEnd === year.hijriEnd)) return invalid('unsupported-customization-preset');
    if (scope.deleted) continue;
    if (scopes.has(scope.presetId)) return invalid('ambiguous-customization-scope');
    scopes.add(scope.presetId);
    if (!Array.isArray(scope.termDateOverrides ?? []) || !Array.isArray(scope.exceptions ?? [])) {
      return invalid('invalid-customizations');
    }
    const termIds = new Set();
    for (const override of scope.termDateOverrides ?? []) {
      if (!override || !validId(override.termId)) return invalid('invalid-term-override');
      if (override.deleted) continue;
      if ((override.presetId != null && override.presetId !== scope.presetId) ||
          (override.yearId != null && override.yearId !== year.id)) return invalid('customization-scope-mismatch');
      const term = existing.find((candidate) => candidate.id === override.termId);
      if (!term) return invalid('unknown-override-term');
      if (!validBounds(override.startDate, override.endDate)) return invalid('invalid-term-bounds');
      if (termIds.has(term.id)) return invalid('ambiguous-term-override');
      termIds.add(term.id);
    }
    const dates = new Set();
    const ids = new Set();
    for (const day of scope.exceptions ?? []) {
      if (!day || !validId(day.id)) return invalid('invalid-exception');
      if (ids.has(day.id)) return invalid('duplicate-exception-id');
      ids.add(day.id);
      if (day.deleted) continue;
      if ((day.presetId != null && day.presetId !== scope.presetId) ||
          (day.yearId != null && day.yearId !== year.id)) return invalid('customization-scope-mismatch');
      if (!validDate(day.date) || !hasKind(day.kind) || (day.label != null && typeof day.label !== 'string')) {
        return invalid('invalid-exception');
      }
      if (dates.has(day.date)) return invalid('ambiguous-exception-date');
      dates.add(day.date);
    }
  }
  const project = (scopePreset, overrides) => {
    const projectedTerms = terms.map((term) => {
    if (term.deleted) return copy(term);
    const official = scopePreset.terms.find((entry) => entry.index === term.index);
    const override = overrides.find((entry) => entry.termId === term.id);
    if (!official) return override ? {
      ...copy(term), startDate: override.startDate, endDate: override.endDate, dateSource: 'custom',
    } : copy(term);
    return {
      ...copy(term),
      startDate: override?.startDate ?? official.startDate,
      endDate: override?.endDate ?? official.endDate,
      officialStartDate: official.startDate,
      officialEndDate: official.endDate,
      dateSource: override ? 'custom' : 'official',
    };
  });
    return projectedTerms;
  };
  const selected = customizations.find((scope) => !scope.deleted && scope.presetId === preset.id);
  const projectedTerms = project(preset, live(selected?.termDateOverrides ?? []));
  // Every stored live scope is subject to the same effective inclusive overlap
  // rule as the server, including scopes currently inactive on this device.
  for (const scopePreset of CALENDAR_PRESETS.filter((entry) => scopes.has(entry.id) || entry.id === preset.id)) {
    const scope = customizations.find((entry) => !entry.deleted && entry.presetId === scopePreset.id);
    const effective = project(scopePreset, live(scope?.termDateOverrides ?? []));
    const first = effective.find((term) => !term.deleted && term.index === 1);
    const second = effective.find((term) => !term.deleted && term.index === 2);
    if (first.endDate >= second.startDate) return invalid('overlapping-official-terms');
    const bounded = live(effective).filter((term) => validBounds(term.startDate, term.endDate));
    if (bounded.some((term, index) => bounded.slice(index + 1).some((other) =>
      term.startDate <= other.endDate && other.startDate <= term.endDate))) return invalid('overlapping-term-bounds');
  }
  return {
    ok: true,
    year: {
      ...copy(year), calendarPresetId: preset.id,
      startDate: preset.academicYearStart,
      endOfYearVacationStart: preset.endOfYearVacationStart,
      nextAcademicYearStart: preset.nextAcademicYearStart,
    },
    terms: projectedTerms,
    preset: copy(preset),
    exceptions: copy(live(selected?.exceptions ?? [])),
  };
}

/** Resolve one date; explicit exceptions win over official days and weekends. */
export function resolveCalendarDate(calendar, date) {
  if (!validCalendar(calendar)) return invalid('invalid-calendar');
  if (!validDate(date)) return invalid('invalid-date');
  const exception = calendar.exceptions.find((day) => day.date === date);
  const official = calendar.preset.holidays.find((day) => day.startDate <= date && date <= day.endDate);
  const kind = exception?.kind ?? official?.kind ?? (isWeekend(date) ? 'holiday' : 'study');
  return {
    ok: true, date, yearId: calendar.year.id, presetId: calendar.preset.id,
    kind, label: exception ? exception.label ?? '' : official?.label ?? '', teaching: isTeachingDay(kind),
    source: exception ? 'custom' : official ? 'official' : 'default',
    exceptionId: exception?.id ?? null,
    officialRangeId: !exception && official ? `${calendar.preset.id}:${official.startDate}` : null,
  };
}

/** Inputs to today's missing-session decision only; never materializes records. */
export function resolveTodayEligibility(calendar, context = {}) {
  if (!validCalendar(calendar)) return invalid('invalid-calendar');
  if (!isObject(context)) return invalid('invalid-context');
  const { date, today, activeTermId } = context;
  if (!validDate(date) || !validDate(today)) return invalid('invalid-date');
  const term = calendar.terms.find((entry) => entry.id === activeTermId && !entry.deleted);
  if (!term) return invalid('invalid-active-term');
  const day = resolveCalendarDate(calendar, date);
  const result = { ok: true, eligible: false, yearId: calendar.year.id, termId: term.id, day };
  if (date !== today) return { ...result, reason: 'not-today' };
  if (term.status === 'closed') return { ...result, reason: 'term-closed' };
  if (!validBounds(term.startDate, term.endDate)) return invalid('missing-term-bounds');
  if (date < term.startDate || date > term.endDate) return { ...result, reason: 'outside-term' };
  if (!day.teaching) return { ...result, reason: 'non-teaching-day' };
  return { ...result, eligible: true, reason: 'eligible' };
}

/** Date arrival is a suggestion, separate from the teacher's active-term choice. */
export function suggestTermTransition(calendar, context = {}) {
  if (!validCalendar(calendar)) return invalid('invalid-calendar');
  if (!isObject(context)) return invalid('invalid-context');
  const { date, activeTermId } = context;
  if (!validDate(date)) return invalid('invalid-date');
  const active = calendar.terms.find((term) => term.id === activeTermId && !term.deleted);
  if (!active) return invalid('invalid-active-term');
  const second = calendar.terms.find((term) => term.index === 2 && !term.deleted);
  const suggestion = active.index === 1 && active.status !== 'closed' && second.status !== 'closed' &&
    date >= second.startDate ? {
      fromTermId: active.id, toTermId: second.id,
      message: 'الفصل الدراسي الثاني بدأ',
      activateLabel: 'تفعيل الفصل الدراسي الثاني', laterLabel: 'لاحقًا',
    } : null;
  return { ok: true, suggestion };
}

/**
 * Historical support ONLY. No selected Calendar argument: unknown provenance
 * stays unknown. This does not replace today's explicit exception/cancellation
 * behavior; resolveCalendarDate supplies today's suspension/non-teaching kind.
 * Recorded context uses {kind,label?,presetId?,source?}, never inferred values.
 */
export function resolveRecordedSessionPresentation(session) {
  if (!isObject(session) || !Object.hasOwn(SESSION_STATUS, session.status) ||
      (session.reason != null && typeof session.reason !== 'string')) return invalid('invalid-session');
  const context = session.calendarContext;
  if (context != null && (!isObject(context) || !hasKind(context.kind) ||
      (context.label != null && typeof context.label !== 'string'))) return invalid('invalid-recorded-context');
  return {
    ok: true, ...sessionCalendarPresentation(session, context ?? null),
    provenance: context == null ? 'unrecorded' : 'recorded',
    calendarContext: context == null ? null : copy(context),
  };
}
