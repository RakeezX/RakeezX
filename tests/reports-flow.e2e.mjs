import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/';
const TABLES = [
  'profile', 'years', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'time_profiles', 'slots', 'sessions', 'attendance',
  'items', 'scores', 'logs', 'calendars', 'calendar_days', 'units', 'lessons',
  'notes', 'assignments', 'submissions',
];

function mockCloud() {
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]));
  return {
    tables,
    async route(page) {
      await page.route(`${CLOUD_URL}*`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        if (request.method() === 'GET') return route.fulfill({ json: tables[table] ?? [] });
        if (request.method() === 'POST') {
          for (const record of JSON.parse(request.postData() ?? '[]')) {
            const index = (tables[table] ??= []).findIndex((item) => item.id === record.id);
            if (index < 0) tables[table].push({ ...record });
            else tables[table][index] = { ...record };
          }
          return route.fulfill({ json: [] });
        }
        return route.fulfill({ status: 200, json: [] });
      });
    },
  };
}

async function enableMockSync(page, cloud) {
  await page.addInitScript(() => {
    localStorage.setItem('rakeezx-auth', JSON.stringify({
      access_token: 'test-token', user: { id: 'reports-test-user' },
    }));
  });
  await cloud.route(page);
}

function observeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function expectNoDocumentOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('reports render current historical data, edited section metadata, and synced records without duplicates', async ({ page }) => {
  test.setTimeout(90_000);
  const cloud = mockCloud();
  const errors = observeErrors(page);
  await enableMockSync(page, cloud);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store && window.__syncModule, { timeout: 15_000 });
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');

  // Isolated TEST-only data includes multiple sections, a historical dated session,
  // scores, and a no-roster teaching for the report empty state.
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'report-year', name: 'TEST Year' }],
      terms: [{ id: 'report-term', yearId: 'report-year', name: 'TEST Term' }],
      subjects: [
        { id: 'report-subject-a', name: 'TEST Mathematics' },
        { id: 'report-subject-b', name: 'TEST Science' },
      ],
      sections: [
        { id: 'report-section-a', yearId: 'report-year', grade: 4, label: 'A', name: 'TEST 4/A', order: 0 },
        { id: 'report-section-b', yearId: 'report-year', grade: 5, label: 'B', name: 'TEST 5/B', order: 1 },
        { id: 'report-section-empty', yearId: 'report-year', grade: 6, label: 'E', name: 'TEST 6/E', order: 2 },
      ],
      teachings: [
        { id: 'report-teaching-a', sectionId: 'report-section-a', subjectId: 'report-subject-a', termId: 'report-term', order: 0 },
        { id: 'report-teaching-b', sectionId: 'report-section-b', subjectId: 'report-subject-b', termId: 'report-term', order: 1 },
        { id: 'report-teaching-empty', sectionId: 'report-section-empty', subjectId: 'report-subject-b', termId: 'report-term', order: 2 },
      ],
      students: [
        { id: 'report-student-a', name: 'TEST Report A', status: 'active' },
        { id: 'report-student-b', name: 'TEST Report B', status: 'active' },
        { id: 'report-student-c', name: 'TEST Report C', status: 'active' },
        { id: 'report-student-d', name: 'TEST Report D', status: 'active' },
      ],
      enrollments: [
        { id: 'report-enrollment-a', studentId: 'report-student-a', sectionId: 'report-section-a', status: 'active', rollNo: 1 },
        { id: 'report-enrollment-b', studentId: 'report-student-b', sectionId: 'report-section-a', status: 'active', rollNo: 2 },
        { id: 'report-enrollment-c', studentId: 'report-student-c', sectionId: 'report-section-a', status: 'active', rollNo: 3 },
        { id: 'report-enrollment-d', studentId: 'report-student-d', sectionId: 'report-section-b', status: 'active', rollNo: 1 },
      ],
      slots: [{ id: 'report-slot-a', teachingId: 'report-teaching-a', weekday: 1, period: 4 }],
      sessions: [{ id: 'report-session-historical', teachingId: 'report-teaching-a', slotId: 'report-slot-a', date: '2026-08-02', weekday: 0, period: 1 }],
      attendance: [
        { id: 'report-attendance-a', studentId: 'report-student-a', sessionId: 'report-session-historical', teachingId: 'report-teaching-a', date: '2026-08-02', status: 'present' },
        { id: 'report-attendance-b', studentId: 'report-student-b', sessionId: 'report-session-historical', teachingId: 'report-teaching-a', date: '2026-08-02', status: 'late' },
        { id: 'report-attendance-c', studentId: 'report-student-c', sessionId: 'report-session-historical', teachingId: 'report-teaching-a', date: '2026-08-02', status: 'absent' },
      ],
      items: [
        { id: 'report-item-homework', teachingId: 'report-teaching-a', name: 'TEST Homework', max: 10 },
        { id: 'report-item-test', teachingId: 'report-teaching-a', name: 'TEST Test', max: 20 },
        { id: 'report-item-project', teachingId: 'report-teaching-b', name: 'TEST Project', max: 10 },
      ],
      scores: [
        { id: 'report-score-a1', studentId: 'report-student-a', itemId: 'report-item-homework', value: 8 },
        { id: 'report-score-a2', studentId: 'report-student-a', itemId: 'report-item-test', value: 18 },
        { id: 'report-score-b1', studentId: 'report-student-b', itemId: 'report-item-homework', value: 4 },
        { id: 'report-score-c1', studentId: 'report-student-c', itemId: 'report-item-homework', value: 2 },
        { id: 'report-score-c2', studentId: 'report-student-c', itemId: 'report-item-test', value: 4 },
        { id: 'report-score-d1', studentId: 'report-student-d', itemId: 'report-item-project', value: 9 },
      ],
      logs: [{ id: 'report-log-a', studentId: 'report-student-a', teachingId: 'report-teaching-a', kind: 'participation', delta: 2, date: '2026-08-02' }],
    });
    await window.store.patchDevice({ activeYearId: 'report-year', activeTermId: 'report-term' });
    window.store.repaint();
  });

  // Report index covers each populated and empty teaching and shows current scores.
  await page.goto('/#/reports');
  await expect(page.locator('.list')).toContainText('TEST Mathematics');
  await expect(page.locator('.list')).toContainText('TEST Science');
  await expect(page.locator('.list')).toContainText('الرابع الابتدائي / A');
  await expectNoDocumentOverflow(page);

  // Edit the section through its real UI. The report must immediately use the same identity with updated metadata.
  await page.goto('/#/teaching/report-teaching-a');
  await page.locator('[data-act="edit-sec"]').click();
  await page.selectOption('select[name="grade"]', '5');
  await page.fill('input[name="label"]', 'Z');
  await page.click('button[form="edit-sec-form"]');
  await expect(page.locator('#toast')).toContainText('تم تعديل');
  expect(await page.evaluate(() => window.store.state.sections.find((section) => section.id === 'report-section-a'))).toMatchObject({ id: 'report-section-a', grade: 5, label: 'Z' });

  await page.goto('/#/teaching/report-teaching-a/reports');
  await expect(page.locator('.printhead')).toContainText('الخامس الابتدائي / Z');
  await expect(page.locator('.gtable--report')).toContainText('TEST Report A');
  await expect(page.locator('.gtable--report')).toContainText('TEST Report B');
  await expect(page.locator('.gtable--report')).toContainText('TEST Report C');
  await page.locator('[data-act="tab"][data-tab="grades"]').click();
  await expect(page.locator('.gtable--report')).toContainText('26');
  await expect(page.locator('.gtable--report')).toContainText('4');
  await expect(page.locator('.gtable--report')).toContainText('6');
  await expectNoDocumentOverflow(page);

  await page.locator('[data-act="tab"][data-tab="attendance"]').click();
  await expect(page.locator('.gtable--report')).toContainText('TEST Report A');
  await expect(page.locator('.gtable--report')).toContainText('TEST Report B');
  await expect(page.locator('.gtable--report')).toContainText('TEST Report C');
  expect(await page.evaluate(() => {
    const session = window.store.state.sessions.find((item) => item.id === 'report-session-historical');
    const attendance = window.store.state.attendance.filter((item) => !item.deleted && item.sessionId === session.id);
    return { session: { date: session.date, weekday: session.weekday, period: session.period }, count: attendance.length };
  })).toEqual({ session: { date: '2026-08-02', weekday: 0, period: 1 }, count: 3 });

  await page.locator('[data-act="tab"][data-tab="support"]').click();
  await expect(page.locator('.list')).toContainText('TEST Report C');
  await expect(page.locator('.list')).toContainText('الدرجات دون ٥٠٪');

  // Individual student report is a report view too: its current section label, scores, and dated attendance remain connected.
  await page.goto('/#/student/report-student-a?teaching=report-teaching-a');
  await expect(page.locator('.printhead')).toContainText('الخامس الابتدائي / Z');
  await expect(page.locator('main')).toContainText('26 / 30');
  await expect(page.locator('main')).toContainText('حاضر 1');
  await page.reload();
  await expect(page.locator('.printhead')).toContainText('الخامس الابتدائي / Z');

  // The no-roster report must use its safe empty state rather than crash.
  await page.goto('/#/teaching/report-teaching-empty/reports');
  await expect(page.locator('.empty')).toContainText('لا بيانات بعد');

  // Desktop plus mobile smoke checks, allowing report tables to scroll only within their own wrapper.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/teaching/report-teaching-a/reports');
  await expect(page.locator('.gtable--report')).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // The test saved fixtures through the real store, which schedules automatic sync.
  // Wait for that pass to settle before asserting the explicit category sync results.
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');

  // Sync the same report sources, confirm immediate convergence, then render them on a fresh device.
  const first = await page.evaluate(async () => ({
    structural: await window.__syncModule.syncStructural(),
    students: await window.__syncModule.syncStudents(),
    timetable: await window.__syncModule.syncTimetable(),
    scoring: await window.__syncModule.syncScoring(),
  }));
  expect(first.timetable.attendance).toEqual({ pushed: 0, pulled: 0 });
  expect(first.scoring.scores).toEqual({ pushed: 0, pulled: 0 });
  const second = await page.evaluate(async () => ({
    timetable: await window.__syncModule.syncTimetable(),
    scoring: await window.__syncModule.syncScoring(),
  }));
  expect(second.timetable.attendance).toEqual({ pushed: 0, pulled: 0 });
  expect(second.scoring.scores).toEqual({ pushed: 0, pulled: 0 });
  expect(cloud.tables.attendance).toHaveLength(3);
  expect(cloud.tables.scores).toHaveLength(6);

  const freshDevice = await page.context().browser().newContext({ viewport: { width: 1280, height: 800 } });
  const pageB = await freshDevice.newPage();
  const errorsB = observeErrors(pageB);
  await enableMockSync(pageB, cloud);
  await pageB.goto('/#/classes');
  await pageB.waitForFunction(() => window.store && window.__syncModule, { timeout: 15_000 });
  await pageB.evaluate(async () => {
    await window.__syncModule.syncStructural();
    await window.__syncModule.syncStudents();
    await window.__syncModule.syncTimetable();
    await window.__syncModule.syncScoring();
    await window.store.patchDevice({ activeYearId: 'report-year', activeTermId: 'report-term' });
  });
  await pageB.goto('/#/teaching/report-teaching-a/reports');
  await expect(pageB.locator('.printhead')).toContainText('الخامس الابتدائي / Z');
  await pageB.locator('[data-act="tab"][data-tab="grades"]').click();
  await expect(pageB.locator('.gtable--report')).toContainText('26');
  await pageB.goto('/#/reports/execution');
  await expect(pageB.getByText('تنفيذ الحصص', { exact: true })).toBeVisible();
  await expect(pageB.locator('.gtable--report')).toContainText('تم رصد الحضور');
  expect(await pageB.evaluate(() => ({
    attendance: window.store.state.attendance.filter((item) => !item.deleted).length,
    scores: window.store.state.scores.filter((item) => !item.deleted).length,
    uniqueScores: new Set(window.store.state.scores.filter((item) => !item.deleted).map((item) => item.id)).size,
  }))).toEqual({ attendance: 3, scores: 6, uniqueScores: 6 });
  expect(errorsB).toEqual([]);
  await freshDevice.close();
  expect(errors).toEqual([]);
});

test('reports index has a safe empty state', async ({ page }) => {
  const errors = observeErrors(page);
  await page.goto('/#/reports');
  await page.waitForFunction(() => window.store, { timeout: 15_000 });
  await expect(page.locator('.empty')).toContainText('لا بيانات بعد');
  await expectNoDocumentOverflow(page);
  expect(errors).toEqual([]);
});
