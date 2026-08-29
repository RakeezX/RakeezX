import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/';

function mockCloud() {
  const tables = Object.fromEntries([
    'profile', 'years', 'terms', 'subjects', 'sections', 'teachings',
    'students', 'enrollments', 'time_profiles', 'slots', 'sessions', 'attendance',
    'items', 'scores', 'logs', 'calendars', 'calendar_days', 'units', 'lessons',
    'notes', 'assignments', 'submissions',
  ].map((name) => [name, []]));

  return {
    tables,
    async route(page) {
      await page.route(`${CLOUD_URL}*`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        if (request.method() === 'GET') {
          await route.fulfill({ json: tables[table] ?? [] });
          return;
        }
        if (request.method() === 'POST') {
          const payload = JSON.parse(request.postData() ?? '[]');
          for (const record of payload) {
            const row = { ...record };
            const index = (tables[table] ??= []).findIndex((item) => item.id === row.id);
            if (index < 0) tables[table].push(row);
            else tables[table][index] = row;
          }
          await route.fulfill({ json: [] });
          return;
        }
        await route.fulfill({ status: 200, json: [] });
      });
    },
  };
}

async function signInForMockSync(page, cloud) {
  await page.addInitScript(() => {
    localStorage.setItem('rakeezx-auth', JSON.stringify({
      access_token: 'test-token', user: { id: 'attendance-test-user' },
    }));
  });
  await cloud.route(page);
}

test('attendance remains historical after recurring slot edit and sync converges', async ({ page }) => {
  test.setTimeout(90_000);
  const cloud = mockCloud();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await signInForMockSync(page, cloud);
  await page.goto('/#/schedule');
  await page.waitForFunction(() => window.__syncModule && window.store, { timeout: 15_000 });

  // Isolated TEST-only fixture: one section, one teaching, and four students.
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'test-year', name: 'TEST Year' }],
      terms: [{ id: 'test-term', yearId: 'test-year', name: 'TEST Term' }],
      subjects: [{ id: 'test-subject', name: 'TEST Attendance' }],
      sections: [{ id: 'test-section', yearId: 'test-year', grade: 4, label: 'T', name: 'TEST 4/T', order: 0 }],
      teachings: [{ id: 'test-teaching', sectionId: 'test-section', subjectId: 'test-subject', termId: 'test-term', order: 0 }],
      students: [
        { id: 'test-student-present', name: 'TEST Present', status: 'active' },
        { id: 'test-student-absent', name: 'TEST Absent', status: 'active' },
        { id: 'test-student-late', name: 'TEST Late', status: 'active' },
        { id: 'test-student-excused', name: 'TEST Excused', status: 'active' },
      ],
      enrollments: [
        { id: 'test-enrollment-present', studentId: 'test-student-present', sectionId: 'test-section', status: 'active', rollNo: 1 },
        { id: 'test-enrollment-absent', studentId: 'test-student-absent', sectionId: 'test-section', status: 'active', rollNo: 2 },
        { id: 'test-enrollment-late', studentId: 'test-student-late', sectionId: 'test-section', status: 'active', rollNo: 3 },
        { id: 'test-enrollment-excused', studentId: 'test-student-excused', sectionId: 'test-section', status: 'active', rollNo: 4 },
      ],
    });
    await window.store.patchDevice({ activeYearId: 'test-year', activeTermId: 'test-term' });
    window.store.repaint();
  });
  // Establish the TEST fixture's structural and student dependencies before syncing attendance.
  await page.evaluate(async () => {
    await window.__syncModule.syncStructural();
    await window.__syncModule.syncStudents();
  });

  // Create the recurring Sunday/P1 slot through the actual timetable UI.
  await page.locator('[data-act="add"]').first().click();
  await page.selectOption('select[name="teachingId"]', 'test-teaching');
  await page.selectOption('select[name="weekday"]', '0');
  await page.selectOption('select[name="period"]', '1');
  await page.click('button[form="slot-form"]');
  await expect(page.locator('#toast')).toContainText('أُضيفت');
  const slotId = await page.locator('.slot').filter({ hasText: 'الحصة الأولى' }).locator('[data-act="edit"]').getAttribute('data-id');
  expect(slotId).toBeTruthy();

  // Open the Sunday dated session through the attendance UI, not by seeding a session.
  await page.goto('/#/teaching/test-teaching/attendance');
  const daysSinceSunday = await page.evaluate(() => new Date().getDay());
  for (let index = 0; index < daysSinceSunday; index += 1) {
    await page.locator('[data-act="prev-day"]').click();
  }
  await expect(page.locator('.att-row')).toHaveCount(4);

  const setStatus = async (student, status) => {
    await page.locator('.att-row', { hasText: student }).locator(`[data-status="${status}"]`).click();
  };
  await setStatus('TEST Present', 'present');
  await setStatus('TEST Absent', 'absent');
  await setStatus('TEST Late', 'late');
  await setStatus('TEST Excused', 'excused');
  await expect(page.getByText('اكتمل الرصد', { exact: false })).toBeVisible();

  const historical = await page.evaluate(() => {
    const session = window.store.state.sessions.find((item) => item.teachingId === 'test-teaching' && !item.deleted && window.store.state.attendance.some((record) => record.sessionId === item.id && !record.deleted));
    const attendance = window.store.state.attendance
      .filter((item) => item.sessionId === session.id && !item.deleted)
      .map(({ id, studentId, sessionId, teachingId, date, status }) => ({ id, studentId, sessionId, teachingId, date, status }))
      .sort((left, right) => left.studentId.localeCompare(right.studentId));
    return { session: { id: session.id, date: session.date, period: session.period, slotId: session.slotId }, attendance };
  });
  expect(historical.session.slotId).toBe(slotId);
  expect(historical.attendance).toHaveLength(4);
  expect(new Set(historical.attendance.map((item) => item.studentId)).size).toBe(4);
  expect(historical.attendance.map((item) => item.status)).toEqual(['absent', 'excused', 'late', 'present']);

  // Reload the exact dated session and confirm the same records survive locally.
  await page.goto(`/#/teaching/test-teaching/attendance?session=${historical.session.id}`);
  await expect(page.locator('.att-row', { hasText: 'TEST Excused' }).locator('[data-status="excused"]')).toHaveClass(/is-on/);
  expect(await page.evaluate(() => window.store.state.attendance.filter((item) => !item.deleted && item.sessionId).length)).toBe(4);

  // Move the recurring slot through the real edit sheet. Historical dated attendance must not move or duplicate.
  await page.goto('/#/schedule');
  await page.locator(`[data-act="edit"][data-id="${slotId}"]`).click();
  await page.selectOption('select[name="weekday"]', '1');
  await page.selectOption('select[name="period"]', '4');
  await page.click('button[form="slot-form"]');
  await expect(page.locator('#toast')).toContainText('تم تعديل');
  expect(await page.evaluate((expected) => {
    const slot = window.store.state.slots.find((item) => item.id === expected);
    return { id: slot.id, weekday: slot.weekday, period: slot.period };
  }, slotId)).toEqual({ id: slotId, weekday: 1, period: 4 });
  expect(await page.evaluate((snapshot) => {
    const session = window.store.state.sessions.find((item) => item.id === snapshot.session.id);
    const attendance = window.store.state.attendance
      .filter((item) => item.sessionId === snapshot.session.id && !item.deleted)
      .map(({ studentId, status, date, teachingId }) => ({ studentId, status, date, teachingId }))
      .sort((left, right) => left.studentId.localeCompare(right.studentId));
    return { session: { id: session.id, date: session.date, period: session.period, slotId: session.slotId }, attendance };
  }, historical)).toEqual({
    session: historical.session,
    attendance: historical.attendance.map(({ studentId, status, date, teachingId }) => ({ studentId, status, date, teachingId })),
  });

  // The attendance report reads the same historical session data.
  await page.goto('/#/teaching/test-teaching/reports');
  await page.locator('[data-act="tab"][data-tab="attendance"]').click();
  await expect(page.locator('.gtable--report')).toContainText('TEST Present');
  await expect(page.locator('.gtable--report')).toContainText('TEST Absent');
  await expect(page.locator('.gtable--report')).toContainText('TEST Late');
  await expect(page.locator('.gtable--report')).toContainText('TEST Excused');

  // Dated-session mutations enqueue automatic sync; wait for it to settle before
  // asserting the explicit follow-up is a no-op and cloud convergence is complete.
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  const firstSync = await page.evaluate(() => window.__syncModule.syncTimetable());
  expect(firstSync.attendance).toEqual({ pushed: 0, pulled: 0 });
  const secondSync = await page.evaluate(() => window.__syncModule.syncTimetable());
  expect(secondSync.attendance).toEqual({ pushed: 0, pulled: 0 });
  expect(cloud.tables.attendance).toHaveLength(4);

  // A fresh device downloads exactly the same four dated records: no duplicate or resurrection.
  const browser = page.context().browser();
  const deviceB = await browser.newContext();
  const pageB = await deviceB.newPage();
  const errorsB = [];
  pageB.on('pageerror', (error) => errorsB.push(error.message));
  pageB.on('console', (message) => {
    if (message.type() === 'error') errorsB.push(message.text());
  });
  await signInForMockSync(pageB, cloud);
  await pageB.goto('/#/classes');
  await pageB.waitForFunction(() => window.__syncModule && window.store, { timeout: 15_000 });
  // Authenticated boot now performs the full dependency-safe pull itself.
  await pageB.waitForFunction(() => window.__syncModule.state.status === 'synced', { timeout: 15_000 });
  await pageB.evaluate(() => window.store.patchDevice({ activeYearId: 'test-year', activeTermId: 'test-term' }));  await pageB.goto(`/#/teaching/test-teaching/attendance?session=${historical.session.id}`);
  await expect(pageB.locator('.att-row')).toHaveCount(4);
  expect(await pageB.evaluate((sessionId) => {
    const records = window.store.state.attendance.filter((item) => !item.deleted && item.sessionId === sessionId);
    return { count: records.length, uniqueStudents: new Set(records.map((item) => item.studentId)).size };
  }, historical.session.id)).toEqual({ count: 4, uniqueStudents: 4 });
  await pageB.goto('/#/teaching/test-teaching/sessions');
  await expect(pageB.getByText('تم رصد الحضور', { exact: true })).toBeVisible();
  expect(errorsB).toEqual([]);
  await deviceB.close();
  expect(errors).toEqual([]);
});
