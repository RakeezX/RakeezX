import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { validateBackupIntegrity } from '../src/lib/export.js';

test.setTimeout(120_000);

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'teacher@example.test';

async function navigateTo(page, hash, title) {
  await page.evaluate((nextHash) => { location.hash = nextHash; }, hash);
  await page.waitForURL(new RegExp(`${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
}

async function openBackup(page) {
  await page.goto('/#/settings/backup');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'البيانات والنسخ الاحتياطي', exact: true, level: 1 })).toBeVisible();
}

async function authenticateAndRemount(page, ownerId = OWNER) {
  await page.route('https://xlrubcwjqktzzunrvuns.supabase.co/auth/v1/user', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: ownerId, email: EMAIL }) });
  });
  await page.evaluate(async ({ owner, email }) => {
    const cloud = await import('/src/lib/cloud.js');
    cloud.setMockAuth({ id: owner, email }, { access_token: 'synthetic-claim-token', user: { id: owner, email } });
    cloud.setMockBackend({ async fetchRecords() { return []; } });
    location.hash = '#/settings';
  }, { owner: ownerId, email: EMAIL });
  await page.waitForURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true, level: 1 })).toBeVisible();
  await navigateTo(page, '#/settings/backup', 'البيانات والنسخ الاحتياطي');
}

async function downloadFreshBackup(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تنزيل نسخة' }).click(),
  ]);
  const path = await download.path();
  const payload = JSON.parse(await readFile(path, 'utf8'));
  expect(await validateBackupIntegrity(payload)).toMatchObject({ ok: true, integrity: 'verified' });
  await expect(page.getByText('اكتمل آخر تنزيل في هذه الجلسة')).toBeVisible();
  return payload;
}

test('visible claim requires a fresh backup and explicit confirmation, then remounts without repeat activation', async ({ page }) => {
  await openBackup(page);
  await expect(page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' })).toHaveCount(0);

  await authenticateAndRemount(page);
  const action = page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' });
  await expect(action).toBeVisible();
  await expect(action).toBeDisabled();
  await expect(page.getByText('نزّل نسخة احتياطية حديثة أولًا')).toBeVisible();

  const downloaded = await downloadFreshBackup(page);
  expect(downloaded).toMatchObject({ app: 'rakeezx', version: 5, sourceOwnerId: OWNER });
  await expect(action).toBeEnabled();
  await mkdir('test-results/legacy-claim-visible-action', { recursive: true });
  await page.screenshot({ path: 'test-results/legacy-claim-visible-action/claim-action.png', fullPage: true });
  await action.click();
  await expect(page.getByRole('dialog', { name: 'تأكيد ربط السجل المحلي بالحساب' }).getByText('تأكيد ربط السجل المحلي بالحساب', { exact: true })).toBeVisible();
  await expect(page.getByText(EMAIL)).toBeVisible();
  await page.screenshot({ path: 'test-results/legacy-claim-visible-action/claim-confirmation.png', fullPage: true });
  await page.getByRole('button', { name: 'إلغاء' }).click();
  const cancelled = await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return { marker: (await db.get('device', 'device'))?.workspaceClaim ?? null,
      owned: (await db.getAll('outbox')).filter((entry) => entry.ownerId != null).length };
  });
  expect(cancelled).toEqual({ marker: null, owned: 0 });

  await action.click();
  await page.getByRole('button', { name: 'نعم، اربط السجل' }).click();
  await expect(page.getByText('السجل المحلي مرتبط بالحساب')).toBeVisible();
  await expect(action).toHaveCount(0);
  const claimed = await page.evaluate(async (owner) => {
    const db = await import('/src/lib/db.js');
    const { createWorkspaceRegistry } = await import('/src/lib/workspaces.js');
    const registry = createWorkspaceRegistry();
    const device = await db.get('device', 'device');
    const records = await registry.findByAuthUserId(owner);
    const outbox = await db.getAll('outbox');
    await registry.close();
    return {
      state: device.workspaceClaim?.state,
      ownerMatch: device.workspaceClaim?.ownerId === owner,
      registryMatch: records.length === 1 && records[0].claimId === device.workspaceClaim?.claimId,
      outboxPreserved: outbox.every((entry) => entry.ownerId === owner),
    };
  }, OWNER);
  expect(claimed).toEqual({ state: 'claimed', ownerMatch: true, registryMatch: true, outboxPreserved: true });

  await navigateTo(page, '#/settings', 'الإعدادات');
  await navigateTo(page, '#/settings/backup', 'البيانات والنسخ الاحتياطي');
  await expect(page.getByText('السجل المحلي مرتبط بالحساب')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' })).toHaveCount(0);
});

test('offline and conflicting-owner states never stamp or silently retry', async ({ page, context }) => {
  await openBackup(page);
  await authenticateAndRemount(page);
  await page.evaluate(async () => {
    const { runtimeSyncOwnershipGuard } = await import('/src/lib/sync-ownership.js');
    runtimeSyncOwnershipGuard.setWorkspace({
      id: 'demo', type: 'demo', databaseName: 'rakeezx-demo', ownershipState: 'demo', syncEligible: false,
    });
    location.hash = '#/settings';
  });
  await page.waitForURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true, level: 1 })).toBeVisible();
  await navigateTo(page, '#/settings/backup', 'البيانات والنسخ الاحتياطي');
  await expect(page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' })).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return (await db.get('device', 'device'))?.workspaceClaim ?? null;
  })).toBeNull();
  await page.evaluate(async () => {
    const { runtimeSyncOwnershipGuard, LEGACY_UNCLAIMED_SYNC_WORKSPACE } = await import('/src/lib/sync-ownership.js');
    runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE);
    location.hash = '#/settings';
  });
  await page.waitForURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true, level: 1 })).toBeVisible();
  await navigateTo(page, '#/settings/backup', 'البيانات والنسخ الاحتياطي');
  await context.setOffline(true);
  await navigateTo(page, '#/settings', 'الإعدادات');
  await navigateTo(page, '#/settings/backup', 'البيانات والنسخ الاحتياطي');
  await expect(page.getByText('يلزم الاتصال للربط الأول')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' })).toBeDisabled();
  await context.setOffline(false);

  await page.evaluate(async (ownerId) => {
    const db = await import('/src/lib/db.js');
    await db.put('outbox', {
      id: 'v2:claim-conflict', mutationId: 'claim-conflict', protocol: 'v2', store: 'students',
      recordId: 'student:claim-conflict', op: 'patch', patch: { name: 'Synthetic' },
      sequence: 999, queuedAt: 1, clientUpdatedAt: 1, state: 'pending', attemptCount: 0,
      ownerId,
    });
    location.hash = '#/settings';
  }, OTHER_OWNER);
  await page.waitForURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true, level: 1 })).toBeVisible();
  await navigateTo(page, '#/settings/backup', 'البيانات والنسخ الاحتياطي');
  await downloadFreshBackup(page);
  await page.getByRole('button', { name: 'ربط السجل المحلي بالحساب' }).click();
  await page.getByRole('button', { name: 'نعم، اربط السجل' }).click();
  await expect(page.getByRole('alert')).toContainText('دليل الملكية أو سجل المزامنة غير متطابق');
  const unchanged = await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return {
      marker: (await db.get('device', 'device'))?.workspaceClaim ?? null,
      ownerId: (await db.get('outbox', 'v2:claim-conflict'))?.ownerId,
    };
  });
  expect(unchanged).toEqual({ marker: null, ownerId: OTHER_OWNER });
});
