import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { STORES } from '../src/lib/db.js';
import { lifecycleServer, academicFixture, evidence, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';

test.setTimeout(120_000);
let pg, backend, f, errors, failReconciliation, previews;

async function seedClaimedWorkspace(page) {
  const claimId = 'claim:student-lifecycle-ui';
  await page.route('**/__student-lifecycle-workspace__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>student lifecycle workspace fixture</title>',
  }));
  await page.goto('/__student-lifecycle-workspace__');
  await page.evaluate(async ({ stores, ownerId, claimId }) => {
    const request = (operation) => new Promise((resolve, reject) => {
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
    });
    const transaction = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    const productRequest = indexedDB.open('rakeezx', 7);
    productRequest.onupgradeneeded = () => {
      for (const store of stores) {
        if (!productRequest.result.objectStoreNames.contains(store)) {
          productRequest.result.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    const product = await request(productRequest);
    const productTx = product.transaction(['device', 'profile'], 'readwrite');
    productTx.objectStore('device').put({
      id: 'device', deviceId: 'device:student-lifecycle-ui', schemaVersion: 7,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:student-lifecycle-ui',
        evidenceHash: 'student-lifecycle-ui-evidence', createdAt: 100, updatedAt: 100,
      },
    });
    productTx.objectStore('profile').put({
      id: 'profile', teacherName: 'معلم الاختبار', schoolName: 'مدرسة الاختبار',
      serverRevision: 1, updatedAt: 100,
    });
    await transaction(productTx);
    product.close();

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rakeezx-workspace-v1:${ownerId}`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const registryRequest = indexedDB.open('rakeezx-workspace-registry', 1);
    registryRequest.onupgradeneeded = () => {
      const workspaceStore = registryRequest.result.createObjectStore('workspaces', { keyPath: 'id' });
      workspaceStore.createIndex('authUserId', 'authUserId', { unique: false });
    };
    const registry = await request(registryRequest);
    const registryTx = registry.transaction('workspaces', 'readwrite');
    registryTx.objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: ownerId,
      databaseName: 'rakeezx', ownershipState: 'claimed', workspaceKind: 'legacy-in-place',
      claimId, evidenceHash: 'student-lifecycle-ui-evidence', createdAt: 100, updatedAt: 100,
    });
    await transaction(registryTx);
    registry.close();
  }, { stores: STORES, ownerId: OWNER, claimId });
  await page.unroute('**/__student-lifecycle-workspace__');
}

test.beforeEach(async ({ page }) => {
  pg = await lifecycleServer();
  backend = new LifecycleBackend(pg);
  failReconciliation = false;
  previews = [];
  f = await academicFixture(pg, 'ui-synthetic');
  await pg.query(`update rakeezx.sections set label=case when id=$1 then 'أ' else 'ب' end,name='فصل اختبار' where id in ($1,$2)`, [f.section, f.destination]);
  await pg.query(`update rakeezx.terms set name='الفصل الأول' where id=$1`, [f.term]);
  await pg.query(`update rakeezx.subjects set name='مادة اختبار' where id=$1`, [f.subject]);
  await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('teaching:destination',$1,$2,$3)`, [f.destination, f.subject, f.term]);
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('https://*.supabase.co/**', route => route.abort());
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async route => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split('/').pop();
    expect(request.headers().authorization).toBe('Bearer student-ui-test');
    try {
      if (request.method() === 'GET') {
        if (failReconciliation && backend.calls.length && endpoint === 'students') {
          await route.fulfill({ status: 503, json: { message: 'Synthetic reconciliation failure' } }); return;
        }
        await route.fulfill({ json: await backend.fetchRecords(endpoint) }); return;
      }
      const p = request.postDataJSON();
      let value;
      if (endpoint === 'score_foundation_capability') {
        await route.fulfill({ status: 204 });
        return;
      }
      if (endpoint === 'preview_student_removal') {
        value = await backend.previewStudentRemoval(p.p_student_id, p.p_source_enrollment_id, p.p_source_revision);
        previews.push(value);
      } else if (endpoint === 'apply_sync_v2_mutation') value = await backend.applySyncV2Mutation({
        entity: p.p_entity, recordId: p.p_record_id, mutationId: p.p_mutation_id, deviceId: p.p_device_id,
        baseRevision: p.p_base_revision, patch: p.p_patch, operation: p.p_operation, clientUpdatedAt: p.p_client_updated_at,
      });
      else {
        const envelope = { mutationId: p.p_mutation_id, deviceId: p.p_device_id, command: p.p_command, payload: p.p_payload, clientUpdatedAt: p.p_client_updated_at };
        if (endpoint === 'apply_student_lifecycle_command') value = await backend.applyStudentLifecycleCommand(envelope);
        else if (endpoint === 'apply_sync_v2_enrollment_command') value = await backend.applySyncV2EnrollmentCommand(envelope);
        else throw new Error(`Unexpected synthetic endpoint ${endpoint}`);
      }
      await route.fulfill({ json: value });
    } catch (error) {
      if (error.message === 'Synthetic lost response after commit') { await route.abort(); return; }
      await route.fulfill({ status: 400, json: { code: error.code ?? '22023', message: error.message } });
    }
  });
  await page.addInitScript(({ key, owner }) => localStorage.setItem(key, JSON.stringify({ access_token: 'student-ui-test', user: { id: owner } })), { key: AUTH_STORAGE_KEY, owner: OWNER });
  await seedClaimedWorkspace(page);
  await page.goto('/#/classes');
  await page.waitForFunction(studentId => window.store?.state.ready && window.store.getStudent(studentId) && window.__syncModule?.getSyncOperationalSummarySnapshot().cloudSyncHealthy, f.student);
  await page.evaluate(async f => window.store.patchDevice({ activeYearId: f.year, activeTermId: f.term }), f);
  await settleCloudSync(page);
});

test('ambiguous response resumes the same command after reload, without a second deletion identity', async ({ page }) => {
  backend.loseResponse = true;
  await profile(page);
  await confirmDelete(page);
  await expect(page.getByRole('button', { name: 'إكمال الإجراء السابق', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText(/Synthetic|student-lifecycle:|تم حذف/);
  expect(await page.evaluate(id => !!window.store.getStudent(id), f.student)).toBe(true);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
  await page.getByRole('button', { name: 'إكمال الإجراء السابق', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('تم حذف الطالب المضاف بالخطأ.');
  expect(backend.calls).toHaveLength(2);
  expect(backend.calls[0]).toEqual(backend.calls[1]);
  expect((await pg.query(`select count(*)::int n from rakeezx.student_lifecycle_receipts where student_id=$1`, [f.student])).rows[0].n).toBe(1);
  expect(errors.filter(error => !error.includes('ERR_FAILED'))).toEqual([]);
});

test('finalized lifecycle receipt finishes local reconciliation without another cloud command', async ({ page }) => {
  failReconciliation = true;
  await profile(page);
  await confirmDelete(page);
  await expect(page.getByRole('dialog')).toContainText('تم تأكيد الإجراء، ويحتاج هذا الجهاز إلى إكمال التحديث.');
  await expect(page.getByRole('button', { name: 'إكمال تحديث هذا الجهاز', exact: true })).toBeVisible();
  expect(backend.calls).toHaveLength(1);
  failReconciliation = false;
  await page.getByRole('button', { name: 'إكمال تحديث هذا الجهاز', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('تم حذف الطالب المضاف بالخطأ.');
  expect(backend.calls).toHaveLength(1);
  expect(errors.filter(error => !error.includes('503'))).toEqual([]);
});
test.afterEach(async () => { await pg?.close(); });

async function profile(page, name = 'طالب اصطناعي') {
  await page.goto(`/#/student/${f.student}?teaching=${f.teaching}`);
  await expect(page.locator('.student-profile-header__name')).toHaveText(name);
  await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
  return page.getByRole('dialog', { name: 'إدارة الطالب', exact: true });
}
async function confirmDelete(page) {
  await removeStudent(page);
  const sheet = page.getByRole('dialog', { name: 'حذف هذا الطالب؟', exact: true });
  await expect(sheet).toContainText('طالب اصطناعي');
  await expect(sheet).toContainText('لا يوجد لهذا الطالب سجل تعليمي محفوظ، لذلك سيتم حذف الطالب من ركيز.');
  await expect(sheet).toContainText('لن يظهر ضمن «الطلاب السابقون»');
  await expect(sheet).not.toContainText(/نهائيًا|كل أثر|كل الأجهزة|تراجع|NOT_PRISTINE|student:/);
  await sheet.getByRole('button', { name: 'حذف الطالب', exact: true }).click();
}
async function removeStudent(page) {
  await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
  await page.getByRole('button', { name: 'إزالة الطالب من الفصل', exact: true }).click();
}
async function settleCloudSync(page) {
  // Context writes schedule a debounced run: an idle snapshot alone is not readiness.
  // Complete the real Sync path, which also drains its scheduled bootstrap timer.
  await expect.poll(() => page.evaluate(async () => {
    if (!await window.__syncModule.syncAll({ full: true })) return false;
    const summary = await window.__syncModule.getSyncOperationalSummary();
    return summary.cloudSyncHealthy && !summary.automaticSyncActive &&
      !summary.automaticRetryActive && summary.queuedCount === 0 && summary.safeToContinueUnrelatedWork;
  })).toBe(true);
}
async function historicalData(page) {
  return page.evaluate(async id => {
    const db = await import('/src/lib/db.js');
    return Object.fromEntries(await Promise.all(['attendance', 'scores', 'logs', 'notes', 'closedTermReports'].map(async name => [name, await db.getAll(name)])));
  }, f.student);
}

test('signed-out review names authentication, with no destructive fallback or RPC', async ({ page }) => {
  await page.evaluate(async () => (await import('/src/lib/cloud.js')).setMockAuth(null, null));
  await profile(page); await removeStudent(page);
  await expect(page.getByRole('dialog')).toContainText('يلزم تسجيل الدخول إلى الحساب المعني لإتمام هذا الإجراء.');
  await expect(page.locator('[data-management="confirm"], [data-management="sync-preview"]')).toHaveCount(0);
  expect(previews).toHaveLength(0); expect(backend.calls).toHaveLength(0);
});

test('new local student requires acknowledgement; explicit Sync re-previews, never auto-deletes', async ({ page }) => {
  await settleCloudSync(page);
  // This case exercises manual Sync, not a click racing an already running auto Sync.
  // Pause the debounce clock before creating the unsynced fixture; RPC remains real.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/apply_sync_v2_mutation`, async route => { await gate; await route.fallback(); });
  const id = await page.evaluate(async section => (await window.store.addStudent(section, 'طالب جديد اصطناعي')).id, f.section);
  await page.evaluate(({ id, teaching }) => { location.hash = `/student/${id}?teaching=${teaching}`; }, { id, teaching: f.teaching });
  await page.clock.runFor(50); // Render the route without reaching the 900ms auto-Sync debounce.
  await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
  await page.clock.runFor(50); // Finish the sheet's opening animation frame.
  await page.getByRole('button', { name: 'إزالة الطالب من الفصل', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('تحتاج بيانات الطالب إلى المزامنة أولًا قبل إزالته.');
  expect(previews).toHaveLength(0); expect(backend.calls).toHaveLength(0);
  await expect(page.locator('[data-management="confirm"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'مزامنة الآن', exact: true }).click(); release();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('حذف هذا الطالب؟');
  expect(previews.at(-1).outcome).toBe('delete_pristine'); expect(backend.calls).toHaveLength(0);
  expect(await page.evaluate(id => window.store.getStudent(id).serverRevision, id)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  expect(await page.evaluate(id => !!window.store.getStudent(id), id)).toBe(true);
  expect(errors).toEqual([]);
});

test('actual Demo package uses a precise local-only block, never cloud lifecycle', async ({ page }) => {
  const ids = await page.evaluate(async () => {
    const pkg = await (await import('/src/lib/demo.js')).createDemoPackage();
    const student = window.store.state.students.find(s => s.id.startsWith('demo:') && window.store.activeEnrollment(s.id)?.sectionId === pkg.section.id);
    return { student: student.id, teaching: pkg.teaching.id };
  });
  await page.goto(`/#/student/${ids.student}?teaching=${ids.teaching}`);
  await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
  await page.getByRole('button', { name: 'إزالة الطالب من الفصل', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('هذا طالب في فصل تجريبي محلي. يمكن حذف الفصل التجريبي من إدارة الفصول.');
  await expect(page.locator('[data-management="confirm"], [data-management="sync-preview"]')).toHaveCount(0);
  expect(previews).toHaveLength(0); expect(backend.calls).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('genuine unavailable RPC is informational only and exposes no server details', async ({ page }) => {
  await profile(page);
  await settleCloudSync(page);
  let unavailableCalls = 0;
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/preview_student_removal`, route => {
    unavailableCalls++;
    return route.fulfill({ status: 503, json: { message: 'PRIVATE synthetic server error' } });
  });
  await removeStudent(page);
  await expect(page.getByRole('dialog')).toContainText('تعذر التحقق من نتيجة الإزالة الآن. تحقق من الاتصال وحدّث البيانات ثم حاول مرة أخرى.');
  await expect(page.getByRole('dialog')).not.toContainText(/PRIVATE|503|student:|enrollment:/);
  await expect(page.locator('[data-management="confirm"], [data-management="sync-preview"]')).toHaveCount(0);
  expect(backend.calls).toHaveLength(0);
  expect(unavailableCalls).toBe(1, 'the intended unavailable RPC must actually be reached');
});

test('pristine delete uses the real authoritative command, no cascade or false erasure promise, and survives reload', async ({ page }) => {
  const sheet = await profile(page);
  await expect(sheet.getByRole('button', { name: 'حذف الطالب', exact: true })).not.toBeVisible();
  await confirmDelete(page);
  await expect(page.getByRole('status')).toContainText('تم حذف الطالب المضاف بالخطأ.');
  expect(backend.calls).toHaveLength(1);
  expect(backend.calls[0].command).toBe('delete_pristine');
  await page.getByRole('button', { name: 'العودة للكشف' }).click();
  await expect(page).toHaveURL(new RegExp(`/teaching/${f.teaching}/students$`));
  await expect(page.locator('.roster-list a[href*="' + f.student + '"]')).toHaveCount(0);
  await expect(page.locator('.management-empty .empty__title')).toContainText('لا طلاب في');
  await page.reload();
  expect(await page.evaluate(id => window.store.getStudent(id), f.student)).toBeNull();
  expect((await pg.query(`select deleted_at from rakeezx.students where id=$1`, [f.student])).rows[0].deleted_at).toBeTruthy();
  expect(previews[0].outcome).toBe('delete_pristine');
  await page.goto('/#/archive');
  await page.getByRole('link', { name: 'الطلاب السابقون', exact: true }).click();
  await expect(page.locator('.former-students-page')).toContainText('لا يوجد طلاب سابقون');
  await expect(page.locator('.former-student-row')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const kind of ['attendance', 'scores', 'notes', 'logs', 'closed-term-report']) {
  test(`${kind} previews preserved-history removal and remains readable in Former Students`, async ({ page }) => {
    await evidence(pg, f, kind);
    await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
    await page.evaluate(async () => window.__syncModule.syncAll({ full: true }));
    await profile(page);
    await removeStudent(page);
    const sheet = page.getByRole('dialog', { name: 'إزالة الطالب من الفصل؟', exact: true });
    await expect(sheet).toContainText('لدى الطالب سجل محفوظ. سيتم إزالته من الفصل الحالي مع الاحتفاظ بحضوره ودرجاته وسجله السابق.');
    await expect(sheet).toContainText('سيظهر الطالب لاحقًا ضمن «الطلاب السابقون».');
    await expect(sheet.getByRole('button', { name: 'حذف الطالب', exact: true })).toHaveCount(0);
    const before = await historicalData(page);
    expect(previews[0].outcome).toBe('end_enrollment');
    expect(backend.calls).toHaveLength(0);
    await page.getByRole('button', { name: 'إزالة من الفصل', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('تمت إزالة الطالب من الفصل مع الاحتفاظ بسجله السابق.');
    expect(await historicalData(page)).toEqual(before);
    expect(await page.evaluate(id => ({ student: window.store.getStudent(id).id, enrollment: window.store.activeEnrollment(id) }), f.student)).toEqual({ student: f.student, enrollment: null });
    await page.getByRole('button', { name: 'العودة إلى ملف الطالب' }).click();
    await expect(page.locator('.banner-closed')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('انتهى الانتساب الحالي. السجل السابق متاح للعرض.');
    await expect(page.getByRole('dialog').locator('[data-management="remove"], [data-management="transfer"]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).not.toContainText(/أعده للدراسة|استعادة الطالب|NOT_PRISTINE|membership-history/);
    expect(await historicalData(page)).toEqual(before);
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.goto('/#/archive');
    await page.getByRole('link', { name: 'الطلاب السابقون', exact: true }).click();
    const former = page.locator('.former-student-row');
    await expect(former).toContainText('طالب اصطناعي');
    await expect(former).toContainText('انتهى في');
    await former.getByRole('link', { name: 'عرض سجل طالب اصطناعي', exact: true }).click();
    await expect(page.locator('.banner-closed')).toBeVisible();
    expect(await historicalData(page)).toEqual(before);
    await expect(page.locator('[data-act="reinstate"]')).toHaveCount(0);
    await page.goto(`/#/teaching/${f.teaching}/students`);
    await expect(page.locator('.roster-list a[href*="' + f.student + '"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('archived source preview is blocked with no destructive action or command', async ({ page }) => {
  await evidence(pg, f, 'archived');
  await profile(page);
  await removeStudent(page);
  await expect(page.getByRole('dialog')).toContainText('لا يمكن تنفيذ الإجراء على فصل مؤرشف.');
  expect(backend.calls).toHaveLength(0);
  expect((await pg.query(`select deleted_at from rakeezx.students where id=$1`, [f.student])).rows[0].deleted_at).toBeNull();
  await expect(page.locator('[data-management="confirm"]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toContainText(/تم إنهاء|ARCHIVED_ENROLLMENT/);
  expect(await page.evaluate(id => window.store.activeEnrollment(id)?.id, f.student)).toBe(f.enrollment);
  expect(errors).toEqual([]);
});

test('stale source never ends a newer transfer, with safe messaging and unchanged educational history', async ({ page }) => {
  await evidence(pg, f, 'scores');
  await profile(page);
  await removeStudent(page);
  await expect(page.getByRole('dialog')).toHaveAccessibleName('إزالة الطالب من الفصل؟');
  await backend.applySyncV2EnrollmentCommand({ mutationId: 'synthetic-other-device', deviceId: 'synthetic-b', command: 'transfer', payload: { studentId: f.student, sourceEnrollmentId: f.enrollment, destinationEnrollmentId: 'synthetic-destination-enrollment', destinationSectionId: f.destination, date: '2026-09-01' }, clientUpdatedAt: Date.now() });
  await page.getByRole('button', { name: 'إزالة من الفصل', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('تغيرت حالة الطالب على جهاز آخر. حدّث البيانات ثم حاول مرة أخرى.');
  await expect(page.getByRole('dialog')).not.toContainText(/تم إنهاء|STALE_SOURCE|synthetic-|enrollment:/);
  expect(await page.evaluate(id => window.store.activeEnrollment(id)?.sectionId, f.student)).toBe(f.destination);
  expect((await pg.query(`select count(*)::int n from rakeezx.scores where student_id=$1`, [f.student])).rows[0].n).toBe(1);
  expect(errors).toEqual([]);
});

test('offline action never mutates; cancellation/Escape restores focus and keyboard trap works', async ({ page, context }) => {
  await profile(page);
  await removeStudent(page);
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'إدارة الطالب', exact: true })).toBeVisible();
  await context.setOffline(true);
  await removeStudent(page);
  await expect(page.getByRole('dialog')).toContainText('يلزم الاتصال بالإنترنت لإتمام هذا الإجراء.');
  expect(backend.calls).toHaveLength(0);
  expect(await page.evaluate(id => window.store.activeEnrollment(id)?.id, f.student)).toBe(f.enrollment);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'إدارة الطالب', exact: true })).toBeFocused();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test('existing transfer picker from management keeps identity and history after reload', async ({ page }) => {
  await evidence(pg, f, 'notes');
  await page.evaluate(async () => window.__syncModule.syncAll({ full: true }));
  const before = await historicalData(page);
  await profile(page);
  await page.getByRole('button', { name: 'نقل الطالب إلى فصل آخر', exact: true }).click();
  await page.locator(`[data-pick="${f.destination}"]`).click();
  await expect.poll(() => page.evaluate(id => window.store.activeEnrollment(id)?.sectionId, f.student)).toBe(f.destination);
  expect(await historicalData(page)).toEqual(before);
  await page.reload();
  expect(await page.evaluate(id => window.store.activeEnrollment(id)?.sectionId, f.student)).toBe(f.destination);
  expect(await historicalData(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('stale pristine preview transitions to preserved-history confirmation without automatic ending', async ({ page }) => {
  await profile(page);
  await removeStudent(page);
  await expect(page.getByRole('dialog')).toHaveAccessibleName('حذف هذا الطالب؟');
  expect(backend.calls).toHaveLength(0);
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/apply_student_lifecycle_command`, async route => {
    if (route.request().postDataJSON().p_command === 'delete_pristine') await evidence(pg, f, 'notes');
    await route.fallback();
  });
  await page.getByRole('button', { name: 'حذف الطالب', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('إزالة الطالب من الفصل؟');
  await expect(page.getByRole('dialog')).toContainText('لدى الطالب سجل محفوظ، ولم يُحذف.');
  await expect(page.getByRole('dialog')).not.toContainText(/تم حذف|NOT_PRISTINE|private|synthetic/);
  expect(backend.calls).toHaveLength(1);
  expect((await pg.query(`select deleted_at from rakeezx.students where id=$1`, [f.student])).rows[0].deleted_at).toBeNull();
  expect(await page.evaluate(id => !!window.store.activeEnrollment(id), f.student)).toBe(true);
  await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
  await page.getByRole('button', { name: 'إزالة من الفصل', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('تمت إزالة الطالب من الفصل مع الاحتفاظ بسجله السابق.');
  expect(backend.calls.map(call => call.command)).toEqual(['delete_pristine', 'end_enrollment']);
  expect(errors).toEqual([]);
});

test('read-only preview can be dismissed with Escape while waiting, with no lifecycle command', async ({ page }) => {
  let release, started;
  const requested = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/preview_student_removal`, async route => {
    started(); await gate; await route.fallback();
  });
  await profile(page);
  await removeStudent(page);
  await requested;
  await expect(page.getByRole('status')).toContainText('جارٍ التحقق من نتيجة الإزالة…');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'إدارة الطالب', exact: true })).toBeFocused();
  release();
  await expect.poll(() => previews.length).toBe(1);
  await expect(page.getByRole('button', { name: 'إدارة الطالب', exact: true })).toBeFocused();
  expect(backend.calls).toHaveLength(0);
  expect(await page.evaluate(id => !!window.store.activeEnrollment(id), f.student)).toBe(true);
});

test('local-only retained evidence never presents pristine deletion; preview makes no lifecycle writes', async ({ page }) => {
  await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
  await page.evaluate(async id => (await import('/src/lib/db.js')).put('submissions', { id: 'synthetic-local', studentId: id, deleted: true }), f.student);
  await profile(page);
  await removeStudent(page);
  await expect(page.getByRole('dialog')).toHaveAccessibleName('إزالة الطالب من الفصل؟');
  await expect(page.getByRole('button', { name: 'حذف الطالب', exact: true })).toHaveCount(0);
  expect(previews[0].outcome).toBe('delete_pristine'); // Server has no submissions; runtime safely overrides.
  expect(backend.calls).toHaveLength(0);
  expect((await pg.query(`select count(*)::int n from rakeezx.student_lifecycle_receipts`)).rows[0].n).toBe(0);
  expect(await page.evaluate(() => window.store.state.device.studentLifecycleResume ?? null)).toBeNull();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  expect(errors).toEqual([]);
});

test('Former Students excludes active, transferred-active and tombstoned students; long read-only history is responsive', async ({ page }, testInfo) => {
  await evidence(pg, f, 'notes');
  await profile(page); await removeStudent(page);
  await page.getByRole('button', { name: 'إزالة من الفصل', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('تمت إزالة الطالب من الفصل');
  await page.getByRole('button', { name: 'العودة إلى ملف الطالب' }).click();
  const active = await academicFixture(pg, 'synthetic-active');
  const transferred = await academicFixture(pg, 'synthetic-transferred');
  await backend.applySyncV2EnrollmentCommand({ mutationId: 'synthetic-transfer-list', deviceId: 'synthetic-b', command: 'transfer', payload: { studentId: transferred.student, sourceEnrollmentId: transferred.enrollment, destinationEnrollmentId: 'synthetic-transfer-destination', destinationSectionId: transferred.destination, date: '2026-09-01' }, clientUpdatedAt: Date.now() });
  const deleted = await academicFixture(pg, 'synthetic-deleted');
  await backend.applyStudentLifecycleCommand({ mutationId: 'synthetic-delete-list', deviceId: 'synthetic-b', command: 'delete_pristine', payload: { studentId: deleted.student }, clientUpdatedAt: Date.now() });
  for (let i = 0; i < 18; i++) {
    const former = await academicFixture(pg, `synthetic-former-${i}`);
    await pg.query(`update rakeezx.students set name=$2,status='withdrawn' where id=$1`, [former.student, `طالب سابق اصطناعي ذو اسم طويل للتحقق من القراءة ${i}`]); await pg.query(`update rakeezx.sections set label='أ',name='فصل سابق اصطناعي' where id=$1`, [former.section]);
    await pg.query(`update rakeezx.enrollments set status='withdrawn',end_date='2026-09-01' where id=$1`, [former.enrollment]);
  }
  await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
  await page.evaluate(async () => window.__syncModule.syncAll({ full: true }));
  await page.goto('/#/archive');
  await page.getByRole('link', { name: 'الطلاب السابقون', exact: true }).click();
  await expect(page.locator('.former-student-row')).toHaveCount(19);
  for (const id of [active.student, transferred.student, deleted.student]) await expect(page.locator(`.former-student-row a[href*="${encodeURIComponent(id)}"]`)).toHaveCount(0);
  for (const width of [320, 390, 412, 1280, 1440]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.former-students-page button')).toHaveCount(0);
    await expect(page.locator('.former-students-page')).not.toContainText(/أعده للدراسة|استعادة الطالب|اختيار فصل|synthetic-|student:|enrollment:/);
    for (const link of await page.locator('.former-student-row a').all()) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('.former-students-page').analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`former-${width}-${theme}.png`), animations: 'disabled' });
  }
  await page.getByRole('link', { name: 'عرض سجل طالب اصطناعي', exact: true }).click();
  await expect(page.locator('.banner-closed')).toBeVisible();
  await expect(page.locator('[data-act="reinstate"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('management/confirmation is accessible and calm at mobile/desktop widths in both themes', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 412, 1280, 1440]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    await profile(page);
    await expect(page.getByRole('button', { name: 'إزالة الطالب من الفصل', exact: true })).toBeVisible();
    await expect(page.locator('[data-management]')).toHaveCount(2);
    for (const state of ['choose', 'confirm']) {
      if (state === 'confirm') {
        await removeStudent(page);
        await expect(page.getByRole('dialog')).toHaveAccessibleName('حذف هذا الطالب؟');
        await expect(page.getByRole('button', { name: 'إلغاء', exact: true })).toBeFocused();
      }
      const sheet = page.getByRole('dialog');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      for (const control of await sheet.locator('button:visible, summary:visible').all()) {
        await expect.poll(async () => (await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      expect((await new AxeBuilder({ page }).include('.sheet').analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${state}-${width}-${theme}.png`), animations: 'disabled' });
    }
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'حذف الطالب', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(sheet.getByRole('button', { name: 'إغلاق', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'إدارة الطالب', exact: true })).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test('Student Management polish keeps long Arabic context and both consequences calm and accessible', async ({ page }, testInfo) => {
  const name = 'عبدالله محمد عبدالرحمن أحمد يوسف عبدالعزيز الطالب الاصطناعي';
  await pg.query(`update rakeezx.students set name=$2 where id=$1`, [f.student, name]);
  await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
  await page.evaluate(async () => window.__syncModule.syncAll({ full: true }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const consequence of ['delete', 'end']) {
    if (consequence === 'end') {
      await evidence(pg, f, 'notes');
      await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
      await page.evaluate(async () => window.__syncModule.syncAll({ full: true }));
    }
    for (const width of [320, 390, 412, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      await profile(page, name);
      const entry = page.locator('.student-profile-management');
      expect((await entry.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(entry.locator('svg')).toHaveCount(1);
      const person = page.locator('.student-management__person');
      await expect(person.locator('strong')).toHaveText(name);
      await page.evaluate(() => document.fonts.ready);
      const title = person.locator('strong'), classContext = person.locator(':scope > span');
      const titleBox = await title.boundingBox(), classBox = await classContext.boundingBox();
      expect(classBox.y).toBeGreaterThan(titleBox.y + titleBox.height * .7);
      const alignment = await person.evaluate((element) => {
        const titleElement = element.querySelector(':scope > strong');
        const classElement = element.querySelector(':scope > span');
        return {
          direction: getComputedStyle(element).direction,
          textAlign: getComputedStyle(element).textAlign,
          titleAlign: getComputedStyle(titleElement).textAlign,
          classAlign: getComputedStyle(classElement).textAlign,
        };
      });
      expect(alignment).toEqual({ direction: 'rtl', textAlign: 'right', titleAlign: 'right', classAlign: 'right' });
      await expect(page.locator('.student-management__row')).toHaveCount(2);
      if (consequence === 'delete') await page.screenshot({ path: testInfo.outputPath(`polish-choose-${width}-${theme}.png`), animations: 'disabled' });
      await removeStudent(page);
      await expect(page.getByRole('dialog')).toHaveAccessibleName(consequence === 'delete' ? 'حذف هذا الطالب؟' : 'إزالة الطالب من الفصل؟');
      await expect(page.getByRole('button', { name: 'إلغاء', exact: true })).toBeFocused();
      const sheet = page.getByRole('dialog');
      expect((await sheet.boundingBox()).width).toBeLessThanOrEqual(520);
      expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('[data-management="confirm"]')).toHaveClass(consequence === 'delete' ? /btn--danger/ : /btn--primary/);
      expect((await new AxeBuilder({ page }).include('.sheet').analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`polish-${consequence}-${width}-${theme}.png`), animations: 'disabled' });
      await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
      await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
      await expect(entry).toBeFocused();
    }
  }
  expect(backend.calls).toHaveLength(0); expect(errors).toEqual([]);
});

test('Student Management polish reviews precise sync/auth/Demo/blocked/unknown states in both themes', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const state of ['auth', 'Demo', 'sync', 'blocked', 'unknown']) {
    let studentId = f.student, teachingId = f.teaching, release;
    if (state === 'auth') await page.evaluate(async () => (await import('/src/lib/cloud.js')).setMockAuth(null, null));
    else await page.evaluate(async owner => (await import('/src/lib/cloud.js')).setMockAuth({ id: owner }, { access_token: 'student-ui-test' }), OWNER);
    if (state === 'Demo') {
      const demo = await page.evaluate(async () => {
        const pkg = await (await import('/src/lib/demo.js')).createDemoPackage();
        return { student: window.store.state.students.find(s => s.id.startsWith('demo:') && window.store.activeEnrollment(s.id)?.sectionId === pkg.section.id).id, teaching: pkg.teaching.id };
      }); studentId = demo.student; teachingId = demo.teaching;
    }
    if (state === 'sync') {
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(`${SUPABASE_URL}/rest/v1/rpc/apply_sync_v2_mutation`, async route => { await gate; await route.fallback(); });
      studentId = await page.evaluate(async section => (await window.store.addStudent(section, 'طالب غير متزامن اصطناعي')).id, f.section);
    }
    if (state === 'blocked') await evidence(pg, f, 'archived');
    if (state === 'unknown') await page.route(`${SUPABASE_URL}/rest/v1/rpc/preview_student_removal`, route => route.fulfill({ status: 503, json: { message: 'PRIVATE synthetic error' } }));
    const expected = { auth: 'يلزم تسجيل الدخول إلى الحساب المعني', Demo: 'هذا طالب في فصل تجريبي محلي', sync: 'تحتاج بيانات الطالب إلى المزامنة أولًا', blocked: 'لا يمكن تنفيذ الإجراء على فصل مؤرشف', unknown: 'تعذر التحقق من نتيجة الإزالة الآن' }[state];
    for (const width of [320, 390, 412, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      await page.goto(`/#/student/${studentId}?teaching=${teachingId}`);
      await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
      if (state === 'blocked' || state === 'unknown') await settleCloudSync(page);
      await page.getByRole('button', { name: 'إزالة الطالب من الفصل', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'إدارة الطالب', exact: true });
      await expect(sheet).toContainText(expected);
      await expect(sheet.locator('[data-management="confirm"]')).toHaveCount(0);
      await expect(sheet.locator('[data-management="sync-preview"]')).toHaveCount(state === 'sync' ? 1 : 0);
      await expect(sheet).not.toContainText(/PRIVATE|RPC|student:|enrollment:|student_not_synced|demo_local_only|preview_unavailable/);
      expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *')].map(el => ({ tag: el.tagName, class: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(el => el.left < -1 || el.right > innerWidth + 1) }));
      // Collect every responsive state without hiding an out-of-scope page overflow.
      expect.soft(overflow.scrollWidth, JSON.stringify({ state, theme, ...overflow })).toBeLessThanOrEqual(width);
      for (const button of await sheet.locator('button:visible').all()) await expect.poll(async () => (await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect((await new AxeBuilder({ page }).include('.sheet').analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`polish-${state}-${width}-${theme}.png`), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'إدارة الطالب', exact: true })).toBeFocused();
    }
    if (release) {
      release(); await page.unroute(`${SUPABASE_URL}/rest/v1/rpc/apply_sync_v2_mutation`);
      await settleCloudSync(page);
    }
  }
  expect(backend.calls).toHaveLength(0);
  expect(errors.filter(error => !error.includes('503'))).toEqual([]);
});

test('Demo enrollment badge stays readable and contained with short and long Arabic names', async ({ page }, testInfo) => {
  const ids = await page.evaluate(async () => {
    const pkg = await (await import('/src/lib/demo.js')).createDemoPackage();
    const student = window.store.state.students.find(s => s.id.startsWith('demo:') && window.store.activeEnrollment(s.id)?.sectionId === pkg.section.id);
    return { student: student.id, teaching: pkg.teaching.id };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [kind, name] of [['short', 'أحمد محمد'], ['long', 'عبدالله محمد عبدالرحمن أحمد يوسف عبدالعزيز الطالب الاصطناعي']]) {
    await page.evaluate(async ({ id, name }) => window.store.renameStudent(id, name), { id: ids.student, name });
    for (const width of [320, 390, 412, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      await page.goto(`/#/student/${ids.student}?teaching=${ids.teaching}`);
      const header = page.locator('.student-profile-header'), badge = header.locator('.student-profile-header__meta > .badge');
      await expect(header.locator('.student-profile-header__name')).toHaveText(name);
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('الانتساب الحالي');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await badge.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await badge.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
      const bounds = await badge.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect((await new AxeBuilder({ page }).include('.student-profile-header').analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`demo-badge-${kind}-${width}-${theme}.png`), animations: 'disabled' });
    }
  }
  expect(backend.calls).toHaveLength(0); expect(previews).toHaveLength(0); expect(errors).toEqual([]);
});

test('Student Management Arabic name and class share the RTL right start edge', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [kind, name] of [['short', 'تجربة 1'], ['long', 'عبدالله محمد عبدالرحمن أحمد يوسف عبدالعزيز الطالب الاصطناعي']]) {
    await pg.query(`update rakeezx.students set name=$2 where id=$1`, [f.student, name]);
    await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
    await page.evaluate(async () => window.__syncModule.syncAll({ full: true }));
    for (const width of [320, 390, 412, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      const sheet = await profile(page, name), person = sheet.locator('.student-management__person');
      await expect(person.locator('strong')).toHaveText(name);
      for (const [action, title, helper] of [['transfer', 'نقل الطالب إلى فصل آخر', 'مع الاحتفاظ بهويته وسجله'], ['remove', 'إزالة الطالب من الفصل', 'تُعرض النتيجة الآمنة قبل تأكيدك']]) {
        const row = sheet.locator(`[data-management="${action}"]`), text = row.locator('.student-management__row-text');
        await expect(row).toHaveAccessibleName(title);
        await expect(text.locator('strong')).toHaveText(title);
        await expect(text.locator('small')).toHaveText(helper);
        if (kind === 'short' && width === 320 && theme === 'light') await testInfo.attach(`rendered-${action}`, { body: JSON.stringify(await row.evaluate(el => ({ html: el.outerHTML, visibleText: el.innerText, text: el.textContent, icons: [...el.querySelectorAll('svg')].map(svg => ({ namespace: svg.namespaceURI, hidden: svg.getAttribute('aria-hidden'), text: svg.textContent })) })), null, 2), contentType: 'application/json' });
        await expect(row).not.toContainText(/svg/i);
        await expect(row.locator('svg')).toHaveCount(2);
        expect(await row.locator('svg').evaluateAll(icons => icons.every(svg => svg.namespaceURI === 'http://www.w3.org/2000/svg' && svg.getAttribute('aria-hidden') === 'true' && svg.textContent === '' && svg.getBoundingClientRect().width > 0))).toBe(true);
        const titleBox = await text.locator('strong').boundingBox(), helperBox = await text.locator('small').boundingBox();
        expect(helperBox.y - titleBox.y - titleBox.height).toBeGreaterThanOrEqual(4);
        const rawText = await text.textContent();
        expect(rawText).toMatch(new RegExp(`${title}\\s+${helper}`));
        await expect(row.locator('.student-management__row-icon, .student-management__row-chevron')).toHaveCount(2);
        expect(await row.locator('.student-management__row-icon, .student-management__row-chevron').evaluateAll(icons => icons.every(el => el.getAttribute('aria-hidden') === 'true'))).toBe(true);
        if (width === 320) {
          const helperLine = text.locator('small');
          await helperLine.evaluate((el, value) => { el.textContent = value; }, `${helper} ${helper} ${helper}`);
          expect((await helperLine.boundingBox()).height).toBeGreaterThan(helperBox.height);
          expect(await helperLine.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
          expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await helperLine.evaluate((el, value) => { el.textContent = value; }, helper);
        }
      }
      const context = await person.evaluate(el => {
        const metrics = child => {
          const range = document.createRange(); range.selectNodeContents(child);
          const styles = getComputedStyle(child), box = child.getBoundingClientRect();
          return { direction: styles.direction, align: styles.textAlign, top: box.top, bottom: box.bottom, right: Math.max(...[...range.getClientRects()].map(rect => rect.right)) };
        };
        return { name: metrics(el.querySelector('strong')), section: metrics(el.querySelector('span')), right: el.getBoundingClientRect().right, contained: el.scrollWidth <= el.clientWidth };
      });
      for (const line of [context.name, context.section]) {
        expect(line.direction).toBe('rtl'); expect(line.align).toBe('right');
        expect(Math.abs(line.right - context.right)).toBeLessThan(1);
      }
      expect(context.section.top).toBeGreaterThanOrEqual(context.name.bottom);
      const avatar = person.locator('..').locator('.student-management__avatar'), avatarBox = await avatar.boundingBox();
      await expect(avatar).toHaveAttribute('aria-hidden', 'true');
      await expect(avatar.locator('svg')).toHaveCount(1);
      expect(Math.abs(avatarBox.y - context.name.top)).toBeLessThan(1);
      expect(avatarBox.x - context.right).toBeGreaterThanOrEqual(11);
      expect(context.contained).toBe(true);
      expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include('.sheet').analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`context-rtl-${kind}-${width}-${theme}.png`), animations: 'disabled' });
      await sheet.getByRole('button', { name: 'إغلاق', exact: true }).click();
      await expect(page.getByRole('button', { name: 'إدارة الطالب', exact: true })).toBeFocused();
    }
  }
  expect(previews).toHaveLength(0); expect(backend.calls).toHaveLength(0); expect(errors).toEqual([]);
});
