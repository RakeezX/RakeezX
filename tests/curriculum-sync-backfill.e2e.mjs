import { test, expect } from '@playwright/test';

test.setTimeout(120_000);

const OWNER = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'curriculum@example.test';
const BOOTSTRAP = 'bootstrap:curriculum-e2e';

const canonicalUnit = {
  id: 'unit:curriculum-e2e', subject_id: 'subject:curriculum-e2e', grade: 4, term_index: 1,
  name: 'الوحدة الاصطناعية', order: 0, planned_sessions: 2, revision: 1,
  field_revisions: { identity: 1, content: 1, order: 1, planning: 1 },
  client_updated_at: 10, deleted_at: null,
};
const canonicalLesson = {
  id: 'lesson:curriculum-e2e', unit_id: canonicalUnit.id, name: 'الدرس الاصطناعي', order: 0,
  planned_sessions: 1, revision: 1,
  field_revisions: { identity: 1, content: 1, order: 1, planning: 1 },
  client_updated_at: 10, deleted_at: null,
};

async function openBackup(page) {
  await page.goto('/#/settings/backup');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'البيانات والنسخ الاحتياطي', exact: true })).toBeVisible();
}

async function downloadBackup(page) {
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تنزيل نسخة' }).click(),
  ]);
  await expect(page.getByText('اكتمل آخر تنزيل في هذه الجلسة')).toBeVisible();
}

test('claimed workspace explicitly bootstraps curriculum after backup and persists COMPLETE across reload', async ({ page }) => {
  let serverState = 'NOT_STARTED';
  const calls = { contribute: 0, finalize: 0 };
  const status = () => ({
    protocolVersion: 1, bootstrapId: serverState === 'NOT_STARTED' ? undefined : BOOTSTRAP,
    state: serverState, unitCount: serverState === 'NOT_STARTED' ? 0 : 1,
    lessonCount: serverState === 'NOT_STARTED' ? 0 : 1, conflicts: serverState === 'CONFLICT'
      ? [{ entity: 'units', id: canonicalUnit.id, reason: 'same-id-different-content' }] : [],
  });
  await page.route('https://xlrubcwjqktzzunrvuns.supabase.co/auth/v1/user', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: OWNER, email: EMAIL }) }));
  await page.route('https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/rpc/get_curriculum_sync_bootstrap_status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status()) });
    }
    if (url.pathname.endsWith('/rpc/contribute_curriculum_sync_bootstrap')) {
      const body = route.request().postDataJSON();
      expect(body.p_authoritative).toBe(true);
      expect(body.p_units.map((row) => row.id)).toEqual([canonicalUnit.id]);
      expect(body.p_lessons.map((row) => row.id)).toEqual([canonicalLesson.id]);
      calls.contribute += 1;
      serverState = 'IN_PROGRESS';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status()) });
    }
    if (url.pathname.endsWith('/rpc/finalize_curriculum_sync_bootstrap')) {
      calls.finalize += 1;
      serverState = 'COMPLETE';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ...status(), units: [canonicalUnit], lessons: [canonicalLesson],
      }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await openBackup(page);
  await expect(page.getByText('حفظ المنهج مع الحساب', { exact: true })).toHaveCount(0);
  await page.evaluate(async ({ owner, email }) => {
    const cloud = await import('/src/lib/cloud.js');
    cloud.setMockAuth({ id: owner, email }, { access_token: 'curriculum-e2e-token', user: { id: owner, email } });
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify({
      access_token: 'curriculum-e2e-token', expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: owner, email },
    }));
    const store = window.store;
    await store.save({ subjects: [{ id: 'subject:curriculum-e2e', name: 'منهج', slug: 'curriculum-e2e' }] }, { queue: false });
    await store.save({ units: [{ id: 'unit:curriculum-e2e', subjectId: 'subject:curriculum-e2e', grade: 4,
      termIndex: 1, name: 'الوحدة الاصطناعية', order: 0, plannedSessions: 2, updatedAt: 10 }] }, { queue: false });
    await store.save({ lessons: [{ id: 'lesson:curriculum-e2e', unitId: 'unit:curriculum-e2e',
      name: 'الدرس الاصطناعي', order: 0, plannedSessions: 1, updatedAt: 10 }] }, { queue: false });
    location.hash = '#/settings';
  }, { owner: OWNER, email: EMAIL });
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true })).toBeVisible();
  await page.goto('/#/settings/backup');
  const claim = page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' });
  await expect(claim).toBeDisabled();
  await downloadBackup(page);
  await expect(claim).toBeEnabled();
  await claim.click();
  await page.getByRole('button', { name: 'نعم، اربط السجل' }).click();
  await expect(page.getByText('السجل المحلي مرتبط بالحساب')).toBeVisible();

  await page.goto('/#/settings');
  await page.goto('/#/settings/backup');
  const bootstrap = page.getByRole('button', { name: 'تهيئة حفظ المنهج' });
  await expect(bootstrap).toBeEnabled();
  await bootstrap.click();
  await expect(page.getByText('تأكيد حفظ المنهج مع الحساب', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'متابعة آمنة' }).click();
  await expect(page.getByText('المنهج محفوظ مع الحساب', { exact: true })).toBeVisible();
  expect(calls).toEqual({ contribute: 1, finalize: 1 });
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    const marker = (await db.get('device', 'device')).curriculumSyncBootstrap;
    return { state: marker.state, reconciled: marker.reconciled,
      units: (await db.getAll('units')).map((row) => row.id), lessons: (await db.getAll('lessons')).map((row) => row.id) };
  })).toEqual({ state: 'COMPLETE', reconciled: true, units: [canonicalUnit.id], lessons: [canonicalLesson.id] });

  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByText('المنهج محفوظ مع الحساب', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تهيئة حفظ المنهج' })).toHaveCount(0);

  serverState = 'CONFLICT';
  await page.evaluate(() => { location.hash = '#/settings'; });
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true })).toBeVisible();
  await page.evaluate(() => { location.hash = '#/settings/backup'; });
  await expect(page.getByRole('heading', { name: 'البيانات والنسخ الاحتياطي', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('توقفت التهيئة لحماية البيانات');
  expect(calls).toEqual({ contribute: 1, finalize: 1 });
});
