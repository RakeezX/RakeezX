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

  test('Section edit button works and completes an edit', async ({ page }) => {
    await page.goto('/#/classes');
    await page.evaluate(async () => {
      await window.store.save({
        sections: [{ id: 'sec1', yearId: 'y1', grade: 4, label: 'أ', name: '4/أ', order: 0 }],
        teachings: [{ id: 'tch1', sectionId: 'sec1', subjectId: 'sub1', termId: 't1', order: 0 }]
      });
      window.store.repaint();
    });

    await page.goto('/#/teaching/tch1');
    await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });
    
    // Click edit button
    await page.locator('[data-act="edit-sec"]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    
    // Change label to 'ب'
    await page.fill('input[name="label"]', 'ب');
    await page.click('button[form="edit-sec-form"]');
    
    // Check if the toast says "تم تعديل الشعبة بنجاح"
    await expect(page.locator('#toast')).toContainText('تم تعديل');
    
    // Verify title updated
    await expect(page.locator('.topbar__title').first()).toContainText('الرابع الابتدائي / ب');
  });

  test('Schedule duplicate rejection and in-place editing', async ({ page }) => {
    await page.goto('/#/schedule');
    await page.evaluate(async () => {
      await window.store.save({
        years: [{ id: 'y1', name: '2024' }],
        terms: [{ id: 't1', yearId: 'y1', name: 'Term 1' }],
        subjects: [{ id: 'sub1', name: 'Math' }],
        sections: [{ id: 'sec1', yearId: 'y1', grade: 4, label: 'أ', name: '4/أ', order: 0 }],
        teachings: [{ id: 'tch1', sectionId: 'sec1', subjectId: 'sub1', termId: 't1', order: 0 }]
      });
      await window.store.patchDevice({ activeYearId: 'y1', activeTermId: 't1' });
      window.store.repaint();
    });

    await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });

    // Add first slot
    await page.locator('[data-act="add"]').first().click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('select[name="teachingId"]')).toBeVisible({ timeout: 10000 });
    
    await page.selectOption('select[name="weekday"]', '0'); // Sunday
    await page.selectOption('select[name="period"]', '1');  // Period 1
    await page.click('button[form="slot-form"]');
    
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الأولى' })).toBeVisible();

    // Try adding duplicate
    await page.locator('[data-act="add"]').first().click();
    await expect(page.locator('.sheet')).toBeVisible();
    await page.selectOption('select[name="weekday"]', '0'); // Sunday
    await page.selectOption('select[name="period"]', '1');  // Period 1
    await page.click('button[form="slot-form"]');
    
    await expect(page.locator('#toast')).toContainText('مسجلة بالفعل');

    // 1. Click edit on the existing Sunday P1 slot
    const firstSlotId = await page.locator('.slot').filter({ hasText: 'الحصة الأولى' }).getAttribute('id');
    await page.locator('.slot').filter({ hasText: 'الحصة الأولى' }).locator('[data-act="edit"]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    
    // 2. Edit the SAME slot to Monday (1) / Period 4
    await page.selectOption('select[name="weekday"]', '1');
    await page.selectOption('select[name="period"]', '4');
    await page.click('button[form="slot-form"]');
    
    // 3. Confirm it visibly moved
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الرابعة' })).toBeVisible();
    
    // 4. Now create: Sunday / Period 1 / DIFFERENT Teaching (we only have one teaching in mock, so we'll use same teaching but new slot ID)
    // Wait, let's just add it to Sunday P1. If old is released, this will succeed.
    await page.locator('[data-act="add"]').first().click();
    await expect(page.locator('.sheet')).toBeVisible();
    await page.selectOption('select[name="weekday"]', '0'); // Sunday
    await page.selectOption('select[name="period"]', '1');  // Period 1
    await page.click('button[form="slot-form"]');
    
    // Expected SUCCESS, toast shown
    await expect(page.locator('#toast')).toContainText('أُضيفت');
    
    // 5. Attempt another: Sunday P1
    await page.locator('[data-act="add"]').first().click();
    await expect(page.locator('.sheet')).toBeVisible();
    await page.selectOption('select[name="weekday"]', '0'); // Sunday
    await page.selectOption('select[name="period"]', '1');  // Period 1
    await page.click('button[form="slot-form"]');
    
    // Expected REJECT
    await expect(page.locator('#toast')).toContainText('مسجلة بالفعل');
    await page.keyboard.press('Escape'); // Close modal manually here since it didn't submit
    
    // 6. Reload the app
    await page.reload();
    
    // 7. Check occupancy
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الأولى' })).toBeVisible();
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الرابعة' })).toBeVisible();
    
    // 8. Verify ID preserved
    const editedSlotId = await page.locator('.slot').filter({ hasText: 'الحصة الرابعة' }).getAttribute('id');
    expect(editedSlotId).toBe(firstSlotId);
    
    expect(errors).toEqual([]);
  });
});
