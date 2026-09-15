import { test, expect } from '@playwright/test';

async function createStudentFixture(page) {
  return page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: '١', name: 'الخامس / ١' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const student = await window.store.addStudent(section.id, 'طالب تجربة الملاحظات');
    return { sectionId: section.id, teachingId: teaching.id, studentId: student.id };
  });
}

async function openNotes(page) {
  const notes = page.locator('.student-notes-history');
  await expect(notes).toBeVisible();
  if (!(await notes.evaluate((node) => node.open))) await notes.evaluate((node) => { node.open = true; });
  await expect(notes).toHaveJSProperty('open', true);
  return notes;
}

test('student detail captures unambiguous context automatically and preserves it through transfer', async ({ page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await createStudentFixture(page);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await openNotes(page);
  await expect(page.getByText('لا توجد ملاحظات مسجلة لهذا الطالب.')).toBeVisible();
  await expect(page.locator('input[name="note"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'إضافة ملاحظة' }).click();
  await expect(page.getByText('ربطها بالفصل الحالي')).toHaveCount(0);
  await page.locator('#student-note-text').fill('يحتاج متابعة في مهارة الطباعة');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('يحتاج متابعة في مهارة الطباعة')).toHaveCount(1);
  await openNotes(page);
  await expect(page.getByText('يحتاج متابعة في مهارة الطباعة')).toBeVisible();
  expect(await page.evaluate((data) => window.store.notesOf(data.studentId)[0].teachingId, fixture)).toBe(fixture.teachingId);

  await page.getByRole('button', { name: 'ملاحظة جديدة' }).click();
  await page.locator('#student-note-text').fill('تحسن في استخدام لوحة المفاتيح');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تحسن في استخدام لوحة المفاتيح')).toHaveCount(1);
  await openNotes(page);
  await expect(page.getByText('تحسن في استخدام لوحة المفاتيح')).toBeVisible();
  const second = page.locator('.logrow', { hasText: 'تحسن في استخدام لوحة المفاتيح' });
  await second.getByRole('button', { name: 'تعديل ملاحظة' }).click();
  await page.locator('#student-note-text').fill('تحسن واضح في استخدام لوحة المفاتيح');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toHaveCount(1);
  await openNotes(page);
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toBeVisible();

  const next = await page.evaluate(async ({ studentId }) => {
    const section = await window.store.createSection({ grade: 5, label: '٢', name: 'الخامس / ٢' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    await window.store.transferStudent(studentId, section.id, { date: '2026-08-26' });
    return { sectionId: section.id, teachingId: teaching.id };
  }, fixture);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${next.teachingId}`);
  await openNotes(page);
  await page.getByRole('button', { name: 'ملاحظة جديدة' }).click();
  await page.locator('#student-note-text').fill('ملاحظة بعد النقل');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('ملاحظة بعد النقل')).toHaveCount(1);
  expect(await page.evaluate((data) => {
    const byText = Object.fromEntries(window.store.notesOf(data.studentId).map((note) => [note.text, note.teachingId]));
    return byText;
  }, fixture)).toMatchObject({
    'يحتاج متابعة في مهارة الطباعة': fixture.teachingId,
    'ملاحظة بعد النقل': next.teachingId,
  });

  await openNotes(page);
  const edited = page.locator('.logrow', { hasText: 'تحسن واضح في استخدام لوحة المفاتيح' });
  await expect(edited).toBeVisible();
  await expect(edited.getByRole('button', { name: 'حذف ملاحظة' })).toHaveCount(0);
  const current = page.locator('.logrow', { hasText: 'ملاحظة بعد النقل' });
  await current.getByRole('button', { name: 'حذف ملاحظة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(page.getByText('ملاحظة بعد النقل')).toHaveCount(0);
  await openNotes(page);
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toBeVisible();
  await expect(page.getByText('يحتاج متابعة في مهارة الطباعة')).toBeVisible();

  await page.reload();
  await openNotes(page);
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toBeVisible();
  await expect(page.getByText('ملاحظة بعد النقل')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('student detail creates a general note without current context; legacy and multi-tab still work', async ({ context, page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await createStudentFixture(page);
  const generalStudent = await page.evaluate(async () => {
    const student = { id: 'notes-general-student', name: 'طالب بلا فصل', note: '', status: 'active', updatedAt: Date.now(), deleted: false };
    await window.store.save({ students: [student] });
    return student.id;
  });
  await page.goto(`/#/student/${generalStudent}`);
  await openNotes(page);
  await page.getByRole('button', { name: 'إضافة ملاحظة' }).click();
  await page.locator('#student-note-text').fill('ملاحظة عامة بلا سياق');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  expect(await page.evaluate((studentId) => window.store.notesOf(studentId)[0].teachingId, generalStudent)).toBeNull();

  await page.evaluate(async ({ studentId }) => {
    await window.store.patch('students', studentId, { note: 'ملاحظة قديمة' });
    await window.store.migrateLegacyStudentNotes();
  }, fixture);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await openNotes(page);
  await expect(page.getByText('ملاحظة قديمة')).toBeVisible();
  await page.reload();
  await openNotes(page);
  await expect(page.getByText('ملاحظة قديمة')).toHaveCount(1);

  const other = await context.newPage();
  await other.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await other.waitForFunction(() => window.store);
  await openNotes(other);
  await openNotes(page);
  await page.getByRole('button', { name: 'ملاحظة جديدة' }).click();
  await page.locator('#student-note-text').fill('ملاحظة متعددة التبويبات');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(other.getByText('ملاحظة متعددة التبويبات')).toHaveCount(1);
  await openNotes(other);
  await expect(other.getByText('ملاحظة متعددة التبويبات')).toBeVisible();
  await other.close();
});
