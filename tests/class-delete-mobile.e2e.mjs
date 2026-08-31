import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 680, label: '320px' },
  { width: 390, height: 844, label: '390px' },
  { width: 1024, height: 768, label: 'desktop' },
]) {
  test(`Centralized class deletion workflow stays responsive and confirmed — ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();

    // Verify trash button is removed from class cards
    await expect(page.locator('.class-card .class-demo-del-btn')).toHaveCount(0);

    // Verify centralized delete button exists in action area
    const deleteButton = page.getByRole('button', { name: 'حذف فصل' });
    await expect(deleteButton).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    // Step 1: Open sheet and select class
    await deleteButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.class-delete-row')).toBeVisible();

    const continueBtn = dialog.getByRole('button', { name: 'متابعة' });
    await expect(continueBtn).toBeVisible();

    // Step 2: Proceed to confirm step
    await continueBtn.click();
    await expect(dialog.locator('.class-delete-confirm-box')).toBeVisible();
    await expect(dialog.getByText('سيتم حذف الفصل وبياناته المرتبطة، بما في ذلك الحصص والحضور والدرجات والرصد والملاحظات.')).toBeVisible();
    await expect(dialog.getByText('الطلاب المرتبطون بفصول أو سجلات أخرى ستبقى بياناتهم الأخرى محفوظة.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'تأكيد الحذف' })).toBeVisible();

    // Cancel closes dialog cleanly
    await dialog.getByRole('button', { name: 'رجوع' }).click();
    await expect(dialog.locator('.class-delete-row')).toBeVisible();
    await dialog.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dialog).toHaveCount(0);

    // Verify Class Workspace does NOT have old visible "حذف الإسناد" action
    const firstClassLink = page.locator('a.class-card__main').first();
    await firstClassLink.click();
    await expect(page.locator('.class-hub')).toBeVisible();
    await expect(page.getByRole('button', { name: 'حذف الإسناد' })).toHaveCount(0);
  });
}

