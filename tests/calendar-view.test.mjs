import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

global.document = {
  documentElement: {
    setAttribute() {},
    removeAttribute() {},
    classList: { add() {}, remove() {} },
  },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });

test('Calendar Academic Time Control Center view renders all key information correctly', async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();

  const calendarView = (await import('../src/views/calendar.js')).default;
  const htmlResult = calendarView.render();
  assert.ok(htmlResult, 'Render result must not be null/undefined');
  const rendered = htmlResult.value || String(htmlResult);

  // 1. شريط الاعتماد وسياق المنطقة وتوحيد الهوية
  assert.ok(rendered.includes('calendar-identity__text'), 'Must include approved Calendar identity');
  assert.ok(rendered.includes('التقويم المعتمد'), 'Must include التقويم المعتمد badge');
  assert.ok(rendered.includes('تقويم مكة المكرمة') || rendered.includes('تقويم جميع مناطق المملكة'), 'Must include clear official preset title');

  // التحقق من زر الإعدادات الوحيد وإجراء الإضافة الوحيد
  const topActionsHtml = String(calendarView.topActions?.()?.value || calendarView.topActions?.() || '');
  assert.ok(!topActionsHtml.includes('open-settings'), 'Top actions must NOT contain duplicate settings button');
  assert.ok(!topActionsHtml.includes('data-act="add"'), 'Top actions must NOT contain add action');
  assert.ok(rendered.includes('data-act="add"'), 'Periods section header must contain the single main add action');
  assert.ok(rendered.includes('data-act="open-settings"'), 'Hero strip must contain the kept settings button');

  // 2. رادار الزمن الدراسي: أين نحن الآن ومسار التقدم
  assert.ok(rendered.includes('أين نحن الآن؟'), 'Must include أين نحن الآن؟');
  assert.ok(rendered.includes('timeline-track'), 'Must include visual progress track');
  assert.ok(rendered.includes('الأيام المتبقية'), 'Must include remaining days metric');
  assert.ok(rendered.includes('الأيام المنقضية'), 'Must include elapsed days metric');
  assert.ok(rendered.includes('نسبة الإنجاز الزمني'), 'Must include progress percentage');

  // 3. الإجازة القادمة والصياغة السليمة
  assert.ok(rendered.includes('المحطة القادمة'), 'Must include next milestone card');

  // 4. التبديل الحي بين التقويمين وتحديث العرض
  const { GENERAL_1448_1449_PRESET_ID } = await import('../src/lib/calendar-presets.js');
  await store.applyCalendarPreset(GENERAL_1448_1449_PRESET_ID);
  const generalRendered = String(calendarView.render()?.value || calendarView.render());
  assert.ok(generalRendered.includes('تقويم جميع مناطق المملكة'), 'Must render General preset title after switch');
  assert.ok(generalRendered.includes('جميع المناطق ما عدا إدارات التعليم المستثناة'), 'Must render General preset subtitle');

  // 4. شبكة الفصول الدراسية وتعديل التواريخ
  assert.ok(rendered.includes('الفصول الدراسية'), 'Must include terms section');
  assert.ok(rendered.includes('الفصل الدراسي الأول'), 'Must render Term 1');
  assert.ok(rendered.includes('الفصل الدراسي الثاني'), 'Must render Term 2');
  assert.ok(rendered.includes('تعديل'), 'Must include term edit button');

  // 5. المخطط الزمني للفترات والإجازات وأزرار التصفية
  assert.ok(rendered.includes('الإجازات والفترات الدراسية'), 'Must include periods section');
  assert.ok(rendered.includes('holiday-list'), 'Must include periods list');
  assert.ok(store.calendarRangesOf().some((range) => range.label === 'إجازة اليوم الوطني'), 'Official holiday remains in Calendar data');
  assert.ok(rendered.includes('data-filter="upcoming"'), 'Must include upcoming filter');
  assert.ok(rendered.includes('رسمية معتمدة'), 'Must distinguish official from local exceptions');
});

test('affected preview includes sessions plus ungenerated slots only in their own year and term', async () => {
  await db.clearAll(); store.state.ready = false; await store.init();
  const { getAffectedSchedule, default: calendarView } = await import('../src/views/calendar.js');
  const [first, second] = store.termsOf(store.activeYear().id);
  await store.save({
    teachings: [
      { id: 'tch:preview-current', termId: first.id, deleted: false },
      { id: 'tch:preview-future', termId: second.id, deleted: false },
      { id: 'tch:preview-old', termId: 'term:another-year', deleted: false },
    ],
    slots: [
      { id: 'sl:preview-1', teachingId: 'tch:preview-current', weekday: 3, period: 1, deleted: false },
      { id: 'sl:preview-2', teachingId: 'tch:preview-current', weekday: 3, period: 2, deleted: false },
      { id: 'sl:preview-future', teachingId: 'tch:preview-future', weekday: 3, period: 3, deleted: false },
    ],
    sessions: [
      { id: 'se:preview-current', teachingId: 'tch:preview-current', date: '2026-09-23', period: 1, deleted: false },
      { id: 'se:preview-old', teachingId: 'tch:preview-old', date: '2026-09-23', period: 4, deleted: false },
    ],
  });
  const before = await db.getAll('sessions');
  const affected = getAffectedSchedule('2026-09-23', '2026-09-26');
  assert.deepEqual(affected.map(({ id, type }) => [id, type]), [['se:preview-current', 'session'], ['sl:preview-2', 'slot']]);
  assert.deepEqual(await db.getAll('sessions'), before, 'Preview must be read-only');
  assert.ok(store.calendarRangesOf().some((range) => range.startDate <= '2026-09-23' && range.endDate >= '2026-09-23' && range.source?.startsWith('preset:')), 'National Day retains official range identity');
  assert.ok(calendarView.render().value.includes('data-filter="upcoming"'), 'Default Calendar filter remains upcoming');
});

test('Calendar gracefully handles empty year without terms and validates activation', async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();

  const { default: calendarView, hasValidYearCalendarConfig } = await import('../src/views/calendar.js');
  const { makeYear, makeTerm } = await import('../src/models.js');

  // إنشاء سنة دراسية جديدة بدون فصول (1449)
  const emptyYear = makeYear({ hijriStart: 1449, label: '1449 / 1450 هـ' });
  await store.save({ years: [emptyYear] });

  // التحقق من أن السنة الفارغة غير صالحة للتفعيل
  assert.equal(hasValidYearCalendarConfig(emptyYear.id), false, 'Empty year with 0 terms must be invalid');

  // إذا أضيفت فصول ولكن بدون تواريخ بداية ونهاية
  const termNoDates = makeTerm({ yearId: emptyYear.id, index: 1, status: 'active' });
  await store.save({ terms: [termNoDates] });
  assert.equal(hasValidYearCalendarConfig(emptyYear.id), false, 'Year with term lacking dates must be invalid');

  // تفعيل السنة قسراً في الجهاز لمحاكاة حالة تالفة والتأكد أن العرض لا ينهار إطلاقاً
  await store.patchDevice({ activeYearId: emptyYear.id, activeTermId: termNoDates.id });

  assert.doesNotThrow(() => {
    const rendered = calendarView.render();
    const renderedHtml = rendered.value || String(rendered);
    assert.ok(renderedHtml.includes('calendar-terms'), 'Must render gracefully');
  }, 'Calendar rendering must never crash on empty or unconfigured terms');

  // استعادة سنة صالحة
  const validYear = store.years().find(y => y.id !== emptyYear.id);
  if (validYear) {
    assert.equal(hasValidYearCalendarConfig(validYear.id), true, 'Official configured year must be valid');
    await store.patchDevice({ activeYearId: validYear.id });
  }

  store.closeChannel();
  db.closeDB();
});
