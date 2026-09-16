import { test, expect } from '@playwright/test';

test.setTimeout(90_000);
test.use({
  ...(process.env.RAKEEZX_E2E_BASE_URL ? { baseURL: process.env.RAKEEZX_E2E_BASE_URL } : {}),
  serviceWorkers: 'block',
});

async function seedNavigationContext(page, prefix) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  return page.evaluate(async (key) => {
    const yearId = `${key}-year`;
    const termId = `${key}-term`;
    const subjectId = `${key}-subject`;
    const sectionId = `${key}-section`;
    const teachingId = `${key}-teaching`;
    const studentId = `${key}-student`;
    await window.store.save({
      years: [{ id: yearId, label: '1448-1449' }],
      terms: [{ id: termId, yearId, name: 'الفصل الأول' }],
      subjects: [{ id: subjectId, name: 'العلوم' }],
      sections: [{ id: sectionId, yearId, grade: 5, label: key }],
      teachings: [{ id: teachingId, sectionId, subjectId, termId }],
      students: [{ id: studentId, name: `طالب ${key}`, status: 'active' }],
      enrollments: [{ id: `${key}-enrollment`, studentId, sectionId, status: 'active', rollNo: 1 }],
    }, { queue: false });
    await window.store.patchDevice({ activeYearId: yearId, activeTermId: termId }, { queue: false });
    return { teachingId, studentId };
  }, prefix);
}

const appBack = (page) => page.locator('.topbar [data-act="app-back"]');

async function openReportsContext(page) {
  await page.locator('a[href="#/reports"]:visible').first().click();
  await expect(page).toHaveURL(/#\/reports$/);
  await expect(page.locator('a[href="#/reports/execution"]')).toBeVisible();
  await page.evaluate(() => { location.hash = '/reports?scope=current'; });
  await expect(page).toHaveURL(/#\/reports\?scope=current$/);
  await expect(page.locator('a[href="#/reports/execution"]')).toBeVisible();
}

test('Reports detail prefers its exact in-app context and browser Back remains native', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seedNavigationContext(page, 'nav-reports');

  await openReportsContext(page);
  await page.locator('a[href="#/reports/execution"]').click();
  await expect(page).toHaveURL(/#\/reports\/execution$/);
  await appBack(page).click();
  await expect(page).toHaveURL(/#\/reports\?scope=current$/);

  await page.goForward();
  await expect(page).toHaveURL(/#\/reports\/execution$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/reports\?scope=current$/);

  await page.locator('a[href="#/reports/execution"]').click();
  await appBack(page).click();
  await expect(page).toHaveURL(/#\/reports\?scope=current$/);
  expect(errors).toEqual([]);
});

test('direct deep links use logical fallbacks without leaving RAKEEZ or looping', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/reports/execution');
  await appBack(page).click();
  await expect(page).toHaveURL(/#\/reports$/);

  const { teachingId } = await seedNavigationContext(page, 'nav-deep');
  const deepLink = await context.newPage();
  await deepLink.setViewportSize({ width: 390, height: 844 });
  await deepLink.goto(`/#/teaching/${teachingId}/groups`);
  await appBack(deepLink).click();
  await expect(deepLink).toHaveURL(new RegExp(`#\\/teaching\\/${teachingId}$`));
  await deepLink.waitForTimeout(250);
  await expect(deepLink).toHaveURL(new RegExp(`#\\/teaching\\/${teachingId}$`));
  await deepLink.close();
});

test('Student Profile returns to the roster context on mobile and desktop', async ({ page }) => {
  const { teachingId, studentId } = await seedNavigationContext(page, 'nav-student');

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/#/teaching/${teachingId}/students`);
    await page.locator(`a[href="#/student/${studentId}?teaching=${teachingId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#\\/student\\/${studentId}\\?teaching=${teachingId}$`));
    await appBack(page).click();
    await expect(page).toHaveURL(new RegExp(`#\\/teaching\\/${teachingId}\\/students$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});

test('Archive detail returns to the exact Archive entry context', async ({ page }) => {
  await page.goto('/#/archive');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'nav-archive-year', label: 'السنة المؤرشفة', status: 'archived' }],
      terms: [{ id: 'nav-archive-term', yearId: 'nav-archive-year', name: 'الفصل المؤرشف', status: 'closed' }],
    }, { queue: false });
    window.store.repaint();
  });
  await page.goto('/#/archive?section=history');
  await page.locator('a[href="#/archive/year/nav-archive-year/term/nav-archive-term"]').click();
  await expect(page).toHaveURL(/#\/archive\/year\/nav-archive-year\/term\/nav-archive-term$/);
  await appBack(page).click();
  await expect(page).toHaveURL(/#\/archive\?section=history$/);
});
