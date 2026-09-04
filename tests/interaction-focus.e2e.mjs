import { test, expect } from '@playwright/test';

test('a changed grade keeps the first Grades-tab click and persists after reload', async ({ page }) => {
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
        { id: 'interaction:participation', teachingId: 'interaction:teaching', name: 'المشاركة', max: 5, auto: 'participation', perPoint: 1, order: 1 },
      ],
      scores: [{ id: 'interaction:score:a', studentId: 'interaction:student:a', itemId: 'interaction:item', value: 5 }],
    });
    await window.store.patchDevice({ activeYearId: 'interaction:year', activeTermId: 'interaction:term' });
    window.store.repaint();
  });

  await page.goto('/#/teaching/interaction:teaching/grades');
  const itemInput = page.locator('input[data-fk="g-interaction:student:a-interaction:item"]');
  const participation = page.getByRole('tab', { name: /المشاركة/ });

  // A: unchanged input → first tab click.
  await itemInput.click();
  await participation.click();
  await expect(participation).toHaveAttribute('aria-selected', 'true');

  // B: changed input → first tab click, with no local full-page replacement.
  const testTab = page.getByRole('tab', { name: /اختبار/ });
  await testTab.click();
  await expect(testTab).toHaveAttribute('aria-selected', 'true');
  await page.evaluate(() => {
    let count = 0;
    const main = document.getElementById('main');
    const observer = new MutationObserver((mutations) => {
      count += mutations.filter((mutation) => mutation.type === 'childList' && mutation.removedNodes.length).length;
    });
    observer.observe(main, { childList: true });
    window.__interactionReplacementCount = () => count;
    window.__interactionReplacementObserver = observer;
  });
  await itemInput.fill('8');
  await participation.click();
  await expect(participation).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => window.__interactionReplacementCount())).toBe(1);
  await page.evaluate(() => window.__interactionReplacementObserver.disconnect());

  // C: changed input → next grade input, with the first click focusing it.
  await page.getByRole('tab', { name: /اختبار/ }).click();
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  const first = page.locator('input[data-fk="t-interaction:student:a-interaction:item"]');
  const next = page.locator('input[data-fk="t-interaction:student:b-interaction:item"]');
  await first.fill('7');
  await next.click();
  await expect(next).toBeFocused();
  await page.waitForFunction(() => window.store.state.scores.some((score) =>
    !score.deleted && score.studentId === 'interaction:student:a' && score.itemId === 'interaction:item' && score.value === 7));

  // D: the saved value survives a real reload.
  await page.reload();
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  await expect(page.locator('input[data-fk="t-interaction:student:a-interaction:item"]')).toHaveValue('7');
  expect(errors).toEqual([]);
});
