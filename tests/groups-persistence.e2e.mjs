import { test, expect } from '@playwright/test';

async function seedGroups(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const students = Array.from({ length: 6 }, (_, index) => ({
      id: 'groups-persist-student-' + index,
      name: 'طالب مجموعات ' + (index + 1),
      status: 'active',
    }));
    await window.store.save({
      years: [{ id: 'groups-persist-year', label: '1448-1449' }],
      terms: [{ id: 'groups-persist-term', yearId: 'groups-persist-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'groups-persist-subject', name: 'العلوم' }],
      sections: [{ id: 'groups-persist-section', yearId: 'groups-persist-year', grade: 5, label: '1' }],
      teachings: [{ id: 'groups-persist-teaching', sectionId: 'groups-persist-section', subjectId: 'groups-persist-subject', termId: 'groups-persist-term' }],
      students,
      enrollments: students.map((student, index) => ({
        id: 'groups-persist-enrollment-' + index,
        studentId: student.id,
        sectionId: 'groups-persist-section',
        status: 'active',
        rollNo: index + 1,
      })),
      sessions: [{ id: 'groups-persist-session', teachingId: 'groups-persist-teaching', date: today, period: 1 }],
      attendance: [{ id: 'groups-persist-absence', sessionId: 'groups-persist-session', studentId: 'groups-persist-student-5', status: 'absent' }],
    });
  });
}

test('Groups saves a full-roster base arrangement locally across reloads and tabs', async ({ page }) => {
  const teachingId = 'groups-persist-teaching';
  await seedGroups(page);
  await page.goto('/#/teaching/' + teachingId + '/groups');

  await page.getByRole('button', { name: /قسّم المجموعات/ }).click();
  await expect.poll(() => page.evaluate((id) => window.store.state.device.groupArrangements?.[id]?.flat().length ?? 0, teachingId)).toBe(6);

  const baseBeforeMove = await page.evaluate((id) => window.store.state.device.groupArrangements[id], teachingId);
  expect(new Set(baseBeforeMove.flat()).size).toBe(6);
  await expect(page.locator('.group__member')).toHaveCount(5);

  const peer = await page.context().newPage();
  await peer.goto('/#/teaching/' + teachingId + '/groups');
  await expect.poll(() => peer.evaluate((id) => window.store.state.device.groupArrangements?.[id]?.flat().length ?? 0, teachingId)).toBe(6);

  const firstMember = page.locator('.group').nth(0).locator('.group__member').first();
  const movingId = await firstMember.getAttribute('data-student-id');
  await firstMember.click();
  await page.locator('.group').nth(1).getByRole('button', { name: /نقل/ }).click();

  await expect.poll(() => page.evaluate((id) => window.store.state.device.groupArrangements[id], teachingId)).not.toEqual(baseBeforeMove);
  const moved = await page.evaluate((id) => window.store.state.device.groupArrangements[id], teachingId);
  expect(new Set(moved.flat()).size).toBe(6);
  expect(moved.flat().filter((id) => id === movingId)).toHaveLength(1);

  await expect.poll(() => peer.evaluate((id) => window.store.state.device.groupArrangements[id], teachingId)).toEqual(moved);
  await page.reload();
  await expect.poll(() => page.evaluate((id) => window.store.state.device.groupArrangements[id], teachingId)).toEqual(moved);
  await expect(page.locator('.group__member')).toHaveCount(5);

  await page.locator('[data-change="toggle-absent"]').check();
  await expect(page.locator('.group__member')).toHaveCount(6);
  expect(await page.evaluate((id) => window.store.state.device.groupArrangements[id], teachingId)).toEqual(moved);
  await peer.close();
});