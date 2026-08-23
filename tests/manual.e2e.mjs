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
    await expect(page.locator('.topbar__title').first()).toContainText('4/ب');
  });

  test('Schedule duplicate rejection and in-place editing', async ({ page }) => {
    await page.goto('/#/schedule');
    await page.evaluate(async () => {
      await window.store.save({
        sections: [{ id: 'sec1', yearId: 'y1', grade: 4, label: 'أ', name: '4/أ', order: 0 }],
        teachings: [{ id: 'tch1', sectionId: 'sec1', subjectId: 'sub1', termId: 't1', order: 0 }]
      });
      window.store.repaint();
    });

    await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15000 });

    // Add first slot
    await page.locator('[data-act="add"]').first().click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('select[name="teachingId"] option').first()).toBeVisible({ timeout: 10000 });
    
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
    await page.locator('[data-sheet-close]').first().click();

    // Click edit on the slot
    await page.locator('.slot').filter({ hasText: 'الحصة الأولى' }).locator('[data-act="edit"]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    
    // Change period to 2
    await page.selectOption('select[name="period"]', '2');
    await page.click('button[form="slot-form"]');
    
    await expect(page.locator('#toast')).toContainText('تم تعديل الحصة');
    await expect(page.locator('.slot').filter({ hasText: 'الحصة الثانية' })).toBeVisible();
    
    expect(errors).toEqual([]);
  });
});
