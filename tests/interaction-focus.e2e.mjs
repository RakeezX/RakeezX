import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/';

function mockCloud() {
  const tables = {};
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
          const body = JSON.parse(request.postData() ?? '[]');
          const records = Array.isArray(body) ? body : [body];
          const rows = (tables[table] ??= []);
          for (const record of records) {
            const index = rows.findIndex((row) => row.id === record.id);
            if (index < 0) rows.push({ ...record });
            else rows[index] = { ...rows[index], ...record };
          }
          await route.fulfill({ json: [] });
          return;
        }
        await route.fulfill({ status: 200, json: [] });
      });
    },
  };
}

test('post-edit sync preserves first-click grade interaction while real data updates still render', async ({ page }) => {
  test.setTimeout(60_000);
  const cloud = mockCloud();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem('rakeezx-auth', JSON.stringify({
      access_token: 'interaction-test-token', user: { id: 'interaction-test-user' },
    }));
  });
  await cloud.route(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true && window.__syncModule);
  await page.evaluate(async () => {
    await window.store.save({
      years: [{ id: 'interaction:year', name: 'سنة اختبار', status: 'active' }],
      terms: [{ id: 'interaction:term', yearId: 'interaction:year', name: 'الفصل الأول', index: 1, status: 'active' }],
      subjects: [{ id: 'interaction:subject', name: 'مادة التفاعل' }],
      sections: [{ id: 'interaction:section', yearId: 'interaction:year', grade: 4, label: 'أ' }],
      teachings: [{ id: 'interaction:teaching', sectionId: 'interaction:section', subjectId: 'interaction:subject', termId: 'interaction:term' }],
      students: [
        { id: 'interaction:student:a', name: 'طالب التفاعل أ', status: 'active' },
        { id: 'interaction:student:b', name: 'طالب التفاعل ب', status: 'active' },
      ],
      enrollments: [
        { id: 'interaction:enrollment:a', studentId: 'interaction:student:a', sectionId: 'interaction:section', status: 'active', rollNo: 1 },
        { id: 'interaction:enrollment:b', studentId: 'interaction:student:b', sectionId: 'interaction:section', status: 'active', rollNo: 2 },
      ],
      items: [
        { id: 'interaction:item', teachingId: 'interaction:teaching', name: 'اختبار', max: 10, auto: null, order: 0 },
        { id: 'interaction:participation', teachingId: 'interaction:teaching', name: 'المشاركة', max: 5, auto: 'participation', perPoint: 1, order: 1 },
      ],
      scores: [{ id: 'interaction:score:a', studentId: 'interaction:student:a', itemId: 'interaction:item', value: 5 }],
    });
    await window.store.patchDevice({ activeYearId: 'interaction:year', activeTermId: 'interaction:term' });
    window.store.repaint();
    await window.__syncModule.syncAll({ full: false });
  });

  await page.locator('a[href="#/teaching/interaction:teaching"]').click();
  await expect(page).toHaveURL(/#\/teaching\/interaction:teaching$/);

  await page.goto('/#/teaching/interaction:teaching/grades');
  const itemInput = page.locator('input[data-fk="g-interaction:student:a-interaction:item"]');
  await itemInput.click();
  await expect.poll(() => itemInput.evaluate((el) => ({ start: el.selectionStart, end: el.selectionEnd, length: el.value.length })))
    .toEqual({ start: 0, end: 1, length: 1 });

  await itemInput.fill('8');
  await page.getByRole('tab', { name: /المشاركة/ }).click();
  await expect(page.getByRole('tab', { name: /المشاركة/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('يُحسب آليًا من الرصد السريع')).toBeVisible();

  await page.getByRole('tab', { name: /اختبار/ }).click();
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  const first = page.locator('input[data-fk="t-interaction:student:a-interaction:item"]');
  const next = page.locator('input[data-fk="t-interaction:student:b-interaction:item"]');
  await first.fill('8');
  await next.click();
  await page.waitForFunction(() => window.store.state.scores.some((score) =>
    !score.deleted && score.studentId === 'interaction:student:a' && score.itemId === 'interaction:item' && score.value === 8));
  await expect(next).toBeFocused();

  // Let the local change paint on the Grades screen, then put an unrelated
  // class card on screen before the real own-record sync completes.
  await next.fill('6');
  await page.waitForTimeout(50);
  await page.goto('/#/classes');
  const classCard = page.locator('.class-card').first();
  await expect(classCard).toBeVisible();
  const cardStayedMounted = await page.evaluate(async () => {
    const card = document.querySelector('.class-card');
    await window.__syncModule.syncAll({ full: false });
    return card?.isConnected;
  });
  expect(cardStayedMounted).toBe(true);

  // A newer cloud record is a real data change and must still refresh the UI.
  const remoteSection = cloud.tables.sections.find((section) => section.id === 'interaction:section');
  remoteSection.label = 'ب';
  remoteSection.client_updated_at = Date.now() + 10_000;
  const cardWasReplacedForRemoteChange = await page.evaluate(async () => {
    const card = document.querySelector('.class-card');
    await window.__syncModule.syncStructural();
    return !card?.isConnected;
  });
  expect(cardWasReplacedForRemoteChange).toBe(true);
  await expect(page.locator('.class-card')).toContainText('ب');

  await page.goto('/#/teaching/interaction:teaching/grades');
  await page.locator('[data-act="mode"][data-mode="table"]').click();
  const finalNext = page.locator('input[data-fk="t-interaction:student:b-interaction:item"]');
  await finalNext.fill('6');
  await page.locator('a[href="#/student/interaction:student:a"]').click();
  await expect(page).toHaveURL(/#\/student\/interaction:student:a/);
  await expect(page.getByText('طالب التفاعل أ', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
