import { test, expect } from '@playwright/test';

test('N25 report actions explain empty output and retain blank grade print', async ({ page }) => {
  const errors = [];
  const downloads = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'n25-year', label: 'Synthetic year' }],
      terms: [{ id: 'n25-term', yearId: 'n25-year', name: 'Synthetic term' }],
      sections: [{ id: 'n25-section', yearId: 'n25-year', grade: 4, label: 'A' }],
      subjects: [{ id: 'n25-subject', name: 'Synthetic subject' }],
      teachings: [{ id: 'n25-teaching', sectionId: 'n25-section', subjectId: 'n25-subject', termId: 'n25-term' }],
      students: [{ id: 'n25-student', name: 'Synthetic student' }],
      enrollments: [{ id: 'n25-enrollment', studentId: 'n25-student', sectionId: 'n25-section', status: 'active' }],
    });
    await window.store.patchDevice({ activeYearId: 'n25-year', activeTermId: 'n25-term' });
  });
  await page.goto('/#/teaching/n25-teaching/reports');
  await page.locator('[data-act="csv"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا توجد درجات مرصودة');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-act="print"]').last().click();
  await expect(page.getByRole('dialog')).toContainText('طباعة كشف فارغ');
  await page.getByRole('dialog').getByRole('button', { name: 'طباعة كشف فارغ' }).click();
  await expect(page.getByRole('dialog')).toContainText('تأكيد بيانات التقرير والطباعة');
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();

  await page.locator('[data-tab="attendance"]').click();
  await page.locator('[data-act="csv"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا يوجد حضور مرصود');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-act="print"]').last().click();
  await expect(page.getByRole('dialog')).toContainText('لا يوجد حضور مرصود');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-tab="support"]').click();
  await page.locator('[data-act="csv"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا توجد بيانات كافية');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-act="print"]').last().click();
  await expect(page.getByRole('dialog')).toContainText('لا توجد بيانات كافية');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-tab="attendance"]').click();

  await page.evaluate(async () => {
    await window.store.save({
      sessions: [
        { id: 'n25-session-out', teachingId: 'n25-teaching', date: '2026-08-01', period: 1 },
        { id: 'n25-session-in', teachingId: 'n25-teaching', date: '2026-08-02', period: 2 },
      ],
      attendance: [
        { id: 'n25-attendance-out', teachingId: 'n25-teaching', studentId: 'n25-student', sessionId: 'n25-session-out', status: 'absent' },
        { id: 'n25-attendance-in', teachingId: 'n25-teaching', studentId: 'n25-student', sessionId: 'n25-session-in', status: 'present' },
      ],
    });
    window.store.repaint();
  });
  await page.locator('[data-change="filter-start"]').fill('2026-08-02');
  await page.locator('[data-change="filter-start"]').dispatchEvent('change');
  await page.locator('[data-change="filter-end"]').fill('2026-08-02');
  await page.locator('[data-change="filter-end"]').dispatchEvent('change');
  await expect(page.locator('.report-document')).toContainText('100%');
  const csvDownload = page.waitForEvent('download');
  await page.locator('[data-act="csv"]').click();
  const stream = await (await csvDownload).createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk;
  expect(csv.split(/\r?\n/)[0].split(',')).toHaveLength(5);
  expect(csv).toContain(',0,0');
  expect(csv).not.toContain(',1,0');

  await page.locator('[data-tab="support"]').click();
  await page.locator('[data-act="csv"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا يوجد طلاب تنطبق عليهم مؤشرات الدعم');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-act="print"]').last().click();
  await expect(page.getByRole('dialog')).toContainText('لا يوجد طلاب تنطبق عليهم مؤشرات الدعم');
  await expect(page.getByRole('dialog')).toContainText('راجع المؤشرات أو اختر فصلًا آخر');
  await page.getByRole('dialog').getByRole('button', { name: 'العودة' }).click();

  await page.evaluate(async () => {
    await window.store.save({
      items: [{ id: 'n25-item', teachingId: 'n25-teaching', name: 'Synthetic item', max: 10 }],
      scores: [{ id: 'n25-score', itemId: 'n25-item', studentId: 'n25-student', value: 9 }],
      logs: [{ id: 'n25-log', teachingId: 'n25-teaching', studentId: 'n25-student', kind: 'participation', delta: 1 }],
    });
    window.store.repaint();
  });
  await expect(page.locator('.report-document')).toContainText('لا يوجد طلاب تنطبق عليهم مؤشرات الدعم');
  await page.locator('[data-act="csv"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا يوجد طلاب تنطبق عليهم مؤشرات الدعم');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-act="print"]').last().click();
  await expect(page.getByRole('dialog')).toContainText('لا يوجد طلاب تنطبق عليهم مؤشرات الدعم');
  await page.getByRole('dialog').getByRole('button', { name: 'طباعة التقرير فارغًا' }).click();
  await expect(page.getByRole('dialog')).toContainText('تأكيد بيانات التقرير والطباعة');
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();

  await page.goto('/#/reports/execution');
  await page.selectOption('[data-change="status"]', 'future');
  await page.locator('[data-act="csv"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا توجد حصص مطابقة');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  await page.locator('[data-act="print"]').click();
  await expect(page.getByRole('dialog')).toContainText('لا توجد حصص مطابقة');
  await page.getByRole('dialog').getByRole('button', { name: 'حسنًا' }).click();
  expect(downloads).toHaveLength(1);
  for (const [width, theme] of [[1280, 'light'], [390, 'dark'], [320, 'light']]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async (value) => { await window.store.patchDevice({ theme: value }); window.store.applyTheme(); }, theme);
    await page.goto('/#/teaching/n25-teaching/reports');
    await expect(page.locator('[data-act="csv"]')).toBeVisible();
    await expect(page.locator('[data-act="print"]').last()).toBeVisible();
    await page.locator('[data-tab="support"]').click();
    await page.locator('[data-act="print"]').last().click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'طباعة التقرير فارغًا' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('dialog').getByRole('button', { name: 'العودة' }).click();
  }
  expect(errors).toEqual([]);
});

test('N25 schedule template notice and D-086 compact action reachability', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.store?.state?.ready);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'n25-schedule-year', label: 'Synthetic year' }],
      terms: [{ id: 'n25-schedule-term', yearId: 'n25-schedule-year', name: 'Synthetic term' }],
      sections: [{ id: 'n25-schedule-section', yearId: 'n25-schedule-year', grade: 4, label: 'A' }],
      subjects: [{ id: 'n25-schedule-subject', name: 'Synthetic subject' }],
      teachings: [{ id: 'n25-schedule-teaching', sectionId: 'n25-schedule-section', subjectId: 'n25-schedule-subject', termId: 'n25-schedule-term' }],
      timeProfiles: [{ id: 'n25-profile', name: 'Synthetic timing', periods: [{ period: 1, start: '07:00', end: '07:45' }], overrides: {} }],
    });
    await window.store.patchDevice({ activeYearId: 'n25-schedule-year', activeTermId: 'n25-schedule-term', activeTimeProfileId: 'n25-profile' });
    window.store.repaint();
  });
  for (const [width, theme] of [[1280, 'light'], [390, 'dark'], [320, 'light']]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async (value) => { await window.store.patchDevice({ theme: value }); window.store.applyTheme(); }, theme);
    await page.locator('[data-act="export"]').click();
    await expect(page.getByRole('dialog')).toContainText('الجدول بلا حصص مجدولة');
    await expect(page.locator('#schedule-export-png')).toBeVisible();
    await expect(page.locator('#schedule-export-print')).toBeVisible();
    if (width === 1280) {
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#schedule-export-png').click();
      expect((await downloadPromise).suggestedFilename()).toBe('rakeezx-schedule.png');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).last().click();
  }
  expect(errors).toEqual([]);
});
