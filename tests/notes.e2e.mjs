import { test, expect } from '@playwright/test';

async function createStudentFixture(page) {
  return page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'ن', name: 'الخامس / ملاحظات المتصفح' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const student = await window.store.addStudent(section.id, 'طالب تجربة الملاحظات');
    return { sectionId: section.id, teachingId: teaching.id, studentId: student.id };
  });
}

test('student detail provides an append-oriented, persistent Arabic notes history', async ({ page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await createStudentFixture(page);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await expect(page.getByText('لا توجد ملاحظات مسجلة لهذا الطالب.')).toBeVisible();
  await expect(page.locator('input[name="note"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'إضافة ملاحظة' }).click();
  await page.locator('#student-note-text').fill('يحتاج متابعة في مهارة الطباعة');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('يحتاج متابعة في مهارة الطباعة')).toBeVisible();

  await page.getByRole('button', { name: 'ملاحظة جديدة' }).click();
  await page.locator('#student-note-text').fill('تحسن في استخدام لوحة المفاتيح');
  await page.getByRole('dialog').getByLabel('ربطها بالفصل الحالي').check();
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تحسن في استخدام لوحة المفاتيح')).toBeVisible();
  await expect(page.locator('.logrow').filter({ hasText: 'تحسن في استخدام لوحة المفاتيح' }).getByText(/الخامس/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('يحتاج متابعة في مهارة الطباعة')).toBeVisible();
  await expect(page.getByText('تحسن في استخدام لوحة المفاتيح')).toBeVisible();
  const second = page.locator('.logrow', { hasText: 'تحسن في استخدام لوحة المفاتيح' });
  await second.getByRole('button', { name: 'تعديل ملاحظة' }).click();
  await page.locator('#student-note-text').fill('تحسن واضح في استخدام لوحة المفاتيح');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toBeVisible();

  const first = page.locator('.logrow', { hasText: 'يحتاج متابعة في مهارة الطباعة' });
  await first.getByRole('button', { name: 'حذف ملاحظة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(page.getByText('يحتاج متابعة في مهارة الطباعة')).toHaveCount(0);
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toBeVisible();

  await page.goto('/#/classes');
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await expect(page.getByText('تحسن واضح في استخدام لوحة المفاتيح')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('legacy notes appear once and same-profile tabs receive new notes', async ({ context, page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const fixture = await createStudentFixture(page);
  await page.evaluate(async ({ studentId }) => {
    await window.store.patch('students', studentId, { note: 'ملاحظة قديمة' });
    await window.store.migrateLegacyStudentNotes();
  }, fixture);
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await expect(page.getByText('ملاحظة قديمة')).toBeVisible();
  await page.reload();
  await expect(page.getByText('ملاحظة قديمة')).toHaveCount(1);

  const other = await context.newPage();
  await other.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  await other.waitForFunction(() => window.store);
  await page.getByRole('button', { name: 'ملاحظة جديدة' }).click();
  await page.locator('#student-note-text').fill('ملاحظة متعددة التبويبات');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(other.getByText('ملاحظة متعددة التبويبات')).toBeVisible();
  await other.close();
});