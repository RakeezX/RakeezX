import { test, expect } from '@playwright/test';

test.describe('Manual Acceptance Requirements', () => {
  let errors = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', e => errors.push(e.message));
  });

  test('Empty-state/setup CTA is visible when no sections exist', async ({ page }) => {
    await page.goto('/#/classes');
    await expect(page.locator('.sidebar__brand').or(page.locator('.topbar__title')).first()).toBeVisible({ timeout: 15000 });
    
    const ctaVisible = await page.getByRole('button', { name: /إعداد الفصول/ }).first().isVisible();
    expect(ctaVisible).toBe(true);
  });

  test('Section edit uses the canonical grade catalog and preserves section identity', async ({ page }) => {
    const expectedGrades = [
      'الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي',
      'الخامس الابتدائي', 'السادس الابتدائي', 'الأول المتوسط', 'الثاني المتوسط',
      'الثالث المتوسط', 'الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي',
    ];

    await page.goto('/#/classes');
    await page.evaluate(async () => {
      await window.store.save({
        years: [{ id: 'y1', name: '2024' }],
        terms: [{ id: 't1', yearId: 'y1', name: 'Term 1' }],
        subjects: [{ id: 'sub1', name: 'Math A' }, { id: 'sub2', name: 'Math B' }],
        sections: [
          { id: 'sec1', yearId: 'y1', grade: 4, label: '1', name: '4/1', order: 0 },
          { id: 'sec2', yearId: 'y1', grade: 5, label: '6', name: '5/6', order: 1 },
        ],
        teachings: [
          { id: 'tch1', sectionId: 'sec1', subjectId: 'sub1', termId: 't1', order: 0 },
          { id: 'tch2', sectionId: 'sec2', subjectId: 'sub2', termId: 't1', order: 1 },
        ],
      });
      await window.store.patchDevice({ activeYearId: 'y1', activeTermId: 't1' });
      window.store.repaint();
    });

    await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });

    // The create-section sheet uses the canonical 12-grade catalog.
    await page.locator('[data-act="add"]').first().click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('select[name="grade"] option').allTextContents()).resolves.toEqual(expectedGrades);
    await page.keyboard.press('Escape');

    // Edit section 4/1 to 5/5 through the real teaching-hub sheet.
    await page.goto('/#/teaching/tch1');
    await expect(page.locator('.topbar__title').first()).toContainText('الرابع الابتدائي / 1');
    await page.locator('[data-act="edit-sec"]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('select[name="grade"] option').allTextContents()).resolves.toEqual(expectedGrades);
    await page.selectOption('select[name="grade"]', '5');
    await page.fill('input[name="label"]', '5');
    await page.click('button[form="edit-sec-form"]');

    await expect(page.locator('#toast')).toContainText('تم تعديل');
    await expect(page.locator('#toast')).not.toContainText('store.repaint is not a function');
    await expect(page.locator('.topbar__title').first()).toContainText('الخامس الابتدائي / 5');

    const editedBeforeReload = await page.evaluate(() => {
      const section = window.store.state.sections.find((item) => item.id === 'sec1');
      return { id: section.id, grade: section.grade, label: section.label };
    });
    expect(editedBeforeReload).toEqual({ id: 'sec1', grade: 5, label: '5' });

    await page.reload();
    await expect(page.locator('.topbar__title').first()).toContainText('الخامس الابتدائي / 5');
    await expect(page.locator('[data-act="edit-sec"]')).toBeVisible();
    expect(await page.evaluate(() => {
      const section = window.store.state.sections.find((item) => item.id === 'sec1');
      return { id: section.id, grade: section.grade, label: section.label };
    })).toEqual(editedBeforeReload);

    // A same-year, same-grade, same-label edit remains rejected.
    await page.goto('/#/teaching/tch2');
    await expect(page.locator('.topbar__title').first()).toContainText('الخامس الابتدائي / 6');
    await page.locator('[data-act="edit-sec"]').click();
    await page.selectOption('select[name="grade"]', '5');
    await page.fill('input[name="label"]', '5');
    await page.click('button[form="edit-sec-form"]');
    await expect(page.locator('#toast')).toContainText('موجود مسبقاً');
    expect(await page.evaluate(() => {
      const section = window.store.state.sections.find((item) => item.id === 'sec2');
      return { id: section.id, grade: section.grade, label: section.label };
    })).toEqual({ id: 'sec2', grade: 5, label: '6' });

    expect(errors).toEqual([]);
  });
  test('Schedule edit releases the old position without changing slot identity', async ({ page }) => {
    await page.goto('/#/schedule');
    await page.evaluate(async () => {
      await window.store.save({
        years: [{ id: 'y1', name: '2024' }],
        terms: [{ id: 't1', yearId: 'y1', name: 'Term 1' }],
        subjects: [
          { id: 'subA', name: 'Math A' },
          { id: 'subB', name: 'Math B' },
          { id: 'subC', name: 'Math C' },
        ],
        sections: [{ id: 'sec1', yearId: 'y1', grade: 4, label: 'أ', name: '4/أ', order: 0 }],
        teachings: [
          { id: 'tchA', sectionId: 'sec1', subjectId: 'subA', termId: 't1', order: 0 },
          { id: 'tchB', sectionId: 'sec1', subjectId: 'subB', termId: 't1', order: 1 },
          { id: 'tchC', sectionId: 'sec1', subjectId: 'subC', termId: 't1', order: 2 },
        ],
      });
      await window.store.patchDevice({ activeYearId: 'y1', activeTermId: 't1' });
      window.store.repaint();
    });

    await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });

    const addSlot = async (teachingId, weekday, period) => {
      await page.locator('[data-act="add"]').first().click();
      await expect(page.locator('.sheet')).toBeVisible();
      await page.selectOption('select[name="teachingId"]', teachingId);
      await page.selectOption('select[name="weekday"]', weekday);
      await page.selectOption('select[name="period"]', period);
      await page.click('button[form="slot-form"]');
    };

    // Teaching A: Sunday / Period 1.
    await addSlot('tchA', '0', '1');
    await expect(page.locator('#toast')).toContainText('أُضيفت');
    const firstSlotId = await page.locator('.slot').filter({ hasText: 'الحصة الأولى' }).locator('[data-act="edit"]').getAttribute('data-id');
    expect(firstSlotId).toBeTruthy();

    // Move the same slot to Monday / Period 4.
    await page.locator('.slot').filter({ hasText: 'الحصة الأولى' }).locator('[data-act="edit"]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    await page.selectOption('select[name="weekday"]', '1');
    await page.selectOption('select[name="period"]', '4');
    await page.click('button[form="slot-form"]');
    await expect(page.locator('#toast')).toContainText('تم تعديل');
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الرابعة' })).toBeVisible();

    // Teaching B can now use the released Sunday / Period 1 position.
    await addSlot('tchB', '0', '1');
    await expect(page.locator('#toast')).toContainText('أُضيفت');

    // Teaching C is rejected because Teaching B occupies Sunday / Period 1.
    await addSlot('tchC', '0', '1');
    await expect(page.locator('#toast')).toContainText('مسجلة بالفعل');
    await page.keyboard.press('Escape');

    const snapshot = () => window.store.state.slots
      .filter((slot) => ['tchA', 'tchB', 'tchC'].includes(slot.teachingId))
      .map(({ id, teachingId, weekday, period }) => ({ id, teachingId, weekday, period }));
    const beforeReload = await page.evaluate(snapshot);
    expect(beforeReload).toEqual([
      { id: firstSlotId, teachingId: 'tchA', weekday: 1, period: 4 },
      expect.objectContaining({ teachingId: 'tchB', weekday: 0, period: 1 }),
    ]);

    await page.reload();
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الأولى' })).toBeVisible();
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الرابعة' })).toBeVisible();
    const editedSlotId = await page.locator('.slot').filter({ hasText: 'الحصة الرابعة' }).locator('[data-act="edit"]').getAttribute('data-id');
    expect(editedSlotId).toBe(firstSlotId);

    const afterReload = await page.evaluate(snapshot);
    expect(afterReload).toEqual(beforeReload);
    expect(errors).toEqual([]);
  });
});
