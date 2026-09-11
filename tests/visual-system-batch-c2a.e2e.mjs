import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(120_000);
test.use({ ...(process.env.RAKEEZX_E2E_BASE_URL ? { baseURL: process.env.RAKEEZX_E2E_BASE_URL } : {}) });

const viewports = [
  { width: 320, height: 760 },
  { width: 390, height: 844 },
  { width: 412, height: 860 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
];

const noOverflow = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
);

function runtimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

async function seed(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const names = ['أحمد محمد', 'سارة خالد', 'عبدالله ناصر', 'نورة سعد', 'عمر فهد', 'ريم علي', 'يوسف حسن', 'لينا ماجد'];
    const students = names.map((name, index) => ({ id: `c2a-student-${index}`, name, status: 'active' }));
    const extraSections = Array.from({ length: 10 }, (_, index) => ({
      id: `c2a-section-extra-${index}`,
      yearId: 'c2a-year',
      grade: index < 5 ? 5 : 6,
      label: String(index < 5 ? index + 2 : index - 4),
    }));
    const extraTeachings = extraSections.map((section, index) => ({
      id: `c2a-teaching-extra-${index}`,
      sectionId: section.id,
      subjectId: 'c2a-subject',
      termId: 'c2a-term',
    }));
    await window.store.save({
      profile: [{ id: 'profile', teacherName: 'معلم رَكيز', schoolName: 'مدرسة رَكيز' }],
      years: [{ id: 'c2a-year', label: '1448-1449' }],
      terms: [
        { id: 'c2a-term', yearId: 'c2a-year', name: 'الفصل الدراسي الأول' },
        { id: 'c2a-term-empty', yearId: 'c2a-year', name: 'الفصل الدراسي الثاني' },
      ],
      subjects: [{ id: 'c2a-subject', name: 'المهارات الرقمية' }],
      sections: [{ id: 'c2a-section', yearId: 'c2a-year', grade: 5, label: 'أ' }, ...extraSections],
      teachings: [{ id: 'c2a-teaching', sectionId: 'c2a-section', subjectId: 'c2a-subject', termId: 'c2a-term' }, ...extraTeachings],
      students,
      enrollments: students.map((student, index) => ({ id: `c2a-enrollment-${index}`, studentId: student.id, sectionId: 'c2a-section', status: 'active', rollNo: index + 1 })),
      items: [
        { id: 'c2a-item-1', teachingId: 'c2a-teaching', name: 'المهام', max: 10 },
        { id: 'c2a-item-2', teachingId: 'c2a-teaching', name: 'المشروع', max: 10 },
      ],
      scores: [{ id: 'c2a-score', studentId: 'c2a-student-0', itemId: 'c2a-item-1', value: 8 }],
      slots: [
        { id: 'c2a-slot-1', teachingId: 'c2a-teaching', weekday: 0, period: 1 },
        { id: 'c2a-slot-2', teachingId: 'c2a-teaching', weekday: 2, period: 3 },
      ],
      sessions: [
        { id: 'c2a-session-1', teachingId: 'c2a-teaching', slotId: 'c2a-slot-1', date: '2026-09-06', weekday: 0, period: 1, startTime: '07:00', endTime: '07:45' },
        { id: 'c2a-session-2', teachingId: 'c2a-teaching', slotId: 'c2a-slot-2', date: '2026-09-08', weekday: 2, period: 3, startTime: '08:40', endTime: '09:25' },
      ],
      attendance: students.map((student, index) => ({ id: `c2a-attendance-${index}`, studentId: student.id, sessionId: 'c2a-session-1', teachingId: 'c2a-teaching', date: '2026-09-06', status: index === 2 ? 'absent' : 'present' })),
      timeProfiles: [{
        id: 'c2a-timing', name: 'التوقيت الصيفي', order: 1,
        periods: [
          { period: 1, start: '07:00', end: '07:45' },
          { period: 2, start: '07:50', end: '08:35' },
          { period: 3, start: '08:40', end: '09:25' },
        ],
        overrides: {},
      }],
    }, { queue: false });
    await window.store.patchDevice({ activeYearId: 'c2a-year', activeTermId: 'c2a-term', theme: 'light' }, { queue: false });
    await window.store.patchProfile({ activeTimeProfileId: 'c2a-timing' }, { queue: false });
  });
}

async function theme(page, value) {
  await page.evaluate((selected) => window.store.patchDevice({ theme: selected }, { queue: false }), value);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', value);
}

test('C2A reports stay cohesive, responsive, and print only the report document', async ({ page }) => {
  const errors = runtimeErrors(page);
  await seed(page);

  for (const selectedTheme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/#/reports');
      await theme(page, selectedTheme);
      await expect(page.locator('.report-hub')).toHaveCount(2);
      await expect(page.locator('a[href="#/reports/execution"]')).toHaveCount(1);
      await expect(page.locator('.report-grade-group')).toHaveCount(2);
      await expect(page.locator('.report-grade-group[open]')).toHaveCount(0);
      await expect(page.locator('.report-grade-group').first().locator('.report-class-row').first()).toBeHidden();
      await expect(page.locator('.report-grade-group__count').first()).toHaveText('6 فصول');
      await expect(page.locator('.report-grade-group__count').nth(1)).toHaveText('5 فصول');
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/reports`).toBe(true);

      await page.goto('/#/teaching/c2a-teaching/reports');
      await expect(page.locator('.report-workspace')).toBeVisible();
      await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toBeVisible();
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/class-report`).toBe(true);

      await page.goto('/#/reports/execution');
      await expect(page.locator('.report-filters')).toBeVisible();
      await expect(page.locator('.report-metrics .stat')).toHaveCount(5);
      await expect(page.locator('.report-metrics')).not.toContainText('شعب');
      await expect(page.locator('.report-metrics')).toContainText('فصول');
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/execution`).toBe(true);
    }
  }

  await mkdir(path.resolve('test-results/c2a-browser'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/reports');
  await theme(page, 'light');
  await page.screenshot({ path: 'test-results/c2a-browser/reports-index-desktop-light.png', fullPage: true });
  await page.goto('/#/reports/execution');
  await page.screenshot({ path: 'test-results/c2a-browser/execution-desktop-light.png', fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/teaching/c2a-teaching/reports');
  await page.getByRole('button', { name: 'معاينة A4' }).click();
  await expect(page.locator('.a4-sheet')).toHaveClass(/a4-sheet--landscape/);
  await expect(page.locator('.a4-sheet .printhead')).toContainText('رَكيز المعلم');
  await expect(page.locator('.a4-sheet .print-report__footer')).toBeVisible();
  await page.getByRole('button', { name: 'الطلاب', exact: true }).click();
  await expect(page.locator('.a4-sheet')).not.toHaveClass(/a4-sheet--landscape/);
  await page.getByRole('button', { name: 'من يحتاج دعمًا' }).click();
  await expect(page.locator('.a4-sheet .support-report-print table')).toBeVisible();
  await expect(page.locator('.a4-sheet .support-report-screen')).toBeHidden();
  await expect(page.locator('.a4-sheet .support-report-print .row')).toHaveCount(0);
  await expect(page.locator('.a4-sheet .printhead__title')).toHaveText('تقرير من يحتاج دعمًا');
  await page.screenshot({ path: 'test-results/c2a-browser/support-a4-preview-desktop-light.png', fullPage: true });

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.report-tabs')).toBeHidden();
  await expect(page.locator('.report-toolbar')).toBeHidden();
  await expect(page.locator('.report-actions')).toBeHidden();
  await expect(page.locator('.report-document .printhead')).toBeVisible();
  await expect(page.locator('.report-document .print-report__footer')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  await page.goto('/#/reports/execution');
  await page.locator('select[data-change="status"]').selectOption('pending');
  await expect(page.locator('.gtable--report')).toContainText('لم يُرصد الحضور');
  await page.locator('select[data-change="term"]').selectOption('c2a-term-empty');
  await expect(page.locator('.report-filters')).toBeVisible();
  await expect(page.locator('.report-metrics .stat')).toHaveCount(5);
  await expect(page.locator('.report-metrics')).not.toContainText('شعب');
  await expect(page.locator('.report-results .empty__title')).toHaveText('لا توجد بيانات تنفيذ في الفصل الدراسي الثاني.');
  await expect(page.locator('.report-results')).not.toContainText('أضف فصلًا');
  await page.screenshot({ path: 'test-results/c2a-browser/execution-empty-term-desktop-light.png', fullPage: true });

  await page.goto('/#/reports');
  const closedGroup = page.locator('.report-grade-group').nth(1).locator('summary');
  await closedGroup.focus();
  await expect(closedGroup).toBeFocused();
  await closedGroup.press('Enter');
  await expect(page.locator('.report-grade-group').nth(1)).toHaveAttribute('open', '');

  await page.goto('/#/teaching/c2a-teaching/reports');
  await page.getByRole('button', { name: 'من يحتاج دعمًا' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.report-document .support-report-print table')).toBeVisible();
  await expect(page.locator('.report-document .support-report-screen')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'الحضور', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const datesBefore = await page.locator('.attendance-date-range__field').evaluateAll((nodes) => nodes.map((node) => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height })));
  expect(Math.abs(datesBefore[0].top - datesBefore[1].top)).toBeLessThanOrEqual(1);
  await expect(page.locator('.attendance-date-range .date-field')).toHaveCount(2);
  const dateTouchTargets = await page.locator('.attendance-date-range .date-field').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(dateTouchTargets.every((height) => height >= 44)).toBe(true);
  await expect(page.locator('.report-document .printhead__meta--context')).not.toContainText('من');
  await expect(page.locator('.report-document .printhead__meta--context').getByText('الفترة', { exact: true })).toHaveCount(0);
  await page.locator('input[data-change="filter-start"]').fill('2026-09-01');
  await page.locator('input[data-change="filter-start"]').dispatchEvent('change');
  const datesAfter = await page.locator('.attendance-date-range__field').evaluateAll((nodes) => nodes.map((node) => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height })));
  expect(Math.abs(datesAfter[0].top - datesAfter[1].top)).toBeLessThanOrEqual(1);
  expect(Math.abs(datesAfter[0].height - datesBefore[0].height)).toBeLessThanOrEqual(1);
  await page.locator('input[data-change="filter-end"]').fill('2026-09-10');
  await page.locator('input[data-change="filter-end"]').dispatchEvent('change');
  const printRange = page.locator('.report-document .printhead__meta--context');
  await expect(printRange.getByText('الفترة', { exact: true })).toHaveCount(1);
  await expect(printRange).toContainText('من');
  await expect(printRange).toContainText('إلى');
  expect(await noOverflow(page)).toBe(true);
  await page.screenshot({ path: 'test-results/c2a-browser/attendance-date-range-390-light.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  const mobileDates = await page.locator('.attendance-date-range__field').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
  expect(mobileDates[1]).toBeGreaterThan(mobileDates[0]);
  expect(await noOverflow(page)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('input[type="date"]').first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  const scan = await new AxeBuilder({ page })
    .include('.report-workspace')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'critical')).toEqual([]);
  expect(errors).toEqual([]);
});

test('Schedule export UI previews options, downloads PNG, and prints isolated A4 landscape', async ({ page }) => {
  const errors = runtimeErrors(page);
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/schedule');

  const exportButton = page.getByRole('button', { name: 'تصدير الجدول' });
  await exportButton.focus();
  await expect(exportButton).toBeFocused();
  await exportButton.press('Enter');
  await expect(page.getByRole('dialog', { name: 'تصدير الجدول' })).toBeVisible();
  await expect(page.locator('.schedule-export-preview')).toContainText('التوقيت الأساسي: التوقيت الصيفي');
  await expect(page.locator('.schedule-export-preview')).toContainText('المعلم: معلم رَكيز');
  await expect(page.locator('.schedule-export-preview')).toContainText('المدرسة: مدرسة رَكيز');
  await expect(page.locator('.schedule-export-preview__table td.is-empty')).not.toHaveCount(0);
  await expect(page.locator('.schedule-export-preview__table thead th').first()).toHaveText('اليوم');
  await expect(page.locator('.schedule-export-preview__table thead th').nth(1)).toHaveText('الحصة 1');
  await expect(page.locator('.schedule-export-preview__table tbody th').first()).toHaveText('الأحد');
  await expect(page.locator('.schedule-export-preview')).toContainText('خامس/أ');
  await expect(page.locator('.schedule-export-preview')).toContainText('رقمية');
  expect(await noOverflow(page)).toBe(true);
  await mkdir(path.resolve('test-results/c2a-browser'), { recursive: true });
  await page.screenshot({ path: 'test-results/c2a-browser/schedule-export-mobile-light.png', fullPage: true });

  await page.locator('input[name="includeTimes"]').uncheck();
  await expect(page.locator('.schedule-export-preview')).not.toContainText('التوقيت الأساسي:');
  await page.locator('input[name="includeTimes"]').check();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تنزيل PNG' }).click();
  const downloadedPng = await download;
  expect(downloadedPng.suggestedFilename()).toBe('rakeezx-schedule.png');
  await downloadedPng.saveAs(path.resolve('test-results/c2a-browser/schedule-export.png'));

  await page.evaluate(() => {
    window.__c2aPrint = { document: '', called: false };
    window.open = () => ({
      document: {
        open() {},
        write(value) { window.__c2aPrint.document = value; },
        close() {},
      },
      focus() {},
      print() { window.__c2aPrint.called = true; },
      set opener(value) {},
    });
  });
  await page.getByRole('button', { name: 'طباعة / PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__c2aPrint.called)).toBe(true);
  const printDocument = await page.evaluate(() => window.__c2aPrint.document);
  expect(printDocument).toContain('@page { size: A4 landscape;');
  expect(printDocument).toContain('<b>رَكيز</b> <em>المعلم</em>');
  expect(printDocument).toContain('التوقيت الأساسي: التوقيت الصيفي');
  expect(printDocument).toContain('المعلم: معلم رَكيز');
  expect(printDocument).toContain('المدرسة: مدرسة رَكيز');
  expect(printDocument).toContain('<th scope="col">اليوم</th><th scope="col">الحصة 1</th>');
  expect(printDocument).toContain('<th scope="row">الأحد</th>');
  expect(printDocument).toContain('خامس/أ');
  expect(printDocument).toContain('رقمية');
  expect(printDocument).not.toContain('تعديل أوقات الحصص');

  await page.getByRole('button', { name: 'إغلاق' }).last().click();
  for (const selectedTheme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/#/schedule');
      await theme(page, selectedTheme);
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/schedule`).toBe(true);
      await page.getByRole('button', { name: 'تصدير الجدول' }).click();
      await expect(page.locator('.schedule-export-preview')).toBeVisible();
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/schedule-export`).toBe(true);
      if (selectedTheme === 'dark' && viewport.width === 1440) {
        await page.screenshot({ path: 'test-results/c2a-browser/schedule-export-desktop-dark.png', fullPage: true });
      }
      if (viewport.width <= 412) {
        const targets = await page.locator('.schedule-export-actions .btn').evaluateAll((nodes) => nodes.filter((node) => !node.hidden).map((node) => node.getBoundingClientRect().height));
        expect(targets.every((height) => height >= 44), JSON.stringify(targets)).toBe(true);
      }
      await page.getByRole('button', { name: 'إغلاق' }).last().click();
    }
  }
  expect(errors).toEqual([]);
});

test('C2A print verification artifacts use portrait and landscape A4 layouts', async ({ page }) => {
  await seed(page);
  const outputDir = path.resolve('test-results/c2a-print');
  await mkdir(outputDir, { recursive: true });

  await page.goto('/#/teaching/c2a-teaching/reports');
  await page.getByRole('button', { name: 'من يحتاج دعمًا' }).click();
  await page.emulateMedia({ media: 'print' });
  const portrait = await page.pdf({
    path: path.join(outputDir, 'support-portrait.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(portrait.byteLength).toBeGreaterThan(2_000);

  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'الدرجات', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  const landscape = await page.pdf({
    path: path.join(outputDir, 'report-landscape.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(landscape.byteLength).toBeGreaterThan(2_000);

  const scheduleDocument = await page.evaluate(async () => {
    const engine = await import('/src/lib/schedule-export.js');
    return engine.schedulePrintDocument(engine.buildScheduleExportModel(window.store, {
      includeTeacherName: true,
      includeSchoolName: true,
      includeTimes: true,
    }));
  });
  await page.setContent(scheduleDocument, { waitUntil: 'load' });
  const schedule = await page.pdf({
    path: path.join(outputDir, 'schedule-landscape.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(schedule.byteLength).toBeGreaterThan(2_000);
});
