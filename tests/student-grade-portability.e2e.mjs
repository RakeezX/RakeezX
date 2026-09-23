import { test, expect } from '@playwright/test';

async function openGrades(page, teachingId) {
  if (await page.evaluate(() => location.hash) !== '#/classes') {
    await page.getByRole('link', { name: 'الفصول', exact: true }).click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/classes');
  }
  await page.locator(`a[href="#/teaching/${teachingId}"]`).click();
  await page.locator(`a[href="#/teaching/${teachingId}/grades"]`).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/teaching/${teachingId}/grades`);
  await page.locator('[data-act="mode"][data-mode="table"]').click();
}

test('a transferred student sees and updates compatible grades from the destination grade screen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);

  const fixture = await page.evaluate(async () => {
    const ids = {
      year: 'grade-portability-e2e:year', term: 'grade-portability-e2e:term', subject: 'grade-portability-e2e:subject',
      x: 'grade-portability-e2e:X', y: 'grade-portability-e2e:Y', teachingX: 'grade-portability-e2e:teaching:X',
      teachingY: 'grade-portability-e2e:teaching:Y', student: 'grade-portability-e2e:student',
      itemX: 'grade-portability-e2e:item:X', itemY: 'grade-portability-e2e:item:Y',
    };
    await window.store.save({
      years: [{ id: ids.year, name: 'سنة اختبار', status: 'active' }],
      terms: [{ id: ids.term, yearId: ids.year, name: 'الفصل الأول', index: 1, status: 'active' }],
      subjects: [{ id: ids.subject, name: 'رياضيات اختبار' }],
      sections: [
        { id: ids.x, yearId: ids.year, grade: 4, label: 'أ', name: '٤/أ' },
        { id: ids.y, yearId: ids.year, grade: 4, label: 'ب', name: '٤/ب' },
      ],
      teachings: [
        { id: ids.teachingX, sectionId: ids.x, subjectId: ids.subject, termId: ids.term },
        { id: ids.teachingY, sectionId: ids.y, subjectId: ids.subject, termId: ids.term },
      ],
      students: [{ id: ids.student, name: 'طالب نقل الدرجات', status: 'active' }],
      enrollments: [{ id: 'grade-portability-e2e:enrollment:X', studentId: ids.student, sectionId: ids.x, status: 'active', rollNo: 1 }],
      items: [
        { id: ids.itemX, teachingId: ids.teachingX, name: 'اختبار قصير', max: 10, auto: null,
          order: 0, portabilityGroupId: 'grade-portability-e2e:reviewed-link' },
        { id: ids.itemY, teachingId: ids.teachingY, name: 'اختبار قصير', max: 10, auto: null,
          order: 0, portabilityGroupId: 'grade-portability-e2e:reviewed-link' },
      ],
      scores: [{ id: `sc:${ids.student}:${ids.itemX}`, studentId: ids.student, itemId: ids.itemX, value: 8 }],
    });
    await window.store.patchDevice({ activeYearId: ids.year, activeTermId: ids.term });
    await window.store.transferStudent(ids.student, ids.y, { date: '2026-09-01' });
    return ids;
  });

  await openGrades(page, fixture.teachingY);
  const destinationInput = page.locator(`input[data-fk="t-${fixture.student}-${fixture.itemY}"]`);
  await expect(destinationInput).toHaveValue('8');

  await destinationInput.fill('9');
  await destinationInput.press('Tab');
  await page.waitForFunction(({ student, itemX, itemY }) => {
    const scores = window.store.state.scores.filter((score) => !score.deleted && score.studentId === student);
    return scores.length === 1 && scores[0].itemId === itemX && scores[0].value === 9 &&
      window.store.studentContext(student, window.store.state.items.find((item) => item.id === itemY)?.teachingId)
        .scoresByItem[itemY]?.value === 9;
  }, fixture);

  await page.evaluate(({ student, x }) => window.store.transferStudent(student, x, { date: '2026-09-08' }), fixture);
  await openGrades(page, fixture.teachingX);
  await expect(page.locator(`input[data-fk="t-${fixture.student}-${fixture.itemX}"]`)).toHaveValue('9');

  await page.evaluate(({ student, y }) => window.store.transferStudent(student, y, { date: '2026-09-15' }), fixture);
  await openGrades(page, fixture.teachingY);
  await page.reload();
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  await expect(destinationInput).toHaveValue('9');
  await page.locator(`a[href^="#/student/${fixture.student}"]`).first().click();
  await expect(page.locator('.student-profile-current-grades .itemrow__val')).toContainText('9 / 10');
  expect(errors).toEqual([]);
});
