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
    const tools = page.locator('.class-hub .tile');
    await expect(tools).toHaveCount(8);
    await expect(tools.locator('.tile__title')).toHaveText([
      'هدف وميثاق الصف',
      'الرصد السريع',
      'القرعة',
      'المجموعات',
      'لوحة التميز',
      'الحصص',
      'التقارير',
      'توزيع الدرجات',
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    // Verify old "حذف الإسناد" button is removed from Class Workspace
    await expect(page.getByRole('button', { name: 'حذف الإسناد' })).toHaveCount(0);

    // Return to classes page and delete via centralized "حذف فصل"
    await page.goto('/#/classes');
    const deleteButton = page.getByRole('button', { name: 'حذف فصل' });
    await expect(deleteButton).toBeVisible();
    const deleteStyles = await deleteButton.evaluate((node) => {
      const dangerProbe = document.createElement('span');
      dangerProbe.style.color = 'var(--danger)';
      node.append(dangerProbe);
      const styles = getComputedStyle(node);
      const result = {
        color: styles.color,
        danger: getComputedStyle(dangerProbe).color,
        background: styles.backgroundColor,
        border: styles.borderTopColor,
      };
      dangerProbe.remove();
      return result;
    });
    expect(deleteStyles.color).toBe(deleteStyles.danger);
    expect(deleteStyles.background).not.toBe('rgba(0, 0, 0, 0)');
    await deleteButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator(`.class-delete-row[data-teaching-id="${fixture.teachingId}"]`).click();
    await dialog.getByRole('button', { name: 'متابعة' }).click();

    await expect(dialog.getByText('سيتم حذف الفصل وبياناته المرتبطة، بما في ذلك الحصص والحضور والدرجات والرصد والملاحظات.')).toBeVisible();
    await expect(dialog.getByText('الطلاب المرتبطون بفصول أو سجلات أخرى ستبقى بياناتهم الأخرى محفوظة.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    await dialog.getByRole('button', { name: 'رجوع' }).click();
    await dialog.getByRole('button', { name: 'إلغاء' }).click();
    expect(await page.evaluate((id) => window.store.state.teachings.some((item) => item.id === id && !item.deleted), fixture.teachingId)).toBe(true);

    await deleteButton.click();
    await dialog.locator(`.class-delete-row[data-teaching-id="${fixture.teachingId}"]`).click();
    await dialog.getByRole('button', { name: 'متابعة' }).click();
    await dialog.getByRole('button', { name: 'تأكيد الحذف' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('لا يمكن حذف الفصل لأنه يحتوي على بيانات محفوظة');
    const state = await page.evaluate((ids) => ({
      teachingDeleted: window.store.state.teachings.some((item) => item.id === ids.teachingId && item.deleted),
      sectionDeleted: window.store.state.sections.some((item) => item.id === ids.sectionId && item.deleted),
      studentDeleted: window.store.state.students.some((item) => item.id === ids.studentId && item.deleted),
      enrollmentDeleted: window.store.state.enrollments.some((item) => item.id === ids.enrollmentId && item.deleted),
    }), fixture);
    expect(state).toEqual({ teachingDeleted: false, sectionDeleted: false, studentDeleted: false, enrollmentDeleted: false });
    expect(errors.filter((error) => !error.includes('favicon'))).toEqual([]);
  });
}
