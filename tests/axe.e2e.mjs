import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const testRoutes = [
  '#/',
  '#/classes',
  '#/students',
  '#/schedule',
  '#/attendance',
  '#/curriculum',
  '#/reports',
  '#/settings'
];

const NOW = Date.now() + 86400000;
const today = new Date().toLocaleDateString('en-CA');
const MOCK_DB = {
  years: [{ id: 'y1', label: '1445', order: 1, client_updated_at: NOW }],
  terms: [{ id: 't1', year_id: 'y1', name: 'T1', client_updated_at: NOW }],
  subjects: [{ id: 'sub1', name: 'Math', client_updated_at: NOW }],
  sections: [{ id: 'sec1', year_id: 'y1', grade: 1, label: 'A', name: '1/A', client_updated_at: NOW }],
  teachings: [{ id: 'tch1', section_id: 'sec1', subject_id: 'sub1', term_id: 't1', client_updated_at: NOW }],
  students: [
    { id: 'std1', name: 'Student 1', status: 'active', client_updated_at: NOW }
  ],
  enrollments: [
    { id: 'enr1', student_id: 'std1', section_id: 'sec1', status: 'active', client_updated_at: NOW }
  ],
  time_profiles: [{ id: 'tp1', name: 'Default', periods: [], client_updated_at: NOW }],
  slots: [],
  sessions: [{ id: 'sess1', teaching_id: 'tch1', date: today, period: 1, client_updated_at: NOW }],
  attendance: [{ id: 'att1', student_id: 'std1', session_id: 'sess1', status: 'present', client_updated_at: NOW }],
  profile: [{ id: '9e3a9858-50bb-470e-91f6-8ea901ffb030', owner_id: '9e3a9858-50bb-470e-91f6-8ea901ffb030', teacher_name: 'Test', client_updated_at: NOW }]
};

async function setupMockCloud(page) {
  await page.evaluate(() => {
    localStorage.setItem('rakeezx-auth', JSON.stringify({
      access_token: 'fake',
      user: { id: '9e3a9858-50bb-470e-91f6-8ea901ffb030' }
    }));
  });

  await page.route('https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();

    if (request.method() === 'GET') {
      await route.fulfill({ json: MOCK_DB[table] || [] });
    } else {
      await route.continue();
    }
  });
}

test.describe('Accessibility / Axe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await setupMockCloud(page);
    await page.goto('http://localhost:5173');
    await expect(page.locator('.sidebar__brand').or(page.locator('.topbar__title')).first()).toBeVisible({ timeout: 15000 });
  });

  for (const route of testRoutes) {
    test(`Axe check for ${route}`, async ({ page }) => {
      await page.goto(`http://localhost:5173/${route}`);
      // wait a bit for the route to render
      await page.waitForTimeout(500); 

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
      
      if (criticalViolations.length > 0) {
        console.error(`Critical violations on ${route}:`, JSON.stringify(criticalViolations, null, 2));
      }
      expect(criticalViolations.length).toBe(0);
    });
  }
});
