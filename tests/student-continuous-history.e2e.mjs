import { test, expect } from '@playwright/test';

test('Student Profile shows context-true continuous history through X → Y → X', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await page.evaluate(async () => {
    const stamp = Date.now();
    const studentId = 'continuous-history:student';
    const x = 'continuous-history:X';
    const y = 'continuous-history:Y';
    const teachingX = 'continuous-history:teaching:X';
    const teachingY = 'continuous-history:teaching:Y';
    const sessionX = 'continuous-history:session:X';
    const sessionY = 'continuous-history:session:Y';
    const common = { updatedAt: stamp, deleted: false };
    await window.store.save({
      years: [{ id: 'continuous-history:year', label: '1450–1451 هـ', hijriStart: 1450, order: 0, status: 'active', ...common }],
      terms: [{ id: 'continuous-history:term', yearId: 'continuous-history:year', index: 1, name: 'الفصل الأول', order: 0, status: 'active', ...common }],
      subjects: [{ id: 'continuous-history:subject', name: 'المهارات الرقمية', slug: 'continuous-history', ...common }],
      sections: [
        { id: x, yearId: 'continuous-history:year', grade: 4, label: 'أ', name: 'الرابع / أ', order: 0, ...common },
        { id: y, yearId: 'continuous-history:year', grade: 4, label: 'ب', name: 'الرابع / ب', order: 1, ...common },
      ],
      teachings: [
        { id: teachingX, sectionId: x, subjectId: 'continuous-history:subject', termId: 'continuous-history:term', order: 0, ...common },
        { id: teachingY, sectionId: y, subjectId: 'continuous-history:subject', termId: 'continuous-history:term', order: 1, ...common },
      ],
      students: [{ id: studentId, name: 'طالب السجل المستمر', status: 'active', ...common }],
      enrollments: [{ id: `en:${studentId}:${x}`, studentId, sectionId: x, rollNo: 1, startDate: '2026-08-01', endDate: null, status: 'active', ...common }],
      items: [
        { id: 'continuous-history:item:X', teachingId: teachingX, name: 'اختبار قصير', max: 10, order: 0, auto: null, ...common },
        { id: 'continuous-history:item:Y', teachingId: teachingY, name: 'اختبار قصير', max: 10, order: 0, auto: null, ...common },
      ],
      scores: [{ id: `sc:${studentId}:continuous-history:item:X`, studentId, itemId: 'continuous-history:item:X', value: 6, ...common }],
      sessions: [{ id: sessionX, teachingId: teachingX, date: '2026-08-20', period: 2, status: 'held', ...common }],
      attendance: [{ id: `at:${studentId}:${sessionX}`, studentId, sessionId: sessionX, teachingId: teachingX, date: '2026-08-20', status: 'absent', ...common }],
      logs: [{ id: 'continuous-history:log:X', studentId, sessionId: sessionX, teachingId: teachingX, date: '2026-08-20', kind: 'participation', delta: 1, tag: 'مشاركة X', ...common }],
      notes: [{ id: 'continuous-history:note:X', studentId, sessionId: sessionX, teachingId: teachingX, date: '2026-08-20', kind: 'general', text: 'ملاحظة X', createdAt: stamp, ...common }],
    });
    await window.store.patchDevice({ activeYearId: 'continuous-history:year', activeTermId: 'continuous-history:term' });
    await window.store.transferStudent(studentId, y, { date: '2026-08-25' });
    return { studentId, x, y, teachingX, teachingY, sessionY };
  });

  // Follow the same route a teacher takes after a transfer: open Y's roster and
  // select the student there before Y has any attendance, notes, or quick logs.
  await page.goto(`/#/teaching/${fixture.teachingY}/students`);
  const studentLink = page.locator(`a[href="#/student/${fixture.studentId}?teaching=${fixture.teachingY}"]`);
  await expect(studentLink.locator('.row__title')).toHaveText('طالب السجل المستمر');
  await studentLink.click();
  await expect(page.locator('.student-profile-header__name')).toHaveText('طالب السجل المستمر');
  await expect(page.locator('.student-profile-header__meta')).toContainText('الانتساب الحالي · الرابع الابتدائي / ب');
  await expect(page.locator('.student-profile-header__meta')).toContainText('السجل الحالي · الرابع الابتدائي / ب · المهارات الرقمية');
  const grades = page.locator('.section', { hasText: 'الدرجات — المهارات الرقمية' });
  await expect(grades).toContainText('6 / 10');
  const previous = page.locator('.student-previous-history');
  await expect(previous).toContainText('السجل السابق');
  await expect(previous).toContainText('الرابع الابتدائي / أ · المهارات الرقمية');
  await expect(previous).toContainText('اختبار قصير');
  await expect(previous).toContainText('6 / 10');
  await expect(previous).toContainText('للقراءة فقط');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(previous).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  const initialAttendance = page.locator('.section', { hasText: 'سجل الحضور المستمر' });
  await expect(initialAttendance.locator('.logrow')).toHaveCount(1);
  await expect(initialAttendance).toContainText('الرابع الابتدائي / أ · المهارات الرقمية');
  await expect(initialAttendance).toContainText('سياق سابق');
  const initialNotes = page.locator('.section', { hasText: 'الملاحظات' });
  await expect(initialNotes).toContainText('ملاحظة X');
  const initialLogs = page.locator('.section', { hasText: 'المشاركة والسلوك' });
  await expect(initialLogs).toContainText('مشاركة X');

  await page.evaluate(async ({ studentId, teachingY, sessionY }) => {
    const stamp = Date.now();
    const common = { updatedAt: stamp, deleted: false };
    await window.store.save({
      sessions: [{ id: sessionY, teachingId: teachingY, date: '2026-08-28', period: 4, status: 'held', ...common }],
      attendance: [{ id: `at:${studentId}:${sessionY}`, studentId, sessionId: sessionY, teachingId: teachingY, date: '2026-08-28', status: 'present', ...common }],
      logs: [{ id: 'continuous-history:log:Y', studentId, sessionId: sessionY, teachingId: teachingY, date: '2026-08-28', kind: 'behavior', delta: -1, tag: 'سلوك Y', ...common }],
      notes: [{ id: 'continuous-history:note:Y', studentId, sessionId: sessionY, teachingId: teachingY, date: '2026-08-28', kind: 'general', text: 'ملاحظة Y', createdAt: stamp + 1, ...common }],
    });
  }, fixture);

  await expect(page.locator('.student-profile-header__meta')).toContainText('السجل الحالي · الرابع الابتدائي / ب · المهارات الرقمية');

  const attendance = page.locator('.section', { hasText: 'سجل الحضور المستمر' });
  await expect(attendance.locator('.logrow')).toHaveCount(2);
  await expect(attendance).toContainText('الرابع الابتدائي / أ · المهارات الرقمية');
  await expect(attendance).toContainText('الرابع الابتدائي / ب · المهارات الرقمية');
  await expect(attendance.getByText('السجل الحالي', { exact: true })).toHaveCount(1);
  await expect(attendance.getByText('سياق سابق', { exact: true })).toHaveCount(1);
  await expect(attendance).toContainText('غائب');
  await expect(attendance).toContainText('حاضر');

  const notes = page.locator('.section', { hasText: 'الملاحظات' });
  await expect(notes.locator('.logrow')).toHaveCount(2);
  await expect(notes).toContainText('ملاحظة X');
  await expect(notes).toContainText('ملاحظة Y');

  const logs = page.locator('.section', { hasText: 'المشاركة والسلوك' });
  await expect(logs.locator('.logrow')).toHaveCount(2);
  await expect(logs).toContainText('مشاركة X');
  await expect(logs).toContainText('سلوك Y');
  await expect(page.locator('.stat', { hasText: 'نسبة الحضور · كل السجل' })).toContainText('50');

  const beforeReturn = await page.evaluate((studentId) => {
    const history = window.store.studentHistory(studentId);
    return Object.fromEntries(['attendance', 'logs', 'notes', 'scores']
      .map((name) => [name, history[name].map((event) => event.record.id)]));
  }, fixture.studentId);
  await page.evaluate(({ studentId, x }) => window.store.transferStudent(studentId, x, { date: '2026-09-01' }), fixture);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingX}`);
  await page.reload();
  await expect(page.locator('.section', { hasText: 'سجل الحضور المستمر' }).locator('.logrow')).toHaveCount(2);
  expect(await page.evaluate((studentId) => {
    const history = window.store.studentHistory(studentId);
    return Object.fromEntries(['attendance', 'logs', 'notes', 'scores']
      .map((name) => [name, history[name].map((event) => event.record.id)]));
  }, fixture.studentId)).toEqual(beforeReturn);

  await page.evaluate(async ({ studentId, y, x }) => {
    await window.store.transferStudent(studentId, y, { date: '2026-09-02' });
    await window.store.archiveSection(x, '2026-09-03');
  }, fixture);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingY}`);
  const archivedHistory = page.locator(`[data-history-teaching="${fixture.teachingX}"]`);
  await expect(archivedHistory).toContainText('مؤرشف');
  await expect(archivedHistory).toContainText('6 / 10');
  await expect(page.locator(`[data-id="continuous-history:note:X"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});
