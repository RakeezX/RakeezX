import { test, expect } from '@playwright/test';

// Local synthetic IndexedDB only; no authentication or remote Product data.
async function seed(page) {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.ready);
  return page.evaluate(async () => {
    const p = 'reinstate-safety';
    const ids = Object.fromEntries(['year','term','subject','x','y','tx','ty','active','withdrawn','session','note']
      .map(key => [key, `${p}:${key}`]));
    const common = { updatedAt: 1788307200000, deleted: false };
    await window.store.save({
      years: [{ id: ids.year, label: '1450–1451 هـ', hijriStart: 1450, status: 'active', ...common }],
      terms: [
        { id: ids.term, yearId: ids.year, name: 'الفصل الأول', index: 1, status: 'active', ...common },
        { id: `${p}:term2`, yearId: ids.year, name: 'الفصل الثاني', index: 2, status: 'upcoming', ...common },
      ],
      subjects: [{ id: ids.subject, name: 'مادة اختبار', ...common }],
      sections: [
        { id: ids.x, yearId: ids.year, grade: 4, label: 'أ', ...common },
        { id: ids.y, yearId: ids.year, grade: 4, label: 'ب', ...common },
      ],
      teachings: [
        { id: ids.tx, sectionId: ids.x, subjectId: ids.subject, termId: ids.term, ...common },
        { id: ids.ty, sectionId: ids.y, subjectId: ids.subject, termId: ids.term, ...common },
      ],
      students: [
        { id: ids.active, name: 'طالب اختبار نشط', status: 'active', ...common },
        { id: ids.withdrawn, name: 'طالب اختبار مغادر', status: 'withdrawn', ...common },
      ],
      enrollments: [
        { id: `${p}:active-en`, studentId: ids.active, sectionId: ids.x, rollNo: 1, startDate: '2026-08-01', endDate: null, status: 'active', ...common },
        { id: `${p}:withdrawn-en`, studentId: ids.withdrawn, sectionId: ids.x, rollNo: 2, startDate: '2026-08-01', endDate: '2026-09-01', status: 'withdrawn', ...common },
      ],
      sessions: [{ id: ids.session, teachingId: ids.tx, date: '2026-08-20', period: 1, status: 'held', ...common }],
      attendance: [{ id: `${p}:attendance`, studentId: ids.withdrawn, sessionId: ids.session, teachingId: ids.tx, date: '2026-08-20', status: 'absent', ...common }],
      notes: [{ id: ids.note, studentId: ids.withdrawn, teachingId: ids.tx, date: '2026-08-20', kind: 'general', text: 'ملاحظة تاريخية محفوظة', createdAt: common.updatedAt, ...common }],
    });
    await window.store.patchDevice({ activeYearId: ids.year, activeTermId: ids.term });
    return ids;
  });
}

async function recordState(page, id) {
  return page.evaluate(async studentId => {
    const db = await import('/src/lib/db.js');
    return {
      student: await db.get('students', studentId),
      enrollments: (await db.getAll('enrollments')).filter(row => row.studentId === studentId),
      attendance: (await db.getAll('attendance')).filter(row => row.studentId === studentId),
      notes: (await db.getAll('notes')).filter(row => row.studentId === studentId),
      outbox: await db.getAll('outbox'),
    };
  }, id);
}

for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
  test(`withdrawn history without reinstatement — ${width}px ${theme}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height: 900 });
    const ids = await seed(page);
    await page.evaluate(async theme => {
      await window.store.patchDevice({ theme });
      window.store.applyTheme(); // Same sequence as the Settings theme action.
    }, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.goto(`/#/teaching/${ids.tx}/students`);
    const former = page.locator('.former-students-section');
    await expect(former).toContainText('طالب اختبار مغادر');
    await former.locator(`a[href="#/student/${ids.withdrawn}"]`).click();
    await expect(page.locator('.student-profile-header__name')).toHaveText('طالب اختبار مغادر');
    await expect(page.getByText('هذا الطالب غادر المدرسة — سجلّه محفوظ كاملًا للعرض.', { exact: false })).toBeVisible();
    await expect(page.locator('[data-act="reinstate"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'أعده للدراسة' })).toHaveCount(0);
    await expect(page.locator('[data-act="withdraw"]')).toHaveCount(0);
    const before = await recordState(page, ids.withdrawn);
    // A stale delegated control must also be inert: the action handler is gone.
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.dataset.act = 'reinstate'; button.id = 'stale-reinstate';
      button.textContent = 'stale synthetic control';
      document.querySelector('.student-profile-actions__row').append(button);
    });
    await page.locator('#stale-reinstate').click();
    expect(await recordState(page, ids.withdrawn)).toEqual(before);
    await expect(page.locator('#toast')).not.toContainText('أُعيد للدراسة');
    await page.locator('#stale-reinstate').evaluate(node => node.remove());
    await page.locator('.student-profile-enrollment summary').click();
    await expect(page.locator('.student-profile-enrollment')).toContainText('غادر');
    await page.locator('.student-attendance-history summary').click();
    await expect(page.locator('.student-attendance-history')).toContainText('غائب');
    await page.locator('.student-notes-history summary').click();
    await expect(page.locator('.student-notes-history')).toContainText('ملاحظة تاريخية محفوظة');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.locator('.student-profile-header__name')).toHaveText('طالب اختبار مغادر');
    await expect(page.locator('[data-act="reinstate"]')).toHaveCount(0);
    expect(await recordState(page, ids.withdrawn)).toEqual(before);
    await page.goto(`/#/student/${ids.active}?teaching=${ids.tx}`);
    await expect(page.locator('[data-act="withdraw"]')).toBeVisible();
    await expect(page.locator('.student-profile-actions [data-act="share"]')).toBeVisible();
    await expect(page.locator('.student-profile-actions [data-act="print"]')).toBeVisible();
    await expect(page.locator('[data-act="reinstate"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('active roster edit and actual Transfer control retain identity/history after reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const ids = await seed(page);
  const withdrawnBefore = await recordState(page, ids.withdrawn);
  await page.goto(`/#/teaching/${ids.tx}/students`);
  await page.locator(`[data-act="edit"][data-id="${ids.active}"]`).click();
  await page.locator('#edit-student input[name="name"]').fill('طالب اختبار معدل');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.locator('.roster-list')).toContainText('طالب اختبار معدل');
  await page.locator(`[data-act="edit"][data-id="${ids.active}"]`).click();
  await page.locator('#btn-transfer').click();
  await page.locator(`[data-pick="${ids.y}"]`).click();
  await expect(page.locator('.roster-list a[href*="' + ids.active + '"]')).toHaveCount(0);
  await page.goto(`/#/teaching/${ids.ty}/students`);
  await expect(page.locator('.roster-list')).toContainText('طالب اختبار معدل');
  await page.reload();
  await expect(page.locator('.roster-list')).toContainText('طالب اختبار معدل');
  expect(await page.evaluate(ids => ({
    id: window.store.getStudent(ids.active).id,
    sectionId: window.store.activeEnrollment(ids.active).sectionId,
    originalStart: window.store.enrollmentsOf(ids.active).find(row => row.sectionId === ids.x).startDate,
  }), ids)).toEqual({ id: ids.active, sectionId: ids.y, originalStart: '2026-08-01' });
  const withdrawnAfter = await recordState(page, ids.withdrawn);
  for (const key of ['student','enrollments','attendance','notes']) expect(withdrawnAfter[key]).toEqual(withdrawnBefore[key]);
  expect(errors).toEqual([]);
});
