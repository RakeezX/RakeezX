import { test, expect } from '@playwright/test';

test.describe('Responsive & Accessibility Audit', () => {
  const VIEWPORTS = [
    { name: 'Mobile (iPhone 12)', width: 390, height: 844 },
    { name: 'Tablet (iPad)', width: 810, height: 1080 },
    { name: 'Desktop (1080p)', width: 1920, height: 1080 }
  ];

  for (const vp of VIEWPORTS) {
    test(`Layout check for ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.addInitScript(() => {
        localStorage.setItem('rakeezx-auth', JSON.stringify({
          access_token: 'fake-token',
          user: { id: 'test-user' }
        }));
      });

      await page.goto('/#/', { waitUntil: 'networkidle' });
      await expect(page.locator('#app')).toBeVisible();

      // Check for horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return docW > winW;
      });

      expect(hasHorizontalScroll).toBe(false); // No horizontal scrolling allowed in the SPA wrapper

      // Navigate through major views
      await page.goto('/#/classes', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      await page.goto('/#/schedule', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      await page.goto('/#/reports', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      await page.goto('/#/settings', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Verify header visibility
      const headerVisible = await page.locator('.topbar').isVisible();
      expect(headerVisible).toBe(true);
    });
  }
});
