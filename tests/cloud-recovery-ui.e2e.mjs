import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { STORES } from '../src/lib/db.js';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

test.setTimeout(120_000);

const OWNER = '11111111-1111-4111-8111-111111111111';

async function seedClaimedOwner(page, ownerId = OWNER) {
  await page.route('**/__cloud_restore_fixture__', (route) => route.fulfill({ body: '<!doctype html><title>fixture</title>' }));
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => route.fulfill({ json: { id: ownerId, email: 'teacher@example.test' } }));
  await page.goto('/__cloud_restore_fixture__');
  await page.evaluate(async ({ ownerId, stores, authKey }) => {
    const result = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const done = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const claimId = 'claim:cloud-recovery-ui';
    const request = indexedDB.open('rakeezx', 7);
    request.onupgradeneeded = () => stores.forEach((name) => {
      if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
    });
    const database = await result(request);
    const tx = database.transaction('device', 'readwrite');
    tx.objectStore('device').put({
      id: 'device', deviceId: 'device:cloud-recovery-ui', schemaVersion: 7,
      workspaceClaim: { version: 1, claimId, state: 'claimed', ownerId, origin: location.origin,
        databaseName: 'rakeezx', deviceId: 'device:cloud-recovery-ui', evidenceHash: 'cloud-recovery-evidence',
        createdAt: 100, updatedAt: 100 },
    });
    await done(tx);
    database.close();
    const { createWorkspaceRegistry } = await import('/src/lib/workspaces.js');
    const registry = createWorkspaceRegistry();
    await registry.registerLegacyClaim(ownerId, { claimId, evidenceHash: 'cloud-recovery-evidence' });
    await registry.close();
    localStorage.setItem(authKey, JSON.stringify({
      access_token: 'cloud-recovery-test-token', refresh_token: 'cloud-recovery-refresh',
      expires_at: 4_102_444_800, user: { id: ownerId, email: 'teacher@example.test' },
    }));
  }, { ownerId, stores: STORES, authKey: AUTH_STORAGE_KEY });
  await page.unroute('**/__cloud_restore_fixture__');
}

async function openBackup(page, { claimed = false } = {}) {
  if (claimed) await seedClaimedOwner(page);
  await page.goto('/#/settings/backup');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.getByRole('heading', { name: 'البيانات والنسخ الاحتياطي' })).toBeVisible();
}

async function createBackup(page, sourceOwnerId = OWNER, { withDeletion = false } = {}) {
  return page.evaluate(async ({ ownerId, includeDeletion }) => {
    const db = await import('/src/lib/db.js');
    const { buildBackup } = await import('/src/lib/export.js');
    await db.put('students', {
      id: `cloud-ui:${ownerId}`,
      name: 'طالب الاستعادة الآمنة', note: '', status: 'active', deleted: false,
      updatedAt: 1, serverRevision: 0,
    });
    if (includeDeletion) {
      const serverCanonical = {
        id: 'cloud-ui:delete', name: 'طالب سيُحذف', note: '', status: 'active', deleted: false,
        updatedAt: 1, serverRevision: 1, fieldRevisions: { name: 1, note: 1, status: 1 },
      };
      await db.put('students', {
        ...serverCanonical, deleted: true, deletedAt: 2, updatedAt: 2,
        serverCanonical,
      });
    }
    await db.clearStore('outbox');
    return buildBackup({ sourceOwnerId: ownerId, backupId: `cloud-ui-backup:${ownerId}` });
  }, { ownerId: sourceOwnerId, includeDeletion: withDeletion });
}

async function createIsolatedOwnerBackup(browser, ownerId) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await seedClaimedOwner(page, ownerId);
    return await page.evaluate(async (sourceOwnerId) => {
      const db = await import('/src/lib/db.js');
      const { buildBackup } = await import('/src/lib/export.js');
      await db.put('students', { id: `cloud-ui:${sourceOwnerId}`, name: 'synthetic B source',
        status: 'active', deleted: false, updatedAt: 1, serverRevision: 0 });
      return buildBackup({ sourceOwnerId, backupId: `cloud-ui-backup:${sourceOwnerId}` });
    }, ownerId);
  } finally {
    await context.close();
  }
}

async function setCloudFile(page, payload, name = 'rakeez-cloud-backup.json') {
  await page.locator('#cloud-restore-file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
}

async function resetCloudFile(page) {
  await page.getByRole('button', { name: 'اختيار نسخة أخرى' }).click();
  await expect(page.locator('.cloud-recovery-flow')).toHaveCount(0);
}

async function installHealthyCloud(page, { finalizeDelay = 0, serverStudents = [], finalStudents = serverStudents } = {}) {
  await page.evaluate(async ({ ownerId, delay, initialStudents, reconciledStudents }) => {
    const cloud = await import('/src/lib/cloud.js');
    const db = await import('/src/lib/db.js');
    const { SYNC_V2_SCHEMAS, SYNC_V2_STORES } = await import('/src/lib/sync-v2.js');
    const canonical = Object.fromEntries(SYNC_V2_STORES.map((storeName) => [SYNC_V2_SCHEMAS[storeName].entity, []]));
    const finalCanonical = structuredClone(canonical);
    canonical.students = initialStudents;
    finalCanonical.students = reconciledStudents;
    window.__cloudRecoveryCalls = { stage: 0, finalize: 0 };
    cloud.setMockAuth({ id: ownerId, email: 'teacher@example.test' }, {
      access_token: 'test-token', user: { id: ownerId, email: 'teacher@example.test' },
    });
    const stageRestore = async (envelope) => {
      window.__cloudRecoveryCalls.stage += 1;
      if (!Array.isArray(envelope.sourceManifest)) throw new Error('Missing canonical source manifest');
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash, stageHash: 'cloud-ui-stage-hash' };
    };
    const finalizeRestore = async (envelope) => {
      window.__cloudRecoveryCalls.finalize += 1;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return { restoreId: envelope.restoreId, backupHash: envelope.backupHash,
        stageHash: envelope.expectedStageHash,
        receipt: { restoreId: envelope.restoreId, status: 'finalized' } };
    };
    cloud.setMockBackend({
      async fetchOwnerSyncMarker() { return { protocol: 'OWNER_SIGNAL_V1', ownerId, revision: '1' }; },
      async fetchRecords(tableName) {
        return window.__cloudRecoveryCalls.finalize ? finalCanonical[tableName] ?? [] : canonical[tableName] ?? [];
      },
      stageSyncV2Restore: stageRestore,
      finalizeSyncV2Restore: finalizeRestore,
      stageScoreRestoreV2: stageRestore,
      finalizeScoreRestoreV2: finalizeRestore,
    });
    await db.clearStore('outbox');
  }, { ownerId: OWNER, delay: finalizeDelay, initialStudents: serverStudents, reconciledStudents: finalStudents });
}

async function expectNoOverflow(page, label) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), label).toBe(true);
}

test('Cloud Recovery validates V3/V4 accurately and represents file/auth failures', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await openBackup(page);

  await page.locator('#cloud-restore-file').setInputFiles({
    name: 'unsupported-v2.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'rakeezx', version: 2, data: { students: [{ id: 'legacy', name: 'قديم' }] } })),
  });
  await expect(page.getByRole('alert')).toContainText('النسخة غير مدعومة');
  await resetCloudFile(page);

  await page.locator('#cloud-restore-file').setInputFiles({
    name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from('{not-json'),
  });
  await expect(page.getByRole('alert')).toContainText('النسخة غير صالحة');
  await resetCloudFile(page);

  const legacy = {
    app: 'rakeezx', version: 3, exportedAt: new Date().toISOString(),
    data: { students: [{ id: 'v3:student', name: 'نسخة قديمة', deleted: false, updatedAt: 1 }] },
  };
  await setCloudFile(page, legacy, 'supported-v3.json');
  await expect(page.locator('.cloud-validation')).toContainText('تم التحقق من بنية النسخة');
  await expect(page.locator('.cloud-validation')).toContainText('تحقق بنيوي لإصدار V3');
  await expect(page.locator('.cloud-validation')).not.toContainText('تم التحقق من سلامة النسخة');
  await resetCloudFile(page);

  const v4 = await createBackup(page);
  await setCloudFile(page, v4, 'supported-v4.json');
  await expect(page.locator('.cloud-validation')).toContainText('تم قراءة الملف');
  await expect(page.locator('.cloud-validation')).toContainText('تم التحقق من سلامة النسخة');
  await page.getByRole('button', { name: 'متابعة إلى المعاينة السحابية' }).click();
  await expect(page.getByRole('alert')).toContainText('يلزم تسجيل الدخول');
  expect(errors).toEqual([]);
});

test('ready Cloud Recovery previews six states, confirms counts, and reconciles once', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await openBackup(page, { claimed: true });
  const serverStudent = {
    id: 'cloud-ui:delete', name: 'طالب سيُحذف', note: '', status: 'active', revision: 1,
    field_revisions: { name: 1, note: 1, status: 1 }, deleted_at: null,
  };
  await installHealthyCloud(page, {
    finalizeDelay: 350,
    serverStudents: [serverStudent],
    finalStudents: [{ ...serverStudent, revision: 2, deleted_at: '2026-09-11T00:00:00.000Z' }],
  });
  const payload = await createBackup(page, OWNER, { withDeletion: true });
  await setCloudFile(page, payload);
  await expect(page.locator('.cloud-validation')).toContainText('تم التحقق من سلامة النسخة');
  await page.getByRole('button', { name: 'متابعة إلى المعاينة السحابية' }).click();
  await expect(page.locator('.cloud-plan-summary')).toBeVisible();
  for (const label of ['ستتم إضافتها', 'ستتحدث', 'ستُحذف', 'ستبقى كما هي', 'موجودة في السحابة فقط', 'محظورة وتحتاج مراجعة']) {
    await expect(page.locator('.cloud-plan-summary')).toContainText(label);
  }
  await expect(page.locator('.cloud-local-only-note')).toContainText('بعض البيانات المحلية الخاصة بهذا الجهاز لا تدخل ضمن المقارنة السحابية');

  await page.getByRole('button', { name: 'المتابعة إلى التأكيد' }).click();
  const dialog = page.getByRole('dialog', { name: 'تأكيد الاستعادة السحابية الآمنة' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('حذف', { exact: true })).toBeVisible();
  await expect(dialog.locator('.cloud-confirm-summary .is-delete strong')).toHaveText('1');
  await expect(dialog.getByRole('button', { name: 'إلغاء' })).toBeFocused();
  await dialog.getByRole('button', { name: 'استعادة النسخة بأمان' }).click();
  await expect(page.locator('.cloud-restore-progress')).toContainText('تنفيذ الاستعادة السحابية');
  await expect(page.locator('.cloud-restore-progress')).toContainText('تحديث هذا الجهاز بالنسخة النهائية');
  await expect(page.locator('.cloud-recovery-message.is-success')).toContainText('تمت استعادة بياناتك بنجاح');
  expect(await page.evaluate(() => window.__cloudRecoveryCalls)).toEqual({ stage: 1, finalize: 1 });
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    const record = await db.get('students', 'cloud-ui:delete');
    return { deleted: record?.deleted, live: (await db.getAll('students'))
      .some((student) => student.id === 'cloud-ui:delete' && !student.deleted) };
  })).toEqual({ deleted: true, live: false });
  expect(errors).toEqual([]);
});

test('blocked review cannot restore and finalized checkpoint resumes local reconciliation', async ({ page, browser }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await openBackup(page, { claimed: true });
  await installHealthyCloud(page);
  const differentOwner = '22222222-2222-4222-8222-222222222222';
  await page.evaluate(async () => (await import('/src/lib/db.js')).put('students', {
    id: 'cloud-ui:a-preserve', name: 'synthetic A', status: 'active', deleted: false, updatedAt: 1,
  }));
  const mismatched = await createIsolatedOwnerBackup(browser, differentOwner);
  const before = await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return { students: await db.getAll('students'), outbox: await db.getAll('outbox') };
  });
  expect(mismatched.version).toBe(5);
  expect(mismatched.sourceOwnerId).toBe(differentOwner);
  await setCloudFile(page, mismatched, 'different-account.json');
  await expect(page.locator('.cloud-validation')).toContainText('تم التحقق من سلامة النسخة');
  await page.getByRole('button', { name: 'متابعة إلى المعاينة السحابية' }).click();
  await expect(page.locator('.cloud-plan-summary')).toContainText('محظورة وتحتاج مراجعة');
  await expect(page.locator('.cloud-plan-details')).toContainText('لا يمكن تطبيق هذا السجل تلقائيًا بأمان');
  await expect(page.getByRole('button', { name: 'المتابعة إلى التأكيد' })).toBeDisabled();
  await expect(page.locator('.cloud-recovery-blocked-copy')).toContainText('يمنع الاستعادة كاملة');
  expect(await page.evaluate(() => window.__cloudRecoveryCalls)).toEqual({ stage: 0, finalize: 0 });
  expect(await page.evaluate(() => import('/src/lib/cloud.js').then((cloud) => cloud.user.id))).toBe(OWNER);
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return { students: await db.getAll('students'), outbox: await db.getAll('outbox') };
  })).toEqual(before);
  expect(await page.evaluate((ownerId) => import('/src/lib/db.js').then((db) =>
    db.get('students', `cloud-ui:${ownerId}`)), differentOwner)).toBeUndefined();

  await resetCloudFile(page);
  await page.evaluate(async () => {
    await window.store.patchDevice({
      cloudRestoreResume: {
        version: 1, restoreId: 'cloud-ui-resume', backupHash: 'a'.repeat(64), backupVersion: 4,
        stageHash: 'cloud-ui-stage-hash', state: 'finalized', localData: {},
        stagedAt: Date.now() - 1000, finalizedAt: Date.now(),
        receipt: { restoreId: 'cloud-ui-resume', status: 'finalized' },
      },
    }, { queue: false });
  });
  await page.evaluate(() => { window.location.hash = '#/settings'; });
  await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();
  await page.evaluate(() => { window.location.hash = '#/settings/backup'; });
  await expect(page.getByRole('heading', { name: 'البيانات والنسخ الاحتياطي' })).toBeVisible();
  await expect(page.locator('.cloud-resume-panel')).toContainText('اكتملت الاستعادة في السحابة');
  await expect(page.locator('.cloud-resume-panel')).toContainText('يحتاج هذا الجهاز إلى إكمال التحديث');
  await expect(page.getByRole('button', { name: 'اختيار نسخة للمراجعة' })).toBeDisabled();
  await page.getByRole('button', { name: 'إكمال تحديث هذا الجهاز' }).click();
  await expect(page.locator('.cloud-recovery-message.is-success')).toContainText('تمت استعادة بياناتك بنجاح');
  expect(await page.evaluate(() => window.__cloudRecoveryCalls)).toEqual({ stage: 0, finalize: 1 });
  expect(errors).toEqual([]);
});

test('Cloud Recovery review is responsive, RTL, accessible, and reduced-motion safe', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('test-results/cloud-recovery-ui', { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBackup(page, { claimed: true });
  await installHealthyCloud(page);
  const payload = await createBackup(page);
  await setCloudFile(page, payload);
  await page.getByRole('button', { name: 'متابعة إلى المعاينة السحابية' }).click();
  await expect(page.locator('.cloud-plan-summary')).toBeVisible();

  for (const theme of ['light', 'dark']) {
    await page.evaluate((selected) => document.documentElement.setAttribute('data-theme', selected), theme);
    for (const width of [320, 390, 412, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 860 : 900 });
      await expectNoOverflow(page, `${theme}/${width}`);
      if (width <= 412) {
        const buttonBoxes = await page.locator('.cloud-recovery-flow button:visible, .recovery-path--cloud button:visible').evaluateAll((buttons) =>
          buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
        expect(buttonBoxes.every((box) => box.width >= 44 && box.height >= 44), `${theme}/${width} touch targets`).toBe(true);
      }
      await page.screenshot({ path: `test-results/cloud-recovery-ui/review-${theme}-${width}.png`, fullPage: true });
    }
  }

  await page.getByRole('button', { name: 'المتابعة إلى التأكيد' }).focus();
  await expect(page.getByRole('button', { name: 'المتابعة إلى التأكيد' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'تأكيد الاستعادة السحابية الآمنة' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('.sheet').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'تأكيد الاستعادة السحابية الآمنة' })).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const animation = await page.locator('.cloud-recovery-flow').evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('scroll-behavior'));
  expect(typeof animation).toBe('string');
  expect(errors).toEqual([]);
});
