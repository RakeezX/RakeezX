import { test, expect } from '@playwright/test';

test('manual scoring persists and reports correctly without duplicate records', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true, { timeout: 15_000 });

  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'score-year', name: 'TEST Year' }],
      terms: [{ id: 'score-term', yearId: 'score-year', name: 'TEST Term' }],
      subjects: [{ id: 'score-subject', name: 'TEST Scoring' }],
      sections: [{ id: 'score-section', yearId: 'score-year', grade: 4, label: 'T', name: 'TEST 4/T', order: 0 }],
      teachings: [{ id: 'score-teaching', sectionId: 'score-section', subjectId: 'score-subject', termId: 'score-term', order: 0 }],
      students: [
        { id: 'score-student-a', name: 'TEST Score A', status: 'active' },
        { id: 'score-student-b', name: 'TEST Score B', status: 'active' },
        { id: 'score-student-c', name: 'TEST Score C', status: 'active' },
      ],
      enrollments: [
        { id: 'score-enrollment-a', studentId: 'score-student-a', sectionId: 'score-section', status: 'active', rollNo: 1 },
        { id: 'score-enrollment-b', studentId: 'score-student-b', sectionId: 'score-section', status: 'active', rollNo: 2 },
        { id: 'score-enrollment-c', studentId: 'score-student-c', sectionId: 'score-section', status: 'active', rollNo: 3 },
      ],
    });
    await window.store.patchDevice({ activeYearId: 'score-year', activeTermId: 'score-term' });
    window.store.repaint();
  });

  await page.goto('/#/teaching/score-teaching/items');
  const addItem = async (name, max) => {
    await page.locator('[data-act="add"]').first().click();
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="max"]', String(max));
    await page.click('button[form="item-form"]');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  };
  // These are manual items; no deferred D-11 participation behavior is introduced.
  await addItem('TEST Homework', 10);
  await addItem('TEST Participation', 10);
  await addItem('TEST Project', 10);
  await addItem('TEST Behavior', 10);
  await addItem('TEST Test', 20);
  expect(await page.locator('.row').filter({ hasText: 'TEST Participation' }).count()).toBe(1);

  const itemIds = await page.evaluate(() => Object.fromEntries(
    window.store.state.items
      .filter((item) => item.teachingId === 'score-teaching' && !item.deleted)
      .map((item) => [item.name, item.id]),
  ));
  expect(Object.keys(itemIds)).toHaveLength(5);

  await page.goto('/#/teaching/score-teaching/grades');
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  const enter = async (studentId, itemName, value) => {
    const input = page.locator(`input[data-fk="t-${studentId}-${itemIds[itemName]}"]`);
    await input.fill(String(value));
    await input.press('Tab');
  };
  await enter('score-student-a', 'TEST Homework', 9);
  await enter('score-student-a', 'TEST Participation', 8);
  await enter('score-student-a', 'TEST Project', 10);
  await enter('score-student-a', 'TEST Behavior', 7);
  await enter('score-student-a', 'TEST Test', 18);
  await enter('score-student-b', 'TEST Homework', 5);
  await enter('score-student-b', 'TEST Project', 6);
  await enter('score-student-b', 'TEST Behavior', 8);
  await enter('score-student-b', 'TEST Test', 12);
  await enter('score-student-c', 'TEST Homework', 10);
  await enter('score-student-c', 'TEST Participation', 10);
  await enter('score-student-c', 'TEST Behavior', 10);
  await enter('score-student-c', 'TEST Test', 20);

  const beforeReload = await page.evaluate(() => {
    const { roster, items, ctx } = window.store.teachingContext('score-teaching');
    const totals = Object.fromEntries(roster.map((student) => {
      const values = items.map((item) => ({ item, value: ctx[student.id].scoresByItem[item.id]?.value }));
      const graded = values.filter(({ value }) => value !== null && value !== undefined);
      const earned = graded.reduce((sum, { value }) => sum + value, 0);
      const outOfGraded = graded.reduce((sum, { item }) => sum + item.max, 0);
      return [student.id, {
        earned, outOfGraded, missing: items.length - graded.length,
        pct: outOfGraded ? earned / outOfGraded * 100 : null,
      }];
    }));
    const scores = window.store.state.scores
      .filter((score) => !score.deleted && Object.values(ctx).some((entry) => Object.values(entry.scoresByItem).some((record) => record.id === score.id)));
    return { totals, scores: scores.map(({ id, studentId, itemId, value }) => ({ id, studentId, itemId, value })) };
  });
  expect(beforeReload.totals).toEqual({
    'score-student-a': { earned: 52, outOfGraded: 60, missing: 0, pct: 52 / 60 * 100 },
    'score-student-b': { earned: 31, outOfGraded: 50, missing: 1, pct: 62 },
    'score-student-c': { earned: 50, outOfGraded: 50, missing: 1, pct: 100 },
  });
  expect(beforeReload.scores).toHaveLength(13);
  expect(new Set(beforeReload.scores.map((score) => score.id)).size).toBe(13);

  await page.reload();
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  expect(await page.evaluate(() => window.store.state.scores.filter((score) => !score.deleted).length)).toBe(13);
  await expect(page.locator('input[data-fk="t-score-student-a-' + itemIds['TEST Test'] + '"]')).toHaveValue('18');

  // Editing section metadata through its real sheet preserves item and score identities.
  await page.goto('/#/teaching/score-teaching');
  await page.locator('[data-act="edit-sec"]').click();
  await page.selectOption('select[name="grade"]', '5');
  await page.fill('input[name="label"]', 'U');
  await page.click('button[form="edit-sec-form"]');
  await expect(page.locator('#toast')).toContainText('تم تعديل');
  expect(await page.evaluate(() => ({
    section: window.store.state.sections.find((section) => section.id === 'score-section'),
    scoreIds: window.store.state.scores.filter((score) => !score.deleted).map((score) => score.id).sort(),
  }))).toMatchObject({
    section: { id: 'score-section', grade: 5, label: 'U' },
    scoreIds: beforeReload.scores.map((score) => score.id).sort(),
  });

  await page.goto('/#/teaching/score-teaching/reports');
  await expect(page.locator('.gtable--report')).toContainText('TEST Score A');
  await expect(page.locator('.gtable--report')).toContainText('TEST Score B');
  await expect(page.locator('.gtable--report')).toContainText('TEST Score C');
  await expect(page.locator('.gtable--report')).toContainText('52');
  await expect(page.locator('.gtable--report')).toContainText('31');
  await expect(page.locator('.gtable--report')).toContainText('50');

  expect(errors).toEqual([]);
});
