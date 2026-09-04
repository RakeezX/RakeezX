import { test, expect } from '@playwright/test';

test('grade entry, immediate next-target click, and class/student navigation keep the first interaction', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'interaction:year', name: 'سنة اختبار', status: 'active' }],
      terms: [{ id: 'interaction:term', yearId: 'interaction:year', name: 'الفصل الأول', index: 1, status: 'active' }],
      subjects: [{ id: 'interaction:subject', name: 'مادة التفاعل' }],
      sections: [{ id: 'interaction:section', yearId: 'interaction:year', grade: 4, label: 'أ' }],
      teachings: [{ id: 'interaction:teaching', sectionId: 'interaction:section', subjectId: 'interaction:subject', termId: 'interaction:term' }],
      students: [
        { id: 'interaction:student:a', name: 'طالب التفاعل أ', status: 'active' },
        { id: 'interaction:student:b', name: 'طالب التفاعل ب', status: 'active' },
      ],
      enrollments: [
        { id: 'interaction:enrollment:a', studentId: 'interaction:student:a', sectionId: 'interaction:section', status: 'active', rollNo: 1 },
        { id: 'interaction:enrollment:b', studentId: 'interaction:student:b', sectionId: 'interaction:section', status: 'active', rollNo: 2 },
      ],
      items: [
        { id: 'interaction:item', teachingId: 'interaction:teaching', name: 'اختبار', max: 10, auto: null, order: 0 },
      ],
    });
    await window.store.patchDevice({ activeYearId: 'interaction:year', activeTermId: 'interaction:term' });
    window.store.repaint();
  });

  await page.locator('a[href="#/teaching/interaction:teaching"]').click();
  await expect(page).toHaveURL(/#\/teaching\/interaction:teaching$/);

  await page.goto('/#/teaching/interaction:teaching/grades');
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  const first = page.locator('input[data-fk="t-interaction:student:a-interaction:item"]');
  const next = page.locator('input[data-fk="t-interaction:student:b-interaction:item"]');
  await first.fill('8');
  await next.click();
  await page.waitForFunction(() => window.store.state.scores.some((score) =>
    !score.deleted && score.studentId === 'interaction:student:a' && score.itemId === 'interaction:item' && score.value === 8));
  await expect(next).toBeFocused();

  await next.fill('6');
  await page.locator('a[href="#/student/interaction:student:a"]').click();
  await expect(page).toHaveURL(/#\/student\/interaction:student:a/);
  await expect(page.getByText('طالب التفاعل أ', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
