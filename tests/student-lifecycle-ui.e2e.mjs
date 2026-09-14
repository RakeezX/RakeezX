import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { lifecycleServer, academicFixture, evidence, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';

test.setTimeout(120_000);
let pg, backend, f, errors, failReconciliation, previews;
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
  await page.goto('/#/classes');
  await page.waitForFunction(studentId => window.store?.state.ready && window.store.getStudent(studentId) && window.__syncModule?.getSyncOperationalSummarySnapshot().cloudSyncHealthy, f.student);
  await page.evaluate(async f => window.store.patchDevice({ activeYearId: f.year, activeTermId: f.term }), f);
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

async function profile(page) {
  await page.goto(`/#/student/${f.student}?teaching=${f.teaching}`);
  await expect(page.locator('.student-profile-header__name')).toHaveText('طالب اصطناعي');
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
  await page.waitForFunction(() => !window.__syncModule.getSyncOperationalSummarySnapshot().automaticSyncActive);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/apply_sync_v2_mutation`, async route => { await gate; await route.fallback(); });
  const id = await page.evaluate(async section => (await window.store.addStudent(section, 'طالب جديد اصطناعي')).id, f.section);
  await page.goto(`/#/student/${id}?teaching=${f.teaching}`);
  await page.getByRole('button', { name: 'إدارة الطالب', exact: true }).click();
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
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/preview_student_removal`, route => route.fulfill({ status: 503, json: { message: 'PRIVATE synthetic server error' } }));
  await profile(page); await removeStudent(page);
  await expect(page.getByRole('dialog')).toContainText('تعذر التحقق من نتيجة الإزالة الآن. تحقق من الاتصال وحدّث البيانات ثم حاول مرة أخرى.');
  await expect(page.getByRole('dialog')).not.toContainText(/PRIVATE|503|student:|enrollment:/);
  await expect(page.locator('[data-management="confirm"], [data-management="sync-preview"]')).toHaveCount(0);
  expect(backend.calls).toHaveLength(0);
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
