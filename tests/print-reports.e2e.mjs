import { test, expect } from '@playwright/test';

const maleNames = ['أحمد محمد','محمد خالد','عبدالله سعد','عمر فهد','يوسف علي','خالد عبدالرحمن','سلمان ناصر','عبدالعزيز ماجد','تركي وليد','فهد عادل','ناصر إبراهيم','سعد راشد','ماجد حسن','راكان بدر','زياد طارق','أنس سامي','بدر منصور','وليد صالح','ياسر عوض','فيصل حمد','ريان عبدالمجيد','حسن جابر','علي ناصر','معتز فؤاد','سامي يوسف','طارق مازن','إبراهيم سالم','خليل سلطان','جابر عمر','منصور فهد'];

function errorsFor(page) { const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); return errors; }
async function downloadText(download) { const stream = await download.createReadStream(); let text = ''; for await (const chunk of stream) text += chunk; return text; }

async function seed(page) {
  await page.evaluate(async (names) => {
    const students = names.map((name, index) => ({ id: `print-student-${index}`, name, status: 'active' }));
    const enrollments = students.map((student, index) => ({ id: `print-enrollment-${index}`, studentId: student.id, sectionId: 'print-section', status: 'active', rollNo: index + 1 }));
    const attendance = students.map((student, index) => ({ id: `print-attendance-${index}`, studentId: student.id, sessionId: 'print-session', teachingId: 'print-teaching', date: '2026-08-20', status: index % 5 === 0 ? 'absent' : index % 3 === 0 ? 'late' : 'present' }));
    await window.store.save({
      profile: [{ id: 'profile', teacherName: 'معلم تجريبي', schoolName: 'مدرسة تجريبية' }],
      years: [{ id: 'print-year', label: '1448-1449' }], terms: [{ id: 'print-term', yearId: 'print-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'print-subject', name: 'الرياضيات' }], sections: [{ id: 'print-section', yearId: 'print-year', grade: 5, label: '1', name: 'الخامس / 1' }],
      teachings: [{ id: 'print-teaching', sectionId: 'print-section', subjectId: 'print-subject', termId: 'print-term' }],
      students, enrollments,
      items: [{ id: 'print-item', teachingId: 'print-teaching', name: 'اختبار قصير', max: 10 }, { id: 'print-participation', teachingId: 'print-teaching', name: 'المشاركة', max: 5, auto: 'participation', perPoint: 1 }],
      scores: [{ id: 'print-score', studentId: 'print-student-0', itemId: 'print-item', value: 8 }],
      logs: [{ id: 'print-log', studentId: 'print-student-0', teachingId: 'print-teaching', kind: 'participation', delta: 2, date: '2026-08-20' }],
      slots: [{ id: 'print-slot', teachingId: 'print-teaching', weekday: 0, period: 1 }],
      sessions: [{ id: 'print-session', teachingId: 'print-teaching', slotId: 'print-slot', date: '2026-08-20', weekday: 0, period: 1, startTime: '07:00', endTime: '07:45' }], attendance,
    });
    await window.store.patchDevice({ activeYearId: 'print-year', activeTermId: 'print-term', reportPrincipalName: '' });
    window.store.repaint();
  }, maleNames);
}

test('administration print reports preserve data, local metadata, privacy, RTL, and print media', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = errorsFor(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store, { timeout: 15_000 });
  await seed(page);

  await page.goto('/#/teaching/print-teaching/reports');
  await page.locator('[data-act="tab"][data-tab="roster"]').click();
  await expect(page.locator('[data-act="tab"][data-tab="roster"]')).toBeVisible();
  await expect(page.locator('.gtable--report tbody tr')).toHaveCount(30);
  await expect(page.locator('.gtable--report')).toContainText('أحمد محمد');
  await expect(page.locator('main')).not.toContainText('الهوية الوطنية');
  await expect(page.locator('.print-signatures')).not.toContainText('مدير المدرسة');
  await expect(page.getByRole('button', { name: 'طباعة' })).toBeVisible();

  await page.getByRole('button', { name: 'طباعة' }).click();
  await expect(page.locator('#pre-print-form')).toBeVisible();
  await page.locator('input[name="principalName"]').fill('مدير تجريبي');
  await page.locator('button[form="pre-print-form"]').click();
  await expect(page.locator('.print-signatures')).toContainText('معلم المادة');
  await expect(page.locator('.print-signatures')).toContainText('مدير المدرسة');
  await expect(page.locator('.print-signatures')).toContainText('مدير تجريبي');
  await page.reload();
  await page.locator('[data-act="tab"][data-tab="roster"]').click();
  await expect(page.locator('.print-signatures')).toContainText('مدير تجريبي');

  const rosterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const rosterFile = await rosterDownload;
  await expect(rosterFile.suggestedFilename()).toMatch(/^طلاب-/);
  expect(await downloadText(rosterFile)).toContain('أحمد محمد');

  await page.locator('[data-act="tab"][data-tab="attendance"]').click();
  await expect(page.locator('.gtable--report')).toContainText('غياب');
  const attendanceDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const attendanceFile = await attendanceDownload;
  await expect(attendanceFile.suggestedFilename()).toMatch(/^حضور-/);
  const attendanceText = await downloadText(attendanceFile);
  expect(attendanceText).toContain('20 أغسطس 2026');
  expect(attendanceText).toContain('أحمد محمد');
  expect(attendanceText).not.toMatch(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/);

  await page.locator('[data-act="tab"][data-tab="support"]').click();
  await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تصدير CSV' })).toBeVisible();
  await expect(page.locator('.list')).toContainText('محمد خالد');
  const supportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const supportFile = await supportDownload;
  await expect(supportFile.suggestedFilename()).toMatch(/^دعم-/);
  const supportText = await downloadText(supportFile);
  expect(supportText).toContain('محمد خالد');
  expect(supportText).toContain('مؤشرات الدعم');
  expect(supportText).not.toContain('print-student-');
  expect(supportText).not.toContain('updatedAt');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-only .gtable--report')).toContainText('مؤشرات الدعم');
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.report-actions')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.locator('[data-act="tab"][data-tab="grades"]').click();
  await expect(page.locator('.gtable--report')).toContainText('اختبار قصير');
  await expect(page.locator('.gtable--report tbody tr').nth(1)).toContainText('0');
  const gradesDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  await expect((await gradesDownload).suggestedFilename()).toMatch(/^درجات-/);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.report-actions')).toBeHidden();
  await expect(page.locator('.printhead')).toBeVisible();
  expect(await page.locator('.gtable thead').evaluate(el => getComputedStyle(el).display)).toBe('table-header-group');
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.emulateMedia({ media: 'screen' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/#/reports/execution');
  await expect(page.locator('.gtable--report')).toBeVisible();
  await expect(page.locator('.gtable--report')).toContainText('تم رصد الحضور');
  const executionDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const executionFile = await executionDownload;
  await expect(executionFile.suggestedFilename()).toBe('تنفيذ-الحصص.csv');
  const executionText = await downloadText(executionFile);
  expect(executionText).toContain('07:00 – 07:45');
  expect(executionText).not.toContain('print-session');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.print-signatures')).toContainText('مدير تجريبي');
  await page.emulateMedia({ media: 'screen' });
  expect(errors).toEqual([]);
});
