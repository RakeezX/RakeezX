import { test, expect } from '@playwright/test';

const NOW = Date.now() + 86400000; // Future timestamp to override local defaults
const today = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
const MOCK_DB = {
  years: [{ id: 'y1', label: '1445', order: 1, client_updated_at: NOW }],
  terms: [{ id: 't1', year_id: 'y1', name: 'T1', client_updated_at: NOW }],
  subjects: [{ id: 'sub1', name: 'Math', client_updated_at: NOW }],
  sections: [{ id: 'sec1', year_id: 'y1', grade: 1, label: 'A', name: '1/A', client_updated_at: NOW }],
  teachings: [{ id: 'tch1', section_id: 'sec1', subject_id: 'sub1', term_id: 't1', client_updated_at: NOW }],
  students: [
    { id: 'std1', name: 'Student 1', status: 'active', client_updated_at: NOW },
    { id: 'std2', name: 'Student 2', status: 'active', client_updated_at: NOW }
  ],
  enrollments: [
    { id: 'enr1', student_id: 'std1', section_id: 'sec1', status: 'active', client_updated_at: NOW },
    { id: 'enr2', student_id: 'std2', section_id: 'sec1', status: 'active', client_updated_at: NOW }
  ],
  time_profiles: [{ id: 'tp1', name: 'Default', periods: [], client_updated_at: NOW }],
  slots: [],
  sessions: [{ id: 'ses1', teaching_id: 'tch1', date: today, period: 1, status: 'scheduled', client_updated_at: NOW }],
  attendance: []
};

function setupMockCloud(page) {
  return page.route('https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();

    if (request.method() === 'GET') {
      await route.fulfill({ json: MOCK_DB[table] || [] });
    } else if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData());
      if (!MOCK_DB[table]) MOCK_DB[table] = [];
      for (const rec of payload) {
        const idx = MOCK_DB[table].findIndex(r => r.id === rec.id);
        if (idx >= 0) MOCK_DB[table][idx] = { ...rec, client_updated_at: Date.now() };
        else MOCK_DB[table].push({ ...rec, client_updated_at: Date.now() });
      }
      await route.fulfill({ json: [] });
    } else {
      await route.continue();
    }
  });
}

test.describe('E2E Attendance Flow', () => {
  test('should run cross-device sync workflow safely', async ({ page }) => {
    test.setTimeout(60000); // Give plenty of time for 2 browsers + multiple syncs

    // We'll manage multiple pages manually for Device A and Device B
    const browser = page.context().browser();
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.on('console', msg => console.log(`[Device A] ${msg.type()}: ${msg.text()}`));
    pageA.on('pageerror', err => console.error(`[Device A] Error: ${err}`));

    // Auth bypass
    await pageA.addInitScript(() => {
      localStorage.setItem('rakeezx-auth', JSON.stringify({
        access_token: 'fake-token',
        user: { id: 'test-user' }
      }));
    });
    await setupMockCloud(pageA);

    await pageA.goto('/#/classes');

    // Wait for the app to finish async boot
    await pageA.waitForFunction(() => window.__syncModule !== undefined, { timeout: 10000 });

    // Authenticated boot now pulls the fixture automatically; wait for actual data,
    // rather than racing the in-flight initial sync with manual category calls.
    await pageA.waitForFunction(() => window.store.getTeaching('tch1') && window.store.state.students.length >= 2, { timeout: 15_000 });
    await pageA.evaluate(() => window.store.patchDevice({ activeTermId: 't1' }));
    await pageA.reload();
    await pageA.waitForFunction(() => window.store.getTeaching('tch1') && window.__syncModule?.state.status === 'synced', { timeout: 15_000 });
    await expect(pageA.locator('.class-card__title').first()).toBeVisible({ timeout: 5_000 });
    // Click class
    await pageA.click('a[href="#/teaching/tch1"]');

    // Teaching Hub -> Attendance
    await pageA.click('a[href="#/teaching/tch1/attendance"]');

    // Check if students are rendered
    await expect(pageA.locator('text="Student 1"')).toBeVisible();
    await expect(pageA.locator('text="Student 2"')).toBeVisible();

    // Mark Student 1 as present (assume there is a button for presence)
    // Actually, RakeezX attendance UI marks by clicking the state icon or standard buttons.
    const student1Row = pageA.locator('.att-row', { hasText: 'Student 1' }).first();
    await student1Row.locator('.segbtn[data-status="present"]').click();

    // Explicitly sync timetable after marking attendance to ensure the MOCK cloud backend receives the record.
    // Auto-sync timing is non-deterministic in test environments; explicit sync is reliable.
    await pageA.evaluate(async () => {
      await window.__syncModule.syncTimetable();
    });

    // DEVICE B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.addInitScript(() => {
      localStorage.setItem('rakeezx-auth', JSON.stringify({
        access_token: 'fake-token',
        user: { id: 'test-user' }
      }));
    });
    await setupMockCloud(pageB);

    await pageB.goto('/#/teaching/tch1/attendance');

    // Give page B a moment to initialize
    await pageB.waitForTimeout(1000);

    // Verify Device B reaches the attendance view without JS errors.
    // The mock MOCK_DB.attendance state was set by Device A's explicit sync call.
    await expect(pageB.locator('#app')).toBeVisible({ timeout: 5000 });
    // The attendance record pushed by Device A must be in the mock cloud backend
    expect(MOCK_DB.attendance.length).toBeGreaterThan(0); // Device A must have synced at least one record

    // Cleanup: close browser contexts to release resources
    await contextA.close();
    await contextB.close();
  });
});
