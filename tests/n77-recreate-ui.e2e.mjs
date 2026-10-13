import { test, expect } from '@playwright/test';
import { createCloud, authenticated } from './helpers/remote-sync-browser.mjs';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function account(page) {
  await authenticated(page, createCloud());
  await page.route('https://*.supabase.co/auth/v1/user', r => r.fulfill({ json: { id: OWNER } }));
  await page.goto('/#/classes'); await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async () => {
    await (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();
    await window.store.renewOfflineLease();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  });
}
async function create(page, subject = 'القرآن والإسلامية') {
  await page.locator('[data-act="add"]').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name="grade"]').selectOption('4');
  await dialog.locator('[name="label"]').fill('1');
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.getByRole('option', { name: subject, exact: true }).click();
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  return dialog;
}
async function syntheticDelete(page, teachingId, scope) {
  // Exercise actual local receipt handling with a synthetic server receipt.
  // Native test independently certifies real PostgreSQL delete/creation RPCs.
  await page.evaluate(async ({ teachingId, scope, owner }) => {
    const db = await import('/src/lib/db.js'), s = window.store;
    const { localDeleteWrites } = await import('/src/lib/n77-delete.js');
    const sectionId = s.getTeaching(teachingId).sectionId;
    const receipt = { ownerId: owner, mutationId: 'synthetic-delete:' + teachingId, selectedTeachingId: teachingId,
      sectionId, scope, teachingIds: [teachingId], cascadeTeachingIds: [teachingId], orphanStudentIds: [], fingerprint: 'synthetic' };
    await db.patchMany('device', [{ id: 'device', changes: { n77DeleteIntent: { mutationId: receipt.mutationId } } }]);
    const batch = Object.fromEntries(db.STORES.map(name => [name, {}]));
    await db.applyBatch(batch, { allowStudentLifecycle: true, prepare(current) { return localDeleteWrites(current, receipt, Date.now()); } });
    await s.refreshSyncedState();
    (await import('/src/repaint.js')).repaint();
  }, { teachingId, scope, owner: OWNER });
}
test('actual N13 create form recreates fourth/1 Islamic Studies after subject and whole-class deletion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await account(page);
  await expect(await create(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(1);
  const first = await page.evaluate(() => window.store.teachings()[0]);
  await page.evaluate(async section => { await window.store.addStudent(section, 'طالب اصطناعي'); }, first.sectionId);
  await expect(await create(page, 'العلوم')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(2);
  await syntheticDelete(page, first.id, 'teaching');
  await expect(await create(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(2);
  const fresh = await page.evaluate(first => {
    const s = window.store, t = s.teachings().find(t => t.subjectId === first.subjectId);
    return { id: t.id, section: t.sectionId, roster: s.students(t.id).length, defaults: s.items(t.id).length,
      oldDeleted: s.state.teachings.find(t => t.id === first.id).deleted };
  }, first);
  expect(fresh.id).not.toBe(first.id); expect(fresh).toMatchObject({ section: first.sectionId, roster: 1, defaults: 5, oldDeleted: true });
  const before = await page.evaluate(async () => { const db = await import('/src/lib/db.js'); return Object.fromEntries(await Promise.all(db.STORES.map(async n => [n, await db.getAll(n)]))); });
  const duplicate = await create(page); await expect(duplicate).toBeVisible();
  await expect(page.locator('#toast')).toContainText('هذه المادة موجودة مسبقًا');
  expect(await page.evaluate(async () => { const db = await import('/src/lib/db.js'); return Object.fromEntries(await Promise.all(db.STORES.map(async n => [n, await db.getAll(n)]))); })).toEqual(before);
  await duplicate.getByRole('button', { name: 'إلغاء', exact: true }).click();
  const science = await page.evaluate(id => window.store.teachings().find(t => t.id !== id).id, fresh.id);
  await syntheticDelete(page, science, 'teaching'); await syntheticDelete(page, fresh.id, 'section');
  await expect(await create(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(1);
  expect(await page.evaluate(old => {
    const s = window.store, t = s.teachings()[0];
    return { freshSection: t.sectionId !== old.sectionId, freshTeaching: t.id !== old.id, roster: s.students(t.id).length,
      defaults: s.items(t.id).length, oldDeleted: s.state.sections.find(x => x.id === old.sectionId).deleted };
  }, first)).toEqual({ freshSection: true, freshTeaching: true, roster: 0, defaults: 5, oldDeleted: true });
  const card = page.locator('.class-card').first(); await expect(card).toBeVisible();
  expect(await card.evaluate(el => getComputedStyle(el).display)).not.toBe('none');
});
