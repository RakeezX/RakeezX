import { test, expect } from '@playwright/test';

async function waitForSyncState(page, status) {
  await page.waitForFunction(expected => window.__syncModule?.displayState().status === expected, status);
}

async function expectSingleVisibleHubTrigger(page) {
  await expect.poll(() => page.locator('.teacher-mini-hub-trigger, .topbar__teacher-btn').evaluateAll(elements => (
    elements.filter(element => element.getClientRects().length > 0).length
  ))).toBe(1);
}

test('Teacher Mini Hub reconciles live V2 sync state without dismissal', async ({ page, context }) => {
  test.setTimeout(60_000);
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.route('**/auth/v1/token?grant_type=refresh_token', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error_description: 'Synthetic expired session' }),
  }));

  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);
  await page.evaluate(async () => {
    const cloud = await import('/src/lib/cloud.js');
    let revision = 0;
    let mode = 'success';
    let release;

    cloud.setMockBackend({
      fetchRecords: async () => [],
      applySyncV2Mutation: async envelope => {
        if (mode === 'hold') await new Promise(resolve => { release = resolve; });
        const nextRevision = ++revision;
        return {
          mutationId: envelope.mutationId,
          entity: envelope.entity,
          recordId: envelope.recordId,
          canonicalId: envelope.recordId,
          outcome: 'applied',
          appliedGroups: Object.keys(envelope.patch),
          conflictedGroups: [],
          resultRevision: nextRevision,
          canonical: {
            id: envelope.recordId,
            ...envelope.patch,
            revision: nextRevision,
            field_revisions: {},
            deleted_at: null,
          },
        };
      },
    });
    cloud.setMockAuth({ id: 'sync-ui-owner', email: 'sync-ui@example.test' }, { access_token: 'sync-ui-token' });
    window.__syncUiTest = {
      setMode(value) { mode = value; },
      holding() { return Boolean(release); },
      release() { release?.(); },
    };
    await window.__syncModule.syncAll({ full: true });
  });
  await waitForSyncState(page, 'synced');
  await expectSingleVisibleHubTrigger(page);

  const healthySummary = await page.evaluate(() => window.__syncModule.getSyncOperationalSummary());
  expect(healthySummary).toMatchObject({
    state: 'synced', pendingCount: 0, failedCount: 0, blockedCount: 0,
    rejectedCount: 0, actionableSyncIssue: false, localWorkSaved: true,
    cloudSyncHealthy: true, teacherActionRequired: false, safeToContinueUnrelatedWork: true,
  });
  expect(JSON.stringify(healthySummary)).not.toMatch(/recordId|mutationId|patch|receipt|token|student|class/i);

  await page.locator('.teacher-mini-hub-trigger').click();
  const sheet = page.locator('.sheet').last();
  const badge = sheet.locator('.mini-hub-sync__state .badge');
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveText('متزامن');
  await expect(badge).toHaveClass(/badge--brand/);

  await page.evaluate(async () => {
    await window.store.save({ subjects: [{ id: 'sync-ui:pending', name: 'مادة اختبار', slug: 'sync-ui-pending' }] });
  });
  await waitForSyncState(page, 'pending');
  await expect(badge).toHaveText('تغييرات بانتظار المزامنة');
  await expect(badge).toHaveClass(/badge--neutral/);

  await page.evaluate(() => {
    window.__syncUiTest.setMode('hold');
    window.__syncUiRun = window.__syncModule.syncAll({ full: false });
  });
  await waitForSyncState(page, 'syncing');
  await expect(badge).toHaveText('جارٍ مزامنة التغييرات');
  await expect(badge).toHaveClass(/badge--neutral/);
  await page.waitForFunction(() => window.__syncUiTest.holding());
  await page.evaluate(async () => {
    window.__syncUiTest.setMode('success');
    window.__syncUiTest.release();
    await window.__syncUiRun;
  });
  await waitForSyncState(page, 'synced');
  await expect(badge).toHaveText('متزامن');
  await expect(badge).toHaveClass(/badge--brand/);
  await expect(sheet).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(async () => {
    await window.store.save({ subjects: [{ id: 'sync-ui:offline', name: 'مادة دون اتصال', slug: 'sync-ui-offline' }] });
  });
  await waitForSyncState(page, 'offline');
  const offlineSummary = await page.evaluate(() => window.__syncModule.getSyncOperationalSummary());
  expect(offlineSummary).toMatchObject({
    state: 'offline', pendingCount: 1, actionableSyncIssue: true,
    automaticRetryActive: false, teacherActionRequired: false,
    localWorkSaved: true, cloudSyncHealthy: false, safeToContinueUnrelatedWork: true,
  });
  await context.setOffline(false);
  await page.evaluate(() => window.__syncModule.syncAll({ full: false }));
  await waitForSyncState(page, 'synced');

  await sheet.locator('[data-sheet-close]').first().click();
  await expectSingleVisibleHubTrigger(page);

  await page.evaluate(() => {
    window.__syncModule.state.status = 'error';
  });
  await page.locator('.teacher-mini-hub-trigger').click();
  await expect(badge).toHaveText('تعذر إكمال المزامنة');
  await expect(badge).toHaveClass(/badge--danger/);

  await sheet.locator('[data-sheet-close]').first().click();
  await expectSingleVisibleHubTrigger(page);
  await page.evaluate(async () => {
    const cloud = await import('/src/lib/cloud.js');
    const user = { id: 'sync-ui-owner', email: 'sync-ui@example.test' };
    cloud.setMockAuth(user, {
      access_token: 'expired-sync-ui-token', refresh_token: 'invalid-sync-ui-refresh',
      expires_at: 1, user,
    });
    await cloud.request('/students?select=*').catch(() => {});
  });
  await waitForSyncState(page, 'auth_required');
  await page.locator('.teacher-mini-hub-trigger').click();
  await expect(badge).toHaveText('يلزم تسجيل الدخول');
  await expect(badge).toHaveClass(/badge--warn/);
  expect(runtimeErrors).toEqual([]);
});

test('Teacher Mini Hub has one mobile trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);
  await expectSingleVisibleHubTrigger(page);
});
