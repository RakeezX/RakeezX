import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Riyadh' });

async function seedGroups(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    // Attendance is keyed to the device-local date, not the UTC date.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    await window.store.patchDevice({
      activeYearId: 'groups-persist-year',
      activeTermId: 'groups-persist-term',
    }, { queue: false });
  });
}

async function openGroups(page, teachingId) {
  await expect.poll(() => page.evaluate((id) => Boolean(window.store?.getTeaching(id)), teachingId)).toBe(true);
  await page.goto('/#/classes');
  await page.locator(`a[href="#/teaching/${teachingId}"]`).click();
  await page.locator(`a[href="#/teaching/${teachingId}/groups"]`).click();
  await expect(page.getByRole('heading', { name: 'المجموعات', exact: true })).toBeVisible();
}

test('Groups saves one durable full-roster arrangement across reloads and tabs', async ({ page }) => {
  const teachingId = 'groups-persist-teaching';
  // Exercise the Riyadh midnight boundary where UTC still reports yesterday.
  await page.clock.setFixedTime(new Date('2026-09-02T21:30:00Z'));
  await seedGroups(page);
  expect(await page.evaluate(() => window.store.state.sessions[0].date)).toBe('2026-09-03');
  await openGroups(page, teachingId);

  await page.getByRole('button', { name: /قسّم المجموعات/ }).click();
  await expect.poll(() => page.evaluate((id) => window.store.groupArrangementOf(id)?.groups?.flat().length ?? 0, teachingId)).toBe(6);

  const baseBeforeMove = await page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId);
  expect(new Set(baseBeforeMove.flat()).size).toBe(6);
  await expect(page.locator('.group__member')).toHaveCount(5);

  const peer = await page.context().newPage();
  await peer.clock.setFixedTime(new Date('2026-09-02T21:30:00Z'));
  await peer.goto('/#/classes');
  await peer.waitForFunction(() => window.store?.state?.ready === true);
  await openGroups(peer, teachingId);
  await expect.poll(() => peer.evaluate((id) => window.store.groupArrangementOf(id)?.groups?.flat().length ?? 0, teachingId)).toBe(6);

  const firstMember = page.locator('.group').nth(0).locator('.group__member').first();
  const movingId = await firstMember.getAttribute('data-student-id');
  await firstMember.click();
  await page.locator('.group').nth(1).getByRole('button', { name: /نقل/ }).click();

  await expect.poll(() => page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId)).not.toEqual(baseBeforeMove);
  const moved = await page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId);
  expect(new Set(moved.flat()).size).toBe(6);
  expect(moved.flat().filter((id) => id === movingId)).toHaveLength(1);

  await expect.poll(() => peer.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId)).toEqual(moved);
  await expect.poll(() => page.evaluate(async (id) => (await (await import('/src/lib/db.js')).getAll('groupArrangements')).find(row => row.teachingId === id)?.groups, teachingId)).toEqual(await savedGroups(page, teachingId));
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'المجموعات', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId)).toEqual(moved);
  await expect(page.locator('.group__member')).toHaveCount(5);

  await page.locator('[data-change="toggle-absent"]').check();
  await expect(page.locator('.group__member')).toHaveCount(6);
  expect(await page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId)).toEqual(moved);
  await peer.close();
});
async function seedRegenerationGroups(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const students = Array.from({ length: 16 }, (_, index) => ({
      id: 'groups-regenerate-student-' + index,
      name: 'طالب إعادة التقسيم ' + (index + 1),
      status: 'active',
    }));
    await window.store.save({
      years: [{ id: 'groups-regenerate-year', label: '1448-1449' }],
      terms: [{ id: 'groups-regenerate-term', yearId: 'groups-regenerate-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'groups-regenerate-subject', name: 'الرياضيات' }],
      sections: [{ id: 'groups-regenerate-section', yearId: 'groups-regenerate-year', grade: 5, label: '2' }],
      teachings: [{ id: 'groups-regenerate-teaching', sectionId: 'groups-regenerate-section', subjectId: 'groups-regenerate-subject', termId: 'groups-regenerate-term' }],
      students,
      enrollments: students.map((student, index) => ({
        id: 'groups-regenerate-enrollment-' + index,
        studentId: student.id,
        sectionId: 'groups-regenerate-section',
        status: 'active',
        rollNo: index + 1,
      })),
    });
    await window.store.patchDevice({
      activeYearId: 'groups-regenerate-year',
      activeTermId: 'groups-regenerate-term',
    }, { queue: false });
  });
}

async function distortFirstGroup(page) {
  for (let moved = 0; moved < 3; moved += 1) {
    await page.locator('.group').nth(0).locator('.group__member').first().click();
    await page.locator('.group').nth(1).getByRole('button', { name: /نقل/ }).click();
  }
}

const savedGroups = (page, teachingId) => page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId);
const sortedSizes = (arrangement) => arrangement.map((group) => group.length).sort((a, b) => a - b);

test('New Random and Balanced generation replace distorted saved group structures from a fresh roster', async ({ page }) => {
  const teachingId = 'groups-regenerate-teaching';
  await seedRegenerationGroups(page);
  await openGroups(page, teachingId);
  await page.getByRole('button', { name: /قسّم المجموعات/ }).click();
  await expect.poll(() => savedGroups(page, teachingId)).toHaveLength(4);

  await distortFirstGroup(page);
  const distortedRandom = await savedGroups(page, teachingId);
  expect(sortedSizes(distortedRandom)).toEqual([1, 4, 4, 7]);
  await expect.poll(() => page.evaluate(async (id) => (await (await import('/src/lib/db.js')).getAll('groupArrangements')).find(row => row.teachingId === id)?.groups, teachingId)).toEqual(await savedGroups(page, teachingId));
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'المجموعات', exact: true })).toBeVisible();
  expect(sortedSizes(await savedGroups(page, teachingId))).toEqual([1, 4, 4, 7]);

  await page.getByRole('button', { name: 'عشوائي' }).click();
  await page.getByRole('button', { name: /أعد التقسيم/ }).click();
  await expect.poll(async () => sortedSizes(await savedGroups(page, teachingId))).toEqual([4, 4, 4, 4]);
  const randomReplacement = await savedGroups(page, teachingId);
  expect(new Set(randomReplacement.flat()).size).toBe(16);
  await expect.poll(() => page.evaluate(async (id) => (await (await import('/src/lib/db.js')).getAll('groupArrangements')).find(row => row.teachingId === id)?.groups, teachingId)).toEqual(await savedGroups(page, teachingId));
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'المجموعات', exact: true })).toBeVisible();
  expect(await savedGroups(page, teachingId)).toEqual(randomReplacement);

  await page.setViewportSize({ width: 390, height: 844 });
  await distortFirstGroup(page);
  expect(sortedSizes(await savedGroups(page, teachingId))).toEqual([1, 4, 4, 7]);

  await page.getByRole('button', { name: 'متوازن' }).click();
  await page.getByRole('button', { name: /أعد التقسيم/ }).click();
  await expect.poll(async () => sortedSizes(await savedGroups(page, teachingId))).toEqual([4, 4, 4, 4]);
  const balancedReplacement = await savedGroups(page, teachingId);
  expect(new Set(balancedReplacement.flat()).size).toBe(16);
  await expect.poll(() => page.evaluate(async (id) => (await (await import('/src/lib/db.js')).getAll('groupArrangements')).find(row => row.teachingId === id)?.groups, teachingId)).toEqual(await savedGroups(page, teachingId));
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'المجموعات', exact: true })).toBeVisible();
  expect(await savedGroups(page, teachingId)).toEqual(balancedReplacement);
});
