import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 680, label: '320px' },
  { width: 390, height: 844, label: '390px' },
  { width: 1024, height: 768, label: 'desktop' },
]) {
  test(`Class Hub density and safe delete warning — ${viewport.label}`, async ({ page }) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);

    const fixture = await page.evaluate(async () => {
      const section = await window.store.createSection({ grade: 4, label: `تحسين-${Date.now()}`, name: 'الرابع / تحسين' });
      const teaching = await window.store.createTeaching({ sectionId: section.id });
      const student = await window.store.addStudent(section.id, 'طالب اختبار الحذف');
      const enrollment = window.store.state.enrollments.find((item) => item.studentId === student.id && item.sectionId === section.id);
      return { sectionId: section.id, teachingId: teaching.id, studentId: student.id, enrollmentId: enrollment.id };
    });
    const classLink = page.locator(`a.class-card__main[href="#/teaching/${fixture.teachingId}"]`);
    await expect(classLink).toBeVisible();
    await classLink.click();
    await expect(page.locator('.class-hub')).toBeVisible();
    await expect(page.locator('.class-hub__settings')).toBeVisible();
    await expect(page.locator('.class-hub .tile')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    const deleteButton = page.getByRole('button', { name: 'حذف الإسناد' });
    await expect(deleteButton).toBeVisible();
    if (viewport.width <= 540) {
      const box = await deleteButton.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(36);
    } else {
      await expect(deleteButton).toContainText('حذف الإسناد');
    }

    await deleteButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('سيتم حذف بيانات هذا الإسناد مثل بنود التقييم والدرجات والحصص والحضور والسجل.')).toBeVisible();
    await expect(dialog.getByText('الطلاب وانتسابهم للشعبة سيبقون كما هم دون أي تعديل أو حذف.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    await dialog.getByRole('button', { name: 'إلغاء' }).click();
    expect(await page.evaluate((id) => window.store.state.teachings.some((item) => item.id === id && !item.deleted), fixture.teachingId)).toBe(true);

    await deleteButton.click();
    await page.getByRole('dialog').getByRole('button', { name: 'حذف الإسناد' }).click();
    await page.waitForURL(/#\/classes/);
    const state = await page.evaluate((ids) => ({
      teachingDeleted: window.store.state.teachings.some((item) => item.id === ids.teachingId && item.deleted),
      sectionActive: window.store.state.sections.some((item) => item.id === ids.sectionId && !item.deleted),
      studentActive: window.store.state.students.some((item) => item.id === ids.studentId && !item.deleted),
      enrollmentActive: window.store.state.enrollments.some((item) => item.id === ids.enrollmentId && !item.deleted),
    }), fixture);
    expect(state).toEqual({ teachingDeleted: true, sectionActive: true, studentActive: true, enrollmentActive: true });
    expect(errors.filter((error) => !error.includes('favicon'))).toEqual([]);
  });
}