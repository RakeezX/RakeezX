import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CALENDAR_PRESETS, GENERAL_1448_1449_PRESET_ID as G, WESTERN_1448_1449_PRESET_ID as W } from '../src/lib/calendar-presets.js';
import { CALENDAR_KIND, SESSION_STATUS } from '../src/models.js';
import {
  resolveCalendarRuntime, resolveCalendarDate, resolveTodayEligibility,
  suggestTermTransition, resolveRecordedSessionPresentation,
} from '../src/lib/calendar-runtime.js';

const fixture = () => ({
  year: { id: 'existing:year', hijriStart: 1448, hijriEnd: 1449, startDate: '2026-09-01', updatedAt: 7 },
  terms: [
    { id: 'imported:first', yearId: 'existing:year', index: 1, status: 'active', startDate: '2026-09-01', endDate: '2027-01-06', updatedAt: 8 },
    { id: 'imported:second', yearId: 'existing:year', index: 2, status: 'upcoming', startDate: '2027-01-18', endDate: '2027-06-20', updatedAt: 9 },
  ],
  presetId: G,
  customizations: [
    { yearId: 'existing:year', presetId: G,
      termDateOverrides: [{ termId: 'imported:first', startDate: '2026-09-02', endDate: '2027-01-06' }],
      exceptions: [{ id: 'general:day', date: '2026-10-04', kind: 'suspension', label: 'تعليق محفوظ' }] },
    { yearId: 'existing:year', presetId: W,
      termDateOverrides: [{ termId: 'imported:first', startDate: '2026-09-03', endDate: '2027-01-05' }],
      exceptions: [{ id: 'western:day', date: '2026-10-04', kind: 'remote', label: 'عن بعد محفوظ' }] },
  ],
});
const resolve = (input = fixture()) => {
  const result = resolveCalendarRuntime(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
const plain = () => ({ ...fixture(), customizations: [] });
const dayInput = (kind, date = '2026-10-04') => ({ ...plain(), customizations: [{
  yearId: 'existing:year', presetId: G,
  exceptions: [{ id: 'synthetic:day', date, kind, label: 'synthetic' }],
}] });
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test('General → Western → General restores dates/exceptions and keeps imported year/term/Teaching identities', () => {
  const input = freeze(fixture());
  const teachings = freeze([{ id: 'teaching:kept', termId: 'imported:first', sectionId: 'section:kept' }]);
  const before = JSON.stringify({ input, teachings });
  const results = [G, W, G].map(presetId => resolve({ ...input, presetId }));
  assert.deepEqual(results.map(x => x.terms[0].startDate), ['2026-09-02', '2026-09-03', '2026-09-02']);
  assert.deepEqual(results.map(x => resolveCalendarDate(x, '2026-10-04').kind), ['suspension', 'remote', 'suspension']);
  assert.deepEqual(results[0], results[2]);
  for (const result of results) {
    assert.equal(result.year.id, input.year.id);
    assert.deepEqual(result.terms.map(x => x.id), input.terms.map(x => x.id));
    assert.equal(teachings[0].termId, result.terms[0].id);
  }
  assert.equal(JSON.stringify({ input, teachings }), before);
});

test('both terms and year metadata project exact existing catalog dates without customizations', () => {
  for (const presetId of [G, W]) {
    const result = resolve({ ...plain(), presetId });
    const preset = CALENDAR_PRESETS.find(x => x.id === presetId);
    assert.deepEqual(result.terms.map(x => [x.startDate, x.endDate]), preset.terms.map(x => [x.startDate, x.endDate]));
    assert.equal(result.year.startDate, preset.academicYearStart);
    assert.equal(result.year.endOfYearVacationStart, preset.endOfYearVacationStart);
    assert.equal(result.year.nextAcademicYearStart, preset.nextAcademicYearStart);
    assert.equal(result.terms[0].officialStartDate, preset.terms[0].startDate);
    assert.equal(result.terms[0].dateSource, 'official');
  }
});

test('manual second-term bounds are scoped and restore on returning', () => {
  const input = fixture();
  input.customizations[0].termDateOverrides.push({ termId: 'imported:second', startDate: '2027-01-19', endDate: '2027-06-21' });
  assert.equal(resolve(input).terms[1].startDate, '2027-01-19');
  assert.equal(resolve({ ...input, presetId: W }).terms[1].startDate, '2027-01-17');
  assert.equal(resolve(input).terms[1].endDate, '2027-06-21');
});

test('a custom teaching day overrides an official holiday without inventing official-event association', () => {
  const result = resolve(dayInput('study', '2026-09-23'));
  const day = resolveCalendarDate(result, '2026-09-23');
  assert.equal(day.teaching, true);
  assert.equal(day.source, 'custom');
  assert.equal(day.exceptionId, 'synthetic:day');
  assert.equal(day.officialRangeId, null);
});

test('empty custom labels do not inherit an unrelated official holiday label', () => {
  const input = dayInput('remote', '2026-09-23');
  delete input.customizations[0].exceptions[0].label;
  assert.equal(resolveCalendarDate(resolve(input), '2026-09-23').label, '');
});

for (const [kind, metadata] of Object.entries(CALENDAR_KIND)) {
  test(`today's ${kind} exception keeps the shipped teaching predicate (${metadata.teaching})`, () => {
    const result = resolve(dayInput(kind));
    const output = resolveTodayEligibility(result, { date: '2026-10-04', today: '2026-10-04', activeTermId: 'imported:first' });
    assert.equal(output.ok, true);
    assert.equal(output.eligible, metadata.teaching);
    assert.equal(output.day.kind, kind);
  });
}

test('official holiday ranges include their endpoints and are selected-preset references', () => {
  const general = resolve(plain());
  const western = resolve({ ...plain(), presetId: W });
  for (const result of [general, western]) for (const range of result.preset.holidays) {
    for (const date of [range.startDate, range.endDate]) {
      const day = resolveCalendarDate(result, date);
      assert.equal(day.kind, range.kind);
      assert.equal(day.source, 'official');
      assert.equal(day.officialRangeId, `${result.preset.id}:${range.startDate}`);
    }
  }
  assert.equal(resolveCalendarDate(general, '2027-04-30').source, 'default');
  assert.equal(resolveCalendarDate(western, '2027-04-30').source, 'official');
  assert.equal(resolveCalendarDate(general, '2027-05-07').source, 'official');
});

test('weekends default non-teaching but explicit study/remote/exam/event days override them', () => {
  const empty = resolve(plain());
  assert.equal(resolveCalendarDate(empty, '2026-10-02').teaching, false);
  assert.equal(resolveCalendarDate(empty, '2026-10-03').teaching, false);
  assert.equal(resolveCalendarDate(empty, '2026-10-04').teaching, true);
  for (const kind of ['study', 'remote', 'exam', 'event']) {
    assert.equal(resolveCalendarDate(resolve(dayInput(kind, '2026-10-02')), '2026-10-02').teaching, true);
  }
});

test('eligibility uses inclusive effective bounds and the supplied active term', () => {
  const result = resolve(fixture());
  for (const [date, eligible] of [['2026-09-01', false], ['2026-09-02', true], ['2027-01-06', true], ['2027-01-07', false], ['2027-01-17', false]]) {
    assert.equal(resolveTodayEligibility(result, { date, today: date, activeTermId: 'imported:first' }).eligible, eligible, date);
  }
  assert.equal(resolveTodayEligibility(result, { date: '2027-01-17', today: '2027-01-17', activeTermId: 'imported:second' }).eligible, true);
});

test('past and future queries are ineligible and all stored representations remain unchanged', () => {
  const input = fixture();
  const stored = freeze({ sessions: [{ id: 'past', date: '2026-09-01', status: 'held' },
    { id: 'future', date: '2027-04-30', status: 'scheduled' }, { id: 'deleted', deleted: true }],
    attendance: [{ id: 'attendance:kept', sessionId: 'past', status: 'present' }],
    scores: [{ id: 'score:kept', value: 7 }], logs: [{ id: 'log:kept', note: 'synthetic' }],
    outbox: [{ id: 'pending:kept', state: 'pending' }], device: { activeTermId: 'imported:first' } });
  const before = JSON.stringify({ input, stored });
  for (const presetId of [G, W, G]) {
    const result = resolve({ ...input, presetId });
    for (const date of ['2026-09-01', '2027-04-30']) {
      assert.equal(resolveTodayEligibility(result, { date, today: '2026-10-04', activeTermId: stored.device.activeTermId }).reason, 'not-today');
    }
    suggestTermTransition(result, { date: '2027-01-17', activeTermId: stored.device.activeTermId });
  }
  assert.equal(JSON.stringify({ input, stored }), before);
});

test('extra/custom and deleted terms are retained verbatim; closed term status is never replaced by catalog status', () => {
  const input = plain();
  input.terms[0].status = 'closed';
  input.terms.push({ id: 'custom:third', yearId: input.year.id, index: 3, status: 'upcoming', startDate: '2027-08-01', endDate: '2027-08-12', note: 'kept' });
  input.terms.push({ id: 'deleted:first', yearId: input.year.id, index: 1, status: 'closed', deleted: true, startDate: '2025-01-01' });
  const result = resolve(input);
  assert.equal(result.terms[0].status, 'closed');
  assert.deepEqual(result.terms.slice(2), input.terms.slice(2));
  assert.equal(resolveTodayEligibility(result, { date: '2026-10-04', today: '2026-10-04', activeTermId: 'imported:first' }).reason, 'term-closed');
  assert.equal(suggestTermTransition(result, { date: '2027-01-17', activeTermId: 'imported:first' }).suggestion, null);
});

test('teacher-selected extra term uses its own stored bounds without a manufactured official mapping', () => {
  const input = plain();
  input.terms.push({ id: 'custom:third', yearId: input.year.id, index: 3, status: 'active', startDate: '2027-08-01', endDate: '2027-08-12' });
  const result = resolve(input);
  assert.equal(resolveTodayEligibility(result, { date: '2027-08-01', today: '2027-08-01', activeTermId: 'custom:third' }).eligible, true);
  assert.equal(result.terms[2].officialStartDate, undefined);
});

test('deleted scopes, exception rows and overrides are retained in input but never applied', () => {
  const input = fixture();
  input.customizations[0].termDateOverrides[0].deleted = true;
  input.customizations[0].exceptions[0].deleted = true;
  const before = structuredClone(input);
  const result = resolve(input);
  assert.equal(result.terms[0].startDate, '2026-08-23');
  assert.equal(resolveCalendarDate(result, '2026-10-04').kind, 'study');
  input.customizations[1].deleted = true;
  assert.equal(resolve({ ...input, presetId: W }).terms[0].startDate, '2026-08-30');
  assert.deepEqual(input.customizations[0], before.customizations[0]);
});

test('outputs cannot mutate inputs, inactive scopes or the shared official catalog', () => {
  const input = freeze(fixture());
  const before = JSON.stringify(input);
  const catalogBefore = JSON.stringify(CALENDAR_PRESETS);
  const result = resolve(input);
  result.year.id = 'changed'; result.terms[0].id = 'changed'; result.exceptions[0].kind = 'holiday';
  result.preset.terms[0].startDate = 'changed'; result.preset.holidays[0].label = 'changed';
  assert.equal(JSON.stringify(input), before);
  assert.equal(JSON.stringify(CALENDAR_PRESETS), catalogBefore);
  assert.equal(resolve(input).terms[0].id, 'imported:first');
});

test('explicit unknown/missing preset and mismatched/deleted year fail instead of defaulting', () => {
  for (const presetId of [undefined, null, '', 'western', 'unknown']) {
    assert.deepEqual(resolveCalendarRuntime({ ...plain(), presetId }), { ok: false, reason: 'unsupported-preset' });
  }
  assert.equal(resolveCalendarRuntime({ ...plain(), year: { ...plain().year, hijriStart: 1447 } }).reason, 'preset-year-mismatch');
  assert.equal(resolveCalendarRuntime({ ...plain(), year: { ...plain().year, deleted: true } }).reason, 'invalid-year');
  assert.equal(resolveCalendarRuntime({ ...plain(), year: null }).reason, 'invalid-year');
});

test('missing/deleted/duplicate/ambiguous/foreign-year term identities are rejected', () => {
  const changes = [
    [terms => terms.pop(), 'missing-official-term'],
    [terms => { terms[1].deleted = true; }, 'missing-official-term'],
    [terms => { terms[1].id = terms[0].id; }, 'duplicate-term-id'],
    [terms => terms.push({ ...terms[0], id: 'other:first' }), 'ambiguous-official-term'],
    [terms => { terms[1].yearId = 'other:year'; }, 'invalid-terms'],
    [terms => { terms[1].index = '2'; }, 'invalid-terms'],
  ];
  for (const [change, expected] of changes) {
    const input = plain(); change(input.terms);
    assert.equal(resolveCalendarRuntime(input).reason, expected);
  }
});

test('unknown/unscoped/duplicate customization ownership returns errors, without an adoption workflow', () => {
  const input = fixture();
  assert.equal(resolveCalendarRuntime({ ...input, customizations: [{}] }).reason, 'unscoped-customization');
  assert.equal(resolveCalendarRuntime({ ...input, customizations: [{ yearId: input.year.id, presetId: 'future' }] }).reason, 'unsupported-customization-preset');
  assert.equal(resolveCalendarRuntime({ ...input, customizations: [input.customizations[0], input.customizations[0]] }).reason, 'ambiguous-customization-scope');
});

test('bad/unknown/ambiguous/manual extra-term overrides fail closed', () => {
  for (const [overrides, reason] of [
    [[{ termId: 'unknown', startDate: '2026-09-01', endDate: '2027-01-06' }], 'unknown-override-term'],
    [[{ termId: 'imported:first', startDate: '2027-02-29', endDate: '2027-03-01' }], 'invalid-term-bounds'],
    [[{ termId: 'imported:first', startDate: '2027-01-07', endDate: '2026-09-01' }], 'invalid-term-bounds'],
    [[{ termId: 'imported:first', startDate: '2026-09-01', endDate: '2027-01-17' }], 'overlapping-official-terms'],
  ]) {
    const input = fixture(); input.customizations[0].termDateOverrides = overrides;
    assert.equal(resolveCalendarRuntime(input).reason, reason);
  }
  const duplicate = fixture(); duplicate.customizations[0].termDateOverrides.push(duplicate.customizations[0].termDateOverrides[0]);
  assert.equal(resolveCalendarRuntime(duplicate).reason, 'ambiguous-term-override');
  const extra = fixture(); extra.terms.push({ id: 'extra', yearId: extra.year.id, index: 3, status: 'upcoming' });
  extra.customizations[0].termDateOverrides.push({ termId: 'extra', startDate: '2027-08-01', endDate: '2027-08-10' });
  assert.equal(resolveCalendarRuntime(extra).ok, true);
});

test('bad/unknown/ambiguous exception data does not silently win', () => {
  for (const [patch, reason] of [[{ kind: 'future-kind' }, 'invalid-exception'], [{ date: '2027-02-29' }, 'invalid-exception'], [{ id: '' }, 'invalid-exception']]) {
    const input = fixture(); Object.assign(input.customizations[0].exceptions[0], patch);
    assert.equal(resolveCalendarRuntime(input).reason, reason);
  }
  const input = fixture(); input.customizations[0].exceptions.push({ ...input.customizations[0].exceptions[0], id: 'other' });
  assert.equal(resolveCalendarRuntime(input).reason, 'ambiguous-exception-date');
  input.customizations[0].exceptions[1].id = input.customizations[0].exceptions[0].id;
  assert.equal(resolveCalendarRuntime(input).reason, 'duplicate-exception-id');
});

test('date/context APIs reject malformed dates, invalid resolutions and unknown active terms', () => {
  const result = resolve(plain());
  for (const date of [undefined, '2027-02-29', '2026-13-01', '2026-10-4', '2026-10-04T00:00:00Z']) {
    assert.equal(resolveCalendarDate(result, date).reason, 'invalid-date');
    assert.equal(resolveTodayEligibility(result, { date, today: '2026-10-04', activeTermId: 'imported:first' }).ok, false);
    assert.equal(suggestTermTransition(result, { date, activeTermId: 'imported:first' }).ok, false);
  }
  assert.equal(resolveCalendarDate({ ok: false }, '2026-10-04').reason, 'invalid-calendar');
  assert.equal(resolveTodayEligibility(result, { date: '2026-10-04', today: '2026-10-04', activeTermId: 'unknown' }).reason, 'invalid-active-term');
  assert.equal(suggestTermTransition(result, { date: '2027-01-17', activeTermId: 'unknown' }).reason, 'invalid-active-term');
});

test('null or non-record API inputs return explicit invalid results rather than throwing', () => {
  const result = resolve(plain());
  for (const bad of [null, [], 'not a record', 0]) {
    assert.equal(resolveCalendarRuntime(bad).reason, 'invalid-input');
    assert.equal(resolveTodayEligibility(result, bad).reason, 'invalid-context');
    assert.equal(suggestTermTransition(result, bad).reason, 'invalid-context');
    assert.equal(resolveRecordedSessionPresentation(bad).reason, 'invalid-session');
  }
});

test('nested customization metadata cannot contradict its explicit preset/year scope', () => {
  for (const target of ['exceptions', 'termDateOverrides']) {
    for (const metadata of [{ presetId: W }, { yearId: 'other:year' }]) {
      const input = fixture(); Object.assign(input.customizations[0][target][0], metadata);
      assert.equal(resolveCalendarRuntime(input).reason, 'customization-scope-mismatch');
    }
  }
});

test('term-start suggestion follows effective second-term start and never changes activation', () => {
  const input = fixture();
  input.customizations[0].termDateOverrides.push({ termId: 'imported:second', startDate: '2027-01-19', endDate: '2027-06-24' });
  const result = freeze(resolve(input));
  const options = freeze({ date: '2027-01-19', activeTermId: 'imported:first' });
  assert.equal(suggestTermTransition(result, { ...options, date: '2027-01-18' }).suggestion, null);
  assert.deepEqual(suggestTermTransition(result, options).suggestion, {
    fromTermId: 'imported:first', toTermId: 'imported:second', message: 'الفصل الدراسي الثاني بدأ',
    activateLabel: 'تفعيل الفصل الدراسي الثاني', laterLabel: 'لاحقًا',
  });
  assert.equal(options.activeTermId, 'imported:first');
  assert.equal(suggestTermTransition(result, { ...options, activeTermId: 'imported:second' }).suggestion, null);
  assert.equal(input.terms[1].status, 'upcoming');
});

test('closed second term does not offer activation', () => {
  const input = plain(); input.terms[1].status = 'closed';
  assert.equal(suggestTermTransition(resolve(input), { date: '2027-01-17', activeTermId: 'imported:first' }).suggestion, null);
});

test('recorded historical suspension presentation survives a different selected Calendar', () => {
  const session = freeze({ id: 'old:session', status: 'cancelled_holiday', reason: 'إجازة قديمة',
    calendarContext: { kind: 'suspension', label: 'تعليق محفوظ', presetId: G, source: 'custom' } });
  const before = JSON.stringify(session);
  const expected = resolveRecordedSessionPresentation(session);
  assert.equal(expected.label, CALENDAR_KIND.suspension.label);
  assert.equal(expected.reason, 'تعليق محفوظ');
  for (const presetId of [G, W, G]) {
    resolve({ ...plain(), presetId });
    assert.deepEqual(resolveRecordedSessionPresentation(session), expected);
  }
  expected.calendarContext.kind = 'holiday';
  assert.equal(JSON.stringify(session), before);
});

test('unrecorded history keeps stored status/reason; current suspension cannot manufacture historical provenance', () => {
  const current = resolveCalendarDate(resolve(dayInput('suspension')), '2026-10-04');
  assert.equal(current.kind, 'suspension');
  const result = resolveRecordedSessionPresentation({ status: 'cancelled_holiday', reason: 'historical reason' });
  assert.equal(result.label, SESSION_STATUS.cancelled_holiday.label);
  assert.equal(result.reason, 'historical reason');
  assert.equal(result.calendarContext, null);
  assert.equal(result.provenance, 'unrecorded');
});

test('recorded Calendar context never cancels or changes another stored session status', () => {
  for (const status of Object.keys(SESSION_STATUS).filter(x => x !== 'cancelled_holiday')) {
    const result = resolveRecordedSessionPresentation({ status, reason: 'retained', calendarContext: { kind: 'suspension' } });
    assert.equal(result.label, SESSION_STATUS[status].label);
    assert.equal(result.reason, 'retained');
    assert.equal(result.counts, SESSION_STATUS[status].counts);
  }
  assert.equal(resolveRecordedSessionPresentation({ status: 'unknown' }).reason, 'invalid-session');
  assert.equal(resolveRecordedSessionPresentation({ status: 'held', calendarContext: { kind: 'unknown' } }).reason, 'invalid-recorded-context');
});

test('pure resolver depends only on catalog/models and supplies no factories, clock, network or persistence operations', () => {
  const source = readFileSync(new URL('../src/lib/calendar-runtime.js', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/^import .+ from '([^']+)'/gm)].map(x => x[1]), ['./calendar-presets.js', '../models.js']);
  assert.doesNotMatch(source, /\b(?:fetch|indexedDB|localStorage|Date\.now|Math\.random|makeYear|makeTerm|makeSession|calendarPresetRecords)\s*\(/);
  assert.doesNotMatch(source, /(?:store|cloud|sync|db)\.js/);
});


test('inactive extra-term scope rejects inclusive overlap without mutating input', () => {
  const input = fixture();
  input.terms.push({ id: 'extra:third', yearId: input.year.id, index: 3, status: 'upcoming' });
  input.customizations[1].termDateOverrides.push({ termId: 'extra:third', startDate: '2027-07-01', endDate: '2027-07-05' });
  const before = JSON.stringify(input);
  assert.deepEqual(resolveCalendarRuntime(input), { ok: false, reason: 'overlapping-term-bounds' });
  assert.equal(JSON.stringify(input), before);
});
