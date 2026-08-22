import { test, expect } from '@playwright/test';

const NOW = Date.now() + 86400000;
const today = new Date().toLocaleDateString('en-CA');
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
  attendance: [],
  profile: [{ id: 'profile', school_name: 'Test School', teacher_name: 'Test Teacher', client_updated_at: NOW }]
};

function setupMockCloud(page) {
  return page.route('https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/*', async (route) => {
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

test.describe('Route Crawl', () => {
  let errors = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('vite') && !text.includes('504')) {
          errors.push(text);
        }
      }
    });
    await setupMockCloud(page);
    
    // Initial sync
    await page.goto('/');
    
    // Wait for the shell to be visible
    await expect(page.locator('.sidebar__brand').or(page.locator('.topbar__title')).first()).toBeVisible({ timeout: 15000 });
    
    // Wait for initial sync to likely finish
    await page.waitForTimeout(1000); 
  });

  const routes = [
    '/',
    '/classes',
    '/schedule',
    '/schedule/times',
    '/curriculum',
    '/reports',
    '/calendar',
    '/settings',
    '/settings/backup',
    // Dynamic routes
    '/teaching/tch1',
    '/teaching/tch1/students',
    '/teaching/tch1/attendance',
    '/teaching/tch1/quicklog',
    '/teaching/tch1/grades',
    '/teaching/tch1/items',
    '/teaching/tch1/picker',
    '/teaching/tch1/groups',
    '/teaching/tch1/board',
    '/teaching/tch1/sessions',
    '/teaching/tch1/reports',
    '/student/std1'
  ];

  for (const route of routes) {
    test(`Route works: ${route}`, async ({ page }) => {
      await page.goto('/#' + route);
      
      // Wait for content to render by checking for topbar title or empty state
      const isVisible = await page.locator('.topbar__title, .empty').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBe(true);
      
      // Wait a tiny bit to catch async render errors
      await page.waitForTimeout(300);

      if (errors.length > 0) {
        console.error(`Errors on route ${route}:`, errors);
      }
      expect(errors).toHaveLength(0);
      
      // Ensure no "تعذّر عرض هذه الشاشة" (Render failure)
      const hasErrorUI = await page.locator('text=تعذّر عرض هذه الشاشة').isVisible();
      expect(hasErrorUI).toBe(false);
    });
  }
});
