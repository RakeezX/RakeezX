import { test, expect } from '@playwright/test';

async function seedClass(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  return page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'ميثاق', color: '#18A878' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    for (let index = 1; index <= 24; index += 1) {
      await window.store.addStudent(section.id, `طالب الميثاق ${index}`, { rollNo: index });
    }
    return teaching.id;
  });
}

test('class goal and charter flow persists its timer/selection and previews an explicit atomic reward', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixedNow = new Date('2026-09-09T07:00:00+03:00');
  await page.clock.install({ time: fixedNow });
  const teachingId = await seedClass(page);

  await page.goto(`/#/teaching/${encodeURIComponent(teachingId)}`);
  await expect(page.locator('.class-context-nav__item span')).toHaveText(['الفصل', 'الطلاب', 'الحضور', 'كشف الدرجات']);
  await expect(page.locator('.quick-tools-grid .tile__title')).toHaveText([
    'هدف وميثاق الصف', 'الرصد السريع', 'القرعة', 'المجموعات',
    'لوحة التميز', 'الحصص', 'التقارير', 'توزيع الدرجات',
  ]);
  await expect(page.getByRole('link', { name: /هدف وميثاق الصف/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /الحصص السجل والحصص السابقة/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.quick-tools-grid')).toHaveCSS('grid-template-columns', /.+ .+/);
  await expect(page.locator('.quick-tools-grid .tile').first()).toHaveCSS('min-height', '104px');
  await page.setViewportSize({ width: 1440, height: 900 });
  const toolCards = page.locator('.quick-tools-grid .class-tool-card');
  await expect(toolCards).toHaveCount(8);
  await expect(toolCards.first()).toHaveCSS('min-height', '134px');
  expect(await toolCards.evaluateAll((cards) => new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size)).toBe(1);
  await page.getByRole('link', { name: /هدف وميثاق الصف/ }).click();

  await expect(page.getByRole('heading', { name: 'الهدف الرئيسي', exact: true })).toBeVisible();
  await expect(page.getByLabel('اختر هدف الحصة')).toHaveValue('نلتزم بقوانين الصف');
  await expect(page.locator('.class-rules-surface')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'مواثيق جاهزة' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ميثاق مخصص' })).toBeVisible();
  await expect(page.getByText('تضمين الهدف الرئيسي في العرض', { exact: true })).toHaveCount(0);
  await expect(page.getByText('الأولوية الآن', { exact: true })).toHaveCount(0);

  for (const width of [320, 390, 412, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await expect(page.locator('.lesson-goal')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `${width}px must not overflow horizontally`).toBe(false);
  }
  await expect(page.getByRole('heading', { name: 'ميثاق الصف', exact: true })).toBeInViewport();
  expect(await page.locator('.lesson-goal').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(230);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'ميثاق مخصص' }).click();
  await expect(page.locator('#modal-root').getByRole('button', { name: 'إضافة الميثاق' })).toBeVisible();
  await page.locator('#modal-root').getByRole('button', { name: 'إلغاء' }).click();
  await page.getByRole('button', { name: 'مواثيق جاهزة' }).click();
  await expect(page.locator('#modal-root').getByText('مواثيق جاهزة', { exact: true })).toBeVisible();
  const presetSheet = page.locator('#modal-root');
  const savePresets = presetSheet.getByRole('button', { name: 'حفظ الاختيارات', exact: true });
  await expect(savePresets).toBeDisabled();
  await presetSheet.locator('[data-preset-text="ارفع يدك قبل المشاركة"]').click();
  await presetSheet.locator('[data-preset-text="لا تقاطع المعلّم أو زملاءك"]').click();
  await expect(presetSheet.locator('.rule-preset.is-selected')).toHaveCount(2);
  await expect(presetSheet.locator('.rule-preset-group:not([hidden])').first().getByText('مختارة الآن', { exact: true })).toBeVisible();
  expect(await presetSheet.locator('[data-selected-presets] .rule-preset').evaluateAll((buttons) => buttons.map((button) => button.dataset.presetText))).toEqual([
    'لا تقاطع المعلّم أو زملاءك', 'ارفع يدك قبل المشاركة',
  ]);
  expect(await presetSheet.locator('[data-available-presets] .rule-preset.is-selected').count()).toBe(0);
  await expect(savePresets).toBeEnabled();
  await savePresets.click();
  await expect(page.getByText('لا تقاطع المعلّم أو زملاءك', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('لا تقاطع المعلّم أو زملاءك', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إزالة من العرض: لا تقاطع المعلّم أو زملاءك' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'إزالة من العرض: ارفع يدك قبل المشاركة' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'إزالة من العرض: لا تقاطع المعلّم أو زملاءك' }).click();
  await expect(page.getByRole('button', { name: 'تضمين في العرض: لا تقاطع المعلّم أو زملاءك' })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'عرض صفي', exact: true }).click();
  let presentation = page.locator('.classroom-presentation');
  await expect(presentation).toBeVisible();
  await expect(presentation.getByText('ارفع يدك قبل المشاركة', { exact: true })).toBeVisible();
  await expect(presentation.getByText('لا تقاطع المعلّم أو زملاءك', { exact: true })).toHaveCount(0);
  await expect(presentation.locator('.classroom-presentation__goal')).toHaveCount(0);
  await expect(presentation.locator('.classroom-presentation__timer')).toHaveCount(0);
  await expect(presentation.locator('.classroom-presentation__reward')).toHaveCount(0);
  await page.getByRole('button', { name: 'إنهاء العرض' }).click();

  await expect(page.getByPlaceholder('اكتب هدفًا قصيرًا وواضحًا')).toHaveCount(0);
  await expect(page.getByLabel('مدة مخصصة بالدقائق')).toHaveCount(0);
  await expect(page.getByLabel('قيمة مكافأة مخصصة')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const controlTops = () => page.evaluate(() => Object.fromEntries([
    ['goal', document.querySelector('[name="goalPreset"]')],
    ['duration', document.querySelector('[name="duration"]')],
    ['reward', document.querySelector('[name="reward"]')],
    ['start', document.querySelector('.goal-builder__start')],
  ].map(([key, element]) => [key, Math.round(element.getBoundingClientRect().top)])));
  const stableTops = await controlTops();
  await page.getByLabel('اختر هدف الحصة').selectOption('custom');
  await expect(page.getByPlaceholder('اكتب هدفًا قصيرًا وواضحًا')).toBeVisible();
  expect(await controlTops()).toEqual(stableTops);
  await page.getByPlaceholder('اكتب هدفًا قصيرًا وواضحًا').fill('نحافظ على وقت التعلّم');
  await page.getByLabel('المدة').selectOption('custom');
  await expect(page.getByLabel('مدة مخصصة بالدقائق')).toBeVisible();
  expect(await controlTops()).toEqual(stableTops);
  await page.getByLabel('مدة مخصصة بالدقائق').fill('12');
  await page.getByLabel('المكافأة').selectOption('custom');
  await expect(page.getByLabel('قيمة مكافأة مخصصة')).toBeVisible();
  expect(await controlTops()).toEqual(stableTops);
  await page.getByLabel('قيمة مكافأة مخصصة').fill('7');
  for (const width of [320, 390, 412, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await expect(page.getByLabel('الهدف المخصص')).toBeVisible();
    await expect(page.getByLabel('مدة مخصصة بالدقائق')).toBeVisible();
    await expect(page.getByLabel('قيمة مكافأة مخصصة')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${width}px custom controls must not overflow`).toBe(false);
  }
  await page.getByRole('button', { name: 'ابدأ الهدف' }).click();
  await expect(page.getByRole('heading', { name: 'نحافظ على وقت التعلّم' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('.goal-live__timer')).toHaveText('12:00');
  await page.getByRole('link', { name: 'رجوع', exact: true }).click();
  const activeGoalIndicator = page.getByRole('link', { name: 'الهدف النشط: نحافظ على وقت التعلّم' });
  await expect(activeGoalIndicator).toBeVisible();
  await expect(activeGoalIndicator.locator('.class-goal-indicator__timer')).toHaveText('12:00');
  await expect(activeGoalIndicator).toContainText('+7 مشاركة');
  await activeGoalIndicator.click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'نحافظ على وقت التعلّم' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('heading', { name: 'ميثاق الصف', exact: true })).toBeInViewport();
  expect(await page.locator('.lesson-goal').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(240);
  const timerBeforeTick = await page.locator('.goal-live__timer').textContent();
  await page.clock.runFor(1_100);
  const timerAfterTick = await page.locator('.goal-live__timer').textContent();
  const seconds = (value) => value.split(':').reduce((minutes, part) => minutes * 60 + Number(part), 0);
  expect(seconds(timerBeforeTick) - seconds(timerAfterTick)).toBeGreaterThanOrEqual(1);
  expect(seconds(timerBeforeTick) - seconds(timerAfterTick)).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: 'تم تحقيق الهدف' }).click();
  await expect(page.getByText('سيتم منح +7 لـ 24 طالبًا مؤهلًا', { exact: true })).toBeVisible();
  await expect(page.getByText('تُنفّذ المكافأة مرة واحدة بعد التأكيد.')).toBeVisible();
  await page.getByRole('button', { name: 'رجوع', exact: true }).click();

  await page.getByRole('button', { name: 'عرض صفي', exact: true }).click();
  presentation = page.locator('.classroom-presentation');
  await expect(presentation).toBeVisible();
  await expect(presentation.getByText('نحافظ على وقت التعلّم', { exact: true })).toBeVisible();
  await expect(presentation.getByText('ميثاق الصف', { exact: true })).toBeVisible();
  await expect(presentation.getByText('ارفع يدك قبل المشاركة', { exact: true })).toBeVisible();
  await expect(presentation.getByText('لا تقاطع المعلّم أو زملاءك', { exact: true })).toHaveCount(0);
  await expect(presentation.locator('.classroom-presentation__timer')).toBeVisible();
  await expect(presentation.locator('.classroom-presentation__reward')).toContainText('+7');
  await page.getByRole('button', { name: 'إنهاء العرض' }).click();

  await page.clock.runFor(718_900);
  await expect(page.locator('.goal-live__timer')).toHaveText('00:00');
  await expect(page.getByText('انتهى الوقت — بانتظار قرار المعلّم. لا تُضاف نقاط تلقائيًا.')).toBeVisible();

  expect(errors).toEqual([]);
});
