import { test, expect } from '@playwright/test';

test('attendance toolbar dates wrap cleanly and retain filtering at desktop, 390 and 320', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'n69-year', label: 'N69 Year' }],
      sections: [{ id: 'n69-section', yearId: 'n69-year', label: 'A' }],
      teachings: [{ id: 'n69-teaching', sectionId: 'n69-section', subjectId: 'n69-subject', termId: 'n69-term' }],
      students: [{ id: 'n69-student', name: 'N69 Student', status: 'active' }],
      enrollments: [{ id: 'n69-enrollment', studentId: 'n69-student', sectionId: 'n69-section', status: 'active' }],
      sessions: [
        { id: 'n69-session-a', teachingId: 'n69-teaching', date: '2026-08-01', period: 1 },
        { id: 'n69-session-b', teachingId: 'n69-teaching', date: '2026-08-02', period: 1 },
      ],
      attendance: [
        { id: 'n69-attendance-a', studentId: 'n69-student', sessionId: 'n69-session-a', status: 'absent' },
        { id: 'n69-attendance-b', studentId: 'n69-student', sessionId: 'n69-session-b', status: 'present' },
      ],
    });
    window.store.repaint();
  });
  await page.goto('/#/teaching/n69-teaching/reports');
  await page.locator('[data-act="tab"][data-tab="attendance"]').click();
  const toolbar = page.locator('.report-toolbar');
  const start = toolbar.locator('[data-change="filter-start"]');
  const end = toolbar.locator('[data-change="filter-end"]');
  await expect(start).toBeVisible();
  await expect(end).toBeVisible();
  await expect(page.locator('.attendance-date-range')).toHaveCount(0);
  await start.fill('2026-08-02');
  await start.press('Tab');
  await end.fill('2026-08-02');
  await end.press('Tab');
  await expect(page.locator('.report-document .gtable--report')).toContainText('100%');
  await toolbar.locator('[data-mode="detailed"]').click();
  await expect(page.locator('.report-document')).toContainText('1 حصة مرصودة');
  await toolbar.locator('[data-act="toggle-a4"]').click();
  await expect(page.locator('.a4-preview-container')).toBeVisible();

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(start).toHaveValue('2026-08-02');
      await expect(end).toHaveValue('2026-08-02');
      const geometry = await page.evaluate(() => {
        const controls = [
          ['select[data-change="sort"]', 90],
          ['input[data-change="filter-start"]', 90],
          ['input[data-change="filter-end"]', 90],
          ['button[data-mode="brief"]', 44],
          ['button[data-mode="detailed"]', 44],
          ['button[data-act="toggle-a4"]', 90],
        ];
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          unreachable: controls.flatMap(([selector, minWidth]) => {
            const control = document.querySelector(`.report-toolbar ${selector}`);
            if (!control) return [selector];
            const box = control.getBoundingClientRect();
            return box.left < -1 || box.right > window.innerWidth + 1 || box.width < minWidth || box.height <= 0
              ? [selector]
              : [];
          }),
        };
      });
      expect(geometry).toEqual({ overflow: false, unreachable: [] });
      for (const selector of [
        '[data-change="sort"]',
        '[data-change="filter-start"]',
        '[data-change="filter-end"]',
        '[data-mode="brief"]',
        '[data-mode="detailed"]',
        '[data-act="toggle-a4"]',
      ]) {
        await toolbar.locator(selector).click({ trial: true });
      }
    }
  }
  expect(errors).toEqual([]);
});
