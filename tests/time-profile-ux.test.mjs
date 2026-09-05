import test from 'node:test';
import assert from 'node:assert';
import { normalizeTimeDigits, html, raw } from '../src/lib/dom.js';
import { GRADE_CATALOG, generateAdvancedPeriods, isValidRecessPosition, recessPositions } from '../src/models.js';

test('normalizeTimeDigits forces ASCII Western digits and HH:MM format', () => {
  assert.strictEqual(normalizeTimeDigits('٠٧:٣٠'), '07:30');
  assert.strictEqual(normalizeTimeDigits('٠٦:٤٥'), '06:45');
  assert.strictEqual(normalizeTimeDigits('7:00'), '07:00');
  assert.strictEqual(normalizeTimeDigits('0700'), '07:00');
  assert.strictEqual(normalizeTimeDigits(' 12:45 '), '12:45');
  assert.strictEqual(normalizeTimeDigits('invalid'), '');
});

test('GRADE_CATALOG covers all 12 Saudi educational levels cleanly', () => {
  assert.strictEqual(GRADE_CATALOG.length, 12);
  const primary = GRADE_CATALOG.filter(g => g.stage === 'ابتدائي');
  const middle = GRADE_CATALOG.filter(g => g.stage === 'متوسط');
  const secondary = GRADE_CATALOG.filter(g => g.stage === 'ثانوي');

  assert.strictEqual(primary.length, 6);
  assert.strictEqual(middle.length, 3);
  assert.strictEqual(secondary.length, 3);

  // Verify labels are clean strings, no objects
  for (const item of GRADE_CATALOG) {
    assert.strictEqual(typeof item.v, 'number');
    assert.strictEqual(typeof item.label, 'string');
    assert.ok(!item.label.includes('[object Object]'));
  }
});

test('generateAdvancedPeriods supports optional recess (zero recess if disabled)', () => {
  const noRecessConfig = {
    firstPeriodStart: '07:00',
    periodDuration: 45,
    count: 7,
    gap: 0,
    recess: { enabled: false }
  };

  const periods = generateAdvancedPeriods(noRecessConfig);
  assert.strictEqual(periods.length, 7);
  // Periods should be completely contiguous
  for (let i = 1; i < periods.length; i++) {
    assert.strictEqual(periods[i].start, periods[i - 1].end, `Period ${i + 1} start must equal Period ${i} end`);
  }
});

test('recess placement is limited to boundaries between existing periods', async () => {
  assert.deepStrictEqual(recessPositions(1), []);
  assert.deepStrictEqual(recessPositions(4), [1, 2, 3]);
  assert.strictEqual(isValidRecessPosition(0, 4), false);
  assert.strictEqual(isValidRecessPosition(-1, 4), false);
  assert.strictEqual(isValidRecessPosition(4, 4), false);
  assert.strictEqual(isValidRecessPosition(2, 4), true);

  const config = {
    firstPeriodStart: '07:00', periodDuration: 45, count: 4, gap: 0,
    recess: { enabled: true, afterPeriod: 0, duration: 20, transition: 0 },
  };
  const periods = generateAdvancedPeriods(config);
  assert.deepStrictEqual(periods.map((period) => period.start), ['07:00', '07:45', '08:30', '09:15']);

  const { reflowPeriodsWithRecess } = await import('../src/views/times.js');
  const basePeriods = periods.map((period) => ({ ...period }));
  const reflowed = reflowPeriodsWithRecess(basePeriods, { afterPeriod: -1, recessDuration: 20 });
  assert.deepStrictEqual(reflowed.map((period) => period.start), ['07:00', '07:45', '08:30', '09:15']);
});

test('html and raw template rendering never yields [object Object] during interpolation or string conversion', () => {
  const inner = html`<div class="inner">محتوى تجريبي</div>`;
  // Test raw object toString()
  assert.strictEqual(String(inner), '<div class="inner">محتوى تجريبي</div>');
  assert.ok(!String(inner).includes('[object Object]'));

  // Test template interpolation of another html template
  const outer = html`<div class="outer">${inner}</div>`;
  assert.strictEqual(outer.value, '<div class="outer"><div class="inner">محتوى تجريبي</div></div>');
  assert.strictEqual(String(outer), '<div class="outer"><div class="inner">محتوى تجريبي</div></div>');
  assert.ok(!outer.value.includes('[object Object]'));
});

test('timing profile duplicate name check rejects profiles with identical names (case-insensitive and trimmed)', () => {
  const existingProfiles = [
    { id: 'tp-1', name: 'التوقيت الصيفي' },
    { id: 'tp-2', name: 'توقيت رمضان' }
  ];

  const isDuplicate = (name, currentId = null) => {
    const clean = name.trim().toLowerCase();
    return existingProfiles.some(p => p.id !== currentId && p.name.trim().toLowerCase() === clean);
  };

  assert.strictEqual(isDuplicate('التوقيت الصيفي'), true);
  assert.strictEqual(isDuplicate(' التوقيت الصيفي '), true);
  assert.strictEqual(isDuplicate('توقيت رمضان'), true);
  assert.strictEqual(isDuplicate('التوقيت الشتوي'), false);
  // Editing existing profile with its own name should not trigger duplicate
  assert.strictEqual(isDuplicate('التوقيت الصيفي', 'tp-1'), false);
});

test('reflowPeriodsWithRecess correctly inserts recess at requested period and shifts subsequent periods', async () => {
  const { reflowPeriodsWithRecess } = await import('../src/views/times.js');
  const basePeriods = [
    { period: 1, start: '07:00', end: '07:45' },
    { period: 2, start: '07:45', end: '08:30' },
    { period: 3, start: '08:30', end: '09:15' },
    { period: 4, start: '09:15', end: '10:00' },
  ];

  // Insert recess after period 2, duration 20 mins, transition 5 mins = 25 mins total
  const withRecess = reflowPeriodsWithRecess(basePeriods, { afterPeriod: 2, recessDuration: 20, transition: 5 });
  assert.strictEqual(withRecess.length, 4);
  assert.strictEqual(withRecess[0].start, '07:00');
  assert.strictEqual(withRecess[0].end, '07:45');
  assert.strictEqual(withRecess[1].start, '07:45');
  assert.strictEqual(withRecess[1].end, '08:30');

  // Period 3 must now start at 08:30 + 25 mins = 08:55 and end at 09:40
  assert.strictEqual(withRecess[2].start, '08:55');
  assert.strictEqual(withRecess[2].end, '09:40');

  // Period 4 must start at 09:40 and end at 10:25
  assert.strictEqual(withRecess[3].start, '09:40');
  assert.strictEqual(withRecess[3].end, '10:25');

  // Remove recess (afterPeriod: 0) -> should revert to contiguous
  const noRecess = reflowPeriodsWithRecess(withRecess, { afterPeriod: 0 });
  assert.strictEqual(noRecess[2].start, '08:30');
  assert.strictEqual(noRecess[2].end, '09:15');
  assert.strictEqual(noRecess[3].start, '09:15');
  assert.strictEqual(noRecess[3].end, '10:00');
});

test('getProfileModels produces independent model objects with isolated periods', async () => {
  const { getProfileModels } = await import('../src/views/times.js');
  const profileWithModels = {
    id: 'tp-multi',
    name: 'توقيت الصيفي بنموذجين',
    periods: [
      { period: 1, start: '07:00', end: '07:45', grades: [1, 2, 3] },
      { period: 2, start: '07:45', end: '08:30', grades: [1, 2, 3] },
      { period: 1, start: '07:00', end: '07:45', grades: [4, 5, 6] },
      { period: 2, start: '07:45', end: '08:30', grades: [4, 5, 6] },
    ],
    overrides: {
      models: [
        {
          id: 'm1',
          name: 'الصفوف الأولية',
          grades: [1, 2, 3],
          gradesLabel: 'الصفوف 1-3',
          afterPeriod: 2,
          recessDuration: 20,
          periods: [
            { period: 1, start: '07:00', end: '07:45' },
            { period: 2, start: '07:45', end: '08:30' },
            { period: 3, start: '08:50', end: '09:35' },
          ]
        },
        {
          id: 'm2',
          name: 'الصفوف العليا',
          grades: [4, 5, 6],
          gradesLabel: 'الصفوف 4-6',
          afterPeriod: 3,
          recessDuration: 25,
          periods: [
            { period: 1, start: '07:00', end: '07:45' },
            { period: 2, start: '07:45', end: '08:30' },
            { period: 3, start: '08:30', end: '09:15' },
            { period: 4, start: '09:40', end: '10:25' },
          ]
        }
      ]
    }
  };

  const models = getProfileModels(profileWithModels);
  assert.strictEqual(models.length, 2);
  assert.strictEqual(models[0].id, 'm1');
  assert.strictEqual(models[1].id, 'm2');

  // Verifying modifying model 2 does not affect model 1
  models[1].periods[0].start = '07:15';
  assert.strictEqual(models[0].periods[0].start, '07:00');
  assert.strictEqual(models[1].periods[0].start, '07:15');
  models[0].grades.push(12);
  assert.deepStrictEqual(profileWithModels.overrides.models[0].grades, [1, 2, 3]);
});

test('schedule label helpers formatSectionDisplay and shortClassLabel eliminate duplicate grade text', async () => {
  const { formatSectionDisplay, shortClassLabel } = await import('../src/views/schedule.js');

  // When grade is 5 and section name already contains 'الخامس' or 'خامس', grade prefix is cleanly stripped
  assert.strictEqual(formatSectionDisplay(5, 'خامس / أ'), 'أ');
  assert.strictEqual(formatSectionDisplay(5, 'خامس/أ'), 'أ');
  assert.strictEqual(formatSectionDisplay(5, 'الخامس / أ'), 'أ');
  assert.strictEqual(formatSectionDisplay(5, 'الخامس أ'), 'أ');

  // When grade is 5 and section name is just 'أ' or '1'
  assert.strictEqual(formatSectionDisplay(5, 'أ'), 'أ');
  assert.strictEqual(formatSectionDisplay(5, '1'), '1');

  // When no grade is provided, keep original string
  assert.strictEqual(formatSectionDisplay(null, 'خامس / ب'), 'خامس / ب');

  // shortClassLabel with full section object produces concise grade/section label without duplication
  assert.strictEqual(shortClassLabel({ grade: 4, name: 'رابع / أ' }), 'رابع/أ');
  assert.strictEqual(shortClassLabel({ grade: 4, name: 'أ' }), 'رابع/أ');
  assert.strictEqual(shortClassLabel({ grade: 4, name: 'الرابع / ب' }), 'رابع/ب');
  assert.strictEqual(shortClassLabel({ grade: 7, name: 'أول متوسط / 1' }), 'أول متوسط/1');
});

test('timing profile persistence stores multiple models and restores them seamlessly', async () => {
  const { getProfileModels } = await import('../src/views/times.js');

  // Simulate models created in UI
  const uiModels = [
    {
      id: 'm1',
      name: 'نموذج 1',
      grades: [1, 2, 3],
      gradesLabel: 'الصفوف الأولية',
      afterPeriod: 2,
      recessDuration: 20,
      recessTransition: 0,
      periods: [
        { period: 1, start: '07:00', end: '07:45' },
        { period: 2, start: '07:45', end: '08:30' },
        { period: 3, start: '08:50', end: '09:35' },
      ]
    },
    {
      id: 'm2',
      name: 'نموذج 2',
      grades: [4, 5, 6],
      gradesLabel: 'الصفوف العليا',
      afterPeriod: 3,
      recessDuration: 25,
      recessTransition: 5,
      periods: [
        { period: 1, start: '07:00', end: '07:45' },
        { period: 2, start: '07:45', end: '08:30' },
        { period: 3, start: '08:30', end: '09:15' },
        { period: 4, start: '09:45', end: '10:30' },
      ]
    }
  ];

  // Save payload structure generated by sheet-btn-save-all:
  const flatPeriods = [];
  for (const m of uiModels) {
    for (const pItem of m.periods) {
      flatPeriods.push({
        ...pItem,
        grades: m.grades
      });
    }
  }

  const savedProfile = {
    id: 'tp-test',
    name: 'التوقيت الصيفي',
    periods: flatPeriods,
    overrides: {
      models: uiModels.map(m => ({
        id: m.id,
        name: m.name,
        grades: m.grades,
        gradesLabel: m.gradesLabel,
        afterPeriod: m.afterPeriod,
        recessDuration: m.recessDuration,
        recessTransition: m.recessTransition,
        periods: m.periods.map(x => ({ ...x }))
      }))
    }
  };

  // Re-open/reload profile
  const restoredModels = getProfileModels(savedProfile);
  assert.strictEqual(restoredModels.length, 2);
  assert.strictEqual(restoredModels[0].name, 'نموذج 1');
  assert.deepStrictEqual(restoredModels[0].grades, [1, 2, 3]);
  assert.strictEqual(restoredModels[0].afterPeriod, 2);
  assert.strictEqual(restoredModels[0].periods.length, 3);
  assert.strictEqual(restoredModels[0].periods[2].start, '08:50');

  assert.strictEqual(restoredModels[1].name, 'نموذج 2');
  assert.deepStrictEqual(restoredModels[1].grades, [4, 5, 6]);
  assert.strictEqual(restoredModels[1].afterPeriod, 3);
  assert.strictEqual(restoredModels[1].periods.length, 4);
  assert.strictEqual(restoredModels[1].periods[3].start, '09:45');
});

test('getProfileModels normalizes system default names to "نموذج 1" and "نموذج 2" without overwriting custom names', async () => {
  const { getProfileModels } = await import('../src/views/times.js');

  // Legacy rules without custom model names
  const legacyProfile = {
    id: 'legacy-1',
    name: 'توقيت تجريبي',
    overrides: {
      config: {
        recess: {
          rules: [
            { grades: [4], afterPeriod: 2, duration: 20 },
            { grades: [5, 6], afterPeriod: 3, duration: 20 }
          ]
        }
      }
    }
  };

  const models = getProfileModels(legacyProfile);
  assert.strictEqual(models.length, 2);
  assert.strictEqual(models[0].name, 'نموذج 1');
  assert.strictEqual(models[1].name, 'نموذج 2');

  // Custom teacher names are preserved
  const customProfile = {
    id: 'custom-1',
    name: 'توقيت خاص',
    overrides: {
      models: [
        { id: 'm1', name: 'الصفوف الأولية', grades: [1, 2, 3], periods: [] },
        { id: 'm2', name: 'الصفوف العليا', grades: [4, 5, 6], periods: [] }
      ]
    }
  };

  const customModels = getProfileModels(customProfile);
  assert.strictEqual(customModels[0].name, 'الصفوف الأولية');
  assert.strictEqual(customModels[1].name, 'الصفوف العليا');
});

test('model toolbar, recess row, and input centering adhere to strict UX constraints', async () => {
  const fs = await import('node:fs');
  const timesCode = fs.readFileSync(new URL('../src/views/times.js', import.meta.url), 'utf8');
  const compCss = fs.readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
  const appCss = fs.readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');

  // 1. Model Toolbar: .models-tabs is separate from .models-bar__actions
  assert.ok(timesCode.includes('<div class="models-tabs">'), 'must have separate models-tabs wrapper');
  assert.ok(timesCode.includes('<div class="models-bar__actions">'), 'must have separate models-bar__actions cluster');
  assert.ok(!timesCode.includes('models-bar__btn-label'), 'no text label in models-bar actions (icon-only desktop and mobile)');

  // CSS: .models-tabs has overflow-x: auto and .models-bar does NOT have overflow-x: auto
  const modelsTabsCss = compCss.match(/\.models-tabs\s*\{([^}]*)\}/)?.[1] ?? '';
  const modelsBarCss = compCss.match(/\.models-bar\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(modelsTabsCss, /overflow-x:\s*auto/, 'models-tabs must have overflow-x: auto');
  assert.doesNotMatch(modelsBarCss, /overflow-x:\s*auto/, 'models-bar must NOT scroll actions');

  // 2. Recess actions: icon-only on desktop and mobile, delete has danger styling
  assert.ok(!timesCode.includes('recess-btn-label'), 'no text label in recess-edit-btn (icon-only desktop and mobile)');
  assert.match(compCss, /\.recess-del-btn\s*\{[\s\S]*?color:\s*var\(--danger\)\s*!important;/, 'recess-del-btn must have danger color !important');

  // 3. Compact numeric input centering
  assert.ok(compCss.includes('.input--center'), 'components.css must define .input--center');
  assert.ok(compCss.includes('text-align: center !important;'), 'must declare text-align: center !important');
  assert.ok(appCss.includes('.input--center'), 'app.css must define .input--center');

  // 4. Shortened centered recess summary (no redundant 'بعد الحصة X')
  assert.ok(!timesCode.includes('بعد الحصة ${prev.period}'), 'must NOT include redundant "بعد الحصة X" in recess summary');
  assert.ok(timesCode.includes('<span class="recess-sep" aria-hidden="true">·</span>'), 'must include dot separator');
  assert.ok(compCss.includes('justify-content: center;'), 'recess-info must be visually centered');
});
