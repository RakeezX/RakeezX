import { test, expect } from '@playwright/test';

const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 1024, height: 768 },
];

async function seedQuickLog(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store, { timeout: 15_000 });
  await page.evaluate(async () => {
    const students = Array.from({ length: 8 }, (_, index) => ({ id: `ql-mobile-student-${index}`, name: `طالب تجريبي ${index + 1}`, status: 'active' }));
    await window.store.save({
      years: [{ id: 'ql-mobile-year', label: '1448-1449' }],
      terms: [{ id: 'ql-mobile-term', yearId: 'ql-mobile-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'ql-mobile-subject', name: 'المهارات الرقمية' }],
      sections: [{ id: 'ql-mobile-section', yearId: 'ql-mobile-year', grade: 5, label: '1' }],
      teachings: [{ id: 'ql-mobile-teaching', sectionId: 'ql-mobile-section', subjectId: 'ql-mobile-subject', termId: 'ql-mobile-term' }],
      students,
      enrollments: students.map((student, index) => ({ id: `ql-mobile-enrollment-${index}`, studentId: student.id, sectionId: 'ql-mobile-section', status: 'active', rollNo: index + 1 })),
    });
    window.store.repaint();
  });
}

test('Quick Log remains fully usable and RTL-safe across narrow mobile viewports', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await seedQuickLog(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/#/teaching/ql-mobile-teaching/quicklog');
    const behavior = page.getByRole('button', { name: 'سجل السلوك فقط' });
    const participation = page.getByRole('button', { name: 'المشاركة' });
    await expect(behavior).toBeVisible();
    await expect(participation).toBeVisible();
    await behavior.click();
    await expect(behavior).toHaveClass(/is-on/);
    await participation.click();
    await expect(participation).toHaveClass(/is-on/);
    await expect(page.locator('[data-change="reason"]')).toBeVisible();
    await expect(page.locator('.qlcard').first()).toBeVisible();
    if (viewport.width < 900) await expect(page.locator('.tabbar')).toBeVisible();
    else await expect(page.locator('.tabbar')).toBeHidden();

    expect(await page.evaluate(() => ({
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
      rtl: document.documentElement.dir === 'rtl',
      cardsFit: [...document.querySelectorAll('.qlcard')].every((card) => {
        const box = card.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth;
      }),
      tabbarFits: (() => {
        const bar = document.querySelector('.tabbar');
        if (getComputedStyle(bar).display === 'none') return true;
        const box = bar.getBoundingClientRect();
        return box.left === 0 && box.right === window.innerWidth && box.width === window.innerWidth;
      })(),
    }))).toEqual({ documentFits: true, rtl: true, cardsFit: true, tabbarFits: true });
  }

  expect(errors).toEqual([]);
});