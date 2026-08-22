import { test, expect } from '@playwright/test';

test.describe('Multi-tab Synchronization', () => {
  test('Changes in one tab broadcast and sync to another tab', async ({ context }) => {
    // Tab A
    const pageA = await context.newPage();
    await pageA.goto('/');
    await expect(pageA.locator('.sidebar__brand').or(pageA.locator('.topbar__title')).first()).toBeVisible({ timeout: 15000 });
    
    // Tab B
    const pageB = await context.newPage();
    await pageB.goto('/');
    await expect(pageB.locator('.sidebar__brand').or(pageB.locator('.topbar__title')).first()).toBeVisible({ timeout: 15000 });

    // Go to Settings in both tabs
    await pageA.goto('/#/settings');
    await pageB.goto('/#/settings');

    // Wait for the inputs to be visible
    const inputA = pageA.locator('input[name="teacherName"]');
    await expect(inputA).toBeVisible({ timeout: 5000 });
    const inputB = pageB.locator('input[name="teacherName"]');
    await expect(inputB).toBeVisible({ timeout: 5000 });

    // In Tab A, change the teacher name
    await inputA.fill('Test Teacher Tab A');
    await inputA.evaluate(node => node.dispatchEvent(new Event('change', { bubbles: true })));

    // Wait a bit for BroadcastChannel to propagate and Tab B to re-render
    await pageB.waitForTimeout(1000);

    // Tab B should now have the new value
    await expect(inputB).toHaveValue('Test Teacher Tab A');

    // Clean up
    await inputA.fill('');
    await inputA.evaluate(node => node.dispatchEvent(new Event('change', { bubbles: true })));
    await pageB.waitForTimeout(500);
  });
});
