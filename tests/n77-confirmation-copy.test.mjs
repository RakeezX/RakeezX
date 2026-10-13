import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createCloud, authenticated } from './helpers/remote-sync-browser.mjs';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function prepare(page, ids) {
  const transport = createCloud();
  await authenticated(page, transport);
  await page.route('https://*.supabase.co/auth/v1/user', route => route.fulfill({ json: { id: owner } }));
  await page.goto('/#/classes');
  await page.evaluate(async () => { window.__copyStore = await import('/src/store.js'); });
  await page.waitForFunction(() => window.__copyStore?.state.ready);
  await page.evaluate(async (teachingIds) => {
    await (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();
    await window.__copyStore.renewOfflineLease();
    const db = await import('/src/lib/db.js');
    const models = await import('/src/models.js');
    await db.put('sections', models.makeSection({ id: 'copy-section', yearId: 'remote-year', grade: 4, label: '٤/أ' }));
    for (const id of teachingIds) {
      await db.put('teachings', models.makeTeaching({ id, sectionId: 'copy-section', subjectId: 'remote-subject', termId: 'remote-term-1' }));
    }
    await window.__copyStore.init();
  }, ids);
  await page.route('https://*.supabase.co/rest/v1/rpc/n77_delete_teaching', async route => {
    const request = route.request().postDataJSON();
    const scope = ids.length === 1 ? 'section' : 'teaching';
    const planTeachingIds = scope === 'section' ? ids : [request.p_teaching_id];
    await route.fulfill({ json: {
      ownerId: owner,
      selectedTeachingId: request.p_teaching_id,
      sectionId: request.p_expected_section_id,
      scope,
      fingerprint: 'copy-scope-fingerprint',
      teachingIds: planTeachingIds,
      ...request.p_commit ? { outcome: 'deleted', mutationId: request.p_mutation_id, cascadeTeachingIds: planTeachingIds, orphanStudentIds: [] } : {},
    } });
  });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.__copyStore?.state.ready);
  await page.evaluate(async () => {
    await (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();
    await window.__copyStore.renewOfflineLease();
  });
  const dialog = page.getByRole('dialog');
  await page.locator('[data-act="delete-class-flow"]').click();
  await dialog.locator(`[data-teaching-id="${ids[0]}"]`).click();
  await dialog.locator('#class-delete-next-btn').click();
  await expect(dialog.locator('#class-delete-confirm-btn')).toBeVisible();
  return dialog;
}

async function checkSubject(page) {
  const dialog = await prepare(page, ['copy-subject-one', 'copy-subject-two']);
  await expect(dialog.locator('.sheet__title')).toHaveText('تأكيد حذف المادة من الفصل');
  await expect(dialog.locator('.sheet__desc')).toBeHidden();
  await expect(dialog.locator('.class-delete-row__title')).toContainText('٤/أ');
  await expect(dialog.locator('.class-delete-row__sub')).toHaveText('Synthetic subject');
  await expect(dialog.locator('.class-delete-confirm-box__consequence')).toHaveText('ستُحذف هذه المادة ودرجاتها وحصصها وحضورها وملاحظاتها. سيبقى الفصل وطلابه وبقية المواد.');
  await expect(dialog.locator('.class-delete-confirm-box__note')).toContainText('يتطلب الحذف اتصالًا بالإنترنت');
  await expect(dialog.locator('.class-delete-confirm-box')).not.toContainText(/تنبيه تأكيد|أنت على وشك حذف|إجراء يتطلب التأكيد/);
  await expect(dialog.locator('#class-delete-back-btn')).toBeVisible();
  await expect(dialog.locator('#class-delete-confirm-btn')).toBeVisible();
  await dialog.locator('#class-delete-back-btn').click();
  await expect(dialog.locator('.sheet__desc')).toBeVisible();
  await expect(dialog.locator('.sheet__desc')).toHaveText('اختر الفصل الذي ترغب في حذفه من القائمة:');
  await expect(dialog.locator('#class-delete-next-btn')).toBeVisible();
}

async function checkFinalClass(page) {
  const dialog = await prepare(page, ['copy-final-class']);
  await expect(dialog.locator('.sheet__title')).toHaveText('تأكيد حذف الفصل كاملًا');
  await expect(dialog.locator('.class-delete-confirm-box__consequence')).toHaveText('هذه آخر مادة في الفصل؛ سيُحذف الفصل ودرجاته وحصصه وحضوره وملاحظاته.');
  await expect(dialog.locator('.class-delete-confirm-box__note')).toContainText('ستبقى سجلات الطلاب في الفصول الأخرى محفوظة');
  await expect(dialog.locator('#class-delete-confirm-btn')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.__copyStore.getTeaching('copy-final-class') != null)).toBe(true);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const check of [checkSubject, checkFinalClass]) {
    const context = await browser.newContext({ baseURL: process.env.RAKEEZX_E2E_BASE_URL || 'http://127.0.0.1:5173' });
    const page = await context.newPage();
    try { await check(page); }
    finally { await context.close(); }
  }
  console.log('PASS N77 subject/final-class confirmation UI, identity, Back and no-commit checks');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
